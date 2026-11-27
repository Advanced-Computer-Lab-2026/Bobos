import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const files = [
  "apps/api/src/controllers/admin.controller.test.js",
  "apps/api/src/routes/admin.routes.test.js",
  "apps/api/src/controllers/group-b.integration.test.js",
  "apps/api/src/controllers/finance.integration.test.js",
  "apps/api/src/controllers/b3.edge-cases.test.js",
  "apps/api/src/controllers/scheduling.integration.test.js",
  "apps/api/src/controllers/bc-requirements.audit.test.js",
  "apps/api/src/utils/credit-allowance.test.js",
  "apps/api/src/utils/major.test.js",
  "apps/api/src/models/models.test.js",
  "apps/web/src/slot-change-filters.test.js",
];
console.log("Running Group B and C acceptance checks.");
const child = spawn(process.execPath, ["--test", "--test-concurrency=1", ...files], {
  cwd: fileURLToPath(new URL("../", import.meta.url)),
  stdio: "inherit",
});
child.on("error", (error) => { console.error(error); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
