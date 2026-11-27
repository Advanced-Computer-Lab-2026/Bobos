import "../../public/portal-studio/course-icons.js";
export default function OfferingCourseIcon({ code = "" }) {
  const key = String(code).replace(/\s/g, "").toUpperCase();
  const identity = globalThis.BobosCourseIcons?.[key];
  const symbol = identity?.symbol;
  const tone = identity?.tone || "ivory";
  return <span className="offering-course-emblem" data-tone={tone} aria-hidden="true">{symbol ? <img src={`/portal-studio/images/symbols/${symbol}.svg`} alt="" /> : <svg viewBox="0 0 30 24" fill="none" stroke="currentColor" strokeWidth="1.25"><path d="m9 6 11-.5.6 10.5-11 1z M12 9l5-.4.4 4.4-5 .4z M11 3v3m4-3v3m4-3v2m-8 12v3m4-3v3m4-4v3M6 9h3m-3 4h3m12-5h3m-3 5h3" /></svg>}</span>;
}
