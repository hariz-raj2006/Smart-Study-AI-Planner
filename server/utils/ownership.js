import { store } from '../database/index.js';
import { AppError } from './AppError.js';

/**
 * Fetch a record only if it belongs to the given user.
 * Returns 404 when the record doesn't exist or belongs to another user.
 */
export async function getOwnedOr404(
  collection,
  id,
  userId,
  label = 'Item'
) {
  const row = await store.get(collection, id);

  if (!row || row.userId !== userId) {
    throw new AppError(404, `${label} not found.`);
  }

  return row;
}