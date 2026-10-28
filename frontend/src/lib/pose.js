import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';




const POSE_MODEL_URL = '/models/pose_landmarker_lite.task';
const POSE_WASM_URL = '/mediapipe/wasm';

export async function createPoseLandmarker() {
  console.log('[NeuroGuard] Loading local MediaPipe WASM...');

  const vision = await FilesetResolver.forVisionTasks(POSE_WASM_URL);

  console.log('[NeuroGuard] MediaPipe WASM loaded');
  console.log('[NeuroGuard] Loading local pose model...');

  try {
    return await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: POSE_MODEL_URL,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.55,
      minPosePresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
    });
  } catch (gpuError) {
    console.warn(
      '[NeuroGuard] GPU failed, falling back to CPU:',
      gpuError
    );

    return await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: POSE_MODEL_URL,
        delegate: 'CPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.55,
      minPosePresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
    });
  }
}



// export const POSE_MODEL_URL =
//   'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

// export const POSE_WASM_URL =
//   'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm';

export const LANDMARKS = {
  nose: 0,
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
};

// export async function createPoseLandmarker() {
//   const vision = await FilesetResolver.forVisionTasks(POSE_WASM_URL);
//   return PoseLandmarker.createFromOptions(vision, {
//     baseOptions: {
//       modelAssetPath: POSE_MODEL_URL,
//       delegate: 'CPU',
//     },
//     runningMode: 'VIDEO',
//     numPoses: 1,
//     minPoseDetectionConfidence: 0.55,
//     minPosePresenceConfidence: 0.55,
//     minTrackingConfidence: 0.55,
//   });
// }

export function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: ((a.z || 0) + (b.z || 0)) / 2 };
}

export function angle(a, b, c) {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const mag = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  if (!mag) return 0;
  const cosine = Math.min(1, Math.max(-1, dot / mag));
  return Math.acos(cosine) * (180 / Math.PI);
}

export function visiblePoint(point, threshold = 0.5) {
  return Boolean(point && (point.visibility ?? 1) >= threshold);
}

export function drawSkeleton(ctx, video, landmarks) {
  if (!ctx || !video || !landmarks) return;
  const width = video.videoWidth || video.clientWidth;
  const height = video.videoHeight || video.clientHeight;
  ctx.clearRect(0, 0, width, height);

  const connections = [
    [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
    [11, 23], [12, 24], [23, 24], [23, 25], [25, 27],
    [24, 26], [26, 28], [15, 17], [16, 18],
  ];

  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#8fe3d5';
  ctx.fillStyle = '#ffffff';

  for (const [aIdx, bIdx] of connections) {
    const a = landmarks[aIdx];
    const b = landmarks[bIdx];
    if (!visiblePoint(a) || !visiblePoint(b)) continue;
    ctx.beginPath();
    ctx.moveTo(a.x * width, a.y * height);
    ctx.lineTo(b.x * width, b.y * height);
    ctx.stroke();
  }

  ctx.fillStyle = '#0f766e';
  for (const point of landmarks) {
    if (!visiblePoint(point, 0.4)) continue;
    ctx.beginPath();
    ctx.arc(point.x * width, point.y * height, 5.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
