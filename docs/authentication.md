# Sprint 1 authentication backend

The routes below implement requirements 1, 2 and 3. All examples use JSON request bodies and existing database accounts. No signup route is provided.

## Configuration

Copy `.env.example` to `.env` in the repository root. Set `MONGODB_URI` for your local MongoDB server and set a random `JWT_SECRET`. Generate the secret once with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Keep the secret in `.env`. The file is ignored by Git. Production requires `JWT_SECRET`; development uses an ephemeral random secret if it is absent, which invalidates existing tokens and OTPs when the API restarts.

Password reset requires an SMTP provider. Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` and `SMTP_FROM` using that provider's settings. The sender must be allowed by the provider, and messages are addressed to the existing account's GUC email.

For port 587, use `SMTP_SECURE=false` and `SMTP_REQUIRE_TLS=true`. For port 465, use `SMTP_SECURE=true`. An unauthenticated SMTP relay can omit `SMTP_USER` and `SMTP_PASS`. Until email is configured, the forgot-password endpoint returns `503` with an explanatory message.

Start the backend with:

```powershell
npm run dev --workspace @bobos/api
```

## Requirement 1: login

`POST /api/identity/login`

```json
{ "email": "karim.normal@student.guc.edu.eg", "password": "Password123!" }
```

The backend normalizes email case and whitespace, checks the GUC domain, looks up an existing active account, and verifies its bcrypt password hash. It returns `200` with a signed token and safe user fields, `400` for invalid input, or `401` for invalid credentials/inactive accounts. All five roles are supported.

Protected requests use `Authorization: Bearer <token>`. Tokens expire after seven days. Protected routes also check the database's current active state and authentication version, so password reset invalidates existing tokens immediately.

## Requirement 2: password reset

1. `POST /api/identity/forgot-password`

```json
{ "email": "karim.normal@student.guc.edu.eg" }
```

The user receives a six-digit code by email. The response never contains the code and gives the same success message for unknown/inactive accounts. Only a keyed hash is stored, in the user's hidden `passwordReset` field. Codes expire after 10 minutes. Requests for the same account have a 60-second cooldown.

2. `POST /api/identity/reset-password`

```json
{ "email": "karim.normal@student.guc.edu.eg", "otp": "123456", "newPassword": "NewPassword123!" }
```

Keep the OTP as a string to preserve leading zeros. Five incorrect attempts invalidate the code. A successful reset atomically replaces the password hash, removes the code and invalidates existing sessions. A used, expired or replaced code cannot change the password again. New passwords require at least eight characters and at most 72 UTF-8 bytes, matching bcrypt's input limit. The user then logs in with the new password.

The embedded state makes the update atomic on standalone local MongoDB; a replica set is not required. The pre-existing `PasswordResetToken` model remains available but is not used by these routes.

## Requirement 3: logout

`POST /api/identity/logout` with `Authorization: Bearer <token>` and an empty JSON body `{}`.

Logout increments the account's persisted authentication version. All existing sessions for that account become invalid, including the supplied token, and protected endpoints return `401` if those tokens are reused. This implementation logs out all devices. The client should also remove its stored token after success. A new login still works and issues a token with the updated version.

The endpoint identifies the user only through the authenticated token; request-body user IDs cannot log out another account. Missing, invalid, expired and already invalidated tokens return `401`.

## Development accounts and request limits

The pre-existing `POST /api/identity/seed-demo` endpoint is disabled by default. For an empty development database only, explicitly set `ALLOW_DEMO_SEED=true` to enable it. It resets the demo accounts to their shared development password, so do not use it with accounts you need to preserve. It is always disabled in production.

Authentication verification is limited to 30 requests per IP per 15 minutes; forgot-password is limited to 10. Excess requests return `429`. These IP counters use the process-local store; a deployment with multiple API processes needs a shared store. Account OTP expiry, cooldown and attempt limits are enforced by MongoDB and persist across restarts. Configure trusted proxies narrowly if hosting behind a reverse proxy.

## Verification

```powershell
npm test
```

The integration tests start a temporary real MongoDB process and a local SMTP server, and exercise the Express endpoints over HTTP. They do not send mail to real inboxes or modify your `bobos` database. The MongoDB test binary may download on the first run; there is no system MongoDB installation requirement for these tests. Real inbox delivery still needs your team's SMTP configuration.

Implementation references: [Nodemailer SMTP](https://nodemailer.com/smtp), [express-rate-limit usage](https://express-rate-limit.mintlify.app/quickstart/usage), [MongoDB test server](https://typegoose.github.io/mongodb-memory-server/docs/guides/quick-start-guide/).
