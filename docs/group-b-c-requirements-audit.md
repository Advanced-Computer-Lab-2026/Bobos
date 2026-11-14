# Group B and C requirements audit — 14 November 2026

This audit covers the 46 Sprint 2 requirements assigned to B1/B2/B3 and C1/C2/C3 in the team's assignment image, checked against the functional-requirements workbook in the workspace. Shared Sprint 1 APIs are included in the regression run. A passing implementation-presence check does not certify every rule; the strict acceptance suite below deliberately fails on reproducible gaps.

## Integration and UI preservation

- Integration starts at `development` commit `1a51471` (Portal Folio UI).
- Ali's `c1-work` at `64af724` adds requirements 59, 60, 62, 63, 70–73. Earlier draft-editor code covered only portions of these; the previous claim that all of C1 was complete was too broad.
- Adam's `C3` at `e7cea94` adds slot-change requests 40–48. `c3-work` is an older already-integrated branch, not the new slot-change implementation.
- C2's offering copy/draft/slot/validation work is already in development. All three C parts are collected in this integration.
- B1's split branch has the same calendar/report implementations already in development. B2's rewritten branches have the same finance API implementation already integrated by PR #46; their three financial-page differences are Portal Folio theme changes, which are retained. B3's removal implementation is already included. No pending B implementation was found outside those branches.
- PortalChrome, theme logic, public assets and all pre-existing Folio CSS rules are retained. New navigation entries and feature controls are added using the current shell. No redesign/mockup branch is merged.
- Corrected C1's overview-fetch effect, which was incorrectly inserted into `GroupAssignmentsPage` and referenced undefined student/data variables. It now runs inside the advising editor.
- Corrected requirement 125 history search: matching one historical staff-name snapshot previously returned all activity by that staff ID, including rows that did not match the displayed name/email query.
- Corrected requirement 67's end-date boundary to use UTC consistently with the start-date boundary; the final hours of the selected day were previously omitted on this Cairo host.

## Test commands and interpretation

```sh
npm run test:bc
npm run test:bc:regression
npm run build
```

`test:bc` is the strict acceptance command. It runs the existing suites, new B1/B2/C2/C3 API tests and C3 frontend filter tests. Unmet acceptance criteria are ordinary failing assertions with exit code 1.

`test:bc:regression` runs the same assertions but labels the 14 documented gap cases as Node test TODOs. They execute; they are not skipped or counted as passing. This command is useful for detecting regressions while the known gaps are repaired. Do not describe its zero exit status as full requirement completion.

Final run: **110 tests: 96 passed, 14 failed in strict mode**. Regression mode: **96 passed, 14 TODOs, zero unexpected failures**. Frontend production build passes. The test runner serializes database suites to reduce disk pressure. On this host, temporary MongoDB storage was redirected to a task-specific D: directory because C: had less than MongoDB's required free space.

The calendar tests use a real local API and MongoDB replica set, mocking only Google's external HTTP responses. They exercise OAuth state rejection, encrypted token storage, refresh, recurring event payloads, all component types, stable event IDs, stale-event removal and disconnect. A real Google account/OAuth app was not connected.

## Requirement coverage

`Verified` means the listed behavior has implementation and automated coverage in the combined code. `Partial` means at least one required rule has a failing strict acceptance test. Requirements 44–45 are performed in the staff UI; their tested filter function is the one called by that component.

| Part | Req. | Behavior checked | Result |
| --- | --- | --- | --- |
| B1 | 116 | Student OAuth, encrypted credentials, processed-schedule gate, recurring Google events in university timezone, details, refresh/resync/disconnect | Verified with mocked provider |
| B1 | 122 | All students, derived status/blocking step, advisor/type/request grouping | Partial: graduation/exit-exam/reversal requests absent |
| B1 | 123 | Global/student processing and reopening history; actor snapshots, version, date and reason | Partial: concurrent processing can record duplicates |
| B1 | 124 | Action/date filters; inclusive end day; invalid and reversed dates | Verified |
| B1 | 125 | Literal student ID/staff-name/email search, including staff rename snapshots | Verified; search broadening fixed |
| B1 | 126 | CSV exports all matching pages and excludes nonmatching rows | Verified |
| B2 | 97 | Advising-student financial history and ownership isolation | Verified |
| B2 | 98 | Staff paginated ledger with student and transaction metadata | Verified |
| B2 | 99 | Student ID, request ID, transaction/deferred reference searches | Verified |
| B2 | 100 | Combined date, settlement and status filters | Verified |
| B2 | 101 | Details of selected records and role/owner boundaries | Verified |
| B2 | 102 | Eligible refund/deferred cancellation, wallet conservation, revocation and audit history | Partial: five failing acceptance cases below |
| B2 | 127 | Export filtered financial records and enforce staff access | Verified |
| B3 | 64 | Removal request, assigned-advisor boundary, reason and failed-course validation | Partial: substantive reason eligibility is not enforced |
| B3 | 65 | Coordinator removal-request list | Verified |
| B3 | 66 | Student/course/advisor search | Verified |
| B3 | 67 | Combined status/advisor/date filters, inclusive start/end boundaries | Verified; end-date boundary fixed |
| B3 | 68 | Selected removal details and malformed/not-found requests | Verified |
| B3 | 69 | Decision note, approval removing draft courses, repeat decisions | Partial: concurrent approvals are not atomic |
| B3 | 80 | Valid complete draft to Ready for Student Review; invalid/incomplete draft blocked | Verified |
| B3 | 81 | Process schedule, pending slot/extra-hours guards | Partial: live validation, pending removal and atomic processing gaps |
| B3 | 82 | Required reason, processed-to-draft, version increment, student visibility and automatic history | Verified for sequential workflow |
| C1 | 59 | Reason, allowance, system status and bachelor eligibility | Partial: GPA-only probation and stale workflow projection |
| C1 | 60 | Bachelor selection Winter/Spring, eligibility and four-course/core/humanities limits | Partial: accompanying core courses bypass extra-hours activation |
| C1 | 62 | One open draft per student/term; preferences shown and optional | Verified |
| C1 | 63 | Mandatory-first selection and credit consumption | Verified |
| C1 | 70 | Eligible other courses; completed/prerequisite/season/publication exclusions | Verified |
| C1 | 71 | Add eligible nonmandatory course, duplicate and credit checks | Verified |
| C1 | 72 | Remove nonmandatory course and release its reservations | Verified |
| C1 | 73 | Selected/allowed/extra/remaining credit totals | Verified |
| C2 | 24 | Copy offering structure/instructors/slots; unpublished target; reset occupancy; skip existing; flag conflicts | Verified |
| C2 | 74 | Save/resume incomplete drafts and optimistic version checks | Verified |
| C2 | 75 | Published lecture/tutorial/lab choices and capacity | Verified |
| C2 | 76 | Reserve all components atomically; concurrent last-seat competition | Verified |
| C2 | 77 | Change slots, prevent clashes/full slots, exact reservation transfer | Verified |
| C2 | 78 | Remove slots and release capacity; incomplete draft remains editable | Verified |
| C2 | 79 | Combined missing course/slot, prerequisite, offering, clash/capacity and credit validation | Verified |
| C3 | 40 | Assigned lecture/tutorial/lab request, preference note, review status/deadline, duplicate prevention | Verified |
| C3 | 41 | Own request status, decision, exact replacement and note | Verified |
| C3 | 42 | Withdraw pending only; resolved requests cannot be withdrawn | Verified |
| C3 | 43 | Assigned-advisor scope; coordinator sees all; unrelated roles denied | Verified |
| C3 | 44 | Staff UI literal search by ID, name and course | Verified |
| C3 | 45 | Staff UI status/advisor/course/date filters, inclusive boundaries, combined filters | Verified |
| C3 | 46 | Staff selected-request details and ownership | Verified |
| C3 | 47 | Current vs replacement slots, remaining seats and clashes | Verified |
| C3 | 48 | Exact replacement, atomic capacity update, concurrent last-seat competition, Ready status preserved | Verified; final processing remains blocked by Req. 81 defects |

## Reproduced acceptance failures

The assertions are in `apps/api/src/controllers/bc-requirements.audit.test.js`. They call real routes against isolated test databases; they do not use production data.

1. **102 — ineligible refund:** an active, uncancelled extra-hours request is refunded. The API does not require a cancelled eligible request or reversal authorization.
2. **102 — unpaid deferred debt:** a deferred-charge reversal goes through the generic refund path and credits the wallet. There is no correct deferred-cancellation path.
3. **102 — revocation:** refunding does not change the extra-hours settlement state or remove unapplied additions from the draft.
4. **102 — duplicate concurrency:** simultaneous requests can create multiple refund credits because checking, marking and creating the ledger entry are separate operations.
5. **102 — wallet conservation:** refunding a wallet payment removes the original debit from the wallet calculation and adds a refund credit. A 5,000 balance minus a 3,200 payment should return to 5,000; the API produces 8,200.
6. **59 — probation:** GPA 3.70 with stale non-probation standing/reason gets the full allowance. The implementation checks standing/reason only. An existing unit test explicitly expects GPA alone not to count; that assumption conflicts with the workbook's stated GPA threshold and is exposed here rather than silently changed.
7. **60 — accompanying courses:** only humanities are flagged for bachelor-project extra-hours approval/payment; accompanying core courses bypass that rule. The workbook refers to the courses taken with the project collectively.
8. **64 — removal grounds:** a student with zero completed hours can request `completedHours` deferral, which requires more than 157. The endpoint checks only failed/unattended history, enum and nonempty explanation, not the substantive eligibility rules for the reason.
9. **69 — concurrent decisions:** multiple approvals can succeed; request decision, slot release and schedule edits are separate operations. Capacity can be released more than once.
10. **81 — pending approval:** processing succeeds while a mandatory-removal request awaits coordinator decision.
11. **81 — live validity:** an offering made unpublished after review can still be processed; processing never revalidates the current course/slot/credit state.
12. **81/123 — concurrent processing:** two staff can process the same review schedule and create multiple processing history events. Pending-request checks, schedule write and history creation are not one transaction/conditional transition.
13. **59 — stale status:** an empty draft can be created while an older `StudentWorkflowState` says Processed, and the overview still displays Processed. It trusts the stored projection instead of deriving current actions.
14. **122 — missing work categories:** submitted graduation plans, pending exit exams and pending financial reversals are absent from the dashboard, even when those records exist in the shared models.

These findings are reported as incomplete/partial behavior. This integration does not invent new implementations for those business rules or claim B/C are fully complete. Group A remains outside this merge.
