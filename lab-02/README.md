# Lab 2: SQLite Database and CRUD Routes

## Student details

- **Name:** Vasireddy Mitesh Sai
- **Registration Number:** 252U1R1250
- **Section:** CSE-2E-211

## Setup and run

```bash
npm install
npm run seed
npm start
```

For development with automatic restarts, run `npm run dev`. The server uses port `3000` by default, or the port specified by the `PORT` environment variable.

## API endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/books/` | Get all books |
| GET | `/books/:bookId/` | Get one book |
| POST | `/books/` | Add a book |
| PUT | `/books/:bookId/` | Update a book |
| DELETE | `/books/:bookId/` | Delete a book |

Book request bodies use JSON with all four fields:

```json
{
  "title": "The Hobbit",
  "author": "J. R. R. Tolkien",
  "price": 15,
  "pages": 310
}
```

`title` and `author` must be non-empty strings, `price` a non-negative integer, and `pages` a positive integer. The SQLite database file is generated locally by `npm run seed` and is excluded from Git.
