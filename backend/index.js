
const express = require("express");
require("dotenv").config();

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("OTP Backend is running!");
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});
