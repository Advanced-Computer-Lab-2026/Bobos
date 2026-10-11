// Requirement 33 - the assigned lecture / tutorial / lab of ONE registered
// course. Pure: shapes a StudentSchedule entry (the denormalised snapshot taken
// at assignment time, NOT the live offering) into the details payload.
import { DAYS, toMinutes } from './timetable.js';

export const COMPONENT_TYPES = ['lecture', 'tutorial', 'lab'];

function idOf(ref) {
  if (!ref) return null;
  return String(ref._id || ref);
}

const dayIndex = (day) => {
  const i = DAYS.indexOf(day);
  return i === -1 ? DAYS.length : i;
};

const bySession = (a, b) =>
  dayIndex(a.day) - dayIndex(b.day) ||
  toMinutes(a.startTime) - toMinutes(b.startTime) ||
  COMPONENT_TYPES.indexOf(a.type) - COMPONENT_TYPES.indexOf(b.type);

// The entry of `courseId` in the schedule's entries, or null.
export function findCourseEntry(entries = [], courseId) {
  return (entries || []).find((e) => idOf(e.course) === String(courseId)) || null;
}

// components.<type> = first slot of that type (null when the course has none);
// sessions = every slot, Saturday -> Thursday then by start time.
export function buildCourseDetails(entry, { courseType = null, instructors = [] } = {}) {
  const slots = ((entry && entry.slots) || [])
    .filter(Boolean)
    .map((s) => ({
      type: s.type,
      groupNumber: s.groupNumber ?? null,
      day: s.day ?? null,
      startTime: s.startTime ?? null,
      endTime: s.endTime ?? null,
      room: s.room ?? null
    }));

  const components = Object.fromEntries(
    COMPONENT_TYPES.map((type) => [type, slots.find((s) => s.type === type) || null])
  );

  return {
    course: {
      courseId: idOf(entry && entry.course),
      courseCode: entry ? entry.courseCode : null,
      courseName: entry ? entry.courseName : null,
      creditHours: Number(entry && entry.creditHours) || 0,
      courseType: courseType || null
    },
    instructors: Array.isArray(instructors) ? [...instructors] : [],
    components,
    sessions: [...slots].sort(bySession)
  };
}
