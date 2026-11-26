import { useEffect, useMemo, useState } from "react";
import { api } from "./api.js";
import {
  OverviewPage,
  ProfilePage,
  NotificationsPage,
  StudentRecordsPage,
  PreferencesPage,
} from "./components/BasicPages.jsx";
import StudentDirectoryPage from "./components/StudentDirectoryPage.jsx";
import FinancialRecordsPage from "./components/FinancialRecordsPage.jsx";
import AdvisingPage, { MyAdvisorPage } from "./components/AdvisingPage.jsx";
import SlotChangesPage from "./components/SlotChangesPage.jsx";
import AcademicWorkspace from "./components/AcademicWorkspace.jsx";
import { GroupAssignmentsPage, StaffSchedulesPage, StudentSchedulingPage } from "./components/SchedulingPages.jsx";
import { CalendarSyncPage, PendingWorkPage, ScheduleActivityPage } from "./components/B1Pages.jsx";
import MandatoryRemovalDashboard from "./components/MandatoryRemovalDashboard.jsx";
import ExtraHoursPage from "./components/ExtraHoursPage.jsx";
import GraduationReview, { StudentGraduation } from "./components/GraduationReview.jsx";

const notify = (tone, text) => document.querySelector("portal-action-feedback")?.show(tone, text);

const navGroups = (role) => {
  const student = ["normalStudent", "advisingStudent"].includes(role);
  const staff = ["advisor", "coordinator", "administrator"].includes(role);
  return [
    { title: "Home", items: [{ id: "overview", label: "Overview" }, { id: "notifications", label: "Notifications" }, ...(role === "coordinator" ? [{ id: "pending-work", label: "Pending work" }] : [])] },
    ...(student ? [{ title: "Student services", items: [
      ...(role === "advisingStudent" ? [{ id: "records", label: "Academic records" }] : []),
      { id: "my-schedule", label: "My schedule" },
      { id: "my-courses", label: "Registered courses" },
      ...(role === "advisingStudent" ? [{ id: "my-graduation", label: "My graduation" }] : []),
      ...(role === "advisingStudent" ? [{ id: "extra-hours", label: "Extra-hours requests" }] : []),
      ...(role === "advisingStudent" ? [{ id: "slot-changes", label: "Slot change requests" }] : []),
      ...(role === "normalStudent" ? [{ id: "schedule-swap", label: "Eligible swap groups" }] : []),
      ...(role === "advisingStudent" ? [{ id: "preferences", label: "Schedule preferences" }] : []),
      ...(role === "advisingStudent" ? [{ id: "my-advisor", label: "My advisor" }] : []),
      { id: "calendar-sync", label: "Calendar sync" },
    ] }] : []),
    ...(staff ? [{ title: "Student services", items: [
      ...(["coordinator", "administrator"].includes(role) ? [
        { id: "directory", label: "Student directory" },
        { id: "financial-records", label: "Financial records" },
      ] : []),
      ...(role === "advisor" || role === "coordinator" ? [{ id: "advising", label: "Advising students" }] : []),
      ...(role === "advisor" || role === "coordinator" ? [{ id: "preferences", label: "Student preferences" }] : []),
      ...(["coordinator", "administrator"].includes(role) ? [{ id: "schedule-activity", label: "Schedule activity" }] : []),
      ...(["coordinator", "administrator", "advisor"].includes(role) ? [{ id: "mandatory-removals", label: "Course removals" }] : []),
      { id: "student-schedules", label: "Student schedules" },
      ...(["advisor", "coordinator"].includes(role) ? [{ id: "graduation-review", label: role === "coordinator" ? "Graduation review" : "My submitted plans" }] : []),
      ...(["advisor", "coordinator"].includes(role) ? [{ id: "extra-hours", label: "Extra-hours requests" }] : []),
      ...(["advisor", "coordinator"].includes(role) ? [{ id: "slot-changes", label: "Slot change requests" }] : []),
    ] }] : []),
    ...(["coordinator", "administrator"].includes(role) ? [{ title: "Academic setup", items: [
      { id: "courses", label: "Course catalogue" },
      { id: "terms", label: "Academic terms" },
      ...(role === "administrator" ? [{ id: "offerings", label: "Course offerings" }] : []),
      ...(role === "coordinator" ? [{ id: "templates", label: "Schedule templates" }] : []),
      { id: "group-assignments", label: "Schedule group assignments" },
    ] }] : []),
  ];
};

const studioPageByScreen = {
  "calendar-sync": "calendar-sync",
  "my-graduation": "graduation-plans",
  "graduation-review": "graduation-plans",
  "graduation-plans": "graduation-plans",
};

function illustratedUrl(screen, role, page = studioPageByScreen[screen] || "overview") {
  const destination = new URL("/portal-studio/index.html", window.location.href);
  const portalPage = screen === "graduation-review" && role === "advisor" ? "my-submitted-plans" : page;
  destination.search = new URLSearchParams({ page: portalPage, role, preview: "live" });
  if (page === "academic-services" && screen !== "overview") destination.searchParams.set("screen", screen);
  if (page === "calendar-sync") {
    const result = new URLSearchParams(window.location.search).get("calendar");
    if (["connected", "error"].includes(result)) destination.searchParams.set("calendar", result);
  }
  return destination;
}

export default function App({ service }) {
  const workspaceParams = new URLSearchParams(service);
  const requestedScreen = workspaceParams.get("screen");
  const embeddedServices = workspaceParams.get("section") === "academic-services";
  const embeddedCalendar = !embeddedServices && requestedScreen === "calendar-sync";
  const embeddedExtraHours = !embeddedServices && requestedScreen === "extra-hours";
  const embeddedGraduation = !embeddedServices && requestedScreen === "graduation-plans";
  const embeddedPage = embeddedServices ? "academic-services" : embeddedGraduation ? "graduation-plans" : embeddedExtraHours ? "extra-hours" : null;
  const [token, setToken] = useState(() => window.localStorage.getItem("bobos.token"));
  const [previewExtraHours] = useState(() =>
    embeddedExtraHours && !token && workspaceParams.get("role") === "advisingStudent"
    && window.localStorage.getItem("portal-studio-preview-session") === "1"
  );
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(Boolean(token));
  const [activeScreen, setActiveScreen] = useState("overview");
  const [embeddedProfileError, setEmbeddedProfileError] = useState("");
  const [screenContext, setScreenContext] = useState(null);
  useEffect(() => {
    if (!token) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    let alive = true;
    setProfileLoading(true);
    api("/api/identity/profile", { token })
      .then((data) => {
        if (!alive) return;
        setProfile(data.profile);
        if (requestedScreen === "profile" || navGroups(data.profile.role).some(group => group.items.some(item => item.id === requestedScreen))) {
          setActiveScreen(requestedScreen);
        }
      })
      .catch((error) => {
        if (!alive) return;
        if (embeddedPage && error.status !== 401) {
          setEmbeddedProfileError("Your workspace couldn’t load. Try refreshing the page.");
          return;
        }
        if (window.localStorage.getItem("bobos.token") === token) {
          window.localStorage.removeItem("bobos.token");
        }
        setToken(null);
        setProfile(null);
        if (error.status !== 401) notify("error", error.message);
      })
      .finally(() => alive && setProfileLoading(false));
    return () => { alive = false; };
  }, [token, embeddedPage, requestedScreen]);

  const groups = useMemo(() => navGroups(profile?.role), [profile?.role]);
  const allNavItems = groups.flatMap((group) => group.items);

  useEffect(() => {
    if (activeScreen === "my-advisor" && profile?.role !== "advisingStudent") setActiveScreen("overview");
  }, [activeScreen, profile?.role]);

  const openScreen = (screen, context = null) => {
    if (profile && ((!embeddedServices && screen === "overview") || Object.hasOwn(studioPageByScreen, screen))) {
      window.localStorage.setItem("portal-studio-preview-session", "1");
      window.top.location.assign(illustratedUrl(screen, profile.role));
      return;
    }
    const destination = new URL(window.location.href);
    if (screen === "overview") destination.searchParams.delete("screen");
    else destination.searchParams.set("screen", screen);
    window.history.replaceState(window.history.state, "", destination);
    setActiveScreen(screen);
    setScreenContext(context);
    window.scrollTo(0, 0);
  };

  if (profileLoading && embeddedExtraHours) return <div className="extra-hours-loading" aria-busy="true"><span className="sr-only">Loading extra-hours requests…</span></div>;
  if (profileLoading) return <div className="app-loading"><span className="loader" />Loading your workspace…</div>;
  if (embeddedPage && embeddedProfileError) {
    return <div className="feedback error" role="alert">{embeddedProfileError}</div>;
  }
  if (previewExtraHours) {
    return <div className="extra-hours-shell extra-hours-embedded">
      <ExtraHoursPage role="advisingStudent" notify={notify} embedded preview />
    </div>;
  }
  if (!token || !profile) {
    const signIn = new URL("/portal-studio/index.html", window.location.href);
    const isSubmittedView = embeddedGraduation && workspaceParams.get("view") === "submitted";
    signIn.search = new URLSearchParams({
      page: "login",
      role: workspaceParams.get("role") || "",
      preview: "live",
      next: isSubmittedView ? "my-submitted-plans" : embeddedPage || "overview",
    });
    if (embeddedServices && requestedScreen) signIn.searchParams.set("screen", requestedScreen);
    return <p className="feedback error">Your session has ended. <a href={signIn.href}>Sign in to Portal</a>.</p>;
  }

  if (embeddedCalendar) {
    if (!["normalStudent", "advisingStudent"].includes(profile.role)) {
      return <p role="alert">Sign in with a Bobos student account to connect Google Calendar.</p>;
    }
    return <div className="extra-hours-embedded"><CalendarSyncPage token={token} /></div>;
  }

  if (embeddedGraduation) {
    const { role } = profile;
    if (!["advisor", "coordinator", "advisingStudent"].includes(role) || workspaceParams.get("role") !== role) {
      return <p className="feedback error" role="alert">Sign in with the matching portal role to view graduation plans.</p>;
    }
    return <div className="extra-hours-shell extra-hours-embedded">
      {role === "advisingStudent" ? <StudentGraduation token={token} />
        : role === "advisor" && workspaceParams.get("view") !== "submitted"
          ? <AdvisingPage token={token} role={role} graduationOnly />
          : <GraduationReview token={token} role={role} />}
    </div>;
  }

  if (embeddedExtraHours) {
    const notifyEmbedded = (tone, text) => {
      const feedback = document.querySelector("portal-action-feedback");
      if (feedback) feedback.show(tone, text);
      else notify(tone, text);
    };
    if (!["advisor", "coordinator", "advisingStudent"].includes(profile.role) || workspaceParams.get("role") !== profile.role) {
      return <div className="feedback error" role="alert">Sign in with the matching portal role to view extra-hours requests.</div>;
    }
    return <div className="extra-hours-shell extra-hours-embedded">
      <ExtraHoursPage token={token} role={profile.role} advisorId={profile._id} notify={notifyEmbedded} embedded />
    </div>;
  }

  const report = notify;

  const workspaceContent = (
    <div className="page-content" id="workspace-content" tabIndex={-1}>
      {activeScreen === "overview" && <OverviewPage token={token} profile={profile} onOpen={openScreen} />}
      {activeScreen === "profile" && <ProfilePage profile={profile} />}
      {activeScreen === "notifications" && <NotificationsPage token={token} notify={report} />}
      {activeScreen === "records" && profile.role !== "normalStudent" && <StudentRecordsPage token={token} profile={profile} notify={report} />}
      {activeScreen === "preferences" && <PreferencesPage token={token} profile={profile} profileId={screenContext?.id || screenContext?._id || profile.studentProfileId} studentTarget={screenContext?._id ? screenContext : undefined} notify={report} onOpenDraftSchedule={(student, selectedTermId) => openScreen("student-schedules", { draftStudent: student, termId: selectedTermId })} />}
      {activeScreen === "directory" && <StudentDirectoryPage token={token} role={profile.role} notify={report} />}
      {activeScreen === "financial-records" && ["coordinator", "administrator"].includes(profile.role) && <FinancialRecordsPage token={token} role={profile.role} notify={report} />}
      {activeScreen === "advising" && <AdvisingPage token={token} role={profile.role} notify={report} onOpenPreferences={(student) => openScreen("preferences", student)} />}
      {activeScreen === "graduation-review" && ["advisor", "coordinator"].includes(profile.role) && <GraduationReview token={token} role={profile.role} />}
      {activeScreen === "my-graduation" && profile.role === "advisingStudent" && <StudentGraduation token={token} />}
      {activeScreen === "my-advisor" && profile.role === "advisingStudent" && <MyAdvisorPage token={token} />}
      {activeScreen === "calendar-sync" && <CalendarSyncPage token={token} />}
      {activeScreen === "pending-work" && profile.role === "coordinator" && <PendingWorkPage token={token} />}
      {activeScreen === "schedule-activity" && ["coordinator", "administrator"].includes(profile.role) && <ScheduleActivityPage token={token} />}
      {activeScreen === "mandatory-removals" && ["coordinator", "administrator", "advisor"].includes(profile.role) && <MandatoryRemovalDashboard token={token} role={profile.role} notify={report} />}
      {activeScreen === "extra-hours" && ["advisingStudent", "coordinator", "advisor"].includes(profile.role) && <ExtraHoursPage token={token} role={profile.role} advisorId={profile._id} notify={report} />}
      {activeScreen === "group-assignments" && <GroupAssignmentsPage token={token} canAssign={profile.role === "coordinator"} notify={report} />}
      {activeScreen === "student-schedules" && <StaffSchedulesPage token={token} role={profile.role} notify={report} initialStudent={screenContext?.draftStudent} initialTermId={screenContext?.termId} />}
      {activeScreen === "slot-changes" && <SlotChangesPage token={token} role={profile.role} onOpenSchedule={() => openScreen("my-schedule")} />}
      {["my-schedule", "my-courses", "schedule-swap"].includes(activeScreen) && <StudentSchedulingPage token={token} section={activeScreen} onOpenSlotChanges={profile.role === "advisingStudent" ? () => openScreen("slot-changes") : undefined} />}
      {["courses", "terms", "offerings", "templates"].includes(activeScreen) && <AcademicWorkspace token={token} role={profile.role} section={activeScreen} onNavigate={openScreen} notify={report} />}
      {!["profile", "overview"].includes(activeScreen) && !allNavItems.some((item) => item.id === activeScreen) && <OverviewPage token={token} profile={profile} onOpen={openScreen} />}
    </div>
  );

  if (embeddedServices) {
    if (workspaceParams.get("role") !== profile.role) {
      return <p className="feedback error" role="alert">Sign in with the matching portal role to view academic services.</p>;
    }
    const showPagePicker = !requestedScreen || requestedScreen === "overview" || requestedScreen === "academic-services";
    return (
      <div className="extra-hours-shell extra-hours-embedded academic-services-embedded">
        {showPagePicker && <label className="field academic-services-picker">
          <span>Academic services page</span>
          <select value={activeScreen} onChange={(event) => openScreen(event.target.value)}>
            {groups.map((group) => (
              <optgroup label={group.title} key={group.title}>
                {group.items.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                {group.title === "Home" && <option value="profile">My profile</option>}
              </optgroup>
            ))}
          </select>
        </label>}
        {workspaceContent}
      </div>
    );
  }

  return <p role="alert">This service is unavailable.</p>;
}
