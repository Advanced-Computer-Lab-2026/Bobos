# Requirement coverage

Numbers and role names below come from the workbook and `PAGE-BRIEFS.md`. “Preview” means exercised local transactions; “React” means existing production controls retained behind the route adapter, not new backend verification.

| Requirement | Required work and implementation | State / safeguard |
|---|---|---|
| R16, R17 · Administrator | `terms`; all term, teaching, registration, advising and whole-schedule-swap date fields. React `TermsWorkspace` remains API-backed. | Required/invalid/reversed dates, duplicate term identity, teaching bounds, read-only roles, save error. Cross-workflow enforcement remains the original APIs. |
| R18–20 · Administrator | `courses`, `course-detail`; code, name, credit hours, core/elective/huma, faculty/major, recommended semester, offering season, prerequisites. | Search empty state; complete editor; duplicate code, missing/invalid values, unknown/self prerequisites; safe edit; read-only access. |
| R21 · Administrator | Separate deletion action and review. React original DELETE retained. | Prerequisite/offering references block local deletion; unused course deletes. No silent cascade. |
| R22, R23, R25, R26 · Administrator | `offerings`; course/term, inherited academic year, instructors, eligibility, all component groups, day/time/room, maximum/assigned/remaining capacity. | Draft/new/empty groups; metadata errors; timetable/room/instructor conflicts; occupancy floor; protected deletion; harmless capacity edit preserves seats. |
| R24 · Administrator | `copy-offerings`; source term label includes academic year and season; existing destination. Review distinguishes new drafts, skips and conflicts. | Empty/invalid/same or later source rejected; Winter/Spring/Summer supported; existing course-term skipped; no student/schedule/request/history/publication transfer; seats reset and remaining recalculated. |
| R27 · Administrator | Publication review, publish/unpublish. Real PATCH is retained with a confirmation state in the scoped React patch. | Missing groups/instructors/eligibility or inactive course prevents publication locally; references prevent unsafe unpublication; production errors remain visible and retryable. |
| R28, R29 · Coordinator | `templates`, `template-detail`; major, semester, study group, term, published offerings and one component group per type; linked meetings included. | New/empty/working/saved/published; missing components, duplicate course/group identity, wrong term/major/cohort and timetable conflicts. Saved and working comparison; no silent rewrite of processed schedules. |
| R30 · Coordinator | `group-assignments`; inspect current and destination timetable, assign/reassign, create processed schedule from published template. | Normal-student only; matching cohort; active account; capacity; unassigned/assigned/reassigned; history retained and seats transferred. Administrator read-only. |
| R128 · Administrator | Whole-file CSV validation, row-level errors, pre-commit review, create/update by code. Existing production import endpoint retained. | Invalid row blocks all imports; duplicate/header/size/quote errors; forward prerequisite references; safe repeat upsert; import pending and storage/server error paths. |

## Non-functional workbook criteria

**Information Architecture.** Tasks remain under existing Academic setup navigation. Controls sit beside the records they affect. Matrices and timetables scroll locally rather than expanding the page. Detail sections distinguish catalogue attributes from term-specific delivery.

**Feedback and Responsiveness.** Validation is in context; commits announce outcomes. Native dialogs disable submit while the handler runs. Source React loading, busy, empty, API-error and retry states remain in their original components. A browser-only save is not presented as a production server success.

**Navigation is Reversible.** Existing sidebar/brand/profile navigation is preserved. Course details retain the original Back control; template editing has Back to templates. Dialog Cancel, Close and Escape return focus to the opener. Selection and filter state are kept per owned page. Browser Back is not the only return route.

**Learnability and Visibility.** Existing Portal vocabulary, font inheritance, button treatment and muted surfaces remain. One Page design selector is supplied by the host; there is no second design toolbar. Destination, publication and capacity are visible before consequential actions.

**Efficiency.** Search, persistent index/selection, selective copy, comparison, group folders, focused steps and tabular layouts offer different workflows. Required data are not removed when the composition changes; lower-priority detail can be disclosed or inspected.

**Design for errors.** Validation precedes mutation; preview actions clone before committing. Destructive operations show dependencies. CSV errors are row-addressed. Storage failure and stale-opened-dialog writes preserve data. UI permissions are checked again by local dispatch, while production authorization remains server-side.

**Satisfaction / professional UI / consistent elements.** These are subjective workbook criteria, not a numeric claim. Same-size, same-mode browser comparisons against Overview are included. Drawings stay at task scale; no decorative hero, repeated statistic band or new brand was added.

**Smooth app flow.** Existing sign-in/sign-out, Overview, profile, calendar month, Original renderer and original dialogs were exercised after integration. No cross-part API, authentication, notification or shell implementation was replaced. The optional React patch is separately documented and requires host integration/build verification.

## Shared state coverage, not eighty forked controllers

Every arrangement invokes the same page controller and transaction functions. The matrix exercises search and transfer selection across all choices. Detailed mutation/error tests exercise the shared handlers and pure rules. It does **not** claim that every combination of every business rule and all 80 layouts has an independent end-to-end test.

A local fixture has no network-loading state to simulate honestly. The React adapter preserves real asynchronous states; the studio does not show artificial delays or fake remote success messages. Resolved/retry states include successful copy, repeat duplicate-safe copy, corrected CSV, corrected template selection, blocked publication/deletion, quota failure and stale dialog recovery.
