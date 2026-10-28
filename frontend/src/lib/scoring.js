import { LANDMARKS, angle, midpoint, visiblePoint } from './pose';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = (value, decimals = 0) => Number(value.toFixed(decimals));

function getSide(landmarks, side) {
  const shoulder = landmarks[LANDMARKS[`${side}Shoulder`]];
  const elbow = landmarks[LANDMARKS[`${side}Elbow`]];
  const wrist = landmarks[LANDMARKS[`${side}Wrist`]];
  return { shoulder, elbow, wrist };
}

export function armRaiseFrame(landmarks) {
  const left = getSide(landmarks, 'left');
  const right = getSide(landmarks, 'right');
  if (![left.shoulder, left.elbow, left.wrist, right.shoulder, right.elbow, right.wrist].every((p) => visiblePoint(p))) {
    return { ready: false };
  }

  const leftAngle = angle(left.shoulder, left.elbow, left.wrist);
  const rightAngle = angle(right.shoulder, right.elbow, right.wrist);
  const leftElevation = clamp((left.shoulder.y - left.wrist.y) * 120 + 50, 0, 100);
  const rightElevation = clamp((right.shoulder.y - right.wrist.y) * 120 + 50, 0, 100);
  const averageElevation = (leftElevation + rightElevation) / 2;
  const symmetry = clamp(100 - Math.abs(leftElevation - rightElevation) * 1.2, 0, 100);
  const extension = clamp(100 - Math.abs(180 - ((leftAngle + rightAngle) / 2)) * 1.15, 0, 100);

  return {
    ready: true,
    leftElevation,
    rightElevation,
    leftAngle,
    rightAngle,
    averageElevation,
    symmetry,
    extension,
  };
}

export function buildArmRaiseSession(frames) {
  const valid = frames.filter((frame) => frame.ready);
  if (!valid.length) {
    return { score: 0, metrics: { rangeOfMotion: 0, symmetry: 0, movementQuality: 0, repetitions: 0 }, phase: 'No pose' };
  }

  let reps = 0;
  let state = 'down';
  let lastPeak = 0;
  const leftValues = valid.map((f) => f.leftElevation);
  const rightValues = valid.map((f) => f.rightElevation);
  const maxLeft = Math.max(...leftValues);
  const maxRight = Math.max(...rightValues);
  const minLeft = Math.min(...leftValues);
  const minRight = Math.min(...rightValues);

  for (const frame of valid) {
    const peak = frame.averageElevation;
    if (state === 'down' && peak >= 78 && Date.now() - lastPeak > 700) {
      state = 'up';
      lastPeak = Date.now();
    } else if (state === 'up' && peak <= 55) {
      reps += 1;
      state = 'down';
    }
  }

  const rom = ((maxLeft - minLeft) + (maxRight - minRight)) / 2;
  const symmetry = valid.reduce((sum, f) => sum + f.symmetry, 0) / valid.length;
  const movementQuality = valid.reduce((sum, f) => sum + f.extension, 0) / valid.length;
  const rangeScore = clamp((rom / 65) * 100, 0, 100);
  const repScore = clamp((reps / 5) * 100, 0, 100);
  const score = 0.38 * rangeScore + 0.27 * symmetry + 0.2 * movementQuality + 0.15 * repScore;

  return {
    score: round(clamp(score, 0, 100)),
    metrics: {
      rangeOfMotion: round(clamp(rangeScore, 0, 100)),
      symmetry: round(symmetry),
      movementQuality: round(movementQuality),
      repetitions: reps,
      leftPeak: round(maxLeft),
      rightPeak: round(maxRight),
      asymmetry: round(100 - symmetry),
    },
    phase: reps >= 5 ? 'Complete' : state === 'up' ? 'Raise' : 'Lower',
  };
}

export function sitToStandFrame(landmarks) {
  const leftHip = landmarks[LANDMARKS.leftHip];
  const rightHip = landmarks[LANDMARKS.rightHip];
  const leftKnee = landmarks[LANDMARKS.leftKnee];
  const rightKnee = landmarks[LANDMARKS.rightKnee];
  const leftAnkle = landmarks[LANDMARKS.leftAnkle];
  const rightAnkle = landmarks[LANDMARKS.rightAnkle];
  if (![leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle].every((p) => visiblePoint(p))) return { ready: false };
  const left = angle(leftHip, leftKnee, leftAnkle);
  const right = angle(rightHip, rightKnee, rightAnkle);
  const kneeAngle = (left + right) / 2;
  return {
    ready: true,
    kneeAngle,
    trunkHeight: 1 - midpoint(leftHip, rightHip).y,
  };
}

export function buildSitToStandSession(frames) {
  const valid = frames.filter((f) => f.ready);
  if (!valid.length) return { score: 0, metrics: { repetitions: 0, stability: 0, movementQuality: 0 } };
  let reps = 0;
  let state = 'standing';
  let cooldown = 0;
  for (const frame of valid) {
    if (cooldown > 0) cooldown -= 1;
    if (state === 'standing' && frame.kneeAngle < 105) state = 'sit';
    if (state === 'sit' && frame.kneeAngle > 155 && cooldown === 0) {
      reps += 1;
      state = 'standing';
      cooldown = 20;
    }
  }
  const angles = valid.map((f) => f.kneeAngle);
  const range = Math.max(...angles) - Math.min(...angles);
  const stability = clamp(100 - (Math.max(...angles) - Math.min(...angles) - 80) * 0.35, 0, 100);
  const rangeScore = clamp((range / 70) * 100, 0, 100);
  const repScore = clamp((reps / 5) * 100, 0, 100);
  return {
    score: round(0.45 * repScore + 0.35 * rangeScore + 0.2 * stability),
    metrics: {
      repetitions: reps,
      stability: round(stability),
      movementQuality: round(rangeScore),
      kneeRange: round(range),
    },
  };
}

export function seatedReachFrame(landmarks) {
  const leftShoulder = landmarks[LANDMARKS.leftShoulder];
  const rightShoulder = landmarks[LANDMARKS.rightShoulder];
  const leftWrist = landmarks[LANDMARKS.leftWrist];
  const rightWrist = landmarks[LANDMARKS.rightWrist];
  if (![leftShoulder, rightShoulder, leftWrist, rightWrist].every((p) => visiblePoint(p))) return { ready: false };
  const shoulderMid = midpoint(leftShoulder, rightShoulder);
  const wristMid = midpoint(leftWrist, rightWrist);
  const reach = Math.hypot(wristMid.x - shoulderMid.x, wristMid.y - shoulderMid.y);
  return { ready: true, reach: clamp(reach * 180, 0, 100), wristY: wristMid.y };
}

export function buildSeatedReachSession(frames) {
  const valid = frames.filter((f) => f.ready);
  if (!valid.length) return { score: 0, metrics: { repetitions: 0, pathEfficiency: 0, movementQuality: 0 } };
  let reps = 0;
  let state = 'start';
  for (const f of valid) {
    if (state === 'start' && f.reach > 42) state = 'reach';
    if (state === 'reach' && f.reach < 25) { reps += 1; state = 'start'; }
  }
  const reach = valid.reduce((s, f) => s + f.reach, 0) / valid.length;
  const movementQuality = clamp(reach * 1.15, 0, 100);
  const repScore = clamp((reps / 5) * 100, 0, 100);
  const pathEfficiency = clamp(100 - Math.abs(58 - reach) * 0.8, 0, 100);
  return {
    score: round(0.4 * movementQuality + 0.35 * pathEfficiency + 0.25 * repScore),
    metrics: { repetitions: reps, pathEfficiency: round(pathEfficiency), movementQuality: round(movementQuality) },
  };
}
