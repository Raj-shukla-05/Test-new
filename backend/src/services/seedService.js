const Doctor = require('../models/Doctor');
const DoctorAvailability = require('../models/DoctorAvailability');
const User = require('../models/User');
const { doctors, availabilities, users, credentials } = require('../store');
const { isMongoConnected } = require('../db');

/**
 * Synchronizes seed accounts and any dynamically registered doctors in MongoDB.
 * Ensures all doctor users in the User collection have complete Doctor and DoctorAvailability records.
 */
async function seedDatabaseIfEmpty() {
  if (!isMongoConnected()) return;

  try {
    // 1. Seed initial Doctors
    for (const doc of doctors) {
      const exists = await Doctor.findOne({ id: doc.id });
      if (!exists) {
        await Doctor.create(doc);
      }
    }

    // 2. Seed initial Availabilities
    for (const avail of availabilities) {
      const exists = await DoctorAvailability.findOne({ doctorId: avail.doctorId });
      if (!exists) {
        await DoctorAvailability.create(avail);
      }
    }

    // 3. Seed Users & Credentials
    for (const cred of credentials) {
      const exists = await User.findOne({ email: cred.email });
      if (!exists) {
        const u = users[cred.userId];
        if (u) {
          await User.create({
            id: u.id,
            name: u.name,
            email: cred.email,
            passwordHash: cred.passwordHash,
            role: u.role,
            age: u.age || null,
            preferredLanguage: u.preferredLanguage || 'English',
            doctorId: u.doctorId || null,
            authorizedCaregivers: u.authorizedCaregivers || [],
            caregiverPatients: u.caregiverPatients || [],
          });
        }
      }
    }

    // 4. Scan all users with role === 'doctor' and ensure they have a Doctor profile and DoctorAvailability
    const allDoctorUsers = await User.find({ role: 'doctor' }).lean();
    for (const docUser of allDoctorUsers) {
      const existingDoc = await Doctor.findOne({
        $or: [{ userId: docUser.id }, { id: docUser.id }, { id: `doc-${docUser.id.replace(/^doctor-/, '')}` }],
      });

      const docId = existingDoc ? existingDoc.id : `doc-${docUser.id.replace(/^doctor-/, '')}`;

      if (!existingDoc) {
        const rawName = docUser.name || 'Specialist';
        const formattedName = rawName.startsWith('Dr.') ? rawName : `Dr. ${rawName}`;
        const newDoc = {
          id: docId,
          userId: docUser.id,
          name: formattedName,
          specialization: 'Neurology',
          qualifications: ['MBBS', 'MD - Neurology'],
          experienceYears: 7,
          consultationFee: 1000,
          bio: 'Specialist in post-stroke recovery, neurological rehabilitation, and clinical motor assessments.',
          clinic: {
            name: `${rawName.replace(/^Dr\.?\s*/, '')}'s Neuro Recovery Clinic`,
            address: 'Plot 22, Healthcare Enclave, Linking Road',
            city: 'Mumbai',
            roomNumber: 'Suite 102',
            phone: '+91 22 2600 5566',
          },
          rating: 4.8,
          isActive: true,
          createdAt: docUser.createdAt || new Date(),
          updatedAt: new Date(),
        };

        await Doctor.create(newDoc);
        console.log(`[Database] Auto-generated Doctor profile for user '${docUser.name}' (${docUser.id})`);
      }

      // Ensure availability exists for this doctor
      const existingAvail = await DoctorAvailability.findOne({ doctorId: docId });
      if (!existingAvail) {
        await DoctorAvailability.create({
          id: `avail-${docId}`,
          doctorId: docId,
          workingDays: [1, 2, 3, 4, 5],
          dayStartTime: '09:00',
          dayEndTime: '17:00',
          slotDurationMinutes: 30,
          breakStartTime: '13:00',
          breakEndTime: '14:00',
          unavailableDates: [],
          blockedSlots: [],
        });
      }
    }

    // 5. Populate/Refresh in-memory doctors and availabilities arrays with real database records
    const allDbDoctors = await Doctor.find({ isActive: true }).lean();
    for (const dbDoc of allDbDoctors) {
      const existingIdx = doctors.findIndex((d) => d.id === dbDoc.id || d.userId === dbDoc.userId);
      if (existingIdx !== -1) {
        doctors[existingIdx] = dbDoc;
      } else {
        doctors.push(dbDoc);
      }
      // Also register in users map if not present
      if (!users[dbDoc.userId]) {
        users[dbDoc.userId] = {
          id: dbDoc.userId,
          name: dbDoc.name,
          role: 'doctor',
          specialty: dbDoc.specialization,
        };
      }
    }

    const allDbAvails = await DoctorAvailability.find({}).lean();
    for (const dbAvail of allDbAvails) {
      const existingIdx = availabilities.findIndex((a) => a.doctorId === dbAvail.doctorId);
      if (existingIdx !== -1) {
        availabilities[existingIdx] = dbAvail;
      } else {
        availabilities.push(dbAvail);
      }
    }

    console.log(`[Database] Seed synchronization complete: ${allDbDoctors.length} doctors active in database.`);
  } catch (err) {
    console.warn(`[Database] Seed synchronization note: ${err.message}`);
  }
}

module.exports = { seedDatabaseIfEmpty };
