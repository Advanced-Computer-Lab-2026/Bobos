# Group B API verification

Group B's student directory and advisor-management APIs are mounted in the shared Express app. Every route requires an active authenticated session; route-level checks then enforce the relevant role.

| API | Roles | Coverage |
| --- | --- | --- |
| `GET /api/admin/students` | Coordinator, Administrator | Search by ID/name/email; filter student type, advisor, major, semester, standing, workflow, blocking step, and account state; returns filter options and current term. |
| `GET /api/admin/students/:id` | Coordinator, Administrator | Validates the profile ID and returns profile/account details. |
| `PATCH /api/admin/users/:id/status` | Administrator | Accepts only a boolean active state, invalidates existing sessions, and returns 400/404 for malformed or unknown users. |
| `GET /api/admin/advisors/lookup?email=` | Coordinator | Validates GUC advisor email and reports roster membership. |
| `POST /api/admin/advisors` and `DELETE /api/admin/advisors/:email` | Coordinator | Adds/removes an existing advisor from the advising roster, records notification status, closes active assignment history, and clears current student pointers on removal. |
| `GET /api/advisor/advisors`, `/students`, `/students/:profileId` | Advisor, Coordinator | Lists advisors and advising students, applies validated filters/pagination, and returns assignment/workflow details. |
| `GET /api/advisor/my-advisor` | Normal Student, Advising Student | Returns only the signed-in student's assigned advisor. |
| `PATCH /api/advisor/students/:profileId/advisor` | Coordinator | Assigns only an active advisor who is registered in the advising system; records assignment and reassignment history and treats repeating the current assignment as idempotent. |

Adding and removing advisors updates roster membership; only active advisors in the roster can be assigned or appear in the active advisor list. Advisor assignment and removal use MongoDB transactions, so local MongoDB must run as a single-node replica set. Account status changes increment the authentication version, invalidating all existing sessions. Advisor email notices use the same `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` configuration as password reset; when SMTP is not configured, the in-app notification remains pending and the API reports that status.

Run `npm run test:group-b` for integration checks covering authentication and role boundaries, literal search behavior, malformed inputs, account status changes, advisor lookup/roster updates, first assignment/reassignment, repeated assignments, and assignment cleanup when an advisor is removed.
