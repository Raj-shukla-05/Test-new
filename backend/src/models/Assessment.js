const mongoose = require('mongoose');

const AssessmentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  assignmentId: { type: String, index: true, default: null },
  timestamp: { type: Date, default: Date.now },
  exerciseType: { type: String, required: true },
  duration: { type: Number, default: 0 },
  score: { type: Number, required: true, min: 0, max: 100 },
  metrics: { type: mongoose.Schema.Types.Mixed, default: {} },
  trackingQuality: {
    validFrames: { type: Number, default: 0 },
    totalFrames: { type: Number, default: 0 },
    trackingRatio: { type: Number, default: 1 },
    qualityWarning: { type: String, default: null },
    isValid: { type: Boolean, default: true },
  },
  source: { type: String, default: 'live' },
});

module.exports = mongoose.models.Assessment || mongoose.model('Assessment', AssessmentSchema);
