/**
 * Dashboard and progress statistics. Everything is calculated from the
 * student's stored subjects, exams, assignments, sessions and progress records.
 * Nothing is invented: a brand-new account simply gets zeros and empty lists.
 */

import { store } from '../database/index.js';
import { addDays, daysBetween, startOfWeek, todayStr } from '../utils/dates.js';
import { currentPriorities, decorateSessions, loadStudentData } from './planService.js';

/** Minutes of a session that count as "planned". Work that was moved elsewhere is not counted twice. */
export function plannedMinutes(s) {
  if (s.rescheduledTo && s.status !== 'completed') return s.status === 'partial' ? s.completedMinutes || 0 : 0;
  return s.durationMinutes;
}

export function doneMinutes(s) {
  if (s.status === 'completed') return s.durationMinutes;
  if (s.status === 'partial') return Math.min(s.completedMinutes || 0, s.durationMinutes);
  return 0;
}

const sum = (list, fn) => list.reduce((n, x) => n + fn(x), 0);
const hours = (minutes) => Math.round((minutes / 60) * 10) / 10;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function computeDashboard(userId, now = new Date()) {
  const data = loadStudentData(userId);
  const today = todayStr(now);
  const weekStart = startOfWeek(today);
  const { sessions, subjects, exams, assignments } = data;

  const todays = sessions.filter((s) => s.date === today && s.status !== 'skipped');
  const due = sessions.filter((s) => s.date <= today);
  const duePlanned = sum(due, plannedMinutes);
  const dueDone = sum(due, doneMinutes);

  const subjectName = new Map(subjects.map((s) => [s.id, s.name]));
  const deadlines = [
    ...exams
      .filter((e) => e.date >= today)
      .map((e) => ({
        type: 'exam',
        id: e.id,
        title: e.title,
        subjectName: subjectName.get(e.subjectId) || 'Unknown',
        date: e.date,
        daysRemaining: daysBetween(today, e.date),
      })),
    ...assignments
      .filter((a) => !a.completed && a.dueDate >= today)
      .map((a) => ({
        type: 'assignment',
        id: a.id,
        title: a.title,
        subjectName: subjectName.get(a.subjectId) || 'Unknown',
        date: a.dueDate,
        daysRemaining: daysBetween(today, a.dueDate),
      })),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8);

  const weekly = WEEKDAYS.map((label, i) => {
    const date = addDays(weekStart, i);
    const day = sessions.filter((s) => s.date === date);
    return { date, label, plannedHours: hours(sum(day, plannedMinutes)), completedHours: hours(sum(day, doneMinutes)) };
  });

  return {
    today,
    totals: {
      subjects: subjects.length,
      upcomingExams: exams.filter((e) => e.date >= today).length,
      todayPlannedMinutes: sum(todays, plannedMinutes),
      todayCompletedMinutes: sum(todays, doneMinutes),
      completedTasks: sessions.filter((s) => s.status === 'completed').length,
      pendingTasks: sessions.filter((s) => s.status === 'planned' && s.date >= today).length,
      overdueTasks: decorateSessions(sessions, subjects, now).filter((s) => s.overdue).length,
      completionPercent: duePlanned > 0 ? Math.round((dueDone / duePlanned) * 100) : 0,
    },
    todaySessions: decorateSessions(todays, subjects, now),
    deadlines,
    priorities: currentPriorities(data, now).map((p) => ({
      subjectId: p.subjectId,
      subjectName: p.subjectName,
      color: p.color,
      score: p.score,
      label: p.label,
      reason: p.reason,
      nextExam: p.nextExam,
    })),
    weekly,
  };
}

function weekKey(date) {
  return startOfWeek(date);
}

export function computeProgress(userId, now = new Date()) {
  const data = loadStudentData(userId);
  const today = todayStr(now);
  const { sessions, subjects } = data;
  const records = store.list('progress', (r) => r.userId === userId && r.kind === 'performance');

  // Weekly planned vs completed hours for the last 8 weeks (including this one).
  const thisWeek = weekKey(today);
  const weeks = [];
  for (let i = 7; i >= 0; i--) {
    const start = addDays(thisWeek, -7 * i);
    const end = addDays(start, 6);
    const inWeek = sessions.filter((s) => s.date >= start && s.date <= end);
    weeks.push({
      weekStart: start,
      label: start.slice(5), // MM-DD
      plannedHours: hours(sum(inWeek, plannedMinutes)),
      completedHours: hours(sum(inWeek, doneMinutes)),
    });
  }

  const subjectRows = subjects.map((s) => {
    const mine = sessions.filter((x) => x.subjectId === s.id && x.date <= today);
    const planned = sum(mine, plannedMinutes);
    const done = sum(mine, doneMinutes);
    const history = records
      .filter((r) => r.subjectId === s.id)
      .sort((a, b) => a.recordedOn.localeCompare(b.recordedOn) || a.createdAt.localeCompare(b.createdAt))
      .map((r) => ({ date: r.recordedOn, value: r.value }));
    const topics = s.topics || [];
    return {
      subjectId: s.id,
      name: s.name,
      color: s.color,
      plannedHours: hours(planned),
      completedHours: hours(done),
      completionPercent: planned > 0 ? Math.round((done / planned) * 100) : 0,
      topicsDone: topics.filter((t) => t.completed).length,
      topicsTotal: topics.length,
      currentPerformance: s.currentPerformance,
      targetPerformance: s.targetPerformance,
      performanceHistory: history,
      performanceChange: history.length >= 2 ? Math.round((history[history.length - 1].value - history[0].value) * 10) / 10 : null,
    };
  });

  // Streaks: consecutive days / weeks with at least one completed minute.
  const studyDays = new Set(sessions.filter((s) => doneMinutes(s) > 0).map((s) => s.date));
  let dayStreak = 0;
  let cursor = studyDays.has(today) ? today : addDays(today, -1);
  while (studyDays.has(cursor)) {
    dayStreak += 1;
    cursor = addDays(cursor, -1);
  }
  const studyWeeks = new Set([...studyDays].map(weekKey));
  let weekStreak = 0;
  let wk = studyWeeks.has(thisWeek) ? thisWeek : addDays(thisWeek, -7);
  while (studyWeeks.has(wk)) {
    weekStreak += 1;
    wk = addDays(wk, -7);
  }

  const due = sessions.filter((s) => s.date <= today && !s.rescheduledTo);
  const completedCount = due.filter((s) => s.status === 'completed').length;

  return {
    summary: {
      totalPlannedHours: hours(sum(sessions.filter((s) => s.date <= today), plannedMinutes)),
      totalCompletedHours: hours(sum(sessions, doneMinutes)),
      sessionsCompleted: sessions.filter((s) => s.status === 'completed').length,
      taskCompletionRate: due.length ? Math.round((completedCount / due.length) * 100) : 0,
      dayStreak,
      weekStreak,
    },
    weeks,
    subjects: subjectRows,
  };
}