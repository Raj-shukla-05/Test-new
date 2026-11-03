const express = require('express');
const router = express.Router();
const { users, patients, assessments } = require('../store');
const { authenticateToken, requireRole } = require('../middleware/auth');

// GET /api/caregivers/:id/patients - Caregiver retrieves their authorized patients list
router.get('/:id/patients', authenticateToken, requireRole('caregiver', 'doctor'), (req, res) => {
  const caregiverId = req.params.id;

  // Ensure caregiver can only query their own patient list
  if (req.user.role === 'caregiver' && req.user.userId !== caregiverId) {
    return res.status(403).json({ message: 'Forbidden: You cannot view another caregiver’s patient list' });
  }

  const caregiverUser = users[caregiverId];
  if (!caregiverUser) {
    return res.status(404).json({ message: 'Caregiver not found' });
  }

  const patientIds = caregiverUser.caregiverPatients || [];

  const caregiverPatients = patientIds.map((pId) => {
    const user = users[pId];
    const patRecord = patients.find((p) => p.id === pId);
    const sessionCount = assessments.filter((a) => a.userId === pId).length;

    return {
      id: pId,
      name: user?.name || patRecord?.name || 'Patient',
      age: user?.age ?? patRecord?.age ?? null,
      status: patRecord?.status || 'stable',
      score: patRecord?.score || 0,
      change: patRecord?.change || 0,
      lastCheck: patRecord?.lastCheck || 'Recent',
      sessions: sessionCount,
    };
  });

  res.json({ patients: caregiverPatients });
});

module.exports = router;
