// ฝึกภาษาอังกฤษกับน้องมีไฟ (เชื่อม English Step)
// ใช้ข้อมูลบทเรียนและภาพปากชุดเดียวกับแอป: /english-step/data.js + /english-step/mouth.js
// - สอนพูดทีละคำ: ภาพปากขยับ + อ่านคำสำเนียงอังกฤษ → อัดเสียง → ให้คะแนน → บอกวิธีแก้เป็นภาษาไทย
// - เทียบคู่เสียง (ship / sheep) ด้วยภาพปากขยับ
// - คะแนนฝึกพูดบันทึกเข้าผลเรียน English Step ของผู้เรียน (ถ้ารู้ชื่อ)
export const ENG_API = 'https://script.google.com/macros/s/AKfycby-QfNUJFz0vCVtD4K0Fk3_k4d-U6pkkdjxjCgk69eRbdohQJPRJjU7zkllpJ2FS9ky/exec';
const PER_ROUND = 8;
let X = null;              // ctx จาก app.js
let S = null;              // รอบฝึกปัจจุบัน
let loading = null;

/* ---------- โหลดข้อมูลบทเรียน + ภาพปาก (ครั้งเดียว) ---------- */
function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('โหลด ' + src + ' ไม่ได้')); document.head.append(s); });
}
export function ensureES() {
  if (window.ES_DATA && window.MOUTH) return Promise.resolve(window.ES_DATA);
  if (!loading) loading = Promise.all([window.ES_DATA ? 0 : loadScript('/english-step/data.js?v=20261126'), window.MOUTH ? 0 : loadScript('/english-step/mouth.js?v=20261126')]).then(() => window.ES_DATA).catch((e) => { loading = null; throw e; });
  return loading;
}
const low = (s) => String(s || '').trim().toLowerCase();
// หากลุ่มเสียงของคำ: คำตัวอย่างก่อน แล้วคำแรกของคู่ แล้วค่อยคำคู่ (sheep อยู่กลุ่ม อี ยาว ไม่ใช่กลุ่ม ch)
const findSound = (D, w) => D.SOUNDS.find((x) => x.ex.includes(w)) || D.SOUNDS.find((x) => x.pairs.some((p) => p[0] === w)) || D.SOUNDS.find((x) => x.pairs.some((p) => p.includes(w)));

/* ---------- ค้นข้อมูลคำ/เสียง (ใช้ทั้งการ์ดและเครื่องมือ english_explain) ---------- */
export async function esInfo(word) {
  const D = await ensureES(), w = low(word);
  if (!w) return null;
  const s = findSound(D, w);
  const v = D.VOCAB.find((x) => x[1] === w);
  const pair = s && s.pairs.find((p) => p.includes(w));
  return {
    คำ: w, ความหมาย: D.TH[w] || (v ? v[2] : ''),
    ประโยคตัวอย่าง: v ? v[3] : '', คำแปลประโยค: v ? D.VTH[D.VOCAB.indexOf(v)] : '',
    กลุ่มเสียง: s ? s.name : '', วิธีวางปาก: s ? s.steps : [],
    คู่เสียงที่มักสับสน: pair ? pair.join(' / ') : '', ความหมายคำคู่: pair ? pair.map((x) => x + ' = ' + (D.TH[x] || '')).join(', ') : '',
    _sound: s ? s.id : ''
  };
}
// เลือกท่าปากของคำ: เสียงหลักของกลุ่ม หรือท่าคู่ (เช่น sink → s)
function poseOf(D, soundId, word) {
  const dm = D.DEMO[soundId]; if (!dm) return null;
  const c = (dm.cmp || []).find((x) => x[1] === word);
  if (c) return c[0];
  const s = D.SOUNDS.find((x) => x.id === soundId);
  const p = s && s.pairs.find((x) => x[1] === word);
  if (p && dm.cmp && dm.cmp[1]) return dm.cmp[1][0];
  return dm.m;
}

/* ---------- เสียงอ่านภาษาอังกฤษ ---------- */
let enVoice = null;
function pickEn() { const v = speechSynthesis.getVoices(); enVoice = v.find((x) => /en[-_]US/i.test(x.lang) && /Google|Samantha|Microsoft|Siri/i.test(x.name)) || v.find((x) => /^en/i.test(x.lang)) || null; }
function sayEn(text, rate = 0.8) {
  return new Promise((res) => {
    try {
      if (!enVoice) pickEn();
      const u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; if (enVoice) u.voice = enVoice; u.rate = rate;
      if (X.cfg().muted) u.volume = 0;
      u.onstart = () => X.mascot.speaking = true;
      u.onend = u.onerror = () => { X.mascot.speaking = false; res(); };
      setTimeout(res, 4000);
      speechSynthesis.speak(u);
    } catch { res(); }
  });
}

/* ---------- ให้คะแนนการออกเสียง ---------- */
async function geminiJudge(audio, word) {
  const key = X.cfg().apiKey; if (!key) return null;
  const prompt = `ผู้เรียนชาวไทยกำลังฝึกพูดคำภาษาอังกฤษว่า "${word}"
ฟังเสียงในไฟล์แล้วตอบเป็น JSON เท่านั้น:
{"heard":"คำภาษาอังกฤษที่ได้ยินจริงตามเสียง (ห้ามแก้ให้ตรงคำเป้าหมาย ถ้าออกเสียงผิดเป็นอีกคำให้เขียนคำนั้น)","score":ตัวเลข 0-100 ความใกล้เคียงกับการออกเสียงมาตรฐาน,"tip":"คำแนะนำภาษาไทย 1 ประโยคสั้นๆ เรื่องวิธีวางปาก/ลิ้น ถ้าออกเสียงดีแล้วให้เว้นว่าง"}
ถ้าไม่มีเสียงพูดของคน ให้ heard เป็น "" และ score เป็น 0`;
  const body = { contents: [{ role: 'user', parts: [{ inlineData: { mimeType: audio.mime, data: audio.b64 } }, { text: prompt }] }], generationConfig: { temperature: 0, maxOutputTokens: 200, responseMimeType: 'application/json' } };
  for (const m of ['gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', X.cfg().model]) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body) });
      if (r.status === 429 || r.status === 404) continue;
      const j = await r.json();
      const t = (j.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('');
      const o = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
      return { heard: low(o.heard), score: Math.max(0, Math.min(100, Math.round(Number(o.score) || 0))), tip: String(o.tip || '') };
    } catch (e) { console.warn('english judge', e); }
  }
  return null;
}
function srJudge(word) {
  return new Promise((res) => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return res(null);
    const r = new SR(); r.lang = 'en-US'; r.interimResults = false; r.maxAlternatives = 5;
    let done = false; const fin = (v) => { if (!done) { done = true; res(v); } };
    r.onresult = (e) => {
      const alts = [...e.results[0]].map((a) => ({ t: low(a.transcript), c: a.confidence }));
      const words = (s) => s.replace(/[^a-z ]/g, '').split(' ');
      const hit = alts.find((a) => a.t === word || words(a.t).includes(word));
      fin(hit ? { heard: alts[0].t, score: Math.min(100, Math.round(60 + 40 * (hit === alts[0] ? (alts[0].c || 0.8) : 0.5))), tip: '' } : { heard: alts[0] ? alts[0].t : '', score: 25, tip: '' });
    };
    r.onerror = () => fin({ heard: '', score: 0, tip: '' });
    r.onend = () => fin({ heard: '', score: 0, tip: '' });
    try { r.start(); } catch { fin(null); }
  });
}
async function listenAndJudge(word) {
  if (X.useAudioAI()) {
    X.wav.prime();
    const audio = await X.wav.record({ noSpeechMs: 6000, minSpeechMs: 250, silenceMs: 900, maxMs: 6000 });
    if (!audio) return { heard: '', score: 0, tip: '' };
    setMsg('กำลังฟังว่าออกเสียงเป็นอย่างไร…');
    return (await geminiJudge(audio, word)) || { heard: '', score: 0, tip: '', fail: true };
  }
  return (await srJudge(word)) || { heard: '', score: 0, tip: '', fail: true };
}

/* ---------- บันทึก/อ่านผลเรียนจาก English Step ---------- */
export async function engCall(action, data = {}) {
  const c = X.cfg();
  if (!c.hubUser || !c.hubPass) return { ok: false, msg: 'ยังไม่ได้ใส่บัญชีศูนย์รวมงานในตั้งค่าน้องมีไฟ' };
  const r = await fetch(ENG_API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, hubUser: c.hubUser, hubPass: c.hubPass, ...data }) });
  return r.json();
}

/* ---------- หน้าจอ ---------- */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function css() {
  if ($('engCss')) return;
  const st = document.createElement('style'); st.id = 'engCss';
  st.textContent = '.eng-stage{display:flex;align-items:center;gap:8px;background:#FBF7F3;border-radius:16px;padding:8px}.eng-stage>div{min-width:0}.eng-stage svg{width:100%;height:auto;display:block}' +
    '.eng-word{font-size:44px;font-weight:700;line-height:1.1;font-family:system-ui,sans-serif}.eng-th{font-size:18px;color:#3D63C9}.eng-sent{font-size:17px;color:#444}' +
    '.eng-bar{height:12px;background:#eee;border-radius:6px;overflow:hidden}.eng-bar i{display:block;height:100%;width:0;background:#1D9E75;transition:width .5s}' +
    '.eng-msg{font-size:18px;min-height:26px;color:#4b2e83}.eng-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px}.eng-cap{font-size:15px;color:#666}' +
    '.ck-btn.eng-go{background:#B85A12;border-color:#B85A12;color:#fff}.eng-mic.on{background:#B42318;border-color:#B42318;color:#fff}';
  document.head.append(st);
  if (!$('engDlg')) {
    const d = document.createElement('dialog'); d.id = 'engDlg'; d.className = 'ck';
    d.innerHTML = '<div class="dt-head"><button id="engBack" type="button" class="iconbtn" aria-label="ปิด"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg></button><span id="engTitle">ฝึกภาษาอังกฤษ</span></div><div class="ck-body" id="engBody"></div>';
    document.body.append(d);
    $('engBack').onclick = closeEnglish;
    d.addEventListener('close', () => { if (S) S.run++; S = null; window.__engCoachOn = false; });
  }
}
function setMsg(t) { const m = $('engMsg'); if (m) m.textContent = t; }
export function closeEnglish() { if (S) S.run++; S = null; window.__engCoachOn = false; const d = $('engDlg'); if (d && d.open) d.close(); }

/* ภาพปากเคลื่อนไหว */
function stageHTML() { return '<div class="eng-stage"><div style="flex:3" id="engSide"></div><div style="flex:2" id="engFront"></div></div><div class="eng-cap" id="engCap">ท่าปกติ</div>'; }
function draw(p) { const a = $('engSide'), b = $('engFront'); if (!a || !b) return false; a.innerHTML = window.MOUTH.side(p); b.innerHTML = window.MOUTH.front(p.f); return true; }
function move(st, to, ms) {
  const M = window.MOUTH, from = st.cur, id = st.run;
  return new Promise((res) => { const t0 = performance.now();
    const f = (now) => { if (id !== st.run) return res(false); const t = Math.min(1, (now - t0) / ms), e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      if (!draw(M.lerp(from, to, e))) return res(false);
      if (t < 1) requestAnimationFrame(f); else { st.cur = to; res(true); } };
    requestAnimationFrame(f); });
}

/* ---------- เริ่มรอบฝึก ---------- */
export function initEnglish(ctx) { X = ctx; if ('speechSynthesis' in window) { pickEn(); speechSynthesis.addEventListener?.('voiceschanged', pickEn); } }

function pickTopic(D, topic, weak) {
  const t = low(topic);
  if (/คำศัพท์|ศัพท์|vocab|word/.test(t)) return { mode: 'vocab' };
  const alias = { 'th': 'th1', 'ธ': 'th1', 'v': 'v', 'w': 'v', 'l': 'lr', 'r': 'lr', 'sh': 'sh', 'ch': 'ch', 'z': 'z', 'อี': 'ii', 'อิ': 'ii', 'แอ': 'ae', 'เอ': 'ae', '-s': 'fs', 's ท้าย': 'fs', 'ท้าย': 'fd', 'ควบกล้ำ': 'cl' };
  let s = t && (D.SOUNDS.find((x) => x.id === t) || D.SOUNDS.find((x) => low(x.name).includes(t)) || findSound(D, t));
  if (!s && t) { const k = Object.keys(alias).find((a) => t.includes(a)); if (k) s = D.SOUNDS.find((x) => x.id === alias[k]); }
  if (!s && weak && weak.length) s = D.SOUNDS.find((x) => x.id === weak[0]);
  if (!s) s = D.SOUNDS[Math.floor(Math.random() * D.SOUNDS.length)];
  return { mode: 'sound', s };
}

export async function englishCoach(a = {}) {
  css();
  const d = $('engDlg'); if (!d.open) d.showModal();
  window.__engCoachOn = true;
  $('engBody').innerHTML = '<div class="eng-msg">กำลังเตรียมบทเรียน…</div>';
  let D;
  try { D = await ensureES(); } catch (e) { $('engBody').innerHTML = '<div class="eng-msg">โหลดบทเรียนไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่</div>'; return; }
  const name = String(a.name || '').trim() || (X.isPapa() ? X.papaName() : '');
  let weak = [];
  if (name && !a.topic) { try { const r = await engCall('robotUser', { name }); if (r.ok && r.found) weak = (r.learner.เสียงที่ยังต้องฝึก || []).sort((x, y) => x.คะแนนดีสุด - y.คะแนนดีสุด).map((x) => x.เสียง); } catch {} }
  const tp = pickTopic(D, a.topic, weak);
  let items;
  if (tp.mode === 'vocab') items = D.VOCAB.slice().sort(() => Math.random() - 0.5).slice(0, PER_ROUND).map((v) => ({ w: v[1], th: v[2], sent: v[3], sth: D.VTH[D.VOCAB.indexOf(v)], pose: null }));
  else { const s = tp.s, ws = [...s.ex, ...s.pairs.map((p) => p[0])].filter((w, i, arr) => arr.indexOf(w) === i).slice(0, PER_ROUND); items = ws.map((w) => ({ w, th: D.TH[w] || '', pose: poseOf(D, s.id, w) })); }
  S = { run: 0, cur: window.MOUTH.REST, i: 0, items, scores: [], name, mode: tp.mode, s: tp.s, D };
  $('engTitle').textContent = tp.mode === 'vocab' ? 'ฝึกพูดคำศัพท์กับน้องมีไฟ' : 'ฝึกเสียง ' + tp.s.name;
  const intro = tp.mode === 'vocab' ? `มาฝึกพูดคำศัพท์ ${items.length} คำกันนะคะ ฟังน้องมีไฟก่อน แล้วพูดตามค่ะ`
    : `มาฝึกเสียง ${tp.s.name} กันนะคะ ${tp.s.steps[0]} ฟังน้องมีไฟก่อน แล้วพูดตามค่ะ`;
  await X.speakWait(intro);
  step();
}

async function step() {
  const st = S; if (!st) return;
  const it = st.items[st.i], M = window.MOUTH, id = ++st.run;
  X.bumpIdle();
  $('engBody').innerHTML = (it.pose ? stageHTML() : '') +
    `<div><div class="eng-word">${esc(it.w)}</div><div class="eng-th">${esc(it.th)}</div>${it.sent ? `<div class="eng-sent">${esc(it.sent)}<br><span class="eng-th" style="font-size:15px">${esc(it.sth || '')}</span></div>` : ''}</div>` +
    `<div class="eng-bar"><i id="engBar"></i></div><div class="eng-msg" id="engMsg">ฟังนะคะ…</div><div class="eng-cap" id="engHeard">คำที่ ${st.i + 1} จาก ${st.items.length}${st.name ? ' · บันทึกคะแนนให้ ' + esc(st.name) : ' · ยังไม่บันทึกคะแนน (บอกชื่อก่อนฝึกเพื่อบันทึก)'}</div>` +
    '<div class="eng-row"><button class="ck-btn" id="engHear" type="button">ฟังอีกครั้ง</button><button class="ck-btn eng-mic" id="engMic" type="button">พูด</button><button class="ck-btn" id="engNext" type="button">' + (st.i + 1 < st.items.length ? 'คำถัดไป' : 'ดูสรุป') + '</button><button class="ck-btn" id="engApp" type="button">เปิดแอปเต็มจอ</button></div>';
  $('engHear').onclick = () => demo(st, it, true);
  $('engMic').onclick = () => attempt(st, it);
  $('engNext').onclick = () => next(st);
  $('engApp').onclick = () => { closeEnglish(); X.openApp('/english-step/', '🔤 English Step'); };
  if (it.pose) { st.cur = M.REST; draw(M.REST); }
  await demo(st, it, false);
  if (id === st.run && S === st) attempt(st, it);
}
async function demo(st, it, slow) {
  const M = window.MOUTH;
  if (it.pose && M.M[it.pose]) {
    if (!(await move(st, M.M[it.pose], slow ? 1100 : 650))) return;
    const c = $('engCap'); if (c) c.textContent = M.M[it.pose].label;
  }
  await sayEn(it.w, slow ? 0.55 : 0.8);
  if (it.sent && !slow) await sayEn(it.sent, 0.8);
}
async function attempt(st, it) {
  if (st.busy) return; st.busy = true;
  const id = st.run, mic = $('engMic');
  try {
    mic && mic.classList.add('on'); setMsg('พูดคำว่า “' + it.w + '” ได้เลยค่ะ'); X.mascot.setMood('listening');
    const r = await listenAndJudge(it.w);
    mic && mic.classList.remove('on'); X.mascot.setMood('normal');
    if (id !== st.run || S !== st) return;
    if (r.fail) { setMsg('ฟังไม่ได้ค่ะ ตรวจไมค์หรือ Gemini API key แล้วกด “พูด” อีกครั้ง'); return; }
    if (!r.heard) { setMsg('ไม่ได้ยินเสียงค่ะ กด “พูด” แล้วพูดดังขึ้นอีกนิดนะคะ'); await X.speakWait('ไม่ได้ยินเสียงค่ะ ลองพูดดังขึ้นอีกนิดนะคะ'); return; }
    st.scores[st.i] = Math.max(st.scores[st.i] || 0, r.score);
    const bar = $('engBar'); if (bar) { bar.style.width = r.score + '%'; bar.style.background = r.score >= 70 ? '#1D9E75' : '#E8962E'; }
    const h = $('engHeard'); if (h) h.textContent = `${r.score} คะแนน · ได้ยินว่า “${r.heard}”`;
    const tip = r.tip || (st.s ? st.s.steps[0] : '');
    if (r.score >= 70) {
      const p = ['เก่งมากค่ะ', 'ชัดมากเลยค่ะ', 'ถูกต้องค่ะ เยี่ยมเลย'][Math.floor(Math.random() * 3)];
      setMsg(p); X.mascot.express?.('happy', 2); await X.speakWait(p);
      if (id === st.run && S === st) setTimeout(() => { if (id === st.run && S === st) next(st); }, 900);
    } else {
      const heardPair = st.s && st.s.pairs.some((p) => p.includes(it.w) && p.includes(r.heard) && r.heard !== it.w);
      const say = (heardPair ? `น้องมีไฟได้ยินเป็นคำว่า ${r.heard} ค่ะ ` : 'เกือบแล้วค่ะ ') + tip + ' ลองอีกครั้งนะคะ';
      setMsg(say); await X.speakWait(say);
    }
  } finally { st.busy = false; mic && mic.classList.remove('on'); }
}
async function next(st) {
  if (S !== st) return;
  st.run++;
  if (st.i + 1 < st.items.length) { st.i++; return step(); }
  const done = st.scores.filter((x) => x != null), avg = done.length ? Math.round(done.reduce((a, b) => a + b, 0) / done.length) : 0;
  let saved = '';
  if (st.name && st.mode === 'sound' && done.length) {
    try { const r = await engCall('robotLog', { name: st.name, sound: st.s.id, score: avg }); saved = r.ok ? 'บันทึกคะแนนเข้า English Step ของ ' + r.name + ' แล้ว' : (r.msg || ''); } catch { saved = 'บันทึกคะแนนไม่สำเร็จ'; }
  }
  $('engBody').innerHTML = `<div class="eng-word">${avg} คะแนน</div><div class="eng-msg">ฝึกครบ ${done.length} จาก ${st.items.length} คำ</div><div class="eng-cap">${esc(saved)}</div>` +
    '<div class="eng-row"><button class="ck-btn eng-go" id="engAgain" type="button">ฝึกอีกรอบ</button><button class="ck-btn" id="engApp2" type="button">เปิดแอปเต็มจอ</button><button class="ck-btn" id="engClose" type="button">ปิด</button></div>';
  $('engAgain').onclick = () => englishCoach({ name: st.name, topic: st.mode === 'vocab' ? 'คำศัพท์' : st.s.id });
  $('engApp2').onclick = () => { closeEnglish(); X.openApp('/english-step/', '🔤 English Step'); };
  $('engClose').onclick = closeEnglish;
  await X.speakWait(avg >= 70 ? `เก่งมากค่ะ ได้เฉลี่ย ${avg} คะแนน` : `ได้เฉลี่ย ${avg} คะแนนค่ะ ฝึกอีกนิดก็คล่องแล้วนะคะ`);
}

/* ---------- เทียบคู่เสียงบนจอ (english_explain) ---------- */
export async function englishCompare(w1, w2) {
  css();
  let D; try { D = await ensureES(); } catch { return; }
  const words = [low(w1), low(w2)].filter(Boolean);
  const shared = words.length > 1 && D.SOUNDS.find((x) => x.pairs.some((p) => words.every((w) => p.includes(w))));   // ship/sheep = คู่สระ ไม่ใช่กลุ่ม sh
  const poses = words.map((w) => { const s = shared || findSound(D, w); return { w, th: D.TH[w] || '', pose: s ? poseOf(D, s.id, w) : null }; }).filter((x) => x.pose);
  if (!poses.length) return;
  const d = $('engDlg'); if (!d.open) d.showModal();
  window.__engCoachOn = true;
  const st = { run: 0, cur: window.MOUTH.REST, items: poses };
  S = st;
  $('engTitle').textContent = 'เทียบเสียง ' + poses.map((p) => p.w).join(' / ');
  $('engBody').innerHTML = stageHTML() + `<div class="eng-row">${poses.map((p) => `<div><div class="eng-word" style="font-size:34px">${esc(p.w)}</div><div class="eng-th">${esc(p.th)}</div></div>`).join('')}</div>` +
    '<div class="eng-row"><button class="ck-btn eng-go" id="engPlay" type="button">เล่นอีกครั้ง</button><button class="ck-btn" id="engPractice" type="button">ฝึกพูดเสียงนี้</button><button class="ck-btn" id="engClose" type="button">ปิด</button></div>';
  const play = async (sound) => {
    const id = ++st.run, M = window.MOUTH; draw(st.cur = M.REST);
    for (const p of poses) {
      if (!(await move(st, M.M[p.pose], 800))) return; const c = $('engCap'); if (c) c.textContent = M.M[p.pose].label + ' · ' + p.w;
      if (sound) await sayEn(p.w, 0.7); await wait(900); if (id !== st.run) return;
      if (!(await move(st, M.REST, 450))) return; await wait(300);
    }
  };
  $('engPlay').onclick = () => play(true);
  $('engPractice').onclick = () => englishCoach({ topic: poses[0].w });
  $('engClose').onclick = closeEnglish;
  await wait(800); play(false);   // ครั้งแรกขยับปากอย่างเดียว ไม่แย่งเสียงตอนน้องมีไฟกำลังอธิบาย
}
