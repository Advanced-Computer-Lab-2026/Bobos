# Production readiness

Complete these items when preparing the production release or assessment deployment. Keep the local preview usable while development continues.

## Data and accounts

- Provide a documented, repeatable initialization that populates every role’s required workflow with meaningful records and preserves intentional empty states. Smoke-test the populated screens as each role.
- Use realistic fictional student and staff names and internally consistent schedules, preferences, requests, decisions, payments and activity. Use only the existing course catalogue and course icon mappings. Add no courses for fixture coverage.
- Provision hosted assessment accounts through the regular GUC email and password flow. For local assessment, follow the [standalone evaluation setup](../README.md#optional-integrations) against a fresh disposable MongoDB database. The evaluation seed is disabled in production, and the API demo-account seed endpoint returns 404 in production.

## Presentation and payments

- The static build and ordinary Vite sessions start with an empty sign-in form. Quick demo sign-in and its credentials route are available only in a loopback Vite session started with an explicit `BOBOS_PORTAL_DEMO` preset. Audit every role for developer copy, placeholder content and controls that disclose simulation mechanics.
- Keep the sandbox payment gateway required by requirement 91. Present the normal **Pay** and payment status labels. Remove phrases such as “fake Stripe payment” from the customer-facing interface. Require a successful sandbox response before recording a payment or applying approved courses and hours. Never store card numbers, CVVs or gateway passwords.
- Verify standard sign-in, sign-out, disabled-account handling and email OTP reset for every role. The requirements workbook’s items 1 and 2 cover normal login and OTP reset. Neither the workbook nor the assignment brief requires a 15-minute login lockout.
