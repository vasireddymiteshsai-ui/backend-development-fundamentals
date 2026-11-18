const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json()); // Allows Express to read JSON from request.body

const dbPath = path.join(__dirname, "users.db");
const JWT_SECRET = "MY_SECRET_KEY"; // Constant secret key for Lab 4[cite: 1]
let db = null;

// Start the database and Express server
const startServer = async () => {
  db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  // Create the user table automatically[cite: 1]
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user (
      username TEXT UNIQUE,
      name TEXT,
      password TEXT
    );
  `);

  app.listen(3000, () => {
    console.log("Server running at http://localhost:3000/");
  });
};

startServer();

// API 1: Register a new user[cite: 1]
app.post("/register/", async (request, response) => {
  const { username, name, password } = request.body;

  // Step 1: Check if username already exists[cite: 1]
  const checkUserQuery = `SELECT * FROM user WHERE username = ?;`;
  const existingUser = await db.get(checkUserQuery, [username]);

  if (existingUser !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    // Step 2: Hash the password and save user[cite: 1]
    const hashedPassword = await bcrypt.hash(password, 10);
    const insertUserQuery = `
      INSERT INTO user (username, name, password)
      VALUES (?, ?, ?);
    `;
    await db.run(insertUserQuery, [username, name, hashedPassword]);

    response.status(200);
    response.send("User created successfully");
  }
});

// API 2: Login user and return JWT token[cite: 1]
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;

  // Step 1: Check if user exists[cite: 1]
  const checkUserQuery = `SELECT * FROM user WHERE username = ?;`;
  const dbUser = await db.get(checkUserQuery, [username]);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    // Step 2: Compare entered password with stored hash[cite: 1]
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);

    if (isPasswordMatched === true) {
      // Step 3: Create JWT token with ONLY username in payload[cite: 1]
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, JWT_SECRET);

      response.status(200);
      response.send({ jwt_token: jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});