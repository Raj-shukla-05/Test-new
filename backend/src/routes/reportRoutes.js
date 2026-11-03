const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole, isCaregiverAuthorized } = require('../middleware/auth');
const {
  compilePatientRecoveryReport,
  shareRecoveryReport,
  getSharedReport,
  revokeReportAccess,
  getReportsSharedWithDoctor,
  getReportsSharedByPatient,
} = require('../services/reportSharingService');

// 1. GET /api/reports/preview - Preview recovery report generated from genuine assessment data
router.get('/preview', authenticateToken, requireRole('patient', 'caregiver'), async (req, res) => {
  try {
    let patientId = req.user.userId;

    if (req.user.role === 'caregiver') {
      const requestedPatientId = req.query.patientId;
      if (!requestedPatientId || !isCaregiverAuthorized(req.user.userId, requestedPatientId)) {
        return res.status(403).json({ message: 'Forbidden: You are not authorized for this patient.' });
      }
      patientId = requestedPatientId;
    }

    const report = await compilePatientRecoveryReport(patientId);
    res.json({ report });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

// 2. POST /api/reports/share - Explicitly authorize and share report with a doctor
router.post('/share', authenticateToken, requireRole('patient', 'caregiver'), async (req, res) => {
  try {
    const { doctorId, appointmentId = null, patientId: requestedPatientId } = req.body || {};

    if (!doctorId) {
      return res.status(400).json({ message: 'doctorId is required to share a report.' });
    }

    let targetPatientId = req.user.userId;

    if (req.user.role === 'caregiver') {
      if (!requestedPatientId || !isCaregiverAuthorized(req.user.userId, requestedPatientId)) {
        return res.status(403).json({ message: 'Forbidden: You are not authorized for this patient.' });
      }
      targetPatientId = requestedPatientId;
    }

    const clientIp = req.ip || req.headers['x-forwarded-for'] || null;
    const userAgent = req.headers['user-agent'] || null;

    const shareRecord = await shareRecoveryReport({
      patientId: targetPatientId,
      doctorId,
      appointmentId,
      actingUser: req.user,
      clientIp,
      userAgent,
    });

    res.status(201).json({ share: shareRecord });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

// 3. GET /api/reports/shared-with-me - Doctor view of authorized shared reports
router.get('/shared-with-me', authenticateToken, requireRole('doctor'), async (req, res) => {
  try {
    const list = await getReportsSharedWithDoctor(req.user.userId);
    res.json({ reports: list });
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve shared reports.' });
  }
});

// 4. GET /api/reports/my-shares - Patient view of all shared reports they granted
router.get('/my-shares', authenticateToken, requireRole('patient', 'caregiver'), async (req, res) => {
  try {
    const patientId = req.user.userId;
    const list = await getReportsSharedByPatient(patientId);
    res.json({ reports: list });
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve patient shares.' });
  }
});

// 5. GET /api/reports/shared/:shareId - Retrieve specific shared report
router.get('/shared/:shareId', authenticateToken, async (req, res) => {
  try {
    const clientIp = req.ip || req.headers['x-forwarded-for'] || null;
    const userAgent = req.headers['user-agent'] || null;

    const reportRecord = await getSharedReport(
      req.params.shareId,
      req.user,
      clientIp,
      userAgent
    );

    res.json({ report: reportRecord });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

// 6. DELETE /api/reports/shares/:shareId - Revoke doctor access to the report
router.delete('/shares/:shareId', authenticateToken, requireRole('patient', 'caregiver'), async (req, res) => {
  try {
    const clientIp = req.ip || req.headers['x-forwarded-for'] || null;
    const userAgent = req.headers['user-agent'] || null;

    const revokedRecord = await revokeReportAccess(
      req.params.shareId,
      req.user,
      clientIp,
      userAgent
    );

    res.json({ message: 'Report access successfully revoked.', report: revokedRecord });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

module.exports = router;
