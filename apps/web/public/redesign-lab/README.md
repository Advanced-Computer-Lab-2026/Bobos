# bobos redesign studies

Open [compare.html](compare.html) to compare all five directions, or [index.html](index.html) to enter the interactive previews. No installation or server is required. Keep the `fonts` folder beside the HTML files.

Each version contains 30 page views. The top review bar switches between versions, roles, and every page. The regular navigation reflects the chosen role. The review bar and sample-data labels are prototype controls, not proposed production UI.

| Version | Direction |
| --- | --- |
| 01 Quiet | Warm neutral sidebar, Tiempos headings, open task lists, restrained clay accents. Recommended starting point. |
| 02 Editorial | Horizontal navigation, larger serif hierarchy, white space and dividing rules. |
| 03 Studio | Compact navigation, inset work surface, sans headings and muted ice panels. |
| 04 Clay | Warm paper canvas, generous navigation, a single-column work queue. |
| 05 Contrast | Charcoal navigation, compact bordered work surfaces and restrained cherry accents. |

## Source of truth

- Palette and font files: commit `186b1b5`, dated 8 November 2026, on `origin/feature/cherry-ice-clay-design-system`.
- Core tokens retained: ink `#28262B`, canvas `#FAFAFA`, cherry `#EDA9BA`, ice `#ACCAE3`, clay `#D8B097`, with the source system’s darker and pale variants. Quiet and Clay use warm neutral canvas adaptations.
- Fonts: the repository's original Tiempos Text and Styrene B files. No remote font requests.
- Screen inventory: `apps/web/src/App.jsx` and the newer pages in the `group-b-integration` checkout. These prototypes do not change either checkout's application logic.
- Design guidance: Emil Kowalski’s `emil-design-eng` skill, installed from https://github.com/emilkowalski/skills/tree/main/skills/emil-design-eng and read for this task.

## Global design rules

1. No emojis anywhere in the interface.
2. Remove decorative icons, neon green accents, gradients, orbits, and placeholder status indicators.
3. Remove “Academic portal”, “Development”, redundant role/session cards, and repeated explanatory copy.
4. Use color sparingly for selection, actionable states, and course differentiation. Status always includes a text label.
5. Keep the “Create test notification” action, as requested.
6. Make useful actions and information the reason for every element.
7. Use native controls, visible keyboard focus, accessible dialogs, reduced-motion support, and brief press feedback. Frequent navigation has no entrance animation.

## Page coverage

Overview; notifications; profile; student directory; student details with advisor history and workflow; advising students; pending work; schedule activity; financial records with transaction/refund dialogs; course removals with decision/request dialogs; student schedules; advising draft with validation and process/reopen dialogs; course catalogue with edit/import dialogs; course details; academic terms with management dialog; offerings and section management; copy offerings; templates; template editor; group assignments; student weekly schedule; registered courses; swap groups and requests; preferences; records with history/transcript/wallet tabs; advisor; calendar sync; sign in; forgot password; reset password.

## Prototype behavior

All names, dates, totals, and academic information are sample content. No API requests, authentication, payments, refunds, calendar authorization, or academic changes occur. Preview state resets on reload. Most workflow dialogs validate their inputs and acknowledge the action; they do not implement the production workflow or persist changes. Test notifications, notification read states, search/filters, and calendar connection states update locally. CSV, calendar, and transcript actions download explicitly named sample files.

All pages can be opened using the review selector even when the selected production role would not have access. Production authorization remains a backend responsibility.

## Build and verification

The five HTML files embed their CSS and JavaScript. Source lives in `styles.css` and `app.js`. Run `python build.py` from this directory to rebuild; bundled fonts are reused, and missing fonts are extracted from repository commit `186b1b5`.

`qa-report.json` records browser checks across all 30 views × 5 versions × 2 viewports (1440 px and 390 px), plus interaction checks. To repeat browser QA, install Python Playwright (`python -m pip install playwright`), serve this folder on port 4178 (`python -m http.server 4178 --bind 127.0.0.1`), and run `python verify.py` in another terminal. Set `CHROME_PATH` if Chrome is not detected, or install Playwright Chromium with `python -m playwright install chromium`. An optional `BOBOS_PLAYWRIGHT_PATH` supports a separate dependency directory. Screenshots are in `screenshots/`.

No application source files were replaced, and nothing was deployed.

## Typography and geometry refinement

All five directions now use 12 px controls, 18–20 px panels, and 26 px dialogs. Tiempos Headline Bold is used for serif page titles and the wordmark, Tiempos Text Semibold for section headings, and Styrene B Medium/Bold for controls, navigation, and data. Studio retains its sans heading direction using Styrene B Bold. These are the original repository font files, with no synthetic bold.
