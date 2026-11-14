// Reveal the new theme from the existing switcher's center.
export function revealTheme(button, updateTheme) {
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    updateTheme();
    return;
  }

  const { left, top, width, height } = button.getBoundingClientRect();
  const x = left + width / 2;
  const y = top + height / 2;
  const root = document.documentElement;
  const radius = Math.hypot(Math.max(x, root.clientWidth - x), Math.max(y, root.clientHeight - y));

  const transition = document.startViewTransition(updateTheme);
  transition.ready.then(() => {
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 400, easing: 'ease-in-out', fill: 'both', pseudoElement: '::view-transition-new(root)' }
    );
  }).catch(() => transition.skipTransition());
}
