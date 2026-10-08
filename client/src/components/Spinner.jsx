export default function Spinner({ label = 'Loading...', large = false }) {
  return (
    <div className="state-block">
      <span className={large ? 'spinner spinner--lg' : 'spinner'} aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}
