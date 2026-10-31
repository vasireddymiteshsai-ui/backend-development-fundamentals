const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

const app = express();
const PORT = process.env.PORT || 3000;
const databasePath = path.join(__dirname, "books.db");

app.use(express.json());

let database;

const isValidBook = (book) =>
  book !== null &&
  typeof book === "object" &&
  typeof book.title === "string" &&
  book.title.trim().length > 0 &&
  typeof book.author === "string" &&
  book.author.trim().length > 0 &&
  Number.isInteger(book.price) &&
  book.price >= 0 &&
  Number.isInteger(book.pages) &&
  book.pages > 0;

const parseBookId = (value) => {
  const bookId = Number(value);
  return Number.isInteger(bookId) && bookId > 0 ? bookId : null;
};

app.get("/books/", async (req, res, next) => {
  try {
    const books = await database.all("SELECT * FROM book ORDER BY id");
    res.json(books);
  } catch (error) {
    next(error);
  }
});

app.get("/books/:bookId/", async (req, res, next) => {
  const bookId = parseBookId(req.params.bookId);
  if (bookId === null) {
    return res.status(400).json({ error: "bookId must be a positive integer" });
  }

  try {
    const book = await database.get("SELECT * FROM book WHERE id = ?", [bookId]);
    if (!book) {
      return res.status(404).json({ error: "Book not found" });
    }
    return res.json(book);
  } catch (error) {
    return next(error);
  }
});

app.post("/books/", async (req, res, next) => {
  if (!isValidBook(req.body)) {
    return res.status(400).json({
      error: "title and author must be non-empty strings; price must be a non-negative integer; pages must be a positive integer",
    });
  }

  const { title, author, price, pages } = req.body;

  try {
    const result = await database.run(
      "INSERT INTO book (title, author, price, pages) VALUES (?, ?, ?, ?)",
      [title.trim(), author.trim(), price, pages],
    );
    return res.status(201).json({
      bookId: result.lastID,
      message: "Book added successfully",
    });
  } catch (error) {
    return next(error);
  }
});

app.put("/books/:bookId/", async (req, res, next) => {
  const bookId = parseBookId(req.params.bookId);
  if (bookId === null) {
    return res.status(400).json({ error: "bookId must be a positive integer" });
  }
  if (!isValidBook(req.body)) {
    return res.status(400).json({
      error: "title and author must be non-empty strings; price must be a non-negative integer; pages must be a positive integer",
    });
  }

  const { title, author, price, pages } = req.body;

  try {
    const result = await database.run(
      "UPDATE book SET title = ?, author = ?, price = ?, pages = ? WHERE id = ?",
      [title.trim(), author.trim(), price, pages, bookId],
    );
    if (result.changes === 0) {
      return res.status(404).json({ error: "Book not found" });
    }
    return res.json({ message: "Book updated successfully" });
  } catch (error) {
    return next(error);
  }
});

app.delete("/books/:bookId/", async (req, res, next) => {
  const bookId = parseBookId(req.params.bookId);
  if (bookId === null) {
    return res.status(400).json({ error: "bookId must be a positive integer" });
  }

  try {
    const result = await database.run("DELETE FROM book WHERE id = ?", [bookId]);
    if (result.changes === 0) {
      return res.status(404).json({ error: "Book not found" });
    }
    return res.json({ message: "Book deleted successfully" });
  } catch (error) {
    return next(error);
  }
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
  database = await open({
    filename: databasePath,
    driver: sqlite3.Database,
  });

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

initializeDBAndServer().catch((error) => {
  console.error("Failed to initialize the database or start the server:", error);
  process.exitCode = 1;
});
