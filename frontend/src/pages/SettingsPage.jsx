import React from 'react';
import { Check, LockKeyhole, ShieldCheck } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="page">
      <div className="hero-row compact"><div><span className="eyebrow">Privacy & safety</span><h1>Designed around data minimization</h1><p>NeuroGuard stores functional metrics, not a permanent library of patient videos.</p></div></div>
      <div className="settings-grid">
        <section className="card"><div className="card-head"><div><span className="eyebrow">Data controls</span><h3>Your choices</h3></div><ShieldCheck size={19} className="muted" /></div>
          <SettingRow title="Store assessment metrics" desc="Scores, exercise type, timestamps and feature summaries" enabled />
          <SettingRow title="Store raw assessment video" desc="Disabled by default — no raw video is sent to the backend" />
          <SettingRow title="Allow caregiver access" desc="Share selected functional trends and alerts" enabled />
        </section>
        <section className="card"><div className="card-head"><div><span className="eyebrow">Safety boundary</span><h3>What NeuroGuard does not do</h3></div><LockKeyhole size={19} className="muted" /></div>
          <ul className="clean-list"><li><Check size={16} /> Does not diagnose disease</li><li><Check size={16} /> Does not prescribe treatment</li><li><Check size={16} /> Does not generate free-form exercise prescriptions</li><li><Check size={16} /> Does not use an LLM to decide urgent safety status</li></ul>
          <div className="legal-note">Prototype thresholds are product thresholds, not clinically validated medical thresholds.</div>
        </section>
      </div>
    </div>
  );
}

function SettingRow({ title, desc, enabled }) {
  return <div className="setting-row"><div><strong>{title}</strong><span>{desc}</span></div><span className={`toggle ${enabled ? 'on' : ''}`}><b /></span></div>;
}
