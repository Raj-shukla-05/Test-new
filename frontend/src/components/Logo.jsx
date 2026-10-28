import React from 'react';

export function Logo({ compact = false }) {
  return (
    <div className={`brand ${compact ? 'brand-compact' : ''}`}>
      <div className="brand-mark"><span /><span /><span /></div>
      {!compact && <div><strong>NeuroGuard</strong><small>AI recovery monitor</small></div>}
    </div>
  );
}
