const mongoose = require('mongoose');

const AppointmentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  patientId: { type: String, required: true, index: true },
  patientName: { type: String, required: true },
  doctorId: { type: String, required: true, index: true },
  doctorName: { type: String, required: true },
  doctorSpecialty: { type: String, required: true },
  clinic: {
    name: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    roomNumber: { type: String, default: 'Suite 101' },
    phone: { type: String, required: true },
  },
  date: { type: String, required: true, index: true }, // YYYY-MM-DD
  startTime: { type: String, required: true }, // HH:mm
  endTime: { type: String, required: true }, // HH:mm
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'rejected', 'cancelled', 'completed', 'no-show'],
    default: 'pending',
    index: true,
  },
  consultationFee: { type: Number, required: true, min: 0 },
  reason: { type: String, default: '', trim: true },
  bookedBy: {
    userId: { type: String, required: true },
    role: { type: String, enum: ['patient', 'caregiver'], required: true },
    name: { type: String, required: true },
  },
  cancellation: {
    cancelledBy: { type: String, default: null },
    cancelledByRole: { type: String, default: null },
    cancelledAt: { type: Date, default: null },
    reason: { type: String, default: null },
  },
  rejection: {
    rejectedBy: { type: String, default: null },
    rejectedAt: { type: Date, default: null },
    reason: { type: String, default: null },
  },
  sharedReportId: { type: String, default: null },
  rescheduleInfo: {
    rescheduledFromId: { type: String, default: null },
    rescheduledAt: { type: Date, default: null },
    previousSlot: { type: String, default: null },
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Partial unique index to guarantee atomic reservation in MongoDB:
// No two active (pending or confirmed) appointments can exist for the same doctor at the same date and startTime.
AppointmentSchema.index(
  { doctorId: 1, date: 1, startTime: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['pending', 'confirmed'] },
    },
  }
);

module.exports = mongoose.models.Appointment || mongoose.model('Appointment', AppointmentSchema);
