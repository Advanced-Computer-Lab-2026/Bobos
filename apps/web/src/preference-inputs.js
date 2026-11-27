export const PREFERENCE_DAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
export const PREFERENCE_TIME_SLOTS = ["08:15-09:45", "10:00-11:30", "11:45-13:15", "13:45-15:15", "15:45-17:15"];
export function parseDays(value) {
  const names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const days = value.split(",").map(item => item.trim()).filter(Boolean).map(day => {
    const name = names.find(name => name.toLowerCase() === day.toLowerCase());
    if (!name) throw new Error(`Unknown weekday: ${day}. Use a full name such as Monday.`);
    return name;
  });
  if (new Set(days).size !== days.length) throw new Error("Remove duplicate weekday entries.");
  return days.map((day, index) => ({ day, priority: index + 1 }));
}
export function parseTimes(value) {
  return value.split(",").map((item) => item.trim()).filter(Boolean).map((range, index) => {
    const parts = range.split(/[-–—]/).map((part) => part.trim());
    if (parts.length !== 2) throw new Error("Use time ranges like 09:00-12:00.");
    return { startMinute: timeToMinutes(parts[0]), endMinute: timeToMinutes(parts[1]), priority: index + 1 };
  });
}
function timeToMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid time: ${value}. Use HH:MM.`);
  const hours = Number(match[1]); const minutes = Number(match[2]);
  if (hours > 24 || minutes > 59 || (hours === 24 && minutes !== 0)) throw new Error(`Invalid time: ${value}.`);
  return hours * 60 + minutes;
}
