---
trigger: glob
globs: "backend/**/*.{js,mjs,cjs,ts}, frontend/**/*.{js,jsx,ts,tsx}, **/.env*"
description: "Security and patient-data privacy rules for NeuroGuard."
---

# Security and Privacy

- Never commit real API keys, passwords, tokens, or database credentials.
- Keep private API credentials on the backend.
- Validate untrusted input and enforce authorization server-side.
- Apply least-privilege access to patient records.
- Do not log sensitive health information unnecessarily.
- Avoid retaining raw camera or microphone recordings without a justified need and appropriate consent.
- Do not disable authentication or authorization to work around errors.
- Never expose stack traces, secrets, or internal configuration to clients.
- Review security implications before changing authentication or data-access logic.
