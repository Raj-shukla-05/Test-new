const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

let authToken = typeof window !== 'undefined' ? window.sessionStorage?.getItem('neuroguard.token') : null;

export function setAuthToken(token) {
  authToken = token;
  if (token) {
    try { window.sessionStorage?.setItem('neuroguard.token', token); } catch {}
  } else {
    try { window.sessionStorage?.removeItem('neuroguard.token'); } catch {}
  }
}

export function getAuthToken() {
  return authToken;
}

export function clearAuthToken() {
  authToken = null;
  try { window.sessionStorage?.removeItem('neuroguard.token'); } catch {}
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const error = new Error(body?.message || `Request failed: ${response.status}`);
    error.status = response.status;
    if (response.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('neuroguard:unauthorized'));
    }
    throw error;
  }
  return response.json();
}

export const api = {
  setAuthToken,
  getAuthToken,
  clearAuthToken,
  login: async (email, password) => {
    const res = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (res?.token) setAuthToken(res.token);
    return res;
  },
  signup: async (payload) => {
    const res = await request('/auth/signup', { method: 'POST', body: JSON.stringify(payload) });
    if (res?.token) setAuthToken(res.token);
    return res;
  },
  health: () => request('/health'),
  dashboard: (userId) => request(`/users/${userId}/dashboard`),
  assessments: (userId) => request(`/users/${userId}/assessments`),
  trends: (userId) => request(`/users/${userId}/trends`),
  caregiverPatients: (caregiverId) => request(`/caregivers/${caregiverId}/patients`),
  doctorPatients: (doctorId) => request(`/doctors/${doctorId}/patients`),
  alerts: (userId) => request(`/alerts/${userId}`),
  patientAssignments: (patientId) => request(`/patients/${patientId}/assignments`),
  assignment: (id) => request(`/assignments/${id}`),
  createAssignment: (payload) => request('/assignments', { method: 'POST', body: JSON.stringify(payload) }),
  updateAssignmentStatus: (id, payload) => request(`/assignments/${id}/status`, { method: 'PATCH', body: JSON.stringify(payload) }),
  doctorAssignments: (doctorId) => request(`/doctors/${doctorId}/assignments`),
  createAssessment: (payload) => request('/assessments', { method: 'POST', body: JSON.stringify(payload) }),
  explanation: (payload) => request('/explanation', { method: 'POST', body: JSON.stringify(payload) }),
  speechAnalyze: (payload) => request('/speech/analyze', { method: 'POST', body: JSON.stringify(payload) }),
  demoDecline: (userId) => request(`/users/${userId}/demo-decline`, { method: 'POST' }),
};
