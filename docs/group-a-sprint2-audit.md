# Group A Sprint 2 integration and audit

Checked against the team assignment and functional-requirements workbook: **36 requirements** (A1: 83–88 and 90–96; A2: 35–39 and 117–121; A3: 103–115). Implementation presence alone is not treated as proof of completion.

## Branches collected

- Start at `development` `e75f1ad`, preserving the Portal Folio design and the offering-year cleanup.
- `branch-A` `8b19eee`: Omar's extra-hours work and Adham's swaps/notifications. The older `Group-A` branch does not contain these newer commits.
- `feature/a3-graduation-plans-verified` `bb89ab9`: Abdelbaky's graduation planning and exit exams.
- Examined other remote branch histories for outstanding extra-hours, swaps, notification and graduation implementation commits. No additional Group A implementation was found outside these sources and already-integrated Sprint 1 branches.

## Academic year recheck

The offering-only duplicate was redundant. The year remains on `AcademicTerm` because transcripts group results by it, financial filters use it, and offering-copy selection uses year plus season. It is not removed from the domain.

The focused offering-year suite passed before integration and again on the combined code, including inherited create/read/update behavior, old conflicting records, changing the parent term year, copied offerings, legacy cleanup safety, scheduling and transcript/PDF regressions. Catalogue controller/model and cleanup migration retain the previous change. There was no new failure attributed to removing the offering copy. No live application database cleanup or real-account provider test was performed.

## Integration repairs

- Kept the current Portal shell, theme controls, public assets and existing CSS. Added functional navigation/controls for the submitted features. The only existing stylesheet addition preserves line breaks in probation emails.
- Preserved C1/C2 draft validation, seat reservations, B3 pending slot-change/extra-hours checks and workflow projections while adding A2's notifications.
- Used A2's transactional schedule transitions with B3 guards inside the transaction. The previously failing B/C concurrent-processing/history assertion now passes and is an ordinary regression test, not a TODO. Other existing B/C gaps remain.
- Fixed receipt routing: the route supplies `transactionId` but its controller previously read `id`, so valid receipt/confirmation downloads returned 400. Real paid/deferred PDF routes now have regression coverage.
- Limited extra-hours approval buttons to Coordinators; the previous component also displayed them to Advisors even though the decision endpoint denied their use.
- Moved the graduation test database into the OS temporary directory. This host runs test databases on D: because C: lacks MongoDB's required free space.

## Verification commands

```sh
npm run test:a
npm run test:a:regression
npm run test:offering-year
npm run test:bc:regression
npm run build
```

`test:a` executes the complete Group A integration/acceptance selection. Known requirement gaps are real failures, so this command exits 1 until they are repaired. `test:a:regression` executes the same assertions but marks the twelve documented gap cases as TODOs; it does not count them as passes. Test data lives in isolated temporary MongoDB databases.

Strict Group A result: **84 tests, 72 pass, 12 fail**. A regression result: **72 pass, 12 explicit TODOs, zero unexpected failures**. Post-integration B/C regression: **118 tests, 105 pass, 13 existing TODOs, zero unexpected failures**. Post-integration offering-year suite: **73 pass, zero failures**. The production frontend build passes.

Probation emails are tested through a local SMTP test server, not a real GUC mailbox. Gateway behavior uses the submitted sandbox simulation and never collects card/CVV/password data. UI presence is inspected in source; these are API/integration tests, not a claim of full browser acceptance for every screen.

## Requirement matrix

| Part | Requirement | Result and coverage |
| --- | --- | --- |
| A1 | 83 | **Partial:** pricing/probation/per-request limits work, but no advisor submission form exists in the frontend; backend misses assigned-advisor ownership and cumulative activated-hour checks. |
| A1 | 84 | Verified coordinator queue and populated details. |
| A1 | 85 | Verified exact student-ID search and empty results. |
| A1 | 86 | Verified combined Advisor, decision, settlement option and settlement-status filters. |
| A1 | 87 | **Partial:** decisions are transactional and approval does not activate hours, but blank notes and stale eligibility are accepted. |
| A1 | 88 | Verified student-owned approved request details, pricing and cost breakdown. |
| A1 | 90 | Verified Awaiting Payment Choice until confirmation; ownership and already-settled guards. |
| A1 | 91 | **Partial:** single-request wallet/gateway payments work, but different simultaneous requests can overspend one wallet. |
| A1 | 92 | Verified one outstanding deferred charge, activation and no wallet/gateway debit. |
| A1 | 93 | Verified failed and cancelled sandbox gateway attempts retry to success. |
| A1 | 94 | Verified paid/deferred PDF downloads through actual routes, references, distinct labels and student ownership; route mismatch repaired. |
| A1 | 95 | **Partial:** normal decision/payment/deferral history works, but a completed B2 refund is not reflected in request settlement/history. |
| A1 | 96 | Verified only the creating Advisor can withdraw a pending request; approved/withdrawn requests are blocked. |
| A2 | 35 | Verified deadline, eligible desired groups, auto-populated current schedule and one open request. |
| A2 | 36 | Verified exact-course/term/processed eligibility and anonymous requester display. |
| A2 | 37 | Verified live revalidation and atomic full-schedule exchange with one winning completion. |
| A2 | 38 | Verified request history and group/status details across terms and both participants. |
| A2 | 39 | Verified owner-only withdrawal of open requests. |
| A2 | 117 | Verified swap, schedule review/process/reopen, extra-hours, ledger reversal and saved decision notifications; actual A3 decisions are also tested through routes and inboxes. |
| A2 | 118 | Verified two completed consecutive probation semesters, skipped/ineligible recipients, retry/deduplication and production API startup scheduling. Real delivery still needs SMTP configuration. |
| A2 | 119 | Verified advisor assignment and slot-change submission/withdrawal alerts with assignment-time ownership and deduplication. |
| A2 | 120 | **Partial:** extra-hours requests alert Coordinators; graduation, exit-exam, mandatory-removal and financial-reversal action alerts are absent. |
| A2 | 121 | **Missing:** no reminder sender, timer or inbox synchronization. Production startup plus near-deadline open schedules produces no reminders. Only the enum exists. |
| A3 | 103 | **Partial dependency:** complete planning, seasons, prerequisite order and activated course-specific limits work, but the shared C1 GPA-only probation defect allows too many hours. |
| A3 | 104 | Verified creator-only draft edits, stale-version conflicts and submitted read-only state. |
| A3 | 105 | Verified creator-only deletion of drafts. |
| A3 | 106 | Verified private unfinished drafts cannot be read by another Advisor, Coordinator or student. |
| A3 | 107 | **Partial dependency:** completeness and exam substitution checks work, but the GPA-only credit-limit defect also passes submission. |
| A3 | 108 | Verified exactly one unschedulable remaining failed course and feasible-placement checks. |
| A3 | 109 | Verified Coordinator-only exam decisions, required response note and repeat-decision guard. |
| A3 | 110 | Verified Advisor-owned submissions and Coordinator-wide submissions with private drafts excluded. |
| A3 | 111 | Verified status/Advisor/date filters in combination. |
| A3 | 112 | Verified student ID and Advisor name/email search. |
| A3 | 113 | **Partial dependency:** rejection/resubmission and acceptance revalidation work, but the GPA-only limit defect permits invalid acceptance. |
| A3 | 114 | Verified the subject student sees only accepted plans. |
| A3 | 115 | Verified exit-exam statuses and Coordinator response are visible only to the subject student. |

## Twelve failing strict acceptance cases

The executable assertions are in `apps/api/src/controllers/group-a.audit.test.js`:

1. **83:** a different Advisor can submit for a student assigned to another Advisor. Read/detail/withdraw paths are scoped, but submission is not.
2. **83:** another request can be created after the student's three permitted extra hours have already been activated. Calculation restarts from the standard allowance rather than considering existing active requests.
3. **87:** an approval with a whitespace-only response note succeeds.
4. **87:** a request is still approved after its student moves onto probation.
5. **91:** two different requests can both spend a wallet that funds only one. Each transaction reads the same ledger balance and writes a different request, so there is no shared write conflict to prevent overspending.
6. **95:** a completed refund leaves the extra-hours request marked Paid and does not add the refund to its history. This depends on the previously reported B2 Req. 102 repair.
7. **120:** submitting a valid graduation plan produces no Coordinator submission alert.
8. **120:** creating a valid exit-exam request produces no Coordinator request alert.
9. **120:** creating a mandatory-removal request produces no Coordinator request alert.
10. **120:** a pending financial reversal produces no Coordinator alert.
11. **121:** starting the production API with an assigned open schedule and a deadline one hour away, then loading staff inboxes, still produces no Advisor/Coordinator reminder.
12. **103/107/113:** a GPA-3.70 student with stale non-probation standing/reason can save, submit and receive acceptance for a 25-credit term despite the required 23-credit allowance. This is the shared C1 Req. 59 defect, not a missing A3 page.

The missing **83 frontend submission form** is a separate source-inspection finding, not one of these twelve API assertions: the submitted ExtraHoursPage only lists, decides, settles, withdraws and downloads existing requests; no frontend call submits course IDs to `POST /api/extra-hours`.

This integration collects the existing submitted A work and reports its gaps. It does not claim the features are complete merely because branches are merged, and does not implement the missing business rules silently.
