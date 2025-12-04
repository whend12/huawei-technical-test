const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

let formStorage = [];
let counterId = 1;

app.post("/api/v1/form", (req, res) => {
  const { name, email, phone } = req.body || {};

  if (!name || !email) {
    return res.status(400).json({
      success: false,
      message: "Field 'name' and 'email' are required.",
    });
  }

  const record = {
    id: counterId++,
    name: name,
    email: email,
    phone: phone || "",
    createdAt: new Date().toISOString(),
  };

  formStorage.push(record);

  return res.status(201).json({
    success: true,
    data: record,
  });
});

app.get("/api/v1/form", (req, res) => {
  res.json({
    success: true,
    data: formStorage,
  });
});

app.get("/api/v1/form/:id", (req, res) => {
  const id = Number(req.params.id);
  const detail = formStorage.find((item) => item.id === id);

  if (!detail) {
    return res.status(404).json({
      success: false,
      message: "Data not found.",
    });
  }

  res.json({
    success: true,
    data: detail,
  });
});

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

app.listen(PORT, () => {
  console.log(`Server aktif di http://localhost:${PORT}`);
});
