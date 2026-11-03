# 03 — Codebase File & Directory Map

This document provides a comprehensive inventory of all source files, configurations, assets, and test fixtures in the NeuroGuard AI repository.

---

## 1. Root Directory

| Path | Type | Purpose | Key Exports / Contents | Dependencies | Relationship & Usage |
|---|---|---|---|---|---|
| `README.md` | Documentation | Hackathon project overview, architecture diagram, and quickstart commands. | Project mission, architecture diagram, run commands. | None | Developer onboarding documentation. Outdated in parts (mentions OpenAI; current code uses Gemini). |
| `CLAUDE.md` | Documentation | Historical instructions and notes for Claude Code. | Commands, in-memory state summary, seeded accounts. | None | Contextual developer notes. References older unauthenticated architecture before commit `8370fe2`. |
| `AGENTS.md` | Documentation / Rules | Comprehensive rules and behavioral constraints for AI coding agents. | Core mission, safety rules, Gemini rules, Git rules. | None | High-priority agent instructions defining development boundaries. |
| `START_HERE.md` | Documentation | Hackathon quickstart checklist for judges and developers. | Step-by-step startup instructions. | None | Fast manual verification guide. |
| `THIRD_PARTY.md` | Documentation | Attribution and license notes for open-source reference projects. | MIT references (sumitsahoo, RomeoCoding). | None | Compliance and intellectual property documentation. |
| `.gitignore` | Configuration | Git exclusion rules. | Excludes `node_modules/`, `dist/`, `.env`, logs, etc. | Git | Working tree hygiene. Preserves `.env.example`. |
| `.agents/rules/` | Configuration / Rules | Specialized agent instructions for sub-domains. | `backend.md`, `frontend.md`, `security.md`, `testing.md`. | None | Granular rule specifications for backend, frontend, security, and tests. |

---

## 2. Backend Subsystem (`backend/`)

### Configuration & Package Files
| Path | Type | Purpose | Key Exports / Contents | Dependencies | Relationship & Usage |
|---|---|---|---|---|---|
| `backend/package.json` | Configuration | NPM package definition and execution scripts. | Scripts: `start`, `dev`, `test`. | Express, Mongoose, bcryptjs, JWT, cors, dotenv, nodemon. | Manifest for the Node.js backend. Defines Node 20+ native test runner script. |
| `backend/package-lock.json` | Configuration | Exact dependency lockfile. | Deterministic dependency tree. | NPM | Ensures identical dependency versions across installs. |
| `backend/.env.example` | Configuration | Template for environment configuration. | `PORT`, `NODE_ENV`, `MONGODB_URI`, `JWT_SECRET`, `GEMINI_API_KEY`, `GEMINI_MODEL`. | None | Copied to `.env` during local setup. Exposes no secrets. |

### Source Modules (`backend/src/`)
| Path | Type | Purpose | Key Exports / Contents | Dependencies | Relationship & Usage |
|---|---|---|---|---|---|
| `backend/src/server.js` | Production Code | Main Express server, route definitions, error handling. | `app` (Express instance), `_sanitizeFindings`. | Express, CORS, bcryptjs, local models, services, store. | Core backend entry point (737 lines). Registers all 18 API routes, handles JWT auth, links assignments. |
| `backend/src/db.js` | Production Code | MongoDB connection lifecycle manager. | `connectDB`, `isMongoConnected`, `disconnectDB`. | Mongoose | Manages MongoDB connection with 4s timeout. Enables in-memory fallback if connection fails. |
| `backend/src/store.js` | Production Code | In-memory database store, seed data, and demo scenarios. | `users`, `assessments`, `patients`, `alerts`, `credentials`, `assignments`. | bcryptjs | Active runtime data store. Holds 7 seed assessments for Raj Kumar, 3 patient summaries, and demo credentials. |
| `backend/src/trendEngine.js` | Production Code | Mathematical engine for personal baselines and trends. | `mean`, `deviation`, `classify`, `buildTrend`, `personalBaseline`, `detectPersistentDecline`, `buildDashboard`, `createAlert`. | None | Pure algorithmic module. Calculates moving 5-session baseline, deviation percentage, and alert triggers. |
| `backend/src/middleware/auth.js` | Production Code | Authentication and role-based access control middleware. | `generateToken`, `verifyToken`, `authenticateToken`, `requireRole`, `requireSelfOrDoctor`. | jsonwebtoken, `store.js` | Secures protected endpoints. Enforces patient data isolation and clinician oversight permissions. |
| `backend/src/services/geminiService.js` | Production Code | Gemini AI integration and local deterministic fallback. | `generateExplanation`, `buildLocalExplanation`, `formatDiagnosticMessage`. | Node native `fetch` | Sanitizes findings, constructs prompt, calls Google Gemini API, and provides safe local fallback text. |

### Database Models (`backend/src/models/`)
| Path | Type | Purpose | Key Exports / Contents | Dependencies | Relationship & Usage |
|---|---|---|---|---|---|
| `backend/src/models/User.js` | Production Code | Mongoose schema for user accounts. | Mongoose Model `User` (`id`, `name`, `email`, `passwordHash`, `role`, `doctorId`, etc.). | Mongoose | Persists patient, doctor, and caregiver accounts when MongoDB is connected. |
| `backend/src/models/Assessment.js` | Production Code | Mongoose schema for completed movement sessions. | Mongoose Model `Assessment` (`id`, `userId`, `assignmentId`, `score`, `metrics`, `trackingQuality`). | Mongoose | Persists recorded assessment sessions and tracking quality metadata. |
| `backend/src/models/Assignment.js` | Production Code | Mongoose schema for clinician-prescribed protocols. | Mongoose Model `Assignment` (`id`, `doctorId`, `patientId`, `exerciseType`, `status`, `doctorNotes`). | Mongoose | Persists assignments and doctor review feedback. |
| `backend/src/models/Alert.js` | Production Code | Mongoose schema for longitudinal recovery alerts. | Mongoose Model `Alert` (`id`, `userId`, `severity`, `type`, `reason`, `action`). | Mongoose | **Dormant / Unused Model:** Imported in `server.js` line 12, but never written to or queried. Alerts are handled in memory. |

### Automated Tests (`backend/test/`)
| Path | Type | Purpose | Key Exports / Contents | Dependencies | Relationship & Usage |
|---|---|---|---|---|---|
| `backend/test/auth.test.js` | Test Code | Integration tests for authentication and authorization. | 11 tests verifying login, signup, JWT protection, and patient isolation. | `node:test`, `node:assert`, `server.js` | Executed via `npm test`. Validates security boundaries. |
| `backend/test/assignments.test.js` | Test Code | End-to-end integration tests for doctor assignment workflow. | 15 tests verifying protocol creation, tracking quality rejection, session linking, and review. | `node:test`, `node:assert`, `server.js` | Executed via `npm test`. Validates assignment lifecycle. |
| `backend/test/geminiService.test.js` | Test Code | Unit and integration tests for AI explanation engine. | 34 tests covering local fallback, error diagnostics, prompt safety, and live Gemini verification. | `node:test`, `node:assert`, `geminiService.js` | Executed via `npm test`. Validates prompt rules and fallback logic. |
| `backend/test/trendEngine.test.js` | Test Code | Unit tests for mathematical trend formulas. | 6 tests verifying mean, deviation, classification bands, moving baseline, and persistent decline. | `node:test`, `node:assert`, `trendEngine.js` | Executed via `npm test`. Validates clinical deviation bands. |

---

## 3. Frontend Subsystem (`frontend/`)

### Configuration & Entry Points
| Path | Type | Purpose | Key Exports / Contents | Dependencies | Relationship & Usage |
|---|---|---|---|---|---|
| `frontend/package.json` | Configuration | Frontend NPM manifest and build scripts. | Scripts: `dev`, `build`, `preview`. | React 19, MediaPipe, Recharts, Lucide, Vite. | Frontend manifest and build definitions. |
| `frontend/package-lock.json` | Configuration | Exact dependency lockfile. | Deterministic dependency tree. | NPM | Ensures identical frontend library versions. |
| `frontend/vite.config.js` | Configuration | Vite compiler configuration. | React plugin setup, strict port 5173. | `@vitejs/plugin-react`, `vite` | Configures build and HMR development server. |
| `frontend/index.html` | Asset / Entry | HTML entry point for the single-page application. | Root DOM container `#root`, viewport, font imports. | None | Vite HTML host document. |
| `frontend/src/main.jsx` | Production Code | React application bootstrap. | Mounts `<App />` into `#root` with `StrictMode`. | React, ReactDOM, `app.css` | Entry point executed by browser. |
| `frontend/src/App.jsx` | Production Code | Main application shell, state coordinator, and router. | Top-level component `<App />`. Manages user session, role, active view, and toast notifications. | Lucide icons, pages, components, `api.js`, `demoData.js` | Orchestrates views (`dashboard`, `assessment`, `progress`, `doctor`, `caregiver`, `settings`). |

### Libraries & Utilities (`frontend/src/lib/`)
| Path | Type | Purpose | Key Exports / Contents | Dependencies | Relationship & Usage |
|---|---|---|---|---|---|
| `frontend/src/lib/api.js` | Production Code | Centralized REST client with automatic JWT attachment. | `api` object (18 API methods), `setAuthToken`, `getAuthToken`, `clearAuthToken`. | Native `fetch`, `window.sessionStorage` | Handles all network communication with backend. Dispatches `neuroguard:unauthorized` event on 401. |
| `frontend/src/lib/demoData.js` | Production Code | Fallback demonstration data and seeded user constants. | `DEMO_USER_ID`, `DEMO_CAREGIVER_ID`, `fallbackDashboard`, `fallbackTrends`, `fallbackAlerts`. | None | Used for offline demonstration resilience when the backend is unreachable. |
| `frontend/src/lib/pose.js` | Production Code | MediaPipe initialization and skeleton canvas drawing. | `createPoseLandmarker`, `drawSkeleton`, `LANDMARKS`, `angle`, `midpoint`, `visiblePoint`. | `@mediapipe/tasks-vision` | Loads local WASM and `.task` model. Draws 14 anatomical connections on canvas. |
| `frontend/src/lib/scoring.js` | Production Code | Movement feature extraction and exercise scoring logic. | `armRaiseFrame`, `buildArmRaiseSession`, `sitToStandFrame`, `buildSitToStandSession`, `seatedReachFrame`, `buildSeatedReachSession`. | `pose.js` | Derives ROM, symmetry, extension, stability, path efficiency, and repetition counts. |

### Application Pages (`frontend/src/pages/`)
| Path | Type | Purpose | Key Exports / Contents | Dependencies | Relationship & Usage |
|---|---|---|---|---|---|
| `frontend/src/pages/LoginPage.jsx` | Production Code | Authentication page for sign-in and registration. | `<LoginPage />`, quick-demo credential buttons. | `api.js`, `Logo.jsx`, Lucide | Rendered when `authUser` is null. Handles login/signup toggle. |
| `frontend/src/pages/PatientDashboard.jsx` | Production Code | Primary patient home screen. | `<PatientDashboard />`. Renders score ring, metrics, assigned protocols, AI explanation, and alerts. | MetricCard, ScoreRing, TrendChart, AlertCard, `api.js` | Central patient interface. Requests AI explanation and displays clinician feedback. |
| `frontend/src/pages/AssessmentPage.jsx` | Production Code | Assessment staging, protocol instructions, and camera coordinator. | `<AssessmentPage />`. Handles exercise selection, clinician banner, tracking validation. | `CameraAssessment.jsx`, Lucide | Bridges prescription instructions with live camera tracking. |
| `frontend/src/pages/DoctorPage.jsx` | Production Code | Clinician oversight dashboard and assignment manager. | `<DoctorPage />`, `<PatientDetail />`. | TrendChart, AlertCard, `api.js`, Lucide | Clinician interface for patient triage, protocol creation, and session review. |
| `frontend/src/pages/CaregiverPage.jsx` | Production Code | Simplified caregiver monitoring interface. | `<CaregiverPage />`, `<PatientRow />`. | TrendChart, Lucide | High-level status overview for family caregivers. |
| `frontend/src/pages/ProgressPage.jsx` | Production Code | Longitudinal historical trend analysis. | `<ProgressPage />`. Renders 21-day timeline, stats strip, and session cards. | TrendChart, Lucide | Extended historical view for patient recovery trajectory. |
| `frontend/src/pages/SettingsPage.jsx` | Production Code | Patient data privacy choices and non-diagnostic boundaries. | `<SettingsPage />`, `<SettingRow />`. | Lucide | Transparently communicates data minimization practices. |

### UI Components (`frontend/src/components/`)
| Path | Type | Purpose | Key Exports / Contents | Dependencies | Relationship & Usage |
|---|---|---|---|---|---|
| `frontend/src/components/CameraAssessment.jsx` | Production Code | Webcam loop, MediaPipe detector execution, live canvas overlay. | `<CameraAssessment />`. Controls camera start/stop/finish, elapsed timer, live rep estimate. | `pose.js`, `scoring.js`, Lucide | Executes the 30 fps video loop and passes results to `AssessmentPage`. |
| `frontend/src/components/Topbar.jsx` | Production Code | Header navigation, storage health indicator, profile toggle. | `<Topbar />`. Displays MongoDB connection status chip and logout button. | Lucide | Header across all application pages. |
| `frontend/src/components/Sidebar.jsx` | Production Code | Role-specific sidebar navigation. | `<Sidebar />`. Dynamically renders nav items based on user role; includes "Load decline demo" button. | `Logo.jsx`, Lucide | Main navigation bar. |
| `frontend/src/components/TrendChart.jsx` | Production Code | Reactive longitudinal line chart. | `<TrendChart />`, `<TooltipContent />`. | Recharts (`LineChart`, `Line`, `ResponsiveContainer`) | Visualizes recovery scores across time. |
| `frontend/src/components/AlertCard.jsx` | Production Code | Visual card for explainable alerts. | `<AlertCard />`, `<StableCard />`. | Lucide | Renders clinical attention alerts and stable baseline cards. |
| `frontend/src/components/MetricCard.jsx` | Production Code | Tile displaying individual metric value and percentage change. | `<MetricCard />`. Renders icon, value, and positive/negative trend arrow. | Lucide | Visualizes Movement, Balance, Coordination, and Speech. |
| `frontend/src/components/ScoreRing.jsx` | Production Code | Circular SVG progress ring. | `<ScoreRing />`. Animates functional score (0-100) with baseline delta. | None (Pure SVG) | Hero metric visualizer on patient dashboard. |
| `frontend/src/components/Logo.jsx` | Production Code | Application brand logo. | `<Logo />`. Renders stylized brain shield SVG and wordmark. | Lucide | Branding asset. |

### Public Assets (`frontend/public/`)
| Path | Type | Purpose | Size | Relationship & Usage |
|---|---|---|---|---|
| `frontend/public/models/pose_landmarker_lite.task` | Asset (Binary) | MediaPipe Pose Landmarker Lite neural network model. | 5.78 MB | Loaded on-demand by `createPoseLandmarker` in `pose.js`. |
| `frontend/public/mediapipe/wasm/vision_wasm_internal.wasm` | Asset (WASM) | WebAssembly runtime for MediaPipe vision tasks. | 11.15 MB | Vision task computation engine. |
| `frontend/public/mediapipe/wasm/vision_wasm_module_internal.wasm` | Asset (WASM) | Modular WebAssembly runtime. | 11.15 MB | Alternative WASM loader module. |
| `frontend/public/mediapipe/wasm/vision_wasm_nosimd_internal.wasm` | Asset (WASM) | Fallback WebAssembly runtime for non-SIMD browsers. | 10.48 MB | High-compatibility fallback for older CPU hardware. |
| `frontend/public/mediapipe/wasm/*.js` | Asset (JS) | WebAssembly JavaScript glue code. | ~322 KB each | Emscripten bridge linking JS with WASM binaries. |

---

## 4. Disconnected, Dormant, or Redundant Files

1. **`backend/src/models/Alert.js` (Dormant Model):**  
   - Schema defined and compiled via Mongoose.
   - Imported in `backend/src/server.js` line 12 (`const Alert = require('./models/Alert');`).
   - **Never used anywhere in the codebase.** Alerts are generated dynamically via `trendEngine.createAlert` and stored in an in-memory `Map` (`alerts` in `store.js`).
2. **`POST /api/speech/analyze` in `server.js` (Disconnected Route):**  
   - Backend route and logic are fully operational (lines 619-643).
   - Client wrapper exists in `frontend/src/lib/api.js` line 78 (`speechAnalyze`).
   - **Never called by any React component.** Speech functionality in `PatientDashboard.jsx` is represented only as an optional checklist label.
3. **`CaregiverPage.jsx` Hardcoded View (Partially Disconnected State):**  
   - Although `api.caregiverPatients` fetches real patients for the caregiver, the right-hand detail card in `CaregiverPage.jsx` hardcodes the title `"Raj Kumar"` and `"Movement is up 10% versus the recent baseline"`. Clicking "View" on other patients does not switch the detail view.
