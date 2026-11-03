const express = require('express');
const router = express.Router();
const { appointments, users } = require('../store');
const { isMongoConnected } = require('../db');
const Appointment = require('../models/Appointment');
const { authenticateToken, requireRole, isCaregiverAuthorized } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimiter');
const {
  findDoctor,
  bookAppointment,
  transitionAppointmentStatus,
  rescheduleAppointment,
} = require('../services/appointmentService');

// Rate limiter for appointment booking: max 15 requests per minute
const bookingRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 15,
  message: 'Too many booking requests. Please wait a moment before trying again.',
});

// 1. POST /api/appointments - Book an appointment
router.post('/', authenticateToken, requireRole('patient', 'caregiver'), bookingRateLimiter, async (req, res) => {
  try {
    const { doctorId, date, startTime, reason = '', patientId: requestedPatientId } = req.body || {};

    if (!doctorId || !date || !startTime) {
      return res.status(400).json({ message: 'doctorId, date, and startTime are required.' });
    }

    let targetPatientId = req.user.userId;

    // If caregiver is booking, ensure they are authorized for the target patient
    if (req.user.role === 'caregiver') {
      if (!requestedPatientId) {
        return res.status(400).json({ message: 'Caregiver booking requires a valid patientId.' });
      }
      if (!isCaregiverAuthorized(req.user.userId, requestedPatientId)) {
        return res.status(403).json({ message: 'Forbidden: You are not authorized to book for this patient.' });
      }
      targetPatientId = requestedPatientId;
    } else {
      // Patient booking for self
      if (requestedPatientId && requestedPatientId !== req.user.userId) {
        return res.status(403).json({ message: 'Forbidden: Patients can only book for themselves.' });
      }
    }

    const appointment = await bookAppointment({
      doctorId,
      patientId: targetPatientId,
      date: String(date).trim(),
      startTime: String(startTime).trim(),
      reason: String(reason).trim(),
      bookedBy: {
        userId: req.user.userId,
        role: req.user.role,
        name: req.user.name,
      },
    });

    res.status(201).json({ appointment });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

// 2. GET /api/appointments/my - Patient or Caregiver view of appointments
router.get('/my', authenticateToken, requireRole('patient', 'caregiver'), async (req, res) => {
  try {
    let patientIds = [req.user.userId];

    if (req.user.role === 'caregiver') {
      const caregiver = users[req.user.userId];
      patientIds = caregiver?.caregiverPatients || [];
    }

    let list = appointments.filter((a) => patientIds.includes(a.patientId));

    if (isMongoConnected()) {
      try {
        const dbList = await Appointment.find({ patientId: { $in: patientIds } }).lean();
        if (dbList && dbList.length > 0) list = dbList;
      } catch {}
    }

    // Sort: upcoming first, then descending by date
    list.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.startTime}:00`);
      const dateB = new Date(`${b.date}T${b.startTime}:00`);
      return dateB - dateA;
    });

    res.json({ appointments: list });
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve appointments' });
  }
});

// 3. GET /api/appointments/doctor - Doctor view of their appointments
router.get('/doctor', authenticateToken, requireRole('doctor'), async (req, res) => {
  try {
    const doctor = await findDoctor(req.user.userId);
    if (!doctor) {
      return res.status(404).json({ message: 'Doctor profile not found' });
    }

    let list = appointments.filter((a) => a.doctorId === doctor.id);

    if (isMongoConnected()) {
      try {
        const dbList = await Appointment.find({ doctorId: doctor.id }).lean();
        if (dbList && dbList.length > 0) list = dbList;
      } catch {}
    }

    list.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.startTime}:00`);
      const dateB = new Date(`${b.date}T${b.startTime}:00`);
      return dateB - dateA;
    });

    res.json({ appointments: list });
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve doctor appointments' });
  }
});

// 4. GET /api/appointments/:appointmentId - Appointment detail
router.get('/:appointmentId', authenticateToken, async (req, res) => {
  let appointment = appointments.find((a) => a.id === req.params.appointmentId);
  if (!appointment && isMongoConnected()) {
    try {
      appointment = await Appointment.findOne({ id: req.params.appointmentId }).lean();
    } catch {}
  }

  if (!appointment) {
    return res.status(404).json({ message: 'Appointment not found' });
  }

  const doctor = await findDoctor(appointment.doctorId);

  // Authorization check
  const isOwner = req.user.role === 'patient' && req.user.userId === appointment.patientId;
  const isAuthorizedCaregiver =
    req.user.role === 'caregiver' &&
    isCaregiverAuthorized(req.user.userId, appointment.patientId);
  const isAssignedDoctor =
    req.user.role === 'doctor' &&
    (req.user.userId === doctor?.userId || req.user.userId === appointment.doctorId);

  if (!isOwner && !isAuthorizedCaregiver && !isAssignedDoctor) {
    return res.status(403).json({ message: 'Forbidden: You do not have access to this appointment.' });
  }

  res.json({ appointment });
});

// 5. PATCH /api/appointments/:appointmentId/confirm - Doctor confirms
router.patch('/:appointmentId/confirm', authenticateToken, requireRole('doctor'), async (req, res) => {
  try {
    const updated = await transitionAppointmentStatus({
      appointmentId: req.params.appointmentId,
      targetStatus: 'confirmed',
      actingUser: req.user,
    });
    res.json({ appointment: updated });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

// 6. PATCH /api/appointments/:appointmentId/reject - Doctor declines with reason
router.patch('/:appointmentId/reject', authenticateToken, requireRole('doctor'), async (req, res) => {
  const { reason } = req.body || {};
  if (!reason || !String(reason).trim()) {
    return res.status(400).json({ message: 'A rejection reason is required.' });
  }

  try {
    const updated = await transitionAppointmentStatus({
      appointmentId: req.params.appointmentId,
      targetStatus: 'rejected',
      actingUser: req.user,
      reason: String(reason).trim(),
    });
    res.json({ appointment: updated });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

// 7. PATCH /api/appointments/:appointmentId/cancel - Patient, Caregiver, or Doctor cancels
router.patch('/:appointmentId/cancel', authenticateToken, async (req, res) => {
  const { reason = 'Cancelled by user' } = req.body || {};

  try {
    const updated = await transitionAppointmentStatus({
      appointmentId: req.params.appointmentId,
      targetStatus: 'cancelled',
      actingUser: req.user,
      reason: String(reason).trim(),
    });
    res.json({ appointment: updated });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

// 8. PATCH /api/appointments/:appointmentId/reschedule - Reschedule
router.patch('/:appointmentId/reschedule', authenticateToken, async (req, res) => {
  const { newDate, newStartTime, reason = 'Rescheduled' } = req.body || {};

  if (!newDate || !newStartTime) {
    return res.status(400).json({ message: 'newDate (YYYY-MM-DD) and newStartTime (HH:mm) are required.' });
  }

  try {
    const newAppointment = await rescheduleAppointment({
      appointmentId: req.params.appointmentId,
      newDate: String(newDate).trim(),
      newStartTime: String(newStartTime).trim(),
      actingUser: req.user,
      reason: String(reason).trim(),
    });
    res.json({ appointment: newAppointment });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

// 9. PATCH /api/appointments/:appointmentId/complete - Doctor marks complete
router.patch('/:appointmentId/complete', authenticateToken, requireRole('doctor'), async (req, res) => {
  try {
    const updated = await transitionAppointmentStatus({
      appointmentId: req.params.appointmentId,
      targetStatus: 'completed',
      actingUser: req.user,
    });
    res.json({ appointment: updated });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

// 10. PATCH /api/appointments/:appointmentId/no-show - Doctor marks no-show
router.patch('/:appointmentId/no-show', authenticateToken, requireRole('doctor'), async (req, res) => {
  try {
    const updated = await transitionAppointmentStatus({
      appointmentId: req.params.appointmentId,
      targetStatus: 'no-show',
      actingUser: req.user,
    });
    res.json({ appointment: updated });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

module.exports = router;
