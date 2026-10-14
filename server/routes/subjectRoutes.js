import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { subjectSchema } from '../validation/schemas.js';
import {
  createSubject,
  deleteSubject,
  listSubjects,
  updateSubject,
} from '../controllers/subjectController.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', listSubjects);
router.post('/', validate(subjectSchema), createSubject);
router.put('/:id', validate(subjectSchema), updateSubject);
router.delete('/:id', deleteSubject);

export default router;