import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, ArrowDownRight, ArrowUpRight, CheckCircle2, LoaderCircle,
  Search, UsersRound, Sparkles, ShieldCheck, PlusCircle, Calendar,
  Clock, Check, X, FileText, Send, Ban
} from 'lucide-react';
import TrendChart from '../components/TrendChart';
import AlertCard, { StableCard } from '../components/AlertCard';
import { api } from '../lib/api';

const DEFAULT_INSTRUCTIONS = {
  arm_raise: 'Perform 5 slow, bilateral arm raises in the morning. Keep shoulders level and pause at highest comfortable elevation.',
  sit_to_stand: 'Complete 5 repetitions from a stable chair with arms crossed over chest. Focus on smooth, balanced ascent and descent.',
  seated_reach: 'Perform 5 controlled forward reaches from an upright seated posture. Maintain core stability throughout.',
};

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'review', label: 'Review recommended' },
  { id: 'monitor', label: 'Monitor' },
  { id: 'stable', label: 'Stable' },
];
const STATUS_LABEL = { review: 'Review recommended', monitor: 'Monitor', stable: 'Stable' };
const STATUS_ORDER = { review: 0, monitor: 1, stable: 2 };

export default function DoctorPage({ doctor }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.doctorPatients(doctor.id)
      .then((list) => { if (!cancelled) setPatients(list); })
      .catch(() => { if (!cancelled) setError('Could not load patients. Make sure the backend is running.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [doctor.id]);

  const counts = useMemo(() => ({
    all: patients.length,
    review: patients.filter((p) => p.status === 'review').length,
    monitor: patients.filter((p) => p.status === 'monitor').length,
    stable: patients.filter((p) => p.status === 'stable').length,
  }), [patients]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return patients
      .filter((p) => (filter === 'all' || p.status === filter) && (!q || p.name.toLowerCase().includes(q)))
      .sort((a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3) || a.name.localeCompare(b.name));
  }, [patients, query, filter]);

  const selected = patients.find((p) => p.id === selectedId);

  return (
    <div className="page">
      <div className="hero-row">
        <div>
          <span className="eyebrow">Doctor panel</span>
          <h1>{doctor.name}</h1>
          <p>All patients under your care, ordered by who most needs attention first. Findings are functional-monitoring signals, not diagnoses.</p>
        </div>
      </div>
      <section className="patient-summary-row doctor-summary">
        <div className="summary-tile"><UsersRound size={18} /><div><strong>{counts.all}</strong><span>Total patients</span></div></div>
        <div className="summary-tile review"><AlertCircle size={18} /><div><strong>{counts.review}</strong><span>Review recommended</span></div></div>
        <div className="summary-tile monitor"><AlertCircle size={18} /><div><strong>{counts.monitor}</strong><span>Monitor</span></div></div>
        <div className="summary-tile stable"><CheckCircle2 size={18} /><div><strong>{counts.stable}</strong><span>Stable</span></div></div>
      </section>
      <div className="caregiver-layout">
        <section className="card wide">
          <div className="card-head"><div><span className="eyebrow">Patient list</span><h3>All patients</h3></div></div>
          <div className="doctor-toolbar">
            <div className="search-box"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search patients by name…" aria-label="Search patients" /></div>
            <div className="filter-chips">
              {FILTERS.map((f) => (
                <button key={f.id} type="button" className={filter === f.id ? 'active' : ''} onClick={() => setFilter(f.id)}>{f.label} <b>{counts[f.id]}</b></button>
              ))}
            </div>
          </div>
          {loading && <div className="loading-bar"><LoaderCircle size={15} className="spin" /> Loading patients…</div>}
          {error && <div className="login-error" role="alert">{error}</div>}
          {!loading && !error && !visible.length && <p className="empty-note">No patients match your search.</p>}
          <div className="patient-table">
            {visible.map((p) => {
              const change = Number(p.change) || 0;
              return (
                <div key={p.id} className={`patient-row ${p.id === selectedId ? 'selected' : ''}`}>
                  <div className="patient-person"><div className="avatar">{p.name[0]}</div><div><strong>{p.name}</strong><span>{p.age ? `Age ${p.age} · ` : ''}{p.sessions} session{p.sessions === 1 ? '' : 's'} · {p.lastCheck}</span></div></div>
                  <div className="patient-score"><strong>{p.score}</strong><span>/100</span></div>
                  <div className={`status-badge ${p.status}`}><span /> {STATUS_LABEL[p.status] || p.status}</div>
                  <span className={change >= 0 ? 'positive' : 'negative'}>{change >= 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />} {Math.abs(change)}%</span>
                  <button className="table-button" onClick={() => setSelectedId(p.id)}>View</button>
                </div>
              );
            })}
          </div>
        </section>
        <PatientDetail patient={selected} />
      </div>
    </div>
  );
}

function PatientDetail({ patient }) {
  const [trends, setTrends] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [explanation, setExplanation] = useState(null);
  const [busy, setBusy] = useState(false);

  // Assignment Creation Form State
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [exerciseType, setExerciseType] = useState('arm_raise');
  const [instructions, setInstructions] = useState(DEFAULT_INSTRUCTIONS.arm_raise);
  const [targetReps, setTargetReps] = useState(5);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Review Form State
  const [reviewingId, setReviewingId] = useState(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const loadPatientData = () => {
    if (!patient) return;
    setBusy(true);

    // Fetch actual patient dashboard to get grounded metric data before requesting explanation.
    const dashboardPromise = api.dashboard(patient.id).catch(() => null);

    Promise.all([
      api.trends(patient.id),
      api.alerts(patient.id),
      api.patientAssignments(patient.id),
      dashboardPromise,
    ])
      .then(([t, a, asgns, dashData]) => {
        setTrends(t || []);
        setAlerts(a || []);
        setAssignments(asgns || []);

        // Build explanation findings from actual dashboard metrics, not the patient-list summary.
        const dm = dashData?.metrics || {};
        const measured_metrics = [];
        const findings = {
          trend: patient.status === 'review' ? 'persistent_decline' : (patient.status || 'stable'),
          baseline_sessions: dashData?.baseline?.window ?? null,
          exercise_type: dashData?.summary?.exerciseType || null,
          details: `Clinical review for ${patient.name}. Status: ${patient.status}.`,
        };

        if (dm.Movement?.measured && dm.Movement.change !== null) {
          findings.movement_change = dm.Movement.change;
          measured_metrics.push('movement');
        }
        if (dm.Balance?.measured && dm.Balance.change !== null) {
          findings.balance_change = dm.Balance.change;
          measured_metrics.push('balance');
        }
        if (dm.Speech?.measured && dm.Speech.change !== null) {
          findings.speech_change = dm.Speech.change;
          measured_metrics.push('speech');
        }
        findings.measured_metrics = measured_metrics;

        return api.explanation(findings)
          .catch(() => ({ source: 'failed', text: 'AI summary is temporarily unavailable. Baseline metrics remain active.' }));
      })
      .then((exp) => {
        setExplanation(exp);
      })
      .catch(() => {
        setTrends([]);
        setAlerts([]);
        setAssignments([]);
        setExplanation(null);
      })
      .finally(() => setBusy(false));
  };

  useEffect(() => {
    setShowAssignForm(false);
    setFormError('');
    setFormSuccess('');
    setReviewingId(null);
    loadPatientData();
  }, [patient?.id]);

  const handleExerciseChange = (type) => {
    setExerciseType(type);
    setInstructions(DEFAULT_INSTRUCTIONS[type] || '');
  };

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!instructions.trim()) {
      setFormError('Please enter clinical instructions for the patient.');
      return;
    }
    if (!dueDate) {
      setFormError('Please specify a valid due date.');
      return;
    }
    if (new Date(dueDate) < new Date(new Date().setHours(0, 0, 0, 0))) {
      setFormError('Due date cannot be in the past.');
      return;
    }

    setSubmitting(true);
    try {
      await api.createAssignment({
        patientId: patient.id,
        exerciseType,
        instructions: instructions.trim(),
        targetReps: Number(targetReps) || 5,
        dueDate: new Date(dueDate).toISOString(),
      });
      setFormSuccess('Assessment successfully assigned to patient.');
      setShowAssignForm(false);
      loadPatientData();
    } catch (err) {
      setFormError(err.message || 'Failed to create assignment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelAssignment = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this assigned protocol?')) return;
    try {
      await api.updateAssignmentStatus(id, { status: 'cancelled' });
      loadPatientData();
    } catch (err) {
      alert(err.message || 'Failed to cancel assignment');
    }
  };

  const handleReviewSession = async (assignmentId) => {
    if (!reviewNotes.trim()) {
      alert('Please provide clinical feedback or impression before approving.');
      return;
    }
    setReviewSubmitting(true);
    try {
      await api.updateAssignmentStatus(assignmentId, {
        status: 'reviewed',
        doctorNotes: reviewNotes.trim(),
      });
      setReviewingId(null);
      setReviewNotes('');
      loadPatientData();
    } catch (err) {
      alert(err.message || 'Failed to submit review');
    } finally {
      setReviewSubmitting(false);
    }
  };

  if (!patient) {
    return (
      <section className="card">
        <div className="card-head"><div><span className="eyebrow">Patient detail</span><h3>Select a patient</h3></div></div>
        <p className="empty-note">Choose “View” on a patient to see their trend and alerts.</p>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span className="eyebrow">{patient.name}</span>
          <h3>Clinical Management</h3>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {busy && <LoaderCircle size={16} className="spin" />}
          <button
            className="primary"
            style={{ fontSize: '0.825rem', padding: '0.4rem 0.75rem' }}
            onClick={() => { setShowAssignForm(!showAssignForm); setFormError(''); setFormSuccess(''); }}
          >
            <PlusCircle size={15} /> {showAssignForm ? 'Close Form' : 'Assign Assessment'}
          </button>
        </div>
      </div>

      {formSuccess && (
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', color: '#10b981', padding: '0.6rem 0.8rem', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '1rem' }}>
          ✓ {formSuccess}
        </div>
      )}

      {/* Assign Assessment Form */}
      {showAssignForm && (
        <form onSubmit={handleCreateAssignment} style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <strong style={{ fontSize: '0.95rem' }}>New Assessment Protocol</strong>
            <button type="button" className="icon-button" onClick={() => setShowAssignForm(false)} aria-label="Close"><X size={15} /></button>
          </div>

          {formError && <div className="login-error" style={{ marginBottom: '0.75rem' }}>{formError}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Protocol Type
              <select
                value={exerciseType}
                onChange={(e) => handleExerciseChange(e.target.value)}
                style={{ width: '100%', marginTop: '0.25rem', padding: '0.45rem', borderRadius: '6px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              >
                <option value="arm_raise">Arm Raise (Upper body ROM & symmetry)</option>
                <option value="sit_to_stand">Sit-to-Stand (Functional lower limb)</option>
                <option value="seated_reach">Seated Reach (Core stability & reach)</option>
              </select>
            </label>

            <label style={{ fontSize: '0.8rem', fontWeight: 600 }}>Target Repetitions
              <input
                type="number"
                min="1"
                max="20"
                value={targetReps}
                onChange={(e) => setTargetReps(e.target.value)}
                style={{ width: '100%', marginTop: '0.25rem', padding: '0.45rem', borderRadius: '6px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
            </label>
          </div>

          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.75rem' }}>Due Date
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={{ width: '100%', marginTop: '0.25rem', padding: '0.45rem', borderRadius: '6px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
          </label>

          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.75rem' }}>Clinician Instructions
            <textarea
              rows="3"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Enter tailored guidance for the patient..."
              style={{ width: '100%', marginTop: '0.25rem', padding: '0.5rem', borderRadius: '6px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', resize: 'vertical' }}
            />
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
            <button type="button" className="secondary" onClick={() => setShowAssignForm(false)}>Cancel</button>
            <button type="submit" className="primary" disabled={submitting}>
              {submitting ? <LoaderCircle size={14} className="spin" /> : <Send size={14} />} Assign Protocol
            </button>
          </div>
        </form>
      )}

      {/* Assigned Protocols Section */}
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Assigned Protocols ({assignments.length})
          </span>
        </div>

        {assignments.length === 0 ? (
          <p className="empty-note">No protocols currently assigned to this patient.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {assignments.map((asgn) => {
              const isCompleted = asgn.status === 'completed';
              const isReviewed = asgn.status === 'reviewed';
              const isPending = asgn.status === 'assigned' || asgn.status === 'in_progress';
              const isReviewingThis = reviewingId === asgn.id;

              const exerciseTitle = asgn.exerciseType === 'arm_raise'
                ? 'Arm Raise'
                : asgn.exerciseType === 'sit_to_stand' ? 'Sit-to-Stand' : 'Seated Reach';

              return (
                <div
                  key={asgn.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                    <div>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{exerciseTitle}</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>Target: {asgn.targetReps} reps</span>
                    </div>
                    <span className={`status-badge ${asgn.status}`} style={{ textTransform: 'capitalize', fontSize: '0.7rem' }}>
                      {asgn.status.replace('_', ' ')}
                    </span>
                  </div>

                  <p style={{ margin: '0.25rem 0 0.5rem 0', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    {asgn.instructions}
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>Due: {new Date(asgn.dueDate).toLocaleDateString()}</span>
                    
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {isPending && (
                        <button
                          type="button"
                          className="table-button danger"
                          style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem' }}
                          onClick={() => handleCancelAssignment(asgn.id)}
                        >
                          <Ban size={11} /> Cancel
                        </button>
                      )}

                      {isCompleted && !isReviewingThis && (
                        <button
                          type="button"
                          className="table-button"
                          style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem', background: '#3b82f6', color: '#fff' }}
                          onClick={() => { setReviewingId(asgn.id); setReviewNotes(''); }}
                        >
                          <FileText size={11} /> Review Session
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Completed Session Details */}
                  {asgn.completedSession && (
                    <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.6rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', fontSize: '0.75rem', border: '1px dashed var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Completed on: {new Date(asgn.completedSession.timestamp).toLocaleDateString()}</span>
                        <strong>Score: {asgn.completedSession.score}/100</strong>
                      </div>
                      {asgn.completedSession.trackingQuality?.qualityWarning && (
                        <div style={{ color: '#f59e0b', marginTop: '0.2rem' }}>
                          ⚠️ {asgn.completedSession.trackingQuality.qualityWarning}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Doctor Review Notes Display */}
                  {isReviewed && asgn.doctorNotes && (
                    <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.6rem', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '6px', borderLeft: '3px solid #10b981', fontSize: '0.75rem' }}>
                      <strong style={{ color: '#10b981' }}>Clinician Review: </strong>
                      <span style={{ color: 'var(--text-primary)' }}>{asgn.doctorNotes}</span>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '0.2rem' }}>
                        Reviewed on {new Date(asgn.reviewedAt).toLocaleDateString()}
                      </div>
                    </div>
                  )}

                  {/* Review Input Box */}
                  {isReviewingThis && (
                    <div style={{ marginTop: '0.6rem', padding: '0.6rem', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', border: '1px solid #3b82f6' }}>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.3rem' }}>
                        Clinical Review Feedback
                        <textarea
                          rows="2"
                          value={reviewNotes}
                          onChange={(e) => setReviewNotes(e.target.value)}
                          placeholder="Document clinical impression and guidance..."
                          style={{ width: '100%', marginTop: '0.2rem', padding: '0.35rem', borderRadius: '4px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: '0.75rem' }}
                        />
                      </label>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', marginTop: '0.3rem' }}>
                        <button type="button" className="secondary" style={{ fontSize: '0.7rem', padding: '0.2rem 0.4rem' }} onClick={() => setReviewingId(null)}>Cancel</button>
                        <button
                          type="button"
                          className="primary"
                          style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
                          disabled={reviewSubmitting}
                          onClick={() => handleReviewSession(asgn.id)}
                        >
                          {reviewSubmitting ? <LoaderCircle size={11} className="spin" /> : <Check size={11} />} Approve & Sign Off
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card-head" style={{ marginTop: '1.25rem' }}>
        <div><span className="eyebrow">Recovery Trend</span><h3>Performance Progression</h3></div>
      </div>
      {trends.length ? <TrendChart data={trends} compact /> : <p className="empty-note">No sessions recorded yet.</p>}
      
      {explanation?.text && (
        <div style={{ marginTop: '1rem', padding: '0.85rem', background: 'rgba(255,255,255,0.04)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>AI Longitudinal Summary</span>
            <span className="soft-badge" style={{ fontSize: '0.7rem' }}>
              <Sparkles size={11} /> {
                explanation.source === 'gemini'
                  ? 'Gemini AI'
                  : explanation.source === 'local-fallback'
                    ? 'Local Fallback'
                    : (explanation.source === 'failed' ? 'Unavailable' : 'Baseline Engine')
              }
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.875rem', lineHeight: 1.5, color: 'var(--text-primary)' }}>{explanation.text}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
            <ShieldCheck size={12} />
            <span>Assistive functional summary; clinical decisions must be made independently.</span>
          </div>
        </div>
      )}

      <div className="alert-section" style={{ marginTop: '1rem' }}>
        {alerts.length ? alerts.map((a) => <AlertCard key={a.id} alert={a} onReview={() => {}} />) : (trends.length ? <StableCard /> : null)}
      </div>
    </section>
  );
}
