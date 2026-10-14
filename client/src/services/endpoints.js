/** Every backend call the frontend uses. Paths match the Express routes exactly. */
import { api } from './api.js';

const id = encodeURIComponent;

export const authApi = {
  me: (opts) => api.get('/auth/me', opts),
  login: (body) => api.post('/auth/login', body),
  register: (body) => api.post('/auth/register', body),
  logout: () => api.post('/auth/logout'),
  updateProfile: (body) => api.put('/auth/profile', body),
};

export const subjectsApi = {
  list: (opts) => api.get('/subjects', opts),
  create: (body) => api.post('/subjects', body),
  update: (subjectId, body) => api.put(`/subjects/${id(subjectId)}`, body),
  remove: (subjectId) => api.del(`/subjects/${id(subjectId)}`),
};

export const examsApi = {
  list: (opts) => api.get('/exams', opts),
  create: (body) => api.post('/exams', body),
  update: (examId, body) => api.put(`/exams/${id(examId)}`, body),
  remove: (examId) => api.del(`/exams/${id(examId)}`),
};

export const assignmentsApi = {
  list: (opts) => api.get('/assignments', opts),
  create: (body) => api.post('/assignments', body),
  update: (assignmentId, body) => api.put(`/assignments/${id(assignmentId)}`, body),
  remove: (assignmentId) => api.del(`/assignments/${id(assignmentId)}`),
};

export const availabilityApi = {
  get: (opts) => api.get('/availability', opts),
  update: (body) => api.put('/availability', body),
};

export const plansApi = {
  list: (opts) => api.get('/study-plans', opts),
  get: (planId, opts) => api.get(`/study-plans/${id(planId)}`, opts),
  update: (planId, body) => api.put(`/study-plans/${id(planId)}`, body),
  /** Local plan: scheduling algorithm only, no Gemini. */
  generateLocal: (body) => api.post('/study-plans/generate', body),
};

export const sessionsApi = {
  list: (query, opts) => api.get('/sessions', { ...opts, query }),
  create: (body) => api.post('/sessions', body),
  update: (sessionId, body) => api.put(`/sessions/${id(sessionId)}`, body),
  remove: (sessionId) => api.del(`/sessions/${id(sessionId)}`),
  complete: (sessionId, body) => api.post(`/sessions/${id(sessionId)}/complete`, body),
  skip: (sessionId, body) => api.post(`/sessions/${id(sessionId)}/skip`, body),
  reschedule: (sessionId, body) => api.post(`/sessions/${id(sessionId)}/reschedule`, body),
  slots: (sessionId, opts) => api.get(`/sessions/${id(sessionId)}/slots`, opts),
  rescheduleMissed: (body) => api.post('/sessions/reschedule-missed', body),
};

export const aiApi = {
  status: (opts) => api.get('/ai/status', opts),
  test: () => api.post('/ai/test'),
  generatePlan: (body) => api.post('/ai/generate-study-plan', body),
  assistant: (body) => api.post('/ai/assistant', body),
};

export const statsApi = {
  dashboard: (opts) => api.get('/dashboard', opts),
  progress: (opts) => api.get('/progress', opts),
};