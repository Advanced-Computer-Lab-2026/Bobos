# Requirement coverage and source traceability

## Basis and scope

Read directly from the supplied `START-HERE.md`, `project/requirements/PAGE-BRIEFS.md`, both requirement sheets in `GUC_316_70_71577_2026-09-27T06_59_26.xlsx`, the relevant React/API source, and the two audit documents listed below. `requirements-source.json` preserves the twenty assigned numbered rows and the nonfunctional sheet's extracted cells. It is the original source wording, not an invented acceptance checklist.

Every one of the ten choices on a page shares its workflow functions and permission checks. The matrix describes **interactive studio coverage plus the authenticated-component handoff**, not a new certification of backend correctness.

| Requirement | Studio coverage in every page choice | Real authenticated implementation retained |
| --- | --- | --- |
| R15 | Assigned advisor name and GUC email; no-assignment state; copy/email actions. | `AdvisingPage.jsx` → `MyAdvisorPage`; `/api/advisor/my-advisor`. |
| R31 | Course code/name, lecture/tutorial/lab day/time/room and days off. Normal students see only processed; advising students see only ready-for-review or processed. Staff have a read-only incomplete-draft scenario. | `SchedulingPages.jsx` → `StudentSchedulingPage` / `StaffSchedulesPage`; `/api/schedules/me`, `/api/schedules/student/:studentId`. Existing server release and role checks remain authoritative. |
| R32 | The four inherited registered courses, each credit value and the 19-credit total. Same release gate as the schedule. | `/api/schedules/me/courses` in `StudentSchedulingPage`. |
| R33 | Select a course or component and inspect all assigned lecture/tutorial/lab details. | `/api/schedules/me/courses/:courseId`, including the existing term context. |
| R34 | Exact-course-set, same-term destination fixtures; complete twelve-component schedules, days off and group number. | `/api/swaps/eligible-groups` in `SwapManagement` within `SchedulingPages.jsx`. |
| R35 | Multi-destination selection, immutable current group, deadline, confirmation, one open local request and error feedback. | Existing `SwapManagement` request submission through `/api/swaps/requests`. No new transaction logic. |
| R36 | Anonymous eligible offers with the complete destination schedule. No requester identity is rendered. | Existing `/api/swaps/requests/open`; API checks exact subjects, term and processed state. |
| R37 | Confirm a whole-schedule local exchange; group, all component fixtures and version move together; stale-offer failure can be demonstrated. | Existing completion endpoint and transactional service. **The static preview does not prove live revalidation, concurrency or two-party atomicity.** |
| R38 | Own submitted/completed request history, current/desired groups, Open/Completed/Withdrawn/Expired statuses. | Existing `/api/swaps/requests/me`, unchanged server ownership/history. |
| R39 | Confirm withdrawal of an own Open local request only. Terminal requests have no withdrawal action. | Existing request withdrawal endpoint and owner/status checks. |
| R40 | Advising-student-only request for one assigned component, optional note, completed ready-for-review gate, deadline, duplicate-pending validation; no direct schedule editing. | `SlotChangesPage.jsx` → `/api/slot-changes`; `StudentSchedulingPage` preserves the `onOpenSlotChanges` route callback. |
| R41 | Pending, Approved, Rejected and Withdrawn records; response note and an explicit replacement in the resolved example. | Existing own-request endpoint `/api/slot-changes/me` and populated decision/replacement details. |
| R42 | Pending-only withdrawal with confirmation and retained history. | Existing slot-request withdrawal route and server status/ownership guard. |
| R49 | Processed-student-only PDF, print and .ics. PDF and print contain the complete schedule rather than only the currently filtered day/course. | Existing `/api/schedules/me/download` PDF endpoint and Print action in `StudentSchedulingPage`. |
| R54 | Completed courses with grades, current courses, remaining courses with credits/prerequisites/seasons; identity, advisor, major, GPA, completed hours and semester. Staff cannot see the student wallet tab. | `BasicPages.jsx` → `StudentRecordsPage`; `/api/identity/students/:profileId/history`. Adapter requires an explicit selected student for staff and ignores another student's context ID for students. |
| R55 | Attended-year selector and transcript; Winter, Spring, Summer, first makeup and second makeup are represented where present. Year comparison never changes the primary export target. | Existing `/transcript/years` and `/transcript?year=` routes under the student profile. |
| R56 | Actual preview PDF for the displayed attended year only, with explicit non-official labeling. | Existing `/transcript/download?year=` PDF route, existing ownership controls. |
| R57 | Days off, preferred/avoided days and time ranges, course/component group priorities, optional note, updates before deadline, validation and saved feedback. Mandatory/prerequisite/offering/capacity/clash/credit/extra-hour rules are stated as controlling constraints. | `PreferencesPage` uses the existing student preferences GET/PUT routes, published group choices, term context and validation. |
| R58 | Latest saved preferences and priorities/last-update context, staff read-only controls, return-to-draft handoff and a truly unsubmitted empty state. No submission is not a scheduling blocker. | Existing staff student lookup and read-only `PreferencesPage`; `onOpenDraftSchedule(student, termId)` returns to `StaffSchedulesPage`. |
| R116 | Explicit simulated OAuth handoff without a password field; processed-only sync/file export; twelve recurring events with course/component/time/location/instructor, teaching dates, Africa/Cairo timezone, stable UIDs, disconnect, unchanged re-sync and retry. | `B1Pages.jsx` → `CalendarSyncPage`; `/api/calendar/connection`, `/api/calendar/connect`, `/api/calendar/sync`, disconnect DELETE, and the existing OAuth callback. The real provider is not contacted by the preview. |

## Exact integration hooks

Copy `integration/StudentLifeRoutes.jsx` to `project/apps/web/src/components/StudentLifeRoutes.jsx`. From `project/`, dry-run and apply the included patch:

```sh
patch --dry-run -p1 < apps/web/public/portal-studio/variants/02-student-life/integration/app-integration.patch
patch -p1 < apps/web/public/portal-studio/variants/02-student-life/integration/app-integration.patch
```

The patch redirects only the seven owned render branches in `apps/web/src/App.jsx`, cleans up the imports they no longer need, and excludes recognized owned routes from the unrelated fallback-to-Overview branch. Authentication, `api.js`, profile loading, navigation, theme, notifications, staff schedules, slot changes, extra hours and every other contributor's route are unchanged.

The adapter exports `STUDENT_LIFE_ROUTES`, `STUDENT_LIFE_PERMISSIONS`, `canOpenStudentLifeRoute(pageKey, role)` and the default `StudentLifeRoute({pageKey, token, profile, context, notify, onOpen})`. The existing `App.jsx` state and callbacks are passed directly. See `integration/BASELINE.json` for the expected unpatched App.jsx hash.

This optional adapter is deliberately **not loaded by the studio registry**. The 70 browser-DOM compositions are review implementations. Production visuals still come from the existing authenticated React components; porting a chosen composition into those components is a separate design-integration step. This prevents synthetic data from silently entering production.

## Nonfunctional coverage

The original requirements emphasize coherent information architecture, familiar and consistent controls, visible feedback, learnability, efficient task completion, error prevention/recovery and regression safety. The implementation keeps the host shell and vocabulary, preserves route links and native tabs, makes consequential actions confirmable, shows explicit empty/disabled/error states, provides labeled controls and focus indication, uses native modal dialogs with Escape/focus restoration, supports keyboard day/step/component controls, and disables authored motion under reduced-motion preferences.

All CSS is scoped to `.sl2-page` / `.sl2-dialog`; the print-only shell rules are conditional on `.sl2-print-schedule`. Event listeners are attached to the owned content wrapper. There is no new document-level click handler, router, role selector, credentials form, remote font or design toolbar. Layouts are tested in both approved themes and at desktop/mobile sizes. These checks are not a formal accessibility conformance certification or a cross-browser usability study.

## Supplied audit findings are not this delivery's test results

`project/docs/group-b-c-requirements-audit.md` reports the earlier strict B/C run as 110 tests, 96 passed and 14 failed, and describes Google-provider responses as mocked. It explicitly says implementation presence is not full acceptance.

`project/docs/group-a-sprint2-audit.md` reports the later integration: strict Group A 84 tests, 72 passed and 12 failed; post-integration B/C regression 118 tests, 105 passed and 13 TODOs; the focused offering-year suite 73 passed. That audit says the concurrent processing/history gap was repaired while other B/C gaps remained. Its swap transaction coverage and the B/C calendar/slot-request coverage are **source-reported**, not re-run here.

Known shared-rule gaps—such as GPA-only probation/credit allowances, some financial concurrency/reversal behavior and missing staff action/reminder notifications—are not repaired or concealed by a design package. The complete current API acceptance suites, database behavior, credentials, real email delivery and real Google OAuth must still be verified in the deployed environment.
