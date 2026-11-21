# Integration contract

## Studio host

The only runtime registration is `pages.js`. It loads its adjacent `operations.css` relative to `document.currentScript.src`, then assigns exactly three owned registry entries:

```js
window.portalVariants['pending-work']
window.portalVariants['schedule-activity']
window.portalVariants['financial-records']
```

Each is an array of ten `{name, apply({root,page,role})}` objects. The shared `variants/host.js` continues to own the single selector, Original mode, rendering and localStorage choice. This submission never reassigns an existing registry object and does not write sibling keys.

`apply` starts from the original rendered content. Existing headings, search/type controls, queue links and action nodes are retained or moved. It derives records from the original preview's rows; it does not ship a second sample dataset. Financial preview details use the original host modal and selected row facts. CSV contains the filtered preview rows and is explicitly a preview download. Preview finance never calls a live mutation.

All styles begin with `.ops05`/`.ops05-studio`/`.ops05-react`. The content marker is `data-operation-page`, **not** the host-reserved `data-page` navigation marker. Local handlers attach to local controls. Original delegated `data-page` links remain intact. No document-wide event listener, body replacement, iframe, alternate authentication or toolbar is added by the studio plugin.

The owned role checks are coordinator-only for pending work, and coordinator/administrator for activity and finance. They complement, not replace, the host's navigation/role checks. The original studio is still a design preview, not a secure client for live student records.

## Narrow React edits

`install.py` copies the eight files under `react/` into `apps/web/src/operations/`. The patch changes only the following seams:

| Existing file | Exact seam |
| --- | --- |
| `apps/web/src/App.jsx` | Redirects FinancialRecordsPage, ExtraHoursPage and GraduationReview/StudentGraduation imports to `./operations/`; imports PendingWorkPage/ScheduleActivityPage from the adapter while retaining CalendarSyncPage from `./components/B1Pages.jsx` |
| `apps/web/src/App.jsx` | Passes `profile.role` to owned adapters, `profile._id` as `actorId` to ExtraHoursPage, and original `openScreen` as `onOpen` to PendingWorkPage |
| `apps/web/src/components/AdvisingPage.jsx` | Redirects GraduationPlans import to `../operations/GraduationPlans.jsx`; forwards its existing `role` |
| `apps/web/src/components/StudentDirectoryPage.jsx` | Redirects only ScheduleActivityPage import; forwards existing `role` alongside existing selected `studentId` |

No new top-level navigation route is necessary. Existing App screen keys and permissions remain in place. Adapters' internal `pageKey` values distinguish a queue, detail, editor or confirmation so each can remember its own design. See `manifest.json` for every key/entry/role.

`OpsFrame` owns one compact selector for each React view. A financial dialog suppresses the background selector and displays one inside the active dialog. `OpsGate` checks role before mounting children, so a denied child does not run its data-fetch effect. This is a UI boundary, not server authorization.

The controlled fields and section components keep a stable component tree across design changes. Staged sections remain mounted but hidden; the guided mode checks native validity before advancing. Table arrangements render the existing React cell children and callbacks declaratively rather than moving React DOM nodes by hand. Incomplete/empty tables retain native fallback semantics.

## Original app dependencies retained

The adapters import the existing `../api.js`, `WorkspaceUI.jsx` and, where needed, `PortalChrome.jsx`. They use the original token prop and `api` helper. There is no new HTTP client, auth/session system, router, state package, font or third-party runtime dependency. Existing notifications, theme, sidebar, header, responsive navigation and calendar implementation are unchanged.

## API paths and consequential payloads

The paths below are taken from the supplied implementation. They are not invented API contracts or a new server specification.

| Workflow | Existing API used |
| --- | --- |
| Pending work | `GET /api/admin/pending-work` |
| Activity | `GET /api/admin/schedule-activity`; selected student uses `/api/admin/students/:studentId/schedule-activity`; exports append `/export` |
| Finance | `GET /api/finance/records`, `GET /api/finance/records/:id`, `GET /api/finance/export` |
| Extra-hours lists | `GET /api/extra-hours`, `/api/extra-hours/advisor/mine`, `/api/extra-hours/mine` according to the actual signed-in role |
| Advisor request inputs | `GET /api/advisor/students?advisorId=<authenticated actor>&search=...&page=...&limit=50`; `GET /api/catalogue/courses`; original identity/profile is fallback for actor ID |
| Request creation | `POST /api/extra-hours` with `{studentId, courseIds, graduatingWithinOneYear}`; API resolves active term and authoritative itemized pricing |
| Request detail | `GET /api/extra-hours/:id` |
| Coordinator decision | `POST /api/extra-hours/:id/decision` with `{decision: "approved" | "rejected", responseNote}` |
| Withdrawal | `POST /api/extra-hours/:id/withdraw` for a pending request |
| Wallet | `GET /api/extra-hours/mine/wallet` |
| Immediate settlement | `POST /api/extra-hours/:id/settlement` with `{option:"now", method:"wallet"}` or `{option:"now", method:"gateway", gatewayResult}` |
| Deferral | Same settlement endpoint with `{option:"deferred"}`; no wallet/gateway method is sent |
| Student history | `GET /api/extra-hours/mine/financial-history` |
| Receipt/confirmation | `GET /api/extra-hours/mine/financial-history/:recordId/download`, authenticated blob response and original content-disposition filename |
| Private graduation workspace | `GET /api/advisor/students/:studentId/graduation-plans` |
| Save/update/delete | Original private plan collection/`:planId` endpoints; plan payload includes `{termPlans, exitExamRequest, version}`; deletion includes `version` |
| Submit plan | `POST .../graduation-plans/:planId/submit` with the version returned by saving |
| Request exam | `POST .../graduation-plans/exit-exam-requests` with server-eligible `courseId` and `reason` |
| Submitted queue | `GET /api/graduation/plans` with existing search/status/advisor/from/to/page parameters |
| Plan decision | `POST /api/graduation/plans/:id/decision` with decision, note and original `submittedAt` freshness token |
| Exam queue/decision | `GET /api/graduation/exit-exams`; `POST /api/graduation/exit-exams/:id/decision` |
| Student graduation | `GET /api/graduation/me` |

Finance search and list/export filters remain the original `search`, `type`, `status`, `term`, `startDate`, `endDate`, `settlementOption`; current-page limits are not sent to export. Activity retains `action`, `from`, `to`, `search`, with paging for list only. These tests verify forwarding, not live database filter semantics.

**No reversal POST is issued.** The supplied endpoint is not adequate for the workbook's accounting rules. `financial-reversal` is an explicit blocked review, not a simulated success.

## Persistence and coexistence

Choice storage uses `portal-page-design:<pageKey>` for both studio and React, consistent with the supplied host. It is page-specific, not account-specific, just like the supplied host; no student record or form content is stored by this preference mechanism. A local React memory fallback displays “Session only” when storage cannot be written. The original studio host's own storage behavior is not patched.

Production cross-tab changes are observed by the React adapter's storage listener. The restricted-browser harness does not certify real storage events, reload persistence or native history. Verify these in a normal served browser before integration acceptance.

Sibling coexistence was checked against the supplied four starter folders plus witness registry entries. Actual future sibling submissions were unavailable, so their arbitrary later CSS/registry changes are not certified. Ownership boundaries are intentionally additive.

## Source retention

The original `components/B1Pages.jsx`, `ExtraHoursPage.jsx`, `FinancialRecordsPage.jsx`, `GraduationPlans.jsx` and `GraduationReview.jsx` remain untouched. The installer redirects the relevant imports only. Undo reverses the exact changes, leaves adapter files for safe manual cleanup, and does not overwrite unrelated integrator edits that fail the expected-fragment check.
