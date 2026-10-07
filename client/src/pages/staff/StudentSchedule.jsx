// Requirement 31 - Advisor / Coordinator / Administrator view one student's
// schedule. Administrators get a read-only badge (the endpoint is GET-only).
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import Alert from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import ScheduleView from '../../components/ScheduleView.jsx';

export default function StudentSchedule() {
  const { studentId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    setData(null);
    api
      .get(`/schedules/student/${encodeURIComponent(studentId)}`)
      .then(setData)
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, [studentId]);

  useEffect(load, [load]);

  return (
    <>
      <div className="btn-row" style={{ marginBottom: '0.75rem' }}>
        <Button variant="secondary" size="sm" onClick={() => navigate('/schedules')}>
          &larr; Back to students
        </Button>
      </div>
      <div className="page__header">
        <div className="row-gap">
          <h1>Student schedule</h1>
          {data?.readOnly ? <span className="badge badge--info">Read-only (Administrator)</span> : null}
        </div>
        <p>Current weekly schedule with lecture, tutorial and lab times and locations.</p>
      </div>

      {loading ? <Spinner label="Loading schedule..." large /> : null}
      {!loading && error && error.status === 404 ? (
        <EmptyState title="No schedule to show" message={error.message} />
      ) : null}
      {!loading && error && error.status !== 404 ? <Alert kind="error">{error.message}</Alert> : null}
      {!loading && data ? <ScheduleView data={data} /> : null}
    </>
  );
}
