// น้องไฟเรียนรู้: จำคำที่ฟังผิด, คำตอบที่ยืนยันแล้ว, ตัวอย่างคำถาม→ระบบ
// เก็บในเครื่อง (ใช้ได้ทันที) + ซิงค์กับ Google Sheet ผ่าน Apps Script (ใช้ร่วมกันทุกเครื่อง)
const KEY = 'nongfai.learn';
const S = JSON.parse(localStorage.getItem(KEY) || '{"corr":[],"verified":[],"examples":[]}');
const save = () => localStorage.setItem(KEY, JSON.stringify(S));
let conf = { url: '', secret: '' };

// ข้อมูลที่ไม่เปลี่ยนทุกวัน — ถ้ากดว่าถูก เก็บเป็นคำตอบทันทีได้
export const STATIC_TOOLS = ['search_regulations', 'drawings_bom', 'material_price', 'contacts'];

async function post(body) {
  if (!conf.url || !conf.secret) return null;
  // text/plain เพื่อไม่ให้เบราว์เซอร์ต้องถาม CORS ก่อน (Apps Script ไม่รองรับ)
  const r = await fetch(conf.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...body, secret: conf.secret }) });
  return r.json();
}

export async function initLearn(url, secret) {
  conf = { url: (url || '').trim(), secret: (secret || '').trim() };
  if (!conf.url) return false;
  try {
    const j = await post({ action: 'load' });
    if (j && j.ok) { S.corr = j.corr || []; S.verified = j.verified || []; S.examples = j.examples || []; S.sheetUrl = j.sheetUrl; save(); return true; }
    console.warn('learn load', j);
  } catch (e) { console.warn('learn load', e); }
  return false;
}
export const learnStats = () => ({ corr: S.corr.length, verified: S.verified.length, examples: S.examples.length, sheetUrl: S.sheetUrl || '', online: !!(conf.url && conf.secret) });

// ---------- คำที่ฟังผิด ----------
export function applyCorrections(t) {
  if (!t) return t;
  const list = [...S.corr].sort((a, b) => b.wrong.length - a.wrong.length);
  for (const c of list) if (c.wrong && t.includes(c.wrong)) t = t.split(c.wrong).join(c.right);
  return t;
}
export const glossaryExtra = () => [...new Set(S.corr.map((c) => c.right))].slice(-80).join(', ');

// หาเฉพาะส่วนที่ต่างกันระหว่างคำที่ฟังได้กับคำที่แก้ (เติมบริบทข้างละ 1-2 ตัวอักษรถ้าสั้นเกิน)
export function diffPair(a, b) {
  const tail = /(\s|ครับ|ค่ะ|คะ|คับ|นะ|หน่อย|จ้า)+$/;
  a = a.trim().replace(tail, ''); b = b.trim().replace(tail, '');
  if (!a || !b || a === b) return null;
  let p = 0; while (p < a.length && p < b.length && a[p] === b[p]) p++;
  let s = 0; while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
  let wa = a.slice(p, a.length - s), wb = b.slice(p, b.length - s);
  if (!wa || !wb) return null; // แค่เติมหรือลบคำ ไม่ใช่ฟังผิด — ไม่จำ
  // ขยายให้ไม่ตัดกลางสระ/วรรณยุกต์ไทย และให้ยาวอย่างน้อย 3 ตัว
  const mark = /[ัิ-ฺ็-๎]/;
  // ขยายซ้าย-ขวาสลับกันจนยาวอย่างน้อย 4 ตัว (กันไปแก้คำอื่นที่บังเอิญมีตัวอักษรเหมือนกัน)
  for (let left = true; (wa.length < 4 || mark.test(wa[0]) || mark.test(a[a.length - s] || '')) && (p > 0 || s > 0); left = !left) {
    if (left && p > 0) { p--; wa = a[p] + wa; wb = b[p] + wb; }
    else if (s > 0) { wa += a[a.length - s]; wb += b[b.length - s]; s--; }
  }
  while (mark.test(a[a.length - s] || '') && s > 0) { wa += a[a.length - s]; wb += b[b.length - s]; s--; }
  if (wa.length > 30 || wb.length > 30) return null; // แก้ทั้งประโยค = เปลี่ยนคำถาม ไม่ใช่ฟังผิด
  return { wrong: wa, right: wb };
}
export async function addCorrection(heard, fixed, by) {
  const d = diffPair(heard, fixed);
  if (!d) return null;
  S.corr = S.corr.filter((c) => c.wrong !== d.wrong); S.corr.push(d); save();
  post({ action: 'correction', ...d, by }).catch(() => {});
  return d;
}

// ---------- คำตอบที่ยืนยันแล้ว ----------
const norm = (q) => String(q).toLowerCase().replace(/\s+|[?？!.,]|ครับ|ค่ะ|คะ|คับ|นะ|หน่อย|ด้วย|น้องไฟ|พี่|จ้า|จ๊ะ/g, '');
function bigrams(s) { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; }
function dice(a, b) {
  if (a === b) return 1; if (a.length < 2 || b.length < 2) return 0;
  const A = bigrams(a), B = bigrams(b); let inter = 0;
  for (const [g, n] of A) inter += Math.min(n, B.get(g) || 0);
  return (2 * inter) / (a.length - 1 + b.length - 1);
}
export function findVerified(q) {
  const n = norm(q); if (n.length < 4) return null;
  let best = null, score = 0;
  for (const v of S.verified) { const s = dice(n, norm(v.q)); if (s > score) { score = s; best = v; } }
  return score >= 0.9 ? { ...best, score } : null;
}
export function examplesText() {
  const ex = S.examples.slice(-15);
  return ex.length ? '\nตัวอย่างคำถามที่เคยตอบถูก และระบบที่ใช้ (ให้เรียกเครื่องมือแบบเดียวกันเมื่อถามคล้ายกัน):\n' + ex.map((e) => `- "${e.q}" → ${e.tools}`).join('\n') : '';
}

export async function sendFeedback(f) {
  // f: {q,a,card,ok,reason,fix,tools,cacheable,by}
  if (f.ok && f.cacheable) { S.verified = S.verified.filter((v) => norm(v.q) !== norm(f.q)); S.verified.push({ q: f.q, a: f.a, card: f.card || '' }); }
  if (!f.ok && f.fix) { S.verified = S.verified.filter((v) => norm(v.q) !== norm(f.q)); S.verified.push({ q: f.q, a: f.fix, card: '' }); }
  if (!f.ok && !f.fix) S.verified = S.verified.filter((v) => norm(v.q) !== norm(f.q)); // คำตอบที่เคยยืนยันแต่ผิด → เลิกใช้ในเครื่องนี้
  if (f.ok && !f.cacheable && f.tools) { S.examples.push({ q: f.q, tools: f.tools }); S.examples = S.examples.slice(-40); }
  save();
  try { const j = await post({ action: 'feedback', ...f, device: navigator.platform || '' }); return j ? j.ok : 'local'; } catch { return false; }
}
