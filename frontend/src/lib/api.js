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

  // --- Doctor Discovery & Profile APIs ---
  doctors: (params = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.specialization) q.set('specialization', params.specialization);
    if (params.city) q.set('city', params.city);
    const queryString = q.toString();
    return request(`/doctors${queryString ? `?${queryString}` : ''}`);
  },
  doctor: (doctorId) => request(`/doctors/${doctorId}`),
  doctorAvailability: (doctorId, date) => request(`/doctors/${doctorId}/availability?date=${date}`),
  updateDoctorProfile: (payload) => request('/doctors/profile', { method: 'PATCH', body: JSON.stringify(payload) }),
  updateDoctorAvailability: (payload) => request('/doctors/availability', { method: 'PUT', body: JSON.stringify(payload) }),
  blockDoctorSlot: (payload) => request('/doctors/availability/block', { method: 'POST', body: JSON.stringify(payload) }),
  unblockDoctorSlot: (blockId) => request(`/doctors/availability/block/${blockId}`, { method: 'DELETE' }),

  // --- Appointments APIs ---
  bookAppointment: (payload) => request('/appointments', { method: 'POST', body: JSON.stringify(payload) }),
  myAppointments: () => request('/appointments/my'),
  doctorAppointments: () => request('/appointments/doctor'),
  appointment: (appointmentId) => request(`/appointments/${appointmentId}`),
  confirmAppointment: (appointmentId) => request(`/appointments/${appointmentId}/confirm`, { method: 'PATCH' }),
  rejectAppointment: (appointmentId, reason) =>
    request(`/appointments/${appointmentId}/reject`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
  cancelAppointment: (appointmentId, reason) =>
    request(`/appointments/${appointmentId}/cancel`, { method: 'PATCH', body: JSON.stringify({ reason }) }),
  rescheduleAppointment: (appointmentId, payload) =>
    request(`/appointments/${appointmentId}/reschedule`, { method: 'PATCH', body: JSON.stringify(payload) }),
  completeAppointment: (appointmentId) => request(`/appointments/${appointmentId}/complete`, { method: 'PATCH' }),
  noShowAppointment: (appointmentId) => request(`/appointments/${appointmentId}/no-show`, { method: 'PATCH' }),

  // --- Recovery Report Sharing APIs ---
  previewReport: (patientId) => request(`/reports/preview${patientId ? `?patientId=${patientId}` : ''}`),
  shareReport: (payload) => request('/reports/share', { method: 'POST', body: JSON.stringify(payload) }),
  sharedReportsWithMe: () => request('/reports/shared-with-me'),
  mySharedReports: () => request('/reports/my-shares'),
  sharedReport: (shareId) => request(`/reports/shared/${shareId}`),
  revokeReport: (shareId) => request(`/reports/shares/${shareId}`, { method: 'DELETE' }),

  // --- Notifications APIs ---
  notifications: () => request('/notifications'),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => request('/notifications/read-all', { method: 'POST' }),

  // --- Caregiver APIs ---
  caregiverPatients: (caregiverId) => request(`/caregivers/${caregiverId}/patients`),
};
