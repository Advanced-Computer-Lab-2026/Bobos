import { ChromeIcon } from "./PortalChrome.jsx";

export function WorkspaceHeader({ title, description, action, meta }) {
  return <header className="workspace-header">
    <div><h1>{title}</h1>{description && <p>{description}</p>}</div>
    {(action || meta) && <div className="workspace-header-actions">{meta}{action}</div>}
  </header>;
}

export function WorkspaceEmpty({ title, description, icon = "inbox", action }) {
  return <div className="workspace-empty">
    <span className="workspace-empty-icon"><ChromeIcon name={icon} /></span>
    <h3>{title}</h3><p>{description}</p>{action}
  </div>;
}

export function displayLabel(value = "") {
  const labels = {
    advising: "Advising student", normal: "Normal student", advisor: "Advisor",
    coordinator: "Coordinator", administrator: "Administrator", notStarted: "Not started",
    readyForStudentReview: "Ready for student review", wholeScheduleSwap: "Schedule swaps",
    slotChange: "Slot changes", mandatoryCourseRemoval: "Course removals", extraHours: "Extra hours",
  };
  return labels[value] || String(value || "—").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}
