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

See [the authentication backend guide](docs/authentication.md) for login, email OTP password reset and logout, environment configuration, and API examples.

See [scheduling preferences](docs/scheduling-preferences.md) for requirements 57/58: students submit ranked term-specific hints before the advising deadline, and Advisors/Coordinators read the latest hints without making them mandatory. Run `npm run test:group-a` for the Group A API integration and edge-case checks.
