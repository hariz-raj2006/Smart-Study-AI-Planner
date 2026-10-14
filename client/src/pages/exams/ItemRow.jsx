import { formatDate, parseDate } from '../../utils/format.js';

/** One row in the exam / assignment lists: a date tile, title, subject, badges and action buttons. */
export default function ItemRow({ dateStr, title, subjectName, subjectColor, details, badges, actions, done = false }) {
  const d = parseDate(dateStr);
  return (
    <li className={`item-row${done ? ' item-row--done' : ''}`}>
      <div className="item-row__date" aria-hidden="true">
        <span>{d.toLocaleDateString(undefined, { month: 'short' })}</span>
        <strong>{d.getDate()}</strong>
      </div>
      <div className="item-row__main">
        <div className="item-row__title">{title}</div>
        <div className="item-row__meta">
          <span className="color-dot" style={{ background: subjectColor }} aria-hidden="true" />
          <span>{subjectName}</span>
          <span>· {formatDate(dateStr, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
          {details}
        </div>
      </div>
      <div className="item-row__badges">{badges}</div>
      <div className="item-row__actions">{actions}</div>
    </li>
  );
}