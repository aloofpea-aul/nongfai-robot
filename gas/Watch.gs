/**
 * น้องมีไฟ · ตัวเฝ้าฐานข้อมูล + สมุดเหตุการณ์
 * ทุก 1 นาที: ดูว่าไฟล์ฐานข้อมูลของระบบไหนถูกแก้ → อ่านเฉพาะไฟล์นั้น → เทียบทีละแถว ทีละช่องกับครั้งก่อน
 * → บันทึกเป็นเหตุการณ์ในชีต "น้องมีไฟ สมุดเหตุการณ์" (อ่านอย่างเดียว ไม่แก้ไฟล์ของระบบใดๆ)
 * ช่องที่เป็นรหัสผ่าน/โทเคน จะไม่ถูกคัดลอก
 */
const WATCH_FILES = [
  // [ระบบ, id, mode]  mode: rows = เทียบทีละแถว · touch = แจ้งแค่ว่าอัปเดตข้อมูลแล้ว (ไฟล์ใหญ่)
  ['งานเวรแก้ไฟ', '1G-09SvTHMTkJicNpjoDN0Dw6tS8PUr-ivDfXxnHuR98', 'rows'],
  ['SLD / Patrol', '1m7dL33F1JwdK60G640xLjlWntkPrY5ulb4tpkpf04LU', 'rows'],
  ['Office Love', '16FDAI8YlOMXlRxTTB6iiy6_4yB48Chv3D3PJBNxRKH4', 'rows'],
  ['ยานพาหนะ', '1arrcSr5twdOkuIHr_XLfwL9ezGPtSGbZ52v1Vo12gu4', 'rows'],
  ['งานจัดซื้อ', '19fEbARQGPUHNzd-d62SpseikLeANU5oJb7cpe3qQPbU', 'rows'],
  ['ซื้อ/ขายหม้อแปลง', '1-6dcnsft8yCySKmnXTIXRaBoOFH3xfhnHawEocO0ac4', 'rows'],
  ['ตัดงบทำการ', '18y0w0hyfIUfp4bUTuLbkjlmHq9tozZzdxUtYrT8GYaI', 'rows'],
  ['ใบเบิกค่ารักษา', '1pucCuKiFWLqCcF1LPNoEHkLNqCNL4yfYupNc8XIheR0', 'rows'],
  ['ออกเลขหนังสือ', '1E8UMS7pbV5Q71Ed-QM-s6NEJBsXdxIKjCWQns-i7OIw', 'rows'],
  ['CCL งานก่อสร้าง', '10tpQGCrlOa26y4K0o3OeHCJrNjr6KAubxrR8lI6xtdI', 'rows'],
  ['สำรวจงานก่อสร้าง', '1JQLp5lB-w0bHLqGcgnYGShhpMViIbFnDQZJnMCg0dCI', 'rows'],
  ['ตัดต้นไม้', '1DWfex5lBumS0rV4uWyLG-h8Q3V2AdFgk7gA01lnMeYY', 'rows'],
  ['คลังพัสดุ', '1IKvWOiuLhYFrxoSfR18kZ3sic5o5Y52Ei9-i8ZCLsdQ', 'rows'],
  ['แผนงานระดมทีม', '1EOfQj1eqkbXeKWTJnV4W6GXpvo8ErpwDaqb64h_byCo', 'rows'],
  ['เตือนภัยกรมอุตุ', '1De5t1KWw3DHZ4vuIyjzomueYp8HYEw58wXD3VS6O1oM', 'rows'],
  ['Safety Talk', '1DcW-dB_dvIcjL4t4ZH1UQSvWQM7yUVX4nEshVqsQVIQ', 'rows'],
  ['ลงเวลา/เช็กอิน', '1pqA3RnyMf88LWIOzDMGAJ9Cb5sZQggS-jVukZnT9q9A', 'rows'],
  ['Load01 กฟต.2', '1GKNEcIyej5dOe0b38DBvN8eGdjZq_G0xP7YZPmVDioo', 'touch'],
  ['KPI / Report50', '1EQgU4gGg5cs-yk11EV_p6B-zx3ZlY9RdhccvnY-wU58', 'touch'],
  ['K04 แผนปฏิบัติการ', '1k-x9dTYXPOyWa8Uf2hl-uG5-yNWIDuC1ICvwyel-nAk', 'touch'],
  ['ระเบียบ กฟภ.', '12Sydlf61_zv9EWrZ74Ur57wEXjqmyY0_DzVxLcSHyDo', 'touch'],
];
const SECRET_COL = /pass|รหัสผ่าน|pin\b|^pin|token|secret|otp|apikey|api_key|salt|hash/i;   // ไม่คัดลอกค่าช่องเหล่านี้
const SKIP_SHEET = /^_|log|cache|tmp|temp|backup|archive|session/i;                        // ชีตบันทึกภายใน/แคช ไม่ต้องเฝ้า
const MAX_EVENTS_PER_FILE = 150, KEEP_EVENTS = 6000, EV_HDR = ['id', 'เวลา', 'ระบบ', 'ชีต', 'รายการ', 'ชนิด', 'สรุป', 'ช่องที่เปลี่ยน', 'ตัวเชื่อม', 'ข้อมูลแถว'];

function evSheet_() {
  const p = PropertiesService.getScriptProperties();
  let ss = null, id = p.getProperty('EVENTS_ID');
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) { ss = SpreadsheetApp.create('น้องมีไฟ สมุดเหตุการณ์'); p.setProperty('EVENTS_ID', ss.getId()); }
  let sh = ss.getSheetByName('เหตุการณ์');
  if (!sh) {
    sh = ss.getSheets()[0]; sh.setName('เหตุการณ์');
    sh.getRange(1, 1, 1, EV_HDR.length).setValues([EV_HDR]).setFontWeight('bold').setBackground('#E9E0F3');
    sh.setFrozenRows(1);
  }
  return sh;
}
// ภาพจำข้อมูลครั้งก่อน: เก็บแบบบีบอัดในชีตซ่อน "_snap" ของสมุดเหตุการณ์ (ไม่ต้องใช้สิทธิ์สร้างไฟล์ใน Drive)
function snapSheet_() {
  const ss = evSheet_().getParent();
  let sh = ss.getSheetByName('_snap');
  if (!sh) { sh = ss.insertSheet('_snap'); sh.hideSheet(); }
  return sh;
}
function snapRow_(sh, fid) {
  const n = sh.getLastRow();
  if (!n) return 0;
  const ids = sh.getRange(1, 1, n, 1).getValues();
  for (let i = 0; i < n; i++) if (ids[i][0] === fid) return i + 1;
  return 0;
}
function loadSnap_(fid) {
  const sh = snapSheet_(), r = snapRow_(sh, fid);
  if (!r) return null;
  const parts = sh.getRange(r, 2, 1, Math.max(1, sh.getLastColumn() - 1)).getValues()[0].filter((x) => x !== '');
  try { return JSON.parse(Utilities.ungzip(Utilities.newBlob(Utilities.base64Decode(parts.join('')), 'application/x-gzip')).getDataAsString()); } catch (e) { return null; }
}
function saveSnap_(fid, obj) {
  const sh = snapSheet_();
  const data = Utilities.base64Encode(Utilities.gzip(Utilities.newBlob(JSON.stringify(obj))).getBytes());
  const parts = []; for (let i = 0; i < data.length; i += 45000) parts.push(data.slice(i, i + 45000));
  if (parts.length > 200) return; // ใหญ่เกิน (ไม่ควรเกิด) ข้าม
  const r = snapRow_(sh, fid) || sh.getLastRow() + 1;
  const width = Math.max(sh.getLastColumn(), parts.length + 1);
  const row = [fid, ...parts]; while (row.length < width) row.push('');
  sh.getRange(r, 1, 1, width).setValues([row]);
}

const fmt_ = (v) => (v instanceof Date ? Utilities.formatDate(v, 'Asia/Bangkok', v.getHours() || v.getMinutes() ? 'yyyy-MM-dd HH:mm' : 'yyyy-MM-dd') : String(v == null ? '' : v)).trim();
// อ่านทุกชีตของไฟล์ → { ชีต: { h: หัวตาราง, k: คอลัมน์คีย์, r: { คีย์: [ค่า...] } } }
function readFile_(id) {
  const ss = SpreadsheetApp.openById(id), out = {};
  ss.getSheets().forEach((sh) => {
    const name = sh.getName();
    if (SKIP_SHEET.test(name) || sh.getLastRow() < 2 || sh.getLastColumn() < 1) return;
    const vals = sh.getRange(1, 1, Math.min(sh.getLastRow(), 6000), Math.min(sh.getLastColumn(), 60)).getValues();
    const h = vals[0].map((x, i) => fmt_(x) || 'คอลัมน์' + (i + 1));
    const secret = h.map((x) => SECRET_COL.test(x));
    const rows = vals.slice(1).map((r) => r.map((v, i) => (secret[i] ? (v === '' ? '' : '•') : fmt_(v)).slice(0, 300))).filter((r) => r.some((v) => v !== ''));
    // คอลัมน์คีย์: คอลัมน์แรกใน 3 คอลัมน์แรกที่ค่าไม่ซ้ำและไม่ว่าง (เช่น id, รหัส, เลขที่) ไม่มีก็ใช้ลำดับแถว
    let k = -1;
    for (let c = 0; c < Math.min(3, h.length) && k < 0; c++) {
      const col = rows.map((r) => r[c]);
      if (col.every((v) => v !== '') && new Set(col).size === col.length) k = c;
    }
    const r = {};
    rows.forEach((row, i) => { r[k >= 0 ? row[k] : '#' + (i + 2)] = row; });
    out[name] = { h, k, r };
  });
  return out;
}

const FEEDER = /\b[A-Z]{3}\d{2}\b/g, DEVICE = /\b[A-Z]{3}\d{2}[A-Z]{1,3}-?\d+[\w\/-]*/g, PLATE = /(?:^|\s)(\d?[ก-ฮ]{1,2}[\s-]?\d{1,4})(?=\s|$)/g, MOO = /(?:บ้าน|ม\.|หมู่)\s?[ก-๙A-Za-z0-9]+/g;
function entities_(text) {
  const s = new Set();
  (text.match(DEVICE) || []).forEach((x) => s.add(x));
  (text.match(FEEDER) || []).forEach((x) => s.add(x));
  let m; while ((m = PLATE.exec(text))) s.add(m[1].replace(/\s/g, ''));
  (text.match(MOO) || []).slice(0, 3).forEach((x) => s.add(x));
  return [...s].slice(0, 12).join(' ');
}
const brief_ = (h, row, k) => row.map((v, i) => (i === k || !v || v === '•' ? '' : h[i] + ': ' + v)).filter(Boolean).slice(0, 4).join(' · ').slice(0, 220);

function diffFile_(sys, old, cur) {
  const ev = [];
  Object.keys(cur).forEach((name) => {
    const a = old && old[name], b = cur[name];
    if (!a) return; // ชีตใหม่: จำไว้ก่อน
    const label = (row) => (b.k >= 0 ? row[b.k] : row.find((v) => v && v !== '•') || '');
    Object.keys(b.r).forEach((key) => {
      const nr = b.r[key], or = a.r[key];
      const ent = entities_(nr.join(' '));
      const rowJson = JSON.stringify(Object.fromEntries(b.h.map((x, i) => [x, nr[i]]).filter(([, v]) => v !== ''))).slice(0, 2000);
      if (!or) { ev.push([sys, name, label(nr), 'เพิ่ม', 'เพิ่ม ' + name + ' ' + label(nr) + (brief_(b.h, nr, b.k) ? ' — ' + brief_(b.h, nr, b.k) : ''), '', ent, rowJson]); return; }
      const ch = [];
      b.h.forEach((x, i) => { const ov = or[a.h.indexOf(x)] ?? '', nv = nr[i] ?? ''; if (ov !== nv && !(ov === '•' && nv === '•')) ch.push({ c: x, o: ov === '•' ? '(ซ่อน)' : ov, n: nv === '•' ? '(ซ่อน)' : nv }); });
      if (ch.length) ev.push([sys, name, label(nr), 'แก้', 'แก้ ' + name + ' ' + label(nr) + ': ' + ch.slice(0, 3).map((c) => c.c + ' ' + (c.o || '(ว่าง)') + ' → ' + (c.n || '(ว่าง)')).join(' · '), JSON.stringify(ch).slice(0, 2000), ent, rowJson]);
    });
    Object.keys(a.r).forEach((key) => { if (!b.r[key]) { const or = a.r[key]; ev.push([sys, name, b.k >= 0 ? or[a.k] : key, 'ลบ', 'ลบ ' + name + ' ' + (a.k >= 0 ? or[a.k] : key), '', entities_(or.join(' ')), '']); } });
  });
  if (ev.length > MAX_EVENTS_PER_FILE) { // นำเข้า/แก้ทีเดียวเยอะ = สรุปรวบ
    const by = {}; ev.forEach((e) => { const k2 = e[1] + '|' + e[3]; by[k2] = (by[k2] || 0) + 1; });
    return Object.keys(by).map((k2) => { const [sh, t] = k2.split('|'); return [sys, sh, '', t, t + ' ' + sh + ' ' + by[k2] + ' รายการ (แก้ทีละมาก)', '', '', '']; });
  }
  return ev;
}

// ทำงานทุก 1 นาที (ตั้งด้วย setupWatch)
function watchTick() {
  // ประหยัดโควตาเวลาทริกเกอร์ของบัญชี (ฟรีวันละ ~90 นาที ใช้ร่วมทุกโปรเจกต์): กลางวันทุก 5 นาที · 22:00–06:00 ทุก 15 นาที
  const now = new Date(Date.now() + 7 * 3600e3), h = now.getUTCHours();
  // ย้ายทริกเกอร์จากทุก 1 นาทีเป็นทุก 5 นาที (ทำครั้งเดียวอัตโนมัติ)
  const pp = PropertiesService.getScriptProperties();
  if (pp.getProperty('TRIG_V') !== '5') {
    ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === 'watchTick').forEach((t) => ScriptApp.deleteTrigger(t));
    ScriptApp.newTrigger('watchTick').timeBased().everyMinutes(5).create();
    pp.setProperty('TRIG_V', '5');
  }
  if ((h >= 22 || h < 6) && now.getUTCMinutes() % 15 >= 5) return;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return; // รอบก่อนยังไม่เสร็จ → ข้ามรอบนี้
  const t0 = Date.now(), p = PropertiesService.getScriptProperties();
  try {
    const rows = [];
    for (const [sys, id, mode] of WATCH_FILES) {
      if (Date.now() - t0 > 240000) break; // กันเกินเวลา 6 นาทีของ Apps Script
      let upd; try { upd = DriveApp.getFileById(id).getLastUpdated().getTime(); } catch (e) { continue; }
      const last = Number(p.getProperty('UPD_' + id) || 0);
      if (upd === last) continue;
      if (mode === 'touch') { if (last) rows.push([sys, '', '', 'อัปเดต', sys + ': อัปเดตข้อมูลแล้ว', '', '', '']); p.setProperty('UPD_' + id, String(upd)); continue; }
      try {
        const cur = readFile_(id), old = loadSnap_(id);
        if (old) rows.push(...diffFile_(sys, old, cur));
        saveSnap_(id, cur);
        p.setProperty('UPD_' + id, String(upd));
      } catch (e) { console.warn(sys, e); }
    }
    if (rows.length) {
      const sh = evSheet_(), now = new Date();
      let n = Number(p.getProperty('EV_SEQ') || 0);
      const out = rows.map((r) => [++n, now, ...r]);
      sh.getRange(sh.getLastRow() + 1, 1, out.length, EV_HDR.length).setValues(out);
      p.setProperty('EV_SEQ', String(n));
      const extra = sh.getLastRow() - 1 - KEEP_EVENTS;
      if (extra > 200) sh.deleteRows(2, extra);
      CacheService.getScriptCache().remove('ev_tail');
    }
  } finally { lock.releaseLock(); }
}

// ส่งเหตุการณ์ใหม่ให้น้องมีไฟ (หลัง id ที่ระบุ)
function eventsSince_(since, limit) {
  const sh = evSheet_(), n = sh.getLastRow() - 1;
  if (n < 1) return { last: 0, events: [] };
  const take = Math.min(n, 400), vals = sh.getRange(sh.getLastRow() - take + 1, 1, take, EV_HDR.length).getValues();
  const ev = vals.filter((r) => Number(r[0]) > since).slice(-(limit || 100)).map((r) => ({
    id: Number(r[0]), at: r[1] instanceof Date ? r[1].getTime() : r[1], sys: r[2], sheet: r[3], key: String(r[4]), type: r[5], text: r[6],
    ch: r[7] ? JSON.parse(r[7]) : [], ent: String(r[8] || ''), row: r[9] ? JSON.parse(r[9]) : null,
  }));
  return { last: Number(vals[vals.length - 1][0]), events: ev };
}

// ติดตั้งครั้งเดียว: ตั้งเวลาทุก 1 นาที + จำสถานะเริ่มต้นของทุกไฟล์ (ไม่สร้างเหตุการณ์ย้อนหลัง)
function setupWatch() {
  ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === 'watchTick').forEach((t) => ScriptApp.deleteTrigger(t));
  evSheet_(); snapSheet_();
  watchTick();
  ScriptApp.newTrigger('watchTick').timeBased().everyMinutes(5).create();
  return 'ติดตั้งแล้ว: สมุดเหตุการณ์ ' + SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('EVENTS_ID')).getUrl();
}

// ค้นเหตุการณ์ข้ามระบบ (ให้น้องมีไฟตอบคำถาม เช่น "ALA01 สัปดาห์นี้มีอะไรบ้าง")
// q = คำค้น (หลายคำคั่นด้วยช่องว่าง ต้องพบทุกคำ) · sys = ชื่อระบบบางส่วน · days = ย้อนหลังกี่วัน · type = เพิ่ม/แก้/ลบ/อัปเดต
function findEvents_(o) {
  const sh = evSheet_(), n = sh.getLastRow() - 1;
  if (n < 1) return { total: 0, events: [], bySys: {}, byType: {}, ents: {} };
  const days = Math.min(Math.max(Number(o.days) || 7, 1), 120), since = Date.now() - days * 864e5;
  const terms = String(o.q || '').toLowerCase().split(/\s+/).filter(Boolean), sys = String(o.sys || '').toLowerCase(), type = String(o.type || '');
  const take = Math.min(n, KEEP_EVENTS + 200), first = sh.getLastRow() - take + 1;
  const vals = sh.getRange(first, 1, take, 9).getValues();
  const hit = [];
  for (let i = vals.length - 1; i >= 0; i--) {
    const r = vals[i], t = r[1] instanceof Date ? r[1].getTime() : Date.parse(r[1]);
    if (t < since) break;
    if (sys && String(r[2]).toLowerCase().indexOf(sys) < 0) continue;
    if (type && r[5] !== type) continue;
    if (terms.length) { const hay = r.slice(2).join(' ').toLowerCase(); if (!terms.every((w) => hay.indexOf(w) >= 0)) continue; }
    hit.push([first + i, r, t]);
  }
  const bySys = {}, byType = {}, ents = {};
  hit.forEach(([, r]) => { bySys[r[2]] = (bySys[r[2]] || 0) + 1; byType[r[5]] = (byType[r[5]] || 0) + 1; String(r[8] || '').split(' ').filter(Boolean).forEach((e) => { ents[e] = (ents[e] || 0) + 1; }); });
  const top = hit.slice(0, Math.min(Number(o.limit) || 60, 150));
  let rowJ = {};
  if (top.length) { // ข้อมูลแถวเต็ม (เฉพาะรายการที่จะส่ง) อ่านช่วงเดียวถ้าไม่ไกลเกินไป
    const lo = top[top.length - 1][0], hi = top[0][0];
    if (hi - lo < 1500) { const j = sh.getRange(lo, 10, hi - lo + 1, 1).getValues(); top.forEach(([row]) => { rowJ[row] = j[row - lo][0]; }); }
  }
  const events = top.map(([row, r, t]) => ({ id: Number(r[0]), at: t, sys: r[2], sheet: r[3], key: String(r[4]), type: r[5], text: r[6], ch: r[7] ? JSON.parse(r[7]) : [], ent: String(r[8] || ''), row: rowJ[row] ? JSON.parse(rowJ[row]) : null }));
  const topEnts = Object.fromEntries(Object.entries(ents).sort((a, b) => b[1] - a[1]).slice(0, 15));
  return { total: hit.length, days, events, bySys, byType, ents: topEnts };
}
