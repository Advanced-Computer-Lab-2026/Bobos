import "@vitejs/plugin-react/preamble";
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import baseStyles from "./style.css?inline";
import workspaceStyles from "./workspace-polish.css?inline";
import formStyles from "./form-controls.css?inline";
import serviceStyles from "./extra-hours-study.css?inline";

import paperStyles from "./components/paper-toss-button.css?inline";

const styles = [baseStyles, workspaceStyles, formStyles, serviceStyles, paperStyles].join("\n")
  .replaceAll(":root", ".service-surface");

export function mount(host) {
  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = styles + `
    .service-surface[data-embedded="true"] {
      background:transparent;
      font-family:inherit;
      --embedded-ink: var(--portal-ink);
      --embedded-muted: var(--portal-muted);
      --embedded-canvas: var(--portal-canvas);
      --embedded-paper: var(--portal-paper);
      --embedded-raised: var(--portal-raised);
      --embedded-line: var(--portal-line);
    }
  `;
  const surface = document.createElement("div");
  surface.className = "service-surface";
  surface.dataset.embedded = "true";
  const updateTheme = () => {
    surface.dataset.theme = document.documentElement.dataset.theme;
    const theme = getComputedStyle(host);
    for (const name of ["ink", "muted", "canvas", "paper", "raised", "line"]) {
      surface.style.setProperty(`--portal-${name}`, theme.getPropertyValue(`--${name}`));
    }
  };
  updateTheme();
  const observer = new MutationObserver(updateTheme);
  observer.observe(document.documentElement, { attributeFilter: ["data-theme"] });
  const tabs = document.createElement("link");
  tabs.rel = "stylesheet";
  tabs.href = "/portal-studio/view-tabs.css";
  host.replaceChildren();
  shadow.append(tabs, style, surface);
  const root = createRoot(surface);
  root.render(<App service={host.dataset.portalService} />);
  return () => {
    observer.disconnect();
    root.unmount();
  };
}
