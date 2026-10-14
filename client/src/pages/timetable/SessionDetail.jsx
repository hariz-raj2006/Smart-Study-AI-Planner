import { CheckCircle2, Clock, Pencil, Trash2, XCircle, CalendarClock } from 'lucide-react';
import Button from '../../components/Button.jsx';
import Modal from '../../components/Modal.jsx';
import { PriorityBadge, StatusBadge } from '../../components/Badge.jsx';
import { ACTIVITY_LABELS, formatDate, formatMinutes, formatTime } from '../../utils/format.js';
import { ORIGIN_LABELS, canComplete, isMovable } from './range.js';

/** Details of one session plus every action that is allowed for it right now. */
export default function SessionDetail({ session: s, today, onAction, onClose }) {
  const completable = canComplete(s, today);
  const movable = isMovable(s);
  const editable = s.status === 'planned' && !s.overdue;
  const unfinished = s.status === 'partial' ? s.durationMinutes - (s.completedMinutes || 0) : s.durationMinutes;

  return (
    <Modal open onClose={onClose} title={`${s.subjectName}: ${s.topic}`} size="md">
      <div className="stack">
        <div className="row">
          <StatusBadge status={s.status} overdue={s.overdue} />
          {s.priority && <PriorityBadge priority={s.priority} />}
        </div>

        <dl className="detail-grid">
          <dt>Date</dt>
          <dd>{formatDate(s.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</dd>
          <dt>Time</dt>
          <dd>
            {formatTime(s.startTime)} - {formatTime(s.endTime)} ({formatMinutes(s.durationMinutes)})
          </dd>
          <dt>Activity</dt>
          <dd>{ACTIVITY_LABELS[s.activityType] || s.activityType}</dd>
          {s.status === 'partial' && (
            <>
              <dt>Progress</dt>
              <dd>
                {formatMinutes(s.completedMinutes || 0)} done, {formatMinutes(unfinished)} left
              </dd>
            </>
          )}
          {typeof s.priorityScore === 'number' && s.priorityScore > 0 && (
            <>
              <dt>Priority score</dt>
              <dd>{Math.round(s.priorityScore)} / 100</dd>
            </>
          )}
          <dt>Created by</dt>
          <dd>{ORIGIN_LABELS[s.origin] || s.origin}</dd>
          {s.skipReason && (
            <>
              <dt>Your note</dt>
              <dd>{s.skipReason}</dd>
            </>
          )}
          {s.notes && (
            <>
              <dt>Notes</dt>
              <dd>{s.notes}</dd>
            </>
          )}
          {s.rescheduledTo && (
            <>
              <dt>Moved</dt>
              <dd>The unfinished part was rescheduled.</dd>
            </>
          )}
        </dl>

        {s.explanation && (
          <div className="why-box">
            <strong>Why this session?</strong>
            <p style={{ marginTop: '0.25rem' }}>{s.explanation}</p>
          </div>
        )}

        <div className="detail-actions">
          {completable && (
            <Button icon={CheckCircle2} onClick={() => onAction('complete', s)}>
              {s.status === 'partial' ? 'Finish session' : 'Mark done'}
            </Button>
          )}
          {s.status === 'planned' && s.date <= today && (
            <Button variant="secondary" icon={XCircle} onClick={() => onAction('skip', s)}>
              Missed or skipped
            </Button>
          )}
          {s.status === 'planned' && s.date > today && (
            <Button variant="secondary" icon={XCircle} onClick={() => onAction('skip', s)}>
              Skip this session
            </Button>
          )}
          {!s.rescheduledTo && s.status !== 'completed' && (
            <Button variant="secondary" icon={CalendarClock} onClick={() => onAction('reschedule', s)}>
              {movable ? 'Reschedule' : 'Move to another time'}
            </Button>
          )}
          {editable && (
            <Button variant="secondary" icon={Pencil} onClick={() => onAction('edit', s)}>
              Edit
            </Button>
          )}
          <Button variant="danger" icon={Trash2} onClick={() => onAction('delete', s)}>
            Delete
          </Button>
        </div>
        {!completable && s.status === 'planned' && s.date > today && (
          <p className="text-sm muted">
            <Clock size={14} aria-hidden="true" style={{ verticalAlign: '-2px' }} /> You can mark this session done on the day it takes place.
          </p>
        )}
      </div>
    </Modal>
  );
}