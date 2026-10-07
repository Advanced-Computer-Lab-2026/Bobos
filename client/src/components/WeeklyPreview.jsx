import EmptyState from './EmptyState.jsx';

const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];

const TYPE_LABEL = { lecture: 'Lec', tutorial: 'Tut', lab: 'Lab' };

// Renders a list of slots as a weekly grid. Reused by the requirement-30 group
// preview; requirements 31/34 can reuse it for a student's own schedule.
export default function WeeklyPreview({ slots }) {
  if (!slots || slots.length === 0) {
    return <EmptyState title="No slots" message="This group has no lecture, tutorial or lab slots." />;
  }

  const startTimes = [...new Set(slots.map((s) => s.startTime))].sort();
  const daysInUse = DAYS.filter((day) => slots.some((s) => s.day === day));

  return (
    <div className="week-grid">
      <table>
        <thead>
          <tr>
            <th>Time</th>
            {daysInUse.map((day) => (
              <th key={day}>{day}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {startTimes.map((startTime) => (
            <tr key={startTime}>
              <th scope="row" className="nowrap">{startTime}</th>
              {daysInUse.map((day) => {
                const cell = slots.filter((s) => s.day === day && s.startTime === startTime);
                return (
                  <td key={day}>
                    {cell.map((slot) => (
                      <span className="week-slot" key={slot.slotId || `${slot.courseCode}-${slot.type}`}>
                        <strong>{slot.courseCode}</strong>
                        <small>
                          {TYPE_LABEL[slot.type] || slot.type}
                          {slot.groupNumber ? ` ${slot.groupNumber}` : ''} - {slot.room}
                          <br />
                          {slot.startTime}-{slot.endTime}
                        </small>
                      </span>
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
