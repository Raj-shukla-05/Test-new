const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/server');

let server;
let baseUrl;

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

describe('Authentication & Authorization Integration Tests', () => {
  let patientToken;
  let doctorToken;

  test('POST /api/auth/login succeeds for seeded patient', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'raj@neuroguard.demo', password: 'patient123' }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.token);
    assert.equal(body.user.id, 'user-raj');
    assert.equal(body.user.role, 'patient');
    patientToken = body.token;
  });

  test('POST /api/auth/login succeeds for seeded doctor', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'priya@neuroguard.demo', password: 'doctor123' }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.token);
    assert.equal(body.user.id, 'doctor-priya');
    assert.equal(body.user.role, 'doctor');
    doctorToken = body.token;
  });

  test('POST /api/auth/login fails with invalid password', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'raj@neuroguard.demo', password: 'wrongpassword' }),
    });

    assert.equal(res.status, 401);
  });

  test('POST /api/auth/signup validates email format and password length', async () => {
    const badEmail = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', email: 'invalid-email', password: 'password123' }),
    });
    assert.equal(badEmail.status, 400);

    const shortPass = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test', email: 'test@example.com', password: '123' }),
    });
    assert.equal(shortPass.status, 400);
  });

  test('POST /api/auth/signup successfully registers a new patient', async () => {
    const uniqueEmail = `patient-${Date.now()}@example.com`;
    const res = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Vikram Seth', email: uniqueEmail, password: 'securepassword123', role: 'patient' }),
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.token);
    assert.equal(body.user.name, 'Vikram Seth');
    assert.equal(body.user.role, 'patient');
  });

  test('Protected endpoint returns 401 when token is missing', async () => {
    const res = await fetch(`${baseUrl}/users/user-raj/dashboard`);
    assert.equal(res.status, 401);
  });

  test('Patient can access their own dashboard', async () => {
    const res = await fetch(`${baseUrl}/users/user-raj/dashboard`, {
      headers: { Authorization: `Bearer ${patientToken}` },
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.summary);
  });

  test('Patient is forbidden (403) from accessing another patient record', async () => {
    const res = await fetch(`${baseUrl}/users/user-anita/dashboard`, {
      headers: { Authorization: `Bearer ${patientToken}` },
    });
    assert.equal(res.status, 403);
  });

  test('Doctor can access patient records and patient list', async () => {
    const listRes = await fetch(`${baseUrl}/doctors/doctor-priya/patients`, {
      headers: { Authorization: `Bearer ${doctorToken}` },
    });
    assert.equal(listRes.status, 200);
    const list = await listRes.json();
    assert.ok(Array.isArray(list));

    const patientRes = await fetch(`${baseUrl}/users/user-raj/dashboard`, {
      headers: { Authorization: `Bearer ${doctorToken}` },
    });
    assert.equal(patientRes.status, 200);
  });

  test('Doctor cannot access private records of a patient assigned to a different clinician (403)', async () => {
    const { generateToken } = require('../src/middleware/auth');
    const otherDoctorToken = generateToken({
      userId: 'doctor-other',
      role: 'doctor',
      name: 'Dr. Other',
      email: 'other@neuroguard.demo',
    });

    // user-raj is assigned to doctor-priya
    const res = await fetch(`${baseUrl}/users/user-raj/dashboard`, {
      headers: { Authorization: `Bearer ${otherDoctorToken}` },
    });
    assert.equal(res.status, 403);
  });

  test('Patient cannot access doctor patient list', async () => {
    const res = await fetch(`${baseUrl}/doctors/doctor-priya/patients`, {
      headers: { Authorization: `Bearer ${patientToken}` },
    });
    assert.equal(res.status, 403);
  });
});
