# Design manifest

The host supplies Original plus ten independently remembered choices on each of seven pages. Every composition uses the same page-specific permission checks, state model and actions. The alternatives change reading, comparison, disclosure or sequence—not the Portal brand.

## my-schedule

Requirements: R31, R40, R41, R42, R49.

| # | Host selector name | Composition and interaction |
| --- | --- | --- |
| 1 | Week & requests | Three-day-width week with an adjacent slot-request rail; scan and act without opening a separate workflow. |
| 2 | One day at a time | One selected day at a time, with keyboard-operable day controls and the same request history. |
| 3 | Weekly agenda | Chronological, full-width meeting rows; compare time, component and room without card-height noise. |
| 4 | Course lanes | One lane per course with its lecture, tutorial and lab grouped together. |
| 5 | Time grid | Time-proportioned columns expose gaps and overlaps; component details stay inspectable. |
| 6 | Schedule inspector | A stable detail inspector beside the week keeps context while reviewing a meeting. |
| 7 | Course index & week | A course index filters the shared week; a meeting inspector and reset-to-all retain context. |
| 8 | Foldout days | Open and close individual day folders; inspect only the days that matter. |
| 9 | Room-to-room route | Room-to-room meeting sequences foreground the route through each teaching day. |
| 10 | Review & release | Review sequence and request history precede the final week, distinguishing ready from processed. |

## my-courses

Requirements: R32, R33.

| # | Host selector name | Composition and interaction |
| --- | --- | --- |
| 1 | Course register | An expanded register exposes all three assigned components under every course. |
| 2 | Course & sections | Select a course in a master list and inspect its three components alongside it. |
| 3 | Section matrix | Component-by-course matrix makes lecture, tutorial and lab differences comparable. |
| 4 | Course index | A compact course index controls a wider assigned-section panel. |
| 5 | Teaching-day index | Teaching-day folders lead back to the full course-section inspector. |
| 6 | Credit ledger | A credit-ledger arrangement retains course identity and component disclosure. |
| 7 | Course folders | Course folders disclose their own three components, avoiding a separate detail page. |
| 8 | Component focus | Filter the selected course by component type with keyboard-operable controls. |
| 9 | Two-course comparison | Choose at most two courses and compare their assigned sections side by side. |
| 10 | Find a course | Filter the course register by code or name; empty results explain how to recover. |

## schedule-swap

Requirements: R34, R35, R36, R37, R38, R39.

| # | Host selector name | Composition and interaction |
| --- | --- | --- |
| 1 | Side-by-side groups | Compare two eligible groups and build a multi-destination request in a separate selection rail. |
| 2 | Current & destination | Keep the current whole schedule visible above destination comparisons. |
| 3 | Group inspector | Compact group choices lead to a full-schedule inspection drawer before committing. |
| 4 | Days-off explorer | Filter eligible destinations by desired day off without changing eligibility rules. |
| 5 | Complete week comparison | Full component tables replace compact week cards for precise schedule comparison. |
| 6 | Choose & review | A choose-then-review arrangement makes the immutable current group and confirmation step explicit. |
| 7 | Meeting change map | A meeting-by-meeting change map shows what moves between current and destination schedules. |
| 8 | Exchange inbox | Lead with the anonymous exchange inbox; retain group selection and request history. |
| 9 | Request ledger | Lead with the request ledger, with explicit routes back to eligible groups and offers. |
| 10 | Destination shortlist | A narrow destination shortlist with full schedule drawers supports focused selection. |

## preferences

Requirements: R57, R58.

| # | Host selector name | Composition and interaction |
| --- | --- | --- |
| 1 | Two-column brief | Keep day constraints and course groups alongside each other, followed by time ranges and notes. |
| 2 | Priority ladder | Reorder preference sections with explicit Move up/Move down controls; course/time priorities remain editable. |
| 3 | Week preferences | A live weekly preference map summarizes days off, preferred days and avoided days. |
| 4 | Groups first | Course groups come first, then day and time constraints. |
| 5 | Form & live review | A live read-only review summarizes the form before saving. |
| 6 | Guided submission | Four keyboard-operable steps divide days, groups, times and note; one persistent Save action. |
| 7 | Compact outline | Fold each form section into a compact outline while preserving its controls. |
| 8 | Advisor note first | An advisor note leads, using the existing Portal conversation drawing rather than a new chat product. |
| 9 | Course group cards | Course-group cards emphasize component-specific group and priority choices. |
| 10 | Week & constraints | The released week provides read-only context beside preferences; saving never edits assignments. |

## records

Requirements: R54, R55, R56.

| # | Host selector name | Composition and interaction |
| --- | --- | --- |
| 1 | Transcript desk | An attended-year index sits beside the selected transcript, with history still reachable below. |
| 2 | Academic timeline | Completed, current and remaining course blocks form an academic timeline. |
| 3 | Course dossier | Individual course dossiers disclose their grade or prerequisite record. |
| 4 | Year folders | Year folders select the displayed transcript and its matching PDF. |
| 5 | Academic ledger | A compact academic ledger prioritizes the three required history categories. |
| 6 | Year comparison | Compare two attended years while the primary year remains the PDF export target. |
| 7 | Term-by-term results | Group the selected year by Winter, Spring, Summer and applicable makeup periods. |
| 8 | Remaining courses first | Remaining courses, prerequisites and offering seasons precede completed and current history. |
| 9 | Find a result | Search course history by code, title, term or status, with an explicit no-match result. |
| 10 | Print-ready transcript | A document-oriented transcript layout foregrounds the attended year and its export. |

## my-advisor

Requirements: R15.

| # | Host selector name | Composition and interaction |
| --- | --- | --- |
| 1 | Contact & preparation | Contact details, personal preparation and the existing next-action links share one workspace. |
| 2 | Contact first | Name, email and office information take precedence over preparation tools. |
| 3 | Contact strip | A compact contact strip spans the page above preparation and schedule links. |
| 4 | Office-hours agenda | Listed office hours become a readable agenda; no fake appointment booking is introduced. |
| 5 | Meeting brief | Personal meeting preparation leads, with contact details retained in view. |
| 6 | Email draft | Compose a private note and hand it to the user’s mail app; no message is falsely reported as sent. |
| 7 | Advisor file | An open contact-record folder holds the assigned advisor’s details. |
| 8 | Next action first | The supplied schedule-review and preference-deadline links lead the composition. |
| 9 | Compact contact | Contact stays compact while preparation is disclosed on demand. |
| 10 | Preparation checklist | The meeting checklist leads, persists locally and reports preparation progress. |

## calendar-sync

Requirements: R116.

| # | Host selector name | Composition and interaction |
| --- | --- | --- |
| 1 | Connection & source | Connection status and the processed source schedule sit side by side. |
| 2 | Connection steps | A short connection sequence explains consent, processed eligibility and synchronization. |
| 3 | Event ledger | A recurring-event ledger makes the exact component events inspectable. |
| 4 | Calendar file first | Calendar-file export leads, clearly separated from a live provider connection. |
| 5 | Event inspector | Select an event in the ledger to inspect its recurring payload alongside it. |
| 6 | Connection drawer | Connection settings fold away after review, leaving source and privacy information. |
| 7 | Permissions first | Permissions and privacy precede connection controls. |
| 8 | Review sync changes | Review the next sync’s changes and stable event identifiers before synchronizing. |
| 9 | Sync activity | A local sync activity log exposes successful runs and unchanged re-syncs. |
| 10 | Compact settings | Compact settings disclosures organize source, permissions and the .ics snapshot. |

