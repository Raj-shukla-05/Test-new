# NeuroGuard AI — Complete Codebase Intelligence, Architecture & Implementation Audit

**Audit Date:** October 29, 2026  
**Auditor:** Senior Software Architect, Security Auditor & QA Engineering Specialist  
**Repository Branch:** `features` (Commit: `8370fe2`)  
**Audit Scope:** Full repository static analysis, architecture tracing, runtime provenance audit, test suite execution, and production build verification.  
**Integrity Guarantee:** Zero modifications made to application source code, dependencies, or configuration during this audit.

---

## Executive Summary

**NeuroGuard AI** is an AI-assisted home functional recovery monitoring platform designed for stroke rehabilitation. It combines:
1. **On-device browser-based computer vision** using Google MediaPipe Pose Landmarker for privacy-preserving movement tracking.
2. **Deterministic longitudinal trend and personal baseline analysis** comparing patients against their own prior sessions rather than population averages.
3. **Structured clinician prescription workflows** allowing doctors to assign tailored rehabilitation exercises with specific repetition targets and instructions, and subsequently review completed sessions with feedback.
4. **Context-sanitized AI explanations** powered by Google Gemini API (with a deterministic local fallback engine) that strictly translate recorded metric deltas into plain-language rehabilitation observations.
5. **Role-based authorization and session management** protecting patient medical records using JSON Web Tokens (JWT) and bcrypt password hashing.
6. **Dual-mode data persistence** operating resiliently in an in-memory session mode while providing asynchronous persistence to MongoDB when configured.

### Key Audit Findings

| Category | Status / Assessment | Evidence & Key Observations |
|---|---|---|
| **Test Verification** | **66 / 66 Passing** | All 9 test suites in Node test runner (`node --test test/**/*.test.js`) executed and passed cleanly in 11.95s. |
| **Frontend Production Build** | **Successful (Vite 6.0.5)** | `npm run build` completed with zero errors in 7.93s, generating optimized JS and CSS bundles. |
| **Computer Vision Pipeline** | **Functional with Algorithm Quirk** | MediaPipe runs entirely locally (WASM and model served from `public/`). However, in `scoring.js`, arm-raise repetition counting in post-session processing evaluates `Date.now() - lastPeak > 700` in a tight loop, restricting the final reported rep count to a maximum of 1 rep. |
| **Data Architecture** | **In-Memory Primary / Mongo Archive** | The backend routes read exclusively from in-memory arrays in `store.js`. MongoDB writes are fire-and-forget; no data is read back from MongoDB on queries or restarts. |
| **Real vs. Dummy Data** | **Mixed Provenance** | Real camera landmark detection and live scoring exist; however, unmeasured dashboard metrics fall back to hardcoded display numbers (`82`, `71`, `76`, `84`) via nullish coalescing in the UI. |
| **Security & Privacy** | **High Privacy / Target Authorization Gaps** | Video frames never leave client devices. Patient isolation is enforced on dashboard/assessments, but `/api/users/:id/demo-decline` and `/api/explanation` lack authentication middleware. |
| **AI Explanation Safety** | **Strictly Sanitized Input** | Gemini prompt strictly limits explanations to whitelisted deviations. If the API key is absent or Gemini fails, the deterministic local baseline engine seamlessly provides fallback text. |

---

## Documentation Roadmap & Index

The audit has been documented across 15 dedicated, cross-referenced technical reports located in this directory:

| Report | Title | Core Focus |
|---|---|---|
| [**01-project-overview.md**](./01-project-overview.md) | **Project Overview & System Context** | Clinical problem, mission, intended user roles, what the system does and does not do, and boundary conditions. |
| [**02-feature-functionality-catalog.md**](./02-feature-functionality-catalog.md) | **Feature & Functionality Catalog** | Exhaustive catalog of every capability, UI entry points, backend handlers, data inputs/outputs, and verified status. |
| [**03-codebase-file-map.md**](./03-codebase-file-map.md) | **Codebase File & Directory Map** | Full inventory of every repository file, directory purpose, exported symbols, dependencies, and dead/dormant code. |
| [**04-system-architecture-and-data-flows.md**](./04-system-architecture-and-data-flows.md) | **System Architecture & Data Flows** | End-to-end workflow tracing, subsystem interactions, and 6 comprehensive Mermaid sequence/architecture diagrams. |
| [**05-real-vs-dummy-data-audit.md**](./05-real-vs-dummy-data-audit.md) | **Real vs. Dummy Data Audit** | Exhaustive data provenance matrix: hardcoded constants, mock responses, synthetic history, derived scores, and live inputs. |
| [**06-api-endpoint-reference.md**](./06-api-endpoint-reference.md) | **API Endpoint Reference** | Complete HTTP API documentation covering routes, auth requirements, role restrictions, schemas, and error responses. |
| [**07-database-and-data-models.md**](./07-database-and-data-models.md) | **Database & Data Models** | Mongoose schemas (User, Assessment, Assignment, Alert), relationships, indexes, storage fallbacks, and Mermaid ER diagram. |
| [**08-computer-vision-and-assessment-algorithms.md**](./08-computer-vision-and-assessment-algorithms.md) | **Computer Vision & Movement Algorithms** | MediaPipe integration, landmark kinematics, joint angle math, rep counting state machines, and scoring formulations. |
| [**09-ai-baseline-and-explanation-engine.md**](./09-ai-baseline-and-explanation-engine.md) | **AI Baseline & Explanation Engine** | Personal baseline algorithm, trend classification, Gemini API integration, prompt safeguards, and fallback mechanisms. |
| [**10-security-and-privacy-audit.md**](./10-security-and-privacy-audit.md) | **Security & Privacy Audit** | Threat analysis, JWT security, password hashing, BOLA/IDOR evaluation, data minimization, and prioritized vulnerability table. |
| [**11-testing-and-verification-report.md**](./11-testing-and-verification-report.md) | **Testing & Verification Report** | Test suite execution audit (66 tests), mocked vs live external testing, build results, and unverified edge cases. |
| [**12-configuration-and-deployment.md**](./12-configuration-and-deployment.md) | **Configuration & Deployment Guide** | Environment variables table, local run instructions, Vite build configuration, and deployment prerequisites. |
| [**13-known-limitations-and-roadmap.md**](./13-known-limitations-and-roadmap.md) | **Known Limitations & Technical Roadmap** | Prioritized technical debt, architectural bottlenecks, clinical constraints, and remediation items (P0 to P3). |
| [**14-complete-project-explanation.md**](./14-complete-project-explanation.md) | **Complete Plain-English Project Walkthrough** | Comprehensive guide suitable for onboarding engineers, hackathon judges, technical vivas, and presentation prep. |
| [**15-demo-readiness-checklist.md**](./15-demo-readiness-checklist.md) | **Demo Readiness Checklist** | Actionable pre-flight checklist covering setup, patient assessment, doctor review, judge flows, and risk mitigation. |

---

## Audit Methodology

1. **Static Code Inspection:** Complete line-by-line inspection of all frontend React components, backend Express routes, middleware, service modules, Mongoose schemas, and test fixtures.
2. **Test Execution:** Ran the native Node.js test runner across all integration test suites (`npm test` in `backend/`).
3. **Build Verification:** Ran the Vite production compiler (`npm run build` in `frontend/`) to evaluate tree-shaking, bundle size, and syntax validity.
4. **Data Flow Tracing:** Traced the complete lifecycle of sensor data from camera pixels → MediaPipe landmarks → geometric scoring → API payload → baseline calculation → Gemini explanation → UI rendering.
5. **Security & Boundary Analysis:** Analyzed role-based access control, object-level authorization, secret exposure, token lifetimes, and input validation.

---

## Prioritized Action Summary

- **P0 (Critical):** Fix repetition counter loop bug in `frontend/src/lib/scoring.js` (`Date.now()` evaluation inside post-session loop causes arm raise reps to cap at 1).
- **P1 (Hackathon High):** Add `authenticateToken` middleware to `POST /api/users/:id/demo-decline` and `POST /api/explanation` to prevent unauthorized resource mutation and LLM quota consumption.
- **P1 (Hackathon High):** Prevent unmeasured metrics on `PatientDashboard.jsx` from falling back to arbitrary numbers (`82`, `71`, `76`, `84`) via nullish coalescing.
- **P2 (Architecture):** Migrate backend read paths to query MongoDB when connected rather than exclusively reading from in-memory arrays in `store.js`.
