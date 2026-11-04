import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { store } from '../database/index.js';
import { defaultAvailability } from '../database/defaults.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Used so a login for an unknown email takes about as long as a real one.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

function cookieOptions() {
  return {
    httpOnly: true, // JavaScript in the browser cannot read this cookie
    sameSite: 'lax',
    secure: config.isProduction, // HTTPS only in production
    path: '/',
  };
}

function startSession(res, userId) {
  const token = jwt.sign({ sub: userId }, config.sessionSecret, {
    algorithm: 'HS256',
    expiresIn: `${config.sessionDays}d`,
  });
  res.cookie(config.cookieName, token, {
    ...cookieOptions(),
    maxAge: config.sessionDays * 24 * 60 * 60 * 1000,
  });
}

export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    theme: user.theme || 'system',
    createdAt: user.createdAt,
  };
}

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (store.findOne('users', (u) => u.email === email)) {
    throw new AppError(409, 'An account with this email already exists.', {
      code: 'VALIDATION',
      details: [{ field: 'email', message: 'This email is already registered' }],
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = store.insert('users', { name, email, passwordHash, theme: 'system' });
  store.insert('availability', defaultAvailability(user.id));

  startSession(res, user.id);
  res.status(201).json({ user: publicUser(user) });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = store.findOne('users', (u) => u.email === email);

  const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
  if (!user || !ok) throw new AppError(401, 'Invalid email or password.');

  startSession(res, user.id);
  res.json({ user: publicUser(user) });
});

export const logout = (req, res) => {
  res.clearCookie(config.cookieName, cookieOptions());
  res.json({ message: 'Logged out.' });
};

export const me = (req, res) => {
  res.json({ user: publicUser(req.user) });
};

export const updateProfile = asyncHandler(async (req, res) => {
  const { name, theme, currentPassword, newPassword } = req.body;
  const user = store.get('users', req.user.id);
  const patch = {};

  if (name) patch.name = name;
  if (theme) patch.theme = theme;

  if (newPassword) {
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      throw new AppError(400, 'Your current password is incorrect.', {
        code: 'VALIDATION',
        details: [{ field: 'currentPassword', message: 'Current password is incorrect' }],
      });
    }
    patch.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  const updated = store.update('users', user.id, patch);
  res.json({ user: publicUser(updated) });
});