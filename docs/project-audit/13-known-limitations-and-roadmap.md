# 13 — Known Limitations & Technical Roadmap

This report categorizes all discovered technical debt, architectural bottlenecks, algorithmic defects, and security risks into an actionable, prioritized engineering roadmap.

---

## 1. Prioritized Findings Matrix

| Priority | Reference | Category | Summary of Issue | Affected Component | Required Remediation Action |
|---|---|---|---|---|---|
| **P0** | **ALG-01** | Algorithmic Defect | Arm raise repetition counter in post-session processing evaluates `Date.now() - lastPeak > 700` in a synchronous loop, capping final rep count to 1. | `frontend/src/lib/scoring.js` (Lines 58-65) | Replace `Date.now()` with frame timestamp delta `(frame.at - lastPeak > 700)`. |
| **P1** | **SEC-01** | Security / Auth Gap | `POST /api/users/:id/demo-decline` lacks authentication middleware. Any unauthenticated caller can overwrite patient history and alerts. | `backend/src/server.js` (Line 570) | Wrap endpoint with `authenticateToken` and `requireRole('doctor')` or restrict to `NODE_ENV === 'development'`. |
| **P1** | **SEC-02** | Security / Abuse Risk | `POST /api/explanation` lacks authentication middleware, exposing Gemini API quota to unauthenticated denial of service. | `backend/src/server.js` (Line 721) | Add `authenticateToken` middleware to `/api/explanation`. |
| **P1** | **DAT-01** | Data Integrity / UI | `PatientDashboard.jsx` nullish coalescing renders hardcoded fake numbers (`82`, `71`, `76`, `84`) for unmeasured metrics. | `frontend/src/pages/PatientDashboard.jsx` (Lines 108-111) | Check `metrics.Domain?.measured` before rendering; render `"—"` or `"Not Measured"` when null. |
| **P2** | **ARC-01** | Architecture / Persistence | Server reads 100% of queries from in-memory arrays. MongoDB writes are never hydrated back on restart, causing data loss upon reboot. | `backend/src/server.js`, `store.js`, `db.js` | Implement startup hydration from MongoDB into memory or convert GET endpoints to query Mongoose models. |
| **P2** | **SEC-03** | Security / Secret Mgmt | Hardcoded fallback for `JWT_SECRET` allows token forgery if environment variable is missing. | `backend/src/middleware/auth.js` (Line 3) | Fail fast on server startup if `JWT_SECRET` is unset in production. |
| **P2** | **UI-01** | UI Disconnect | `CaregiverPage.jsx` patient detail card hardcodes Raj Kumar's name and trend. Clicking "View" on Anita or Mohan does not change the card. | `frontend/src/pages/CaregiverPage.jsx` | Bind detail card to a `selectedPatient` state variable updated by the "View" button. |
| **P2** | **ALG-02** | CV Buffer Limit | `CameraAssessment.jsx` caps `framesRef` buffer at 450 frames (15s). Exercises taking longer than 15s discard earlier repetitions. | `frontend/src/components/CameraAssessment.jsx` (Line 91) | Increase buffer cap or compute running summary statistics instead of dropping raw frames. |
| **P3** | **TST-01** | Test Coverage | Zero frontend automated tests and zero unit tests for `scoring.js`. | `frontend/src/lib/scoring.js` | Add `vitest` to frontend and unit test joint kinematics and rep counters. |
| **P3** | **FEAT-01** | Dead Code Cleanup | `POST /api/speech/analyze` is fully implemented on backend, but completely unused by frontend. | `backend/src/server.js`, `frontend/src/lib/api.js` | Either build a microphone recording modal in `PatientDashboard` or remove the dead endpoint. |
| **P3** | **PERF-01** | Bundle Optimization | Single frontend JS chunk is 835 kB (larger than Vite's 500 kB recommendation). | `frontend/vite.config.js` | Configure `build.rollupOptions.output.manualChunks` to split `@mediapipe` and `recharts` into separate vendor chunks. |

---

## 2. Deep-Dive on Highest-Priority Issues

### P0-01: Fix Arm Raise Post-Session Repetition Counter
- **Root Cause:** In `frontend/src/lib/scoring.js`:
  ```javascript
  let lastPeak = 0;
  for (const frame of valid) {
    const peak = frame.averageElevation;
    if (state === 'down' && peak >= 78 && Date.now() - lastPeak > 700) {
      state = 'up';
      lastPeak = Date.now();
    } else if (state === 'up' && peak <= 55) {
      reps += 1;
      state = 'down';
    }
  }
  ```
- **Remediation:** In `CameraAssessment.jsx`, each frame already stores its timestamp: `{ ...frame, at: Date.now() }`.
  Update `buildArmRaiseSession` to evaluate frame timestamps:
  ```javascript
  let lastPeak = 0;
  for (const frame of valid) {
    const peak = frame.averageElevation;
    const frameTime = frame.at || 0;
    if (state === 'down' && peak >= 78 && frameTime - lastPeak > 700) {
      state = 'up';
      lastPeak = frameTime;
    } else if (state === 'up' && peak <= 55) {
      reps += 1;
      state = 'down';
    }
  }
  ```
  *Note:* As mandated by audit instructions, no files were modified during this audit; this remediation should be applied by the developer before demo day.

---

### P1-01: Secure Unauthenticated Endpoints
- **Root Cause:** In `backend/src/server.js`:
  - Line 570: `app.post('/api/users/:id/demo-decline', (req, res) => { ... })`
  - Line 721: `app.post('/api/explanation', async (req, res) => { ... })`
- **Remediation:** Insert `authenticateToken` middleware:
  ```javascript
  app.post('/api/users/:id/demo-decline', authenticateToken, requireRole('doctor'), (req, res) => { ... });
  app.post('/api/explanation', authenticateToken, async (req, res) => { ... });
  ```

---

### P1-02: Eliminate Fake Metric Display on Patient Dashboard
- **Root Cause:** In `frontend/src/pages/PatientDashboard.jsx` lines 108-111:
  ```jsx
  <MetricCard label="Balance" value={metrics.Balance?.value ?? 71} change={metrics.Balance?.change ?? 4} icon={Scale} />
  <MetricCard label="Speech" value={metrics.Speech?.value ?? 84} change={metrics.Speech?.change ?? 0} icon={Mic2} />
  ```
- **Remediation:** Update `MetricCard` to accept a `measured` prop or pass `null`:
  ```jsx
  <MetricCard 
    label="Balance" 
    value={metrics.Balance?.measured ? metrics.Balance.value : '—'} 
    change={metrics.Balance?.measured ? metrics.Balance.change : null} 
    icon={Scale} 
  />
  ```

---

## 3. Clinical & Regulatory Boundary Statement

1. **Non-Diagnostic Device Framing:** NeuroGuard AI is currently an investigational software prototype designed to support motor recovery tracking. It has not received 510(k) clearance from the US FDA, CE mark approval under EU MDR, or CDSCO validation.
2. **Clinical Decision Making:** Automated deviation flags, baseline calculations, and Gemini AI observations must be presented to clinicians strictly as assistive, non-binding telemetry. Clinical diagnosis, discharge planning, and medication changes must remain under the sole discretion of licensed healthcare providers.
3. **Threshold Calibration:** The prototype deviation thresholds ($\le 5\%$ Normal, $\le 10\%$ Monitor, $\le 15\%$ Significant, $> 15\%$ Review) are engineering heuristics established for demonstration; they require rigorous multi-center clinical validation before being claimed as clinically verified thresholds.
