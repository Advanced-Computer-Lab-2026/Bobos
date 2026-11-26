export default function OfferingCourseIcon({ code = "" }) {
  const key = code.replace(/\s/g, "");
  const symbol = { CSEN502: "algorithms", CSEN503: "algorithms", DMET501: "graphics", DMET502: "graphics", CSEN703: "algorithms", CSEN704: "advanced-lab", DMET701: "graphics" }[key];
  const tone = { CSEN502: "coral", CSEN503: "blue", DMET501: "sage", DMET502: "ivory", CSEN701: "blue", CSEN703: "coral", CSEN704: "sage", DMET701: "ivory" }[key] || "ivory";
  return <span className="offering-course-emblem" data-tone={tone} aria-hidden="true">{symbol ? <img src={`/portal-studio/images/symbols/${symbol}.svg`} alt="" /> : <svg viewBox="0 0 30 24" fill="none" stroke="currentColor" strokeWidth="1.25"><path d="m9 6 11-.5.6 10.5-11 1z M12 9l5-.4.4 4.4-5 .4z M11 3v3m4-3v3m4-3v2m-8 12v3m4-3v3m4-4v3M6 9h3m-3 4h3m12-5h3m-3 5h3" /></svg>}</span>;
}
