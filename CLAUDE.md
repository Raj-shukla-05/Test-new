# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

NeuroGuard AI is a hackathon prototype for stroke-recovery functional monitoring. Two independent npm projects (no root package.json, no tests, no linter configured):

- `backend/` — Express 4 API (CommonJS), port 5000
- `frontend/` — React 19 + Vite 6 SPA (ESM), port 5173 (`strictPort: true`)

## Commands

Backend (`cd backend`): `npm install`, `cp .env.example .env`, `npm run dev` (nodemon) or `npm start`.
Frontend (`cd frontend`): `npm install`, `npm run dev`, `npm run build`, `npm run preview`.

Frontend talks to `http://localhost:5000/api` unless `VITE_API_BASE_URL` is set. Camera needs a secure context (localhost is fine; use Chrome/Edge).

## Architecture

**Backend is in-memory only.** `backend/src/store.js` holds seeded `users`, `assessments`, `patients`, `alerts` as module-level data; state resets on restart. `mongoose` and `MONGODB_URI` are listed but not used anywhere. `server.js` defines all routes inline; `trendEngine.js` is the pure logic:
- baseline = mean of the last ≤5 prior assessments; `classify` buckets % deviation (≤5 normal, ≤10 monitor, ≤15 significant, else review)
- `detectPersistentDecline`: last 3 sessions all below baseline and mean < 95% of it → "review" alert
- `buildDashboard` / `buildTrend` / `createAlert` derive everything on request from the assessments array.
- `POST /api/assessments` normalizes `arm_raise` metrics into the `movement/balance/coordination/speech` shape the engine reads (speech defaults to 84).
- `POST /api/users/:id/demo-decline` injects 5 declining sessions and mutates `patients`/`alerts` for the judge demo. `POST /api/explanation` uses OpenAI if `OPENAI_API_KEY` is set, otherwise (or on error) a deterministic local text.

**Frontend** (`App.jsx`) is a single-page app with no router: `role` (patient/caregiver) and `view` state pick the page in `pages/`. It hard-codes `DEMO_USER_ID` / `DEMO_CAREGIVER_ID` from `lib/demoData.js` and falls back to the bundled `fallback*` data when the API is unreachable. All API calls go through `lib/api.js`.

**Login / sign-up (demo auth, not real security).** `POST /api/auth/login` and `POST /api/auth/signup` check/append the plaintext `credentials` list in `store.js` (signup validates name, email, password ≥ 8 chars, role patient|caregiver|doctor; 409 on duplicate email) and return `{ user }` — no token, other endpoints are unprotected. New patients are also pushed onto `patients` and start with no assessments (score 0). `App.jsx` gates everything behind `pages/LoginPage.jsx` (sign-in/sign-up toggle) and stores the user in `sessionStorage` (`neuroguard.user`); `role` picks the initial view and Topbar logout clears it. Patients fetch/save under their own id (`activeUserId` in `App.jsx`); caregivers still view the seeded `DEMO_USER_ID`. `api.js` errors carry `.status` and the server's `message`. The Topbar profile chip toggles patient/caregiver for the demo (disabled for doctors). Seeded accounts: `raj@neuroguard.demo` / `patient123`, `anita@neuroguard.demo` / `caregiver123`, `priya@neuroguard.demo` / `doctor123` (doctor). Replace with hashed passwords + tokens before any real use.

**Doctor panel.** Third role `doctor` (seeded `doctor-priya`). `GET /api/doctors/:id/patients` returns every entry in `patients` plus a session count (404 unless the id is a doctor). `pages/DoctorPage.jsx` fetches that list itself (not via `App.jsx` state), shows status counts, name search, status filter chips, rows sorted review → monitor → stable, and a detail card that loads `trends` + `alerts` for the selected patient. Doctors only get the "All patients" sidebar item. `homeView`/`roleOf` in `App.jsx` map a user's role to its landing view.

**Pose pipeline runs fully in the browser (no video leaves the client):** `lib/pose.js` creates the MediaPipe `PoseLandmarker` (GPU delegate, CPU fallback) from locally served assets — WASM in `public/mediapipe/wasm` and model in `public/models/pose_landmarker_lite.task` (do not switch to CDN URLs). `lib/scoring.js` turns landmarks into per-frame metrics (ROM, symmetry, control, rep counting) per exercise (arm raise, sit-to-stand, seated reach); `components/CameraAssessment.jsx` drives the camera/overlay loop and the result is posted to `/api/assessments`.

## Notes

- Thresholds are prototype values, not clinically validated; the product is framed as non-diagnostic. Keep the LLM prompt and UI copy within that framing.
- `backend/.env` exists locally; never commit it or print its contents.
- Third-party code attribution/licensing constraints are in `THIRD_PARTY.md` (some reviewed repos had no license, so their code must not be copied).
