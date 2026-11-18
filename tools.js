import { findEvents } from './events.js?v=11182355';
import { describe, sysInfo, SYS } from './systems.js?v=11182355';
import { loadNotices, ntState, ntArea, ntWhen, ntHm, ntDate } from './notices.js?v=11182355';
// เครื่องมือให้น้องมีไฟดึงข้อมูลจากศูนย์รวมงาน กฟส.อ่าวลึก (Gemini function calling)
// public = ใครถามก็ตอบได้ · internal = ต้องยืนยันตัวตนพนักงานก่อน (PIN)

const DUTY_API = 'https://script.google.com/macros/s/AKfycbzIFoqXzNyJ56EOd2p-L6bdbO6ZNLQmYS5xoW4sTFJUuZKkxnnU2TEKJRMdusi1gwzr5g/exec';
const STOCK_API = 'https://script.google.com/macros/s/AKfycby536q10bjzfwQPQLrxbv-BXY33WNggpQi06VdRLniht_zUZjArNZ5V9fQIBKCY0dAHzw/exec';
const VEH_API = 'https://script.google.com/macros/s/AKfycbzLnelFGNLqynkfwm06vBDZE23p5_1-kDV3CZm_EuuMHDex4vEtNNYeJ9sRo-m0KLq1/exec';
const REGS_API = 'https://script.google.com/macros/s/AKfycbwNmNqCAMHKla92Ck3VbCVJeByNDQcq9OYaj5Vlt8WIIzvBo0uDKFg3lHFYPxavvRjpXw/exec';

const WD = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
export const bkkNow = () => new Date(Date.now() + 7 * 3600e3);          // ใช้ getUTC* = เวลาไทย
export const bkkToday = () => bkkNow().toISOString().slice(0, 10);

// ---------- แคชสั้นๆ ไม่ให้ยิงหลังบ้านซ้ำ ----------
const cache = new Map();
async function cached(key, ms, fn) {
  const c = cache.get(key);
  if (c && Date.now() - c.t < ms) return c.v;
  const v = await fn();
  cache.set(key, { t: Date.now(), v });
  return v;
}
async function getJSON(url) {
  const r = await fetch(url);
  const j = await r.json();
  if (j && j.ok === false) throw new Error(j.message || j.error || 'error');
  return j;
}
async function postJSON(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  const j = await r.json();
  if (j && j.ok === false) throw new Error(j.message || j.error || 'error');
  return j;
}
const monthOf = (date) => String(date || bkkToday()).slice(0, 7);
const has = (s, q) => String(s || '').toLowerCase().includes(String(q || '').toLowerCase());
function words(q) { return String(q || '').toLowerCase().split(/[\s,]+/).filter((w) => w.length > 0); }

// ---------- 1) เวรแก้ไฟ ----------
const SEG = {
  emp: { '1': 'ช่วง 1 (00:30–08:30)', '2': 'ช่วง 2 (08:30–16:30)', '3': 'ช่วง 3 (16:30–00:30)', 'S': 'เตรียมพร้อม (00:30–08:30)' },
  wk: { '1': 'กะ 1 (00:00–08:00)', '2': 'กะ 2 (08:00–16:00)', '3': 'กะ 3 (16:00–24:00)' },
};
async function dutyRoster({ date }) {
  date = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : bkkToday();
  const m = monthOf(date), d = Number(date.slice(8, 10));
  const [mo, boot] = await Promise.all([
    cached('month' + m, 300e3, () => getJSON(DUTY_API + '?action=month&m=' + m)),
    cached('boot', 3600e3, () => getJSON(DUTY_API + '?action=bootstrap')),
  ]);
  const data = mo.month && mo.month.data;
  if (!data) return { date, note: 'ยังไม่มีตารางเวรของเดือนนี้' };
  const day = (data.days || [])[d - 1] || {};
  const list = (g) => Object.entries(data[g] || {}).map(([name, arr]) => {
    const code = String(arr[d - 1] || '');
    if (!code || code === '0') return null;
    return { name, เวร: code.split(',').map((c) => SEG[g][c] || c).join(' + ') };
  }).filter(Boolean);
  const pe = list('emp'), wk = list('wk');
  const D = { source: 'ตารางเวรแก้ไฟ ' + date, app: '/duty-roster/', stats: [{ l: 'พนักงาน', v: pe.length }, { l: 'คนงาน', v: wk.length }, { l: 'โทรห้องเวร', v: boot.config && boot.config.roomPhone }],
    items: [...pe.map((p) => ({ title: p.name, sub: p.เวร, badge: 'พนักงาน' })), ...wk.map((p) => ({ title: p.name, sub: p.เวร, badge: 'คนงาน' }))] };
  return withD({
    date, วัน: WD[new Date(date + 'T00:00:00Z').getUTCDay()], วันหยุด: !!(day.off || day.hol), สถานะตาราง: mo.month.status,
    พนักงาน: list('emp'), คนงาน: list('wk'),
    โทรห้องเวร: boot.config && boot.config.roomPhone,
    หมายเหตุ: 'ตามตารางที่อนุมัติ อาจมีการแลกเวรภายหลัง ดูให้แน่ใจได้ที่แอปงานเวรแก้ไฟ',
  }, D);
}

// ---------- 2) ประวัติไฟดับ ----------
async function outageHistory({ month, keyword }) {
  const m = /^\d{4}-\d{2}$/.test(month || '') ? month : monthOf();
  const j = await cached('out' + m, 300e3, () => getJSON(DUTY_API + '?action=outages&m=' + m));
  const raw = j.outages || [];
  let rows = raw.map((o) => ({ _lat: (o.dev && o.dev.lat) || o.lat, _lon: (o.dev && o.dev.lon) || o.lon,
    ดับ: o.off, จ่ายไฟคืน: o.on, ระดับ: o.lvl === 'hv' ? 'แรงสูง' : o.lvl === 'lv' ? 'แรงต่ำ' : o.lvl,
    ฟีดเดอร์: o.feeder, อุปกรณ์: o.dev ? [o.dev.id, o.dev.type, o.dev.rating, o.dev.desc].filter(Boolean).join(' ') : '',
    ผู้ใช้ไฟได้รับผลกระทบ: o.cust, สาเหตุ: [o.cType, o.cData].filter(Boolean).join(' - '), สภาพอากาศ: o.weather,
    การแก้ไข: o.detail, สถานที่: o.place,
  }));
  if (keyword) rows = rows.filter((r) => words(keyword).every((w) => JSON.stringify(r).toLowerCase().includes(w)));
  const causes = {}; rows.forEach((r) => { const c = r.สาเหตุ || 'ไม่ระบุ'; causes[c] = (causes[c] || 0) + 1; });
  const topCause = Object.entries(causes).sort((a, b) => b[1] - a[1])[0];
  const D = { source: 'ประวัติไฟดับ ' + m, app: '/duty-roster/', stats: [{ l: 'ครั้ง', v: rows.length }, { l: 'ผู้ใช้ไฟได้รับผล', v: rows.reduce((a, r) => a + (Number(r.ผู้ใช้ไฟได้รับผลกระทบ) || 0), 0) }, { l: 'สาเหตุหลัก', v: topCause ? topCause[0] + ' (' + topCause[1] + ')' : '-' }],
    items: rows.slice(-30).reverse().map((r) => ({ title: r.สาเหตุ || r.อุปกรณ์ || 'ไฟดับ', sub: [r.ฟีดเดอร์, String(r.ดับ || '').replace('T', ' ')].filter(Boolean).join(' · '), badge: r.ระดับ, fields: F(r), lat: r._lat, lon: r._lon })) };
  rows.forEach((r) => { delete r._lat; delete r._lon; });
  return withD({ เดือน: m, จำนวน: rows.length, รายการ: rows.slice(-25) }, D);
}

// ---------- 3) สภาพอากาศ / ประกาศกรมอุตุฯ ----------
async function weatherNow() {
  const j = await cached('wx', 300e3, () => getJSON(DUTY_API + '?action=wx'));
  const w = j.wx || {};
  return withD({ สรุป: w.label, รายละเอียด: w.detail, เงื่อนไข: (w.ck || []).map((c) => c.t) },
    { source: 'สภาพอากาศอ่าวลึกตอนนี้', app: '/duty-roster/', stats: [{ l: 'สภาพ', v: w.label, t: w.lv >= 3 ? 'red' : '' }], items: [{ title: w.detail || '' }, ...(w.ck || []).map((c) => ({ title: c.t, badge: c.ok ? 'เข้าเงื่อนไข' : 'ไม่เข้า', tone: c.ok ? 'red' : 'green' }))] });
}
async function weatherWarnings({ month }) {
  const m = /^\d{4}-\d{2}$/.test(month || '') ? month : monthOf();
  const j = await cached('tmd' + m, 600e3, () => getJSON(DUTY_API + '?action=tmd&m=' + m));
  const out = Object.entries(j.days || {}).map(([d, v]) => ({
    วันที่: m + '-' + String(d).padStart(2, '0'),
    เกี่ยวกับกระบี่: v.k ? { เรื่อง: v.k.w, ระดับ: v.k.sev, ฉบับ: v.k.no } : null,
    ทั่วไป: v.s ? { เรื่อง: v.s.w, ระดับ: v.s.sev, ฉบับ: v.s.no } : null,
  }));
  return withD({ เดือน: m, ประกาศ: out.slice(-10) }, { source: 'ประกาศเตือนภัยกรมอุตุฯ ' + m, app: '/tmd/',
    items: out.slice(-10).reverse().map((x) => { const v = x.เกี่ยวกับกระบี่ || x.ทั่วไป || {}; return { title: v.เรื่อง || '-', sub: x.วันที่ + ' · ' + (v.ฉบับ || ''), badge: x.เกี่ยวกับกระบี่ ? 'กระบี่ · ' + v.ระดับ : v.ระดับ, tone: x.เกี่ยวกับกระบี่ ? 'red' : 'amber' }; }) });
}

// ---------- 4) ระเบียบ กฟภ. ----------
let regsMeta = null;
async function loadRegsMeta() {
  if (regsMeta) return regsMeta;
  const html = await (await fetch('/regulations/index.html', { cache: 'force-cache' })).text();
  const m = html.match(/^const DATA=(\{.*?\});\s*$/m);
  regsMeta = JSON.parse(m[1]);
  return regsMeta;
}
// เนื้อหาเต็ม: โหลดครั้งเดียวแล้วเก็บในเครื่อง (IndexedDB) ใช้ค้นในเนื้อความ
const IDB = 'nongfai-regs';
function idb() {
  return new Promise((res, rej) => { const r = indexedDB.open(IDB, 1); r.onupgradeneeded = () => r.result.createObjectStore('t'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
async function idbGet(k) { const db = await idb(); return new Promise((res) => { const q = db.transaction('t').objectStore('t').get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); }
async function idbSet(k, v) { const db = await idb(); return new Promise((res) => { const t = db.transaction('t', 'readwrite'); t.objectStore('t').put(v, k); t.oncomplete = () => res(); t.onerror = () => res(); }); }
let regsText = null, regsLoading = null;
function loadRegsText() {
  if (regsText) return Promise.resolve(regsText);
  if (regsLoading) return regsLoading;
  regsLoading = (async () => {
    const man = await getJSON(REGS_API + '?action=manifest');
    const saved = await idbGet('v');
    if (saved && saved.version === man.version) { regsText = saved.map; return regsText; }
    const map = {};
    for (let i = 0; i < man.shards; i++) {
      const b64 = (await (await fetch(REGS_API + '?action=shard&i=' + i)).text()).trim();
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const txt = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
      JSON.parse(txt).forEach(([id, t]) => { map[id] = t; });
    }
    await idbSet('v', { version: man.version, map });
    regsText = map; return map;
  })().finally(() => { regsLoading = null; });
  return regsLoading;
}
const thaiNorm = (s) => String(s || '').replace(/ํา/g, 'ำ').replace(/\s+/g, ' ');
async function searchRegulations({ query }) {
  const meta = await loadRegsMeta();
  const ws = words(thaiNorm(query));
  const scored = meta.rows.map((r) => {
    const title = thaiNorm(r[2]).toLowerCase();
    let s = 0; ws.forEach((w) => { if (title.includes(w)) s += 3; });
    return { r, s };
  });
  // ค้นในเนื้อหาด้วย ถ้าโหลดไว้แล้ว (ไม่รอโหลด — ครั้งแรกจะเริ่มโหลดเบื้องหลัง)
  const text = regsText;
  if (!text) loadRegsText().catch(() => {});
  if (text) scored.forEach((x) => { const t = thaiNorm(text[x.r[0]]).toLowerCase(); ws.forEach((w) => { if (t.includes(w)) x.s += 1; }); });
  const top = scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s || b.r[4] - a.r[4]).slice(0, 5);
  const res = {
    ค้นในเนื้อหา: text ? 'ค้นแล้ว' : 'กำลังดาวน์โหลดเนื้อหาครั้งแรก ตอนนี้ค้นจากชื่อเรื่องเท่านั้น',
    ผลลัพธ์: top.map(({ r }) => {
      let ตัวอย่าง = '';
      if (text && text[r[0]]) {
        const t = thaiNorm(text[r[0]]), i = Math.max(0, ws.map((w) => t.toLowerCase().indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0] || 0);
        ตัวอย่าง = t.slice(Math.max(0, i - 300), i + 900);
      }
      return { ชื่อ: r[2], ประเภท: r[3], ปี: r[4], หมวด: meta.cats[r[6]], ลิงก์: r[7] ? 'https://drive.google.com/file/d/' + r[7] + '/view' : '', ตัวอย่าง };
    }),
  };  return withD(res, { source: 'ระเบียบ กฟภ.', app: '/regulations/', items: res.ผลลัพธ์.map((r) => ({ title: r.ชื่อ, sub: [r.ประเภท, r.ปี, r.หมวด].filter(Boolean).join(' · '), link: r.ลิงก์, text: r.ตัวอย่าง })) });

}

// ---------- 5) คลังพัสดุ ----------
async function stockSearch({ keyword }, creds) {
  const j = await cached('stock', 600e3, () => postJSON(STOCK_API, { action: 'bootstrap', user: creds.user, pass: creds.pass }));
  const slocName = {}; (j.slocs || []).forEach((s) => { slocName[s.code] = s.name; });
  const ws = words(keyword);
  const agg = {};
  (j.rows || []).forEach(([sloc, mat, desc, batch, qty, unit, transit]) => {
    const hay = (mat + ' ' + desc).toLowerCase();
    if (ws.length && !ws.every((w) => hay.includes(w))) return;
    const k = mat;
    (agg[k] = agg[k] || { รหัส: mat, รายการ: desc, หน่วย: unit, รวม: 0, ตามคลัง: {} });
    agg[k].รวม += qty;
    const sn = slocName[sloc] || sloc;
    agg[k].ตามคลัง[sn] = (agg[k].ตามคลัง[sn] || 0) + qty;
  });
  const items = Object.values(agg).sort((a, b) => b.รวม - a.รวม);
  return withD({ พบ: items.length, รายการ: items.slice(0, 15) }, { source: 'คลังพัสดุ', app: '/stock/', stats: [{ l: 'รายการที่พบ', v: items.length }],
    items: items.slice(0, 30).map((x) => ({ title: x.รายการ, sub: x.รหัส, badge: x.รวม + ' ' + (x.หน่วย || ''), tone: x.รวม > 0 ? 'green' : 'red', fields: Object.entries(x.ตามคลัง).map(([k, v]) => [k, v + ' ' + (x.หน่วย || '')]) })) });
}

// ---------- 6) ยานพาหนะ ----------
async function vehicles({ keyword }, creds) {
  const j = await cached('veh', 120e3, () => postJSON(VEH_API, { action: 'bootstrap', user: creds.user, pass: creds.pass }));
  const today = bkkToday();
  const img = {}; (j.vehicles || []).forEach((v) => { img[v.plate] = v.image || driveImg(v.imageId); });
  let cars = (j.vehicles || []).map((v) => ({ ทะเบียน: v.plate, รุ่น: v.model, สถานะ: v.status === 'in-use' ? 'ใช้งานอยู่' : 'ว่าง', ผู้ใช้: v.user, ภารกิจ: v.mission, ตั้งแต่: v.since, เลขไมล์: v.mile }));
  let books = (j.bookings || []).filter((b) => String(b.end || b.start).slice(0, 10) >= today)
    .map((b) => ({ เริ่ม: b.start, ถึง: b.end, ทะเบียน: b.plate, ผู้จอง: b.user, ภารกิจ: b.mission, สถานะ: b.status }));
  if (keyword) { const f = (x) => words(keyword).every((w) => JSON.stringify(x).toLowerCase().includes(w)); cars = cars.filter(f); books = books.filter(f); }
  return withD({ รถ: cars, การจองที่จะถึง: books.slice(0, 15) }, { source: 'ระบบยานพาหนะ', app: '/vehicle/',
    stats: [{ l: 'ว่าง', v: cars.filter((c) => c.สถานะ === 'ว่าง').length, t: 'green' }, { l: 'ใช้งานอยู่', v: cars.filter((c) => c.สถานะ !== 'ว่าง').length }, { l: 'การจองที่จะถึง', v: books.length }],
    items: [...cars.map((c) => ({ title: c.ทะเบียน, sub: [c.รุ่น, c.ผู้ใช้, c.ภารกิจ].filter(Boolean).join(' · '), badge: c.สถานะ, thumb: img[c.ทะเบียน], images: img[c.ทะเบียน] ? [img[c.ทะเบียน]] : [], fields: F(c) })),
      ...books.slice(0, 15).map((b) => ({ title: 'จอง ' + (b.ทะเบียน || ''), sub: [String(b.เริ่ม).slice(0, 16).replace('T', ' '), b.ผู้จอง, b.ภารกิจ].filter(Boolean).join(' · '), badge: b.สถานะ, fields: F(b) }))] });
}

// ---------- ตัวช่วยย่อข้อมูลให้พอดีกับ AI ----------
const SKIP_KEY = /photo|image|img|pic|base64|thumb|^lat$|^lon$|^lng$|url|token|pass|signature|hist$/i;
function slim(x, d = 0) {
  if (typeof x === 'string') return x.length > 300 ? x.slice(0, 300) + '…' : x;
  if (Array.isArray(x)) return x.slice(0, d ? 40 : 120).map((v) => slim(v, d + 1));
  if (x && typeof x === 'object') { const o = {}; for (const [k, v] of Object.entries(x)) { if (!SKIP_KEY.test(k) && v !== '' && v != null) o[k] = slim(v, d + 1); } return o; }
  return x;
}
function cap(obj, n = 14000) { const s = JSON.stringify(obj); return s.length > n ? s.slice(0, n) + ' …(ข้อมูลยาวเกิน ตัดไว้แค่นี้ ถามให้แคบลงได้)' : obj; }
const match = (x, kw) => !kw || words(kw).every((w) => JSON.stringify(x).toLowerCase().includes(w));
// ---------- ข้อมูลสำหรับแสดงบนจอ (ไม่ส่งให้ AI) ----------
const withD = (ai, d) => Object.assign(typeof ai === 'string' ? { ข้อมูล: ai } : ai, { __display: d });
const F = (o) => Object.entries(o || {}).filter(([k, v]) => v !== '' && v != null && typeof v !== 'object' && !k.startsWith('_') && !SKIP_KEY.test(k)).map(([k, v]) => [k, String(v).replace(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}).*$/, '$1 $2')]);
const toneOf = (s) => /ร้ายแรง|สูง|^3$|ใหม่|ค้าง|ยังไม่|ใช้งานอยู่|นอกพื้นที่|รุนแรง/.test(String(s)) ? 'red' : /กลาง|^2$|รับงาน|กำลัง|รอ/.test(String(s)) ? 'amber' : /เสร็จ|ว่าง|ปกติ|ในพื้นที่|แล้ว/.test(String(s)) ? 'green' : '';
const driveImg = (id) => id ? 'https://lh3.googleusercontent.com/d/' + id + '=w800' : '';
const needCreds = (c) => { if (!c.user || !c.pass) throw new Error('ยังไม่ได้ตั้งชื่อ/รหัสศูนย์รวมงานในหน้าตั้งค่าของน้องมีไฟ'); };

// ---------- 7) SLD อุปกรณ์ในระบบจำหน่าย (สาธารณะ) ----------
const HUB_GAS = 'https://script.google.com/macros/s/AKfycbzqsOqJJQlF4SS1UX_YM6hmhd3lUXCVocAJiK7l28Tzddms9SQ9Z7p-iYgrrgd2B2meWw/exec';
async function sldDevices({ keyword, feeder }) {
  const j = await cached('sld', 3600e3, () => getJSON(HUB_GAS));
  const feeders = (j.feeders || []).map((f) => ({ ฟีดเดอร์: f.id, ชื่อ: f.name, เชื่อมกับ: f.tieTo, จำนวนอุปกรณ์: (f.devices || []).length }));
  let devs = [];
  (j.feeders || []).forEach((f) => (f.devices || []).forEach((d) => devs.push({ _lat: d.lat, _lon: d.lon, ฟีดเดอร์: f.id, รหัส: d.id, ชนิด: d.type, พิกัด: d.rating, ที่ตั้ง: d.desc, มิเตอร์: d.meterCount, ตรวจสอบแล้ว: d.verifiedStatus || d.sequenceVerified })));
  if (feeder) devs = devs.filter((d) => String(d.ฟีดเดอร์).toUpperCase() === String(feeder).toUpperCase());
  if (keyword) devs = devs.filter((d) => match(d, keyword));
  const D = { source: 'SLD สถานีไฟฟ้าอ่าวลึก', app: '/sld-ala/', stats: [{ l: 'ฟีดเดอร์', v: feeders.length }, { l: 'อุปกรณ์ที่พบ', v: devs.length }],
    items: devs.slice(0, 40).map((d) => ({ title: d.รหัส + (d.ชนิด ? ' (' + d.ชนิด + ')' : ''), sub: [d.ที่ตั้ง, d.พิกัด].filter(Boolean).join(' · '), badge: d.ฟีดเดอร์, fields: F(d), lat: d._lat, lon: d._lon })) };
  const ai = devs.slice(0, 40).map(({ _lat, _lon, ...x }) => x);
  return withD({ สถานี: j.substation && j.substation.name, ฟีดเดอร์ทั้งหมด: feeders, พบอุปกรณ์: devs.length, อุปกรณ์: ai }, D);
}

// ---------- 8) Patrol ระบบจำหน่าย (จุดบกพร่อง) ----------
async function patrolFindings({ status, feeder, keyword }, c) {
  needCreds(c);
  const j = await cached('patrol' + (status || '') + (feeder || ''), 300e3, () => postJSON(HUB_GAS, { action: 'patrolList', changedBy: c.user, changedByPassword: c.pass, limit: 400, status: status || '', feederId: feeder || '' }));
  let rows = (j.findings || []).filter((r) => match(r, keyword));
  const sev = (r) => Number(r.Severity) || 0;
  const D = { source: 'Patrol ระบบจำหน่าย', app: '/sld-ala/patrol-index.html', stats: [{ l: 'พบ', v: rows.length }, { l: 'ร้ายแรง', v: rows.filter((r) => sev(r) >= 3).length, t: 'red' }, { l: 'ทั้งหมดในระบบ', v: j.total }],
    items: rows.slice(0, 30).map((r) => ({ title: r.ProblemType || r.Detail || r.FindingID, sub: [r.AnchorRef, r.FeederID, r.NearPlace || r.Address].filter(Boolean).join(' · '), badge: [r.Status, sev(r) ? 'ระดับ ' + sev(r) : ''].filter(Boolean).join(' · '), tone: sev(r) >= 3 ? 'red' : sev(r) === 2 ? 'amber' : '', fields: F(r), lat: r.Lat, lon: r.Lon, detail: { kind: 'patrol', id: r.FindingID } })) };
  return withD({ ทั้งหมดในระบบ: j.total, พบ: rows.length, รายการ: slim(rows.slice(0, 30)) }, D);
}

// ---------- 9) งานตัดต้นไม้ ----------
const TREE_API = 'https://script.google.com/macros/s/AKfycbx3pSMOKIPC0ZKUWzx4tJk-m-cmK0ACxxrGhy7kbs2-D24Rs_pnlMp2Lp3CXi-lSrpq/exec';
async function treeCutting({ year, keyword }, c) {
  needCreds(c);
  const y = String(year || (bkkNow().getUTCFullYear() + 543));
  const login = await cached('treeLogin', 6 * 3600e3, () => postJSON(TREE_API, { action: 'login', user: c.user, password: c.pass }));
  const j = await cached('tree' + y, 600e3, () => postJSON(TREE_API, { action: 'bootstrap', user: login.user && login.user.name, token: login.token, year: y }));
  const data = j.data || j;
  const jobs = (data.jobs || []).filter((x) => match(x, keyword));
  return { ปี: y, จำนวนงาน: (data.jobs || []).length, พบ: jobs.length, งาน: slim(jobs.slice(0, 30)), อื่นๆ: cap(slim(Object.fromEntries(Object.entries(data).filter(([k]) => k !== 'jobs'))), 3000) };
}

// ---------- 10–11) งานจัดซื้อ / ซื้อหม้อแปลง (TF) ----------
const PROCURE_API = 'https://script.google.com/macros/s/AKfycbwJEHg7z1xtXk4xWntweZ1MBzdz34l0KuPLyQ7iCe5Bm5isvWENHwnGn4MmVJ_MIyqZjQ/exec';
const TFBUY_API = 'https://script.google.com/macros/s/AKfycbyeZSYM_uYyC1ZD2q3SdjVPWClHNFRsc_yfUclwPD9mnvw70hU_TG75CXsvmQjsQAAu/exec';
function jobsTool(api, key) {
  return async ({ keyword }, c) => {
    needCreds(c);
    const j = await cached(key, 300e3, () => postJSON(api, { action: 'bootstrap', user: c.user, pass: c.pass }));
    const jobs = (j.jobs || []).filter((x) => match(x, keyword))
      .map((x) => ({ ปี: x.year, ประเภท: x.kind, แผนก: x.dept, เรื่อง: x.title, ผู้ขาย: x.vendor, ยอดเงิน: x.total, ขั้นตอน: x.step, เลขที่: x.nums, ผู้สร้าง: x.createdBy, แก้ล่าสุด: x.updatedAt }));
    return withD({ ทั้งหมด: (j.jobs || []).length, พบ: jobs.length, งาน: jobs.slice(0, 30) }, { source: key === 'tfbuy' ? 'งานซื้อหม้อแปลง' : 'งานจัดซื้อ', app: key === 'tfbuy' ? '/tfbuy/' : '/procure/', stats: [{ l: 'พบ', v: jobs.length }],
      items: jobs.slice(0, 30).map((x) => ({ title: x.เรื่อง, sub: [x.ผู้ขาย, x.ยอดเงิน ? Number(x.ยอดเงิน).toLocaleString('th-TH') + ' บาท' : ''].filter(Boolean).join(' · '), badge: x.ขั้นตอน, fields: F(x) })) });
  };
}

// ---------- 12) Safety talk ----------
const ST_API = 'https://script.google.com/macros/s/AKfycbyfGC_-vovohq24RWL91hUEYWXxdiL8UkvJ5VOabKe2dGt9vERuCKocEieny86rhOBJXw/exec';
async function safetyTalk({ keyword }, c) {
  needCreds(c);
  const j = await cached('st', 600e3, () => postJSON(ST_API, { fn: 'st', args: [{ action: 'boot', auth: { name: c.user, pass: c.pass } }] }));
  const data = j.data || j;
  if (!keyword) return cap(slim(data));
  const out = {};
  for (const [k, v] of Object.entries(data)) out[k] = Array.isArray(v) ? v.filter((x) => match(x, keyword)).slice(0, 30) : v;
  return cap(slim(out));
}

// ---------- 13) แผนปฏิบัติการ K04 (สาธารณะ) ----------
const K04_API = 'https://script.google.com/macros/s/AKfycbzPHT_oHJEDbCXQAIswkwOeSEWtSYuMb1xtG3KdgVYIJuzFJ_9qbVHqw8myYG9rtbpHiQ/exec';
async function k04Plan({ keyword }) {
  const j = await cached('k04', 1800e3, () => getJSON(K04_API + '?action=data'));
  const acts = [];
  (j.sheets || []).forEach((sh) => (sh.activities || []).forEach((a) => acts.push({ หมวด: sh.name, รหัส: a.code, กิจกรรม: a.title, แผนงาน: a.plan, เป้าหมาย: a.desc, ผู้รับผิดชอบ: a.resp, ผู้ดำเนินการ: a.doer,
    รายไตรมาส: (a.rows || []).map((r) => ({ หน่วย: r.unit, ไตรมาส: (r.q || []).map((q) => ({ เป้า: q.t, ผล: q.r, คะแนน: q.score })) })) })));
  const hit = acts.filter((a) => match(a, keyword));
  return withD({ กิจกรรมทั้งหมด: acts.length, พบ: hit.length, กิจกรรม: cap(hit.slice(0, 12), 12000) }, { source: 'แผนปฏิบัติการ K04', app: '/k04/', stats: [{ l: 'พบ', v: hit.length }],
    items: hit.slice(0, 20).map((a) => ({ title: a.รหัส + ' ' + a.กิจกรรม, sub: [a.ผู้รับผิดชอบ, a.ผู้ดำเนินการ].filter(Boolean).join(' · '), fields: [['แผนงาน', a.แผนงาน || ''], ['เป้าหมาย', (a.เป้าหมาย || []).join(' ')], ...(a.รายไตรมาส || []).flatMap((r) => (r.ไตรมาส || []).map((q, i) => ['ไตรมาส ' + (i + 1) + ' (' + (r.หน่วย || '') + ')', 'เป้า ' + (q.เป้า || '-') + ' · ผล ' + (q.ผล || '-')]))] })) });
}

// ---------- 14) KPI กฟต.2 ปี 2569 (สาธารณะ) ----------
async function kpiRegion2({ keyword }) {
  const all = await cached('kpi', 3600e3, async () => {
    const out = {};
    for (const f of ['kpi_data', 'org_data']) {
      const txt = await (await fetch('/kpi-pea-region2-2569/data/' + f + '.js')).text();
      const names = [...txt.matchAll(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/gm)].map((m) => m[1]);
      try { Object.assign(out, new Function(txt + ';return {' + names.join(',') + '};')()); } catch {}
    }
    return out;
  });
  const aol = new Set(all.KPI_AOL || []);
  let list = (all.FB || []).map((r) => ({ รหัส: r[0], ตัวชี้วัด: r[1], เจ้าของ: r[2], ประเภท: r[3], ผู้รับผิดชอบ: r[4], ผลงานล่าสุด: r[5], ข้อมูลเดือน: r[6], คะแนนล่าสุด: r[7],
    เกณฑ์คะแนน_ระดับ1ถึง5: all.TARGETS && all.TARGETS[r[0]], คะแนนรายเดือน: all.MONTHLY_SCORES && all.MONTHLY_SCORES[r[0]], วัดผลที่กฟส_อ่าวลึกด้วย: aol.has(r[0]) }));
  if (keyword) list = list.filter((x) => match(x, keyword));
  return withD({ หมายเหตุ: 'เป็นผลระดับ กฟต.2 ตามแดชบอร์ด KPI', จำนวน: list.length, ตัวชี้วัด: list.slice(0, 25) }, { source: 'KPI กฟต.2 ปี 2569', app: '/kpi-pea-region2-2569/kpi/',
    items: list.slice(0, 30).map((k) => ({ title: k.รหัส + ' ' + k.ตัวชี้วัด, sub: [k.ผู้รับผิดชอบ, k.ข้อมูลเดือน ? 'ข้อมูล ' + k.ข้อมูลเดือน : ''].filter(Boolean).join(' · '), badge: k.คะแนนล่าสุด != null ? 'คะแนน ' + k.คะแนนล่าสุด : 'ยังไม่รายงาน', tone: k.คะแนนล่าสุด >= 4 ? 'green' : k.คะแนนล่าสุด != null && k.คะแนนล่าสุด < 3 ? 'red' : '',
      fields: [['ผลงานล่าสุด', k.ผลงานล่าสุด], ['เจ้าของ', k.เจ้าของ], ['ประเภท', k.ประเภท], ...Object.entries(k.เกณฑ์คะแนน_ระดับ1ถึง5 || {}).map(([a, b]) => ['เกณฑ์ระดับ ' + a, b]), ...Object.entries(k.คะแนนรายเดือน || {}).map(([a, b]) => ['คะแนน ' + a, b])].filter((x) => x[1] != null).map(([a, b]) => [a, String(b)]) })) });
}

// ---------- 15) เช็กอินวันนี้ (สาธารณะในแดชบอร์ด) ----------
const CHECKIN_API = 'https://script.google.com/macros/s/AKfycbxY0vjjr3MAl6e_OSTTbubrK-cVTrsx3o38xQGLJkJMro8rS8H-LaWl2J3oeE_I31FR/exec';
async function checkinToday({ keyword }) {
  const j = await cached('checkin', 120e3, () => getJSON(CHECKIN_API + '?action=getTodayDashboard'));
  const recs = (j.records || []).map((r) => ({ ชื่อ: String(r.name || '').replace(/\s+/g, ' '), เข้างาน: r.checkIn, ออกงาน: r.checkOut, พื้นที่: r.area, หมายเหตุ: r.note })).filter((r) => match(r, keyword));
  const raw = {}; (j.records || []).forEach((r) => { raw[String(r.name || '').replace(/\s+/g, ' ')] = r.picUrl; });
  return withD({ วันที่: bkkToday(), เช็กอินแล้ว: recs.length, รายชื่อ: recs, อื่นๆ: cap(slim(Object.fromEntries(Object.entries(j).filter(([k]) => k !== 'records'))), 2000) }, { source: 'เช็กอินวันนี้ ' + bkkToday(), app: '/pea-checkin/dashboard_mobile.html', stats: [{ l: 'เช็กอินแล้ว', v: recs.length }, { l: 'นอกพื้นที่', v: recs.filter((r) => /นอก/.test(r.พื้นที่ || '')).length }],
    items: recs.map((r) => ({ title: r.ชื่อ, sub: ['เข้า ' + (r.เข้างาน || '-'), r.ออกงาน ? 'ออก ' + r.ออกงาน : '', r.หมายเหตุ].filter(Boolean).join(' · '), badge: r.พื้นที่, thumb: raw[r.ชื่อ], images: raw[r.ชื่อ] ? [raw[r.ชื่อ]] : [] })) });
}

// ---------- 15b) ประกาศงดจ่ายไฟ (แผนดับไฟล่วงหน้า / ดับไฟฉุกเฉิน) ----------
async function powerNotices({ keyword }) {
  const all = await loadNotices(), now = Date.now(), today = bkkToday();
  const ST = { plan: 'ตามแผน', due: 'ถึงเวลาดับ', live: 'กำลังดับ', done: 'ไฟมาแล้ว', over: 'เลยเวลาแล้ว', cancel: 'ยกเลิก' };
  let list = all.map((n) => ({ n, st: ntState(n, now) }));
  list = keyword ? list.filter(({ n }) => match([n.area, n.sub, n.reason, n.feeder, (n.villages || []).join(' ')].join(' '), keyword)) : list.filter(({ n, st }) => n.date >= today || st === 'live' || st === 'due');
  list.sort((a, b) => String(a.n.startAt).localeCompare(String(b.n.startAt)));
  list = list.slice(0, 12);
  const days = (ymd) => Math.round((Date.parse(ymd + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 864e5);
  return withD({ จำนวน: list.length, ประกาศ: list.map(({ n, st }) => ({ ประเภท: n.type === 'emg' ? 'ดับไฟฉุกเฉิน' : 'งดจ่ายไฟตามแผน', วันเวลา: ntWhen(n), พื้นที่: ntArea(n) + (n.sub ? ' ' + n.sub : ''), เหตุผล: n.reason || '', ผู้ใช้ไฟ: n.cust || '', สถานะ: ST[st] || st })) },
    { source: 'ประกาศงดจ่ายไฟ · งานเวรแก้ไฟ', app: '/duty-roster/', items: list.map(({ n, st }) => {
      const d = days(n.date);
      const fields = [['ประเภท', n.type === 'emg' ? 'ดับไฟฉุกเฉิน' : 'งดจ่ายไฟตามแผน'], ['วันเวลา', ntWhen(n)], ['สถานะ', ST[st] || st], ['พื้นที่', ntArea(n) + (n.sub ? ' ' + n.sub : '')],
['เหตุผล', n.reason || ''], ['ผู้ใช้ไฟประมาณ', n.cust ? n.cust + ' ราย' : ''], ['ฟีดเดอร์', n.feeder || ''],
        ['ดับจริง', n.actualOff ? ntHm(n.actualOff) + ' น.' : ''], ['ไฟมา', n.actualOn ? ntHm(n.actualOn) + ' น.' : ''], ['หนังสือประกาศ', n.type === 'emg' ? '' : n.doc ? 'แนบแล้ว (แสดงด้านบน)' : 'ยังไม่แนบ']].filter(([, v]) => v);
      return { title: (n.type === 'emg' ? 'ดับไฟฉุกเฉิน ' : 'งดจ่ายไฟ ') + ntDate(n.date) + ' ' + ntHm(n.actualOff || n.startAt) + (n.endAt ? '–' + ntHm(n.endAt) : '') + ' น.', sub: [ntArea(n), n.reason].filter(Boolean).join(' · '),
        fields, detail: n.doc && n.doc.fileId ? { kind: 'noticeDoc', fileId: n.doc.fileId } : null, link: '/duty-roster/?nt=' + encodeURIComponent(n.id),
        badge: st === 'live' || st === 'due' ? 'กำลังดับ' : st === 'plan' ? (d === 0 ? 'วันนี้' : d === 1 ? 'พรุ่งนี้' : 'อีก ' + d + ' วัน') : ST[st], tone: st === 'live' || st === 'due' || n.type === 'emg' ? 'red' : st === 'plan' ? (d <= 1 ? 'amber' : '') : st === 'done' ? 'green' : '' };
    }) });
}

// ---------- 16) รับแจ้งไฟดับ (เรื่องค้าง/ล่าสุด 36 ชม.) ----------
async function outageTickets({ keyword }, c) {
  needCreds(c);
  const j = await cached('tickets', 60e3, () => postJSON(DUTY_API, { action: 'tickets', hubUser: c.user, hubPass: c.pass }));
  const ST = { new: 'ใหม่ ยังไม่มีคนรับ', acc: 'รับงานแล้ว กำลังแก้', done: 'แก้เสร็จ', cancel: 'ยกเลิก' };
  const rows = (j.tickets || []).map((t) => Object.assign(slim(t), { สถานะ: ST[t.st] || t.st })).filter((t) => match(t, keyword));
  return withD({ จำนวน: rows.length, รายการ: rows.slice(0, 30) }, { source: 'รับแจ้งไฟดับ', app: '/duty-roster/', stats: [{ l: 'ยังไม่มีคนรับ', v: rows.filter((r) => /ใหม่/.test(r.สถานะ)).length, t: 'red' }, { l: 'กำลังแก้', v: rows.filter((r) => /รับงาน/.test(r.สถานะ)).length }],
    items: rows.slice(0, 30).map((r) => ({ title: r.place || r.addr || r.detail || r.id || 'แจ้งไฟดับ', sub: [r.name, r.phone, r.accBy ? 'รับโดย ' + r.accBy : ''].filter(Boolean).join(' · '), badge: r.สถานะ, fields: F(r), lat: r.lat, lon: r.lon })) });
}
// ---------- 17) สมุดโทรศัพท์ทีมแก้ไฟ ----------
async function contacts({ keyword }, c) {
  needCreds(c);
  const j = await cached('contacts', 3600e3, () => postJSON(DUTY_API, { action: 'contacts', user: c.user, pass: c.pass }));
  const list = j.contacts || j.list || j.data || j;
  return cap(slim(Array.isArray(list) ? list.filter((x) => match(x, keyword)) : list), 8000);
}

// ---------- 18) SAIFI / SAIDI รายพื้นที่ (สาธารณะ) ----------
async function reliability({ keyword }) {
  const a = await cached('area', 3600e3, async () => (await fetch('/pea-analytics-data/data/area.json')).json());
  const kw = keyword || 'อ่าวลึก';
  const rows = (a.rows || []).filter((r) => match(r, kw)).slice(0, 10).map((r) => Object.fromEntries(a.headers.map((h, i) => [h, r[i]]).filter(([, v]) => v !== '' && v != null)));
  return withD({ หมายเหตุ: 'SAIFI/SAIDI แยกตามพื้นที่ ตัวเลข 1–5 คือระดับเหตุ/ประเภทตามรายงานต้นทาง', พบ: rows.length, ข้อมูล: rows }, { source: 'SAIFI / SAIDI รายพื้นที่', app: '/pea-analytics-data/', items: rows.map((r) => ({ title: r['กฟฟ.'] || r['กฟส.'] || '', sub: [r['กฟส.'], r['กฟฟ.จุดรวมงาน']].filter(Boolean).join(' · '), badge: r['SAIFI รวม'] ? 'SAIFI ' + Number(r['SAIFI รวม']).toFixed(2) : '', fields: F(r) })) });
}

// ---------- 19) Load01 โหลดฟีดเดอร์ (สาธารณะ) ----------
const LOAD01_API = 'https://script.google.com/macros/s/AKfycbxL9UA6FHRLeemR_1xHu5WDih4POHR0lKkZQOhJlywuXhUtgkVHoyNs_18mteoGf1Yu/exec';
async function load01({ feeder, months }) {
  const d = await cached('load01', 3600e3, async () => { const j = await postJSON(LOAD01_API, { fn: 'getDashboardData', args: [] }); return typeof j.result === 'string' ? JSON.parse(j.result) : j.result; });
  const want = String(feeder || 'ALA').toUpperCase();
  const fidx = []; (d.feeders || []).forEach((f, i) => { if (String(f[3] || '').toUpperCase().startsWith(want) || match(f, feeder)) fidx.push(i); });
  const n = Math.min(Number(months) || 3, 12), lastM = (d.months || []).length - 1;
  const out = fidx.slice(0, 12).map((fi) => {
    const f = d.feeders[fi];
    const L = { mw: 'Peak MW', mvar: 'MVar', kv: 'kV', ia: 'กระแสเฟส A (A)', ib: 'กระแสเฟส B (A)', ic: 'กระแสเฟส C (A)', lmw: 'Light MW', ph: 'เวลา Peak (ชม.)', lh: 'เวลา Light (ชม.)', ub: 'ไม่สมดุล UB %', pf: 'PF', lf: 'Load factor', q: 'คุณภาพข้อมูล' };
    const rows = (d.rows || []).filter((r) => r[1] === fi && r[0] > lastM - n).map((r) => Object.assign({ เดือน: d.months[r[0]] }, Object.fromEntries((d.cols || []).slice(2).map((c, k) => [L[c] || c, r[k + 2]]))));
    return { ฟีดเดอร์: f[3], สถานี: f[1], พื้นที่: f[4], ข้อมูล: rows };
  });
  return withD({ ข้อมูลล่าสุดถึงเดือน: d.months && d.months[lastM], ฟีดเดอร์: out }, { source: 'Load01 ถึงเดือน ' + (d.months && d.months[lastM]), app: '/load01/',
    items: out.map((f) => { const last = f.ข้อมูล[f.ข้อมูล.length - 1] || {}; return { title: f.ฟีดเดอร์, sub: f.พื้นที่, badge: last['Peak MW'] != null ? last['Peak MW'] + ' MW' : '', fields: f.ข้อมูล.flatMap((r) => Object.entries(r).filter(([k, v]) => k !== 'เดือน' && v != null).map(([k, v]) => [r.เดือน + ' · ' + k, String(v)])) }; }) });
}

// ---------- 20) แบบมาตรฐาน / รายการวัสดุ (สาธารณะ) ----------
async function drawingsBom({ keyword }) {
  const list = await cached('bom', 6 * 3600e3, async () => (await fetch('/pea-drawings/bom-index.json')).json());
  const hit = list.filter((x) => match({ t: x.t, i: (x.items || []).map((y) => y.th).join(' ') }, keyword)).slice(0, 5)
    .map((x) => ({ แบบ: x.t, หน้า: '/pea-drawings/' + x.f, วัสดุ: (x.items || []).slice(0, 25).map((y) => [y.n, y.th, (y.q || []).join(' ')].join(' · ')) }));
  return withD({ พบ: hit.length, แบบ: hit }, { source: 'แบบมาตรฐาน กฟภ.', app: '/pea-drawings/', items: hit.map((x) => ({ title: x.แบบ, sub: (x.วัสดุ || []).length + ' รายการวัสดุ', link: x.หน้า, fields: (x.วัสดุ || []).map((m) => { const p = m.split(' · '); return [p[0] + '. ' + (p[1] || ''), p.slice(2).join(' ')]; }) })) });
}

// ---------- 20b) ค้นแบบมาตรฐาน กฟภ. พร้อมภาพ 2D / 3D (ดึงจากคลังแบบในศูนย์รวมงาน ไม่สร้างใหม่) ----------
async function dwgCatalog() {
  // ดัชนีชื่อแบบ (สร้างจากคลังแบบ pea-drawings ด้วย scripts/build-dwg-index.py) — ภาพ/โมเดลเปิดจากหน้าแบบในคลังโดยตรง
  return cached('dwgcat', 24 * 3600e3, async () => (await fetch('./dwg-index.json?v=11182355')).json());
}
const DWG_SYN = [[/สามเฟส|3เฟส/g, '3 เฟส'], [/หนึ่งเฟส|เฟสเดียว|1เฟส/g, '1 เฟส'], [/เสาคู่|สองเสา/g, 'นั่งร้าน'], [/(\d+)\s*เควี|(\d+)\s*kv/gi, '$1$2 kV'], [/ลูกถ้วย|ลูกถ้วยไฟ/g, 'ลูกถ้วย'], [/แรงต่ำ/g, 'แรงต่ำ']];
const dwgNorm = (t) => { t = String(t || '').toLowerCase(); DWG_SYN.forEach(([a, b]) => { t = t.replace(a, b); }); return t; };
async function standardDrawing({ keyword }) {
  const cat = await dwgCatalog();
  const q = dwgNorm(keyword);
  const ws = q.split(/[\s,]+/).filter(Boolean);
  const score = (x) => {
    const name = dwgNorm(x.t + ' ' + x.en), hay = dwgNorm([x.t, x.en, x.s, x.w].join(' ')), hayNs = hay.replace(/\s+/g, '');
    let sc = 0;
    for (const w of ws) {
      if (/^\d{3,4}[a-z]?$/i.test(w) && name.startsWith(w)) sc += 12;   // เลขการประกอบ เช่น 3718
      else if (/^(kv|kva|v|เฟส|ม\.?|มม\.?|ระบบ|แบบ|การติดตั้ง)$/.test(w)) sc += name.includes(w) ? 0.3 : 0; // คำทั่วไป ให้น้ำหนักน้อย
      else if (name.includes(w)) sc += 2 + Math.min(w.length, 12) / 3;                    // คำยาว = เจาะจงกว่า
      else if (hay.includes(w) || hayNs.includes(w)) sc += 1.5;
      else if (/^\d+$/.test(w)) sc -= 1;
      else if (w.length > 3) { let n = 0, k = 0; for (let i = 0; i < w.length - 1; i++, k++) if (hayNs.includes(w.slice(i, i + 2))) n++; sc += n / k >= 0.8 ? n / k : -3; }
      else sc -= 3;
    }
    return sc + (x.p ? 0.5 : 0);
  };
  const hit = cat.map((x) => [score(x), x]).filter(([s]) => s > 1).sort((a, b) => b[0] - a[0]).slice(0, 8).map(([, x]) => x);
  const P = (u) => (u ? '/pea-drawings/' + u : '');
  return withD({ พบ: hit.length, แบบ: hit.map((x) => ({ แบบ: x.t, หมวด: x.s, มีภาพ2D3D: !!x.p })), หมายเหตุ: 'รายการแบบแสดงบนจอแล้ว ผู้ใช้แตะเพื่อดูภาพ 2D / 3D / วัสดุ / PDF' },
    { source: 'แบบมาตรฐาน กฟภ. · 2D / 3D', app: '/pea-drawings/', items: hit.map((x) => ({ title: x.t, sub: [x.s, x.en].filter(Boolean).join(' · '), badge: x.p ? '2D · 3D' : 'PDF', tone: x.p ? 'green' : '', thumb: x.i ? './thumbs/' + x.p.split('/').pop().replace('.html', '.jpg') : '', wide: true, dwg: { page: P(x.p), pdf: P(x.f), title: x.t } })) });
}

// ---------- 21) ระบบตัดงบ / เบิกค่ารักษา (รหัสของระบบตัดงบ) ----------
const BUDGET_API = 'https://script.google.com/macros/s/AKfycbygECo4LkNmO4KLt2CXCrX25vwXE0armUUsdajOWF1CL3djNXaELZX8gwb8zU1GFdsWwQ/exec';
async function fnCall(api, fn, args, token) {
  const j = await postJSON(api, { fn, args: args || [], token });
  return j.data !== undefined ? j.data : j.result !== undefined ? j.result : j;
}
async function budget({ keyword }, c) {
  if (!c.budgetUser || !c.budgetPass) throw new Error('ยังไม่ได้ตั้งชื่อผู้ใช้/รหัสของระบบตัดงบในหน้าตั้งค่าของน้องมีไฟ');
  const login = await cached('budgetLogin', 6 * 3600e3, async () => { const r = await fnCall(BUDGET_API, 'apiLogin', [c.budgetUser, c.budgetPass]); if (!r || r.status !== 'success') throw new Error((r && r.message) || 'เข้าระบบตัดงบไม่สำเร็จ'); return r; });
  const [boot, dash] = await Promise.all([
    cached('budgetBoot', 600e3, () => fnCall(BUDGET_API, 'getBootData', [], login.token)),
    cached('budgetDash', 600e3, () => fnCall(BUDGET_API, 'getEnhancedDashboardData', [{ periodType: 'all', dateFrom: null, dateTo: null, dept: '', searchQuery: keyword || '' }], login.token)),
  ]);
  return { ภาพรวม: cap(slim(dash), 8000), ข้อมูลตั้งต้น: cap(slim(boot), 5000) };
}

// ---------- 22) ออกเลขหนังสือ (รหัสสำนักงาน) ----------
const BOOKNUM_API = 'https://script.google.com/macros/s/AKfycbxNSVvzUdqQC-_8ZKLJM1GFliAM4zWyJI8z8VzU0vhhSSBqq0JcxrUr_UyBkWol7ko1Rw/exec';
async function bookNumbers({ category, keyword }, c) {
  if (!c.officeCode) throw new Error('ยังไม่ได้ตั้งรหัสสำนักงานของระบบออกเลขหนังสือในหน้าตั้งค่าของน้องมีไฟ');
  const login = await cached('bookLogin', 12 * 3600e3, async () => { const r = await fnCall(BOOKNUM_API, 'login', [c.officeCode]); if (!r || !r.ok) throw new Error('รหัสสำนักงานไม่ถูกต้อง'); return r; });
  const cats = category ? [category] : ['หนังสือทั่วไป', 'หนังสือสัญญาจ้าง', 'คำสั่ง (พ.)', 'ใบสำคัญจ่าย'];
  const out = {};
  for (const cat of cats) out[cat] = slim(keyword ? await fnCall(BOOKNUM_API, 'searchData', [login.token, cat, keyword]) : await cached('book' + cat, 300e3, () => fnCall(BOOKNUM_API, 'getRecentData', [login.token, cat])));
  return cap(out, 12000);
}

// ---------- 23) CCL งานก่อสร้าง (รหัสของระบบ CCL) ----------
const CCL_API = 'https://script.google.com/macros/s/AKfycby4f-2rofhzok_cg9-YLftco1XuC-MCrKn72TTakoPhQfz-qGqjX9WTzZkY5Ye_BxejNQ/exec';
async function ccl({ keyword }, c) {
  if (!c.cclUser || !c.cclPass) throw new Error('ยังไม่ได้ตั้งชื่อผู้ใช้/รหัสของระบบ CCL ในหน้าตั้งค่าของน้องมีไฟ');
  const login = await cached('cclLogin', 6 * 3600e3, async () => { const r = await fnCall(CCL_API, 'loginUser', [c.cclUser, c.cclPass]); if (!r || !r.success) throw new Error((r && r.error) || 'เข้าระบบ CCL ไม่สำเร็จ'); return r; });
  const [stats, jobs] = await Promise.all([
    cached('cclStats', 600e3, () => fnCall(CCL_API, 'getDashboardStats', [], login.token)),
    cached('cclJobs', 600e3, () => fnCall(CCL_API, 'getConstructionData', [], login.token)),
  ]);
  const list = Array.isArray(jobs) ? jobs : (jobs && (jobs.data || jobs.rows)) || [];
  return { สรุป: cap(slim(stats), 4000), พบงาน: list.filter((x) => match(x, keyword)).length, งาน: slim(list.filter((x) => match(x, keyword)).slice(0, 25)) };
}

// ---------- 24) Office Love เดินตรวจ รปภ. (รหัสของระบบ Office Love) ----------
const OL_API = 'https://script.google.com/macros/s/AKfycbzDx_LY4rc3KSqC3PH1XUe--LqJPppD1q1lB1YvTRi0BCm3Z6i0luBKiyxcoGfkqpIbRw/exec';
async function officeLove({ keyword }, c) {
  const u = c.olUser || c.user, pw = c.olPass || c.pass;
  if (!u || !pw) throw new Error('ยังไม่ได้ตั้งชื่อผู้ใช้/รหัสของระบบ Office Love ในหน้าตั้งค่าของน้องมีไฟ');
  const login = await cached('olLogin', 6 * 3600e3, () => postJSON(OL_API, { action: 'login', username: u, password: pw }));
  const tk = login.token || (login.data && login.data.token);
  let board;
  try { board = await cached('olBoard', 300e3, () => postJSON(OL_API, { action: 'supervisorBoard', token: tk })); }
  catch { board = await cached('olBoot', 300e3, () => postJSON(OL_API, { action: 'bootstrap', token: tk })); }
  return cap(slim(keyword ? JSON.parse(JSON.stringify(board), (k, v) => (Array.isArray(v) ? v.filter((x) => match(x, keyword)) : v)) : board), 10000);
}

// ---------- 25) รหัสพัสดุและราคามาตรฐาน (จากระบบสำรวจออกแบบงานก่อสร้าง) ----------
async function materialPrice({ keyword }) {
  const [items, sp] = await cached('matdb', 6 * 3600e3, () => Promise.all([fetch('/construction/data/items.json').then((r) => r.json()), fetch('/construction/data/stdprice.json').then((r) => r.json())]));
  const hit = Object.entries(items).filter(([code, v]) => match([code, v[0]], keyword)).slice(0, 20)
    .map(([code, v]) => ({ รหัสพัสดุ: code, รายการ: v[0], หน่วย: v[1], ราคามาตรฐาน_บาท: sp.p && sp.p[code] }));
  return withD({ แหล่งราคา: sp.src, พบ: hit.length, รายการ: hit }, { source: sp.src, app: '/construction/', items: hit.map((x) => ({ title: x.รายการ, sub: x.รหัสพัสดุ + ' · ' + x.หน่วย, badge: x.ราคามาตรฐาน_บาท != null ? Number(x.ราคามาตรฐาน_บาท).toLocaleString('th-TH') + ' บาท' : 'ไม่มีราคา' })) });
}

// ---------- แสดงผลอัตโนมัติสำหรับระบบที่ไม่ได้ทำการ์ดเฉพาะ ----------
const NAMES = { tree_cutting: 'งานตัดต้นไม้', safety_talk: 'Safety talk', contacts: 'สมุดโทรศัพท์ทีมแก้ไฟ', budget: 'ระบบตัดงบ', book_numbers: 'ออกเลขหนังสือ', ccl: 'CCL งานก่อสร้าง', office_love: 'Office Love' };
const APPS = { tree_cutting: '/tree-ala/', safety_talk: '/safety-talk/', contacts: '/duty-roster/', budget: '/budget/', book_numbers: '/booknum/', ccl: '/ccl/', office_love: '/office-love/' };
function autoDisplay(name, r) {
  let data = r; if (typeof data === 'string') { try { data = JSON.parse(data.replace(/ …\(ข้อมูลยาวเกิน.*$/, '')); } catch { return null; } }
  let best = null;
  (function walk(x, d) { if (d > 3 || !x || typeof x !== 'object') return; if (Array.isArray(x)) { if (x.length && typeof x[0] === 'object' && (!best || x.length > best.length)) best = x; x.slice(0, 3).forEach((y) => walk(y, d + 1)); } else Object.values(x).forEach((y) => walk(y, d + 1)); })(data, 0);
  if (!best) return null;
  return { source: NAMES[name] || name, app: APPS[name], stats: [{ l: 'รายการ', v: best.length }],
    items: best.slice(0, 30).map((o) => { const f = F(o); return { title: f[0] ? f[0][1] : '-', sub: f.slice(1, 3).map((x) => x[1]).join(' · '), fields: f }; }) };
}

// ---------- ความเคลื่อนไหวข้ามระบบ (สมุดเหตุการณ์) + ความสัมพันธ์ ----------
const thDT = (t) => new Date(t).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
async function activityLog(a, c) {
  const days = Number(a.days) || 7;
  const sysArg = String(a.system || '').trim();
  const sys = sysArg ? (Object.keys(SYS).find((k) => k.includes(sysArg) || sysArg.includes(k.split(' ')[0])) || sysArg) : '';
  const j = await findEvents({ url: c.learnUrl, secret: c.learnSecret }, { q: a.keyword || '', sys, days, type: a.type || '', limit: 60 });
  const evs = j.events || [];
  const cards = evs.map((e) => ({ e, d: describe(e) }));
  const bySys = Object.entries(j.bySys || {}).sort((x, y) => y[1] - x[1]);
  const ents = Object.entries(j.ents || {}).filter(([k]) => !a.keyword || k.toLowerCase() !== String(a.keyword).toLowerCase()).slice(0, 8);
  const ai = {
    ช่วงเวลา: 'ย้อนหลัง ' + j.days + ' วัน', คำค้น: a.keyword || '(ทั้งหมด)', ระบบ: sys || '(ทุกระบบ)',
    พบทั้งหมด: j.total, แยกตามระบบ: Object.fromEntries(bySys), แยกตามชนิด: j.byType,
    สิ่งที่เกี่ยวข้องบ่อย: Object.fromEntries(ents),
    เหตุการณ์ล่าสุด: cards.slice(0, 40).map(({ e, d }) => ({ เวลา: thDT(e.at), ระบบ: e.sys, ชนิด: e.type, รายการ: d.text, รายละเอียด: d.sub, ช่องที่เปลี่ยน: (e.ch || []).slice(0, 4).map((x) => x.c + ': ' + (x.o || '(ว่าง)') + ' → ' + (x.n || '(ว่าง)')) })),
    คำแนะนำการตอบ: 'สรุปเป็นภาษาพูด: มีกี่เรื่อง ระบบไหนบ้าง เรื่องสำคัญ (เปลี่ยนขั้นตอน/รายการใหม่) และความเชื่อมโยงข้ามระบบถ้ามี ห้ามแต่งข้อมูลนอกเหนือจากนี้',
  };
  const tone = { 'เพิ่ม': 'green', 'ลบ': 'red', 'แก้': 'amber', 'อัปเดต': '' };
  const D = { source: 'สมุดเหตุการณ์ทุกระบบ · ' + (a.keyword ? '"' + a.keyword + '" · ' : '') + j.days + ' วัน', app: '',
    stats: [{ l: 'ความเคลื่อนไหว', v: j.total }, ...bySys.slice(0, 3).map(([k, v]) => ({ l: sysInfo(k).icon + ' ' + k, v }))],
    items: cards.map(({ e, d }) => ({ title: d.icon + ' ' + d.text, sub: thDT(e.at) + ' · ' + d.title + (d.sub ? ' · ' + d.sub : ''), badge: e.type, tone: tone[e.type] || '', app: d.app,
      text: e.text, fields: [['ระบบ', e.sys], ['ชีต', e.sheet], ['เวลา', thDT(e.at)], ...(e.ch || []).slice(0, 8).map((x) => [x.c, (x.o || '(ว่าง)') + ' → ' + (x.n || '(ว่าง)')]), ...(d.ents.length ? [['เกี่ยวข้อง', d.ents.join(', ')]] : []), ...Object.entries(e.row || {}).slice(0, 10).map(([k, v]) => [k, String(v)])] })),
    chips: ents.map(([k, v]) => ({ t: k + ' (' + v + ')', q: k + ' มีความเคลื่อนไหวอะไรบ้างในทุกระบบ' })) };
  return withD(ai, D);
}

export async function loadDetail(det, c) {
  if (det.kind === 'patrol') {
    const j = await postJSON(HUB_GAS, { action: 'patrolDetail', changedBy: c.user, changedByPassword: c.pass, findingId: det.id });
    return { fields: F(j.finding), images: (j.photos || []).map((p) => driveImg(p.DriveFileId)).filter(Boolean) };
  }
  if (det.kind === 'noticeDoc') { // หนังสือประกาศงดจ่ายไฟ (ไฟล์ใน Drive ของระบบงานเวรแก้ไฟ)
    const j = await cached('ntf' + det.fileId, 3600e3, () => getJSON(DUTY_API + '?action=noticeFile&f=' + encodeURIComponent(det.fileId)));
    if (!j || !j.base64) return null;
    if (/pdf/.test(j.mime)) { const b = Uint8Array.from(atob(j.base64), (ch) => ch.charCodeAt(0)); return { pdf: URL.createObjectURL(new Blob([b], { type: 'application/pdf' })) }; }
    return { images: ['data:' + j.mime + ';base64,' + j.base64] };
  }
  return null;
}

// ---------- คำศัพท์ช่วยถอดเสียง (ชื่อคน ฟีดเดอร์ ชื่อระบบ) ----------
const BASE_TERMS = ['น้องมีไฟ', 'กฟส.อ่าวลึก', 'ผปร.', 'เวรแก้ไฟ', 'ไฟดับ', 'ไฟตก', 'ฟีดเดอร์', 'หม้อแปลง', 'ฟิวส์ลิงก์', 'ฟิวส์แรงสูง', 'รีโคลสเซอร์', 'เซกชันไลเซอร์', 'ลูกถ้วย', 'ล่อฟ้า', 'คอนสาย', 'เสาคอนกรีต',
  'Patrol', 'SLD', 'Load01', 'KPI', 'K04', 'SAIFI', 'SAIDI', 'Safety talk', 'Office Love', 'CCL', 'มิเตอร์', 'พัสดุ', 'คลังพัสดุ', 'จัดซื้อ', 'ตัดงบ', 'ออกเลขหนังสือ', 'ตัดต้นไม้', 'รปภ.', 'กฟจ.กระบี่', 'กฟต.2',
  'ALA01', 'ALA02', 'ALA03', 'ALA04', 'ALA05', 'ALA06', 'ALA07', 'ALA08', 'ALA09', 'ALA10', 'อ่าวลึก', 'ปลายพระยา', 'เขาพนม', 'แหลมสัก', 'เกาะยอ', 'คลองหิน', 'นาเหนือ', 'บ้านกลาง', 'ทุ่งไทรทอง', 'คลองยา', 'แหลมสัก'];
export async function glossary() {
  const names = new Set();
  try { const m = await cached('month' + monthOf(), 300e3, () => getJSON(DUTY_API + '?action=month&m=' + monthOf())); const d = m.month && m.month.data; ['emp', 'wk'].forEach((g) => Object.keys((d && d[g]) || {}).forEach((n) => names.add(n))); } catch {}
  try { const c = await cached('checkin', 120e3, () => getJSON(CHECKIN_API + '?action=getTodayDashboard')); (c.records || []).forEach((r) => String(r.name || '').split(/\s+/).filter(Boolean).forEach((p) => names.add(p))); } catch {}
  return [...BASE_TERMS, ...names].join(', ');
}

// ---------- ประกาศให้ Gemini รู้จักเครื่องมือ ----------
export const TOOLS = {
  activity_log: { access: 'internal', run: activityLog, decl: { name: 'activity_log', description: 'สมุดเหตุการณ์ของทุกระบบในศูนย์รวมงาน: ใครเพิ่ม/แก้/ลบอะไร เปลี่ยนขั้นตอนเมื่อไหร่ ย้อนหลังได้ และเชื่อมความสัมพันธ์ข้ามระบบด้วยตัวเชื่อม เช่น ฟีดเดอร์ (ALA01) รหัสอุปกรณ์ ทะเบียนรถ หมู่บ้าน ใช้เมื่อถามว่า "มีอะไรเปลี่ยน/เคลื่อนไหว/อัปเดต" "X สัปดาห์นี้มีอะไรบ้าง" "เกี่ยวข้องกับอะไรบ้าง" หรือสรุปความเคลื่อนไหวทั้งสาขา', parameters: { type: 'OBJECT', properties: { keyword: { type: 'STRING', description: 'คำค้น/ตัวเชื่อม เช่น ALA01, กข1234, บ้านแหลมสัก ว่างได้ = ทุกเรื่อง' }, system: { type: 'STRING', description: 'ชื่อระบบ เช่น ยานพาหนะ งานจัดซื้อ Patrol ตัดงบ ว่างได้ = ทุกระบบ' }, days: { type: 'NUMBER', description: 'ย้อนหลังกี่วัน (วันนี้=1 สัปดาห์นี้=7 เดือนนี้=30)' }, type: { type: 'STRING', description: 'เพิ่ม | แก้ | ลบ | อัปเดต ว่างได้' } } } } },
  standard_drawing: { access: 'public', run: standardDrawing, decl: { name: 'standard_drawing', description: 'ค้นแบบก่อสร้างมาตรฐาน กฟภ. และแสดงภาพ 2D / โมเดล 3D / PDF บนจอ เช่น แบบติดตั้งหม้อแปลง คอนสาย ลูกถ้วย เสา หรือเลขแบบ เช่น 6201 (ใช้เมื่อผู้ใช้อยากดูแบบหรือรูป)', parameters: { type: 'OBJECT', properties: { keyword: { type: 'STRING', description: 'ชื่อแบบ อุปกรณ์ หรือเลขการประกอบ' } }, required: ['keyword'] } } },
  weather_now: { access: 'public', run: weatherNow, decl: { name: 'weather_now', description: 'สภาพอากาศตอนนี้ที่อ่าวลึก และระดับความเสี่ยงไฟดับจากฝน/ลม', parameters: { type: 'OBJECT', properties: {} } } },
  weather_warnings: { access: 'public', run: weatherWarnings, decl: { name: 'weather_warnings', description: 'ประกาศเตือนภัยกรมอุตุนิยมวิทยารายวันของเดือน (เฉพาะที่เกี่ยวกับกระบี่และทั่วไป)', parameters: { type: 'OBJECT', properties: { month: { type: 'STRING', description: 'YYYY-MM ว่างได้ = เดือนนี้' } } } } },
  duty_roster: { access: 'internal', run: dutyRoster, decl: { name: 'duty_roster', description: 'ตารางเวรแก้ไฟของพนักงานและคนงาน กฟส.อ่าวลึก ในวันที่ระบุ ว่าใครเข้าเวรช่วงไหน และเบอร์ห้องเวร', parameters: { type: 'OBJECT', properties: { date: { type: 'STRING', description: 'YYYY-MM-DD ว่างได้ = วันนี้' } } } } },
  outage_history: { access: 'internal', run: outageHistory, decl: { name: 'outage_history', description: 'ประวัติไฟดับที่ทีมแก้ไฟบันทึก รายเดือน: เวลาดับ-จ่ายคืน ฟีดเดอร์ อุปกรณ์ สาเหตุ จำนวนผู้ใช้ไฟ การแก้ไข', parameters: { type: 'OBJECT', properties: { month: { type: 'STRING', description: 'YYYY-MM ว่างได้ = เดือนนี้' }, keyword: { type: 'STRING', description: 'คำกรอง เช่น ชื่อหมู่บ้าน ฟีดเดอร์ สาเหตุ' } } } } },
  search_regulations: { access: 'internal', run: searchRegulations, decl: { name: 'search_regulations', description: 'ค้นกฎหมาย ระเบียบ คำสั่ง หลักเกณฑ์ ของ กฟภ. และหน่วยงานรัฐ (ประมาณ 800 ฉบับ) คืนชื่อเรื่อง ลิงก์ และข้อความที่เกี่ยวข้อง', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING', description: 'คำค้นสั้นๆ เช่น ค่าเช่าบ้าน, ลาพักผ่อน, จัดซื้อจัดจ้าง' } }, required: ['query'] } } },
  stock_search: { access: 'internal', run: stockSearch, decl: { name: 'stock_search', description: 'ค้นจำนวนพัสดุคงคลังของ กฟส.อ่าวลึก ตามชื่อหรือรหัสพัสดุ แยกตามคลัง', parameters: { type: 'OBJECT', properties: { keyword: { type: 'STRING', description: 'ชื่อหรือรหัสพัสดุ เช่น มิเตอร์ 15(45), ฟิวส์ลิงก์ 10K' } }, required: ['keyword'] } } },
  vehicles: { access: 'internal', run: vehicles, decl: { name: 'vehicles', description: 'สถานะรถยนต์ของ กฟส.อ่าวลึก (ว่าง/ใช้งานอยู่ ใครใช้ ภารกิจ) และการจองรถที่จะถึง', parameters: { type: 'OBJECT', properties: { keyword: { type: 'STRING', description: 'กรองด้วยทะเบียน ชื่อคน หรือภารกิจ ว่างได้' } } } } },
  sld_devices: { access: 'internal', run: sldDevices, decl: { name: 'sld_devices', description: 'Single Line Diagram สถานีไฟฟ้าอ่าวลึก: รายชื่อฟีดเดอร์ และอุปกรณ์ในระบบจำหน่าย (หม้อแปลง ฟิวส์ สวิตช์ รีโคลสเซอร์) รหัส พิกัด ที่ตั้ง จำนวนมิเตอร์', parameters: { type: 'OBJECT', properties: { feeder: { type: 'STRING', description: 'เช่น ALA06' }, keyword: { type: 'STRING', description: 'รหัสอุปกรณ์ ชื่อหมู่บ้าน หรือชนิด เช่น TR, WF, หม้อแปลง' } } } } },
  patrol_findings: { access: 'internal', run: patrolFindings, decl: { name: 'patrol_findings', description: 'Patrol ระบบจำหน่าย: จุดบกพร่อง/จุดเสี่ยงที่ตรวจพบ สถานะการแก้ไข ฟีดเดอร์ ระดับความรุนแรง', parameters: { type: 'OBJECT', properties: { status: { type: 'STRING', description: 'สถานะ ว่างได้' }, feeder: { type: 'STRING' }, keyword: { type: 'STRING' } } } } },
  tree_cutting: { access: 'internal', run: treeCutting, decl: { name: 'tree_cutting', description: 'งานตัดต้นไม้ กฟส.อ่าวลึก: แผนงาน ผลงาน ผู้รับจ้าง พื้นที่ ตามปีงบประมาณ', parameters: { type: 'OBJECT', properties: { year: { type: 'STRING', description: 'ปี พ.ศ. เช่น 2569' }, keyword: { type: 'STRING' } } } } },
  procure_jobs: { access: 'internal', run: jobsTool(PROCURE_API, 'procure'), decl: { name: 'procure_jobs', description: 'ระบบงานจัดซื้อ (วิธีเฉพาะเจาะจง): รายการงานจัดซื้อ เรื่อง ผู้ขาย ยอดเงิน ขั้นตอน เลขที่เอกสาร', parameters: { type: 'OBJECT', properties: { keyword: { type: 'STRING' } } } } },
  tf_purchase_jobs: { access: 'internal', run: jobsTool(TFBUY_API, 'tfbuy'), decl: { name: 'tf_purchase_jobs', description: 'ระบบงานซื้อหม้อแปลง/ขายหม้อแปลงให้ผู้ใช้ไฟ (tfbuy): รายการงาน ผู้ซื้อ ยอดเงิน ขั้นตอน', parameters: { type: 'OBJECT', properties: { keyword: { type: 'STRING' } } } } },
  safety_talk: { access: 'internal', run: safetyTalk, decl: { name: 'safety_talk', description: 'กิจกรรม Safety Talk: รอบประชุม ผู้เข้าร่วม ขาด/ลา หัวข้อ', parameters: { type: 'OBJECT', properties: { keyword: { type: 'STRING' } } } } },
  k04_plan: { access: 'internal', run: k04Plan, decl: { name: 'k04_plan', description: 'K04 แผนปฏิบัติการ กฟจ.กระบี่ และ กฟฟ.ในสังกัด ปี 2569: กิจกรรม เป้าหมาย ผลรายไตรมาส ผู้รับผิดชอบ', parameters: { type: 'OBJECT', properties: { keyword: { type: 'STRING', description: 'รหัสหรือชื่อกิจกรรม เช่น 1.1, ต้นทุน, SAIFI' } } } } },
  kpi_region2: { access: 'internal', run: kpiRegion2, decl: { name: 'kpi_region2', description: 'KPI Dashboard กฟต.2 ปี 2569: เป้าหมาย ผลงาน คะแนน อันดับของแต่ละการไฟฟ้า', parameters: { type: 'OBJECT', properties: { keyword: { type: 'STRING', description: 'เช่น อ่าวลึก, 1.3.1, SAIFI' } } } } },
  checkin_today: { access: 'internal', run: checkinToday, decl: { name: 'checkin_today', description: 'การเช็กอินเข้า-ออกงานของพนักงานวันนี้ ใครมาแล้ว กี่โมง อยู่ในหรือนอกพื้นที่', parameters: { type: 'OBJECT', properties: { keyword: { type: 'STRING', description: 'ชื่อคน ว่างได้' } } } } },
  power_notices: { access: 'public', run: powerNotices, decl: { name: 'power_notices', description: 'ประกาศงดจ่ายไฟฟ้า (ดับไฟตามแผนล่วงหน้า) และดับไฟฉุกเฉิน ของ กฟส.อ่าวลึก: วันเวลา พื้นที่ เหตุผล สถานะ ใช้ตอบคำถามว่าจะดับไฟวันไหน ที่ไหน', parameters: { type: 'OBJECT', properties: { keyword: { type: 'STRING', description: 'ชื่อหมู่บ้าน ตำบล หรือพื้นที่ (ไม่ใส่ = ประกาศที่กำลังจะมาถึง)' } } } } },
  outage_tickets: { access: 'internal', run: outageTickets, decl: { name: 'outage_tickets', description: 'งานรับแจ้งไฟดับจากผู้ใช้ไฟ: เรื่องที่ยังค้าง ใครรับงาน และรายการล่าสุดใน 36 ชั่วโมง', parameters: { type: 'OBJECT', properties: { keyword: { type: 'STRING' } } } } },
  contacts: { access: 'internal', run: contacts, decl: { name: 'contacts', description: 'สมุดโทรศัพท์/ผู้ติดต่อของทีมแก้ไฟ กฟส.อ่าวลึก', parameters: { type: 'OBJECT', properties: { keyword: { type: 'STRING', description: 'ชื่อคนหรือหน่วยงาน' } } } } },
  reliability: { access: 'internal', run: reliability, decl: { name: 'reliability', description: 'ดัชนีความเชื่อถือได้ SAIFI / SAIDI และจำนวนผู้ใช้ไฟ แยกตามพื้นที่ กฟส./กฟจ.', parameters: { type: 'OBJECT', properties: { keyword: { type: 'STRING', description: 'ชื่อพื้นที่ ค่าเริ่มต้น อ่าวลึก' } } } } },
  load01: { access: 'internal', run: load01, decl: { name: 'load01', description: 'Load01 (SCADA กฟต.2): โหลดรายเดือนของฟีดเดอร์ เช่น กระแส MW Load factor', parameters: { type: 'OBJECT', properties: { feeder: { type: 'STRING', description: 'เช่น ALA06 หรือ ALA = ทุกฟีดเดอร์สถานีอ่าวลึก' }, months: { type: 'NUMBER', description: 'ย้อนหลังกี่เดือน (1-12)' } } } } },
  drawings_bom: { access: 'internal', run: drawingsBom, decl: { name: 'drawings_bom', description: 'แบบมาตรฐาน กฟภ. และรายการวัสดุต่อชุด (BOM) เช่น ฐานรากเสา คอนสาย ติดตั้งหม้อแปลง', parameters: { type: 'OBJECT', properties: { keyword: { type: 'STRING', description: 'ชื่อแบบหรือวัสดุ' } }, required: ['keyword'] } } },
  budget: { access: 'internal', run: budget, decl: { name: 'budget', description: 'ระบบตัดงบทำการ: งบคงเหลือ ยอดใช้ ตามแผนก รายการขอใช้งบ (รวมเบิกค่ารักษา)', parameters: { type: 'OBJECT', properties: { keyword: { type: 'STRING', description: 'คำค้น เช่น ชื่อแผนก รายการ' } } } } },
  book_numbers: { access: 'internal', run: bookNumbers, decl: { name: 'book_numbers', description: 'ระบบออกเลขหนังสือ: เลขหนังสือล่าสุด ค้นเรื่อง หนังสือทั่วไป สัญญาจ้าง คำสั่ง ใบสำคัญจ่าย', parameters: { type: 'OBJECT', properties: { category: { type: 'STRING', description: 'หนังสือทั่วไป | หนังสือสัญญาจ้าง | คำสั่ง (พ.) | ใบสำคัญจ่าย' }, keyword: { type: 'STRING' } } } } },
  ccl: { access: 'internal', run: ccl, decl: { name: 'ccl', description: 'CCL ติดตามงานก่อสร้าง: งานก่อสร้าง สถานะ ผู้รับผิดชอบ สรุปภาพรวม', parameters: { type: 'OBJECT', properties: { keyword: { type: 'STRING' } } } } },
  office_love: { access: 'internal', run: officeLove, decl: { name: 'office_love', description: 'Office Love ระบบเดินตรวจความปลอดภัยสำนักงานของ รปภ.: การเข้าเวร จุดตรวจ เหตุผิดปกติ', parameters: { type: 'OBJECT', properties: { keyword: { type: 'STRING' } } } } },
  material_price: { access: 'internal', run: materialPrice, decl: { name: 'material_price', description: 'ค้นรหัสพัสดุ กฟภ. ชื่อวัสดุ หน่วย และราคามาตรฐานพัสดุงบลงทุนปี 2569 (ใช้ประมาณราคางานก่อสร้าง)', parameters: { type: 'OBJECT', properties: { keyword: { type: 'STRING', description: 'ชื่อวัสดุภาษาอังกฤษหรือรหัส เช่น POLE 12, TRANSFORMER 50 KVA, 1000000003' } }, required: ['keyword'] } } },
};
export const TOOL_DECLS = [{ functionDeclarations: Object.values(TOOLS).map((t) => t.decl) }];

export async function runTool(name, args, ctx) {
  const t = TOOLS[name];
  if (!t) return { error: 'ไม่มีเครื่องมือนี้' };
  if (t.access === 'internal' && !ctx.staff()) {
    ctx.needVerify();
    return { error: 'ข้อมูลภายใน ต้องให้เจ้าหน้าที่ยืนยันตัวตนก่อน', need_verify: true };
  }
  const creds = ctx.creds();
  if ((name === 'stock_search' || name === 'vehicles') && (!creds.user || !creds.pass)) return { error: 'ยังไม่ได้ตั้งชื่อ/รหัสศูนย์รวมงานในหน้าตั้งค่าของน้องมีไฟ' };
  try {
    const r = await t.run(args || {}, creds);
    if (r && typeof r === 'object' && r.__display) { const { __display, ...ai } = r; if (ctx.show) ctx.show(__display); return ai; }
    if (ctx.show) ctx.show(autoDisplay(name, r));
    return r;
  }
  catch (e) { return { error: 'ดึงข้อมูลไม่สำเร็จ: ' + String(e.message || e).slice(0, 120) }; }
}
