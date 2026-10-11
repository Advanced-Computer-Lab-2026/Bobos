import { slotsOverlap, toMinutes, findFirstClash, describeSlot } from '../src/utils/timetable.js';

describe('timetable overlap helper', () => {
  test('toMinutes parses HH:mm', () => {
    expect(toMinutes('08:15')).toBe(495);
    expect(toMinutes('00:00')).toBe(0);
    expect(Number.isNaN(toMinutes('nonsense'))).toBe(true);
  });

  test('slots on different days never overlap', () => {
    const a = { day: 'Saturday', startTime: '08:15', endTime: '10:00' };
    const b = { day: 'Sunday', startTime: '08:15', endTime: '10:00' };
    expect(slotsOverlap(a, b)).toBe(false);
  });

  test('identical slots overlap', () => {
    const a = { day: 'Monday', startTime: '10:15', endTime: '12:00' };
    expect(slotsOverlap(a, { ...a })).toBe(true);
  });

  test('partially overlapping slots overlap', () => {
    const a = { day: 'Monday', startTime: '10:00', endTime: '12:00' };
    const b = { day: 'Monday', startTime: '11:00', endTime: '13:00' };
    expect(slotsOverlap(a, b)).toBe(true);
    expect(slotsOverlap(b, a)).toBe(true);
  });

  test('back-to-back slots do NOT overlap', () => {
    const a = { day: 'Monday', startTime: '10:00', endTime: '12:00' };
    const b = { day: 'Monday', startTime: '12:00', endTime: '14:00' };
    expect(slotsOverlap(a, b)).toBe(false);
  });

  test('a fully contained slot overlaps', () => {
    const a = { day: 'Tuesday', startTime: '08:00', endTime: '14:00' };
    const b = { day: 'Tuesday', startTime: '10:00', endTime: '11:00' };
    expect(slotsOverlap(a, b)).toBe(true);
  });

  test('findFirstClash returns null for a clash-free list', () => {
    const slots = [
      { day: 'Saturday', startTime: '08:15', endTime: '10:00' },
      { day: 'Saturday', startTime: '10:15', endTime: '12:00' },
      { day: 'Sunday', startTime: '08:15', endTime: '10:00' }
    ];
    expect(findFirstClash(slots)).toBeNull();
  });

  test('findFirstClash returns the clashing pair', () => {
    const slots = [
      { day: 'Saturday', startTime: '08:15', endTime: '10:00', courseCode: 'CSEN 501', type: 'lecture', groupNumber: '1' },
      { day: 'Sunday', startTime: '08:15', endTime: '10:00' },
      { day: 'Saturday', startTime: '09:00', endTime: '11:00', courseCode: 'MATH 501', type: 'tutorial', groupNumber: '1' }
    ];
    const clash = findFirstClash(slots);
    expect(clash).not.toBeNull();
    expect(clash[0].courseCode).toBe('CSEN 501');
    expect(clash[1].courseCode).toBe('MATH 501');
    expect(describeSlot(clash[0])).toBe('CSEN 501 lecture group 1 (Saturday 08:15-10:00)');
  });
});
