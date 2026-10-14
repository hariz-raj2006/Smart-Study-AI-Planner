import crypto from 'node:crypto';
import { store } from '../database/index.js';
import { defaultAvailability } from '../database/defaults.js';

function findOrCreate(userId) {
  const existing = store.findOne('availability', (a) => a.userId === userId);
  return existing || store.insert('availability', defaultAvailability(userId));
}

export function getAvailability(req, res) {
  res.json({ availability: findOrCreate(req.user.id) });
}

export function updateAvailability(req, res) {
  const current = findOrCreate(req.user.id);
  const d = req.body;

  const availability = store.update('availability', current.id, {
    studyDays: d.studyDays,
    startTime: d.startTime,
    endTime: d.endTime,
    breakMinutes: d.breakMinutes,
    sessionMinutes: d.sessionMinutes,
    maxDailyHours: d.maxDailyHours,
    preferredPeriod: d.preferredPeriod,
    restDates: [...new Set(d.restDates)].sort(),
    commitments: d.commitments.map((c) => ({ ...c, id: c.id || crypto.randomUUID() })),
  });
  res.json({ availability });
}