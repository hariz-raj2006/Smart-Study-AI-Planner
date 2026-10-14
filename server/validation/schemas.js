import { z } from 'zod';
import { isValidDateStr, isValidTimeStr, timeToMinutes } from '../utils/dates.js';

const dateStr = z.string().refine(isValidDateStr, 'Use a valid date (YYYY-MM-DD)');
const timeStr = z.string().refine(isValidTimeStr, 'Use a valid time (HH:MM, 24-hour)');
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must look like #4f46e5');
const idStr = z.string().min(1, 'This field is required').max(100);

// ---------- Authentication ----------

const passwordRule = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(100, 'Password is too long')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number');

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60),
    email: z.string().trim().toLowerCase().email('Enter a valid email address').max(120),
    password: passwordRule,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required').max(100),
});

export const profileSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60).optional(),
    theme: z.enum(['light', 'dark', 'system']).optional(),
    currentPassword: z.string().max(100).optional(),
    newPassword: passwordRule.optional(),
  })
  .superRefine((d, ctx) => {
    if (d.newPassword && !d.currentPassword) {
      ctx.addIssue({
        code: 'custom',
        path: ['currentPassword'],
        message: 'Enter your current password to set a new one',
      });
    }
  });

// ---------- Subjects ----------

const topicSchema = z.object({
  id: z.string().max(100).optional(),
  name: z.string().trim().min(1, 'Topic name is required').max(100),
  completed: z.boolean().default(false),
});

export const subjectSchema = z.object({
  name: z.string().trim().min(1, 'Subject name is required').max(80),
  color: hexColor.optional(),
  difficulty: z.coerce.number().int().min(1, 'Difficulty is 1 to 5').max(5, 'Difficulty is 1 to 5'),
  currentPerformance: z.coerce.number().min(0, 'Must be 0 to 100').max(100, 'Must be 0 to 100'),
  targetPerformance: z.coerce.number().min(0, 'Must be 0 to 100').max(100, 'Must be 0 to 100'),
  estimatedWorkloadHours: z.coerce
    .number()
    .min(0.5, 'Workload must be at least 0.5 hours')
    .max(500, 'Workload cannot exceed 500 hours'),
  topics: z.array(topicSchema).max(100, 'A subject can have at most 100 topics').default([]),
});

// ---------- Exams and assignments ----------

export const examSchema = z.object({
  subjectId: idStr,
  title: z.string().trim().min(1, 'Exam title is required').max(100),
  date: dateStr,
  startTime: timeStr.optional(),
  importance: z.coerce.number().int().min(1, 'Importance is 1 to 5').max(5, 'Importance is 1 to 5'),
});

export const assignmentSchema = z.object({
  subjectId: idStr,
  title: z.string().trim().min(1, 'Assignment title is required').max(100),
  dueDate: dateStr,
  estimatedHours: z.coerce.number().min(0.25, 'At least 0.25 hours').max(100, 'At most 100 hours'),
  completed: z.boolean().optional(),
});

// ---------- Availability and preferences ----------

const commitmentSchema = z.object({
  id: z.string().max(100).optional(),
  title: z.string().trim().min(1, 'Commitment title is required').max(80),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: timeStr,
  endTime: timeStr,
});

export const availabilitySchema = z
  .object({
    studyDays: z
      .array(z.coerce.number().int().min(0).max(6))
      .min(1, 'Select at least one study day')
      .transform((days) => [...new Set(days)].sort((a, b) => a - b)),
    startTime: timeStr,
    endTime: timeStr,
    breakMinutes: z.coerce.number().int().min(0, 'Break is 0 to 60 minutes').max(60, 'Break is 0 to 60 minutes'),
    sessionMinutes: z.coerce.number().int().min(15, 'Session is 15 to 180 minutes').max(180, 'Session is 15 to 180 minutes'),
    maxDailyHours: z.coerce.number().min(0.5, 'Daily limit is 0.5 to 16 hours').max(16, 'Daily limit is 0.5 to 16 hours'),
    preferredPeriod: z.enum(['morning', 'afternoon', 'evening', 'any']),
    restDates: z.array(dateStr).max(366).default([]),
    commitments: z.array(commitmentSchema).max(50).default([]),
  })
  .superRefine((d, ctx) => {
    const start = timeToMinutes(d.startTime);
    const end = timeToMinutes(d.endTime);
    if (end <= start) {
      ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'End time must be after start time' });
    } else if (end - start < d.sessionMinutes) {
      ctx.addIssue({
        code: 'custom',
        path: ['endTime'],
        message: 'The study window must be at least as long as one study session',
      });
    }
    d.commitments.forEach((c, i) => {
      if (timeToMinutes(c.endTime) <= timeToMinutes(c.startTime)) {
        ctx.addIssue({
          code: 'custom',
          path: ['commitments', i, 'endTime'],
          message: 'A commitment must end after it starts',
        });
      }
    });
  });