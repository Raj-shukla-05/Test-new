const mongoose = require('mongoose');

const AssignmentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  doctorId: { type: String, required: true, index: true },
  patientId: { type: String, required: true, index: true },
  exerciseType: {
    type: String,
    required: true,
    enum: ['arm_raise', 'sit_to_stand', 'seated_reach'],
    default: 'arm_raise',
  },
  instructions: { type: String, required: true, trim: true },
  targetReps: { type: Number, default: 5, min: 1, max: 50 },
  startDate: { type: Date, default: Date.now },
  dueDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ['assigned', 'in_progress', 'completed', 'reviewed', 'cancelled', 'expired'],
    default: 'assigned',
    index: true,
  },
  completedSessionId: { type: String, default: null },
  doctorNotes: { type: String, default: '' },
  reviewedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.Assignment || mongoose.model('Assignment', AssignmentSchema);
