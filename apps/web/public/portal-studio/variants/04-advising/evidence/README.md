# Browser evidence

These are captures of the integrated supplied Portal, not flattened screen mockups or a separate gallery website.

## Orientation

`overview-continuity-light.jpg` and `overview-continuity-dark.jpg` place the unchanged approved Overview next to the Student review desk at the same source viewport (1440 × 1000) and mode. The sidebar and top bar remain the host’s. The contact sheets under `contacts/` show every one of the ten arrangements for each of the eight owned page/workflow keys.

`studio/` includes full-resolution light/dark desktop and 390 × 844 mobile examples for all six studio pages, additional draft arrangements, and the actual ready/processed local workflow states. Studio samples are the supplied synthetic preview students, enriched by the local state described in the README.

`react/` includes selected-record views in both themes and sizes for account/advisor administration and staff slot review. These are the **actual patched React App** with test HTTP responses intercepted by Playwright. The source adapters themselves contain no fixture service or fallback records. They are not evidence that a real database, SMTP provider or live final-seat competition was exercised.

`motion/exposed-poses-contact.png` shows the small folder and the existing envelope strip after pressing **Next record** in the actual page. Captions are observed elapsed browser times, not a claim of exact screen-capture timing. `motion-captures.json` records the pose numbers. The final two envelope samples hold the same resting pose. Resting drawings are also shown in their full page context.

`results/` contains raw named assertions and render metadata. Counts and test limitations are explained in `../docs/TESTING.md`. Passing viewport checks mean no document-level horizontal overflow; they are not an automated visual-design or accessibility certification.

## Regeneration

The browser scripts in `../tests/` save the source PNGs. `make-evidence.py` composes contact sheets from those files; it does not generate new artwork. Pillow is required for contact-sheet composition. Fonts used for rendering captions are not distributed.

```sh
python tests/make-evidence.py --studio ./studio-evidence --react ./react-error-evidence --motion ./motion-evidence --target ./evidence
```

The additional `react/slot-open-mobile-*.png` and `react/slot-decision-mobile-*.png` captures scroll the same opened Decision desk to its current-slot and decision controls at 390 × 844. They are supplemental captures, not additional checks in the reported totals.
