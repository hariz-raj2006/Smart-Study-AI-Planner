import { addDays, formatDate, formatMinutes, formatTime, startOfWeek } from '../../utils/format.js';

/** Seven day columns (Monday first). Click a session for its details, or a day name to open that day. */
export default function WeekView({ anchor, today, sessions, onOpen, onPickDay }) {
  const start = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <div className="week-grid">
      {days.map((date) => {
        const list = sessions.filter((s) => s.date === date);
        const total = list.filter((s) => s.status !== 'skipped').reduce((n, s) => n + s.durationMinutes, 0);
        return (
          <section key={date} className={`week-day${date === today ? ' week-day--today' : ''}`} aria-label={formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}>
            <div className="week-day__head">
              <button type="button" onClick={() => onPickDay(date)}>
                {formatDate(date, { weekday: 'short', day: 'numeric' })}
              </button>
              <span className="week-day__total">{total ? formatMinutes(total) : ''}</span>
            </div>
            {list.length === 0 ? (
              <p className="text-xs faint">Free</p>
            ) : (
              list.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`chip-session${s.status === 'completed' ? ' chip-session--done' : ''}${s.overdue || s.status === 'missed' ? ' chip-session--bad' : ''}`}
                  style={{ borderLeftColor: s.subjectColor }}
                  onClick={() => onOpen(s)}
                  aria-label={`${s.subjectName}, ${s.topic}, ${formatTime(s.startTime)} to ${formatTime(s.endTime)}, ${s.overdue ? 'overdue' : s.status}`}
                >
                  <span className="chip-session__time">{formatTime(s.startTime)}</span>
                  <span className="chip-session__name">{s.subjectName}</span>
                </button>
              ))
            )}
          </section>
        );
      })}
    </div>
  );
}