
import crypto from 'node:crypto';
import pg from 'pg';


const { Pool } = pg;

export const COLLECTIONS = [
  'users',
  'subjects',
  'exams',
  'assignments',
  'availability',
  'plans',
  'sessions',
  'progress',
];

const MUTATION_LOCK_ID = 72819436;

let pool;
let initializationPromise;

function getPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is missing. Configure it in server/.env or your deployment environment.'
    );
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 5,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      ssl: /localhost|127\.0\.0\.1/i.test(connectionString)
        ? undefined
        : { rejectUnauthorized: false },
    });

    pool.on('error', (error) => {
      console.error('PostgreSQL pool error:', error.message);
    });
  }

  return pool;
}

async function initialize() {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      const db = getPool();

      await db.query(`
        CREATE TABLE IF NOT EXISTS smartstudy_records (
          collection TEXT NOT NULL,
          id TEXT NOT NULL,
          data JSONB NOT NULL,
          PRIMARY KEY (collection, id)
        )
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS smartstudy_records_collection_idx
        ON smartstudy_records (collection)
      `);
    })().catch((error) => {
      initializationPromise = undefined;
      throw error;
    });
  }

  await initializationPromise;
}

function checkCollection(name) {
  if (!COLLECTIONS.includes(name)) {
    throw new Error(`Unknown SmartStudy collection: ${name}`);
  }
}

function clone(value) {
  return structuredClone(value);
}

function parseRow(row) {
  return row ? row.data : null;
}

async function readAll(client) {
  const result = await client.query(
    'SELECT collection, id, data FROM smartstudy_records'
  );

  const database = Object.fromEntries(
    COLLECTIONS.map((name) => [name, []])
  );

  for (const row of result.rows) {
    if (database[row.collection]) {
      database[row.collection].push(row.data);
    }
  }

  return database;
}

async function upsert(client, collection, row) {
  if (!row || row.id === undefined || row.id === null) {
    throw new Error(
      `A valid id is required for collection "${collection}".`
    );
  }

  await client.query(
    `INSERT INTO smartstudy_records (collection, id, data)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (collection, id)
     DO UPDATE SET data = EXCLUDED.data`,
    [collection, String(row.id), JSON.stringify(row)]
  );
}

export function createPostgresStore() {
  async function list(name, predicate = () => true) {
    checkCollection(name);
    await initialize();

    const result = await getPool().query(
      `SELECT data FROM smartstudy_records
       WHERE collection = $1`,
      [name]
    );

    return result.rows.map(parseRow).filter(predicate);
  }

  async function get(name, id) {
    checkCollection(name);
    await initialize();

    const result = await getPool().query(
      `SELECT data FROM smartstudy_records
       WHERE collection = $1 AND id = $2`,
      [name, String(id)]
    );

    return parseRow(result.rows[0]);
  }

  async function findOne(name, predicate) {
    const rows = await list(name, predicate);
    return rows[0] ?? null;
  }

  async function insert(name, row) {
    checkCollection(name);
    await initialize();

    const now = new Date().toISOString();

    const newRow = {
      ...row,
      id: row.id ?? crypto.randomUUID(),
      createdAt: row.createdAt ?? now,
      updatedAt: now,
    };

    const client = await getPool().connect();

    try {
      await client.query('BEGIN');
      await upsert(client, name, newRow);
      await client.query('COMMIT');
      return clone(newRow);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function insertMany(name, rows) {
    checkCollection(name);
    await initialize();

    const now = new Date().toISOString();

    const newRows = rows.map((row) => ({
      ...row,
      id: row.id ?? crypto.randomUUID(),
      createdAt: row.createdAt ?? now,
      updatedAt: now,
    }));

    const client = await getPool().connect();

    try {
      await client.query('BEGIN');

      for (const row of newRows) {
        await upsert(client, name, row);
      }

      await client.query('COMMIT');
      return clone(newRows);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function update(name, id, changes) {
    checkCollection(name);
    await initialize();

    const client = await getPool().connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        `SELECT data FROM smartstudy_records
         WHERE collection = $1 AND id = $2
         FOR UPDATE`,
        [name, String(id)]
      );

      const existing = parseRow(result.rows[0]);

      if (!existing) {
        await client.query('COMMIT');
        return null;
      }

      const updated = clone(existing);

      if (typeof changes === 'function') {
        const returned = changes(updated);

        if (returned !== undefined) {
          Object.assign(updated, returned);
        }
      } else {
        Object.assign(updated, changes);
      }

      updated.id = existing.id;
      updated.updatedAt = new Date().toISOString();

      await upsert(client, name, updated);
      await client.query('COMMIT');

      return clone(updated);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function remove(name, id) {
    checkCollection(name);
    await initialize();

    const result = await getPool().query(
      `DELETE FROM smartstudy_records
       WHERE collection = $1 AND id = $2
       RETURNING id`,
      [name, String(id)]
    );

    // Match the JSON store: true if a record was deleted.
    return result.rowCount > 0;
  }

  async function removeWhere(name, predicate) {
    checkCollection(name);

    const rows = await list(name, predicate);

    if (rows.length === 0) {
      return 0;
    }

    const client = await getPool().connect();

    try {
      await client.query('BEGIN');

      for (const row of rows) {
        await client.query(
          `DELETE FROM smartstudy_records
           WHERE collection = $1 AND id = $2`,
          [name, String(row.id)]
        );
      }

      await client.query('COMMIT');
      return rows.length;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async function mutate(callback) {
    await initialize();

    const client = await getPool().connect();

    try {
      await client.query('BEGIN');

      await client.query(
        'SELECT pg_advisory_xact_lock($1)',
        [MUTATION_LOCK_ID]
      );

      const before = await readAll(client);
      const after = clone(before);
      const result = callback(after);

      if (result && typeof result.then === 'function') {
        throw new Error(
          'The mutate callback must be synchronous. Do not use await inside it.'
        );
      }

      for (const name of COLLECTIONS) {
        const oldRows = new Map(
          before[name].map((row) => [String(row.id), row])
        );

        const newRows = new Map(
          after[name].map((row) => [String(row.id), row])
        );

        for (const id of oldRows.keys()) {
          if (!newRows.has(id)) {
            await client.query(
              `DELETE FROM smartstudy_records
               WHERE collection = $1 AND id = $2`,
              [name, id]
            );
          }
        }

        for (const [id, row] of newRows) {
          const oldRow = oldRows.get(id);

          if (
            !oldRow ||
            JSON.stringify(oldRow) !== JSON.stringify(row)
          ) {
            await upsert(client, name, row);
          }
        }
      }

      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  return {
    list,
    get,
    findOne,
    insert,
    insertMany,
    update,
    remove,
    removeWhere,
    mutate,
  };
}

export async function closePostgresPool() {
  if (pool) {
    await pool.end();
    pool = undefined;
    initializationPromise = undefined;
  }
}
