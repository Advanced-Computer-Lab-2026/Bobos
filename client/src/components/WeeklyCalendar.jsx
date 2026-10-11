// Requirement 31 - Saturday-to-Friday timetable. Time runs down the vertical
// axis; each session is a block coloured by type (lecture / tutorial / lab).
// Input is the server-built `week` + `daysOff` (GET /api/schedules/...), so the
// grouping and days-off logic has one source of truth.
const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const TYPE_LABEL = { lecture: 'Lecture', tutorial: 'Tutorial', lab: 'Lab' };
const PX_PER_MIN = 1.1;

function toMinutes(time) {
  const [h, m] = String(time).split(':').map(Number);
  return h * 60 + m;
}

export default function WeeklyCalendar({ week = {}, daysOff = [] }) {
  const sessions = DAYS.flatMap((day) => week[day] || []);
  // Default window 08:00-18:00, widened to fit any earlier/later session.
  const start = Math.min(8 * 60, ...sessions.map((s) => Math.floor(toMinutes(s.startTime) / 60) * 60));
  const end = Math.max(18 * 60, ...sessions.map((s) => Math.ceil(toMinutes(s.endTime) / 60) * 60));
  const height = (end - start) * PX_PER_MIN;
  const hours = [];
  for (let m = start; m <= end; m += 60) hours.push(m);
  const offSet = new Set(daysOff);

  return (
    <div className="wcal">
      <div className="wcal__legend" aria-label="Legend">
        {Object.entries(TYPE_LABEL).map(([type, label]) => (
          <span key={type} className="wcal__legend-item">
            <span className={`wcal__swatch wcal__swatch--${type}`} aria-hidden="true" />
            {label}
          </span>
        ))}
        <span className="wcal__legend-item">
          <span className="wcal__swatch wcal__swatch--off" aria-hidden="true" />
          Day off
        </span>
      </div>

      <div className="wcal__scroll">
        <div className="wcal__grid">
          <div className="wcal__corner" />
          {DAYS.map((day) => (
            <div key={day} className={`wcal__day-head${offSet.has(day) ? ' wcal__day-head--off' : ''}`}>
              {day}
              {offSet.has(day) ? <small>Day off</small> : null}
            </div>
          ))}

          <div className="wcal__times" style={{ height }}>
            {hours.map((m) => (
              <span key={m} style={{ top: (m - start) * PX_PER_MIN }}>
                {String(Math.floor(m / 60)).padStart(2, '0')}:00
              </span>
            ))}
          </div>

          {DAYS.map((day) => {
            const list = week[day] || [];
            const off = offSet.has(day) || list.length === 0;
            return (
              <div
                key={day}
                className={`wcal__col${off ? ' wcal__col--off' : ''}`}
                style={{ height }}
                aria-label={off ? `${day}: day off` : `${day}: ${list.length} sessions`}
              >
                {hours.map((m) => (
                  <span key={m} className="wcal__line" style={{ top: (m - start) * PX_PER_MIN }} />
                ))}
                {off ? <span className="wcal__off-label">Day off</span> : null}
                {list.map((s) => (
                  <div
                    key={`${s.courseCode}-${s.type}-${s.startTime}`}
                    className={`wcal__block wcal__block--${s.type}`}
                    style={{
                      top: (toMinutes(s.startTime) - start) * PX_PER_MIN,
                      height: (toMinutes(s.endTime) - toMinutes(s.startTime)) * PX_PER_MIN
                    }}
                    title={`${s.courseCode} ${s.courseName} - ${TYPE_LABEL[s.type] || s.type} ${s.groupNumber || ''}, ${s.startTime}-${s.endTime}, ${s.room}`}
                  >
                    <strong>{s.courseCode}</strong>
                    <span className="wcal__name">{s.courseName}</span>
                    <span>{TYPE_LABEL[s.type] || s.type}{s.groupNumber ? ` ${s.groupNumber}` : ''}</span>
                    <span>{s.room}</span>
                    <small>{s.startTime}-{s.endTime}</small>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
