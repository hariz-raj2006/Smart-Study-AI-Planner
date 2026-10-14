import { PRIORITY_LABELS, STATUS_LABELS } from '../utils/format.js';

export default function Badge({ tone = 'neutral', dot = false, children, className = '' }) {
  return (
    <span className={`badge badge--${tone} ${className}`}>
      {dot && <span className="badge__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

const PRIORITY_TONE = { high: 'danger', medium: 'warning', low: 'success' };

/** Priority is always shown as text as well as colour. */
export function PriorityBadge({ priority }) {
  return (
    <Badge tone={PRIORITY_TONE[priority] || 'neutral'} dot>
      {PRIORITY_LABELS[priority] || priority}
    </Badge>
  );
}

const STATUS_TONE = { planned: 'primary', completed: 'success', partial: 'warning', missed: 'danger', skipped: 'neutral' };

export function StatusBadge({ status, overdue = false }) {
  if (overdue) return <Badge tone="danger">Overdue</Badge>;
  return <Badge tone={STATUS_TONE[status] || 'neutral'}>{STATUS_LABELS[status] || status}</Badge>;
}