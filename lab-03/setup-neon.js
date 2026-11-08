const sampleBooks = require("./sample-books.json");

const setupNeonDatabase = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("Set DATABASE_URL to your Neon connection string before running setup.");
  }

  const { neon } = require("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL);

  await sql.query(`
    CREATE TABLE IF NOT EXISTS book (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      price INTEGER NOT NULL,
      pages INTEGER NOT NULL
    )
  `);

  const values = sampleBooks.flatMap((book) => [
    book.title,
    book.author,
    book.price,
    book.pages,
  ]);
  const placeholders = sampleBooks
    .map((book, index) => {
      const firstValue = index * 4 + 1;
      return `($${firstValue}::text, $${firstValue + 1}::text, $${firstValue + 2}::integer, $${firstValue + 3}::integer)`;
    })
    .join(", ");

  await sql.query(
    `
      INSERT INTO book (title, author, price, pages)
      SELECT sample.title, sample.author, sample.price, sample.pages
      FROM (VALUES ${placeholders}) AS sample(title, author, price, pages)
      WHERE NOT EXISTS (SELECT 1 FROM book)
    `,
    values,
  );

  console.log("Neon database is ready.");
};

setupNeonDatabase().catch((error) => {
  console.error("Could not set up the Neon database:", error);
  process.exitCode = 1;
});
