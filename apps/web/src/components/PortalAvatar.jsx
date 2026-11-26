import React from "react";

// Same name-derived portrait palette as Portal Studio's avatar(name).
const portraits = ["#d5ab99", "#a1bccd", "#cbbfa5", "#bcbdcf", "#d6bc91", "#aebcae", "#d2beba", "#b3c5bb", "#c4b8ab", "#b8c3d2", "#a4c1b8"];
export default function PortalAvatar({ name = "Student" }) {
  const normalized = String(name || "Student").replace(/^Dr\. /, "");
  const hash = [...normalized].reduce((seed, char) => (seed * 37 + char.charCodeAt(0)) | 0, 0);
  const initials = normalized.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("");
  return <span className="avatar portal-person-avatar" data-portrait={Math.abs(hash) % portraits.length} style={{ backgroundColor: portraits[Math.abs(hash) % portraits.length] }} aria-hidden="true">{initials}</span>;
}
