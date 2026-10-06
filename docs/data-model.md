# Data Model

This is the MongoDB persistence layer for the full 128-item functional requirements sheet. It defines Mongoose schemas and indexes only; it does not implement pages, API routes, authorization, workflow services, migrations, or seed data.

## Read Order

The sprint labels and requirement numbers below follow the `Sprint` column in the workbook's `Functional Requirements` sheet. Sprint 1 is Req. 1-23, 25-34, 49-58, 61, 89, and 128; Sprint 2 is Req. 24, 35-48, 59-60, 62-88, and 90-127. Schema definitions remain grouped by domain; comments beside each schema identify the requirements it supports in each sprint.

### Sprint 1

1. `identity.js` - Requirements 1-15. For B1 specifically, review `StudentProfile` for Req. 6-8.
2. `catalogue.js` - Requirements 16-23, 25-27, and 128.
3. `academics.js` - Requirements 6-8, 28-33, and 49-58, 61.
4. `requests.js` - No Sprint 1 request schema; Req. 34's eligible group schedules come from `ScheduleTemplate` and `CourseOffering`.
5. `communications.js` - Requirements 5 and 13.
6. `finance.js` - Requirement 89.

For B1, start with Requirements 6-8: `StudentProfile` in `identity.js` and `StudentWorkflowState` in `academics.js` provide the directory fields and workflow projection.

### Sprint 2

1. `requests.js` - Requirements 35-48.
2. `identity.js`, `catalogue.js`, `academics.js`, and `requests.js` - Requirements 59-82, 118, and 122.
3. `requests.js` and `finance.js` - Requirements 83-102.
4. `requests.js` - Requirements 103-115.
5. `communications.js` - Requirements 116-121 and 123-126.
6. `finance.js` - Requirement 127.

The Sprint 2-only offering-copy operation in Req. 24 reuses `AcademicTerm` and `CourseOffering` from `catalogue.js`; it needs no new schema.

Some models appear in both sprint groups because their fields support requirements from both sprints. The sprint labels are a reading aid, not separate schemas or implementation boundaries.

## Models

| Model | Purpose |
| --- | --- |
| `User` | Login identity, role, active state, advisor-roster membership, and password hash. Email domain is validated against role; signup is not part of the requirements. |
| `StudentProfile` | Student ID, type, major, semester, standing, enrollment state, advising reason, and current advisor. Kept separate so staff accounts do not carry student-only fields. |
| `AdvisorAssignment` | Appendable assignment history; the partial unique index allows only one current advisor assignment per student. |
| `PasswordResetToken` | Stores only a token hash, use time, and expiry; expired tokens are removed by MongoDB's TTL index. |
| `AcademicTerm` | Term dates, registration/advising deadlines, season, and academic year. |
| `Course` | Catalogue data, credit hours, curriculum lecture/tutorial/lab hours when supplied, type, majors, seasons, prerequisite references, and bachelor-project marker. |
| `CourseOffering` | A course in a term, instructor name/email snapshots, eligible groups, publication state, and lecture/tutorial/lab slots. Slot groups are embedded because their details belong to one offering. |
| `ScheduleTemplate` | Published standard schedule for a term, major, semester, and study group. |
| `StudentSchedule` | Normal or advising schedule, its workflow status/version, course selections, and selected offering slot IDs. |
| `CourseAttempt` | Course history and transcript results, including makeup attempts and attendance state. |
| `StudentTermStanding` | Per-student academic-standing snapshot for a term, used to evaluate consecutive probation semesters. |
| `SchedulingPreference` | Ranked preferred/avoided days, time ranges, groups, and days off for a student and term. |
| `StudentWorkflowState` | Computed per-student/per-term status and blocking step for coordinator dashboards. It is a projection, not an advisor-editable source of truth. |
| `WholeScheduleSwapRequest` | Group-based swap request, eligible group choices, course-set snapshot, expiry, and completion state. |
| `SlotChangeRequest` | Advising student's requested slot change, current/replacement slot IDs, decision, and response. |
| `MandatoryCourseRemovalRequest` | Advisor request and coordinator decision for removing a mandatory course. |
| `ExtraHoursRequest` | Requested courses/hours, eligibility snapshot, itemized cost, coordinator decision, and settlement state. |
| `FinancialTransaction` | Append-only wallet, gateway, deferred-charge, refund, and cancellation ledger. Wallet balance is derived from successful entries. |
| `FinancialReversalRequest` | Pending refund-to-wallet or deferred-charge-cancellation request linked to its extra-hours request and original financial record. |
| `GraduationPlan` | Private advisor draft or submitted plan, with courses assigned to future terms and coordinator decision. |
| `ExitExamRequest` | Request and decision for an exit exam tied to a remaining failed course. |
| `Notification` | In-app/email event, delivery/read state, and related record pointer. |
| `ScheduleActivity` | Processing/reopening audit event with actor identity snapshots so history remains readable later. |
| `CalendarConnection` | OAuth provider account and encrypted token fields; there is deliberately no calendar-password field. |

## Relationships

```mermaid
erDiagram
  USER ||--o| STUDENT_PROFILE : has
  STUDENT_PROFILE ||--o{ ADVISOR_ASSIGNMENT : assigned
  USER ||--o{ ADVISOR_ASSIGNMENT : advisor
  ACADEMIC_TERM ||--o{ COURSE_OFFERING : contains
  COURSE ||--o{ COURSE_OFFERING : offered_as
  COURSE_OFFERING ||--o{ STUDENT_SCHEDULE : selected_in
  STUDENT_PROFILE ||--o{ STUDENT_SCHEDULE : owns
  STUDENT_PROFILE ||--o{ COURSE_ATTEMPT : has
  STUDENT_PROFILE ||--o{ STUDENT_TERM_STANDING : has
  ACADEMIC_TERM ||--o{ STUDENT_TERM_STANDING : records
  STUDENT_PROFILE ||--o{ SCHEDULING_PREFERENCE : sets
  STUDENT_PROFILE ||--o{ WHOLE_SCHEDULE_SWAP_REQUEST : requests
  STUDENT_PROFILE ||--o{ SLOT_CHANGE_REQUEST : requests
  STUDENT_PROFILE ||--o{ EXTRA_HOURS_REQUEST : requests
  STUDENT_PROFILE ||--o{ FINANCIAL_REVERSAL_REQUEST : student
  EXTRA_HOURS_REQUEST ||--o{ FINANCIAL_TRANSACTION : settled_by
  EXTRA_HOURS_REQUEST ||--o| FINANCIAL_REVERSAL_REQUEST : reversal_requested
  FINANCIAL_TRANSACTION ||--o| FINANCIAL_REVERSAL_REQUEST : original_record
  USER ||--o{ FINANCIAL_REVERSAL_REQUEST : requested_by
  STUDENT_PROFILE ||--o{ GRADUATION_PLAN : has
  STUDENT_PROFILE ||--o{ EXIT_EXAM_REQUEST : requests
  USER ||--o{ NOTIFICATION : receives
  STUDENT_SCHEDULE ||--o{ SCHEDULE_ACTIVITY : audited_by
  USER ||--o{ CALENDAR_CONNECTION : connects
```

The model files are grouped by responsibility: `identity.js`, `catalogue.js`, `academics.js`, `requests.js`, `finance.js`, and `communications.js`. `models/index.js` re-exports them for API code.

## Requirement Coverage

- Requirements 1-15: users, student profiles, advisor assignments, reset tokens, and student-directory indexes.
- Requirements 16-30: academic terms, catalogue courses, offerings/slots, templates, and schedule assignments.
- Requirements 31-61: student schedules, swaps, slot changes, academic history, preferences, and mandatory-course candidates.
- Requirements 62-82: advising schedule drafts, review/processing states, and mandatory-course removal decisions.
- Requirements 83-102: extra-hours requests, wallet/payment/deferred-charge ledger entries, financial reversal requests, refunds, and financial search indexes.
- Requirements 103-115: graduation plans and exit-exam requests/decisions.
- Requirements 116-128: calendar connections, notifications, computed workflow dashboard state, term-level academic standing, and schedule activity history. CSV import remains an all-or-nothing API operation; it does not need a permanent import collection.

## Important Boundaries

Mongoose validates individual documents and the indexes prevent selected duplicate records. Document validation hooks do not run for query updates, so write services must validate hydrated documents before saving or enforce the same rule in the service. Cross-document rules still belong in API services and MongoDB transactions: seat-capacity changes, two-sided schedule swaps, role visibility, deadlines, prerequisite/credit-hour decisions, one-time financial reversals, and all-or-nothing CSV imports. Those rules cannot be guaranteed by a schema alone.

Reopening a schedule returns `StudentSchedule.status` to `draft`; the workflow projection may report `reopened`, and the schedule activity record preserves the required reason. Curriculum contact hours are optional because the required CSV columns do not include them; when available, they preserve the lecture/tutorial/lab breakdown from the curriculum sheet.

`StudentWorkflowState` is a dashboard-friendly projection and must be recomputed from source schedules and requests. Calendar tokens must be encrypted before writing these fields; the model does not perform encryption. Store payment-provider references and outcomes only, never card numbers, CVVs, or gateway passwords.
