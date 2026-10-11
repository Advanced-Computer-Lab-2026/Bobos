// Requirement 31 - one rendering of GET /api/schedules/* shared by the student
// page and the staff page: summary, weekly calendar, days off, course list.
import Card from './Card.jsx';
import Table from './Table.jsx';
import WeeklyCalendar from './WeeklyCalendar.jsx';

const STATUS = {
  processed: { label: 'Processed', kind: 'ok' },
  ready_for_student_review: { label: 'Ready for student review', kind: 'info' },
  draft: { label: 'Draft (hidden from student)', kind: 'warn' }
};
const TYPE_LABEL = { lecture: 'Lecture', tutorial: 'Tutorial', lab: 'Lab' };

export function StatusBadge({ status }) {
  if (!status) return <span className="badge">No schedule</span>;
  const s = STATUS[status] || { label: status, kind: '' };
  return <span className={`badge${s.kind ? ` badge--${s.kind}` : ''}`}>{s.label}</span>;
}

export default function ScheduleView({ data }) {
  const { term, student, schedule } = data;

  const columns = [
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

  return (
    <>
      <Card flat>
        <div className="sched-meta">
          <div><small>Student</small><strong>{student.fullName} ({student.studentId})</strong></div>
          <div><small>Programme</small><span>{student.major}, semester {student.currentSemester} - {student.studentType}</span></div>
          <div><small>Term</small><span>{term.season} {term.academicYear}</span></div>
          <div><small>Status</small><StatusBadge status={schedule.status} /></div>
          <div><small>Group</small><span>{schedule.studyGroup}</span></div>
          <div><small>Credit hours</small><strong>{schedule.totalCreditHours}</strong></div>
        </div>
      </Card>

      <Card
        title="Weekly calendar"
        subtitle={`Days off: ${schedule.daysOff.length ? schedule.daysOff.join(', ') : 'none'}`}
      >
        <WeeklyCalendar week={schedule.week} daysOff={schedule.daysOff} />
      </Card>

      <Card title="Courses" subtitle={`${schedule.courses.length} courses, ${schedule.totalCreditHours} credit hours`}>
        <Table columns={columns} rows={schedule.courses} rowKey={(c) => c.courseCode} />
      </Card>
    </>
  );
}
