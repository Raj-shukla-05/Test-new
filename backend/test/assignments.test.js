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

describe('Doctor-Patient Assessment Assignment Workflow Tests', () => {
  let doctorToken;
  let otherDoctorToken;
  let patientToken;
  let otherPatientToken;
  let testAssignmentId;

  before(async () => {
    // 1. Log in seeded doctor (Dr. Priya)
    const docRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'priya@neuroguard.demo', password: 'doctor123' }),
    });
    const docData = await docRes.json();
    doctorToken = docData.token;

    // 2. Register another doctor (Dr. Arun)
    const otherDocRes = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Dr. Arun Kumar',
        email: `arun-${Date.now()}@neuroguard.demo`,
        password: 'doctorpassword123',
        role: 'doctor',
      }),
    });
    const otherDocData = await otherDocRes.json();
    otherDoctorToken = otherDocData.token;

    // 3. Log in seeded patient (Raj Kumar)
    const patRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'raj@neuroguard.demo', password: 'patient123' }),
    });
    const patData = await patRes.json();
    patientToken = patData.token;

    // 4. Register another patient (Sneha)
    const otherPatRes = await fetch(`${baseUrl}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Sneha Patel',
        email: `sneha-${Date.now()}@neuroguard.demo`,
        password: 'patientpassword123',
        role: 'patient',
      }),
    });
    const otherPatData = await otherPatRes.json();
    otherPatientToken = otherPatData.token;
  });

  test('Doctor successfully assigns an assessment to authorized patient', async () => {
    const due = new Date(Date.now() + 7 * 86400000).toISOString();
    const res = await fetch(`${baseUrl}/assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${doctorToken}`,
      },
      body: JSON.stringify({
        patientId: 'user-raj',
        exerciseType: 'arm_raise',
        instructions: 'Perform 5 slow bilateral arm raises in the morning. Ensure shoulders stay level.',
        targetReps: 5,
        dueDate: due,
      }),
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.assignment);
    assert.equal(data.assignment.doctorId, 'doctor-priya');
    assert.equal(data.assignment.patientId, 'user-raj');
    assert.equal(data.assignment.status, 'assigned');
    assert.equal(data.assignment.exerciseType, 'arm_raise');
    testAssignmentId = data.assignment.id;
  });

  test('Assignment creation rejects invalid exercise type or missing instructions', async () => {
    const due = new Date(Date.now() + 7 * 86400000).toISOString();
    const badType = await fetch(`${baseUrl}/assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${doctorToken}`,
      },
      body: JSON.stringify({
        patientId: 'user-raj',
        exerciseType: 'unsupported_exercise',
        instructions: 'Instructions here',
        targetReps: 5,
        dueDate: due,
      }),
    });
    assert.equal(badType.status, 400);

    const badInstructions = await fetch(`${baseUrl}/assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${doctorToken}`,
      },
      body: JSON.stringify({
        patientId: 'user-raj',
        exerciseType: 'arm_raise',
        instructions: '  ',
        targetReps: 5,
        dueDate: due,
      }),
    });
    assert.equal(badInstructions.status, 400);
  });

  test('Unauthorized doctor cannot assign work to another doctor\'s patient', async () => {
    const due = new Date(Date.now() + 7 * 86400000).toISOString();
    const res = await fetch(`${baseUrl}/assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${otherDoctorToken}`,
      },
      body: JSON.stringify({
        patientId: 'user-raj', // Belongs to Dr. Priya
        exerciseType: 'arm_raise',
        instructions: 'Unauthorized assignment attempt',
        targetReps: 5,
        dueDate: due,
      }),
    });

    assert.equal(res.status, 403);
  });

  test('Patient can retrieve their own assignments', async () => {
    const res = await fetch(`${baseUrl}/patients/user-raj/assignments`, {
      headers: { Authorization: `Bearer ${patientToken}` },
    });

    assert.equal(res.status, 200);
    const list = await res.json();
    assert.ok(Array.isArray(list));
    const found = list.find((a) => a.id === testAssignmentId);
    assert.ok(found);
    assert.equal(found.patientId, 'user-raj');
  });

  test('Patient is blocked from retrieving another patient\'s assignments', async () => {
    const res = await fetch(`${baseUrl}/patients/user-raj/assignments`, {
      headers: { Authorization: `Bearer ${otherPatientToken}` },
    });

    assert.equal(res.status, 403);
  });

  test('Patient can transition their assignment from assigned to in_progress', async () => {
    const res = await fetch(`${baseUrl}/assignments/${testAssignmentId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patientToken}`,
      },
      body: JSON.stringify({ status: 'in_progress' }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.assignment.status, 'in_progress');
  });

  test('Invalid camera result is not marked as successfully completed', async () => {
    // Attempt to submit an assessment session with 0 valid frames
    const res = await fetch(`${baseUrl}/assessments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patientToken}`,
      },
      body: JSON.stringify({
        userId: 'user-raj',
        assignmentId: testAssignmentId,
        exerciseType: 'arm_raise',
        duration: 10,
        score: 0,
        metrics: { movement: 0, balance: 0, coordination: 0 },
        trackingQuality: {
          validFrames: 0,
          totalFrames: 120,
          trackingRatio: 0,
          isValid: false,
          qualityWarning: 'No pose detected in frame',
        },
      }),
    });

    assert.equal(res.status, 400);
  });

  test('Completed valid session links to assignment and updates status to completed', async () => {
    const res = await fetch(`${baseUrl}/assessments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patientToken}`,
      },
      body: JSON.stringify({
        userId: 'user-raj',
        assignmentId: testAssignmentId,
        exerciseType: 'arm_raise',
        duration: 75,
        score: 84,
        metrics: { movement: 85, balance: 80, coordination: 82, speech: 84 },
        trackingQuality: {
          validFrames: 210,
          totalFrames: 220,
          trackingRatio: 0.95,
          isValid: true,
          qualityWarning: null,
        },
      }),
    });

    assert.equal(res.status, 201);
    const assessment = await res.json();
    assert.equal(assessment.assignmentId, testAssignmentId);

    // Verify assignment is now completed and references the session
    const asgnRes = await fetch(`${baseUrl}/assignments/${testAssignmentId}`, {
      headers: { Authorization: `Bearer ${patientToken}` },
    });
    const asgnData = await asgnRes.json();
    assert.equal(asgnData.assignment.status, 'completed');
    assert.equal(asgnData.assignment.completedSessionId, assessment.id);
  });

  test('Invalid status transition is rejected by backend', async () => {
    // Attempt to revert a completed assignment back to in_progress
    const res = await fetch(`${baseUrl}/assignments/${testAssignmentId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${doctorToken}`,
      },
      body: JSON.stringify({ status: 'in_progress' }),
    });

    assert.equal(res.status, 400);
  });

  test('Doctor can review a completed session with clinical notes', async () => {
    const res = await fetch(`${baseUrl}/assignments/${testAssignmentId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${doctorToken}`,
      },
      body: JSON.stringify({
        status: 'reviewed',
        doctorNotes: 'Excellent bilateral symmetry and smooth controlled elevation. Cleared for next progression.',
      }),
    });

    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.assignment.status, 'reviewed');
    assert.ok(data.assignment.doctorNotes.includes('Excellent bilateral symmetry'));
    assert.ok(data.assignment.reviewedAt);
  });

  test('Doctor cannot review or modify an assignment created by another doctor', async () => {
    const res = await fetch(`${baseUrl}/assignments/${testAssignmentId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${otherDoctorToken}`,
      },
      body: JSON.stringify({
        status: 'reviewed',
        doctorNotes: 'Tampering attempt',
      }),
    });

    assert.equal(res.status, 403);
  });

  test('Invalid tracking quality in self-directed session without assignment is rejected (400)', async () => {
    const res = await fetch(`${baseUrl}/assessments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patientToken}`,
      },
      body: JSON.stringify({
        userId: 'user-raj',
        exerciseType: 'arm_raise',
        duration: 20,
        score: 0,
        metrics: { movement: 0 },
        trackingQuality: {
          validFrames: 1,
          totalFrames: 100,
          trackingRatio: 0.01,
          isValid: false,
          qualityWarning: 'Lost body tracking completely',
        },
      }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.match(body.message, /insufficient valid body tracking/i);
  });

  test('Patient cannot submit an assessment for another patient ID (403)', async () => {
    const res = await fetch(`${baseUrl}/assessments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patientToken}`,
      },
      body: JSON.stringify({
        userId: 'user-anita', // Raj trying to submit for Anita
        exerciseType: 'arm_raise',
        duration: 30,
        score: 75,
        metrics: { movement: 75 },
      }),
    });

    assert.equal(res.status, 403);
  });

  test('Non-patient (doctor) cannot submit camera assessment sessions (403)', async () => {
    const res = await fetch(`${baseUrl}/assessments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${doctorToken}`,
      },
      body: JSON.stringify({
        userId: 'user-raj',
        exerciseType: 'arm_raise',
        duration: 30,
        score: 75,
        metrics: { movement: 75 },
      }),
    });

    assert.equal(res.status, 403);
  });

  test('Valid assessment response indicates persistence and storage mode truthfully', async () => {
    const res = await fetch(`${baseUrl}/assessments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${patientToken}`,
      },
      body: JSON.stringify({
        userId: 'user-raj',
        exerciseType: 'arm_raise',
        duration: 45,
        score: 80,
        metrics: { movement: 80, coordination: 78 },
        trackingQuality: {
          validFrames: 100,
          totalFrames: 100,
          trackingRatio: 1.0,
          isValid: true,
        },
      }),
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.storage === 'mongodb' || data.storage === 'in-memory');
    assert.equal(typeof data.persisted, 'boolean');
  });
});
