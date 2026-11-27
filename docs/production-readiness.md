# Production readiness

Complete these checks before opening Portal to university accounts.

## Data and accounts

- Provide a documented, repeatable initialization that populates every role’s required workflow with meaningful records and preserves intentional empty states. Smoke-test the populated screens as each role.
- Use the official course catalogue and provide internally consistent schedules, preferences, requests, decisions, payments and activity.
- Provision university accounts through the standard email and password flow. Hosted environments use their own account database and deployment credentials. Local assessment data is prepared separately using the [installation instructions](../README.md#installation).

## Presentation and payments

- Verify sign-in uses university credentials on every host. Check the resulting landing page for each role.
- Use the assessment payment environment required by requirement 91. A confirmed provider response is required before recording card settlement and applying the corresponding approved courses and hours. Payment details are entered on the provider’s checkout page.
- Verify standard sign-in, sign-out, disabled-account handling and email OTP reset for every role.
