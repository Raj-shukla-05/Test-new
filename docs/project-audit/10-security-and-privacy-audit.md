# 10 — Security & Privacy Audit

This report evaluates authentication security, authorization boundaries, object-level isolation (BOLA/IDOR), cryptographic integrity, data minimization, and external API privacy across the NeuroGuard AI platform.

---

## 1. Verified Security Controls

1. **Password Hashing:** Implemented with `bcryptjs` using a cost factor of 10 (`bcrypt.hash(password, 10)`). Seed passwords in `store.js` are hashed via `bcrypt.hashSync`. Plaintext passwords are not stored in memory.
2. **Stateless JWT Authentication:** Implemented via `jsonwebtoken` (`HS256`, 7-day expiration). Tokens encapsulate `userId`, `role`, `name`, and `email`.
3. **Patient Object-Level Isolation (BOLA Prevention):** Protected routes (`/api/users/:id/dashboard`, `/api/users/:id/assessments`, `/api/users/:id/trends`, `/api/alerts/:id`) enforce `requireSelfOrDoctor` middleware. If a patient attempts to access another patient's identifier, the backend returns HTTP 403 Forbidden. Verified by automated tests.
4. **Doctor Oversight Scope:** Clinicians can only view patients assigned to their clinician ID. Unassigned patients are visible for demonstration triage, but patients assigned to another doctor return HTTP 403.
5. **Assessment Submission Role Restriction:** `/api/assessments` strictly enforces that only users with `role === 'patient'` may submit sessions, and the `userId` in the payload must strictly match the token's `userId`. Doctors and caregivers cannot forge patient assessment sessions.
6. **Edge Privacy & Data Minimization:** Web camera frames are processed exclusively in browser volatile RAM. No image frames, canvas captures, or audio files are ever written to local storage, transmitted over HTTP, or persisted to a database.
7. **Gemini Data Sanitization:** Zero personally identifiable information (PII) is transmitted to Google Gemini. The prompt contains only numerical deviation percentages, session window counts, and exercise type strings.

---

## 2. Vulnerability & Findings Matrix

| Ref ID | Severity | Category | Affected File & Line | Exploit / Failure Scenario | Remediation Recommendation | Status |
|---|---|---|---|---|---|---|
| **SEC-01** | **High** | Broken Authentication | `backend/src/server.js` (Line 570) | `POST /api/users/:id/demo-decline` has **no authentication middleware**. Any unauthenticated attacker can POST to this endpoint and inject 5 fake declining assessments, create critical alerts, and mutate patient records for any target user ID. | Add `authenticateToken` and `requireRole('doctor')` or restrict to `NODE_ENV === 'development'`. | **Confirmed Vulnerability** |
| **SEC-02** | **High** | Unauthenticated Resource Abuse | `backend/src/server.js` (Line 721) | `POST /api/explanation` has **no authentication middleware**. Anyone on the internet can flood this endpoint, triggering expensive Google Gemini API calls, exhausting API quotas, and causing denial of service. | Add `authenticateToken` middleware to `/api/explanation`. | **Confirmed Vulnerability** |
| **SEC-03** | **High** | Cryptographic Weakness | `backend/src/middleware/auth.js` (Line 3) | If `process.env.JWT_SECRET` is unset, code defaults to a hardcoded string (`'neuroguard-dev-fallback-secret-2026'`). An attacker knowing this public default can forge valid doctor/patient JWT tokens. | Crash server on startup if `JWT_SECRET` is missing in production. | **Confirmed Vulnerability** |
| **SEC-04** | **Medium** | Data Integrity / Misleading UI | `frontend/src/pages/PatientDashboard.jsx` (Lines 108-111) | Nullish coalescing (`?? 82`, `?? 71`, `?? 76`, `?? 84`) renders hardcoded fake numbers for unmeasured metrics when backend returns `null`. | Render `"—"` or `"Not Measured"` when metric is null instead of static numbers. | **Confirmed Vulnerability** |
| **SEC-05** | **Medium** | Overly Permissive CORS | `backend/src/server.js` (Line 18) | `app.use(cors({ origin: true }))` reflects the incoming `Origin` header, permitting cross-origin credentialed requests from any third-party malicious website. | Specify an explicit whitelist (e.g., `http://localhost:5173`, production domain). | **Confirmed Finding** |
| **SEC-06** | **Medium** | Asymmetric Persistence Data Loss | `backend/src/server.js` (Lines 120-132, 552-557) | Data written to MongoDB is **never hydrated back into memory** on startup. Stopping and restarting the backend server erases all user registrations and live assessments. | Add a startup hydration function to load records from MongoDB into memory. | **Confirmed Finding** |
| **SEC-07** | **Medium** | Missing Rate Limiting | `backend/src/server.js` | No rate limiting middleware on `/api/auth/login`, `/api/auth/signup`, or `/api/explanation`. Vulnerable to brute-force credential stuffing. | Integrate `express-rate-limit` on authentication and AI endpoints. | **Confirmed Finding** |
| **SEC-08** | **Low** | Public Demo Accounts in Bundle | `frontend/src/pages/LoginPage.jsx` (Lines 6-10) | Seed demo credentials (`raj@neuroguard.demo`, `patient123`, etc.) are hardcoded into the client JavaScript bundle. | Gate demo login buttons behind an environment flag (`VITE_ENABLE_DEMO_LOGIN`). | **Confirmed Finding** |
| **SEC-09** | **Low** | Long Token Lifetimes | `backend/src/middleware/auth.js` (Line 6) | Tokens expire in 7 days (`expiresIn: '7d'`) without refresh token rotation or revocation lists. Stolen tokens remain valid for a week. | Implement short-lived access tokens (15m) with HTTP-only refresh cookies. | **Confirmed Finding** |
| **SEC-10** | **Low** | Legacy Plaintext Password Check | `backend/src/server.js` (Line 64) | `else if (match.password) isPasswordValid = match.password === password;` allows plaintext password checks for legacy or test users. | Remove plaintext fallback completely; mandate bcrypt hash for all accounts. | **Confirmed Finding** |

---

## 3. Detailed Finding Analyses

### Finding SEC-01: Unprotected Demo Decline Route
- **Code Location:** `backend/src/server.js` lines 570-615:
  ```javascript
  // --- Scenario Simulation Endpoint ---
  app.post('/api/users/:id/demo-decline', (req, res) => {
    const userId = req.params.id;
    const template = [81, 79, 75, 71, 68];
    template.forEach((score, index) => {
      // Injects 5 assessments into memory...
    });
    alerts.set(userId, [{ ... }]);
    // Mutates patient triage status to 'review'
  ```
- **Analysis:** Notice that unlike `/api/users/:id/dashboard` or `/api/assignments`, there is **no `authenticateToken` middleware**. An unauthenticated HTTP request:
  `curl -X POST http://localhost:5000/api/users/user-raj/demo-decline`
  will immediately succeed, corrupting Raj Kumar's longitudinal assessment history and forcing his clinical triage badge to "Review Recommended".

---

### Finding SEC-02: Public AI Explanation Endpoint
- **Code Location:** `backend/src/server.js` lines 721-726:
  ```javascript
  app.post('/api/explanation', async (req, res) => {
    const raw = req.body || {};
    const findings = sanitizeFindings(raw.findings ?? raw);
    const explanation = await generateExplanation(findings);
    res.json(explanation);
  });
  ```
- **Analysis:** This endpoint is completely unauthenticated. Anyone can send arbitrary JSON findings to `/api/explanation`. The backend will invoke `generateExplanation()`, which issues an outbound HTTPS POST to Google's Gemini API with the backend's private API key. This exposes the operator to quota exhaustion and potential API billing spikes.

---

### Finding SEC-03: Hardcoded JWT Fallback Secret
- **Code Location:** `backend/src/middleware/auth.js` lines 3-7:
  ```javascript
  const JWT_SECRET = process.env.JWT_SECRET || 'neuroguard-dev-fallback-secret-2026';

  function generateToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  }
  ```
- **Analysis:** If a deployment forgets to populate `JWT_SECRET` in `.env`, the server boots with the hardcoded fallback string. An attacker inspecting this open-source repository can forge a JWT with:
  `{ "userId": "doctor-priya", "role": "doctor" }` signed using `'neuroguard-dev-fallback-secret-2026'` and gain full administrative access to all patient records.

---

## 4. Privacy & Data Minimization Audit

### Video & Audio Handling
- **Webcam:** Video streams are passed directly to an in-memory HTML5 `<video>` element. MediaPipe processes frames via WebGL textures.
- **Persistence:** Neither the browser nor the server contains any code capable of writing video files to IndexedDB, LocalStorage, or disk.
- **Data Minimization Rating:** **EXCELLENT (10/10).** Fully adheres to HIPAA / GDPR privacy-by-design standards regarding biometric video capture.

### External AI Privacy (Google Gemini)
- **PII Leakage Check:** Inspected prompt generation in `geminiService.js`.
  - Patient names: **NOT INCLUDED**
  - Patient ages: **NOT INCLUDED**
  - Patient emails: **NOT INCLUDED**
  - Clinician names: **NOT INCLUDED**
- **Data Transmitted:** Strictly anonymous kinematic deltas (e.g., `Movement Deviation: +10%`, `Baseline Comparison Sessions Available: 5`).
- **Privacy Rating:** **EXCELLENT (10/10).** No protected health information (PHI) is exposed to the foundation model provider.
