# Verification report · 20 November 2026

## Completed result

| Run | Result | Meaning |
|---|---:|---|
| Deterministic preview rules | **69 passed** | Allowance/rounding/probation, activated hours, course/component validity, mandatory rules, capacity, clashes, bachelor constraints, blockers, permissions and search/date predicates. |
| Fresh-baseline studio rendering | **360 configurations** | 6 pages × 10 designs × 2 themes × 2 viewports as Coordinator = 240; 6 × 10 as Advisor and Administrator at desktop light = 120, including denied/read-only views. |
| Connected React queue rendering | **160 configurations** | Both workflows as Coordinator; account as Administrator; slot review as Advisor. Each permitted combination × 10 designs × 2 themes × 2 sizes. |
| Connected React opened-record rendering | **80 configurations** | 2 workflows × 10 designs × 2 themes × 2 sizes with the selected record and actual action controls open. |
| Studio interaction/integration checks | **50 passed** | Original, per-page persistence, genuine in-app navigation, filters, comparison limit, confirmations, keyboard return, removal decisions, component edit, ready/process/reopen, optional preferences, payment blocker, roles, sign-out/sign-in and reduced motion. |
| React contract checks | **21 passed** | Assignment/account/membership methods and payloads, role-appropriate controls, email-status response, exact slot approval/rejection, cancellation and 409 refresh. |
| React error/detail checks | **17 passed** | Service/detail retries, date feedback, no stale decision after failed opening, selection persistence, keyboard cancellation, failed decision retry, withdrawn state, assignment authorization error and Original recovery. |

**Totals: 600 render configurations, 88 named browser checks, 69 preview-rule assertions. No captured JavaScript page errors and no document-width overflow in the completed render matrices.** These counts describe distinct configurations and named assertions in the final completed runs; unsuccessful development runs and repeated earlier smoke runs are not added to the totals.

Raw results are in `evidence/results/`. A configuration is a render/overflow/selector check, **not** a full end-to-end approval journey repeated for that design. Workflow components and state are shared across each ten-choice group; the named interaction checks exercise representative arrangements and selected cross-design transitions. All 600 configurations were not individually assessed by a human accessibility reviewer.

## Fresh-copy proof

The original `04-advising-round-2.zip` was extracted again into a fresh directory. Only this returned folder was copied into `project/apps/web/public/portal-studio/variants/04-advising/`. The supplied four other variant folders, `variants/host.js`, `index.html`, native `app.js`, existing styles, login, account menu and calendar remained unchanged.

The studio was tested from that fresh copy. The React installer was then applied there and applied a second time to verify idempotence. It added four adapters and changed only the five documented App anchors. Comparing every original archive file after both steps found **286 of 288 original files byte-identical**. The two deliberately changed original files are the owned `variants/04-advising/pages.js` stub and `apps/web/src/App.jsx`. With the optional React patch excluded, the studio-only install changes just its owned stub among the original files. The complete filename comparison is recorded in `integration-results.json`.

Coexistence was tested with the **four variant stubs supplied in this baseline**; implementations from other chats that were not included in the archive could not be tested. The entrypoint writes only its six owned registry keys, and styles/events are scoped to the owned content. It does not replace the registry or host.

## Environment and what actually ran

The static project was served with Python’s HTTP server and exercised by Python Playwright using the locally installed Chromium executable. Desktop source viewport: 1440 × 1000. Mobile: 390 × 844. Themes were set through the existing theme state, not by substituting a screenshot palette. Reduced-motion emulation was used for the stationary-drawing check. The actual native Sign in, account-menu Sign out, sidebar links, filters, native dialogs and calendar arrows were used.

Node **22.16.0** executed the pure rules and regenerated/checked the dependency-free `pages.js` bundle. The three JSX source files were transpile-checked with installed TypeScript. Regeneration produced the same entrypoint bytes as the copy exercised in the fresh baseline.

The supplied React dependency tree was not installed in this environment, so **`npm run build` was not run**. Instead, the actual freshly patched `App.jsx`, its existing components/API helper/filter function, and the four new adapter files were transpiled into a temporary browser harness. The available local React **19.1.1** runtime from the installed Playwright tooling was used. This is not certification of the version ranges in the supplied package manifest. The temporary compiled harness and its runtime are **not delivered** as another app, nor are package versions modified.

API responses in the React tests were intercepted by Playwright using shapes checked against the supplied controllers. The fixture token exists only in the test context. The actual app shell and adapter code were mounted; a hand-built facsimile of the page was not used. The scripts can also run against the existing app’s normal development server and install their own HTTP fixtures.

## Important tested behavior

The role distinction between browsing all advising students and reviewing only assigned slot requests is preserved in the UI/contract. Administrator account actions and Coordinator membership/assignment actions are separate. The empty/no-match state is not a fake successful fetch. Failure opening a request removes prior actionable detail; a conflict clears its exact replacement. Failed submission retains input and is retryable. Cancellation sends no mutation. Server responses determine connected success/decision state.

The local preview cycle includes required removal response, approved removal editing an unprocessed draft, rejection preserving the mandatory course, full component option disabled, removing and restoring a lab, incomplete save, valid review-ready, final processing, required reopen reason and retained history. Optional missing preferences and payment-choice blockers are represented. Keyboard Escape/focus return and reduced-motion stillness are checked; a full WCAG audit is not claimed.

The approved extra-hours folder is byte-identical to the supplied asset. No fonts, unrelated application copies, node_modules, generated React harness, credentials or production data are included in the deliverable.

## Not executed / not established

No live MongoDB/API acceptance suite, SMTP delivery, payment gateway, real identity session invalidation, browser-engine matrix, screen-reader audit, multi-user concurrency or last-seat database competition was executed. HTTP interception cannot prove ownership isolation, transaction atomicity, real data retention or mail delivery. Native student-facing visibility/export after a local staff-preview change is not wired to the added browser store. All pre-existing features were not regression-tested merely because their files remained identical.

The backend failures in the supplied audit remain failures outside this UI patch; they are not relabeled as passing TODOs. The README and requirements matrix distinguish local behavior, API consumers, retained functionality and unverified guarantees.

## Reproduce

Use the three browser commands and pure-rule command in the README after copying into a fresh baseline. `studio-browser.py --workflow-only` omits the Coordinator visual matrix for faster interaction debugging; that mode is **not** the 360-configuration final run reported here. `motion-capture.py` captures task-triggered exposed poses. `make-evidence.py` produces the documentary sheets from saved browser PNGs.

The supported browser path is configurable with `--browser`. Test fixtures are confined to `tests/`. Browser tests return a nonzero exit status on a failed assertion; no expected-failure suppression was added.
