# Portal design system

The visual reference is Portal Studio’s **Claude Study** workspace, coordinator **Teaching week** view, **Concertina** calendar and **File tags** activity. Use the original page layouts when extending the design to another role. Keep the information, navigation, actions and permissions appropriate to that role. The design editions under `variants/` are explorations. Their presence in the repository does not make every treatment a house convention.

## See it in motion

From the repository root run `python3 -m http.server 8080 --bind 127.0.0.1 --directory apps/web/public`. Open `http://127.0.0.1:8080/portal-studio/index.html?page=login&role=coordinator&preview=live`. Reload to see the lamp arrive. Continue opens the fixture workspace. Hover an entire queue entry, hold there for a few seconds, then leave. Scroll to Schedule review and repeat on a folder. Flip the calendar and hover a marked deadline. Use the light studio view to check contrast: `?page=overview&role=coordinator&layout=21&palette=10&mode=light&preview=studio`.

The paths below refer to `apps/web/public/portal-studio/`. It is the runnable visual reference. The React application lives under `apps/web/src/`. When bringing artwork to a real workflow, keep its existing data, access controls, loading states and submission behavior.

## Surface, type and composition

The console palette uses charcoal canvas (#151515), a slightly deeper sidebar (#0f0f0f), warm white ink (#efeee9), muted copy (#bdbbb0) and quiet rules (#303030). Light mode uses a muted ground (#f0eee6), paper (#f8f6ef) and dark brown ink (#302d28). Read the applied tokens in `studio.js`, `base.css` and `studio.css`; theme-specific overrides matter. Use semantic tokens for controls and text. Save sky blue, clay, sage and warm cream for recognizable objects, course identities and useful distinctions. The Computer Graphics sheet is a good cream reference.

The greeting and wordmark carry the serif voice. Operational titles, student names, labels, counts and controls use the sans-serif system. The stylesheet requests local Tiempos and Styrene with fallbacks. Give the greeting room and keep the term visible alongside its context. Work queue and Schedule review sit on the canvas. Timetable classes have their own colored cards. Preserve this hierarchy when adding content. Use space and alignment to group related items before adding borders or containers. The current brand mark is `portal-card-index.svg`.

## Draw an object that explains the action

Start with the object at its final display size. A folder tab, the mouth of an envelope or the silhouette of a cup should read before the viewer sees the details. Give the outline slight asymmetry. Use a few opaque fills, a controlled ink edge and a small number of internal strokes. Where one object passes behind another, give the foreground its own opaque face. Keep line endings crisp and inspect them at actual size. An illustration can float directly on the page. Choose an object because it helps explain the task.

## Draw the movement

A **cel** is a drawing held for part of an animation. A **line boil** alternates nearby versions of a contour. The subject keeps its place while an arc, corner or end of a stroke shifts by roughly a pen width. In the advisor illustration both bubbles have their own ink movement. Their centers stay legible. Moving the entire group side to side reads as shaking. Moving the middle of opposite sides toward one another reads as squeezing.

Distinguish the gesture from the held pose. Draw anticipation, contact, weight, release and settlement where the action calls for them. Give each pose its own duration. A folder can rise quickly, overshoot, and spend most of a hover sitting open. During that hold, alternate the contour or existing writing. Keep the lettering already present when the paper emerges. Replaying a writing stroke or repeating a stamp changes the meaning of the action.

The code uses alternate SVG paths, stepped CSS keyframes and timed JavaScript poses. Choose the technique to suit the drawing. The binder has depth and the pull chain responds to the hand. Their behavior is specific to those objects. For a new interaction, choose one readable gesture and preview it in place. Keep the actual click target stable and preserve its label and action.

## Working references

| Surface | What to study | Source |
|---|---|---|
| Work queue | The envelope opens and holds, the advisor bubbles redraw, and the group remains recognizable as people. The full entry activates the illustration. | `app.js` → `queueSketch`, `workQueue`; `studio.css` |
| Schedule review | A cream desktop folder exposes a sheet. The front cover yields at its base. The sheet settles before the ink does. Names and credits stay readable below it. | `app.js` → desktop-folder markup; `studio.css` → folder-lift, folder-open, folder-contour, folder-pen |
| Timetable and greeting | Nodes depict Algorithms, a faceted solid depicts Graphics, a bug belongs to Advanced Computer Lab, and a coffee cup marks a free day. The sun or moon sits beside the greeting. Study each silhouette at card size. | `images/symbols/`, `app.js`, `studio.css` |
| Calendar | Follow a paper corner around the rings. The binding anchors the rotation, successive turns can overlap, and the seasonal art belongs to its sheet. Deadline notes share the calendar’s perspective. | `binder-motion.js`, `concertina.js`, `concertina-turn.css`, `seasonal-calendar.js` |
| Recent activity | The object identifies what happened. Study the advising draft and the published template side by side. The stamp descends, leaves its mark, lifts and holds. | `activity-art.js` → `activityStamp`; `activity.css` |
| Staff and student pages | Apply illustrations to the particular workflow while preserving the arrangement people use to complete it. Compare coordinator and student routes. | `staff-art.js`, `student-art.js`, corresponding CSS, `desk-details.css`, `academic-pages.css` |

## Sign-in and the lamp

The form is on the left. The lamp and paper float on the right. Its foot starts on the email field, lands at 56% scale on Continue, and then jumps to the desk. On each control the full sole is flat. The right edge of Continue dips and rebounds under the foot. The curved underside becomes visible in flight. The grip is attached beneath the shade. During the two hops the cord follows a hand-authored exposure sheet and keeps the bead below its socket. The interactive drag uses a separate simulation so someone can catch the bead, pull sideways, and release it with momentum. Tapping the shade gives it a small nod and operates the same light. The sheet reveals Group 4’s teaching week.

Use `desk-lamp.js` → `hopToDesk` for choreography, `lamp-cord.js` → `drawHop` for the authored cord poses, and `images/borrowed-light.svg` for the actual artwork and joints. For the field border, read `drawInputEdges` alongside `login-art.css`. Three outlines keep the long sides equally spaced. Small clockwise registrations of 0.10° and 0.20° give the ink movement without changing field height. The full exposure cycle is 0.51 seconds. These numbers describe this input specifically.

## Review a change

Watch it at normal speed in the surrounding page, then inspect the first contact and last moving frame. Check that the final pose lands on the resting artwork. Move off halfway through, come back, click again and use the keyboard. Check focus, touch, light and dark backgrounds, a narrow viewport, and reduced motion. The still pose must communicate the state. Existing buttons retain their actions; the examples here give designers room to invent new gestures.

When an approved change alters one of these references, update the relevant passage and source pointer in the same change.

## Workspace fields and records

Portal Studio uses the sign-in contour on text entry throughout the workspace, including searches, notes and dialogs. The SVG sits above the native control so the caret stays still. Reduced motion keeps one ink contour visible. Preferred days use a single drawn check that settles when selected. See `drawInputEdges` and `workspace-pages.css`.

The directory files students alphabetically by first name. Schedule review pairs each student with a draft state and its action. Course removals use the catalogue’s course drawings; align each request with its student, reason and review button. Group advising and assignment rosters by who needs attention first. Financial totals use tabular sans-serif figures on the canvas, with EGP secondary to the amount. Academic terms use whitespace between entries, readable dates and a visible action button. Use the seasonal artwork directly on the canvas and keep the notification drawings large enough to identify at reading distance.

Save preferences uses button study 06, **Bookmark tab**. A sage ribbon with a notched tip drops 16px on hover or keyboard focus and settles in 430ms. The existing reduced-motion rule shows its end pose immediately.


Use the advising roster’s circular initials anywhere a student appears in a list. In notifications the person sits beside the read action. Student schedules groups records by stage. Each stage name stands alone as a section heading above the rows of students, their majors and their next actions. Status drawings borrow the timetable stock colors. A blue inbox means ready for review, a sage check means complete, and a coral warning marks an assignment that needs attention. Pair every mark with its written state. Search, filter and action contours use the three sign-in drawings. The pending-work envelope and advisor bubbles respond across the full queue link. The course-removal eraser plays its slow pass on entry and holds still with reduced motion enabled.

When an action shows its line boil, the active SVG path draws both the button face and its perimeter. Keep the native hit area stationary. Related views use file-shaped tabs with a sage selected face. Notifications pairs open and sealed envelopes with the view names. Switching views draws one pencil loop around the selected label and then holds. Work queues share rows with their student work items. Schedule actions center on the same track across groups. Course removals uses the compact original segmented selector. Schedule activity places dates above their entries and pairs the time with the author’s profile.

Profiles use a sage campus ID with the same initials as the directory. On a student record, Academic details, Advisor history and Schedule workflow expand independently so the reader can consult multiple sections. Student actions carry the selected student through to their schedule and preferences.
