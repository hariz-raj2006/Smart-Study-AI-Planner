import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { examSchema } from '../validation/schemas.js';
import { createExam, deleteExam, listExams, updateExam } from '../controllers/examController.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', listExams);
router.post('/', validate(examSchema), createExam);
router.put('/:id', validate(examSchema), updateExam);
router.delete('/:id', deleteExam);

export default router;