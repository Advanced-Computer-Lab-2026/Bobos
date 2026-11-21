# Academic setup · Portal integration

Round-two delivery. This folder adds **80 page-specific choices inside the supplied Portal**, not a second application. The eight page keys each have ten choices plus the host's unchanged **Original**. There is no landing page, alternate sidebar, login, iframe, gallery router or design toolbar.

## Install the preview

From the directory containing the supplied `project/` and this ZIP's `variants/`:

```sh
cp -R variants/03-academic-setup project/apps/web/public/portal-studio/variants/
cd project/apps/web/public
python3 -m http.server 8000
```

Open `http://localhost:8000/portal-studio/index.html?preview=live` and use the existing sign-in. The supplied host already loads `variants/03-academic-setup/pages.js`; no index, shell, host, authentication or API file needs changing. The other four variant folders remain alongside this one.

Use **Page design**, the single select supplied by `variants/host.js`. Original is option 0. Options 1–10 are remembered independently under `portal-page-design:<page-key>`. Navigate away and back, reload, or sign out and in: the choice remains.

For Administrator preview tasks, start with `?preview=live&role=administrator`. For templates and assignments, use `?preview=live&role=coordinator`. These are the **existing preview's role parameters**, not a replacement for production authentication. No credentials are invented here.

| Owned page | Main work | Write role |
|---|---|---|
| `terms` | Term, teaching, registration, advising and swap dates | Administrator |
| `courses` | Catalogue browsing, creation and whole-file CSV import | Administrator |
| `course-detail` | Attributes, prerequisites, editing and protected deletion | Administrator |
| `offerings` | Instructors, eligibility, component groups, capacity and publication | Administrator |
| `copy-offerings` | Previous source term → existing target, skips and conflict review | Administrator |
| `templates` | Major / semester / study-group templates | Coordinator |
| `template-detail` | Component choices, weekly timetable and publication | Coordinator |
| `group-assignments` | Current vs destination, processed schedule and reassignment | Coordinator |

Broader read-only access follows the supplied read routes where relevant. The Administrator assignment view is read-only; catalogue and term writes are never granted to Coordinator, Advisor or student roles.

## What the choices change

Each page has its own names and composition details. The common interaction families are ledger, indexed browsing, selection + inspector, cards, folders/timeline, readiness queue, comparison, planning view, focused record/steps, and a matrix. They share transactions rather than ten diverging data models. `manifest.json` enumerates every name, page key, requirement and role boundary.

The existing page heading and action controls are reused. The existing search input is reused where available; the ledger reuses the original table element. Native dialogs complete the supplied preview-only actions. The shell, notification/profile links, sign-out, global navigation, overview and binder remain the host's.

## Preview versus real application

**Studio choices use explicitly labelled browser-only preview records.** Mutations are stored in `portal-academic-setup:preview:v2`, not sent to an API. CSV imports, copies, template edits and assignments share this store. The untouched Original renderer continues to show its supplied reference records; it is not a second view of the transactional preview store. See `docs/source-decisions.md` for every fixture extension and discrepancy.

The optional **real React integration** is separate. It rearranges the existing React forms and tables without importing preview records, replacing API functions, changing tokens or mocking responses. It adds 21 route/state keys around the real workflows, using only React and React DOM already declared by the host.

```sh
python3 variants/03-academic-setup/patches/apply-react.py project --check
python3 variants/03-academic-setup/patches/apply-react.py project
```

The installer requires Python 3 and Git. It verifies the exact two source-file hashes before applying. It refuses a changed baseline instead of overwriting another integrator's work. The patch changes only `AcademicWorkspace.jsx` and the `GroupAssignmentsPage` area of `SchedulingPages.jsx`; the adapter files are copied to `apps/web/src/components/academic-setup/`. Full hooks, API paths and constraints are in `docs/integration.md`.

**React patch applicability and JSX syntax were checked. A production React build, live database/API acceptance and real-account authentication were not run here.** The supplied runtime packages were not installed and network dependency retrieval was unavailable. Existing audit gaps are not reported as repaired by a layout adapter.

## Themes and motion

All app colors, fonts and controls inherit the Portal theme. The supplied `preview=live` bootstrap pins its initial theme to dark and hides studio controls; this folder deliberately does not add a second theme toolbar. Both host theme modes were exercised through the existing `lab.dark` / `applyLook()` mechanism. The source's studio mode also retains its original controls. Production theme controls remain unchanged.

Task drawings are small, authored eight-pose strips: file, calendar, transfer, group movement and weekly schedule. They play once on hover/focus and rest; reduced-motion uses the static final pose. Editable pose sheets live in `assets/`. Course marks use the same compact scale as the existing teaching-week illustrations. No font binaries or external asset dependencies are included.

## Verification and evidence

The folder was copied into a freshly extracted round-two baseline and exercised there. Included reports distinguish preview tests from production integration checks:

- `evidence/domain-tests.tap`: 73 pure preview-rule tests.
- `evidence/browser-journeys.json`: 43 workflow assertions through existing sign-in and navigation.
- `evidence/layout-matrix.json`: 640 checks, covering 8 pages × 10 choices × 4 widths × 2 themes, plus 64 Original checks.
- `evidence/shell-and-evidence.json`: 68 shell, role, focus, mobile-dialog and finite-motion assertions.
- `evidence/layouts/`: all 80 desktop-dark and all 80 phone-light viewport screenshots.
- `evidence/overview-comparison.jpg`: Overview and the academic desk at the same viewport in both modes.
- `evidence/package-smoke.json`: 110 passing checks against the ZIP-extracted installation.
- `evidence/contact-sheets/`: ten-choice sheets for each page, plus complete desktop and phone overview sheets.

`docs/verification.md` records what these checks do and do not prove. Screenshots are actual browser captures; contact sheets only resize and label them.

## Edit and rebuild

`src/` is the editable source. `pages.js` is the committed, dependency-free browser bundle.

```sh
node build.mjs
node --test tests/domain.test.mjs
python3 tests/browser-journeys.py --base http://127.0.0.1:8000
python3 tests/layout-matrix.py --base http://127.0.0.1:8000
python3 tests/shell-and-evidence.py --base http://127.0.0.1:8000
python3 tests/package-smoke.py --base http://127.0.0.1:8000
```

Browser tests need the Python Playwright package and a Chromium executable; pass `--browser` for another executable path. These are test tools, not preview runtime dependencies.

To reset only this preview's academic records, remove `portal-academic-setup:preview:v2` and keys beginning `portal-academic-setup:view:` from the browser's local storage. Do not clear all storage: that would also remove other submissions' selections and the host session.
