import React from 'react';
import { Bell, ChevronDown, HelpCircle, LogOut, Search } from 'lucide-react';

export default function Topbar({ role, setRole, onLogout, userName, systemStatus }) {
  const isMongoConnected = systemStatus?.database === 'connected';
  const isInMemory = systemStatus?.database === 'in-memory';

  return (
    <header className="topbar">
      <div className="topbar-title">
        <span className="eyebrow">Home recovery monitoring</span>
        <div
          className={`live-chip ${isInMemory ? 'warning' : ''}`}
          style={isInMemory ? { background: 'rgba(234, 179, 8, 0.12)', borderColor: 'rgba(234, 179, 8, 0.3)', color: '#eab308' } : undefined}
          title={isMongoConnected ? 'All sessions are permanently persisted in MongoDB' : 'Running in resilient session mode; data held in memory'}
        >
          <span style={isInMemory ? { background: '#eab308' } : undefined} />
          {isMongoConnected ? 'System operational · MongoDB connected' : (isInMemory ? 'Session mode · In-memory (DB offline)' : 'System operational')}
        </div>
      </div>
      <div className="topbar-actions">
        <div className="search-box"><Search size={17} /><input placeholder="Search patients, sessions…" /></div>
        <button className="icon-button"><HelpCircle size={18} /></button>
        <button className="icon-button notification"><Bell size={18} /><b /></button>
        <button className="profile-menu" onClick={() => setRole(role === 'patient' ? 'caregiver' : 'patient')}>
          <span className="avatar small">{(userName || (role === 'patient' ? 'R' : 'A')).charAt(0).toUpperCase()}</span>
          <span>{userName || (role === 'patient' ? 'Raj Kumar' : 'Anita Sharma')}</span>
          <ChevronDown size={15} />
        </button>
        <button className="icon-button" onClick={onLogout} title="Sign out" aria-label="Sign out"><LogOut size={18} /></button>
      </div>
    </header>
  );
}
