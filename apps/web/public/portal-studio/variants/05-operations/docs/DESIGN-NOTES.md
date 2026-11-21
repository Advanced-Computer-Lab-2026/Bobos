# Design choices inside the approved Portal

## What stays fixed

Overview remains the approved dashboard. The submission does not change the brand, sidebar width, account controls, login, term display, shared typography, header, theme controls or calendar. Page design choices belong to the content area. Drawings remain small and task-related; no hero, statistic band or decorative dashboard replaces the user's work.

The three studio adapters start with the actual renderer's nodes. React adapters stay inside the existing app's authenticated routes and use existing API calls. The same task-oriented layout families are adapted to each view rather than presented as ten unrelated products.

## Ten arrangements and their purpose

| Family | Useful when | Interaction changed |
| --- | --- | --- |
| Register | Scan many records or read a form continuously | Semantic rows and continuous sections |
| Side desk | Refine a queue while keeping records visible | Filters/workflow navigation beside work |
| Lanes | Separate records by a real status or category | Grouped record columns; form sections in task columns |
| Open files | Inspect only the items that need attention | Native disclosure records or collapsible sections |
| Trail | Follow an actual ordering or a sequence of decisions | Dated/ordered trail without invented events |
| Comparison | Reconcile competing records or facts | Up to three selected rows; source/decision sections alongside each other |
| Inbox | Work through a queue without losing its position | Selection index beside the active record/section |
| Day / term book | Locate work by time or stage | Real date/term grouping or horizontal form stages |
| Focused review | Finish one item or one step at a time | Previous/next navigation; native validity checks before progressing |
| Action / margin register | Prioritize the next available action | Action-first tables or a reference index at the form margin |

The ten names vary by page to describe its actual work. Exact names, roles and keys are in `../manifest.json`. These are shared layout families; the count does not imply 230 independently invented interaction systems. Original remains available. The studio's Original renderer is untouched; React Original is the adapter's baseline arrangement with the explicitly documented functional additions and safety restrictions.

## State belongs to the task, not the arrangement

Selecting a different design does not submit a request, decide a plan, spend money or reset a draft. Controlled fields and form sections retain their identity. Sections can be hidden during focused work without unmounting their field state. A selected comparison can be empty; the interface asks for a selection rather than silently substituting records.

Each view remembers only its design preference under the supplied host's page-key convention. Records and drafts are not written to that preference store. Storage failure falls back to a clearly marked session choice in React. API failures remain failures; a toast or illustration never substitutes for the server's result.

## Illustration at the decision point

The approved extra-hours folder asset is included locally. Its geometry is used for the small decision-point drawing. The sheet has authored opening poses, intermediate holds and a quiet final state; it does not loop. Replay is a labelled control. Reduced motion renders the final state without animation. It sits beside the request context, not above the page as decoration.

## Boundaries are visible

A deferred confirmation says it is not a paid receipt. A sandbox payment is labelled as such. Reversal review is available, but execution is blocked because the supplied audits describe unresolved accounting faults. The incomplete pending-work feed is disclosed. These are deliberate honest states, not success simulations or backend repairs.
