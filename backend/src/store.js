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
  'user-raj': {
    id: 'user-raj',
    name: 'Raj Kumar',
    age: 58,
    role: 'patient',
    preferredLanguage: 'English',
    doctorId: 'doctor-priya',
    authorizedCaregivers: ['caregiver-anita'],
  },
  'user-anita': {
    id: 'user-anita',
    name: 'Anita Sharma',
    age: 63,
    role: 'patient',
    preferredLanguage: 'English',
    doctorId: 'doctor-priya',
    authorizedCaregivers: [],
  },
  'caregiver-anita': {
    id: 'caregiver-anita',
    name: 'Anita Sharma (Caregiver)',
    age: 52,
    role: 'caregiver',
    preferredLanguage: 'English',
    caregiverPatients: ['user-raj'],
  },
  'user-mohan': {
    id: 'user-mohan',
    name: 'Mohan Singh',
    age: 66,
    role: 'patient',
    preferredLanguage: 'English',
    doctorId: 'doctor-priya',
    authorizedCaregivers: [],
  },
  'doctor-priya': {
    id: 'doctor-priya',
    name: 'Dr. Priya Nair',
    role: 'doctor',
    specialty: 'Neurorehabilitation',
  },
  'doctor-vikram': {
    id: 'doctor-vikram',
    name: 'Dr. Vikram Rao',
    role: 'doctor',
    specialty: 'Neurology',
  },
  'doctor-sunita': {
    id: 'doctor-sunita',
    name: 'Dr. Sunita Menon',
    role: 'doctor',
    specialty: 'Physical Medicine and Rehabilitation',
  },
  'doctor-arvind': {
    id: 'doctor-arvind',
    name: 'Dr. Arvind Patel',
    role: 'doctor',
    specialty: 'Physiotherapy',
  },
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
  { email: 'vikram@neuroguard.demo', passwordHash: bcrypt.hashSync('doctor123', 10), userId: 'doctor-vikram' },
  { email: 'sunita@neuroguard.demo', passwordHash: bcrypt.hashSync('doctor123', 10), userId: 'doctor-sunita' },
  { email: 'arvind@neuroguard.demo', passwordHash: bcrypt.hashSync('doctor123', 10), userId: 'doctor-arvind' },
];

// Doctors catalog
const doctors = [
  {
    id: 'doc-priya',
    userId: 'doctor-priya',
    name: 'Dr. Priya Nair',
    specialization: 'Neurorehabilitation',
    qualifications: ['MBBS', 'MD - Physical Medicine & Rehab', 'Fellowship in Neurorehabilitation'],
    experienceYears: 14,
    consultationFee: 1200,
    bio: 'Specialist in post-stroke motor recovery, hemiplegic arm rehabilitation, and evidence-based neuroplasticity protocols.',
    clinic: {
      name: 'Apex Neurorehabilitation Center',
      address: 'Plot 42, Hill Road, Bandra West',
      city: 'Mumbai',
      roomNumber: 'OPD Suite 204',
      phone: '+91 22 2640 1199',
    },
    rating: 4.9,
    isActive: true,
  },
  {
    id: 'doc-vikram',
    userId: 'doctor-vikram',
    name: 'Dr. Vikram Rao',
    specialization: 'Neurology',
    qualifications: ['MBBS', 'DM - Neurology', 'FINR'],
    experienceYears: 18,
    consultationFee: 1500,
    bio: 'Consultant Neurologist focusing on acute stroke management, cerebrovascular disorders, and spasticity interventions.',
    clinic: {
      name: 'Metro Brain & Spine Institute',
      address: 'Central Avenue, Near Metro Station, Andheri East',
      city: 'Mumbai',
      roomNumber: 'Clinic 12B',
      phone: '+91 22 2835 4400',
    },
    rating: 4.8,
    isActive: true,
  },
  {
    id: 'doc-sunita',
    userId: 'doctor-sunita',
    name: 'Dr. Sunita Menon',
    specialization: 'Physical Medicine and Rehabilitation',
    qualifications: ['MBBS', 'DNB - PMR', 'Certified Stroke Rehab Specialist'],
    experienceYears: 11,
    consultationFee: 900,
    bio: 'Dedicated to functional independence restoration, balance training, gait re-education, and musculoskeletal coordination.',
    clinic: {
      name: 'Horizon Rehabilitation & Mobility Clinic',
      address: 'Hiranandani Business Park, Powai',
      city: 'Mumbai',
      roomNumber: 'Ground Floor, Suite G-03',
      phone: '+91 22 2570 8822',
    },
    rating: 4.7,
    isActive: true,
  },
  {
    id: 'doc-arvind',
    userId: 'doctor-arvind',
    name: 'Dr. Arvind Patel',
    specialization: 'Physiotherapy',
    qualifications: ['BPT', 'MPT - Neurological Sciences', 'MIAP'],
    experienceYears: 9,
    consultationFee: 800,
    bio: 'Clinical neuro-physiotherapist specializing in upper-limb coordination, sit-to-stand transitions, and kinematic re-training.',
    clinic: {
      name: 'CareWave Neuro Recovery Care',
      address: 'Senapati Bapat Marg, Dadar West',
      city: 'Mumbai',
      roomNumber: 'Rehab Wing, Level 1',
      phone: '+91 22 2430 7711',
    },
    rating: 4.9,
    isActive: true,
  },
];

// Doctor availabilities
const availabilities = doctors.map((doc) => ({
  id: `avail-${doc.id}`,
  doctorId: doc.id,
  workingDays: [1, 2, 3, 4, 5], // Monday through Friday
  dayStartTime: '09:00',
  dayEndTime: '17:00',
  slotDurationMinutes: 30,
  breakStartTime: '13:00',
  breakEndTime: '14:00',
  unavailableDates: [],
  blockedSlots: [],
}));

// In-memory appointments store
const appointments = [];

// In-memory shared recovery reports store
const sharedReports = [];

// In-memory notifications store
const notifications = [];

module.exports = {
  users,
  assessments,
  patients,
  alerts,
  credentials,
  assignments,
  doctors,
  availabilities,
  appointments,
  sharedReports,
  notifications,
};
