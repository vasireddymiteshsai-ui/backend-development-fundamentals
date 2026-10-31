const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const sampleBooks = require("./sample-books.json");

const databasePath = path.join(__dirname, "books.db");

const seedDatabase = async () => {
  const database = await open({
    filename: databasePath,
    driver: sqlite3.Database,
  });

  try {
    await database.exec(`
      CREATE TABLE IF NOT EXISTS book (
        id INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        price INTEGER NOT NULL,
        pages INTEGER NOT NULL
      )
    `);

    const existingBooks = await database.get("SELECT COUNT(*) AS count FROM book");
    if (existingBooks.count === 0) {
      for (const book of sampleBooks) {
        await database.run(
          "INSERT INTO book (title, author, price, pages) VALUES (?, ?, ?, ?)",
          [book.title, book.author, book.price, book.pages],
        );
      }
      console.log(`Seeded the local database with ${sampleBooks.length} books.`);
    } else {
      console.log("The local database already has books; leaving them unchanged.");
    }
  } finally {
    await database.close();
  }
};

seedDatabase().catch((error) => {
  console.error("Could not seed the local database:", error);
  process.exitCode = 1;
});
