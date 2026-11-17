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

// ---------- ประกาศให้ Gemini รู้จักเครื่องมือ ----------
export const TOOLS = {
  weather_now: { access: 'public', run: weatherNow, decl: { name: 'weather_now', description: 'สภาพอากาศตอนนี้ที่อ่าวลึก และระดับความเสี่ยงไฟดับจากฝน/ลม', parameters: { type: 'OBJECT', properties: {} } } },
  weather_warnings: { access: 'public', run: weatherWarnings, decl: { name: 'weather_warnings', description: 'ประกาศเตือนภัยกรมอุตุนิยมวิทยารายวันของเดือน (เฉพาะที่เกี่ยวกับกระบี่และทั่วไป)', parameters: { type: 'OBJECT', properties: { month: { type: 'STRING', description: 'YYYY-MM ว่างได้ = เดือนนี้' } } } } },
  duty_roster: { access: 'internal', run: dutyRoster, decl: { name: 'duty_roster', description: 'ตารางเวรแก้ไฟของพนักงานและคนงาน กฟส.อ่าวลึก ในวันที่ระบุ ว่าใครเข้าเวรช่วงไหน และเบอร์ห้องเวร', parameters: { type: 'OBJECT', properties: { date: { type: 'STRING', description: 'YYYY-MM-DD ว่างได้ = วันนี้' } } } } },
  outage_history: { access: 'internal', run: outageHistory, decl: { name: 'outage_history', description: 'ประวัติไฟดับที่ทีมแก้ไฟบันทึก รายเดือน: เวลาดับ-จ่ายคืน ฟีดเดอร์ อุปกรณ์ สาเหตุ จำนวนผู้ใช้ไฟ การแก้ไข', parameters: { type: 'OBJECT', properties: { month: { type: 'STRING', description: 'YYYY-MM ว่างได้ = เดือนนี้' }, keyword: { type: 'STRING', description: 'คำกรอง เช่น ชื่อหมู่บ้าน ฟีดเดอร์ สาเหตุ' } } } } },
  search_regulations: { access: 'internal', run: searchRegulations, decl: { name: 'search_regulations', description: 'ค้นกฎหมาย ระเบียบ คำสั่ง หลักเกณฑ์ ของ กฟภ. และหน่วยงานรัฐ (ประมาณ 800 ฉบับ) คืนชื่อเรื่อง ลิงก์ และข้อความที่เกี่ยวข้อง', parameters: { type: 'OBJECT', properties: { query: { type: 'STRING', description: 'คำค้นสั้นๆ เช่น ค่าเช่าบ้าน, ลาพักผ่อน, จัดซื้อจัดจ้าง' } }, required: ['query'] } } },
  stock_search: { access: 'internal', run: stockSearch, decl: { name: 'stock_search', description: 'ค้นจำนวนพัสดุคงคลังของ กฟส.อ่าวลึก ตามชื่อหรือรหัสพัสดุ แยกตามคลัง', parameters: { type: 'OBJECT', properties: { keyword: { type: 'STRING', description: 'ชื่อหรือรหัสพัสดุ เช่น มิเตอร์ 15(45), ฟิวส์ลิงก์ 10K' } }, required: ['keyword'] } } },
  vehicles: { access: 'internal', run: vehicles, decl: { name: 'vehicles', description: 'สถานะรถยนต์ของ กฟส.อ่าวลึก (ว่าง/ใช้งานอยู่ ใครใช้ ภารกิจ) และการจองรถที่จะถึง', parameters: { type: 'OBJECT', properties: { keyword: { type: 'STRING', description: 'กรองด้วยทะเบียน ชื่อคน หรือภารกิจ ว่างได้' } } } } },
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
