import React from 'react';
import { ArrowRight, BellRing, CheckCircle2 } from 'lucide-react';

export default function AlertCard({ alert, onReview }) {
  const color = alert.severity === 'review' ? 'orange' : alert.severity === 'urgent' ? 'red' : 'yellow';
  return (
    <div className={`alert-card ${color}`}>
      <div className="alert-icon"><BellRing size={17} /></div>
      <div className="alert-body">
        <div className="alert-title"><strong>{alert.type}</strong><span>{alert.timestamp}</span></div>
        <p>{alert.reason}</p>
        <button onClick={onReview}>{alert.action || 'Review change'} <ArrowRight size={14} /></button>
      </div>
    </div>
  );
}

export function StableCard() {
  return (
    <div className="stable-card">
      <CheckCircle2 size={19} />
      <div><strong>No concerning persistent change</strong><span>Your latest check is within the expected variation of your personal baseline.</span></div>
    </div>
  );
}
