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
  timestamp: `${date}T10:30:00.000Z`,
  exerciseType: 'arm_raise',
  duration: 82,
  score,
  metrics: { movement, balance, coordination, speech, rangeOfMotion: movement, symmetry: coordination, movementQuality: movement },
  source: 'seed',
}));

const users = {
  'user-raj': { id: 'user-raj', name: 'Raj Kumar', age: 58, role: 'patient', preferredLanguage: 'English', caregiverId: 'caregiver-anita' },
  'user-anita': { id: 'user-anita', name: 'Anita Sharma', age: 63, role: 'patient', preferredLanguage: 'English', caregiverId: 'caregiver-anita' },
  'user-mohan': { id: 'user-mohan', name: 'Mohan Singh', age: 66, role: 'patient', preferredLanguage: 'English', caregiverId: 'caregiver-anita' },
  'caregiver-anita': { id: 'caregiver-anita', name: 'Anita Sharma', role: 'caregiver' },
  'doctor-priya': { id: 'doctor-priya', name: 'Dr. Priya Nair', role: 'doctor', specialty: 'Neurorehabilitation' },
};

const patients = [
  { id: 'user-raj', name: 'Raj Kumar', age: 58, status: 'stable', score: 79, change: 9.7, lastCheck: 'Today, 10:42 AM' },
  { id: 'user-anita', name: 'Anita Sharma', age: 63, status: 'monitor', score: 72, change: -7.2, lastCheck: 'Yesterday, 6:18 PM' },
  { id: 'user-mohan', name: 'Mohan Singh', age: 66, status: 'review', score: 68, change: -13, lastCheck: 'Yesterday, 4:05 PM' },
];

const alerts = new Map();
alerts.set('user-raj', [{ id: 'seed-alert', severity: 'monitor', type: 'Change detected', reason: 'Balance performance changed by 4% compared with the recent baseline.', timestamp: 'Today, 10:42 AM', action: 'Review change' }]);

// Demo-only credentials (plaintext on purpose; prototype, no real accounts).
const credentials = [
  { email: 'raj@neuroguard.demo', password: 'patient123', userId: 'user-raj' },
  { email: 'anita@neuroguard.demo', password: 'caregiver123', userId: 'caregiver-anita' },
  { email: 'priya@neuroguard.demo', password: 'doctor123', userId: 'doctor-priya' },
];

module.exports = { users, assessments, patients, alerts, credentials };
