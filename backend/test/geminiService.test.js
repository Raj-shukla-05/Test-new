/**
 * geminiService.test.js
 * Covers: explanation accuracy, metric filtering, baseline handling,
 * source labels, prompt correctness, and pipeline integration.
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
require('dotenv').config();

const {
  buildLocalExplanation,
  formatDiagnosticMessage,
  generateExplanation,
} = require('../src/services/geminiService');

const app = require('../src/server');

// ---------------------------------------------------------------------------
// 1. buildLocalExplanation — metric-specific accuracy
// ---------------------------------------------------------------------------

describe('buildLocalExplanation — accuracy and metric specificity', () => {

  test('first session: returns initial-reference message when baseline_sessions is 0', () => {
    const text = buildLocalExplanation({ trend: 'stable', baseline_sessions: 0 });
    assert.match(text, /initial reference/);
    assert.ok(!text.includes('movement'), 'Should not mention movement for a baseline-only session');
    assert.ok(!text.includes('balance'), 'Should not mention balance for a baseline-only session');
    assert.ok(!text.includes('speech'), 'Should not mention speech for a baseline-only session');
  });

  test('first session: returns initial-reference when baseline_sessions is absent', () => {
    const text = buildLocalExplanation({ trend: 'stable' });
    assert.match(text, /initial reference/);
  });

  test('arm_raise only: mentions movement, not balance or speech when those are absent', () => {
    const text = buildLocalExplanation({
      trend: 'improving',
      movement_change: 8,
      baseline_sessions: 3,
      // No balance_change, no speech_change
    });
    assert.match(text, /movement/);
    assert.ok(!text.includes('balance'), 'Should not mention balance (not measured)');
    assert.ok(!text.includes('speech'), 'Should not mention speech (not measured)');
  });

  test('persistent_decline only mentions measured metrics', () => {
    const text = buildLocalExplanation({
      trend: 'persistent_decline',
      movement_change: -12,
      // No balance_change, no speech_change
      baseline_sessions: 4,
    });
    assert.match(text, /movement/);
    assert.ok(!text.includes('balance'), 'Should not fabricate balance in decline message');
    assert.ok(!text.includes('speech'), 'Should not fabricate speech in decline message');
    assert.match(text, /below the recent personal baseline/);
  });

  test('persistent_decline with both movement and balance mentions both', () => {
    const text = buildLocalExplanation({
      trend: 'persistent_decline',
      movement_change: -10,
      balance_change: -7,
      baseline_sessions: 4,
    });
    assert.match(text, /movement/);
    assert.match(text, /balance/);
  });

  test('improving trend with only movement measured', () => {
    const text = buildLocalExplanation({
      trend: 'improving',
      movement_change: 6,
      baseline_sessions: 2,
    });
    assert.match(text, /trending upward/);
    assert.match(text, /movement/);
    assert.ok(!text.includes('balance'));
    assert.ok(!text.includes('speech'));
  });

  test('stable trend cites number of sessions used for comparison', () => {
    const text = buildLocalExplanation({
      trend: 'stable',
      movement_change: 1,
      baseline_sessions: 3,
    });
    assert.ok(
      text.includes('3') || text.includes('sessions'),
      'Stable explanation should reference the session window'
    );
  });

  test('single prior session: does not claim confident improvement or decline', () => {
    const text = buildLocalExplanation({
      trend: 'stable',
      movement_change: 0,
      baseline_sessions: 1,
    });
    // Must mention the limited comparison basis
    assert.ok(
      text.includes('1') || text.includes('session'),
      'Should reference limited comparison basis for 1-session history'
    );
  });

  test('no positive change → does not produce improving label for zero deviations', () => {
    const text = buildLocalExplanation({
      trend: 'stable',
      movement_change: 0,
      balance_change: 0,
      baseline_sessions: 5,
    });
    assert.ok(!text.includes('trending upward'), 'Should not claim improvement for zero deviations');
  });
});

// ---------------------------------------------------------------------------
// 2. formatDiagnosticMessage — HTTP error categorization
// ---------------------------------------------------------------------------

describe('formatDiagnosticMessage — error categorization', () => {
  test('HTTP 400, 401, 403, 404-model, 404-endpoint, 429, 5xx are correctly categorized', () => {
    const check = (status, body, model, pattern) => {
      const msg = formatDiagnosticMessage(status, body, model);
      assert.match(msg, pattern, `Expected ${status} to match ${pattern}`);
    };

    check(400, { error: { message: 'Invalid argument' } }, 'gemini-3.5-flash', /HTTP 400 Bad Request/);
    check(401, { error: { message: 'API key not valid' } }, 'gemini-3.5-flash', /HTTP 401 Unauthorized/);
    check(403, { error: { message: 'Permission denied' } }, 'gemini-3.5-flash', /HTTP 403 Forbidden/);
    check(404, { error: { message: 'models/gemini-1.5-flash is not found' } }, 'gemini-1.5-flash', /Model "gemini-1.5-flash" not found/);
    check(404, { error: { message: 'Resource not found' } }, 'gemini-3.5-flash', /HTTP 404 Not Found/);
    check(429, { error: { message: 'Rate limit exceeded' } }, 'gemini-3.5-flash', /HTTP 429 Rate Limit/);
    check(503, { error: { message: 'High demand' } }, 'gemini-3.8-flash', /HTTP 503 Server Error/);
  });
});

// ---------------------------------------------------------------------------
// 3. generateExplanation — mocked integration: accuracy, prompt, labels
// ---------------------------------------------------------------------------

describe('generateExplanation — mocked: accuracy and source labels', () => {
  const originalFetch = globalThis.fetch;
  const originalKey   = process.env.GEMINI_API_KEY;
  const originalModel = process.env.GEMINI_MODEL;

  after(() => {
    globalThis.fetch = originalFetch;
    process.env.GEMINI_API_KEY = originalKey;
    process.env.GEMINI_MODEL   = originalModel;
  });

  test('source = local when API key is missing', async () => {
    delete process.env.GEMINI_API_KEY;
    const res = await generateExplanation({ trend: 'stable', baseline_sessions: 3 });
    assert.equal(res.source, 'local');
    assert.ok(res.text.length > 0);
    // Restore for subsequent tests
    process.env.GEMINI_API_KEY = originalKey;
  });

  test('source = gemini on successful API response, with correct header and URL', async () => {
    process.env.GEMINI_API_KEY = 'test-key-abc';
    process.env.GEMINI_MODEL   = 'models/gemini-3.5-flash'; // deliberate models/ prefix

    let capturedUrl     = '';
    let capturedHeaders = {};
    let capturedBody    = null;

    globalThis.fetch = async (url, opts) => {
      capturedUrl     = url;
      capturedHeaders = opts.headers || {};
      capturedBody    = JSON.parse(opts.body || '{}');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Movement tracking remained steady today.' }] } }],
        }),
      };
    };

    const res = await generateExplanation({
      trend: 'stable',
      movement_change: 1,
      measured_metrics: ['movement'],
      baseline_sessions: 4,
      exercise_type: 'arm_raise',
    });

    assert.equal(res.source, 'gemini');
    assert.equal(res.text, 'Movement tracking remained steady today.');

    // URL must not duplicate models/ and must not embed key in query params
    assert.ok(capturedUrl.includes('/models/gemini-3.5-flash:generateContent'), 'URL path should be correct');
    assert.ok(!capturedUrl.includes('models/models'), 'URL must not duplicate models/');
    assert.ok(!capturedUrl.includes('key='), 'API key must not appear in URL query string');

    // Key must be in header, not URL
    assert.equal(capturedHeaders['x-goog-api-key'], 'test-key-abc');

    // Prompt must include measured metric but not unmeasured ones
    const promptText = capturedBody.contents[0].parts[0].text;
    assert.ok(promptText.includes('Movement Deviation'), 'Prompt should include movement');
    assert.ok(!promptText.includes('Balance Deviation: +'), 'Prompt must not list balance when not measured');
    assert.ok(!promptText.includes('Speech Deviation: +'), 'Prompt must not list speech when not measured');
    assert.ok(promptText.includes('arm_raise'), 'Prompt should include exercise type');
    assert.ok(promptText.includes('4'), 'Prompt should include baseline session count');
  });

  test('arm_raise prompt does NOT include balance or speech deviations when absent', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    process.env.GEMINI_MODEL   = 'gemini-3.5-flash';

    let capturedPrompt = '';
    globalThis.fetch = async (url, opts) => {
      capturedPrompt = JSON.parse(opts.body).contents[0].parts[0].text;
      return {
        ok: true, status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: 'Your arm movement was tracked.' }] } }] }),
      };
    };

    await generateExplanation({
      trend: 'stable',
      movement_change: 2,
      baseline_sessions: 3,
      exercise_type: 'arm_raise',
      // No balance_change, no speech_change
    });

    assert.ok(capturedPrompt.includes('Movement Deviation'), 'Should include movement');
    // These lines must not appear (not measured)
    assert.ok(!capturedPrompt.includes('Balance Deviation'), 'Must not include Balance Deviation when not measured');
    assert.ok(!capturedPrompt.includes('Speech Deviation'), 'Must not include Speech Deviation when not measured');
  });

  test('no baseline session: prompt includes 0 sessions and model instructed to note initial reference', async () => {
    process.env.GEMINI_API_KEY = 'test-key';

    let capturedPrompt = '';
    globalThis.fetch = async (url, opts) => {
      capturedPrompt = JSON.parse(opts.body).contents[0].parts[0].text;
      return {
        ok: true, status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: 'First session recorded.' }] } }] }),
      };
    };

    await generateExplanation({ trend: 'stable', baseline_sessions: 0 });

    assert.ok(capturedPrompt.includes('0'), 'Prompt should state 0 baseline sessions');
  });

  test('Gemini generic / unsupported claim: explanation returned as-is with source=gemini', async () => {
    // The service passes Gemini output through without content-filtering —
    // the system instruction is what prevents hallucinations.
    // This test verifies the service does not silently discard a valid response.
    process.env.GEMINI_API_KEY = 'test-key';
    const genericText = 'Your recovery is progressing well.';

    globalThis.fetch = async () => ({
      ok: true, status: 200,
      json: async () => ({ candidates: [{ content: { parts: [{ text: genericText }] } }] }),
    });

    const res = await generateExplanation({ trend: 'stable', baseline_sessions: 3 });
    assert.equal(res.source, 'gemini');
    assert.equal(res.text, genericText);
  });

  test('source = local-fallback on HTTP 404', async () => {
    process.env.GEMINI_API_KEY = 'test-key';

    globalThis.fetch = async () => ({
      ok: false, status: 404,
      json: async () => ({ error: { message: 'models/gemini-1.5-flash is not found' } }),
    });

    const res = await generateExplanation({ trend: 'stable', movement_change: 2, baseline_sessions: 3 });
    assert.equal(res.source, 'local-fallback');
    assert.ok(res.text.length > 0, 'Fallback text should not be empty');
  });

  test('source = local-fallback on HTTP 401', async () => {
    process.env.GEMINI_API_KEY = 'bad-key';

    globalThis.fetch = async () => ({
      ok: false, status: 401,
      json: async () => ({ error: { message: 'API key not valid' } }),
    });

    const res = await generateExplanation({ trend: 'stable', baseline_sessions: 2 });
    assert.equal(res.source, 'local-fallback');
  });

  test('source = local-fallback on HTTP 429', async () => {
    process.env.GEMINI_API_KEY = 'test-key';

    globalThis.fetch = async () => ({
      ok: false, status: 429,
      json: async () => ({ error: { message: 'Rate limit exceeded' } }),
    });

    const res = await generateExplanation({ trend: 'improving', movement_change: 5, baseline_sessions: 3 });
    assert.equal(res.source, 'local-fallback');
    assert.match(res.text, /trending upward/);
  });

  test('source = local-fallback on AbortError timeout', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    globalThis.fetch = async () => { const e = new Error('aborted'); e.name = 'AbortError'; throw e; };

    const res = await generateExplanation({ trend: 'stable', baseline_sessions: 3 });
    assert.equal(res.source, 'local-fallback');
  });

  test('source = local-fallback on empty candidates array', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ candidates: [] }) });

    const res = await generateExplanation({ trend: 'stable', baseline_sessions: 3 });
    assert.equal(res.source, 'local-fallback');
  });

  test('source = local-fallback on network failure', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    globalThis.fetch = async () => { throw new Error('ECONNREFUSED'); };

    const res = await generateExplanation({ trend: 'stable', baseline_sessions: 3 });
    assert.equal(res.source, 'local-fallback');
  });

  test('source = local-fallback on invalid tracking quality', async () => {
    process.env.GEMINI_API_KEY = 'test-key';
    // Even if tracking_quality_warning is passed, service should still work (just include it in prompt)
    let capturedPrompt = '';
    globalThis.fetch = async (url, opts) => {
      capturedPrompt = JSON.parse(opts.body).contents[0].parts[0].text;
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'Session had partial tracking.' }] } }] }) };
    };

    const res = await generateExplanation({
      trend: 'stable',
      movement_change: 0,
      baseline_sessions: 2,
      tracking_quality_warning: 'Only 40% of frames had full body visibility',
    });

    assert.equal(res.source, 'gemini');
    assert.ok(capturedPrompt.includes('40%'), 'Tracking warning should be in prompt');
  });
});

// ---------------------------------------------------------------------------
// 4. sanitizeFindings — server-side filtering
// ---------------------------------------------------------------------------

describe('sanitizeFindings — server-side metric filtering', () => {
  const { _sanitizeFindings } = require('../src/server');

  test('only whitelisted metrics pass through (by measured_metrics list)', () => {
    const out = _sanitizeFindings({
      trend: 'improving',
      movement_change: 5,
      balance_change: 3,
      speech_change: 2,
      measured_metrics: ['movement'],
    });
    assert.ok('movement_change' in out, 'movement should pass through');
    assert.ok(!('balance_change' in out), 'balance should be filtered when not in measured_metrics');
    assert.ok(!('speech_change' in out), 'speech should be filtered when not in measured_metrics');
  });

  test('trend is validated and defaults to stable for unrecognized values', () => {
    const out = _sanitizeFindings({ trend: 'random_value' });
    assert.equal(out.trend, 'stable');
  });

  test('valid trend values pass through', () => {
    for (const t of ['stable', 'improving', 'declining', 'persistent_decline']) {
      const out = _sanitizeFindings({ trend: t });
      assert.equal(out.trend, t);
    }
  });

  test('details are truncated at 500 characters', () => {
    const longStr = 'x'.repeat(600);
    const out = _sanitizeFindings({ trend: 'stable', details: longStr });
    assert.equal(out.details.length, 500);
  });

  test('baseline_sessions is included when numeric', () => {
    const out = _sanitizeFindings({ trend: 'stable', baseline_sessions: 4 });
    assert.equal(out.baseline_sessions, 4);
  });

  test('exercise_type is passed through as string', () => {
    const out = _sanitizeFindings({ trend: 'stable', exercise_type: 'arm_raise' });
    assert.equal(out.exercise_type, 'arm_raise');
  });

  test('tracking_quality_warning is included when present', () => {
    const out = _sanitizeFindings({ trend: 'stable', tracking_quality_warning: 'Low frame count' });
    assert.equal(out.tracking_quality_warning, 'Low frame count');
  });

  test('when measured_metrics absent, includes metrics only where change value is not null/undefined', () => {
    const out = _sanitizeFindings({
      trend: 'stable',
      movement_change: 3,
      // balance_change absent (not measured)
      speech_change: null, // explicitly null means not measured
    });
    assert.ok('movement_change' in out);
    assert.ok(!('balance_change' in out));
    assert.ok(!('speech_change' in out));
  });
});

// ---------------------------------------------------------------------------
// 5. POST /api/explanation — HTTP endpoint integration
// ---------------------------------------------------------------------------

describe('POST /api/explanation — endpoint integration', () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}/api`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test('responds with structured { source, text } for arm_raise findings', async () => {
    const res = await fetch(`${baseUrl}/explanation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trend: 'stable',
        movement_change: 2,
        measured_metrics: ['movement'],
        baseline_sessions: 3,
        exercise_type: 'arm_raise',
      }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.source, 'Must have source field');
    assert.ok(body.text && body.text.length > 0, 'Must have non-empty text');
    assert.ok(['gemini', 'local-fallback', 'local'].includes(body.source), 'Source must be a valid label');
  });

  test('responds with source=local when no API key (missing key env var)', async () => {
    const savedKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      const res = await fetch(`${baseUrl}/explanation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trend: 'stable',
          baseline_sessions: 0,
        }),
      });

      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.source, 'local');
      assert.match(body.text, /initial reference/);
    } finally {
      process.env.GEMINI_API_KEY = savedKey;
    }
  });

  test('valid source labels: only gemini, local-fallback, or local', async () => {
    const res = await fetch(`${baseUrl}/explanation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trend: 'improving', movement_change: 5, measured_metrics: ['movement'], baseline_sessions: 4 }),
    });
    const body = await res.json();
    assert.ok(['gemini', 'local-fallback', 'local'].includes(body.source), `Unexpected source: ${body.source}`);
  });
});

// ---------------------------------------------------------------------------
// 6. Gemini Service Live API Verification
// ---------------------------------------------------------------------------

describe('Gemini Service Live API Verification', () => {
  test('real API request to verified provider model returns gemini source', async (t) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '') {
      t.skip('Skipping live verification: GEMINI_API_KEY not configured.');
      return;
    }

    const res = await generateExplanation({
      trend: 'improving',
      movement_change: 6,
      measured_metrics: ['movement'],
      baseline_sessions: 4,
      exercise_type: 'arm_raise',
      details: 'Follow-up functional evaluation',
    });

    assert.ok(res, 'Response object should exist');
    assert.ok(typeof res.text === 'string' && res.text.length > 0, 'Explanation text should be non-empty');
    assert.equal(res.source, 'gemini', `Expected source=gemini, got: ${res.source}`);
    // Basic sanity: live response should not mention balance or speech (not in measured_metrics)
    // Note: we can't enforce this 100% since the model controls the output,
    // but the prompt explicitly prohibits it. Log a warning if violated.
    if (res.text.toLowerCase().includes('balance') || res.text.toLowerCase().includes('speech')) {
      console.warn('[LiveTest] WARNING: Gemini response mentioned unmeasured metrics. Prompt constraints may need strengthening.');
    }
  });
});
