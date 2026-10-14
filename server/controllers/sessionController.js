import { store } from '../database/index.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getOwnedOr404 } from '../utils/ownership.js';
import { newRow, touch } from '../utils/rows.js';
import { addDays, isValidDateStr, minutesToTime, timeToMinutes, todayStr } from '../utils/dates.js';
import {
  calculateSubjectPriorities,
  checkSessionPlacement,
  deriveBreaks,
  findAvailableSlots,
  isActiveSession,
  rescheduleMissedSessions,
} from '../services/schedulingService.js';
import { generateAdaptationAdvice } from '../services/geminiService.js';
import { decorateSessions, isOverdue, loadStudentData } from '../services/planService.js';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function placementContext(data, now) {
  return { availability: data.availability, exams: data.exams, assignments: data.assignments, now };
}

function conflictError(errors) {
  return new AppError(409, errors.map((e) => e.message).join(' '), { code: 'SCHEDULE_CONFLICT', details: errors });
}

function priorityFor(data, subjectId, now) {
  const rows = calculateSubjectPriorities({
    subjects: data.subjects,
    exams: data.exams,
    assignments: data.assignments,
    today: todayStr(now),
  });
  return rows.find((p) => p.subjectId === subjectId);
}

const isMovable = (s, now) => ['missed', 'skipped', 'partial'].includes(s.status) || isOverdue(s, now);

/** An overdue "planned" session is treated as missed when it is rescheduled. */
const normalizeMissed = (s, now) => (isOverdue(s, now) ? { ...s, status: 'missed' } : s);

const unfinishedMinutes = (s) =>
  s.status === 'partial' ? s.durationMinutes - (s.completedMinutes || 0) : s.durationMinutes;

function proposalFor(userId, sessions, now) {
  const data = loadStudentData(userId);
  return rescheduleMissedSessions({
    missedSessions: sessions.map((s) => normalizeMissed(s, now)),
    allSessions: data.sessions,
    subjects: data.subjects,
    exams: data.exams,
    assignments: data.assignments,
    availability: data.availability,
    now,
  });
}

/** Saves a reschedule proposal in one atomic step. Returns the new sessions. */
function applyProposal(userId, proposal) {
  return store.mutate((d) => {
    const created = [];
    for (const move of proposal.moves) {
      const original = d.sessions.find((r) => r.id === move.fromSessionId && r.userId === userId);
      if (!original) continue;
      const row = newRow({ ...move.to, userId, planId: original.planId || null });
      d.sessions.push(row);
      original.rescheduledTo = row.id;
      if (original.status === 'planned') original.status = 'missed'; // it was overdue
      touch(original);
      created.push(structuredClone(row));
    }
    return created;
  });
}

async function maybeAdvice(askAi, proposal, userId, now) {
  if (!askAi || !proposal.moves.length) return {};
  try {
    const data = loadStudentData(userId);
    const priorities = calculateSubjectPriorities({
      subjects: data.subjects,
      exams: data.exams,
      assignments: data.assignments,
      today: todayStr(now),
    });
    const { advice, model } = await generateAdaptationAdvice({ moves: proposal.moves, unplaced: proposal.unplaced, priorities });
    return { aiAdvice: advice, aiModel: model };
  } catch (err) {
    // The timetable change itself already succeeded; report the AI problem honestly.
    return { aiError: err.message };
  }
}

function pickDecorated(sessions, userId, now) {
  const data = loadStudentData(userId);
  return decorateSessions(sessions, data.subjects, now);
}

// ---------------------------------------------------------------------------
// list / create / edit / delete
// ---------------------------------------------------------------------------

export function listSessions(req, res) {
  const { from, to, status } = req.query;
  for (const [name, value] of [['from', from], ['to', to]]) {
    if (value !== undefined && !isValidDateStr(value)) {
      throw new AppError(400, `"${name}" must be a date like 2026-10-12.`);
    }
  }
  const now = new Date();
  const data = loadStudentData(req.user.id);
  let sessions = data.sessions;
  if (from) sessions = sessions.filter((s) => s.date >= from);
  if (to) sessions = sessions.filter((s) => s.date <= to);
  if (status) sessions = sessions.filter((s) => s.status === status);
  res.json({
    sessions: decorateSessions(sessions, data.subjects, now),
    breaks: deriveBreaks(sessions, data.availability.breakMinutes),
  });
}

export function createSession(req, res) {
  const b = req.body;
  const now = new Date();
  getOwnedOr404('subjects', b.subjectId, req.user.id, 'Subject');
  if (b.assignmentId) getOwnedOr404('assignments', b.assignmentId, req.user.id, 'Assignment');
  const data = loadStudentData(req.user.id);

  const candidate = {
    subjectId: b.subjectId,
    date: b.date,
    startTime: b.startTime,
    endTime: b.endTime,
    activityType: b.activityType,
    assignmentId: b.assignmentId,
    status: 'planned',
  };
  const { errors, warnings } = checkSessionPlacement(candidate, { ...placementContext(data, now), otherSessions: data.sessions });
  if (errors.length) throw conflictError(errors);

  const p = priorityFor(data, b.subjectId, now);
  const session = store.insert('sessions', {
    userId: req.user.id,
    planId: null,
    subjectId: b.subjectId,
    assignmentId: b.assignmentId,
    date: b.date,
    startTime: b.startTime,
    endTime: b.endTime,
    durationMinutes: timeToMinutes(b.endTime) - timeToMinutes(b.startTime),
    topic: b.topic,
    activityType: b.activityType,
    priority: p ? p.label : 'medium',
    priorityScore: p ? p.score : 0,
    explanation: 'Added by you.',
    notes: b.notes || '',
    status: 'planned',
    completedMinutes: 0,
    origin: 'manual',
  });
  res.status(201).json({ session: pickDecorated([session], req.user.id, now)[0], warnings });
}

export function updateSession(req, res) {
  const existing = getOwnedOr404('sessions', req.params.id, req.user.id, 'Session');
  if (existing.status !== 'planned') {
    throw new AppError(400, 'Only planned sessions can be edited. Use Reschedule for missed or partly completed ones.');
  }
  const b = req.body;
  const now = new Date();
  getOwnedOr404('subjects', b.subjectId, req.user.id, 'Subject');
  const data = loadStudentData(req.user.id);

  const candidate = { ...existing, ...b, status: 'planned' };
  const { errors, warnings } = checkSessionPlacement(candidate, { ...placementContext(data, now), otherSessions: data.sessions });
  if (errors.length) throw conflictError(errors);

  const session = store.update('sessions', existing.id, {
    subjectId: b.subjectId,
    date: b.date,
    startTime: b.startTime,
    endTime: b.endTime,
    durationMinutes: timeToMinutes(b.endTime) - timeToMinutes(b.startTime),
    topic: b.topic,
    activityType: b.activityType,
    notes: b.notes ?? existing.notes ?? '',
  });
  res.json({ session: pickDecorated([session], req.user.id, now)[0], warnings });
}

export function deleteSession(req, res) {
  const existing = getOwnedOr404('sessions', req.params.id, req.user.id, 'Session');
  store.mutate((d) => {
    d.sessions = d.sessions.filter((s) => s.id !== existing.id);
    d.progress = d.progress.filter((p) => !(p.kind === 'study' && p.sessionId === existing.id));
  });
  res.json({ message: 'Session deleted.' });
}

// ---------------------------------------------------------------------------
// complete / skip
// ---------------------------------------------------------------------------

export function completeSession(req, res) {
  const existing = getOwnedOr404('sessions', req.params.id, req.user.id, 'Session');
  if (!['planned', 'partial'].includes(existing.status)) {
    throw new AppError(400, 'Only planned or partly completed sessions can be marked as done.');
  }
  const now = new Date();
  const today = todayStr(now);
  if (existing.date > today) {
    throw new AppError(400, 'You can only mark sessions that are today or in the past.');
  }
  const { completedTopicIds } = req.body;
  const requested = req.body.completedMinutes ?? existing.durationMinutes;
  const minutes = Math.min(requested, existing.durationMinutes);
  const status = minutes >= existing.durationMinutes ? 'completed' : 'partial';

  const subject = getOwnedOr404('subjects', existing.subjectId, req.user.id, 'Subject');
  const validTopicIds = new Set((subject.topics || []).map((t) => t.id));
  if (completedTopicIds.some((id) => !validTopicIds.has(id))) {
    throw new AppError(400, 'One of the selected topics does not belong to this subject.');
  }

  const result = store.mutate((d) => {
    const row = d.sessions.find((s) => s.id === existing.id);
    row.status = status;
    row.completedMinutes = minutes;
    row.completedAt = now.toISOString();
    touch(row);

    const record = d.progress.find((p) => p.kind === 'study' && p.sessionId === row.id);
    if (record) {
      Object.assign(record, { minutes, date: row.date, recordedOn: today });
      touch(record);
    } else {
      d.progress.push(
        newRow({ userId: req.user.id, subjectId: row.subjectId, kind: 'study', sessionId: row.id, date: row.date, minutes, recordedOn: today })
      );
    }

    let updatedSubject = null;
    if (completedTopicIds.length) {
      const s = d.subjects.find((x) => x.id === row.subjectId);
      for (const t of s.topics) if (completedTopicIds.includes(t.id)) t.completed = true;
      touch(s);
      updatedSubject = structuredClone(s);
    }
    return { session: structuredClone(row), subject: updatedSubject };
  });

  const payload = { session: pickDecorated([result.session], req.user.id, now)[0], subject: result.subject };
  if (status === 'partial') payload.proposal = proposalFor(req.user.id, [result.session], now);
  res.json(payload);
}

/** Marks a planned session as missed or skipped and previews how it could be rescheduled. */
export function skipSession(req, res) {
  const existing = getOwnedOr404('sessions', req.params.id, req.user.id, 'Session');
  if (existing.status !== 'planned') {
    throw new AppError(400, 'Only planned sessions can be marked as missed or skipped.');
  }
  const now = new Date();
  const { status, reason } = req.body;

  const session = store.mutate((d) => {
    const row = d.sessions.find((s) => s.id === existing.id);
    row.status = status;
    row.skipReason = reason || '';
    touch(row);
    d.progress = d.progress.filter((p) => !(p.kind === 'study' && p.sessionId === row.id));
    return structuredClone(row);
  });

  res.json({
    session: pickDecorated([session], req.user.id, now)[0],
    proposal: proposalFor(req.user.id, [session], now),
  });
}

// ---------------------------------------------------------------------------
// rescheduling
// ---------------------------------------------------------------------------

/** GET /api/sessions/:id/slots : suggested free times for the Reschedule dialog. */
export function suggestSlots(req, res) {
  const session = getOwnedOr404('sessions', req.params.id, req.user.id, 'Session');
  const now = new Date();
  const data = loadStudentData(req.user.id);
  const slots = findAvailableSlots({
    minutes: Math.max(15, unfinishedMinutes(session)),
    availability: data.availability,
    existingSessions: data.sessions,
    exams: data.exams,
    subjectId: session.subjectId,
    excludeSessionId: session.id,
    now,
    limit: 6,
  });
  res.json({ slots });
}

/**
 * POST /api/sessions/:id/reschedule
 *  mode "manual": move a planned session in place, or create a new session for the
 *                 unfinished part of a missed / skipped / partial one.
 *  mode "auto"  : let the scheduler pick the slot. preview:true only returns the proposal;
 *                 confirm:true is required to save it.
 */
export const rescheduleSession = asyncHandler(async (req, res) => {
  const session = getOwnedOr404('sessions', req.params.id, req.user.id, 'Session');
  const { mode, date, startTime, preview, confirm, askAi } = req.body;
  const now = new Date();
  const data = loadStudentData(req.user.id);

  if (session.status === 'completed') throw new AppError(400, 'A completed session cannot be rescheduled.');

  if (mode === 'auto') {
    if (!isMovable(session, now)) {
      throw new AppError(400, 'Automatic rescheduling is for missed, skipped, overdue or partly completed sessions.');
    }
    const proposal = proposalFor(req.user.id, [session], now);
    if (preview) return res.json({ proposal });
    if (!confirm) throw new AppError(400, 'Please confirm the change first (confirm: true).', { code: 'CONFIRM_REQUIRED' });
    const created = applyProposal(req.user.id, proposal);
    const extra = await maybeAdvice(askAi, proposal, req.user.id, now);
    return res.json({ proposal, created: pickDecorated(created, req.user.id, now), ...extra });
  }

  // manual
  const ctx = placementContext(data, now);

  if (session.status === 'planned' && !isOverdue(session, now)) {
    const duration = session.durationMinutes;
    const candidate = { ...session, date, startTime, endTime: minutesToTime(timeToMinutes(startTime) + duration) };
    if (timeToMinutes(candidate.endTime) > 24 * 60 - 1) {
      throw new AppError(400, 'A session cannot run past midnight.');
    }
    const { errors, warnings } = checkSessionPlacement(candidate, { ...ctx, otherSessions: data.sessions });
    if (errors.length) throw conflictError(errors);
    const updated = store.update('sessions', session.id, { date, startTime, endTime: candidate.endTime });
    return res.json({ session: pickDecorated([updated], req.user.id, now)[0], warnings });
  }

  if (data.sessions.some((s) => s.rescheduledFrom === session.id && isActiveSession(s))) {
    throw new AppError(409, 'This session has already been rescheduled.');
  }
  const minutes = unfinishedMinutes(session);
  if (minutes < 5) throw new AppError(400, 'There is no unfinished time left to reschedule.');
  const endTime = minutesToTime(timeToMinutes(startTime) + minutes);
  if (timeToMinutes(endTime) > 24 * 60 - 1) throw new AppError(400, 'A session cannot run past midnight.');

  const candidate = {
    subjectId: session.subjectId,
    assignmentId: session.assignmentId,
    activityType: session.activityType,
    date,
    startTime,
    endTime,
    status: 'planned',
  };
  const { errors, warnings } = checkSessionPlacement(candidate, { ...ctx, otherSessions: data.sessions });
  if (errors.length) throw conflictError(errors);

  const p = priorityFor(data, session.subjectId, now); // recalculated priority
  const created = store.mutate((d) => {
    const row = newRow({
      userId: req.user.id,
      planId: session.planId || null,
      subjectId: session.subjectId,
      assignmentId: session.assignmentId,
      examId: session.examId,
      date,
      startTime,
      endTime,
      durationMinutes: minutes,
      topic: session.topic,
      activityType: session.activityType,
      priority: p ? p.label : session.priority,
      priorityScore: p ? p.score : session.priorityScore,
      explanation: `Rescheduled by you from ${session.date} ${session.startTime}.`,
      notes: session.notes || '',
      status: 'planned',
      completedMinutes: 0,
      origin: 'manual',
      rescheduledFrom: session.id,
    });
    d.sessions.push(row);
    const original = d.sessions.find((s) => s.id === session.id);
    original.rescheduledTo = row.id;
    if (original.status === 'planned') original.status = 'missed';
    touch(original);
    return structuredClone(row);
  });
  res.json({ session: pickDecorated([created], req.user.id, now)[0], warnings });
});

/**
 * POST /api/sessions/reschedule-missed
 * Finds missed / skipped / overdue / partly completed sessions (or the ones listed in
 * sessionIds), proposes new slots, and saves them only when confirm:true is sent.
 */
export const rescheduleMissed = asyncHandler(async (req, res) => {
  const { sessionIds, preview, confirm, askAi } = req.body;
  const now = new Date();
  const today = todayStr(now);

  let sessions;
  if (sessionIds && sessionIds.length) {
    sessions = sessionIds.map((id) => getOwnedOr404('sessions', id, req.user.id, 'Session'));
  } else {
    const oldest = addDays(today, -30);
    sessions = loadStudentData(req.user.id).sessions.filter((s) => s.date >= oldest && isMovable(s, now));
  }
  sessions = sessions.filter((s) => s.status !== 'completed');

  const proposal = proposalFor(req.user.id, sessions, now);
  if (preview) return res.json({ proposal });
  if (!confirm) throw new AppError(400, 'Please confirm the change first (confirm: true).', { code: 'CONFIRM_REQUIRED' });

  const created = applyProposal(req.user.id, proposal);
  const extra = await maybeAdvice(askAi, proposal, req.user.id, now);
  res.json({ proposal, created: pickDecorated(created, req.user.id, now), ...extra });
});