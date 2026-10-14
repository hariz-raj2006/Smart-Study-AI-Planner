import express from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { loginSchema, profileSchema, registerSchema } from '../validation/schemas.js';
import { login, logout, me, register, updateProfile } from '../controllers/authController.js';

const router = express.Router();

// Slow down password-guessing: 30 attempts per 15 minutes per IP.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { message: 'Too many attempts. Please wait a few minutes and try again.' } },
});

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/logout', logout);
router.get('/me', requireAuth, me);
router.put('/profile', requireAuth, validate(profileSchema), updateProfile);

export default router;