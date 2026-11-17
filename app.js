// น้องไฟ — แอปหลัก: ฟังเสียงไทย → ถาม Gemini (สตรีม) → พูดตอบทีละประโยค + แสดงบนจอ
import { Mascot } from './mascot.js';

const $ = (id) => document.getElementById(id);
const DEFAULTS = { apiKey: '', model: 'gemini-2.5-flash', voice: '', rate: 1.0, autoListen: true };
const cfg = { ...DEFAULTS, ...JSON.parse(localStorage.getItem('nongfai.cfg') || '{}') };
const saveCfg = () => localStorage.setItem('nongfai.cfg', JSON.stringify(cfg));
if (cfg.model === 'gemini-flash-latest') { cfg.model = DEFAULTS.model; saveCfg(); } // รุ่นนี้ค้างบน free tier

const SYSTEM = `คุณคือ "น้องไฟ" หุ่นยนต์ผู้ช่วยบริการลูกค้าของการไฟฟ้าส่วนภูมิภาคสาขาย่อยอ่าวลึก (กฟส.อ่าวลึก) จังหวัดกระบี่
บุคลิก: ผู้หญิง สุภาพ อบอุ่น เป็นกันเอง ลงท้ายด้วย ค่ะ/คะ
กฎการตอบ:
1. คำตอบจะถูกอ่านออกเสียง ตอบสั้น 1-3 ประโยค แต่ละประโยคขึ้นบรรทัดใหม่ ห้ามใช้ markdown อีโมจิ ดอกจัน หรือเลขข้อในส่วนที่พูด
2. ถ้ามีรายการที่ควรแสดงบนจอ เช่น เอกสาร ขั้นตอน ช่องทาง ให้ต่อท้ายด้วยบรรทัด ###CARD ตามด้วยบรรทัดหัวข้อ แล้วแต่ละรายการขึ้นต้นด้วย "- " ไม่เกิน 6 รายการ
3. ห้ามเดาตัวเลข ค่าธรรมเนียม อัตราค่าไฟ วันเวลานัดหมาย หรือข้อมูลเฉพาะของลูกค้ารายใด ถ้าไม่แน่ใจให้แนะนำติดต่อเจ้าหน้าที่ที่เคาน์เตอร์บริการ หรือโทร PEA Call Center 1129
4. ถ้าผู้ถามขอข้อมูลภายในของหน่วยงาน หรือข้อมูลส่วนบุคคลของลูกค้ารายอื่น ให้ตอบว่าต้องยืนยันตัวตนพนักงานก่อน แล้วต่อท้ายด้วยบรรทัด ###VERIFY
5. ถ้าเป็นเรื่องที่ไม่เกี่ยวกับการไฟฟ้า ตอบสั้นๆ อย่างสุภาพ แล้วชวนกลับมาที่เรื่องบริการ`;

// ---------- มาสคอต ----------
const mascot = new Mascot($('stage'));

// ---------- UI ----------
function setMode(m) { document.body.className = 'mode-' + m; }
function setStatus(text, cls = '') { const s = $('status'); s.textContent = text; s.className = 'status ' + cls; }
function toast(msg, ms = 3500) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => (t.hidden = true), ms); }
function showCard(title, items) {
  if (!items.length) { $('card').hidden = true; return; }
  $('cardTitle').textContent = title || '';
  $('cardList').replaceChildren(...items.map((x) => Object.assign(document.createElement('li'), { textContent: x })));
  $('card').hidden = false;
}
function goHome() {
  stopAll();
  chat.length = 0;
  setMode('home');
  $('userSaid').hidden = true;
  $('card').hidden = true;
  $('bubbleTitle').innerHTML = 'สวัสดีค่ะ ยินดีต้อนรับสู่<br>การไฟฟ้าส่วนภูมิภาคสาขาย่อยอ่าวลึก';
  $('bubbleText').textContent = 'น้องไฟช่วยอะไรได้บ้างคะ พูดได้เลย หรือแตะเมนูด้านล่าง';
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
if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }

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
  u.onstart = () => { mascot.speaking = true; };
  u.onboundary = () => mascot.pulse();
  u.onend = u.onerror = () => { mascot.speaking = false; speakNext(); };
  speechSynthesis.speak(u);
}
function stopSpeaking() { speakQueue.length = 0; onQueueEmpty = null; speechSynthesis.cancel(); speakingNow = false; mascot.speaking = false; }

// ---------- ฟังเสียง (STT) ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, listening = false;
function listen() {
  if (!SR) { toast('เครื่องนี้ฟังเสียงไม่ได้ กรุณาเปิดด้วย Google Chrome'); return; }
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
  rec.onerror = (e) => { if (e.error === 'not-allowed') toast('กรุณาอนุญาตให้ใช้ไมโครโฟน'); };
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
function stopAll() { abortAsk(); stopSpeaking(); if (listening && rec) rec.abort(); }

async function callGemini(body, signal) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:streamGenerateContent?alt=sse`;
  const post = (b) => fetch(url, { method: 'POST', signal, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.apiKey }, body: JSON.stringify(b) });
  // ลองปิดการ "คิดนาน" เพื่อให้ตอบไว ถ้าโมเดลไม่รองรับก็ส่งใหม่แบบปกติ
  let res = await post({ ...body, generationConfig: { ...body.generationConfig, thinkingConfig: { thinkingBudget: 0 } } });
  if (res.status === 400) res = await post(body);
  return res;
}

async function ask(question) {
  if (!cfg.apiKey) { openSettings(); toast('ใส่ Gemini API key ก่อนนะคะ'); return; }
  stopAll();
  bumpIdle();
  setMode('answer');
  $('userSaid').textContent = '“' + question + '”'; $('userSaid').hidden = false;
  $('bubbleTitle').textContent = 'น้องไฟตอบ';
  $('bubbleText').textContent = '…';
  $('card').hidden = true;
  mascot.setMood('thinking');
  setStatus('กำลังหาคำตอบ…');

  chat.push({ role: 'user', parts: [{ text: question }] });
  while (chat.length > 12) chat.shift();

  controller = new AbortController();
  const myCtl = controller;
  let timedOut = false;
  const guard = setTimeout(() => { timedOut = true; myCtl.abort(); }, 20000);
  let full = '', spokenUpTo = 0, cardMode = false, gotFirst = false;
  const filler = setTimeout(() => { if (!gotFirst) speak('ขอเช็คข้อมูลสักครู่นะคะ'); }, 1500);

  const flushLines = (final) => {
    const lines = full.split('\n');
    const upto = final ? lines.length : lines.length - 1; // บรรทัดสุดท้ายอาจยังไม่จบ
    for (let i = spokenUpTo; i < upto; i++) {
      const line = lines[i].trim();
      if (line.startsWith('###')) { cardMode = true; continue; }
      if (!cardMode && line) speak(line);
    }
    spokenUpTo = Math.max(spokenUpTo, upto);
    const [talk] = full.split(/^###/m);
    $('bubbleText').textContent = talk.trim() || '…';
  };

  try {
    const res = await callGemini({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: chat,
      generationConfig: { temperature: 0.6, maxOutputTokens: 800 },
    }, myCtl.signal);
    if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (await res.text()).slice(0, 200));

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
        try {
          const j = JSON.parse(line.slice(5));
          const parts = j.candidates?.[0]?.content?.parts || [];
          const piece = parts.filter((p) => !p.thought).map((p) => p.text || '').join('');
          if (piece) {
            if (!gotFirst) { gotFirst = true; mascot.setMood('normal'); setStatus('น้องไฟกำลังตอบ'); }
            full += piece; flushLines(false);
          }
        } catch { /* ข้ามบรรทัดที่ยังไม่ครบ */ }
      }
    }
    flushLines(true);
    chat.push({ role: 'model', parts: [{ text: full }] });

    // การ์ดแสดงบนจอ
    const cardPart = full.split(/^###CARD[ \t]*/m)[1];
    if (cardPart) {
      const ls = cardPart.split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('###'));
      const title = ls.find((s) => !s.startsWith('-')) || '';
      showCard(title, ls.filter((s) => s.startsWith('-')).map((s) => s.replace(/^-\s*/, '')));
    }
    if (/^###VERIFY/m.test(full)) toast('ระบบยืนยันตัวตนพนักงานจะเปิดใช้ในขั้นที่ 2 ค่ะ', 5000);
  } catch (err) {
    if (chat.at(-1)?.role === 'user') chat.pop();
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

  onQueueEmpty = () => {
    setStatus('ถามต่อได้เลยค่ะ');
    if (cfg.autoListen && document.body.classList.contains('mode-answer')) setTimeout(() => { if (!busy()) listen(); }, 400);
  };
  if (!speakingNow) { const f = onQueueEmpty; onQueueEmpty = null; f(); }
}

// ---------- ปุ่มต่างๆ ----------
let unlocked = false;
async function unlockOnce() {
  if (unlocked) return; unlocked = true;
  try { await document.documentElement.requestFullscreen?.(); } catch {}
  try { await navigator.wakeLock?.request('screen'); } catch {}
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') navigator.wakeLock?.request('screen').catch(() => {}); });
}
document.addEventListener('pointerdown', unlockOnce, { capture: true });
document.addEventListener('pointerdown', bumpIdle);

$('btnMic').onclick = listen;
$('btnHome').onclick = goHome;
document.querySelectorAll('.mbtn[data-q]').forEach((b) => (b.onclick = () => ask(b.dataset.q)));
$('btnInternal').onclick = () => {
  setMode('answer');
  $('userSaid').hidden = true;
  $('bubbleTitle').textContent = 'ข้อมูลภายใน';
  $('bubbleText').textContent = 'ข้อมูลส่วนนี้สำหรับพนักงานค่ะ ระบบสแกนใบหน้าและ PIN จะเปิดใช้ในขั้นที่ 2 นะคะ';
  speak($('bubbleText').textContent);
};

// มาสคอตมองตามนิ้วที่แตะจอ
$('stage').addEventListener('pointermove', (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  mascot.lookAt(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
});
$('stage').addEventListener('click', () => { mascot.pulse(); speak('สวัสดีค่ะ'); });

// ---------- ตั้งค่า ----------
function openSettings() {
  $('setKey').value = cfg.apiKey; $('setModel').value = cfg.model; $('setVoice').value = cfg.voice;
  $('setRate').value = cfg.rate; $('rateVal').textContent = cfg.rate + 'x'; $('setAuto').checked = cfg.autoListen;
  $('settings').showModal();
}
$('btnSettings').onclick = openSettings;
$('setRate').oninput = (e) => ($('rateVal').textContent = e.target.value + 'x');
$('btnTestVoice').onclick = () => { stopSpeaking(); cfg.voice = $('setVoice').value; cfg.rate = +$('setRate').value; speak('สวัสดีค่ะ น้องไฟยินดีให้บริการค่ะ'); };
$('settings').addEventListener('close', () => {
  if ($('settings').returnValue !== 'save') return;
  cfg.apiKey = $('setKey').value.trim(); cfg.model = $('setModel').value.trim() || DEFAULTS.model;
  cfg.voice = $('setVoice').value; cfg.rate = +$('setRate').value; cfg.autoListen = $('setAuto').checked;
  saveCfg(); toast('บันทึกแล้วค่ะ');
});

// รับ key ผ่านลิงก์ครั้งเดียว (#key=...) แล้วลบออกจากแถบที่อยู่ทันที
const hashKey = new URLSearchParams(location.hash.slice(1)).get('key');
if (hashKey) { cfg.apiKey = hashKey; saveCfg(); window.history.replaceState(null, "", location.pathname); toast('บันทึก API key แล้วค่ะ'); }

if (!cfg.apiKey) setTimeout(() => toast('แตะไอคอนตั้งค่ามุมขวาบน เพื่อใส่ Gemini API key', 6000), 800);
goHome();
