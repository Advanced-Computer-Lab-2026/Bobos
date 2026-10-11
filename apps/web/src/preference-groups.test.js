import assert from "node:assert/strict";
import test from "node:test";
import { findPreferenceConflict, preferenceConflictMessage, preferenceGroupOptions, preferenceMeetingLabel } from "./preference-groups.js";

const offerings = [
  {
    course: { _id: "course-a", code: "CSEN102" },
    slots: [
      { componentType: "lecture", groupNumber: "1", day: "Monday", startMinute: 540, endMinute: 600, room: "C7.301" },
      { componentType: "tutorial", groupNumber: "1", day: "Tuesday", startMinute: 600, endMinute: 660, room: "C6.202" },
    ],
  },
  {
    course: { _id: "course-b", code: "CSEN301" },
    slots: [
      { componentType: "lecture", groupNumber: "1", day: "Monday", startMinute: 570, endMinute: 630, room: "C7.303" },
      { componentType: "lecture", groupNumber: "2", day: "Monday", startMinute: 600, endMinute: 660, room: "C7.304" },
      { componentType: "tutorial", groupNumber: "1", day: "Wednesday", startMinute: 540, endMinute: 600, room: "C6.303" },
    ],
  },
];

test("finds partial overlaps across subjects and formats the exact conflicting interval", () => {
  const conflict = findPreferenceConflict([
    { course: "course-a", componentType: "lecture", groupNumber: "1" },
    { course: "course-b", componentType: "lecture", groupNumber: "1" },
  ], offerings);
  assert.deepEqual(conflict, {
    firstCourse: "CSEN102",
    firstGroup: "lecture 1",
    secondCourse: "CSEN301",
    secondGroup: "lecture 1",
    day: "Monday",
    startMinute: 570,
    endMinute: 600,
  });
  assert.match(preferenceConflictMessage(conflict), /Monday, 09:30–10:00/);
});

test("allows adjacent group times and ranked alternatives in the same subject", () => {
  assert.equal(findPreferenceConflict([
    { course: "course-a", componentType: "lecture", groupNumber: "1" },
    { course: "course-b", componentType: "lecture", groupNumber: "2" },
  ], offerings), null);
  assert.equal(findPreferenceConflict([
    { course: "course-b", componentType: "lecture", groupNumber: "1" },
    { course: "course-b", componentType: "lecture", groupNumber: "2" },
  ], offerings), null);
});

test("checks every meeting in a multi-session group and keeps readable time labels", () => {
  const multiSessionOfferings = [...offerings];
  multiSessionOfferings[1] = {
    ...offerings[1],
    slots: [...offerings[1].slots, { componentType: "lecture", groupNumber: "1", day: "Tuesday", startMinute: 630, endMinute: 690, room: "C7.305" }],
  };
  const conflict = findPreferenceConflict([
    { course: "course-a", componentType: "tutorial", groupNumber: "1" },
    { course: "course-b", componentType: "lecture", groupNumber: "1" },
  ], multiSessionOfferings);
  assert.equal(conflict?.day, "Tuesday");
  assert.equal(preferenceGroupOptions(multiSessionOfferings[1]).find(option => option.componentType === "lecture" && option.groupNumber === "1").sessions.length, 2);
  assert.equal(preferenceMeetingLabel(multiSessionOfferings[1].slots.at(-1)), "Tuesday · 10:30–11:30 · C7.305");
});
