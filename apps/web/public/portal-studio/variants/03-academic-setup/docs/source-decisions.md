# Source grounding and explicit decisions

## Sources actually used

The requested basis is the round-two upload, not the prior standalone prototype. Source paths below are relative to its `project/`:

1. `requirements/PAGE-BRIEFS.md`, specifically the eight assigned page sections.
2. `requirements/GUC_316_70_71577_2026-09-27T06_59_26.xlsx`: Functional Requirements (including stakeholder and extra-comment columns), Non-functional Requirements, MET and DMET Curriculum, and the supplied evaluation data. The workbook was read as cells, not inferred from a filename or screenshot.
3. `requirements/Functional Requirements.txt` and `requirements/Non-functional Requirements.txt`.
4. `docs/group-a-verification.md`, `docs/group-a-sprint2-audit.md`, `docs/group-b-c-requirements-audit.md`, and `docs/offering-academic-year.md`.
5. `apps/web/public/portal-studio/app.js`, `studio.js`, `base.css`, existing teaching-week artwork/binder behavior, `variants/host.js`, and the supplied login/Overview.
6. Actual React implementations in `apps/web/src/components/AcademicWorkspace.jsx` and `SchedulingPages.jsx`, `apps/web/src/api.js`, API route/controller code for catalogue, academic terms, templates and group assignments, and the course-import/curriculum parser.

The accompanying requirements PDF was not used as an independent authority. No external research or invented institutional rules replace the supplied workbook.

## Keep source records separate from transaction fixtures

The approved Original is unmodified. Its six catalogue rows, short offering/template ledgers and student examples are a visual reference, not a complete relational database. Working variants need enough linked records to exercise the mandated transactions. Those additions are confined to `src/seed.js` and are labelled “Preview records · stored in this browser” on every owned page.

- Six catalogue identities and displayed credits follow the Portal preview: CSEN 701, CSEN 703, CSEN 704, DMET 701, ELCT 701 and MATH 701. CSEN 501 is an added prerequisite fixture. IDs, contact hours, seasons, active flags and dependency edges are explicit demonstration data, not an assertion that the preview supersedes the curriculum workbook.
- Displayed Winter 2026, Spring 2027 and Spring 2026 calendar windows are retained. Full term/teaching boundaries, advising instants, Winter 2025 and Summer 2026 are added fixture data to make source/target copying testable. They are not live university deadlines. The fixture clock is fixed at 20 November 2026, 12:00 UTC.
- Teaching meetings use the supplied teaching-week identities where shown, plus synthetic instructor contact details, eligibility, alternate component groups, capacities and occupancy. No emails are sent. Group 1 alternatives are deliberately offset from Group 4 for a valid reassignment example.
- The supplied Original labels Group 4 **Draft**, while the assignment page already assigns students to Group 4; its short template also includes a draft DMET offering. This is a source inconsistency, not silently treated as a valid production state. The working fixture explicitly uses a **published Group 4 snapshot containing three eligible published CSEN offerings**. It therefore has three courses / six meetings rather than the Original's four-course shorthand. Original still displays the supplied version.
- The twelve student names follow the original assignment preview. Student IDs, email addresses, type/semester, stored schedule snapshots and history are local fixtures. Six start assigned to Group 4 and six unassigned. No actual student data is fetched.
- The UI label “Computer Engineering” follows Portal. Preview `CS` / `DMET` identifiers are not substituted for production API major values. React adapters retain the actual form values and response objects unchanged.

## Curriculum import is not a hidden correction pass

The standard CSV includes the workbook's eight required attributes. The curriculum-format helper follows the supplied parser's flattened course-code/component-hour format and permits explicit default seasons. It flags inconsistent component-hour totals and unresolved prerequisite references instead of guessing a correction. Repeated curriculum identities are surfaced with a warning about the singular recommended-semester model; placeholders are counted as skipped. This is not a certification that every workbook record can be imported without stakeholder clarification. The three sample CSVs are deliberately synthetic and named DEMO, not proposed catalogue changes.

The preview parser is a demonstration of R128, not a replacement for `course-import.controller.js`. Production uses its existing atomic import endpoint and errors. Preview defensive rules can be stricter than an uncorrected server; a safe preview does not prove server parity.

## Academic year and side effects

`docs/offering-academic-year.md` explicitly keeps academic year on `AcademicTerm` and derives offering year from the term. There is no independently editable offering-year field here. Duplicate-safe copy uses course + target term and resets occupancy/publication; remaining capacity is calculated, not copied as stored data.

Saving a preview term updates only matching existing in-memory host calendar milestones. It never changes calendar month, binder style or renderer. A fresh Overview-only load is still the baseline preview; it does not independently load this module's academic store. Production deadline enforcement remains in the existing APIs and other workflows. R16/R17 are not claimed to be globally enforced by this folder.

Template edits increment a version without silently rewriting already processed schedules. Explicit reassignment applies a new version. Preview history uses the fixture clock, not an audit-grade timestamp. The local revision check detects a stale opened dialog, but browser storage is **not** a database transaction or multi-tab compare-and-swap guarantee.

## Existing audits remain existing audits

The Group B/C audit records 96 passing / 14 failing strict acceptance tests at that audit point. The later Group A Sprint 2 integration audit reports Group A 72 passing / 12 failing, and a post-integration B/C regression of 105 passing / 13 explicit TODOs. These reports describe different source snapshots/scopes; they must not be added together or called complete acceptance. The later report notes one concurrent-processing repair while other B/C gaps remain.

This delivery does not repair unrelated extra-hours, finance, probation, graduation, notification or live-provider gaps. It does not recast TODOs as passes. Original Google/SMTP/gateway test limitations remain as recorded. No real database cleanup, mailbox delivery, provider OAuth or production API acceptance was performed for this design submission.

The extra-hours decision folder and conversation artwork belong to other assigned pages. They remain untouched; neither is reused as generic decoration on academic setup pages.
