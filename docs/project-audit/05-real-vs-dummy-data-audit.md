# 05 — Real vs. Dummy Data Audit

This report is an exhaustive provenance and integrity audit of every data point, metric, score, credentials record, and historical log across the NeuroGuard AI repository. It establishes where real sensory and database data is used, where synthetic or hardcoded values are substituted, and where fallback logic can potentially mislead users.

---

## 1. Master Data Provenance Inventory

The following table catalogs every significant data point across the frontend, backend, test suite, and storage layers:

| Data Category | Exact File Path | Code Location | Data Source | Transformation / Calculation | Consumer | Runtime Condition | Persistence | Production Impact | Confidence |
|---|---|---|---|---|---|---|---|---|---|
| **REAL INPUT** | `frontend/src/components/CameraAssessment.jsx` | Lines 54-80 | Device Webcam (`getUserMedia`) | Frame pixels processed by MediaPipe Vision | `detectForVideo()` | Whenever camera check is started | None (volatile RAM only) | Real physical movement measurement | Verified |
| **REAL INPUT** | `frontend/src/lib/scoring.js` | Lines 13-38 (`armRaiseFrame`) | MediaPipe 33 Landmarks | Angle math, wrist/shoulder elevation delta | `buildArmRaiseSession` | Per-frame during active camera check | None (frames array) | Real kinematic joint angles | Verified |
| **REAL INPUT** | `frontend/src/pages/LoginPage.jsx` | Lines 25-45 | User Form Input | Trimmed, lowercased, password string | `POST /api/auth/login` | During sign-in / registration | Memory & Mongo if connected | Real credentials | Verified |
| **DERIVED** | `frontend/src/lib/scoring.js` | Lines 67-74 | Valid frame array | Weighted sum of ROM, symmetry, extension, reps | `onComplete(sessionResult)` | Upon clicking "Finish" | Posted to `/api/assessments` | Real derived movement score (0-100) | Verified |
| **DERIVED** | `backend/src/trendEngine.js` | Lines 25-30 (`personalBaseline`) | Assessment records array | Mean of last 5 prior sessions | `buildDashboard`, `createAlert` | On dashboard/trend request | Derived on demand | True patient baseline | Verified |
| **DERIVED** | `backend/src/trendEngine.js` | Lines 38-48 (`buildDashboard`) | Historical assessments | Latest vs baseline delta percentage | Patient / Doctor UI | On `/api/users/:id/dashboard` | Derived on demand | Relative functional change | Verified |
| **SYNTHETIC** | `backend/src/store.js` | Lines 3-23 (`days` array) | Hardcoded array in code | Maps 7 static days to score, movement, balance, speech | `assessments` array | Seed data for `user-raj` | In-memory `store.js` | Appears as Raj Kumar's 21-day history | Verified |
| **SYNTHETIC** | `backend/src/store.js` | Lines 25-31 (`users`) | Static object literals | Pre-seeded user records | `GET /api/users/:id/dashboard` | Default server state | In-memory `store.js` | Seed users: Raj, Anita, Mohan, Priya | Verified |
| **SYNTHETIC** | `backend/src/store.js` | Lines 33-37 (`patients`) | Static array literals | Pre-seeded clinical triage statuses | `GET /api/doctors/:id/patients` | Default server state | In-memory `store.js` | Pre-calculated scores and changes | Verified |
| **SYNTHETIC** | `backend/src/store.js` | Lines 42-59 (`asgn-seed-1`) | Static assignment object | Pre-seeded protocol for Raj Kumar | `GET /api/patients/:id/assignments` | Default server state | In-memory `store.js` | Pre-existing prescribed protocol | Verified |
| **SYNTHETIC** | `backend/src/server.js` | Lines 570-615 (`demo-decline`) | Static template `[81, 79, 75, 71, 68]` | Generates 5 synthetic assessments 1 day apart | Triggered by "Load decline demo" | In-memory `assessments` & `alerts` | Injects synthetic decline trajectory | Verified |
| **HARDCODED FALLBACK** | `frontend/src/pages/PatientDashboard.jsx` | Lines 108-111 | Static JSX defaults | Nullish coalescing: `?? 82`, `?? 71`, `?? 76`, `?? 84` | Rendered metric cards | When backend returns `null` for unmeasured metric | None (UI render only) | **CRITICAL:** Displays fake values for unmeasured metrics | Verified |
| **HARDCODED CONSTANT** | `frontend/src/lib/demoData.js` | Lines 4-38 (`fallbackDashboard`) | Hardcoded JS object | Static fallback values (Score: 79, Change: 9.7%) | `App.jsx` state | When backend API is unreachable | Client memory | Prevents UI crash during network outage | Verified |
| **HARDCODED CONSTANT** | `frontend/src/lib/demoData.js` | Lines 26-34 (`fallbackTrends`) | Hardcoded 7-day array | Static recovery trend | `App.jsx` state | When backend API is unreachable | Client memory | Renders offline demonstration chart | Verified |
| **HARDCODED CONSTANT** | `frontend/src/pages/DoctorPage.jsx` | Lines 11-15 (`DEFAULT_INSTRUCTIONS`) | Static text strings | Pre-written clinical instructions | Assignment creation modal | When doctor selects exercise type | None | Pre-populates clinical text area | Verified |
| **SIMULATED** | `frontend/src/pages/AssessmentPage.jsx` | Lines 27-33 (`trackingQuality`) | Ternary evaluation in JS | Checks `score > 0 && duration >= 3` | `POST /api/assessments` | On session completion | Sent in request payload | Synthesizes 150/160 valid frames heuristic | Verified |
| **FALLBACK** | `backend/src/services/geminiService.js` | Lines 16-65 (`buildLocalExplanation`) | Deterministic string templates | Formats rule-based text from findings object | `POST /api/explanation` | When GEMINI_API_KEY missing or API fails | Client render | Safe, non-hallucinating fallback text | Verified |
| **MOCKED TEST** | `backend/test/geminiService.test.js` | Lines 240-340 | Mocked fetch responses | Simulates HTTP 401, 404, 429, timeouts, malformed JSON | `generateExplanation()` | Test runner only | None | Verifies fallback error resilience | Verified |

---

## 2. Detailed Trace of Key Dashboard Cards & Charts

### Trace A: Patient Dashboard Score Ring
```text
Data Source: In-memory assessments array in backend/src/store.js (or newly posted live assessment)
    │
    ▼
API Handler: GET /api/users/:id/dashboard (server.js:146)
    │
    ▼
Transformation: trendEngine.buildDashboard()
    - Extracts latest assessment score: current = latest.score (e.g., 79)
    - Extracts prior <= 5 assessments: baseline = personalBaseline(prior, 'score', 5) (e.g., 72)
    - Computes change = (current - baseline) / baseline (e.g., +9.7%)
    │
    ▼
Network Payload: { summary: { functionalScore: 79, change: 9.7, trend: "Improving" } }
    │
    ▼
React State: App.jsx -> setDashboard(results[0]) -> passed to PatientDashboard.jsx
    │
    ▼
Rendered Output: <ScoreRing score={79} change={9.7} />
    - SVG circle strokeDashoffset dynamically computed: circumference - (79/100) * circumference
    - Renders "79 / 100", "↑ 9.7% vs baseline"
```
**Provenance Verdict:** **Real Computed Data** based on session history. If the backend is offline, falls back to `fallbackDashboard` in `demoData.js`.

---

### Trace B: Patient Dashboard Individual Metric Cards (Movement, Balance, Coordination, Speech)
```text
Data Source: latest assessment metrics object in store.js
    │
    ▼
API Handler: trendEngine.buildDashboard()
    - Evaluates metric('movement'): raw = latest.metrics.movement -> if null return null
    - If patient completed an 'arm_raise', server.js stripped 'balance' and 'speech'!
    - Return payload: { metrics: { Movement: { value: 82, change: 10, measured: true }, Balance: null, Coordination: { value: 76, change: 6, measured: true }, Speech: null } }
    │
    ▼
React Component: PatientDashboard.jsx (Lines 108-111)
    - <MetricCard label="Movement" value={metrics.Movement?.value ?? 82} ... /> -> Renders 82 (Real)
    - <MetricCard label="Balance" value={metrics.Balance?.value ?? 71} change={metrics.Balance?.change ?? 4} ... />
      --> CRITICAL AUDIT FINDING: metrics.Balance is null!
      --> Nullish coalescing ?? evaluates to default: Renders value 71, change +4%!
    - <MetricCard label="Speech" value={metrics.Speech?.value ?? 84} change={metrics.Speech?.change ?? 0} ... />
      --> metrics.Speech is null!
      --> Nullish coalescing ?? evaluates to default: Renders value 84, change 0%!
```
> [!WARNING]
> **Audit Finding (Data Fabrication in UI):** When an exercise like `arm_raise` is completed, the backend correctly sets unmeasured domains (`Balance`, `Speech`) to `null`. However, `PatientDashboard.jsx` lines 108-111 use the nullish coalescing operator (`??`) to substitute hardcoded numbers (`82`, `71`, `76`, `84`) and changes (`10%`, `4%`, `6%`, `0%`). The user is presented with plausible-looking balance and speech numbers despite no such measurements having taken place!

---

### Trace C: Longitudinal Trend Chart (`TrendChart.jsx`)
```text
Data Source: assessments array in store.js (filtered by userId)
    │
    ▼
API Handler: GET /api/users/:id/trends -> trendEngine.buildTrend()
    - Sorts assessments by timestamp ascending
    - Maps each assessment to:
      { day: "D1", date: "Sep 01", score: 70, movement: 68, balance: 64, coordination: 69, speech: 82 }
    │
    ▼
React Component: App.jsx -> setTrends() -> ProgressPage / PatientDashboard
    │
    ▼
Rendered Output: <TrendChart data={trends} />
    - Recharts <LineChart> plots SVG polyline for dataKey="score"
```
**Provenance Verdict:** **Real Data Path**, but initial values reflect the pre-seeded 7-day scenario in `store.js`. When a patient completes a real live camera assessment, it appends a real `D8` point to this chart.

---

### Trace D: AI Explanation Card
```text
Data Source: PatientDashboard.jsx useEffect lines 38-78
    │
    ▼
Transformation 1 (Client Sanitization):
    - Inspects dashboard.metrics
    - Only pushes to measured_metrics if metric.measured === true and change !== null
    - For an arm_raise session: sends { trend: "improving", movement_change: 10, measured_metrics: ["movement"], baseline_sessions: 5 }
    │
    ▼
API Handler: POST /api/explanation -> server._sanitizeFindings()
    - Strips any field not in measured_metrics
    - Validates trend enum
    │
    ▼
Provider Service: geminiService.generateExplanation()
    - If GEMINI_API_KEY is configured: Calls Google Gemini API
    - If API key is missing or fails: Calls buildLocalExplanation()
    │
    ▼
Rendered Output:
    - Text: "Recent functional performance is trending upward compared with the personal baseline across the last 5 comparable sessions (movement (+10%))."
    - Badge: "Gemini AI" (if live) or "Local Fallback" / "Personal Baseline Engine"
```
**Provenance Verdict:** **Grounded Derived Data.** The input payload strictly reflects measured metrics. If Gemini responds, the text is LLM-generated; otherwise, it is deterministically generated from code templates.

---

## 3. Verification of Specific Audit Questions

### 1. Can dashboard values be fabricated when metrics are missing?
**YES (CONFIRMED).** As proven in Trace B, `PatientDashboard.jsx` lines 108-111 use `?? 71` and `?? 84` to render fake balance and speech numbers when the backend returns `null`.

### 2. Can a trend be displayed without comparable prior sessions?
**YES, but with explicit disclosure.** When a patient has only 1 assessment, `buildTrend` displays a single `D1` point. In `buildDashboard`, `baseline.window` is set to `0`. `PatientDashboard.jsx` displays the caption: `"Initial reference session (establishing baseline)"`.

### 3. Can an initial session be described as clinically stable?
**NO.** `buildLocalExplanation` in `geminiService.js` explicitly checks `if (baselineSessions === 0 || baselineSessions === null)` and returns:  
`"This session has been recorded as your initial reference point. NeuroGuard will begin tracking meaningful changes once more comparable sessions are available."`

### 4. Do doctor dashboards use real patient-specific data?
**YES.** `DoctorPage.jsx` fetches data directly via `api.doctorPatients(doctor.id)`. When clicking on a patient, `loadPatientData()` queries `/api/users/:id/dashboard`, `/api/users/:id/trends`, and `/api/patients/:id/assignments` for that specific patient's ID.

### 5. Can a patient see data belonging to another patient?
**NO.** Backend route `/api/users/:id/dashboard` and `/api/patients/:patientId/assignments` enforce `requireSelfOrDoctor` middleware. If `req.user.role === 'patient'` and `req.user.userId !== req.params.id`, the backend rejects the request with HTTP 403 Forbidden.

### 6. Can a successful save notification appear when MongoDB persistence failed?
**YES.** When an assessment is submitted, if MongoDB is disconnected, the server saves it to volatile in-memory storage and returns HTTP 201 with `storage: "in-memory"`. `App.jsx` line 92 displays: `"Session recorded. (Session mode · held in temporary memory)"`. While this informs the user, it is still reported as a successful session recording.

### 7. Is a local fallback explanation ever incorrectly labeled as Gemini-generated?
**NO.** `geminiService.js` explicitly tags responses:
- `source: 'gemini'` only when HTTP 200 is received and candidate text is extracted.
- `source: 'local-fallback'` on any API failure or timeout.
- `source: 'local'` when `GEMINI_API_KEY` is not provided.
The frontend directly checks `explanation.source === 'gemini'` before displaying the "Gemini AI" badge.

### 8. Can a Gemini response reference unmeasured domains?
**PROBABILISTICALLY MINIMAL, BUT NOT IMPOSSIBLE.** The server-side prompt explicitly states:  
`"STRICT RULES: 1. Only describe metrics that are explicitly listed in 'Measured Deviations' below. Do NOT mention movement, balance, speech, or any other metric that is absent from that list."`  
However, because the server does not post-filter the raw text string returned by Gemini, an LLM hallucination could theoretically bypass this instruction.

### 9. Are demo credentials or sample records available in production builds?
**YES.** `LoginPage.jsx` contains static `DEMO_ACCOUNTS` array with `raj@neuroguard.demo` / `patient123`, `anita@neuroguard.demo` / `caregiver123`, and `priya@neuroguard.demo` / `doctor123`. These quick-fill buttons are compiled into the production bundle.

### 10. Do in-memory records disappear after a server restart?
**YES.** Because the primary operational store is `backend/src/store.js`, any assessment recorded or user registered during server execution is lost upon process termination or restart. Even if MongoDB is connected, the backend does not load documents from MongoDB on startup.
