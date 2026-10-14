/**
 * OPTIONAL demo-data seeder. Run it with:   npm run seed
 *
 * It creates ONE clearly labelled demo account with sample subjects, exams and assignments
 * so you can try the app quickly:
 *     email:    demo@smartstudy.local
 *     password: Demo@12345
 *
 * The marks, topics and dates are SAMPLE data. It never touches any other account, and it
 * does not create fake progress or sessions: you generate a plan and complete sessions yourself.
 *
 *   npm run seed            create the demo account (does nothing if it already exists)
 *   npm run seed -- --reset delete the demo account and its data, then create it again
 */
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { store } from './index.js';
import { defaultAvailability, SUBJECT_COLORS } from './defaults.js';
import { addDays, todayStr } from '../utils/dates.js';

const DEMO_EMAIL = 'demo@smartstudy.local';
const DEMO_PASSWORD = 'Demo@12345';
const reset = process.argv.includes('--reset');

const existing = store.findOne('users', (u) => u.email === DEMO_EMAIL);
if (existing && !reset) {
  console.log(`The demo account already exists (${DEMO_EMAIL}). Use "npm run seed -- --reset" to recreate it.`);
  process.exit(0);
}
if (existing) {
  store.mutate((d) => {
    d.users = d.users.filter((r) => r.id !== existing.id);
    for (const name of ['subjects', 'exams', 'assignments', 'availability', 'plans', 'sessions', 'progress']) {
      d[name] = d[name].filter((r) => r.userId !== existing.id);
    }
  });
  console.log('Removed the old demo account and its data.');
}

const today = todayStr();
const topics = (names, done = []) => names.map((name) => ({ id: crypto.randomUUID(), name, completed: done.includes(name) }));

const user = store.insert('users', {
  name: 'Demo Student (sample data)',
  email: DEMO_EMAIL,
  passwordHash: bcrypt.hashSync(DEMO_PASSWORD, 10),
  theme: 'system',
});
store.insert('availability', defaultAvailability(user.id));

const subjectDefs = [
  { name: 'Mathematics', difficulty: 5, current: 52, target: 85, hours: 14, topics: topics(['Algebra', 'Calculus', 'Trigonometry', 'Statistics', 'Probability'], ['Algebra']) },
  { name: 'Physics', difficulty: 4, current: 60, target: 80, hours: 10, topics: topics(['Kinematics', 'Dynamics', 'Energy and Work', 'Waves'], ['Kinematics']) },
  { name: 'English Literature', difficulty: 2, current: 74, target: 80, hours: 6, topics: topics(['Poetry', 'Drama', 'Prose', 'Essay Writing'], ['Poetry', 'Drama']) },
  { name: 'Computer Science', difficulty: 3, current: 68, target: 90, hours: 9, topics: topics(['Data Structures', 'Algorithms', 'Databases', 'Networks']) },
];

const subjects = subjectDefs.map((s, i) => {
  const row = store.insert('subjects', {
    userId: user.id,
    name: s.name,
    color: SUBJECT_COLORS[i % SUBJECT_COLORS.length],
    difficulty: s.difficulty,
    currentPerformance: s.current,
    targetPerformance: s.target,
    estimatedWorkloadHours: s.hours,
    topics: s.topics,
  });
  store.insert('progress', { userId: user.id, subjectId: row.id, kind: 'performance', value: s.current, recordedOn: today });
  return row;
});
const byName = Object.fromEntries(subjects.map((s) => [s.name, s]));

const exams = [
  { subject: 'Mathematics', title: 'Mathematics Mid-term', offset: 9, importance: 5 },
  { subject: 'Physics', title: 'Physics Unit Test', offset: 16, importance: 4 },
  { subject: 'Computer Science', title: 'CS Practical Exam', offset: 24, importance: 3 },
];
for (const e of exams) {
  store.insert('exams', { userId: user.id, subjectId: byName[e.subject].id, title: e.title, date: addDays(today, e.offset), startTime: null, importance: e.importance });
}

store.insert('assignments', { userId: user.id, subjectId: byName['English Literature'].id, title: 'Essay on a modern play', dueDate: addDays(today, 6), estimatedHours: 3, completed: false });
store.insert('assignments', { userId: user.id, subjectId: byName['Computer Science'].id, title: 'Database design report', dueDate: addDays(today, 12), estimatedHours: 4, completed: false });

console.log('');
console.log('Demo account created (sample data, labelled as such).');
console.log(`  email:    ${DEMO_EMAIL}`);
console.log(`  password: ${DEMO_PASSWORD}`);
console.log('Log in, then open "AI Planner" and click "Generate AI Study Plan".');
console.log('');