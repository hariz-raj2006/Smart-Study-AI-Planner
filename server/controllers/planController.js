import { store } from '../database/index.js';
import { getOwnedOr404 } from '../utils/ownership.js';
import {
  decorateSessions,
  generateAndSavePlan,
  loadStudentData,
  requireConfirmation,
  validateAcademicData,
} from '../services/planService.js';

export function listPlans(req, res) {
  const sessions = store.list('sessions', (s) => s.userId === req.user.id);
  const plans = store
    .list('plans', (p) => p.userId === req.user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((p) => ({ ...p, sessionCount: sessions.filter((s) => s.planId === p.id).length }));
  res.json({ plans });
}

export function getPlan(req, res) {
  const plan = getOwnedOr404('plans', req.params.id, req.user.id, 'Plan');
  const data = loadStudentData(req.user.id);
  const sessions = decorateSessions(
    data.sessions.filter((s) => s.planId === plan.id),
    data.subjects
  );
  res.json({ plan, sessions });
}

export function updatePlan(req, res) {
  const plan = getOwnedOr404('plans', req.params.id, req.user.id, 'Plan');
  const patch = {};
  if (req.body.title) patch.title = req.body.title;
  if (req.body.status) patch.status = req.body.status;
  res.json({ plan: store.update('plans', plan.id, patch) });
}

/**
 * POST /api/study-plans/generate
 * Local plan: uses ONLY the scheduling algorithm, no Gemini. It is clearly marked
 * aiUsed:false so it is never presented as an AI plan. Useful when Gemini is unavailable.
 */
export function generateLocalPlan(req, res) {
  const { planDays, confirm } = req.body;
  const now = new Date();
  const data = loadStudentData(req.user.id);
  validateAcademicData(data);
  requireConfirmation(data, now, confirm);
  const result = generateAndSavePlan({ userId: req.user.id, data, now, planDays, aiRaw: null, aiUsed: false, aiModel: null });
  res.status(201).json(result);
}