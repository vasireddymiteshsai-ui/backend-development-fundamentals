const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");

const databasePath = path.join(__dirname, "books.db");
const sampleBooks = [
  ["The Great Gatsby", "F. Scott Fitzgerald", 10, 180],
  ["To Kill a Mockingbird", "Harper Lee", 12, 281],
  ["1984", "George Orwell", 9, 328],
  ["Pride and Prejudice", "Jane Austen", 8, 432],
  ["The Hobbit", "J. R. R. Tolkien", 15, 310],
  ["The Catcher in the Rye", "J. D. Salinger", 11, 277],
  ["Animal Farm", "George Orwell", 7, 112],
  ["The Alchemist", "Paulo Coelho", 13, 208],
  ["Little Women", "Louisa May Alcott", 14, 449],
  ["Moby-Dick", "Herman Melville", 16, 585],
];

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

    await database.run("BEGIN TRANSACTION");
    for (const [title, author, price, pages] of sampleBooks) {
      await database.run(
        "INSERT OR IGNORE INTO book (title, author, price, pages) VALUES (?, ?, ?, ?)",
        [title, author, price, pages],
      );
    }
    await database.run("COMMIT");
    console.log(`Database seeded with ${sampleBooks.length} sample books.`);
  } catch (error) {
    await database.run("ROLLBACK");
    throw error;
  } finally {
    await database.close();
  }
};

seedDatabase().catch((error) => {
  console.error("Failed to seed the database:", error);
  process.exitCode = 1;
});
