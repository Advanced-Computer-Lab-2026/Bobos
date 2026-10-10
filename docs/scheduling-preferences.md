# Scheduling preferences: requirements 57 and 58

Source: `CSEN704 - University Scheduling System Requirements (Project) (1).xlsx`, **Functional Requirements**, rows 58-59 (requirements 57-58). The ACL course description explains that the system supports advising students and their staff, uses MERN, and is evaluated with frontend, backend and database together. This change implements the API/database portion under the user's existing API-only scope.

## Routes

All requests need the normal `Authorization: Bearer <token>` header. `studentId` is a MongoDB StudentProfile ID.

| Method | Route | Access |
| --- | --- | --- |
| PUT | `/api/identity/students/:studentId/preferences?term=<AcademicTerm ID>` | Active Advising Student, own profile only |
| GET | `/api/identity/students/:studentId/preferences?term=<AcademicTerm ID>` | Active Advisor or Coordinator, any advising student; Advising Student, own profile |

Omit `term` only when exactly one academic term is active. Invalid IDs return 400, missing terms return 404, and ambiguous active terms return 409. An explicit term selects that term's independent preferences. Only `term` is accepted as a query parameter.

PUT replaces the complete preference document for the selected student/term. Omitted arrays become empty and an omitted note becomes empty text; send `{}` to clear preferences. The student and term cannot be supplied or changed through body fields. A unique student/term index and atomic replacement prevent duplicate documents under concurrent first submissions.

Updates require the current server time to be strictly before the term's advising deadline. The exact deadline and later requests return 403; a missing valid deadline returns 409. Dates in the term should be stored as absolute timestamps, for example an ISO timestamp with Egypt's UTC offset. The deadline is rechecked after group validation to honor a deadline changed during validation. Staff can still read previous submissions after the deadline.

## Example body

```json
{
  "preferredDays": [{ "day": "Monday", "priority": 1 }],
  "avoidedDays": [{ "day": "Friday", "priority": 1 }],
  "preferredTimes": [{ "startMinute": 540, "endMinute": 720, "priority": 1 }],
  "avoidedTimes": [{ "startMinute": 900, "endMinute": 1440, "priority": 2 }],
  "preferredGroups": [{ "course": "<Course ObjectId>", "componentType": "lecture", "groupNumber": "1", "priority": 1 }],
  "desiredDaysOff": [{ "day": "Saturday", "priority": 1 }],
  "note": "Prefer mornings when feasible."
}
```

Days use full weekday names. Times are integer minutes after midnight, with `0 <= start < end <= 1440`. Groups reference active catalogue courses and actual lecture/tutorial/lab groups in published offerings for the selected term. A full group may still be requested as a hint; saving a preference allocates no seat. Group numbers are non-empty strings.

Priority is an optional positive integer. An omitted priority defaults to the entry's position (starting at 1). Smaller ranks come first; equal ranks preserve submission order. Each list rejects duplicate entries. Notes are optional text, trimmed, with at most 1000 characters. Unknown fields and malformed types are rejected before storage.

Preferred groups from different courses cannot overlap on the same weekday. A meeting that starts exactly when another ends is allowed. Multiple ranked group choices within the same course remain alternatives and are not compared against each other. The page reports a clash immediately, and the API repeats the check before saving so direct requests cannot store conflicting choices.

## Read response and draft schedule workflow

```json
{
  "success": true,
  "submitted": false,
  "advisoryOnly": true,
  "preferences": null,
  "lastUpdatedAt": null
}
```

No submission is a successful response, so absence of preferences does not block a draft workflow. When a record exists, `preferences` contains the saved fields and `lastUpdatedAt` contains its database update timestamp. Lists are returned in priority order; group courses are populated with their code/name.

Advisors and Coordinators can create or update advising drafts from Student schedules:

| Method | Route | Access |
| --- | --- | --- |
| GET | `/api/schedules/advising/:studentId/draft?termId=<term code or ID>` | Assigned Advisor or Coordinator |
| PUT | `/api/schedules/advising/:studentId/draft?termId=<term code or ID>` | Assigned Advisor or Coordinator |

The GET response includes the latest saved preferences and `preferenceLastUpdatedAt`, ranked published group options with meeting times and current seat counts, failed/unattended course reminders, and any saved draft. An absent preference document returns `preference: null` with a null timestamp. The web editor keeps the student preference panel visible beside the course selection workflow, highlights preferred groups, and previews the selected weekly timetable.

PUT accepts `{ "version": 0, "courses": [] }` to create an open empty draft, or a versioned course selection such as `{ "version": 1, "courses": [{ "courseOffering": "<CourseOffering ID>", "groups": [{ "componentType": "lecture", "groupNumber": "1" }] }] }`. Every selected course needs one group per published component. Updates use the draft version to reject stale edits. Staff may only update a schedule whose status is still `draft`; schedules already sent for review or processed are read-only. Drafts do not reserve seats.

When the schedule is ready, staff can include `"submitForReview": true` in the same versioned PUT. The API revalidates the selected groups and saves the schedule as `readyForStudentReview` atomically; an empty schedule cannot be sent. The advising student can then view the schedule in My schedule, read-only. Download and print remain available only after the schedule is processed.

The API rejects inactive/unpublished or ineligible offerings, repeated passed courses, unmet prerequisites, full groups, malformed or duplicate selections, and overlaps (including partial overlaps; adjacent times are allowed). Advisors can edit only their assigned advising students; Coordinators can edit any advising student. No preference record is required to create or save a draft. An empty draft is allowed while work starts; any non-empty draft must include each still-required failed/unattended course, unless that course has an approved removal for the term. Selected failed/unattended courses are marked mandatory in the saved snapshot, and the editor surfaces the required courses for staff.

Before saving a draft, the API also checks the student's credit load against the applicable allowance and the extra-hours rules. Requirement 59 sets normal allowances at 34 hours for semesters 3–4, 30 for semesters 5–6, 28 for semester 7, and 24 for semester 8 onward. Probation reduces the applicable allowance by 25%, rounded up, and permits no increase. Approved extra hours count only after their request is paid or deferred: a non-graduating student may take up to three above the standard allowance, while a student graduating within one year may reach 34 total hours. The selected draft must include the courses covered by those activated approvals. Approval alone is not enough.

The requirements workbook does not state an allowance for semester 2; the project owner confirmed that it uses the same 34-hour limit as semesters 3–4. No students are expected to be advised in semester 1, so that baseline remains unconfigured and the API applies only the overall 34-hour ceiling there. Sending a validated draft for student review changes its visibility but does not reserve seats or mark it processed.

Preferences are never guaranteed. Saving preferences changes only `SchedulingPreference`; it does not change attempts, schedules or payment records. The advising draft endpoint is a separate workflow and keeps hints advisory while validating available offerings, prerequisites, capacity and timetable clashes.

## Verification

The database-backed preference integration suite covers all categories, optional/tied ranks, replacements and clearing, staff reads, absent submissions, role/ownership checks, inactive accounts, deadline expiry/exact boundary/changes during validation, invalid term selection, malformed and injected inputs, unpublished/nonexistent/wrong-term groups, inactive courses, concurrent first submissions, unchanged existing schedules/mandatory attempts/payments/capacity, and sanitized storage failures. The scheduling integration suite covers preference timestamps while creating/updating drafts, absent preferences, advisor ownership, version conflicts, stale published offerings, prerequisites, capacity, timetable clashes, semester credit limits, probation reductions, and payment/defer activation of approved extra hours.

Run `npm run test:group-a`; MongoDB memory-server uses a temporary database. The existing Group A tests run alongside the new preference tests.
