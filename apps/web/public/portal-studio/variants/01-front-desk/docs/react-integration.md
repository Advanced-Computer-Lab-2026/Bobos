# Optional real-application companion

The required installation is only the public Studio folder. This companion is separate and **does not port all sixty variants into React**. It improves the supplied real AuthPage and replaces only its Notifications view with a route-keyed API reader. Existing Overview/Profile and every other team workflow stay unchanged.

## Files and hooks

Copy these four files from this folder to `project/apps/web/src/front-desk/01/`:

```text
AuthSupport.jsx
NotificationsRoute.jsx
route-contract.mjs
front-desk.css
```

`AuthSupport` is keyed by the existing AuthPage `mode` (`login`, `forgot`, `reset`). `PasswordField` retains controlled values and the existing submit handlers. The source still calls POST `/api/identity/login`, `/api/identity/forgot-password`, and `/api/identity/reset-password`; existing App logout is untouched.

`NotificationsRoute` replaces the `screen === "notifications"` call site in `apps/web/src/App.jsx`. It receives `{token, profile, onOpen: openScreen, notify}` and is keyed by account identity and role. It loads GET `/api/notifications`; read operations call PATCH `/api/notifications/:id/read`. All state originates from actual API responses; it imports no studio fixtures.

`route-contract.mjs` contains role/event/model rules and the exact GET paths supported for record inspection. Extra-hours detail, slot requests, own financial history and permitted graduation/exit collections are used only where the supplied routes exist. Other relations hand off to an existing authorized workspace. There is no invented direct graduation-plan, reminder or reversal endpoint.

`front-desk.css` is rooted at `data-front-desk-route`; no global reset or shell stylesheet is installed. The approved folder and auth drawings load from the installed public extension folder.

## Apply the patches deliberately

From the `project` root, with the public extension already installed:

```sh
PART=apps/web/public/portal-studio/variants/01-front-desk
mkdir -p apps/web/src/front-desk/01
cp "$PART"/react/* apps/web/src/front-desk/01/
patch --dry-run -p1 < "$PART/patches/01-web-companion.patch"
patch --dry-run -p1 < "$PART/patches/02-notification-metadata.patch"
patch -p1 < "$PART/patches/01-web-companion.patch"
patch -p1 < "$PART/patches/02-notification-metadata.patch"
```

Review `patches/baseline-hashes.json` first. It lists the expected SHA-256 for the three existing source files. If your teammates changed these files, integrate the small hunks manually instead of overwriting their work. Apply only once. Standard `git apply --check`/`git apply` can be used in place of patch.

Patch 01 touches only `apps/web/src/App.jsx` and `apps/web/src/components/AuthPage.jsx`: the notification import/call, route-local auth help, controlled password fields and busy/byte checks. Patch 02 touches only `apps/api/src/controllers/notifications.controller.js`: it exposes the existing model’s relation metadata in the owned GET/PATCH serializers. It does not change notification producers, authorization, model schemas, identity endpoints or decisions.

For rollback, reverse the two patches in reverse order and remove `apps/web/src/front-desk/01/`. Do not reverse against unrelated later edits without reviewing the diff.

## Runtime acceptance still required

The patches were applied to an isolated copy of the exact baseline. Their JSX was transpiled for syntax, the serializer passes Node syntax checking, and the pure contract’s Node tests pass. A React dependency installation/build, live API, MongoDB, SMTP delivery and screen-reader audit were **not** run here; available dependency downloads were unavailable. Those checks are not represented as passed.

Before adoption, run the repository’s normal build/tests with its configured environment, then test real account login, generic recovery, expired/replaced code, reset session invalidation, own-profile/logout, own notifications, mixed channels, successful/failed reads, unauthorized/deleted relations and route changes during pending requests. Missing backend senders remain missing after this patch.
