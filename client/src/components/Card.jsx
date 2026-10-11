export default function Card({ title, subtitle, actions, children, flat = false }) {
  return (
    <section className={flat ? 'card card--flat' : 'card'}>
      {(title || actions) && (
        <header className="card__title">
          <div>
            {title ? <h2>{title}</h2> : null}
            {subtitle ? <p className="muted" style={{ margin: 0, fontSize: '0.875rem' }}>{subtitle}</p> : null}
          </div>
          {actions ? <div className="btn-row">{actions}</div> : null}
        </header>
      )}
      {children}
    </section>
  );
}
