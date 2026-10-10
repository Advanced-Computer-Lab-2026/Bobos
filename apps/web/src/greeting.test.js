import assert from "node:assert/strict";
import test from "node:test";
import { greetingName } from "./greeting.js";

test("uses the given name after coordinator and administrator honorifics", () => {
  assert.equal(greetingName("Eng. Nadia El-Sayed (Coordinator)"), "Nadia");
  assert.equal(greetingName("Dr. Laila Mansour (Admin)"), "Laila");
});

test("skips multiple leading honorifics and punctuation", () => {
  assert.equal(greetingName("Prof. Dr. Ahmed Hassan"), "Ahmed");
});

test("keeps ordinary names and handles missing names", () => {
  assert.equal(greetingName("Omar Ahmed"), "Omar");
  assert.equal(greetingName(""), "there");
  assert.equal(greetingName(null), "there");
});
