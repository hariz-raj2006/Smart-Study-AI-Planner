import { DAY_NAMES_SHORT, formatDate } from '../../utils/format.js';
import { monthGrid } from './range.js';

const HEAD_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Calendar-style month overview. Click a day to open it in the day view. */
export default function MonthView({ anchor, today, sessions, onPickDay }) {
  const cells = monthGrid(anchor);
  const month = anchor.slice(0, 7);

  return (
    <div className="month-wrap">
      <div className="month-grid" role="grid" aria-label="Month calendar">
        {HEAD_ORDER.map((d) => (
          <div key={d} className="month-head" role="columnheader">
            {DAY_NAMES_SHORT[d]}
          </div>
        ))}
        {cells.map((date) => {
          const list = sessions.filter((s) => s.date === date && s.status !== 'skipped');
          const out = !date.startsWith(month);
          return (
            <button
              key={date}
              type="button"
              role="gridcell"
              className={`month-cell${out ? ' month-cell--out' : ''}${date === today ? ' month-cell--today' : ''}`}
              onClick={() => onPickDay(date)}
              aria-label={`${formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}: ${list.length} session${list.length === 1 ? '' : 's'}`}
            >
              <span className="month-cell__num">{Number(date.slice(8))}</span>
              {list.slice(0, 3).map((s) => (
                <span key={s.id} className="month-cell__item">
                  <span className="color-dot" style={{ background: s.subjectColor, width: '0.55rem', height: '0.55rem' }} aria-hidden="true" />
                  {s.subjectName}
                </span>
              ))}
              {list.length > 3 && <span className="month-cell__more">+{list.length - 3} more</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}