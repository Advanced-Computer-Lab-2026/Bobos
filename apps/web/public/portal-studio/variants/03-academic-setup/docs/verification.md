# Verification record

This is a Portal contribution, not a standalone production acceptance result. The studio prototype and the optional React source adapter have different verification boundaries.

## Baseline and installation

The exact round-two upload was extracted to a clean project. The contribution folder was copied to `apps/web/public/portal-studio/variants/03-academic-setup/`, and the supplied public directory was served with Python's HTTP server. The normal `portal-studio/index.html?preview=live` sign-in and Overview were used before operating academic pages. The final package was also extracted and its installed browser bundle rechecked.

The upload contains **287 project files**. One is this contribution's empty `pages.js` placeholder. All **286 files outside this folder** match the upload byte-for-byte. The optional React patch was applied only in a separate source-check copy; it was not silently applied to the studio test baseline. `evidence/baseline-integrity.json` records the comparison and input archive hash.

The supplied host contains the other four submissions' placeholder folders. Their real future implementations were not available. Coexistence checks confirm additive registration, unchanged host files and an unrelated registry sentinel; they do not claim to have run four unseen submissions.

## Passing automated checks

| Suite | Result | What it exercises |
|---|---:|---|
| `domain-tests.tap` | 73 passed, 0 failed | Actual shared preview rule module: course/term validation, atomic CSV import, duplicates, capacity, copy, publication, linked template components, assignment, history and role denial. |
| `browser-journeys.json` | 43 passed, 0 failed | Existing sign-in; create/edit/import/delete; invalid and corrected submissions; copy review/repeat; publication safeguards; template edits; reassignment/unassignment; storage failure and stale dialog; page choice persistence; sign-out/sign-in; Original dialog. |
| `layout-matrix.json` | 640 passed, 0 failed | Eight pages × ten choices × four viewport widths × two themes. Checks selectors, page identity, headings, document fit, preserved shell dimensions, search and copy selection. |
| Original checks in matrix | 64 passed | Eight pages × four widths × two themes. Option 0 uses the original renderer with no `.as-root` contribution scope. |
| `shell-and-evidence.json` | 68 passed, 0 failed | Calendar month retention, profile/brand return, same theme/font/shell, all five role boundaries, absence of unauthorized controls, focus/escape, mobile review/error containment, finite poses and reduced motion. |
| `package-smoke.json` | 110 passed, 0 failed | After ZIP extraction: local runtime assets match, eight ten-choice registrations agree with manifest, all eighty choices render, Original remains unadapted, keyboard timetable scrolling works, no failed requests or uncaught errors. |

The 640 layout cases use widths **1440, 1024, 768 and 390 CSS pixels**, in dark and light. Heights are 1000 pixels at the two larger widths and 844 pixels at the two smaller widths. This is viewport coverage, not a claim of every browser/assistive-technology combination. Browser version and detailed cases are in the reports.

There were no uncaught browser JavaScript errors in these passing runs. The workflow suite also observed no production API requests from the studio adapter. Browser-only writes are explicitly labelled in the interface.

## Visual evidence

`evidence/layouts/` contains all 80 desktop-dark and all 80 phone-light viewport captures. Contact sheets resize those captures without altering their contents. They are not screenshots of a fabricated gallery or composites of unrelated controls.

`overview-comparison.jpg` places the existing Overview and Course desk side by side at the same 1440 × 1000 viewport, first dark and then light. The 224-pixel sidebar and 48-pixel topbar are host-owned and unchanged. A plain content heading replaces no shell branding. The baseline's initial `preview=live` theme is dark; both modes were set through the source's existing theme mechanism, without adding a theme toolbar.

`existing-signin.png` is the supplied preview sign-in. The validation and assignment-review phone images show real native dialogs and fixed action footers. Wide timetables and matrices scroll within content; the document itself stays within the viewport. The weekly timetable is focusable for keyboard scrolling.

`authored-motion-poses.png` shows every authored pose and settling hold. The source strips remain editable SVGs. The finite-motion browser check samples an intermediate transform and the final rest; reduced motion has no running animation. This is not a comprehensive motion-perception/accessibility study.

## React checks, separately

`patches/apply-react.py --check` verified the two exact original file hashes and patch applicability. The installer was then run in an isolated copy. Both modified JSX files and `AcademicDesign.jsx` syntax-parsed successfully. Copied adapter files match the supplied adapter source. A repeated install against changed files was rejected rather than overwritten. The report is `evidence/react-integration.json`.

**Not run:** a Vite production build, the real React application in a browser, live API/database acceptance, authentication-provider flows, server concurrency, or production deployment. Runtime dependencies were not installed and dependency retrieval was unavailable in this environment. Syntax parsing is not a type check or runtime test. The scoped adapter retains the existing real forms/API callbacks; the host integrator must still build and exercise that optional patch in its development environment.

Existing source-audit failures and TODOs remain documented. No passing preview test is used to declare unrelated backend requirements complete.

## Reproduce

From this folder, `node build.mjs` regenerates `pages.js` without installing anything. `node --test tests/domain.test.mjs` runs the rules. The four Python browser scripts in `tests/` accept `--base` and `--browser`; use the local Portal server and a Chromium executable with Python Playwright installed. Those tools are test dependencies only, not website dependencies.

The tests use isolated browser contexts and synthetic academic records. Do not run them against a production environment. The source archive/baseline integrity check compares only supplied files, with the owned placeholder explicitly excluded. Final ZIP verification also checks member paths and archive integrity; no font binaries, node_modules, credentials or independent app shell are included.
