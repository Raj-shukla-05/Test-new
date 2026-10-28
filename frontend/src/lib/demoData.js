export const DEMO_USER_ID = 'user-raj';
export const DEMO_CAREGIVER_ID = 'caregiver-anita';

export const fallbackDashboard = {
  user: {
    id: DEMO_USER_ID,
    name: 'Raj Kumar',
    age: 58,
    role: 'patient',
    preferredLanguage: 'English',
  },
  summary: {
    functionalScore: 79,
    change: 9.7,
    trend: 'Improving',
    lastAssessment: 'Today',
  },
  metrics: {
    Movement: { value: 82, change: 10 },
    Balance: { value: 71, change: 4 },
    Coordination: { value: 76, change: 6 },
    Speech: { value: 84, change: 0 },
  },
  baseline: {
    functionalScore: 72,
    window: 5,
  },
};

export const fallbackTrends = [
  { day: 'D1', date: 'Sep 01', score: 70, movement: 68, balance: 64, coordination: 69, speech: 82 },
  { day: 'D3', date: 'Sep 03', score: 72, movement: 71, balance: 66, coordination: 70, speech: 83 },
  { day: 'D5', date: 'Sep 05', score: 71, movement: 72, balance: 67, coordination: 71, speech: 83 },
  { day: 'D7', date: 'Sep 07', score: 76, movement: 77, balance: 69, coordination: 72, speech: 84 },
  { day: 'D10', date: 'Sep 10', score: 77, movement: 80, balance: 71, coordination: 74, speech: 84 },
  { day: 'D14', date: 'Sep 14', score: 79, movement: 82, balance: 71, coordination: 76, speech: 84 },
  { day: 'D21', date: 'Sep 21', score: 79, movement: 82, balance: 71, coordination: 76, speech: 84 },
];

export const fallbackAlerts = [
  {
    id: 'alert-1',
    severity: 'monitor',
    type: 'Change detected',
    reason: 'Balance performance changed by 4% compared with the recent baseline.',
    timestamp: 'Today, 10:42 AM',
  },
];
