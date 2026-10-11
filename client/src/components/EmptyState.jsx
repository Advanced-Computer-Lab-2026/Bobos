export default function EmptyState({ title = 'Nothing to show', message, action }) {
  return (
    <div className="state-block">
      <h3>{title}</h3>
      {message ? <p>{message}</p> : null}
      {action || null}
    </div>
  );
}
