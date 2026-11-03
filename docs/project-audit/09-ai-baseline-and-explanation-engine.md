# 09 — AI Baseline & Explanation Engine

This document details the mathematical algorithms governing personal baseline calculations, trend classification bands, the Google Gemini API integration pipeline, and deterministic fallback logic in NeuroGuard AI.

---

## 1. Mathematical Baseline & Trend Engine

All baseline calculations are implemented in `backend/src/trendEngine.js`. NeuroGuard evaluates recovery relative to the patient's own history rather than generic population averages.

### Formulaic Definitions

1. **Mean ($\mu$):**
   $$\mu(V) = \frac{1}{|V|} \sum_{v \in V} v$$
2. **Relative Percentage Deviation ($\delta$):**
   $$\delta(c, b) = \begin{cases} 0 & \text{if } b = 0 \\ \frac{c - b}{b} & \text{otherwise} \end{cases}$$
3. **Clinical Deviation Classification Bands (`classify`):**
   $$\text{Band}(|\delta|) = \begin{cases} 
   \text{'normal'} & \text{if } |\delta| \le 0.05 \text{ (within } 5\% \text{)} \\
   \text{'monitor'} & \text{if } 0.05 < |\delta| \le 0.10 \text{ (within } 10\% \text{)} \\
   \text{'significant'} & \text{if } 0.10 < |\delta| \le 0.15 \text{ (within } 15\% \text{)} \\
   \text{'review'} & \text{if } |\delta| > 0.15 \text{ (exceeds } 15\% \text{)}
   \end{cases}$$
4. **Persistent Decline Detection (`detectPersistentDecline`):**
   A safety-critical rule designed to catch compounding deterioration before a single massive drop occurs:
   - Requires at least 4 total sessions (3 recent + at least 1 prior baseline session).
   - Extracts the 3 most recent sessions ($R = [s_{-3}, s_{-2}, s_{-1}]$) and previous baseline sessions ($P$).
   - Computes baseline $B = \mu(P)$.
   - Evaluates:
     $$\text{PersistentDecline} = (\forall r \in R, r < B) \land \left(\mu(R) < B \times 0.95\right)$$
   - If true, forces alert severity to `'review'` and type to `'Persistent deviation'`.

### Baseline Moving Window (`buildDashboard`)
In `backend/src/trendEngine.js` lines 38-48:
```javascript
const ordered = assessments.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
const latest = ordered[ordered.length - 1];
const prior = ordered.slice(0, -1); // Strictly excludes latest session
const baseline = prior.length ? personalBaseline(prior, 'score', 5) : Number(latest?.score || 0);
const current = Number(latest?.score || 0);
const change = baseline ? (current - baseline) / baseline : 0;
```
- **Strict Exclusion:** The latest session is explicitly sliced out (`ordered.slice(0, -1)`). The baseline is never polluted by the current check-in.
- **Window Size:** Caps at the last 5 comparable prior sessions (`Math.min(prior.length, 5)`).
- **Initial Session ($N=1$):** `prior.length === 0`. The baseline window is reported as `0`, and metric change is reported as `null`.

---

## 2. Gemini AI Integration Architecture

The generative explanation service is implemented in `backend/src/services/geminiService.js`.

### Provider Configuration
- **Model Name:** Configured via `process.env.GEMINI_MODEL`, defaulting to `gemini-3.5-flash-lite`.
- **Target Endpoint:**
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
- **Authentication:** `x-goog-api-key: process.env.GEMINI_API_KEY` request header.
- **Timeout Management:** Controlled by `process.env.GEMINI_TIMEOUT_MS` (default: 15,000 ms) using `AbortController`.
- **Generation Parameters:**
  ```json
  {
    "temperature": 0.2,
    "maxOutputTokens": 1024
  }
  ```
  A low temperature (0.2) is intentionally selected to minimize creative variance and hallucination risk.

---

## 3. Server-Side Metric Sanitization (`sanitizeFindings`)

Before any data is passed to the Gemini prompt or local engine, `server._sanitizeFindings()` enforces strict input whitelisting:
1. **Trend Validation:** Only permits `'stable'`, `'improving'`, `'declining'`, or `'persistent_decline'`. Defaults to `'stable'` for any unrecognized string.
2. **Explicit Metric Whitelisting:** Inspects `measured_metrics` array. If an exercise like `arm_raise` did not measure balance or speech, those fields are completely stripped from the findings object.
3. **Details Truncation:** Free-text details from callers are truncated to 500 characters to prevent prompt injection attacks.
4. **Baseline Metadata:** Enforces that `baseline_sessions` is a valid number, communicating to the model whether historical comparison is valid.

---

## 4. Prompt Engineering & Safeguards

The prompt constructed in `geminiService.js` lines 135-188 enforces strict non-diagnostic constraints:

```text
You are an assistive explanation system for NeuroGuard AI, a non-diagnostic functional rehabilitation monitoring platform. Explain the structured recovery monitoring observations in 2-3 concise, empathetic, plain-language sentences.

STRICT RULES:
1. Only describe metrics that are explicitly listed in "Measured Deviations" below. Do NOT mention movement, balance, speech, or any other metric that is absent from that list.
2. Never provide a medical diagnosis, medication advice, or determine clinical emergencies.
3. Never invent measurements or metrics not present in the input.
4. baseline_sessions is the number of comparable prior sessions used to establish the baseline (excluding the current session). If baseline_sessions is 0 or absent, state clearly that this session is an initial reference baseline and no historical comparison is possible yet.
5. If baseline_sessions is 1, state that comparison is based on only a single prior session. Never claim confirmed clinical improvement, diagnosis, or confirmed recovery.
6. Clearly frame findings as functional rehabilitation observations relative to the personal baseline.
7. Suggest discussing persistent changes with a doctor or rehabilitation specialist where appropriate.
```

---

## 5. Deterministic Local Fallback Engine (`buildLocalExplanation`)

When `GEMINI_API_KEY` is not provided, or when the Gemini API times out or returns an HTTP error (401, 404, 429), `buildLocalExplanation()` generates deterministic text based on strictly bounded logic:

| Scenario | Condition | Generated Text |
|---|---|---|
| **Initial Reference** | `baselineSessions === 0` or `null` | *"This session has been recorded as your initial reference point. NeuroGuard will begin tracking meaningful changes once more comparable sessions are available."* |
| **Single Prior Session (Upward)** | `baselineSessions === 1` and deltas $>0$ | *"Functional check shows preliminary upward change compared with your single prior session (movement (+10%)). Multiple sessions are required to establish a confirmed trend."* |
| **Single Prior Session (Decline)** | `baselineSessions === 1` and `persistent_decline` | *"Performance is below your single prior session. Additional check-ins are needed to determine whether this represents a persistent trend."* |
| **Persistent Decline (Multi-Session)** | `trend === 'persistent_decline'` | *"Recent movement (13%) is below the recent personal baseline across the last 5 comparable sessions. Consider reviewing this change with your healthcare professional."* |
| **Upward Progress (Multi-Session)** | Improving deltas present | *"Recent functional performance is trending upward compared with the personal baseline across the last 5 comparable sessions (movement (+10%))."* |
| **Stable (Multi-Session)** | All deltas within $\pm 5\%$ | *"The latest functional check is within the expected range of the personal baseline across the last 5 comparable sessions. NeuroGuard will continue tracking meaningful changes."* |

---

## 6. Error Diagnostics & Source Badging

### Error Diagnostic Formatter (`formatDiagnosticMessage`)
When an external API call fails, `formatDiagnosticMessage(status, errorData, modelName)` formats a sanitized warning log in the server console:
- `400`: `"[GeminiService] HTTP 400 Bad Request: Malformed request payload."`
- `401`: `"[GeminiService] HTTP 401 Unauthorized: Invalid or missing API key."`
- `404`: `"[GeminiService] HTTP 404 Not Found: Model <name> not found on this API version."`
- `429`: `"[GeminiService] HTTP 429 Rate Limit Exceeded: Quota reached."`
- **Security Check:** Error logs never output private API keys or internal JWT secrets.

### Frontend Source Badging Logic
In `PatientDashboard.jsx` and `DoctorPage.jsx`:
```javascript
explanation?.source === 'gemini'
  ? 'Gemini AI'
  : explanation?.source === 'local-fallback'
    ? 'Local Fallback'
    : (explanation?.source === 'failed' ? 'Unavailable' : 'Personal Baseline Engine')
```
- A local fallback is **never falsely labeled as Gemini AI**.
- A medical disclaimer (`ShieldCheck`) accompanies every rendered explanation:  
  *"Non-diagnostic rehabilitation observation. Consult your doctor for medical evaluations."*

---

## 7. Remaining Hallucination Risks & Recommendations

1. **Unvalidated Output String:** While the input findings are thoroughly sanitized by `_sanitizeFindings`, the text returned by Gemini is not scanned before being returned to the client. If the model ignores Rule 1 and mentions "balance" during an arm-raise assessment, the frontend will render it.
   - *Recommendation:* Add regex post-validation to check if the returned string contains words corresponding to unmeasured metrics. If detected, silently fall back to `buildLocalExplanation`.
2. **Model Availability & Deprecation:** The default model `gemini-3.5-flash-lite` or older names like `gemini-1.5-flash` may vary across Google API endpoints. The fallback engine ensures complete resilience against model 404 errors.
