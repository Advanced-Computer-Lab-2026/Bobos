export default function Alert({ kind = 'info', children, onDismiss }) {
  if (!children) return null;
  return (
    <div className={`alert alert--${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <div className="row-gap" style={{ justifyContent: 'space-between' }}>
        <span>{children}</span>
        {onDismiss ? (
          <button type="button" className="btn btn--ghost btn--sm" onClick={onDismiss}>
            Dismiss
          </button>
        ) : null}
      </div>
    </div>
  );
}
