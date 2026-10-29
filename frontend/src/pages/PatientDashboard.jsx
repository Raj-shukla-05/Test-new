import React, { useEffect, useState } from 'react';
import {
  Activity, ClipboardCheck, Hand, Mic2, MoveUp, Scale, Sparkles,
  ShieldCheck, LoaderCircle, FileText, Calendar, Clock, ArrowRight,
  CheckCircle2, AlertCircle
} from 'lucide-react';
import MetricCard from '../components/MetricCard';
import ScoreRing from '../components/ScoreRing';
import TrendChart from '../components/TrendChart';
import AlertCard, { StableCard } from '../components/AlertCard';
import { api } from '../lib/api';

export default function PatientDashboard({ dashboard, trends, alerts, setView, onReview, onStartAssignment }) {
  const metrics = dashboard.metrics || {};
  const [explanation, setExplanation] = useState(null);
  const [explaining, setExplaining] = useState(false);
  const [assignments, setAssignments] = useState([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);

  const userId = dashboard.user?.id;

  const loadAssignments = () => {
    if (!userId) return;
    setLoadingAssignments(true);
    api.patientAssignments(userId)
      .then((list) => setAssignments(list || []))
      .catch(() => setAssignments([]))
      .finally(() => setLoadingAssignments(false));
  };

  useEffect(() => {
    loadAssignments();
  }, [userId, trends.length]);

  useEffect(() => {
    let cancelled = false;
    setExplaining(true);

    // Only send metrics that were actually measured (metric.measured === true and change !== null).
    // This prevents the model from receiving fabricated deviations for unmeasured dimensions.
    const measured_metrics = [];
    const findings = {
      trend: dashboard.summary?.trend?.toLowerCase() || 'stable',
      baseline_sessions: dashboard.baseline?.window ?? 0,
      exercise_type: dashboard.summary?.exerciseType || null,
    };

    if (metrics.Movement?.measured && metrics.Movement.change !== null) {
      findings.movement_change = metrics.Movement.change;
      measured_metrics.push('movement');
    }
    if (metrics.Balance?.measured && metrics.Balance.change !== null) {
      findings.balance_change = metrics.Balance.change;
      measured_metrics.push('balance');
    }
    if (metrics.Speech?.measured && metrics.Speech.change !== null) {
      findings.speech_change = metrics.Speech.change;
      measured_metrics.push('speech');
    }

    findings.measured_metrics = measured_metrics;
    findings.details = `Functional score: ${dashboard.summary?.functionalScore ?? 0}/100`;

    api.explanation(findings)
      .then((res) => {
        if (!cancelled && res?.text) {
          setExplanation(res);
        }
      })
      .catch(() => {
        if (!cancelled) setExplanation({ source: 'failed', text: '' });
      })
      .finally(() => {
        if (!cancelled) setExplaining(false);
      });

    return () => { cancelled = true; };
  }, [dashboard.summary?.functionalScore, dashboard.summary?.change, trends.length]);

  const activeAssignments = assignments.filter((a) => ['assigned', 'in_progress'].includes(a.status));
  const completedAssignments = assignments.filter((a) => ['completed', 'reviewed'].includes(a.status));

  return (
    <div className="page">
      <div className="hero-row">
        <div>
          <span className="eyebrow">Recovery Monitoring</span>
          <h1>Good day, {dashboard.user?.name || 'Patient'} <span className="wave">👋</span></h1>
          <p>Let’s keep your recovery visible. Your functional progress is compared against your personal baseline.</p>
        </div>
        <button className="primary large" onClick={() => setView('assessment')}><ClipboardCheck size={18} /> Start today’s check</button>
      </div>

      <div className="dashboard-grid top-grid">
        <section className="card score-card">
          <div className="card-head">
            <div><span className="eyebrow">Today’s snapshot</span><h3>Functional performance</h3></div>
            <span className="soft-badge green"><Sparkles size={13} /> {dashboard.summary?.trend || 'Stable'}</span>
          </div>
          <ScoreRing score={dashboard.summary?.functionalScore ?? 0} change={dashboard.summary?.change ?? 0} />
          <div className="score-note">
            <strong>Personal baseline comparison</strong>
            <span>NeuroGuard compares you with your own previous sessions — not a generic population average.</span>
          </div>
        </section>

        <section className="metric-grid">
          <MetricCard label="Movement" value={metrics.Movement?.value ?? 82} change={metrics.Movement?.change ?? 10} icon={MoveUp} tone="teal" />
          <MetricCard label="Balance" value={metrics.Balance?.value ?? 71} change={metrics.Balance?.change ?? 4} icon={Scale} />
          <MetricCard label="Coordination" value={metrics.Coordination?.value ?? 76} change={metrics.Coordination?.change ?? 6} icon={Hand} />
          <MetricCard label="Speech" value={metrics.Speech?.value ?? 84} change={metrics.Speech?.change ?? 0} icon={Mic2} />
        </section>
      </div>

      {/* Clinician Assigned Protocols Section */}
      <section className="card" style={{ marginTop: '1.25rem' }}>
        <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="eyebrow">Clinician Care Plan</span>
            <h3>Prescribed Functional Protocols</h3>
          </div>
          {loadingAssignments && <LoaderCircle size={15} className="spin" />}
        </div>

        {activeAssignments.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: activeAssignments.length > 1 ? '1fr 1fr' : '1fr', gap: '1rem', marginTop: '0.5rem' }}>
            {activeAssignments.map((asgn) => {
              const exerciseTitle = asgn.exerciseType === 'arm_raise'
                ? 'Arm Raise'
                : asgn.exerciseType === 'sit_to_stand' ? 'Sit-to-Stand' : 'Seated Reach';
              const daysLeft = Math.ceil((new Date(asgn.dueDate) - new Date()) / 86400000);

              return (
                <div
                  key={asgn.id}
                  style={{
                    background: 'rgba(59, 130, 246, 0.05)',
                    border: '1px solid rgba(59, 130, 246, 0.3)',
                    borderRadius: '8px',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{exerciseTitle}</strong>
                      <span className="soft-badge" style={{ fontSize: '0.725rem' }}>
                        <Clock size={12} /> {daysLeft > 0 ? `Due in ${daysLeft} days` : 'Due today'}
                      </span>
                    </div>

                    <p style={{ margin: '0.4rem 0 0.8rem 0', fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                      <strong>Instruction: </strong>{asgn.instructions}
                    </p>

                    <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: '0.8rem' }}>
                      Target: <strong>{asgn.targetReps} controlled reps</strong> • Due: {new Date(asgn.dueDate).toLocaleDateString()}
                    </div>
                  </div>

                  <button
                    className="primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={() => {
                      if (onStartAssignment) onStartAssignment(asgn);
                      else setView('assessment');
                    }}
                  >
                    Start Assigned Protocol <ArrowRight size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="empty-note" style={{ margin: '0.5rem 0' }}>
            No pending clinician assignments right now. You can still perform ad-hoc recovery checks anytime.
          </p>
        )}

        {/* Completed / Reviewed History */}
        {completedAssignments.length > 0 && (
          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '0.6rem' }}>
              Recently Completed Protocols
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {completedAssignments.slice(0, 3).map((asgn) => {
                const exerciseTitle = asgn.exerciseType === 'arm_raise' ? 'Arm Raise' : asgn.exerciseType;
                return (
                  <div
                    key={asgn.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      padding: '0.6rem 0.8rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <CheckCircle2 size={15} style={{ color: '#10b981' }} />
                        <strong style={{ fontSize: '0.85rem' }}>{exerciseTitle}</strong>
                        <span className={`status-badge ${asgn.status}`} style={{ fontSize: '0.675rem' }}>
                          {asgn.status === 'reviewed' ? 'Reviewed by Clinician' : 'Completed (Pending Doctor Review)'}
                        </span>
                      </div>
                      {asgn.doctorNotes && (
                        <p style={{ margin: '0.3rem 0 0 1.3rem', fontSize: '0.8rem', color: '#10b981' }}>
                          💬 Doctor Feedback: "{asgn.doctorNotes}"
                        </p>
                      )}
                    </div>
                    {asgn.completedSession && (
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        {asgn.completedSession.score}/100
                      </strong>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* AI Recovery Insight Card */}
      <section className="card" style={{ marginTop: '1.25rem' }}>
        <div className="card-head">
          <div>
            <span className="eyebrow">AI Rehabilitation Insights</span>
            <h3>Functional Analysis</h3>
          </div>
          <span className="soft-badge">
            <Sparkles size={13} /> {
              explanation?.source === 'gemini'
                ? 'Gemini AI'
                : explanation?.source === 'local-fallback'
                  ? 'Local Fallback'
                  : (explanation?.source === 'failed' ? 'Unavailable' : 'Personal Baseline Engine')
            }
          </span>
        </div>
        {explaining ? (
          <div className="loading-bar"><LoaderCircle size={15} className="spin" /> Generating functional explanation…</div>
        ) : explanation?.text ? (
          <p style={{ margin: '0.75rem 0', color: 'var(--text-primary)', lineHeight: 1.6 }}>{explanation.text}</p>
        ) : (
          <p className="empty-note">
            {explanation?.source === 'failed'
              ? 'AI explanation is temporarily unavailable. Local baseline tracking continues normally.'
              : 'Recovery measurements will be analyzed across your repeated sessions.'}
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
          <ShieldCheck size={14} />
          <span>Non-diagnostic rehabilitation observation. Consult your doctor for medical evaluations.</span>
        </div>
      </section>

      <div className="dashboard-grid main-grid" style={{ marginTop: '1.25rem' }}>
        <section className="card wide">
          <div className="card-head">
            <div><span className="eyebrow">Personal baseline</span><h3>Recovery trend</h3></div>
            <button className="link-button" onClick={() => setView('progress')}>View full history</button>
          </div>
          <div className="chart-caption">
            <span><i className="legend-dot" /> Functional performance</span>
            <span>{
              dashboard.baseline?.window > 0
                ? `Baseline window: last ${dashboard.baseline.window} comparable prior session${dashboard.baseline.window === 1 ? '' : 's'}`
                : 'Initial reference session (establishing baseline)'
            }</span>
          </div>
          <TrendChart data={trends} />
        </section>

        <section className="card">
          <div className="card-head"><div><span className="eyebrow">Today</span><h3>Check-in status</h3></div><Activity size={18} className="muted" /></div>
          <div className="checklist">
            <div className="check-row done"><span>1</span><div><strong>Camera check</strong><small>Head, shoulders, hands, feet visible</small></div><b>Done</b></div>
            <div className="check-row pending"><span>2</span><div><strong>Movement assessment</strong><small>Arm raise · ~2 min</small></div><button onClick={() => setView('assessment')}>Start</button></div>
            <div className="check-row optional"><span>3</span><div><strong>Speech assessment</strong><small>Optional · ~30 sec</small></div><b>Optional</b></div>
          </div>
          <div className="mini-note"><ShieldNote /> <span>Raw camera frames are processed locally and never stored.</span></div>
        </section>
      </div>

      <section className="card alert-section" style={{ marginTop: '1.25rem' }}>
        <div className="card-head"><div><span className="eyebrow">Attention</span><h3>What NeuroGuard noticed</h3></div><span className="soft-badge">Explainable alerts</span></div>
        {alerts.length ? alerts.map((alert) => <AlertCard key={alert.id} alert={alert} onReview={onReview} />) : <StableCard />}
      </section>
    </div>
  );
}

function ShieldNote() {
  return <span className="shield-note">✓</span>;
}
