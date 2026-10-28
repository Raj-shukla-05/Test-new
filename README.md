# NeuroGuard AI — Hackathon Build

AI-powered home recovery & functional monitoring for stroke survivors.

## What this build includes

- React + Vite frontend and separate Node.js + Express backend
- Browser-side MediaPipe Pose Landmarker for privacy-first movement analysis
- Live Arm Raise exercise with skeleton overlay, ROM, symmetry, control and rep counting
- Sit-to-Stand and Seated Reach exercises using the same pose pipeline
- Personal baseline and longitudinal trend engine
- Caregiver dashboard with Stable / Monitor / Review Recommended states
- Explainable alerts based on deterministic trend logic
- Seeded Day 1 → Day 21 demo scenario so the hackathon presentation is reliable
- Optional speech assessment metrics (browser Speech Recognition when supported)
- Optional OpenAI explanation endpoint; local deterministic explanation is always available as fallback
- No raw video upload or persistence

## Architecture

```text
Camera / Microphone
      |
      v
React client + MediaPipe
      |
      +--> pose landmarks --> feature engine --> scores
      |                                      |
      |                                      v
      |                              Node / Express API
      |                                      |
      |                              baseline + trends
      |                                      |
      |                       +--------------+--------------+
      |                       |                             |
      v                       v                             v
Patient UI            MongoDB (optional)          Caregiver UI
                                             
Structured findings --> optional LLM --> plain-language explanation
```

## Run

### Terminal 1 — backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Backend: `http://localhost:5000`

### Terminal 2 — frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173`

The camera requires a secure browser context. `localhost` is allowed by modern browsers.

## Optional environment

Backend `.env`:

```env
PORT=5000
MONGODB_URI=
OPENAI_API_KEY=
OPENAI_MODEL=
```

Leave MongoDB and OpenAI blank for a fully local hackathon demo. The server uses an in-memory store and a deterministic explanation fallback.

## Demo account

The UI is intentionally seeded for a presentation-ready flow:

- Patient: Raj Kumar
- Caregiver: Anita Sharma
- Current functional performance: 79/100
- Historical decline scenario can be enabled from the dashboard

## Important safety framing

NeuroGuard is a prototype for functional monitoring. It does not diagnose disease, prescribe treatment, or replace professional care. All demo thresholds are product/prototype thresholds, not clinically validated medical thresholds.

## Open-source / external work reviewed

The implementation was informed by public rehabilitation and MediaPipe projects, including:

- `sumitsahoo/mediapipe-pose-estimation` — MIT; used as a reference for React + MediaPipe browser architecture.
- `RomeoCoding/Stroke-Rehab-BMEhack` — MIT; used as a reference for stroke-oriented hand/movement analysis and remote monitoring concepts.
- `tiiffanyho/rehably` — reviewed for browser-side MediaPipe/session patterns. The repository page did not expose a project license, so its code was not copied.
- `nancyhamdan/RehabAI` and `ak-abdullah/FYP-Demo` were reviewed for rehabilitation scoring / dashboard architecture. No code from repositories without a clear permissive license is copied into this build.

See `THIRD_PARTY.md` for details.
