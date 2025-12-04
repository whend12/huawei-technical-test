const fs = require("fs");
const path = require("path");
const cron = require("node-cron");

let fetchFn = global.fetch;
if (!fetchFn) {
  try {
    fetchFn = require("node-fetch");
  } catch {
    throw new Error("Install node-fetch: npm i node-fetch@2");
  }
}

const OUTDIR = process.env.OUTDIR || path.join(process.cwd(), "home", "cron");

if (!fs.existsSync(OUTDIR)) {
  fs.mkdirSync(OUTDIR, { recursive: true });
  console.log("Created OUTDIR:", OUTDIR);
}

function baseNameNowMMDDYYYY() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const yyyy = now.getFullYear();
  const HH = String(now.getHours()).padStart(2, "0");
  const MM = String(now.getMinutes()).padStart(2, "0");
  return `cron_${mm}${dd}${yyyy}_${HH}.${MM}`;
}

function jsonToCsv(rows, headers) {
  const esc = (v) => {
    const s = v == null ? "" : String(v);
    const needWrap = /[",\r\n]/.test(s);
    const body = s.replace(/"/g, '""');
    return needWrap ? `"${body}"` : body;
  };
  const headerLine = headers.map(esc).join(",");
  const lines = rows.map((r) => headers.map((h) => esc(r[h])).join(","));
  return "\uFEFF" + [headerLine, ...lines].join("\r\n");
}

async function collectOnce() {
  const API_URL = process.env.API_URL || "http://localhost:3000/api/v1/form";
  const base = path.join(OUTDIR, baseNameNowMMDDYYYY());
  const csvPath = `${base}.csv`;

  try {
    console.log(new Date().toISOString(), "Fetching:", API_URL);
    const res = await fetchFn(API_URL);

    console.log(new Date().toISOString(), "HTTP status:", res.status);

    const text = await res.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch (err) {
      console.error("Response is not JSON. Body:", text);
      throw new Error(`Unexpected response format (status ${res.status})`);
    }

    if (!res.ok) {
      console.error("Non-OK response:", res.status, payload);
      throw new Error(`HTTP ${res.status}`);
    }

    const rows = Array.isArray(payload?.data) ? payload.data : [];

    let headers;
    if (rows.length > 0) {
      const firstKeys = Object.keys(rows[0]);
      const pref = ["id", "name", "email", "phone", "createdAt"];
      const ordered = pref.concat(firstKeys.filter((k) => !pref.includes(k)));
      headers = [...new Set(ordered)];
    } else {
      headers = ["id", "name", "email", "phone", "createdAt"];
    }

    const csv = jsonToCsv(rows, headers);
    fs.writeFileSync(csvPath, csv, "utf8");
  } catch (e) {
    console.error(new Date().toISOString(), "Collect error:", e.message);
  }
}

function cleanupOldFiles() {
  const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const regex = /^cron_\d{8}_\d{2}\.\d{2}\.csv$/;
  try {
    for (const name of fs.readdirSync(OUTDIR)) {
      if (!regex.test(name)) continue;
      const fp = path.join(OUTDIR, name);
      try {
        const age = now - fs.statSync(fp).mtimeMs;
        if (age > THIRTY_DAYS) {
          fs.unlinkSync(fp);
          console.log(new Date().toISOString(), "Deleted:", name);
        }
      } catch (errFile) {
        console.error("File check error:", name, errFile.message);
      }
    }
  } catch (err) {
    console.error("Cleanup dir error:", err.message);
  }
}

cron.schedule("0 8,12,15 * * *", collectOnce, { timezone: "Asia/Jakarta" });

cron.schedule("0 3 * * *", cleanupOldFiles, { timezone: "Asia/Jakarta" });

collectOnce();
