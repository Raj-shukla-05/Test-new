const { assessments, users, sharedReports, appointments } = require('../store');
const { isMongoConnected } = require('../db');
const User = require('../models/User');
const Assessment = require('../models/Assessment');
const SharedRecoveryReport = require('../models/SharedRecoveryReport');
const Appointment = require('../models/Appointment');
const { buildDashboard, buildTrend, createAlert, personalBaseline } = require('../trendEngine');
const { findDoctor } = require('./appointmentService');
const { createNotification } = require('./notificationService');

/**
 * Compiles a comprehensive, genuine recovery report directly from patient assessment records.
 */
async function compilePatientRecoveryReport(patientId) {
  let patient = users[patientId];
  if (!patient && isMongoConnected()) {
    try {
      patient = await User.findOne({ id: patientId }).lean();
    } catch {}
  }

  if (!patient) {
    const error = new Error('Patient not found');
    error.statusCode = 404;
    throw error;
  }

  // Gather real assessment records for this patient from memory and MongoDB
  let patientAssessments = assessments.filter((a) => a.userId === patientId);
  if (isMongoConnected()) {
    try {
      const dbAssessments = await Assessment.find({ userId: patientId }).lean();
      if (dbAssessments && dbAssessments.length > 0) {
        const map = new Map();
        for (const a of patientAssessments) map.set(a.id, a);
        for (const a of dbAssessments) map.set(a.id, a);
        patientAssessments = Array.from(map.values());
      }
    } catch (err) {
      console.warn(`[ReportSharing] Error querying assessments from DB: ${err.message}`);
    }
  }

  patientAssessments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const totalSessions = patientAssessments.length;
  const recentSessions = patientAssessments.slice(0, 10);

  // Derive genuine baseline and longitudinal metrics
  const scores = patientAssessments.map((a) => a.score);
  const baselineScore = personalBaseline(scores);

  const dashboardData = buildDashboard(patient, patientAssessments);
  const trendData = buildTrend(patientAssessments);
  const activeAlert = createAlert(patientId, patientAssessments);

  // Group assessments by exercise type
  const exerciseBreakdown = {
    arm_raise: patientAssessments.filter((a) => a.exerciseType === 'arm_raise').length,
    sit_to_stand: patientAssessments.filter((a) => a.exerciseType === 'sit_to_stand').length,
    seated_reach: patientAssessments.filter((a) => a.exerciseType === 'seated_reach').length,
  };

  return {
    patient: {
      id: patient.id,
      name: patient.name,
      age: patient.age ?? null,
      preferredLanguage: patient.preferredLanguage || 'English',
    },
    generatedAt: new Date().toISOString(),
    clinicalDisclaimer:
      'NeuroGuard AI provides assistive functional monitoring and recovery metric extraction. This report is supplementary clinical documentation and does not constitute a diagnostic evaluation or replacement for professional clinical judgment.',
    summary: {
      overallStatus: dashboardData.summary?.status || 'stable',
      currentScore: dashboardData.summary?.score ?? (scores[0] || null),
      baselineScore,
      percentageChange: dashboardData.summary?.change ?? 0,
      totalAssessments: totalSessions,
      exerciseBreakdown,
    },
    longitudinalTrends: trendData,
    recentAlerts: activeAlert ? [activeAlert] : [],
    sessions: recentSessions.map((s) => ({
      id: s.id,
      timestamp: s.timestamp,
      exerciseType: s.exerciseType,
      duration: s.duration,
      score: s.score,
      metrics: s.metrics || {},
      trackingQuality: s.trackingQuality || { isValid: true, trackingRatio: 1 },
      source: s.source || 'live',
    })),
  };
}

/**
 * Creates an authorized recovery report share record from patient to doctor.
 */
async function shareRecoveryReport({
  patientId,
  doctorId,
  appointmentId = null,
  actingUser,
  clientIp = null,
  userAgent = null,
}) {
  let patient = users[patientId];
  if (!patient && isMongoConnected()) {
    try {
      patient = await User.findOne({ id: patientId }).lean();
    } catch {}
  }

  if (!patient) {
    const error = new Error('Patient not found');
    error.statusCode = 404;
    throw error;
  }

  // Check that requester is the patient or authorized caregiver
  const isSelf = actingUser.role === 'patient' && actingUser.userId === patientId;
  const isAuthorizedCaregiver =
    actingUser.role === 'caregiver' && patient.authorizedCaregivers?.includes(actingUser.userId);

  if (!isSelf && !isAuthorizedCaregiver) {
    const error = new Error('Forbidden: You can only share your own recovery reports.');
    error.statusCode = 403;
    throw error;
  }

  const doctor = await findDoctor(doctorId);
  if (!doctor) {
    const error = new Error('Doctor not found');
    error.statusCode = 404;
    throw error;
  }

  // Compile real recovery data
  const reportData = await compilePatientRecoveryReport(patientId);

  const shareId = `share-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const sharedRecord = {
    id: shareId,
    patientId: patient.id,
    patientName: patient.name,
    doctorId: doctor.id,
    doctorUserId: doctor.userId,
    doctorName: doctor.name,
    appointmentId: appointmentId || null,
    status: 'active',
    reportData,
    sharedAt: new Date().toISOString(),
    revokedAt: null,
    accessAuditLog: [
      {
        doctorId: doctor.id,
        doctorUserId: doctor.userId,
        action: 'shared',
        accessedAt: new Date().toISOString(),
        ip: clientIp,
        userAgent,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  sharedReports.push(sharedRecord);

  // If tied to an appointment, record sharedReportId in the appointment
  if (appointmentId) {
    const apt = appointments.find((a) => a.id === appointmentId);
    if (apt) {
      apt.sharedReportId = shareId;
      apt.updatedAt = new Date().toISOString();
      if (isMongoConnected()) {
        Appointment.findOneAndUpdate({ id: apt.id }, { sharedReportId: shareId }).catch(() => {});
      }
    }
  }

  if (isMongoConnected()) {
    try {
      await SharedRecoveryReport.create({
        id: sharedRecord.id,
        patientId: sharedRecord.patientId,
        patientName: sharedRecord.patientName,
        doctorId: sharedRecord.doctorId,
        doctorName: sharedRecord.doctorName,
        appointmentId: sharedRecord.appointmentId,
        status: sharedRecord.status,
        reportData: sharedRecord.reportData,
        sharedAt: sharedRecord.sharedAt,
        accessAuditLog: sharedRecord.accessAuditLog,
      });
    } catch (err) {
      console.warn(`[ReportSharing] Failed to persist report share to MongoDB: ${err.message}`);
    }
  }

  // Notify Doctor
  await createNotification({
    userId: doctor.userId,
    type: 'report_shared',
    title: 'Patient Shared Recovery Report',
    message: `${patient.name} has authorized you to access their NeuroGuard recovery metrics and assessment history.`,
    appointmentId,
  });

  return sharedRecord;
}

/**
 * Securely retrieves a shared report for a doctor or the owning patient.
 * Strictly verifies access permissions and records viewing in the audit trail.
 */
async function getSharedReport(shareId, actingUser, clientIp = null, userAgent = null) {
  let record = sharedReports.find((r) => r.id === shareId);
  if (!record && isMongoConnected()) {
    try {
      record = await SharedRecoveryReport.findOne({ id: shareId }).lean();
    } catch {}
  }

  if (!record) {
    const error = new Error('Shared recovery report not found.');
    error.statusCode = 404;
    throw error;
  }

  const doctor = await findDoctor(record.doctorId);

  // 1. Patient viewing own report
  const isPatientOwner = actingUser.role === 'patient' && actingUser.userId === record.patientId;
  const isAuthorizedCaregiver =
    actingUser.role === 'caregiver' &&
    users[record.patientId]?.authorizedCaregivers?.includes(actingUser.userId);

  // 2. Doctor viewing shared report
  const isDoctorRecipient =
    actingUser.role === 'doctor' &&
    (actingUser.userId === doctor?.userId || actingUser.userId === record.doctorId || actingUser.userId === record.doctorUserId);

  if (!isPatientOwner && !isAuthorizedCaregiver && !isDoctorRecipient) {
    const error = new Error('Forbidden: You do not have permission to view this recovery report.');
    error.statusCode = 403;
    throw error;
  }

  // 3. If doctor is viewing, check whether access was revoked
  if (isDoctorRecipient) {
    if (record.status === 'revoked') {
      const error = new Error('Forbidden: Access to this recovery report has been revoked by the patient.');
      error.statusCode = 403;
      throw error;
    }

    // Record access in audit log
    const auditEntry = {
      doctorId: record.doctorId,
      doctorUserId: actingUser.userId,
      action: 'viewed',
      accessedAt: new Date().toISOString(),
      ip: clientIp,
      userAgent,
    };

    record.accessAuditLog = record.accessAuditLog || [];
    record.accessAuditLog.push(auditEntry);

    if (isMongoConnected()) {
      SharedRecoveryReport.findOneAndUpdate(
        { id: record.id },
        { $push: { accessAuditLog: auditEntry } }
      ).catch(() => {});
    }
  }

  return record;
}

/**
 * Revokes patient authorization for a shared recovery report.
 */
async function revokeReportAccess(shareId, actingUser, clientIp = null, userAgent = null) {
  let record = sharedReports.find((r) => r.id === shareId);
  if (!record && isMongoConnected()) {
    try {
      record = await SharedRecoveryReport.findOne({ id: shareId });
    } catch {}
  }

  if (!record) {
    const error = new Error('Shared report record not found.');
    error.statusCode = 404;
    throw error;
  }

  const isPatientOwner = actingUser.role === 'patient' && actingUser.userId === record.patientId;
  const isAuthorizedCaregiver =
    actingUser.role === 'caregiver' &&
    users[record.patientId]?.authorizedCaregivers?.includes(actingUser.userId);

  if (!isPatientOwner && !isAuthorizedCaregiver) {
    const error = new Error('Forbidden: Only the patient can revoke access to their recovery report.');
    error.statusCode = 403;
    throw error;
  }

  if (record.status === 'revoked') {
    return record; // Already revoked
  }

  const revokedAt = new Date().toISOString();
  record.status = 'revoked';
  record.revokedAt = revokedAt;

  const auditEntry = {
    doctorId: record.doctorId,
    doctorUserId: record.doctorUserId || record.doctorId,
    action: 'revoked',
    accessedAt: revokedAt,
    ip: clientIp,
    userAgent,
  };

  record.accessAuditLog = record.accessAuditLog || [];
  record.accessAuditLog.push(auditEntry);

  if (isMongoConnected()) {
    try {
      await SharedRecoveryReport.findOneAndUpdate(
        { id: record.id },
        {
          status: 'revoked',
          revokedAt,
          $push: { accessAuditLog: auditEntry },
        }
      );
    } catch (err) {
      console.warn(`[ReportSharing] MongoDB revoke update failed: ${err.message}`);
    }
  }

  const doctor = await findDoctor(record.doctorId);
  if (doctor?.userId) {
    await createNotification({
      userId: doctor.userId,
      type: 'report_revoked',
      title: 'Report Access Revoked',
      message: `${record.patientName} has revoked access to their previously shared recovery report.`,
      appointmentId: record.appointmentId,
    });
  }

  return record;
}

/**
 * Lists shared reports received by a doctor.
 */
async function getReportsSharedWithDoctor(doctorUserId) {
  const doctor = await findDoctor(doctorUserId);
  if (!doctor) return [];

  let list = sharedReports.filter(
    (r) => (r.doctorId === doctor.id || r.doctorUserId === doctor.userId) && r.status === 'active'
  );

  if (isMongoConnected()) {
    try {
      const dbList = await SharedRecoveryReport.find({
        doctorId: doctor.id,
        status: 'active',
      }).lean();
      if (dbList && dbList.length > 0) list = dbList;
    } catch {}
  }

  return list.sort((a, b) => new Date(b.sharedAt) - new Date(a.sharedAt));
}

/**
 * Lists shared reports issued by a patient.
 */
async function getReportsSharedByPatient(patientId) {
  let list = sharedReports.filter((r) => r.patientId === patientId);

  if (isMongoConnected()) {
    try {
      const dbList = await SharedRecoveryReport.find({ patientId }).lean();
      if (dbList && dbList.length > 0) list = dbList;
    } catch {}
  }

  return list.sort((a, b) => new Date(b.sharedAt) - new Date(a.sharedAt));
}

module.exports = {
  compilePatientRecoveryReport,
  shareRecoveryReport,
  getSharedReport,
  revokeReportAccess,
  getReportsSharedWithDoctor,
  getReportsSharedByPatient,
};
