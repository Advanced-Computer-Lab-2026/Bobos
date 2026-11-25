
export default function PaperTossButton({ children, disabled, onClick, tossing = false, label, width }) {
  return (
    <button type="button" className="paper-toss-button" disabled={disabled} aria-label={label}
      style={width ? { width } : undefined}
      onClick={onClick} data-tossing={tossing || undefined}>
      <span className="paper-toss-icon" aria-hidden="true">
        <svg className="paper-toss-sheet" viewBox="0 0 20 22" aria-hidden="true">
          <path d="M3 1.5h8.9l4.9 5V20H3zM11.9 1.5v5h4.9M5.8 10h8M5.8 13h8M5.8 16h5.6" />
        </svg>
        <svg className="paper-toss-bin" viewBox="0 0 18 20" aria-hidden="true">
          <path className="paper-toss-lid" d="M3 5.4h12M6.6 3.2h4.8" />
          <path d="M4.6 7 5.3 17.4h7.4L13.4 7M7.3 9v5.5M10.8 9v5.5" />
        </svg>
      </span>
      {children}
    </button>
  );
}

export function waitForPaperToss() {
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return new Promise((resolve) => window.setTimeout(resolve, 580));
  }
}
