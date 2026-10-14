import express from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { assistantSchema, planGenerateSchema } from '../validation/sessionSchemas.js';
import { aiStatus, aiTest, assistant, generateAiStudyPlan } from '../controllers/aiController.js';

const router = express.Router();
router.use(requireAuth);

// Every Gemini request costs quota, so limit them per logged-in student (not per IP).
const aiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `user:${req.user.id}`,
  message: { error: { message: 'You have made many AI requests in a short time. Please wait a few minutes and try again.' } },
});

router.get('/status', aiStatus);
router.post('/test', aiLimiter, aiTest);
router.post('/generate-study-plan', aiLimiter, validate(planGenerateSchema), generateAiStudyPlan);
router.post('/assistant', aiLimiter, validate(assistantSchema), assistant);

export default router;