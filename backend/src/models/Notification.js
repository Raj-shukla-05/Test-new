const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  type: {
    type: String,
    enum: [
      'booking_created',
      'booking_confirmed',
      'booking_rejected',
      'appointment_cancelled',
      'appointment_rescheduled',
      'report_shared',
      'report_revoked',
      'general',
    ],
    required: true,
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  appointmentId: { type: String, default: null },
  read: { type: Boolean, default: false, index: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);
