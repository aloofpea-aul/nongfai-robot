import { faceOf } from './faces.js?v=11191945';
// พจนานุกรมระบบในศูนย์รวมงาน: ไอคอน สี ลิงก์แอป และคำอธิบาย → ใช้แปลง "เหตุการณ์" จากสมุดเหตุการณ์เป็นข้อความที่เข้าใจง่าย
// ชื่อระบบ (key) ต้องตรงกับ WATCH_FILES ใน gas/Watch.gs
export const SYS = {
  'งานเวรแก้ไฟ': { k: 'duty', icon: '⚡', color: '#e24b4a', app: '/duty-roster/', noun: 'ข้อมูลงานเวรแก้ไฟ' },
  'SLD / Patrol': { k: 'patrol', icon: '🛠️', color: '#d9822b', app: '/sld-ala/patrol-index.html', noun: 'ข้อมูล Patrol/อุปกรณ์', appOf: (sh) => (/patrol|finding|ตรวจ|บกพร่อง/i.test(sh) ? '/sld-ala/patrol-index.html' : /survey|สำรวจ/i.test(sh) ? '/sld-ala/transformer-survey/' : '/sld-ala/') },
  'Office Love': { k: 'officelove', icon: '🛡️', color: '#7a4fd0', app: '/office-love/', noun: 'บันทึกเดินตรวจ รปภ.' },
  'ยานพาหนะ': { k: 'vehicles', icon: '🚗', color: '#2a7de1', app: '/vehicle/', noun: 'รายการรถ/การจอง' },
  'งานจัดซื้อ': { k: 'procure', icon: '🛒', color: '#1e8f6e', app: '/procure/', noun: 'งานจัดซื้อ' },
  'ซื้อ/ขายหม้อแปลง': { k: 'tfbuy', icon: '🔌', color: '#b5651d', app: '/tfbuy/', noun: 'งานซื้อ/ขายหม้อแปลง' },
  'ตัดงบทำการ': { k: 'budget', icon: '💰', color: '#c79a00', app: '/budget/', noun: 'รายการขอใช้งบ' },
  'ใบเบิกค่ารักษา': { k: 'medical', icon: '🏥', color: '#d6457a', app: '/medical/', noun: 'ใบเบิกค่ารักษา' },
  'ออกเลขหนังสือ': { k: 'booknum', icon: '📄', color: '#5b6b7f', app: '/booknum/', noun: 'เลขหนังสือ' },
  'CCL งานก่อสร้าง': { k: 'ccl', icon: '🏗️', color: '#8a5a2b', app: '/ccl/', noun: 'งานก่อสร้าง' },
  'สำรวจงานก่อสร้าง': { k: 'survey', icon: '📐', color: '#3d8b9c', app: '/construction/', noun: 'งานสำรวจ/ประมาณการ' },
  'ตัดต้นไม้': { k: 'tree', icon: '🌳', color: '#3c9a3c', app: '/tree-ala/', noun: 'งานตัดต้นไม้' },
  'คลังพัสดุ': { k: 'stock', icon: '📦', color: '#a0662f', app: '/stock/', noun: 'รายการพัสดุ' },
  'แผนงานระดมทีม': { k: 'teamplan', icon: '📅', color: '#4466cc', app: '/teamplan-krabi/', noun: 'แผนงานระดมทีม' },
  'เตือนภัยกรมอุตุ': { k: 'tmd', icon: '⛈️', color: '#3b6fb6', app: '/tmd/', noun: 'ประกาศเตือนภัย' },
  'Safety Talk': { k: 'safety', icon: '🦺', color: '#e07b00', app: '/safety-talk/', noun: 'กิจกรรม Safety Talk' },
  'ลงเวลา/เช็กอิน': { k: 'checkin', icon: '⏰', color: '#1e8f6e', app: '/pea-checkin/dashboard_mobile.html', noun: 'การลงเวลา' },
  'Load01 กฟต.2': { k: 'load01', icon: '📈', color: '#2b8a8a', app: '/load01/', noun: 'ข้อมูลโหลด' },
  'KPI / Report50': { k: 'kpi', icon: '🎯', color: '#8a3ab9', app: '/kpi-pea-region2-2569/', noun: 'ผล KPI' },
  'K04 แผนปฏิบัติการ': { k: 'k04', icon: '🗂️', color: '#4a6a8a', app: '/k04/', noun: 'แผนปฏิบัติการ' },
  'ระเบียบ กฟภ.': { k: 'regs', icon: '⚖️', color: '#6a5a4a', app: '/regulations/', noun: 'ระเบียบ' },
};
export const sysInfo = (name) => SYS[name] || { k: 'other', icon: '🔔', color: '#7a4fd0', app: '', noun: 'ข้อมูล' };
export const appOf = (ev) => { const s = sysInfo(ev.sys); return (s.appOf ? s.appOf(ev.sheet || '') : s.app) || ''; };

// ช่องที่เปลี่ยนเองตลอด (เวลาแก้ไขล่าสุด ฯลฯ) ไม่นับเป็นความเคลื่อนไหว
const NOISE = /updated|modified|lastseen|last_seen|heartbeat|ping|timestamp|^ts$|_at$|เวลาอัปเดต|แก้ไขล่าสุด|อัปเดตล่าสุด|ปรับปรุงล่าสุด|sync|cache/i;
// ช่องที่ไม่ควรขึ้นจอ (พิกัด รหัส LINE รูป ลิงก์)
const PRIV = /lat|lng|lon|accuracy|uid|selfie|photo|pic|url|ลิงก์|พิกัด|รูป/i;
const STATUS = /สถานะ|status|ขั้นตอน|ขั้น|step|stage|state|ผลการ|อนุมัติ/i;
const NAMEISH = /เรื่อง|ชื่อ|รายการ|ภารกิจ|สถานที่|ที่ตั้ง|ทะเบียน|หัวข้อ|ผู้ขอ|ผู้ซื้อ|ผู้ขาย|งาน|title|name|subject|plate|place|item|desc/i;
const idLike = (v) => !v || /^#\d+$/.test(v) || /^[A-Za-z]{0,4}[-_]?\d{9,}$/.test(v) || /^[0-9a-f-]{16,}$/i.test(v);
const ST_TH = { new: 'ใหม่', open: 'เปิด', pending: 'รอดำเนินการ', wait: 'รอ', waiting: 'รอ', acc: 'รับงานแล้ว', accepted: 'รับงานแล้ว', approved: 'อนุมัติแล้ว', approve: 'อนุมัติแล้ว', rejected: 'ไม่อนุมัติ', reject: 'ไม่อนุมัติ', done: 'เสร็จแล้ว', closed: 'ปิดงาน', complete: 'เสร็จแล้ว', completed: 'เสร็จแล้ว', cancel: 'ยกเลิก', cancelled: 'ยกเลิก', canceled: 'ยกเลิก', progress: 'กำลังดำเนินการ', in_progress: 'กำลังดำเนินการ', draft: 'ร่าง', returned: 'คืนแล้ว', inuse: 'ใช้งานอยู่', available: 'ว่าง', booked: 'จองแล้ว' };
const th = (v) => { const s = String(v ?? '').trim(); return ST_TH[s.toLowerCase()] || s || '(ว่าง)'; };
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

export const isNoise = (ev) => ev.type === 'แก้' && (ev.ch || []).length > 0 && ev.ch.every((c) => NOISE.test(c.c));

// ชื่อเรียกของรายการ: ใช้ช่องที่อ่านแล้วเข้าใจ (เรื่อง/ชื่อ/ทะเบียน/สถานที่) แทนรหัสยาวๆ
export function itemName(ev) {
  const row = ev.row || {};
  const cand = Object.entries(row).filter(([k, v]) => NAMEISH.test(k) && !STATUS.test(k) && !idLike(String(v)) && String(v).length > 1 && v !== '•');
  const pick = cand.slice(0, 2).map(([, v]) => clip(v, 160));
  if (pick.length) return pick.join(' · ');
  if (!idLike(ev.key)) return clip(ev.key, 160);
  const any = Object.entries(row).find(([k, v]) => !idLike(String(v)) && String(v).length > 2 && !/วัน|เวลา|date|time/i.test(k) && v !== '•');
  return any ? clip(any[1], 160) : clip(ev.key, 60);
}

// เหตุการณ์ → การ์ดแจ้งเตือน { topic, title, text, sub, say, app, ents, q }
export function describe(ev) {
  if (ev.sys === 'ลงเวลา/เช็กอิน' && ev.type !== 'ลบ') return describeCheckin(ev);
  if (ev.sys === 'ยานพาหนะ' && ev.type !== 'ลบ') { const v = describeVehicle(ev); if (v) return v; }
  const s = sysInfo(ev.sys), name = itemName(ev), sheet = ev.sheet ? 'ชีต ' + ev.sheet : '';
  const ch = (ev.ch || []).filter((c) => !NOISE.test(c.c));
  const st = ch.find((c) => STATUS.test(c.c));
  let title, sub, say;
  if (ev.type === 'อัปเดต') { title = ev.sys + ' · อัปเดตข้อมูลแล้ว'; sub = 'มีการนำเข้า/แก้ข้อมูลชุดใหม่'; say = ev.sys + ' อัปเดตข้อมูลแล้วค่ะ'; }
  else if (!ev.key && /รายการ \(แก้ทีละมาก\)/.test(ev.text || '')) { title = ev.sys + ' · แก้ข้อมูลทีละมาก'; sub = clip(ev.text, 400); say = ev.sys + ' มีการแก้ข้อมูลทีละหลายรายการค่ะ'; }
  else if (ev.type === 'เพิ่ม') { title = ev.sys + ' · ' + s.noun + 'ใหม่'; sub = briefRow(ev) || sheet; say = ev.sys + ' มี' + s.noun + 'ใหม่ ' + name + 'ค่ะ'; }
  else if (ev.type === 'ลบ') { title = ev.sys + ' · ลบรายการ'; sub = sheet; say = ev.sys + ' ลบรายการ ' + name + 'ค่ะ'; }
  else if (st) { title = ev.sys + ' · เปลี่ยนขั้นตอน'; sub = st.c + ': ' + th(st.o) + ' → ' + th(st.n); say = ev.sys + ' ' + name + ' เปลี่ยนเป็น ' + th(st.n) + 'ค่ะ'; }
  else { title = ev.sys + ' · แก้ไขข้อมูล'; sub = ch.slice(0, 6).map((c) => c.c + ': ' + clip(c.o || '(ว่าง)', 120) + ' → ' + clip(c.n || '(ว่าง)', 120)).join('\n') + (ch.length > 6 ? '\nและอีก ' + (ch.length - 6) + ' ช่อง' : ''); say = ev.sys + ' แก้ไข ' + name + (ch[0] ? ' ช่อง' + ch[0].c : '') + 'ค่ะ'; }
  const ents = String(ev.ent || '').split(' ').filter(Boolean).slice(0, 4);
  say = say.replace(/\s*\/\s*/g, ' ').replace(/\s·\s/g, ' ');
  return { topic: s.k, icon: s.icon, color: s.color, title, text: name, sub, say, app: appOf(ev), ents, sys: ev.sys, evId: ev.id, at: ev.at,
    q: name && !idLike(name) ? ev.sys + ' ' + name + ' มีความเคลื่อนไหวอะไรบ้าง' : ev.sys + ' ล่าสุดมีความเคลื่อนไหวอะไรบ้าง' };
}
function briefRow(ev) {
  const row = ev.row || {}, nm = itemName(ev);
  return Object.entries(row).filter(([k, v]) => v && v !== '•' && !idLike(String(v)) && !NOISE.test(k) && !PRIV.test(k) && String(v) !== nm && !nm.includes(String(v))).slice(0, 6).map(([k, v]) => k + ': ' + clip(v, 120)).join('\n');
}

// ลงเวลาทำงาน: "สมชาย ลงเวลาเข้างาน 07:52 น." แทนข้อความทั่วไป
function describeCheckin(ev) {
  const s = sysInfo(ev.sys), row = ev.row || {}, ch = ev.ch || [];
  const get = (re) => { const e = Object.entries(row).find(([k]) => re.test(k)); return e ? String(e[1] || '') : ''; };
  const name = get(/^name$|ชื่อ/i) || itemName(ev);
  const outC = ch.find((c) => /out|ออก/i.test(c.c) && c.n), inV = get(/check.?in|เข้า/i), outV = get(/check.?out|ออก/i);
  const isOut = !!outC || (ev.type === 'แก้' && outV);
  const time = (isOut ? (outC && outC.n) || outV : inV).match(/\d{1,2}[:.]\d{2}/);
  const area = get(/area|พื้นที่/i);
  const verb = isOut ? 'ลงเวลาออกงาน' : 'ลงเวลาเข้างาน';
  const raw = Object.entries(row).find(([k, v]) => /selfie|photo|pic|รูป/i.test(k) && /^https?:/.test(String(v)));
  const img = faceOf(name) || (raw ? driveImg(String(raw[1])) : '');
  return { img, topic: s.k, icon: s.icon, color: s.color, title: 'ลงเวลา · ' + (isOut ? 'ออกงาน' : 'เข้างาน'), text: name, sub: [time ? time[0] + ' น.' : '', area].filter(Boolean).join(' · '),
    say: name + ' ' + verb + (time ? ' ' + time[0].split(/[:.]/).map(Number).join(' นาฬิกา ') + ' นาที' : '') + 'ค่ะ', app: s.app, ents: [], sys: ev.sys, evId: ev.id, at: ev.at, q: 'วันนี้ใครลงเวลาแล้ว ใครยังไม่ลงเวลาบ้าง' };
}

// ยานพาหนะ: บอกว่าใครใช้รถคันไหน ไปทำอะไร (ชีต รายการใช้รถ / Logใช้งานรถ / การจอง / การซ่อมบำรุง / ตรวจรถก่อนใช้)
function describeVehicle(ev) {
  const s = sysInfo(ev.sys), row = ev.row || {}, ch = ev.ch || [], sh = String(ev.sheet || '');
  const get = (re) => { const e = Object.entries(row).find(([k, v]) => re.test(k) && v && v !== '•'); return e ? clip(e[1], 160) : ''; };
  const was = (re) => { const c = ch.find((x) => re.test(x.c)); return c ? { o: clip(c.o, 160), n: clip(c.n, 160) } : null; };
  const plate = get(/^(plate|carplate|ทะเบียน)$/i) || get(/^(action|รถ)$/i);
  const mission = get(/^(mission|detail|ภารกิจ)$/i);
  const user = get(/^(user|ผู้ใช้|ผู้จอง)$/i), by = get(/^(by|ผู้บันทึก|ผู้ตรวจ)$/i), retBy = get(/^(returnby|ผู้คืน)$/i);
  const mile = get(/^(endmile|เลขไมล์กลับ)$/i) || get(/^(mile|เลขไมล์)$/i);
  const card = (kind, who, title, sub, say) => ({ topic: s.k, icon: s.icon, color: s.color, title: 'ยานพาหนะ · ' + title, text: [who || 'ไม่ระบุชื่อ', plate].filter(Boolean).join(' · '), sub: sub || '', say,
    app: s.app, ents: String(ev.ent || '').split(' ').filter(Boolean).slice(0, 4), sys: ev.sys, evId: ev.id, at: ev.at, vk: plate, vs: kind, q: (who ? who + ' ' : '') + (plate ? 'รถ ' + plate + ' ' : '') + 'ใช้รถล่าสุดเมื่อไหร่ ไปไหนบ้าง' });
  const P = plate ? 'รถ ' + plate + ' ' : 'รถ', who = (n) => (n ? 'พี่' + String(n).replace(/^(นาย|นางสาว|นาง|น\.ส\.)\s*/, '').split(' ')[0] : 'มีคน');
  if (/log|ใช้งานรถ/i.test(sh)) {
    const ret = was(/^(returndate|วันเวลาคืน|returnby|ผู้คืน|endmile|เลขไมล์กลับ)$/i) || (was(/^(status|สถานะ)$/i) && /return|คืน|ว่าง|avail/i.test(was(/^(status|สถานะ)$/i).n));
    if (ev.type === 'แก้' && ret) { const n = retBy || user; return card('log', n, 'คืนรถ', [mission && 'ภารกิจ ' + mission, mile && 'ไมล์ ' + mile].filter(Boolean).join(' · '), who(n) + ' คืน' + P + 'แล้วค่ะ'); }
    if (ev.type === 'เพิ่ม') return card('log', user, 'เบิกใช้รถ', mission ? 'ภารกิจ ' + mission : '', who(user) + ' เบิก' + P + (mission ? ' ไป' + mission : '') + 'ค่ะ');
  }
  if (/การจอง|book/i.test(sh)) {
    const when = [get(/^(startdate|เริ่ม)$/i), get(/^(enddate|สิ้นสุด)$/i)].filter(Boolean).join(' – ');
    const st = was(/^(status|สถานะ)$/i);
    if (ev.type === 'เพิ่ม') return card('book', user, 'จองรถ', [when, mission].filter(Boolean).join(' · '), who(user) + ' จอง' + P + (mission ? ' ไป' + mission : '') + 'ค่ะ');
    if (st) { const t = th(st.n); return card('book', user, 'การจอง' + t, [when, mission].filter(Boolean).join(' · '), 'การจอง' + P + 'ของ' + who(user) + ' ' + t + 'ค่ะ'); }
  }
  if (/ซ่อม|maint/i.test(sh) && ev.type === 'เพิ่ม') { const what = get(/^(type|รายการ)$/i), cost = get(/^(cost|ค่าใช้จ่าย)$/i); return card('maint', by, 'บันทึกซ่อมบำรุง', [what, cost && cost + ' บาท'].filter(Boolean).join(' · '), who(by) + ' บันทึกซ่อม' + P + (what ? ' ' + what : '') + 'ค่ะ'); }
  if (/ตรวจรถ|check/i.test(sh) && ev.type === 'เพิ่ม') { const fails = get(/^(fails|ข้อบกพร่อง)$/i); return card('check', by, 'ตรวจรถก่อนใช้', fails && fails !== '0' && fails !== '[]' ? 'พบข้อบกพร่อง: ' + fails : 'ผ่านทุกข้อ', who(by) + ' ตรวจ' + P + 'ก่อนใช้' + (fails && fails !== '0' && fails !== '[]' ? ' พบข้อบกพร่องค่ะ' : ' เรียบร้อยค่ะ')); }
  if (/รายการใช้รถ|cars?$/i.test(sh)) {
    const st = was(/^(status|สถานะ)$/i), u = was(/^(user|ผู้ใช้)$/i);
    if (st || u) {
      const busy = /inuse|ใช้งาน|busy/i.test((st && st.n) || '') || (u && u.n && !(st && /avail|ว่าง/i.test(st.n)));
      if (busy) { const n = (u && u.n) || user; return card('car', n, 'มีคนใช้รถ', mission, who(n) + ' กำลังใช้' + P + 'ค่ะ'); }
      const n = (u && u.o) || user; return card('car', n, 'รถว่างแล้ว', n ? 'คืนโดย ' + n : '', P + 'ว่างแล้วค่ะ' + (n ? ' คืนโดย' + who(n) : ''));
    }
  }
  return null;
}

// ลิงก์รูปใน Google Drive → ลิงก์ภาพย่อที่เปิดใน <img> ได้
export function driveImg(u) {
  const m = String(u || '').match(/(?:\/d\/|[?&]id=)([\w-]{20,})/);
  return m && /google/.test(u) ? 'https://drive.google.com/thumbnail?id=' + m[1] + '&sz=w240' : u;
}
