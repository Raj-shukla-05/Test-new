import React, { useEffect, useMemo, useState } from 'react';
import { HeartPulse, LoaderCircle, ShieldCheck } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import PatientDashboard from './pages/PatientDashboard';
import ProgressPage from './pages/ProgressPage';
import AssessmentPage from './pages/AssessmentPage';
import CaregiverPage from './pages/CaregiverPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';
import DoctorPage from './pages/DoctorPage';
import { api } from './lib/api';
import { DEMO_CAREGIVER_ID, DEMO_USER_ID, fallbackAlerts, fallbackDashboard, fallbackTrends } from './lib/demoData';

const SESSION_KEY = 'neuroguard.user';
const homeView = (r) => (r === 'caregiver' ? 'caregiver' : r === 'doctor' ? 'doctor' : 'dashboard');
const roleOf = (u) => (u?.role === 'caregiver' || u?.role === 'doctor' ? u.role : 'patient');

function loadSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; }
}

export default function App() {
  const [authUser, setAuthUser] = useState(loadSession);
  const [role, setRole] = useState(() => roleOf(loadSession()));
  const [view, setView] = useState(() => homeView(roleOf(loadSession())));
  const [dashboard, setDashboard] = useState(fallbackDashboard);
  const [trends, setTrends] = useState(fallbackTrends);
  const [alerts, setAlerts] = useState(fallbackAlerts);
  const [patients, setPatients] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const [systemStatus, setSystemStatus] = useState(null);

  useEffect(() => {
    api.health().then(setSystemStatus).catch(() => setSystemStatus({ database: 'offline' }));
  }, []);

  // Patients see their own data; caregivers and doctors manage patients
  const activeUserId = authUser?.role === 'patient' ? authUser.id : DEMO_USER_ID;

  const refresh = async () => {
    setLoading(true);
    try {
      const promises = [
        api.dashboard(activeUserId),
        api.trends(activeUserId),
        api.alerts(activeUserId),
      ];

      // Only query caregiver patients if the current user has the caregiver role
      if (authUser?.role === 'caregiver') {
        promises.push(api.caregiverPatients(authUser.id || DEMO_CAREGIVER_ID));
      }

      const results = await Promise.all(promises);
      setDashboard(results[0]);
      setTrends(results[1]);
      setAlerts(results[2]);
      if (results[3]) {
        setPatients(results[3]);
      }
    } catch {
      setDashboard(fallbackDashboard);
      setTrends(fallbackTrends);
      setAlerts(fallbackAlerts);
      setPatients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authUser) refresh();

    const handleUnauthorized = () => {
      handleLogout();
      setToast('Your session has expired. Please sign in again.');
    };

    window.addEventListener('neuroguard:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('neuroguard:unauthorized', handleUnauthorized);
  }, [authUser]);

  const handleLogin = (user, token) => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
      if (token) api.setAuthToken(token);
    } catch { /* storage unavailable */ }
    setRole(roleOf(user));
    setView(homeView(roleOf(user)));
    setAuthUser(user);
  };

  const handleLogout = () => {
    try {
      sessionStorage.removeItem(SESSION_KEY);
      api.clearAuthToken();
    } catch { /* storage unavailable */ }
    setAuthUser(null);
  };

  const handleSave = async (result, assignmentId, trackingQuality) => {
    try {
      const saved = await api.createAssessment({
        userId: activeUserId,
        exerciseType: result.exercise,
        duration: result.duration,
        score: result.score,
        metrics: result.metrics,
        assignmentId: assignmentId || null,
        trackingQuality: trackingQuality || null,
      });

      const storageNote = saved?.storage === 'mongodb'
        ? ' (Saved to database)'
        : saved?.storage === 'in-memory'
          ? ' (Session mode · held in temporary memory)'
          : '';

      setToast(
        assignmentId
          ? `Session submitted against prescribed protocol.${storageNote}`
          : `Session recorded.${storageNote} NeuroGuard will compare it with your personal baseline.`
      );
      setSelectedAssignment(null);
      await refresh();
    } catch (err) {
      setToast(err.message || 'Session completed locally. Connect the backend to persist it.');
    }
    window.setTimeout(() => setToast(''), 4500);
  };

  const handleDemoDecline = async () => {
    try {
      await api.demoDecline(activeUserId);
      await refresh();
      setView(role === 'caregiver' ? 'caregiver' : 'dashboard');
      setToast('Decline scenario loaded: Day 15 → Day 21.');
    } catch {
      const decline = fallbackTrends.map((item, index) => index < 4 ? item : { ...item, score: 81 - index * 4, movement: 82 - index * 6, balance: 71 - index * 5 });
      setTrends(decline);
      setAlerts([{ id: 'demo', severity: 'review', type: 'Persistent deviation', reason: 'Movement and balance have been trending below Raj’s recent baseline across the last three sessions.', timestamp: 'Demo scenario', action: 'Review recommendation' }]);
      setToast('Demo decline scenario loaded locally.');
    }
    window.setTimeout(() => setToast(''), 4500);
  };

  const content = useMemo(() => {
    if (view === 'assessment') {
      return (
        <AssessmentPage
          assignment={selectedAssignment}
          onClearAssignment={() => setSelectedAssignment(null)}
          onSave={handleSave}
          onDone={() => { setSelectedAssignment(null); setView('dashboard'); }}
        />
      );
    }
    if (view === 'progress') return <ProgressPage trends={trends} />;
    if (view === 'doctor') return <DoctorPage doctor={authUser} />;
    if (view === 'caregiver') return <CaregiverPage trends={trends} patients={patients.length ? patients : undefined} onReview={() => setToast('Opening the trend evidence for review…')} />;
    if (view === 'settings') return <SettingsPage />;
    return (
      <PatientDashboard
        dashboard={dashboard}
        trends={trends}
        alerts={alerts}
        setView={setView}
        onReview={() => setView('progress')}
        onStartAssignment={(asgn) => {
          setSelectedAssignment(asgn);
          setView('assessment');
        }}
      />
    );
  }, [view, dashboard, trends, alerts, patients, authUser, selectedAssignment]);

  if (!authUser) return <LoginPage onLogin={handleLogin} />;

  return (
    <div className="app-shell">
      <Sidebar view={view} setView={setView} role={role} userName={authUser.name} onDemoDecline={handleDemoDecline} />
      <main className="main-shell">
        <Topbar role={role} userName={authUser.name} onLogout={handleLogout} systemStatus={systemStatus} setRole={(nextRole) => { if (authUser.role === 'doctor') return; setRole(nextRole); setView(homeView(nextRole)); }} />
        <div className="content-shell">
          {loading && view === 'dashboard' && <div className="loading-bar"><LoaderCircle size={15} className="spin" /> Syncing recovery data…</div>}
          {content}
        </div>
        <div className="medical-disclaimer"><ShieldCheck size={14} /> NeuroGuard is a prototype for functional monitoring and does not replace professional medical care.</div>
        {toast && <div className="toast"><HeartPulse size={16} /> {toast}</div>}
      </main>
    </div>
  );
}
