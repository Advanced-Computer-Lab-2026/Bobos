export default function Button({
  children,
  variant = 'primary',
  size,
  type = 'button',
  loading = false,
  disabled = false,
  className = '',
  ...rest
}) {
  const classes = ['btn'];
  if (variant !== 'primary') classes.push(`btn--${variant}`);
  if (size) classes.push(`btn--${size}`);
  if (className) classes.push(className);

  return (
    <button type={type} className={classes.join(' ')} disabled={disabled || loading} {...rest}>
      {loading ? <span className="spinner" aria-hidden="true" /> : null}
      {loading ? ' ' : null}
      {children}
    </button>
  );
}
