# Portal · Operations / round two

This is an additive part of the supplied Portal, not a standalone website. The studio plugin registers **ten choices on each of three existing pages**. The authenticated React integration supplies **ten remembered choices across 23 workflow-view keys**, including those same three pages. “230” counts unique page-key/design combinations, not 230 new navigation routes or separate applications.

## Open the supplied studio

Copy this entire `05-operations` folder into:

```text
project/apps/web/public/portal-studio/variants/05-operations/
```

Replace the supplied empty `05-operations/pages.js` starter. Leave `variants/host.js` and the other four folders alone. From the folder containing `project`, run:

```sh
python3 -m http.server 8000 --directory project/apps/web/public
```

Open:

```text
http://localhost:8000/portal-studio/index.html?preview=live
```

Use the supplied **Sign in**, then **Pending work**, **Schedule activity**, or **Financial records**. The original host adds one **Page design** selector; this submission does not create another selector, shell, login or landing page. The existing preview remains explicitly fictional and does not acquire live payment actions.

Choose a design, visit Overview, return, then sign out and sign in again. Each page has its own `portal-page-design:<pageKey>` preference. **Original** still invokes the supplied studio renderer without applying this plugin. Light/dark, the sidebar, account menu, calendar state and existing queue links remain owned by Portal.

## Install the authenticated React workflows

The studio has no original renderers for extra-hours, settlement or graduation. They are integrated into the supplied React app instead of inventing new studio routes.

From the folder containing `project`, inspect and apply the narrow integration:

```sh
python3 project/apps/web/public/portal-studio/variants/05-operations/install.py --project project --check
python3 project/apps/web/public/portal-studio/variants/05-operations/install.py --project project
```

The installer copies `react/` into `project/apps/web/src/operations/` and edits only these existing React source files:

```text
apps/web/src/App.jsx
apps/web/src/components/AdvisingPage.jsx
apps/web/src/components/StudentDirectoryPage.jsx
```

The exact changes are also in `patches/react-integration.patch`. They redirect owned component imports and pass existing authenticated-role, actor-ID and navigation props. CalendarSync remains imported from the original component. No API, authentication, shared shell, theme implementation, package manifest or shared CSS is patched.

Use the original project's environment/MongoDB setup and its existing commands, as documented in `project/README.md`:

```sh
cd project
npm install
npm run dev
```

No dependency is added by this submission. The real React app still requires the real API and existing accounts. There are no demo credentials, client-side substitute authentication or test fixtures in its runtime imports. `npm run build` and the supplied strict API acceptance suites remain integration gates; they were **not** certified in this delivery environment.

The installer is idempotent and refuses unexpected source fragments before changing files. To reverse its import/prop edits:

```sh
python3 apps/web/public/portal-studio/variants/05-operations/install.py --project . --undo
```

Undo leaves `src/operations/` in place, intentionally, so another integrator's edits are not deleted. After verifying that it is no longer imported, that directory may be removed manually.

## Where the workflows live

| Existing Portal entry | Additional views inside that workflow |
| --- | --- |
| Pending work | System-derived blockers, grouping, search and existing workflow handoffs |
| Schedule activity | Global history and the existing selected-student history |
| Financial records | Ledger, selected-record detail, reversal eligibility review |
| Extra-hours requests — Advisor | Own requests, assigned-student request form, itemized detail, pending withdrawal |
| Extra-hours requests — Coordinator | Search/filter, eligibility, itemized cost, noted decision |
| Extra-hours requests — Advising student | Own requests, wallet, settlement, sandbox attempt/retry, financial history, paid/deferred confirmation |
| Advising students → Graduation plan — Advisor | Private plans, course-to-term editor, exit-exam request |
| Graduation review — Advisor/Coordinator | Submitted plans; coordinator plan and exam decisions |
| My graduation — Advising student | Accepted plans and exit-exam responses |

`manifest.json` gives all 23 keys, ten names per key, roles, launch points and requirement mappings. `docs/REQUIREMENTS.md` preserves the workbook's actions and rules, and separates UI implementation from inherited backend gaps. `docs/INTEGRATION.md` identifies every integration seam and API family.

## Important boundaries

**This is not a repaired payment backend.** The supplied audits document unsafe financial reversal behavior and cross-request wallet concurrency. The adapter exposes the reversal review but disables execution and sends no refund mutation. Paid receipts and deferred confirmations are different views; the latter is explicitly **not paid**. Gateway outcomes use the supplied sandbox API, not a real card service.

The new advisor request form performs assignment, probation and per-request load checks, but it cannot repair server-side ownership/cumulative-limit enforcement. Graduation still depends on the original server's term/prerequisite/credit rules, including the audited GPA-policy defect. The pending-work feed still lacks graduation, exit-exam and reversal categories; the UI says so rather than fabricating them.

These limitations are recorded in `docs/KNOWN-GAPS.md`, not counted as fulfilled requirements. Notifications, calendar integration, account management and other teams' features are not reimplemented.

## Evidence and verification

See `tests/README.md` and `tests/reports/` for exact results and limitations. The evidence folder contains actual browser captures at **1440 × 1000** and **390 × 844**, light/dark studio captures, and same-viewport comparisons with the untouched Overview.

The browser environment blocks normal navigation. The recorded runs therefore used an explicitly documented HTTP-fed Chromium harness with in-memory storage and no-op history. React was exercised with an offline **React 18.2 compatibility runtime**, not a production React 19/Vite build. Test API responses were isolated fixtures; no real database, money, provider or generated receipt PDF was certified. Native origin/reload persistence remains a required integrator check.

The returned folder was copied into a fresh extraction of the supplied round-two baseline. The installer, exact source-file changes, unchanged shared files and sibling-folder preservation were checked there. The final fresh-copy React test bundle matched the working-copy test bundle byte-for-byte.
