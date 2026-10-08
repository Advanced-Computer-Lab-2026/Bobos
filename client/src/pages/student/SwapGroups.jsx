// Requirement 34 - a Normal Student views the eligible destination groups (and
// each group's complete weekly schedule) for a whole-schedule swap.
// Eligibility is decided by the server (GET /api/swaps/eligible-groups): only
// published groups of the same term whose course-code set EXACTLY matches the
// student's subjects.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import Alert from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import Card from '../../components/Card.jsx';
import Table from '../../components/Table.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import WeeklyCalendar from '../../components/WeeklyCalendar.jsx';

const TYPE_LABEL = { lecture: 'Lecture', tutorial: 'Tutorial', lab: 'Lab' };

const courseColumns = [
  { key: 'courseCode', header: 'Code', className: 'nowrap', render: (c) => <strong>{c.courseCode}</strong> },
  { key: 'courseName', header: 'Course' },
  { key: 'creditHours', header: 'Credit hrs' },
  {
    key: 'slots',
    header: 'Lecture / tutorial / lab - time and location',
    render: (c) => (
      <div className="stack">
        {c.slots.map((s) => (
          <span key={`${s.type}-${s.day}-${s.startTime}`}>
            <strong>{TYPE_LABEL[s.type] || s.type}</strong>
            {s.groupNumber ? ` (${s.groupNumber})` : ''}: {s.day} {s.startTime}-{s.endTime}, {s.room}
          </span>
        ))}
      </div>
    )
  }
];

function formatDate(value) {
  if (!value) return 'not set';
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function GroupCard({ group }) {
  const seats = group.minRemainingCapacity;
  return (
    <Card
      title={`Group ${group.studyGroup}`}
      subtitle={`${group.major}, semester ${group.semester} - ${group.totalCreditHours} credit hours`}
      actions={
        <span className={`badge${seats === 0 ? ' badge--danger' : ' badge--info'}`}>
          {seats === null ? 'Seats unknown' : seats === 0 ? 'Some sessions full' : `At least ${seats} seats left`}
        </span>
      }
    >
      <p className="muted">Days off: {group.daysOff.length ? group.daysOff.join(', ') : 'none'}</p>
      <WeeklyCalendar week={group.week} daysOff={group.daysOff} />
      <Table columns={courseColumns} rows={group.courses} rowKey={(c) => c.courseCode} />
      {/* Requirement 35 extension point: the "Request swap to this group" control
          (POST /api/swaps/...) goes here, keyed by group.templateId. */}
    </Card>
  );
}

export default function SwapGroups() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [forbidden, setForbidden] = useState('');
  const [notAvailable, setNotAvailable] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    setForbidden('');
    setNotAvailable(false);
    api
      .get('/swaps/eligible-groups')
      .then(setData)
      .catch((err) => {
        if (err.status === 403) setForbidden(err.message);
        else if (err.status === 404) setNotAvailable(true);
        else setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const back = (
    <Button variant="secondary" onClick={() => navigate('/schedule')}>Back to my schedule</Button>
  );

  return (
    <>
      <div className="page__header">
        <div className="row-gap" style={{ justifyContent: 'space-between' }}>
          <h1>Swap schedule</h1>
          {back}
        </div>
        <p>
          You can swap your whole schedule only into another standard schedule group of the same term whose
          registered subjects are <strong>exactly</strong> yours - no additional and no missing subject.
        </p>
      </div>

      {loading ? <Spinner label="Finding eligible groups..." large /> : null}
      {!loading && error ? (
        <Alert kind="error">
          {error} <Button variant="ghost" size="sm" onClick={load}>Try again</Button>
        </Alert>
      ) : null}
      {!loading && forbidden ? (
        <EmptyState title="Schedule swaps are not available for your account" message={forbidden} action={back} />
      ) : null}
      {!loading && notAvailable ? (
        <EmptyState
          title="You don't have a processed schedule yet"
          message="Swap options appear once you have been assigned to a standard schedule group."
          action={back}
        />
      ) : null}

      {!loading && data ? (
        <>
          <Card flat>
            <div className="sched-meta">
              <div><small>Student</small><strong>{data.student.fullName} ({data.student.studentId})</strong></div>
              <div><small>Term</small><span>{data.term.season} {data.term.academicYear}</span></div>
              <div><small>Current group</small><strong>Group {data.currentGroup.studyGroup}</strong></div>
              <div><small>Cohort</small><span>{data.currentGroup.major}, semester {data.currentGroup.semester}</span></div>
              <div><small>Credit hours</small><strong>{data.currentGroup.totalCreditHours}</strong></div>
              <div><small>Swap deadline</small><span>{formatDate(data.term.swapDeadline)}</span></div>
            </div>
            <p className="muted" style={{ marginBottom: 0 }}>
              Your subjects: {data.currentGroup.courseCodes.join(', ')}
            </p>
          </Card>

          <h2>Eligible groups ({data.count})</h2>
          {data.count === 0 ? (
            <EmptyState
              title="No eligible groups"
              message="No other group matches your registered subjects exactly."
              action={back}
            />
          ) : (
            data.eligibleGroups.map((g) => <GroupCard key={g.templateId} group={g} />)
          )}
        </>
      ) : null}
    </>
  );
}
