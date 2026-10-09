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

## Read response and schedule integration

```json
{
  "success": true,
  "submitted": false,
  "advisoryOnly": true,
  "preferences": null,
  "lastUpdatedAt": null
}
```

No submission is a successful response, so absence of preferences does not block a draft workflow. When a record exists, `preferences` contains the saved fields and `lastUpdatedAt` contains its database update timestamp. Lists are returned in priority order; group courses are populated with their code/name. Advisors and Coordinators can fetch this endpoint when creating or editing a draft and refresh it for the latest submission.

Preferences are never guaranteed. This API writes only SchedulingPreference records. It does not change mandatory courses, prerequisites, published offerings, capacity, timetable conflicts, credit-hour limits, approved extra hours, schedules or payments. Draft scheduling must continue to enforce those rules when interpreting the hints. This change does not implement the separate draft editor or scheduling engine.

## Verification

The database-backed integration suite covers all categories, optional/tied ranks, replacements and clearing, staff reads, absent submissions, role/ownership checks, inactive accounts, deadline expiry/exact boundary/changes during validation, invalid term selection, malformed and injected inputs, unpublished/nonexistent/wrong-term groups, inactive courses, concurrent first submissions, unchanged existing schedules/mandatory attempts/payments/capacity, and sanitized storage failures.

Run `npm run test:group-a`; MongoDB memory-server uses a temporary database. The existing Group A tests run alongside the new preference tests.
