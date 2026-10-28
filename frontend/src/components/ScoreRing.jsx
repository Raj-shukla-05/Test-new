import React from 'react';

export default function ScoreRing({ score = 79, label = 'Functional performance', change = 0 }) {
  const value = Math.max(0, Math.min(100, Number(score)));
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className="score-ring-wrap">
      <svg viewBox="0 0 128 128" className="score-ring">
        <circle cx="64" cy="64" r={radius} className="ring-track" />
        <circle cx="64" cy="64" r={radius} className="ring-value" strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <div className="score-center"><strong>{value}</strong><span>/ 100</span></div>
      <div className="score-label"><strong>{label}</strong><span className={change >= 0 ? 'positive' : 'negative'}>{change >= 0 ? '↑' : '↓'} {Math.abs(change).toFixed(1)}% vs baseline</span></div>
    </div>
  );
}
