const MAJOR_ALIASES = new Map([
  ["cs", "cs"],
  ["csen", "cs"],
  ["computerscience", "cs"],
  ["dmet", "dmet"],
  ["dme", "dmet"],
  ["digitalmediaengineering", "dmet"],
  ["digitalmediaengineeringtechnology", "dmet"],
  ["digitalmediaengineeringandtechnology", "dmet"],
]);

export function canonicalMajor(value) {
  const key = String(value ?? "").normalize("NFKC").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return MAJOR_ALIASES.get(key) || key;
}

export function majorLabel(value) {
  const canonical = canonicalMajor(value);
  if (canonical === "cs") return "CS";
  if (canonical === "dmet") return "DMET";
  return String(value ?? "").trim();
}

export function majorMatches(left, right) {
  return canonicalMajor(left) === canonicalMajor(right);
}
