const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'neuroguard-dev-fallback-secret-2026';

function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required. Missing Bearer token.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired authentication token.' });
  }
}

/**
 * Middleware to restrict endpoints to specific user roles.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: insufficient role privileges.' });
    }
    next();
  };
}

/**
 * Middleware ensuring a user can only access their own record,
 * unless they are an authorized doctor or caregiver with permissions.
 */
function requireSelfOrDoctor(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  const requestedUserId = req.params.id;

  // Patients can only access their own records
  if (req.user.role === 'patient') {
    if (req.user.userId === requestedUserId) {
      return next();
    }
    return res.status(403).json({ message: 'Forbidden: cannot access another patient\'s private medical records.' });
  }

  // Doctors have oversight access only to their authorized patients
  if (req.user.role === 'doctor') {
    const { users } = require('../store');
    const patient = users[requestedUserId];
    if (patient && patient.doctorId && patient.doctorId !== req.user.userId) {
      return res.status(403).json({ message: 'Forbidden: patient is assigned to another clinician.' });
    }
    return next();
  }

  // Caregivers can view assigned patients
  if (req.user.role === 'caregiver') {
    const { users } = require('../store');
    const patient = users[requestedUserId];
    if (patient && patient.caregiverId && patient.caregiverId !== req.user.userId) {
      return res.status(403).json({ message: 'Forbidden: patient is assigned to another caregiver.' });
    }
    return next();
  }

  return res.status(403).json({ message: 'Forbidden: cannot access another user\'s private medical records.' });
}

module.exports = {
  JWT_SECRET,
  generateToken,
  verifyToken,
  authenticateToken,
  requireRole,
  requireSelfOrDoctor,
};
