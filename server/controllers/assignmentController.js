import { store } from '../database/index.js';
import { getOwnedOr404 } from '../utils/ownership.js';
import { daysBetween, todayStr } from '../utils/dates.js';

function enrich(a) {
  const daysRemaining = daysBetween(todayStr(), a.dueDate);
  const status = a.completed ? 'done' : daysRemaining < 0 ? 'overdue' : daysRemaining === 0 ? 'today' : 'upcoming';
  return { ...a, daysRemaining, status };
}

export function listAssignments(req, res) {
  const assignments = store
    .list('assignments', (a) => a.userId === req.user.id)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map(enrich);
  res.json({ assignments });
}

export function createAssignment(req, res) {
  const data = req.body;
  getOwnedOr404('subjects', data.subjectId, req.user.id, 'Subject');

  const assignment = store.insert('assignments', {
    userId: req.user.id,
    subjectId: data.subjectId,
    title: data.title,
    dueDate: data.dueDate,
    estimatedHours: data.estimatedHours,
    completed: Boolean(data.completed),
  });
  res.status(201).json({ assignment: enrich(assignment) });
}

export function updateAssignment(req, res) {
  const existing = getOwnedOr404('assignments', req.params.id, req.user.id, 'Assignment');
  const data = req.body;
  getOwnedOr404('subjects', data.subjectId, req.user.id, 'Subject');

  const assignment = store.update('assignments', existing.id, {
    subjectId: data.subjectId,
    title: data.title,
    dueDate: data.dueDate,
    estimatedHours: data.estimatedHours,
    completed: data.completed ?? existing.completed,
  });
  res.json({ assignment: enrich(assignment) });
}

export function deleteAssignment(req, res) {
  const existing = getOwnedOr404('assignments', req.params.id, req.user.id, 'Assignment');
  store.remove('assignments', existing.id);
  res.json({ message: 'Assignment deleted.' });
}