import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowDownRight, ArrowUpRight, CheckCircle2, LoaderCircle, Search, UsersRound } from 'lucide-react';
import TrendChart from '../components/TrendChart';
import AlertCard, { StableCard } from '../components/AlertCard';
import { api } from '../lib/api';

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
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!patient) return undefined;
    let cancelled = false;
    setBusy(true);
    Promise.all([api.trends(patient.id), api.alerts(patient.id)])
      .then(([t, a]) => { if (!cancelled) { setTrends(t); setAlerts(a); } })
      .catch(() => { if (!cancelled) { setTrends([]); setAlerts([]); } })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [patient?.id]);

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
      <div className="card-head"><div><span className="eyebrow">{patient.name}</span><h3>Recent trend</h3></div>{busy && <LoaderCircle size={16} className="spin" />}</div>
      {trends.length ? <TrendChart data={trends} compact /> : <p className="empty-note">No sessions recorded yet.</p>}
      <div className="alert-section">
        {alerts.length ? alerts.map((a) => <AlertCard key={a.id} alert={a} onReview={() => {}} />) : (trends.length ? <StableCard /> : null)}
      </div>
    </section>
  );
}
