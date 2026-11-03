const mongoose = require('mongoose');

const AccessAuditSchema = new mongoose.Schema({
  doctorId: { type: String, required: true },
  action: { type: String, enum: ['shared', 'viewed', 'revoked'], required: true },
  accessedAt: { type: Date, default: Date.now },
  ip: { type: String, default: null },
  userAgent: { type: String, default: null },
});

const SharedRecoveryReportSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  patientId: { type: String, required: true, index: true },
  patientName: { type: String, required: true },
  doctorId: { type: String, required: true, index: true },
  doctorName: { type: String, required: true },
  appointmentId: { type: String, index: true, default: null },
  status: {
    type: String,
    enum: ['active', 'revoked'],
    default: 'active',
    index: true,
  },
  reportData: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  sharedAt: { type: Date, default: Date.now },
  revokedAt: { type: Date, default: null },
  accessAuditLog: [AccessAuditSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.SharedRecoveryReport || mongoose.model('SharedRecoveryReport', SharedRecoveryReportSchema);
