// แจ้งเตือนอัปเดตจากศูนย์รวมงาน (เกือบเรียลไทม์)
// ถามตัวเฝ้า (Apps Script ระบบเรียนรู้) ทุก ~12 วิ ว่าไฟล์ของระบบไหนถูกแก้ → ดึงเฉพาะระบบนั้นมาเทียบกับครั้งก่อน
// ครั้งแรกจำสถานะไว้เฉยๆ (ไม่ประกาศของเก่า) · ทำงานเฉพาะตอนเปิดแอปอยู่บนจอ
import { DUTY_API, loadNotices, ntState, ntT, ntArea, ntAreaSay, ntWhen } from './notices.js?v=11181425';
const TMD_API = 'https://script.google.com/macros/s/AKfycbyF7Am81Ut4aUbzTbACUFpJhIQ2q3iKiiTxoLM8IoGvANQ8NQpaM5BvokCeyOWiAqrwNA/exec';
const KEY = 'nongfai.watch';
const S = JSON.parse(localStorage.getItem(KEY) || '{}'); // { ts:{}, tk:{id:st}, tmd:[keys], log:[] }
S.ts = S.ts || {}; S.log = S.log || [];
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };

export const TOPICS = { notices: 'ประกาศงดจ่ายไฟ', tickets: 'รับแจ้งไฟดับ', tmd: 'เตือนภัยกรมอุตุ' };
const FILE_OF = { notices: 'tickets', tickets: 'tickets', tmd: 'tmd' }; // ประกาศงดจ่ายไฟอยู่ในไฟล์เดียวกับงานเวรแก้ไฟ
const FULL_EVERY = 3 * 60e3; // ดึงเต็มทุก 3 นาทีด้วย เผื่อเวลาไฟล์ใน Drive อัปเดตช้า

const post = async (url, body) => (await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })).json();
const hhmm = (t) => new Date(t).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
const where = (r) => String(r.place || r.addr || r.detail || ('เลขที่ ' + r.id)).replace(/\s+/g, ' ').slice(0, 80);

// ---------- แต่ละระบบ: คืนรายการใหม่ [{topic,title,text,say,q}] ----------
async function checkTickets(ctx) {
  const c = ctx.creds();
  if (!c.user || !c.pass) return [];
  const j = await post(DUTY_API, { action: 'tickets', hubUser: c.user, hubPass: c.pass });
  if (!j || j.ok === false) return [];
  const now = {}; (j.tickets || []).forEach((t) => { now[t.id] = t; });
  const first = !S.tk; const prev = S.tk || {};
  S.tk = Object.fromEntries(Object.values(now).map((t) => [t.id, t.st]));
  if (first) return [];
  const out = [];
  for (const t of Object.values(now)) {
    const before = prev[t.id];
    if (!before && (t.st === 'new' || t.st === 'acc')) out.push({ topic: 'tickets', title: 'รับแจ้งไฟดับใหม่', text: where(t), sub: [t.name, t.phone, t.st === 'new' ? 'ยังไม่มีคนรับงาน' : 'รับโดย ' + (t.accBy || '')].filter(Boolean).join(' · '), say: 'มีรับแจ้งไฟดับใหม่ ที่ ' + where(t) + (t.st === 'new' ? ' ยังไม่มีคนรับงานค่ะ' : ''), q: 'งานรับแจ้งไฟดับที่ยังค้างมีอะไรบ้าง' });
    else if (before === 'new' && t.st === 'acc') out.push({ topic: 'tickets', title: 'รับงานแจ้งไฟดับแล้ว', text: where(t), sub: 'รับโดย ' + (t.accBy || '-'), say: (t.accBy || 'ทีมแก้ไฟ') + ' รับงานแจ้งไฟดับ ที่ ' + where(t) + ' แล้วค่ะ', q: 'งานรับแจ้งไฟดับที่ยังค้างมีอะไรบ้าง' });
    else if (before && before !== 'done' && t.st === 'done') out.push({ topic: 'tickets', title: 'แก้ไฟเสร็จแล้ว', text: where(t), sub: t.accBy ? 'โดย ' + t.accBy : '', say: 'งานแจ้งไฟดับ ที่ ' + where(t) + ' แก้เสร็จแล้วค่ะ', q: 'งานรับแจ้งไฟดับล่าสุด' });
  }
  return out;
}
async function checkTmd() {
  const j = await (await fetch(TMD_API + '?action=list&limit=15&focus=' + encodeURIComponent('ภาคใต้'))).json();
  const list = (j && j.data || []).filter((d) => d && (d.krabiDetail || d.focus === 'ภาคใต้' || d.focus === 'กระบี่'));
  const key = (d) => String(d.sortKey || '') + '|' + (d.issueNo || '') + '|' + (d.title || '');
  const first = !S.tmd; const prev = new Set(S.tmd || []);
  S.tmd = list.map(key).slice(0, 40);
  if (first) return [];
  const no = (d) => String(d.issueNo || '').replace(/^ฉบับที่\s*/, '');
  return list.filter((d) => !prev.has(key(d))).slice(0, 3).map((d) => ({
    topic: 'tmd', title: 'ประกาศเตือนภัยกรมอุตุ' + (no(d) ? ' ฉบับที่ ' + no(d) : ''), text: String(d.title || '').replace(/^ประกาศกรมอุตุนิยมวิทยา\s*เรื่อง\s*/, '').slice(0, 120),
    sub: [d.severity, d.krabiDetail ? 'เกี่ยวกับกระบี่' : 'ภาคใต้'].filter(Boolean).join(' · '),
    say: 'ประกาศเตือนภัยกรมอุตุนิยมวิทยา' + (no(d) ? ' ฉบับที่ ' + no(d).replace(/\s*\(.*\)/, '') : '') + ' เรื่อง ' + String(d.title || '').replace(/^ประกาศกรมอุตุนิยมวิทยา\s*เรื่อง\s*/, '').replace(/\s*\(.*$/, '').slice(0, 80) + (d.krabiDetail ? ' มีผลกับกระบี่ค่ะ' : ' ค่ะ'),
    q: 'ประกาศเตือนภัยกรมอุตุล่าสุดมีอะไรบ้าง',
  }));
}
async function checkNotices() {
  const list = await loadNotices(), now = Date.now();
  const first = !S.nt; const prev = S.nt || {};
  const cur = {};
  const out = [], Q = 'ประกาศงดจ่ายไฟที่กำลังจะมาถึงมีอะไรบ้าง';
  for (const n of list) {
    const st = ntState(n, now), p = prev[n.id] || {}, emg = n.type === 'emg', area = ntAreaSay(n);
    const soonMin = Math.round((ntT(n.startAt) - now) / 60e3);
    const c = cur[n.id] = { st, soon: p.soon || false };
    if (first) { c.soon = soonMin <= 30; continue; }
    const card = (title, say, sub) => out.push({ topic: 'notices', title, text: ntArea(n).slice(0, 140), sub: sub || ntWhen(n), say, q: Q });
    if (!prev[n.id]) {
      if (st === 'plan' || st === 'due' || st === 'live')
        card(emg ? 'ดับไฟฉุกเฉิน' : 'ประกาศงดจ่ายไฟใหม่', emg ? 'มีการดับไฟฉุกเฉิน ที่ ' + area + (n.reason ? ' เนื่องจาก' + n.reason : '') + 'ค่ะ' : 'มีประกาศงดจ่ายไฟใหม่ ' + ntWhen(n) + ' ที่ ' + area + 'ค่ะ');
      c.soon = soonMin <= 30;
      continue;
    }
    if (p.st !== st) {
      if (st === 'live' && !emg) card('เริ่มงดจ่ายไฟแล้ว', 'เริ่มงดจ่ายไฟแล้ว ที่ ' + area + 'ค่ะ');
      else if (st === 'done') card('ไฟมาแล้ว', 'จ่ายไฟคืนแล้ว ที่ ' + area + 'ค่ะ');
      else if (st === 'cancel') card('ยกเลิกงดจ่ายไฟ', 'ยกเลิกการงดจ่ายไฟ ' + ntWhen(n) + ' ที่ ' + area + ' ใช้ไฟได้ตามปกติค่ะ');
    }
    if (!c.soon && st === 'plan' && soonMin > 0 && soonMin <= 30) { c.soon = true; card('อีก ' + soonMin + ' นาทีจะงดจ่ายไฟ', 'อีก ' + soonMin + ' นาที จะเริ่มงดจ่ายไฟ ที่ ' + area + 'ค่ะ'); }
  }
  S.nt = cur;
  return out;
}
const CHECK = { notices: checkNotices, tickets: checkTickets, tmd: checkTmd };

// ---------- วนเช็ก ----------
let timer = null, running = false, lastFull = 0, ctxRef = null;
export const alertLog = () => S.log;
export function clearAlertLog() { S.log = []; save(); }
export function resetWatchBaseline() { delete S.tk; delete S.tmd; delete S.nt; S.ts = {}; save(); }

async function tick() {
  const ctx = ctxRef; if (!ctx || running) return;
  const cfg = ctx.cfg();
  if (!cfg.alertOn || document.visibilityState !== 'visible') return;
  const topics = Object.keys(CHECK).filter((k) => cfg.alertTopics?.[k] !== false);
  if (!topics.length) return;
  running = true;
  try {
    let changed = [];
    const L = ctx.learn();
    const full = Date.now() - lastFull > FULL_EVERY;
    if (L.url && L.secret && !full) {
      const w = await post(L.url, { action: 'watch', secret: L.secret });
      if (w && w.ok && w.t) {
        changed = topics.filter((k) => { const t = w.t[FILE_OF[k]]; return (t && t !== S.ts[k]) || S.ts[k] === undefined; });
        topics.forEach((k) => { const t = w.t[FILE_OF[k]]; if (t) S.ts[k] = t; });
      } else changed = topics; // ตัวเฝ้าใช้ไม่ได้ → ดึงตรงทุกรอบแทน (ช้ากว่าแต่ยังทำงาน)
    } else changed = topics;
    if (full) lastFull = Date.now();
    const found = [];
    for (const k of changed) { try { found.push(...await CHECK[k](ctx)); } catch (e) { console.warn('watch', k, e); } }
    save();
    if (found.length) {
      const at = Date.now();
      found.forEach((f) => { f.at = at; f.time = hhmm(at); });
      S.log = [...found.reverse(), ...S.log].slice(0, 30); save();
      ctx.onAlerts(found);
    }
  } catch (e) { console.warn('watch', e); }
  finally { running = false; }
}
export function startWatch(ctx) {
  ctxRef = ctx;
  clearInterval(timer);
  timer = setInterval(tick, 12000);
  setTimeout(tick, 3000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(tick, 1500); });
}
export const watchNow = () => tick();
