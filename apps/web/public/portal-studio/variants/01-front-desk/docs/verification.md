# Verification / delivered code

The native extension was copied into a **fresh extraction of the supplied round-two baseline**, then served from its existing `apps/web/public` directory. Tests ran in Chromium 144.0.7559.96 through Python Playwright. The original source archive SHA-256 and file comparison are recorded in `evidence/integration-results.json`.

## Executed results

| Check | Result | Scope |
| --- | --- | --- |
| Viewport/theme renders | 240 pass | 60 designs × desktop 1440×1000 / mobile 390×844 × inherited light/dark; Coordinator preview |
| Role renders | 300 pass | 60 designs × all five roles; student/staff profile and Coordinator-link boundaries |
| State and return-to-preview checks | 270 pass | Every applicable fixture for all ten designs on each page; retry controls operated |
| Desktop primary actions | 60 pass | Native form submission, schedule/recovery navigation or explicit read action in every design |
| Mobile primary actions | 60 pass | Same primary-action coverage at 390×844 |
| Native continuity flows | 6 pass | Independent remembered designs, sign-out/in and reload; calendar month; drawer focus/tabs; inbox persistence/email/search; Original/mobile menu; reduced motion |
| Event/validation checks | 36 pass | Allowed event-role fixtures, missing-sender notices, three email statuses, non-implicit read, forbidden handoff, GUC/OTP/UTF-8 validation, conversation motion, registry coexistence |
| Extra-width renders | 180 pass | All sixty at 320×812, 768×1024 and 1024×768 |
| Pure route-contract tests | 22 pass | Actual role/model/event allowlist, endpoints, channel/read rules, password byte limits and safe record projection |
| Optional patches | 2 dry-runs and applications pass | Three exact existing files in an isolated staging copy |
| JSX / JavaScript syntax | Pass | Four JSX files transpiled with TypeScript 5.8.3; seven relevant original/generated JS modules checked by Node |
| Baseline preservation | 287 files unchanged | Every original file outside the owned extension folder, including the other four stubs |

All browser reports have zero uncaught JavaScript errors and zero recorded failures. Render checks inspect document/content/workspace horizontal bounds; they are not a claim that geometry can judge visual quality. The matrix reports are in `evidence/`, with the pure-function TAP output under `tests/`.

## Visual evidence

`evidence/screenshots/` has 240 viewport captures. `evidence/contact-sheets/` has twenty-four labeled sheets grouping all ten choices per page, size and mode. These are actual viewport screenshots; the host workspace scrolls internally. They do not pretend to be full-content screenshots.

`overview-side-by-side-light.png` and `overview-side-by-side-dark.png` compare Original with Review desk at the same viewport/mode. Original/recommended captures for each other page, a live calendar month change, a draft drawer, native mobile navigation, email-only delivery, an explicit missing-sender notice, native conversation art and byte-validation feedback are also included. `motion-door-storyboard.png` shows seven held exposure samples. `logos-fifteen-grid.png`, the responsive logo-sheet captures and light/dark recommendation contexts document the asset studies without installing a rebrand.

Visual review identified a cramped three-column work-queue arrangement in Overview 4 despite passing geometry checks. That layout was corrected to vertically grouped card content, its four viewport/theme captures were replaced, the main matrix was rerun, and extra-width checks added. The binder’s transparent drawing canvas was also contained locally after strict overflow checks. The delivered evidence reflects those corrections.

## Repeat the tests

Install this folder into a fresh supplied baseline, serve the existing public directory, and use Python with Playwright plus a system Chromium. Set `CHROMIUM` to your executable when it is not `/usr/bin/chromium`. Test dependencies are not application dependencies and are not bundled.

From this extension folder:

```sh
python3 tests/browser-check.py --base http://localhost:8000 --output tests/results
python3 tests/extra-checks.py --base http://localhost:8000 --output tests/results
python3 tests/narrow-checks.py --base http://localhost:8000 --output tests/results
python3 tests/mobile-actions.py --base http://localhost:8000 --output tests/results
node --test tests/route-contract.test.mjs
```

The first command captures the viewport matrix unless `--no-screenshots` is passed. Every script exits nonzero on a recorded failure. They use the native preview session deliberately, not real authentication or a backend mock masquerading as production.

## Not verified here

A real React build/import-resolution pass, React runtime behavior, MongoDB, live identity/notification endpoints, SMTP delivery, the full repository integration suite, external calendar providers, and production account permissions were **not** executed here. The production companion was source-aligned, patch-applied and syntax/contract checked only. Audited backend verification described elsewhere belongs to the supplied audit documents, not to this test run.

Keyboard and reduced-motion checks are not a formal accessibility certification. Visual layout and subjective UI/UX satisfaction still need stakeholder review. Future changes from the other four teams require their own combined regression pass; a sentinel test verifies that this extension merges registry keys without deleting another team’s entries, not that unseen future code has been tested.
