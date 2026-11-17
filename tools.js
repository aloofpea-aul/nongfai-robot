// เครื่องมือให้น้องไฟดึงข้อมูลจากศูนย์รวมงาน กฟส.อ่าวลึก (Gemini function calling)
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
  return {
    date, วัน: WD[new Date(date + 'T00:00:00Z').getUTCDay()], วันหยุด: !!(day.off || day.hol), สถานะตาราง: mo.month.status,
    พนักงาน: list('emp'), คนงาน: list('wk'),
    โทรห้องเวร: boot.config && boot.config.roomPhone,
    หมายเหตุ: 'ตามตารางที่อนุมัติ อาจมีการแลกเวรภายหลัง ดูให้แน่ใจได้ที่แอปงานเวรแก้ไฟ',
  };
}

// ---------- 2) ประวัติไฟดับ ----------
async function outageHistory({ month, keyword }) {
  const m = /^\d{4}-\d{2}$/.test(month || '') ? month : monthOf();
  const j = await cached('out' + m, 300e3, () => getJSON(DUTY_API + '?action=outages&m=' + m));
  let rows = (j.outages || []).map((o) => ({
    ดับ: o.off, จ่ายไฟคืน: o.on, ระดับ: o.lvl === 'hv' ? 'แรงสูง' : o.lvl === 'lv' ? 'แรงต่ำ' : o.lvl,
    ฟีดเดอร์: o.feeder, อุปกรณ์: o.dev ? [o.dev.id, o.dev.type, o.dev.rating, o.dev.desc].filter(Boolean).join(' ') : '',
    ผู้ใช้ไฟได้รับผลกระทบ: o.cust, สาเหตุ: [o.cType, o.cData].filter(Boolean).join(' - '), สภาพอากาศ: o.weather,
    การแก้ไข: o.detail, สถานที่: o.place,
  }));
  if (keyword) rows = rows.filter((r) => words(keyword).every((w) => JSON.stringify(r).toLowerCase().includes(w)));
  return { เดือน: m, จำนวน: rows.length, รายการ: rows.slice(-25) };
}

// ---------- 3) สภาพอากาศ / ประกาศกรมอุตุฯ ----------
async function weatherNow() {
  const j = await cached('wx', 300e3, () => getJSON(DUTY_API + '?action=wx'));
  const w = j.wx || {};
  return { สรุป: w.label, รายละเอียด: w.detail, เงื่อนไข: (w.ck || []).map((c) => c.t) };
}
async function weatherWarnings({ month }) {
  const m = /^\d{4}-\d{2}$/.test(month || '') ? month : monthOf();
  const j = await cached('tmd' + m, 600e3, () => getJSON(DUTY_API + '?action=tmd&m=' + m));
  const out = Object.entries(j.days || {}).map(([d, v]) => ({
    วันที่: m + '-' + String(d).padStart(2, '0'),
    เกี่ยวกับกระบี่: v.k ? { เรื่อง: v.k.w, ระดับ: v.k.sev, ฉบับ: v.k.no } : null,
    ทั่วไป: v.s ? { เรื่อง: v.s.w, ระดับ: v.s.sev, ฉบับ: v.s.no } : null,
  }));
  return { เดือน: m, ประกาศ: out.slice(-10) };
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
  return {
    ค้นในเนื้อหา: text ? 'ค้นแล้ว' : 'กำลังดาวน์โหลดเนื้อหาครั้งแรก ตอนนี้ค้นจากชื่อเรื่องเท่านั้น',
    ผลลัพธ์: top.map(({ r }) => {
      let ตัวอย่าง = '';
      if (text && text[r[0]]) {
        const t = thaiNorm(text[r[0]]), i = Math.max(0, ws.map((w) => t.toLowerCase().indexOf(w)).filter((i) => i >= 0).sort((a, b) => a - b)[0] || 0);
        ตัวอย่าง = t.slice(Math.max(0, i - 300), i + 900);
      }
      return { ชื่อ: r[2], ประเภท: r[3], ปี: r[4], หมวด: meta.cats[r[6]], ลิงก์: r[7] ? 'https://drive.google.com/file/d/' + r[7] + '/view' : '', ตัวอย่าง };
    }),
  };
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
  return { พบ: items.length, รายการ: items.slice(0, 15) };
}

// ---------- 6) ยานพาหนะ ----------
async function vehicles({ keyword }, creds) {
  const j = await cached('veh', 120e3, () => postJSON(VEH_API, { action: 'bootstrap', user: creds.user, pass: creds.pass }));
  const today = bkkToday();
  let cars = (j.vehicles || []).map((v) => ({ ทะเบียน: v.plate, รุ่น: v.model, สถานะ: v.status === 'in-use' ? 'ใช้งานอยู่' : 'ว่าง', ผู้ใช้: v.user, ภารกิจ: v.mission, ตั้งแต่: v.since, เลขไมล์: v.mile }));
  let books = (j.bookings || []).filter((b) => String(b.end || b.start).slice(0, 10) >= today)
    .map((b) => ({ เริ่ม: b.start, ถึง: b.end, ทะเบียน: b.plate, ผู้จอง: b.user, ภารกิจ: b.mission, สถานะ: b.status }));
  if (keyword) { const f = (x) => words(keyword).every((w) => JSON.stringify(x).toLowerCase().includes(w)); cars = cars.filter(f); books = books.filter(f); }
  return { รถ: cars, การจองที่จะถึง: books.slice(0, 15) };
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
const needCreds = (c) => { if (!c.user || !c.pass) throw new Error('ยังไม่ได้ตั้งชื่อ/รหัสศูนย์รวมงานในหน้าตั้งค่าของน้องไฟ'); };

// ---------- 7) SLD อุปกรณ์ในระบบจำหน่าย (สาธารณะ) ----------
const HUB_GAS = 'https://script.google.com/macros/s/AKfycbzqsOqJJQlF4SS1UX_YM6hmhd3lUXCVocAJiK7l28Tzddms9SQ9Z7p-iYgrrgd2B2meWw/exec';
async function sldDevices({ keyword, feeder }) {
  const j = await cached('sld', 3600e3, () => getJSON(HUB_GAS));
  const feeders = (j.feeders || []).map((f) => ({ ฟีดเดอร์: f.id, ชื่อ: f.name, เชื่อมกับ: f.tieTo, จำนวนอุปกรณ์: (f.devices || []).length }));
  let devs = [];
  (j.feeders || []).forEach((f) => (f.devices || []).forEach((d) => devs.push({ ฟีดเดอร์: f.id, รหัส: d.id, ชนิด: d.type, พิกัด: d.rating, ที่ตั้ง: d.desc, มิเตอร์: d.meterCount, ตรวจสอบแล้ว: d.verifiedStatus || d.sequenceVerified })));
  if (feeder) devs = devs.filter((d) => String(d.ฟีดเดอร์).toUpperCase() === String(feeder).toUpperCase());
  if (keyword) devs = devs.filter((d) => match(d, keyword));
  return { สถานี: j.substation && j.substation.name, ฟีดเดอร์ทั้งหมด: feeders, พบอุปกรณ์: devs.length, อุปกรณ์: devs.slice(0, 40) };
}

// ---------- 8) Patrol ระบบจำหน่าย (จุดบกพร่อง) ----------
async function patrolFindings({ status, feeder, keyword }, c) {
  needCreds(c);
  const j = await cached('patrol' + (status || '') + (feeder || ''), 300e3, () => postJSON(HUB_GAS, { action: 'patrolList', changedBy: c.user, changedByPassword: c.pass, limit: 400, status: status || '', feederId: feeder || '' }));
  let rows = (j.findings || []).filter((r) => match(r, keyword));
  return { ทั้งหมดในระบบ: j.total, พบ: rows.length, รายการ: slim(rows.slice(0, 30)) };
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
    return { ทั้งหมด: (j.jobs || []).length, พบ: jobs.length, งาน: jobs.slice(0, 30) };
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
  return { กิจกรรมทั้งหมด: acts.length, พบ: hit.length, กิจกรรม: cap(hit.slice(0, 12), 12000) };
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
  return { หมายเหตุ: 'เป็นผลระดับ กฟต.2 ตามแดชบอร์ด KPI', จำนวน: list.length, ตัวชี้วัด: list.slice(0, 25) };
}

// ---------- 15) เช็กอินวันนี้ (สาธารณะในแดชบอร์ด) ----------
const CHECKIN_API = 'https://script.google.com/macros/s/AKfycbxY0vjjr3MAl6e_OSTTbubrK-cVTrsx3o38xQGLJkJMro8rS8H-LaWl2J3oeE_I31FR/exec';
async function checkinToday({ keyword }) {
  const j = await cached('checkin', 120e3, () => getJSON(CHECKIN_API + '?action=getTodayDashboard'));
  const recs = (j.records || []).map((r) => ({ ชื่อ: String(r.name || '').replace(/\s+/g, ' '), เข้างาน: r.checkIn, ออกงาน: r.checkOut, พื้นที่: r.area, หมายเหตุ: r.note })).filter((r) => match(r, keyword));
  return { วันที่: bkkToday(), เช็กอินแล้ว: recs.length, รายชื่อ: recs, อื่นๆ: cap(slim(Object.fromEntries(Object.entries(j).filter(([k]) => k !== 'records'))), 2000) };
}

// ---------- 16) รับแจ้งไฟดับ (เรื่องค้าง/ล่าสุด 36 ชม.) ----------
async function outageTickets({ keyword }, c) {
  needCreds(c);
  const j = await cached('tickets', 60e3, () => postJSON(DUTY_API, { action: 'tickets', hubUser: c.user, hubPass: c.pass }));
  const ST = { new: 'ใหม่ ยังไม่มีคนรับ', acc: 'รับงานแล้ว กำลังแก้', done: 'แก้เสร็จ', cancel: 'ยกเลิก' };
  const rows = (j.tickets || []).map((t) => Object.assign(slim(t), { สถานะ: ST[t.st] || t.st })).filter((t) => match(t, keyword));
  return { จำนวน: rows.length, รายการ: rows.slice(0, 30) };
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
  return { หมายเหตุ: 'SAIFI/SAIDI แยกตามพื้นที่ ตัวเลข 1–5 คือระดับเหตุ/ประเภทตามรายงานต้นทาง', พบ: rows.length, ข้อมูล: rows };
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
  return { ข้อมูลล่าสุดถึงเดือน: d.months && d.months[lastM], ชื่อคอลัมน์: d.cols, ฟีดเดอร์: out };
}

// ---------- 20) แบบมาตรฐาน / รายการวัสดุ (สาธารณะ) ----------
async function drawingsBom({ keyword }) {
  const list = await cached('bom', 6 * 3600e3, async () => (await fetch('/pea-drawings/bom-index.json')).json());
  const hit = list.filter((x) => match({ t: x.t, i: (x.items || []).map((y) => y.th).join(' ') }, keyword)).slice(0, 5)
    .map((x) => ({ แบบ: x.t, หน้า: '/pea-drawings/' + x.f, วัสดุ: (x.items || []).slice(0, 25).map((y) => [y.n, y.th, (y.q || []).join(' ')].join(' · ')) }));
  return { พบ: hit.length, แบบ: hit };
}

// ---------- 21) ระบบตัดงบ / เบิกค่ารักษา (รหัสของระบบตัดงบ) ----------
const BUDGET_API = 'https://script.google.com/macros/s/AKfycbygECo4LkNmO4KLt2CXCrX25vwXE0armUUsdajOWF1CL3djNXaELZX8gwb8zU1GFdsWwQ/exec';
async function fnCall(api, fn, args, token) {
  const j = await postJSON(api, { fn, args: args || [], token });
  return j.data !== undefined ? j.data : j.result !== undefined ? j.result : j;
}
async function budget({ keyword }, c) {
  if (!c.budgetUser || !c.budgetPass) throw new Error('ยังไม่ได้ตั้งชื่อผู้ใช้/รหัสของระบบตัดงบในหน้าตั้งค่าของน้องไฟ');
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
  if (!c.officeCode) throw new Error('ยังไม่ได้ตั้งรหัสสำนักงานของระบบออกเลขหนังสือในหน้าตั้งค่าของน้องไฟ');
  const login = await cached('bookLogin', 12 * 3600e3, async () => { const r = await fnCall(BOOKNUM_API, 'login', [c.officeCode]); if (!r || !r.ok) throw new Error('รหัสสำนักงานไม่ถูกต้อง'); return r; });
  const cats = category ? [category] : ['หนังสือทั่วไป', 'หนังสือสัญญาจ้าง', 'คำสั่ง (พ.)', 'ใบสำคัญจ่าย'];
  const out = {};
  for (const cat of cats) out[cat] = slim(keyword ? await fnCall(BOOKNUM_API, 'searchData', [login.token, cat, keyword]) : await cached('book' + cat, 300e3, () => fnCall(BOOKNUM_API, 'getRecentData', [login.token, cat])));
  return cap(out, 12000);
}

// ---------- 23) CCL งานก่อสร้าง (รหัสของระบบ CCL) ----------
const CCL_API = 'https://script.google.com/macros/s/AKfycby4f-2rofhzok_cg9-YLftco1XuC-MCrKn72TTakoPhQfz-qGqjX9WTzZkY5Ye_BxejNQ/exec';
async function ccl({ keyword }, c) {
  if (!c.cclUser || !c.cclPass) throw new Error('ยังไม่ได้ตั้งชื่อผู้ใช้/รหัสของระบบ CCL ในหน้าตั้งค่าของน้องไฟ');
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
  if (!u || !pw) throw new Error('ยังไม่ได้ตั้งชื่อผู้ใช้/รหัสของระบบ Office Love ในหน้าตั้งค่าของน้องไฟ');
  const login = await cached('olLogin', 6 * 3600e3, () => postJSON(OL_API, { action: 'login', username: u, password: pw }));
  const tk = login.token || (login.data && login.data.token);
  let board;
  try { board = await cached('olBoard', 300e3, () => postJSON(OL_API, { action: 'supervisorBoard', token: tk })); }
  catch { board = await cached('olBoot', 300e3, () => postJSON(OL_API, { action: 'bootstrap', token: tk })); }
  return cap(slim(keyword ? JSON.parse(JSON.stringify(board), (k, v) => (Array.isArray(v) ? v.filter((x) => match(x, keyword)) : v)) : board), 10000);
}

// ---------- ประกาศให้ Gemini รู้จักเครื่องมือ ----------
export const TOOLS = {
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
  outage_tickets: { access: 'internal', run: outageTickets, decl: { name: 'outage_tickets', description: 'งานรับแจ้งไฟดับจากผู้ใช้ไฟ: เรื่องที่ยังค้าง ใครรับงาน และรายการล่าสุดใน 36 ชั่วโมง', parameters: { type: 'OBJECT', properties: { keyword: { type: 'STRING' } } } } },
  contacts: { access: 'internal', run: contacts, decl: { name: 'contacts', description: 'สมุดโทรศัพท์/ผู้ติดต่อของทีมแก้ไฟ กฟส.อ่าวลึก', parameters: { type: 'OBJECT', properties: { keyword: { type: 'STRING', description: 'ชื่อคนหรือหน่วยงาน' } } } } },
  reliability: { access: 'internal', run: reliability, decl: { name: 'reliability', description: 'ดัชนีความเชื่อถือได้ SAIFI / SAIDI และจำนวนผู้ใช้ไฟ แยกตามพื้นที่ กฟส./กฟจ.', parameters: { type: 'OBJECT', properties: { keyword: { type: 'STRING', description: 'ชื่อพื้นที่ ค่าเริ่มต้น อ่าวลึก' } } } } },
  load01: { access: 'internal', run: load01, decl: { name: 'load01', description: 'Load01 (SCADA กฟต.2): โหลดรายเดือนของฟีดเดอร์ เช่น กระแส MW Load factor', parameters: { type: 'OBJECT', properties: { feeder: { type: 'STRING', description: 'เช่น ALA06 หรือ ALA = ทุกฟีดเดอร์สถานีอ่าวลึก' }, months: { type: 'NUMBER', description: 'ย้อนหลังกี่เดือน (1-12)' } } } } },
  drawings_bom: { access: 'internal', run: drawingsBom, decl: { name: 'drawings_bom', description: 'แบบมาตรฐาน กฟภ. และรายการวัสดุต่อชุด (BOM) เช่น ฐานรากเสา คอนสาย ติดตั้งหม้อแปลง', parameters: { type: 'OBJECT', properties: { keyword: { type: 'STRING', description: 'ชื่อแบบหรือวัสดุ' } }, required: ['keyword'] } } },
  budget: { access: 'internal', run: budget, decl: { name: 'budget', description: 'ระบบตัดงบทำการ: งบคงเหลือ ยอดใช้ ตามแผนก รายการขอใช้งบ (รวมเบิกค่ารักษา)', parameters: { type: 'OBJECT', properties: { keyword: { type: 'STRING', description: 'คำค้น เช่น ชื่อแผนก รายการ' } } } } },
  book_numbers: { access: 'internal', run: bookNumbers, decl: { name: 'book_numbers', description: 'ระบบออกเลขหนังสือ: เลขหนังสือล่าสุด ค้นเรื่อง หนังสือทั่วไป สัญญาจ้าง คำสั่ง ใบสำคัญจ่าย', parameters: { type: 'OBJECT', properties: { category: { type: 'STRING', description: 'หนังสือทั่วไป | หนังสือสัญญาจ้าง | คำสั่ง (พ.) | ใบสำคัญจ่าย' }, keyword: { type: 'STRING' } } } } },
  ccl: { access: 'internal', run: ccl, decl: { name: 'ccl', description: 'CCL ติดตามงานก่อสร้าง: งานก่อสร้าง สถานะ ผู้รับผิดชอบ สรุปภาพรวม', parameters: { type: 'OBJECT', properties: { keyword: { type: 'STRING' } } } } },
  office_love: { access: 'internal', run: officeLove, decl: { name: 'office_love', description: 'Office Love ระบบเดินตรวจความปลอดภัยสำนักงานของ รปภ.: การเข้าเวร จุดตรวจ เหตุผิดปกติ', parameters: { type: 'OBJECT', properties: { keyword: { type: 'STRING' } } } } },
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
  if ((name === 'stock_search' || name === 'vehicles') && (!creds.user || !creds.pass)) return { error: 'ยังไม่ได้ตั้งชื่อ/รหัสศูนย์รวมงานในหน้าตั้งค่าของน้องไฟ' };
  try { return await t.run(args || {}, creds); }
  catch (e) { return { error: 'ดึงข้อมูลไม่สำเร็จ: ' + String(e.message || e).slice(0, 120) }; }
}
