const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['patient', 'doctor', 'caregiver'], default: 'patient' },
  age: { type: Number },
  preferredLanguage: { type: String, default: 'English' },
  doctorId: { type: String, index: true, default: null },
  authorizedCaregivers: [{ type: String }], // Array of user IDs authorized to manage this patient
  caregiverPatients: [{ type: String }], // Array of patient IDs this caregiver is authorized for
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
