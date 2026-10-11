import { useState, useEffect } from 'react';

export default function AssignAdvisorModal({ student, onClose, onSuccess }) {
  const [advisors, setAdvisors] = useState([]);
  const [advisorId, setAdvisorId] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    fetch('/api/advisor/advisors')
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.message || 'Failed to load advisors');
        return body;
      })
      .then((data) => {
        setAdvisors(data);
        if (student.assignedAdvisor?._id) {
          setAdvisorId(student.assignedAdvisor._id);
        }
      })
      .catch((err) => setFetchError(err.message));
  }, [student]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!advisorId) return;
    setLoading(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/advisor/students/${student._id}/advisor`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advisorId }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || 'Assignment failed');
      onSuccess();
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isReassign = Boolean(student.assignedAdvisor?._id);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(25, 42, 42, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          padding: '1.5rem',
          borderRadius: '8px',
          minWidth: '380px',
          maxWidth: '480px',
          width: '100%',
          boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ marginTop: 0 }}>
          {isReassign ? 'Reassign Advisor' : 'Assign Advisor'}
        </h3>

        <p style={{ margin: '0 0 0.5rem' }}>
          Student: <strong>{student.user?.fullName ?? student.studentId}</strong>
          {' '}({student.studentId})
        </p>

        {isReassign && (
          <p style={{ margin: '0 0 1rem', color: '#526261', fontSize: '0.875rem' }}>
            Current advisor: {student.assignedAdvisor.fullName}
          </p>
        )}

        {fetchError && (
          <p style={{ color: '#c0392b', margin: '0 0 0.75rem' }}>{fetchError}</p>
        )}

        <form onSubmit={handleSubmit}>
          <label
            htmlFor="advisorSelect"
            style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}
          >
            Select Advisor
          </label>
          <select
            id="advisorSelect"
            value={advisorId}
            onChange={(e) => setAdvisorId(e.target.value)}
            required
            disabled={loading || fetchError !== null}
            style={{
              width: '100%',
              padding: '0.4rem 0.6rem',
              marginBottom: '1rem',
              borderRadius: '4px',
              border: '1px solid #ccc',
            }}
          >
            <option value="">— Choose an advisor —</option>
            {advisors.map((a) => (
              <option key={a._id} value={a._id}>
                {a.fullName} ({a.email})
              </option>
            ))}
          </select>

          {submitError && (
            <p style={{ color: '#c0392b', margin: '0 0 0.75rem' }}>{submitError}</p>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !advisorId}
              style={{
                background: '#177e74',
                color: '#fff',
                border: 'none',
                padding: '0.4rem 1rem',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {loading ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
