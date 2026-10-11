const HONORIFICS = new Set([
  "eng",
  "engineer",
  "dr",
  "doctor",
  "prof",
  "professor",
  "mr",
  "mrs",
  "ms",
  "miss",
]);

export function greetingName(fullName) {
  const name = String(fullName || "")
    .trim()
    .replace(/\s*\([^)]*\)\s*$/, "");
  const parts = name.split(/\s+/).filter(Boolean);

  while (parts.length && HONORIFICS.has(parts[0].toLowerCase().replace(/[.,]/g, ""))) {
    parts.shift();
  }

  return parts[0] || "there";
}
