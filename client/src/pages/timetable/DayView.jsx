import { CalendarCheck } from 'lucide-react';
import Card from '../../components/Card.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import SessionRow from '../../components/SessionRow.jsx';
import { formatMinutes } from '../../utils/format.js';
import { canComplete } from './range.js';

/** All sessions of one day, in time order, with the breaks between them. Each row has a completion checkbox. */
export default function DayView({ date, today, sessions, breaks, onOpen, onComplete }) {
  const list = sessions.filter((s) => s.date === date);
  const dayBreaks = breaks.filter((b) => b.date === date);
  const planned = list.filter((s) => s.status !== 'skipped').reduce((n, s) => n + s.durationMinutes, 0);

  if (list.length === 0) {
    return (
      <Card>
        <EmptyState icon={CalendarCheck} title="Nothing scheduled" description="There are no study sessions on this day. Use the AI Planner to generate a plan, or add a session yourself." />
      </Card>
    );
  }

  return (
    <Card>
      <p className="muted text-sm" style={{ marginBottom: '0.9rem' }}>
        {list.length} session{list.length === 1 ? '' : 's'} · {formatMinutes(planned)} planned
      </p>
      {list.map((s) => {
        const breakAfter = dayBreaks.find((b) => b.startTime === s.endTime);
        const allowed = canComplete(s, today);
        return (
          <div key={s.id}>
            <SessionRow
              session={s}
              onOpen={onOpen}
              leading={
                <input
                  type="checkbox"
                  checked={s.status === 'completed'}
                  disabled={!allowed}
                  onChange={() => onComplete(s)}
                  aria-label={s.status === 'completed' ? `${s.topic} is completed` : allowed ? `Mark ${s.topic} as done` : `${s.topic} cannot be marked yet`}
                  title={allowed ? 'Mark as done' : s.status === 'completed' ? 'Completed' : 'Available on the day of the session'}
                />
              }
            />
            {breakAfter && <div className="break-row">Break · {breakAfter.durationMinutes} min</div>}
          </div>
        );
      })}
    </Card>
  );
}