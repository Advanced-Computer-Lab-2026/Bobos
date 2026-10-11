// Requirement 31 - who may see which student's schedule. ONE place for the
// visibility rules so reqs 32/33/49 apply the same matrix.
//
//   student      - own record only (Student.user === viewer.id), else 403.
//                  normal   -> 'processed' only
//                  advising -> 'ready_for_student_review' or 'processed';
//                              a 'draft' is hidden (404, never revealed)
//   advisor      - ADVISING students only (any status); normal students -> 403
//   coordinator  - any student, any status
//   administrator- any student, any status, read-only
//
// Returns { status: 200, readOnly } when the schedule may be shown, or
// { status: 403 | 404, message } otherwise.

export const NO_VISIBLE_SCHEDULE = 'No schedule is available to view yet.';

const STUDENT_VISIBLE = {
  normal: ['processed'],
  advising: ['ready_for_student_review', 'processed']
};

const ALL_STATUSES = ['draft', 'ready_for_student_review', 'processed'];

function idOf(ref) {
  if (!ref) return null;
  return String(ref._id || ref);
}

// Which statuses `viewer` may see for `student`, or a 403 error.
export function visibleStatusesFor(viewer, student) {
  if (!viewer || !student) return { error: { status: 403, message: 'Forbidden' } };

  switch (viewer.role) {
    case 'student':
      if (idOf(student.user) !== String(viewer.id)) {
        return { error: { status: 403, message: 'Students may only view their own schedule.' } };
      }
      return { statuses: STUDENT_VISIBLE[student.studentType] || [], readOnly: false };
    case 'advisor':
      if (student.studentType !== 'advising') {
        return {
          error: {
            status: 403,
            message: "Advisors may only view advising students' schedules. Normal students' schedules are managed by the Coordinator."
          }
        };
      }
      return { statuses: ALL_STATUSES, readOnly: false };
    case 'coordinator':
      return { statuses: ALL_STATUSES, readOnly: false };
    case 'administrator':
      return { statuses: ALL_STATUSES, readOnly: true };
    default:
      return { error: { status: 403, message: 'Forbidden' } };
  }
}

export function checkScheduleAccess(viewer, student, schedule) {
  const access = visibleStatusesFor(viewer, student);
  if (access.error) return access.error;
  if (!schedule || !access.statuses.includes(schedule.status)) {
    return { status: 404, message: NO_VISIBLE_SCHEDULE };
  }
  return { status: 200, readOnly: access.readOnly };
}
