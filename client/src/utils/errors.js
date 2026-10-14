/** Helpers for turning API errors into messages that suit the screen. */

export const errorMessage = (err, fallback = 'Something went wrong. Please try again.') =>
  (err && err.message) || fallback;

/** For validation errors (HTTP 400, code VALIDATION): { fieldName: "message" }. */
export function fieldErrors(err) {
  const out = {};
  if (err && err.code === 'VALIDATION' && Array.isArray(err.details)) {
    for (const d of err.details) {
      if (d && d.field && !out[d.field]) out[d.field] = d.message;
    }
  }
  return out;
}

export const isConfirmRequired = (err) => Boolean(err && err.code === 'CONFIRM_REQUIRED');
export const isAiError = (err) => Boolean(err && typeof err.code === 'string' && err.code.startsWith('AI_'));