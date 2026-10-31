const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Welcome to my Node.js and Express server!");
});

app.get("/about", (req, res) => {
  res.json({
    name: "Vasireddy Mitesh Sai",
    registrationNumber: "252U1R1250",
    section: "[Insert your section]",
  });
});

app.get("/time", (req, res) => {
  res.json({
    currentDateTime: new Date().toISOString(),
  });
});

app.use((req, res) => {
  res.status(404).send("404 - Page not found");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
