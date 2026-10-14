/**
 * SmartStudy AI - Scheduling Service
 * ==================================
 * A deterministic, rule-based scheduling algorithm. It is NOT a trained
 * machine-learning model. Generative AI (Gemini) only gives optional "soft"
 * hints (see sanitizeAiRecommendations); every hard rule below is enforced by
 * this code, and the final timetable is always validated here.
 *
 * -------------------------------------------------------------------------
 * PRIORITY SCORE  (0 - 100)
 * -------------------------------------------------------------------------
 *   Priority = 100 x ( wE*ExamUrgency + wP*PerformanceGap
 *                    + wD*Difficulty  + wW*Workload ) / (wE+wP+wD+wW)
 *
 *   Default weights (SCHEDULING_CONFIG.weights):
 *     ExamUrgency 0.40, PerformanceGap 0.30, Difficulty 0.20, Workload 0.10
 *
 *   Every component is first normalised to the range 0..1:
 *     ExamUrgency    = (1 - daysUntilExam / urgencyHorizonDays), clamped 0..1,
 *                      multiplied by an importance factor (0.6 .. 1.0).
 *                      No upcoming exam -> 0.
 *     PerformanceGap = (target% - current%) / performanceGapCap, clamped 0..1.
 *     Difficulty     = (difficulty - 1) / 4          (difficulty is 1..5)
 *     Workload       = this subject's remaining minutes / the largest
 *                      remaining minutes among the student's subjects.
 *
 *   Gemini may nudge a score by at most +/- maxAiNudge points. It can never
 *   change the weights, dates, availability or any hard constraint.
 *
 * -------------------------------------------------------------------------
 * HOW A TIMETABLE IS BUILT
 * -------------------------------------------------------------------------
 *  1. Work out how many minutes each subject needs inside the planning
 *     window (remaining workload, scaled by priority when the exam is far away).
 *  2. Split that time into learning / practice / revision / mock tests.
 *     Revision and mock tests are only allowed close to the exam.
 *  3. Go through the planning window day by day. Each day, every task gets a
 *     daily quota (remaining time / usable days left before its deadline).
 *     Tasks are placed highest priority first (tasks on their last possible day
 *     go first), alternating subjects, into free time slots.
 *  4. A slot is rejected if it overlaps another session, leaves less than the
 *     break gap, exceeds the daily limit, or makes one subject run too long.
 *  5. Whatever does not fit is reported as a conflict. Nothing is silently dropped.
 *  6. The finished timetable is validated again (validateTimetable).
 *
 * Rules: sessions never cross midnight, never start in the past, never fall
 * outside the configured availability, and sessions for a subject are always
 * before that subject's exam date (assignment work: on or before the due date).
 *
 * Dates are "YYYY-MM-DD", times "HH:MM". Server local time is used for "now".
 */

import {
  addDays,
  dayOfWeek,
  daysBetween,
  isValidDateStr,
  isValidTimeStr,
  minutesToTime,
  nowMinutes,
  timeToMinutes,
  todayStr,
} from '../utils/dates.js';

// ---------------------------------------------------------------------------
// Configuration (edit the numbers here to tune the algorithm)
// ---------------------------------------------------------------------------

export const SCHEDULING_CONFIG = Object.freeze({
  weights: Object.freeze({
    examUrgency: 0.4,
    performanceGap: 0.3,
    difficulty: 0.2,
    workload: 0.1,
  }),
  urgencyHorizonDays: 30, // an exam this far away (or more) has zero urgency
  performanceGapCap: 50, // a 50-point gap (or more) counts as the maximum gap
  highPriorityScore: 60, // score >= this -> "high"
  mediumPriorityScore: 35, // score >= this -> "medium", otherwise "low"
  defaultPlanDays: 14,
  maxPlanDays: 28,
  defaultDeadlineDays: 30, // used to scale workload when a subject has no exam
  minSessionMinutes: 15,
  maxConsecutiveSameSubjectMinutes: 120,
  longBreakMinutes: 30, // a gap this long ends a "same subject in a row" run
  examBlockMinutes: 180, // time blocked on exam day when the exam has a start time
  maxAiNudge: 10,
  periods: Object.freeze({
    morning: Object.freeze({ start: 5 * 60, end: 12 * 60 }),
    afternoon: Object.freeze({ start: 12 * 60, end: 17 * 60 }),
    evening: Object.freeze({ start: 17 * 60, end: 24 * 60 }),
  }),
});

export const ACTIVITY_TYPES = ['learning', 'revision', 'practice', 'assignment', 'mock_test'];

export function resolveConfig(overrides = {}) {
  const cfg = {
    ...SCHEDULING_CONFIG,
    ...overrides,
    weights: { ...SCHEDULING_CONFIG.weights, ...(overrides.weights || {}) },
  };
  const w = Object.values(cfg.weights);
  if (w.some((n) => typeof n !== 'number' || !Number.isFinite(n) || n < 0) || w.every((n) => n === 0)) {
    throw new Error('Scheduling weights must be non-negative numbers and not all zero.');
  }
  return cfg;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const clamp01 = (n) => clamp(n, 0, 1);
const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;
const roundUp5 = (n) => Math.ceil(n / 5) * 5;
const roundTo5 = (n) => Math.round(n / 5) * 5;
const sum = (list, fn = (x) => x) => list.reduce((n, x) => n + fn(x), 0);

export function formatMinutes(min) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/** Cleans AI-supplied text: no control characters, collapsed spaces, length limit. */
function cleanText(value, max) {
  if (typeof value !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

const statusOf = (s) => s.status || 'planned';
/** Sessions that occupy time on the calendar (missed and skipped ones do not). */
export const isActiveSession = (s) => ['planned', 'partial', 'completed'].includes(statusOf(s));

// ---------------------------------------------------------------------------
// Priority calculation
// ---------------------------------------------------------------------------

/** 0..1. Today = 1, `urgencyHorizonDays` or more away = 0, no upcoming exam = 0. */
export function computeExamUrgency(daysUntilExam, importance = 3, config = SCHEDULING_CONFIG) {
  if (daysUntilExam === null || daysUntilExam === undefined || daysUntilExam < 0) return 0;
  const timeFactor = clamp01(1 - daysUntilExam / config.urgencyHorizonDays);
  const importanceFactor = 0.6 + 0.4 * (clamp(importance, 1, 5) / 5);
  return round2(timeFactor * importanceFactor);
}

/** 0..1. How far current performance is below the target. */
export function computePerformanceGap(current, target, config = SCHEDULING_CONFIG) {
  const gap = Math.max(0, target - current);
  return round2(clamp01(gap / config.performanceGapCap));
}

/** 0..1 from a 1..5 difficulty rating. */
export function computeDifficulty(difficulty) {
  return round2(clamp01((clamp(difficulty, 1, 5) - 1) / 4));
}

export function topicCompletion(subject) {
  const topics = subject.topics || [];
  if (!topics.length) return 0;
  return topics.filter((t) => t.completed).length / topics.length;
}

/**
 * Workload estimation: the estimated workload scaled by how many topics are
 * still incomplete. If an exam is coming, at least 15% of the workload is kept
 * for revision even when every topic is ticked off.
 */
export function estimateRemainingMinutes(subject, hasUpcomingExam) {
  const total = subject.estimatedWorkloadHours * 60;
  let remaining = total * (1 - topicCompletion(subject));
  if (hasUpcomingExam) remaining = Math.max(remaining, total * 0.15);
  return roundUp5(remaining);
}

/** components: { examUrgency, performanceGap, difficulty, workload } (each 0..1). Returns 0..100. */
export function calculatePriorityScore(components, weights = SCHEDULING_CONFIG.weights) {
  const totalWeight = sum(Object.values(weights));
  if (totalWeight <= 0) return 0;
  const weighted =
    weights.examUrgency * clamp01(components.examUrgency) +
    weights.performanceGap * clamp01(components.performanceGap) +
    weights.difficulty * clamp01(components.difficulty) +
    weights.workload * clamp01(components.workload);
  return round2((100 * weighted) / totalWeight);
}

export function priorityLabel(score, config = SCHEDULING_CONFIG) {
  if (score >= config.highPriorityScore) return 'high';
  if (score >= config.mediumPriorityScore) return 'medium';
  return 'low';
}

/** The nearest exam on or after `today` for a subject, or null. */
export function findNextExam(subjectId, exams, today) {
  const upcoming = exams
    .filter((e) => e.subjectId === subjectId && e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  return upcoming[0] || null;
}

function describePriority(info) {
  const parts = [];
  if (info.nextExam) {
    const when =
      info.daysUntilExam === 0 ? 'today' : info.daysUntilExam === 1 ? 'tomorrow' : `in ${info.daysUntilExam} days`;
    parts.push(`exam ${when} (importance ${info.nextExam.importance}/5)`);
  } else {
    parts.push('no upcoming exam');
  }
  const gap = Math.max(0, info.subject.targetPerformance - info.subject.currentPerformance);
  if (gap > 0) parts.push(`${Math.round(gap)} points below target`);
  parts.push(`difficulty ${info.subject.difficulty}/5`);
  parts.push(`about ${formatMinutes(info.remainingStudyMinutes)} of study left`);
  return `${info.subject.name} is ${info.label} priority (score ${info.score}/100): ${parts.join(', ')}.`;
}

/**
 * Priority score for every subject, highest first.
 * `nudges` is an optional { [subjectId]: points } map (from sanitized AI hints).
 */
export function calculateSubjectPriorities({ subjects, exams = [], assignments = [], today, nudges = {}, config } = {}) {
  const cfg = resolveConfig(config);
  const base = subjects.map((subject) => {
    const nextExam = findNextExam(subject.id, exams, today);
    const daysUntilExam = nextExam ? daysBetween(today, nextExam.date) : null;
    const remainingStudyMinutes = estimateRemainingMinutes(subject, Boolean(nextExam));
    const assignmentMinutes = sum(
      assignments.filter((a) => a.subjectId === subject.id && !a.completed && a.dueDate >= today),
      (a) => Math.round(a.estimatedHours * 60)
    );
    return { subject, nextExam, daysUntilExam, remainingStudyMinutes, workloadMinutes: remainingStudyMinutes + assignmentMinutes };
  });
  const maxWorkload = Math.max(0, ...base.map((b) => b.workloadMinutes));

  const rows = base.map((info) => {
    const components = {
      examUrgency: computeExamUrgency(info.daysUntilExam, info.nextExam?.importance, cfg),
      performanceGap: computePerformanceGap(info.subject.currentPerformance, info.subject.targetPerformance, cfg),
      difficulty: computeDifficulty(info.subject.difficulty),
      workload: maxWorkload > 0 ? round2(clamp01(info.workloadMinutes / maxWorkload)) : 0,
    };
    const nudge = clamp(Number(nudges[info.subject.id]) || 0, -cfg.maxAiNudge, cfg.maxAiNudge);
    const score = round1(clamp(calculatePriorityScore(components, cfg.weights) + nudge, 0, 100));
    const row = {
      subjectId: info.subject.id,
      subjectName: info.subject.name,
      color: info.subject.color,
      score,
      label: priorityLabel(score, cfg),
      components,
      aiNudge: nudge,
      nextExam: info.nextExam
        ? { id: info.nextExam.id, date: info.nextExam.date, importance: info.nextExam.importance, title: info.nextExam.title, daysUntil: info.daysUntilExam }
        : null,
      daysUntilExam: info.daysUntilExam,
      completion: round2(topicCompletion(info.subject)),
      remainingStudyMinutes: info.remainingStudyMinutes,
      workloadMinutes: info.workloadMinutes,
      subject: info.subject,
    };
    row.reason = describePriority({ ...info, score, label: row.label });
    return row;
  });

  return rows
    .sort((a, b) => b.score - a.score || a.subjectName.localeCompare(b.subjectName))
    .map(({ subject, ...row }) => row); // eslint-disable-line no-unused-vars
}

// ---------------------------------------------------------------------------
// AI recommendation validation (the "repair" step for Gemini output)
// ---------------------------------------------------------------------------

function sanitizeMix(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const vals = ['learning', 'revision', 'practice'].map((k) => {
    const n = Number(raw[k]);
    return Number.isFinite(n) && n > 0 ? n : 0;
  });
  const total = sum(vals);
  if (total <= 0) return null;
  // Each activity keeps at least 10%, so the AI cannot remove revision or practice entirely.
  // Shares below the floor are raised to 10% and the others are scaled down to keep the total at 1.
  const floor = 0.1;
  let shares = vals.map((v) => v / total);
  for (let pass = 0; pass < 3; pass++) {
    const low = shares.map((s) => s < floor - 1e-9);
    if (!low.some(Boolean)) break;
    const fixed = low.filter(Boolean).length * floor;
    const highTotal = sum(shares.filter((_, i) => !low[i]));
    shares = shares.map((s, i) => (low[i] ? floor : (s * (1 - fixed)) / highTotal));
  }
  return { learning: shares[0], revision: shares[1], practice: shares[2] };
}

/**
 * Turns raw (untrusted) AI JSON into a safe structure. Unknown subjects are
 * dropped, numbers are clamped, topic names must match real topics, and text is
 * cleaned and shortened. Expected raw shape:
 *   { overallAdvice, subjectRecommendations: [{ subjectId, subjectName, priorityNudge,
 *       focusTopics: [], activityMix: {learning, revision, practice}, note }] }
 */
export function sanitizeAiRecommendations(raw, subjects, config) {
  const cfg = resolveConfig(config);
  const result = { bySubject: {}, overallAdvice: '', warnings: [] };
  if (!raw || typeof raw !== 'object') {
    result.warnings.push('The AI response was not a valid object and was ignored.');
    return result;
  }
  result.overallAdvice = cleanText(raw.overallAdvice, 600);
  const list = Array.isArray(raw.subjectRecommendations) ? raw.subjectRecommendations : [];
  const byId = new Map(subjects.map((s) => [s.id, s]));
  const byName = new Map(subjects.map((s) => [s.name.toLowerCase(), s]));

  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const subject =
      byId.get(item.subjectId) || byName.get(String(item.subjectName || '').trim().toLowerCase());
    if (!subject) {
      result.warnings.push(`Ignored a recommendation for an unknown subject "${cleanText(String(item.subjectName || item.subjectId || '?'), 40)}".`);
      continue;
    }
    if (result.bySubject[subject.id]) continue; // the first recommendation per subject wins

    const n = Number(item.priorityNudge);
    const topicByLower = new Map((subject.topics || []).map((t) => [t.name.toLowerCase(), t.name]));
    const focus = [];
    for (const name of Array.isArray(item.focusTopics) ? item.focusTopics : []) {
      const canonical = topicByLower.get(String(name).trim().toLowerCase());
      if (canonical && !focus.includes(canonical)) focus.push(canonical);
    }
    result.bySubject[subject.id] = {
      priorityNudge: Number.isFinite(n) ? clamp(n, -cfg.maxAiNudge, cfg.maxAiNudge) : 0,
      focusTopics: focus.slice(0, 10),
      activityMix: sanitizeMix(item.activityMix),
      note: cleanText(item.note, 220),
    };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Availability validation and time-slot generation
// ---------------------------------------------------------------------------

/** Checks that an availability record is usable for scheduling. Returns { ok, errors[] }. */
export function validateAvailabilityForScheduling(a) {
  const errors = [];
  if (!a || typeof a !== 'object') return { ok: false, errors: ['Availability has not been set.'] };
  if (!Array.isArray(a.studyDays) || a.studyDays.length === 0 || a.studyDays.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    errors.push('Choose at least one study day.');
  }
  if (!isValidTimeStr(a.startTime) || !isValidTimeStr(a.endTime)) {
    errors.push('The daily start and end times are not valid.');
  } else if (timeToMinutes(a.endTime) <= timeToMinutes(a.startTime)) {
    errors.push('The daily end time must be after the start time.');
  }
  if (!(a.sessionMinutes >= 15)) errors.push('The study session length must be at least 15 minutes.');
  if (!(a.maxDailyHours > 0)) errors.push('The maximum daily study hours must be greater than zero.');
  if (!(a.breakMinutes >= 0)) errors.push('The break length cannot be negative.');
  return { ok: errors.length === 0, errors };
}

/** Removes the `blocks` time ranges from the `base` ranges. Ranges are { start, end } in minutes. */
export function subtractIntervals(base, blocks) {
  let result = base.map((r) => ({ ...r }));
  for (const b of [...blocks].sort((x, y) => x.start - y.start)) {
    const next = [];
    for (const r of result) {
      if (b.end <= r.start || b.start >= r.end) {
        next.push(r);
        continue;
      }
      if (b.start > r.start) next.push({ start: r.start, end: b.start });
      if (b.end < r.end) next.push({ start: b.end, end: r.end });
    }
    result = next;
  }
  return result;
}

/**
 * Free study time on one date as [{ start, end }] in minutes after midnight.
 * Respects study days, rest dates, the daily window, weekly commitments, exams
 * on that date, and (for today) the current time. Past dates give no slots.
 */
export function generateTimeSlots(date, availability, { exams = [], now = new Date(), config } = {}) {
  const cfg = resolveConfig(config);
  if (!isValidDateStr(date) || date < todayStr(now)) return [];
  if (!availability.studyDays.includes(dayOfWeek(date))) return [];
  if ((availability.restDates || []).includes(date)) return [];

  let start = timeToMinutes(availability.startTime);
  const end = timeToMinutes(availability.endTime);
  if (date === todayStr(now)) start = Math.max(start, roundUp5(nowMinutes(now))); // never the past
  if (end - start < cfg.minSessionMinutes) return [];

  const dow = dayOfWeek(date);
  const blocks = (availability.commitments || [])
    .filter((c) => c.dayOfWeek === dow)
    .map((c) => ({ start: timeToMinutes(c.startTime), end: timeToMinutes(c.endTime) }));

  for (const exam of exams.filter((e) => e.date === date)) {
    if (!exam.startTime) return []; // exam day with no time: keep the whole day free
    const t = timeToMinutes(exam.startTime);
    blocks.push({ start: t, end: t + cfg.examBlockMinutes });
  }

  return subtractIntervals([{ start, end }], blocks).filter((i) => i.end - i.start >= cfg.minSessionMinutes);
}

// ---------------------------------------------------------------------------
// Conflict detection, breaks, per-session rules and timetable validation
// ---------------------------------------------------------------------------

const startMin = (s) => timeToMinutes(s.startTime);
const endMin = (s) => timeToMinutes(s.endTime);

/** True if two sessions overlap in time on the same date. Touching sessions do not overlap. */
export function hasOverlap(a, b) {
  return a.date === b.date && startMin(a) < endMin(b) && startMin(b) < endMin(a);
}

/** Every overlapping pair in a list of sessions. */
export function findOverlaps(sessions) {
  const active = sessions.filter(isActiveSession);
  const byDate = new Map();
  for (const s of active) {
    if (!byDate.has(s.date)) byDate.set(s.date, []);
    byDate.get(s.date).push(s);
  }
  const pairs = [];
  for (const list of byDate.values()) {
    list.sort((a, b) => startMin(a) - startMin(b));
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length && startMin(list[j]) < endMin(list[i]); j++) {
        pairs.push({ first: list[i], second: list[j] });
      }
    }
  }
  return pairs;
}

/**
 * Break insertion: breaks are not stored, they are derived from the gaps
 * between back-to-back sessions. A gap longer than `maxGapMinutes` is free
 * time rather than a break.
 */
export function deriveBreaks(sessions, breakMinutes, maxGapMinutes = 60) {
  if (!(breakMinutes > 0)) return [];
  const byDate = new Map();
  for (const s of sessions.filter(isActiveSession)) {
    if (!byDate.has(s.date)) byDate.set(s.date, []);
    byDate.get(s.date).push(s);
  }
  const breaks = [];
  for (const [date, list] of byDate) {
    list.sort((a, b) => startMin(a) - startMin(b));
    for (let i = 0; i < list.length - 1; i++) {
      const gap = startMin(list[i + 1]) - endMin(list[i]);
      if (gap > 0 && gap <= maxGapMinutes) {
        const length = Math.min(gap, breakMinutes);
        breaks.push({
          type: 'break',
          date,
          startTime: list[i].endTime,
          endTime: minutesToTime(endMin(list[i]) + length),
          durationMinutes: length,
        });
      }
    }
  }
  return breaks.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
}

/** Is [startTime, endTime] on `date` inside the student's availability? Returns { ok, reason }. */
export function isWithinAvailability(date, startTime, endTime, availability) {
  if (!availability.studyDays.includes(dayOfWeek(date))) {
    return { ok: false, reason: 'This day is not one of your study days.' };
  }
  if ((availability.restDates || []).includes(date)) {
    return { ok: false, reason: 'This date is marked as a rest day.' };
  }
  const s = timeToMinutes(startTime);
  const e = timeToMinutes(endTime);
  if (s < timeToMinutes(availability.startTime) || e > timeToMinutes(availability.endTime)) {
    return { ok: false, reason: `Sessions must be between ${availability.startTime} and ${availability.endTime}.` };
  }
  const dow = dayOfWeek(date);
  const clash = (availability.commitments || []).find(
    (c) => c.dayOfWeek === dow && s < timeToMinutes(c.endTime) && timeToMinutes(c.startTime) < e
  );
  if (clash) return { ok: false, reason: `This time overlaps your commitment "${clash.title}".` };
  return { ok: true };
}

/** Rules that apply to one session by itself (not to its neighbours). */
function checkSessionRules(session, ctx) {
  const { availability, exams = [], assignments = [], now = new Date() } = ctx;
  const problems = [];
  const add = (type, message) => problems.push({ type, message, sessionId: session.id });

  if (!isValidDateStr(session.date) || !isValidTimeStr(session.startTime) || !isValidTimeStr(session.endTime)) {
    add('invalid_format', 'The date or time is not valid.');
    return problems;
  }
  if (endMin(session) <= startMin(session)) {
    add('invalid_time', 'The end time must be after the start time (sessions cannot cross midnight).');
    return problems;
  }
  const today = todayStr(now);
  if (statusOf(session) === 'planned') {
    if (session.date < today || (session.date === today && startMin(session) < nowMinutes(now))) {
      add('in_past', 'Sessions cannot be scheduled in the past.');
    }
  }
  const avail = isWithinAvailability(session.date, session.startTime, session.endTime, availability);
  if (!avail.ok) add('outside_availability', avail.reason);

  for (const exam of exams.filter((e) => e.date === session.date)) {
    if (!exam.startTime) {
      add('exam_day', `"${exam.title}" is on this date, so it is kept free.`);
    } else {
      const t = timeToMinutes(exam.startTime);
      const examBlock = { start: t, end: t + SCHEDULING_CONFIG.examBlockMinutes };
      if (startMin(session) < examBlock.end && examBlock.start < endMin(session)) {
        add('exam_clash', `This overlaps the exam "${exam.title}".`);
      }
    }
  }

  if (session.activityType === 'assignment') {
    const a = assignments.find((x) => x.id === session.assignmentId);
    if (a && !a.completed && session.date > a.dueDate) {
      add('after_deadline', `This is after the assignment deadline (${a.dueDate}).`);
    }
  } else if (session.subjectId) {
    const next = findNextExam(session.subjectId, exams, today);
    if (next && session.date >= next.date) {
      add('after_exam', `Study sessions for this subject must be before its exam on ${next.date}.`);
    }
  }
  return problems;
}

/**
 * Full check for placing ONE session (used when creating, editing or
 * rescheduling by hand). ctx: { availability, otherSessions, exams, assignments, now }.
 * Returns { errors: [], warnings: [] }. No errors means the placement is allowed.
 */
export function checkSessionPlacement(session, ctx) {
  const errors = checkSessionRules(session, ctx);
  const warnings = [];
  const others = (ctx.otherSessions || []).filter((o) => isActiveSession(o) && o.id !== session.id);
  const valid = errors.every((e) => e.type !== 'invalid_format' && e.type !== 'invalid_time');

  if (valid) {
    const clash = others.find((o) => hasOverlap(session, o));
    if (clash) {
      errors.push({ type: 'overlap', message: `This overlaps another session (${clash.startTime}-${clash.endTime}).`, sessionId: session.id });
    }
    const dayTotal = sum(others.filter((o) => o.date === session.date), (o) => endMin(o) - startMin(o));
    const limit = Math.round(ctx.availability.maxDailyHours * 60);
    if (dayTotal + (endMin(session) - startMin(session)) > limit) {
      errors.push({ type: 'daily_limit', message: `This would exceed your daily limit of ${formatMinutes(limit)}.`, sessionId: session.id });
    }
    const brk = ctx.availability.breakMinutes || 0;
    const tooClose = others.find(
      (o) => o.date === session.date && !hasOverlap(session, o) &&
        (startMin(session) - endMin(o) < brk && startMin(session) >= endMin(o) ||
          startMin(o) - endMin(session) < brk && startMin(o) >= endMin(session))
    );
    if (tooClose) warnings.push({ type: 'short_break', message: `There is less than ${brk} minutes between this and another session.`, sessionId: session.id });
  }
  return { errors, warnings };
}

/**
 * Final validation of a timetable. `sessions` are checked in full; `fixedSessions`
 * (already existing, e.g. completed ones) are only used for overlap and daily-limit checks.
 * ctx: { availability, exams, assignments, now, fixedSessions }
 */
export function validateTimetable(sessions, ctx) {
  const errors = [];
  const warnings = [];
  const fixed = (ctx.fixedSessions || []).filter(isActiveSession);
  const mine = sessions.filter(isActiveSession);

  for (const s of mine) errors.push(...checkSessionRules(s, ctx));

  for (const { first, second } of findOverlaps([...fixed, ...mine])) {
    errors.push({
      type: 'overlap',
      message: `Sessions overlap on ${first.date}: ${first.startTime}-${first.endTime} and ${second.startTime}-${second.endTime}.`,
      sessionId: second.id,
    });
  }

  const limit = Math.round(ctx.availability.maxDailyHours * 60);
  const touched = new Set(mine.map((s) => s.date));
  for (const date of touched) {
    const total = sum([...fixed, ...mine].filter((s) => s.date === date), (s) => endMin(s) - startMin(s));
    if (total > limit) {
      errors.push({ type: 'daily_limit', message: `${date} has ${formatMinutes(total)} planned, above the ${formatMinutes(limit)} daily limit.` });
    }
  }

  const brk = ctx.availability.breakMinutes || 0;
  const all = [...fixed, ...mine].sort((a, b) => a.date.localeCompare(b.date) || startMin(a) - startMin(b));
  for (let i = 0; i < all.length - 1; i++) {
    if (all[i].date === all[i + 1].date) {
      const gap = startMin(all[i + 1]) - endMin(all[i]);
      if (gap >= 0 && gap < brk) {
        warnings.push({ type: 'short_break', message: `Less than ${brk} minutes between two sessions on ${all[i].date}.` });
      }
    }
  }
  return { valid: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// Activity allocation (revision allocation and subject distribution)
// ---------------------------------------------------------------------------

/**
 * Splits a subject's minutes into learning / practice / revision / mock tests.
 *  - Revision share grows with topic completion and when the exam is within 7 days.
 *  - Mock tests only appear when an exam is within 21 days and enough time is planned.
 *  - With no incomplete topics, the learning share moves to practice and revision.
 *  - `mix` (sanitized AI hint) can replace the learning/revision/practice proportions.
 */
export function allocateActivityMinutes(
  totalMinutes,
  { daysUntilExam = null, completion = 0, hasIncompleteTopics = true, mix = null, sessionMinutes = 50 } = {}
) {
  const total = roundTo5(Math.max(0, totalMinutes));
  const mockLen = clamp(roundTo5(sessionMinutes * 2), 60, 120);

  let mockCount = 0;
  if (daysUntilExam !== null && daysUntilExam <= 21 && total >= 180) {
    mockCount = total >= 480 ? 2 : 1;
    while (mockCount > 0 && mockCount * mockLen > total * 0.35) mockCount -= 1;
  }
  const mock = mockCount * mockLen;
  const rest = total - mock;

  let revisionShare;
  let practiceShare;
  let learningShare;
  if (mix) {
    ({ revision: revisionShare, practice: practiceShare, learning: learningShare } = mix);
  } else {
    revisionShare = clamp(0.15 + 0.3 * completion + (daysUntilExam !== null && daysUntilExam <= 7 ? 0.1 : 0), 0.15, 0.55);
    practiceShare = 0.25;
    learningShare = Math.max(0, 1 - revisionShare - practiceShare);
  }
  if (!hasIncompleteTopics) {
    revisionShare += learningShare / 2;
    practiceShare += learningShare / 2;
    learningShare = 0;
  }

  const out = {
    learning: roundTo5(rest * learningShare),
    practice: roundTo5(rest * practiceShare),
    revision: 0,
  };
  out.revision = Math.max(0, rest - out.learning - out.practice);

  // Merge any activity that ended up shorter than the smallest allowed session.
  for (const key of ['learning', 'practice', 'revision']) {
    if (out[key] > 0 && out[key] < SCHEDULING_CONFIG.minSessionMinutes) {
      const target = ['revision', 'practice', 'learning'].filter((k) => k !== key).sort((a, b) => out[b] - out[a])[0];
      out[target] += out[key];
      out[key] = 0;
    }
  }
  return { ...out, mock, mockCount, mockLen };
}

function topicLabel(names) {
  const shown = names.slice(0, 3).join(', ');
  return names.length > 3 ? `${shown} +${names.length - 3} more` : shown;
}

/** Spreads `minutes` over topic groups (about 30+ minutes each) so topics progress in order. */
function buildTopicItems(names, minutes, fallback) {
  if (minutes <= 0) return [];
  if (!names.length) return [{ topic: fallback, minutes }];
  const k = clamp(Math.floor(minutes / 30), 1, names.length);
  const base = Math.floor(names.length / k);
  const extra = names.length % k;
  const items = [];
  let index = 0;
  let used = 0;
  for (let g = 0; g < k; g++) {
    const size = base + (g < extra ? 1 : 0);
    const group = names.slice(index, index + size);
    index += size;
    const m = g === k - 1 ? minutes - used : roundTo5(minutes / k);
    used += m;
    items.push({ topic: topicLabel(group), minutes: m });
  }
  return items;
}

// ---------------------------------------------------------------------------
// Placement engine
// ---------------------------------------------------------------------------

function periodRange(period, cfg) {
  return cfg.periods[period] || null; // "any" -> no preference
}

function buildDayContext(date, { availability, exams, sessions, now, cfg, ignoreId }) {
  const free = generateTimeSlots(date, availability, { exams, now, config: cfg });
  const mine = sessions
    .filter((s) => s.date === date && isActiveSession(s) && s.id !== ignoreId)
    .map((s) => ({ id: s.id, subjectId: s.subjectId, start: startMin(s), end: endMin(s) }));
  const used = sum(mine, (s) => s.end - s.start);
  const capacityLeft = Math.max(0, Math.round(availability.maxDailyHours * 60) - used);
  const freeMinutes = sum(free, (i) => i.end - i.start);
  return {
    date,
    free,
    sessions: mine,
    capacityLeft,
    freeMinutes,
    usable: freeMinutes >= cfg.minSessionMinutes && capacityLeft >= cfg.minSessionMinutes,
  };
}

/** Length (minutes) of the same-subject run that `cand` would belong to. */
function runLength(sessions, cand, longBreak) {
  const list = [...sessions, cand].sort((a, b) => a.start - b.start);
  const i = list.indexOf(cand);
  let total = cand.end - cand.start;
  for (let j = i - 1; j >= 0; j--) {
    if (list[j].subjectId !== cand.subjectId || list[j + 1].start - list[j].end >= longBreak) break;
    total += list[j].end - list[j].start;
  }
  for (let j = i + 1; j < list.length; j++) {
    if (list[j].subjectId !== cand.subjectId || list[j].start - list[j - 1].end >= longBreak) break;
    total += list[j].end - list[j].start;
  }
  return total;
}

/**
 * Finds the earliest valid start for a session of up to `desired` minutes
 * (at least `minLen`) on one day. Candidate starts are the beginning of each free
 * window, the preferred period, and the end of every existing session plus a
 * break. Returns { start, length } or null.
 */
function findPlacement(day, desired, minLen, { cfg, breakMin, pref, subjectId }) {
  const candidates = new Set();
  for (const f of day.free) {
    candidates.add(f.start);
    if (pref && pref.start > f.start && pref.start < f.end) candidates.add(pref.start);
    for (const x of day.sessions) {
      for (const gap of [breakMin, cfg.longBreakMinutes]) {
        const t = x.end + gap;
        if (t >= f.start && t < f.end) candidates.add(t);
      }
    }
  }

  let firstAny = null;
  for (const s of [...candidates].sort((a, b) => a - b)) {
    const f = day.free.find((i) => s >= i.start && s < i.end);
    if (!f) continue;
    let maxLen = f.end - s;
    let blocked = false;
    for (const x of day.sessions) {
      if (s >= x.start - breakMin && s < x.end + breakMin) {
        blocked = true;
        break;
      }
      if (x.start - breakMin > s) maxLen = Math.min(maxLen, x.start - breakMin - s);
    }
    if (blocked) continue;

    maxLen = Math.min(maxLen, day.capacityLeft);
    let len = Math.min(desired, maxLen);
    if (len < desired) len = Math.floor(len / 5) * 5;
    if (len < minLen || len < 1) continue;

    const run = runLength(day.sessions, { start: s, end: s + len, subjectId }, cfg.longBreakMinutes);
    if (run > Math.max(cfg.maxConsecutiveSameSubjectMinutes, len)) continue;

    const found = { start: s, length: len };
    if (!pref || (s >= pref.start && s < pref.end)) return found;
    if (!firstAny) firstAny = found;
  }
  return firstAny;
}

/** Picks a chunk size that never leaves a leftover shorter than the minimum session. */
function chooseChunk(itemMinutes, sessionMinutes, cfg) {
  let chunk = Math.min(itemMinutes, sessionMinutes);
  const rest = itemMinutes - chunk;
  if (rest > 0 && rest < cfg.minSessionMinutes) {
    const shrink = cfg.minSessionMinutes - rest;
    chunk = chunk - shrink >= cfg.minSessionMinutes ? chunk - shrink : itemMinutes;
  }
  return chunk;
}

const remainingOf = (stream) => sum(stream.items, (i) => i.minutes);

/**
 * Places streams of work into the day contexts, day by day.
 * A stream = { key, subjectId, activityType, items: [{ topic, minutes }], earliestDate, deadline,
 *              noSplit, priority, priorityScore, explanation, ...meta }.
 */
function runEngine({ streams, dates, days, cfg, availability, horizonEnd, origin }) {
  const breakMin = availability.breakMinutes || 0;
  const pref = periodRange(availability.preferredPeriod, cfg);
  const out = [];

  for (const date of dates) {
    const day = days[date];
    if (!day.usable) continue;
    const active = streams.filter((s) => remainingOf(s) > 0 && s.earliestDate <= date && s.deadline >= date);
    if (!active.length) continue;

    const quota = new Map();
    const urgent = new Map();
    for (const s of active) {
      const from = s.earliestDate > date ? s.earliestDate : date;
      const to = s.deadline < horizonEnd ? s.deadline : horizonEnd;
      const eligible = Math.max(1, dates.filter((d) => d >= from && d <= to && days[d].usable).length);
      quota.set(s, s.noSplit ? s.items[0].minutes : roundUp5(Math.ceil(remainingOf(s) / eligible)));
      urgent.set(s, eligible <= 1 ? 1 : 0);
    }

    let lastSubject = null;
    for (let guard = 0; guard < 500 && day.capacityLeft >= cfg.minSessionMinutes; guard++) {
      const candidates = active
        .filter((s) => remainingOf(s) > 0 && quota.get(s) > 0)
        .sort(
          (a, b) =>
            urgent.get(b) - urgent.get(a) ||
            (a.subjectId === lastSubject) - (b.subjectId === lastSubject) ||
            b.priorityScore - a.priorityScore ||
            a.deadline.localeCompare(b.deadline) ||
            a.key.localeCompare(b.key)
        );

      let placed = false;
      for (const s of candidates) {
        const item = s.items[0];
        const desired = s.noSplit ? item.minutes : chooseChunk(item.minutes, availability.sessionMinutes, cfg);
        const minLen = s.noSplit ? desired : Math.min(cfg.minSessionMinutes, desired);
        const spot = findPlacement(day, desired, minLen, { cfg, breakMin, pref, subjectId: s.subjectId });
        if (!spot) continue;

        let len = spot.length;
        const rest = item.minutes - len;
        if (rest > 0 && rest < cfg.minSessionMinutes) {
          const shrink = cfg.minSessionMinutes - rest;
          if (len - shrink >= cfg.minSessionMinutes) len -= shrink;
          else continue;
        }

        const session = {
          subjectId: s.subjectId,
          date,
          startTime: minutesToTime(spot.start),
          endTime: minutesToTime(spot.start + len),
          durationMinutes: len,
          topic: item.topic,
          activityType: s.activityType,
          priority: s.priority,
          priorityScore: s.priorityScore,
          explanation: s.explanation,
          status: 'planned',
          completedMinutes: 0,
          origin,
        };
        if (s.assignmentId) session.assignmentId = s.assignmentId;
        if (s.examId) session.examId = s.examId;
        if (s.rescheduledFrom) session.rescheduledFrom = s.rescheduledFrom;
        out.push(session);

        day.sessions.push({ id: undefined, subjectId: s.subjectId, start: spot.start, end: spot.start + len });
        day.capacityLeft -= len;
        item.minutes -= len;
        if (item.minutes <= 0) s.items.shift();
        s.placed += len;
        quota.set(s, quota.get(s) - len);
        lastSubject = s.subjectId;
        placed = true;
        break;
      }
      if (!placed) break;
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
}

// ---------------------------------------------------------------------------
// Study plan generation
// ---------------------------------------------------------------------------

function activityReason(activityType, subject, topic, extra = {}) {
  switch (activityType) {
    case 'learning':
      return `Learn topics you have not completed yet (${topic}).`;
    case 'practice':
      return 'Practice questions to apply the concepts and find weak spots.';
    case 'revision':
      return extra.hasExam
        ? 'Revisit covered material to strengthen recall before the exam.'
        : 'Revisit covered material so earlier topics stay fresh.';
    case 'mock_test':
      return 'Timed mock test to rehearse exam conditions.';
    case 'assignment':
      return `Work on "${extra.title}", due ${extra.dueDate}.`;
    default:
      return `Study ${subject.name}.`;
  }
}

function makeExplanation(activityType, subject, topic, priority, aiNote, extra) {
  return `${activityReason(activityType, subject, topic, extra)} ${aiNote || priority.reason}`.trim();
}

function buildSubjectStreams({ subject, priority, start, horizonEnd, planDays, ai, cfg, sessionMinutes }) {
  const exam = priority.nextExam;
  const conflicts = [];
  let daysAvail;
  let deadline;
  if (exam) {
    daysAvail = daysBetween(start, exam.date);
    deadline = addDays(exam.date, -1);
    if (daysAvail <= 0) {
      conflicts.push({
        type: 'deadline_too_soon',
        severity: 'error',
        subjectId: subject.id,
        subjectName: subject.name,
        message: `${subject.name}: the exam "${exam.title}" is ${exam.date === start ? 'today' : 'already here'}, so no study sessions can be scheduled before it.`,
      });
      return { streams: [], conflicts };
    }
  } else {
    daysAvail = cfg.defaultDeadlineDays;
    deadline = addDays(start, cfg.defaultDeadlineDays - 1);
  }

  const remaining = priority.remainingStudyMinutes;
  const factor = Math.min(1, planDays / daysAvail);
  const multiplier = 0.75 + 0.5 * (priority.score / 100); // higher priority -> a bigger share
  // Exam inside the window: plan ALL remaining work. Otherwise plan a priority-weighted share.
  let total = factor >= 1 ? remaining : Math.min(remaining, remaining * factor * multiplier);
  total = Math.min(roundUp5(total), roundUp5(remaining));
  if (total < cfg.minSessionMinutes) return { streams: [], conflicts };

  const topics = subject.topics || [];
  const incompleteAll = topics.filter((t) => !t.completed).map((t) => t.name);
  const completedNames = topics.filter((t) => t.completed).map((t) => t.name);
  const note = ai.bySubject[subject.id] || {};
  const focus = (note.focusTopics || []).filter((n) => incompleteAll.includes(n));
  const incomplete = [...focus, ...incompleteAll.filter((n) => !focus.includes(n))];

  const alloc = allocateActivityMinutes(total, {
    daysUntilExam: priority.daysUntilExam,
    completion: priority.completion,
    hasIncompleteTopics: incomplete.length > 0 || topics.length === 0,
    mix: note.activityMix || null,
    sessionMinutes,
  });

  const examInWindow = Boolean(exam) && deadline <= horizonEnd;
  const clampStart = (d) => (d > start ? d : start);
  const revisionWindow = clamp(Math.floor(daysAvail * 0.6), 2, 10);
  const mockWindow = clamp(Math.floor(daysAvail * 0.4), 1, 7);

  const defs = [
    {
      type: 'learning',
      items: buildTopicItems(incomplete, alloc.learning, `${subject.name}: core concepts`),
      earliest: start,
    },
    {
      type: 'practice',
      items: buildTopicItems([...incomplete, ...completedNames], alloc.practice, `${subject.name}: practice problems`),
      earliest: start,
    },
    {
      type: 'revision',
      items: buildTopicItems(
        completedNames.length ? completedNames : [...incomplete],
        alloc.revision,
        `${subject.name}: review of covered material`
      ),
      earliest: examInWindow ? clampStart(addDays(exam.date, -revisionWindow)) : start,
    },
    {
      type: 'mock_test',
      items: Array.from({ length: alloc.mockCount }, (_, i) => ({
        topic: alloc.mockCount > 1 ? `Mock test ${i + 1}` : 'Full mock test',
        minutes: alloc.mockLen,
      })),
      earliest: examInWindow ? clampStart(addDays(exam.date, -mockWindow)) : start,
      noSplit: true,
    },
  ];

  const streams = defs
    .filter((d) => d.items.length > 0)
    .map((d) => ({
      key: `${subject.id}:${d.type}`,
      subjectId: subject.id,
      subjectName: subject.name,
      activityType: d.type,
      items: d.items,
      earliestDate: d.earliest,
      deadline,
      noSplit: Boolean(d.noSplit),
      priority: priority.label,
      priorityScore: priority.score,
      examId: exam ? exam.id : undefined,
      explanation: makeExplanation(d.type, subject, d.items[0].topic, priority, note.note, { hasExam: Boolean(exam) }),
      needed: sum(d.items, (i) => i.minutes),
      placed: 0,
    }));
  return { streams, conflicts };
}

function buildAssignmentStreams({ assignments, subjects, priorities, start, today, planDays, cfg }) {
  const streams = [];
  const conflicts = [];
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const priorityById = new Map(priorities.map((p) => [p.subjectId, p]));

  for (const a of assignments) {
    const subject = subjectById.get(a.subjectId);
    if (!subject || a.completed) continue;
    if (a.dueDate < today) {
      conflicts.push({
        type: 'assignment_overdue',
        severity: 'warning',
        subjectId: subject.id,
        subjectName: subject.name,
        assignmentId: a.id,
        message: `Assignment "${a.title}" (${subject.name}) was due on ${a.dueDate} and is not marked complete.`,
      });
      continue;
    }
    if (a.dueDate < start) continue;
    const p = priorityById.get(subject.id);
    const daysAvail = daysBetween(start, a.dueDate) + 1; // the due date itself is allowed
    const factor = Math.min(1, planDays / daysAvail);
    const minutes = roundUp5(a.estimatedHours * 60 * factor);
    if (minutes < cfg.minSessionMinutes) continue;
    const urgency = clamp01(1 - daysBetween(today, a.dueDate) / cfg.urgencyHorizonDays);
    const score = round1(0.5 * p.score + 0.5 * 100 * urgency);
    streams.push({
      key: `${subject.id}:assignment:${a.id}`,
      subjectId: subject.id,
      subjectName: subject.name,
      activityType: 'assignment',
      assignmentId: a.id,
      assignmentTitle: a.title,
      items: [{ topic: a.title, minutes }],
      earliestDate: start,
      deadline: a.dueDate,
      noSplit: false,
      priority: priorityLabel(score, cfg),
      priorityScore: score,
      explanation: makeExplanation('assignment', subject, a.title, p, '', { title: a.title, dueDate: a.dueDate }),
      needed: minutes,
      placed: 0,
    });
  }
  return { streams, conflicts };
}

function buildShortfallConflicts(streams, horizonEnd, planDays, priorities, cfg) {
  const groups = new Map();
  for (const s of streams) {
    const left = remainingOf(s);
    if (left < cfg.minSessionMinutes) continue;
    const key = s.assignmentId ? `a:${s.assignmentId}` : `s:${s.subjectId}`;
    if (!groups.has(key)) {
      groups.set(key, { stream: s, needed: 0, placed: 0, deadline: s.deadline });
    }
    const g = groups.get(key);
    g.needed += s.needed;
    g.placed += s.placed;
    if (s.deadline < g.deadline) g.deadline = s.deadline;
  }
  // Add the needed/placed of streams that were fully placed so the totals are honest.
  for (const s of streams) {
    const key = s.assignmentId ? `a:${s.assignmentId}` : `s:${s.subjectId}`;
    const g = groups.get(key);
    if (g && remainingOf(s) < cfg.minSessionMinutes) {
      g.needed += s.needed;
      g.placed += s.placed;
    }
  }
  const conflicts = [];
  for (const g of groups.values()) {
    const shortfall = g.needed - g.placed;
    const hard = g.deadline <= horizonEnd;
    const p = priorities.find((x) => x.subjectId === g.stream.subjectId);
    const when = g.stream.assignmentId
      ? `before the due date (${g.deadline})`
      : p && p.nextExam && hard
        ? `before your exam on ${p.nextExam.date}`
        : `in the next ${planDays} days`;
    const what = g.stream.assignmentId ? `Assignment "${g.stream.assignmentTitle}" (${g.stream.subjectName})` : g.stream.subjectName;
    conflicts.push({
      type: 'insufficient_time',
      severity: hard ? 'error' : 'warning',
      subjectId: g.stream.subjectId,
      subjectName: g.stream.subjectName,
      assignmentId: g.stream.assignmentId,
      neededMinutes: g.needed,
      scheduledMinutes: g.placed,
      shortfallMinutes: shortfall,
      deadline: g.deadline,
      message:
        `${what}: ${formatMinutes(g.needed)} of work is needed ${when}, but only ${formatMinutes(g.placed)} fits in your available time ` +
        `(shortfall ${formatMinutes(shortfall)}). Add study days, widen your daily window, raise the daily limit, or move the deadline.`,
    });
  }
  return conflicts;
}

function emptyResult(start, end, conflicts, priorities = [], ai = null) {
  return {
    sessions: [],
    conflicts,
    priorities,
    ai: ai ? { overallAdvice: ai.overallAdvice, warnings: ai.warnings } : null,
    validation: { valid: true, errors: [], warnings: [] },
    summary: { startDate: start, endDate: end, requiredMinutes: 0, scheduledMinutes: 0, availableMinutes: 0, sessionCount: 0 },
  };
}

/**
 * Generates a validated timetable. Pure function: it does not read or write the database.
 *
 * input: {
 *   subjects, exams, assignments, availability,
 *   existingSessions  - sessions that are kept (completed ones, or planned ones that should not move),
 *   aiRecommendations - raw AI JSON (optional; sanitized here),
 *   now, startDate, planDays, config
 * }
 * returns { sessions, conflicts, priorities, ai, validation, summary }
 * Sessions have no id / userId / planId yet; the caller adds those before saving.
 */
export function generateStudyPlan({
  subjects,
  exams = [],
  assignments = [],
  availability,
  existingSessions = [],
  aiRecommendations = null,
  now = new Date(),
  startDate,
  planDays,
  config,
}) {
  const cfg = resolveConfig(config);
  const today = todayStr(now);
  const start = startDate && startDate > today ? startDate : today;
  const days = clamp(Math.round(planDays || cfg.defaultPlanDays), 1, cfg.maxPlanDays);
  const horizonEnd = addDays(start, days - 1);
  const dates = Array.from({ length: days }, (_, i) => addDays(start, i));

  const check = validateAvailabilityForScheduling(availability);
  if (!check.ok) {
    return emptyResult(start, horizonEnd, [
      { type: 'invalid_availability', severity: 'error', message: `Your availability settings need fixing: ${check.errors.join(' ')}` },
    ]);
  }
  if (!subjects.length) {
    return emptyResult(start, horizonEnd, [
      { type: 'no_subjects', severity: 'error', message: 'Add at least one subject before generating a plan.' },
    ]);
  }

  const ai = sanitizeAiRecommendations(aiRecommendations, subjects, cfg);
  const nudges = Object.fromEntries(Object.entries(ai.bySubject).map(([id, v]) => [id, v.priorityNudge]));
  const priorities = calculateSubjectPriorities({ subjects, exams, assignments, today, nudges, config: cfg });
  const subjectById = new Map(subjects.map((s) => [s.id, s]));

  const dayContexts = {};
  for (const date of dates) {
    dayContexts[date] = buildDayContext(date, { availability, exams, sessions: existingSessions, now, cfg });
  }
  const availableMinutes = sum(dates, (d) => Math.min(dayContexts[d].freeMinutes, dayContexts[d].capacityLeft));
  if (!dates.some((d) => dayContexts[d].usable)) {
    return emptyResult(
      start,
      horizonEnd,
      [{ type: 'no_availability', severity: 'error', message: `There is no free study time in the next ${days} days. Check your study days, rest days, commitments and daily window.` }],
      priorities,
      ai
    );
  }

  const streams = [];
  const conflicts = [];
  for (const p of priorities) {
    const built = buildSubjectStreams({
      subject: subjectById.get(p.subjectId),
      priority: p,
      start,
      horizonEnd,
      planDays: days,
      ai,
      cfg,
      sessionMinutes: availability.sessionMinutes,
    });
    streams.push(...built.streams);
    conflicts.push(...built.conflicts);
  }
  const assignmentBuilt = buildAssignmentStreams({ assignments, subjects, priorities, start, today, planDays: days, cfg });
  streams.push(...assignmentBuilt.streams);
  conflicts.push(...assignmentBuilt.conflicts);

  const requiredMinutes = sum(streams, (s) => s.needed);
  const sessions = runEngine({ streams, dates, days: dayContexts, cfg, availability, horizonEnd, origin: 'ai-plan' });
  conflicts.push(...buildShortfallConflicts(streams, horizonEnd, days, priorities, cfg));

  const validation = validateTimetable(sessions, { availability, exams, assignments, now, fixedSessions: existingSessions });
  if (!validation.valid) {
    // This would be a bug in the algorithm; never hand an invalid timetable to the caller.
    throw new Error(`Internal scheduling error: ${validation.errors.map((e) => e.message).join(' | ')}`);
  }

  return {
    sessions,
    conflicts,
    priorities,
    ai: { overallAdvice: ai.overallAdvice, warnings: ai.warnings },
    validation,
    summary: {
      startDate: start,
      endDate: horizonEnd,
      requiredMinutes,
      scheduledMinutes: sum(sessions, (s) => s.durationMinutes),
      availableMinutes,
      sessionCount: sessions.length,
    },
  };
}

// ---------------------------------------------------------------------------
// Missed-task rescheduling
// ---------------------------------------------------------------------------

/**
 * Proposes new slots for missed / skipped / partially completed sessions.
 * Pure function: it returns a proposal, the caller decides whether to save it
 * (so the UI can ask for confirmation first).
 *
 * input: { missedSessions, allSessions, subjects, exams, assignments, availability, now, horizonDays, config }
 * returns { moves: [{ fromSessionId, from, to, explanation }], unplaced: [...], skipped: [...],
 *           explanation: [strings], summary }
 */
export function rescheduleMissedSessions({
  missedSessions,
  allSessions = [],
  subjects,
  exams = [],
  assignments = [],
  availability,
  now = new Date(),
  horizonDays,
  config,
}) {
  const cfg = resolveConfig(config);
  const today = todayStr(now);
  const span = clamp(Math.round(horizonDays || cfg.defaultPlanDays), 1, cfg.maxPlanDays);
  const horizonEnd = addDays(today, span - 1);
  const dates = Array.from({ length: span }, (_, i) => addDays(today, i));
  const moves = [];
  const unplaced = [];
  const skipped = [];

  const check = validateAvailabilityForScheduling(availability);
  if (!check.ok) {
    return {
      moves,
      unplaced: missedSessions.map((s) => ({ sessionId: s.id, topic: s.topic, reason: `Availability settings need fixing: ${check.errors.join(' ')}` })),
      skipped,
      explanation: [],
      summary: { requested: missedSessions.length, rescheduled: 0, unplaced: missedSessions.length, skipped: 0 },
    };
  }

  const priorities = calculateSubjectPriorities({ subjects, exams, assignments, today, config: cfg }); // recalculated
  const priorityById = new Map(priorities.map((p) => [p.subjectId, p]));
  const subjectById = new Map(subjects.map((s) => [s.id, s]));
  const missedIds = new Set(missedSessions.map((s) => s.id));
  const keep = allSessions.filter((s) => isActiveSession(s) && !missedIds.has(s.id));

  const streams = [];
  const meta = new Map();
  for (const s of missedSessions) {
    const subject = subjectById.get(s.subjectId);
    const label = `"${s.topic}"${subject ? ` (${subject.name})` : ''}`;
    if (!subject) {
      skipped.push({ sessionId: s.id, topic: s.topic, reason: 'Its subject no longer exists.' });
      continue;
    }
    if (allSessions.some((x) => x.rescheduledFrom === s.id && isActiveSession(x))) {
      skipped.push({ sessionId: s.id, topic: s.topic, reason: 'It has already been rescheduled.' });
      continue;
    }
    const unfinished = roundUp5(statusOf(s) === 'partial' ? s.durationMinutes - (s.completedMinutes || 0) : s.durationMinutes);
    if (unfinished < cfg.minSessionMinutes) {
      skipped.push({ sessionId: s.id, topic: s.topic, reason: 'Less than 15 minutes of work remains.' });
      continue;
    }

    const p = priorityById.get(subject.id);
    let deadline = horizonEnd;
    let deadlineNote = '';
    if (s.activityType === 'assignment') {
      const a = assignments.find((x) => x.id === s.assignmentId);
      if (!a) {
        skipped.push({ sessionId: s.id, topic: s.topic, reason: 'The assignment no longer exists.' });
        continue;
      }
      if (a.completed) {
        skipped.push({ sessionId: s.id, topic: s.topic, reason: 'The assignment is already marked complete.' });
        continue;
      }
      deadline = a.dueDate;
      deadlineNote = `It still finishes before the assignment is due on ${a.dueDate}.`;
    } else if (p.nextExam) {
      deadline = addDays(p.nextExam.date, -1);
      deadlineNote = `It still falls before your exam on ${p.nextExam.date}.`;
    }
    if (deadline < today) {
      unplaced.push({
        sessionId: s.id,
        topic: s.topic,
        subjectName: subject.name,
        reason: `No eligible time left: the deadline or exam date has passed or is today.`,
      });
      continue;
    }

    const key = `resched:${s.id}`;
    meta.set(key, { session: s, label, deadlineNote, subject });
    streams.push({
      key,
      subjectId: s.subjectId,
      subjectName: subject.name,
      activityType: s.activityType,
      assignmentId: s.assignmentId,
      examId: s.examId,
      rescheduledFrom: s.id,
      items: [{ topic: s.topic, minutes: unfinished }],
      earliestDate: today,
      deadline,
      noSplit: true,
      priority: p.label,
      priorityScore: p.score,
      explanation: `Rescheduled because it was ${statusOf(s)} on ${s.date}. ${p.reason}`,
      needed: unfinished,
      placed: 0,
    });
  }

  const dayContexts = {};
  for (const date of dates) {
    dayContexts[date] = buildDayContext(date, { availability, exams, sessions: keep, now, cfg });
  }
  const placed = runEngine({ streams, dates, days: dayContexts, cfg, availability, horizonEnd, origin: 'rescheduled' });

  for (const session of placed) {
    const m = meta.get(`resched:${session.rescheduledFrom}`);
    const from = { date: m.session.date, startTime: m.session.startTime, endTime: m.session.endTime };
    const explanation =
      `Moved ${m.label} from ${from.date} ${from.startTime} to ${session.date} ${session.startTime} ` +
      `because it was ${statusOf(m.session)}. ${m.deadlineNote}`.trim();
    moves.push({ fromSessionId: m.session.id, from, to: session, explanation });
  }
  const movedIds = new Set(moves.map((m) => m.fromSessionId));
  for (const st of streams) {
    if (!movedIds.has(st.rescheduledFrom)) {
      const m = meta.get(st.key);
      unplaced.push({
        sessionId: m.session.id,
        topic: m.session.topic,
        subjectName: m.subject.name,
        reason: `No free slot of ${formatMinutes(st.needed)} before ${st.deadline} within the next ${span} days.`,
      });
    }
  }

  const validation = validateTimetable(
    moves.map((m) => m.to),
    { availability, exams, assignments, now, fixedSessions: keep }
  );
  if (!validation.valid) {
    throw new Error(`Internal scheduling error: ${validation.errors.map((e) => e.message).join(' | ')}`);
  }

  return {
    moves,
    unplaced,
    skipped,
    explanation: moves.map((m) => m.explanation),
    summary: {
      requested: missedSessions.length,
      rescheduled: moves.length,
      unplaced: unplaced.length,
      skipped: skipped.length,
    },
  };
}

/**
 * Suggests free start times for a session of `minutes` length (for the manual
 * "Reschedule" dialog). One suggestion per day, earliest first.
 */
export function findAvailableSlots({
  minutes,
  fromDate,
  days = 14,
  availability,
  existingSessions = [],
  exams = [],
  subjectId = null,
  excludeSessionId = null,
  now = new Date(),
  limit = 5,
  config,
}) {
  const cfg = resolveConfig(config);
  const today = todayStr(now);
  const first = fromDate && fromDate > today ? fromDate : today;
  const pref = periodRange(availability.preferredPeriod, cfg);
  const out = [];
  for (let i = 0; i < days && out.length < limit; i++) {
    const date = addDays(first, i);
    const day = buildDayContext(date, { availability, exams, sessions: existingSessions, now, cfg, ignoreId: excludeSessionId });
    if (!day.usable || day.capacityLeft < minutes) continue;
    const spot = findPlacement(day, minutes, minutes, { cfg, breakMin: availability.breakMinutes || 0, pref, subjectId });
    if (spot) out.push({ date, startTime: minutesToTime(spot.start), endTime: minutesToTime(spot.start + minutes) });
  }
  return out;
}