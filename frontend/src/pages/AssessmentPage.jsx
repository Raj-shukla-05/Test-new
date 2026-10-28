import React, { useState } from 'react';
import { Check, Hand, MoveUp, Scale, Sparkles } from 'lucide-react';
import CameraAssessment from '../components/CameraAssessment';

const exercises = [
  { id: 'arm_raise', title: 'Arm Raise', desc: 'Range, symmetry and movement control', icon: MoveUp, featured: true },
  { id: 'sit_to_stand', title: 'Sit-to-Stand', desc: 'Repetitions, stability and completion', icon: Scale },
  { id: 'seated_reach', title: 'Seated Reach', desc: 'Reach consistency and path efficiency', icon: Hand },
];

export default function AssessmentPage({ onSave, onDone }) {
  const [exercise, setExercise] = useState('arm_raise');
  const [sessionResult, setSessionResult] = useState(null);
  return (
    <div className="page">
      <div className="hero-row compact"><div><span className="eyebrow">Today’s check</span><h1>One short session. Better visibility.</h1><p>Choose one structured assessment. Your movement is processed in your browser; only metrics are saved.</p></div><span className="privacy-pill"><Sparkles size={14} /> Privacy-first</span></div>
      <div className="exercise-picker">
        {exercises.map(({ id, title, desc, icon: Icon, featured }) => (
          <button className={`exercise-card ${exercise === id ? 'selected' : ''}`} key={id} onClick={() => { setExercise(id); setSessionResult(null); }}>
            <div className="exercise-icon"><Icon size={21} /></div><div><strong>{title}</strong><span>{desc}</span></div>{exercise === id && <Check className="exercise-check" size={16} />}
            {featured && <span className="recommended">Recommended</span>}
          </button>
        ))}
      </div>
      <CameraAssessment exercise={exercise} onComplete={(result) => { setSessionResult(result); onSave?.(result); }} />
      {sessionResult && <div className="post-session"><div><span className="eyebrow">Saved to NeuroGuard</span><h3>{sessionResult.exerciseTitle}: {sessionResult.score}/100</h3><p>The new session will be compared with your personal baseline.</p></div><button className="primary" onClick={onDone}>Back to overview</button></div>}
    </div>
  );
}
