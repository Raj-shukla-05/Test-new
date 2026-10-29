# NeuroGuard AI — Agent Instructions

## 1. Project Mission

NeuroGuard AI is an AI-assisted home recovery and functional monitoring platform.

The platform supports structured assessments, movement and coordination measurements, personal baselines, longitudinal progress tracking, and understandable feedback for patients and authorized healthcare professionals.

The system is intended to support rehabilitation monitoring. It must not diagnose medical conditions, replace clinicians, or present experimental measurements as clinically validated results.

## 2. Core Technology Stack

Use the existing implementation and dependencies wherever possible.

Expected technologies include:

- Frontend: React, Vite, JavaScript .
- Backend: Node.js and Express.
- Computer vision: MediaPipe Tasks Vision and Pose Landmarker.
- Database: MongoDB, if implemented.
- AI assistance: Google Gemini API, when required and configured.
- Charts: Recharts, if already used.
- Validation: Existing validation libraries or appropriate server-side validation.

Do not assume that every planned technology has already been integrated. Inspect the codebase and distinguish implemented features from planned features.

## 3. Mandatory Workflow

Before making substantial changes:

1. Inspect the project structure.
2. Read the relevant source files and configuration.
3. Review package.json files and available scripts.
4. Check Git status and preserve existing user changes.
5. Identify the root cause or implementation requirement.
6. Explain the proposed approach and affected files when the task is substantial.
7. Implement the smallest complete solution.
8. Run relevant tests, lint checks, or builds where available.
9. Report what changed, what was tested, and what remains incomplete.

Do not rewrite the project or replace its architecture without a clear reason and approval.

## 4. Preserve the Existing Prototype

- Preserve existing pages, components, routes, and working functionality.
- Reuse existing UI components and styling.
- Preserve working MediaPipe camera and pose-tracking functionality.
- Inspect the existing implementation before adding a second implementation of the same feature.
- Do not remove local model files or WASM assets without checking their usage.
- Do not replace working code with mock data simply to make a demonstration easier.
- Keep mock data clearly separated from real application data.
- Avoid unrelated changes and unnecessary dependencies.

## 5. Application Architecture

Maintain a clear separation between:

- User interface and presentation.
- Client-side application state.
- API communication.
- Authentication and authorization.
- Assessment orchestration.
- Movement and speech feature extraction.
- Assessment result calculations.
- Personal baseline and longitudinal trend calculations.
- Gemini-assisted explanations.
- Database access and persistence.

Follow the architecture that actually exists. Introduce new folders or abstraction layers only when they provide a practical benefit.

Never move all business logic into React components or expose backend-only functionality to the browser.

## 6. User Roles and Authorization

The intended user roles are:

### Patient

- Access assigned assessments.
- Complete authorized assessments.
- View personal results and progress.
- View permitted recommendations and explanations.

### Doctor

- Access authorized patient records.
- Assign appropriate assessments.
- Review assessment history and trends.
- Review measurements and AI-assisted explanations.
- Make clinical decisions independently of automated output.

Enforce authorization on the backend, not merely by hiding frontend buttons.

Users must not be able to access another patient's private records by changing a URL, identifier, or API request.

Do not introduce a caregiver role unless the project requirements explicitly call for it.

## 7. Assessment and Computer Vision Safety

- Obtain camera and microphone permission before use.
- Provide clear instructions for assessment setup and positioning.
- Handle denied permissions, unavailable devices, poor visibility, and model-loading failures gracefully.
- Avoid reporting a successful assessment when required measurements could not be obtained.
- Separate raw observations, derived metrics, and AI-generated explanations.
- Preserve timestamps, assessment types, and measurement provenance where appropriate.
- Compare progress against the patient's own valid baseline when sufficient data exists.
- Do not invent measurements, patient histories, confidence values, or clinical thresholds.
- Do not interpret a single unusual session as proof of recovery, deterioration, or a medical emergency.
- Clearly label experimental metrics as non-diagnostic and not clinically validated.

Any clinical thresholds or medical claims must have an appropriate evidence source and require qualified clinical review before being presented as validated.

## 8. Gemini API Rules

- Use Gemini only for tasks that benefit from language understanding or explanation.
- Keep API credentials on the backend.
- Never embed a private Gemini API key in frontend code.
- Never expose secrets in logs, error messages, source files, or responses.
- Validate the data supplied to the model.
- Treat model output as potentially incorrect.
- Do not allow the model to invent assessment measurements or alter calculated results.
- Generate explanations from recorded measurements and explicitly supplied context.
- Do not present AI-generated output as a medical diagnosis or independently verified clinical recommendation.
- Handle API failures, timeouts, rate limits, and unavailable models gracefully.
- Do not call the Gemini API for every UI interaction when a local calculation is sufficient.

## 9. Security and Privacy

- Never commit API keys, passwords, JWT secrets, database credentials, or personal patient data.
- Keep secrets in environment variables.
- Validate and authorize all protected backend requests.
- Validate incoming data on the server.
- Use appropriate authentication, authorization, and session-expiration practices.
- Apply least-privilege access to patient information.
- Avoid unnecessary collection or retention of raw video and audio.
- Obtain informed consent where required.
- Do not log sensitive patient information unnecessarily.
- Do not weaken authentication or security checks to bypass errors.

## 10. Frontend Standards

- Follow the existing React and Vite conventions.
- Build reusable components when appropriate.
- Keep components focused and maintainable.
- Reuse existing design tokens, styles, and UI patterns.
- Support mobile, tablet, and desktop layouts.
- Include loading, error, empty, and success states.
- Provide accessible labels, keyboard navigation, and understandable feedback.
- Avoid unnecessary full-page redesigns.
- Do not use placeholder interactions for features presented as functional.

## 11. Backend Standards

- Follow the existing Express routing and middleware structure.
- Separate route handling, business logic, and database operations where appropriate.
- Validate request bodies, parameters, and query values.
- Use consistent error responses.
- Handle asynchronous errors correctly.
- Keep secrets and privileged operations on the server.
- Enforce role-based and resource-level authorization.
- Avoid exposing stack traces or internal configuration in production responses.

## 12. Database and Data Integrity

- Inspect existing schemas and data structures before modifying them.
- Preserve compatibility with existing records where practical.
- Validate assessment records before saving.
- Store timestamps and assessment types consistently.
- Distinguish missing measurements from valid zero values.
- Do not overwrite historical assessment results when creating a new session.
- Avoid destructive migrations or database resets without explicit approval.
- Never delete real patient data to simplify development or testing.

## 13. Testing and Verification

- Inspect available npm scripts before running commands.
- Test the affected functionality rather than assuming it works.
- Run relevant tests and production builds when available.
- Check browser console errors and API failures when applicable.
- Verify authentication and authorization for protected features.
- Test missing environment variables and external API failures.
- Do not claim tests passed unless they were actually executed successfully.
- Clearly report any tests that could not be run.

## 14. Dependency Management

- Inspect existing dependencies before installing new packages.
- Prefer existing libraries when they satisfy the requirement.
- Explain the purpose of significant new dependencies.
- Do not replace package managers or lockfiles unnecessarily.
- Do not upgrade unrelated dependencies during a focused bug fix.

## 15. Git and File Safety

- Preserve uncommitted changes.
- Never overwrite unrelated user work.
- Do not execute destructive commands without explicit approval.
- Do not commit, push, merge, reset, or delete branches unless requested.
- Do not modify Git history without explicit approval.
- Review the final diff before finishing.

## 16. Completion Report

For every substantial task, report:

1. What was implemented.
2. Which files were changed.
3. Why the implementation was chosen.
4. Which tests or verification commands were executed.
5. Whether verification succeeded.
6. Any remaining limitations, risks, or required environment variables.

Never claim that an unimplemented feature is complete.
