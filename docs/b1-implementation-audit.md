# B1 implementation audit — 26 November 2026

Scope: requirements 116 and 122–126, as assigned to B1 in `group-b-c-requirements-audit.md`. This is a code and acceptance-test audit of the current development implementation. Requirements 123–126 were also checked directly against the user-supplied University Scheduling System Requirements workbook.

| Requirement | Current implementation and verification |
| --- | --- |
| 116: Google Calendar | Student OAuth; encrypted access/refresh tokens; processed-schedule gate; recurring lecture/tutorial/lab events in university time; automatic change-stream sync, reconciliation, refresh and disconnect. API tests use real isolated MongoDB and mocked Google responses. Actual consent requires the Google Cloud app's allowed audience/verification; repository code cannot remove Google's testing restriction. |
| 122: Pending work | Both student types, derived statuses/blocking steps, grouping by student type/advisor/request, and all seven supported request types. Two newly reproduced omissions repaired below. |
| 123: Processing/reopening history | Global and individual-student history, actor snapshots, schedule version, timestamps and reopening reason. Concurrent processing logs exactly once. |
| 124: History filters | Action and inclusive date ranges compose; malformed and reversed dates are rejected. |
| 125: History search | Literal student ID, staff-name and staff-email search, including snapshots after staff renames. Student names are excluded, as requested and consistent with requirement 125. ID formatting accepts surrounding whitespace, compact IDs and copied dash variants. |
| 126: History export | All matching pages exported to CSV with active filters and spreadsheet-cell escaping. |

## Missing behavior repaired in this audit

1. Approved extra-hours requests with settlement `none` contributed to `awaitingPaymentChoice` student status but disappeared from request rows and counts. Include them and label them **Payment choice needed** in the UI.
2. Submitted graduation plans containing only future terms disappeared from the coordinator queue because it restricted every plan to the active term. Include all submitted plans awaiting review; schedule-specific requests retain their term filtering.

Both cases failed newly added API tests before the fixes and passed afterward. The previously documented B1 missing-request and duplicate-processing gaps were already fixed in Ziad's development implementation; they were verified rather than reimplemented. Remove the obsolete B1 TODO annotation from its passing test.

## Portal presentation

Keep functional React components and live data. Render B1 within Portal with the existing illustrations, 22px medium operational headings, open canvas sections, quiet filter panels, ruled records and the shared light/dark palette. The extra academic-services page dropdown remains removed. Styling is scoped in `apps/web/src/portal-academic.css`.

## Validation and limits

- Baseline: 11 selected B1/shared processing checks passed with strict assertions.
- Added two regression cases; both reproduced the omissions before correction.
- After correction: 15 B1/shared processing checks pass with no TODOs.
- Production build and diff whitespace checks pass.
- External Google authorization was not completed by the automated tests. No claim of successful connection to a personal Google Calendar is made.
- The supplied `sample-financial-records.csv` has six illustrated financial rows and five columns (Transaction, Student, Type, Amount, Status). It is B2 sample data, not a B1 requirement source or a complete database import: student IDs, currency, dates, term and linked request metadata are absent. No rows were imported or invented.
