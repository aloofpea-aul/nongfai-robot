// น้องไฟ — แอปหลัก: ฟังเสียงไทย → ถาม Gemini (สตรีม) → พูดตอบทีละประโยค + แสดงบนจอ
import { Mascot } from './mascot.js?v=11172356';
import { WavRecorder } from './recorder.js?v=11172356';
import { TOOL_DECLS, runTool, bkkNow, loadDetail, glossary } from './tools.js?v=11172356';

const $ = (id) => document.getElementById(id);
export const VERSION = '11172356';
// อัปเดตตัวเอง: ถ้าบนเว็บมีเวอร์ชันใหม่กว่า ให้โหลดหน้าใหม่ทันที (กันไอโฟนจำไฟล์เก่า)
fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then((r) => r.json()).then((j) => {
  if (j.v && j.v !== VERSION && !sessionStorage.getItem('nf.reload.' + j.v)) {
    sessionStorage.setItem('nf.reload.' + j.v, '1');
    location.replace(location.pathname + '?r=' + j.v);
  }
}).catch(() => {});

const DEFAULTS = { apiKey: '', model: 'gemini-3.5-flash-lite', voice: '', rate: 1.0, autoListen: true, hubUser: '', hubPass: '', staffPin: '', mode: 'ops', stt: 'gemini', budgetUser: '', budgetPass: '', officeCode: '', cclUser: '', cclPass: '', olUser: '', olPass: '' };
const cfg = { ...DEFAULTS, ...JSON.parse(localStorage.getItem('nongfai.cfg') || '{}') };
const saveCfg = () => localStorage.setItem('nongfai.cfg', JSON.stringify(cfg));
// ชื่อ/รหัสศูนย์รวมงาน: ถ้าเครื่องนี้เคยล็อกอินศูนย์รวมงานไว้ ใช้ชุดนั้นเลย (โดเมนเดียวกัน)
if (!cfg.hubUser) cfg.hubUser = localStorage.getItem('pea_aoluek_username') || '';
if (!cfg.hubPass) cfg.hubPass = localStorage.getItem('pea_aoluek_password') || '';
// 2.5 Flash ฟรีแค่ 20 ครั้ง/วัน · flash-latest ค้าง → ย้ายไปรุ่น Flash-Lite ที่เร็วและโควตาเยอะกว่า
// มือถือ: ปิดการฟังต่ออัตโนมัติเป็นค่าเริ่มต้น (กันไมค์อัดเสียงรอบข้างตอนไม่มีคนพูด) — ตั้งครั้งเดียว เปิดเองได้ในตั้งค่า
if (!cfg.alPhone && matchMedia('(max-width:820px)').matches) { cfg.autoListen = false; cfg.alPhone = 1; saveCfg(); }
if (['gemini-flash-latest', 'gemini-2.5-flash'].includes(cfg.model)) { cfg.model = DEFAULTS.model; saveCfg(); }

const SYSTEM_BASE = `คุณคือ "น้องไฟ" หุ่นยนต์ผู้ช่วยบริการลูกค้าของการไฟฟ้าส่วนภูมิภาคสาขาอ่าวลึก (กฟส.อ่าวลึก) จังหวัดกระบี่
บุคลิก: ผู้หญิง สุภาพ อบอุ่น เป็นกันเอง ลงท้ายด้วย ค่ะ/คะ
กฎการตอบ:
1. คำตอบจะถูกอ่านออกเสียง ตอบสั้น 1-3 ประโยค แต่ละประโยคขึ้นบรรทัดใหม่ ห้ามใช้ markdown อีโมจิ ดอกจัน หรือเลขข้อในส่วนที่พูด
2. ถ้ามีรายการที่ควรแสดงบนจอ เช่น เอกสาร ขั้นตอน ช่องทาง ให้ต่อท้ายด้วยบรรทัด ###CARD ตามด้วยบรรทัดหัวข้อ แล้วแต่ละรายการขึ้นต้นด้วย "- " ไม่เกิน 6 รายการ ลิงก์ให้ใส่ในการ์ดเท่านั้น ห้ามพูดหรือพิมพ์ลิงก์ในส่วนที่พูด
3. ห้ามเดาตัวเลข ค่าธรรมเนียม อัตราค่าไฟ วันเวลานัดหมาย หรือข้อมูลเฉพาะของลูกค้ารายใด ถ้าไม่แน่ใจให้แนะนำติดต่อเจ้าหน้าที่ที่เคาน์เตอร์บริการ หรือโทร PEA Call Center 1129
4. มีเครื่องมือดึงข้อมูลจริงจากศูนย์รวมงาน กฟส.อ่าวลึก หลายระบบ (อากาศ เตือนภัย เวรแก้ไฟ ไฟดับ รับแจ้งไฟดับ เบอร์โทรทีม SLD Patrol ตัดต้นไม้ ระเบียบ พัสดุ รถ จัดซื้อ ซื้อหม้อแปลง safety talk K04 KPI เช็กอิน SAIFI/SAIDI Load01 แบบมาตรฐาน ตัดงบ ออกเลขหนังสือ CCL Office Love ราคามาตรฐานพัสดุ) เมื่อคำถามเกี่ยวข้องให้เรียกเครื่องมือก่อนตอบเสมอ แล้วตอบจากผลที่ได้เท่านั้น ห้ามแต่งข้อมูลเอง
5. ถ้าเครื่องมือตอบว่า need_verify ให้บอกสั้นๆ ว่าเป็นข้อมูลภายใน ขอให้เจ้าหน้าที่ใส่รหัสยืนยันตัวตนบนจอก่อน
6. ตอบเรื่องวัน เวลา ให้เทียบกับวันเวลาปัจจุบันที่ให้ไว้ ในส่วนที่พูดให้อ่านตัวเลขเป็นคำพูดได้ แต่ในการ์ด ###CARD ให้ใช้ตัวเลขเสมอ เช่น 2,048,517 บาท หรือ 16:30 น.
7. ถ้าเป็นเรื่องที่ไม่เกี่ยวกับการไฟฟ้า ตอบสั้นๆ อย่างสุภาพ แล้วชวนกลับมาที่เรื่องบริการ`;

const OPS_NOTE = `
โหมดใช้งานตอนนี้: ใช้ภายในแผนกปฏิบัติการระบบไฟฟ้า (ผปร.) กฟส.อ่าวลึก ผู้ที่คุยด้วยคือพนักงานและคนงานในแผนก ไม่ใช่ลูกค้า
ให้พูดแบบเพื่อนร่วมงานที่สุภาพ เรียกว่า "พี่" ได้ ตอบตรงประเด็นงาน ใช้เครื่องมือข้อมูลภายในได้ทุกตัวโดยไม่ต้องยืนยันตัวตน
ตอบตัวเลขและชื่อให้ครบถ้วน ถ้ารายการยาวให้สรุปที่สำคัญเป็นคำพูด แล้วใส่รายละเอียดในการ์ด`;
function systemText() {
  const n = bkkNow(), wd = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'][n.getUTCDay()];
  return SYSTEM_BASE + (OPS() ? OPS_NOTE : '') + `\nวันเวลาปัจจุบัน: วัน${wd}ที่ ${n.toISOString().slice(0, 16).replace('T', ' ')} (เวลาไทย)` +
    (staffOn() ? '\nตอนนี้เจ้าหน้าที่ยืนยันตัวตนแล้ว ใช้เครื่องมือข้อมูลภายในได้' : '');
}

// ---------- โหมดเจ้าหน้าที่ (ยืนยันด้วย PIN) ----------
let staffUntil = 0, wantVerify = false, lastAsk = null;
const OPS = () => cfg.mode !== 'customer';   // ช่วงทดสอบใช้ในแผนก ผปร. = ถือว่าเป็นเจ้าหน้าที่ทุกคน
const staffOn = () => OPS() || Date.now() < staffUntil;
const toolCtx = { staff: staffOn, show: (d) => showResults(d), needVerify: () => { wantVerify = true; }, creds: () => ({ user: cfg.hubUser, pass: cfg.hubPass, budgetUser: cfg.budgetUser, budgetPass: cfg.budgetPass, officeCode: cfg.officeCode, cclUser: cfg.cclUser, cclPass: cfg.cclPass, olUser: cfg.olUser, olPass: cfg.olPass }) };

// ---------- ผลค้นหา: สรุปตัวเลข + รายการพร้อมรูป + หน้ารายละเอียด ----------
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
function clearResults() { document.getElementById('results').replaceChildren(); document.body.classList.remove('has-results'); }
function showResults(d) {
  if (!d || (!(d.items || []).length && !(d.stats || []).length)) return;
  const box = el('section', 'rs');
  const head = el('div', 'rs-head'); head.append(el('span', null, 'ข้อมูลจาก ' + (d.source || '')));
  if (d.app) { const a = el('a', null, 'เปิดแอป'); a.href = d.app; a.target = '_blank'; a.rel = 'noopener'; head.append(a); }
  box.append(head);
  if ((d.stats || []).length) { const g = el('div', 'rs-stats'); d.stats.forEach((s) => { const c = el('div', 'st' + (s.t ? ' ' + s.t : '')); c.append(el('b', null, s.v == null ? '-' : String(s.v)), el('span', null, s.l)); g.append(c); }); box.append(g); }
  const items = d.items || [], list = el('div', 'rs');
  const renderItems = (n) => { list.replaceChildren(...items.slice(0, n).map((it) => itemRow(it, d))); };
  renderItems(8); box.append(list);
  if (items.length > 8) { const more = el('button', 'rs-more', 'ดูทั้งหมด ' + items.length + ' รายการ'); more.type = 'button'; more.onclick = () => { renderItems(items.length); more.remove(); }; box.append(more); }
  const r = document.getElementById('results'); r.append(box); document.body.classList.add('has-results');
}
function itemRow(it, d) {
  const b = el('button', 'ri'); b.type = 'button';
  if (it.thumb) { const im = el('img', 'th'); im.src = it.thumb; im.alt = ''; im.loading = 'lazy'; im.onerror = () => im.replaceWith(thumbIcon(it)); b.append(im); } else b.append(thumbIcon(it));
  const tx = el('div', 'tx'); tx.append(el('div', 't1', it.title || '-')); if (it.sub) tx.append(el('div', 't2', it.sub)); b.append(tx);
  if (it.badge) b.append(el('span', 'bd' + (it.tone || toneGuess(it.badge) ? ' ' + (it.tone || toneGuess(it.badge)) : ''), String(it.badge)));
  b.onclick = () => openDetail(it, d);
  return b;
}
function thumbIcon(it) { const s = el('span', 'th', it.lat ? '⌖' : it.link ? '▤' : '•'); s.setAttribute('aria-hidden', 'true'); return s; }
function toneGuess(t) { t = String(t); return /ร้ายแรง|ระดับ 3|ใหม่|ยังไม่|ใช้งานอยู่|นอกพื้นที่/.test(t) ? 'red' : /ระดับ 2|รับงาน|กำลัง|รอ|กลาง/.test(t) ? 'amber' : /เสร็จ|ว่าง|ในพื้นที่|ปกติ/.test(t) ? 'green' : ''; }
async function openDetail(it, d) {
  $('dtTitle').textContent = it.title || '';
  $('dtBadge').replaceChildren(...(it.badge ? [el('span', 'bd' + ((it.tone || toneGuess(it.badge)) ? ' ' + (it.tone || toneGuess(it.badge)) : ''), String(it.badge))] : []));
  $('dtText').textContent = [it.sub, it.text].filter(Boolean).join('\n\n');
  const setImgs = (arr) => $('dtImgs').replaceChildren(...(arr || []).map((u) => { const im = el('img'); im.src = u; im.alt = it.title || ''; im.onerror = () => im.remove(); return im; }));
  const setFields = (f) => $('dtFields').replaceChildren(...(f || []).map(([k, v]) => { const r = el('div'); r.append(el('span', null, k), el('span', null, v)); return r; }));
  setImgs(it.images); setFields(it.fields);
  const lat = Number(it.lat), lon = Number(it.lon);
  $('dtMap').hidden = !(lat && lon); if (lat && lon) $('dtMap').href = 'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lon;
  const app = it.link || d.app; $('dtOpen').hidden = !app; if (app) { $('dtOpen').href = app; $('dtOpen').textContent = it.link ? 'เปิดเอกสาร' : 'เปิดในแอป'; }
  $('detailDlg').showModal();
  if (it.detail) {
    $('dtLoading').hidden = false;
    try { const x = await loadDetail(it.detail, toolCtx.creds()); if (x) { if (x.images && x.images.length) setImgs(x.images); if (x.fields && x.fields.length) setFields(x.fields); } }
    catch (e) { toast('โหลดรายละเอียดไม่สำเร็จ: ' + String(e.message || e).slice(0, 80)); }
    $('dtLoading').hidden = true;
  }
}
document.getElementById('dtBack').onclick = () => $('detailDlg').close();

// ---------- มาสคอต ----------
const mascot = new Mascot($('stage'));

// ---------- UI ----------
function setMode(m) { document.body.className = 'mode-' + m + (OPS() ? ' ops' : ''); }
function setStatus(text, cls = '') { const s = $('status'); s.textContent = text; s.className = 'status ' + cls; $('barStatus').textContent = text; $('stripStatus').textContent = text; }
function toast(msg, ms = 3500) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => (t.hidden = true), ms); }
function showCard(title, items) {
  if (!items.length) { $('card').hidden = true; return; }
  $('cardTitle').textContent = title || '';
  $('cardList').replaceChildren(...items.map((x) => {
    const li = document.createElement('li'), m = x.match(/https?:\/\/\S+/);
    if (!m) { li.textContent = x; return li; }
    const label = x.replace(m[0], '').replace(/[:：\-–]\s*$/, '').trim();
    if (label) li.append(label + ' ');
    const a = Object.assign(document.createElement('a'), { href: m[0], target: '_blank', rel: 'noopener', textContent: 'เปิดเอกสาร' });
    li.append(a); return li;
  }));
  $('card').hidden = false;
}
function goHome() {
  stopAll();
  chat.length = 0;
  setMode('home');
  $('userSaid').hidden = true;
  $('card').hidden = true;
  clearResults();
  if (OPS()) {
    $('bubbleTitle').innerHTML = 'สวัสดีค่ะ แผนกปฏิบัติการระบบไฟฟ้า<br>กฟส.อ่าวลึก';
    $('bubbleText').textContent = 'ถามเรื่องเวรแก้ไฟ ไฟดับ อากาศ พัสดุ รถ หรือระเบียบ กฟภ. ได้เลยค่ะ';
  } else {
    $('bubbleTitle').innerHTML = 'สวัสดีค่ะ ยินดีต้อนรับสู่<br>การไฟฟ้าส่วนภูมิภาคสาขาอ่าวลึก';
    $('bubbleText').textContent = 'น้องไฟช่วยอะไรได้บ้างคะ พูดได้เลย หรือแตะเมนูด้านล่าง';
  }
  mascot.setMood('normal');
  setStatus('แตะปุ่มไมค์แล้วพูดได้เลยค่ะ');
}

setInterval(() => { $('clock').textContent = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'; }, 1000);
if (navigator.getBattery) navigator.getBattery().then((b) => {
  const upd = () => { const el = $('battery'); el.hidden = false; el.textContent = 'แบต ' + Math.round(b.level * 100) + '%'; el.classList.toggle('low', b.level <= 0.2 && !b.charging); };
  b.addEventListener('levelchange', upd); b.addEventListener('chargingchange', upd); upd();
});

// กลับหน้าแรกเองเมื่อไม่มีคนคุย 60 วินาที (ลูกค้าคนใหม่จะเริ่มบทสนทนาใหม่)
let idleTimer;
function bumpIdle() { clearTimeout(idleTimer); idleTimer = setTimeout(() => { if (!busy()) goHome(); }, 60000); }

// ---------- เสียงพูด (TTS) ----------
let voices = [];
function loadVoices() {
  voices = speechSynthesis.getVoices().filter((v) => v.lang && v.lang.toLowerCase().startsWith('th'));
  const sel = $('setVoice');
  sel.replaceChildren(...(voices.length ? voices : [{ name: '', lang: '' }]).map((v) =>
    Object.assign(document.createElement('option'), { value: v.name, textContent: v.name ? `${v.name} (${v.lang})` : 'ไม่พบเสียงภาษาไทย – ติดตั้ง Google TTS ภาษาไทย' })));
  sel.value = cfg.voice;
}
if ('speechSynthesis' in window) {
  loadVoices(); speechSynthesis.onvoiceschanged = loadVoices;
  // iPhone/iPad โหลดรายชื่อเสียงช้าและบางทีไม่แจ้ง ให้ลองซ้ำ
  let tries = 0; const t = setInterval(() => { loadVoices(); if (voices.length || ++tries > 20) clearInterval(t); }, 500);
}

const speakQueue = [];
let speakingNow = false, onQueueEmpty = null;
function speak(text) {
  text = text.replace(/[*#_`>]/g, '').trim();
  if (!text) return;
  speakQueue.push(text);
  if (!speakingNow) speakNext();
}
function speakNext() {
  const text = speakQueue.shift();
  if (!text) {
    speakingNow = false; mascot.speaking = false;
    const f = onQueueEmpty; onQueueEmpty = null; if (f) f();
    return;
  }
  speakingNow = true;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'th-TH';
  const v = voices.find((x) => x.name === cfg.voice) || voices[0];
  if (v) u.voice = v;
  u.rate = cfg.rate;
  let started = false;
  u.onstart = () => { started = true; mascot.speaking = true; };
  u.onboundary = () => mascot.pulse();
  u.onend = u.onerror = () => { mascot.speaking = false; speakNext(); };
  speechSynthesis.resume?.();
  speechSynthesis.speak(u);
}

let curSrc = null;
function stopSpeaking() { speakQueue.length = 0; onQueueEmpty = null; if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel(); // iOS: cancel แล้วพูดต่อทันทีจะเงียบ จึง cancel เฉพาะตอนกำลังพูด
  try { curSrc?.stop(); } catch {} curSrc = null; speakingNow = false; mascot.speaking = false; }

// พูดคำสั้นๆ ทันทีในจังหวะที่แตะ — ไอโฟนจะยอมให้พูดคำตอบที่ตามมาทีหลัง
function tapCue(text) {
  return new Promise((res) => {
    try {
      const u = new SpeechSynthesisUtterance(text); u.lang = 'th-TH'; u.rate = cfg.rate;
      const v = voices.find((x) => x.name === cfg.voice) || voices[0]; if (v) u.voice = v;
      u.onend = u.onerror = () => res(); setTimeout(res, 1500);
      speechSynthesis.speak(u);
    } catch { res(); }
  });
}

// ---------- ฟังเสียง (STT) ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, listening = false;
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const useAudioAI = () => IS_IOS || !SR || cfg.stt !== 'device'; // ค่าเริ่มต้น: ให้ Gemini ถอดเสียง (แม่นกว่า + รู้จักชื่อคน/ฟีดเดอร์)
const wav = new WavRecorder();
// iPhone/iPad (Safari 16.4+): 'playback' = เสียงพูดดังแม้เปิดโหมดเงียบ แต่ต้องสลับเป็น 'play-and-record' ก่อนเปิดไมค์
// ไม่บังคับโหมดเสียงอีกแล้ว (โหมด playback ทำให้ไอโฟนเปิดไมค์ไม่ได้) ตั้งกลับเป็น auto ก่อนอัดทุกครั้ง
function setAudioMode(type) { try { if (navigator.audioSession && type === 'auto') navigator.audioSession.type = 'auto'; } catch {} }

function micOn() { listening = true; $('btnMic').classList.add('listening'); mascot.setMood('listening'); setStatus('กำลังฟังอยู่ค่ะ…', 'listening'); }
function micOff() { listening = false; $('btnMic').classList.remove('listening'); mascot.setMood('normal'); }

async function listenAudio() {
  if (wav.active) { wav.stop(); return; }
  stopSpeaking(); abortAsk();
  setAudioMode('auto');
  wav.prime();
  micOn();
  bumpIdle();
  await tapCue('ค่ะ'); // ตอบรับก่อนเริ่มฟัง และปลดล็อกเสียงพูดบนไอโฟน
  try {
    const audio = await wav.record({ onSpeech: () => setStatus('ฟังอยู่ พูดจบแล้วรอสักครู่นะคะ', 'listening') });
    micOff();
    if (!audio) { setStatus('ไม่ได้ยินเสียง แตะไมค์แล้วพูดใหม่นะคะ'); return; }
    setStatus('กำลังแปลงเสียงเป็นข้อความ…'); mascot.setMood('thinking');
    const text = await transcribe(audio);
    mascot.setMood('normal');
    if (!text) { setStatus('ฟังไม่ชัด แตะไมค์แล้วพูดใหม่อีกครั้งนะคะ'); speak('ขอโทษค่ะ ฟังไม่ชัด รบกวนพูดอีกครั้งนะคะ'); return; }
    if (voiceCommand(text)) return;
    ask(text);
  } catch (e) {
    micOff();
    console.error(e);
    toast(e.name === 'NotAllowedError' ? 'กรุณาอนุญาตให้ใช้ไมโครโฟน' : 'เปิดไมค์ไม่ได้: ' + e.message, 6000);
    setStatus('แตะปุ่มไมค์แล้วพูดได้เลยค่ะ');
  }
}

function listen() {
  if (useAudioAI()) return listenAudio();
  if (listening) { rec.stop(); return; }
  stopSpeaking(); abortAsk();
  rec = new SR();
  rec.lang = 'th-TH'; rec.interimResults = true; rec.maxAlternatives = 1; rec.continuous = false;
  let finalText = '';
  rec.onstart = () => { listening = true; $('btnMic').classList.add('listening'); mascot.setMood('listening'); setStatus('กำลังฟังอยู่ค่ะ…', 'listening'); };
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) finalText += e.results[i][0].transcript; else interim += e.results[i][0].transcript;
    }
    const shown = (finalText + interim).trim();
    if (shown) { $('userSaid').textContent = '“' + shown + '”'; $('userSaid').hidden = false; }
  };
  rec.onerror = (e) => {
    if (e.error === 'not-allowed') toast('กรุณาอนุญาตให้ใช้ไมโครโฟน');
    if (e.error === 'service-not-allowed') toast('iPad: เปิด ตั้งค่า > Siri และ การป้อนตามคำบอก (Dictation) ก่อนนะคะ', 7000);
  };
  rec.onend = () => {
    listening = false; $('btnMic').classList.remove('listening'); mascot.setMood('normal');
    if (finalText.trim()) ask(finalText.trim());
    else setStatus('แตะปุ่มไมค์แล้วพูดได้เลยค่ะ');
  };
  rec.start();
  bumpIdle();
}

// ---------- ถาม Gemini (สตรีม) ----------
const chat = [];
let controller = null;
const busy = () => listening || speakingNow || !!controller;
function abortAsk() { if (controller) { controller.abort(); controller = null; } }
function stopAll() { abortAsk(); stopSpeaking(); if (listening && rec) rec.abort(); wav.cancel(); }

// ถ้าโควตาฟรีของรุ่นที่ใช้อยู่หมด (429) จะลองรุ่นถัดไปให้อัตโนมัติ
const FALLBACK_MODELS = ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];
async function callGemini(body, signal) {
  const models = [cfg.model, ...FALLBACK_MODELS.filter((m) => m !== cfg.model)];
  let res;
  for (const m of models) {
    const b = /2\.5/.test(m) ? { ...body, generationConfig: { ...body.generationConfig, thinkingConfig: { thinkingBudget: 0 } } } : body;
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:streamGenerateContent?alt=sse`,
      { method: 'POST', signal, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.apiKey }, body: JSON.stringify(b) });
    if (res.status !== 429 && res.status !== 404) return res;
  }
  return res;
}

// ---------- ถอดเสียงเป็นข้อความก่อน (แยกจากการตอบ) ให้ตรงกับที่พูดมากที่สุด ----------
let glossaryText = '';
glossary().then((g) => { glossaryText = g; }).catch(() => {});
async function transcribe(audio) {
  if (!cfg.apiKey) { openSettings(); toast('ใส่ Gemini API key ก่อนนะคะ'); return ''; }
  const prompt = `ถอดเสียงพูดในไฟล์นี้ออกมาเป็นข้อความตามที่ผู้พูดพูดจริงทุกคำ
- ภาษาไทยเป็นหลัก อาจมีคำภาษาอังกฤษ ตัวเลข หรือรหัส ให้เขียนตามที่ได้ยิน เช่น ALA06, KPI 2.11
- ห้ามตอบคำถาม ห้ามสรุป ห้ามแก้ใจความ ห้ามเติมคำที่ไม่ได้พูด ตัดเฉพาะคำซ้ำ เอ่อ อ่า
- ถ้าเสียงไม่ชัดให้เลือกคำที่ใกล้ที่สุดจากรายการคำศัพท์ด้านล่าง
- ถ้าไม่มีเสียงพูดของคน ให้ตอบว่า [ไม่มีเสียง]
ตอบเฉพาะข้อความที่ถอดได้ บรรทัดเดียว
คำศัพท์ที่อาจได้ยิน (ชื่อคน ฟีดเดอร์ ชื่อระบบ): ${glossaryText || 'กฟส.อ่าวลึก, เวรแก้ไฟ, ฟีดเดอร์, หม้อแปลง, Patrol'}`;
  const body = { contents: [{ role: 'user', parts: [{ inlineData: { mimeType: audio.mime, data: audio.b64 } }, { text: prompt }] }], generationConfig: { temperature: 0, maxOutputTokens: 300 } };
  // ทดสอบแล้ว: ชื่อรุ่น flash-lite-latest ถอดเสียงเร็วสุด (~2 วิ) ส่วน 3.5/3.1 flash-lite ใช้ 7–10 วิ
  for (const m of ['gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', cfg.model]) {
    try {
      const b = /2\.5/.test(m) ? { ...body, generationConfig: { ...body.generationConfig, thinkingConfig: { thinkingBudget: 0 } } } : body;
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.apiKey }, body: JSON.stringify(b) });
      if (r.status === 429 || r.status === 404) continue;
      const j = await r.json();
      const t = (j.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('').trim().replace(/^["“]|["”]$/g, '');
      const clean = t.replace(/([\u0E00-\u0E7F])\s+(?=[\u0E00-\u0E7F])/g, '$1'); // ตัดช่องว่างที่แทรกระหว่างคำไทย
      return /\[ไม่มีเสียง\]/.test(clean) || clean.length < 2 ? '' : clean;
    } catch (e) { console.warn('transcribe', e); }
  }
  return '';
}

// คำสั่งเสียงที่ทำได้ทันที ไม่ต้องถาม AI
function voiceCommand(t) {
  const x = t.replace(/\s+/g, '').replace(/ค่ะ|ครับ|คะ|นะ/g, '');
  if (/^(กลับ)?หน้าแรก$|^กลับหน้าหลัก$|^เริ่มใหม่$/.test(x)) { goHome(); speak('กลับหน้าแรกแล้วค่ะ'); return true; }
  if (/^(หยุด|พอแล้ว|เงียบ|ยกเลิก)$/.test(x)) { stopAll(); setStatus('หยุดแล้วค่ะ'); return true; }
  return false;
}

const AUDIO_NOTE = 'ไฟล์เสียงนี้คือคำพูดของลูกค้า บรรทัดแรกให้ขึ้นต้นด้วย ###USER: ตามด้วยคำที่ลูกค้าพูดเป็นข้อความภาษาไทย แล้วขึ้นบรรทัดใหม่ตอบตามกฎปกติ ถ้าฟังไม่ออกให้ขอให้พูดอีกครั้งอย่างสุภาพ';

async function ask(question, audio, keepCue) {
  if (!cfg.apiKey) { openSettings(); toast('ใส่ Gemini API key ก่อนนะคะ'); return; }
  if (keepCue) { abortAsk(); if (listening && rec) rec.abort(); wav.cancel(); } else stopAll();
  bumpIdle();
  setMode('answer');
  $('userSaid').textContent = audio ? 'กำลังฟังที่พูด…' : '“' + question + '”'; $('userSaid').hidden = false;
  $('bubbleTitle').textContent = 'น้องไฟตอบ';
  $('bubbleText').textContent = '…';
  $('card').hidden = true;
  clearResults();
  mascot.setMood('thinking');
  setStatus('กำลังหาคำตอบ…');

  chat.push(audio
    ? { role: 'user', parts: [{ inlineData: { mimeType: audio.mime, data: audio.b64 } }, { text: AUDIO_NOTE }] }
    : { role: 'user', parts: [{ text: question }] });
  while (chat.length > 12) chat.shift();

  controller = new AbortController();
  const myCtl = controller;
  let timedOut = false;
  const guard = setTimeout(() => { timedOut = true; myCtl.abort(); }, 45000);
  let full = '', spokenUpTo = 0, cardMode = false, gotFirst = false, heard = question || '';
  wantVerify = false;
  const filler = setTimeout(() => { if (!gotFirst) speak('ขอเช็คข้อมูลสักครู่นะคะ'); }, 1500);

  const flushLines = (final) => {
    const lines = full.split('\n');
    const upto = final ? lines.length : lines.length - 1; // บรรทัดสุดท้ายอาจยังไม่จบ
    for (let i = spokenUpTo; i < upto; i++) {
      let line = lines[i].trim().replace(/^###(?!USER|CARD|VERIFY)[^:\n]*:\s*/, '');
      if (line.startsWith('###USER:')) { const said = line.slice(8).trim(); if (said) { heard = said; $('userSaid').textContent = '“' + said + '”'; } continue; }
      if (line.startsWith('###')) { cardMode = true; continue; }
      if (!cardMode && line) speak(line);
    }
    spokenUpTo = Math.max(spokenUpTo, upto);
    const [talk] = full.replace(/^###USER:.*$/m, '').replace(/^###(?!USER|CARD|VERIFY)[^:\n]*:\s*/gm, '').split(/^###/m);
    $('bubbleText').textContent = talk.trim() || '…';
  };

  try {
    const turnStart = chat.length - 1;
    for (let round = 0; round < 4; round++) {
      const res = await callGemini({
        systemInstruction: { parts: [{ text: systemText() }] },
        contents: chat,
        tools: TOOL_DECLS,
        generationConfig: { temperature: 0.4, maxOutputTokens: 900 },
      }, myCtl.signal);
      if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (await res.text()).slice(0, 200));

      const modelParts = [], calls = [];
      const reader = res.body.getReader(), dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
          if (!line.startsWith('data:')) continue;
          let j; try { j = JSON.parse(line.slice(5)); } catch { continue; }
          for (const p of j.candidates?.[0]?.content?.parts || []) {
            modelParts.push(p);
            if (p.functionCall) { calls.push(p.functionCall); continue; }
            if (p.thought || !p.text) continue;
            if (!gotFirst) { gotFirst = true; mascot.setMood('normal'); setStatus('น้องไฟกำลังตอบ'); }
            full += p.text; flushLines(false);
          }
        }
      }
      if (!calls.length) break;
      // เรียกเครื่องมือแล้วส่งผลกลับให้ AI ตอบต่อ
      setStatus('กำลังดึงข้อมูล…');
      chat.push({ role: 'model', parts: modelParts });
      const results = await Promise.all(calls.map(async (c) => ({ functionResponse: { name: c.name, response: { result: await runTool(c.name, c.args, toolCtx) } } })));
      chat.push({ role: 'user', parts: results });
    }
    // เก็บประวัติแบบย่อ: คำถาม (เป็นข้อความ) + คำตอบสุดท้าย ไม่เก็บข้อมูลดิบจากเครื่องมือ
    chat.splice(turnStart);
    chat.push({ role: 'user', parts: [{ text: heard || '(ลูกค้าพูดด้วยเสียง)' }] });
    flushLines(true);
    chat.push({ role: 'model', parts: [{ text: full.replace(/^###USER:.*\n?/m, '') }] });

    // การ์ดแสดงบนจอ
    const cardPart = full.split(/^###CARD[ \t]*/m)[1];
    if (cardPart) {
      const ls = cardPart.split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('###'));
      const title = ls.find((s) => !s.startsWith('-')) || '';
      showCard(title, ls.filter((s) => s.startsWith('-')).map((s) => s.replace(/^-\s*/, '')));
    }

  } catch (err) {
    while (chat.length && chat.at(-1).role !== 'model') chat.pop();
    if (err.name === 'AbortError' && !timedOut) return;
    console.error(err);
    const quota = String(err.message).includes('429');
    const msg = quota ? 'ตอนนี้มีคนใช้งานเยอะ ขอพักสักครู่นะคะ ติดต่อเจ้าหน้าที่ที่เคาน์เตอร์ได้เลยค่ะ'
      : 'ขออภัยค่ะ ตอนนี้น้องไฟเชื่อมต่อไม่ได้ กรุณาติดต่อเจ้าหน้าที่ที่เคาน์เตอร์นะคะ';
    $('bubbleText').textContent = msg; speak(msg);
    if (String(err.message).includes('40')) toast('เรียก AI ไม่สำเร็จ: ' + err.message.slice(0, 120), 8000);
  } finally {
    clearTimeout(filler); clearTimeout(guard);
    if (controller === myCtl) controller = null;
    mascot.setMood('normal');
  }

  lastAsk = heard || question;
  if (wantVerify) { openPin(); return; }
  onQueueEmpty = () => {
    setStatus(staffOn() ? 'โหมดเจ้าหน้าที่ · ถามต่อได้เลยค่ะ' : 'ถามต่อได้เลยค่ะ');
    if (cfg.autoListen && document.body.classList.contains('mode-answer')) setTimeout(() => { if (!busy()) listen(); }, 400);
  };
  if (!speakingNow) { const f = onQueueEmpty; onQueueEmpty = null; f(); }
}

// ---------- ปุ่มต่างๆ ----------
let unlocked = false;
async function unlockOnce() {
  if (unlocked) return; unlocked = true;
  // iPad/iPhone: ต้อง "ปลดล็อก" เสียงพูดด้วยการแตะครั้งแรก ไม่งั้นคำตอบแรกจะเงียบ
  try { const u = new SpeechSynthesisUtterance('สวัสดี'); u.lang = 'th-TH'; u.volume = 0; speechSynthesis.speak(u); } catch {}
  const el = document.documentElement;
  try { await (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el); } catch {}
  try { await navigator.wakeLock?.request('screen'); } catch {}
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') navigator.wakeLock?.request('screen').catch(() => {}); });
}
document.addEventListener('pointerdown', unlockOnce, { capture: true });
document.addEventListener('pointerdown', bumpIdle);

$('btnMic').onclick = listen;
$('btnHome').onclick = goHome;
$('btnHome2').onclick = goHome;
// แตะคำพูดที่ถอดได้ เพื่อแก้แล้วส่งใหม่
$('userSaid').addEventListener('click', () => {
  const t = $('userSaid').textContent.replace(/^“|”$/g, '').trim();
  if (!t || t === 'กำลังฟังที่พูด…') return;
  $('typeInput').value = t; $('btnSend').hidden = false; $('typeInput').focus();
  toast('แก้คำแล้วกดส่งได้เลยค่ะ');
});
// ช่องพิมพ์คำถาม
$('typeInput').addEventListener('input', () => { $('btnSend').hidden = !$('typeInput').value.trim(); });
$('typeForm').onsubmit = (e) => {
  e.preventDefault();
  const q = $('typeInput').value.trim();
  if (!q) return;
  $('typeInput').value = ''; $('btnSend').hidden = true; $('typeInput').blur();
  stopSpeaking(); tapCue('ค่ะ'); // ปลดล็อกเสียงพูดบนไอโฟนในจังหวะที่กดส่ง
  ask(q, null, true);
};
document.querySelectorAll('.mbtn[data-q]').forEach((b) => (b.onclick = () => { stopSpeaking(); tapCue('ได้เลยค่ะ'); ask(b.dataset.q, null, true); }));
$('btnInternal').onclick = () => { stopSpeaking(); tapCue('ขอรหัสยืนยันตัวตนเจ้าหน้าที่ค่ะ'); lastAsk = null; openPin(); };

// ---------- หน้าใส่ PIN เจ้าหน้าที่ ----------
function openPin() {
  if (!cfg.staffPin) { toast('ยังไม่ได้ตั้ง PIN เจ้าหน้าที่ — ตั้งได้ที่หน้าตั้งค่า', 6000); return; }
  $('pinInput').value = ''; $('pinMsg').textContent = '';
  $('pinDlg').showModal(); setTimeout(() => $('pinInput').focus(), 50);
}
$('pinForm').onsubmit = (e) => {
  e.preventDefault();
  if ($('pinInput').value.trim() !== String(cfg.staffPin)) { $('pinMsg').textContent = 'รหัสไม่ถูกต้อง'; $('pinInput').value = ''; return; }
  staffUntil = Date.now() + 5 * 60e3;
  $('pinDlg').close();
  setStatus('โหมดเจ้าหน้าที่ 5 นาที');
  tapCue('ยืนยันแล้วค่ะ');
  if (lastAsk) { const q = lastAsk; lastAsk = null; ask(q, null, true); }
};
$('pinCancel').onclick = () => { $('pinDlg').close(); setStatus('ถามเรื่องอื่นได้เลยค่ะ'); };

// มาสคอตมองตามนิ้วที่แตะจอ
$('stage').addEventListener('pointermove', (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  mascot.lookAt(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
});
$('stage').addEventListener('click', () => { mascot.pulse(); speak('สวัสดีค่ะ'); });

// ---------- ตั้งค่า ----------
function openSettings() {
  loadVoices();
  $('setKey').value = cfg.apiKey; $('setModel').value = cfg.model; $('setVoice').value = cfg.voice;
  $('setRate').value = cfg.rate; $('rateVal').textContent = cfg.rate + 'x'; $('setAuto').checked = cfg.autoListen;
  $('setMode').value = cfg.mode; $('setStt').value = cfg.stt;
  $('set_budgetUser').value = cfg.budgetUser; $('set_budgetPass').value = cfg.budgetPass; $('set_officeCode').value = cfg.officeCode; $('set_cclUser').value = cfg.cclUser; $('set_cclPass').value = cfg.cclPass; $('set_olUser').value = cfg.olUser; $('set_olPass').value = cfg.olPass;
  $('setHubUser').value = cfg.hubUser; $('setHubPass').value = cfg.hubPass; $('setPin').value = cfg.staffPin;
  $('verLabel').textContent = 'เวอร์ชัน ' + VERSION;
  $('settings').showModal();
}
$('btnSettings').onclick = openSettings;
$('btnPaste').onclick = async () => {
  try { const t = (await navigator.clipboard.readText()).trim(); if (t) $('setKey').value = t; else toast('คลิปบอร์ดว่างค่ะ'); }
  catch { toast('วางไม่ได้ ลองกดค้างที่ช่องแล้วเลือก "วาง" นะคะ'); }
};
$('setRate').oninput = (e) => ($('rateVal').textContent = e.target.value + 'x');
$('btnTestVoice').onclick = () => { stopSpeaking(); cfg.voice = $('setVoice').value; cfg.rate = +$('setRate').value; speak('สวัสดีค่ะ น้องไฟยินดีให้บริการค่ะ'); };
$('settings').addEventListener('close', () => {
  if ($('settings').returnValue !== 'save') return;
  cfg.apiKey = $('setKey').value.trim(); cfg.model = $('setModel').value.trim() || DEFAULTS.model;
  cfg.voice = $('setVoice').value; cfg.rate = +$('setRate').value; cfg.autoListen = $('setAuto').checked;
  cfg.budgetUser = $('set_budgetUser').value.trim(); cfg.budgetPass = $('set_budgetPass').value.trim(); cfg.officeCode = $('set_officeCode').value.trim(); cfg.cclUser = $('set_cclUser').value.trim(); cfg.cclPass = $('set_cclPass').value.trim(); cfg.olUser = $('set_olUser').value.trim(); cfg.olPass = $('set_olPass').value.trim();
  cfg.hubUser = $('setHubUser').value.trim(); cfg.hubPass = $('setHubPass').value; cfg.staffPin = $('setPin').value.trim();
  cfg.mode = $('setMode').value; cfg.stt = $('setStt').value;
  saveCfg(); toast('บันทึกแล้วค่ะ'); if (document.body.classList.contains('mode-home')) goHome(); else setMode('answer');
});

// รับ key ผ่านลิงก์ครั้งเดียว (#key=...) แล้วลบออกจากแถบที่อยู่ทันที
const hashKey = new URLSearchParams(location.hash.slice(1)).get('key');
if (hashKey) { cfg.apiKey = hashKey; saveCfg(); window.history.replaceState(null, "", location.pathname); toast('บันทึก API key แล้วค่ะ'); }

if (!cfg.apiKey) setTimeout(() => toast('แตะไอคอนตั้งค่ามุมขวาบน เพื่อใส่ Gemini API key', 6000), 800);
goHome();
