
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { store } from '../database/index.js';
import { defaultAvailability } from '../database/defaults.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Used so an unknown email takes approximately as long to check
// as a real account.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

// Cookie settings must match for setting and clearing the cookie.
function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: config.isProduction ? 'none' : 'lax',
    secure: config.isProduction,
    path: '/',
  };
}

// Create a signed JWT and send it as an HTTP-only cookie.
function startSession(res, userId) {
  const token = jwt.sign(
    { sub: String(userId) },
    config.sessionSecret,
    {
      algorithm: 'HS256',
      expiresIn: `${config.sessionDays}d`,
    }
  );

  res.cookie(config.cookieName, token, {
    ...cookieOptions(),
    maxAge: config.sessionDays * 24 * 60 * 60 * 1000,
  });
}

// Return only fields safe to expose to the client.
export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    theme: user.theme || 'system',
    createdAt: user.createdAt,
  };
}

// Register a new account and start its session.
export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const existingUser = await store.findOne(
    'users',
    (user) => user.email === email
  );

  if (existingUser) {
    throw new AppError(
      409,
      'An account with this email already exists.',
      {
        code: 'VALIDATION',
        details: [
          {
            field: 'email',
            message: 'This email is already registered',
          },
        ],
      }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await store.insert('users', {
    name,
    email,
    passwordHash,
    theme: 'system',
  });

  await store.insert(
    'availability',
    defaultAvailability(user.id)
  );

  startSession(res, user.id);

  res.status(201).json({
    user: publicUser(user),
  });
});

// Verify credentials and start a session.
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await store.findOne(
    'users',
    (item) => item.email === email
  );

  const passwordMatches = await bcrypt.compare(
    password,
    user ? user.passwordHash : DUMMY_HASH
  );

  if (!user || !passwordMatches) {
    throw new AppError(401, 'Invalid email or password.');
  }

  startSession(res, user.id);

  res.status(200).json({
    user: publicUser(user),
  });
});

// Clear the authentication cookie.
export const logout = (req, res) => {
  res.clearCookie(config.cookieName, cookieOptions());

  res.status(200).json({
    message: 'Logged out.',
  });
};

// Return the authenticated user.
// Authentication middleware must set req.user first.
export const me = (req, res) => {
  res.status(200).json({
    user: publicUser(req.user),
  });
};

// Update profile fields and optionally change the password.
export const updateProfile = asyncHandler(async (req, res) => {
  const { name, theme, currentPassword, newPassword } = req.body;

  const user = await store.get('users', req.user.id);

  if (!user) {
    throw new AppError(404, 'User not found.');
  }

  const patch = {};

  if (name !== undefined) {
    patch.name = name;
  }

  if (theme !== undefined) {
    patch.theme = theme;
  }

  if (newPassword) {
    const passwordMatches = await bcrypt.compare(
      currentPassword || '',
      user.passwordHash
    );

    if (!passwordMatches) {
      throw new AppError(
        400,
        'Your current password is incorrect.',
        {
          code: 'VALIDATION',
          details: [
            {
              field: 'currentPassword',
              message: 'Current password is incorrect',
            },
          ],
        }
      );
    }

    patch.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  const updated = await store.update(
    'users',
    user.id,
    patch
  );

  if (!updated) {
    throw new AppError(404, 'User not found.');
  }

  res.status(200).json({
    user: publicUser(updated),
  });
});
