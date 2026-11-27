# Verification record and repeatable checks

These are delivery checks, not the original project's backend acceptance suite and not a production certification. Reports are recorded outputs of the enclosed scripts. Test-only API data is in `fixtures.js`; production adapters do not import it.

## Recorded results

| Check | Result | What was actually checked |
| --- | --- | --- |
| React layout matrix | 1,012 combinations; zero horizontal viewport overflows greater than 1px; zero uncaught browser errors | 23 view keys × Original plus ten designs × 1440px/390px × light/dark; one design selector per active view |
| React workflow interactions | 316 passed; zero uncaught browser errors | Role gates, empty/error responses, retained form data and payment choices, decision/withdrawal/plan flows, request payloads, exports, confirmations, selection persistence within the shimmed session |
| Original studio | 132 layout checks and 38 functional checks; zero recorded overflows or uncaught browser errors | Three pages × 11 choices × four viewport/theme combinations; filters, comparison selection, preview CSV, original modal/focus, original queue links, account sign-out/sign-in, calendar state, independent design choices and sibling registry witnesses |
| Source/installer integrity | 304 passed | 286 original files compared, excluding the owned studio starter; exactly three existing React files changed; other 283 unchanged; idempotence, dry run, exact undo, unexpected-baseline rejection, eight exact adapter copies, four existing sibling folders retained |
| Request-folder motion | 9 passed | Authored pose holds, distinct transformations, quiet final hold, finite playback, replay, small drawing, reduced-motion resting state |
| JSX compatibility transpilation | 33 source modules; zero syntax diagnostics | TypeScript transpilation into the explicitly non-production compatibility runtime |

The same three keys exist in the studio and in the React app. They are not six unique pages. There are 23 unique React workflow-view keys and ten non-Original choices per key. A layout check is not a separate end-to-end business-process test. No numerical nonfunctional score is assigned.

## Environment and limitations

The environment's managed Chromium policy blocked ordinary top-level navigation. The browser scripts fetch the supplied HTML over the local HTTP server and load that HTML with `page.set_content`, a base URL, an in-memory `localStorage` shim and no-op history methods. This exercises rendered controls and scripts, but does **not** establish native-origin reload persistence, storage events, browser back/forward behavior, redirects or production content-security-policy compatibility.

The studio uses its original supplied preview data and login. The React tests intercept `fetch` only inside the test harness. They run the original app shell/login against isolated fixtures to exercise adapter transitions and API request shapes. These are not working credentials and are not an alternate product login. The runtime contains no fixture imports. No real MongoDB, authorization boundary, payment provider, wallet concurrency, refund transaction or student record was tested.

The offline React runtime is **React 18.2**, obtained from the environment's already-installed JupyterLab chunks. The supplied project requests a different React/Vite toolchain, and npm network installation was unavailable. No dependency manifest was modified and no production React 19/Vite build was claimed. `offline_bundle.cjs` is an optional archived-environment compatibility tool, not a build replacement or an app entry point. Its generated bundle is intentionally not included in the delivery.

Receipt/confirmation tests check the authenticated endpoint and blob-download dispatch. The PDF response fixture is a marker, not a generated receipt. Real PDF content and accounting correctness remain backend acceptance checks. Reversal review is intentionally blocked in the UI; a passed blocked-action test does not mean refunds are implemented safely.

Sibling coexistence was tested with the supplied four starter folders and additional witness registry entries. The other teams' future final submissions were not available to test. Screenshots and viewport tests do not establish comprehensive accessibility, screen-reader, browser-compatibility, high-volume pagination or visual-quality certification.

## Repeat in a compatible local environment

The scripts require Python, Playwright and Chromium. `CHROMIUM_PATH` can override the default `/usr/bin/chromium`. Run the scripts from this folder. Their reports are written under `reports/`; the matrix and studio scripts also refresh screenshots under `../evidence/`.

First copy this submission into the original studio folder, as described in the top-level README, and serve `project/apps/web/public` on port 8000. For the original studio:

```sh
OPS05_STUDIO_BASE=http://127.0.0.1:8000/portal-studio/ python3 browser_studio.py
```

The integrity script needs an untouched extraction of the exact uploaded round-two ZIP. It deliberately installs, undoes and reinstalls the patch, so use a disposable fresh copy. Copying this submission's public folder into that copy is allowed; do not install the React patch beforehand.

```sh
python3 check_install.py /path/to/05-operations-round-2.zip /path/to/disposable-fresh/project
```

For the optional offline React checks, install the adapter into a disposable original project first. The bundler requires TypeScript (locally resolvable, `TYPESCRIPT_PATH`, or globally installed) and the exact JupyterLab runtime chunks it names. `OPS05_JUPYTER_STATIC` can override the detected JupyterLab static folder. It stops explicitly when those chunks are absent; do not count a missing-runtime run as a pass.

```sh
node offline_bundle.cjs /path/to/project/apps/web/src /path/to/project/apps/web/public/__ops05_test
OPS05_REACT_BASE=http://127.0.0.1:8000/__ops05_test/ python3 browser_react_matrix.py
OPS05_REACT_BASE=http://127.0.0.1:8000/__ops05_test/ python3 browser_react_workflows.py
OPS05_REACT_BASE=http://127.0.0.1:8000/__ops05_test/ python3 browser_motion.py
```

Serve the corresponding public folder on that port. Delete `public/__ops05_test/` after testing; it is not a production route. Tests use the restricted transport even on an unrestricted computer, so their results retain the same native-navigation limitations.

## Required integration acceptance beyond this delivery

Run the original project's production build and strict API suites with its specified dependencies, real test database and original auth setup. In an ordinary browser, sign in through Portal, choose a design, navigate away and back, reload, sign out, sign in again and verify per-page persistence. Exercise a second tab and native back/forward navigation. Check both themes and keyboard/screen-reader interactions on each active role.

Exercise real loading/error/large-dataset states; verify scoped authorization, assignment changes, current eligibility, optimistic concurrency, graduation validation and CSV contents against database records. Verify actual PDF receipts versus deferred confirmations. Resolve the documented server gaps before enabling financial reversals or accepting wallet/accounting correctness. These are outstanding integration gates, not tests reported as passed here.
