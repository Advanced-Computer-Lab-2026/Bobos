# Captured evidence

These files are static evidence inside the submission, not a second app or gallery landing page. All page captures were made from the original Portal shell with the owned plugin or scoped adapters installed. No screenshot was composited into the running UI.

## Capture groups

| Files | Meaning |
| --- | --- |
| `studio-overview-1440-light.png`, `studio-overview-1440-dark.png` | Untouched approved Overview in the supplied studio, at 1440 × 1000 |
| `studio-<page>-1440-<theme>.png` | The three registered studio pages, 1440 × 1000, both themes |
| `studio-<page>-390-<theme>.png` | Those same pages, 390 × 844, both themes |
| `comparison-<page>-<theme>.png` | Overview and the owned studio page side by side, captured at the same 1440 × 1000 viewport and mode; a caption strip is added outside the captures |
| `ten-designs-<page>.png` | All ten studio choices at the same desktop viewport, scaled uniformly into a contact sheet; names are added outside each capture |
| `react-<pageKey>-1440-light.png` | Each of the 23 authenticated React view keys inside the existing app shell, at 1440 × 1000 |
| `react-<pageKey>-390-light.png` | Each of those 23 views at 390 × 844 |

There are 69 PNG files: 2 Overview references, 12 studio captures, 6 side-by-side comparisons, 3 ten-design sheets and 46 React view captures. The studio page samples use choice 7, except schedule activity, which uses choice 5. React samples use choice 7, except financial reversal and payment confirmation, which use choice 3. The complete automated matrix also exercises Original, every other choice and both themes; not every tested combination has a saved screenshot.

## Read the images with the test boundaries

The studio records are the existing supplied preview records. React data is isolated test-fixture data and does not represent a live account, payment or academic decision. Captures use the HTTP-fed browser harness described in `../tests/README.md`; they do not certify native origin/reload/history behavior. Reduced motion is enabled for stable capture of the drawing's resting pose. Finite animation/replay and reduced-motion behavior have a separate nine-check report.

The comparisons keep the original sidebar/header and small task-scale artwork visible. The contact sheets compare working arrangements, not alternative brands. Mobile captures intentionally keep the original responsive Portal navigation rather than introduce a separate mobile shell. Selected dialogs or long documents may continue below the viewport; the source remains scrollable and the layout report checks horizontal overflow.
