import { AppError } from '../utils/AppError.js';

/**
 * validate(schema) checks req.body with a zod schema.
 * On success req.body is replaced with the cleaned data (trimmed, converted).
 * On failure the client gets 400 with a per-field list of problems.
 */
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    const summary = details
      .slice(0, 3)
      .map((d) => (d.field ? `${d.field}: ${d.message}` : d.message))
      .join(' • ');
    return next(new AppError(400, summary || 'Invalid input.', { code: 'VALIDATION', details }));
  }
  req.body = result.data;
  return next();
};