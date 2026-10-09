# Bobos

MERN development starter for the University Schedule Management System.

## Requirements

- Node.js 22.12 or newer
- npm
- MongoDB 8.x running locally as a single-node replica set

## Run locally

```sh
cp .env.example .env
npm install
New-Item -ItemType Directory -Force .mongodb-data | Out-Null
mongod --replSet rs0 --dbpath .mongodb-data --bind_ip 127.0.0.1
```

Initialize the replica set once in a second terminal:

```sh
mongosh --host 127.0.0.1 --eval "rs.initiate()"
```

In another terminal, start the app:

```sh
npm run dev
```

The `dev` command starts the React client and Express API. Keep MongoDB running in the first terminal:

- React client: http://localhost:5173
- Express API: http://localhost:3000/api/health
- MongoDB: `mongodb://127.0.0.1:27017/bobos?replicaSet=rs0`

Stop each process with `Ctrl+C`. MongoDB data stays in the ignored `.mongodb-data/` directory.

The client proxies `/api` requests to the Express server. The API connects to MongoDB through Mongoose.

To add repeatable local evaluation data after MongoDB is running, use:

```sh
npm run seed:evaluation --workspace @bobos/api
```

The seed only writes to a local MongoDB URI unless `EVALUATION_SEED_ALLOW_REMOTE=true` is deliberately set. It creates administrator, coordinator, advisor, advising-student, and normal-student demo accounts, plus representative term, course, schedule, history, and wallet records. The command prints the demo password and account list; do not use those credentials outside a local development database.

For separate production hosting, set `VITE_API_BASE_URL` in the frontend build environment to the API's public origin (for example, `https://api.example.edu`, without a trailing slash). Set `WEB_ORIGIN` in the API environment to the frontend's full origin (for example, `https://portal.example.edu`). These settings make browser API requests reach the backend and allow the frontend origin through CORS. Keep the API and MongoDB running; a `502`, `503`, or `504` means the configured API service or its gateway is unavailable. Rebuild the frontend after changing `VITE_API_BASE_URL`.

See [the data model](docs/data-model.md) for the database schemas and requirement coverage.

See [the authentication backend guide](docs/authentication.md) for login, email OTP password reset and logout, environment configuration, and API examples.

See [scheduling preferences](docs/scheduling-preferences.md) for requirements 57/58: students submit ranked term-specific hints before the advising deadline, and Advisors/Coordinators read the latest hints without making them mandatory. Run `npm run test:group-a` for the Group A API integration and edge-case checks.

See [Group B API coverage](docs/group-b-verification.md) for the student directory, account status, advisor roster, advising directory, and advisor assignment routes. Run `npm run test:group-b` for Group B role, filtering, and assignment-history checks.

Run `npm run test:group-c` for catalogue, offering, template-schedule, and group-assignment integration checks.
