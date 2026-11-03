const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/server');
const { generateToken } = require('../src/middleware/auth');
const { appointments } = require('../src/store');

let server;
let baseUrl;

// Pre-generated auth tokens
const patientToken = generateToken({
  userId: 'user-raj',
  role: 'patient',
  name: 'Raj Kumar',
  email: 'raj@neuroguard.demo',
});

const otherPatientToken = generateToken({
  userId: 'user-anita',
  role: 'patient',
  name: 'Anita Sharma',
  email: 'anita-pat@neuroguard.demo',
});

const caregiverToken = generateToken({
  userId: 'caregiver-anita',
  role: 'caregiver',
  name: 'Anita Sharma (Caregiver)',
  email: 'anita@neuroguard.demo',
});

const unauthorizedCaregiverToken = generateToken({
  userId: 'caregiver-unauthorized',
  role: 'caregiver',
  name: 'Stranger Caregiver',
  email: 'stranger@neuroguard.demo',
});

const doctorPriyaToken = generateToken({
  userId: 'doctor-priya',
  role: 'doctor',
  name: 'Dr. Priya Nair',
  email: 'priya@neuroguard.demo',
});

const doctorVikramToken = generateToken({
  userId: 'doctor-vikram',
  role: 'doctor',
  name: 'Dr. Vikram Rao',
  email: 'vikram@neuroguard.demo',
});

before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

// Helper to generate future date YYYY-MM-DD on Mon-Fri
function getFutureDate(daysAhead = 7) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

describe('Doctor Appointment Management & Clinical Recovery System Tests', () => {
  const futureTestDate = getFutureDate(14);
  let createdAppointmentId = null;
  let sharedReportId = null;

  test('1. Doctor Discovery: Browse, search and filter doctors', async () => {
    // Basic listing
    const resAll = await fetch(`${baseUrl}/doctors`);
    assert.equal(resAll.status, 200);
    const bodyAll = await resAll.json();
    assert(bodyAll.doctors.length >= 4);

    // Search by doctor name
    const resSearch = await fetch(`${baseUrl}/doctors?search=Priya`);
    assert.equal(resSearch.status, 200);
    const bodySearch = await resSearch.json();
    assert.equal(bodySearch.doctors[0].name, 'Dr. Priya Nair');

    // Filter by specialization
    const resSpec = await fetch(`${baseUrl}/doctors?specialization=Neurology`);
    assert.equal(resSpec.status, 200);
    const bodySpec = await resSpec.json();
    assert(bodySpec.doctors.every((d) => d.specialization === 'Neurology'));

    // Filter by city
    const resCity = await fetch(`${baseUrl}/doctors?city=Mumbai`);
    assert.equal(resCity.status, 200);
    const bodyCity = await resCity.json();
    assert(bodyCity.doctors.length > 0);
  });

  test('2. Doctor Availability: Generate in-person discrete slots with break exclusion', async () => {
    const res = await fetch(`${baseUrl}/doctors/doc-priya/availability?date=${futureTestDate}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.isWorkingDay, true);
    assert(body.slots.length > 0);

    // 13:00 break slot must be unavailable
    const breakSlot = body.slots.find((s) => s.startTime === '13:00');
    if (breakSlot) {
      assert.equal(breakSlot.available, false);
      assert.equal(breakSlot.unavailableReason, 'Clinic Break');
    }

    // Past date rejection
    const pastRes = await fetch(`${baseUrl}/doctors/doc-priya/availability?date=2021-01-01`);
    assert.equal(pastRes.status, 400);
  });

  test('3. Patient Appointment Booking: Successful in-person clinical visit booking', async () => {
    const res = await fetch(`${baseUrl}/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patientToken}`,
      },
      body: JSON.stringify({
        doctorId: 'doc-priya',
        date: futureTestDate,
        startTime: '10:00',
        reason: 'Post-stroke arm coordination evaluation',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.appointment.patientId, 'user-raj');
    assert.equal(body.appointment.status, 'pending');
    assert.equal(body.appointment.startTime, '10:00');
    assert.equal(body.appointment.clinic.name, 'Apex Neurorehabilitation Center');
    createdAppointmentId = body.appointment.id;
  });

  test('4. Double Booking & Concurrency Prevention: Slot collision returns 409 Conflict', async () => {
    const res = await fetch(`${baseUrl}/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patientToken}`,
      },
      body: JSON.stringify({
        doctorId: 'doc-priya',
        date: futureTestDate,
        startTime: '10:00',
        reason: 'Attempt duplicate booking',
      }),
    });

    assert.equal(res.status, 409);
    const body = await res.json();
    assert(/unavailable|reserved|already been booked/i.test(body.message));
  });

  test('5. Caregiver Booking: Authorized caregiver books on behalf of patient', async () => {
    const res = await fetch(`${baseUrl}/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${caregiverToken}`,
      },
      body: JSON.stringify({
        doctorId: 'doc-priya',
        patientId: 'user-raj',
        date: futureTestDate,
        startTime: '11:00',
        reason: 'Caregiver arranged mobility review',
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.appointment.patientId, 'user-raj');
    assert.equal(body.appointment.bookedBy.role, 'caregiver');
  });

  test('6. Unauthorized Caregiver: Blocked from booking for unassigned patient', async () => {
    const res = await fetch(`${baseUrl}/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${unauthorizedCaregiverToken}`,
      },
      body: JSON.stringify({
        doctorId: 'doc-priya',
        patientId: 'user-raj',
        date: futureTestDate,
        startTime: '11:30',
        reason: 'Unauthorized attempt',
      }),
    });

    assert.equal(res.status, 403);
  });

  test('7. Patient Retrieval: Patient accesses only own appointments', async () => {
    const res = await fetch(`${baseUrl}/appointments/my`, {
      headers: { Authorization: `Bearer ${patientToken}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert(body.appointments.length >= 2);
    assert(body.appointments.every((a) => a.patientId === 'user-raj'));
  });

  test('8. Doctor Retrieval: Doctor accesses assigned clinic appointments', async () => {
    const res = await fetch(`${baseUrl}/appointments/doctor`, {
      headers: { Authorization: `Bearer ${doctorPriyaToken}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert(body.appointments.length >= 2);
    assert(body.appointments.every((a) => a.doctorId === 'doc-priya'));
  });

  test('9. State Transitions: Doctor confirms pending appointment', async () => {
    const res = await fetch(`${baseUrl}/appointments/${createdAppointmentId}/confirm`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${doctorPriyaToken}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.appointment.status, 'confirmed');
  });

  test('10. Security: Patient cannot confirm or complete appointments', async () => {
    const res = await fetch(`${baseUrl}/appointments/${createdAppointmentId}/complete`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${patientToken}` },
    });

    assert.equal(res.status, 403);
  });

  test('11. Security: Doctor cannot modify another doctor’s appointments', async () => {
    const res = await fetch(`${baseUrl}/appointments/${createdAppointmentId}/complete`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${doctorVikramToken}` },
    });

    assert.equal(res.status, 403);
  });

  test('12. Rescheduling: Atomically moves visit to new available slot', async () => {
    const res = await fetch(`${baseUrl}/appointments/${createdAppointmentId}/reschedule`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patientToken}`,
      },
      body: JSON.stringify({
        newDate: futureTestDate,
        newStartTime: '15:00',
        reason: 'Shifted schedule',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.appointment.startTime, '15:00');
    assert.equal(body.appointment.rescheduleInfo.rescheduledFromId, createdAppointmentId);

    // Old appointment must now be marked cancelled
    const oldApt = appointments.find((a) => a.id === createdAppointmentId);
    assert.equal(oldApt.status, 'cancelled');

    // Update active appointment ID
    createdAppointmentId = body.appointment.id;
  });

  test('13. Recovery Report Preview: Patient compiles genuine assessment report', async () => {
    const res = await fetch(`${baseUrl}/reports/preview`, {
      headers: { Authorization: `Bearer ${patientToken}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.report.patient.id, 'user-raj');
    assert(body.report.summary.totalAssessments > 0);
    assert(body.report.clinicalDisclaimer.includes('NeuroGuard AI'));
    assert(Array.isArray(body.report.sessions));
  });

  test('14. Recovery Report Sharing: Patient authorizes sharing with Doctor', async () => {
    const res = await fetch(`${baseUrl}/reports/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patientToken}`,
      },
      body: JSON.stringify({
        doctorId: 'doc-priya',
        appointmentId: createdAppointmentId,
      }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.share.patientId, 'user-raj');
    assert.equal(body.share.doctorId, 'doc-priya');
    assert.equal(body.share.status, 'active');
    sharedReportId = body.share.id;
  });

  test('15. Secure Report Access: Intended doctor views report (Logged in audit)', async () => {
    const res = await fetch(`${baseUrl}/reports/shared/${sharedReportId}`, {
      headers: { Authorization: `Bearer ${doctorPriyaToken}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.report.id, sharedReportId);
    assert(body.report.accessAuditLog.some((l) => l.action === 'viewed'));
  });

  test('16. IDOR Report Security: Unrelated doctor is blocked from accessing report', async () => {
    const res = await fetch(`${baseUrl}/reports/shared/${sharedReportId}`, {
      headers: { Authorization: `Bearer ${doctorVikramToken}` },
    });

    assert.equal(res.status, 403);
  });

  test('17. Patient Revocation: Patient revokes report access; doctor is blocked', async () => {
    // Revoke
    const revokeRes = await fetch(`${baseUrl}/reports/shares/${sharedReportId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${patientToken}` },
    });
    assert.equal(revokeRes.status, 200);
    const revokeBody = await revokeRes.json();
    assert.equal(revokeBody.report.status, 'revoked');

    // Doctor now attempts to view
    const accessRes = await fetch(`${baseUrl}/reports/shared/${sharedReportId}`, {
      headers: { Authorization: `Bearer ${doctorPriyaToken}` },
    });
    assert.equal(accessRes.status, 403);
    const accessBody = await accessRes.json();
    assert(/revoked/i.test(accessBody.message));
  });

  test('18. In-App Notifications: Notifications generated and marked as read', async () => {
    const res = await fetch(`${baseUrl}/notifications`, {
      headers: { Authorization: `Bearer ${patientToken}` },
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert(body.notifications.length > 0);

    const firstNotif = body.notifications[0];
    const markRes = await fetch(`${baseUrl}/notifications/${firstNotif.id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${patientToken}` },
    });
    assert.equal(markRes.status, 200);
    const markBody = await markRes.json();
    assert.equal(markBody.notification.read, true);
  });

  test('19. Doctor Availability Management: Doctor blocks custom slot', async () => {
    const blockRes = await fetch(`${baseUrl}/doctors/availability/block`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${doctorPriyaToken}`,
      },
      body: JSON.stringify({
        date: futureTestDate,
        startTime: '16:00',
        endTime: '16:30',
        reason: 'Clinical Case Conference',
      }),
    });

    assert.equal(blockRes.status, 201);
    const blockBody = await blockRes.json();
    assert.equal(blockBody.blockedSlot.reason, 'Clinical Case Conference');

    // Slot at 16:00 on futureTestDate must now be unavailable
    const slotsRes = await fetch(`${baseUrl}/doctors/doc-priya/availability?date=${futureTestDate}`);
    const slotsBody = await slotsRes.json();
    const slot16 = slotsBody.slots.find((s) => s.startTime === '16:00');
    assert.equal(slot16.available, false);
    assert.equal(slot16.unavailableReason, 'Clinical Case Conference');
  });

  test('20. Concurrency Simulation: Simultaneous bookings of the same slot permit only one winner', async () => {
    const concurrentSlot = '12:00';
    const [bookingA, bookingB] = await Promise.all([
      fetch(`${baseUrl}/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${patientToken}`,
        },
        body: JSON.stringify({
          doctorId: 'doc-priya',
          date: futureTestDate,
          startTime: concurrentSlot,
          reason: 'Patient A concurrent request',
        }),
      }),
      fetch(`${baseUrl}/appointments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${otherPatientToken}`,
        },
        body: JSON.stringify({
          doctorId: 'doc-priya',
          date: futureTestDate,
          startTime: concurrentSlot,
          reason: 'Patient B concurrent request',
        }),
      }),
    ]);

    const statuses = [bookingA.status, bookingB.status].sort();
    assert.deepEqual(statuses, [201, 409]);
  });
});
