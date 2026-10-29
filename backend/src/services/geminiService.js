/**
 * Gemini Service for NeuroGuard AI
 * Provides non-diagnostic, plain-language recovery explanations based strictly on recorded metrics.
 */

try {
  const dns = require('node:dns');
  if (dns && typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first');
  }
} catch {
  // Ignore DNS config failure if unsupported in environment
}

function buildLocalExplanation(findings = {}) {
  const movement = typeof findings.movement_change === 'number' ? findings.movement_change : null;
  const balance  = typeof findings.balance_change  === 'number' ? findings.balance_change  : null;
  const speech   = typeof findings.speech_change   === 'number' ? findings.speech_change   : null;
  const baselineSessions = typeof findings.baseline_sessions === 'number' ? findings.baseline_sessions : null;

  // 1. Initial reference session (no prior comparable baseline)
  if (baselineSessions === 0 || baselineSessions === null) {
    return 'This session has been recorded as your initial reference point. NeuroGuard will begin tracking meaningful changes once more comparable sessions are available.';
  }

  // 2. Single prior session: state limited history and avoid overconfident claims
  if (baselineSessions === 1) {
    if (findings.trend === 'persistent_decline') {
      return 'Performance is below your single prior session. Additional check-ins are needed to determine whether this represents a persistent trend.';
    }
    const parts = [];
    if (movement !== null && movement > 0) parts.push(`movement (+${movement}%)`);
    if (balance  !== null && balance  > 0) parts.push(`balance (+${balance}%)`);
    if (speech   !== null && speech   > 0) parts.push(`speech (+${speech}%)`);
    if (parts.length > 0) {
      return `Functional check shows preliminary upward change compared with your single prior session (${parts.join(', ')}). Multiple sessions are required to establish a confirmed trend.`;
    }
    return 'Functional check is consistent with your single prior session. NeuroGuard will establish a reliable personal baseline as more sessions are completed.';
  }

  // 3. Multi-session baseline: persistent decline
  if (findings.trend === 'persistent_decline') {
    // Only mention specific metrics that were actually measured
    const parts = [];
    if (movement !== null) parts.push(`movement (${Math.abs(movement)}%)`);
    if (balance  !== null) parts.push(`balance (${Math.abs(balance)}%)`);
    if (speech   !== null) parts.push(`speech (${Math.abs(speech)}%)`);
    const metricList = parts.length ? parts.join(' and ') : 'functional performance';
    return `Recent ${metricList} ${parts.length === 1 ? 'is' : 'are'} below the recent personal baseline across the last ${baselineSessions} comparable sessions. Consider reviewing this change with your healthcare professional.`;
  }

  // 4. Multi-session baseline: upward progress
  const improving = [];
  if (movement !== null && movement > 0) improving.push(`movement (+${movement}%)`);
  if (balance  !== null && balance  > 0) improving.push(`balance (+${balance}%)`);
  if (speech   !== null && speech   > 0) improving.push(`speech (+${speech}%)`);

  if (improving.length > 0) {
    return `Recent functional performance is trending upward compared with the personal baseline across the last ${baselineSessions} comparable sessions (${improving.join(', ')}).`;
  }

  // 5. Multi-session baseline: stable
  return `The latest functional check is within the expected range of the personal baseline across the last ${baselineSessions} comparable sessions. NeuroGuard will continue tracking meaningful changes.`;
}

/**
 * Formats a concise error diagnostic from an HTTP status and parsed provider error payload.
 * Never includes secrets, tokens, or private credentials.
 * @param {number} status - HTTP status code
 * @param {any} errorData - Parsed JSON or string from response
 * @param {string} modelName - Model name queried
 * @returns {string} Concise diagnostic string
 */
function formatDiagnosticMessage(status, errorData, modelName) {
  let providerMsg = '';
  if (errorData && typeof errorData === 'object') {
    providerMsg = errorData.error?.message || errorData.message || JSON.stringify(errorData);
  } else if (typeof errorData === 'string') {
    providerMsg = errorData;
  }

  if (status === 400) {
    return `[GeminiService] HTTP 400 Bad Request: Malformed request payload. Provider message: "${providerMsg || 'Invalid argument'}".`;
  }

  if (status === 401) {
    return `[GeminiService] HTTP 401 Unauthorized: Invalid or missing API key. Provider message: "${providerMsg || 'Unauthorized'}".`;
  }

  if (status === 403) {
    return `[GeminiService] HTTP 403 Forbidden: API key lacks required permissions or API is not enabled. Provider message: "${providerMsg || 'Forbidden'}".`;
  }

  if (status === 404) {
    const lower = providerMsg.toLowerCase();
    let detail = 'Endpoint or requested resource not found';
    if (lower.includes('model') || lower.includes('not found') || lower.includes('not supported')) {
      detail = `Model "${modelName}" not found or unsupported for generateContent on this API version`;
    }
    return `[GeminiService] HTTP 404 Not Found: ${detail}. Provider message: "${providerMsg || 'Resource not found'}".`;
  }

  if (status === 429) {
    return `[GeminiService] HTTP 429 Rate Limit Exceeded: Quota or rate limit reached. Provider message: "${providerMsg || 'Resource exhausted'}".`;
  }

  if (status >= 500 && status < 600) {
    return `[GeminiService] HTTP ${status} Server Error: Gemini provider service error. Provider message: "${providerMsg || 'Internal server error'}".`;
  }

  return `[GeminiService] HTTP ${status} Error: Provider message: "${providerMsg || 'Unexpected status'}".`;
}

/**
 * Generates an AI-assisted explanation from validated findings.
 * @param {Object} findings - Object containing functional metrics and trends.
 * @returns {Promise<{ source: string, text: string }>}
 */
async function generateExplanation(findings = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  const localFallback = buildLocalExplanation(findings);

  if (!apiKey || apiKey.trim() === '') {
    return { source: 'local', text: localFallback };
  }

  const rawModel = (process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite').trim();
  // Strip any leading 'models/' prefix to avoid malformed duplicate paths
  const model = rawModel.replace(/^models\//, '');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  // Construct a safe, non-diagnostic prompt
  const systemInstruction =
    'You are an assistive explanation system for NeuroGuard AI, a non-diagnostic functional rehabilitation monitoring platform. ' +
    'Explain the structured recovery monitoring observations in 2-3 concise, empathetic, plain-language sentences. ' +
    'STRICT RULES: ' +
    '1. Only describe metrics that are explicitly listed in "Measured Deviations" below. Do NOT mention movement, balance, speech, or any other metric that is absent from that list. ' +
    '2. Never provide a medical diagnosis, medication advice, or determine clinical emergencies. ' +
    '3. Never invent measurements or metrics not present in the input. ' +
    '4. baseline_sessions is the number of comparable prior sessions used to establish the baseline (excluding the current session). ' +
    '   If baseline_sessions is 0 or absent, state clearly that this session is an initial reference baseline and no historical comparison is possible yet. ' +
    '5. If baseline_sessions is 1, state that comparison is based on only a single prior session. Never claim confirmed clinical improvement, diagnosis, or confirmed recovery. ' +
    '6. Clearly frame findings as functional rehabilitation observations relative to the personal baseline. ' +
    '7. Suggest discussing persistent changes with a doctor or rehabilitation specialist where appropriate.';

  // Build the measured deviations section — only include fields that were explicitly provided.
  const deviations = [];
  if (typeof findings.movement_change === 'number') {
    deviations.push(`- Movement Deviation: ${findings.movement_change >= 0 ? '+' : ''}${findings.movement_change}%`);
  }
  if (typeof findings.balance_change === 'number') {
    deviations.push(`- Balance Deviation: ${findings.balance_change >= 0 ? '+' : ''}${findings.balance_change}%`);
  }
  if (typeof findings.speech_change === 'number') {
    deviations.push(`- Speech Deviation: ${findings.speech_change >= 0 ? '+' : ''}${findings.speech_change}%`);
  }
  const measuredBlock = deviations.length > 0
    ? deviations.join('\n')
    : '- No individual metric deviations measured in this session type.';

  const baselineInfo = typeof findings.baseline_sessions === 'number'
    ? `- Baseline Comparison Sessions Available: ${findings.baseline_sessions}`
    : '- Baseline Comparison Sessions Available: unknown';

  const exerciseInfo = findings.exercise_type
    ? `- Assessment Type: ${findings.exercise_type}`
    : '';

  const trackingWarning = findings.tracking_quality_warning
    ? `- Tracking Quality Warning: ${findings.tracking_quality_warning}`
    : '';

  const userPrompt = [
    'Observed session findings:',
    `- Trend Classification: ${findings.trend || 'stable'}`,
    baselineInfo,
    exerciseInfo,
    trackingWarning,
    'Measured Deviations (only these were collected — do not mention any other metric):',
    measuredBlock,
    findings.details ? `- Details: ${findings.details}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const requestBody = {
    contents: [
      {
        parts: [
          { text: `${systemInstruction}\n\n${userPrompt}` }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024,
    }
  };

  const timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS) || 15000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        try {
          errorData = await response.text();
        } catch {
          errorData = 'Failed to read response body';
        }
      }

      console.warn(formatDiagnosticMessage(response.status, errorData, model));
      return { source: 'local-fallback', text: localFallback };
    }

    const data = await response.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (candidateText) {
      return { source: 'gemini', text: candidateText };
    }

    console.warn('[GeminiService] Received empty or invalid candidate content from Gemini. Using local fallback.');
    return { source: 'local-fallback', text: localFallback };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      console.warn(`[GeminiService] Request timed out after ${timeoutMs}ms. Using local fallback.`);
    } else {
      console.warn(`[GeminiService] Request failed (${error.name || error.message}). Using local fallback.`);
    }
    return { source: 'local-fallback', text: localFallback };
  }
}

module.exports = {
  buildLocalExplanation,
  formatDiagnosticMessage,
  generateExplanation,
};
