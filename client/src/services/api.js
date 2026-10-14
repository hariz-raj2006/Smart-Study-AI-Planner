/**
 * SmartStudy AI — API Service
 *
 * - Connects the React frontend to the Express backend.
 * - Supports local development and production deployment.
 * - Sends login cookies using credentials: 'include'.
 * - Handles JSON requests and API errors.
 * - Keeps Gemini API keys and other secrets on the backend.
 */

const BACKEND_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'https://YOUR-REAL-BACKEND.onrender.com';

// Remove trailing slashes and an optional /api suffix to prevent /api/api URLs.
const BASE = BACKEND_URL.replace(/\/+$/, '').replace(/\/api$/i, '');

export class ApiError extends Error {
  constructor(message, { status = 0, code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Build the complete backend URL.
 * Example: https://your-backend.onrender.com/api/auth/login
 */
function buildUrl(path, query) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }

  const queryString = params.toString();

  return `${BASE}/api${normalizedPath}${
    queryString ? `?${queryString}` : ''
  }`;
}

// These authentication routes may return 401 during normal login checks.
const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/me'];

/**
 * Send an HTTP request to the backend.
 */
export async function request(method, path, { body, query, signal } = {}) {
  let response;

  try {
    response = await fetch(buildUrl(path, query), {
      method,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(body !== undefined
          ? { 'Content-Type': 'application/json' }
          : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw err;
    }

    throw new ApiError(
      'Cannot reach the SmartStudy server. Check the backend URL and make sure the Render server is running.',
      {
        status: 0,
        code: 'NETWORK',
      }
    );
  }

  let data = null;

  try {
    data = await response.json();
  } catch {
    // The server may return an empty or non-JSON response.
  }

  if (!response.ok) {
    if (response.status === 401 && !AUTH_PATHS.includes(path)) {
      window.dispatchEvent(new CustomEvent('smartstudy:unauthorized'));
    }

    const info = data?.error || {};

    throw new ApiError(
      info.message || `The request failed (error ${response.status}).`,
      {
        status: response.status,
        code: info.code,
        details: info.details,
      }
    );
  }

  return data;
}

/**
 * Convenient API methods used by the frontend.
 */
export const api = {
  get: (path, opts) => request('GET', path, opts),

  post: (path, body, opts) =>
    request('POST', path, { ...opts, body: body ?? {} }),

  put: (path, body, opts) =>
    request('PUT', path, { ...opts, body: body ?? {} }),

  del: (path, opts) => request('DELETE', path, opts),
};