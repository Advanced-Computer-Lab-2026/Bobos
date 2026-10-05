# C3 notes — requirement 30 (assign / reassign normal students to a schedule group)

Author: C3 (Team C — catalogue & schedules). Sprint 1.

## What I built

**Repo scaffolding** (the repo was empty apart from `README.md` and `agents.md`): root
`package.json` + `.gitignore`, the whole `server/` tree, the whole `client/` tree (hand-written Vite
setup), `docs/`.

**Server core** — `src/index.js`, `src/app.js`, `src/config/db.js`. `app.js` exports the Express app
**without connecting to Mongo** so tests can import it; `index.js` connects and then listens.

**Requirement 30** — `src/controllers/groupAssignmentController.js` +
`src/routes/groupAssignments.js`, mounted at `/api/group-assignments`, plus
`src/middleware/auth.js` and `src/utils/timetable.js`.

**Front end** — `client/src/pages/coordinator/AssignScheduleGroups.jsx` plus a reusable component
set (`Layout`, `ProtectedRoute`, `Button`, `Card`, `Table`, `Modal`, `Spinner`, `EmptyState`,
`Alert`, `Toast`, `WeeklyPreview`), `api/client.js`, `context/AuthContext.jsx`, and one `index.css`
with CSS variables. **Please reuse these components** rather than adding a UI library — the UI/UX
mark rewards a consistent look.

**Seed** — `src/seed/seed.js` + `src/seed/curriculumData.js`.

**Tests** — `server/tests/groupAssignments.test.js` (29 tests) and `server/tests/timetable.test.js`
(6 tests), with `server/tests/helpers.js` holding the fixture builder.

## Models I had to define on other teams' behalf

Requirement 30 depends on requirement 27, and templates come from 28/29 — none of which existed when
I started. Rather than block, I created the models exactly as the shared architecture brief
specifies. **They are yours to extend, not mine to own.** Extend the existing file; do not replace it.

| Model | Really owned by | Why I needed it |
| ----- | --------------- | --------------- |
| `User` | A1 (req 1 login) | `requireAuth` needs a role, and the seed needs accounts |
| `Student` | A1/A2 (reqs 4, 6–9) | requirement 30 is about **normal** students specifically |
| `AcademicTerm` | Administrator team (reqs 16/17) | an assignment is always *for a term* |
| `Course` | Administrator team (reqs 18–21) | course code / name / credit hours in the schedule snapshot |
| `CourseOffering` | Administrator team (reqs 22–27) | slots, capacity and the published flag |
| `ScheduleTemplate` | C2 (reqs 28/29) | the "standard schedule group" requirement 30 assigns from |
| `StudentSchedule` | **mine** (reqs 30–34, 49) | the processed schedule |

Two details that matter to whoever picks these up:

1. **A `CourseOffering` slot's auto `_id` is the stable slot id** used by `ScheduleTemplate.entries`
   and by `StudentSchedule.entries[].slots[].slotId`. If you rebuild an offering's `slots` array
   from scratch you will orphan every template and schedule that points into it. Update slots in
   place (`$set` on `slots.$`), and when you delete a slot, check `assignedCount` first (requirement 26
   already says so).
2. **`StudentSchedule.entries` is a denormalised snapshot** (course code, name, credit hours, and the
   day/time/room of each slot copied in). That is deliberate: requirements 31, 32, 33, 34 and 49 can
   render a weekly calendar, a credit-hour total and slot details with no joins. The cost is that
   editing an offering's slot does **not** update already-processed schedules — requirement 25 should
   either refuse such an edit or re-process the affected schedules.

## Where to plug in

**Requirement 1 (login) — team A1.** Create `/api/auth/login` under your own `/api/auth` namespace.
Your token payload must stay `{ id, role, email }` so `src/middleware/auth.js` keeps working, and
sign it with `process.env.JWT_SECRET`. Then delete the dev shim (below), swap the
`<Navigate to="/dev-login">` in `client/src/components/ProtectedRoute.jsx` for `/login`, remove the
`/dev-login` route and the `dev-banner` div in `client/src/components/Layout.jsx`. Note the seed
stores bcrypt hashes in `User.password` and the email rule is staff `@guc.edu.eg`, students
`@student.guc.edu.eg`.

**The temporary dev-login shim — DELETE IT when requirement 1 lands.** Three places, all marked with
a loud comment:
- `server/src/controllers/devController.js`
- `server/src/routes/dev.js`
- the `if (process.env.NODE_ENV !== 'production') app.use('/api/dev', devRoutes)` block in
  `server/src/app.js`
- client: `client/src/pages/DevLogin.jsx`

`GET /api/dev/users` lists the seeded accounts; `POST /api/dev/token { email }` returns a signed JWT
with **no password check**. It is never mounted when `NODE_ENV === 'production'`, but it is still a
hole: remove it as soon as the real login exists.

**Requirement 27 (publish/unpublish offerings) — Administrator team.** Build it on
`CourseOffering.isPublished`. My assignment logic already refuses to schedule an unpublished
offering (409, naming the course). For the "unpublishing is blocked when it would invalidate a
processed schedule" rule: query `StudentSchedule` for `entries.offering === <offeringId>`.

**Requirements 28/29 (create/update standard schedule templates) — C2.** Build on
`ScheduleTemplate` under your own `/api/templates` namespace. The contract requirement 30 relies on:
- unique on `(term, major, semester, studyGroup)`;
- one `entries[]` item per course, each pointing at a `CourseOffering` plus up to three slot ids;
- `lectureSlotId` / `tutorialSlotId` / `labSlotId` may be `null` when the course has no such
  component — that is legal and simply skipped. A **non-null id that does not resolve** is treated as
  a data error (409);
- `isPublished` is the gate: requirement 30 refuses to assign from an unpublished template;
- when updating a published template that students are already assigned to, remember their
  `StudentSchedule` snapshots will not follow. Re-assigning a student (`POST /api/group-assignments`
  with the same group) rebuilds their schedule from the current template, which is the simplest
  re-process path.

**Requirement 16/17 (terms) — Administrator team.** I added a temporary
`GET /api/group-assignments/terms` purely so the requirement-30 screen has a term selector. When
`/api/terms` exists, delete `listTerms` from my controller, its route line, and switch the one
`api.get('/group-assignments/terms')` call in `AssignScheduleGroups.jsx`.

**Namespaces reserved by C3:** `/api/group-assignments` (req 30), `/api/schedules` (reqs 31/32/33/49),
`/api/swaps` (req 34).

## Design decisions worth knowing

**`POST` is both assign and reassign.** One endpoint, `201` for a first assignment and `200` for a
reassignment. A reassignment decrements `assignedCount` on every slot of the old schedule, increments
on the new ones, replaces `entries`, and appends a `'reassigned'` history entry recording
`fromGroup`/`toGroup`. Reassigning into the same group is allowed and simply re-processes the
schedule from the current template.

**Capacity check skips slots the student already occupies.** Otherwise reassigning between two groups
that share a slot would report that shared slot as full.

**`DELETE` removes the schedule document.** The `'unassigned'` history entry is returned in the
response but **not** persisted, because keeping the document would leave requirements 31/32/33
rendering a stale processed schedule. A durable audit trail across unassignment belongs to the
activity-history requirement (48) — when you build it, write there instead of resurrecting the doc.

**Clash detection.** `src/utils/timetable.js` exports `slotsOverlap`, `findFirstClash`, `toMinutes`,
`describeSlot` and `DAYS`. Overlap is same-day and half-open `[start, end)`, so 10:00–12:00 and
12:00–14:00 do **not** clash. Requirements 31 and 34 should reuse these rather than re-implement them.

## Atomicity caveat — please read before "fixing" the controller

The project runs against a **standalone `mongod`**, so multi-document transactions are unavailable
and `assignStudentToGroup` **is not atomic**. What it does instead:

- every capacity change is a *conditional* `updateOne` — increments require
  `assignedCount < maxCapacity`, decrements require `assignedCount > 0` — so a lost race is detected
  rather than silently overbooking or driving a count negative;
- every applied change is recorded and rolled back with an inverse `$inc` if a later step fails.

A process crash between two updates can still leave an `assignedCount` off by one. The honest fix is
a reconciliation job that recounts `assignedCount` from `StudentSchedule`, or moving MongoDB to a
single-node replica set and wrapping the apply step in a session transaction. Both are out of scope
for Sprint 1. **Do not reword the comment in the controller to claim atomicity we do not have.**

## Seed notes

`npm run seed` wipes and repopulates the seven collections listed above and prints a summary.

- **76 courses**: all CS and DMET curriculum courses for semesters 1–10 (semester 8 is the bachelor
  project and has none), the four English courses, the four German courses, and 10 electives.
- `Course.creditHours` is the sheet's **Total Hours** column. The per-component hour columns live in
  `src/seed/curriculumData.js`, not in the model, because the architecture brief fixes the `Course`
  schema. The seed uses them to derive slots via the sheet's rule *2 hours = 1 lecture/tutorial/lab*:
  `sessionsPerWeek = ceil(hours / 2)`, and a component with ≥2 derived sessions is seeded as one block
  spanning two consecutive periods. A `ScheduleTemplate` entry holds exactly **one** slot id per
  component, so a multi-session component cannot be split across two separate slots.
- **`DMET 502` appears twice in the sheet** (semester 5 for DMET, semester 7 for CSEN). Course codes
  are unique, so the catalogue holds one course (`major: 'ALL'`, `recommendedSemester: 5`) and the
  per-cohort course sets in `COHORT_COURSES` decide who takes it when.
- **Offerings and templates cover semesters 5 and 7 of both majors** — 4 cohorts, 15 published
  offerings, 188 slots, `maxCapacity: 30`.
- **Slot group numbers are cohort-scoped**, e.g. `CS7-1`, `DMET5-2`. Courses shared by two cohorts
  (e.g. `CSEN 501` in both CS-5 and DMET-5) therefore get separate slots per cohort, which keeps each
  cohort's timetable independently clash-free.
- **4 study groups per cohort: `1`, `2`, `3` published and `4` deliberately UNPUBLISHED**, so the
  "cannot assign to an unpublished group" rule is demonstrable live.
- The timetable is generated programmatically and the seed **asserts** every template is clash-free
  before inserting.
- The 16 normal students are left **unassigned** so requirement 30 can be demoed from scratch.
- Several normal students share the same `(major, currentSemester)` so requirement 34 (whole-schedule
  swap) will have candidates.
- All passwords are bcrypt hashes of one shared dev password, printed at the end of the run.

## Known gaps

- No `/api/auth/login`, no `/api/terms`, `/api/offerings` or `/api/templates` — those are reqs 1, 16/17,
  22–27 and 28/29.
- `StudentSchedule.status` only has `'processed'`. The advising workflow (reqs 56+) will need more
  values (`draft`, `review-ready`, …); add them to the enum rather than creating a second model.
- `Course.major` is a single value, so a course taken by both majors is `'ALL'`. If a later
  requirement needs per-major curriculum placement, that belongs in a separate curriculum model.
- Unassigning does not persist an audit record (see above).
- No reconciliation job for `assignedCount`.
