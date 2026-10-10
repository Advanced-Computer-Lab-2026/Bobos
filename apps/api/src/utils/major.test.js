import assert from "node:assert/strict";
import test from "node:test";
import { canonicalMajor, majorMatches } from "./major.js";

test("major codes and display labels match the same curriculum", () => {
  assert.equal(canonicalMajor("CSEN"), "cs");
  assert.equal(majorMatches("CS", "Computer Science"), true);
  assert.equal(majorMatches("DMET", "Digital Media Engineering"), true);
  assert.equal(majorMatches("DME", "DMET"), true);
  assert.equal(majorMatches("CS", "DMET"), false);
});

test("unknown major names match only after simple case and punctuation normalization", () => {
  assert.equal(majorMatches("Electrical Engineering", " electrical-engineering "), true);
  assert.equal(majorMatches("Electrical Engineering", "Mechanical Engineering"), false);
});
