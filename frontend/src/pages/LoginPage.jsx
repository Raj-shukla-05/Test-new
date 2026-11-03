import React, { useState } from 'react';
import { LoaderCircle, LogIn, ShieldCheck, UserPlus } from 'lucide-react';
import { Logo } from '../components/Logo';
import { api } from '../lib/api';

const DEMO_ACCOUNTS = [
  { label: 'Patient — Raj Kumar', email: 'raj@neuroguard.demo', password: 'patient123' },
  { label: 'Caregiver — Anita Sharma', email: 'anita@neuroguard.demo', password: 'caregiver123' },
  { label: 'Doctor — Dr. Priya Nair', email: 'priya@neuroguard.demo', password: 'doctor123' },
];

export default function LoginPage({ onLogin }) {
  const [mode, setMode] = useState('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [role, setRole] = useState('patient');
  const [specialization, setSpecialization] = useState('Neurology');
  const [clinicName, setClinicName] = useState('');
  const [clinicCity, setClinicCity] = useState('');
  const [consultationFee, setConsultationFee] = useState('1000');
  const [experienceYears, setExperienceYears] = useState('5');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const signup = mode === 'signup';

  const switchMode = (next) => { setMode(next); setError(''); setPassword(''); setConfirm(''); };

  const fillDemo = (account) => {
    setEmail(account.email);
    setPassword(account.password);
    setError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    const mail = email;
    const pass = password;
    if (!mail.trim() || !pass) { setError('Enter your email and password.'); return; }
    if (signup) {
      if (!name.trim()) { setError('Enter your full name.'); return; }
      if (pass.length < 8) { setError('Password must be at least 8 characters.'); return; }
      if (pass !== confirm) { setError('Passwords do not match.'); return; }
    }
    setBusy(true);
    setError('');
    try {
      const payload = { name: name.trim(), email: mail, password: pass, role };
      if (signup && role === 'doctor') {
        payload.specialization = specialization;
        if (clinicName.trim() || clinicCity.trim()) {
          payload.clinic = {
            name: clinicName.trim() || undefined,
            city: clinicCity.trim() || undefined,
          };
        }
        if (consultationFee) payload.consultationFee = Number(consultationFee);
        if (experienceYears) payload.experienceYears = Number(experienceYears);
      }
      const { user, token } = signup
        ? await api.signup(payload)
        : await api.login(mail, pass);
      onLogin(user, token);
    } catch (err) {
      if (err instanceof TypeError) setError('Cannot reach the server. Make sure the backend is running.');
      else setError(err.status === 401 ? 'Invalid email or password.' : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-shell">
      <form
        className="login-card"
        onSubmit={submit}
        noValidate
        style={{ maxWidth: signup && role === 'doctor' ? 480 : 400 }}
      >
        <Logo />
        <h1>{signup ? 'Create your account' : 'Welcome back'}</h1>
        <p>{signup ? 'Set up NeuroGuard to start monitoring recovery.' : 'Sign in to continue your recovery monitoring.'}</p>
        {signup && (
          <>
            <div className="role-toggle" role="radiogroup" aria-label="Account type" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {['patient', 'caregiver', 'doctor'].map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={role === r}
                  className={role === r ? 'active' : ''}
                  onClick={() => setRole(r)}
                >
                  {r === 'patient' ? 'Patient' : r === 'caregiver' ? 'Caregiver' : 'Doctor'}
                </button>
              ))}
            </div>
            <label>Full name
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder={role === 'doctor' ? 'e.g. Sanjay Gupta' : 'Your name'} />
            </label>
            {role === 'doctor' && (
              <>
                <label>Specialization
                  <select
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    style={{ border: '1px solid #dce7e7', borderRadius: 10, padding: '11px 12px', fontSize: 14, background: 'var(--surface)' }}
                  >
                    <option value="Neurology">Neurology</option>
                    <option value="Physical Medicine and Rehabilitation">Physical Medicine & Rehabilitation</option>
                    <option value="Physiotherapy">Physiotherapy</option>
                    <option value="Occupational Therapy">Occupational Therapy</option>
                    <option value="Speech and Language Therapy">Speech & Language Therapy</option>
                    <option value="Neurorehabilitation">Neurorehabilitation</option>
                  </select>
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label>Clinic Name
                    <input value={clinicName} onChange={(e) => setClinicName(e.target.value)} placeholder="e.g. Apex Neuro Center" />
                  </label>
                  <label>City
                    <input value={clinicCity} onChange={(e) => setClinicCity(e.target.value)} placeholder="e.g. Mumbai" />
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label>Consultation Fee (₹)
                    <input type="number" min="0" value={consultationFee} onChange={(e) => setConsultationFee(e.target.value)} placeholder="1000" />
                  </label>
                  <label>Experience (Years)
                    <input type="number" min="0" value={experienceYears} onChange={(e) => setExperienceYears(e.target.value)} placeholder="5" />
                  </label>
                </div>
              </>
            )}
          </>
        )}
        <label>Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" placeholder="you@example.com" />
        </label>
        <label>Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={signup ? 'new-password' : 'current-password'} placeholder={signup ? 'At least 8 characters' : '••••••••'} />
        </label>
        {signup && (
          <label>Confirm password
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" placeholder="Repeat password" />
          </label>
        )}
        {error && <div className="login-error" role="alert">{error}</div>}
        <button className="primary large" type="submit" disabled={busy}>
          {busy ? <LoaderCircle size={15} className="spin" /> : signup ? <UserPlus size={15} /> : <LogIn size={15} />} {signup ? 'Create account' : 'Sign in'}
        </button>
        <div className="login-switch">
          {signup ? 'Already have an account?' : 'New to NeuroGuard?'}{' '}
          <button type="button" onClick={() => switchMode(signup ? 'signin' : 'signup')}>{signup ? 'Sign in' : 'Create an account'}</button>
        </div>
        {!signup && (
          <div className="login-demo">
            <span>Demo accounts</span>
            {DEMO_ACCOUNTS.map((a) => (
              <button key={a.email} type="button" className="secondary" disabled={busy} onClick={() => fillDemo(a)}>{a.label}</button>
            ))}
          </div>
        )}
      </form>
    </div>
  );
}
