---
trigger: glob
globs: "frontend/**/*.{js,jsx,ts,tsx,css,html}"
description: "Frontend development rules for the NeuroGuard React application."
---

# Frontend Development

- Inspect existing components before creating or modifying UI.
- Preserve working camera, MediaPipe, and assessment functionality.
- Reuse existing components, styles, hooks, and utilities.
- Keep API communication separate from presentation logic where practical.
- Include loading, empty, error, and success states.
- Make layouts responsive and accessible.
- Handle camera and microphone permission errors clearly.
- Never expose server-side secrets in browser code.
- Do not replace functional features with mock implementations.
- Run the available frontend checks after relevant changes.
