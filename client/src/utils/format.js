/** Date/time helpers. Dates are "YYYY-MM-DD" strings and times are "HH:MM", exactly as the API uses them. */

const pad = (n) => String(n).padStart(2, '0');

export const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_NAMES_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "YYYY-MM-DD" -> local Date (no time-zone shifting). */
export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toDateStr(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const todayStr = () => toDateStr(new Date());

export function addDays(str, n) {
  const d = parseDate(str);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export function daysBetween(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86400000);
}

export function dayOfWeek(str) {
  return parseDate(str).getDay();
}

/** Monday of the week containing the date. */
export function startOfWeek(str) {
  return addDays(str, -((dayOfWeek(str) + 6) % 7));
}

export function formatDate(str, options = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return parseDate(str).toLocaleDateString(undefined, options);
}

export function formatLongDate(str) {
  return formatDate(str, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(min) {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}

export function formatMinutes(min) {
  const total = Math.round(min || 0);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/** "Today", "Tomorrow", "In 5 days", "3 days ago" */
export function relativeDays(n) {
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  return n > 0 ? `In ${n} days` : `${Math.abs(n)} days ago`;
}

export const ACTIVITY_LABELS = {
  learning: 'Learning',
  revision: 'Revision',
  practice: 'Practice questions',
  assignment: 'Assignment work',
  mock_test: 'Mock test',
};
export const ACTIVITY_OPTIONS = Object.entries(ACTIVITY_LABELS).map(([value, label]) => ({ value, label }));

export const STATUS_LABELS = {
  planned: 'Planned',
  completed: 'Completed',
  partial: 'Partly done',
  missed: 'Missed',
  skipped: 'Skipped',
};

export const PRIORITY_LABELS = { high: 'High priority', medium: 'Medium priority', low: 'Low priority' };

export const PERIOD_OPTIONS = [
  { value: 'morning', label: 'Morning (5 am - 12 pm)' },
  { value: 'afternoon', label: 'Afternoon (12 - 5 pm)' },
  { value: 'evening', label: 'Evening (5 pm onwards)' },
  { value: 'any', label: 'No preference' },
];

export const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?';