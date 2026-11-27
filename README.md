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

For separate production hosting, set `VITE_API_BASE_URL` in the frontend build environment to the API's public origin (for example, `https://api.example.edu`, without a trailing slash). Set `WEB_ORIGIN` in the API environment to the frontend's full origin (for example, `https://portal.example.edu`). These settings make browser API requests reach the backend and allow the frontend origin through CORS. Keep the API and MongoDB running; a `502`, `503`, or `504` means the configured API service or its gateway is unavailable. Rebuild the frontend after changing `VITE_API_BASE_URL`.

See [the data model](docs/data-model.md) for the database schemas and requirement coverage.

See [the authentication backend guide](docs/authentication.md) for login, email OTP password reset and logout, environment configuration, and API examples.

See [scheduling preferences](docs/scheduling-preferences.md) for requirements 57/58: students submit ranked term-specific hints before the advising deadline, and Advisors/Coordinators read the latest hints without making them mandatory. Run `npm run test:group-a` for the Group A API integration and edge-case checks.

See [Group B API coverage](docs/group-b-verification.md) for the student directory, account status, advisor roster, advising directory, and advisor assignment routes. Run `npm run test:group-b` for Group B role, filtering, and assignment-history checks.

Run `npm test` for the current portal's API, frontend, and acceptance suites. Run `npm run test:a` or `npm run test:bc` for the focused group suites. The earlier audit documents record the findings at the time of each audit.

### Functional regression tests

Run `npm test` for the API and logic suites. The [coverage map](tests/functional-coverage.json) ties each of the 128 numbered requirements to named tests. The run fails if a mapped check is missing, skipped, marked TODO, or fails.

Install the browser with `npx playwright install chromium`, then run `npm run test:regression` to include the browser journeys. GitHub Actions runs the same command on pull requests to `development` and `main`. The browser suite serves the production build with a temporary database and local SMTP server. Stripe and Google API checks substitute controlled provider responses. The suite needs no live provider credentials.

Browser tests use accessible roles and labels and assert outcomes such as a saved change after reload. Layout, colors, animation, and CSS class names are free to change. When an intentional change alters an action's accessible name or the steps to complete the task, update the matching browser test. The test map tracks numbered functional requirements. Course grading and full visual acceptance are separate.

### Extra-hours card payments (Req. 91 and 93)

Set `STRIPE_SECRET_KEY` to a Stripe sandbox secret key in the API environment. Hosted Stripe Checkout accepts test cards in EGP. The Portal displays **Pay by card** for an approved request and confirms the payment with Stripe before applying the extra hours. The API checks pending checkouts in the background every minute, so a student can close the tab after paying. Use `WEB_ORIGIN` to set the return origin when hosted.

### Probation warning emails (Req. 118)

Administrators can record official semester standings in **Academic terms → Record standing**. The API stores one standing per student and term. API clients can also use `PUT /api/academic-terms/academicTerm/<termCode>/standings/<studentId>` with `academicStanding` set to `probation` or `goodAcademicStanding`.

With SMTP configured, the production API checks the student when a standing is saved. It also checks at startup and hourly. It sends a warning to an advising student's GUC email after the second consecutive completed Winter or Spring semester on probation. The student's **Notifications** shows the email delivery status. Development can enable the same check with `PROBATION_WARNINGS_ENABLED=true` and a local SMTP catcher.

### Google Calendar sync

For requirement 116, configure a Google OAuth client with the redirect URI `http://localhost:3000/api/calendar/oauth/callback` (use the matching public API URI when hosted). Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` in the ignored `.env` file. Generate an encryption key with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` and set it as `CALENDAR_TOKEN_ENCRYPTION_KEY`. Set `UNIVERSITY_TIMEZONE` to the institution's IANA timezone. Students can connect Google Calendar from **Calendar sync** after signing in, or open `/portal-studio/index.html?page=calendar-sync&role=normalStudent&preview=live`. The app stores encrypted OAuth tokens and never requests a calendar password. The API watches MongoDB changes and synchronizes processed schedules automatically while the browser is closed; a 60-second reconciliation retries missed changes and temporary Google failures. Recurring classes use the university timezone and teaching dates. Course/room changes update stable event IDs, and removed meetings are deleted. Revoked authorization requires reconnecting. Google OAuth must grant Calendar events access and an offline refresh token. The server exposes configuration and sync failures on the real connection page; the illustrated preview is not proof of a connected account.

The root URL opens the illustrated Portal Studio. Sidebar links go to live workflows. Older workspace bookmarks resolve to those same pages. Earlier design experiments are available in Git history.

### B1 manual test data

Run `npm run seed:b1 --workspace @bobos/api` after the evaluation seed to add dedicated B1 accounts, seven request categories and 120 history events without clearing existing data. See [B1 seed scenarios and logins](docs/b1-seed.md). All initial B1 passwords are `Password123!`.

Run `npm run seed:advisor-preview --workspace @bobos/api` against the populated local database to add assigned students, saved preferences, requests, and a submitted graduation plan for the standard Advisor account.

Run `npm run seed:admin-preview --workspace @bobos/api` against the populated local demo database to add tuition and fee records and a mix of read and unread Administrator notifications. The command adds missing records without resetting existing data or read status.

Run `npm run seed:group4 --workspace @bobos/api` to set the local default Layla and Karim demo accounts to the illustrated Group 4 processed timetable (CSEN 701, CSEN 703, CSEN 704, DMET 701; 19 credits). This explicitly replaces only those two accounts’ active-term schedules, records processing history, reconciles seat counts and preserves other students. Meetings use the illustrated start times and rooms with 90-minute durations. Rerunning retains matching processed schedules.

See [Production readiness](docs/production-readiness.md) for release data, sign-in, and payment presentation tasks.
