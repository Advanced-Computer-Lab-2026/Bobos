# Evidence index

All screenshots are captured from the supplied Portal host with the contributor folder installed. No separate gallery or shell is part of the application.

## Desktop and mobile

`screens/` contains 182 captures. Filename pattern: `<theme>-<width>-<page>-<design>.png`. All 70 designs have desktop dark/light captures. Mobile captures retain choices 1, 6 and 10 on each page in both themes; all ten choices were nevertheless checked at mobile width.

Each image captures the current viewport. Portal’s content area scrolls internally; below-the-fold controls are covered by interaction tests, not falsely represented as visible in these images.

## Overview and continuity

`comparisons/teaching-week-reference-dark.png` and `-light.png` place the approved staff Teaching week next to the student schedule at the same viewport and theme. Their roles differ and are labeled. `comparisons/continuity-*` compare the unchanged student Overview with three owned pages for the same role. Shell geometry, typography and background equality are recorded in the supplemental report.

`comparisons/ten-<page>.png` are documentation-only contact sheets of the ten actual desktop captures. Full-size source captures remain in `screens/`.

## Interactive and boundary states

`states/` includes the native Overview binder’s next month and deadline detail, both reference themes, real mobile navigation, a mobile slot-request form and pending result, approved/rejected/withdrawn requests, an incomplete staff draft versus the hidden student draft, processed export context, staff read-only preferences, a closed deadline, invalid time feedback, an empty record, an unassigned advisor, a recoverable load error, provider retry/recovery, and a whole-schedule confirmation/open request.

## Downloaded artifacts

`exports/processed-schedule.pdf`, `printed-schedule.pdf`, `transcript-design-1.pdf` and `calendar-design-1.ics` are actual browser-generated preview exports. The three PNGs are rendered PDF inspections. All are labeled examples, not official records or real Google sync results.

## Reports

See `reports/browser-report.json`, `supplemental-report.json`, `domain-report.json`, `adapter-report.json`, `baseline-integrity.json`, `export-report.json`, `patch-verification.json`, `archive-browser-report.json`, `archive-runtime-integrity.json`, and `environment.json`. `../docs/TESTING.md` explains methods and limits.

## Contact sheets

- [my-schedule — ten choices](comparisons/ten-my-schedule.png)
- [my-courses — ten choices](comparisons/ten-my-courses.png)
- [schedule-swap — ten choices](comparisons/ten-schedule-swap.png)
- [preferences — ten choices](comparisons/ten-preferences.png)
- [records — ten choices](comparisons/ten-records.png)
- [my-advisor — ten choices](comparisons/ten-my-advisor.png)
- [calendar-sync — ten choices](comparisons/ten-calendar-sync.png)
