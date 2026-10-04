import { useState, useEffect, useCallback } from 'react';
import AssignAdvisorModal from './AssignAdvisorModal.jsx';

const cellStyle = { padding: '0.5rem', border: '1px solid #ccc' };
const headStyle = { ...cellStyle, background: '#e8eded', textAlign: 'left' };

const Field = ({ label, value }) => (
  <p style={{ margin: '0.25rem 0' }}>
    <strong>{label}:</strong>{' '}
    <span style={{ color: value ? '#192a2a' : '#526261' }}>{value ?? '—'}</span>
  </p>
);

export default function StudentDetails({ profileId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAssign, setShowAssign] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/advisor/students/${profileId}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || 'Failed to load student');
      setData(body);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <p style={{ padding: '1.5rem' }}>Loading…</p>;
  if (error) return <p style={{ padding: '1.5rem', color: '#c0392b' }}>{error}</p>;
  if (!data) return null;

  const { profile, workflowState, assignmentHistory } = data;

  const assignTargetShape = {
    _id: profile._id,
    studentId: profile.studentId,
    user: profile.user,
    assignedAdvisor: profile.assignedAdvisor,
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '900px', margin: '0 auto' }}>
      <button onClick={onBack} style={{ marginBottom: '1.25rem' }}>
        ← Back to list
      </button>

      <h2 style={{ marginTop: 0 }}>Student Details</h2>

      <section style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ borderBottom: '1px solid #ccc', paddingBottom: '0.25rem' }}>Identity</h3>
        <Field label="Student ID" value={profile.studentId} />
        <Field label="Full Name" value={profile.user?.fullName} />
        <Field label="Email" value={profile.user?.email} />
        <Field label="Major" value={profile.major} />
        <Field label="Current Semester" value={profile.currentSemester} />
        <Field label="Advising Reason" value={profile.advisingReason} />
        <Field label="Academic Standing" value={profile.academicStanding} />
        <Field label="Enrollment Status" value={profile.enrollmentStatus} />
      </section>

      <section style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ borderBottom: '1px solid #ccc', paddingBottom: '0.25rem' }}>Assigned Advisor</h3>
        {profile.assignedAdvisor ? (
          <>
            <Field label="Name" value={profile.assignedAdvisor.fullName} />
            <Field label="Email" value={profile.assignedAdvisor.email} />
          </>
        ) : (
          <p style={{ color: '#526261', margin: '0.25rem 0' }}>
            <em>No advisor currently assigned</em>
          </p>
        )}
        <button
          onClick={() => setShowAssign(true)}
          style={{ marginTop: '0.75rem', padding: '0.35rem 0.8rem', cursor: 'pointer' }}
        >
          {profile.assignedAdvisor ? 'Reassign Advisor' : 'Assign Advisor'}
        </button>
      </section>

      {workflowState && (
        <section style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ borderBottom: '1px solid #ccc', paddingBottom: '0.25rem' }}>Workflow State</h3>
          <Field label="Status" value={workflowState.status} />
          <Field label="Blocking Step" value={workflowState.blockingStep} />
          <Field
            label="Last Activity"
            value={workflowState.lastActivityAt
              ? new Date(workflowState.lastActivityAt).toLocaleString()
              : null}
          />
        </section>
      )}

      <section>
        <h3 style={{ borderBottom: '1px solid #ccc', paddingBottom: '0.25rem' }}>Advisor History</h3>
        {assignmentHistory.length === 0 ? (
          <p style={{ color: '#526261' }}><em>No assignment history</em></p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr>
                <th style={headStyle}>Advisor</th>
                <th style={headStyle}>Assigned By</th>
                <th style={headStyle}>Assigned At</th>
                <th style={headStyle}>Ended At</th>
              </tr>
            </thead>
            <tbody>
              {assignmentHistory.map((h) => (
                <tr key={h._id}>
                  <td style={cellStyle}>{h.advisor?.fullName ?? '—'}</td>
                  <td style={cellStyle}>{h.assignedBy?.fullName ?? '—'}</td>
                  <td style={cellStyle}>{new Date(h.createdAt).toLocaleString()}</td>
                  <td style={cellStyle}>
                    {h.endedAt
                      ? new Date(h.endedAt).toLocaleString()
                      : <em style={{ color: '#177e74' }}>Active</em>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {showAssign && (
        <AssignAdvisorModal
          student={assignTargetShape}
          onClose={() => setShowAssign(false)}
          onSuccess={() => { setShowAssign(false); load(); }}
        />
      )}
    </div>
  );
}
