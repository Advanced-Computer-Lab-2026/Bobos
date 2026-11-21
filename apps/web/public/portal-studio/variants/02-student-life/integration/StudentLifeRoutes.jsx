/**
 * Copy to apps/web/src/components/StudentLifeRoutes.jsx.
 * Authenticated route adapter, NOT the synthetic studio implementation.
 * Reuses the supplied API-backed components and their validation/feedback.
 * No authentication, API wrapper, navigation shell, or data fixture is replaced.
 */
import { StudentRecordsPage, PreferencesPage } from "./BasicPages.jsx";
import { MyAdvisorPage } from "./AdvisingPage.jsx";
import { CalendarSyncPage } from "./B1Pages.jsx";
import { StudentSchedulingPage, StaffSchedulesPage } from "./SchedulingPages.jsx";

export const STUDENT_LIFE_ROUTES = Object.freeze([
  "my-schedule", "my-courses", "schedule-swap", "preferences",
  "records", "my-advisor", "calendar-sync",
]);

export const STUDENT_LIFE_PERMISSIONS = Object.freeze({
  "my-schedule": ["normalStudent", "advisingStudent", "advisor", "coordinator", "administrator"],
  "my-courses": ["normalStudent", "advisingStudent"],
  "schedule-swap": ["normalStudent"],
  preferences: ["advisingStudent", "advisor", "coordinator"],
  records: ["advisingStudent", "advisor", "coordinator"],
  "my-advisor": ["advisingStudent"],
  "calendar-sync": ["normalStudent", "advisingStudent"],
});

export function canOpenStudentLifeRoute(pageKey, role) {
  return STUDENT_LIFE_PERMISSIONS[pageKey]?.includes(role) ?? false;
}

/**
 * @param {{ pageKey: string, token: string, profile: object,
 * context?: object|null, notify: Function, onOpen: Function }} props
 * `context` is the existing App.jsx screenContext (or a selected student record).
 * Staff records always require an explicit student-profile ID; student routes
 * never accept a context ID in place of the signed-in student's own ID.
 * The API remains the authorization authority. These gates only shape the UI.
 */
export default function StudentLifeRoute({ pageKey, token, profile, context = null, notify, onOpen }) {
  if (!STUDENT_LIFE_ROUTES.includes(pageKey)) return null;
  if (!token || !profile) return <section className="feedback" role="status">Sign in to open student services.</section>;
  if (!canOpenStudentLifeRoute(pageKey, profile.role)) {
    return <section className="empty-state"><h1>Page unavailable</h1><p>This service is not available for your role.</p><button className="outline-button" type="button" onClick={() => onOpen("overview")}>Back to Overview</button></section>;
  }
  const isStudent = ["normalStudent", "advisingStudent"].includes(profile.role);
  const selectedId = context?.studentProfileId || context?.id || context?._id;
  const key = `${pageKey}:${profile.role}:${isStudent ? profile.studentProfileId || "self" : selectedId || "choose"}`;
  if (pageKey === "my-schedule" && !isStudent) {
    return <StaffSchedulesPage key={key} token={token} role={profile.role} notify={notify} initialStudent={context?.draftStudent} initialTermId={context?.termId} />;
  }
  if (["my-schedule", "my-courses", "schedule-swap"].includes(pageKey)) {
    return <StudentSchedulingPage key={key} token={token} section={pageKey} onOpenSlotChanges={profile.role === "advisingStudent" ? () => onOpen("slot-changes") : undefined} />;
  }
  if (pageKey === "records") {
    if (!isStudent && !selectedId) {
      return <section className="empty-state"><h1>Select an advising student</h1><p>Academic records require an explicit student selection. No record is inferred from a staff account.</p><button className="outline-button" type="button" onClick={() => onOpen("advising")}>Open advising students</button></section>;
    }
    return <StudentRecordsPage key={key} token={token} profile={profile} profileId={isStudent ? profile.studentProfileId : selectedId} viewerRole={profile.role} subjectName={isStudent ? undefined : context?.fullName || context?.name} onClose={isStudent ? undefined : () => onOpen("advising")} notify={notify} />;
  }
  if (pageKey === "preferences") {
    return <PreferencesPage key={key} token={token} profile={profile} profileId={isStudent ? profile.studentProfileId : selectedId} studentTarget={!isStudent && context?._id ? context : undefined} notify={notify} onOpenDraftSchedule={(student, termId) => onOpen("student-schedules", { draftStudent: student, termId })} />;
  }
  if (pageKey === "my-advisor") return <MyAdvisorPage key={key} token={token} />;
  if (pageKey === "calendar-sync") return <CalendarSyncPage key={key} token={token} />;
  return null;
}
