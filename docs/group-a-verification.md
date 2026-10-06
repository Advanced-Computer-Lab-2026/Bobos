# Group A API integration verification

Scope: existing Group A APIs only. Requirements 57 and 58 are unimplemented and excluded by the user. No Group A frontend screens were requested. Exact numbered acceptance criteria were not supplied; verification uses the feature labels in the assignment and the existing API contracts.

Integrated `Group-A` into a branch based on `development`. `Group-A` already contains `feature/login` and `feature/a3-student-records`.

| Requirements | Verification |
| --- | --- |
| 1 | Login for all five roles; invalid credentials, inactive accounts, malformed input and hash-as-password rejection. |
| 2 | Email OTP delivery through a local SMTP server, password changes, expiry, retry limits, resend cooldown, single-use concurrency, SMTP failures and input validation. |
| 3 | Logout revokes existing sessions across all five roles; fresh login works; other users' sessions remain valid. |
| 4 | Role-specific own profile, persisted student/advisor data, unauthenticated access rejection and resistance to client-supplied identity. |
| 5 | Own notifications, persisted read status, idempotence and cross-user rejection. |
| 54 | Own academic history, actual assigned advisor, earned credits counted once per passed course, current courses and active major courses still required. |
| 55 | Academic-year filtering uses `AcademicTerm.academicYear`; malformed years rejected and absent records return 404. |
| 56 | Authenticated PDF download returns PDF bytes and a safe attachment filename. |
| 61 | Failed/unattended query and persisted failed-course response. |
| 89 | Persisted transaction listing and wallet balance including successful top-ups, refunds and deductions; pending amounts excluded. |
| 57, 58 | Not implemented; not certified or included in this verification. |

## Fixes

- Resolve API startup merge conflict while preserving development route mounts.
- Repair malformed API package JSON and a catalogue import syntax error that prevented API startup.
- Protect all student-record routes with authentication and ownership checks. `studentId` in these URLs means the MongoDB StudentProfile ID.
- Use the actual assigned-advisor and academic-year fields.
- Calculate completed credits from passed course attempts and keep failed courses in remaining requirements.
- Validate transcript year input and return 404 when no attempts match.
- Align shared model test fixtures with the existing required offering academic year.
- Add database-backed record/profile/notification tests and `npm run test:group-a`.
- Override the development runner's vulnerable shell-quote dependency with its patched version.

## Validation

- `npm run test:group-a`: 78 tests passed, zero failures, using temporary MongoDB databases and a local SMTP server.
- `npm run build`: passed.
- API module import and `git diff --check`: passed.

The Group B/C functional suites were not part of this request. Real deployment email delivery still requires the SMTP configuration documented in `authentication.md`.
