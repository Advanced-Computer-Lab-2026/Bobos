// Shared by the staff request list and its requirement 44/45 regression tests.
export function filterSlotChanges(requests, filters) {
  const query = (filters.search || "").trim().toLowerCase();
  return requests.filter(({ student, course, status, createdAt }) => {
    const local = new Date(createdAt);
    const submitted = Number.isNaN(+local) ? "" : new Date(+local - local.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    return (!filters.status || status === filters.status) &&
      (!filters.advisor || (student?.assignedAdvisor?._id || "unassigned") === filters.advisor) &&
      (!filters.course || course?.code === filters.course) &&
      (!filters.from || submitted >= filters.from) && (!filters.to || submitted <= filters.to) &&
      [student?.studentId, student?.user?.fullName, course?.code].some((value) => (value || "").toLowerCase().includes(query));
  });
}
