import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { dashboard, progress } from '../controllers/statsController.js';

const router = express.Router();
router.use(requireAuth);

router.get('/dashboard', dashboard);
router.get('/progress', progress);

export default router;