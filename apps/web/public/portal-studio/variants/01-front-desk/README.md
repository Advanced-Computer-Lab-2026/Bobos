# Portal · Front desk / round two

**One extension for the supplied website.** Ten choices each for Overview, Sign in, Forgot password, Reset password, My profile and Notifications. Original stays available. The existing sidebar, header, navigation, account menu, theme system and calendar remain owned by Portal.

## Install the native designs

Copy this entire `01-front-desk` folder into:

```text
project/apps/web/public/portal-studio/variants/01-front-desk/
```

Replace the supplied empty `01-front-desk` stub only. Do not replace `host.js`, `app.js`, `index.html`, shared CSS, fonts, or the other four submission folders. The supplied index already loads this entry; no HTML patch or package installation is needed.

From `project/apps/web/public`, run:

```sh
python3 -m http.server 8000
```

Open:

```text
http://localhost:8000/portal-studio/index.html?preview=live
```

Use the host’s **Page design** dropdown. A clean browser starts on Original, intentionally. Choose a Sign in design, use **Preview details → Fill sample details**, and submit the existing preview form. Do not enter real credentials: Portal Studio does not authenticate or send email. The optional production companion below is separate.

Suggested first comparisons: Overview **2 · Review desk**, Sign in **1 · Open doorway**, Forgot **5 · Check the address**, Reset **2 · Two small steps**, Profile **4 · Open record**, Notifications **2 · Reading pane**. Each page also has nine other working alternatives. Overview choices all omit the weekly timetable; its normal schedule route and Original remain available.

Navigate away and back: the host remembers each page independently. Try the native account menu’s sign-out → sign-in → overview → notifications route. Choose Original to restore the supplied page without extension styling.

## Included

- `pages.js`, `styles.css`, `assets/`: native host extension and local drawings; no new application shell or runtime dependency.
- `manifest.json`, `docs/variant-guide.md`, `docs/requirement-coverage.csv`: all 60 choices, roles, states and requirement boundaries.
- `logos/comparison.html`: fifteen editable mark proposals at common sizes, light/dark and grayscale. Open folio is recommended in review-only context. The working site keeps its existing brand.
- `react/`, `patches/`: optional narrowly scoped actual-API notification companion and auth help/password-field patch. See `docs/react-integration.md` before applying.
- `evidence/`: viewport captures, source comparison evidence and machine-readable results. See `docs/verification.md`.
- `tests/`: repeatable Chromium checks and dependency-free Node route-contract tests.

After installation, the logo sheet is at:

```text
http://localhost:8000/portal-studio/variants/01-front-desk/logos/comparison.html
```

It is an asset comparison document, not another entry point to Portal.

## Important boundaries

The 60 designs are native **Studio** choices, not 60 React page ports. Studio records and URL state fixtures are explicitly previews. The optional React companion imports no fixtures and uses the supplied authenticated APIs; it needs the normal application build, MongoDB and relevant email configuration. Its JSX and route contract were checked, but the React app/API/SMTP were not run end-to-end in this environment.

R120 remains partial (four Coordinator alert senders are absent); R121 has no reminder sender/timer in the supplied audit. R122’s separate pending dashboard also has audited category gaps. Presentation support does not fix or claim completion of those backends. Existing payment, scheduling and graduation business-rule gaps are not silently changed.
