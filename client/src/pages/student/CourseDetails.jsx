// Requirement 33 - a student selects a registered course and views its
// assigned lecture, tutorial and lab (group, day, time, room).
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import Spinner from '../../components/Spinner.jsx';
import Alert from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import Card from '../../components/Card.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { StatusBadge } from '../../components/ScheduleView.jsx';
import { CourseTypeBadge } from './MyCourses.jsx';

const COMPONENTS = [
  { type: 'lecture', label: 'Lecture' },
  { type: 'tutorial', label: 'Tutorial' },
  { type: 'lab', label: 'Lab' }
];

function ComponentCard({ label, slot }) {
  return (
    <Card title={label}>
      {slot ? (
        <div className="course-component">
          <div><small>Group</small><strong>{slot.groupNumber || '-'}</strong></div>
          <div><small>Day</small><span>{slot.day || '-'}</span></div>
          <div><small>Time</small><span>{slot.startTime}-{slot.endTime}</span></div>
          <div><small>Room</small><span>{slot.room || '-'}</span></div>
        </div>
      ) : (
        <p className="muted">No {label.toLowerCase()} for this course.</p>
      )}
    </Card>
  );
}

export default function CourseDetails() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    setNotFound('');
    setData(null);
    api
      .get(`/schedules/me/courses/${encodeURIComponent(courseId)}`)
      .then(setData)
      .catch((err) => {
        if (err.status === 404 || err.status === 400) setNotFound(err.message);
        else setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [courseId]);

  useEffect(load, [load]);

  const back = (
    <Button variant="secondary" onClick={() => navigate('/courses')}>Back to my courses</Button>
  );

  return (
    <>
      <div className="page__header">
        <div className="btn-row">{back}</div>
        <h1>{data ? `${data.course.courseCode} - ${data.course.courseName}` : 'Course details'}</h1>
        <p>The lecture, tutorial and lab you are assigned to for this course.</p>
      </div>

      {loading ? <Spinner label="Loading course details..." large /> : null}
      {!loading && error ? (
        <Alert kind="error">
          {error} <Button variant="ghost" size="sm" onClick={load}>Try again</Button>
        </Alert>
      ) : null}
      {!loading && notFound ? (
        <EmptyState
          title="Course not available"
          message={notFound || 'This course is not in your registered courses.'}
          action={back}
        />
      ) : null}
      {!loading && data ? (
        <>
          <Card flat>
            <div className="sched-meta">
              <div><small>Course</small><strong>{data.course.courseCode}</strong></div>
              <div><small>Credit hours</small><strong>{data.course.creditHours}</strong></div>
              <div><small>Type</small><CourseTypeBadge type={data.course.courseType} /></div>
              <div>
                <small>Instructors</small>
                <span>{data.instructors.length ? data.instructors.join(', ') : 'To be announced'}</span>
              </div>
              <div><small>Term</small><span>{data.term.season} {data.term.academicYear}</span></div>
              <div><small>Status</small><StatusBadge status={data.status} /></div>
              <div><small>Group</small><span>{data.studyGroup}</span></div>
            </div>
          </Card>

          <div className="course-components">
            {COMPONENTS.map((c) => (
              <ComponentCard key={c.type} label={c.label} slot={data.components[c.type]} />
            ))}
          </div>

          {data.sessions.length > COMPONENTS.filter((c) => data.components[c.type]).length ? (
            <Card title="All sessions" subtitle="This course has more than one session of the same type.">
              <div className="stack">
                {data.sessions.map((s) => (
                  <span key={`${s.type}-${s.day}-${s.startTime}`}>
                    <strong>{s.type}</strong> ({s.groupNumber}): {s.day} {s.startTime}-{s.endTime}, {s.room}
                  </span>
                ))}
              </div>
            </Card>
          ) : null}
        </>
      ) : null}
    </>
  );
}
