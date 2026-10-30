# 06 — API Endpoint Reference

This document provides a comprehensive reference for all 18 registered HTTP endpoints in the NeuroGuard AI backend (`backend/src/server.js`).

---

## Endpoint Summary Table

| Method | Path | Auth Required | Roles Permitted | Ownership / Relationship Scope | Database Mutation |
|---|---|---|---|---|---|
| `GET` | `/api/health` | No | Public | None | None |
| `POST` | `/api/auth/login` | No | Public | None | None |
| `POST` | `/api/auth/signup` | No | Public | None | Appends User in Memory & Mongo |
| `GET` | `/api/users/:id/dashboard` | **Yes (JWT)** | `patient`, `doctor`, `caregiver` | Patient: self only; Doctor: assigned patients | Reads in-memory store |
| `GET` | `/api/users/:id/assessments` | **Yes (JWT)** | `patient`, `doctor`, `caregiver` | Patient: self only; Doctor: assigned patients | Reads in-memory store |
| `GET` | `/api/users/:id/trends` | **Yes (JWT)** | `patient`, `doctor`, `caregiver` | Patient: self only; Doctor: assigned patients | Reads in-memory store |
| `GET` | `/api/alerts/:id` | **Yes (JWT)** | `patient`, `doctor`, `caregiver` | Patient: self only; Doctor: assigned patients | Reads in-memory store |
| `GET` | `/api/caregivers/:id/patients` | **Yes (JWT)** | `caregiver`, `doctor` | Caregiver ID must exist | Reads in-memory store |
| `GET` | `/api/doctors/:id/patients` | **Yes (JWT)** | `doctor` | Doctor ID must match authenticated user | Reads in-memory store |
| `POST` | `/api/assignments` | **Yes (JWT)** | `doctor` | Doctor can only assign to own/unassigned patients | Writes Assignment in Memory & Mongo |
| `GET` | `/api/patients/:patientId/assignments` | **Yes (JWT)** | `patient`, `doctor` | Patient: self only; Doctor: assigned patient | Reads in-memory store |
| `GET` | `/api/assignments/:id` | **Yes (JWT)** | `patient`, `doctor` | Patient: self; Doctor: assigned patient | Reads in-memory store |
| `PATCH` | `/api/assignments/:id/status` | **Yes (JWT)** | `patient`, `doctor` | Patient: self (in_progress); Doctor: creator (review/cancel) | Updates Assignment in Memory & Mongo |
| `GET` | `/api/doctors/:id/assignments` | **Yes (JWT)** | `doctor` | Doctor ID must match authenticated user | Reads in-memory store |
| `POST` | `/api/assessments` | **Yes (JWT)** | `patient` | Patient: self only; Rejects doctors/caregivers | Writes Assessment & updates Assignment |
| `POST` | `/api/users/:id/demo-decline` | **No (GAP)** | Public (Unauthenticated) | None (Mutates targeted user ID) | Injects 5 assessments in Memory |
| `POST` | `/api/speech/analyze` | No | Public | None (Stateless math utility) | None |
| `POST` | `/api/explanation` | **No (GAP)** | Public (Unauthenticated) | None | Calls Google Gemini API / Fallback |

---

## Detailed Endpoint Specifications

### 1. `GET /api/health`
- **Purpose:** System operational health check and active storage mode indicator.
- **Headers:** None.
- **Response (200 OK):**
  ```json
  {
    "ok": true,
    "service": "neuroguard-backend",
    "database": "connected" | "in-memory",
    "aiService": "gemini" | "local-engine",
    "timestamp": "2026-10-29T09:04:46.000Z"
  }
  ```
- **Test Coverage:** Verified in `assignments.test.js`.

---

### 2. `POST /api/auth/login`
- **Purpose:** Authenticates user credentials and issues a signed JWT.
- **Request Body:**
  ```json
  {
    "email": "raj@neuroguard.demo",
    "password": "patient123"
  }
  ```
- **Validation:** Matches normalized email against `credentials` array; verifies password hash using `bcrypt.compare`.
- **Response (200 OK):**
  ```json
  {
    "user": {
      "id": "user-raj",
      "name": "Raj Kumar",
      "role": "patient",
      "preferredLanguage": "English",
      "caregiverId": "caregiver-anita",
      "doctorId": "doctor-priya"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```
- **Failure Responses:**
  - `401 Unauthorized`: Invalid email or incorrect password.
  - `404 Not Found`: User profile missing.
- **Test Coverage:** `backend/test/auth.test.js`.

---

### 3. `POST /api/auth/signup`
- **Purpose:** Registers a new patient, doctor, or caregiver account.
- **Request Body:**
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "password": "securepassword123",
    "role": "patient"
  }
  ```
- **Validation:** Name required; email format regex check; password minimum length 8; role must be `patient`, `doctor`, or `caregiver`; email uniqueness check.
- **Database Effects:** Appends user to `users` and `credentials` in memory. If `isMongoConnected()`, executes `User.create()`.
- **Response (201 Created):** `{ "user": { ... }, "token": "..." }`.
- **Failure Responses:** `400 Bad Request` (validation failed), `409 Conflict` (email already exists).
- **Test Coverage:** `backend/test/auth.test.js`.

---

### 4. `GET /api/users/:id/dashboard`
- **Purpose:** Computes and returns the patient's functional recovery dashboard.
- **Authentication:** Bearer JWT required (`authenticateToken`).
- **Authorization:** `requireSelfOrDoctor` (Patient can only query their own ID; Doctor can only query assigned patients).
- **Calculation:** `trendEngine.buildDashboard(user, userAssessments)`.
- **Response (200 OK):**
  ```json
  {
    "user": { "id": "user-raj", "name": "Raj Kumar", "role": "patient" },
    "summary": {
      "functionalScore": 79,
      "change": 9.7,
      "trend": "Improving",
      "lastAssessment": "2026-09-21T10:30:00.000Z",
      "exerciseType": "arm_raise"
    },
    "metrics": {
      "Movement": { "value": 82, "change": 10.0, "measured": true },
      "Balance": null,
      "Coordination": { "value": 76, "change": 6.0, "measured": true },
      "Speech": null
    },
    "baseline": {
      "functionalScore": 72,
      "window": 5
    }
  }
  ```
- **Failure Responses:** `401 Unauthorized` (missing/invalid token), `403 Forbidden` (patient accessing another patient's data), `404 Not Found` (user not found).
- **Test Coverage:** `backend/test/auth.test.js`.

---

### 5. `POST /api/assignments`
- **Purpose:** Doctor prescribes a new functional assessment protocol for a patient.
- **Authentication:** Bearer JWT required.
- **Authorization:** `requireRole('doctor')`.
- **Ownership Check:** Verifies patient exists and is assigned to this doctor (or unassigned in demo).
- **Request Body:**
  ```json
  {
    "patientId": "user-raj",
    "exerciseType": "arm_raise",
    "instructions": "Perform 5 slow bilateral arm raises in the morning.",
    "targetReps": 5,
    "startDate": "2026-10-29T10:00:00.000Z",
    "dueDate": "2026-11-05T10:00:00.000Z"
  }
  ```
- **Validation:** Validates exerciseType enum (`arm_raise`, `sit_to_stand`, `seated_reach`); instructions non-empty string; targetReps integer 1-30; dueDate valid and not before startDate.
- **Database Effects:** Appends to in-memory `assignments`. If MongoDB connected, calls `Assignment.create()`.
- **Response (201 Created):** `{ "assignment": { "id": "asgn-...", "status": "assigned", ... } }`.
- **Failure Responses:** `400 Bad Request` (invalid input), `403 Forbidden` (patient assigned to another doctor), `404 Not Found` (patient missing).
- **Test Coverage:** `backend/test/assignments.test.js`.

---

### 6. `GET /api/patients/:patientId/assignments`
- **Purpose:** Retrieves all assigned, in-progress, completed, and reviewed protocols for a patient.
- **Authentication:** Bearer JWT required.
- **Authorization:** Patient can view own assignments; Doctor can view assigned patients.
- **Dynamic Resolution:** Evaluates `resolveAssignmentStatus()`: if `dueDate` has passed and status is `assigned` or `in_progress`, dynamically resolves status to `expired`. Resolves linked `completedSession` details.
- **Response (200 OK):**
  ```json
  [
    {
      "id": "asgn-seed-1",
      "doctorId": "doctor-priya",
      "patientId": "user-raj",
      "exerciseType": "arm_raise",
      "instructions": "Perform 5 slow, bilateral arm raises in the morning.",
      "targetReps": 5,
      "status": "assigned",
      "completedSession": null,
      "doctorNotes": "",
      "dueDate": "2026-11-03T10:30:00.000Z"
    }
  ]
  ```
- **Test Coverage:** `backend/test/assignments.test.js`.

---

### 7. `PATCH /api/assignments/:id/status`
- **Purpose:** Manages assignment lifecycle transitions and records doctor review notes.
- **Authentication:** Bearer JWT required.
- **State Machine Transitions:**
  - `assigned` $\rightarrow$ `in_progress`: Permitted by Patient or Doctor.
  - Any $\rightarrow$ `cancelled`: Permitted only by assigning Doctor.
  - `completed` $\rightarrow$ `reviewed`: Permitted only by assigning Doctor; requires optional or mandatory `doctorNotes`. Sets `reviewedAt`.
  - Direct transition to `completed`: Blocked (HTTP 400); completed status is reserved for `/api/assessments` submission.
- **Request Body (Review Example):**
  ```json
  {
    "status": "reviewed",
    "doctorNotes": "Shoulder symmetry improved by 6%. Continue protocol for 3 more days."
  }
  ```
- **Response (200 OK):** `{ "assignment": { ... } }`.
- **Test Coverage:** `backend/test/assignments.test.js`.

---

### 8. `POST /api/assessments`
- **Purpose:** Submits a completed movement assessment session and optionally links it to an assignment.
- **Authentication:** Bearer JWT required.
- **Authorization:** Permitted ONLY for `role === 'patient'` where `req.user.userId === req.body.userId`. Doctors and caregivers cannot submit assessments.
- **Safety Gate (Tracking Quality):**
  ```javascript
  if (quality.isValid === false || quality.validFrames < 5) {
    return res.status(400).json({ message: "Assessment rejected: insufficient valid body tracking frames..." });
  }
  ```
- **Metric Normalization:**
  - `arm_raise`: maps movement = ROM, coordination = symmetry; deletes balance and speech.
  - `sit_to_stand`: maps movement = quality, balance = stability; deletes coordination and speech.
  - `seated_reach`: maps movement = quality, coordination = pathEfficiency; deletes balance and speech.
- **Request Body:**
  ```json
  {
    "userId": "user-raj",
    "exerciseType": "arm_raise",
    "duration": 82,
    "score": 79,
    "metrics": { "rangeOfMotion": 82, "symmetry": 76, "movementQuality": 80 },
    "assignmentId": "asgn-seed-1",
    "trackingQuality": { "validFrames": 150, "totalFrames": 160, "trackingRatio": 0.94, "isValid": true }
  }
  ```
- **Database Effects:** Appends to in-memory `assessments`. Updates linked assignment to `completed` and sets `completedSessionId`. Calls `Assessment.create()` and `Assignment.findOneAndUpdate()` if MongoDB is connected.
- **Response (201 Created):**
  ```json
  {
    "id": "assessment-1730193400000",
    "userId": "user-raj",
    "assignmentId": "asgn-seed-1",
    "score": 79,
    "metrics": { "movement": 82, "coordination": 76 },
    "persisted": false,
    "storage": "in-memory"
  }
  ```
- **Test Coverage:** `backend/test/assignments.test.js`.

---

### 9. `POST /api/explanation`
- **Purpose:** Generates plain-language rehabilitation observations from sanitized session findings.
- **Authentication:** **None (Public GAP)**.
- **Request Body:**
  ```json
  {
    "trend": "improving",
    "movement_change": 10.0,
    "measured_metrics": ["movement"],
    "baseline_sessions": 5,
    "exercise_type": "arm_raise",
    "details": "Functional score: 79/100"
  }
  ```
- **Processing:** Passes through `server._sanitizeFindings()` to strip unmeasured fields; forwards to `geminiService.generateExplanation()`.
- **Response (200 OK):**
  ```json
  {
    "source": "gemini" | "local-fallback" | "local",
    "text": "Recent functional performance is trending upward compared with the personal baseline across the last 5 comparable sessions (movement (+10%))."
  }
  ```
- **Test Coverage:** `backend/test/geminiService.test.js` (34 tests).
