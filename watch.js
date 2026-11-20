// แจ้งเตือนอัปเดตจากศูนย์รวมงาน (เกือบเรียลไทม์)
// ถามตัวเฝ้า (Apps Script ระบบเรียนรู้) ทุก ~12 วิ ว่าไฟล์ของระบบไหนถูกแก้ → ดึงเฉพาะระบบนั้นมาเทียบกับครั้งก่อน
// ครั้งแรกจำสถานะไว้เฉยๆ (ไม่ประกาศของเก่า) · ทำงานเฉพาะตอนเปิดแอปอยู่บนจอ
import { runTool } from './tools.js?v=11201200';
import { startEvents, eventsLive } from './events.js?v=11201200';
import { DUTY_API, loadNotices, ntState, ntT, ntArea, ntAreaSay, ntWhen } from './notices.js?v=11201200';
const TMD_API = 'https://script.google.com/macros/s/AKfycbyF7Am81Ut4aUbzTbACUFpJhIQ2q3iKiiTxoLM8IoGvANQ8NQpaM5BvokCeyOWiAqrwNA/exec';
const KEY = 'nongfai.watch';
const S = JSON.parse(localStorage.getItem(KEY) || '{}'); // { ts:{}, tk:{id:st}, tmd:[keys], log:[] }
S.ts = S.ts || {}; S.log = S.log || [];
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };

// แอปในศูนย์รวมงานที่แจ้งเตือนได้: 3 ระบบแรกเกือบเรียลไทม์ (มีตัวเฝ้าไฟล์) ที่เหลือเช็กทุก ~3 นาที
// ระบบอื่นใช้ "เครื่องมือ" ตัวเดียวกับที่น้องมีไฟใช้ตอบคำถาม แล้วเทียบรายการกับครั้งก่อน
const GEN = {
  duty: { tool: 'duty_roster', name: 'เวรแก้ไฟวันนี้', q: 'วันนี้ใครเข้าเวรแก้ไฟบ้าง' },
  patrol: { tool: 'patrol_findings', name: 'Patrol ระบบจำหน่าย', q: 'จุดบกพร่อง Patrol ล่าสุดมีอะไรบ้าง' },
  vehicles: { tool: 'vehicles', name: 'ยานพาหนะ', q: 'ตอนนี้รถคันไหนว่างบ้าง' },
  procure: { tool: 'procure_jobs', name: 'งานจัดซื้อ', q: 'งานจัดซื้อล่าสุดมีอะไรบ้าง' },
  tfbuy: { tool: 'tf_purchase_jobs', name: 'งานซื้อ/ขายหม้อแปลง', q: 'งานซื้อหม้อแปลงล่าสุดมีอะไรบ้าง' },
  budget: { tool: 'budget', name: 'ตัดงบทำการ', q: 'รายการขอใช้งบล่าสุดมีอะไรบ้าง' },
  ccl: { tool: 'ccl', name: 'CCL งานก่อสร้าง', q: 'งานก่อสร้างใน CCL ล่าสุดเป็นอย่างไร' },
  officelove: { tool: 'office_love', name: 'Office Love (รปภ.)', q: 'Office Love วันนี้มีเหตุผิดปกติไหม' },
  tree: { tool: 'tree_cutting', name: 'งานตัดต้นไม้', q: 'งานตัดต้นไม้ล่าสุดเป็นอย่างไร' },
  safety: { tool: 'safety_talk', name: 'Safety Talk', q: 'Safety Talk ล่าสุดเป็นอย่างไร', off: true },
  booknum: { tool: 'book_numbers', name: 'ออกเลขหนังสือ', q: 'เลขหนังสือล่าสุดคืออะไร', off: true },
  checkin: { tool: 'checkin_today', name: 'เช็กอินเข้างาน', q: 'วันนี้ใครเช็กอินแล้วบ้าง', off: true },
};
// ระบบที่มีเฉพาะในสมุดเหตุการณ์ (ไม่มีเครื่องมือเทียบรายการ)
const EV_ONLY = { medical: 'ใบเบิกค่ารักษา', survey: 'สำรวจงานก่อสร้าง', stock: 'คลังพัสดุ', teamplan: 'แผนงานระดมทีม', kpi: 'KPI / Report50', k04: 'K04 แผนปฏิบัติการ', load01: 'Load01 (โหลดฟีดเดอร์)', regs: 'ระเบียบ กฟภ.' };
const OFF = new Set(['safety', 'booknum', 'load01', 'regs']);
export const TOPICS = { notices: 'ประกาศงดจ่ายไฟ', tickets: 'รับแจ้งไฟดับ', tmd: 'เตือนภัยกรมอุตุ', ...Object.fromEntries(Object.entries(GEN).map(([k, g]) => [k, g.name])), ...EV_ONLY };
// ค่าเริ่มต้น: เปิดทุกระบบ ยกเว้นที่ข้อมูลเปลี่ยนบ่อยจนรบกวน (เช็กอิน, ออกเลขหนังสือ, Safety Talk)
export const topicOn = (cfg, k) => (cfg.alertTopics && k in cfg.alertTopics ? !!cfg.alertTopics[k] : !OFF.has(k));
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
    const card = (title, say, sub) => out.push({ topic: 'notices', title, text: ntArea(n).slice(0, 140), sub: sub || ntWhen(n), say, q: Q, app: '/duty-roster/?nt=' + encodeURIComponent(n.id), openLabel: 'ดูโปสเตอร์' });
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

// ---------- ระบบอื่นๆ: เทียบรายการจากเครื่องมือกับครั้งก่อน ----------
const bkkDay = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
async function checkGeneric(k, ctx) {
  const g = GEN[k];
  let shown = null;
  const tctx = { ...ctx.toolCtx(), staff: () => true, show: (d) => { shown = d; }, needVerify: () => {} };
  const r = await runTool(g.tool, {}, tctx);
  if (!shown || !(shown.items || []).length || (r && (r.error || r.need_verify))) return [];
  const key = (it) => String(it.title || '') + '|' + String(it.sub || '').split('·')[0].trim();
  const now = {}; shown.items.forEach((it) => { now[key(it)] = { b: String(it.badge || ''), t: it.title || '', s: it.sub || '' }; });
  S.g = S.g || {};
  const prev = S.g[k], day = bkkDay();
  S.g[k] = { day, items: Object.fromEntries(Object.entries(now).map(([kk, v]) => [kk, v.b])) };
  if (!prev || prev.day !== day) return []; // ครั้งแรก หรือขึ้นวันใหม่ = จำไว้เฉยๆ ไม่ประกาศ
  const out = [];
  for (const [kk, v] of Object.entries(now)) {
    if (!(kk in prev.items)) out.push({ topic: k, title: g.name + ' · รายการใหม่', text: v.t, sub: [v.s, v.b].filter(Boolean).join(' · '), say: g.name + ' มีรายการใหม่ ' + v.t + (v.b ? ' ' + v.b : '') + 'ค่ะ', q: g.q });
    else if (v.b && prev.items[kk] && prev.items[kk] !== v.b) out.push({ topic: k, title: g.name + ' · อัปเดต', text: v.t, sub: prev.items[kk] + ' → ' + v.b, say: g.name + ' ' + v.t + ' เปลี่ยนเป็น ' + v.b + 'ค่ะ', q: g.q });
  }
  // เปลี่ยนพร้อมกันเยอะ = สรุปรวบเดียว ไม่ประกาศทีละรายการ
  if (out.length > 4) return [{ topic: k, title: g.name + ' · อัปเดต ' + out.length + ' รายการ', text: out.slice(0, 3).map((o) => o.text).join(', ') + ' …', sub: '', say: g.name + ' มีอัปเดต ' + out.length + ' รายการค่ะ', q: g.q }];
  return out;
}
let genIdx = 0;
const genLast = {};
async function nextGeneric(ctx, cfg) {
  // สมุดเหตุการณ์ทำงานอยู่ = รู้ทุกการเปลี่ยนแปลงแล้ว ไม่ต้องดึงเทียบเอง (เหลือเวรแก้ไฟที่อ่านง่ายกว่าแบบเดิม)
  const keys = Object.keys(GEN).filter((k) => topicOn(cfg, k) && (!eventsLive() || k === 'duty'));
  for (let i = 0; i < keys.length; i++) {
    const k = keys[(genIdx + i) % keys.length];
    if (Date.now() - (genLast[k] || 0) < 170e3) continue;
    genIdx = (genIdx + i + 1) % keys.length; genLast[k] = Date.now();
    try { return await checkGeneric(k, ctx); } catch (e) { console.warn('watch', k, e); return []; }
  }
  return [];
}

// ---------- วนเช็ก ----------
let timer = null, running = false, lastFull = 0, ctxRef = null;
export const alertLog = () => S.log;
export function clearAlertLog() { S.log = []; save(); }
export function resetWatchBaseline() { delete S.tk; delete S.tmd; delete S.nt; delete S.g; S.ts = {}; save(); }

async function tick() {
  const ctx = ctxRef; if (!ctx || running) return;
  const cfg = ctx.cfg();
  if (!cfg.alertOn || document.visibilityState !== 'visible') return;
  const topics = Object.keys(CHECK).filter((k) => topicOn(cfg, k));
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
    if (!topics.length) changed = [];
    if (full) lastFull = Date.now();
    const found = [];
    for (const k of changed) { try { found.push(...await CHECK[k](ctx)); } catch (e) { console.warn('watch', k, e); } }
    found.push(...await nextGeneric(ctx, cfg)); // ระบบอื่น: ทีละระบบต่อรอบ (ทุกระบบวนครบใน ~3 นาที)
    save();
    if (found.length) push(found.reverse());
  } catch (e) { console.warn('watch', e); }
  finally { running = false; }
}
function push(found) {
  const ctx = ctxRef; if (!ctx || !found.length) return;
  const at = Date.now();
  found.forEach((f) => { f.at = f.at || at; f.time = hhmm(f.at); });
  S.log = [...found, ...S.log].slice(0, 40); save();
  ctx.onAlerts(found);
}
export function startWatch(ctx) {
  ctxRef = ctx;
  startEvents({ cfg: ctx.cfg, learn: ctx.learn, topicOn, push });
  clearInterval(timer);
  timer = setInterval(tick, 12000);
  setTimeout(tick, 3000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(tick, 1500); });
}
export const watchNow = () => tick();
