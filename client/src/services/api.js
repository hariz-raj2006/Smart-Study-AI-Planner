/**
 * Tiny fetch wrapper for the SmartStudy backend.
 *  - Sends the httpOnly login cookie (credentials: 'include').
 *  - Always sends/receives JSON.
 *  - Throws ApiError with { status, code, details } so screens can show useful messages.
 * The Gemini API key never reaches this code: the browser only talks to our own server.
 */

const BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, { status = 0, code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function buildUrl(path, query) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return `${BASE}/api${path}${qs ? `?${qs}` : ''}`;
}

// These calls may legitimately answer 401 without meaning "your session expired".
const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/me'];

export async function request(method, path, { body, query, signal } = {}) {
  let response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json', Accept: 'application/json' } : { Accept: 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if (err && err.name === 'AbortError') throw err;
    throw new ApiError('Cannot reach the SmartStudy server. Make sure the backend is running (npm run dev in the server folder).', {
      status: 0,
      code: 'NETWORK',
    });
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    if (response.status === 401 && !AUTH_PATHS.includes(path)) {
      window.dispatchEvent(new CustomEvent('smartstudy:unauthorized'));
    }
    const info = data && data.error ? data.error : {};
    throw new ApiError(info.message || `The request failed (error ${response.status}).`, {
      status: response.status,
      code: info.code,
      details: info.details,
    });
  }
  return data;
}

export const api = {
  get: (path, opts) => request('GET', path, opts),
  post: (path, body, opts) => request('POST', path, { ...opts, body: body ?? {} }),
  put: (path, body, opts) => request('PUT', path, { ...opts, body: body ?? {} }),
  del: (path, opts) => request('DELETE', path, opts),
};