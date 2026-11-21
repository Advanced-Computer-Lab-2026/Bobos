# Preview data and integration boundary

## What comes from the supplied renderer

`portal-studio/app.js` explicitly describes a review-only prototype. Its `schedule()`, `registered()`, `swap()`, `preferences()`, `records()`, `advisor()` and `calendarSync()` functions are the starting renderers. The variant wrapper moves their actual DOM nodes before rearranging/enhancing them. The host continues to own authentication/navigation, native tabs, the role, term treatment and design selection.

Inherited fixture identity: Omar Hassan, 70-71577, Computer Engineering; four registered courses totaling 19 credits; Winter 2026/2027; initial Group 4. The existing advisor contact is Dr. Salma Adel, `salma.adel@guc.edu.eg`, office C3.204, Tuesday 12:00–14:00. The existing 1.70 GPA, 116 completed hours, semester 7 and current advisor are kept as profile context—not recalculated from a partial sample transcript.

The four course codes/titles/credits come from the first four `courseData` rows: CSEN 701 / Embedded Systems / 5; CSEN 703 / Analysis & Design of Algorithms / 5; CSEN 704 / Advanced Computer Lab / 4; DMET 701 / Computer Graphics / 5. The original week contains seven meetings. Their original code, day, component, time and location remain present in the completed preview fixture.

## Explicitly added synthetic examples

Five component meetings complete the lecture/tutorial/lab demonstration: Graphics tutorial on Sunday at 14:00, Algorithms lab on Monday at 12:00, Graphics lab on Monday at 14:00, Embedded Systems lab on Wednesday at 08:30 and Advanced Computer Lab tutorial on Wednesday at 10:00. Meeting durations are 90 minutes. Instructor labels other than the inherited advisor contact are illustrative.

Groups 1 and 2 are synthetic complete alternatives with the exact same four course codes and 19 credits. Their full component assignments are derived deterministically from the Group 4 fixture. Group 1 has Tuesday off and a later first start; Group 2 has Sunday off. All twelve meetings move together in a local exchange. No claim is made about live offering capacity or a second student's real schedule.

Seven historic course attempts and three remaining-course examples demonstrate grades, prerequisites, offering seasons, two attended years and all five transcript periods. These rows are deliberately labeled as a partial, illustrative record. They do **not** sum to the inherited 116 completed hours. Transcript PDFs contain only the displayed attended year and are not official records.

The calendar teaching period, 22 November 2026–18 February 2027, is a fixture used to make recurring-event exports inspectable. Exported events use Africa/Cairo, stable component UIDs and weekly recurrence. The `.ics` file is a real importable snapshot, not a live connection. Re-import behavior varies by calendar application and is explained in the UI.

## State and clock

Local scenarios use **14 November 2026 at 10:00 Cairo time**, the supplied audit snapshot, so the pre-deadline paths remain reproducible. The advising deadline is represented as 18 November 2026, 23:59 Cairo; the swap deadline as 13 December 2026, 23:59 Cairo. `deadline`/`locked` scenarios move the preview clock past these boundaries. These are not today's date or live university policies.

Host design choices remain in `localStorage` under `portal-page-design:<page>`. Added workflow state is in `sessionStorage` under `portal-student-life:round2:` and separated by role. Closing the browser session clears those examples. `PortalStudentLife.resetPreview()` clears a role's local state and scenario flags without clearing the host's design selections.

Original and variants share the native calendar connection flag and the original preference days/groups/note fields in both directions. Extra preference fields, slot/swap history, profile examples and recurring-event payloads belong only to the enhanced preview. The unchanged Original still renders its own fixed schedule/history fixtures; it is not converted into a live backend client by this package.

## What is not simulated as real

The studio makes no fetch/XHR requests for university or provider data. Local role gating is interface behavior, not a security boundary. Server ownership, eligibility, reservations, live deadlines, version checks, atomicity and notifications remain the existing API's responsibility. The React adapter imports no preview fixture or `pages.js`, writes no preview storage, and introduces no replacement API wrapper.

Calendar consent, sync, failure and recovery are explicitly labeled simulations. Email actions are `mailto:` handoffs; the app never reports a message as sent. Clipboard denial has a manual-copy fallback. Slot requests do not directly change assignments. The resolved-request scenario includes an illustrative staff response and replacement record; it does not execute an approval mutation against the fixed timetable.

## Assets

`assets/algorithms.svg`, `assets/advanced-lab.svg` and `assets/graphics.svg` are byte-for-byte copies of the supplied approved symbols. The chip drawing and Portal conversation artwork are reused from the existing renderer; small file-tab poses are authored in scoped CSS. No remote asset, icon package or font download is required. The approved extra-hours folder remains in its original baseline location; no extra-hours decision screen belongs to these seven pages, so it is not inserted decoratively here.
