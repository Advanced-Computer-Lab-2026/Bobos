# Integration contract

## Studio: additive folder only

Destination: `project/apps/web/public/portal-studio/variants/03-academic-setup/`.

`pages.js` registers exactly these eight arrays on the existing `window.portalVariants`: `terms`, `courses`, `course-detail`, `offerings`, `copy-offerings`, `templates`, `template-detail`, `group-assignments`. Every array has ten `{ name, apply({root,page,role}) }` objects. Existing sibling keys are not enumerated, cleared or rewritten.

The supplied host attaches its selector **after** applying a variant. The adapter captures the existing heading, action buttons, search and table before replacing only the page's content arrangement. It does not replace `#app`, the sidebar, topbar or shell renderer. Option 0 never invokes the adapter.

`styles.css` is loaded once using the script's local URL. All application selectors are under `.as-root`; the unique animation name is `as-file-poses`. Scoped metadata uses `data-as-page`, deliberately **not** the host's delegated-navigation attribute `data-page`. Links that should navigate still use the host's original `data-page` convention.

Click/input/change handlers are attached to the newly mounted academic root and native dialog, not document/window. Dialog submit is stopped before it reaches the original preview modal handler. Modal keyboard events do not leak slash into the host quick-find. Detached content has no persistent subscription or timer. The only global diagnostic is the read-only `window.portalAcademicSetup` metadata object; it contains no auth override or mutable application state.

The module depends on existing `navigate`, `href`, `selectedCourse` and `academicTerms` bindings where noted in source, plus the host's CSS tokens. It never resets calendar month/style or installs a replacement auth/session. There are no runtime fetches, CDNs, font binaries or added package dependencies.

## Real React: optional scoped patch

The supplied React app uses `activeScreen` and component/modal state, not a URL router. The adapter therefore uses stable **route-state keys**, listed in `react/routes.js` and `manifest.json`. They are not invented URL endpoints.

Existing files changed:

| Path | Exact hooks |
|---|---|
| `apps/web/src/components/AcademicWorkspace.jsx` | `AcademicWorkspace` provider/root; `CoursesWorkspace` course-detail/editor/import/delete; `TermsWorkspace` editor; `OfferingsWorkspace` create/detail/delete and publication review; `DuplicateOfferingsPanel`; `TemplatesWorkspace` editor/delete; named `Modal` bodies; inline existing/new slot forms in `OfferingDetails`. |
| `apps/web/src/components/SchedulingPages.jsx` | Exported `GroupAssignmentsPage` wrapper and its assignment / unassignment dialog bodies only. Other scheduling exports are unchanged. |

New files copied to `apps/web/src/components/academic-setup/`:

- `AcademicDesign.jsx`: one selector via a provider portal, route registration, remembered layout, field/record index, input review, focus steps and native-invalid-field reveal.
- `routes.js`: 21 route-state keys, exact role/API metadata and ten layout names.
- `academic-design.css`: scoped presentation only.

The adapter does not import preview `seed.js`, `domain.js` or `pages.js`. Existing React children remain mounted: forms, refs, controlled values, submit handlers, token-bearing `api(...)` calls, busy flags, errors, cancel behavior and notifications remain original. Summary panes derive their values from the mounted controls and are explicitly read-only. It does not clone fields or maintain a competing form model.

Course and term write controls had broader visibility than their server write permissions. The patch adds Administrator visibility/callback guards and read-only term fields. Group assignment uses the existing `canAssign` boundary, not a new client-side role grant. The server remains authoritative. Route metadata is documentation, not a substitute for middleware.

Publication adds a review before the existing `PATCH /api/catalogue/offerings/:id/publish`; the original API function still executes and reloads data. A failed request keeps the review and server error available for retry. No backend validation or transaction is replaced.

## Existing API families retained

- `GET/POST /api/catalogue/courses`, `PUT/DELETE /api/catalogue/courses/:id`, `POST /api/catalogue/courses/import`.
- `GET/POST /api/academic-terms/academicTerm`, `PUT /api/academic-terms/academicTerm/:id`.
- `GET/POST /api/catalogue/offerings`, `GET/PUT/DELETE /api/catalogue/offerings/:id`, slot POST/PUT/DELETE below that ID, `PATCH .../:id/publish`, `POST .../duplicate`.
- `GET/POST /api/academics/schedule-templates`, `PUT/DELETE .../:id`.
- `/api/group-assignments/terms`, `/students`, `/groups`, assignment POST, term-scoped unassignment DELETE.

Exact query/state hooks are in `react/routes.js`; API definitions are the supplied catalogue, academic-term, academics and group-assignments route files. The React offering workspace is Administrator-only even though certain offering GET routes serve broader advising/preference use cases. The adapter does not widen the real workspace's access.

## Applying, coexistence and rollback

`patches/apply-react.py` checks SHA-256 of both original files, then runs `git apply --check`. It refuses a changed source or an existing destination adapter directory. On copy/apply failure it restores the two original byte sequences and removes its own partial adapter directory. It never changes package manifests, auth, API controllers, migrations, App-level navigation, other variants, or shared global styles.

For an integrator with other React patches already applied, inspect and merge the small component-specific hunks manually; the hash guard deliberately refuses to guess. Studio coexistence needs **only adding the folder**. The optional React patch is not required to view or operate any of the 80 studio choices.

To undo the optional integration on an otherwise unchanged patched baseline, reverse `react-integration.patch` with Git and remove `apps/web/src/components/academic-setup/`. Keep source control backups when combining multiple submissions. To remove the studio contribution, remove only its folder; restore the baseline empty placeholder if your loader expects a file at that path.

## Production verification boundary

The patch was checked against exact supplied source hashes, applied in an isolated copy, and all modified/new JSX was syntax-parsed. A Vite production build and live API/browser run remain required in the host's normal development environment. No dependency version, installed React runtime, database state or backend acceptance result is invented by this delivery.
