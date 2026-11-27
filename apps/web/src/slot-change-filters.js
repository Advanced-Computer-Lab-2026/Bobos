export const slotSubmissionTimeZone = "Africa/Cairo";
const cairoDay = new Intl.DateTimeFormat("sv-SE", {
  timeZone: slotSubmissionTimeZone, year: "numeric", month: "2-digit", day: "2-digit",
});

export function slotSubmissionDay(value, coordinator = false) {
  const date = new Date(value);
  if (!value || Number.isNaN(+date)) return "";
  return coordinator ? cairoDay.format(date) : new Date(+date - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// Shared by the staff request list and its requirement 44/45 regression tests.
export function filterSlotChanges(requests, filters, coordinator = false) {
  const query = (filters.search || "").trim().toLowerCase();
  return requests.filter(({ student, course, status, createdAt }) => {
    const submitted = slotSubmissionDay(createdAt, coordinator);
    return (!filters.status || status === filters.status) &&
      (!filters.advisor || (student?.assignedAdvisor?._id || "unassigned") === filters.advisor) &&
      (!filters.course || course?.code === filters.course) &&
      (!filters.from || submitted >= filters.from) && (!filters.to || submitted <= filters.to) &&
      [student?.studentId, student?.user?.fullName, course?.code].some((value) => (value || "").toLowerCase().includes(query));
  });
}
