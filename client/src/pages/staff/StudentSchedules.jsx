// Requirement 31 - staff entry point: find a student, open their schedule.
// Advisors are only listed advising students (server-side rule).
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Card from '../../components/Card.jsx';
import Table from '../../components/Table.jsx';
import Button from '../../components/Button.jsx';
import Spinner from '../../components/Spinner.jsx';
import Alert from '../../components/Alert.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { StatusBadge } from '../../components/ScheduleView.jsx';

export default function StudentSchedules() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [rows, setRows] = useState([]);
  const [term, setTerm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .get(`/schedules/students?search=${encodeURIComponent(debounced)}`)
      .then((data) => {
        if (cancelled) return;
        setRows(data.students || []);
        setTerm(data.term);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const columns = [
    { key: 'studentId', header: 'ID', className: 'nowrap' },
    {
      key: 'fullName',
      header: 'Name',
      render: (r) => (
        <div className="stack"><strong>{r.fullName}</strong><small className="muted">{r.email}</small></div>
      )
    },
    { key: 'studentType', header: 'Type', render: (r) => <span className="badge">{r.studentType}</span> },
    { key: 'major', header: 'Programme', render: (r) => `${r.major} sem ${r.currentSemester}` },
    { key: 'scheduleStatus', header: 'Schedule', render: (r) => <StatusBadge status={r.scheduleStatus} /> },
    {
      key: 'actions',
      header: '',
      className: 'actions',
      render: (r) => (
        <Button size="sm" disabled={!r.scheduleStatus} onClick={() => navigate(`/students/${r.studentId}/schedule`)}>
          View schedule
        </Button>
      )
    }
  ];

  return (
    <>
      <div className="page__header">
        <h1>Student schedules</h1>
        <p>
          {user?.role === 'advisor'
            ? 'Advising students and their draft, review-ready or processed schedules.'
            : 'All students and their current weekly schedules.'}
          {user?.role === 'administrator' ? ' Administrators have read-only access.' : ''}
          {term ? ` Term: ${term.season} ${term.academicYear}.` : ''}
        </p>
      </div>
      <Card>
        <div className="filter-bar" style={{ marginBottom: '0.75rem' }}>
          <div className="field">
            <label htmlFor="sched-search">Search</label>
            <input
              id="sched-search"
              placeholder="Name, email or ID (e.g. 49-0008)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        {error ? <Alert kind="error">{error}</Alert> : null}
        {loading ? (
          <Spinner label="Loading students..." />
        ) : (
          <Table
            columns={columns}
            rows={rows}
            empty={<EmptyState title="No students found" message="Try a different search." />}
          />
        )}
      </Card>
    </>
  );
}
