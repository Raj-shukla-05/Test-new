import React from 'react';
import { ArrowDownRight, ArrowUpRight, CalendarDays, Download, Info } from 'lucide-react';
import TrendChart from '../components/TrendChart';

export default function ProgressPage({ trends }) {
  const first = trends[0]?.score || 70;
  const latest = trends[trends.length - 1]?.score || 79;
  const change = latest - first;
  return (
    <div className="page">
      <div className="hero-row"><div><span className="eyebrow">Longitudinal view</span><h1>Your recovery trend</h1><p>NeuroGuard focuses on meaningful change across repeated sessions.</p></div><button className="secondary"><Download size={17} /> Export summary</button></div>
      <div className="stats-strip">
        <div><span>Current score</span><strong>{latest}/100</strong></div>
        <div><span>Since first check</span><strong className={change >= 0 ? 'positive' : 'negative'}>{change >= 0 ? '+' : ''}{change} points</strong></div>
        <div><span>Sessions tracked</span><strong>{trends.length}</strong></div>
        <div><span>Baseline window</span><strong>5 sessions</strong></div>
      </div>
      <section className="card wide">
        <div className="card-head"><div><span className="eyebrow">Day 1 → Day 21</span><h3>Functional performance</h3></div><div className="trend-pill"><ArrowUpRight size={15} /> {Math.abs(change)} points</div></div>
        <TrendChart data={trends} />
        <div className="insight-box"><Info size={18} /><div><strong>Why this is more useful than a single score</strong><span>NeuroGuard can show a persistent pattern relative to Raj’s own recent performance rather than comparing him to a generic population average.</span></div></div>
      </section>
      <div className="history-grid">
        {trends.slice().reverse().slice(0, 5).map((item) => (
          <div className="history-card" key={item.day}>
            <div><span>{item.day}</span><small>{item.date}</small></div>
            <strong>{item.score}</strong>
            <span className="history-trend">{item.score >= 75 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />} {item.score >= 75 ? 'On track' : 'Needs attention'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
