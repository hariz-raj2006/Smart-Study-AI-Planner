import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SCHEDULING_CONFIG,
  calculatePriorityScore,
  calculateSubjectPriorities,
  checkSessionPlacement,
  computeDifficulty,
  computeExamUrgency,
  computePerformanceGap,
  deriveBreaks,
  findAvailableSlots,
  findOverlaps,
  generateStudyPlan,
  generateTimeSlots,
  hasOverlap,
  isWithinAvailability,
  rescheduleMissedSessions,
  sanitizeAiRecommendations,
  validateTimetable,
} from '../services/schedulingService.js';
import { dayOfWeek, timeToMinutes } from '../utils/dates.js';

// Monday 12 October 2026, 09:00 local time. Every test uses this fixed "now".
const NOW = new Date(2026, 9, 12, 9, 0, 0);

const baseAvailability = () => ({
  studyDays: [1, 2, 3, 4, 5, 6],
  startTime: '16:00',
  endTime: '21:00',
  breakMinutes: 10,
  sessionMinutes: 50,
  maxDailyHours: 4,
  preferredPeriod: 'evening',
  restDates: [],
  commitments: [],
});

const topics = (names, done = []) => names.map((n) => ({ id: n, name: n, completed: done.includes(n) }));

const mathSubject = () => ({
  id: 'math',
  name: 'Mathematics',
  color: '#4f46e5',
  difficulty: 5,
  currentPerformance: 40,
  targetPerformance: 85,
  estimatedWorkloadHours: 10,
  topics: topics(['Algebra', 'Calculus', 'Geometry', 'Statistics'], ['Algebra']),
});

const historySubject = () => ({
  id: 'hist',
  name: 'History',
  color: '#10b981',
  difficulty: 2,
  currentPerformance: 72,
  targetPerformance: 75,
  estimatedWorkloadHours: 4,
  topics: topics(['Ancient', 'Medieval']),
});

const mathExam = (date = '2026-10-17') => ({ id: 'e1', subjectId: 'math', title: 'Math Final', date, importance: 5 });

function sessionOf(over = {}) {
  return {
    id: 'x1',
    subjectId: 'math',
    date: '2026-10-13',
    startTime: '17:00',
    endTime: '17:50',
    durationMinutes: 50,
    topic: 'Calculus',
    activityType: 'learning',
    status: 'planned',
    completedMinutes: 0,
    ...over,
  };
}

// ---------------------------------------------------------------------------
// Priority calculation
// ---------------------------------------------------------------------------

test('default weights add up to 1', () => {
  const total = Object.values(SCHEDULING_CONFIG.weights).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
});

test('exam urgency: today is 1, far away is 0, importance lowers it', () => {
  assert.equal(computeExamUrgency(0, 5), 1);
  assert.equal(computeExamUrgency(30, 5), 0);
  assert.equal(computeExamUrgency(45, 5), 0);
  assert.equal(computeExamUrgency(null, 5), 0);
  assert.equal(computeExamUrgency(-2, 5), 0);
  assert.equal(computeExamUrgency(15, 5), 0.5);
  assert.ok(computeExamUrgency(5, 1) < computeExamUrgency(5, 5));
  assert.ok(computeExamUrgency(2, 3) > computeExamUrgency(10, 3));
});

test('performance gap and difficulty are normalised to 0..1', () => {
  assert.equal(computePerformanceGap(40, 90), 1);
  assert.equal(computePerformanceGap(40, 65), 0.5);
  assert.equal(computePerformanceGap(90, 80), 0);
  assert.equal(computeDifficulty(1), 0);
  assert.equal(computeDifficulty(3), 0.5);
  assert.equal(computeDifficulty(5), 1);
});

test('priority score uses the weighted formula', () => {
  const all = { examUrgency: 1, performanceGap: 1, difficulty: 1, workload: 1 };
  assert.equal(calculatePriorityScore(all), 100);
  assert.equal(calculatePriorityScore({ ...all, performanceGap: 0, difficulty: 0, workload: 0 }), 40);
  assert.equal(calculatePriorityScore({ examUrgency: 0, performanceGap: 1, difficulty: 0, workload: 0 }), 30);
  assert.equal(calculatePriorityScore({ examUrgency: 0, performanceGap: 0, difficulty: 0, workload: 0 }), 0);
  // custom weights are normalised, so doubling every weight changes nothing
  const doubled = { examUrgency: 0.8, performanceGap: 0.6, difficulty: 0.4, workload: 0.2 };
  const comps = { examUrgency: 0.5, performanceGap: 0.2, difficulty: 1, workload: 0.3 };
  assert.equal(calculatePriorityScore(comps, doubled), calculatePriorityScore(comps));
});

test('a close exam, weak marks and high difficulty rank first', () => {
  const ranked = calculateSubjectPriorities({
    subjects: [historySubject(), mathSubject()],
    exams: [mathExam()],
    assignments: [],
    today: '2026-10-12',
  });
  assert.equal(ranked[0].subjectId, 'math');
  assert.equal(ranked[0].label, 'high');
  assert.equal(ranked[1].label, 'low');
  assert.ok(ranked[0].score > ranked[1].score);
  assert.ok(ranked[0].reason.includes('Mathematics'));
});

test('AI nudges are limited to +/- maxAiNudge points', () => {
  const plain = calculateSubjectPriorities({ subjects: [historySubject()], today: '2026-10-12' })[0].score;
  const nudged = calculateSubjectPriorities({ subjects: [historySubject()], today: '2026-10-12', nudges: { hist: 500 } })[0].score;
  assert.equal(Math.round((nudged - plain) * 10) / 10, SCHEDULING_CONFIG.maxAiNudge);
});

// ---------------------------------------------------------------------------
// AI response validation
// ---------------------------------------------------------------------------

test('sanitizeAiRecommendations drops unknown subjects and clamps values', () => {
  const clean = sanitizeAiRecommendations(
    {
      overallAdvice: 'Focus  on\nmaths.\u0007',
      subjectRecommendations: [
        { subjectId: 'math', priorityNudge: 99, focusTopics: ['calculus', 'Not a topic'], activityMix: { learning: 5, revision: 0, practice: 0 }, note: 'Hard topic.' },
        { subjectId: 'ghost', priorityNudge: 3 },
        { subjectName: 'history', priorityNudge: -50 },
      ],
    },
    [mathSubject(), historySubject()]
  );
  assert.equal(clean.bySubject.math.priorityNudge, 10);
  assert.deepEqual(clean.bySubject.math.focusTopics, ['Calculus']);
  assert.ok(clean.bySubject.math.activityMix.revision >= 0.0999, 'revision keeps a minimum share');
  assert.equal(clean.bySubject.hist.priorityNudge, -10);
  assert.equal(clean.bySubject.ghost, undefined);
  assert.equal(clean.warnings.length, 1);
  assert.equal(clean.overallAdvice, 'Focus on maths.');
});

test('sanitizeAiRecommendations survives garbage', () => {
  assert.deepEqual(sanitizeAiRecommendations(null, [mathSubject()]).bySubject, {});
  assert.deepEqual(sanitizeAiRecommendations('hello', [mathSubject()]).bySubject, {});
  assert.deepEqual(sanitizeAiRecommendations({ subjectRecommendations: 5 }, [mathSubject()]).bySubject, {});
});

// ---------------------------------------------------------------------------
// Overlaps and breaks
// ---------------------------------------------------------------------------

test('overlap detection treats touching sessions as separate', () => {
  const a = sessionOf({ id: 'a', startTime: '17:00', endTime: '17:50' });
  const b = sessionOf({ id: 'b', startTime: '17:50', endTime: '18:30' });
  const c = sessionOf({ id: 'c', startTime: '17:30', endTime: '18:00' });
  const d = sessionOf({ id: 'd', date: '2026-10-14', startTime: '17:30', endTime: '18:00' });
  assert.equal(hasOverlap(a, b), false);
  assert.equal(hasOverlap(a, c), true);
  assert.equal(hasOverlap(a, d), false);
  const pairs = findOverlaps([a, b, c, d]);
  assert.equal(pairs.length, 2); // a-c and c-b
});

test('missed and skipped sessions do not count as overlaps', () => {
  const a = sessionOf({ id: 'a' });
  const b = sessionOf({ id: 'b', status: 'missed' });
  assert.equal(findOverlaps([a, b]).length, 0);
});

test('deriveBreaks makes breaks only from gaps between sessions', () => {
  const list = [
    sessionOf({ id: 'a', startTime: '17:00', endTime: '17:50' }),
    sessionOf({ id: 'b', startTime: '18:00', endTime: '18:50' }),
    sessionOf({ id: 'c', startTime: '20:30', endTime: '21:00' }),
  ];
  const breaks = deriveBreaks(list, 10);
  assert.equal(breaks.length, 1);
  assert.equal(breaks[0].startTime, '17:50');
  assert.equal(breaks[0].endTime, '18:00');
  assert.deepEqual(deriveBreaks(list, 0), []);
});

// ---------------------------------------------------------------------------
// Availability constraints
// ---------------------------------------------------------------------------

test('isWithinAvailability checks days, rest dates, window and commitments', () => {
  const a = { ...baseAvailability(), restDates: ['2026-10-14'], commitments: [{ title: 'Tuition', dayOfWeek: 2, startTime: '18:00', endTime: '19:00' }] };
  assert.equal(isWithinAvailability('2026-10-13', '17:00', '17:50', a).ok, true);
  assert.equal(isWithinAvailability('2026-10-18', '17:00', '17:50', a).ok, false); // Sunday
  assert.equal(isWithinAvailability('2026-10-14', '17:00', '17:50', a).ok, false); // rest date
  assert.equal(isWithinAvailability('2026-10-13', '15:00', '15:50', a).ok, false); // before window
  assert.equal(isWithinAvailability('2026-10-13', '20:30', '21:30', a).ok, false); // after window
  assert.equal(isWithinAvailability('2026-10-13', '17:30', '18:30', a).ok, false); // commitment (Tuesday)
});

test('generateTimeSlots removes commitments and never offers the past', () => {
  const a = { ...baseAvailability(), commitments: [{ title: 'Club', dayOfWeek: 1, startTime: '17:00', endTime: '18:00' }] };
  const slots = generateTimeSlots('2026-10-12', a, { now: NOW });
  assert.deepEqual(slots, [
    { start: timeToMinutes('16:00'), end: timeToMinutes('17:00') },
    { start: timeToMinutes('18:00'), end: timeToMinutes('21:00') },
  ]);
  const late = new Date(2026, 9, 12, 18, 7);
  const lateSlots = generateTimeSlots('2026-10-12', a, { now: late });
  assert.equal(lateSlots[0].start, timeToMinutes('18:10'));
  assert.deepEqual(generateTimeSlots('2026-10-11', a, { now: NOW }), []);
  assert.deepEqual(generateTimeSlots('2026-10-18', a, { now: NOW }), []); // Sunday
});

test('exam day is kept free, or blocked only around the exam time', () => {
  const noTime = generateTimeSlots('2026-10-13', baseAvailability(), { now: NOW, exams: [{ date: '2026-10-13', title: 'X' }] });
  assert.deepEqual(noTime, []);
  const timed = generateTimeSlots('2026-10-13', baseAvailability(), { now: NOW, exams: [{ date: '2026-10-13', title: 'X', startTime: '16:00' }] });
  assert.deepEqual(timed, [{ start: timeToMinutes('19:00'), end: timeToMinutes('21:00') }]);
});

// ---------------------------------------------------------------------------
// Plan generation
// ---------------------------------------------------------------------------

function makePlan(overrides = {}) {
  return generateStudyPlan({
    subjects: [mathSubject(), historySubject()],
    exams: [mathExam()],
    assignments: [{ id: 'as1', subjectId: 'hist', title: 'Essay', dueDate: '2026-10-16', estimatedHours: 2, completed: false }],
    availability: baseAvailability(),
    now: NOW,
    planDays: 14,
    ...overrides,
  });
}

test('generated plan respects availability, has no overlaps and no past sessions', () => {
  const plan = makePlan({ availability: { ...baseAvailability(), restDates: ['2026-10-14'] } });
  assert.ok(plan.sessions.length > 0);
  assert.equal(plan.validation.valid, true);
  assert.equal(findOverlaps(plan.sessions).length, 0);

  for (const s of plan.sessions) {
    assert.notEqual(dayOfWeek(s.date), 0, 'no Sunday sessions');
    assert.notEqual(s.date, '2026-10-14', 'no rest-day sessions');
    assert.ok(timeToMinutes(s.startTime) >= 16 * 60 && timeToMinutes(s.endTime) <= 21 * 60);
    assert.ok(s.date >= '2026-10-12');
    assert.ok(s.durationMinutes >= 15);
    assert.equal(timeToMinutes(s.endTime) - timeToMinutes(s.startTime), s.durationMinutes);
  }
});

test('daily limit and breaks are respected', () => {
  const plan = makePlan();
  const perDay = new Map();
  for (const s of plan.sessions) perDay.set(s.date, (perDay.get(s.date) || 0) + s.durationMinutes);
  for (const total of perDay.values()) assert.ok(total <= 4 * 60);

  const sorted = [...plan.sessions].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].date === sorted[i + 1].date) {
      const gap = timeToMinutes(sorted[i + 1].startTime) - timeToMinutes(sorted[i].endTime);
      assert.ok(gap >= 10, `gap of ${gap} minutes is shorter than the break`);
    }
  }
});

test('subject sessions are before the exam; assignment work is on or before the due date', () => {
  const plan = makePlan();
  for (const s of plan.sessions.filter((x) => x.subjectId === 'math')) assert.ok(s.date < '2026-10-17');
  const assignmentSessions = plan.sessions.filter((x) => x.activityType === 'assignment');
  assert.ok(assignmentSessions.length > 0);
  for (const s of assignmentSessions) assert.ok(s.date <= '2026-10-16');
});

test('plan contains learning, practice and revision for the exam subject, revision late', () => {
  const plan = makePlan();
  const math = plan.sessions.filter((s) => s.subjectId === 'math');
  const types = new Set(math.map((s) => s.activityType));
  for (const t of ['learning', 'practice', 'revision']) assert.ok(types.has(t), `missing ${t}`);
  const firstRevision = math.find((s) => s.activityType === 'revision');
  const firstLearning = math.find((s) => s.activityType === 'learning');
  assert.ok(firstRevision.date >= firstLearning.date);
  for (const s of plan.sessions) {
    assert.ok(s.explanation.length > 10);
    assert.ok(['high', 'medium', 'low'].includes(s.priority));
  }
});

test('the same subject is not scheduled continuously for too long', () => {
  const plan = generateStudyPlan({
    subjects: [{ ...mathSubject(), estimatedWorkloadHours: 40 }],
    exams: [],
    availability: { ...baseAvailability(), startTime: '10:00', endTime: '22:00', maxDailyHours: 8 },
    now: NOW,
    planDays: 5,
  });
  const byDate = new Map();
  for (const s of plan.sessions) {
    if (!byDate.has(s.date)) byDate.set(s.date, []);
    byDate.get(s.date).push(s);
  }
  for (const list of byDate.values()) {
    list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    let run = 0;
    for (let i = 0; i < list.length; i++) {
      const gap = i === 0 ? 999 : timeToMinutes(list[i].startTime) - timeToMinutes(list[i - 1].endTime);
      run = gap >= SCHEDULING_CONFIG.longBreakMinutes ? list[i].durationMinutes : run + list[i].durationMinutes;
      assert.ok(run <= 120, `run of ${run} minutes`);
    }
  }
});

test('insufficient time is reported as a conflict and the schedule stays valid', () => {
  const plan = generateStudyPlan({
    subjects: [{ ...mathSubject(), estimatedWorkloadHours: 40 }],
    exams: [mathExam('2026-10-15')],
    availability: { ...baseAvailability(), startTime: '16:00', endTime: '17:00', maxDailyHours: 1 },
    now: NOW,
    planDays: 14,
  });
  const conflict = plan.conflicts.find((c) => c.type === 'insufficient_time');
  assert.ok(conflict, 'expected an insufficient_time conflict');
  assert.equal(conflict.severity, 'error');
  assert.ok(conflict.shortfallMinutes > 0);
  assert.ok(conflict.message.includes('Mathematics'));
  assert.equal(plan.validation.valid, true);
  assert.ok(plan.summary.scheduledMinutes < plan.summary.requiredMinutes);
});

test('an exam today or in the past leaves no sessions and explains why', () => {
  const plan = generateStudyPlan({
    subjects: [mathSubject()],
    exams: [mathExam('2026-10-12')],
    availability: baseAvailability(),
    now: NOW,
  });
  assert.equal(plan.sessions.filter((s) => s.subjectId === 'math').length, 0);
  assert.ok(plan.conflicts.some((c) => c.type === 'deadline_too_soon'));
});

test('no availability gives a clear conflict instead of an empty silent plan', () => {
  const plan = makePlan({ availability: { ...baseAvailability(), studyDays: [0], restDates: [] }, planDays: 1 });
  assert.equal(plan.sessions.length, 0);
  assert.equal(plan.conflicts[0].type, 'no_availability');

  const bad = makePlan({ availability: { ...baseAvailability(), studyDays: [] } });
  assert.equal(bad.conflicts[0].type, 'invalid_availability');
});

test('existing sessions are kept and never overlapped', () => {
  const existing = [sessionOf({ id: 'keep1', date: '2026-10-12', startTime: '16:00', endTime: '19:00', durationMinutes: 180, status: 'completed' })];
  const plan = makePlan({ existingSessions: existing });
  assert.equal(findOverlaps([...existing, ...plan.sessions]).length, 0);
  const todays = plan.sessions.filter((s) => s.date === '2026-10-12');
  const todayMinutes = todays.reduce((n, s) => n + s.durationMinutes, 0);
  assert.ok(todayMinutes + 180 <= 4 * 60, 'daily limit counts the existing session');
});

test('AI hints influence topic order but cannot break constraints', () => {
  const plan = makePlan({
    aiRecommendations: {
      overallAdvice: 'Start with calculus.',
      subjectRecommendations: [{ subjectId: 'math', priorityNudge: 10, focusTopics: ['Statistics'], note: 'Statistics carries the most marks.' }],
    },
  });
  const firstLearning = plan.sessions.find((s) => s.subjectId === 'math' && s.activityType === 'learning');
  assert.ok(firstLearning.topic.startsWith('Statistics'));
  assert.ok(firstLearning.explanation.includes('Statistics carries'));
  assert.equal(plan.validation.valid, true);
  assert.equal(plan.ai.overallAdvice, 'Start with calculus.');
});

test('plan without any AI input still works (the algorithm is standalone)', () => {
  const plan = makePlan({ aiRecommendations: null });
  assert.ok(plan.sessions.length > 0);
});

// ---------------------------------------------------------------------------
// Placement checks (manual edit / reschedule)
// ---------------------------------------------------------------------------

test('checkSessionPlacement rejects overlaps, closed days and the past', () => {
  const ctx = { availability: baseAvailability(), exams: [mathExam()], assignments: [], now: NOW };
  const other = sessionOf({ id: 'o1', startTime: '17:00', endTime: '17:50' });

  const overlap = checkSessionPlacement(sessionOf({ id: 'n1', startTime: '17:30', endTime: '18:20' }), { ...ctx, otherSessions: [other] });
  assert.ok(overlap.errors.some((e) => e.type === 'overlap'));

  const sunday = checkSessionPlacement(sessionOf({ id: 'n2', date: '2026-10-18' }), { ...ctx, otherSessions: [] });
  assert.ok(sunday.errors.some((e) => e.type === 'outside_availability'));

  const past = checkSessionPlacement(sessionOf({ id: 'n3', date: '2026-10-12', startTime: '08:00', endTime: '08:50' }), { ...ctx, otherSessions: [] });
  assert.ok(past.errors.some((e) => e.type === 'in_past'));

  const afterExam = checkSessionPlacement(sessionOf({ id: 'n4', date: '2026-10-19' }), { ...ctx, otherSessions: [] });
  assert.ok(afterExam.errors.some((e) => e.type === 'after_exam'));

  const ok = checkSessionPlacement(sessionOf({ id: 'n5', startTime: '18:00', endTime: '18:50' }), { ...ctx, otherSessions: [other] });
  assert.deepEqual(ok.errors, []);
  assert.equal(ok.warnings.length, 0);

  const tight = checkSessionPlacement(sessionOf({ id: 'n6', startTime: '17:50', endTime: '18:40' }), { ...ctx, otherSessions: [other] });
  assert.deepEqual(tight.errors, []);
  assert.ok(tight.warnings.some((w) => w.type === 'short_break'));
});

test('daily limit is enforced for manual placement', () => {
  const ctx = { availability: { ...baseAvailability(), maxDailyHours: 1 }, exams: [], now: NOW };
  const other = sessionOf({ id: 'o1', startTime: '16:00', endTime: '16:50' });
  const res = checkSessionPlacement(sessionOf({ id: 'n1', startTime: '17:00', endTime: '17:50' }), { ...ctx, otherSessions: [other] });
  assert.ok(res.errors.some((e) => e.type === 'daily_limit'));
});

test('validateTimetable catches an invalid hand-made timetable', () => {
  const result = validateTimetable(
    [
      sessionOf({ id: 'a', startTime: '17:00', endTime: '18:00' }),
      sessionOf({ id: 'b', startTime: '17:30', endTime: '18:30' }),
      sessionOf({ id: 'c', date: '2026-10-18' }),
      sessionOf({ id: 'd', startTime: '19:00', endTime: '18:00' }),
    ],
    { availability: baseAvailability(), exams: [], assignments: [], now: NOW }
  );
  assert.equal(result.valid, false);
  const types = result.errors.map((e) => e.type);
  assert.ok(types.includes('overlap'));
  assert.ok(types.includes('outside_availability'));
  assert.ok(types.includes('invalid_time'));
});

test('findAvailableSlots suggests valid, non-overlapping times', () => {
  const existing = [sessionOf({ id: 'e1', date: '2026-10-13', startTime: '17:00', endTime: '17:50' })];
  const slots = findAvailableSlots({
    minutes: 50,
    fromDate: '2026-10-13',
    availability: baseAvailability(),
    existingSessions: existing,
    now: NOW,
    limit: 3,
  });
  assert.equal(slots.length, 3);
  assert.equal(slots[0].date, '2026-10-13');
  assert.equal(slots[0].startTime, '18:00'); // 17:50 + 10 minute break
  for (const s of slots) assert.equal(isWithinAvailability(s.date, s.startTime, s.endTime, baseAvailability()).ok, true);
});

// ---------------------------------------------------------------------------
// Rescheduling
// ---------------------------------------------------------------------------

const TUESDAY = new Date(2026, 9, 13, 9, 0, 0);

function rescheduleInput(over = {}) {
  const missed = sessionOf({ id: 'm1', date: '2026-10-12', startTime: '16:00', endTime: '16:50', status: 'missed' });
  const planned = sessionOf({ id: 'p1', date: '2026-10-13', startTime: '16:00', endTime: '16:50' });
  return {
    missedSessions: [missed],
    allSessions: [missed, planned],
    subjects: [mathSubject(), historySubject()],
    exams: [mathExam()],
    assignments: [],
    availability: baseAvailability(),
    now: TUESDAY,
    ...over,
  };
}

test('a missed session is moved to a free future slot before the exam', () => {
  const result = rescheduleMissedSessions(rescheduleInput());
  assert.equal(result.moves.length, 1);
  const move = result.moves[0];
  assert.equal(move.fromSessionId, 'm1');
  assert.ok(move.to.date >= '2026-10-13' && move.to.date < '2026-10-17');
  assert.equal(move.to.origin, 'rescheduled');
  assert.equal(move.to.rescheduledFrom, 'm1');
  assert.equal(move.to.topic, 'Calculus');
  assert.equal(move.to.durationMinutes, 50);
  assert.ok(move.explanation.includes('Moved'));
  assert.equal(findOverlaps([sessionOf({ id: 'p1', date: '2026-10-13', startTime: '16:00', endTime: '16:50' }), move.to]).length, 0);
  assert.ok(result.summary.rescheduled === 1 && result.summary.unplaced === 0);
});

test('rescheduling never creates duplicates', () => {
  const input = rescheduleInput();
  const first = rescheduleMissedSessions(input);
  const saved = { ...first.moves[0].to, id: 'new1' };
  const second = rescheduleMissedSessions({ ...input, allSessions: [...input.allSessions, saved] });
  assert.equal(second.moves.length, 0);
  assert.equal(second.skipped[0].reason, 'It has already been rescheduled.');
});

test('nothing is rescheduled past the exam date', () => {
  const result = rescheduleMissedSessions(rescheduleInput({ exams: [mathExam('2026-10-13')] }));
  assert.equal(result.moves.length, 0);
  assert.equal(result.unplaced.length, 1);
  assert.ok(result.unplaced[0].reason.includes('deadline'));
});

test('a partially completed session only reschedules the unfinished part', () => {
  const partial = sessionOf({ id: 'pp', date: '2026-10-12', startTime: '16:00', endTime: '16:50', status: 'partial', completedMinutes: 30 });
  const result = rescheduleMissedSessions(rescheduleInput({ missedSessions: [partial], allSessions: [partial] }));
  assert.equal(result.moves.length, 1);
  assert.equal(result.moves[0].to.durationMinutes, 20);
});

test('assignment sessions stop at the due date and are dropped when complete', () => {
  const missed = sessionOf({ id: 'am', subjectId: 'hist', activityType: 'assignment', assignmentId: 'as1', topic: 'Essay', date: '2026-10-12', status: 'missed' });
  const base = rescheduleInput({
    missedSessions: [missed],
    allSessions: [missed],
    assignments: [{ id: 'as1', subjectId: 'hist', title: 'Essay', dueDate: '2026-10-14', estimatedHours: 2, completed: false }],
  });
  const ok = rescheduleMissedSessions(base);
  assert.equal(ok.moves.length, 1);
  assert.ok(ok.moves[0].to.date <= '2026-10-14');
  assert.equal(ok.moves[0].to.assignmentId, 'as1');

  const done = rescheduleMissedSessions({ ...base, assignments: [{ ...base.assignments[0], completed: true }] });
  assert.equal(done.moves.length, 0);
  assert.equal(done.skipped.length, 1);
});

test('rescheduling with no free time reports the problem', () => {
  const result = rescheduleMissedSessions(
    rescheduleInput({ availability: { ...baseAvailability(), studyDays: [0] } })
  );
  assert.equal(result.moves.length, 0);
  assert.equal(result.unplaced.length, 1);
});