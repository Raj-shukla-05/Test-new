import React from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from 'lucide-react';

function Trend({ value }) {
  const numeric = Number(value || 0);
  if (numeric > 0.5) return <span className="trend positive"><ArrowUpRight size={14} /> {Math.abs(numeric).toFixed(0)}%</span>;
  if (numeric < -0.5) return <span className="trend negative"><ArrowDownRight size={14} /> {Math.abs(numeric).toFixed(0)}%</span>;
  return <span className="trend neutral"><ArrowRight size={14} /> Stable</span>;
}

export default function MetricCard({ label, value, change, icon: Icon, tone = 'default' }) {
  return (
    <div className={`metric-card ${tone}`}>
      <div className="metric-icon"><Icon size={18} /></div>
      <div className="metric-top"><span>{label}</span><Trend value={change} /></div>
      <strong>{value}</strong>
      <small>vs. recent baseline</small>
    </div>
  );
}
