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
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const signup = mode === 'signup';

  const switchMode = (next) => { setMode(next); setError(''); setPassword(''); setConfirm(''); };

  const submit = async (e, creds) => {
    e?.preventDefault();
    const mail = creds?.email ?? email;
    const pass = creds?.password ?? password;
    if (!mail.trim() || !pass) { setError('Enter your email and password.'); return; }
    if (signup && !creds) {
      if (!name.trim()) { setError('Enter your full name.'); return; }
      if (pass.length < 8) { setError('Password must be at least 8 characters.'); return; }
      if (pass !== confirm) { setError('Passwords do not match.'); return; }
    }
    setBusy(true);
    setError('');
    try {
      const { user } = signup && !creds
        ? await api.signup({ name: name.trim(), email: mail, password: pass, role })
        : await api.login(mail, pass);
      onLogin(user);
    } catch (err) {
      if (err instanceof TypeError) setError('Cannot reach the server. Make sure the backend is running.');
      else setError(err.status === 401 ? 'Invalid email or password.' : err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={submit} noValidate>
        <Logo />
        <h1>{signup ? 'Create your account' : 'Welcome back'}</h1>
        <p>{signup ? 'Set up NeuroGuard to start monitoring recovery.' : 'Sign in to continue your recovery monitoring.'}</p>
        {signup && (
          <>
            <div className="role-toggle" role="radiogroup" aria-label="Account type">
              {['patient', 'caregiver', 'doctor'].map((r) => (
                <button key={r} type="button" role="radio" aria-checked={role === r} className={role === r ? 'active' : ''} onClick={() => setRole(r)}>
                  {r === 'patient' ? 'Patient' : r === 'caregiver' ? 'Caregiver' : 'Doctor'}
                </button>
              ))}
            </div>
            <label>Full name
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Your name" />
            </label>
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
              <button key={a.email} type="button" className="secondary" disabled={busy} onClick={() => submit(null, a)}>{a.label}</button>
            ))}
          </div>
        )}
        <div className="login-note"><ShieldCheck size={13} /> Prototype for functional monitoring; not a substitute for professional care.</div>
      </form>
    </div>
  );
}
