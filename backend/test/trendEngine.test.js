const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  mean,
  deviation,
  classify,
  buildTrend,
  personalBaseline,
  detectPersistentDecline,
  buildDashboard,
  createAlert,
} = require('../src/trendEngine');

describe('Trend Engine Unit Tests', () => {
  test('mean calculates average accurately', () => {
    assert.equal(mean([10, 20, 30]), 20);
    assert.equal(mean([]), 0);
  });

  test('deviation calculates relative percentage delta', () => {
    assert.equal(deviation(80, 100), -0.2);
    assert.equal(deviation(110, 100), 0.1);
    assert.equal(deviation(100, 0), 0);
  });

  test('classify categorizes deviation into clinical monitoring bands', () => {
    assert.equal(classify(0.04), 'normal');
    assert.equal(classify(-0.08), 'monitor');
    assert.equal(classify(0.14), 'significant');
    assert.equal(classify(-0.25), 'review');
  });

  test('personalBaseline calculates moving window average', () => {
    const assessments = [
      { score: 60 },
      { score: 70 },
      { score: 80 },
    ];
    assert.equal(personalBaseline(assessments, 'score', 2), 75);
  });

  test('detectPersistentDecline identifies 3 consecutive sessions below baseline', () => {
    const historical = [
      { score: 80 },
      { score: 82 },
      { score: 81 },
      { score: 70 },
      { score: 68 },
      { score: 65 },
    ];
    assert.equal(detectPersistentDecline(historical, 'score'), true);

    const stable = [
      { score: 80 },
      { score: 82 },
      { score: 81 },
      { score: 81 },
      { score: 80 },
    ];
    assert.equal(detectPersistentDecline(stable, 'score'), false);
  });

  test('buildTrend creates formatted longitudinal data points', () => {
    const raw = [
      { timestamp: '2026-09-01T10:00:00Z', score: 75, metrics: { movement: 75, balance: 70, coordination: 72 } },
    ];
    const trend = buildTrend(raw);
    assert.equal(trend.length, 1);
    assert.equal(trend[0].day, 'D1');
    assert.equal(trend[0].score, 75);
  });
});
