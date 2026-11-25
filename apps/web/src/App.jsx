import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api.js";
import { ChromeIcon, ThemeControl, Wordmark } from "./components/PortalChrome.jsx";
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
import SlotChangesPage from "./components/SlotChangesPage.jsx";
import AcademicWorkspace from "./components/AcademicWorkspace.jsx";
import { GroupAssignmentsPage, StaffSchedulesPage, StudentSchedulingPage } from "./components/SchedulingPages.jsx";
import { CalendarSyncPage, PendingWorkPage, ScheduleActivityPage } from "./components/B1Pages.jsx";
import MandatoryRemovalDashboard from "./components/MandatoryRemovalDashboard.jsx";
import ExtraHoursPage from "./components/ExtraHoursPage.jsx";
import GraduationReview, { StudentGraduation } from "./components/GraduationReview.jsx";

const roleNames = {
  normalStudent: "Normal student",
  advisingStudent: "Advising student",
  advisor: "Advisor",
  coordinator: "Coordinator",
  administrator: "Administrator",
};

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

const titleByScreen = {
  overview: "Overview", profile: "My profile", notifications: "Notifications",
  records: "Academic records", preferences: "Schedule preferences", directory: "Student directory",
  "financial-records": "Financial records",
  advising: "Advising students", "my-advisor": "My advisor", courses: "Course catalogue",
  terms: "Academic terms", offerings: "Course offerings", templates: "Schedule templates",
  "my-schedule": "My schedule", "my-courses": "Registered courses", "schedule-swap": "Eligible swap groups",
  "slot-changes": "Slot change requests",
  "student-schedules": "Student schedules", "group-assignments": "Schedule group assignments",
  "calendar-sync": "Calendar sync", "pending-work": "Pending work", "schedule-activity": "Schedule activity",
  "mandatory-removals": "Mandatory-course removals",
  "extra-hours": "Extra-hours requests",
  "my-graduation": "My graduation", "graduation-review": "Graduation plans",
};

function openIllustratedHome(role) {
  const home = new URL("./portal-studio/index.html", window.location.href);
  home.search = new URLSearchParams({ page: "overview", role, preview: "live" });
  window.localStorage.setItem("portal-studio-preview-session", "1");
  window.location.assign(home);
}

export default function App() {
  const workspaceParams = new URLSearchParams(window.location.search);
  const embeddedCalendar = window.parent !== window && workspaceParams.get("embedded") === "1" && workspaceParams.get("screen") === "calendar-sync";
  const embeddedExtraHours = window.parent !== window && workspaceParams.get("embedded") === "1" && workspaceParams.get("screen") === "extra-hours";
  const [token, setToken] = useState(() => window.localStorage.getItem("bobos.token"));
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(Boolean(token));
  useEffect(() => {
    if (!embeddedExtraHours) return;
    const frame = window.frameElement;
    const hide = () => frame?.classList.remove("is-ready");
    window.addEventListener("pagehide", hide);
    let first, second;
    if (profile && !profileLoading) {
      first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => frame?.classList.add("is-ready"));
      });
    } else hide();
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
      window.removeEventListener("pagehide", hide);
    };
  }, [embeddedExtraHours, profile, profileLoading]);
  const [activeScreen, setActiveScreen] = useState(() => workspaceParams.get("page") === "calendar-sync" ? "calendar-sync" : "overview");
  const [screenContext, setScreenContext] = useState(null);
  const [navQuery, setNavQuery] = useState("");
  const navigation = useRef(null);
  const account = useRef(null);
  const freshLogin = useRef(false);

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
        const requestedScreen = new URLSearchParams(window.location.search).get("screen");
        if (new URLSearchParams(window.location.search).get("page") === "calendar-sync" && ["normalStudent", "advisingStudent"].includes(data.profile.role)) {
          const destination = new URL("./portal-studio/index.html", window.location.href);
          destination.search = new URLSearchParams({ page: "calendar-sync", role: data.profile.role, preview: "live" });
          window.localStorage.setItem("portal-studio-preview-session", "1");
          window.location.replace(destination);
          return;
        }
        if (freshLogin.current) {
          freshLogin.current = false;
          if (!embeddedExtraHours && !embeddedCalendar && new URLSearchParams(window.location.search).get("page") !== "calendar-sync" && (import.meta.env.DEV || requestedScreen === "extra-hours")) {
            openIllustratedHome(data.profile.role);
            return;
          }
        }
        setProfile(data.profile);
        if (requestedScreen === "extra-hours" && ["advisor", "coordinator", "advisingStudent"].includes(data.profile.role)) {
          setActiveScreen(requestedScreen);
        }
      })
      .catch((error) => {
        if (!alive) return;
        window.localStorage.removeItem("bobos.token");
        setToken(null);
        setProfile(null);
        if (error.status !== 401) notify("error", error.message);
      })
      .finally(() => alive && setProfileLoading(false));
    return () => { alive = false; };
  }, [token, embeddedExtraHours, embeddedCalendar]);

  const groups = useMemo(() => navGroups(profile?.role), [profile?.role]);
  const allNavItems = groups.flatMap((group) => group.items);

  useEffect(() => {
    if (activeScreen === "my-advisor" && profile?.role !== "advisingStudent") setActiveScreen("overview");
  }, [activeScreen, profile?.role]);

  const acceptLogin = (newToken) => {
    document.querySelector("portal-action-feedback")?.clear();
    freshLogin.current = true;
    window.localStorage.setItem("bobos.token", newToken);
    setToken(newToken);
    setActiveScreen(workspaceParams.get("page") === "calendar-sync" ? "calendar-sync" : "overview");
    setScreenContext(null);
  };

  const signOut = async () => {
    try { await api("/api/identity/logout", { token, method: "POST", body: {} }); } catch { /* Clear the local session even when the API is offline. */ }
    window.localStorage.removeItem("bobos.token");
    window.localStorage.removeItem("portal-studio-preview-session");
    setToken(null);
    setProfile(null);
    setActiveScreen("overview");
    document.querySelector("portal-action-feedback")?.clear();
  };

  const openScreen = (screen, context = null) => {
    if (screen === "overview" && profile && (
      new URLSearchParams(window.location.search).get("screen") === "extra-hours"
      || window.localStorage.getItem("portal-studio-preview-session") === "1"
    )) {
      openIllustratedHome(profile.role);
      return;
    }
    setActiveScreen(screen);
    setScreenContext(context);
    navigation.current?.close();
    if (account.current) account.current.open = false;
    window.scrollTo(0, 0);
  };

  const openNavigation = () => {
    setNavQuery("");
    navigation.current?.showModal();
  };

  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("calendar");
    if (!["connected", "error"].includes(result)) return;
    setActiveScreen("calendar-sync");
    if (result === "connected") notify("success", "Google Calendar connected.");
    else notify("error", "Google Calendar connection could not be completed.");
    window.history.replaceState({}, "", window.location.pathname + "?page=calendar-sync");
  }, []);

  if (embeddedExtraHours && !profileLoading && (!token || !profile)) {
    const destination = new URL("./portal-studio/index.html", window.location.href);
    destination.search = new URLSearchParams({page:"login", next:"extra-hours", role:workspaceParams.get("role") || "advisingStudent", preview:"live"});
    window.top.location.replace(destination);
    return <p role="status">Opening Portal sign-in…</p>;
  }
  if (!token) return <AuthPage onLogin={acceptLogin} />;
  if (profileLoading && embeddedExtraHours) return <div className="extra-hours-loading" aria-busy="true"><span className="sr-only">Loading extra-hours requests…</span></div>;
  if (profileLoading) return <div className="app-loading"><span className="loader" />Loading your workspace…</div>;
  if (!profile) return <AuthPage onLogin={acceptLogin} />;

  if (embeddedCalendar) {
    if (!["normalStudent", "advisingStudent"].includes(profile.role)) {
      return <p role="alert">Sign in with a Bobos student account to connect Google Calendar.</p>;
    }
    return <div className="extra-hours-embedded"><CalendarSyncPage token={token} /></div>;
  }

  if (embeddedExtraHours) {
    const notifyEmbedded = (tone, text) => {
      const feedback = window.parent.document.querySelector("portal-action-feedback");
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

  const isExtraHours = activeScreen === "extra-hours";
  const renderNavigation = (search = "", collapsible = false) => {
    const query = search.trim().toLowerCase();
    const matchingGroups = groups.map(({ title, items }) => ({
      title,
      items: items.filter((item) => item.label.toLowerCase().includes(query)),
    })).filter((group) => group.items.length);
    return matchingGroups.length ? matchingGroups.map(({ title, items }) => {
      const links = items.map((item) => (
          <button
            className={`nav-item ${activeScreen === item.id ? "active" : ""}`}
            aria-current={activeScreen === item.id ? "page" : undefined}
            type="button"
            key={item.id}
            onClick={() => openScreen(item.id)}
          >
            {isExtraHours && item.id === "overview" && <ChromeIcon name="home" />}
            {item.label}
          </button>
      ));
      return collapsible ? (
        <details className="nav-group" key={title} open>
          <summary className="nav-group-title">{title}<ChromeIcon name="chevron" /></summary>
          {links}
        </details>
      ) : (
        <div className="nav-group" key={title}>
          <p className="nav-group-title">{title}</p>
          {links}
        </div>
      );
    }) : <p className="page-description">No pages match your search.</p>;
  };

  return (
    <div className={isExtraHours ? "app-shell extra-hours-shell" : "app-shell"}>
      <a className="portal-skip-link" href="#workspace-content">Skip to content</a>
      <aside className="sidebar">
        <button className="portal-home" type="button" onClick={() => openScreen("overview")}><Wordmark /></button>
        {!isExtraHours && <p className="portal-scope">Academic workspace</p>}
        <button className="portal-find outline-button" type="button" onClick={openNavigation}><ChromeIcon name="search" /> Find a page</button>
        <nav aria-label="Main navigation">{renderNavigation("", isExtraHours)}</nav>
        {isExtraHours && <p className="extra-hours-sidebar-footer">German University in Cairo</p>}
      </aside>

      <dialog ref={navigation} className="portal-navigation" aria-labelledby="portal-navigation-heading">
        <header>
          <h2 id="portal-navigation-heading">Navigation</h2>
          <button type="button" className="outline-button" onClick={() => navigation.current.close()}>Close</button>
        </header>
        <label className="field"><span>Find a page</span><input type="search" value={navQuery} onChange={(event) => setNavQuery(event.target.value)} /></label>
        <nav aria-label="Pages">{renderNavigation(navQuery)}</nav>
      </dialog>

      <main className="main-area">
        <header className="topbar">
          <button className="portal-home portal-mobile-brand" type="button" onClick={() => openScreen("overview")}><Wordmark /></button>
          <div className="portal-screen-title">
            {isExtraHours && <span className="extra-hours-crumb">Academic workspace <span aria-hidden="true">/</span></span>}
            <strong>{titleByScreen[activeScreen] || "Overview"}</strong>
          </div>
          <div className="topbar-actions">
            <button className="icon-button portal-menu-button" type="button" aria-label="Open navigation" onClick={openNavigation}><ChromeIcon name="menu" /></button>
            <ThemeControl />
            <button className="icon-button portal-notifications" type="button" aria-label="Open notifications" title="Notifications" onClick={() => openScreen("notifications")}><ChromeIcon name="bell" /></button>
            <details className="portal-account" ref={account} onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.currentTarget.open = false;
                event.currentTarget.querySelector("summary").focus();
              }
            }}>
              <summary className="user-chip" aria-label="Account options">
                <span className="avatar" aria-hidden="true">{(profile.fullName?.trim() || "U").split(/\s+/).slice(0, isExtraHours ? 2 : 1).map((name) => name[0]).join("").toUpperCase()}</span>
                <strong>{profile.fullName}</strong>
              </summary>
              <div className="portal-account-menu">
                <strong>{profile.fullName}</strong>
                <small>{roleNames[profile.role] || profile.role}</small>
                <button className="nav-item" type="button" onClick={() => openScreen("profile")}>My profile</button>
                <button className="nav-item" type="button" onClick={signOut}>Sign out</button>
              </div>
            </details>
          </div>
        </header>

        <div className="page-content" id="workspace-content" tabIndex={-1}>
          {activeScreen === "overview" && <OverviewPage token={token} profile={profile} onOpen={openScreen} />}
          {activeScreen === "profile" && <ProfilePage profile={profile} />}
          {activeScreen === "notifications" && <NotificationsPage token={token} notify={notify} />}
          {activeScreen === "records" && profile.role !== "normalStudent" && <StudentRecordsPage token={token} profile={profile} notify={notify} />}
          {activeScreen === "preferences" && <PreferencesPage token={token} profile={profile} profileId={screenContext?.id || screenContext?._id || profile.studentProfileId} studentTarget={screenContext?._id ? screenContext : undefined} notify={notify} onOpenDraftSchedule={(student, selectedTermId) => openScreen("student-schedules", { draftStudent: student, termId: selectedTermId })} />}
          {activeScreen === "directory" && <StudentDirectoryPage token={token} role={profile.role} notify={notify} />}
          {activeScreen === "financial-records" && <FinancialRecordsPage token={token} role={profile.role} notify={notify} />}
          {activeScreen === "advising" && <AdvisingPage token={token} role={profile.role} notify={notify} onOpenPreferences={(student) => openScreen("preferences", student)} />}
          {activeScreen === "graduation-review" && ["advisor", "coordinator"].includes(profile.role) && <GraduationReview token={token} role={profile.role} />}
          {activeScreen === "my-graduation" && profile.role === "advisingStudent" && <StudentGraduation token={token} />}
          {activeScreen === "my-advisor" && profile.role === "advisingStudent" && <MyAdvisorPage token={token} />}
          {activeScreen === "calendar-sync" && <CalendarSyncPage token={token} />}
          {activeScreen === "pending-work" && profile.role === "coordinator" && <PendingWorkPage token={token} />}
          {activeScreen === "schedule-activity" && ["coordinator", "administrator"].includes(profile.role) && <ScheduleActivityPage token={token} />}
          {activeScreen === "mandatory-removals" && ["coordinator", "administrator", "advisor"].includes(profile.role) && <MandatoryRemovalDashboard token={token} role={profile.role} notify={notify} />}
          {activeScreen === "extra-hours" && ["advisingStudent", "coordinator", "advisor"].includes(profile.role) && <ExtraHoursPage token={token} role={profile.role} advisorId={profile._id} notify={notify} />}
          {activeScreen === "group-assignments" && <GroupAssignmentsPage token={token} canAssign={profile.role === "coordinator"} notify={notify} />}
          {activeScreen === "student-schedules" && <StaffSchedulesPage token={token} role={profile.role} notify={notify} initialStudent={screenContext?.draftStudent} initialTermId={screenContext?.termId} />}
          {activeScreen === "slot-changes" && <SlotChangesPage token={token} role={profile.role} onOpenSchedule={() => openScreen("my-schedule")} />}
          {["my-schedule", "my-courses", "schedule-swap"].includes(activeScreen) && <StudentSchedulingPage token={token} section={activeScreen} onOpenSlotChanges={profile.role === "advisingStudent" ? () => openScreen("slot-changes") : undefined} />}
          {["courses", "terms", "offerings", "templates"].includes(activeScreen) && <AcademicWorkspace token={token} role={profile.role} section={activeScreen} onNavigate={openScreen} notify={notify} />}
          {!["profile", "overview"].includes(activeScreen) && !allNavItems.some((item) => item.id === activeScreen) && <OverviewPage token={token} profile={profile} onOpen={openScreen} />}
        </div>
      </main>
    </div>
  );
}
