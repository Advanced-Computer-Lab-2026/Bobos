# Portal · Student life · Round two

**One Portal integration. Seven owned pages. Ten choices per page, plus the unchanged Original.**

This is a drop-in for the exact Portal baseline in `02-student-life-round-2.zip`. It is not another website or a standalone playground. The existing host supplies sign-in, the shell, navigation, account menu, role context, theme, and the single Page design dropdown. The submission registers only the seven assigned page keys.

## Install and open

From the directory containing the extracted submission and the supplied `project/`:

```sh
cp -R variants/02-student-life project/apps/web/public/portal-studio/variants/
cd project/apps/web/public
python3 -m http.server 8000
```

Open `http://localhost:8000/portal-studio/index.html?preview=live`, then use the supplied **Sign in** button. That minimal sign-in is the baseline's design-preview behavior; this submission does not replace authentication.

For the advising-student pages, open:

```text
http://localhost:8000/portal-studio/index.html?preview=live&role=advisingStudent&page=my-schedule
```

For the normal-student whole-schedule swap, open:

```text
http://localhost:8000/portal-studio/index.html?preview=live&role=normalStudent&page=schedule-swap
```

Use **Page design** above the page heading. Original is value `0`; the ten alternatives are `1`–`10`. The host remembers a different choice for each page in `localStorage`, including after navigating away and signing out/in. No index.html, host.js, app.js, shell, or sibling-contributor changes are needed.

## Included

| Path | Purpose |
| --- | --- |
| `pages.js`, `pages.css` | The complete dependency-free registry, local workflows, responsive compositions and scoped styles. |
| `assets/` | Three approved timetable symbols copied unchanged from the supplied baseline. No font files. |
| `manifest.json` | Machine-readable page keys, 70 choices, roles, requirements, composition intent and screenshot paths. |
| `docs/DESIGN-MANIFEST.md` | Human-readable explanation of every alternative. |
| `docs/REQUIREMENTS.md` | Numbered requirement coverage, conditions, and real API/component handoffs. |
| `docs/DATA.md` | Exact inherited versus invented preview data and state boundaries. |
| `docs/TESTING.md` | Reproducible verification, scenario controls and honest limits. |
| `docs/ART-DIRECTION.md` | Overview comparison, illustration behavior and motion decisions. |
| `integration/` | Optional, narrowly scoped authenticated React route adapter and App.jsx patch. |
| `tests/` | Browser checks, pure-rule tests and adapter contract tests. |
| `evidence/` | Desktop/mobile dark/light captures, state captures, overview comparisons, sample exports and machine-readable reports. |

## Workflows

Schedule variants expose full lecture/tutorial/lab details, ready-versus-processed visibility, slot-change requests, request history and pending-only withdrawal. Processed schedules support real PDF, print and `.ics` output. Courses retain registered credits, catalogue navigation and component inspection. Swaps compare full schedules, accept multiple desired groups, enforce one open local request, keep the requester anonymous and retain completed/withdrawn/expired history.

Preferences support days, preferred/avoided days and times, component-specific group priorities, notes, validation, latest-saved feedback and read-only staff views. Records provide completed/current/remaining course history, attended-year transcripts and a PDF matching the displayed year. Advisor pages retain the assigned name and email, copy/email actions, existing next-step links and private local preparation. Calendar pages separate a file snapshot from provider connection, enforce a processed source, inspect recurring events and show sync/retry feedback.

## Preview and production are deliberately separate

The supplied studio is a **static design preview**. Added examples use a labeled **14 November 2026** snapshot and session-local fixtures. No real university data is loaded, no real account is authenticated by this code, no email is sent by Portal, no Google account is contacted, and no cross-user database transaction occurs. Exported files are clearly marked as preview records.

The optional React adapter reuses the existing authenticated components, actual API calls, authorization and validation. It is a route/permission integration handoff, **not a claim that all 70 DOM preview compositions have been ported to the React application**. The full production build, API/database acceptance suites and real-provider OAuth were not run in this delivery. The supplied audits' known gaps remain documented rather than relabeled as passing.

## Verification

The final fresh-baseline browser run checks every design in two themes and two viewport sizes, exercises each design's main workflow, and verifies navigation, Original, sign-out/sign-in, native calendar/preference continuity, role boundaries, error/retry states and downloads. The entire 979-check suite also passed after extracting the result ZIP into a second fresh baseline. Exact final counts and reports are in `docs/TESTING.md` and `evidence/reports/`.

The copy-only install preserves every uploaded file outside `variants/02-student-life/`. The other four supplied contributor folders are placeholders; registry coexistence was tested with a sentinel, not with unavailable future submissions.
