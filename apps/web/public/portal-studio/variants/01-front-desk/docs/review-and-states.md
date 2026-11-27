# Review route and preview states

Serve the supplied public directory and use its existing navigation and Page design control. Role keys are `normalStudent`, `advisingStudent`, `advisor`, `coordinator`, `administrator`. The supplied preview supports `?preview=live&role=<role>&page=<page>`; authentication state still follows the native preview session.

## First review

Compare Original Overview and a selected Overview at the same viewport and color mode. Check the 224px desktop sidebar, 48px topbar, inherited typography, muted surfaces, small line drawings and existing term/calendar controls. The extension changes task arrangement, not that shell. On mobile, open the native Menu and return to the owned page. The workspace itself scrolls; screenshots are viewport evidence, not stitched claims of full-page content.

On Sign in, use Preview details to populate sample values, then operate the actual form. Designs 6 (login), 5 (forgot) and 2 (reset) add a reversible step. Reset 8 has live length/byte feedback. The recovery links remain visible. Use only synthetic inputs in the preview.

Profile 4 has Arrow Left/Right, Home and End tabs; Profile 9 opens sections; Profile 10 inspects field definitions. Overview 2 selects a draft, 4 opens a preview drawer, 6 selects a queue category, 7 filters names, 9 focuses a page section and 10 folds recent activity.

Notifications 2/10 select without marking read. Other arrangements open a detail drawer. Mark as read and Mark all are separate native operations. Search/folders produce a clear no-match state and clear action. Advising Student has an email-only probation disclosure with no inbox read/send control. The Coordinator’s extra-hours event uses the approved folder at its decision handoff.

## URL-only fixtures

There is deliberately no scenario toolbar. To review a fixture, first open the page and choose a design, then append `fd-state=<state>` to the current URL and reload. Native navigation clears these extra parameters by design. Every fixture has a Return to working preview/Retry control that clears only `fd-state`.

| Page | Applicable states |
| --- | --- |
| overview | empty, unavailable, pending, resolved |
| login / forgot | invalid, unavailable, pending, resolved |
| reset | invalid, expired, unavailable, pending, resolved |
| profile | empty, unavailable, pending, resolved |
| notifications | empty, unavailable, pending, denied, read, resolved |

Success is the ordinary working path; retry is an action, not a fabricated delayed response. A pending fixture never reports a network operation as completed. Fixtures describe presentation; they do not implement authentication, mail or workflow decisions.

For Notifications, `fd-event=<type>` substitutes one supported event only when its role is allowed. The complete event list and actor constraints are in `tests/event-fixtures.json`. `fd-delivery=sent|pending|failed` changes only the Advising Student’s email-only disclosure. No live sender runs.

## Motion study

The supplied envelope dispatch uses a stepped strip and then local ink movement; the conversation drawing boils at the outline rather than bouncing the entire icon. The native binder keeps its canvas flip and month state. The supplied course-specific timetable and greeting sun/moon remain on Original; the ten new Overview compositions intentionally have no timetable.

The eight new auth objects use seven authored poses with held exposures over 900ms, then rest. Only the relevant part moves (door leaf, card, key, bookmark, bell, mail sheet, stamp or lock shackle). Pointer/focus entry can replay the local action; no constant whole-card bob is installed. Native conversation paths and keyframes are reused in notifications. Reduced motion disables authored movement and follows the host’s preference handling. See motion storyboard evidence.
