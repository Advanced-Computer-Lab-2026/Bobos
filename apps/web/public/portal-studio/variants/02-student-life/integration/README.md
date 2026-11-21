# Optional authenticated React handoff

The studio drop-in does **not** need this patch. It is supplied for the separate real React application in `project/apps/web/`.

From the supplied `project/` directory:

```sh
cp apps/web/public/portal-studio/variants/02-student-life/integration/StudentLifeRoutes.jsx apps/web/src/components/StudentLifeRoutes.jsx
patch --dry-run -p1 < apps/web/public/portal-studio/variants/02-student-life/integration/app-integration.patch
patch -p1 < apps/web/public/portal-studio/variants/02-student-life/integration/app-integration.patch
```

`BASELINE.json` records the expected unpatched App.jsx hash. The patch only replaces the owned route-render branches and their imports. No package dependency, API implementation, login flow, role source, notification behavior or unrelated route is changed. Resolve any patch conflict against the current integrator branch rather than applying it blindly.

`StudentLifeRoutes.jsx` exports the owned route list, role-permission map, permission helper and default `StudentLifeRoute`. It passes the existing authenticated `token`, `profile`, `context`, `notify` and `onOpen` through to current components. Student record/preference context cannot redirect a student to another profile; staff records need an explicitly selected student. Slot-change and draft-schedule callbacks retain the existing route keys and term context.

This adapter uses the existing production views and their real APIs. It does not copy synthetic preview data into React, and it is not a production port of every DOM layout. The registry supports visual/workflow selection in the studio; a chosen layout can be integrated into the authenticated components without replacing their domain behavior. Source/API pointers and limitations are in `../docs/REQUIREMENTS.md`.

The patch was dry-run against the fresh supplied App.jsx. JSX syntax and 50 route/prop contract checks passed with stub components. A production build, live API/database acceptance run and real-provider OAuth verification were not performed.
