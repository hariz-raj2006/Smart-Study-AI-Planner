/** Colors given to subjects in order, so each subject looks different. */
export const SUBJECT_COLORS = [
  '#4f46e5', // indigo
  '#7c3aed', // violet
  '#0ea5e9', // sky
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#ec4899', // pink
  '#14b8a6', // teal
];

/** Availability given to every new account. Students edit it on the Availability page. */
export function defaultAvailability(userId) {
  return {
    userId,
    studyDays: [1, 2, 3, 4, 5, 6], // 0 = Sunday ... 6 = Saturday
    startTime: '16:00',
    endTime: '21:00',
    breakMinutes: 10,
    sessionMinutes: 50,
    maxDailyHours: 4,
    preferredPeriod: 'evening', // morning | afternoon | evening | any
    restDates: [], // specific dates (YYYY-MM-DD) with no studying
    commitments: [], // weekly fixed commitments [{ id, title, dayOfWeek, startTime, endTime }]
  };
}