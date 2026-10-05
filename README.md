# Bobos

> University Schedule Management System — GUC CSEN704 *Advanced Computer Lab*, Sprint 1.

## Motivation

Building a term schedule at the GUC is a manual, spreadsheet-driven process. Coordinators keep
standard schedule templates per major, semester and study group; normal students are placed into one
of those groups; advising students negotiate a plan with an advisor. Mistakes are expensive: a
student placed in a group whose template is still a draft, or in a tutorial that is already full,
only finds out in the first teaching week.

Bobos turns that process into a single system: an Administrator maintains the course catalogue,
terms and course offerings, a Coordinator maintains the standard schedule templates and assigns
students to groups, Advisors build advising plans, and every student can see their own processed
weekly schedule.

## Tech stack

MERN, plain JavaScript, ES modules throughout.

| Layer    | Technology |
| -------- | ---------- |
| Database | MongoDB + Mongoose 8 |
| Server   | Node 20+, Express 4, Joi validation, JWT auth (`jsonwebtoken`), bcryptjs |
| Client   | React 18 + Vite 5, react-router-dom 6, plain CSS (no UI library) |
| Tests    | Jest 29 + Supertest, against a real MongoDB |

## Repository layout

```
Bobos/
  package.json          # root: concurrently dev/seed/test scripts
  server/
    .env.example
    src/
      index.js app.js
      config/db.js
      models/      User Student AcademicTerm Course CourseOffering ScheduleTemplate StudentSchedule
      middleware/  auth.js
      utils/       timetable.js
      controllers/ routes/ seed/
    tests/
  client/
    src/
      api/client.js  context/AuthContext.jsx
      components/    pages/
  docs/
```

## Install

Prerequisites: Node 20+ (tested on Node 24), npm, and MongoDB Community running locally.

```bash
# 1. MongoDB (macOS / Homebrew)
brew services start mongodb-community      # must be listening on 127.0.0.1:27017

# 2. dependencies
npm install                 # root (concurrently)
npm install --prefix server
npm install --prefix client

# 3. server environment
cp server/.env.example server/.env         # the defaults work out of the box
```

`server/.env`:

| Variable | Default | Meaning |
| -------- | ------- | ------- |
| `PORT` | `4000` | Express port |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/bobos` | dev / seed database |
| `MONGO_URI_TEST` | `mongodb://127.0.0.1:27017/bobos_test` | Jest database (dropped after each run) |
| `JWT_SECRET` | `dev-secret-change-me` | token signing secret |
| `JWT_EXPIRES_IN` | `7d` | token lifetime |
| `CLIENT_URL` | `http://localhost:5173` | CORS origin |
| `NODE_ENV` | `development` | the dev-login shim is mounted only when this is not `production` |

## Run

```bash
npm run seed       # populate MongoDB (wipes the collections it owns, prints a summary)
npm run dev        # server on :4000 and client on :5173 together
npm test           # Jest + Supertest against MONGO_URI_TEST
```

Or separately:

```bash
npm --prefix server run dev      # nodemon
npm --prefix client run dev      # vite
```

Then open <http://localhost:5173>. Requirement 1 (login) is not implemented yet, so the app opens a
**temporary development sign-in** at `/dev-login` that lists the seeded accounts and mints a JWT
without a password. The seed prints the shared dev password and the Coordinator's email.

## Implemented requirements

### Requirement 30 — Coordinator: assign or reassign normal students to a standard schedule group

> *A student's processed schedule is created from the assigned group's published template.*

Front end: `/coordinator/assign-groups` (`client/src/pages/coordinator/AssignScheduleGroups.jsx`).
Back end: `server/src/controllers/groupAssignmentController.js`, mounted at `/api/group-assignments`.

Every route requires `Authorization: Bearer <jwt>`. Reads are open to `coordinator` and
`administrator` (read-only); assigning and unassigning are `coordinator` only.

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `GET` | `/api/group-assignments/terms` | academic terms for the term selector *(temporary — moves to `/api/terms`, requirements 16/17)* |
| `GET` | `/api/group-assignments/students?termId=&search=&major=&semester=&assigned=` | normal students with their current assignment for the term |
| `GET` | `/api/group-assignments/groups?termId=&major=&semester=` | **published** standard schedule groups with course codes, credit total, assigned count, remaining seats and a weekly slot preview |
| `GET` | `/api/group-assignments/:studentId?termId=` | one student's assignment and full processed schedule |
| `POST` | `/api/group-assignments` | assign or reassign — body `{ studentId, termId?, studyGroup }` |
| `DELETE` | `/api/group-assignments/:studentId?termId=` | unassign (deletes the processed schedule, returns the seats) |

`termId` is optional everywhere and falls back to the term flagged `isCurrent`.

Rules enforced by `POST`: the student must exist (404) and must be a **normal** student (400); the
study group must exist for the student's `(term, major, currentSemester)` (404) and its template must
be **published** (409); every referenced course offering must be published (409); every non-null slot
id must resolve (409); no slot may be at capacity (409); the resolved slots must not clash (409).
On success it returns `201` for a first assignment and `200` for a reassignment.

### Requirement 31 — View a student's current weekly schedule

Front end: `/schedule` (students, `pages/student/MySchedule.jsx`), `/schedules` and
`/students/:studentId/schedule` (advisor / coordinator / administrator, `pages/staff/`), calendar in
`components/WeeklyCalendar.jsx`. Back end: `server/src/controllers/scheduleController.js`, mounted at
`/api/schedules`; rules in `utils/scheduleAccess.js`, calendar in `utils/weeklyCalendar.js`.

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `GET` | `/api/schedules/me?termId=` | the signed-in student's own visible schedule (students only) |
| `GET` | `/api/schedules/student/:studentId?termId=` | one student's schedule (`_id` or `XX-XXXX`), subject to the visibility rules |
| `GET` | `/api/schedules/students?search=&termId=` | staff picker: students with their schedule status (advisors see advising students only) |

Visibility: a normal student sees only their own `processed` schedule; an advising student sees their
own `ready_for_student_review` or `processed` schedule (a `draft` returns the same neutral 404 as "no
schedule"); advisors see advising students in any status (normal students → 403); coordinators see
everyone; administrators see everyone with `readOnly: true`. The response carries `courses`, a
Saturday–Thursday `week` sorted by start time, `daysOff` (Friday plus empty teaching days) and
`totalCreditHours`.

### Requirement 32 — View my registered courses and credit hours

Front end: `/courses` (students, `client/src/pages/student/MyCourses.jsx`). Back end:
`GET /api/schedules/me/courses?termId=` in `server/src/controllers/scheduleController.js`; the
aggregation is the pure `server/src/utils/registeredCourses.js`.

Registered courses are the entries of the student's own **visible** schedule (same rules as
requirement 31: normal → `processed`; advising → `ready_for_student_review` or `processed`; a draft
returns the same neutral 404 as "no schedule"). Staff get 403. Response:
`{ term, student, status, studyGroup, courses[{courseId, courseCode, courseName, creditHours, courseType}], totalCreditHours, courseCount }`
— courses sorted by code, `courseType` from the catalogue, total computed server-side.

### Requirement 33 — View a registered course's lecture, tutorial and lab

Front end: click a course code (or "View details") on `/courses` → `/courses/:courseId` (students,
`client/src/pages/student/CourseDetails.jsx`). Back end: `GET /api/schedules/me/courses/:courseId?termId=`
(`courseId` = Course `_id`); shaping is the pure `server/src/utils/courseDetails.js`.

Same visibility as requirements 31/32 (staff → 403, hidden draft → the neutral "no schedule" 404).
Invalid id → 400; a course not in the student's own visible schedule → 404
"This course is not in your registered courses." (never reveals other schedules). Response:
`{ term, student, status, studyGroup, course{courseId, courseCode, courseName, creditHours, courseType}, instructors[], components{lecture, tutorial, lab}, sessions[] }`
— each component is `{type, groupNumber, day, startTime, endTime, room}` from the student's assigned
snapshot, or `null` (e.g. no lab); `sessions` lists all slots Saturday→Thursday by start time.

<!-- Teammates: append your requirement under its own "### Requirement NN" heading. -->

### Requirement 34 — View eligible destination groups for a whole-schedule swap

> *Show only standard schedule groups for the same term whose registered course-code set exactly matches the student's subjects, with no additional or missing subject.*

Front end: `/swap` (`client/src/pages/student/SwapGroups.jsx`). Back end: `GET /api/swaps/eligible-groups?termId=`
(`server/src/controllers/swapController.js`, rule in `server/src/utils/swapEligibility.js`).

Normal students only (advising students and staff → 403, no token → 401). The student's subjects are the course
codes of their own **processed** schedule for the term (none → 404). Candidates are all **published** templates of the
same term, any cohort, excluding the student's own template; a candidate is eligible only when its course-code set
equals the student's exactly. Each group is returned with `courses` / `week` / `daysOff` / `totalCreditHours` (same
shape as requirement 31) plus an informational `minRemainingCapacity`; the term's `swapDeadline` is included.
Capacity and deadline are not filtered here — requirements 35/37 validate them. The exact-match filter's negative
cases (extra course, missing course, unpublished, other term, other major) are covered by the Jest tests.

## Contributing

See [`agents.md`](./agents.md) for branching, commit and pull-request rules. Team notes live in
[`docs/`](./docs).
