// โหมดรอ: เห็นคนเข้ามาหน้าจอ → ทักและเปิดฟังเอง
// ตรวจใบหน้าในเครื่องด้วย MediaPipe (ไม่ส่งภาพออก ไม่บันทึกภาพ) ประมาณ 2 ครั้งต่อวินาที
const VER = '0.10.14';
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}/wasm`;
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

let det = null, video = null, stream = null, timer = null, opts = null, rateMs = 500;
let seenSince = 0, lastSeen = 0, lastGreet = 0, present = false;
// สถานะไว้ตรวจว่ากล้องยังทำงานไหม (แสดงในหน้าตั้งค่า + จุดบนแถบด้านบน)
export const status = { step: 'off', delegate: '', checks: 0, faces: 0, lastFaceAt: 0, lastCheckAt: 0, err: '', w: 0, h: 0, size: 0 };

async function loadDetector() {
  if (det) return det;
  const { FaceDetector, FilesetResolver } = await import(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VER}/vision_bundle.mjs`);
  const fs = await FilesetResolver.forVisionTasks(WASM);
  // ไอแพดบางรุ่นใช้ GPU ไม่ได้ → ใช้ CPU แทน (โมเดลเล็ก ไหวสบาย)
  try { det = await FaceDetector.createFromOptions(fs, { baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' }, runningMode: 'VIDEO', minDetectionConfidence: 0.5 }); status.delegate = 'GPU'; }
  catch { det = await FaceDetector.createFromOptions(fs, { baseOptions: { modelAssetPath: MODEL, delegate: 'CPU' }, runningMode: 'VIDEO', minDetectionConfidence: 0.5 }); status.delegate = 'CPU'; }
  return det;
}

function tick() {
  if (!video || document.visibilityState !== 'visible') return;
  if (video.readyState < 2) { status.step = 'waiting-video'; return; }
  const now = performance.now();
  let face = null;
  try {
    const r = det.detectForVideo(video, now);
    // เลือกใบหน้าที่ใหญ่สุด (อยู่ใกล้สุด) และต้องใหญ่พอ = ยืนอยู่หน้าจอจริง ไม่ใช่คนเดินผ่านไกลๆ
    status.checks++; status.lastCheckAt = Date.now(); status.step = 'running'; status.w = video.videoWidth; status.h = video.videoHeight;
    let big = 0;
    for (const d of r.detections || []) { const b = d.boundingBox; if (!b) continue; big = Math.max(big, b.width / video.videoWidth); if (b.width / video.videoWidth >= opts.minSize() && (!face || b.width > face.width)) face = b; }
    status.size = big;
    if (face) { status.faces++; status.lastFaceAt = Date.now(); }
    opts.onStatus && opts.onStatus(status, !!face);
  } catch (e) { status.err = String(e && e.message || e).slice(0, 120); status.step = 'detect-error'; return; }
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
  status.step = 'loading-model'; status.err = '';
  await loadDetector();
  status.step = 'opening-camera';
  stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 10 } }, audio: false });
  video = document.createElement('video');
  video.playsInline = true; video.muted = true; video.autoplay = true; video.setAttribute('playsinline', ''); video.setAttribute('muted', '');
  // ไอแพดไม่ส่งภาพจากกล้องให้ video ที่ไม่ได้อยู่ในหน้า → ใส่ไว้ในหน้าแบบมองไม่เห็น
  video.style.cssText = 'position:fixed;left:0;bottom:0;width:4px;height:3px;opacity:0.01;pointer-events:none;z-index:-1';
  document.body.append(video);
  video.srcObject = stream;
  await video.play();
  status.step = 'running';
  lastSeen = Date.now();
  timer = setInterval(tick, rateMs);
  return true;
}
// ไอแพดหยุดกล้องเมื่อสลับไปแอปอื่นหรือล็อกจอ → กลับมาแล้วเปิดกล้องให้ใหม่
async function reopen() {
  if (!timer || document.visibilityState !== 'visible') return;
  const tr = stream && stream.getVideoTracks()[0];
  if (tr && tr.readyState === 'live' && video && !video.paused) return;
  try {
    try { stream && stream.getTracks().forEach((t) => t.stop()); } catch {}
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 10 } }, audio: false });
    video.srcObject = stream; await video.play();
  } catch (e) { opts && opts.onError && opts.onError(e); }
}
document.addEventListener('visibilitychange', () => setTimeout(reopen, 500));
setInterval(reopen, 15000);

export function stopPresence() {
  clearInterval(timer); timer = null;
  try { stream && stream.getTracks().forEach((t) => t.stop()); } catch {}
  try { video && video.remove(); } catch {}
  stream = null; video = null; present = false; seenSince = 0; status.step = 'off';
}
export const presenceOn = () => !!timer;
export const someoneHere = () => present;

// ปรับความถี่การตรวจใบหน้า (โหมดประหยัดพลังงาน: ตอนพักจอตรวจช้าลง)
export function setPresenceRate(ms) {
  if (ms === rateMs) return;
  rateMs = ms;
  if (timer) { clearInterval(timer); timer = setInterval(tick, rateMs); }
}
