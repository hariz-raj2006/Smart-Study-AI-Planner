import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { planGenerateSchema, planUpdateSchema } from '../validation/sessionSchemas.js';
import { generateLocalPlan, getPlan, listPlans, updatePlan } from '../controllers/planController.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', listPlans);
router.post('/generate', validate(planGenerateSchema), generateLocalPlan);
router.get('/:id', getPlan);
router.put('/:id', validate(planUpdateSchema), updatePlan);

export default router;