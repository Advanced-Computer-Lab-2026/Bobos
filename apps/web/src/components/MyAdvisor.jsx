import { useState, useEffect } from 'react';

export default function MyAdvisor({ onRoleLoaded }) {
  const [advisor, setAdvisor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/advisor/my-advisor')
      .then(async (res) => {
        const body = await res.json();
        if (res.status === 403) {
          window.location.replace('/');
          return null;
        }
        if (res.status === 404) onRoleLoaded?.('advisingStudent');
        if (!res.ok) throw new Error(body.message || 'Failed to load advisor');
        onRoleLoaded?.('advisingStudent');
        return body;
      })
      .then((body) => { if (body) setAdvisor(body); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [onRoleLoaded]);

  if (loading) return <p style={{ padding: '1.5rem' }}>Loading advisor information…</p>;

  if (error) {
    return <p style={{ padding: '1.5rem', color: '#c0392b' }}>{error}</p>;
  }

  if (!advisor) return null;

  return (
    <div style={{ padding: '1.5rem', maxWidth: '480px', margin: '0 auto' }}>
      <h2 style={{ marginTop: 0 }}>My Assigned Advisor</h2>
      <p style={{ margin: '0.4rem 0' }}>
        <strong>Name:</strong> {advisor.fullName}
      </p>
      <p style={{ margin: '0.4rem 0' }}>
        <strong>GUC Email:</strong>{' '}
        <a href={`mailto:${advisor.email}`} style={{ color: '#177e74' }}>
          {advisor.email}
        </a>
      </p>
    </div>
  );
}
