// Requirement 31 - turns a StudentSchedule's denormalised `entries` into the
// weekly calendar every consumer renders (reqs 32/33/49 can reuse it).
// Pure function: no database access.
import { DAYS, toMinutes } from './timetable.js';

// Saturday-Thursday are teaching days (the slot model's DAYS); Friday is the
// weekend and is always a day off.
export const TEACHING_DAYS = DAYS;
export const WEEK_DAYS = [...DAYS, 'Friday'];

const byStartTime = (a, b) =>
  toMinutes(a.startTime) - toMinutes(b.startTime) || toMinutes(a.endTime) - toMinutes(b.endTime);

export function buildWeeklyCalendar(entries = []) {
  const week = Object.fromEntries(TEACHING_DAYS.map((day) => [day, []]));

  const courses = entries.map((entry) => {
    const slots = (entry.slots || [])
      .filter(Boolean)
      .map((s) => ({
        type: s.type,
        groupNumber: s.groupNumber,
        day: s.day,
        startTime: s.startTime,
        endTime: s.endTime,
        room: s.room
      }));

    for (const slot of slots) {
      if (!week[slot.day]) continue; // unknown day: never invent a column
      week[slot.day].push({
        courseCode: entry.courseCode,
        courseName: entry.courseName,
        type: slot.type,
        groupNumber: slot.groupNumber,
        startTime: slot.startTime,
        endTime: slot.endTime,
        room: slot.room
      });
    }

    return {
      courseCode: entry.courseCode,
      courseName: entry.courseName,
      creditHours: entry.creditHours || 0,
      slots: slots.sort((a, b) => TEACHING_DAYS.indexOf(a.day) - TEACHING_DAYS.indexOf(b.day) || byStartTime(a, b))
    };
  });

  for (const day of TEACHING_DAYS) week[day].sort(byStartTime);

  const daysOff = WEEK_DAYS.filter((day) => day === 'Friday' || week[day].length === 0);
  const totalCreditHours = courses.reduce((sum, c) => sum + (c.creditHours || 0), 0);

  return { courses, week, daysOff, totalCreditHours };
}
