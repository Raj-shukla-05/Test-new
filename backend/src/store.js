const bcrypt = require('bcryptjs');

const days = [
  ['2026-09-01', 70, 68, 64, 69, 82],
  ['2026-09-03', 72, 71, 66, 70, 83],
  ['2026-09-05', 71, 72, 67, 71, 83],
  ['2026-09-07', 76, 77, 69, 72, 84],
  ['2026-09-10', 77, 80, 71, 74, 84],
  ['2026-09-14', 79, 82, 71, 76, 84],
  ['2026-09-21', 79, 82, 71, 76, 84],
];

const assessments = days.map(([date, score, movement, balance, coordination, speech], index) => ({
  id: `seed-${index + 1}`,
  userId: 'user-raj',
  assignmentId: null,
  timestamp: `${date}T10:30:00.000Z`,
  exerciseType: 'arm_raise',
  duration: 82,
  score,
  metrics: { movement, balance, coordination, speech, rangeOfMotion: movement, symmetry: coordination, movementQuality: movement },
  trackingQuality: { validFrames: 240, totalFrames: 250, trackingRatio: 0.96, qualityWarning: null, isValid: true },
  source: 'seed',
}));

const users = {
  'user-raj': { id: 'user-raj', name: 'Raj Kumar', age: 58, role: 'patient', preferredLanguage: 'English', caregiverId: 'caregiver-anita', doctorId: 'doctor-priya' },
  'user-anita': { id: 'user-anita', name: 'Anita Sharma', age: 63, role: 'patient', preferredLanguage: 'English', caregiverId: 'caregiver-anita', doctorId: 'doctor-priya' },
  'user-mohan': { id: 'user-mohan', name: 'Mohan Singh', age: 66, role: 'patient', preferredLanguage: 'English', caregiverId: 'caregiver-anita', doctorId: 'doctor-priya' },
  'caregiver-anita': { id: 'caregiver-anita', name: 'Anita Sharma', role: 'caregiver' },
  'doctor-priya': { id: 'doctor-priya', name: 'Dr. Priya Nair', role: 'doctor', specialty: 'Neurorehabilitation' },
};

const patients = [
  { id: 'user-raj', name: 'Raj Kumar', age: 58, status: 'stable', score: 79, change: 9.7, lastCheck: 'Today, 10:42 AM', doctorId: 'doctor-priya' },
  { id: 'user-anita', name: 'Anita Sharma', age: 63, status: 'monitor', score: 72, change: -7.2, lastCheck: 'Yesterday, 6:18 PM', doctorId: 'doctor-priya' },
  { id: 'user-mohan', name: 'Mohan Singh', age: 66, status: 'review', score: 68, change: -13, lastCheck: 'Yesterday, 4:05 PM', doctorId: 'doctor-priya' },
];

const alerts = new Map();
alerts.set('user-raj', [{ id: 'seed-alert', severity: 'monitor', type: 'Change detected', reason: 'Balance performance changed by 4% compared with the recent baseline.', timestamp: 'Today, 10:42 AM', action: 'Review change' }]);

// Persistent assessment assignments
const assignments = [
  {
    id: 'asgn-seed-1',
    doctorId: 'doctor-priya',
    patientId: 'user-raj',
    exerciseType: 'arm_raise',
    instructions: 'Perform 5 slow, bilateral arm raises in the morning. Keep shoulders relaxed and hold at the top for 1 second.',
    targetReps: 5,
    startDate: new Date(Date.now() - 2 * 86400000).toISOString(),
    dueDate: new Date(Date.now() + 5 * 86400000).toISOString(),
    status: 'assigned',
    completedSessionId: null,
    doctorNotes: '',
    reviewedAt: null,
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
];

// Seed accounts with secure bcrypt-hashed passwords
const credentials = [
  { email: 'raj@neuroguard.demo', passwordHash: bcrypt.hashSync('patient123', 10), userId: 'user-raj' },
  { email: 'anita@neuroguard.demo', passwordHash: bcrypt.hashSync('caregiver123', 10), userId: 'caregiver-anita' },
  { email: 'priya@neuroguard.demo', passwordHash: bcrypt.hashSync('doctor123', 10), userId: 'doctor-priya' },
];

module.exports = { users, assessments, patients, alerts, credentials, assignments };
