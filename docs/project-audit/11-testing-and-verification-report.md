# 11 — Testing & Verification Report

This report documents the verification commands executed during this audit, automated test coverage, external API testing, and unverified edge cases.

---

## 1. Automated Test Execution Evidence

During this audit, the backend automated test suite was executed in the workspace using Node's native test runner (`node --test test/**/*.test.js`).

### Command Output Summary

```text
> neuroguard-backend@1.0.0 test
> node --test test/**/*.test.js

▶ Doctor-Patient Assessment Assignment Workflow Tests
  ✔ Doctor successfully assigns an assessment to authorized patient (10.47ms)
  ✔ Assignment creation rejects invalid exercise type or missing instructions (9.91ms)
  ✔ Unauthorized doctor cannot assign work to another doctor's patient (4.26ms)
  ✔ Patient can retrieve their own assignments (7.30ms)
  ✔ Patient is blocked from retrieving another patient's assignments (3.81ms)
  ✔ Patient can transition their assignment from assigned to in_progress (11.28ms)
  ✔ Invalid camera result is not marked as successfully completed (12.89ms)
  ✔ Completed valid session links to assignment and updates status to completed (12.27ms)
  ✔ Invalid status transition is rejected by backend (3.40ms)
  ✔ Doctor can review a completed session with clinical notes (4.24ms)
  ✔ Doctor cannot review or modify an assignment created by another doctor (5.66ms)
  ✔ Invalid tracking quality in self-directed session without assignment is rejected (400) (8.20ms)
  ✔ Patient cannot submit an assessment for another patient ID (403) (3.36ms)
  ✔ Non-patient (doctor) cannot submit camera assessment sessions (403) (2.83ms)
  ✔ Valid assessment response indicates persistence and storage mode truthfully (2.91ms)
✔ Doctor-Patient Assessment Assignment Workflow Tests (827.65ms)

▶ Authentication & Authorization Integration Tests
  ✔ POST /api/auth/login succeeds for seeded patient (315.35ms)
  ✔ POST /api/auth/login succeeds for seeded doctor (122.80ms)
  ✔ POST /api/auth/login fails with invalid password (123.52ms)
  ✔ POST /api/auth/signup validates email format and password length (11.41ms)
  ✔ POST /api/auth/signup successfully registers a new patient (172.49ms)
  ✔ Protected endpoint returns 401 when token is missing (4.56ms)
  ✔ Patient can access their own dashboard (6.28ms)
  ✔ Patient is forbidden (403) from accessing another patient record (5.56ms)
  ✔ Doctor can access patient records and patient list (8.61ms)
  ✔ Doctor cannot access private records of a patient assigned to a different clinician (403) (4.25ms)
  ✔ Patient cannot access doctor patient list (3.24ms)
✔ Authentication & Authorization Integration Tests (780.43ms)

▶ buildLocalExplanation — accuracy and metric specificity
  ✔ first session: returns initial-reference message when baseline_sessions is 0 (2.40ms)
  ✔ first session: returns initial-reference when baseline_sessions is absent (0.45ms)
  ✔ arm_raise only: mentions movement, not balance or speech when those are absent (0.87ms)
  ✔ persistent_decline only mentions measured metrics (0.47ms)
  ✔ persistent_decline with both movement and balance mentions both (0.32ms)
  ✔ improving trend with only movement measured (0.42ms)
  ✔ stable trend cites number of sessions used for comparison (0.38ms)
  ✔ single prior session: does not claim confident improvement or decline (0.60ms)
  ✔ no positive change → does not produce improving label for zero deviations (0.64ms)
✔ buildLocalExplanation — accuracy and metric specificity (12.12ms)

▶ formatDiagnosticMessage — error categorization
  ✔ HTTP 400, 401, 403, 404-model, 404-endpoint, 429, 5xx are correctly categorized (0.95ms)
✔ formatDiagnosticMessage — error categorization (1.45ms)

▶ generateExplanation — mocked: accuracy and source labels
  ✔ source = local when API key is missing (7.31ms)
  ✔ source = gemini on successful API response, with correct header and URL (1.29ms)
  ✔ arm_raise prompt does NOT include balance or speech deviations when absent (3.47ms)
  ✔ no baseline session: prompt includes 0 sessions and model instructed to note initial reference (3.45ms)
  ✔ Gemini generic / unsupported claim: explanation returned as-is with source=gemini (0.61ms)
  ✔ source = local-fallback on HTTP 404 (3.96ms)
  ✔ source = local-fallback on HTTP 401 (4.15ms)
  ✔ source = local-fallback on HTTP 429 (3.77ms)
  ✔ source = local-fallback on AbortError timeout (1.12ms)
  ✔ source = local-fallback on empty candidates array (1.03ms)
  ✔ source = local-fallback on network failure (1.53ms)
  ✔ source = local-fallback on invalid tracking quality (0.75ms)
✔ generateExplanation — mocked: accuracy and source labels (35.66ms)

▶ sanitizeFindings — server-side metric filtering
  ✔ only whitelisted metrics pass through (by measured_metrics list) (1.88ms)
  ✔ trend is validated and defaults to stable for unrecognized values (0.23ms)
  ✔ valid trend values pass through (0.32ms)
  ✔ details are truncated at 500 characters (0.25ms)
  ✔ baseline_sessions is included when numeric (0.23ms)
  ✔ exercise_type is passed through as string (0.21ms)
  ✔ tracking_quality_warning is included when present (1.00ms)
  ✔ when measured_metrics absent, includes metrics only where change value is not null/undefined (0.38ms)
✔ sanitizeFindings — server-side metric filtering (7.91ms)

▶ POST /api/explanation — endpoint integration
  ✔ responds with structured { source, text } for arm_raise findings (3926.17ms)
  ✔ responds with source=local when no API key (missing key env var) (13.14ms)
  ✔ valid source labels: only gemini, local-fallback, or local (2848.03ms)
✔ POST /api/explanation — endpoint integration (6798.78ms)

▶ Gemini Service Live API Verification
  ✔ real API request to verified provider model returns gemini source (3536.27ms)
✔ Gemini Service Live API Verification (3538.18ms)

▶ Trend Engine Unit Tests
  ✔ mean calculates average accurately (2.80ms)
  ✔ deviation calculates relative percentage delta (0.84ms)
  ✔ classify categorizes deviation into clinical monitoring bands (0.44ms)
  ✔ personalBaseline calculates moving window average (0.88ms)
  ✔ detectPersistentDecline identifies 3 consecutive sessions below baseline (0.64ms)
  ✔ buildTrend creates formatted longitudinal data points (27.66ms)
✔ Trend Engine Unit Tests (36.81ms)

======================================================================
TOTAL SUITES: 9 | TOTAL TESTS: 66 | PASSED: 66 | FAILED: 0 | SKIPPED: 0
DURATION: 11,954 ms
======================================================================
```

---

## 2. Frontend Production Build Verification

The frontend production compiler was executed via `npm run build` in `frontend/`:

```text
> neuroguard-frontend@1.0.0 build
> vite build

vite v6.4.3 building for production...
transforming (2218) modules...
✓ 2218 modules transformed.
dist/index.html                   0.57 kB │ gzip:   0.35 kB
dist/assets/index-DrZWF8N4.css   25.64 kB │ gzip:   6.03 kB
dist/assets/index-ByYKZq4J.js   835.03 kB │ gzip: 241.84 kB

(!) Some chunks are larger than 500 kB after minification.
✓ built in 7.93s
```
- **Syntax & Bundling:** 100% successful with zero JSX or syntax errors.
- **Bundle Analysis:** Main JS chunk is 835 kB (241 kB gzip). The bulk of this payload consists of `@mediapipe/tasks-vision` and `recharts` / `d3` dependencies.

---

## 3. Mocked vs. Live Test Verification

| Test Suite / Area | Mocked or Live? | Description & Evidence |
|---|---|---|
| **Auth & RBAC Integration** | Real Local HTTP | Spawns an in-process ephemeral HTTP server (`server.listen(0)`), issues real `fetch` calls, validates JWT signatures and bcrypt passwords. |
| **Assignments Workflow** | Real Local HTTP | Complete real HTTP request chain testing protocol creation, linking, tracking rejection, and clinician review. |
| **Gemini Mocked Tests** | Mocked `global.fetch` | Overrides `global.fetch` to simulate Gemini network failures (HTTP 401, 404, 429, timeouts, empty candidates) to verify that `buildLocalExplanation()` triggers seamlessly. |
| **Gemini Live Verification** | **LIVE External API Call** | Evaluates real `process.env.GEMINI_API_KEY`. Transmitted live request to `generativelanguage.googleapis.com` and received valid `{ source: 'gemini', text: "..." }` in 3,536 ms! |
| **Trend Engine Tests** | Pure Unit Tests | Deterministic mathematical tests with zero I/O or mocking. |

---

## 4. Gaps in Test Coverage & Untested Areas

1. **Frontend Unit & Component Tests:**  
   - There are **zero frontend automated tests** (`vitest` or `jest` is not configured in `frontend/package.json`).
   - Neither React component rendering (`PatientDashboard`, `DoctorPage`) nor state hooks are covered by automated assertions.
2. **Kinematic Scoring Unit Tests (`scoring.js`):**  
   - While `trendEngine.js` has comprehensive unit tests, `frontend/src/lib/scoring.js` has zero unit tests.
   - The arm-raise repetition counter bug (`Date.now() - lastPeak > 700`) was undetected because no unit tests existed for `buildArmRaiseSession()`.
3. **End-to-End Browser & Camera Tests:**  
   - End-to-end browser automation (e.g., Playwright / Cypress with simulated webcam video) is not configured.
   - Camera initialization, WebGL fallback, canvas skeleton rendering, and user permission flows require manual physical verification.
4. **MongoDB Persistence Under Concurrency:**  
   - The test suites run without a live MongoDB connection string (`MONGODB_URI` unset), exercising the in-memory fallback. Multi-process concurrency and DB reconnection dropouts have not been tested with an active MongoDB replica set.
