const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const databasePath = path.join(__dirname, "books.db");

app.use(express.json());

let database;

const createBooksTable = `
  CREATE TABLE IF NOT EXISTS book (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    price INTEGER NOT NULL,
    pages INTEGER NOT NULL
  )
`;

const isValidBook = (book) =>
  book !== null &&
  typeof book === "object" &&
  !Array.isArray(book) &&
  typeof book.title === "string" &&
  book.title.trim() !== "" &&
  typeof book.author === "string" &&
  book.author.trim() !== "" &&
  Number.isInteger(book.price) &&
  book.price >= 0 &&
  Number.isInteger(book.pages) &&
  book.pages > 0;

const getBookId = (value) => {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const addQuestionMarks = (query) => {
  let number = 0;
  return query.replace(/\?/g, () => {
    number += 1;
    return `$${number}`;
  });
};

// Use hosted Neon Postgres on Vercel and the local SQLite file for coursework.
const connectToNeon = async () => {
  const { neon } = require("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL);

  database = {
    all: (query, values = []) => sql.query(addQuestionMarks(query), values),

    async get(query, values = []) {
      const rows = await sql.query(addQuestionMarks(query), values);
      return rows[0];
    },

    async run(query, values = []) {
      const postgresQuery = addQuestionMarks(query);
      const rows = await sql.query(`${postgresQuery} RETURNING id`, values);
      return {
        lastID: rows[0] ? rows[0].id : undefined,
        changes: rows.length,
      };
    },
  };
};

const connectToLocalSQLite = async () => {
  const sqlite3 = require("sqlite3");
  const { open } = require("sqlite");

  database = await open({
    filename: databasePath,
    driver: sqlite3.Database,
  });
  await database.exec(createBooksTable);
};

app.get("/books/", async (req, res) => {
  const books = await database.all("SELECT * FROM book ORDER BY id");
  res.json(books);
});

app.get("/books/:bookId/", async (req, res) => {
  const bookId = getBookId(req.params.bookId);
  if (bookId === null) {
    return res.status(400).json({ error: "bookId must be a positive integer" });
  }

  const book = await database.get("SELECT * FROM book WHERE id = ?", [bookId]);
  if (!book) {
    return res.status(404).json({ error: "Book not found" });
  }
  return res.json(book);
});

app.post("/books/", async (req, res) => {
  if (!isValidBook(req.body)) {
    return res.status(400).json({
      error: "Provide a non-empty title and author, a non-negative integer price, and a positive integer pages value",
    });
  }

  const { title, author, price, pages } = req.body;
  const result = await database.run(
    "INSERT INTO book (title, author, price, pages) VALUES (?, ?, ?, ?)",
    [title.trim(), author.trim(), price, pages],
  );
  return res.status(201).json({
    bookId: result.lastID,
    message: "Book added successfully",
  });
});

app.put("/books/:bookId/", async (req, res) => {
  const bookId = getBookId(req.params.bookId);
  if (bookId === null) {
    return res.status(400).json({ error: "bookId must be a positive integer" });
  }
  if (!isValidBook(req.body)) {
    return res.status(400).json({
      error: "Provide a non-empty title and author, a non-negative integer price, and a positive integer pages value",
    });
  }

  const { title, author, price, pages } = req.body;
  const result = await database.run(
    "UPDATE book SET title = ?, author = ?, price = ?, pages = ? WHERE id = ?",
    [title.trim(), author.trim(), price, pages, bookId],
  );
  if (result.changes === 0) {
    return res.status(404).json({ error: "Book not found" });
  }
  return res.json({ message: "Book updated successfully" });
});

app.delete("/books/:bookId/", async (req, res) => {
  const bookId = getBookId(req.params.bookId);
  if (bookId === null) {
    return res.status(400).json({ error: "bookId must be a positive integer" });
  }

  const result = await database.run("DELETE FROM book WHERE id = ?", [bookId]);
  if (result.changes === 0) {
    return res.status(404).json({ error: "Book not found" });
  }
  return res.json({ message: "Book deleted successfully" });
});

app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) {
    return next(error);
  }
  return res.status(500).json({ error: "Internal server error" });
});

const initializeDBAndServer = async () => {
  if (process.env.DATABASE_URL) {
    await connectToNeon();
  } else if (process.env.VERCEL) {
    throw new Error("Set DATABASE_URL to a Neon Postgres connection string in Vercel.");
  } else {
    await connectToLocalSQLite();
  }

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

initializeDBAndServer().catch((error) => {
  console.error("Could not connect to the database or start the server:", error);
  process.exitCode = 1;
});
