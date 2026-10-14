import { addDays, formatDate, parseDate, startOfWeek, toDateStr } from '../../utils/format.js';

const firstOfMonth = (dateStr) => `${dateStr.slice(0, 7)}-01`;

/** The 42 dates (6 weeks, Monday first) shown in the calendar view for the month of `anchor`. */
export function monthGrid(anchor) {
  const start = startOfWeek(firstOfMonth(anchor));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** { from, to } (inclusive) of the sessions to load for a view. */
export function rangeFor(view, anchor) {
  if (view === 'day') return { from: anchor, to: anchor };
  if (view === 'week') {
    const from = startOfWeek(anchor);
    return { from, to: addDays(from, 6) };
  }
  const grid = monthGrid(anchor);
  return { from: grid[0], to: grid[grid.length - 1] };
}

/** Moves the anchor one step back (-1) or forward (+1) for the current view. */
export function shiftAnchor(view, anchor, direction) {
  if (view === 'day') return addDays(anchor, direction);
  if (view === 'week') return addDays(anchor, 7 * direction);
  const d = parseDate(firstOfMonth(anchor));
  return toDateStr(new Date(d.getFullYear(), d.getMonth() + direction, 1));
}

export function titleFor(view, anchor) {
  if (view === 'day') return formatDate(anchor, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (view === 'week') {
    const from = startOfWeek(anchor);
    return `${formatDate(from, { day: 'numeric', month: 'short' })} - ${formatDate(addDays(from, 6), { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }
  return parseDate(anchor).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export const ORIGIN_LABELS = {
  'ai-plan': 'AI-assisted plan',
  'local-plan': 'Scheduler-only plan',
  rescheduled: 'Rescheduled automatically',
  manual: 'Added or moved by you',
};

/** Can this session be ticked off today? (Not future sessions, and only planned or partly done ones.) */
export const canComplete = (session, today) => ['planned', 'partial'].includes(session.status) && session.date <= today;

/** Missed, skipped, partly done or overdue sessions can be moved to a new slot. */
export const isMovable = (session) => ['missed', 'skipped', 'partial'].includes(session.status) || Boolean(session.overdue);