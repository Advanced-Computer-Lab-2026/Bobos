# Portal · Advising / round two

**One Portal integration, not another website.** This folder supplies 60 studio choices across six existing pages and 20 choices across two connected React workflows. Each page has ten choices beside **Original**, remembered independently. The existing sign-in, Overview, navigation, account menu, term treatment and themes remain the host’s.

## 1. Install the studio choices

Copy the **entire `04-advising` folder** into the supplied project, alongside the other four submissions:

```text
project/apps/web/public/portal-studio/variants/
├── host.js                         # existing; do not replace
├── 01-front-desk/                  # existing / other submission
├── 02-student-life/                # existing / other submission
├── 03-academic-setup/              # existing / other submission
├── 04-advising/                    # this folder
└── 05-operations/                  # existing / other submission
```

No dependency installation or HTML change is needed for the studio. The supplied `index.html` already loads this folder’s `pages.js`.

```sh
cd project/apps/web/public
python3 -m http.server 8000
```

Open `http://localhost:8000/portal-studio/index.html?preview=live&role=coordinator`, use the **existing Sign in** button, then visit Student directory, Advising students, Student schedules or Course removals. Open a student or draft through the existing record links. Use the **Page design** dropdown at the top of the content—not a separate design gallery.

The studio’s sign-in is the supplied preview session, not production authentication. Existing role query values `advisor`, `coordinator` and `administrator` allow role inspection. Do not use them as evidence of backend authorization.

| Existing studio page key | Choices | Main work |
|---|---:|---|
| `directory` | 10 | Search, eight facets, selection and access to student records |
| `student-detail` | 10 | Identity, workflow, academic context, weekly schedule and permitted account/assignment actions |
| `advising` | 10 | Browse all advising students; optionally filter to the current advisor’s assignments |
| `student-schedules` | 10 | Find drafts by status and blockers; open review, processing or reopening workflows |
| `draft-schedule` | 10 | Mandatory-first selection, components, credits, validation, save, review-ready, process and reopen |
| `mandatory-removals` | 10 | Search/filter requests, read reasons and record a Coordinator’s decision |

`manifest.json` contains all 80 names, arrangement descriptions, roles, hooks and numbered requirement mappings. `docs/DESIGN.md` explains what changes in each arrangement.

## 2. Install the two connected React workflows

The real account/advisor and staff slot-change workflows are outside the static studio registry. They use the supplied React app, its `api()` helper, real endpoint contracts, existing authorization roles and shell. They are **not** extra static mock pages.

From the supplied `project` root, preflight and then apply:

```sh
python apps/web/public/portal-studio/variants/04-advising/patches/integrate.py --project .
python apps/web/public/portal-studio/variants/04-advising/patches/integrate.py --project . --apply
```

The installer copies four adapter files into `apps/web/src/variants/advising04/` and edits only five narrow anchors in `apps/web/src/App.jsx`. It refuses unexpected anchors or differing installed adapter files rather than overwriting unrelated work. It is idempotent when the same version is already installed. The matching App-only unified diff is `patches/portal-react.patch`.

Launch the existing React/API project using its own README and environment configuration. This submission does not replace its package manifest, authentication, database, API, mail transport or stylesheet system.

| React choice key | Existing app hook | Access |
|---|---|---|
| `account-administration` | New staff navigation entry **Account and advisor access**; `activeScreen === "account-administration"` | Administrator: account activation. Coordinator: advisor membership and assignment. |
| `slot-changes-staff` | Existing **Slot change requests**; `activeScreen === "slot-changes"` | Advisor: server-scoped assigned students. Coordinator: all requests. |

Each adapter has one compact Page design dropdown. **Original** mounts the actual existing component. For account administration, the baseline has no standalone account page, so Original is the existing `StudentDirectoryPage`; its original Directory route is also unchanged. For staff slot review, Original is `SlotChangesPage`. Students continue to receive the original `SlotChangesPage` without the staff adapter.

Exact endpoints and file hooks are in `docs/INTEGRATION.md`.

## Suggested walkthrough

Start with **Directory → Student review desk**, search `71578`, open Mariam and return using the in-app link. The query and per-page choice remain. Switch to **Advising → By advisor** to compare assignments without restricting an Advisor’s general browsing rights.

For a successful local draft cycle, open **Ali Nabil, 70-71587** from Student schedules. His initial draft is complete and has no pending request. Mark it ready, confirm processing, then reopen it with a reason. Try **Three-step review**, **Timetable first** and **Processing desk** without losing the underlying draft.

Omar begins with a pending removal request. In **Course removals → Decision desk**, read his request, choose a decision and enter the required response. Approval exempts the course and removes it from his unprocessed local draft. Mariam also demonstrates a missing lab; Ahmed demonstrates absent, optional preferences; Hana demonstrates an unresolved payment choice. Only an Administrator can change account access; only a Coordinator can assign advisors and decide removals.

In the connected React app, open a pending slot request, compare current and exact replacement components, select an available non-clashing slot and confirm. Cancellation sends no decision. Server conflicts refresh the request and clear a stale selection. An optional response is preserved when a failed submission is retried.

## Scope, honestly

The six studio pages retain and rearrange the supplied renderers and controls, with a **local preview workflow layer**. Sample drafts, assignments and decisions persist in this browser under `portal-ad4-preview:v2`; no database, real capacity reservation, student notification or email is changed. Original remains unmodified and continues to have the original preview behavior. Switching to Original does not make the native preview consume the added local state.

The two React adapters perform real HTTP requests when installed in the actual app. Their test data exists only in Playwright HTTP interception inside `tests/`; no fixture service, credentials, fallback students or fake success response are shipped in the adapters.

The supplied audits document backend defects. This is a scoped UI integration, **not a claim that those defects are repaired**. Full curriculum calculation, all normal-student swap/workflow projections, student-facing visibility/export, SMTP delivery and concurrent database guarantees remain outside the local-preview layer. Read `docs/REQUIREMENTS.md` and `docs/TESTING.md` before assessing completeness.

## Editing and verification

Edit `src/rules.js`, `src/motion.js`, `src/studio.js` and `styles.css`; regenerate the dependency-free entrypoint:

```sh
node build.mjs
node --check pages.js
node tests/rules.test.cjs
```

Browser tests require Python Playwright and a Chromium executable. Run against a fresh copy of the supplied baseline after installing this folder:

```sh
python tests/studio-browser.py --url http://127.0.0.1:8000/portal-studio/index.html --output ./studio-evidence
python tests/react-contract.py --url http://127.0.0.1:5173 --output ./react-evidence
python tests/react-errors.py --url http://127.0.0.1:5173 --output ./react-error-evidence
```

The React browser tests intercept `/api/**` themselves. They are reproducible UI/contract tests, not a live-database acceptance suite. The completed run’s counts, environment and limitations are in `docs/TESTING.md`, with machine-readable results under `evidence/results/`.

## Contents

`pages.js` and `styles.css` are the studio entrypoints. `src/` is editable source. `assets/` contains the approved extra-hours folder. `react/` contains connected adapters. `patches/` contains the guarded installer and App diff. `tests/` contains repeatable tests. `docs/` contains design, source coverage, integration and verification notes. `evidence/` contains actual browser captures, contact sheets and results—not a gallery app.
