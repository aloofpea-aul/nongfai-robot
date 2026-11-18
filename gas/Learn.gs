/**
 * น้องไฟเรียนรู้ — หลังบ้านเก็บข้อมูลการเรียนรู้ของน้องไฟ (Google Apps Script)
 * เก็บใน Google Sheet "น้องไฟเรียนรู้" (สร้างให้เองครั้งแรก)
 *   คำที่แก้      : คำที่ถอดเสียงผิด → คำที่ถูก
 *   คำตอบยืนยัน  : คำถาม-คำตอบที่เจ้าหน้าที่กดว่าถูก (ตอบทันทีครั้งต่อไป)
 *   ตัวอย่าง      : คำถามแบบนี้ใช้ข้อมูลจากระบบไหน (สำหรับข้อมูลที่เปลี่ยนทุกวัน)
 *   ความเห็น     : ทุกครั้งที่กด ถูก/ไม่ถูก พร้อมเหตุผล
 * ทุกคำขอต้องมี secret ที่ตรงกับ Script Properties (สร้างครั้งแรกด้วย ?action=init)
 */
const SHEETS = {
  corr: ['เวลา', 'คำที่ฟังผิด', 'คำที่ถูก', 'โดย', 'ใช้งาน'],
  verified: ['เวลา', 'คำถาม', 'คำตอบ', 'การ์ด', 'ยืนยันโดย', 'ใช้งาน'],
  examples: ['เวลา', 'คำถาม', 'ระบบที่ใช้', 'โดย', 'ใช้งาน'],
  feedback: ['เวลา', 'คำถาม', 'คำตอบ', 'ผล', 'เหตุผล', 'คำตอบที่ถูก', 'ระบบที่ใช้', 'อุปกรณ์', 'โดย'],
};
const NAMES = { corr: 'คำที่แก้', verified: 'คำตอบยืนยัน', examples: 'ตัวอย่าง', feedback: 'ความเห็น' };

function props_() { return PropertiesService.getScriptProperties(); }
function ss_() {
  const p = props_();
  let id = p.getProperty('SHEET_ID'), ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) { ss = SpreadsheetApp.create('น้องไฟเรียนรู้'); p.setProperty('SHEET_ID', ss.getId()); }
  return ss;
}
function sheet_(key) {
  const ss = ss_(), name = NAMES[key];
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, SHEETS[key].length).setValues([SHEETS[key]]).setFontWeight('bold').setBackground('#E9E0F3');
    sh.setFrozenRows(1);
    const first = ss.getSheetByName('Sheet1') || ss.getSheetByName('ชีต1');
    if (first && ss.getSheets().length > 1) ss.deleteSheet(first);
  }
  return sh;
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function rows_(key) {
  const sh = sheet_(key), n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, SHEETS[key].length).getValues().filter((r) => String(r[r.length - 1]).toUpperCase() !== 'FALSE' || key === 'feedback');
}

function doGet(e) {
  const a = (e && e.parameter && e.parameter.action) || '';
  if (a === 'init') {
    // สร้าง secret ครั้งเดียว ครั้งต่อไปจะไม่ส่งคืนอีก
    const p = props_();
    if (p.getProperty('SECRET')) return out_({ ok: false, error: 'ตั้งค่าไปแล้ว' });
    const s = Utilities.getUuid().replace(/-/g, '');
    p.setProperty('SECRET', s);
    Object.keys(SHEETS).forEach(sheet_);
    return out_({ ok: true, secret: s, sheetUrl: ss_().getUrl() });
  }
  return out_({ ok: true, name: 'nongfai-learn' });
}

// ---------- เฝ้าการเปลี่ยนแปลงของระบบในศูนย์รวมงาน (ดูแค่เวลาที่ไฟล์ถูกแก้ล่าสุด ไม่อ่านข้อมูล) ----------
const WATCH = {
  tickets: '1G-09SvTHMTkJicNpjoDN0Dw6tS8PUr-ivDfXxnHuR98', // ตารางเวรแก้ไฟ อ่าวลึก (รับแจ้งไฟดับ)
  tmd: '1De5t1KWw3DHZ4vuIyjzomueYp8HYEw58wXD3VS6O1oM',     // ประกาศเตือนภัย TMD (ฐานข้อมูล)
};
function watch_() {
  const c = CacheService.getScriptCache(), hit = c.get('watch');
  if (hit) return JSON.parse(hit);
  const t = {};
  Object.keys(WATCH).forEach((k) => { try { t[k] = DriveApp.getFileById(WATCH[k]).getLastUpdated().getTime(); } catch (e) { t[k] = 0; } });
  c.put('watch', JSON.stringify(t), 8); // หลายเครื่องถามพร้อมกัน ใช้ผลเดียวกันใน 8 วินาที
  return t;
}

function doPost(e) {
  let b = {};
  try { b = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: 'bad json' }); }
  const secret = props_().getProperty('SECRET');
  if (!secret || b.secret !== secret) return out_({ ok: false, error: 'unauthorized' });
  const now = new Date(), by = String(b.by || '').slice(0, 60);
  const lock = LockService.getScriptLock();
  try {
    if (b.action === 'watch') return out_({ ok: true, t: watch_(), now: Date.now() });
    if (b.action === 'events') return out_({ ok: true, ...eventsSince_(Number(b.since || 0), Number(b.limit || 100)) });
    if (b.action === 'load') {
      return out_({
        ok: true,
        corr: rows_('corr').map((r) => ({ wrong: String(r[1]), right: String(r[2]) })),
        verified: rows_('verified').map((r) => ({ q: String(r[1]), a: String(r[2]), card: String(r[3] || ''), by: String(r[4] || ''), at: r[0] })),
        examples: rows_('examples').slice(-40).map((r) => ({ q: String(r[1]), tools: String(r[2]) })),
        sheetUrl: ss_().getUrl(),
      });
    }
    lock.waitLock(10000);
    const cut = (s, n) => String(s || '').slice(0, n || 2000);
    if (b.action === 'correction') {
      if (!b.wrong || !b.right || b.wrong === b.right) return out_({ ok: false, error: 'empty' });
      sheet_('corr').appendRow([now, cut(b.wrong, 200), cut(b.right, 200), by, true]);
      return out_({ ok: true });
    }
    if (b.action === 'feedback') {
      const norm = (q) => String(q).toLowerCase().replace(/\s+|[?？!.,]|ครับ|ค่ะ|คะ|คับ|นะ|หน่อย|ด้วย|น้องไฟ|พี่|จ้า|จ๊ะ/g, '');
      if (!b.ok || b.cacheable) { // คำตอบเดิมของคำถามเดียวกัน → เลิกใช้ (ถูกแทนหรือถูกแจ้งว่าผิด)
        const sh = sheet_('verified'), n = sh.getLastRow(), key = norm(b.q);
        if (n > 1) sh.getRange(2, 2, n - 1, 1).getValues().forEach((r, i) => { if (norm(r[0]) === key) sh.getRange(i + 2, 6).setValue(false); });
      }
      sheet_('feedback').appendRow([now, cut(b.q), cut(b.a, 4000), b.ok ? 'ถูกต้อง' : 'ไม่ถูก', cut(b.reason, 200), cut(b.fix, 4000), cut(b.tools, 300), cut(b.device, 100), by]);
      if (b.ok && b.cacheable) sheet_('verified').appendRow([now, cut(b.q), cut(b.a, 4000), cut(b.card, 4000), by, true]);
      if (!b.ok && b.fix) sheet_('verified').appendRow([now, cut(b.q), cut(b.fix, 4000), '', by + ' (แก้)', true]);
      if (b.ok && !b.cacheable && b.tools) sheet_('examples').appendRow([now, cut(b.q), cut(b.tools, 300), by, true]);
      return out_({ ok: true });
    }
    return out_({ ok: false, error: 'unknown action' });
  } finally { try { lock.releaseLock(); } catch (err) {} }
}
