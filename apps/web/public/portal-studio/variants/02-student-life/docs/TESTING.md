# Verification and reproducibility

## Final baseline integration

The uploaded round-two archive was extracted to a fresh directory, then only this `variants/02-student-life/` folder was copied into `project/apps/web/public/portal-studio/variants/`. The unchanged public root was served with Python's HTTP server. Tests opened `/portal-studio/index.html?preview=live` and used the supplied Sign in button.

| Check set | Result | Evidence |
| --- | --- | --- |
| Browser layout + interaction assertions | **979 passed, 0 failed; no JavaScript page errors** | `evidence/reports/browser-report.json` |
| Pure preview-domain/registry/PDF checks | **61 passed, 0 failed** | `evidence/reports/domain-report.json` |
| React adapter JSX and route/prop contracts | **50 passed, 0 failed** | `evidence/reports/adapter-report.json` |
| Baseline files outside the owned folder | **287 of 287 byte-identical** | `evidence/reports/baseline-integrity.json` |
| Optional App.jsx patch | Clean dry-run against supplied baseline | `evidence/reports/patch-verification.json` |
| Additional host operation and visual continuity | **17 passed, 0 failed; no JavaScript page errors** | `evidence/reports/supplemental-report.json` |
| Preview export structure | All twelve generated PDFs open without repair; twelve unique weekly calendar events | `evidence/reports/export-report.json` |

The actual result ZIP was then extracted, its folder copied into a second fresh baseline, and the entire **979-check browser suite passed again with zero page errors**. `evidence/reports/archive-browser-report.json` records that repeat; `archive-runtime-integrity.json` identifies the identical executable and asset files. The two runs are not added together as distinct coverage. Only documentation/reports were added after that run, not executable code.

The browser count contains 280 layout checks (70 choices × 2 themes × 2 widths), 613 per-design workflow assertions, 63 role/release-boundary assertions, 11 host continuity checks, plus schedule, keyboard, calendar, reduced-motion, coexistence and runtime checks. Counts are assertions, not distinct users, requirements or backend tests.

Desktop: 1440 × 1000. Mobile: 390 × 844. The main run uses reduced motion for deterministic screenshots. Supplementary host-operation evidence uses the default motion setting. There are 182 main captures: all 70 desktop choices in dark/light and mobile choices 1, 6 and 10 for every page in both themes. **Every** choice was layout-checked at both widths even where a screenshot was not retained.

## What the browser checks actually exercise

Every design runs its page's main task and error/retry, empty and unavailable paths. Schedule checks submit a component request, reject a duplicate, withdraw only pending requests and preserve assignments. Course checks inspect components and preserve credit totals, with searchable and comparison-specific checks. Swap checks reject empty selections, submit multiple destinations, enforce one open request, withdraw and exchange the whole twelve-component fixture. Preference checks save, reject a reversed time interval and save a valid range. Record checks select an attended year and inspect that year's downloaded PDF. Advisor checks retain contact information and local preparation. Calendar checks run an unchanged re-sync, disconnect/reconnect and inspect an actual recurring `.ics` download.

Host checks navigate away/back through the real sidebar, retain different designs per page, restore Original, sign out/in, and bridge original calendar/preference edits in both directions. All five roles are checked on all seven URLs. Additional boundary checks cover staff read-only preferences/records, the student-only wallet, incomplete staff drafts versus unreleased student drafts, ready/processed export gating, deadlines, resolved requests, provider retry, keyboard day controls, dialog Escape/focus return and reduced motion.

The contributor registry is reloaded beside a sentinel entry representing another contributor; it remains intact. The four other actual supplied contributor folders are placeholders. Unavailable future implementations were not fabricated or certified.

## Re-run

Use the exact baseline and copy-only install described in `../README.md`. The runtime itself has no new package dependencies. Tests need Python with Playwright, a Chromium browser, and Node for the pure checks. The adapter test additionally needs the TypeScript compiler module. Use the project's established test environment or install those test tools separately; they are not runtime requirements.

From the contributor folder:

```sh
python3 tests/browser_verify.py --base http://localhost:8000 --output verification-results --mode all --screenshots
python3 tests/evidence_capture.py --base http://localhost:8000 --output supplemental-evidence
node tests/domain_verify.cjs
node tests/adapter_verify.cjs
```

`adapter_verify.cjs` uses `require('typescript')`. When the compiler is installed globally rather than locally, set `TYPESCRIPT_MODULE` to that installation's module directory. The browser scripts choose a system Chromium when available; otherwise Playwright's installed Chromium is used. The recording environment used system Chromium and a localhost-only managed-browser allowlist. That container-specific policy is not shipped or required on a normal local browser.

To independently check the copy-only installation:

```sh
python3 tests/verify_install.py \
  --baseline-zip /path/to/02-student-life-round-2.zip \
  --installed-root /path/to/fresh-extraction \
  --output baseline-integrity.json
```

The installed root is the directory containing `project/` and `START-HERE.md`, not the public directory.

## Inspect states without adding a studio toolbar

Choose a variant on the owned page and use the browser console. These helpers affect only the declared local preview state, never an API:

```js
PortalStudentLife.setScenario('my-schedule', 'processed');
PortalStudentLife.setScenario('my-schedule', 'draft');
PortalStudentLife.setScenario('my-schedule', 'pending');
PortalStudentLife.setScenario('my-schedule', 'resolved');
PortalStudentLife.setScenario('preferences', 'deadline');
PortalStudentLife.setScenario('my-advisor', 'unassigned');
PortalStudentLife.setScenario('calendar-sync', 'conflict');
PortalStudentLife.resetPreview();
```

Call the relevant helper while on that page. Navigate to a permitted role through the baseline URL query; the role strings are `normalStudent`, `advisingStudent`, `advisor`, `coordinator`, `administrator`. Local role selection is not authentication. `resetPreview()` resets the current role's fixtures/scenarios while retaining host design choices. A role argument can be supplied to `resetPreview(role)` and `readPreview(role)`; `setScenario(pageKey, scenario, role)` also accepts an explicit role.

General scenarios: `default`, `empty`, `unavailable`, `error`. Additional page-specific scenarios: `deadline`, `locked`, `ready`, `draft`, `processed`, `pending`, `resolved`, `unassigned`, `conflict`. A scenario name is accepted centrally but has meaningful effects only in the related workflow; this is not a claim that every page has every lifecycle.

The approved live-preview host starts in dark mode and hides its design-studio controls. To inspect light mode without introducing a second toolbar, use its existing functions:

```js
lab.dark = false;
applyLook();
render();
```

Set `lab.dark = true` to return to dark. No owned page hardcodes the application theme.

## Limits

These are local static-preview and adapter-contract results. The full React production build, API/database acceptance suites, two-party swap concurrency, real-account OAuth, university authorization, email delivery, notification side effects and deployed persistence were not executed. The existing audits' passing/failing/TODO results are source-reported separately in `REQUIREMENTS.md`; none is added to the counts above.

The browser run is Chromium-only. Firefox, Safari, real touch hardware, screen-reader behavior and formal accessibility conformance were not certified. The layouts have keyboard/focus/reduced-motion checks, not an accessibility audit. Export PDFs were parsed and rendered locally; `.ics` structure was inspected, but actual imports into each third-party calendar were not tested. File re-import is not equivalent to provider synchronization.
