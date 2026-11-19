import { loadFaces, faceOf, faceCount } from './faces.js?v=11191650';
// ลงเวลาทำงานที่น้องมีไฟด้วยการสแกนใบหน้า — บันทึกเข้าระบบลงเวลาเดิม (pea-checkin) ตัวเดียวกับใน LINE
// ใบหน้า: ประมวลผลในเครื่อง เก็บแค่ตัวเลขจดจำหน้า (ไม่เก็บรูป) ที่ "น้องไฟเรียนรู้" · ใช้เฉพาะลงเวลา · ลงทะเบียนเมื่อเจ้าตัวยินยอม
const CHECKIN_API = 'https://script.google.com/macros/s/AKfycbxY0vjjr3MAl6e_OSTTbubrK-cVTrsx3o38xQGLJkJMro8rS8H-LaWl2J3oeE_I31FR/exec';
const OFFICE = { lat: 8.364947335802357, lng: 98.74931073756771 }; // จุดเดียวกับระบบลงเวลาเดิม (น้องมีไฟตั้งอยู่ในสำนักงาน)
const FA = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/';
const MATCH = 0.5;          // ระยะห่างของหน้าที่ถือว่าเป็นคนเดียวกัน (ยิ่งน้อยยิ่งเข้ม)
const SCAN_MS = 15000;

let X = null;               // ตัวช่วยจากแอป: cfg, speak, toast, pausePresence, resumePresence, learn
let fa = null, faLoading = null, stream = null, emps = [], faces = [], today = {}, run = 0;
const $ = (id) => document.getElementById(id);
const el = (t, c, s) => { const e = document.createElement(t); if (c) e.className = c; if (s != null) e.textContent = s; return e; };
const nm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const bkk = () => new Date(Date.now() + 7 * 3600e3);
const hhmm = () => bkk().toISOString().slice(11, 16);
const sayTime = (t) => { const m = String(t || '').match(/(\d{1,2})[:.](\d{2})/); return m ? +m[1] + ' นาฬิกา ' + +m[2] + ' นาที' : ''; };
const nick = (n) => nm(n).replace(/^(นาย|นางสาว|นาง|น\.ส\.|ว่าที่ ร\.ต\.)\s*/, '').split(' ')[0];
const isB1 = (e) => /B\s*1/i.test(String(e && e.pos || '').replace(/[ฺ]/g, ''));

export function initCheckin(ctx) {
  X = ctx;
  $('ckBack').onclick = closeCheckin;
  $('ckDlg').addEventListener('close', cleanup);
}
async function learnPost(body) {
  const L = X.learn();
  if (!L.url || !L.secret) throw new Error('ยังไม่ได้ตั้งค่าระบบเรียนรู้ (ลิงก์/รหัสลับ) ในหน้าตั้งค่า');
  const r = await fetch(L.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...body, secret: L.secret }) });
  const j = await r.json(); if (!j.ok) throw new Error(j.error || 'บันทึกไม่สำเร็จ'); return j;
}
const ckGet = (p) => fetch(CHECKIN_API + '?' + new URLSearchParams(p)).then((r) => r.json());

async function loadFaceApi() {
  if (fa) return fa;
  if (!faLoading) faLoading = (async () => {
    const m = await import(FA + 'dist/face-api.esm.js');
    const f = m.nets ? m : m.default;
    try { await f.tf.setBackend('webgl'); } catch {}
    await f.tf.ready();
    await Promise.all([f.nets.tinyFaceDetector.loadFromUri(FA + 'model/'), f.nets.faceLandmark68Net.loadFromUri(FA + 'model/'), f.nets.faceRecognitionNet.loadFromUri(FA + 'model/')]);
    fa = f; return f;
  })();
  try { return await faLoading; } catch (e) { faLoading = null; throw e; }
}
async function openCam() {
  if (stream) return;
  X.pausePresence();
  stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
  const v = $('ckVideo'); v.srcObject = stream; v.muted = true; v.playsInline = true;
  await v.play().catch(() => {});
  await new Promise((r) => (v.readyState >= 2 ? r() : (v.onloadeddata = r)));
}
function stopCam() { if (stream) { stream.getTracks().forEach((t) => t.stop()); stream = null; } $('ckVideo').srcObject = null; }
function cleanup() { run++; stopCam(); X && X.resumePresence(); }
export function closeCheckin() { if ($('ckDlg').open) $('ckDlg').close(); }

async function loadData() {
  const [e, d, f] = await Promise.all([
    loadFaces().then(() => ckGet({ action: 'getEmployeeFull' })).catch(() => []),
    ckGet({ action: 'getTodayDashboard' }).catch(() => ({})),
    learnPost({ action: 'faces' }).then((j) => j.faces || []).catch((err) => { X.toast(String(err.message || err)); return []; }),
  ]);
  emps = (Array.isArray(e) ? e : []).map((x) => ({ id: String(x.id), name: nm(x.name), pos: x.position || '', pic: faceOf(x.name) || x.picUrl || '', dbPic: !!faceOf(x.name) }));
  today = {}; (d.records || []).forEach((r) => { today[nm(r.name)] = { in: r.checkIn || '', out: r.checkOut || '' }; });
  faces = f.map((x) => ({ id: String(x.id), name: x.name, d: x.d.map((v) => new Float32Array(v)) }));
}
const empOf = (id) => emps.find((e) => e.id === id);
const statusOf = (e) => today[e.name] || { in: '', out: '' };

// ---------- จอ ----------
function screen(title, ...nodes) {
  $('ckTitle').textContent = title;
  $('ckBody').replaceChildren(...nodes);
  $('ckCam').hidden = true;
}
function camScreen(title, msg) {
  $('ckTitle').textContent = title; $('ckBody').replaceChildren(); $('ckCam').hidden = false; $('ckMsg').textContent = msg || ''; $('ckRing').className = 'ck-ring';
}
function btn(txt, cls, fn) { const b = el('button', 'ck-btn ' + (cls || ''), txt); b.type = 'button'; b.onclick = fn; return b; }

export async function openCheckin() {
  if (!$('ckDlg').open) $('ckDlg').showModal();
  const my = ++run;
  screen('ลงเวลาทำงาน', el('div', 'ck-wait', 'กำลังเตรียมระบบสแกนหน้า…'));
  try { await Promise.all([loadData(), loadFaceApi()]); } catch (e) { if (my === run) screen('ลงเวลาทำงาน', el('div', 'ck-err', 'เปิดระบบสแกนหน้าไม่ได้: ' + String(e.message || e).slice(0, 120)), btn('เลือกชื่อเอง', '', () => pickName('ไม่ผ่านสแกนหน้า'))); return; }
  if (my !== run) return;
  home();
}
function home() {
  const n = emps.length, inN = emps.filter((e) => statusOf(e).in).length;
  const h = bkk().getUTCHours(), hi = h < 12 ? 'สวัสดีตอนเช้าค่ะ' : h < 17 ? 'สวัสดีตอนบ่ายค่ะ' : 'สวัสดีตอนเย็นค่ะ';
  screen('ลงเวลาทำงาน',
    el('div', 'ck-clock', hhmm() + ' น.'),
    el('div', 'ck-hi', hi),
    btn('สแกนหน้าลงเวลา', 'big', scan),
    el('div', 'ck-sub', 'มาแล้ว ' + inN + '/' + n + ' คน · ลงทะเบียนหน้าแล้ว ' + faces.length + ' คน · มีรูปในฐานข้อมูล ' + emps.filter((x) => x.dbPic).length + '/' + n + ' คน'),
    el('div', 'ck-row', ''));
  const row = $('ckBody').querySelector('.ck-row');
  row.append(btn('เลือกชื่อเอง', 'ghost', () => pickName('เลือกชื่อเอง ไม่ผ่านสแกนหน้า')), btn('ลงทะเบียนใบหน้า', 'ghost', enrollStart));
  X.speak(hi + ' มองกล้องเพื่อลงเวลาได้เลยค่ะ');
  if (faces.length) setTimeout(() => { if ($('ckDlg').open && $('ckTitle').textContent === 'ลงเวลาทำงาน' && $('ckBody').querySelector('.big')) scan(); }, 1200);
}

// ---------- ตรวจว่าเป็นคนจริง (กะพริบตาหรือขยับหน้า) + จดจำหน้า ----------
const dist = (a, b) => { let s = 0; for (let i = 0; i < 128; i++) { const d = a[i] - b[i]; s += d * d; } return Math.sqrt(s); };
const ear = (p) => (Math.hypot(p[1].x - p[5].x, p[1].y - p[5].y) + Math.hypot(p[2].x - p[4].x, p[2].y - p[4].y)) / (2 * Math.hypot(p[0].x - p[3].x, p[0].y - p[3].y));
function bestMatch(desc) {
  let best = null, second = 9;
  for (const f of faces) { const d = Math.min(...f.d.map((x) => dist(x, desc))); if (!best || d < best.d) { if (best) second = Math.min(second, best.d); best = { id: f.id, name: f.name, d }; } else second = Math.min(second, d); }
  return best && best.d < MATCH ? { ...best, gap: second - best.d } : null;
}
async function detect() {
  const v = $('ckVideo');
  return fa.detectSingleFace(v, new fa.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 })).withFaceLandmarks().withFaceDescriptor();
}
async function scan() {
  if (!faces.length) { X.toast('ยังไม่มีใครลงทะเบียนใบหน้า — กด "ลงทะเบียนใบหน้า" ก่อนค่ะ', 5000); return; }
  const my = ++run;
  camScreen('สแกนหน้าลงเวลา', 'มองกล้อง แล้วกะพริบตา 1 ครั้งค่ะ');
  try { await openCam(); } catch (e) { screen('ลงเวลาทำงาน', el('div', 'ck-err', 'เปิดกล้องไม่ได้: ' + (e.name || '') + ' ' + String(e.message || e).slice(0, 80)), btn('กลับ', '', home)); return; }
  const t0 = Date.now(); let open = 0, blink = false, yawMin = 9, yawMax = -9, votes = {}, seen = 0;
  while (my === run && Date.now() - t0 < SCAN_MS) {
    const r = await detect().catch(() => null);
    if (my !== run) return;
    if (!r) { $('ckMsg').textContent = 'ยังไม่เห็นหน้า ขยับเข้ามาใกล้อีกนิดค่ะ'; $('ckRing').className = 'ck-ring'; await sleep(150); continue; }
    seen++;
    const lm = r.landmarks, e = (ear(lm.getLeftEye()) + ear(lm.getRightEye())) / 2;
    if (e > 0.25) open++; if (open > 2 && e < 0.2) blink = true;
    const box = r.detection.box, nose = lm.positions[30], yaw = (nose.x - (box.x + box.width / 2)) / box.width;
    yawMin = Math.min(yawMin, yaw); yawMax = Math.max(yawMax, yaw);
    const live = blink || yawMax - yawMin > 0.14;
    const m = bestMatch(r.descriptor);
    if (m) votes[m.id] = (votes[m.id] || 0) + 1;
    const top = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
    $('ckRing').className = 'ck-ring ' + (m ? 'ok' : 'seen');
    $('ckMsg').textContent = !m ? (seen > 12 ? 'ยังจำหน้าไม่ได้ ลองถอดหมวก/แว่นดำ หรือหันเข้าหาแสงค่ะ' : 'กำลังจดจำใบหน้า…') : live ? 'จำได้แล้วค่ะ' : 'กะพริบตา 1 ครั้ง หรือหันหน้าซ้าย-ขวานิดหนึ่งค่ะ';
    if (top && top[1] >= 3 && live) { const selfie = grab(); stopCam(); return confirmPerson(empOf(top[0]) || { id: top[0], name: faces.find((f) => f.id === top[0]).name, pos: '' }, selfie, 'สแกนหน้า'); }
    await sleep(60);
  }
  if (my !== run) return;
  stopCam();
  X.speak('น้องมีไฟจำหน้าไม่ได้ค่ะ เลือกชื่อเองได้นะคะ');
  pickName('เลือกชื่อเอง สแกนหน้าไม่ผ่าน');
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function grab(w = 360) {
  const v = $('ckVideo'); if (!v.videoWidth) return '';
  const h = Math.round(v.videoHeight * w / v.videoWidth), c = document.createElement('canvas'); c.width = w; c.height = h;
  c.getContext('2d').drawImage(v, 0, 0, w, h);
  return c.toDataURL('image/jpeg', w > 250 ? 0.72 : 0.6);
}

// รูปในฐานข้อมูล (ใหญ่) + รูปที่ถ่ายตอนนี้ (เล็ก) — ให้เห็นว่าเป็นคนเดียวกัน
function photos(e, live, done) {
  const w = el('div', 'ck-pics');
  const db = e.pic || faceOf(e.name);
  if (db) { const i = el('img', 'ck-photo db'); i.src = db; i.alt = ''; i.onerror = () => i.remove(); w.append(i); }
  else w.append(el('div', 'ck-photo none', nick(e.name).slice(0, 2)));
  if (live) { const f = el('figure', 'ck-live'); const i = el('img'); i.src = live; i.alt = ''; f.append(i, el('figcaption', null, 'ตอนนี้')); w.append(f); }
  if (done) w.append(el('span', 'ck-tick', '✓'));
  return w;
}
const shrink = (url, w) => new Promise((ok) => { const i = new Image(); i.onload = () => { const c = document.createElement('canvas'); c.width = w; c.height = Math.round(i.height * w / i.width); c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', 0.6)); }; i.onerror = () => ok(''); i.src = url; });
// ถ่ายรูปหน้า (นับ 3-2-1) สำหรับคนที่เลือกชื่อเอง — ลงเวลาเข้างานต้องมีรูปทุกครั้ง
async function snapPhoto(e) {
  const my = run;
  camScreen('ถ่ายรูปยืนยัน · ' + nick(e.name), 'มองกล้องค่ะ');
  try { await openCam(); } catch { return ''; }
  for (const n of [3, 2, 1]) { if (my !== run) return ''; $('ckMsg').textContent = 'ถ่ายรูปใน ' + n + '…'; await sleep(700); }
  let r = null; try { r = await detect(); } catch {}
  $('ckRing').className = 'ck-ring ' + (r ? 'ok' : 'seen');
  const img = grab(); stopCam(); return img;
}

// ---------- ยืนยัน แล้วบันทึกเข้าระบบลงเวลาเดิม ----------
function confirmPerson(e, selfie, how) {
  const st = statusOf(e), action = !st.in ? 'checkin' : !st.out ? 'checkout' : null;
  const head = el('div', 'ck-person');
  head.append(photos(e, selfie));
  head.append(el('div', 'ck-name', e.name), el('div', 'ck-sub', [e.pos, st.in ? 'เข้า ' + st.in : '', st.out ? 'ออก ' + st.out : ''].filter(Boolean).join(' · ')));
  if (!action) { screen('ลงเวลาทำงาน', head, el('div', 'ck-done', 'วันนี้ลงเวลาเข้าและออกครบแล้วค่ะ'), btn('เสร็จ', '', closeCheckin)); X.speak('พี่' + nick(e.name) + ' วันนี้ลงเวลาครบแล้วค่ะ'); return; }
  const label = action === 'checkin' ? 'ลงเวลาเข้างาน' : 'ลงเวลาออกงาน';
  const nodes = [head, el('div', 'ck-q', 'พี่' + nick(e.name) + ' ใช่ไหมคะ')];
  let shift = null;
  if (action === 'checkin' && isB1(e)) {
    const h = bkk().getUTCHours(); shift = h < 8 ? 1 : h < 16 ? 2 : 3;
    const row = el('div', 'ck-row');
    const set = (n) => { shift = n; row.querySelectorAll('button').forEach((b, i) => b.classList.toggle('on', i + 1 === n)); };
    ['กะ 1 (00-08)', 'กะ 2 (08-16)', 'กะ 3 (16-24)'].forEach((t, i) => row.append(btn(t, 'ghost', () => set(i + 1))));
    nodes.push(el('div', 'ck-sub', 'เลือกกะ'), row); set(shift);
  }
  const go = btn(label + ' ' + hhmm() + ' น.', 'big', async () => { let img = selfie; if (!img && action === 'checkin') { img = await snapPhoto(e); if (!img) { X.toast('เปิดกล้องไม่ได้ จะลงเวลาโดยไม่มีรูปค่ะ'); } } submit(e, action, img, how, shift); });
  const row2 = el('div', 'ck-row'); row2.append(btn('ไม่ใช่ฉัน', 'ghost', () => pickName('เลือกชื่อเอง สแกนหน้าจำผิด')));
  if (action === 'checkout') row2.append(btn('ลงเวลาเข้างานแทน', 'ghost', () => submit(e, 'checkin', selfie, how, shift)));
  screen('ยืนยันตัวตน', ...nodes, go, row2);
  X.speak('พี่' + nick(e.name) + ' ใช่ไหมคะ กดยืนยัน' + label + 'ได้เลยค่ะ');
}
async function submit(e, action, selfie, how, shift) {
  const my = ++run;
  screen('กำลังบันทึก', el('div', 'ck-wait', 'กำลังบันทึกเข้าระบบลงเวลา…'));
  const p = { action, empId: e.id, lat: OFFICE.lat, lng: OFFICE.lng, accuracy: 5, lineUID: '', note: 'ลงเวลาที่น้องมีไฟ · ' + how };
  if (action === 'checkin' && shift) p.selectedShift = shift;
  let res = null;
  let photoOk = false;
  if (selfie && action === 'checkin') {
    // แนบรูปหน้าไปกับการลงเวลา (ระบบเดิมเก็บรูปไว้ดูในหน้าสรุป) · ส่งไม่ผ่านลองรูปเล็กลง แล้วค่อยไม่แนบ
    for (const img of [selfie, await shrink(selfie, 220)]) {
      if (!img) continue;
      try { res = await ckGet({ ...p, selfie: img.split(',')[1] }); } catch { res = null; }
      if (res && res.success) { photoOk = true; break; }
      if (res && res.message && !/url|ยาว|size|large|413|414/i.test(res.message)) break; // ไม่ผ่านด้วยเหตุผลอื่น ไม่ต้องลองต่อ
    }
  }
  if (!res || !res.success) { try { res = await ckGet(p); } catch { res = null; } }
  if (my !== run) return;
  if (!res || !res.success) {
    screen('บันทึกไม่สำเร็จ', el('div', 'ck-err', (res && res.message) || 'ระบบลงเวลาไม่ตอบ ลองใหม่อีกครั้ง หรือใช้ LINE ลงเวลาค่ะ'), btn('ลองใหม่', '', () => submit(e, action, selfie, how, shift)), btn('ปิด', 'ghost', closeCheckin));
    X.speak('บันทึกไม่สำเร็จค่ะ'); return;
  }
  const t = res.time || hhmm();
  today[e.name] = { ...statusOf(e), [action === 'checkin' ? 'in' : 'out']: t };
  const verb = action === 'checkin' ? 'ลงเวลาเข้างาน' : 'ลงเวลาออกงาน';
  const pic = photos(e, selfie, true);
  screen('เรียบร้อย', pic, el('div', 'ck-name', e.name), ...(action === 'checkin' ? [el('div', 'ck-sub', photoOk ? '📷 แนบรูปหน้าแล้ว' : selfie ? 'บันทึกเวลาแล้ว แต่แนบรูปไม่สำเร็จ' : 'ไม่มีรูปหน้า')] : []), el('div', 'ck-done', verb + ' ' + t + ' น.' + (res.shift ? ' · ' + res.shift : '')), btn('เสร็จ', '', closeCheckin));
  X.speak(verb + ' ' + sayTime(t) + ' เรียบร้อยค่ะ พี่' + nick(e.name) + (action === 'checkin' ? ' ขอให้ทำงานปลอดภัยนะคะ' : ' เดินทางกลับปลอดภัยนะคะ'));
  X.done && X.done();
  setTimeout(() => { if (my === run) closeCheckin(); }, 7000);
}

// ---------- เลือกชื่อเอง (สำรองเมื่อสแกนไม่ผ่าน · หมายเหตุบอกไว้ในระบบ) ----------
function pickName(how) {
  stopCam();
  const q = el('input', 'ck-search'); q.placeholder = 'พิมพ์ชื่อ'; q.type = 'search';
  const grid = el('div', 'ck-grid');
  const draw = () => {
    const w = q.value.trim();
    const list = emps.filter((e) => !w || e.name.includes(w)).sort((a, b) => (statusOf(a).in ? 1 : 0) - (statusOf(b).in ? 1 : 0));
    grid.replaceChildren(...list.map((e) => { const b = el('button', 'ck-emp' + (statusOf(e).in ? ' done' : '')); b.type = 'button'; const av = el('div', 'ck-av'); if (e.pic) { const i = el('img'); i.src = e.pic; i.alt = ''; i.onerror = () => i.remove(); av.append(i); } else av.textContent = nick(e.name).slice(0, 2); b.append(av, el('span', null, nick(e.name))); b.onclick = () => confirmPerson(e, '', how); return b; }));
  };
  q.oninput = draw; draw();
  screen('เลือกชื่อของคุณ', q, el('div', 'ck-sub', 'ขอบแดง = ยังไม่ลงเวลา · ระบบจะบันทึกว่าเลือกชื่อเอง'), grid);
}

// ---------- ลงทะเบียนใบหน้า (ต้องใช้ PIN เจ้าหน้าที่ + เจ้าตัวกดยินยอม) ----------
function enrollStart() {
  if (!X.cfg().staffPin) { X.toast('ตั้ง PIN เจ้าหน้าที่ในหน้าตั้งค่าก่อนค่ะ', 5000); return; }
  const pin = el('input', 'ck-search'); pin.type = 'password'; pin.inputMode = 'numeric'; pin.placeholder = 'PIN เจ้าหน้าที่';
  const msg = el('div', 'ck-err', '');
  screen('ลงทะเบียนใบหน้า', el('div', 'ck-sub', 'ใส่ PIN เจ้าหน้าที่ก่อน (กันคนลงทะเบียนหน้าแทนคนอื่น)'), pin, msg,
    btn('ต่อไป', 'big', () => { if (pin.value.trim() === String(X.cfg().staffPin)) enrollPick(); else { msg.textContent = 'PIN ไม่ถูกต้อง'; pin.value = ''; } }), btn('กลับ', 'ghost', home));
  setTimeout(() => pin.focus(), 100);
}
function enrollPick() {
  const has = new Set(faces.map((f) => f.id));
  const q = el('input', 'ck-search'); q.placeholder = 'พิมพ์ชื่อ'; q.type = 'search';
  const grid = el('div', 'ck-grid');
  const draw = () => { const w = q.value.trim(); grid.replaceChildren(...emps.filter((e) => !w || e.name.includes(w)).map((e) => { const b = el('button', 'ck-emp' + (has.has(e.id) ? ' done' : ' none')); b.type = 'button'; const av = el('div', 'ck-av'); if (e.pic) { const i = el('img'); i.src = e.pic; i.alt = ''; i.onerror = () => i.remove(); av.append(i); } else av.textContent = nick(e.name).slice(0, 2); b.append(av, el('span', null, nick(e.name) + (has.has(e.id) ? ' ✓' : ''))); b.onclick = () => enrollConsent(e, has.has(e.id)); return b; })); };
  q.oninput = draw; draw();
  screen('เลือกคนที่จะลงทะเบียน', q, el('div', 'ck-sub', '✓ = ลงทะเบียนแล้ว (กดเพื่อลงใหม่หรือลบ)'), grid, btn('กลับ', 'ghost', home));
}
function enrollConsent(e, had) {
  const cb = el('input'); cb.type = 'checkbox'; cb.id = 'ckAgree';
  const lab = el('label', 'ck-consent'); lab.htmlFor = 'ckAgree';
  lab.append(cb, el('span', null, 'ข้าพเจ้า ' + e.name + ' ยินยอมให้น้องมีไฟเก็บข้อมูลจดจำใบหน้า (เป็นตัวเลข ไม่เก็บรูป) เพื่อใช้ลงเวลาทำงานเท่านั้น และขอลบได้ทุกเมื่อ'));
  const nodes = [el('div', 'ck-name', e.name), lab, btn('เริ่มสแกนหน้า', 'big', () => { if (!cb.checked) { X.toast('ต้องกดยินยอมก่อนค่ะ'); return; } enrollCapture(e); })];
  if (had) nodes.push(btn('ลบข้อมูลใบหน้าของคนนี้', 'ghost danger', async () => { try { await learnPost({ action: 'face_del', empId: e.id }); faces = faces.filter((f) => f.id !== e.id); X.toast('ลบข้อมูลใบหน้าแล้วค่ะ'); enrollPick(); } catch (err) { X.toast(String(err.message || err)); } }));
  nodes.push(btn('กลับ', 'ghost', enrollPick));
  screen('ความยินยอม', ...nodes);
}
async function enrollCapture(e) {
  const my = ++run;
  camScreen('ลงทะเบียน: ' + nick(e.name), 'มองตรงที่กล้องค่ะ');
  try { await openCam(); } catch (err) { screen('ลงทะเบียนใบหน้า', el('div', 'ck-err', 'เปิดกล้องไม่ได้'), btn('กลับ', '', enrollPick)); return; }
  const steps = ['มองตรงที่กล้องค่ะ', 'มองตรงอีกครั้งค่ะ', 'หันซ้ายนิดหนึ่งค่ะ', 'หันขวานิดหนึ่งค่ะ', 'เงยหน้านิดหนึ่งค่ะ'];
  const got = []; let i = 0, t0 = Date.now();
  X.speak(steps[0]);
  while (my === run && got.length < steps.length && Date.now() - t0 < 40000) {
    const r = await detect().catch(() => null);
    if (my !== run) return;
    if (r && r.detection.score > 0.7 && r.detection.box.width > 110) {
      got.push(Array.from(r.descriptor, (x) => Math.round(x * 1e4) / 1e4)); i++;
      $('ckRing').className = 'ck-ring ok';
      if (i < steps.length) { $('ckMsg').textContent = '(' + i + '/' + steps.length + ') ' + steps[i]; X.speak(steps[i]); await sleep(1100); }
    } else { $('ckRing').className = 'ck-ring' + (r ? ' seen' : ''); $('ckMsg').textContent = (r ? 'ขยับเข้ามาใกล้อีกนิด · ' : '') + steps[i]; await sleep(150); }
  }
  stopCam();
  if (my !== run) return;
  if (got.length < 3) { screen('ลงทะเบียนไม่สำเร็จ', el('div', 'ck-err', 'เห็นหน้าไม่ชัดพอ ลองหันเข้าหาแสงแล้วลองใหม่ค่ะ'), btn('ลองใหม่', '', () => enrollCapture(e)), btn('กลับ', 'ghost', enrollPick)); return; }
  screen('กำลังบันทึก', el('div', 'ck-wait', 'กำลังบันทึกข้อมูลใบหน้า…'));
  try {
    await learnPost({ action: 'face_save', empId: e.id, name: e.name, descriptors: got, consent: true, device: 'น้องมีไฟ ' + (navigator.platform || '') });
    faces = faces.filter((f) => f.id !== e.id).concat([{ id: e.id, name: e.name, d: got.map((v) => new Float32Array(v)) }]);
    screen('ลงทะเบียนแล้ว', el('div', 'ck-okicon', '✓'), el('div', 'ck-name', e.name), el('div', 'ck-done', 'ต่อไปมองกล้องเพื่อลงเวลาได้เลยค่ะ'), btn('ลองสแกนลงเวลา', 'big', scan), btn('ลงทะเบียนคนต่อไป', 'ghost', enrollPick));
    X.speak('ลงทะเบียนใบหน้าพี่' + nick(e.name) + ' เรียบร้อยค่ะ');
  } catch (err) { screen('บันทึกไม่สำเร็จ', el('div', 'ck-err', String(err.message || err)), btn('ลองใหม่', '', () => enrollCapture(e)), btn('กลับ', 'ghost', enrollPick)); }
}
