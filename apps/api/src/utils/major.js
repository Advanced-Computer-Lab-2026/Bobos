const MAJOR_ALIASES = new Map([
  ["cs", "cs"],
  ["csen", "cs"],
  ["computerscience", "cs"],
  ["dmet", "dmet"],
  ["dme", "dmet"],
  ["digitalmediaengineering", "dmet"],
]);

export function canonicalMajor(value) {
  const key = String(value ?? "").normalize("NFKC").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  return MAJOR_ALIASES.get(key) || key;
}

export function majorMatches(left, right) {
  return canonicalMajor(left) === canonicalMajor(right);
}
