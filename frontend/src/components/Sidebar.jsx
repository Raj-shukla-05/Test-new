import React from 'react';
import {
  Activity, Bell, HeartPulse, LayoutDashboard, LineChart, Settings, ShieldCheck,
  Stethoscope, UserRound, UsersRound, Video,
} from 'lucide-react';
import { Logo } from './Logo';

export default function Sidebar({ view, setView, role, userName, onDemoDecline }) {
  const patientItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'assessment', label: 'Today’s Check', icon: Video },
    { id: 'progress', label: 'My Progress', icon: LineChart },
  ];
  const caregiverItems = [
    { id: 'caregiver', label: 'Patients', icon: UsersRound },
    { id: 'progress', label: 'Trend View', icon: LineChart },
  ];
  const doctorItems = [{ id: 'doctor', label: 'All patients', icon: UsersRound }];
  const items = role === 'doctor' ? doctorItems : role === 'caregiver' ? caregiverItems : patientItems;

  return (
    <aside className="sidebar">
      <Logo />
      <div className="nav-label">Workspace</div>
      <nav>
        {items.map(({ id, label, icon: Icon }) => (
          <button key={id} className={`nav-item ${view === id ? 'active' : ''}`} onClick={() => setView(id)}>
            <Icon size={19} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-spacer" />
      <div className="safety-card">
        <ShieldCheck size={18} />
        <div><strong>Privacy first</strong><span>Camera frames stay on device.</span></div>
      </div>
      <button className="nav-item" onClick={() => setView('settings')}><Settings size={19} /><span>Settings</span></button>
      {role !== 'doctor' && <button className="demo-link" onClick={onDemoDecline}><Activity size={16} /> Load decline demo</button>}
      <div className="sidebar-footer">
        <div className="avatar">{(userName || 'U').replace(/^Dr\.?\s*/, '').charAt(0).toUpperCase()}</div>
        <div><strong>{userName || (role === 'caregiver' ? 'Anita Sharma' : 'Raj Kumar')}</strong><span>{role === 'doctor' ? 'Doctor account' : role === 'caregiver' ? 'Caregiver account' : 'Patient account'}</span></div>
        <Stethoscope size={16} />
      </div>
    </aside>
  );
}
