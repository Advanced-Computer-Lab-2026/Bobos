# Native integration and ownership

`pages.js` is an IIFE. It appends one local stylesheet and writes only the six owned keys on `window.portalVariants`. Each array has ten `{ name, apply({root,page,role}) }` objects. It never replaces the registry, installs a router, creates a second shell, or modifies another team’s page. The host inserts and persists the only Page design dropdown. No menu patch is required.

## Native controls retained

Overview moves the existing queue/review/activity/calendar nodes. The weekly widget is omitted only inside a selected variant. Existing draft links retain their dataset identifiers. Native calendar buttons and `calendarMonth` are not replaced. The transparent binder canvas is clipped at its own calendar module to keep its oversized drawing surface from creating horizontal page overflow; the calendar’s buttons and DOM remain intact.

Auth retains `#auth-form` and its existing submit button. Credential inputs in the studio are preview input affordances; valid submission bubbles to the supplied handler. Client-invalid or URL-fixture error submission stops before that handler. There is no new fake authentication service, OTP generator, account database or token store. Production `AuthPage.jsx` already owns the real requests and remains the owner after the optional patch.

Profile reuses the native own-account identity and role fields. Account recovery and sign-out use existing actions. Extra fields are explicitly fixed preview values in the studio, never imported into React.

Notifications preserve native `read-one`, `read-all`, `data-notification` identifiers and tab actions. The three native preview IDs are retained, with role-relevant message presentations. Opening a detail is not a read operation. Local read persistence is per preview role and synchronizes the native unread indicator. URL examples may substitute an event into one of the three slots; they are not a larger live inbox.

## Scope and lifetime

CSS selectors are rooted at `#content[data-fd-page]` (and the corresponding auth root). Event handlers are bound to the current content/form/disclosure/dialog, not to global document listeners. A host rerender removes those nodes. Microtasks restore focus to the existing design selector after a design change. Local dialogs support Escape, close/backdrop and focus return. Native menus continue to use the host dialog.

The page extension relies on existing host globals (`href`, `icon`, `queueSketch`, `deskCalendar`, `render`, `lab`, `applyLook`, `readNotifications`) in this supplied baseline. It is intentionally not a standalone library. Source checksums identify the tested baseline; changes to those host contracts should trigger the included browser checks.

## Storage

`portal-page-design:<page>` is host-owned. `portal-front-desk:appearance` holds only light/dark. `portal-front-desk:read:<previewRole>` holds the three preview notification IDs. `portal-front-desk:reset-email` in sessionStorage holds the preview recovery address. In-memory Maps remember a selected task, draft, tab, topic or query only until reload. No password, OTP, access token or real record is persisted by this extension. Existing production token behavior is unchanged.

## Permissions

The presentation gate follows the supplied page routes, not a newly invented role system. Coordinator-only pending work is never advertised to other roles. Student record links remain own-account workspaces. The React relation adapter uses an allowlist of event/model/role combinations, never a caller-provided URL or model name to construct an arbitrary endpoint. Missing, unknown or mismatched metadata fails closed. Actual record ownership is enforced by existing server guards; hiding a UI link is not authorization.

## Coexistence

The other four folders and all shared baseline files remain unchanged by the required studio install. Only the optional production patch touches three explicitly named existing files. It must be reviewed and integrated separately; it is not required to view the sixty designs. No font files or third-party runtime bundles are shipped.
