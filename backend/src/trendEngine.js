function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function deviation(current, baseline) {
  if (!baseline) return 0;
  return (current - baseline) / baseline;
}

function classify(delta) {
  const pct = Math.abs(delta) * 100;
  if (pct <= 5) return 'normal';
  if (pct <= 10) return 'monitor';
  if (pct <= 15) return 'significant';
  return 'review';
}

function buildTrend(assessments) {
  return assessments
    .slice()
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
    .map((a, index) => ({
      day: `D${index + 1}`,
      date: new Date(a.timestamp).toLocaleDateString('en-IN', { month: 'short', day: '2-digit' }),
      score: Math.round(a.score),
      movement: Math.round(a.metrics?.movement ?? a.metrics?.rangeOfMotion ?? a.score),
      balance: Math.round(a.metrics?.balance ?? a.score),
      coordination: Math.round(a.metrics?.coordination ?? a.metrics?.symmetry ?? a.score),
      speech: Math.round(a.metrics?.speech ?? 84),
    }));
}

function personalBaseline(assessments, field = 'score', windowSize = 5) {
  const values = assessments
    .slice(-windowSize)
    .map((a) => field === 'score' ? Number(a.score) : Number(a.metrics?.[field] ?? 0))
    .filter(Number.isFinite);
  return mean(values);
}

function detectPersistentDecline(assessments, field = 'score') {
  if (assessments.length < 3) return false;
  const recent = assessments.slice(-3).map((a) => field === 'score' ? Number(a.score) : Number(a.metrics?.[field] ?? 0));
  const previous = assessments.slice(0, -3);
  if (!previous.length) return false;
  const baseline = personalBaseline(previous, field, 5);
  return recent.every((value) => value < baseline) && mean(recent) < baseline * 0.95;
}

function buildDashboard(user, assessments) {
  const ordered = assessments.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const latest = ordered[ordered.length - 1];
  const prior = ordered.slice(0, -1);
  const baseline = prior.length ? personalBaseline(prior, 'score', 5) : Number(latest?.score || 0);
  const current = Number(latest?.score || 0);
  const change = baseline ? (current - baseline) / baseline : 0;
  const metric = (name, fallback) => {
    const value = Number(latest?.metrics?.[name] ?? fallback);
    const old = prior.length ? personalBaseline(prior, name, 5) : value;
    return { value: Math.round(value), change: old ? Math.round(((value - old) / old) * 1000) / 10 : 0 };
  };
  return {
    user,
    summary: { functionalScore: Math.round(current), change: Math.round(change * 1000) / 10, trend: change >= 0.03 ? 'Improving' : change <= -0.05 ? 'Declining' : 'Stable', lastAssessment: latest?.timestamp || null },
    metrics: {
      Movement: metric('movement', latest?.score || 0),
      Balance: metric('balance', latest?.score || 0),
      Coordination: metric('coordination', latest?.score || 0),
      Speech: metric('speech', 84),
    },
    baseline: { functionalScore: Math.round(baseline), window: Math.min(prior.length, 5) },
  };
}

function createAlert(userId, assessments) {
  if (!assessments.length) return null;
  const ordered = assessments.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const latest = ordered[ordered.length - 1];
  const previous = ordered.slice(0, -1);
  if (!previous.length) return null;
  const current = Number(latest.score);
  const baseline = personalBaseline(previous, 'score', 5);
  const delta = deviation(current, baseline);
  const persistent = detectPersistentDecline(ordered, 'score');
  const classification = persistent ? 'review' : classify(delta);
  if (classification === 'normal') return null;
  return {
    id: `alert-${userId}-${Date.now()}`,
    severity: classification === 'review' ? 'review' : 'monitor',
    type: persistent ? 'Persistent deviation' : 'Change detected',
    reason: persistent
      ? `Functional performance is ${Math.abs(Math.round(delta * 100))}% below the recent baseline across the last three sessions.`
      : `Functional performance changed by ${Math.abs(Math.round(delta * 100))}% compared with the recent baseline.`,
    timestamp: new Date(latest.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
    action: persistent ? 'Review recommended' : 'Review change',
  };
}

module.exports = { mean, deviation, classify, buildTrend, personalBaseline, detectPersistentDecline, buildDashboard, createAlert };
