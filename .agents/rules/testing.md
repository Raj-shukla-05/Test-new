---
trigger: glob
globs: "**/*.{test,spec}.{js,jsx,ts,tsx}"
description: "Testing and regression-prevention rules for NeuroGuard."
---

# Testing and Verification

- Inspect existing test conventions before adding tests.
- Test the behavior of the feature, not only its implementation details.
- Cover success, failure, and relevant boundary cases.
- Test unauthorized access to protected patient records.
- Test missing environment variables and external service failures where relevant.
- Avoid tests that depend on real patient data.
- Do not make tests pass by weakening application security.
- Report which tests were executed and their actual results.
