export function termLabel(term) {
  if (!term || typeof term !== "object") return "Academic term";
  const season = String(term.season || "").replace(/([a-z])([A-Z])/g, "$1 $2");
  return [season ? season[0].toUpperCase() + season.slice(1) : "", term.academicYear].filter(Boolean).join(" ") || "Academic term";
}
