import { ACTIVITY_LABELS, formatDate, formatMinutes, formatTime } from '../utils/format.js';
import { PriorityBadge, StatusBadge } from './Badge.jsx';
import '../styles/sessions.css';

/**
 * One study session. `leading` (e.g. a checkbox) and `actions` (buttons) sit outside the clickable
 * area so there are never buttons inside buttons. Pass `onOpen` to make the main part clickable.
 */
export default function SessionRow({ session, leading, actions, onOpen, showExplanation = false, showDate = false }) {
  const s = session;
  const body = (
    <>
      <div className="sess__time">
        {showDate && <div className="sess__date">{formatDate(s.date)}</div>}
        {formatTime(s.startTime)} - {formatTime(s.endTime)}
        <span className="sess__dur">{formatMinutes(s.durationMinutes)}</span>
      </div>
      <div className="sess__main">
        <div className="sess__subject">
          <span className="color-dot" style={{ background: s.subjectColor }} aria-hidden="true" />
          {s.subjectName}
        </div>
        <div className="sess__topic">
          {ACTIVITY_LABELS[s.activityType] || s.activityType}: {s.topic}
        </div>
        {showExplanation && s.explanation && <p className="sess__why">{s.explanation}</p>}
      </div>
      <div className="sess__badges">
        {s.priority && <PriorityBadge priority={s.priority} />}
        <StatusBadge status={s.status} overdue={s.overdue} />
      </div>
    </>
  );

  return (
    <div className={`sess${s.status === 'completed' ? ' sess--done' : ''}`} style={{ borderLeftColor: s.subjectColor }}>
      {leading && <div className="sess__lead">{leading}</div>}
      {onOpen ? (
        <button type="button" className="sess__open" onClick={() => onOpen(s)} aria-label={`Open details: ${s.subjectName}, ${s.topic}, ${formatDate(s.date)} ${formatTime(s.startTime)}`}>
          {body}
        </button>
      ) : (
        <div className="sess__body">{body}</div>
      )}
      {actions && <div className="sess__actions">{actions}</div>}
    </div>
  );
}