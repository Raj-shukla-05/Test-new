const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/server');
const { generateToken } = require('../src/middleware/auth');

let server;
let baseUrl;

const patientRajToken = generateToken({
  userId: 'user-raj',
  role: 'patient',
  name: 'Raj Kumar',
  email: 'raj@neuroguard.demo',
});

const patientAnitaToken = generateToken({
  userId: 'user-anita',
  role: 'patient',
  name: 'Anita Sharma',
  email: 'anita-pat@neuroguard.demo',
});

const unauthorizedCaregiverToken = generateToken({
  userId: 'caregiver-stranger',
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

function getFutureDate(daysAhead = 15) {
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

describe('Doctor Appointment Security & Vulnerability Defense Tests', () => {
  const futureDate = getFutureDate(20);
  let testAppointmentId;

  // Setup: create an initial appointment for Raj with Priya
  before(async () => {
    const res = await fetch(`${baseUrl}/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patientRajToken}`,
      },
      body: JSON.stringify({
        doctorId: 'doc-priya',
        date: futureDate,
        startTime: '09:00',
        reason: 'Security test baseline appointment',
      }),
    });
    const body = await res.json();
    testAppointmentId = body.appointment.id;
  });

  test('S1: Unauthenticated request to protected endpoint returns 401', async () => {
    const res = await fetch(`${baseUrl}/appointments/my`);
    assert.equal(res.status, 401);
  });

  test('S2: Malformed or tampered JWT returns 401', async () => {
    const res = await fetch(`${baseUrl}/appointments/my`, {
      headers: { Authorization: 'Bearer invalid.tampered.token12345' },
    });
    assert.equal(res.status, 401);
  });

  test('S3: Vertical privilege escalation: Patient cannot access doctor availability config', async () => {
    const res = await fetch(`${baseUrl}/doctors/availability`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patientRajToken}`,
      },
      body: JSON.stringify({
        workingDays: [0, 1, 2, 3, 4, 5, 6],
      }),
    });
    assert.equal(res.status, 403);
  });

  test('S4: Horizontal privilege escalation: Patient cannot view another patient’s appointment (IDOR)', async () => {
    const res = await fetch(`${baseUrl}/appointments/${testAppointmentId}`, {
      headers: { Authorization: `Bearer ${patientAnitaToken}` },
    });
    assert.equal(res.status, 403);
  });

  test('S5: Caregiver isolation: Unauthorized caregiver cannot view patient appointment', async () => {
    const res = await fetch(`${baseUrl}/appointments/${testAppointmentId}`, {
      headers: { Authorization: `Bearer ${unauthorizedCaregiverToken}` },
    });
    assert.equal(res.status, 403);
  });

  test('S6: Doctor isolation: Doctor cannot confirm or complete another doctor’s appointment', async () => {
    const res = await fetch(`${baseUrl}/appointments/${testAppointmentId}/confirm`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${doctorVikramToken}` },
    });
    assert.equal(res.status, 403);
  });

  test('S7: Status transition tampering: Patient cannot arbitrarily mark visit as completed', async () => {
    const res = await fetch(`${baseUrl}/appointments/${testAppointmentId}/complete`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${patientRajToken}` },
    });
    assert.equal(res.status, 403);
  });

  test('S8: Input validation: Rejects malformed dates and past dates', async () => {
    const resPast = await fetch(`${baseUrl}/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patientRajToken}`,
      },
      body: JSON.stringify({
        doctorId: 'doc-priya',
        date: '2022-01-01',
        startTime: '10:00',
      }),
    });
    assert.equal(resPast.status, 400);

    const resInvalid = await fetch(`${baseUrl}/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patientRajToken}`,
      },
      body: JSON.stringify({
        doctorId: 'doc-priya',
        date: 'not-a-valid-date',
        startTime: '10:00',
      }),
    });
    assert.equal(resInvalid.status, 400);
  });

  test('S9: Rejects non-existent doctor booking requests', async () => {
    const res = await fetch(`${baseUrl}/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patientRajToken}`,
      },
      body: JSON.stringify({
        doctorId: 'doc-nonexistent-1234',
        date: futureDate,
        startTime: '10:00',
      }),
    });
    assert.equal(res.status, 404);
  });

  test('S10: Report Sharing IDOR: Unauthorized doctor cannot view report', async () => {
    // 1. Raj shares report with Dr. Priya
    const shareRes = await fetch(`${baseUrl}/reports/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patientRajToken}`,
      },
      body: JSON.stringify({
        doctorId: 'doc-priya',
        appointmentId: testAppointmentId,
      }),
    });
    const shareBody = await shareRes.json();
    const shareId = shareBody.share.id;

    // 2. Dr. Vikram (unrelated) attempts to access
    const vikramRes = await fetch(`${baseUrl}/reports/shared/${shareId}`, {
      headers: { Authorization: `Bearer ${doctorVikramToken}` },
    });
    assert.equal(vikramRes.status, 403);

    // 3. Raj revokes
    await fetch(`${baseUrl}/reports/shares/${shareId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${patientRajToken}` },
    });

    // 4. Dr. Priya now tries to view revoked report
    const priyaRes = await fetch(`${baseUrl}/reports/shared/${shareId}`, {
      headers: { Authorization: `Bearer ${doctorPriyaToken}` },
    });
    assert.equal(priyaRes.status, 403);
    const priyaBody = await priyaRes.json();
    assert(/revoked/i.test(priyaBody.message));
  });
});
