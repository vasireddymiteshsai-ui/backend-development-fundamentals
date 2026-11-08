const path = require("path");
const express = require("express");

const PORT = process.env.PORT || 3000;
const databasePath = path.join(__dirname, "books.db");
const sortableColumns = new Set(["id", "title", "author", "price", "pages"]);

const createBooksTable = `
  CREATE TABLE IF NOT EXISTS book (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    price INTEGER NOT NULL,
    pages INTEGER NOT NULL
  )
`;

const addQuestionMarks = (query) => {
  let number = 0;
  return query.replace(/\?/g, () => {
    number += 1;
    return `$${number}`;
  });
};

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

const readQueryValue = (query, name, defaultValue) => {
  const value = query[name];
  if (value === undefined) {
    return defaultValue;
  }
  if (typeof value !== "string") {
    throw badRequest(`${name} must be provided once as a single value`);
  }
  return value;
};

const parseIntegerQuery = (query, name, defaultValue, minimum, maximum) => {
  const value = readQueryValue(query, name, undefined);
  if (value === undefined) {
    return defaultValue;
  }
  if (!/^\d+$/.test(value)) {
    throw badRequest(`${name} must be an integer`);
  }

  const parsedValue = Number(value);
  if (
    !Number.isSafeInteger(parsedValue) ||
    parsedValue < minimum ||
    (maximum !== undefined && parsedValue > maximum)
  ) {
    const range = maximum === undefined ? `at least ${minimum}` : `between ${minimum} and ${maximum}`;
    throw badRequest(`${name} must be ${range}`);
  }
  return parsedValue;
};

const parsePriceQuery = (query, name) => {
  const value = readQueryValue(query, name, undefined);
  if (value === undefined) {
    return undefined;
  }

  const parsedValue = Number(value);
  if (value.trim() === "" || !Number.isFinite(parsedValue) || parsedValue < 0) {
    throw badRequest(`${name} must be a non-negative number`);
  }
  return parsedValue;
};

const parseBookListOptions = (query) => {
  const searchQuery = readQueryValue(query, "search_q", "").trim();
  const orderBy = readQueryValue(query, "order_by", "id").toLowerCase();
  const order = readQueryValue(query, "order", "ASC").toUpperCase();
  const limit = parseIntegerQuery(query, "limit", 10, 1, 100);
  const offset = parseIntegerQuery(query, "offset", 0, 0);
  const minPrice = parsePriceQuery(query, "min_price");
  const maxPrice = parsePriceQuery(query, "max_price");

  if (!sortableColumns.has(orderBy)) {
    throw badRequest(`order_by must be one of: ${Array.from(sortableColumns).join(", ")}`);
  }
  if (order !== "ASC" && order !== "DESC") {
    throw badRequest("order must be ASC or DESC");
  }
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    throw badRequest("min_price cannot be greater than max_price");
  }

  return { searchQuery, orderBy, order, limit, offset, minPrice, maxPrice };
};

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
  if (!/^\d+$/.test(value)) {
    return null;
  }
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

const connectToNeon = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("Set DATABASE_URL to a Neon Postgres connection string.");
  }

  const { neon } = require("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL);

  return {
    all: (query, values = []) => sql.query(addQuestionMarks(query), values),

    async get(query, values = []) {
      const rows = await sql.query(addQuestionMarks(query), values);
      return rows[0];
    },

    async run(query, values = []) {
      const rows = await sql.query(`${addQuestionMarks(query)} RETURNING id`, values);
      return { lastID: rows[0] ? rows[0].id : undefined, changes: rows.length };
    },
  };
};

const connectToLocalSQLite = async () => {
  const sqlite3 = require("sqlite3");
  const { open } = require("sqlite");
  const database = await open({
    filename: databasePath,
    driver: sqlite3.Database,
  });
  await database.exec(createBooksTable);
  return database;
};

const createApp = (database) => {
  const app = express();
  app.use(express.json());

  app.get("/books", async (req, res) => {
    const { searchQuery, orderBy, order, limit, offset, minPrice, maxPrice } =
      parseBookListOptions(req.query);
    const conditions = [];
    const values = [];

    if (searchQuery) {
      conditions.push("LOWER(title) LIKE LOWER(?)");
      values.push(`%${searchQuery}%`);
    }
    if (minPrice !== undefined) {
      conditions.push("price >= ?");
      values.push(minPrice);
    }
    if (maxPrice !== undefined) {
      conditions.push("price <= ?");
      values.push(maxPrice);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    values.push(limit, offset);
    const books = await database.all(
      `SELECT * FROM book ${whereClause} ORDER BY ${orderBy} ${order} LIMIT ? OFFSET ?`,
      values,
    );
    return res.status(200).json(books);
  });

  app.get("/books/:bookId", async (req, res) => {
    const bookId = getBookId(req.params.bookId);
    if (bookId === null) {
      return res.status(400).json({ message: "bookId must be a positive integer" });
    }

    const book = await database.get("SELECT * FROM book WHERE id = ?", [bookId]);
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }
    return res.status(200).json(book);
  });

  app.post("/books", async (req, res) => {
    if (!isValidBook(req.body)) {
      return res.status(400).json({
        message:
          "Provide a non-empty title and author, a non-negative integer price, and a positive integer pages value",
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

  app.put("/books/:bookId", async (req, res) => {
    const bookId = getBookId(req.params.bookId);
    if (bookId === null) {
      return res.status(400).json({ message: "bookId must be a positive integer" });
    }
    if (!isValidBook(req.body)) {
      return res.status(400).json({
        message:
          "Provide a non-empty title and author, a non-negative integer price, and a positive integer pages value",
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

  app.delete("/books/:bookId", async (req, res) => {
    const bookId = getBookId(req.params.bookId);
    if (bookId === null) {
      return res.status(400).json({ message: "bookId must be a positive integer" });
    }

    const result = await database.run("DELETE FROM book WHERE id = ?", [bookId]);
    if (result.changes === 0) {
      return res.status(404).json({ message: "Book not found" });
    }
    return res.status(200).json({ message: "Book deleted successfully" });
  });

  app.use((req, res) => {
    res.status(404).json({ message: "Route not found" });
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }
    if (error.type === "entity.parse.failed") {
      return res.status(400).json({ message: "Request body must contain valid JSON" });
    }
    if (error.status === 400) {
      return res.status(400).json({ message: error.message });
    }
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  });

  return app;
};

const startServer = async () => {
  let database;
  if (process.env.DATABASE_URL) {
    database = await connectToNeon();
  } else if (process.env.VERCEL) {
    throw new Error("Set DATABASE_URL to a Neon Postgres connection string in Vercel.");
  } else {
    database = await connectToLocalSQLite();
  }

  const server = createApp(database).listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
  server.on("error", (error) => {
    console.error("Could not start the server:", error);
    process.exitCode = 1;
  });
};

if (require.main === module) {
  startServer().catch((error) => {
    console.error("Could not connect to the database or start the server:", error);
    process.exitCode = 1;
  });
}

module.exports = { createApp, createBooksTable };
