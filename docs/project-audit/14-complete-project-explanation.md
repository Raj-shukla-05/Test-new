# 14 — Complete Plain-English Project Walkthrough

This document is a comprehensive, end-to-end technical narrative of NeuroGuard AI. It is written for onboarding engineers, hackathon judges, project vivas, and technical interview preparation. It explains how every component connects, how data moves across boundaries, what is real versus synthetic, and how the platform solves a genuine healthcare challenge.

---

## 1. What NeuroGuard AI Is and Why It Matters

Imagine a 58-year-old stroke survivor named **Raj Kumar**. After two weeks in an acute stroke unit, Raj is discharged home. His physical therapist tells him: *"Do your arm raise exercises every morning, and we'll check your progress in four weeks."*

Between those visits, Raj is in an observational blind spot. He does not know if his shoulder elevation is improving, if his bilateral symmetry is lopsided, or if a subtle decline is occurring. Meanwhile, his doctor, **Dr. Priya Nair**, has zero objective data until Raj walks into the clinic a month later.

**NeuroGuard AI solves this problem.** It turns any standard web browser with a webcam into an on-device movement analysis laboratory:
1. **Privacy-First Computer Vision:** Raj positions himself in front of his laptop. MediaPipe detects 33 anatomical body joints at 30 frames a second. His video never leaves his laptop—pixels are processed in local memory and discarded immediately.
2. **Kinematic Feature Extraction:** The software calculates joint angles, vertical elevation, bilateral symmetry, smoothness, and counts repetitions.
3. **Personal Baseline Comparison:** Instead of comparing Raj to a generic population average, NeuroGuard compares his session to his own prior 5 sessions.
4. **Structured Clinician Protocol:** Dr. Priya can log into her portal, prescribe an exact protocol (e.g., *"Arm Raise · 5 reps · Keep shoulders relaxed"*), and review Raj's completed sessions with clinical notes.
5. **Explainable AI Insights:** Using Google Gemini, the platform translates raw numbers into empathetic, 2-3 sentence summaries strictly bounded by what was measured, with a deterministic fallback engine if the internet drops.

---

## 2. Walkthrough: The Life of an Assessment Session

Let’s trace the journey of an assessment session step-by-step from webcam photons to doctor sign-off:

### Step 1: The Prescription
Dr. Priya logs into the **Doctor Portal** (`DoctorPage.jsx`). She opens Raj Kumar's chart and clicks *"Assign Assessment"*. She selects **Arm Raise**, enters a target of **5 reps**, sets a due date for next week, and writes: *"Perform 5 bilateral arm raises in the morning. Pause at the peak."*
- When she clicks *"Assign Protocol"*, the frontend sends a `POST /api/assignments` request with her JWT token.
- The Express server (`server.js`) verifies she is an authorized doctor, generates an assignment ID (`asgn-123`), stores it in memory, and writes it to MongoDB.

### Step 2: Patient Sees the Protocol
Raj opens his **Patient Dashboard** (`PatientDashboard.jsx`). The client fetches his active assignments via `GET /api/patients/user-raj/assignments`. He sees a highlighted blue banner: *"Clinician Care Plan: Arm Raise · Target: 5 reps"*. He clicks *"Start Assigned Protocol"*.

### Step 3: Local Camera Tracking
Raj is taken to `AssessmentPage.jsx`, which mounts `CameraAssessment.jsx`:
- Raj clicks *"Start camera check"*. The browser requests webcam permission (`getUserMedia`).
- The application loads the local neural network (`pose_landmarker_lite.task`, 5.78 MB) and WebAssembly binaries from `/public/mediapipe/wasm/`.
- A 30 fps render loop begins. In each frame, MediaPipe extracts 33 3D coordinates.
- An HTML5 canvas overlays a turquoise skeleton over Raj's video feed.
- For every frame, `armRaiseFrame()` computes:
  - Vertical elevation of wrists relative to shoulders.
  - Bilateral symmetry between left and right arms.
  - Elbow extension angle.
- Live on screen, Raj sees: *"Movement phase: Raise"*, *"Quality signal: 76%"*, *"Repetitions: 3/5"*.

### Step 4: Finishing the Check
Raj completes 5 repetitions and clicks *"Finish"*:
- The client evaluates tracking quality: because `duration >= 3s` and `score > 0`, it verifies valid body tracking.
- The client compiles the final score (e.g., `79/100`), duration (`82s`), and metrics (`ROM: 82, symmetry: 76`).
- It sends a `POST /api/assessments` request carrying Raj's token, the assessment results, and the `assignmentId: "asgn-123"`.

### Step 5: Server Processing & Normalization
The Express server receives the payload:
- **Authorization Check:** Verifies Raj's token matches `userId: "user-raj"`.
- **Quality Safety Check:** Checks `trackingQuality.isValid !== false` and `validFrames >= 5`.
- **Metric Normalization:** Recognizes the exercise is an `arm_raise`. It maps range of motion to `movement`, symmetry to `coordination`, and explicitly strips unmeasured `balance` and `speech`.
- **Protocol Linking:** Locates assignment `asgn-123`, marks status as `completed`, and records `completedSessionId`.
- **Persistence:** Appends the session to in-memory `assessments` and asynchronously calls `Assessment.create()` to MongoDB.

### Step 6: Trend Analysis & Gemini Explanation
Raj returns to his dashboard, which refreshes via `GET /api/users/user-raj/dashboard`:
- The backend's `trendEngine.js` extracts Raj's prior sessions (excluding the new one), calculates his 5-session baseline (`72`), compares it to his new score (`79`), and detects a `+9.7%` upward trend (`Improving`).
- The dashboard sends these sanitized findings to `POST /api/explanation`.
- `geminiService.js` constructs a safe prompt with strict rules forbidding diagnosis or hallucination.
- Google Gemini responds: *"Your functional movement has improved by 10% compared with your recent 5-session baseline. Continue keeping shoulders relaxed as guided by your care team."*
- The dashboard renders the text with a purple badge: **Gemini AI**.

### Step 7: Doctor Review & Sign-Off
Dr. Priya opens her portal. Raj's protocol status has transitioned to **Completed**.
- She inspects his completed session score (`79/100`) and verified tracking quality.
- She types clinical notes: *"Shoulder elevation looks much more symmetrical. Approved."*
- She clicks *"Approve & Sign Off"*. The frontend sends `PATCH /api/assignments/asgn-123/status` with `status: "reviewed"`.
- Raj's dashboard immediately updates to display: *"💬 Doctor Feedback: 'Shoulder elevation looks much more symmetrical. Approved.'"*

---

## 3. Real vs. Synthetic Data: What Judges Need to Know

When presenting to judges or technical interviewers, transparency builds trust. Here is the exact provenance of data in NeuroGuard AI:

| What is 100% REAL | What is DERIVED | What is SYNTHETIC / DEMO |
|---|---|---|
| • Webcam pixels & video stream<br/>• MediaPipe 33 3D pose landmarks<br/>• Joint angle & elevation math<br/>• Live repetition counting on screen<br/>• JWT creation & bcrypt verification<br/>• Role-based access control checks<br/>• Live Google Gemini API calls | • Functional score (0-100)<br/>• Personal baseline moving average<br/>• Deviation percentage delta<br/>• Persistent decline classification<br/>• Local fallback explanation text | • The initial 7-day history in `store.js`<br/>• Seed accounts (Raj, Anita, Mohan, Priya)<br/>• "Load decline demo" button (injects 5 fake sessions)<br/>• Fallback numbers (`?? 82`, `?? 71`, `?? 76`, `?? 84`) on dashboard if metrics are null |

---

## 4. Key Architectural Trade-Offs

1. **Why In-Memory Primary with Asynchronous MongoDB?**  
   *Decision:* In hackathon and demo environments, database connection dropouts or missing credentials frequently break live demos. By maintaining a synchronous in-memory store (`store.js`) as the primary query source and using MongoDB as an asynchronous write-behind archive, NeuroGuard is 100% crash-resilient even if MongoDB is completely offline.
2. **Why Browser-Side Pose Tracking instead of Server-Side Video Streaming?**  
   *Decision:* Streaming raw video from patient homes introduces massive privacy vulnerabilities (HIPAA/GDPR compliance risks), requires high patient upload bandwidth, and incurs heavy server GPU costs. By running `@mediapipe/tasks-vision` on the client's WebGL GPU/WASM runtime, zero video leaves the device, guaranteeing absolute patient privacy.
3. **Why Deterministic Fallback instead of Pure LLM?**  
   *Decision:* Healthcare applications cannot afford downtime, rate limit errors, or hallucinated advice. If Gemini fails, times out, or the API key is missing, the deterministic local baseline engine immediately provides safe, clinically grounded observation text.
