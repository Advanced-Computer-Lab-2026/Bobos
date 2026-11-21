# Integration contract

## Static host

The only registry assignments are the six owned keys. Each has exactly ten `{name, apply({root,page,role})}` entries in `window.portalVariants`. The supplied `variants/host.js` creates Original plus those ten options, stores `portal-page-design:<pageKey>` and calls the selected choice after the original renderer. It is not edited or shadowed.

`pages.js` is a generated concatenation of three local source files; there is no bundler/runtime dependency. `styles.css` resolves relative to the script URL. The extra-hours folder resolves inside `assets/`. Existing `link`, `href`, `staffIdentity`, `academicCourse`, `queueSketch` and `timetableDrawing` functions deliberately remain host dependencies: the task is integration into this exact baseline, not a standalone port.

Rows, links, tabs, headings, course controls and action buttons originate in the native renderers. The layer moves these nodes, enriches their content and intercepts only owned preview actions. Delegated event listeners attach to the new page root, not document-wide shell controls. Returning to a page constructs a fresh root; previous root listeners become unreachable. No override of `render`, `navigate`, sign-in, account menu, calendar, fonts or role state is installed.

Styles are scoped beneath `.ad4`, `.ad4-dialog`, `.ad4-connected` or `.ad4r-dialog`. No `body`, `html`, sidebar or header redesign rules are supplied. Native theme variables provide canvas, paper, ink, muted text, border and control colors. Local SVG marks use small artwork colors, not a new UI palette.

Local storage:

- `portal-page-design:<pageKey>`: the existing host convention; each page independently selected.
- `portal-ad4-preview:v2`: synthetic preview students/drafts/requests. Never contains real API response data.
- `portal-ad4-filters:<role>:<page>`: local preview query/facets and selected/compared IDs.
- `portal-ad4-api-filters:accounts:<role>` and `portal-ad4-api-filters:slots:<role>`: connected query/facets only. Account and request records stay in React memory.

Clear only the owned preview storage key to reset sample workflow mutations. Do not clear all local storage: the host owns its own session, theme and calendar preferences. A blocked preference store must not prevent a connected API action. The preview reports storage-write failure; it is not a durable multi-user database.

## React installation paths

Source → installed path:

```text
react/AccountAdvisorAdmin.jsx → apps/web/src/variants/advising04/AccountAdvisorAdmin.jsx
react/SlotChangeStaff.jsx     → apps/web/src/variants/advising04/SlotChangeStaff.jsx
react/shared.jsx              → apps/web/src/variants/advising04/shared.jsx
react/advising04.css          → apps/web/src/variants/advising04/advising04.css
```

Imports of `../../api.js` resolve to the existing `apps/web/src/api.js`. Slot filtering imports the existing `../../slot-change-filters.js`, not a competing interpretation of search/date rules. `shared.jsx` supplies only the choice control, small reusable facts/feedback/art and native confirmation dialog.

Five `App.jsx` anchors are changed: imports; staff navigation after Directory; screen title map; an additional account renderer; and the staff-only branch of the existing slot renderer. The staff navigation array already belongs to Coordinator/Administrator; the account wrapper separately checks those roles. No student navigation entry is added. No API route, middleware, model, package version, global CSS, PortalChrome or login renderer changes.

Other submissions can add their folders without an app-shell replacement. The installer is anchor-based so unrelated App changes can coexist, but it intentionally stops if an expected anchor was renamed, duplicated or replaced. Review the diff manually in that situation; do not force-overwrite a merged App.

## Actual HTTP contracts

| Work | Method and path | Request / response use |
|---|---|---|
| Directory | `GET /api/admin/students?search=&accountStatus=&studentType=&advisor=` | Reads `students`, `filters`, `term`. Filters are applied through the server. |
| Selected account | `GET /api/admin/students/:profileId` | Reads student profile, populated `user` and `assignedAdvisor`. |
| Account access | `PATCH /api/admin/users/:userId/status` | `{isActive}`; uses returned `isActive`, not an optimistic success. Administrator only in UI. |
| Advisor lookup | `GET /api/admin/advisors/lookup?email=` | Reads full name, email and `isAdvisorInSystem`; no invented identity. |
| Membership add | `POST /api/admin/advisors` | `{email}`; shows actual `emailStatus`. |
| Membership removal | `DELETE /api/admin/advisors/:email` | Encoded email; refreshes current assignments/roster. No history deletion client-side. |
| Active roster | `GET /api/advisor/advisors` | Uses returned eligible advisor array; server supplies active/member scope. |
| Reassignment | `PATCH /api/advisor/students/:profileId/advisor` | `{advisorId}` from the current roster; Coordinator only. |
| Slot queue | `GET /api/slot-changes` | Reads `requests`; server determines assigned-advisor/all-Coordinator scope. |
| Slot detail | `GET /api/slot-changes/:requestId` | Reads `request`, `current`, `alternatives`, `issue`. |
| Slot decision | `POST /api/slot-changes/:requestId/decision` | `{decision, replacementSlotId?, responseNote}`. Exact target for approval; note optional. |

The slot adapter disables full/clashing alternatives for immediate feedback. The server remains authoritative for eligibility, assignment, deadline, freshness, capacity and atomic updates. After saving, the adapter re-fetches both queue and detail. A 409 clears the target and refreshes; a failed initial detail load does not leave the previous record’s actionable form visible. Selection-generation guards reject late record responses. Native confirmation remains open on a failed submission and permits an explicit retry; successful saves followed by refresh failure are identified as saved-but-not-refreshed rather than unsaved.

## Rollback

For the studio, restore the supplied `04-advising/pages.js` stub or remove its six registry entries; leave `host.js` and the other four folders alone. For React, revert the five App diff hunks and remove `src/variants/advising04/`. No database migration or backend rollback is needed because none is included.
