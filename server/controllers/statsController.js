import { computeDashboard, computeProgress } from '../services/statsService.js';

export const dashboard = (req, res) => res.json(computeDashboard(req.user.id));
export const progress = (req, res) => res.json(computeProgress(req.user.id));