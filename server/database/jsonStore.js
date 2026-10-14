import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * A small, safe JSON-file database.
 *
 * - Data lives in one JSON file with a named array per collection.
 * - Every change is applied to a copy first, written to a temp file, then
 *   renamed over the real file (so a crash mid-write cannot corrupt it).
 * - The previous version is kept as "<file>.bak".
 * - If the main file is unreadable, the store restores from the backup and
 *   keeps a copy of the damaged file for inspection.
 */

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

function emptyDb() {
  const db = { version: 1 };
  for (const name of COLLECTIONS) db[name] = [];
  return db;
}

function readAndCheck(file) {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('File does not contain a JSON object');
  }
  for (const name of COLLECTIONS) {
    if (!Array.isArray(parsed[name])) parsed[name] = [];
  }
  return parsed;
}

function load(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (const candidate of [file, `${file}.bak`]) {
    if (!fs.existsSync(candidate)) continue;
    try {
      return readAndCheck(candidate);
    } catch (err) {
      console.error(`[store] Could not read ${candidate}: ${err.message}`);
      if (candidate === file) {
        try {
          fs.copyFileSync(file, `${file}.corrupt-${Date.now()}`);
        } catch {
          /* ignore */
        }
      }
    }
  }
  return emptyDb();
}

function persist(file, data) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak`);
  fs.renameSync(tmp, file);
}

export function createStore(file) {
  let db = load(file);

  const clone = (value) => structuredClone(value);
  const assertCollection = (name) => {
    if (!COLLECTIONS.includes(name)) throw new Error(`Unknown collection: ${name}`);
  };

  /**
   * Run fn(draft) on a copy of the data. If fn succeeds the copy is saved to
   * disk and becomes the live data. If anything throws, nothing is changed.
   */
  function mutate(fn) {
    const draft = clone(db);
    const result = fn(draft);
    persist(file, draft);
    db = draft;
    return result;
  }

  return {
    mutate,

    list(name, predicate = () => true) {
      assertCollection(name);
      return clone(db[name].filter(predicate));
    },

    get(name, id) {
      assertCollection(name);
      const row = db[name].find((r) => r.id === id);
      return row ? clone(row) : null;
    },

    findOne(name, predicate) {
      assertCollection(name);
      const row = db[name].find(predicate);
      return row ? clone(row) : null;
    },

    insert(name, doc) {
      assertCollection(name);
      return mutate((d) => {
        const now = new Date().toISOString();
        const row = { id: crypto.randomUUID(), ...doc, createdAt: now, updatedAt: now };
        d[name].push(row);
        return clone(row);
      });
    },

    insertMany(name, docs) {
      assertCollection(name);
      return mutate((d) => {
        const now = new Date().toISOString();
        const rows = docs.map((doc) => ({
          id: crypto.randomUUID(),
          ...doc,
          createdAt: now,
          updatedAt: now,
        }));
        d[name].push(...rows);
        return clone(rows);
      });
    },

    update(name, id, patch) {
      assertCollection(name);
      return mutate((d) => {
        const row = d[name].find((r) => r.id === id);
        if (!row) return null;
        Object.assign(row, patch, { id: row.id, updatedAt: new Date().toISOString() });
        return clone(row);
      });
    },

    remove(name, id) {
      assertCollection(name);
      return mutate((d) => {
        const before = d[name].length;
        d[name] = d[name].filter((r) => r.id !== id);
        return d[name].length < before;
      });
    },

    removeWhere(name, predicate) {
      assertCollection(name);
      return mutate((d) => {
        const before = d[name].length;
        d[name] = d[name].filter((r) => !predicate(r));
        return before - d[name].length;
      });
    },
  };
}