export function preferenceGroupOptions(offering) {
  const options = new Map();
  for (const slot of offering.slots || []) {
    const key = JSON.stringify([slot.componentType, slot.groupNumber]);
    if (!options.has(key)) options.set(key, { componentType: slot.componentType, groupNumber: slot.groupNumber, sessions: [] });
    options.get(key).sessions.push(slot);
  }
  return [...options.values()];
}

export function preferenceMeetingLabel(slot) {
  const time = Number.isInteger(slot.startMinute) && Number.isInteger(slot.endMinute)
    ? `${minutesToTime(slot.startMinute)}–${minutesToTime(slot.endMinute)}`
    : "Time not set";
  return `${slot.day || "Day not set"} · ${time}${slot.room ? ` · ${slot.room}` : ""}`;
}

export function findPreferenceConflict(groups, offerings) {
  for (let firstIndex = 0; firstIndex < groups.length; firstIndex += 1) {
    const first = groups[firstIndex];
    const firstCourseId = courseId(first.course);
    const firstOffering = offerings.find((item) => courseId(item.course) === firstCourseId);
    const firstOption = preferenceGroupOptions(firstOffering || {}).find((option) => matchesGroup(option, first));
    if (!firstOption) continue;

    for (let secondIndex = firstIndex + 1; secondIndex < groups.length; secondIndex += 1) {
      const second = groups[secondIndex];
      if (courseId(second.course) === firstCourseId) continue;
      const secondOffering = offerings.find((item) => courseId(item.course) === courseId(second.course));
      const secondOption = preferenceGroupOptions(secondOffering || {}).find((option) => matchesGroup(option, second));
      if (!secondOption) continue;

      for (const firstSession of firstOption.sessions) {
        for (const secondSession of secondOption.sessions) {
          if (firstSession.day !== secondSession.day
            || !Number.isInteger(firstSession.startMinute) || !Number.isInteger(firstSession.endMinute)
            || !Number.isInteger(secondSession.startMinute) || !Number.isInteger(secondSession.endMinute)) continue;
          const startMinute = Math.max(firstSession.startMinute, secondSession.startMinute);
          const endMinute = Math.min(firstSession.endMinute, secondSession.endMinute);
          if (startMinute < endMinute) {
            return {
              firstCourse: firstOffering?.course?.code || "First subject",
              firstGroup: `${first.componentType} ${first.groupNumber}`,
              secondCourse: secondOffering?.course?.code || "Second subject",
              secondGroup: `${second.componentType} ${second.groupNumber}`,
              day: firstSession.day,
              startMinute,
              endMinute,
            };
          }
        }
      }
    }
  }
  return null;
}

export function preferenceConflictMessage(conflict) {
  if (!conflict) return "";
  return `${conflict.firstCourse} ${conflict.firstGroup} overlaps ${conflict.secondCourse} ${conflict.secondGroup} on ${conflict.day}, ${minutesToTime(conflict.startMinute)}–${minutesToTime(conflict.endMinute)}. Choose a different group.`;
}

function courseId(course) {
  return String(course?._id || course || "");
}

function matchesGroup(option, group) {
  return option.componentType === group.componentType && option.groupNumber === group.groupNumber;
}

function minutesToTime(value) {
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
}
