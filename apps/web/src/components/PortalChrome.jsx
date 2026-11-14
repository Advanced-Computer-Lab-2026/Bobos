import { useState } from "react";
import { flushSync } from "react-dom";
import { revealTheme } from "../theme-reveal.js";

export function Wordmark() {
  return <span className="portal-wordmark">Portal</span>;
}

const iconPaths = {
  sun: "M12 3v2m0 14v2M3 12h2m14 0h2M6 6l1.5 1.5m9 9L18 18M6 18l1.5-1.5m9-9L18 6 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  moon: "M20 15a8 8 0 0 1-11-11 8.5 8.5 0 1 0 11 11Z",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-2 7-2 9h16c0-2-2-2-2-9m-8 12a2 2 0 0 0 4 0",
  menu: "M4 6h16M4 12h16M4 18h16",
  search: "M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0Zm-2 4 5 5",
};

export function ChromeIcon({ name }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={iconPaths[name]} /></svg>;
}

export function ThemeControl() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || "light");
  const toggle = (event) => {
    revealTheme(event.currentTarget, () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("portal.theme", next); } catch { /* The theme still works without storage. */ }
      flushSync(() => setTheme(next));
    });
  };
  return <button className="portal-theme" type="button" onClick={toggle} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}>
    <span data-selected={theme === "light"}><ChromeIcon name="sun" /></span>
    <span data-selected={theme === "dark"}><ChromeIcon name="moon" /></span>
  </button>;
}
