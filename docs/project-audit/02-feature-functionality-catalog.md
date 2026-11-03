# 02 — Feature & Functionality Catalog

This catalog documents every feature and capability discovered in the NeuroGuard AI repository. Each feature is audited against actual source code, route registrations, schemas, and test execution evidence.

---

## Master Feature Matrix

| ID | Feature Name | Intended Role | UI Surface | Backend Route(s) | Status | Test Coverage |
|---|---|---|---|---|---|---|
| **F-01** | User Authentication (Login/Signup) | Patient, Doctor, Caregiver | `LoginPage.jsx` | `POST /api/auth/login`, `POST /api/auth/signup` | **IMPLEMENTED AND VERIFIED BY TEST** | `backend/test/auth.test.js` (5 tests) |
| **F-02** | Role-Based Access Control (RBAC) | All Roles | `App.jsx`, `Sidebar.jsx`, `Topbar.jsx` | Express middleware (`auth.js`) | **IMPLEMENTED AND VERIFIED BY TEST** | `backend/test/auth.test.js` (6 tests) |
| **F-03** | Patient Dashboard & Score Ring | Patient | `PatientDashboard.jsx` | `GET /api/users/:id/dashboard` | **IMPLEMENTED AND VERIFIED BY TEST** | `backend/test/auth.test.js`, `trendEngine.test.js` |
| **F-04** | Personal Baseline & Trend Calculation | Patient, Doctor, Caregiver | `PatientDashboard.jsx`, `ProgressPage.jsx`, `TrendChart.jsx` | `GET /api/users/:id/trends`, `trendEngine.js` | **IMPLEMENTED AND VERIFIED BY TEST** | `backend/test/trendEngine.test.js` (6 tests) |
| **F-05** | On-Device MediaPipe Movement Capture | Patient | `CameraAssessment.jsx`, `AssessmentPage.jsx` | Pure Client (`lib/pose.js`, `@mediapipe/tasks-vision`) | **IMPLEMENTED, BUT NOT END-TO-END VERIFIED** | Manual camera required; no automated browser tests |
| **F-06** | Exercise Kinematic Feature Extraction | Patient | `CameraAssessment.jsx` | Client (`lib/scoring.js`) | **PARTIALLY IMPLEMENTED** (Arm raise rep bug in post-session) | No unit tests for `scoring.js` |
| **F-07** | Tracking Quality Validation | Patient | `AssessmentPage.jsx` | `POST /api/assessments` | **IMPLEMENTED AND VERIFIED BY TEST** | `backend/test/assignments.test.js` (2 tests) |
| **F-08** | Assessment Submission & Normalization | Patient | `AssessmentPage.jsx` | `POST /api/assessments` | **IMPLEMENTED AND VERIFIED BY TEST** | `backend/test/assignments.test.js` (3 tests) |
| **F-09** | Doctor Assessment Protocol Assignment | Doctor | `DoctorPage.jsx` (`PatientDetail`) | `POST /api/assignments`, `GET /api/patients/:patientId/assignments` | **IMPLEMENTED AND VERIFIED BY TEST** | `backend/test/assignments.test.js` (3 tests) |
| **F-10** | Patient Assignment Retrieval & Execution | Patient | `PatientDashboard.jsx`, `AssessmentPage.jsx` | `GET /api/patients/:patientId/assignments`, `PATCH /api/assignments/:id/status` | **IMPLEMENTED AND VERIFIED BY TEST** | `backend/test/assignments.test.js` (3 tests) |
| **F-11** | Doctor Session Review & Feedback | Doctor | `DoctorPage.jsx` | `PATCH /api/assignments/:id/status` (status: `reviewed`) | **IMPLEMENTED AND VERIFIED BY TEST** | `backend/test/assignments.test.js` (2 tests) |
| **F-12** | Explainable Alerts Engine | Patient, Doctor, Caregiver | `AlertCard.jsx`, `PatientDashboard.jsx`, `DoctorPage.jsx` | `GET /api/alerts/:id`, `trendEngine.createAlert` | **IMPLEMENTED AND VERIFIED BY TEST** | `backend/test/trendEngine.test.js` |
| **F-13** | Gemini AI Recovery Explanation | Patient, Doctor | `PatientDashboard.jsx`, `DoctorPage.jsx` | `POST /api/explanation`, `geminiService.js` | **IMPLEMENTED AND VERIFIED BY TEST** | `backend/test/geminiService.test.js` (34 tests) |
| **F-14** | Deterministic Local Explanation Fallback | Patient, Doctor | `PatientDashboard.jsx`, `DoctorPage.jsx` | `geminiService.buildLocalExplanation` | **IMPLEMENTED AND VERIFIED BY TEST** | `backend/test/geminiService.test.js` (9 tests) |
| **F-15** | Doctor Patient Roster Prioritization | Doctor | `DoctorPage.jsx` | `GET /api/doctors/:id/patients` | **IMPLEMENTED AND VERIFIED BY TEST** | `backend/test/auth.test.js`, `assignments.test.js` |
| **F-16** | Caregiver Patient Overview | Caregiver | `CaregiverPage.jsx` | `GET /api/caregivers/:id/patients` | **PARTIALLY IMPLEMENTED** | Route tested; UI uses hardcoded patient trend |
| **F-17** | Hackathon Demo Decline Scenario | Judge / Presenter | `Sidebar.jsx` ("Load decline demo") | `POST /api/users/:id/demo-decline` | **MOCKED OR SIMULATED** | Working simulation, injects synthetic assessments |
| **F-18** | Storage Mode Health & Topbar Indicator | All Roles | `Topbar.jsx` | `GET /api/health` | **IMPLEMENTED AND VERIFIED BY TEST** | Verified via test assertion & build |
| **F-19** | Speech Analysis Endpoint | Disconnected | None (Checklist shows "Optional") | `POST /api/speech/analyze` | **DISCONNECTED OR UNUSED** | Route works in backend; zero frontend callers |

---

## Deep-Dive Feature Specifications

### F-01: User Authentication (Login & Signup)
- **User Problem:** Securing patient rehabilitation data and separating patient, doctor, and caregiver access.
- **Intended Role:** All roles (Patient, Doctor, Caregiver).
- **UI Location:** `frontend/src/pages/LoginPage.jsx`. Accessible at initial load when no session exists.
- **Frontend Entry:** `LoginPage.jsx` handles form state, quick-fill demo buttons, and submits via `api.login` or `api.signup` (`frontend/src/lib/api.js`).
- **Backend Implementation:** `backend/src/server.js` (`/api/auth/login` lines 50-84, `/api/auth/signup` lines 86-142).
- **Database / Models:** In-memory `credentials` array in `backend/src/store.js`; asynchronous persistence to `backend/src/models/User.js`.
- **Security & Algorithms:** Passwords hashed with `bcryptjs` (salt rounds: 10). Authentication creates signed JWT tokens (`jsonwebtoken`, 7-day expiration) signed with `JWT_SECRET`.
- **Inputs:** Email string, password string (min 8 chars), name string, role (`patient`, `doctor`, `caregiver`).
- **Outputs:** HTTP 200/201 returning `{ user: { id, name, role, ... }, token: "Bearer ..." }`.
- **Error Handling:** 400 for validation errors, 401 for incorrect credentials, 409 for duplicate email.
- **Status:** **IMPLEMENTED AND VERIFIED BY TEST** (`backend/test/auth.test.js`).

---

### F-05: On-Device MediaPipe Movement Capture
- **User Problem:** Tracking physical movement safely at home without exposing raw video to internet eavesdropping or external servers.
- **Intended Role:** Patient.
- **UI Location:** `frontend/src/pages/AssessmentPage.jsx` embedding `frontend/src/components/CameraAssessment.jsx`.
- **Frontend Entry:** User clicks "Start today’s check" or "Start Assigned Protocol". Camera initializes upon clicking "Start camera check".
- **Backend Implementation:** None. Zero video or pixel data leaves the browser.
- **Models & Assets Used:**
  - `frontend/public/models/pose_landmarker_lite.task` (5.78 MB TensorFlow Lite model).
  - `frontend/public/mediapipe/wasm/` (WASM binaries: SIMD, No-SIMD, Module versions).
- **Algorithms:** `createPoseLandmarker` (`frontend/src/lib/pose.js`) attempts GPU delegate via WebGL; falls back to CPU on failure. Extracts 33 pose landmarks at 30 fps. Renders real-time visual skeleton overlay on HTML5 canvas with turquoise connection lines.
- **Error & Fallback:** Clear browser permission error if webcam is denied (`CircleAlert` overlay).
- **Status:** **IMPLEMENTED, BUT NOT END-TO-END VERIFIED** (Verified via code analysis and asset validation; requires physical webcam for live end-to-end execution).

---

### F-06: Exercise Kinematic Feature Extraction & Scoring
- **User Problem:** Quantifying movement quality (range of motion, bilateral symmetry, smoothness, repetitions) into an understandable score (0-100).
- **Intended Role:** Patient.
- **Implementation:** `frontend/src/lib/scoring.js` and `frontend/src/components/CameraAssessment.jsx`.
- **Supported Exercises:**
  1. **Arm Raise (`arm_raise`):**
     - Measures: Left/right wrist elevation relative to shoulders, bilateral symmetry, elbow extension angle.
     - Formula: Elevation $= \text{clamp}((Y_{\text{shoulder}} - Y_{\text{wrist}}) \times 120 + 50, 0, 100)$.
     - Score Formula: $\text{Score} = 0.38 \times \text{rangeScore} + 0.27 \times \text{symmetry} + 0.20 \times \text{movementQuality} + 0.15 \times \text{repScore}$.
     - **Observed Quirk / Bug:** In `buildArmRaiseSession` (lines 58-65 of `scoring.js`), rep counting checks `Date.now() - lastPeak > 700`. Because this executes inside a tight synchronous loop across all frames post-session, `Date.now()` is constant, causing the counter to never exceed 1 rep in the finalized session score!
  2. **Sit-to-Stand (`sit_to_stand`):**
     - Measures: Bilateral knee angle ($\text{angle}(Hip, Knee, Ankle)$) and trunk elevation.
     - Rep Counter: State machine transitions between `standing` (knee $>155^\circ$) and `sit` (knee $<105^\circ$) with a 20-frame cooldown.
     - Score Formula: $\text{Score} = 0.45 \times \text{repScore} + 0.35 \times \text{rangeScore} + 0.20 \times \text{stability}$.
  3. **Seated Reach (`seated_reach`):**
     - Measures: Euclidean distance between shoulder midpoint and wrist midpoint.
     - Score Formula: $\text{Score} = 0.40 \times \text{movementQuality} + 0.35 \times \text{pathEfficiency} + 0.25 \times \text{repScore}$.
- **Status:** **PARTIALLY IMPLEMENTED** (Kinematics and live UI rep counting work; post-session arm raise repetition loop contains timing bug).

---

### F-07: Tracking Quality Validation
- **User Problem:** Preventing false clinical progress reports when a camera is obstructed, lighting is poor, or the patient is outside the frame.
- **Intended Role:** Patient & Clinician safety.
- **UI Location:** `frontend/src/pages/AssessmentPage.jsx` (displays red banner when tracking is insufficient).
- **Backend Implementation:** `backend/src/server.js` lines 460-466 in `POST /api/assessments`.
- **Validation Logic:** If `trackingQuality.isValid === false` or `trackingQuality.validFrames < 5`, the backend rejects submission with HTTP 400: `"Assessment rejected: insufficient valid body tracking frames detected"`.
- **Status:** **IMPLEMENTED AND VERIFIED BY TEST** (`backend/test/assignments.test.js`).

---

### F-08 & F-10: Assessment Protocol Assignment & Completion Workflow
- **User Problem:** Clinicians need to prescribe specific exercises with customized repetition targets and clinical instructions rather than leaving recovery to unguided self-checks.
- **Intended Role:** Doctor creates; Patient completes; Doctor reviews.
- **API Endpoints:**
  - `POST /api/assignments`: Clinician creates protocol (`exerciseType`, `instructions`, `targetReps`, `dueDate`).
  - `GET /api/patients/:patientId/assignments`: Retrieves assigned, in-progress, completed, and reviewed protocols.
  - `POST /api/assessments`: Patient submits completed session with `assignmentId`. Links session, updates assignment to `completed`.
  - `PATCH /api/assignments/:id/status`: Clinician submits clinical feedback (`doctorNotes`) and updates status to `reviewed`.
- **Status Transitions:** `assigned` $\rightarrow$ `in_progress` $\rightarrow$ `completed` $\rightarrow$ `reviewed`. (Also supports `cancelled` and `expired`).
- **Database / Models:** `backend/src/models/Assignment.js` and in-memory `assignments` array in `store.js`.
- **Status:** **IMPLEMENTED AND VERIFIED BY TEST** (Comprehensive 15-test workflow suite in `backend/test/assignments.test.js`).

---

### F-13 & F-14: Gemini AI Recovery Explanation & Local Fallback Engine
- **User Problem:** Stroke survivors find numerical scores and kinematic angles confusing; they need clear, non-diagnostic rehabilitation observations explaining what their change means.
- **Intended Role:** Patient & Doctor.
- **Backend Implementation:** `backend/src/services/geminiService.js` and `backend/src/server.js` (`POST /api/explanation`).
- **Pipeline:**
  1. Frontend inspects dashboard data and sends only measured metrics with `measured: true` and non-null changes.
  2. `sanitizeFindings` on backend strictly filters inputs: whitelists `trend`, `movement_change`, `balance_change`, `speech_change`, `baseline_sessions`, and truncates `details` to 500 characters.
  3. `generateExplanation` queries Gemini (`models/gemini-3.5-flash-lite:generateContent`) via HTTPS POST using `x-goog-api-key`.
  4. System prompt enforces strict non-diagnostic boundaries: prohibition against diagnosing, prescribing, or mentioning unmeasured metrics.
  5. If Gemini times out (15s), returns HTTP error (401, 404, 429), or no API key is provided, `buildLocalExplanation` generates deterministic, clinically safe observation text.
- **UI Source Badging:** UI displays `Gemini AI`, `Local Fallback`, or `Personal Baseline Engine` badge based on response `.source`.
- **Status:** **IMPLEMENTED AND VERIFIED BY TEST** (34 unit & integration tests in `backend/test/geminiService.test.js`).

---

### F-17: Hackathon Demo Decline Scenario
- **User Problem:** Demonstrating persistent decline alerts to hackathon judges without waiting 3 weeks for a patient to decline.
- **Intended Role:** Judge / Presenter.
- **UI Location:** `frontend/src/components/Sidebar.jsx` ("Load decline demo" button).
- **Backend Implementation:** `backend/src/server.js` (`POST /api/users/:id/demo-decline` lines 570-615).
- **Operation:** Injects 5 synthetic declining sessions (`score: 81, 79, 75, 71, 68`), creates a persistent deviation alert, and sets patient status to `review`.
- **Status:** **MOCKED OR SIMULATED** (Fully functional demo tool, but unauthenticated endpoint).

---

### F-19: Speech Analysis Endpoint
- **User Problem:** Analyzing speech cadence, pause count, and pronunciation similarity for post-stroke dysarthria monitoring.
- **Intended Role:** Planned for Patient.
- **Backend Implementation:** `backend/src/server.js` lines 619-643 (`POST /api/speech/analyze`).
- **Algorithms:** Jaccard set similarity across tokenized strings; words per minute calculation.
- **Frontend Status:** Defined in `frontend/src/lib/api.js` line 78 (`speechAnalyze`), but **zero UI components invoke this function**. `PatientDashboard.jsx` displays `Speech assessment · Optional · ~30 sec` as static text without microphone recording capabilities.
- **Status:** **DISCONNECTED OR UNUSED**.
