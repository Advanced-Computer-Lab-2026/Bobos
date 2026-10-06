# Bobos

MERN development starter for the University Schedule Management System.

## Requirements

- Node.js 22.12 or newer
- npm
- MongoDB 8.x running locally

## Run locally

```sh
cp .env.example .env
npm install
mkdir -p .mongodb-data
mongod --dbpath .mongodb-data --bind_ip 127.0.0.1
```

In another terminal, start the app:

```sh
npm run dev
```

The `dev` command starts the React client and Express API. Keep MongoDB running in the first terminal:

- React client: http://localhost:5173
- Express API: http://localhost:3000/api/health
- MongoDB: `mongodb://127.0.0.1:27017/bobos`

Stop each process with `Ctrl+C`. MongoDB data stays in the ignored `.mongodb-data/` directory.

The client proxies `/api` requests to the Express server. The API connects to MongoDB through Mongoose.

See [the data model](docs/data-model.md) for the database schemas and requirement coverage.

## Admin API (Team B — B2)

Covers requirements 9–13 of the University Schedule Management System.

| Method | Route | Purpose | Req |
|---|---|---|---|
| GET | `/api/admin/students/:id` | Get a student's full profile (with user + advisor populated) | 9 |
| PATCH | `/api/admin/users/:id/status` | Activate / deactivate a user account | 10 |
| GET | `/api/admin/advisors/lookup?email=` | Look up an advisor by GUC email — returns full name | 11 |
| POST | `/api/admin/advisors` | Add an advisor to the advising system (sends email notification) | 11, 13 |
| DELETE | `/api/admin/advisors/:email` | Remove an advisor without deleting schedule activity history | 12, 13 |

These routes require authentication middleware to set `req.user`; the current API startup does not attach it yet, so the A1 login work must do that before these screens can be used through the normal app. Student details are available to coordinators and administrators; account status is administrator-only; advisor management is coordinator-only.

Email delivery uses `SMTP_URL` and `EMAIL_FROM` from `.env`. Until these are configured, notifications remain pending; failed SMTP deliveries are recorded as failed.
