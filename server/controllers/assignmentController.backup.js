import { store } from '../database/index.js';
import { AppError } from '../utils/AppError.js';
import { getOwnedOr404 } from '../utils/ownership.js';
import { daysBetween, todayStr } from '../utils/dates.js';

function enrich(exam) {
  const daysRemaining = daysBetween(todayStr(), exam.date);
  const status = daysRemaining < 0 ? 'past' : daysRemaining === 0 ? 'today' : 'upcoming';
  return { ...exam, daysRemaining, status };
}

function pastDateError() {
  return new AppError(400, 'The exam date cannot be in the past.', {
    code: 'VALIDATION',
    details: [{ field: 'date', message: 'Choose today or a future date' }],
  });
}

export function listExams(req, res) {
  const exams = store
    .list('exams', (e) => e.userId === req.user.id)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(enrich);
  res.json({ exams });
}

export function createExam(req, res) {
  const data = req.body;
  getOwnedOr404('subjects', data.subjectId, req.user.id, 'Subject');
  if (data.date < todayStr()) throw pastDateError();

  const exam = store.insert('exams', {
    userId: req.user.id,
    subjectId: data.subjectId,
    title: data.title,
    date: data.date,
    startTime: data.startTime || null,
    importance: data.importance,
  });
  res.status(201).json({ exam: enrich(exam) });
}

export function updateExam(req, res) {
  const existing = getOwnedOr404('exams', req.params.id, req.user.id, 'Exam');
  const data = req.body;
  getOwnedOr404('subjects', data.subjectId, req.user.id, 'Subject');
  // Keeping an old (already past) date unchanged is allowed; moving it into the past is not.
  if (data.date !== existing.date && data.date < todayStr()) throw pastDateError();

  const exam = store.update('exams', existing.id, {
    subjectId: data.subjectId,
    title: data.title,
    date: data.date,
    startTime: data.startTime || null,
    importance: data.importance,
  });
  res.json({ exam: enrich(exam) });
}

export function deleteExam(req, res) {
  const existing = getOwnedOr404('exams', req.params.id, req.user.id, 'Exam');
  store.remove('exams', existing.id);
  res.json({ message: 'Exam deleted.' });
}