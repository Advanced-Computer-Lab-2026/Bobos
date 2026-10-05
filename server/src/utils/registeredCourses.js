// Requirement 32 - a student's registered courses, per-course credit hours and
// the total. Pure: takes the StudentSchedule `entries` snapshot plus a map of
// course id -> courseType (from the catalogue) and never trusts client input.

function idOf(ref) {
  if (!ref) return null;
  return String(ref._id || ref);
}

export function buildRegisteredCourses(entries = [], courseTypeById = new Map()) {
  const courses = (entries || [])
    .map((e) => {
      const courseId = idOf(e.course);
      return {
        courseId,
        courseCode: e.courseCode,
        courseName: e.courseName,
        creditHours: Number(e.creditHours) || 0,
        courseType: (courseId && courseTypeById.get(courseId)) || null
      };
    })
    .sort((a, b) => String(a.courseCode || '').localeCompare(String(b.courseCode || '')));

  const totalCreditHours = courses.reduce((sum, c) => sum + c.creditHours, 0);
  return { courses, totalCreditHours, courseCount: courses.length };
}
