// โหมดรอ: เห็นคนเข้ามาหน้าจอ → ทักและเปิดฟังเอง
// ตรวจใบหน้าในเครื่องด้วย MediaPipe (ไม่ส่งภาพออก ไม่บันทึกภาพ) ประมาณ 2 ครั้งต่อวินาที
const VER = '0.10.14';
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}/wasm`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

let det = null, video = null, stream = null, timer = null, opts = null;
let seenSince = 0, lastSeen = 0, lastGreet = 0, present = false;

async function loadDetector() {
  if (det) return det;
  const { FaceDetector, FilesetResolver } = await import(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}/vision_bundle.mjs`);
  const fs = await FilesetResolver.forVisionTasks(WASM);
  det = await FaceDetector.createFromOptions(fs, { baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' }, runningMode: 'VIDEO', minDetectionConfidence: 0.6 });
  return det;
}

function tick() {
  if (!video || video.readyState < 2 || document.visibilityState !== 'visible') return;
  const now = performance.now();
  let face = null;
  try {
    const r = det.detectForVideo(video, now);
    // เลือกใบหน้าที่ใหญ่สุด (อยู่ใกล้สุด) และต้องใหญ่พอ = ยืนอยู่หน้าจอจริง ไม่ใช่คนเดินผ่านไกลๆ
    for (const d of r.detections || []) { const b = d.boundingBox; if (b && b.width / video.videoWidth >= opts.minSize() && (!face || b.width > face.width)) face = b; }
  } catch { return; }
  const t = Date.now();
  if (face) {
    lastSeen = t;
    if (!seenSince) seenSince = t;
    // ให้น้องมีไฟมองตามคน (ภาพจากกล้องหน้ากลับซ้ายขวา)
    const cx = (face.originX + face.width / 2) / video.videoWidth, cy = (face.originY + face.height / 2) / video.videoHeight;
    opts.onLook(-(cx * 2 - 1), -(cy * 2 - 1));
    if (!present && t - seenSince >= 800) {
      present = true;
      opts.onPresence(true);
      if (t - lastGreet >= opts.gapMs()) { lastGreet = t; opts.onArrive(); }
    }
  } else {
    seenSince = 0;
    if (present && t - lastSeen >= 15000) { present = false; opts.onPresence(false); } // ไม่มีคน 15 วิ = เดินไปแล้ว
    if (!present && lastSeen && t - lastSeen >= opts.sleepMs()) opts.onIdle();
  }
}

export async function startPresence(o) {
  opts = o;
  if (timer) return true;
  await loadDetector();
  stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 10 } }, audio: false });
  video = document.createElement('video');
  video.playsInline = true; video.muted = true; video.setAttribute('playsinline', ''); video.srcObject = stream;
  await video.play();
  lastSeen = Date.now();
  timer = setInterval(tick, 500);
  return true;
}
export function stopPresence() {
  clearInterval(timer); timer = null;
  try { stream && stream.getTracks().forEach((t) => t.stop()); } catch {}
  stream = null; video = null; present = false; seenSince = 0;
}
export const presenceOn = () => !!timer;
export const someoneHere = () => present;
