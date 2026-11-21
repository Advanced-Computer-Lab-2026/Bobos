# Art direction and continuity

## Reference actually used

The supplied Portal **Claude Study / Teaching week** Overview is the reference, not the previous standalone round-one collection. Its existing `app.js` and stylesheet supply the shell, Styrene/Tiempos typography, term badge, understated control vocabulary, muted rules and surfaces, course colors, quiet links and small task drawings. No logo, sidebar, account control or font is replaced.

The staff Overview contains the approved teaching-week composition and flipping academic-calendar binder; the student Overview is a different existing renderer. Evidence therefore includes both: the approved staff dashboard in dark/light and same-role student Overview comparisons with owned pages. All comparison captures use a 1440 × 1000 viewport. `continuity-*` checks compare the sidebar/topbar geometry, background and font-family before and after native navigation; account and sidebar content remain role-dependent.

The reference calendar's Next, Previous, Today and deadline-detail controls were operated in the supplied host. The existing envelope/activity stamps, conversation outlines, course-specific timetable artwork and greeting sky drawing were inspected in the baseline implementation. They remain the source of the illustration vocabulary rather than a new icon/mascot system.

## Where the alternatives differ

The experiment is the work arrangement. The schedule can be a week, day, time axis, course lanes, room route, foldable day files or a stable inspector. Courses can be an expanded register, component matrix, selected-course detail, two-course comparison or searchable ledger. Swaps distinguish complete-schedule comparison, destination filtering, change maps, an anonymous inbox and the student's own request ledger.

Preferences compare ordering, a weekly constraint map, a live review, steps and folded sections without dropping the original inputs. Records compare history, attended-year files, periods, prerequisite planning and search; every PDF still follows the primary selected year. Advisor pages alter contact/preparation/next-step priority without inventing a booking or messaging service. Calendar pages distinguish connection, event payloads, file snapshots, privacy and sync feedback.

`DESIGN-MANIFEST.md` lists the precise intent of all 70 choices. It is documentation, not a gallery route in the website.

## Drawing and motion behavior

The three local `assets/*.svg` files are unchanged approved course symbols from the baseline. The embedded-systems drawing is supplied by the existing `timetableDrawing()` function. Drawings remain small and connected to their course/component; they do not grow into page heroes. The native timetable animation is quiet at rest in the owned compositions and receives a finite hover/focus cycle where appropriate.

Advisor email preparation and preference-note compositions use the existing `queueSketch('advisor-assignment')` conversation artwork. The question/reply outlines receive staggered, small stepped poses with explicit holds and a final resting pose, not an endless floating chat bubble. Transcript year tabs use a short file-opening pose when selecting/approaching a year. Native dialogs, drawers and actual file/year selections carry the interaction; decorative motion is never required to understand a result.

Authored keyframes are confined to `pages.css` (`sl2-question`, `sl2-reply`, `sl2-file-open`). They run once, settle, and are disabled by `prefers-reduced-motion: reduce`. The approved Overview's binder and greeting animation are not modified. No blanket animation or style rule touches other contributors' pages.

The approved `images/extra-hours-folder.svg` remains untouched at its existing decision workflow. These seven student-life routes do not own the coordinator's extra-hours decision, so that folder is not repurposed as unrelated decoration. Messaging remains an explicit mail-app handoff with the existing conversation artwork, not a simulated successful email delivery.

## Responsive and theme decisions

Desktop variants use hierarchy and alignment rather than extra statistic bands. The required credit total and status are context, not decorative KPI tiles. Cards and tables inherit the approved theme variables; course colors retain the baseline's meaning. Dense comparisons become stacked selections on narrow screens. Wide academic/component tables use a labeled, keyboard-focusable horizontal region instead of shrinking the type or clipping the whole page.

The host's live preview starts in dark mode and hides its studio toolbar. Light-mode verification calls the existing `lab.dark=false; applyLook(); render()` host functions; no competing theme selector or design toolbar is added. All 70 choices were checked in both modes at 1440 × 1000 and 390 × 844.

The screenshots are actual browser captures, not composited UI proposals. Side-by-side sheets only arrange those captures for review. Most are initial-viewport evidence: Portal's main content region scrolls internally, and the image should not be mistaken for a capture of every item below the fold. Workflow tests operate those additional controls.
