import { readFile, readdir } from "node:fs/promises";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "node:test";
import { spec } from "node:test/reporters";

const root = fileURLToPath(new URL("../", import.meta.url));
const coverage = JSON.parse(await readFile(new URL("../tests/functional-coverage.json", import.meta.url)));
const expectedIds = Array.from({ length: 128 }, (_, index) => index + 1);
const assignedIds = new Set(coverage.flatMap(entry => entry.requirements));
if (assignedIds.size !== expectedIds.length || expectedIds.some(id => !assignedIds.has(id))) {
  throw new Error("The coverage map must include functional requirements 1 through 128.");
}

process.env.A_AUDIT_STRICT = "1";
process.env.BC_AUDIT_STRICT = "1";

const files = [];
for (const folder of ["apps/api/src", "apps/web/src"]) {
  for (const entry of await readdir(new URL(folder + "/", new URL("../", import.meta.url)), { recursive: true, withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".test.js")) {
      files.push(`${entry.parentPath}/${entry.name}`);
    }
  }
}

const passed = new Map();
let failures = 0;
const results = run({ files: files.sort(), concurrency: 1 });
for await (const event of results.compose(async function* (events) {
  for await (const event of events) {
    const { type, data } = event;
    if (type === "test:fail") failures++;
    if (type === "test:pass" && !data.skip && !data.todo && data.file) {
      const file = relative(root, data.file).replaceAll("\\", "/");
      if (!passed.has(file)) passed.set(file, new Set());
      passed.get(file).add(data.name);
    }
    yield event;
  }
}).compose(spec)) {
  process.stdout.write(event);
}

const missing = coverage.filter(({ file, test }) => !passed.get(file)?.has(test));
for (const { requirements, file, test } of missing) {
  console.error(`Requirements ${requirements.join(", ")} did not pass: "${test}" (${file})`);
}
if (missing.length || failures) process.exitCode = 1;
else console.log(`Verified automated checks for all ${expectedIds.length} functional requirements.`);
