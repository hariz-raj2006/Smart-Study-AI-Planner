import crypto from 'node:crypto';
import { store } from '../database/index.js';
import { SUBJECT_COLORS } from '../database/defaults.js';
import { AppError } from '../utils/AppError.js';
import { getOwnedOr404 } from '../utils/ownership.js';
import { todayStr } from '../utils/dates.js';

function normalizeTopics(topics) {
  return topics.map((t) => ({ id: t.id || crypto.randomUUID(), name: t.name, completed: t.completed }));
}

function assertUniqueName(userId, name, ignoreId) {
  const clash = store.findOne(
    'subjects',
    (s) => s.userId === userId && s.id !== ignoreId && s.name.toLowerCase() === name.toLowerCase()
  );
  if (clash) {
    throw new AppError(409, 'You already have a subject with this name.', {
      code: 'VALIDATION',
      details: [{ field: 'name', message: 'Subject name already exists' }],
    });
  }
}

function recordPerformance(userId, subjectId, value) {
  store.insert('progress', {
    userId,
    subjectId,
    kind: 'performance',
    value,
    recordedOn: todayStr(),
  });
}

export function listSubjects(req, res) {
  const subjects = store
    .list('subjects', (s) => s.userId === req.user.id)
    .sort((a, b) => a.name.localeCompare(b.name));
  res.json({ subjects });
}

export function createSubject(req, res) {
  const userId = req.user.id;
  const data = req.body;
  assertUniqueName(userId, data.name);

  const count = store.list('subjects', (s) => s.userId === userId).length;
  const subject = store.insert('subjects', {
    userId,
    name: data.name,
    color: data.color || SUBJECT_COLORS[count % SUBJECT_COLORS.length],
    difficulty: data.difficulty,
    currentPerformance: data.currentPerformance,
    targetPerformance: data.targetPerformance,
    estimatedWorkloadHours: data.estimatedWorkloadHours,
    topics: normalizeTopics(data.topics),
  });
  recordPerformance(userId, subject.id, subject.currentPerformance);
  res.status(201).json({ subject });
}

export function updateSubject(req, res) {
  const existing = getOwnedOr404('subjects', req.params.id, req.user.id, 'Subject');
  const data = req.body;
  assertUniqueName(req.user.id, data.name, existing.id);

  const subject = store.update('subjects', existing.id, {
    name: data.name,
    color: data.color || existing.color,
    difficulty: data.difficulty,
    currentPerformance: data.currentPerformance,
    targetPerformance: data.targetPerformance,
    estimatedWorkloadHours: data.estimatedWorkloadHours,
    topics: normalizeTopics(data.topics),
  });
  if (subject.currentPerformance !== existing.currentPerformance) {
    recordPerformance(req.user.id, subject.id, subject.currentPerformance);
  }
  res.json({ subject });
}

export function deleteSubject(req, res) {
  const existing = getOwnedOr404('subjects', req.params.id, req.user.id, 'Subject');

  // Remove the subject and everything that belongs to it in one safe step.
  store.mutate((d) => {
    d.subjects = d.subjects.filter((r) => r.id !== existing.id);
    for (const name of ['exams', 'assignments', 'sessions', 'progress']) {
      d[name] = d[name].filter((r) => r.subjectId !== existing.id);
    }
  });
  res.json({ message: 'Subject deleted along with its exams, assignments and sessions.' });
}