import React from 'react';
import { AlertCircle, ArrowDownRight, ArrowUpRight, CheckCircle2, Eye, MessageCircle, UserRound } from 'lucide-react';
import TrendChart from '../components/TrendChart';

const fallbackPatients = [
  { id: 'user-raj', name: 'Raj Kumar', age: 58, status: 'stable', score: 79, change: 9.7, lastCheck: 'Today, 10:42 AM' },
  { id: 'user-anita', name: 'Anita Sharma', age: 63, status: 'monitor', score: 72, change: -7.2, lastCheck: 'Yesterday, 6:18 PM' },
  { id: 'user-mohan', name: 'Mohan Singh', age: 66, status: 'review', score: 68, change: -13, lastCheck: 'Yesterday, 4:05 PM' },
];

export default function CaregiverPage({ trends, patients = fallbackPatients, onReview }) {
  return (
    <div className="page">
      <div className="hero-row"><div><span className="eyebrow">Caregiver view</span><h1>Good evening, Anita</h1><p>A simple view of who is stable, who needs monitoring, and where a persistent change is developing.</p></div><button className="secondary"><MessageCircle size={17} /> Contact care team</button></div>
      <section className="patient-summary-row">
        <div className="summary-tile stable"><CheckCircle2 size={18} /><div><strong>{patients.filter((p) => p.status === 'stable').length}</strong><span>Stable</span></div></div>
        <div className="summary-tile monitor"><AlertCircle size={18} /><div><strong>{patients.filter((p) => p.status === 'monitor').length}</strong><span>Monitor</span></div></div>
        <div className="summary-tile review"><AlertCircle size={18} /><div><strong>{patients.filter((p) => p.status === 'review').length}</strong><span>Review recommended</span></div></div>
      </section>
      <div className="caregiver-layout">
        <section className="card wide">
          <div className="card-head"><div><span className="eyebrow">Patient list</span><h3>Recovery status</h3></div><span className="soft-badge green">3 active patients</span></div>
          <div className="patient-table">
            {patients.map((patient) => <PatientRow key={patient.id} patient={patient} onReview={onReview} />)}
          </div>
        </section>
        <section className="card">
          <div className="card-head"><div><span className="eyebrow">Raj Kumar</span><h3>Recent trend</h3></div><Eye size={18} className="muted" /></div>
          <TrendChart data={trends} compact />
          <div className="care-insight"><strong>Improving</strong><span>Movement is up 10% versus the recent baseline.</span></div>
        </section>
      </div>
    </div>
  );
}

function PatientRow({ patient, onReview }) {
  const statusLabel = patient.status === 'review' ? 'Review recommended' : patient.status === 'monitor' ? 'Monitor' : 'Stable';
  return (
    <div className="patient-row">
      <div className="patient-person"><div className="avatar">{patient.name[0]}</div><div><strong>{patient.name}</strong><span>Age {patient.age} · Last check {patient.lastCheck}</span></div></div>
      <div className="patient-score"><strong>{patient.score}</strong><span>/100</span></div>
      <div className={`status-badge ${patient.status}`}><span /> {statusLabel}</div>
      <span className={patient.change >= 0 ? 'positive' : 'negative'}>{patient.change >= 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />} {Math.abs(patient.change)}%</span>
      <button className="table-button" onClick={() => onReview?.(patient)}>View</button>
    </div>
  );
}
