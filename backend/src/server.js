require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { users, assessments, patients, alerts, credentials, assignments } = require('./store');
const { buildDashboard, buildTrend, createAlert } = require('./trendEngine');
const { generateToken, authenticateToken, requireRole, requireSelfOrDoctor } = require('./middleware/auth');
const { generateExplanation } = require('./services/geminiService');
const { connectDB, isMongoConnected } = require('./db');
const User = require('./models/User');
const Assessment = require('./models/Assessment');
const Alert = require('./models/Alert');
const Assignment = require('./models/Assignment');

const app = express();
const PORT = Number(process.env.PORT || 5000);

app.use(cors({ origin: true }));
app.use(express.json({ limit: '256kb' }));

// Initialize MongoDB connection if running as main server
if (require.main === module) {
  connectDB().catch((err) => {
    console.warn(`[Database] Initialization error: ${err.message}`);
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'neuroguard-backend',
    database: isMongoConnected() ? 'connected' : 'in-memory',
    aiService: process.env.GEMINI_API_KEY ? 'gemini' : 'local-engine',
    timestamp: new Date().toISOString(),
  });
});

// Helper to resolve dynamic status (e.g. expiration)
function resolveAssignmentStatus(assignment) {
  if (!assignment) return null;
  if (['assigned', 'in_progress'].includes(assignment.status) && new Date() > new Date(assignment.dueDate)) {
    return 'expired';
  }
  return assignment.status;
}

// --- Authentication Endpoints ---

app.post('/api/auth/login', async (req, res) => {
  const { email = '', password = '' } = req.body || {};
  const cleanEmail = String(email).trim().toLowerCase();

  const match = credentials.find((c) => c.email === cleanEmail);
  if (!match) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  // Support bcrypt verification with fallback for plain text during testing
  let isPasswordValid = false;
  if (match.passwordHash) {
    isPasswordValid = await bcrypt.compare(password, match.passwordHash);
  } else if (match.password) {
    isPasswordValid = match.password === password;
  }

  if (!isPasswordValid) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }

  const user = users[match.userId];
  if (!user) {
    return res.status(404).json({ message: 'User profile not found' });
  }

  const token = generateToken({
    userId: user.id,
    role: user.role,
    name: user.name,
    email: match.email,
  });

  return res.json({ user, token });
});

app.post('/api/auth/signup', async (req, res) => {
  const { name = '', email = '', password = '', role = 'patient' } = req.body || {};
  const cleanName = String(name).trim();
  const cleanEmail = String(email).trim().toLowerCase();

  if (!cleanName) return res.status(400).json({ message: 'Name is required' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ message: 'Enter a valid email address' });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }
  if (!['patient', 'caregiver', 'doctor'].includes(role)) {
    return res.status(400).json({ message: 'Role must be patient, doctor or caregiver' });
  }

  if (credentials.some((c) => c.email === cleanEmail)) {
    return res.status(409).json({ message: 'An account with this email already exists' });
  }

  const id = `${role === 'patient' ? 'user' : role}-${Date.now().toString(36)}`;
  const passwordHash = await bcrypt.hash(password, 10);

  const user = role !== 'patient'
    ? { id, name: cleanName, role }
    : { id, name: cleanName, role, preferredLanguage: 'English', caregiverId: 'caregiver-anita', doctorId: 'doctor-priya' };

  users[id] = user;
  credentials.push({ email: cleanEmail, passwordHash, userId: id });

  if (role === 'patient') {
    patients.push({ id, name: cleanName, status: 'stable', score: 0, change: 0, lastCheck: 'No checks yet', doctorId: 'doctor-priya' });
  }

  // Persist to MongoDB if connected
  if (isMongoConnected()) {
    User.create({
      id,
      name: cleanName,
      email: cleanEmail,
      passwordHash,
      role,
      preferredLanguage: user.preferredLanguage,
      caregiverId: user.caregiverId,
      doctorId: user.doctorId,
    }).catch((err) => console.warn(`[Database] Failed to persist user: ${err.message}`));
  }

  const token = generateToken({
    userId: user.id,
    role: user.role,
    name: user.name,
    email: cleanEmail,
  });

  return res.status(201).json({ user, token });
});

// --- Protected Patient Data Endpoints ---

app.get('/api/users/:id/dashboard', authenticateToken, requireSelfOrDoctor, (req, res) => {
  const user = users[req.params.id];
  if (!user) return res.status(404).json({ message: 'User not found' });
  return res.json(buildDashboard(user, assessments.filter((item) => item.userId === req.params.id)));
});

app.get('/api/users/:id/assessments', authenticateToken, requireSelfOrDoctor, (req, res) => {
  res.json(
    assessments
      .filter((item) => item.userId === req.params.id)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  );
});

app.get('/api/users/:id/trends', authenticateToken, requireSelfOrDoctor, (req, res) => {
  res.json(buildTrend(assessments.filter((item) => item.userId === req.params.id)));
});

app.get('/api/alerts/:id', authenticateToken, requireSelfOrDoctor, (req, res) => {
  const current = assessments.filter((item) => item.userId === req.params.id);
  const generated = createAlert(req.params.id, current);
  const seeded = alerts.get(req.params.id) || [];
  if (generated) {
    const merged = [generated, ...seeded.filter((item) => item.id !== generated.id)];
    return res.json(merged.slice(0, 3));
  }
  return res.json(seeded.slice(0, 3));
});

// --- Role-Specific Clinical & Caregiver Oversight Endpoints ---

app.get('/api/caregivers/:id/patients', authenticateToken, requireRole('caregiver', 'doctor'), (req, res) => {
  if (!users[req.params.id] || users[req.params.id].role !== 'caregiver') {
    return res.status(404).json({ message: 'Caregiver not found' });
  }
  res.json(patients);
});

app.get('/api/doctors/:id/patients', authenticateToken, requireRole('doctor'), (req, res) => {
  if (req.user.userId !== req.params.id) {
    return res.status(403).json({ message: 'Forbidden: you cannot view another doctor\'s patient roster' });
  }
  if (!users[req.params.id] || users[req.params.id].role !== 'doctor') {
    return res.status(404).json({ message: 'Doctor not found' });
  }

  // Return patients authorized for this doctor (assigned to them or unassigned in demo)
  const doctorPatients = patients.filter((p) => !p.doctorId || p.doctorId === req.params.id);

  res.json(doctorPatients.map((p) => ({
    ...p,
    age: p.age ?? users[p.id]?.age ?? null,
    sessions: assessments.filter((a) => a.userId === p.id).length,
    activeAssignments: assignments.filter(
      (a) => a.patientId === p.id && ['assigned', 'in_progress'].includes(resolveAssignmentStatus(a))
    ).length,
  })));
});

// --- Assessment Assignment Endpoints ---

// 1. Doctor creates an assessment assignment for a patient
app.post('/api/assignments', authenticateToken, requireRole('doctor'), async (req, res) => {
  const doctorId = req.user.userId;
  const { patientId, exerciseType = 'arm_raise', instructions = '', targetReps = 5, startDate, dueDate } = req.body || {};

  if (!patientId) {
    return res.status(400).json({ message: 'patientId is required' });
  }

  const patient = users[patientId];
  if (!patient || patient.role !== 'patient') {
    return res.status(404).json({ message: 'Patient not found' });
  }

  // Doctor authorization: verify patient is not assigned to a different doctor
  if (patient.doctorId && patient.doctorId !== doctorId) {
    return res.status(403).json({ message: 'Forbidden: patient is assigned to another clinician' });
  }

  if (!instructions || typeof instructions !== 'string' || !instructions.trim()) {
    return res.status(400).json({ message: 'Clinician-approved instructions are required' });
  }

  if (!['arm_raise', 'sit_to_stand', 'seated_reach'].includes(exerciseType)) {
    return res.status(400).json({ message: 'Invalid exercise type. Supported: arm_raise, sit_to_stand, seated_reach' });
  }

  const reps = Number(targetReps);
  if (isNaN(reps) || reps < 1 || reps > 30) {
    return res.status(400).json({ message: 'Target repetitions must be a number between 1 and 30' });
  }

  if (!dueDate || isNaN(new Date(dueDate).getTime())) {
    return res.status(400).json({ message: 'A valid due date is required' });
  }

  const parsedDueDate = new Date(dueDate);
  const parsedStartDate = startDate ? new Date(startDate) : new Date();
  if (parsedDueDate < parsedStartDate) {
    return res.status(400).json({ message: 'Due date cannot be before start date' });
  }

  // Ensure patient is linked to this doctor
  if (!patient.doctorId) {
    patient.doctorId = doctorId;
    const patRecord = patients.find((p) => p.id === patientId);
    if (patRecord) patRecord.doctorId = doctorId;
  }

  const assignmentId = `asgn-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const assignment = {
    id: assignmentId,
    doctorId,
    patientId,
    exerciseType,
    instructions: instructions.trim(),
    targetReps: reps,
    startDate: parsedStartDate.toISOString(),
    dueDate: parsedDueDate.toISOString(),
    status: 'assigned',
    completedSessionId: null,
    doctorNotes: '',
    reviewedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  assignments.push(assignment);

  if (isMongoConnected()) {
    Assignment.create(assignment).catch((err) =>
      console.warn(`[Database] Failed to persist assignment: ${err.message}`)
    );
  }

  res.status(201).json({ assignment });
});

// 2. Retrieve assignments for a patient (Patient or Doctor access)
app.get('/api/patients/:patientId/assignments', authenticateToken, (req, res) => {
  const { patientId } = req.params;

  // Patient access check: can only view own assignments
  if (req.user.role === 'patient' && req.user.userId !== patientId) {
    return res.status(403).json({ message: 'Forbidden: you can only view your own assignments' });
  }

  // Doctor access check: can only view authorized patients
  if (req.user.role === 'doctor') {
    const patient = users[patientId];
    if (!patient) return res.status(404).json({ message: 'Patient not found' });
    if (patient.doctorId && patient.doctorId !== req.user.userId) {
      return res.status(403).json({ message: 'Forbidden: you do not have clinical access to this patient' });
    }
  }

  const patientAssignments = assignments
    .filter((a) => a.patientId === patientId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((a) => {
      const resolvedStatus = resolveAssignmentStatus(a);
      const completedSession = a.completedSessionId
        ? assessments.find((s) => s.id === a.completedSessionId) || null
        : null;
      return {
        ...a,
        status: resolvedStatus,
        completedSession,
      };
    });

  res.json(patientAssignments);
});

// 3. Retrieve single assignment by ID
app.get('/api/assignments/:id', authenticateToken, (req, res) => {
  const assignment = assignments.find((a) => a.id === req.params.id);
  if (!assignment) {
    return res.status(404).json({ message: 'Assignment not found' });
  }

  if (req.user.role === 'patient' && req.user.userId !== assignment.patientId) {
    return res.status(403).json({ message: 'Forbidden: access denied to this assignment' });
  }

  if (req.user.role === 'doctor' && assignment.doctorId !== req.user.userId) {
    const patient = users[assignment.patientId];
    if (patient?.doctorId !== req.user.userId) {
      return res.status(403).json({ message: 'Forbidden: access denied to this assignment' });
    }
  }

  const resolvedStatus = resolveAssignmentStatus(assignment);
  const completedSession = assignment.completedSessionId
    ? assessments.find((s) => s.id === assignment.completedSessionId) || null
    : null;

  res.json({
    assignment: {
      ...assignment,
      status: resolvedStatus,
      completedSession,
    },
  });
});

// 4. Update assignment status (Lifecycle transitions)
app.patch('/api/assignments/:id/status', authenticateToken, (req, res) => {
  const assignment = assignments.find((a) => a.id === req.params.id);
  if (!assignment) {
    return res.status(404).json({ message: 'Assignment not found' });
  }

  const { status, doctorNotes } = req.body || {};
  const currentStatus = resolveAssignmentStatus(assignment);

  if (!['in_progress', 'completed', 'reviewed', 'cancelled'].includes(status)) {
    return res.status(400).json({ message: `Invalid target status: '${status}'` });
  }

  // Validate state transitions
  if (status === 'in_progress') {
    // Only assigned can transition to in_progress
    if (currentStatus !== 'assigned') {
      return res.status(400).json({ message: `Cannot transition from '${currentStatus}' to 'in_progress'` });
    }
    // Must be patient or doctor
    if (req.user.role === 'patient' && req.user.userId !== assignment.patientId) {
      return res.status(403).json({ message: 'Forbidden: you cannot start another patient\'s assignment' });
    }
  } else if (status === 'cancelled') {
    // Only doctor who created it can cancel
    if (req.user.role !== 'doctor' || assignment.doctorId !== req.user.userId) {
      return res.status(403).json({ message: 'Forbidden: only the assigning doctor can cancel this protocol' });
    }
    if (['completed', 'reviewed', 'cancelled'].includes(currentStatus)) {
      return res.status(400).json({ message: `Cannot cancel an assignment that is already '${currentStatus}'` });
    }
  } else if (status === 'reviewed') {
    // Only doctor who created it can review
    if (req.user.role !== 'doctor' || assignment.doctorId !== req.user.userId) {
      return res.status(403).json({ message: 'Forbidden: only the assigning doctor can review this session' });
    }
    if (currentStatus !== 'completed') {
      return res.status(400).json({ message: `Only completed assignments can be reviewed (current: '${currentStatus}')` });
    }
    if (doctorNotes) {
      assignment.doctorNotes = String(doctorNotes).trim();
    }
    assignment.reviewedAt = new Date().toISOString();
  } else if (status === 'completed') {
    // Direct status patch to completed is reserved for assessment submission
    return res.status(400).json({ message: 'Assignments are completed through recording a valid assessment session' });
  }

  assignment.status = status;
  assignment.updatedAt = new Date().toISOString();

  if (isMongoConnected()) {
    Assignment.findOneAndUpdate(
      { id: assignment.id },
      { status, doctorNotes: assignment.doctorNotes, reviewedAt: assignment.reviewedAt, updatedAt: assignment.updatedAt }
    ).catch((err) => console.warn(`[Database] Failed to update assignment status: ${err.message}`));
  }

  res.json({ assignment });
});

// 5. Doctor list of all assignments created by doctor
app.get('/api/doctors/:id/assignments', authenticateToken, requireRole('doctor'), (req, res) => {
  if (req.user.userId !== req.params.id) {
    return res.status(403).json({ message: 'Forbidden: you cannot view another doctor\'s assignments' });
  }

  const doctorAssignments = assignments
    .filter((a) => a.doctorId === req.params.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((a) => {
      const patient = users[a.patientId];
      const resolvedStatus = resolveAssignmentStatus(a);
      const completedSession = a.completedSessionId
        ? assessments.find((s) => s.id === a.completedSessionId) || null
        : null;
      return {
        ...a,
        patientName: patient?.name || 'Unknown Patient',
        patientAge: patient?.age || null,
        status: resolvedStatus,
        completedSession,
      };
    });

  res.json(doctorAssignments);
});

// --- Assessment Creation (Linked to Assignments) ---

app.post('/api/assessments', authenticateToken, (req, res) => {
  const { userId, exerciseType, duration, score, metrics, assignmentId, trackingQuality } = req.body || {};
  if (!userId || !exerciseType || typeof score !== 'number') {
    return res.status(400).json({ message: 'userId, exerciseType and numeric score are required' });
  }

  // Patients can only submit assessments for their own account
  if (req.user.role === 'patient' && req.user.userId !== userId) {
    return res.status(403).json({ message: 'Forbidden: cannot submit assessments on behalf of other users' });
  }
  if (req.user.role !== 'patient') {
    return res.status(403).json({ message: 'Forbidden: only patients may submit assessment sessions' });
  }

  // Safety check: Tracking Quality validation for ALL sessions (assigned and unassigned)
  // Never accept an invalid camera session or one with insufficient frames as a valid assessment
  const quality = trackingQuality || {};
  if (quality.isValid === false || (quality.validFrames !== undefined && quality.validFrames < 5)) {
    return res.status(400).json({
      message: 'Assessment rejected: insufficient valid body tracking frames detected. Please position yourself clearly in frame and try again.',
    });
  }

  // Validate linked assignment if provided
  let linkedAssignment = null;
  if (assignmentId) {
    linkedAssignment = assignments.find((a) => a.id === assignmentId);
    if (!linkedAssignment) {
      return res.status(404).json({ message: 'Assigned protocol not found' });
    }
    if (linkedAssignment.patientId !== userId) {
      return res.status(403).json({ message: 'Forbidden: assignment belongs to a different patient' });
    }
    const currentStatus = resolveAssignmentStatus(linkedAssignment);
    if (!['assigned', 'in_progress'].includes(currentStatus)) {
      return res.status(400).json({
        message: `Cannot complete assignment with status '${currentStatus}'`,
      });
    }
  }

  const inputMetrics = metrics || {};
  const normalizedMetrics = { ...inputMetrics };
  if (exerciseType === 'arm_raise') {
    // arm_raise measures movement (range of motion) and coordination (symmetry).
    // Balance is NOT measured in an arm_raise session.
    normalizedMetrics.movement = Number(inputMetrics.rangeOfMotion ?? inputMetrics.movementQuality ?? score);
    normalizedMetrics.coordination = Number(inputMetrics.symmetry ?? score);
    if (inputMetrics.speech !== undefined && inputMetrics.speech !== null) {
      normalizedMetrics.speech = Number(inputMetrics.speech);
    } else {
      delete normalizedMetrics.speech;
    }
    if (inputMetrics.balance === undefined || inputMetrics.balance === null) {
      delete normalizedMetrics.balance;
    }
  } else if (exerciseType === 'sit_to_stand') {
    // sit_to_stand measures movement quality and balance (stability).
    normalizedMetrics.movement = Number(inputMetrics.movementQuality ?? score);
    if (inputMetrics.stability !== undefined || inputMetrics.balance !== undefined) {
      normalizedMetrics.balance = Number(inputMetrics.stability ?? inputMetrics.balance);
    }
    delete normalizedMetrics.speech;
  } else if (exerciseType === 'seated_reach') {
    // seated_reach measures movement quality and coordination (path efficiency).
    normalizedMetrics.movement = Number(inputMetrics.movementQuality ?? score);
    if (inputMetrics.pathEfficiency !== undefined || inputMetrics.coordination !== undefined) {
      normalizedMetrics.coordination = Number(inputMetrics.pathEfficiency ?? inputMetrics.coordination);
    }
    delete normalizedMetrics.balance;
    delete normalizedMetrics.speech;
  }

  const record = {
    id: `assessment-${Date.now()}`,
    userId,
    assignmentId: assignmentId || null,
    timestamp: new Date().toISOString(),
    exerciseType,
    duration: Number(duration || 0),
    score: Math.max(0, Math.min(100, Number(score))),
    metrics: normalizedMetrics,
    trackingQuality: trackingQuality || {
      validFrames: 100,
      totalFrames: 100,
      trackingRatio: 1.0,
      qualityWarning: null,
      isValid: true,
    },
    source: 'live',
  };

  assessments.push(record);

  // If linked to assignment, update assignment to completed
  if (linkedAssignment) {
    linkedAssignment.status = 'completed';
    linkedAssignment.completedSessionId = record.id;
    linkedAssignment.updatedAt = new Date().toISOString();

    if (isMongoConnected()) {
      Assignment.findOneAndUpdate(
        { id: linkedAssignment.id },
        { status: 'completed', completedSessionId: record.id, updatedAt: linkedAssignment.updatedAt }
      ).catch((err) => console.warn(`[Database] Failed to link assignment: ${err.message}`));
    }
  }

  // Persist to MongoDB if available
  if (isMongoConnected()) {
    Assessment.create(record).catch((err) =>
      console.warn(`[Database] Failed to persist assessment: ${err.message}`)
    );
  }

  const responseData = {
    ...record,
    persisted: isMongoConnected(),
    storage: isMongoConnected() ? 'mongodb' : 'in-memory',
  };

  res.status(201).json(responseData);
});

// --- Scenario Simulation Endpoint ---

app.post('/api/users/:id/demo-decline', (req, res) => {
  const userId = req.params.id;
  const template = [81, 79, 75, 71, 68];
  template.forEach((score, index) => {
    const metrics = {
      movement: score + (index === 0 ? 1 : 0),
      balance: score - 4,
      coordination: score - 2,
      speech: 84,
      rangeOfMotion: score - 2,
      symmetry: score - 3,
      movementQuality: score - 1,
    };
    assessments.push({
      id: `decline-${Date.now()}-${index}`,
      userId,
      assignmentId: null,
      timestamp: new Date(Date.now() - (5 - index) * 86400000).toISOString(),
      exerciseType: 'arm_raise',
      duration: 80,
      score,
      metrics,
      trackingQuality: { validFrames: 200, totalFrames: 210, trackingRatio: 0.95, qualityWarning: null, isValid: true },
      source: 'demo',
    });
  });

  alerts.set(userId, [{
    id: `demo-alert-${Date.now()}`,
    severity: 'review',
    type: 'Persistent deviation',
    reason: 'Movement and balance are trending below Raj’s recent baseline across the last three sessions.',
    timestamp: 'Demo scenario',
    action: 'Review recommended',
  }]);

  const patient = patients.find((item) => item.id === userId);
  if (patient) {
    patient.status = 'review';
    patient.score = 68;
    patient.change = -13;
    patient.lastCheck = 'Demo scenario';
  }

  res.json({ ok: true, message: 'Decline demo loaded' });
});

// --- Speech Analysis Endpoint ---

app.post('/api/speech/analyze', (req, res) => {
  const { transcript = '', expectedText = '', duration = 0, pauseCount = 0 } = req.body || {};
  const words = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;
  const expectedWords = expectedText.trim() ? expectedText.trim().split(/\s+/).length : words;
  const normalizedA = transcript.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const normalizedB = expectedText.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const similarity = normalizedB ? Math.round((normalizedA === normalizedB ? 100 : tokenSimilarity(normalizedA, normalizedB)) * 10) / 10 : 0;
  const rate = duration > 0 ? Math.round((words / (duration / 60)) * 10) / 10 : 0;
  res.json({
    speakingDuration: Number(duration),
    pauses: Number(pauseCount),
    speechRate: rate,
    transcriptionSimilarity: similarity,
    wordCount: words,
    expectedWordCount: expectedWords,
  });
});

function tokenSimilarity(a, b) {
  const A = new Set(a.split(/\s+/).filter(Boolean));
  const B = new Set(b.split(/\s+/).filter(Boolean));
  const union = new Set([...A, ...B]);
  const intersection = [...A].filter((x) => B.has(x));
  return union.size ? (intersection.length / union.size) * 100 : 0;
}

// --- Gemini AI Explanation Endpoint ---

/**
 * Builds a sanitized findings object for the explanation service from validated dashboard data.
 * Only includes metrics that were actually measured in the sessions.
 * The client may supply pre-computed findings from buildDashboard output, or the server can
 * compute them from the patient's actual session records when a patientId is supplied.
 *
 * @param {object} rawFindings - Caller-supplied findings, already derived from buildDashboard.
 * @returns {object} Sanitized findings safe to pass to generateExplanation.
 */
function sanitizeFindings(rawFindings) {
  const {
    trend,
    movement_change,
    balance_change,
    speech_change,
    details,
    measured_metrics,
    exercise_type,
    baseline_sessions,
    tracking_quality_warning,
  } = rawFindings;

  const findings = {
    trend: ['stable', 'improving', 'declining', 'persistent_decline'].includes(
      String(trend).toLowerCase()
    )
      ? String(trend).toLowerCase()
      : 'stable',
  };

  // measured_metrics is an explicit whitelist of which domains were actually collected.
  // The client (built from buildDashboard) passes only the metrics that have measured:true.
  // When absent, fall back to individual null-checks.
  const measured = Array.isArray(measured_metrics) ? measured_metrics : null;

  const isIncluded = (name, value) => {
    if (measured) return measured.includes(name);
    return value !== null && value !== undefined;
  };

  if (isIncluded('movement', movement_change)) {
    findings.movement_change = Number(movement_change);
  }
  if (isIncluded('balance', balance_change)) {
    findings.balance_change = Number(balance_change);
  }
  if (isIncluded('speech', speech_change)) {
    findings.speech_change = Number(speech_change);
  }

  // Baseline session count — tells the model whether comparison is meaningful
  const window = typeof baseline_sessions === 'number' ? baseline_sessions : null;
  if (window !== null) {
    findings.baseline_sessions = window;
  }

  // Exercise type gives the model context about what was assessed
  if (exercise_type) {
    findings.exercise_type = String(exercise_type);
  }

  // Pass a tracking quality warning if present (e.g., partial frame coverage)
  if (tracking_quality_warning) {
    findings.tracking_quality_warning = String(tracking_quality_warning);
  }

  // Free-text details from the caller (validated to be a string)
  if (details && typeof details === 'string') {
    findings.details = details.slice(0, 500); // Truncate to avoid prompt injection
  }

  return findings;
}

app.post('/api/explanation', async (req, res) => {
  const raw = req.body || {};
  const findings = sanitizeFindings(raw.findings ?? raw);
  const explanation = await generateExplanation(findings);
  res.json(explanation);
});

// Expose sanitizeFindings for unit testing
app._sanitizeFindings = sanitizeFindings;

app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

if (require.main === module) {
  app.listen(PORT, () => console.log(`NeuroGuard backend running on http://localhost:${PORT}`));
}

module.exports = app;
