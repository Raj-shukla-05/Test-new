const { doctors, availabilities, appointments, users } = require('../store');
const { isMongoConnected } = require('../db');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const DoctorAvailability = require('../models/DoctorAvailability');
const { createNotification } = require('./notificationService');

// In-memory concurrency locks to guarantee atomic reservations
const activeBookingLocks = new Set();

/**
 * Resolves doctor record by either doctor ID or user ID.
 * Checks in-memory cache first, then queries MongoDB and synchronizes cache.
 */
async function findDoctor(doctorIdOrUserId) {
  if (!doctorIdOrUserId) return null;
  const inMem = doctors.find((d) => d.id === doctorIdOrUserId || d.userId === doctorIdOrUserId);
  if (inMem) return inMem;

  if (isMongoConnected()) {
    try {
      const dbDoc = await Doctor.findOne({
        $or: [{ id: doctorIdOrUserId }, { userId: doctorIdOrUserId }],
      }).lean();
      if (dbDoc) {
        if (!doctors.some((d) => d.id === dbDoc.id || d.userId === dbDoc.userId)) {
          doctors.push(dbDoc);
        }
        return dbDoc;
      }
    } catch {}
  }
  return null;
}

/**
 * Resolves doctor availability record.
 */
async function findAvailability(doctorId) {
  const doctor = await findDoctor(doctorId);
  if (!doctor) return null;
  const inMem = availabilities.find((a) => a.doctorId === doctor.id);
  if (inMem) return inMem;

  if (isMongoConnected()) {
    try {
      const dbAvail = await DoctorAvailability.findOne({ doctorId: doctor.id }).lean();
      if (dbAvail) {
        if (!availabilities.some((a) => a.doctorId === dbAvail.doctorId)) {
          availabilities.push(dbAvail);
        }
        return dbAvail;
      }
    } catch {}
  }
  return null;
}

/**
 * Converts HH:mm string to minutes since midnight.
 */
function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Converts minutes since midnight to HH:mm string.
 */
function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * Validates YYYY-MM-DD date format and ensures it is not in the past.
 */
function validateDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { valid: false, message: 'Invalid date format. Expected YYYY-MM-DD.' };
  }
  const [year, month, day] = dateStr.split('-').map(Number);
  const targetDate = new Date(year, month - 1, day, 23, 59, 59, 999);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  if (targetDate < todayStart) {
    return { valid: false, message: 'Cannot view or book appointment slots for past dates.' };
  }
  return { valid: true };
}

/**
 * Generates discrete in-person consultation slots for a doctor on a given date.
 */
async function getAvailableSlots(doctorId, dateStr) {
  const doctor = await findDoctor(doctorId);
  if (!doctor) {
    const error = new Error('Doctor not found');
    error.statusCode = 404;
    throw error;
  }

  const dateCheck = validateDate(dateStr);
  if (!dateCheck.valid) {
    const error = new Error(dateCheck.message);
    error.statusCode = 400;
    throw error;
  }

  const availability = (await findAvailability(doctor.id)) || {
    workingDays: [1, 2, 3, 4, 5],
    dayStartTime: '09:00',
    dayEndTime: '17:00',
    slotDurationMinutes: 30,
    breakStartTime: '13:00',
    breakEndTime: '14:00',
    unavailableDates: [],
    blockedSlots: [],
  };

  const [year, month, day] = dateStr.split('-').map(Number);
  const targetDayOfWeek = new Date(year, month - 1, day).getDay();

  // Check if doctor works on this day
  if (!availability.workingDays.includes(targetDayOfWeek)) {
    return {
      doctor: { id: doctor.id, name: doctor.name, clinic: doctor.clinic },
      date: dateStr,
      isWorkingDay: false,
      reason: 'Doctor does not hold clinic on this day of the week.',
      slots: [],
    };
  }

  // Check if doctor marked this entire date as unavailable
  if (availability.unavailableDates.includes(dateStr)) {
    return {
      doctor: { id: doctor.id, name: doctor.name, clinic: doctor.clinic },
      date: dateStr,
      isWorkingDay: false,
      reason: 'Doctor is unavailable on this date.',
      slots: [],
    };
  }

  // Fetch active bookings for this doctor and date (both in-memory and MongoDB)
  let activeBookings = appointments.filter(
    (a) =>
      a.doctorId === doctor.id &&
      a.date === dateStr &&
      ['pending', 'confirmed'].includes(a.status)
  );

  if (isMongoConnected()) {
    try {
      const dbBookings = await Appointment.find({
        doctorId: doctor.id,
        date: dateStr,
        status: { $in: ['pending', 'confirmed'] },
      }).lean();
      if (dbBookings && dbBookings.length > 0) {
        activeBookings = dbBookings;
      }
    } catch (err) {
      console.warn(`[AppointmentService] MongoDB slot query error: ${err.message}`);
    }
  }

  const bookedStartTimes = new Set(activeBookings.map((b) => b.startTime));

  // Determine blocked slots for this date
  const blockedOnDate = (availability.blockedSlots || []).filter((b) => b.date === dateStr);

  const startMins = timeToMinutes(availability.dayStartTime || '09:00');
  const endMins = timeToMinutes(availability.dayEndTime || '17:00');
  const duration = Number(availability.slotDurationMinutes) || 30;
  const breakStartMins = availability.breakStartTime ? timeToMinutes(availability.breakStartTime) : null;
  const breakEndMins = availability.breakEndTime ? timeToMinutes(availability.breakEndTime) : null;

  const now = new Date();
  const isToday =
    now.getFullYear() === year &&
    now.getMonth() === month - 1 &&
    now.getDate() === day;
  const currentMinutesToday = now.getHours() * 60 + now.getMinutes();

  const slots = [];
  for (let m = startMins; m + duration <= endMins; m += duration) {
    const slotStart = minutesToTime(m);
    const slotEnd = minutesToTime(m + duration);

    // Check break time overlap
    const isBreak =
      breakStartMins !== null &&
      breakEndMins !== null &&
      m < breakEndMins &&
      m + duration > breakStartMins;

    // Check doctor-blocked slot
    const blockedReason = blockedOnDate.find(
      (b) => b.startTime <= slotStart && b.endTime >= slotEnd
    )?.reason;

    // Check if slot has already passed today
    const isPast = isToday && m <= currentMinutesToday;

    // Check if slot is already booked
    const isBooked = bookedStartTimes.has(slotStart);

    let available = true;
    let unavailableReason = null;

    if (isBreak) {
      available = false;
      unavailableReason = 'Clinic Break';
    } else if (blockedReason) {
      available = false;
      unavailableReason = blockedReason;
    } else if (isPast) {
      available = false;
      unavailableReason = 'Time slot has passed';
    } else if (isBooked) {
      available = false;
      unavailableReason = 'Reserved';
    }

    slots.push({
      startTime: slotStart,
      endTime: slotEnd,
      available,
      unavailableReason,
    });
  }

  return {
    doctor: {
      id: doctor.id,
      name: doctor.name,
      specialization: doctor.specialization,
      consultationFee: doctor.consultationFee,
      clinic: doctor.clinic,
    },
    date: dateStr,
    isWorkingDay: true,
    slots,
  };
}

/**
 * Atomically books an in-person clinical appointment.
 * Prevents race conditions and double-booking using mutex locks and partial unique indexes.
 */
async function bookAppointment({
  doctorId,
  patientId,
  date,
  startTime,
  reason = '',
  bookedBy,
}) {
  const doctor = await findDoctor(doctorId);
  if (!doctor) {
    const error = new Error('Doctor not found');
    error.statusCode = 404;
    throw error;
  }

  const patient = users[patientId];
  if (!patient || (patient.role !== 'patient' && !patient.name)) {
    const error = new Error('Patient not found');
    error.statusCode = 404;
    throw error;
  }

  // Validate date format and ensure it is not in the past
  const dateCheck = validateDate(date);
  if (!dateCheck.valid) {
    const error = new Error(dateCheck.message);
    error.statusCode = 400;
    throw error;
  }

  // Validate time format
  if (!/^\d{2}:\d{2}$/.test(startTime)) {
    const error = new Error('Invalid start time format. Expected HH:mm.');
    error.statusCode = 400;
    throw error;
  }

  const lockKey = `${doctor.id}:${date}:${startTime}`;
  if (activeBookingLocks.has(lockKey)) {
    const error = new Error(
      'This appointment slot is currently being processed by another patient. Please try again or select another slot.'
    );
    error.statusCode = 409;
    throw error;
  }

  // Acquire lock
  activeBookingLocks.add(lockKey);

  try {
    // 1. Verify slot is genuinely available according to schedule
    const schedule = await getAvailableSlots(doctor.id, date);
    if (!schedule.isWorkingDay) {
      const error = new Error(schedule.reason || 'Doctor is not available on this date.');
      error.statusCode = 400;
      throw error;
    }

    const matchedSlot = schedule.slots.find((s) => s.startTime === startTime);
    if (!matchedSlot) {
      const error = new Error(`Time slot ${startTime} does not align with doctor clinic hours.`);
      error.statusCode = 400;
      throw error;
    }

    if (!matchedSlot.available) {
      const error = new Error(
        `Time slot ${startTime} on ${date} is unavailable (${matchedSlot.unavailableReason || 'Reserved'}).`
      );
      error.statusCode = 409;
      throw error;
    }

    // 2. Secondary check against in-memory appointments
    const existingConflict = appointments.find(
      (a) =>
        a.doctorId === doctor.id &&
        a.date === date &&
        a.startTime === startTime &&
        ['pending', 'confirmed'].includes(a.status)
    );

    if (existingConflict) {
      const error = new Error(
        'This appointment slot has already been booked by another patient. Please choose a different slot.'
      );
      error.statusCode = 409;
      throw error;
    }

    const appointmentId = `apt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newAppointment = {
      id: appointmentId,
      patientId: patient.id,
      patientName: patient.name,
      doctorId: doctor.id,
      doctorName: doctor.name,
      doctorSpecialty: doctor.specialization,
      clinic: {
        name: doctor.clinic.name,
        address: doctor.clinic.address,
        city: doctor.clinic.city,
        roomNumber: doctor.clinic.roomNumber || 'Suite 101',
        phone: doctor.clinic.phone,
      },
      date,
      startTime: matchedSlot.startTime,
      endTime: matchedSlot.endTime,
      status: 'pending',
      consultationFee: doctor.consultationFee,
      reason: String(reason || '').trim().slice(0, 500),
      bookedBy: {
        userId: bookedBy.userId,
        role: bookedBy.role,
        name: bookedBy.name || (bookedBy.role === 'patient' ? patient.name : 'Caregiver'),
      },
      cancellation: { cancelledBy: null, cancelledByRole: null, cancelledAt: null, reason: null },
      rejection: { rejectedBy: null, rejectedAt: null, reason: null },
      sharedReportId: null,
      rescheduleInfo: { rescheduledFromId: null, rescheduledAt: null, previousSlot: null },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 3. Atomically persist to MongoDB if connected (relying on partial unique index)
    if (isMongoConnected()) {
      try {
        await Appointment.create(newAppointment);
      } catch (mongoErr) {
        if (mongoErr.code === 11000) {
          const conflictErr = new Error(
            'This appointment slot was just reserved by another patient. Please select another slot.'
          );
          conflictErr.statusCode = 409;
          throw conflictErr;
        }
        throw mongoErr;
      }
    }

    // Add to in-memory store
    appointments.push(newAppointment);

    // Send notifications to Doctor and Patient
    await createNotification({
      userId: doctor.userId,
      type: 'booking_created',
      title: 'New Appointment Booking Request',
      message: `${newAppointment.patientName} has booked an in-person clinical visit on ${date} at ${startTime}.`,
      appointmentId: newAppointment.id,
    });

    await createNotification({
      userId: patient.id,
      type: 'booking_created',
      title: 'Appointment Request Submitted',
      message: `Your in-person visit with ${doctor.name} at ${doctor.clinic.name} on ${date} at ${startTime} has been submitted.`,
      appointmentId: newAppointment.id,
    });

    return newAppointment;
  } finally {
    // Release concurrency lock
    activeBookingLocks.delete(lockKey);
  }
}

/**
 * Updates an appointment status following strict healthcare state transitions.
 */
async function transitionAppointmentStatus({
  appointmentId,
  targetStatus,
  actingUser,
  reason = '',
}) {
  let appointment = appointments.find((a) => a.id === appointmentId);
  if (!appointment && isMongoConnected()) {
    try {
      appointment = await Appointment.findOne({ id: appointmentId }).lean();
    } catch {}
  }

  if (!appointment) {
    const error = new Error('Appointment not found');
    error.statusCode = 404;
    throw error;
  }

  const doctor = await findDoctor(appointment.doctorId);
  const isDoctorUser = actingUser.role === 'doctor' && (actingUser.userId === doctor?.userId || actingUser.userId === appointment.doctorId);
  const isPatientUser = actingUser.role === 'patient' && actingUser.userId === appointment.patientId;
  const isCaregiverUser =
    actingUser.role === 'caregiver' &&
    users[appointment.patientId]?.authorizedCaregivers?.includes(actingUser.userId);

  const currentStatus = appointment.status;

  if (targetStatus === 'confirmed') {
    if (!isDoctorUser) {
      const error = new Error('Forbidden: Only the attending doctor can confirm this appointment.');
      error.statusCode = 403;
      throw error;
    }
    if (currentStatus !== 'pending') {
      const error = new Error(`Cannot confirm an appointment with status '${currentStatus}'.`);
      error.statusCode = 400;
      throw error;
    }

    appointment.status = 'confirmed';
    appointment.updatedAt = new Date().toISOString();

    await createNotification({
      userId: appointment.patientId,
      type: 'booking_confirmed',
      title: 'Appointment Confirmed',
      message: `Dr. ${doctor?.name || appointment.doctorName} confirmed your in-person visit for ${appointment.date} at ${appointment.startTime} at ${appointment.clinic.name}.`,
      appointmentId: appointment.id,
    });
  } else if (targetStatus === 'rejected') {
    if (!isDoctorUser) {
      const error = new Error('Forbidden: Only the attending doctor can reject this appointment.');
      error.statusCode = 403;
      throw error;
    }
    if (currentStatus !== 'pending') {
      const error = new Error(`Cannot reject an appointment with status '${currentStatus}'.`);
      error.statusCode = 400;
      throw error;
    }

    const rejectionReason = String(reason || 'Clinician unavailable').trim();
    appointment.status = 'rejected';
    appointment.rejection = {
      rejectedBy: actingUser.userId,
      rejectedAt: new Date().toISOString(),
      reason: rejectionReason,
    };
    appointment.updatedAt = new Date().toISOString();

    await createNotification({
      userId: appointment.patientId,
      type: 'booking_rejected',
      title: 'Appointment Request Declined',
      message: `Your booking request for ${appointment.date} was declined by the clinic: ${rejectionReason}.`,
      appointmentId: appointment.id,
    });
  } else if (targetStatus === 'cancelled') {
    if (!isDoctorUser && !isPatientUser && !isCaregiverUser) {
      const error = new Error('Forbidden: You are not authorized to cancel this appointment.');
      error.statusCode = 403;
      throw error;
    }
    if (!['pending', 'confirmed'].includes(currentStatus)) {
      const error = new Error(`Cannot cancel an appointment that is already '${currentStatus}'.`);
      error.statusCode = 400;
      throw error;
    }

    const cancellationReason = String(reason || 'Cancelled by user').trim();
    appointment.status = 'cancelled';
    appointment.cancellation = {
      cancelledBy: actingUser.userId,
      cancelledByRole: actingUser.role,
      cancelledAt: new Date().toISOString(),
      reason: cancellationReason,
    };
    appointment.updatedAt = new Date().toISOString();

    // Notify the other party
    if (isDoctorUser) {
      await createNotification({
        userId: appointment.patientId,
        type: 'appointment_cancelled',
        title: 'Appointment Cancelled by Doctor',
        message: `Your in-person appointment on ${appointment.date} was cancelled by the clinic: ${cancellationReason}.`,
        appointmentId: appointment.id,
      });
    } else {
      if (doctor?.userId) {
        await createNotification({
          userId: doctor.userId,
          type: 'appointment_cancelled',
          title: 'Appointment Cancelled by Patient',
          message: `${appointment.patientName} cancelled their visit on ${appointment.date} at ${appointment.startTime}: ${cancellationReason}.`,
          appointmentId: appointment.id,
        });
      }
    }
  } else if (targetStatus === 'completed') {
    if (!isDoctorUser) {
      const error = new Error('Forbidden: Only the attending doctor can mark an appointment as completed.');
      error.statusCode = 403;
      throw error;
    }
    if (currentStatus !== 'confirmed') {
      const error = new Error(`Only confirmed appointments can be marked as completed (current: '${currentStatus}').`);
      error.statusCode = 400;
      throw error;
    }

    appointment.status = 'completed';
    appointment.updatedAt = new Date().toISOString();
  } else if (targetStatus === 'no-show') {
    if (!isDoctorUser) {
      const error = new Error('Forbidden: Only the attending doctor can mark a no-show.');
      error.statusCode = 403;
      throw error;
    }
    if (currentStatus !== 'confirmed') {
      const error = new Error(`Only confirmed appointments can be marked as no-show (current: '${currentStatus}').`);
      error.statusCode = 400;
      throw error;
    }

    appointment.status = 'no-show';
    appointment.updatedAt = new Date().toISOString();
  } else {
    const error = new Error(`Invalid status transition to '${targetStatus}'.`);
    error.statusCode = 400;
    throw error;
  }

  // Update in MongoDB if connected
  if (isMongoConnected()) {
    try {
      await Appointment.findOneAndUpdate(
        { id: appointment.id },
        {
          status: appointment.status,
          cancellation: appointment.cancellation,
          rejection: appointment.rejection,
          updatedAt: appointment.updatedAt,
        }
      );
    } catch (err) {
      console.warn(`[AppointmentService] MongoDB status update error: ${err.message}`);
    }
  }

  return appointment;
}

/**
 * Reschedules an eligible appointment to a new date and time.
 */
async function rescheduleAppointment({
  appointmentId,
  newDate,
  newStartTime,
  actingUser,
  reason = 'Patient requested rescheduling',
}) {
  const appointment = appointments.find((a) => a.id === appointmentId);
  if (!appointment) {
    const error = new Error('Appointment not found');
    error.statusCode = 404;
    throw error;
  }

  const doctor = await findDoctor(appointment.doctorId);
  const isDoctorUser = actingUser.role === 'doctor' && (actingUser.userId === doctor?.userId || actingUser.userId === appointment.doctorId);
  const isPatientUser = actingUser.role === 'patient' && actingUser.userId === appointment.patientId;
  const isCaregiverUser =
    actingUser.role === 'caregiver' &&
    users[appointment.patientId]?.authorizedCaregivers?.includes(actingUser.userId);

  if (!isDoctorUser && !isPatientUser && !isCaregiverUser) {
    const error = new Error('Forbidden: You are not authorized to reschedule this appointment.');
    error.statusCode = 403;
    throw error;
  }

  if (!['pending', 'confirmed'].includes(appointment.status)) {
    const error = new Error(`Cannot reschedule an appointment that is already '${appointment.status}'.`);
    error.statusCode = 400;
    throw error;
  }

  // 1. Book the new appointment slot
  const newAppointment = await bookAppointment({
    doctorId: appointment.doctorId,
    patientId: appointment.patientId,
    date: newDate,
    startTime: newStartTime,
    reason: appointment.reason ? `${appointment.reason} (Rescheduled)` : 'Rescheduled visit',
    bookedBy: {
      userId: actingUser.userId,
      role: actingUser.role,
      name: actingUser.name || 'User',
    },
  });

  // Link reschedule metadata
  newAppointment.rescheduleInfo = {
    rescheduledFromId: appointment.id,
    rescheduledAt: new Date().toISOString(),
    previousSlot: `${appointment.date} ${appointment.startTime}`,
  };

  // 2. Mark old appointment as cancelled with reschedule note
  await transitionAppointmentStatus({
    appointmentId: appointment.id,
    targetStatus: 'cancelled',
    actingUser,
    reason: `Rescheduled to ${newDate} at ${newStartTime}`,
  });

  return newAppointment;
}

module.exports = {
  findDoctor,
  findAvailability,
  getAvailableSlots,
  bookAppointment,
  transitionAppointmentStatus,
  rescheduleAppointment,
};
