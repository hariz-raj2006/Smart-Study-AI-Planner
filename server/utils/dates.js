/**
 * Date/time helpers. All dates are plain local calendar strings ("YYYY-MM-DD")
 * and all times are "HH:MM" (24-hour). Calculations use UTC arithmetic on the
 * calendar fields so daylight-saving changes can never shift a date.
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const pad = (n) => String(n).padStart(2, '0');

export function isValidDateStr(s) {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export function isValidTimeStr(s) {
  return typeof s === 'string' && TIME_RE.test(s);
}

/** Local calendar date of a JS Date as "YYYY-MM-DD". */
export function toDateStr(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayStr(now = new Date()) {
  return toDateStr(now);
}

/** Minutes since local midnight for a JS Date. */
export function nowMinutes(now = new Date()) {
  return now.getHours() * 60 + now.getMinutes();
}

function toUtcMs(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(dateStr, n) {
  const dt = new Date(toUtcMs(dateStr) + n * 86400000);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Whole days from a to b (negative if b is before a). */
export function daysBetween(a, b) {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / 86400000);
}

/** 0 = Sunday ... 6 = Saturday */
export function dayOfWeek(dateStr) {
  return new Date(toUtcMs(dateStr)).getUTCDay();
}

/** Monday of the week containing dateStr. */
export function startOfWeek(dateStr) {
  const offset = (dayOfWeek(dateStr) + 6) % 7;
  return addDays(dateStr, -offset);
}

export function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(min) {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
}