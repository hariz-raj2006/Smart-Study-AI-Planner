import { AppError } from '../utils/AppError.js';

export function notFound(req, res, next) {
  next(new AppError(404, `Route not found: ${req.method} ${req.originalUrl}`));
}

// Express recognises error handlers by their four parameters. Keep all four.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({
      error: { message: err.message, code: err.code, details: err.details },
    });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { message: 'The request body is not valid JSON.' } });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: { message: 'The request body is too large.' } });
  }
  console.error('[server error]', err);
  return res
    .status(500)
    .json({ error: { message: 'Something went wrong on the server. Please try again.' } });
}