# Lab 2: SQLite CRUD API

## Student details

- **Name:** Vasireddy Mitesh Sai
- **Registration Number:** 252U1R1250
- **Section:** CSE-2E-211

## Run locally with SQLite

```bash
npm install
npm run seed
npm start
```

The local server listens on port `3000` by default. Use `npm run dev` while editing to restart the server automatically. The local SQLite file is `books.db`.

## Deploy to Vercel with a hosted database

Vercel's serverless functions cannot keep a local SQLite database file between requests. The deployed app uses Neon Postgres when `DATABASE_URL` is set. Neon connection setup does not run extra database queries on every cold start, so initialize a new Neon database once before deploying.

**Live API:** [https://lab-02-eight.vercel.app/](https://lab-02-eight.vercel.app/)

1. Create a Neon Postgres database from the Vercel Marketplace, or create one at [Neon](https://neon.tech/).
2. Copy its connection string. Keep it private.
3. If you are setting up a new Neon database, set `DATABASE_URL` in your terminal and run `npm run setup:neon` once to create the table and sample rows. The database already connected to this Vercel project has already been initialized.
4. In Vercel, make sure the integration provides the `DATABASE_URL` environment variable for Production (and Preview if needed).
5. Import this repository and set its **Root Directory** to `lab-02`. Use the default Node.js/Express settings and deploy.

The local SQLite database is used when `DATABASE_URL` is not set outside Vercel. On Vercel, the app requires `DATABASE_URL` so it does not accidentally use temporary local storage.

## API endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/books/` | Get all books |
| GET | `/books/:bookId/` | Get one book |
| POST | `/books/` | Add a book |
| PUT | `/books/:bookId/` | Update a book |
| DELETE | `/books/:bookId/` | Delete a book |

Use **Body → raw → JSON** in Postman for POST and PUT:

```json
{
  "title": "The Hobbit",
  "author": "J. R. R. Tolkien",
  "price": 15,
  "pages": 310
}
```

The API validates the body and uses parameterized SQL for database values.
