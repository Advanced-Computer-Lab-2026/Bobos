import "@vitejs/plugin-react/preamble";
import React from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import App from "./App.jsx";
import baseStyles from "./style.css?inline";
import workspaceStyles from "./workspace-polish.css?inline";
import formStyles from "./form-controls.css?inline";
import serviceStyles from "./extra-hours-study.css?inline";

import paperStyles from "./components/paper-toss-button.css?inline";
import academicStyles from "./portal-academic.css?inline";
import pickerStyles from "../public/portal-studio/select-picker.css?inline";
import coordinatorStyles from "./coordinator-services.css?inline";
import coordinatorControls from "./coordinator-controls.css?inline";
import statusStyles from "./portal-status.css?inline";
import requestStyles from "./portal-requests.css?inline";
import tabsStyles from "../public/portal-studio/view-tabs.css?inline";

const styles = [tabsStyles, baseStyles, workspaceStyles, formStyles, serviceStyles, paperStyles, academicStyles, pickerStyles, statusStyles, coordinatorStyles, coordinatorControls, requestStyles].join("\n")
  .replaceAll(":root", ".service-surface");

export function mount(host) {
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = styles + `
    .service-surface[data-embedded="true"] {
      background:transparent;
      color: var(--portal-ink);
      font-family: Styrene, system-ui, sans-serif;
      --ink: var(--portal-ink);
      --muted: var(--portal-muted);
      --canvas: var(--portal-canvas);
      --paper: var(--portal-paper);
      --raised: var(--portal-raised);
      --line: var(--portal-line);
      --embedded-ink: var(--portal-ink);
      --embedded-muted: var(--portal-muted);
      --embedded-canvas: var(--portal-canvas);
      --embedded-paper: var(--portal-paper);
      --embedded-raised: var(--portal-raised);
      --embedded-line: var(--portal-line);
    }
    @media (forced-colors: none) {
      [data-service-ink-focus]:focus-visible { outline: none !important; }
    }
  `;
  const surface = document.createElement("div");
  surface.className = "service-surface";
  surface.dataset.embedded = "true";
  // Reuse Portal's existing heading illustrations inside the service shadow root.
  const serviceParams = new URLSearchParams(host.dataset.portalService);
  surface.dataset.portalRole = serviceParams.get("role") || "";
  surface.dataset.service = serviceParams.get("screen") || "";
  const polishedServices = ["advising", "preferences", "graduation-plans", "graduation-review", "my-submitted-plans", "slot-changes", "offerings"];
  surface.classList.toggle("portal-advising-services", polishedServices.includes(serviceParams.get("screen")));
  if (serviceParams.get("section") === "academic-services" || serviceParams.get("screen") === "graduation-plans") {
    const artHost = document.createElement("div");
    artHost.innerHTML = '<div class="page-head"><div></div></div>';
    const artScreen = { directory: "profile", "financial-records": "pending-work", advising: "group-assignments", preferences: "template-detail", "graduation-plans": "templates", "slot-changes": "student-schedules" }[serviceParams.get("screen")] || serviceParams.get("screen");
    window.addStaffArt?.(artScreen, artHost);
    const drawing = artHost.querySelector(".staff-desk-art");
    if (drawing) {
      drawing.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      surface.style.setProperty("--portal-heading-art", `url("data:image/svg+xml,${encodeURIComponent(drawing.outerHTML)}")`);
      surface.dataset.headingArt = "true";
      if (serviceParams.get("screen") === "mandatory-removals") {
        surface.style.setProperty("--portal-heading-art", 'url("/portal-studio/images/course-removal-slip.svg")');
      }
      if (serviceParams.get("screen") === "student-schedules") {
        surface.style.setProperty("--portal-heading-art", 'url("/portal-studio/images/student-schedules-calendar.png")');
      }
    }
  }
  const updateTheme = () => {
    surface.dataset.theme = document.documentElement.dataset.theme;
    surface.style.colorScheme = surface.dataset.theme;
    const theme = getComputedStyle(host);
    for (const name of ["ink", "muted", "canvas", "paper", "raised", "line"]) {
      surface.style.setProperty(`--portal-${name}`, theme.getPropertyValue(`--${name}`));
    }
  };
  updateTheme();
  const observer = new MutationObserver(updateTheme);
  observer.observe(document.documentElement, { attributeFilter: ["data-theme"] });
  host.replaceChildren();
  shadow.append(style, surface);
  const disposeCalendar = window.BobosCalendar?.mount(shadow, { commit: flushSync });
  const disposeInk = window.mountPortalControlInk?.(shadow, { coordinator: surface.dataset.portalRole === "coordinator" });
  const root = createRoot(surface);
  root.render(<App service={host.dataset.portalService} />);
  return () => {
    observer.disconnect();
    disposeInk?.();
    disposeCalendar?.();
    root.unmount();
  };
}
