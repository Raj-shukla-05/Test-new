---
trigger: glob
globs: "backend/**/*.{js,mjs,cjs,ts,json}"
description: "Backend development rules for NeuroGuard APIs and business logic."
---

# Backend Development

- Inspect existing routes, middleware, services, and models first.
- Preserve the existing architecture and API contracts.
- Validate incoming data on the server.
- Enforce authentication and authorization on protected resources.
- Check patient-level access for every protected assessment request.
- Keep Gemini API credentials and database credentials server-side.
- Separate route handlers, business logic, and database access where practical.
- Handle asynchronous errors and external API failures.
- Never expose secrets or sensitive patient data in error responses.
- Test relevant endpoints after modifications.
