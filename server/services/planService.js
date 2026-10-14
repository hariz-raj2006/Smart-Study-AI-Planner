/**
 * Plan service: glue between the database and the pure scheduling module.
 * It loads one student's data, runs the scheduler and saves the result.
 * Every query is filtered by userId, so one student can never see another's data.
 */

import { store } from '../database/index.js';
import { defaultAvailability } from '../database/defaults.js';
import { AppError } from '../utils/AppError.js';
import { newRow } from '../utils/rows.js';
import { nowMinutes, timeToMinutes, todayStr, addDays } from '../utils/dates.js';
import {
  calculateSubjectPriorities,
  generateStudyPlan,
  generateTimeSlots,
  isActiveSession,
  validateAvailabilityForScheduling,
} from './schedulingService.js';

/** Sessions with these origins were created by the planner and may be replaced by a new plan. */
export const REPLACEABLE_ORIGINS = ['ai-plan', 'local-plan', 'rescheduled'];

const startOf = (s) => timeToMinutes(s.startTime);
const endOf = (s) => timeToMinutes(s.endTime);

/** A planned session whose end time has already passed. */
export function isOverdue(session, now = new Date()) {
  if (session.status !== 'planned') return false;
  const today = todayStr(now);
  return session.date < today || (session.date === today && endOf(session) <= nowMinutes(now));
}

/** Planner-made sessions that start in the future and are still untouched. */
export function isReplaceable(session, now = new Date()) {
  if (session.status !== 'planned' || !REPLACEABLE_ORIGINS.includes(session.origin)) return false;
  const today = todayStr(now);
  return session.date > today || (session.date === today && startOf(session) > nowMinutes(now));
}

export function loadStudentData(userId) {
  const mine = (row) => row.userId === userId;
  return {
    subjects: store.list('subjects', mine),
    exams: store.list('exams', mine),
    assignments: store.list('assignments', mine),
    availability: store.findOne('availability', mine) || defaultAvailability(userId),
    sessions: store.list('sessions', mine),
  };
}

export function decorateSessions(sessions, subjects, now = new Date()) {
  const bySubject = new Map(subjects.map((s) => [s.id, s]));
  return sessions
    .map((s) => {
      const subject = bySubject.get(s.subjectId);
      return {
        ...s,
        subjectName: subject ? subject.name : 'Deleted subject',
        subjectColor: subject ? subject.color : '#64748b',
        overdue: isOverdue(s, now),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
}

/** Step 1 of "Generate AI Study Plan": validate the student's academic information. */
export function validateAcademicData(data) {
  const issues = [];
  if (!data.subjects.length) issues.push('Add at least one subject first.');
  const availability = validateAvailabilityForScheduling(data.availability);
  if (!availability.ok) issues.push(...availability.errors);
  if (issues.length) {
    throw new AppError(400, issues.join(' '), { code: 'INCOMPLETE_DATA', details: issues });
  }
}

/** Asks for confirmation before replacing an existing timetable. */
export function requireConfirmation(data, now, confirm) {
  const count = data.sessions.filter((s) => isReplaceable(s, now)).length;
  if (count > 0 && !confirm) {
    throw new AppError(
      409,
      `Generating a new plan will replace ${count} upcoming planned session${count === 1 ? '' : 's'}. ` +
        'Completed sessions, missed sessions and sessions you added by hand are kept.',
      { code: 'CONFIRM_REQUIRED', details: { replaceCount: count } }
    );
  }
  return count;
}

export function currentPriorities(data, now = new Date()) {
  return calculateSubjectPriorities({
    subjects: data.subjects,
    exams: data.exams,
    assignments: data.assignments,
    today: todayStr(now),
  });
}

/**
 * Runs the scheduler and saves the plan. `aiRaw` is Gemini's raw JSON (or null for a
 * local-only plan). Returns everything the frontend needs to show the result.
 */
export function generateAndSavePlan({ userId, data, now, planDays, aiRaw, aiUsed, aiModel }) {
  const kept = data.sessions.filter((s) => !isReplaceable(s, now));
  const result = generateStudyPlan({
    subjects: data.subjects,
    exams: data.exams,
    assignments: data.assignments,
    availability: data.availability,
    existingSessions: kept,
    aiRecommendations: aiRaw,
    now,
    planDays,
  });

  if (!result.sessions.length) {
    // Do not touch the existing timetable when nothing could be scheduled.
    throw new AppError(
      422,
      result.conflicts[0]?.message || 'No study sessions could be scheduled with the current settings.',
      { code: 'NO_SESSIONS', details: result.conflicts }
    );
  }

  const replaceIds = new Set(data.sessions.filter((s) => isReplaceable(s, now)).map((s) => s.id));
  const origin = aiUsed ? 'ai-plan' : 'local-plan';

  const saved = store.mutate((d) => {
    d.sessions = d.sessions.filter((s) => !replaceIds.has(s.id));
    for (const plan of d.plans) {
      if (plan.userId === userId && plan.status === 'active') plan.status = 'archived';
    }
    const plan = newRow({
      userId,
      title: `Study plan ${result.summary.startDate} to ${result.summary.endDate}`,
      startDate: result.summary.startDate,
      endDate: result.summary.endDate,
      status: 'active',
      aiUsed,
      aiModel: aiUsed ? aiModel : null,
      aiAdvice: result.ai?.overallAdvice || '',
      aiWarnings: result.ai?.warnings || [],
      conflicts: result.conflicts,
      priorities: result.priorities,
      summary: result.summary,
    });
    d.plans.push(plan);
    const sessions = result.sessions.map((s) => newRow({ ...s, userId, planId: plan.id, origin }));
    d.sessions.push(...sessions);
    return { plan: structuredClone(plan), sessions: structuredClone(sessions) };
  });

  return {
    plan: saved.plan,
    sessions: decorateSessions(saved.sessions, data.subjects, now),
    conflicts: result.conflicts,
    priorities: result.priorities,
    summary: result.summary,
    aiAdvice: result.ai?.overallAdvice || '',
    aiWarnings: result.ai?.warnings || [],
    aiUsed,
    replaced: replaceIds.size,
  };
}

/** Compact, per-student context for the AI assistant. Contains only this student's data. */
export function buildAssistantContext(userId, now = new Date()) {
  const data = loadStudentData(userId);
  const today = todayStr(now);
  const priorities = currentPriorities(data, now);
  const bySubject = new Map(data.subjects.map((s) => [s.id, s]));
  const brief = (s) => ({
    subject: bySubject.get(s.subjectId)?.name || 'Unknown',
    date: s.date,
    time: `${s.startTime}-${s.endTime}`,
    minutes: s.durationMinutes,
    topic: s.topic,
    activity: s.activityType,
    status: isOverdue(s, now) ? 'overdue' : s.status,
  });

  const todays = data.sessions.filter((s) => s.date === today);
  const free = generateTimeSlots(today, data.availability, { exams: data.exams, now });
  const freeMinutes = free.reduce((n, i) => n + (i.end - i.start), 0);
  const bookedToday = todays.filter(isActiveSession).reduce((n, s) => n + s.durationMinutes, 0);
  const limit = Math.round(data.availability.maxDailyHours * 60);

  return {
    today,
    subjects: priorities.map((p) => {
      const s = bySubject.get(p.subjectId);
      return {
        name: p.subjectName,
        priorityScore: p.score,
        priorityLabel: p.label,
        whyThisPriority: p.reason,
        difficulty1to5: s.difficulty,
        currentPerformancePercent: s.currentPerformance,
        targetPerformancePercent: s.targetPerformance,
        topicsDone: (s.topics || []).filter((t) => t.completed).map((t) => t.name),
        topicsRemaining: (s.topics || []).filter((t) => !t.completed).map((t) => t.name),
        nextExam: p.nextExam ? { title: p.nextExam.title, date: p.nextExam.date, daysAway: p.nextExam.daysUntil } : null,
      };
    }),
    pendingAssignments: data.assignments
      .filter((a) => !a.completed)
      .map((a) => ({ subject: bySubject.get(a.subjectId)?.name || 'Unknown', title: a.title, dueDate: a.dueDate, hours: a.estimatedHours })),
    todaysSessions: todays.map(brief),
    next7DaysSessions: data.sessions
      .filter((s) => s.date > today && s.date <= addDays(today, 7) && isActiveSession(s))
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
      .slice(0, 30)
      .map(brief),
    approxFreeStudyMinutesLeftToday: Math.max(0, Math.min(freeMinutes, limit - bookedToday)),
    availability: {
      studyDaysOfWeek: data.availability.studyDays,
      window: `${data.availability.startTime}-${data.availability.endTime}`,
      maxDailyHours: data.availability.maxDailyHours,
    },
  };
}