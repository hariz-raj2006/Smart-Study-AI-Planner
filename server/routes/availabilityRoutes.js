import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { availabilitySchema } from '../validation/schemas.js';
import { getAvailability, updateAvailability } from '../controllers/availabilityController.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', getAvailability);
router.put('/', validate(availabilitySchema), updateAvailability);

export default router;