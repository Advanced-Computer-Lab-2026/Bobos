import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const files = [
  "apps/api/src/controllers/extra-hours.integration.test.js",
  "apps/api/src/controllers/graduation-plans.integration.test.js",
  "apps/api/src/controllers/scheduling.integration.test.js",
  "apps/api/src/controllers/group-b.integration.test.js",
  "apps/api/src/services/probation-warnings.integration.test.js",
  "apps/api/src/controllers/offering-year.integration.test.js",
  "apps/api/src/controllers/group-a.audit.test.js",
];
console.log("Running Group A acceptance checks.");
const child = spawn(process.execPath, ["--test", "--test-concurrency=1", ...files], {
  cwd: fileURLToPath(new URL("../", import.meta.url)),
  stdio: "inherit",
});
child.on("error", (error) => { console.error(error); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
