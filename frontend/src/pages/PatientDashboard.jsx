import React from 'react';
import { Activity, ClipboardCheck, Hand, Mic2, MoveUp, Scale, Sparkles } from 'lucide-react';
import MetricCard from '../components/MetricCard';
import ScoreRing from '../components/ScoreRing';
import TrendChart from '../components/TrendChart';
import AlertCard, { StableCard } from '../components/AlertCard';

export default function PatientDashboard({ dashboard, trends, alerts, setView, onReview }) {
  const metrics = dashboard.metrics || {};
  return (
    <div className="page">
      <div className="hero-row">
        <div>
          <span className="eyebrow">Sunday, September 14</span>
          <h1>Good evening, Raj <span className="wave">👋</span></h1>
          <p>Let’s keep your recovery visible. Your latest functional check is trending upward.</p>
        </div>
        <button className="primary large" onClick={() => setView('assessment')}><ClipboardCheck size={18} /> Start today’s check</button>
      </div>

      <div className="dashboard-grid top-grid">
        <section className="card score-card">
          <div className="card-head"><div><span className="eyebrow">Today’s snapshot</span><h3>Functional performance</h3></div><span className="soft-badge green"><Sparkles size={13} /> Improving</span></div>
          <ScoreRing score={dashboard.summary.functionalScore} change={dashboard.summary.change} />
          <div className="score-note"><strong>Better than your recent baseline</strong><span>NeuroGuard compares you with your own previous sessions — not a generic population average.</span></div>
        </section>

        <section className="metric-grid">
          <MetricCard label="Movement" value={metrics.Movement?.value ?? 82} change={metrics.Movement?.change ?? 10} icon={MoveUp} tone="teal" />
          <MetricCard label="Balance" value={metrics.Balance?.value ?? 71} change={metrics.Balance?.change ?? 4} icon={Scale} />
          <MetricCard label="Coordination" value={metrics.Coordination?.value ?? 76} change={metrics.Coordination?.change ?? 6} icon={Hand} />
          <MetricCard label="Speech" value={metrics.Speech?.value ?? 84} change={metrics.Speech?.change ?? 0} icon={Mic2} />
        </section>
      </div>

      <div className="dashboard-grid main-grid">
        <section className="card wide">
          <div className="card-head"><div><span className="eyebrow">Personal baseline</span><h3>Recovery trend</h3></div><button className="link-button" onClick={() => setView('progress')}>View full history</button></div>
          <div className="chart-caption"><span><i className="legend-dot" /> Functional performance</span><span>Baseline window: last 5 comparable sessions</span></div>
          <TrendChart data={trends} />
        </section>

        <section className="card">
          <div className="card-head"><div><span className="eyebrow">Today</span><h3>Check-in status</h3></div><Activity size={18} className="muted" /></div>
          <div className="checklist">
            <div className="check-row done"><span>1</span><div><strong>Camera check</strong><small>Head, shoulders, hands, feet visible</small></div><b>Done</b></div>
            <div className="check-row pending"><span>2</span><div><strong>Movement assessment</strong><small>Arm raise · ~2 min</small></div><button onClick={() => setView('assessment')}>Start</button></div>
            <div className="check-row optional"><span>3</span><div><strong>Speech assessment</strong><small>Optional · ~30 sec</small></div><b>Optional</b></div>
          </div>
          <div className="mini-note"><ShieldNote /> <span>Raw camera frames are never stored.</span></div>
        </section>
      </div>

      <section className="card alert-section">
        <div className="card-head"><div><span className="eyebrow">Attention</span><h3>What NeuroGuard noticed</h3></div><span className="soft-badge">Explainable alerts</span></div>
        {alerts.length ? alerts.map((alert) => <AlertCard key={alert.id} alert={alert} onReview={onReview} />) : <StableCard />}
      </section>
    </div>
  );
}

function ShieldNote() {
  return <span className="shield-note">✓</span>;
}
