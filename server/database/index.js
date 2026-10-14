
import { createPostgresStore } from './postgresStore.js';

/**
 * The single shared store used by the whole backend.
 * Uses Neon PostgreSQL through the pg connection pool.
 */
export const store = createPostgresStore();
