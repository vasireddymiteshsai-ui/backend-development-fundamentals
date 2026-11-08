const path = require("path");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;
const databasePath = path.join(__dirname, "books.db");
let database;

app.use(express.json());

// Keep the column names that users are allowed to sort by.
const allowedSortColumns = ["id", "title", "author", "price", "pages"];

const createBooksTable = `
  CREATE TABLE IF NOT EXISTS book (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    price INTEGER NOT NULL,
    pages INTEGER NOT NULL
  )
`;

// SQLite uses ? placeholders. This changes them to $1, $2 for Neon Postgres.
const changePlaceholdersForNeon = (query) => {
  let number = 0;
  return query.replace(/\?/g, () => {
    number += 1;
    return `$${number}`;
  });
};

const isValidBook = (book) => {
  return (
    book &&
    typeof book.title === "string" &&
    book.title.trim() !== "" &&
    typeof book.author === "string" &&
    book.author.trim() !== "" &&
    Number.isInteger(book.price) &&
    book.price >= 0 &&
    Number.isInteger(book.pages) &&
    book.pages > 0
  );
};

const getBookId = (value) => {
  const id = Number(value);
  if (Number.isInteger(id) && id > 0) {
    return id;
  }
  return null;
};

// Use Neon on Vercel. The same routes also work with SQLite on your computer.
const connectToNeon = () => {
  const { neon } = require("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL);

  return {
    all: (query, values) => sql.query(changePlaceholdersForNeon(query), values),

    async get(query, values) {
      const rows = await sql.query(changePlaceholdersForNeon(query), values);
      return rows[0];
    },

    async run(query, values) {
      const rows = await sql.query(
        `${changePlaceholdersForNeon(query)} RETURNING id`,
        values,
      );
      return {
        lastID: rows[0] ? rows[0].id : undefined,
        changes: rows.length,
      };
    },
  };
};

const connectToSQLite = async () => {
  const sqlite3 = require("sqlite3");
  const { open } = require("sqlite");

  const database = await open({
    filename: databasePath,
    driver: sqlite3.Database,
  });

  await database.exec(createBooksTable);
  return database;
};

const createApp = (databaseConnection) => {
  database = databaseConnection;
  return app;
};

// On Vercel, prepare the database the first time a request comes in.
app.use(async (req, res, next) => {
  try {
    if (!database) {
      if (process.env.DATABASE_URL) {
        database = connectToNeon();
      } else if (process.env.VERCEL) {
        throw new Error("Set DATABASE_URL in the Vercel project settings.");
      } else {
        database = await connectToSQLite();
      }
    }
    next();
  } catch (error) {
    next(error);
  }
});

// GET /books?search_q=the&order_by=price&order=DESC&limit=5&offset=0
app.get("/books", async (req, res) => {
  const search = req.query.search_q || "";
  const sortBy = req.query.order_by || "id";
  const order = (req.query.order || "ASC").toUpperCase();
  const limit = req.query.limit === undefined ? 10 : Number(req.query.limit);
  const offset = req.query.offset === undefined ? 0 : Number(req.query.offset);

  // Reject invalid sorting and page settings before making a database query.
  if (!allowedSortColumns.includes(sortBy)) {
    return res.status(400).json({
      message: "order_by must be id, title, author, price, or pages",
    });
  }
  if (order !== "ASC" && order !== "DESC") {
    return res.status(400).json({ message: "order must be ASC or DESC" });
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return res.status(400).json({ message: "limit must be from 1 to 100" });
  }
  if (!Number.isInteger(offset) || offset < 0) {
    return res.status(400).json({ message: "offset must be 0 or greater" });
  }
  if (typeof search !== "string") {
    return res.status(400).json({ message: "search_q must be text" });
  }

  const conditions = [];
  const values = [];

  if (search.trim() !== "") {
    conditions.push("LOWER(title) LIKE LOWER(?)");
    values.push(`%${search.trim()}%`);
  }

  // min_price and max_price can be used separately or together.
  let minPrice;
  let maxPrice;

  if (req.query.min_price !== undefined) {
    minPrice = Number(req.query.min_price);
    if (!Number.isFinite(minPrice) || minPrice < 0) {
      return res.status(400).json({ message: "min_price must be 0 or greater" });
    }
    conditions.push("price >= ?");
    values.push(minPrice);
  }

  if (req.query.max_price !== undefined) {
    maxPrice = Number(req.query.max_price);
    if (!Number.isFinite(maxPrice) || maxPrice < 0) {
      return res.status(400).json({ message: "max_price must be 0 or greater" });
    }
    conditions.push("price <= ?");
    values.push(maxPrice);
  }

  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    return res.status(400).json({
      message: "min_price cannot be greater than max_price",
    });
  }

  let whereClause = "";
  if (conditions.length > 0) {
    whereClause = `WHERE ${conditions.join(" AND ")}`;
  }

  values.push(limit, offset);
  const query = `
    SELECT * FROM book
    ${whereClause}
    ORDER BY ${sortBy} ${order}
    LIMIT ? OFFSET ?
  `;
  const books = await database.all(query, values);
  return res.status(200).json(books);
});

// GET /books/1
app.get("/books/:bookId", async (req, res) => {
  const bookId = getBookId(req.params.bookId);
  if (bookId === null) {
    return res.status(400).json({ message: "bookId must be a positive number" });
  }

  const book = await database.get("SELECT * FROM book WHERE id = ?", [bookId]);
  if (!book) {
    return res.status(404).json({ message: "Book not found" });
  }
  return res.status(200).json(book);
});

// POST /books
app.post("/books", async (req, res) => {
  if (!isValidBook(req.body)) {
    return res.status(400).json({
      message:
        "Enter a title, author, non-negative whole-number price, and positive whole-number pages",
    });
  }

  const { title, author, price, pages } = req.body;
  const result = await database.run(
    "INSERT INTO book (title, author, price, pages) VALUES (?, ?, ?, ?)",
    [title.trim(), author.trim(), price, pages],
  );

  return res.status(201).json({
    message: "Book created successfully",
    bookId: result.lastID,
  });
});

// PUT /books/1
app.put("/books/:bookId", async (req, res) => {
  const bookId = getBookId(req.params.bookId);
  if (bookId === null) {
    return res.status(400).json({ message: "bookId must be a positive number" });
  }
  if (!isValidBook(req.body)) {
    return res.status(400).json({
      message:
        "Enter a title, author, non-negative whole-number price, and positive whole-number pages",
    });
  }

  const { title, author, price, pages } = req.body;
  const result = await database.run(
    "UPDATE book SET title = ?, author = ?, price = ?, pages = ? WHERE id = ?",
    [title.trim(), author.trim(), price, pages, bookId],
  );

  if (result.changes === 0) {
    return res.status(404).json({ message: "Book not found" });
  }
  return res.status(200).json({ message: "Book updated successfully" });
});

// DELETE /books/1
app.delete("/books/:bookId", async (req, res) => {
  const bookId = getBookId(req.params.bookId);
  if (bookId === null) {
    return res.status(400).json({ message: "bookId must be a positive number" });
  }

  const result = await database.run("DELETE FROM book WHERE id = ?", [bookId]);
  if (result.changes === 0) {
    return res.status(404).json({ message: "Book not found" });
  }
  return res.status(200).json({ message: "Book deleted successfully" });
});

// Return the same JSON message when someone requests an unknown route.
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Convert invalid JSON and other errors into JSON responses.
app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Request body must contain valid JSON" });
  }
  console.error(error);
  return res.status(500).json({ message: "Internal server error" });
});

const startServer = async () => {
  if (process.env.DATABASE_URL) {
    database = connectToNeon();
  } else if (process.env.VERCEL) {
    throw new Error("Set DATABASE_URL in the Vercel project settings.");
  } else {
    database = await connectToSQLite();
  }

  createApp(database).listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
};

if (require.main === module) {
  startServer().catch((error) => {
    console.error("Could not start the server:", error);
    process.exitCode = 1;
  });
}

// Vercel uses the exported Express app to handle incoming requests.
module.exports = app;
module.exports.createApp = createApp;
module.exports.createBooksTable = createBooksTable;
