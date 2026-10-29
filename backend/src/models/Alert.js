const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  severity: { type: String, enum: ['review', 'monitor', 'stable'], default: 'monitor' },
  type: { type: String, required: true },
  reason: { type: String, required: true },
  timestamp: { type: String, required: true },
  action: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.Alert || mongoose.model('Alert', AlertSchema);
