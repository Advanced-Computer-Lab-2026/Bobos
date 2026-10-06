import { useState, useEffect, useCallback } from 'react';
import StudentDetails from './StudentDetails.jsx';
import AssignAdvisorModal from './AssignAdvisorModal.jsx';

const ADVISING_REASONS = [
  'probation',
  'failedCourses',
  'unattendedCourses',
  'undeclaredMajor',
  'transfer',
];

const WORKFLOW_STATUSES = [
  'notStarted',
  'draft',
  'readyForStudentReview',
  'changeRequestPending',
  'pendingApproval',
  'awaitingPaymentChoice',
  'deferredToNextInstallment',
  'readyToProcess',
  'processed',
  'reopened',
  'scheduleAssigned',
  'swapRequestOpen',
  'swapCompleted',
  'swapWithdrawn',
  'swapExpired',
];

const PENDING_REQUEST_TYPES = [
  'slotChange',
  'extraHours',
  'mandatoryCourseRemoval',
  'scheduleSwap',
];

const cellStyle = { padding: '0.5rem', border: '1px solid #ccc' };
const headStyle = { ...cellStyle, background: '#e8eded', textAlign: 'left' };

export default function AdvisingDashboard({ canAssign = false, onRoleLoaded }) {
  const [students, setStudents] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [pagination, setPagination] = useState({ total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({
    advisorId: '',
    major: '',
    advisingReason: '',
    scheduleStatus: '',
    pendingRequestType: '',
  });
  const [page, setPage] = useState(1);

  const [advisors, setAdvisors] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState(null);
  const [assignTarget, setAssignTarget] = useState(null);

  useEffect(() => {
    fetch('/api/advisor/advisors')
      .then((r) => r.json())
      .then(setAdvisors)
      .catch(() => {});
  }, [canAssign]);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (filters.advisorId) params.set('advisorId', filters.advisorId);
    if (filters.major) params.set('major', filters.major);
    if (filters.advisingReason) params.set('advisingReason', filters.advisingReason);
    if (filters.scheduleStatus) params.set('scheduleStatus', filters.scheduleStatus);
    if (filters.pendingRequestType) params.set('pendingRequestType', filters.pendingRequestType);
    params.set('page', String(page));
    params.set('limit', '20');
    return params.toString();
  }, [search, filters, page]);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/advisor/students?${buildQuery()}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || 'Failed to load students');
      setStudents(body.data || []);
      setCurrentUserId(body.currentUserId);
      setCurrentUserRole(body.currentUserRole);
      onRoleLoaded?.(body.currentUserRole);
      setPagination(body.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [buildQuery, onRoleLoaded]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const canManageAssignments = canAssign && currentUserRole === 'coordinator';

  const clearFilters = () => {
    setSearch('');
    setFilters({ advisorId: '', major: '', advisingReason: '', scheduleStatus: '', pendingRequestType: '' });
    setPage(1);
  };

  if (selectedProfileId) {
    return (
      <StudentDetails
        profileId={selectedProfileId}
        canAssign={canManageAssignments}
        onBack={() => setSelectedProfileId(null)}
      />
    );
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ marginTop: 0 }}>Advising Students</h2>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="Search by ID, name, or email"
          maxLength={100}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={{ padding: '0.4rem 0.6rem', minWidth: '220px', borderRadius: '4px', border: '1px solid #ccc' }}
        />

        <select
          value={filters.advisorId}
          onChange={(e) => handleFilterChange('advisorId', e.target.value)}
          style={{ padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid #ccc' }}
        >
          <option value="">All Advisors</option>
          {currentUserRole === 'advisor' && currentUserId && (
            <option value={currentUserId}>My assigned students</option>
          )}
          {advisors
            .filter((a) => a._id !== currentUserId)
            .map((a) => (
              <option key={a._id} value={a._id}>{a.fullName}</option>
            ))}
        </select>

        <input
          type="text"
          placeholder="Filter by major"
          value={filters.major}
          onChange={(e) => handleFilterChange('major', e.target.value)}
          style={{ padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid #ccc' }}
        />

        <select
          value={filters.advisingReason}
          onChange={(e) => handleFilterChange('advisingReason', e.target.value)}
          style={{ padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid #ccc' }}
        >
          <option value="">All Advising Reasons</option>
          {ADVISING_REASONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        <select
          value={filters.scheduleStatus}
          onChange={(e) => handleFilterChange('scheduleStatus', e.target.value)}
          style={{ padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid #ccc' }}
        >
          <option value="">All Schedule Statuses</option>
          {WORKFLOW_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          value={filters.pendingRequestType}
          onChange={(e) => handleFilterChange('pendingRequestType', e.target.value)}
          style={{ padding: '0.4rem 0.6rem', borderRadius: '4px', border: '1px solid #ccc' }}
        >
          <option value="">All Pending Request Types</option>
          {PENDING_REQUEST_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button type="button" onClick={clearFilters}>Clear filters</button>
      </div>

      {error && <p style={{ color: '#c0392b', margin: '0 0 1rem' }}>{error}</p>}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr>
                  <th style={headStyle}>Student ID</th>
                  <th style={headStyle}>Full Name</th>
                  <th style={headStyle}>Email</th>
                  <th style={headStyle}>Major</th>
                  <th style={headStyle}>Assigned Advisor</th>
                  <th style={headStyle}>Workflow Status</th>
                  <th style={headStyle}>Blocking Step</th>
                  <th style={headStyle}>Last Update</th>
                  {canManageAssignments && <th style={headStyle}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={canManageAssignments ? 9 : 8} style={{ ...cellStyle, textAlign: 'center', color: '#526261' }}>
                      No students found
                    </td>
                  </tr>
                ) : (
                  students.map((s) => (
                    <tr
                      key={s._id}
                      onClick={() => setSelectedProfileId(s._id)}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f5f4'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = ''; }}
                    >
                      <td style={cellStyle}>{s.studentId}</td>
                      <td style={cellStyle}>{s.user?.fullName ?? '—'}</td>
                      <td style={cellStyle}>{s.user?.email ?? '—'}</td>
                      <td style={cellStyle}>{s.major}</td>
                      <td style={cellStyle}>
                        {s.assignedAdvisor?.fullName ?? <em style={{ color: '#526261' }}>Unassigned</em>}
                      </td>
                      <td style={cellStyle}>{s.workflowStatus ?? '—'}</td>
                      <td style={cellStyle}>{s.blockingStep ?? '—'}</td>
                      <td style={cellStyle}>
                        {s.lastActivityAt
                          ? new Date(s.lastActivityAt).toLocaleString()
                          : '—'}
                      </td>
                      {canManageAssignments && (
                        <td style={cellStyle} onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setAssignTarget(s)}
                          style={{ padding: '0.25rem 0.6rem', cursor: 'pointer' }}
                        >
                          {s.assignedAdvisor?._id ? 'Reassign' : 'Assign'} Advisor
                        </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
            <span style={{ color: '#526261' }}>
              Page {pagination.page} of {pagination.pages} &nbsp;({pagination.total} students)
            </span>
            <button disabled={page >= pagination.pages} onClick={() => setPage((p) => p + 1)}>Next</button>
          </div>
        </>
      )}

      {canManageAssignments && assignTarget && (
        <AssignAdvisorModal
          student={assignTarget}
          onClose={() => setAssignTarget(null)}
          onSuccess={() => { setAssignTarget(null); fetchStudents(); }}
        />
      )}
    </div>
  );
}
