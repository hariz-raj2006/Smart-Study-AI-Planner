import crypto from 'node:crypto';

/** Builds a database row (id + timestamps). Used inside store.mutate() when several changes must be saved together. */
export function newRow(doc) {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), ...doc, createdAt: now, updatedAt: now };
}

export const touch = (row) => {
  row.updatedAt = new Date().toISOString();
  return row;
};