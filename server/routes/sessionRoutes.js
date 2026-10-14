import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  completeSchema,
  rescheduleMissedSchema,
  rescheduleSchema,
  sessionSchema,
  skipSchema,
} from '../validation/sessionSchemas.js';
import {
  completeSession,
  createSession,
  deleteSession,
  listSessions,
  rescheduleMissed,
  rescheduleSession,
  skipSession,
  suggestSlots,
  updateSession,
} from '../controllers/sessionController.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', listSessions);
router.post('/', validate(sessionSchema), createSession);
// This fixed path must come before the "/:id/..." routes.
router.post('/reschedule-missed', validate(rescheduleMissedSchema), rescheduleMissed);
router.put('/:id', validate(sessionSchema), updateSession);
router.delete('/:id', deleteSession);
router.post('/:id/complete', validate(completeSchema), completeSession);
router.post('/:id/skip', validate(skipSchema), skipSession);
router.post('/:id/reschedule', validate(rescheduleSchema), rescheduleSession);
router.get('/:id/slots', suggestSlots);

export default router;