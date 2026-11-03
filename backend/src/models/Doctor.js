const mongoose = require('mongoose');

const DoctorSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  specialization: {
    type: String,
    required: true,
    enum: [
      'Neurology',
      'Physical Medicine and Rehabilitation',
      'Physiotherapy',
      'Occupational Therapy',
      'Speech and Language Therapy',
      'Neurorehabilitation',
    ],
  },
  qualifications: [{ type: String, trim: true }],
  experienceYears: { type: Number, required: true, min: 0 },
  consultationFee: { type: Number, required: true, min: 0 },
  bio: { type: String, default: '' },
  clinic: {
    name: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    roomNumber: { type: String, default: 'Suite 101' },
    phone: { type: String, required: true },
  },
  rating: { type: Number, min: 1, max: 5, default: null },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.Doctor || mongoose.model('Doctor', DoctorSchema);
