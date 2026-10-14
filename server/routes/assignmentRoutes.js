import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { assignmentSchema } from '../validation/schemas.js';
import {
  createAssignment,
  deleteAssignment,
  listAssignments,
  updateAssignment,
} from '../controllers/assignmentController.js';

const router = express.Router();
router.use(requireAuth);

router.get('/', listAssignments);
router.post('/', validate(assignmentSchema), createAssignment);
router.put('/:id', validate(assignmentSchema), updateAssignment);
router.delete('/:id', deleteAssignment);

export default router;