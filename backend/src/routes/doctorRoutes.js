const express = require('express');
const router = express.Router();
const { doctors, availabilities } = require('../store');
const { isMongoConnected } = require('../db');
const Doctor = require('../models/Doctor');
const DoctorAvailability = require('../models/DoctorAvailability');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { findDoctor, getAvailableSlots, findAvailability } = require('../services/appointmentService');

// 1. GET /api/doctors - Discovery catalog with search and filters
router.get('/', async (req, res) => {
  try {
    const { search = '', specialization = '', city = '' } = req.query;

    const docMap = new Map();
    // 1. In-memory doctors
    for (const d of doctors) {
      if (d.isActive !== false) docMap.set(d.id, d);
    }

    // 2. Real database records from MongoDB
    if (isMongoConnected()) {
      try {
        const dbDoctors = await Doctor.find({ isActive: true }).lean();
        for (const d of dbDoctors) {
          docMap.set(d.id, d);
          if (!doctors.some((m) => m.id === d.id || m.userId === d.userId)) {
            doctors.push(d);
          }
        }
      } catch (err) {
        console.warn(`[DoctorRoutes] Error querying MongoDB doctors: ${err.message}`);
      }
    }

    let results = Array.from(docMap.values());

    // Filter by specialization
    if (specialization && specialization !== 'All') {
      const specFilter = specialization.toLowerCase().trim();
      results = results.filter((d) => d.specialization.toLowerCase() === specFilter);
    }

    // Filter by city
    if (city && city !== 'All') {
      const cityFilter = city.toLowerCase().trim();
      results = results.filter((d) => d.clinic?.city?.toLowerCase() === cityFilter);
    }

    // Free text search across name, clinic name, address, and specialty
    if (search.trim()) {
      const query = search.toLowerCase().trim();
      results = results.filter(
        (d) =>
          d.name.toLowerCase().includes(query) ||
          d.specialization.toLowerCase().includes(query) ||
          d.clinic?.name?.toLowerCase().includes(query) ||
          d.clinic?.address?.toLowerCase().includes(query) ||
          d.clinic?.city?.toLowerCase().includes(query)
      );
    }

    res.json({
      total: results.length,
      doctors: results.map((d) => ({
        id: d.id,
        userId: d.userId,
        name: d.name,
        specialization: d.specialization,
        qualifications: d.qualifications || [],
        experienceYears: d.experienceYears,
        consultationFee: d.consultationFee,
        bio: d.bio,
        clinic: d.clinic,
        rating: d.rating,
      })),
    });
  } catch (err) {
    res.status(500).json({ message: 'Failed to retrieve doctors catalog' });
  }
});

// 2. GET /api/doctors/:doctorId - Specific doctor profile
router.get('/:doctorId', async (req, res) => {
  const doctor = await findDoctor(req.params.doctorId);
  if (!doctor) {
    return res.status(404).json({ message: 'Doctor not found' });
  }

  const availability = await findAvailability(doctor.id);

  res.json({
    doctor: {
      id: doctor.id,
      userId: doctor.userId,
      name: doctor.name,
      specialization: doctor.specialization,
      qualifications: doctor.qualifications || [],
      experienceYears: doctor.experienceYears,
      consultationFee: doctor.consultationFee,
      bio: doctor.bio,
      clinic: doctor.clinic,
      rating: doctor.rating,
      workingDays: availability?.workingDays || [1, 2, 3, 4, 5],
      clinicHours: `${availability?.dayStartTime || '09:00'} - ${availability?.dayEndTime || '17:00'}`,
    },
  });
});

// 3. GET /api/doctors/:doctorId/availability - Slots for a specific date
router.get('/:doctorId/availability', async (req, res) => {
  const { date } = req.query;
  if (!date) {
    return res.status(400).json({ message: 'Query parameter date (YYYY-MM-DD) is required.' });
  }

  try {
    const slotsData = await getAvailableSlots(req.params.doctorId, String(date));
    res.json(slotsData);
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

// 4. PATCH /api/doctors/profile - Doctor updates own profile & clinic info
router.patch('/profile', authenticateToken, requireRole('doctor'), async (req, res) => {
  const doctor = await findDoctor(req.user.userId);
  if (!doctor) {
    return res.status(404).json({ message: 'Doctor profile not found' });
  }

  const { consultationFee, bio, clinic, qualifications, experienceYears } = req.body || {};

  if (consultationFee !== undefined) {
    const fee = Number(consultationFee);
    if (isNaN(fee) || fee < 0) {
      return res.status(400).json({ message: 'Consultation fee must be a non-negative number' });
    }
    doctor.consultationFee = fee;
  }

  if (bio !== undefined) doctor.bio = String(bio).trim().slice(0, 1000);
  if (experienceYears !== undefined) {
    const exp = Number(experienceYears);
    if (!isNaN(exp) && exp >= 0) doctor.experienceYears = exp;
  }
  if (Array.isArray(qualifications)) {
    doctor.qualifications = qualifications.map((q) => String(q).trim()).filter(Boolean);
  }

  if (clinic && typeof clinic === 'object') {
    doctor.clinic = {
      name: String(clinic.name || doctor.clinic.name).trim(),
      address: String(clinic.address || doctor.clinic.address).trim(),
      city: String(clinic.city || doctor.clinic.city).trim(),
      roomNumber: String(clinic.roomNumber || doctor.clinic.roomNumber || 'Suite 101').trim(),
      phone: String(clinic.phone || doctor.clinic.phone).trim(),
    };
  }

  doctor.updatedAt = new Date().toISOString();

  if (isMongoConnected()) {
    try {
      await Doctor.findOneAndUpdate(
        { id: doctor.id },
        {
          consultationFee: doctor.consultationFee,
          bio: doctor.bio,
          clinic: doctor.clinic,
          qualifications: doctor.qualifications,
          experienceYears: doctor.experienceYears,
          updatedAt: doctor.updatedAt,
        }
      );
    } catch (err) {
      console.warn(`[DoctorRoutes] MongoDB profile update failed: ${err.message}`);
    }
  }

  res.json({ doctor });
});

// 5. PUT /api/doctors/availability - Doctor configures working days, hours, and duration
router.put('/availability', authenticateToken, requireRole('doctor'), async (req, res) => {
  const doctor = await findDoctor(req.user.userId);
  if (!doctor) {
    return res.status(404).json({ message: 'Doctor profile not found' });
  }

  const {
    workingDays,
    dayStartTime,
    dayEndTime,
    slotDurationMinutes,
    breakStartTime,
    breakEndTime,
    unavailableDates,
  } = req.body || {};

  let availability = await findAvailability(doctor.id);
  if (!availability) {
    availability = {
      id: `avail-${doctor.id}`,
      doctorId: doctor.id,
      workingDays: [1, 2, 3, 4, 5],
      dayStartTime: '09:00',
      dayEndTime: '17:00',
      slotDurationMinutes: 30,
      breakStartTime: '13:00',
      breakEndTime: '14:00',
      unavailableDates: [],
      blockedSlots: [],
    };
    availabilities.push(availability);
  }

  if (Array.isArray(workingDays)) {
    availability.workingDays = workingDays.map(Number).filter((d) => d >= 0 && d <= 6);
  }

  if (dayStartTime && /^\d{2}:\d{2}$/.test(dayStartTime)) availability.dayStartTime = dayStartTime;
  if (dayEndTime && /^\d{2}:\d{2}$/.test(dayEndTime)) availability.dayEndTime = dayEndTime;

  if (slotDurationMinutes !== undefined) {
    const dur = Number(slotDurationMinutes);
    if ([15, 20, 30, 45, 60].includes(dur)) availability.slotDurationMinutes = dur;
  }

  if (breakStartTime && /^\d{2}:\d{2}$/.test(breakStartTime)) availability.breakStartTime = breakStartTime;
  if (breakEndTime && /^\d{2}:\d{2}$/.test(breakEndTime)) availability.breakEndTime = breakEndTime;

  if (Array.isArray(unavailableDates)) {
    availability.unavailableDates = unavailableDates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  }

  availability.updatedAt = new Date().toISOString();

  if (isMongoConnected()) {
    try {
      await DoctorAvailability.findOneAndUpdate(
        { doctorId: doctor.id },
        { ...availability },
        { upsert: true }
      );
    } catch (err) {
      console.warn(`[DoctorRoutes] MongoDB availability update failed: ${err.message}`);
    }
  }

  res.json({ availability });
});

// 6. POST /api/doctors/availability/block - Doctor blocks a specific slot
router.post('/availability/block', authenticateToken, requireRole('doctor'), async (req, res) => {
  const doctor = await findDoctor(req.user.userId);
  if (!doctor) {
    return res.status(404).json({ message: 'Doctor profile not found' });
  }

  const { date, startTime, endTime, reason = 'Personal unavailable' } = req.body || {};
  if (!date || !startTime || !endTime) {
    return res.status(400).json({ message: 'date (YYYY-MM-DD), startTime, and endTime are required' });
  }

  let availability = await findAvailability(doctor.id);
  if (!availability) {
    availability = {
      id: `avail-${doctor.id}`,
      doctorId: doctor.id,
      workingDays: [1, 2, 3, 4, 5],
      dayStartTime: '09:00',
      dayEndTime: '17:00',
      slotDurationMinutes: 30,
      breakStartTime: '13:00',
      breakEndTime: '14:00',
      unavailableDates: [],
      blockedSlots: [],
    };
    availabilities.push(availability);
  }

  const blockId = `block-${Date.now()}`;
  const blockEntry = {
    id: blockId,
    date,
    startTime,
    endTime,
    reason: String(reason).trim().slice(0, 100),
    createdAt: new Date().toISOString(),
  };

  availability.blockedSlots = availability.blockedSlots || [];
  availability.blockedSlots.push(blockEntry);

  if (isMongoConnected()) {
    try {
      await DoctorAvailability.findOneAndUpdate(
        { doctorId: doctor.id },
        { $push: { blockedSlots: blockEntry } },
        { upsert: true }
      );
    } catch {}
  }

  res.status(201).json({ blockedSlot: blockEntry });
});

// 7. DELETE /api/doctors/availability/block/:blockId - Doctor removes a blocked slot
router.delete('/availability/block/:blockId', authenticateToken, requireRole('doctor'), async (req, res) => {
  const doctor = await findDoctor(req.user.userId);
  if (!doctor) {
    return res.status(404).json({ message: 'Doctor profile not found' });
  }

  const availability = await findAvailability(doctor.id);
  if (!availability) {
    return res.status(404).json({ message: 'Availability record not found' });
  }

  const index = (availability.blockedSlots || []).findIndex((b) => b.id === req.params.blockId);
  if (index === -1) {
    return res.status(404).json({ message: 'Blocked slot not found' });
  }

  availability.blockedSlots.splice(index, 1);

  if (isMongoConnected()) {
    try {
      await DoctorAvailability.findOneAndUpdate(
        { doctorId: doctor.id },
        { $pull: { blockedSlots: { id: req.params.blockId } } }
      );
    } catch {}
  }

  res.json({ ok: true, message: 'Blocked slot removed' });
});

module.exports = router;
