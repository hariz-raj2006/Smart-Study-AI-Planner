import { z } from 'zod';
import { isValidDateStr, isValidTimeStr, timeToMinutes } from '../utils/dates.js';
import { ACTIVITY_TYPES } from '../services/schedulingService.js';

const dateStr = z.string().refine(isValidDateStr, 'Use a valid date (YYYY-MM-DD)');
const timeStr = z.string().refine(isValidTimeStr, 'Use a valid time (HH:MM, 24-hour)');
const idStr = z.string().min(1, 'This field is required').max(100);

export const sessionSchema = z
  .object({
    subjectId: idStr,
    date: dateStr,
    startTime: timeStr,
    endTime: timeStr,
    topic: z.string().trim().min(1, 'Topic is required').max(120),
    activityType: z.enum(ACTIVITY_TYPES).default('learning'),
    notes: z.string().trim().max(300).optional(),
    assignmentId: z.string().max(100).optional(),
  })
  .superRefine((d, ctx) => {
    if (isValidTimeStr(d.startTime) && isValidTimeStr(d.endTime) && timeToMinutes(d.endTime) <= timeToMinutes(d.startTime)) {
      ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'End time must be after start time' });
    }
  });

export const completeSchema = z.object({
  completedMinutes: z.coerce.number().int().min(1, 'At least 1 minute').max(600).optional(),
  completedTopicIds: z.array(z.string().max(100)).max(50).default([]),
});

export const skipSchema = z.object({
  status: z.enum(['missed', 'skipped']).default('missed'),
  reason: z.string().trim().max(200).optional(),
});

export const rescheduleSchema = z
  .object({
    mode: z.enum(['manual', 'auto']).default('manual'),
    date: dateStr.optional(),
    startTime: timeStr.optional(),
    preview: z.boolean().default(false),
    confirm: z.boolean().default(false),
    askAi: z.boolean().default(false),
  })
  .superRefine((d, ctx) => {
    if (d.mode === 'manual') {
      if (!d.date) ctx.addIssue({ code: 'custom', path: ['date'], message: 'Choose a new date' });
      if (!d.startTime) ctx.addIssue({ code: 'custom', path: ['startTime'], message: 'Choose a new start time' });
    }
  });

export const rescheduleMissedSchema = z.object({
  sessionIds: z.array(idStr).max(200).optional(),
  preview: z.boolean().default(false),
  confirm: z.boolean().default(false),
  askAi: z.boolean().default(false),
});

export const planGenerateSchema = z.object({
  planDays: z.coerce.number().int().min(1, 'At least 1 day').max(28, 'At most 28 days').default(14),
  confirm: z.boolean().default(false),
});

export const planUpdateSchema = z.object({
  title: z.string().trim().min(1).max(100).optional(),
  status: z.enum(['active', 'archived']).optional(),
});

export const assistantSchema = z.object({
  question: z.string().trim().min(1, 'Type a question').max(1000, 'Keep the question under 1000 characters'),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        text: z.string().max(2000),
      })
    )
    .max(10)
    .default([]),
});