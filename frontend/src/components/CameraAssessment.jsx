import React, { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, CircleAlert, LoaderCircle, Pause, Play, RotateCcw, ShieldCheck, Square } from 'lucide-react';
import { createPoseLandmarker, drawSkeleton } from '../lib/pose';
import { armRaiseFrame, buildArmRaiseSession, buildSeatedReachSession, buildSitToStandSession, seatedReachFrame, sitToStandFrame } from '../lib/scoring';

const EXERCISES = {
  arm_raise: {
    title: 'Arm Raise',
    instruction: 'Raise both arms slowly until they are as high and comfortable as possible, then lower.',
    target: '5 controlled repetitions',
  },
  sit_to_stand: {
    title: 'Sit-to-Stand',
    instruction: 'From a stable chair, stand up tall and return to the seated position at a comfortable pace.',
    target: '5 controlled repetitions',
  },
  seated_reach: {
    title: 'Seated Reach',
    instruction: 'Reach forward and slightly upward with both hands, then return to your starting position.',
    target: '5 controlled repetitions',
  },
};

export default function CameraAssessment({ exercise = 'arm_raise', onComplete }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const landmarkerRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const framesRef = useRef([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [liveMetrics, setLiveMetrics] = useState({ phase: 'Ready', value: 0, symmetry: 0, reps: 0 });
  const [result, setResult] = useState(null);

  useEffect(() => {
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status !== 'running') return undefined;
    const id = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [status]);

  async function startCamera() {
    try {
      setError('');
      setResult(null);
      framesRef.current = [];
      setStatus('loading');
      if (!landmarkerRef.current) landmarkerRef.current = await createPoseLandmarker();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      setElapsed(0);
      setStatus('running');
      rafRef.current = requestAnimationFrame(processFrame);
    } catch (err) {
      console.error(err);
      setError(err?.message?.includes('Permission') ? 'Camera permission was blocked. Allow camera access and try again.' : 'Unable to start the camera or AI model. Check your internet connection and browser permissions.');
      setStatus('error');
    }
  }

  function processFrame(timestamp) {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !landmarkerRef.current || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(processFrame);
      return;
    }
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    try {
      const detection = landmarkerRef.current.detectForVideo(video, timestamp);
      const landmarks = detection?.landmarks?.[0];
      const ctx = canvas.getContext('2d');
      if (landmarks) {
        drawSkeleton(ctx, video, landmarks);
        let frame;
        if (exercise === 'arm_raise') frame = armRaiseFrame(landmarks);
        if (exercise === 'sit_to_stand') frame = sitToStandFrame(landmarks);
        if (exercise === 'seated_reach') frame = seatedReachFrame(landmarks);
        if (frame?.ready) {
          framesRef.current.push({ ...frame, at: Date.now() });
          if (framesRef.current.length > 450) framesRef.current.shift();
          const frames = framesRef.current;
          const current = frames[frames.length - 1];
          const reps = estimateReps(exercise, frames);
          setLiveMetrics({
            phase: exercise === 'arm_raise' ? (current.averageElevation > 70 ? 'Raise' : 'Lower') : 'Tracking',
            value: exercise === 'arm_raise' ? Math.round(current.averageElevation) : Math.round(current.reach ?? current.kneeAngle ?? 0),
            symmetry: Math.round(current.symmetry ?? current.stability ?? current.reach ?? 0),
            reps,
          });
        }
      }
    } catch (err) {
      // Ignore individual-frame issues to keep the assessment loop alive.
    }
    rafRef.current = requestAnimationFrame(processFrame);
  }

  function estimateReps(kind, frames) {
    if (kind === 'arm_raise') return countPeaks(frames.map((f) => f.averageElevation || 0), 70, 48);
    if (kind === 'sit_to_stand') return countValleys(frames.map((f) => f.kneeAngle || 0), 110, 150);
    return countPeaks(frames.map((f) => f.reach || 0), 40, 25);
  }

  function countPeaks(values, high, low) {
    let count = 0; let state = 'low';
    for (const value of values) {
      if (state === 'low' && value >= high) state = 'high';
      if (state === 'high' && value <= low) { count += 1; state = 'low'; }
    }
    return Math.min(5, count);
  }

  function countValleys(values, low, high) {
    let count = 0; let state = 'high';
    for (const value of values) {
      if (state === 'high' && value <= low) state = 'low';
      if (state === 'low' && value >= high) { count += 1; state = 'high'; }
    }
    return Math.min(5, count);
  }

  function stopCamera() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop());
    rafRef.current = null;
    streamRef.current = null;
    if (status === 'running') setStatus('idle');
  }

  function finishAssessment() {
    const frames = framesRef.current;
    let data;
    if (exercise === 'arm_raise') data = buildArmRaiseSession(frames);
    if (exercise === 'sit_to_stand') data = buildSitToStandSession(frames);
    if (exercise === 'seated_reach') data = buildSeatedReachSession(frames);
    const final = {
      exercise,
      exerciseTitle: EXERCISES[exercise].title,
      score: data.score,
      metrics: data.metrics,
      duration: elapsed,
    };
    setResult(final);
    stopCamera();
    onComplete?.(final);
  }

  const exerciseInfo = EXERCISES[exercise];
  return (
    <div className="assessment-layout">
      <div className="assessment-main">
        <div className="assessment-head">
          <div>
            <span className="eyebrow">Live functional check</span>
            <h2>{exerciseInfo.title}</h2>
            <p>{exerciseInfo.instruction}</p>
          </div>
          <div className="timer-pill"><span /> {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}</div>
        </div>

        <div className="camera-card">
          <div className="camera-stage">
            <video ref={videoRef} className="camera-video" playsInline muted />
            <canvas ref={canvasRef} className="camera-canvas" />
            {status === 'idle' && (
              <div className="camera-placeholder">
                <div className="camera-placeholder-icon"><Camera size={30} /></div>
                <strong>Ready for your check</strong>
                <span>Stand or sit where your head, shoulders, hands and feet are visible.</span>
                <button className="primary" onClick={startCamera}><Play size={17} /> Start camera check</button>
              </div>
            )}
            {status === 'loading' && <div className="camera-overlay"><LoaderCircle className="spin" size={28} /><strong>Loading movement AI…</strong><span>Preparing the on-device pose model.</span></div>}
            {status === 'error' && <div className="camera-overlay error"><CircleAlert size={28} /><strong>Camera check could not start</strong><span>{error}</span><button className="secondary" onClick={startCamera}><RotateCcw size={15} /> Try again</button></div>}
            {status === 'running' && (
              <div className="camera-overlay-ui">
                <div className="live-tag"><span /> AI LIVE</div>
                <div className="pose-status"><CheckCircle2 size={15} /> Body detected</div>
              </div>
            )}
          </div>
          <div className="camera-footer">
            <div><ShieldCheck size={16} /><span>Processed on this device • raw video is not uploaded</span></div>
            <div className="camera-controls">
              {status === 'running' && <button className="secondary" onClick={() => setStatus('paused')}><Pause size={15} /> Pause</button>}
              {status === 'paused' && <button className="secondary" onClick={() => setStatus('running')}><Play size={15} /> Resume</button>}
              {status === 'running' && <button className="primary danger" onClick={finishAssessment}><Square size={14} /> Finish</button>}
            </div>
          </div>
        </div>

        {result && (
          <div className="result-banner">
            <div className="result-score">{result.score}<span>/100</span></div>
            <div><strong>{result.exerciseTitle} completed</strong><span>Session processed successfully. Your metrics are ready for baseline comparison.</span></div>
            <button className="secondary" onClick={() => setResult(null)}>New session</button>
          </div>
        )}
      </div>

      <aside className="assessment-side">
        <div className="side-section">
          <span className="section-kicker">Session target</span>
          <div className="target-card"><span className="target-number">5</span><div><strong>controlled reps</strong><span>{exerciseInfo.title}</span></div></div>
        </div>
        <div className="side-section">
          <span className="section-kicker">Live metrics</span>
          <div className="live-metrics">
            <div><span>Movement phase</span><strong>{liveMetrics.phase}</strong></div>
            <div><span>Movement level</span><strong>{liveMetrics.value}{exercise === 'arm_raise' ? '%' : '°'}</strong></div>
            <div><span>Quality signal</span><strong>{liveMetrics.symmetry}%</strong></div>
            <div><span>Repetitions</span><strong>{liveMetrics.reps}/5</strong></div>
          </div>
        </div>
        <div className="side-section">
          <span className="section-kicker">Safety</span>
          <div className="safety-note"><ShieldCheck size={18} /><div><strong>Low-risk demo mode</strong><span>Use a stable chair and stop if you feel unsafe or unwell.</span></div></div>
        </div>
      </aside>
    </div>
  );
}
