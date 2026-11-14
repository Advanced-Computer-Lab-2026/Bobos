import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const regression = process.argv.includes("--regression");
const files = [
  "apps/api/src/controllers/extra-hours.integration.test.js",
  "apps/api/src/controllers/graduation-plans.integration.test.js",
  "apps/api/src/controllers/scheduling.integration.test.js",
  "apps/api/src/controllers/group-b.integration.test.js",
  "apps/api/src/services/probation-warnings.integration.test.js",
  "apps/api/src/controllers/offering-year.integration.test.js",
  "apps/api/src/controllers/group-a.audit.test.js",
];
console.log(regression ? "Group A regression: known acceptance gaps execute as TODOs, not passes." : "Group A strict acceptance: unmet requirements fail this command.");
const child = spawn(process.execPath, ["--test", "--test-concurrency=1", ...files], {
  cwd: fileURLToPath(new URL("../", import.meta.url)),
  env: { ...process.env, A_AUDIT_STRICT: regression ? "0" : "1" }, stdio: "inherit",
});
child.on("error", (error) => { console.error(error); process.exitCode = 1; });
child.on("exit", (code) => { process.exitCode = code ?? 1; });
