# Backend Development Fundamentals

A collection of lab exercises for the **Backend Development Fundamentals** course (Year II, Term II) at Aurora (NIAT), taught by **Joel Prashanth D**.

## Student Details

| Field | Details |
|-------|---------|
| **Name** | Vasireddy Mitesh Sai |
| **Registration Number** | 252U1R1250 |
| **Section** | CSE-2E-211 |
| **GitHub** | [vasireddymiteshsai-ui](https://github.com/vasireddymiteshsai-ui) |

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** SQLite (local), Neon Postgres (deployed)
- **Authentication:** bcrypt, JSON Web Tokens (JWT)
- **Testing:** Postman
- **Deployment:** Vercel (Labs 1–3)

## Labs

| Lab | Title | Key Concepts | Folder |
|-----|-------|--------------|--------|
| 01 | [Node.js and Express Server](lab-01/) | Express setup, routing, GET endpoints | `lab-01/` |
| 02 | [SQLite CRUD API](lab-02/) | SQLite, CRUD operations, Postman, Vercel + Neon deployment | `lab-02/` |
| 03 | [REST API, Query Parameters, Validation, Debugging](lab-03/) | Query params, sorting, filtering, pagination, input validation, parameterised SQL | `lab-03/` |
| 04 | [Registration, Login and JWT](lab-04/) | User registration, bcrypt hashing, JWT authentication, login/register APIs | `lab-04/` |

## Repository Structure

```
backend-development-fundamentals/
├── lab-01/          ← Express server with GET routes
├── lab-02/          ← SQLite CRUD API for books
├── lab-03/          ← REST API with query params, validation & debugging
├── lab-04/          ← User registration, login & JWT
└── README.md        ← This file
```

Each lab folder contains its own `README.md` with setup instructions, endpoint documentation, and screenshots.

## How to Run Any Lab

1. Navigate to the lab folder:
   ```bash
   cd lab-XX
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
   For Lab 04, run `cd app && node index.js` instead.

4. Open `http://localhost:3000` in a browser or Postman.

> **Note:** Do not commit `node_modules/`, `.env`, `*.db` files, or real credentials. Each lab has its own `.gitignore`.

## Rules for All Labs

- Never commit or share the `.env` file; do not commit `node_modules`.
- Passwords are never stored or logged in plain text.
- Every route returns the correct HTTP status code.
- Use parameterised queries; never build SQL by joining user input into the string.
