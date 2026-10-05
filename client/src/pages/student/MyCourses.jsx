// Requirement 32 - a student views their registered courses, the credit hours
// of each course and their total registered credit hours.
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import Alert from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import Card from '../../components/Card.jsx';
import Table from '../../components/Table.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { StatusBadge } from '../../components/ScheduleView.jsx';

const COURSE_TYPE = {
  core: { label: 'Core', kind: 'info' },
  elective: { label: 'Elective', kind: 'ok' },
  huma: { label: 'Humanities', kind: 'warn' }
};

function CourseTypeBadge({ type }) {
  const t = COURSE_TYPE[type];
  if (!t) return <span className="badge">{type || 'Unknown'}</span>;
  return <span className={`badge badge--${t.kind}`}>{t.label}</span>;
}

const columns = [
  // Extension point for requirement 33 (course details): wrap the code in a
  // <Link> to the details page using `c.courseId`. Not built here.
  { key: 'courseCode', header: 'Code', className: 'nowrap', render: (c) => <strong>{c.courseCode}</strong> },
  { key: 'courseName', header: 'Course' },
  { key: 'courseType', header: 'Type', render: (c) => <CourseTypeBadge type={c.courseType} /> },
  { key: 'creditHours', header: 'Credit hrs', className: 'nowrap' }
];

export default function MyCourses() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notAvailable, setNotAvailable] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    setNotAvailable(false);
    setData(null);
    api
      .get('/schedules/me/courses')
      .then(setData)
      .catch((err) => {
        if (err.status === 404) setNotAvailable(true);
        else setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const scheduleLink = <Link className="btn btn--secondary btn--sm" to="/schedule">View weekly schedule</Link>;

  return (
    <>
      <div className="page__header">
        <h1>My courses</h1>
        <p>Your registered courses this term, the credit hours of each course and your total registered credit hours.</p>
      </div>

      {loading ? <Spinner label="Loading your courses..." large /> : null}
      {!loading && error ? (
        <Alert kind="error">
          {error} <Button variant="ghost" size="sm" onClick={load}>Try again</Button>
        </Alert>
      ) : null}
      {!loading && notAvailable ? (
        <EmptyState
          title="No registered courses yet"
          message="Your courses will appear here once your schedule has been processed (or, for advising students, once your advisor marks it ready for your review)."
          action={<Button variant="secondary" onClick={load}>Check again</Button>}
        />
      ) : null}
      {!loading && data ? (
        <>
          <Card flat>
            <div className="sched-meta">
              <div><small>Student</small><strong>{data.student.fullName} ({data.student.studentId})</strong></div>
              <div><small>Term</small><span>{data.term.season} {data.term.academicYear}</span></div>
              <div><small>Status</small><StatusBadge status={data.status} /></div>
              <div><small>Group</small><span>{data.studyGroup}</span></div>
              <div><small>Courses</small><strong>{data.courseCount}</strong></div>
              <div>
                <small>Total credit hours</small>
                <strong className="credit-total">{data.totalCreditHours}</strong>
              </div>
            </div>
          </Card>

          <Card
            title="Registered courses"
            subtitle={`${data.courseCount} courses, ${data.totalCreditHours} credit hours in total`}
            actions={scheduleLink}
          >
            <Table
              columns={columns}
              rows={data.courses}
              rowKey={(c) => c.courseId || c.courseCode}
              empty={<p className="muted">No registered courses yet.</p>}
            />
          </Card>
        </>
      ) : null}
    </>
  );
}
