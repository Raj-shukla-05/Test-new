const mongoose = require('mongoose');

const BlockedSlotSchema = new mongoose.Schema({
  id: { type: String, required: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  startTime: { type: String, required: true }, // HH:mm
  endTime: { type: String, required: true }, // HH:mm
  reason: { type: String, default: 'Unavailable' },
  createdAt: { type: Date, default: Date.now },
});

const DoctorAvailabilitySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  doctorId: { type: String, required: true, unique: true, index: true },
  workingDays: {
    type: [Number], // 0: Sunday, 1: Monday, ..., 6: Saturday
    default: [1, 2, 3, 4, 5],
  },
  dayStartTime: { type: String, default: '09:00' }, // HH:mm
  dayEndTime: { type: String, default: '17:00' }, // HH:mm
  slotDurationMinutes: { type: Number, default: 30, min: 15, max: 120 },
  breakStartTime: { type: String, default: '13:00' }, // HH:mm
  breakEndTime: { type: String, default: '14:00' }, // HH:mm
  unavailableDates: [{ type: String }], // Array of YYYY-MM-DD
  blockedSlots: [BlockedSlotSchema],
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.DoctorAvailability || mongoose.model('DoctorAvailability', DoctorAvailabilitySchema);
