# Portal workspace UI review

Review branch: `codex/ui-polish-local`. Baseline: `development` at `d993c0a` (PR 57). The ten-page polish and global dropdown follow-up were reviewed with before/after screenshots before integration was authorized.

## Skills applied

- [Anthropic Frontend Design](https://github.com/anthropics/skills/tree/main/skills/frontend-design): installed locally; used for hierarchy, plain copy and restrained visual structure.
- [Vercel Web Design Guidelines](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines): installed locally; current upstream checklist fetched for responsive layout, accessible labels, keyboard focus and content handling.
- Existing Emil Design Engineering skill: used for interaction restraint, readable feedback and consistency. No decorative entrance animations added.

## Design direction

The audience is university students, advisors and coordinators performing repeated administrative tasks. Preserve Portal's established identity rather than introduce a new visual theme.

Palette: canvas `#faf8f4`, paper `#fffefa`, ink `#302f2c`, muted text `#6a665f`, blue accent `#48667a`, danger text `#852d26`; use the existing dark-theme equivalents. Typography: existing system UI for task content and existing Portal wordmark. Left-align page titles and descriptions; place related actions beside the title; use a filter panel followed by results. Use actual counts for metadata, not decorative section numbers. Keep tables scrollable within their own region on small screens.

Plan review: the warm palette is an explicit continuation of the user's existing Portal theme. Keep it, while removing repeated technical eyebrows and section markers that do not help the user. Avoid new fonts, gradients, animation libraries or extra dashboard widgets.

## Ten pages

| Page | Before | After | Why |
| --- | --- | --- | --- |
| Pending work | Raw camelCase labels, large repetitive cards, dense table | Compact totals, readable statuses, advisor summary and contained table | Easier triage |
| Financial records | Technical group label, decorative numbering, uneven filters, generic empty state | Task-focused heading, aligned search/filters, contextual empty state and clear-filter action | Easier transaction lookup |
| Schedule activity | Inconsistent controls and heading level; empty table row | Page header, labeled filter panel, action badges, empty state and styled pagination | Consistent history review |
| Graduation review | Heavy tab buttons and unbalanced filter rows | Compact review switch, balanced filter grid and clear queue counts | Clearer review hierarchy |
| Extra-hours requests | Generic empty state, refresh glyph, advisor controls that did not filter their endpoint | Clear role-specific introduction, text refresh action, coordinator-only filters, useful empty state | Avoid misleading controls |
| Slot changes | Bare no-results paragraph and awkward filter wrapping | Balanced filters, queue count, meaningful empty state, retained red rejection feedback | Clear request triage |
| Course removals | Long title and technical eyebrow, awkward date row, decorative glyph | Short task title, aligned filters/dates and meaningful empty state | Better scanning and narrow layouts |
| Advisor schedules | Repeated roster label, plural count for one student | Consistent header, contained table, usable search spacing and singular count | Cleaner daily workflow |
| Graduation planner | Very long course list; no course search; empty term table | Searchable bounded list, sticky column headings, separated actions, missing-term warning | Easier planning without changing selections |
| Calendar sync | One bare connect button and paragraph | Connection status, primary action, numbered explanation of actual steps and processed-schedule prerequisite | Clear expectations before connecting |

Keyboard support also includes a skip-to-content link and focusable scroll regions for the new progress/history/planner tables. Icons extend the existing outline SVG family; no emoji were introduced.

## Scope and verification

Changes are frontend-only. Request payloads, server validation, permissions, payment calculations and persistence are unchanged. The course search filters only rendered rows; saved plan payloads still use the complete assignment map. Existing incomplete business requirements from the A/B/C audits remain outside this UI review.

Before screenshots come from a separate, untouched checkout of the baseline using the same API, accounts, database, viewport and theme as the after screenshots. Empty request/financial queues are real database states. No request, payment, calendar authorization or plan is created just for a screenshot.

Verification results and the ten before/after image pairs are recorded alongside the local screenshot gallery. This is a focused UI review, not a claim of full WCAG certification or live-provider testing.

Final result: production frontend build and `git diff --check` pass. All 9 existing frontend tests pass. An isolated browser checked all ten revised pages at 1440 × 1000 and 390 × 844, verified the existing dark palette on each page, found no page overflow or unlabeled inputs, and reported no frontend runtime errors. Seven interaction checks passed: keyboard skip link; financial search/reset; extra-hours reset; review queue switching; advisor roster search/reset; planner course filtering without changing assignments; calendar connection action presence. External Google authorization, real transactions and workflow mutations were not exercised.

## Resolved review locations

- `apps/web/src/components/B1Pages.jsx:20` — consistent H1 page hierarchy and readable labels replace technical workflow values.
- `apps/web/src/components/B1Pages.jsx:63` — consistent labeled history filters and meaningful empty results.
- `apps/web/src/components/B1Pages.jsx:104` — connection state and explanation accompany the calendar action.
- `apps/web/src/components/GraduationReview.jsx:134` — labeled review queues and responsive filters replace inconsistent controls.
- `apps/web/src/components/SchedulingPages.jsx:472` — roster search spacing and singular student count corrected.
- `apps/web/src/components/GraduationPlans.jsx:197` — course search and a contained scroll region make long lists usable.
- `apps/web/src/App.jsx:203` — keyboard users can skip repeated navigation.

## Global dropdown alignment follow-up

`apps/web/src/form-controls.css` unifies single-choice dropdowns across all pages, including forms outside the ten-page polish. A theme-aware outline chevron sits 12px from the right edge, with 40px of reserved text space. Native select menus, labels and keyboard behavior remain intact. Long selected values use ellipsis; disabled controls show a disabled cursor. Multi-selects and listboxes keep their native presentation. Windows forced-color mode restores the native arrow instead of relying on a background SVG.

Before/after images for this follow-up compare the preceding local UI with the new dropdown styling, using the same account, data and viewport. They show financial filters, academic-term setup and graduation-planner controls. Browser checks cover 80 actual single-choice controls, mobile financial filters, dark colors, keyboard selection, high-contrast fallback and unchanged multi-select presentation. No form was saved during verification.
