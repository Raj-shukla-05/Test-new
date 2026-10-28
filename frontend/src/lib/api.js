const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const error = new Error(body?.message || `Request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export const api = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  signup: (payload) => request('/auth/signup', { method: 'POST', body: JSON.stringify(payload) }),
  health: () => request('/health'),
  dashboard: (userId) => request(`/users/${userId}/dashboard`),
  assessments: (userId) => request(`/users/${userId}/assessments`),
  trends: (userId) => request(`/users/${userId}/trends`),
  caregiverPatients: (caregiverId) => request(`/caregivers/${caregiverId}/patients`),
  doctorPatients: (doctorId) => request(`/doctors/${doctorId}/patients`),
  alerts: (userId) => request(`/alerts/${userId}`),
  createAssessment: (payload) => request('/assessments', { method: 'POST', body: JSON.stringify(payload) }),
  explanation: (payload) => request('/explanation', { method: 'POST', body: JSON.stringify(payload) }),
  speechAnalyze: (payload) => request('/speech/analyze', { method: 'POST', body: JSON.stringify(payload) }),
  demoDecline: (userId) => request(`/users/${userId}/demo-decline`, { method: 'POST' }),
};
