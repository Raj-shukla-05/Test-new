# 15 — Demo Readiness Checklist & Pre-Flight Runbook

This runbook contains actionable, evidence-based pre-flight checklists for demonstrating NeuroGuard AI to hackathon judges, clinicians, or technical evaluators.

---

## 1. Environment & Pre-Flight Prerequisites

- [x] **Node.js Runtime:** Verified on Node.js v22.21.1 (Engine requires Node v18+).
- [x] **Backend Dependencies:** Installed and verified in `backend/node_modules/`.
- [x] **Frontend Dependencies:** Installed and verified in `frontend/node_modules/`.
- [x] **Local Computer Vision Assets:** Verified present in `frontend/public/`:
  - [x] `public/models/pose_landmarker_lite.task` (5.78 MB).
  - [x] `public/mediapipe/wasm/vision_wasm_internal.wasm` (11.15 MB).
  - [x] `public/mediapipe/wasm/vision_wasm_nosimd_internal.wasm` (10.48 MB).
- [x] **Backend Automated Tests:** 66 / 66 passing across 9 test suites (`npm test` in `backend/`).
- [x] **Frontend Production Build:** Compiles cleanly with zero errors via Vite (`npm run build`).
- [ ] **Google Gemini API Key Configured:** Check that `GEMINI_API_KEY` is present in `backend/.env` if live LLM generation is desired during the demo. (Local fallback will operate if omitted).
- [ ] **MongoDB Connection String (Optional):** Check `MONGODB_URI` in `backend/.env`. (Application operates in resilient session mode if omitted).

---

## 2. Launch Sequence

### Terminal 1: Backend API
```bash
cd backend
npm run dev
```
- [ ] Verify console displays: `NeuroGuard backend running on http://localhost:5000`.
- [ ] Verify console reports database mode: either `Connected successfully to MongoDB` or `Running in resilient in-memory mode`.

### Terminal 2: Frontend App
```bash
cd frontend
npm run dev
```
- [ ] Verify Vite dev server starts on `http://localhost:5173`.
- [ ] Open Google Chrome or Microsoft Edge to `http://localhost:5173`.

---

## 3. Recommended Live Demo Script (Step-by-Step)

### Act I: The Patient Experience (Raj Kumar)
- [ ] **Step 1: Patient Login**
  - Click quick-login button: *"Patient — Raj Kumar"* (or enter `raj@neuroguard.demo` / `patient123`).
  - Point out to judges: Authentication uses bcrypt-hashed credentials and issues a signed JWT.
- [ ] **Step 2: Patient Dashboard & Baseline**
  - Highlight the **Functional Performance Score Ring** (`79/100`, `+9.7% vs baseline`).
  - Explain to judges: *"NeuroGuard compares Raj against his own rolling 5-session baseline, not a population average."*
  - Point out the **AI Rehabilitation Insights** card showing Gemini observations with the `Gemini AI` badge.
  - Point out the **Clinician Care Plan** card showing the assigned protocol from Dr. Priya.
- [ ] **Step 3: Live Camera Assessment**
  - Click *"Start Assigned Protocol"* (or *"Start today's check"*).
  - Click *"Start camera check"* and allow browser webcam permissions.
  - Step back so head, shoulders, and wrists are visible.
  - Perform 3 to 5 bilateral arm raises.
  - Point out to judges:
    - Real-time skeleton overlay running at 30 fps via WebGL.
    - Zero pixels leave the laptop; privacy is preserved on-device.
    - Live repetition counter and movement quality signals.
  - Click *"Finish"*.
  - Show the result banner (`Score: 79/100 · Protocol Session Recorded`).
  - Click *"Back to overview"*.
- [ ] **Step 4: Real-Time Baseline Update**
  - Notice the dashboard updates with the new session and the topbar confirms: *"Session recorded against prescribed protocol."*

---

### Act II: The Doctor Portal & Clinical Governance (Dr. Priya Nair)
- [ ] **Step 5: Sign Out and Log In as Clinician**
  - Click the Sign Out icon in the topbar.
  - Click *"Doctor — Dr. Priya Nair"* (`priya@neuroguard.demo` / `doctor123`).
- [ ] **Step 6: Clinical Triage Roster**
  - Point out the triage summary tiles: *Review Recommended (1)*, *Monitor (1)*, *Stable (1)*.
  - Point out that patients are automatically ordered by clinical urgency.
- [ ] **Step 7: Prescribe a New Protocol**
  - Select *Raj Kumar* $\rightarrow$ Click *"Assign Assessment"*.
  - Select exercise type (e.g., *Arm Raise*), target reps (5), due date (next week).
  - Enter custom clinical guidance: *"Focus on keeping shoulders level at the peak."*
  - Click *"Assign Protocol"*.
  - Point out to judges: The protocol is validated server-side, linked to Raj Kumar, and saved.
- [ ] **Step 8: Review Completed Session**
  - Locate Raj's completed protocol $\rightarrow$ Click *"Review Session"*.
  - Enter clinical notes: *"Good symmetry improvement noted. Approved."*
  - Click *"Approve & Sign Off"*.
  - Point out: Status transitions to `Reviewed` with clinical feedback recorded.

---

### Act III: The "Decline Scenario" (Showcasing the Safety Alert Engine)
- [ ] **Step 9: Trigger Decline Scenario**
  - Switch profile to patient or caregiver (or use the sidebar link *"Load decline demo"*).
  - Point out to judges: In a hackathon demo, you cannot wait 3 weeks to see deterioration.
  - Click *"Load decline demo"*.
  - Switch to Doctor panel or Caregiver view.
  - Show that Raj Kumar has automatically moved to **"Review Recommended"** with an amber/red alert:  
    *"Persistent deviation: Functional performance is trending below Raj's recent baseline across the last three sessions."*
  - Show the Gemini insight explaining the persistent decline.

---

## 4. Known Demo Hazards & Immediate Mitigations

| Hazard / Risk | Cause | How to Mitigate During the Demo |
|---|---|---|
| **Webcam Permission Blocked** | Browser permissions denied or camera in use by Zoom / Teams | Close Zoom or other apps using the camera. Click the camera icon in Chrome's URL address bar and select *"Always allow"*. |
| **Low Arm Raise Score** | Patient standing too close to camera | Stand 5–7 feet back so both wrists, elbows, and shoulders remain in the frame throughout full elevation. |
| **Gemini AI Badge Says "Local Fallback"** | `GEMINI_API_KEY` is unset or network has strict proxy | Explain to judges: *"NeuroGuard is built with enterprise resilience. Because the external API timed out or is unconfigured, our deterministic personal baseline engine seamlessly took over without crashing."* |
| **MongoDB Mode Warning** | `MONGODB_URI` unset | The Topbar displays: *"Session mode · In-memory (DB offline)"*. Explain to judges: *"NeuroGuard has dual storage modes. It runs completely self-contained in memory for zero-dependency demos."* |
| **Arm Raise Final Reps Shows 1** | Known post-session loop timing quirk (`ALG-01`) | Direct judge attention to the **live rep counter** on screen (`Repetitions: 5/5`), which accurately counts reps during active motion. |

---

## 5. Final Demonstration Verification Sign-Off

- [x] All 15 audit documents written and verified in `docs/project-audit/`.
- [x] Zero application source code modifications made.
- [x] Git working tree clean on branch `features`.
- [x] Test suite passing 100% (66/66 tests).
- [x] Frontend bundle verified via `npm run build`.
- [ ] Final manual dry-run completed on demo laptop.
