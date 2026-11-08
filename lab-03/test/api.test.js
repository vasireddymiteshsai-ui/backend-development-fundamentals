const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const { mkdtemp, rm } = require("node:fs/promises");
const { after, before, test } = require("node:test");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const { createApp, createBooksTable } = require("../index");

let database;
let server;
let baseUrl;
let temporaryDirectory;

before(async () => {
  temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "lab-03-api-"));
  database = await open({
    filename: path.join(temporaryDirectory, "books.db"),
    driver: sqlite3.Database,
  });
  await database.exec(createBooksTable);
  await database.run(
    "INSERT INTO book (title, author, price, pages) VALUES (?, ?, ?, ?), (?, ?, ?, ?), (?, ?, ?, ?)",
    [
      "The Hobbit",
      "J. R. R. Tolkien",
      15,
      310,
      "The Great Gatsby",
      "F. Scott Fitzgerald",
      10,
      180,
      "Animal Farm",
      "George Orwell",
      7,
      112,
    ],
  );

  server = createApp(database).listen(0);
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  if (database) {
    await database.close();
  }
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("book API supports filtering, validation, and CRUD status codes", async () => {
  const filteredResponse = await fetch(
    `${baseUrl}/books?search_q=the&order_by=price&order=DESC&min_price=8&max_price=15&limit=1&offset=0`,
  );
  assert.equal(filteredResponse.status, 200);
  assert.deepEqual(
    (await filteredResponse.json()).map((book) => book.title),
    ["The Hobbit"],
  );

  const invalidQueryResponse = await fetch(`${baseUrl}/books?order_by=unknown`);
  assert.equal(invalidQueryResponse.status, 400);
  assert.equal(typeof (await invalidQueryResponse.json()).message, "string");

  const invalidBodyResponse = await fetch(`${baseUrl}/books`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Test", author: "Writer", price: "invalid", pages: 10 }),
  });
  assert.equal(invalidBodyResponse.status, 400);
  assert.equal(typeof (await invalidBodyResponse.json()).message, "string");

  const missingBookResponse = await fetch(`${baseUrl}/books/99999`);
  assert.equal(missingBookResponse.status, 404);
  assert.equal((await missingBookResponse.json()).message, "Book not found");

  const createdResponse = await fetch(`${baseUrl}/books`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "A Test Book",
      author: "Test Author",
      price: 12,
      pages: 200,
    }),
  });
  assert.equal(createdResponse.status, 201);
  const createdBook = await createdResponse.json();

  const updatedResponse = await fetch(`${baseUrl}/books/${createdBook.bookId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "An Updated Book",
      author: "Test Author",
      price: 13,
      pages: 210,
    }),
  });
  assert.equal(updatedResponse.status, 200);

  const deletedResponse = await fetch(`${baseUrl}/books/${createdBook.bookId}`, {
    method: "DELETE",
  });
  assert.equal(deletedResponse.status, 200);
});
