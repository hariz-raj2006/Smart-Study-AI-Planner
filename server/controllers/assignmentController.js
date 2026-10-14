import { store } from '../database/index.js';
import { getOwnedOr404 } from '../utils/ownership.js';
import { daysBetween, todayStr } from '../utils/dates.js';
import { asyncHandler } from '../utils/asyncHandler.js';

function enrich(a) {
  const daysRemaining = daysBetween(todayStr(), a.dueDate);

  const status = a.completed
    ? 'done'
    : daysRemaining < 0
      ? 'overdue'
      : daysRemaining === 0
        ? 'today'
        : 'upcoming';

  return { ...a, daysRemaining, status };
}

export const listAssignments = asyncHandler(async (req, res) => {
  const assignments = await store.list(
    'assignments',
    (a) => a.userId === req.user.id
  );

  assignments.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  res.json({ assignments: assignments.map(enrich) });
});

export const createAssignment = asyncHandler(async (req, res) => {
  const data = req.body;

  await getOwnedOr404('subjects', data.subjectId, req.user.id, 'Subject');

  const assignment = await store.insert('assignments', {
    userId: req.user.id,
    subjectId: data.subjectId,
    title: data.title,
    dueDate: data.dueDate,
    estimatedHours: data.estimatedHours,
    completed: Boolean(data.completed),
  });

  res.status(201).json({ assignment: enrich(assignment) });
});

export const updateAssignment = asyncHandler(async (req, res) => {
  const existing = await getOwnedOr404(
    'assignments',
    req.params.id,
    req.user.id,
    'Assignment'
  );

  const data = req.body;

  await getOwnedOr404('subjects', data.subjectId, req.user.id, 'Subject');

  const assignment = await store.update('assignments', existing.id, {
    subjectId: data.subjectId,
    title: data.title,
    dueDate: data.dueDate,
    estimatedHours: data.estimatedHours,
    completed: data.completed ?? existing.completed,
  });

  res.json({ assignment: enrich(assignment) });
});

export const deleteAssignment = asyncHandler(async (req, res) => {
  const existing = await getOwnedOr404(
    'assignments',
    req.params.id,
    req.user.id,
    'Assignment'
  );

  await store.remove('assignments', existing.id);

  res.json({ message: 'Assignment deleted.' });
});
