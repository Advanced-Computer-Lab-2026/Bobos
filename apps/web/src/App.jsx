import { useEffect, useMemo, useState } from "react";
import { api, explainApiError } from "./api.js";
import AuthPage from "./components/AuthPage.jsx";
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
import AcademicWorkspace from "./components/AcademicWorkspace.jsx";
import { GroupAssignmentsPage, StaffSchedulesPage, StudentSchedulingPage } from "./components/SchedulingPages.jsx";
import { CalendarSyncPage, PendingWorkPage, ScheduleActivityPage } from "./components/B1Pages.jsx";
import MandatoryRemovalDashboard from "./components/MandatoryRemovalDashboard.jsx";

const roleNames = {
  normalStudent: "Normal student",
  advisingStudent: "Advising student",
  advisor: "Advisor",
  coordinator: "Coordinator",
  administrator: "Administrator",
};

const navGroups = (role) => {
  const student = ["normalStudent", "advisingStudent"].includes(role);
  const staff = ["advisor", "coordinator", "administrator"].includes(role);
  return [
    { title: "Workspace", items: [{ id: "overview", label: "Overview", icon: "⌂" }, { id: "notifications", label: "Notifications", icon: "◌" }] },
    ...(student ? [{ title: "Student services", items: [
      ...(role === "advisingStudent" ? [{ id: "records", label: "Academic records", icon: "▤" }] : []),
      { id: "my-schedule", label: "My schedule", icon: "◷" },
      { id: "my-courses", label: "Registered courses", icon: "▦" },
      ...(role === "normalStudent" ? [{ id: "schedule-swap", label: "Eligible swap groups", icon: "⇄" }] : []),
      ...(role === "advisingStudent" ? [{ id: "preferences", label: "Schedule preferences", icon: "☷" }] : []),
      { id: "my-advisor", label: "My advisor", icon: "♧" },
      { id: "calendar-sync", label: "Calendar sync", icon: "▦" },
    ] }] : []),
    ...(staff ? [{ title: "People", items: [
      ...(["coordinator", "administrator"].includes(role) ? [
        { id: "directory", label: "Student directory", icon: "♙" },
        { id: "financial-records", label: "Financial Records", icon: "💳" },
      ] : []),
      ...(role === "advisor" || role === "coordinator" ? [{ id: "advising", label: "Advising students", icon: "♧" }] : []),
      ...(role === "advisor" || role === "coordinator" ? [{ id: "preferences", label: "Student preferences", icon: "☷" }] : []),
      ...(role === "coordinator" ? [{ id: "pending-work", label: "Pending work", icon: "◷" }] : []),
      ...(["coordinator", "administrator"].includes(role) ? [{ id: "schedule-activity", label: "Schedule activity", icon: "↻" }] : []),
      ...(["coordinator", "administrator", "advisor"].includes(role) ? [{ id: "mandatory-removals", label: "Course removals", icon: "▤" }] : []),
      { id: "student-schedules", label: "Student schedules", icon: "◷" },
    ] }] : []),
    ...(["coordinator", "administrator"].includes(role) ? [{ title: "Academic setup", items: [
      { id: "courses", label: "Course catalogue", icon: "▦" },
      { id: "terms", label: "Academic terms", icon: "◷" },
      ...(role === "administrator" ? [{ id: "offerings", label: "Course offerings", icon: "▤" }] : []),
      ...(role === "coordinator" ? [{ id: "templates", label: "Schedule templates", icon: "▧" }] : []),
      { id: "group-assignments", label: "Schedule group assignments", icon: "⇄" },
    ] }] : []),
  ];
};

const titleByScreen = {
  overview: "Overview", profile: "My profile", notifications: "Notifications",
  records: "Academic records", preferences: "Schedule preferences", directory: "Student directory",
  "financial-records": "Financial Records",
  advising: "Advising students", "my-advisor": "My advisor", courses: "Course catalogue",
  terms: "Academic terms", offerings: "Course offerings", templates: "Schedule templates",
  "my-schedule": "My schedule", "my-courses": "Registered courses", "schedule-swap": "Eligible swap groups",
  "student-schedules": "Student schedules", "group-assignments": "Schedule group assignments",
  "calendar-sync": "Calendar sync", "pending-work": "Pending work", "schedule-activity": "Schedule activity",
  "mandatory-removals": "Mandatory-course removals",
};

export default function App() {
  const [token, setToken] = useState(() => window.localStorage.getItem("bobos.token"));
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(Boolean(token));
  const [activeScreen, setActiveScreen] = useState("overview");
  const [screenContext, setScreenContext] = useState(null);
  const [notice, setNotice] = useState(null);

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
        if (alive) setProfile(data.profile);
      })
      .catch((error) => {
        if (!alive) return;
        window.localStorage.removeItem("bobos.token");
        setToken(null);
        setProfile(null);
        if (error.status !== 401) setNotice({ type: "error", text: error.message });
      })
      .finally(() => alive && setProfileLoading(false));
    return () => { alive = false; };
  }, [token]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeout = window.setTimeout(() => setNotice(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const groups = useMemo(() => navGroups(profile?.role), [profile?.role]);
  const allNavItems = groups.flatMap((group) => group.items);

  const acceptLogin = (newToken) => {
    window.localStorage.setItem("bobos.token", newToken);
    setToken(newToken);
    setActiveScreen("overview");
    setScreenContext(null);
  };

  const signOut = async () => {
    try { await api("/api/identity/logout", { token, method: "POST", body: {} }); } catch { /* Clear the local session even when the API is offline. */ }
    window.localStorage.removeItem("bobos.token");
    setToken(null);
    setProfile(null);
    setActiveScreen("overview");
  };

  const notify = (type, text) => setNotice({ type, text });
  const openScreen = (screen, context = null) => {
    setActiveScreen(screen);
    setScreenContext(context);
  };

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("calendar");
    if (!result) return;
    setActiveScreen("calendar-sync");
    setNotice(result === "connected"
      ? { type: "success", text: "Google Calendar connected." }
      : { type: "error", text: "Google Calendar connection could not be completed." });
    window.history.replaceState({}, "", window.location.pathname);
  }, []);

  if (!token) return <AuthPage onLogin={acceptLogin} />;
  if (profileLoading) return <div className="app-loading"><span className="loader" />Loading your workspace…</div>;
  if (!profile) return <AuthPage onLogin={acceptLogin} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">B</span><span>bobos<span className="brand-dot">.</span><small>UNIVERSITY SCHEDULING</small></span></div>
        <div className="sidebar-label">MENU</div>
        <nav aria-label="Main navigation">
          {groups.map((group) => (
            <div className="nav-group" key={group.title}>
              <p className="nav-group-title">{group.title}</p>
              {group.items.map((item) => (
                <button
                  className={`nav-item ${activeScreen === item.id ? "active" : ""}`}
                  type="button"
                  key={item.id}
                  onClick={() => openScreen(item.id)}
                >
                  <span className="nav-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom"><span className="online-dot" />Academic portal <span className="version">Development</span></div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-separator">/</span><strong>{titleByScreen[activeScreen] || "Overview"}</strong></div>
          <div className="topbar-actions">
            <button className="icon-button" type="button" aria-label="Open notifications" title="Notifications" onClick={() => openScreen("notifications")}>♧</button>
            <span className="topbar-divider" />
            <button className="user-chip" type="button" aria-label="My profile" title="My profile" aria-current={activeScreen === "profile" ? "page" : undefined} onClick={() => openScreen("profile")}>
              <span className="avatar" aria-hidden="true">{(profile.fullName || "U").trim().slice(0, 1).toUpperCase()}</span>
              <span><strong>{profile.fullName}</strong><small>{roleNames[profile.role] || profile.role}</small></span>
            </button>
            <button className="signout-button" type="button" onClick={signOut}>Sign out</button>
          </div>
        </header>

        <div className="page-content">
          {notice && <div className={`toast ${notice.type}`} role={notice.type === "error" ? "alert" : "status"}>{notice.text}<button type="button" aria-label="Dismiss" onClick={() => setNotice(null)}>×</button></div>}
          {activeScreen === "overview" && <OverviewPage profile={profile} onOpen={openScreen} />}
          {activeScreen === "profile" && <ProfilePage profile={profile} />}
          {activeScreen === "notifications" && <NotificationsPage token={token} notify={notify} />}
          {activeScreen === "records" && profile.role !== "normalStudent" && <StudentRecordsPage token={token} profile={profile} notify={notify} />}
          {activeScreen === "preferences" && <PreferencesPage token={token} profile={profile} profileId={screenContext?.id || screenContext?._id || profile.studentProfileId} studentTarget={screenContext?._id ? screenContext : undefined} notify={notify} onOpenDraftSchedule={(student, selectedTermId) => openScreen("student-schedules", { draftStudent: student, termId: selectedTermId })} />}
          {activeScreen === "directory" && <StudentDirectoryPage token={token} role={profile.role} notify={notify} />}
          {activeScreen === "financial-records" && <FinancialRecordsPage token={token} role={profile.role} notify={notify} />}
          {activeScreen === "advising" && <AdvisingPage token={token} role={profile.role} onOpenPreferences={(student) => openScreen("preferences", student)} />}
          {activeScreen === "my-advisor" && <MyAdvisorPage token={token} />}
          {activeScreen === "calendar-sync" && <CalendarSyncPage token={token} />}
          {activeScreen === "pending-work" && profile.role === "coordinator" && <PendingWorkPage token={token} />}
          {activeScreen === "schedule-activity" && ["coordinator", "administrator"].includes(profile.role) && <ScheduleActivityPage token={token} />}
          {activeScreen === "mandatory-removals" && ["coordinator", "administrator", "advisor"].includes(profile.role) && <MandatoryRemovalDashboard token={token} role={profile.role} notify={notify} />}
          {activeScreen === "group-assignments" && <GroupAssignmentsPage token={token} canAssign={profile.role === "coordinator"} notify={notify} />}
          {activeScreen === "student-schedules" && <StaffSchedulesPage token={token} role={profile.role} notify={notify} initialStudent={screenContext?.draftStudent} initialTermId={screenContext?.termId} />}
          {["my-schedule", "my-courses", "schedule-swap"].includes(activeScreen) && <StudentSchedulingPage token={token} section={activeScreen} />}
          {["courses", "terms", "offerings", "templates"].includes(activeScreen) && <AcademicWorkspace token={token} role={profile.role} section={activeScreen} onNavigate={openScreen} notify={notify} />}
          {activeScreen !== "profile" && !allNavItems.some((item) => item.id === activeScreen) && <OverviewPage profile={profile} onOpen={openScreen} />}
        </div>
      </main>
    </div>
  );
}
