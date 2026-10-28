require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { users, assessments, patients, alerts, credentials } = require('./store');
const { buildDashboard, buildTrend, createAlert } = require('./trendEngine');

const app = express();
const PORT = Number(process.env.PORT || 5000);

app.use(cors({ origin: true }));
app.use(express.json({ limit: '256kb' }));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'neuroguard-backend', timestamp: new Date().toISOString() }));

app.post('/api/auth/login', (req, res) => {
  const { email = '', password = '' } = req.body || {};
  const match = credentials.find((c) => c.email === String(email).trim().toLowerCase() && c.password === password);
  if (!match) return res.status(401).json({ message: 'Invalid email or password' });
  return res.json({ user: users[match.userId] });
});

app.post('/api/auth/signup', (req, res) => {
  const { name = '', email = '', password = '', role = 'patient' } = req.body || {};
  const cleanName = String(name).trim();
  const cleanEmail = String(email).trim().toLowerCase();
  if (!cleanName) return res.status(400).json({ message: 'Name is required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return res.status(400).json({ message: 'Enter a valid email address' });
  if (String(password).length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });
  if (!['patient', 'caregiver', 'doctor'].includes(role)) return res.status(400).json({ message: 'Role must be patient, caregiver or doctor' });
  if (credentials.some((c) => c.email === cleanEmail)) return res.status(409).json({ message: 'An account with this email already exists' });
  const id = `${role === 'patient' ? 'user' : role}-${Date.now().toString(36)}`;
  const user = role !== 'patient'
    ? { id, name: cleanName, role }
    : { id, name: cleanName, role, preferredLanguage: 'English', caregiverId: 'caregiver-anita' };
  users[id] = user;
  credentials.push({ email: cleanEmail, password, userId: id });
  if (role === 'patient') patients.push({ id, name: cleanName, status: 'stable', score: 0, change: 0, lastCheck: 'No checks yet' });
  return res.status(201).json({ user });
});

app.get('/api/users/:id/dashboard', (req, res) => {
  const user = users[req.params.id];
  if (!user) return res.status(404).json({ message: 'User not found' });
  return res.json(buildDashboard(user, assessments.filter((item) => item.userId === req.params.id)));
});

app.get('/api/users/:id/assessments', (req, res) => {
  res.json(assessments.filter((item) => item.userId === req.params.id).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
});

app.get('/api/users/:id/trends', (req, res) => {
  res.json(buildTrend(assessments.filter((item) => item.userId === req.params.id)));
});

app.get('/api/alerts/:id', (req, res) => {
  const current = assessments.filter((item) => item.userId === req.params.id);
  const generated = createAlert(req.params.id, current);
  const seeded = alerts.get(req.params.id) || [];
  if (generated) {
    const merged = [generated, ...seeded.filter((item) => item.id !== generated.id)];
    return res.json(merged.slice(0, 3));
  }
  return res.json(seeded.slice(0, 3));
});

app.get('/api/caregivers/:id/patients', (req, res) => {
  if (!users[req.params.id] || users[req.params.id].role !== 'caregiver') return res.status(404).json({ message: 'Caregiver not found' });
  res.json(patients);
});

app.get('/api/doctors/:id/patients', (req, res) => {
  if (!users[req.params.id] || users[req.params.id].role !== 'doctor') return res.status(404).json({ message: 'Doctor not found' });
  res.json(patients.map((p) => ({
    ...p,
    age: p.age ?? users[p.id]?.age ?? null,
    sessions: assessments.filter((a) => a.userId === p.id).length,
  })));
});

app.post('/api/assessments', (req, res) => {
  const { userId, exerciseType, duration, score, metrics } = req.body || {};
  if (!userId || !exerciseType || typeof score !== 'number') return res.status(400).json({ message: 'userId, exerciseType and numeric score are required' });
  const inputMetrics = metrics || {};
  const normalizedMetrics = { ...inputMetrics };
  if (exerciseType === 'arm_raise') {
    normalizedMetrics.movement = Number(inputMetrics.rangeOfMotion ?? inputMetrics.movementQuality ?? score);
    normalizedMetrics.balance = Number(inputMetrics.movementQuality ?? score);
    normalizedMetrics.coordination = Number(inputMetrics.symmetry ?? score);
    normalizedMetrics.speech = Number(inputMetrics.speech ?? 84);
  }
  const record = {
    id: `assessment-${Date.now()}`,
    userId,
    timestamp: new Date().toISOString(),
    exerciseType,
    duration: Number(duration || 0),
    score: Math.max(0, Math.min(100, Number(score))),
    metrics: normalizedMetrics,
    source: 'live',
  };
  assessments.push(record);
  res.status(201).json(record);
});

app.post('/api/users/:id/demo-decline', (req, res) => {
  const userId = req.params.id;
  const template = [81, 79, 75, 71, 68];
  template.forEach((score, index) => {
    const metrics = { movement: score + (index === 0 ? 1 : 0), balance: score - 4, coordination: score - 2, speech: 84, rangeOfMotion: score - 2, symmetry: score - 3, movementQuality: score - 1 };
    assessments.push({ id: `decline-${Date.now()}-${index}`, userId, timestamp: new Date(Date.now() - (5 - index) * 86400000).toISOString(), exerciseType: 'arm_raise', duration: 80, score, metrics, source: 'demo' });
  });
  alerts.set(userId, [{ id: `demo-alert-${Date.now()}`, severity: 'review', type: 'Persistent deviation', reason: 'Movement and balance are trending below Raj’s recent baseline across the last three sessions.', timestamp: 'Demo scenario', action: 'Review recommended' }]);
  const patient = patients.find((item) => item.id === userId);
  if (patient) { patient.status = 'review'; patient.score = 68; patient.change = -13; patient.lastCheck = 'Demo scenario'; }
  res.json({ ok: true, message: 'Decline demo loaded' });
});

app.post('/api/speech/analyze', (req, res) => {
  const { transcript = '', expectedText = '', duration = 0, pauseCount = 0 } = req.body || {};
  const words = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;
  const expectedWords = expectedText.trim() ? expectedText.trim().split(/\s+/).length : words;
  const normalizedA = transcript.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const normalizedB = expectedText.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const similarity = normalizedB ? Math.round((normalizedA === normalizedB ? 100 : tokenSimilarity(normalizedA, normalizedB)) * 10) / 10 : 0;
  const rate = duration > 0 ? Math.round((words / (duration / 60)) * 10) / 10 : 0;
  res.json({ speakingDuration: Number(duration), pauses: Number(pauseCount), speechRate: rate, transcriptionSimilarity: similarity, wordCount: words, expectedWordCount: expectedWords });
});

function tokenSimilarity(a, b) {
  const A = new Set(a.split(/\s+/).filter(Boolean));
  const B = new Set(b.split(/\s+/).filter(Boolean));
  const union = new Set([...A, ...B]);
  const intersection = [...A].filter((x) => B.has(x));
  return union.size ? (intersection.length / union.size) * 100 : 0;
}

app.post('/api/explanation', async (req, res) => {
  const { findings = {} } = req.body || {};
  const local = buildLocalExplanation(findings);
  if (!process.env.OPENAI_API_KEY) return res.json({ source: 'local', text: local });
  try {
    const model = process.env.OPENAI_MODEL || 'gpt-5-mini';
    const prompt = `You are an explanation layer for a non-diagnostic rehabilitation monitoring prototype. Explain the structured findings below in plain language. Do not diagnose, prescribe treatment, or infer an emergency. Mention that the change should be discussed with a caregiver or rehabilitation professional when appropriate. Findings: ${JSON.stringify(findings)}`;
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model, input: prompt }),
    });
    if (!response.ok) throw new Error('LLM request failed');
    const data = await response.json();
    const text = data.output_text || local;
    return res.json({ source: 'openai', text });
  } catch (err) {
    return res.json({ source: 'local-fallback', text: local });
  }
});

function buildLocalExplanation(findings) {
  const movement = Number(findings.movement_change ?? 0);
  const balance = Number(findings.balance_change ?? 0);
  const speech = Number(findings.speech_change ?? 0);
  if (findings.trend === 'persistent_decline') {
    return `Recent movement and balance performance are below the recent personal baseline (${Math.abs(movement)}% and ${Math.abs(balance)}% respectively). The pattern has persisted across multiple sessions. Consider reviewing this change with the patient's caregiver or rehabilitation professional.`;
  }
  if (movement > 0 || balance > 0 || speech > 0) {
    return `Recent functional performance is trending upward compared with the personal baseline. Movement changed by ${movement}%, balance by ${balance}%, and speech by ${speech}%.`;
  }
  return `The latest functional check is within the expected range of the recent personal baseline. NeuroGuard will continue looking for meaningful changes across repeated sessions.`;
}

app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

app.listen(PORT, () => console.log(`NeuroGuard backend running on http://localhost:${PORT}`));
