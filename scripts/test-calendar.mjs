import { spawnSync } from "node:child_process";

for (const args of [
  ["--test", "apps/api/src/services/calendar-worker.test.js"],
  ["--test", "--test-name-pattern=Req 116", "apps/api/src/controllers/bc-requirements.audit.test.js"],
]) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
