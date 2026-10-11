// Requirement 31 - unit tests for the pure helpers.
import { buildWeeklyCalendar } from '../src/utils/weeklyCalendar.js';
import { checkScheduleAccess, visibleStatusesFor, NO_VISIBLE_SCHEDULE } from '../src/utils/scheduleAccess.js';

describe('buildWeeklyCalendar', () => {
  const entries = [
    {
      courseCode: 'CSEN 501',
      courseName: 'Data Base I',
      creditHours: 6,
      slots: [
        { type: 'lab', groupNumber: '1', day: 'Monday', startTime: '12:15', endTime: '14:00', room: 'Lab 1' },
        { type: 'lecture', groupNumber: '1', day: 'Saturday', startTime: '10:15', endTime: '12:00', room: 'H1' }
      ]
    },
    {
      courseCode: 'MATH 501',
      courseName: 'Discrete Math',
      creditHours: 4,
      slots: [
        { type: 'lecture', groupNumber: '1', day: 'Saturday', startTime: '08:15', endTime: '10:00', room: 'H4' },
        { type: 'tutorial', groupNumber: '1', day: 'Monday', startTime: '08:15', endTime: '10:00', room: 'C7.4' }
      ]
    }
  ];

  test('groups sessions by day, sorted by start time', () => {
    const { week } = buildWeeklyCalendar(entries);
    expect(Object.keys(week)).toEqual(['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']);
    expect(week.Saturday.map((s) => s.courseCode)).toEqual(['MATH 501', 'CSEN 501']);
    expect(week.Monday.map((s) => s.startTime)).toEqual(['08:15', '12:15']);
    expect(week.Saturday[0]).toEqual({
      courseCode: 'MATH 501', courseName: 'Discrete Math', type: 'lecture',
      groupNumber: '1', startTime: '08:15', endTime: '10:00', room: 'H4'
    });
  });

  test('days off are the empty teaching days plus Friday, in week order', () => {
    expect(buildWeeklyCalendar(entries).daysOff).toEqual(['Sunday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
    expect(buildWeeklyCalendar([]).daysOff).toEqual([
      'Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'
    ]);
  });

  test('totals credit hours and orders each course slots by day then time', () => {
    const { courses, totalCreditHours } = buildWeeklyCalendar(entries);
    expect(totalCreditHours).toBe(10);
    expect(courses[0].slots.map((s) => s.day)).toEqual(['Saturday', 'Monday']);
  });
});

describe('scheduleAccess', () => {
  const normal = { _id: 'n', user: 'u-normal', studentType: 'normal' };
  const advising = { _id: 'a', user: { _id: 'u-adv' }, studentType: 'advising' };
  const sched = (status) => ({ status });
  const student = (id) => ({ id, role: 'student' });

  test('normal student: own processed only', () => {
    expect(checkScheduleAccess(student('u-normal'), normal, sched('processed'))).toEqual({ status: 200, readOnly: false });
    expect(checkScheduleAccess(student('u-normal'), normal, sched('draft')).status).toBe(404);
    expect(checkScheduleAccess(student('u-normal'), normal, null).status).toBe(404);
    expect(checkScheduleAccess(student('u-other'), normal, sched('processed')).status).toBe(403);
  });

  test('advising student: draft hidden with the neutral message, review/processed visible', () => {
    expect(checkScheduleAccess(student('u-adv'), advising, sched('draft'))).toEqual({ status: 404, message: NO_VISIBLE_SCHEDULE });
    expect(checkScheduleAccess(student('u-adv'), advising, sched('ready_for_student_review')).status).toBe(200);
    expect(checkScheduleAccess(student('u-adv'), advising, sched('processed')).status).toBe(200);
  });

  test('advisor: advising students in any status, normal students forbidden', () => {
    const advisor = { id: 'x', role: 'advisor' };
    for (const s of ['draft', 'ready_for_student_review', 'processed']) {
      expect(checkScheduleAccess(advisor, advising, sched(s)).status).toBe(200);
    }
    expect(checkScheduleAccess(advisor, normal, sched('processed')).status).toBe(403);
  });

  test('coordinator any; administrator any and read-only; unknown role forbidden', () => {
    expect(checkScheduleAccess({ id: 'c', role: 'coordinator' }, normal, sched('draft'))).toEqual({ status: 200, readOnly: false });
    expect(checkScheduleAccess({ id: 'a', role: 'administrator' }, advising, sched('draft'))).toEqual({ status: 200, readOnly: true });
    expect(visibleStatusesFor({ id: 'z', role: 'guest' }, normal).error.status).toBe(403);
  });
});
