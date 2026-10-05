// Timetable helpers shared by the scheduling requirements (30, 31, 34).
// Times are 'HH:mm' strings, 24h.

export const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

export function toMinutes(time) {
  if (typeof time !== 'string') return NaN;
  const [h, m] = time.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
}

// Two slots overlap when they are on the same day and their [start, end)
// intervals intersect. Back-to-back slots (10:00-12:00 and 12:00-14:00) do NOT
// overlap.
export function slotsOverlap(a, b) {
  if (!a || !b) return false;
  if (a.day !== b.day) return false;
  const aStart = toMinutes(a.startTime);
  const aEnd = toMinutes(a.endTime);
  const bStart = toMinutes(b.startTime);
  const bEnd = toMinutes(b.endTime);
  if ([aStart, aEnd, bStart, bEnd].some((n) => Number.isNaN(n))) return false;
  return aStart < bEnd && bStart < aEnd;
}

// Returns the FIRST clashing pair in a flat list of slots, or null when the list
// is clash-free. Each item may carry extra fields (courseCode, type, ...) which
// are passed through so callers can build a readable error message.
export function findFirstClash(slots) {
  for (let i = 0; i < slots.length; i += 1) {
    for (let j = i + 1; j < slots.length; j += 1) {
      if (slotsOverlap(slots[i], slots[j])) return [slots[i], slots[j]];
    }
  }
  return null;
}

export function describeSlot(slot) {
  const label = slot.courseCode ? `${slot.courseCode} ` : '';
  const type = slot.type ? `${slot.type} ` : '';
  const group = slot.groupNumber ? `group ${slot.groupNumber} ` : '';
  return `${label}${type}${group}(${slot.day} ${slot.startTime}-${slot.endTime})`.trim();
}
