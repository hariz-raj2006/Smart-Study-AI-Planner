import { store } from '../database/index.js';
import { AppError } from './AppError.js';

/**
 * Fetch a record only if it belongs to the given user.
 * A record owned by someone else is reported as "not found" (404), so the API
 * never confirms that another user's record exists.
 */
export function getOwnedOr404(collection, id, userId, label = 'Item') {
  const row = store.get(collection, id);
  if (!row || row.userId !== userId) {
    throw new AppError(404, `${label} not found.`);
  }
  return row;
}