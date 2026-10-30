# 12 — Configuration & Deployment Guide

This document catalogs all environment configurations, runtime variables, build processes, and operational deployment characteristics for NeuroGuard AI.

---

## 1. Master Environment Variable Table

| Variable Name | Subsystem | Required? | Purpose | Default Behavior | Safe Example Format | Exposed to Client? | Consequence If Missing |
|---|---|---|---|---|---|---|---|
| `PORT` | Backend (`server.js`) | Optional | HTTP listen port for Express API | `5000` | `5000` | No | Binds to port `5000`. |
| `NODE_ENV` | Backend (`server.js`) | Optional | Node execution environment | `'development'` | `development` or `production` | No | Defaults to development error handling. |
| `MONGODB_URI` | Backend (`db.js`) | Optional | MongoDB connection string | `""` (Empty string) | `mongodb://localhost:27017/neuroguard` | No | Runs in resilient in-memory session mode. |
| `JWT_SECRET` | Backend (`auth.js`) | **Required for Prod** | HMAC key for signing JWT tokens | `'neuroguard-dev-fallback-secret-2026'` | `a8f9c7e2b1d4...` (64-char hex) | No | Defaults to public insecure fallback string. |
| `GEMINI_API_KEY` | Backend (`geminiService.js`) | Optional | Google Gemini Generative Language API Key | `""` (Empty string) | `AIzaSyD...` (Sanitized) | No | Explanation engine falls back to `buildLocalExplanation`. |
| `GEMINI_MODEL` | Backend (`geminiService.js`) | Optional | Target Gemini model identifier | `'gemini-3.5-flash-lite'` | `gemini-3.5-flash-lite` | No | Uses `gemini-3.5-flash-lite`. |
| `GEMINI_TIMEOUT_MS` | Backend (`geminiService.js`) | Optional | Outbound API fetch timeout in ms | `15000` (15 seconds) | `10000` | No | Defaults to 15-second timeout. |
| `VITE_API_BASE_URL` | Frontend (`lib/api.js`) | Optional | Backend API base URL for REST calls | `'http://localhost:5000/api'` | `http://localhost:5000/api` | **Yes (Bundled)** | Frontend expects backend on port 5000. |

---

## 2. Local Setup & Execution Guide

The application consists of two independent Node projects (`backend` and `frontend`) with no root `package.json`.

### Prerequisites
- Node.js v18.0.0+ (Tested on Node.js v22.21.1)
- Modern Web Browser (Google Chrome or Microsoft Edge recommended for MediaPipe WebGL GPU delegate and WebAssembly support).
- Web camera (built-in or USB).

### Step-by-Step Launch

#### Terminal 1 — Backend API Server
```bash
cd backend
npm install
cp .env.example .env
# Edit .env to populate GEMINI_API_KEY or MONGODB_URI if desired
npm run dev
```
*Console output:*
```text
[Database] MONGODB_URI not provided. Running in resilient in-memory mode.
NeuroGuard backend running on http://localhost:5000
```

#### Terminal 2 — Frontend Application
```bash
cd frontend
npm install
npm run dev
```
*Console output:*
```text
  VITE v6.0.5  ready in 184 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

Open `http://localhost:5173` in Google Chrome or Microsoft Edge.

---

## 3. Production Build & Optimization

To compile the frontend single-page application for static hosting:

```bash
cd frontend
npm run build
```
- Output Directory: `frontend/dist/`
- Asset Structure:
  - `dist/index.html`: Entry document (0.57 kB).
  - `dist/assets/index-[hash].css`: Compiled application styles (25.64 kB).
  - `dist/assets/index-[hash].js`: Minified production bundle (835.03 kB).
  - `dist/models/pose_landmarker_lite.task`: Local neural network binary (5.78 MB).
  - `dist/mediapipe/wasm/`: WebAssembly runtime binaries (~33 MB total).

### Preview Production Build
```bash
cd frontend
npm run preview
```
Runs a local static preview server on port 4173.

---

## 4. Deployment Findings & Infrastructure Assessment

1. **No Containerization Assets:**  
   - There are no `Dockerfile`, `docker-compose.yml`, or container configuration files present in the repository.
   - For containerized deployments, engineers must author custom Dockerfiles for both frontend (e.g., NGINX hosting `frontend/dist`) and backend (`node src/server.js`).
2. **No CI/CD Workflows:**  
   - There are no `.github/workflows/` or continuous integration pipeline definitions.
   - Test execution (`npm test`) and build verification (`npm run build`) are currently manual.
3. **Static Asset Routing in Production:**  
   - The frontend relies on serving `.task` and `.wasm` files directly from the root origin (`/models/pose_landmarker_lite.task` and `/mediapipe/wasm/`).
   - If the frontend is hosted behind a reverse proxy or nested sub-path (e.g., `https://domain.com/app/`), Vite's `base` configuration in `vite.config.js` and asset URLs in `pose.js` must be updated.
4. **CORS in Production:**  
   - Currently, `server.js` sets `cors({ origin: true })`. Before public deployment, `cors` should be locked down to the exact production frontend origin.
