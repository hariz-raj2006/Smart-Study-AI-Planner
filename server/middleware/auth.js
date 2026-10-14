import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { store } from '../database/index.js';
import { AppError } from '../utils/AppError.js';

/**
 * Requires a valid login. The token normally arrives in an httpOnly cookie;
 * an "Authorization: Bearer <token>" header is also accepted (handy for testing).
 * On success req.user holds the account (without its password hash).
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = req.cookies?.[config.cookieName] || (header.startsWith('Bearer ') ? header.slice(7) : null);
  if (!token) return next(new AppError(401, 'Please log in to continue.'));

  let payload;
  try {
    payload = jwt.verify(token, config.sessionSecret, { algorithms: ['HS256'] });
  } catch {
    return next(new AppError(401, 'Your session has expired. Please log in again.'));
  }

  const user = store.get('users', payload.sub);
  if (!user) return next(new AppError(401, 'Account not found. Please log in again.'));

  // eslint-disable-next-line no-unused-vars
  const { passwordHash, ...safeUser } = user;
  req.user = safeUser;
  return next();
}