// น้องมีไฟ — แอปหลัก: ฟังเสียงไทย → ถาม Gemini (สตรีม) → พูดตอบทีละประโยค + แสดงบนจอ
import { Mascot } from './mascot.js?v=11191700';
import { WavRecorder } from './recorder.js?v=11191700';
import { TOOL_DECLS, runTool, bkkNow, loadDetail, glossary, hooks } from './tools.js?v=11191700';
import { startPresence, stopPresence, presenceOn, someoneHere, setPresenceRate, status as camStatus } from './presence.js?v=11191700';
import { startWatch, TOPICS, topicOn, alertLog, clearAlertLog } from './watch.js?v=11191700';
import { wxCard, tmdCard } from './wxlevel.js?v=11191700';
import { loadFaces } from './faces.js?v=11191700';
import { SYS } from './systems.js?v=11191700';
import { initCheckin, openCheckin } from './checkin.js?v=11191700';
import { initLearn, learnStats, applyCorrections, glossaryExtra, addCorrection, findVerified, examplesText, sendFeedback, STATIC_TOOLS } from './learn.js?v=11191700';

const $ = (id) => document.getElementById(id);
export const VERSION = '11191700';
// อัปเดตตัวเอง: ถ้าบนเว็บมีเวอร์ชันใหม่กว่า ให้โหลดหน้าใหม่ทันที (กันไอโฟนจำไฟล์เก่า)
fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then((r) => r.json()).then((j) => {
  if (j.v && j.v !== VERSION && !sessionStorage.getItem('nf.reload.' + j.v)) {
    sessionStorage.setItem('nf.reload.' + j.v, '1');
    location.replace(location.pathname + '?r=' + j.v);
  }
}).catch(() => {});

const DEFAULTS = { apiKey: '', model: 'gemini-3.5-flash-lite', voice: '', rate: 1.0, autoListen: true, hubUser: '', hubPass: '', staffPin: '', mode: 'ops', stt: 'gemini', budgetUser: '', budgetPass: '', officeCode: '', cclUser: '', cclPass: '', olUser: '', olPass: '', learnUrl: '', learnSecret: '', confirm: true, alertOn: true, alertVoice: true, quietOn: true, quietFrom: '22:00', quietTo: '06:00', alertTopics: {}, wakeFace: Math.min(screen.width, screen.height) >= 700, wakeSleep: true, idlePlay: true, powerSave: true };
const cfg = { ...DEFAULTS, ...JSON.parse(localStorage.getItem('nongfai.cfg') || '{}') };
const saveCfg = () => localStorage.setItem('nongfai.cfg', JSON.stringify(cfg));
// เปิดแจ้งเตือนลงเวลาทำงานให้ (เดิมปิดไว้) ครั้งเดียว — ถ้าปิดเองทีหลังจะไม่เปิดซ้ำ
if (!cfg.ckOn1) { cfg.alertTopics = { ...(cfg.alertTopics || {}), checkin: true }; cfg.ckOn1 = true; saveCfg(); }
// ชื่อ/รหัสศูนย์รวมงาน: ถ้าเครื่องนี้เคยล็อกอินศูนย์รวมงานไว้ ใช้ชุดนั้นเลย (โดเมนเดียวกัน)
if (!cfg.hubUser) cfg.hubUser = localStorage.getItem('pea_aoluek_username') || '';
if (!cfg.hubPass) cfg.hubPass = localStorage.getItem('pea_aoluek_password') || '';
// 2.5 Flash ฟรีแค่ 20 ครั้ง/วัน · flash-latest ค้าง → ย้ายไปรุ่น Flash-Lite ที่เร็วและโควตาเยอะกว่า
// มือถือ: ปิดการฟังต่ออัตโนมัติเป็นค่าเริ่มต้น (กันไมค์อัดเสียงรอบข้างตอนไม่มีคนพูด) — ตั้งครั้งเดียว เปิดเองได้ในตั้งค่า
if (!cfg.alPhone && matchMedia('(max-width:820px)').matches) { cfg.autoListen = false; cfg.alPhone = 1; saveCfg(); }
if (['gemini-flash-latest', 'gemini-2.5-flash'].includes(cfg.model)) { cfg.model = DEFAULTS.model; saveCfg(); }

const SYSTEM_BASE = `คุณคือ "น้องมีไฟ" (ชื่อภาษาอังกฤษ MeeFai · ถ้ามีคนเรียก "น้องไฟ" ก็คือคุณ) หุ่นยนต์ผู้ช่วยบริการลูกค้าของการไฟฟ้าส่วนภูมิภาคสาขาอ่าวลึก (กฟส.อ่าวลึก) จังหวัดกระบี่
บุคลิก: ผู้หญิง สุภาพ อบอุ่น เป็นกันเอง ลงท้ายด้วย ค่ะ/คะ
กฎการตอบ:
1. คำตอบจะถูกอ่านออกเสียง ตอบสั้น 1-3 ประโยค แต่ละประโยคขึ้นบรรทัดใหม่ ห้ามใช้ markdown อีโมจิ ดอกจัน หรือเลขข้อในส่วนที่พูด
2. ถ้ามีรายการที่ควรแสดงบนจอ เช่น เอกสาร ขั้นตอน ช่องทาง ให้ต่อท้ายด้วยบรรทัด ###CARD ตามด้วยบรรทัดหัวข้อ แล้วแต่ละรายการขึ้นต้นด้วย "- " ไม่เกิน 6 รายการ ลิงก์ให้ใส่ในการ์ดเท่านั้น ห้ามพูดหรือพิมพ์ลิงก์ในส่วนที่พูด
3. ห้ามเดาตัวเลข ค่าธรรมเนียม อัตราค่าไฟ วันเวลานัดหมาย หรือข้อมูลเฉพาะของลูกค้ารายใด ถ้าไม่แน่ใจให้แนะนำติดต่อเจ้าหน้าที่ที่เคาน์เตอร์บริการ หรือโทร PEA Call Center 1129
4. มีเครื่องมือดึงข้อมูลจริงจากศูนย์รวมงาน กฟส.อ่าวลึก หลายระบบ (อากาศ เตือนภัย เวรแก้ไฟ ไฟดับ รับแจ้งไฟดับ เบอร์โทรทีม SLD Patrol ตัดต้นไม้ ระเบียบ พัสดุ รถ จัดซื้อ ซื้อหม้อแปลง safety talk K04 KPI เช็กอิน SAIFI/SAIDI ประกาศงดจ่ายไฟ Load01 แบบมาตรฐาน (ดูภาพ 2D/3D ใช้ standard_drawing · รายการวัสดุใช้ drawings_bom) ตัดงบ ออกเลขหนังสือ CCL Office Love ราคามาตรฐานพัสดุ) เมื่อคำถามเกี่ยวข้องให้เรียกเครื่องมือก่อนตอบเสมอ แล้วตอบจากผลที่ได้เท่านั้น ห้ามแต่งข้อมูลเอง
5. ถ้าเครื่องมือตอบว่า need_verify ให้บอกสั้นๆ ว่าเป็นข้อมูลภายใน ขอให้เจ้าหน้าที่ใส่รหัสยืนยันตัวตนบนจอก่อน
6. ตอบเรื่องวัน เวลา ให้เทียบกับวันเวลาปัจจุบันที่ให้ไว้ ในส่วนที่พูดให้อ่านตัวเลขเป็นคำพูดได้ แต่ในการ์ด ###CARD ให้ใช้ตัวเลขเสมอ เช่น 2,048,517 บาท หรือ 16:30 น.
7. ถ้าเป็นเรื่องที่ไม่เกี่ยวกับการไฟฟ้า ตอบสั้นๆ อย่างสุภาพ แล้วชวนกลับมาที่เรื่องบริการ`;

const OPS_NOTE = `
โหมดใช้งานตอนนี้: ใช้ภายในแผนกปฏิบัติการระบบไฟฟ้า (ผปร.) กฟส.อ่าวลึก ผู้ที่คุยด้วยคือพนักงานและคนงานในแผนก ไม่ใช่ลูกค้า
ให้พูดแบบเพื่อนร่วมงานที่สุภาพ เรียกว่า "พี่" ได้ ตอบตรงประเด็นงาน ใช้เครื่องมือข้อมูลภายในได้ทุกตัวโดยไม่ต้องยืนยันตัวตน
ตอบตัวเลขและชื่อให้ครบถ้วน ถ้ารายการยาวให้สรุปที่สำคัญเป็นคำพูด แล้วใส่รายละเอียดในการ์ด
คำถามว่า "มีอะไรเปลี่ยน/เคลื่อนไหว/อัปเดตบ้าง" "วันนี้ทั้งสาขามีอะไรเกิดขึ้น" หรือถามเรื่องเดียวข้ามหลายระบบ (เช่น ฟีดเดอร์ ALA01 ทะเบียนรถ หมู่บ้าน) ให้ใช้ activity_log ก่อน
แล้วสรุปแบบเข้าใจง่าย: รวมกี่เรื่อง ระบบไหนบ้าง เรื่องสำคัญ (รายการใหม่ เปลี่ยนขั้นตอน) และบอกความเชื่อมโยงข้ามระบบถ้ามี ถ้าต้องการข้อมูลปัจจุบันของระบบนั้นเพิ่ม ให้เรียกเครื่องมือของระบบนั้นต่อได้`;
function systemText() {
  const n = bkkNow(), wd = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'][n.getUTCDay()];
  return SYSTEM_BASE + (OPS() ? OPS_NOTE : '') + `\nวันเวลาปัจจุบัน: วัน${wd}ที่ ${n.toISOString().slice(0, 16).replace('T', ' ')} (เวลาไทย)` +
    (staffOn() ? '\nตอนนี้เจ้าหน้าที่ยืนยันตัวตนแล้ว ใช้เครื่องมือข้อมูลภายในได้' : '') + examplesText();
}

// ---------- โหมดเจ้าหน้าที่ (ยืนยันด้วย PIN) ----------
let staffUntil = 0, wantVerify = false, lastAsk = null;
const OPS = () => cfg.mode !== 'customer';   // ช่วงทดสอบใช้ในแผนก ผปร. = ถือว่าเป็นเจ้าหน้าที่ทุกคน
const staffOn = () => OPS() || Date.now() < staffUntil;
const toolCtx = { staff: staffOn, show: (d) => showResults(d), needVerify: () => { wantVerify = true; }, creds: () => ({ user: cfg.hubUser, pass: cfg.hubPass, budgetUser: cfg.budgetUser, budgetPass: cfg.budgetPass, officeCode: cfg.officeCode, cclUser: cfg.cclUser, cclPass: cfg.cclPass, olUser: cfg.olUser, olPass: cfg.olPass, learnUrl: cfg.learnUrl, learnSecret: cfg.learnSecret }) };

// ---------- ผลค้นหา: สรุปตัวเลข + รายการพร้อมรูป + หน้ารายละเอียด ----------
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
function clearResults() { document.getElementById('results').replaceChildren(); document.body.classList.remove('has-results'); }
function showResults(d) {
  if (!d || (!(d.items || []).length && !(d.stats || []).length)) return;
  pointAtAnswer();
  const box = el('section', 'rs');
  const head = el('div', 'rs-head'); head.append(el('span', null, 'ข้อมูลจาก ' + (d.source || '')));
  if (d.app) { const a = el('a', null, 'เปิดแอป'); a.href = d.app; a.onclick = (e) => { if (openApp(d.app, d.source)) e.preventDefault(); }; head.append(a); }
  box.append(head);
  if (d.wx) box.append(wxCard(d.wx));
  if (d.tmd) box.append(tmdCard(d.tmd, (p, t) => openApp(p, t)));
  if ((d.stats || []).length && !d.wx) { const g = el('div', 'rs-stats'); d.stats.forEach((s) => { const c = el('div', 'st' + (s.t ? ' ' + s.t : '')); c.append(el('b', null, s.v == null ? '-' : String(s.v)), el('span', null, s.l)); g.append(c); }); box.append(g); }
  const items = d.items || [], list = el('div', 'rs');
  const renderItems = (n) => { list.replaceChildren(...items.slice(0, n).map((it) => itemRow(it, d))); };
  if ((d.chips || []).length) { const cw = el('div', 'rs-chips'); cw.append(el('span', null, 'เกี่ยวข้อง:')); d.chips.forEach((c) => { const b = el('button', null, c.t); b.type = 'button'; b.onclick = () => { stopSpeaking(); tapCue('ได้เลยค่ะ'); ask(c.q, null, true); }; cw.append(b); }); box.append(cw); }
  renderItems(8); box.append(list);
  if (items.length > 8) { const more = el('button', 'rs-more', 'ดูทั้งหมด ' + items.length + ' รายการ'); more.type = 'button'; more.onclick = () => { renderItems(items.length); more.remove(); }; box.append(more); }
  const r = document.getElementById('results'); r.append(box); document.body.classList.add('has-results');
}
function itemRow(it, d) {
  const b = el('button', 'ri'); b.type = 'button';
  if (it.thumb) { const im = el('img', 'th' + (it.wide ? ' wide' : '')); im.src = it.thumb; im.alt = ''; im.loading = 'lazy'; im.onerror = () => im.replaceWith(thumbIcon(it)); b.append(im); } else b.append(thumbIcon(it));
  const tx = el('div', 'tx'); tx.append(el('div', 't1', it.title || '-')); if (it.sub) tx.append(el('div', 't2', it.sub)); b.append(tx);
  if (it.badge) b.append(el('span', 'bd' + (it.tone || toneGuess(it.badge) ? ' ' + (it.tone || toneGuess(it.badge)) : ''), String(it.badge)));
  b.onclick = () => (it.dwg ? openDwg(it.dwg) : openDetail(it, d));
  return b;
}
function thumbIcon(it) { const s = el('span', 'th', it.lat ? '⌖' : it.link ? '▤' : '•'); s.setAttribute('aria-hidden', 'true'); return s; }
function toneGuess(t) { t = String(t); return /ร้ายแรง|ระดับ 3|ใหม่|ยังไม่|ใช้งานอยู่|นอกพื้นที่/.test(t) ? 'red' : /ระดับ 2|รับงาน|กำลัง|รอ|กลาง/.test(t) ? 'amber' : /เสร็จ|ว่าง|ในพื้นที่|ปกติ/.test(t) ? 'green' : ''; }
async function openDetail(it, d) {
  $('dtTitle').textContent = it.title || '';
  $('dtBadge').replaceChildren(...(it.badge ? [el('span', 'bd' + ((it.tone || toneGuess(it.badge)) ? ' ' + (it.tone || toneGuess(it.badge)) : ''), String(it.badge))] : []));
  $('dtText').textContent = [it.sub, it.text].filter(Boolean).join('\n\n');
  const setImgs = (arr) => $('dtImgs').replaceChildren(...(arr || []).map((u) => { const im = el('img'); im.src = u; im.alt = it.title || ''; im.onerror = () => im.remove(); im.onclick = () => $('dtImgs').classList.toggle('big'); return im; }));
  $('dtImgs').classList.remove('big');
  // ค่าในรายละเอียด: เบอร์โทร → แตะโทรได้ · ลิงก์ → แตะเปิดได้ (ใช้งานต่อได้เลยไม่ต้องเข้าแอป)
  const val = (v) => {
    const t = String(v ?? '');
    if (/^(0\d{1,2}[-\s]?\d{3}[-\s]?\d{3,4})(\s*,\s*0\d{1,2}[-\s]?\d{3}[-\s]?\d{3,4})*$/.test(t.trim())) { const sp = el('span'); t.split(/\s*,\s*/).forEach((ph, i) => { if (i) sp.append(', '); const a = el('a', 'tel', ph); a.href = 'tel:' + ph.replace(/[^\d+]/g, ''); sp.append(a); }); return sp; }
    if (/^https?:\/\/\S+$/.test(t.trim())) { const a = el('a', 'tel', 'เปิดลิงก์'); a.href = t.trim(); a.target = '_blank'; return a; }
    return el('span', null, t);
  };
  const setFields = (f) => $('dtFields').replaceChildren(...(f || []).map(([k, v]) => { const r = el('div'); r.append(el('span', null, k), val(v)); return r; }));
  setImgs(it.images); setFields(it.fields);
  const lat = Number(it.lat), lon = Number(it.lon);
  $('dtMap').hidden = !(lat && lon); if (lat && lon) $('dtMap').href = 'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lon;
  const app = it.link || it.app || d.app; $('dtOpen').hidden = !app; $('dtOpen').onclick = (e) => { if (openApp($('dtOpen').getAttribute('href'), it.title)) { e.preventDefault(); $('detailDlg').close(); } }; if (app) { $('dtOpen').href = app; $('dtOpen').textContent = it.link && !/^\/[\w-]+\/(\?|$)/.test(it.link) ? 'เปิดเอกสาร' : 'เปิดในแอป'; }
  $('detailDlg').showModal();
  if (it.detail) {
    $('dtLoading').hidden = false;
    try {
      const x = await loadDetail(it.detail, toolCtx.creds());
      if (x) {
        if (x.images && x.images.length) setImgs(x.images);
        if (x.fields && x.fields.length) setFields(x.fields);
        if (x.pdf) { $('dtOpen').hidden = false; $('dtOpen').href = x.pdf; $('dtOpen').textContent = 'เปิดหนังสือประกาศ (PDF)'; }
      }
    }
    catch (e) { toast('โหลดรายละเอียดไม่สำเร็จ: ' + String(e.message || e).slice(0, 80)); }
    $('dtLoading').hidden = true;
  }
}
document.getElementById('dtBack').onclick = () => $('detailDlg').close();

// ---------- ดูแบบมาตรฐาน 2D / 3D (เปิดหน้าแบบจากคลังในศูนย์รวมงาน) ----------
let dwgNow = null;
function openDwg(g) {
  dwgNow = g;
  $('dwgTitle').textContent = g.title || 'แบบมาตรฐาน';
  if (!g.page) { if (g.pdf) window.open(g.pdf, '_blank'); return; }
  // หน้าแบบอยู่หลังล็อกอินศูนย์รวมงาน: ใช้ชื่อ/รหัสที่ตั้งไว้ในน้องมีไฟ (โดเมนเดียวกัน เก็บในเครื่องนี้)
  try {
    if (cfg.hubUser && cfg.hubPass && !localStorage.getItem('pea_aoluek_password')) {
      localStorage.setItem('pea_aoluek_username', cfg.hubUser); localStorage.setItem('pea_aoluek_password', cfg.hubPass);
    }
  } catch {}
  $('dwgDlg').querySelectorAll('.dwg-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.go === 'elev'));
  $('dwgFrame').src = g.page;
  $('dwgDlg').showModal();
}
// ---------- เปิดแอปในศูนย์รวมงานภายในน้องมีไฟ (ไม่ต้องออกไปเบราว์เซอร์) ----------
// แอปอยู่โดเมนเดียวกัน (aloofpea-aul.github.io) → ใช้ชื่อ/รหัสที่ตั้งไว้ล็อกอินให้อัตโนมัติ
const HUB_PATH = /^\/(?!nongfai-robot\/)[\w-]+\/[^\s]*$/;
function openApp(path, title) {
  if (!path || !HUB_PATH.test(path) || /\.pdf($|\?)/i.test(path)) return false;
  try {
    if (cfg.hubUser && cfg.hubPass && !localStorage.getItem('pea_aoluek_password')) {
      localStorage.setItem('pea_aoluek_username', cfg.hubUser); localStorage.setItem('pea_aoluek_password', cfg.hubPass);
    }
  } catch {}
  const url = path + (path.includes('?') ? '&' : '?') + 'from=nongfai';
  $('appTitle').textContent = title || 'แอปในศูนย์รวมงาน';
  $('appLoading').hidden = false;
  $('appFrame').onload = () => { $('appLoading').hidden = true; };
  $('appFrame').src = url;
  if (!$('appDlg').open) $('appDlg').showModal();
  stopSpeaking();
  return true;
}
$('appBack').onclick = () => { $('appDlg').close(); $('appFrame').src = 'about:blank'; };
$('appReload').onclick = () => { try { $('appFrame').contentWindow.location.reload(); } catch { $('appFrame').src = $('appFrame').src; } };
$('dwgBack').onclick = () => { $('dwgDlg').close(); $('dwgFrame').src = 'about:blank'; };
$('dwgDlg').querySelectorAll('.dwg-tabs button').forEach((b) => (b.onclick = () => {
  const go = b.dataset.go;
  if (go === 'pdf') { if (dwgNow && dwgNow.pdf) window.open(dwgNow.pdf, '_blank'); else toast('แบบนี้ไม่มี PDF ค่ะ'); return; }
  $('dwgDlg').querySelectorAll('.dwg-tabs button').forEach((x) => x.classList.toggle('on', x === b));
  try {
    const doc = $('dwgFrame').contentDocument;
    const t = go === 'tb' ? (doc.getElementById('tb') || [...doc.querySelectorAll('h2')].find((h) => /วัสดุ|รายการ/.test(h.textContent))) : doc.getElementById(go);
    if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); else toast('แบบนี้ไม่มีส่วนนี้ค่ะ');
  } catch { toast('ยังโหลดแบบไม่เสร็จค่ะ'); }
}));

// ---------- มาสคอต ----------
const mascot = new Mascot($('stage'));
window.nfMascot = mascot; // ไว้ทดสอบท่าเล่นจากคอนโซล
// ชี้ไปที่คำตอบ: จอกว้างการ์ดอยู่ทางขวา · มือถือการ์ดอยู่ด้านล่าง
function pointAtAnswer() { mascot.pointSide = window.innerWidth > 820 ? 'right' : 'down'; mascot.gesture('point'); }

// ---------- UI ----------
function setMode(m) { document.body.className = 'mode-' + m + (OPS() ? ' ops' : ''); }
function setStatus(text, cls = '') { const s = $('status'); s.textContent = text; s.className = 'status ' + cls; $('barStatus').textContent = text; $('stripStatus').textContent = text; }
function toast(msg, ms = 3500) { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => (t.hidden = true), ms); }
function showCard(title, items) {
  if (!items.length) { $('card').hidden = true; return; }
  pointAtAnswer();
  $('cardTitle').textContent = title || '';
  $('cardList').replaceChildren(...items.map((x) => {
    const li = document.createElement('li'), m = x.match(/https?:\/\/\S+/);
    if (!m) { li.textContent = x; return li; }
    const label = x.replace(m[0], '').replace(/[:：\-–]\s*$/, '').trim();
    if (label) li.append(label + ' ');
    const a = Object.assign(document.createElement('a'), { href: m[0], target: '_blank', rel: 'noopener', textContent: 'เปิดเอกสาร' });
    li.append(a); return li;
  }));
  $('card').hidden = false;
}
function goHome() {
  stopAll();
  chat.length = 0;
  setMode('home');
  $('userSaid').hidden = true;
  $('card').hidden = true;
  hideFeedback(); cancelConfirm();
  clearResults();
  if (OPS()) {
    $('bubbleTitle').innerHTML = 'สวัสดีค่ะ แผนกปฏิบัติการระบบไฟฟ้า<br>กฟส.อ่าวลึก';
    $('bubbleText').textContent = 'ถามเรื่องเวรแก้ไฟ ไฟดับ อากาศ พัสดุ รถ หรือระเบียบ กฟภ. ได้เลยค่ะ';
  } else {
    $('bubbleTitle').innerHTML = 'สวัสดีค่ะ ยินดีต้อนรับสู่<br>การไฟฟ้าส่วนภูมิภาคสาขาอ่าวลึก';
    $('bubbleText').textContent = 'น้องมีไฟช่วยอะไรได้บ้างคะ พูดได้เลย หรือแตะเมนูด้านล่าง';
  }
  mascot.setMood('normal');
  setStatus('แตะปุ่มไมค์แล้วพูดได้เลยค่ะ');
}

setInterval(() => { $('clock').textContent = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.'; }, 1000);
if (navigator.getBattery) navigator.getBattery().then((b) => {
  const upd = () => { const el = $('battery'); el.hidden = false; el.textContent = 'แบต ' + Math.round(b.level * 100) + '%'; el.classList.toggle('low', b.level <= 0.2 && !b.charging); };
  b.addEventListener('levelchange', upd); b.addEventListener('chargingchange', upd); upd();
});

// กลับหน้าแรกเองเมื่อไม่มีคนคุย 60 วินาที (ลูกค้าคนใหม่จะเริ่มบทสนทนาใหม่)
let idleTimer;
function bumpIdle() { clearTimeout(idleTimer); idleTimer = setTimeout(() => { if (!busy()) goHome(); }, 60000); }

// ---------- เสียงพูด (TTS) ----------
let voices = [];
function loadVoices() {
  voices = speechSynthesis.getVoices().filter((v) => v.lang && v.lang.toLowerCase().startsWith('th'));
  const sel = $('setVoice');
  sel.replaceChildren(...(voices.length ? voices : [{ name: '', lang: '' }]).map((v) =>
    Object.assign(document.createElement('option'), { value: v.name, textContent: v.name ? `${v.name} (${v.lang})` : 'ไม่พบเสียงภาษาไทย – ติดตั้ง Google TTS ภาษาไทย' })));
  sel.value = cfg.voice;
}
if ('speechSynthesis' in window) {
  loadVoices(); speechSynthesis.onvoiceschanged = loadVoices;
  // iPhone/iPad โหลดรายชื่อเสียงช้าและบางทีไม่แจ้ง ให้ลองซ้ำ
  let tries = 0; const t = setInterval(() => { loadVoices(); if (voices.length || ++tries > 20) clearInterval(t); }, 500);
}

const speakQueue = [];
let speakingNow = false, onQueueEmpty = null;
function speak(text) {
  text = text.replace(/[*#_`>]/g, '').trim();
  if (!text || cfg.muted) return; // ปิดเสียงอยู่: แสดงบนจออย่างเดียว
  speakQueue.push(text);
  if (!speakingNow) speakNext();
}
function speakNext() {
  const text = speakQueue.shift();
  if (!text) {
    speakingNow = false; mascot.speaking = false;
    const f = onQueueEmpty; onQueueEmpty = null; if (f) f();
    return;
  }
  speakingNow = true;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'th-TH';
  const v = voices.find((x) => x.name === cfg.voice) || voices[0];
  if (v) u.voice = v;
  u.rate = cfg.rate;
  let started = false;
  u.onstart = () => { started = true; mascot.speaking = true; };
  u.onboundary = () => mascot.pulse();
  u.onend = u.onerror = () => { mascot.speaking = false; speakNext(); };
  speechSynthesis.resume?.();
  speechSynthesis.speak(u);
}

let curSrc = null;
function stopSpeaking() { speakQueue.length = 0; onQueueEmpty = null; if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel(); // iOS: cancel แล้วพูดต่อทันทีจะเงียบ จึง cancel เฉพาะตอนกำลังพูด
  try { curSrc?.stop(); } catch {} curSrc = null; speakingNow = false; mascot.speaking = false; }

// พูดคำสั้นๆ ทันทีในจังหวะที่แตะ — ไอโฟนจะยอมให้พูดคำตอบที่ตามมาทีหลัง
function tapCue(text) {
  return new Promise((res) => {
    try {
      const u = new SpeechSynthesisUtterance(text); u.lang = 'th-TH'; u.rate = cfg.rate; if (cfg.muted) u.volume = 0;
      const v = voices.find((x) => x.name === cfg.voice) || voices[0]; if (v) u.voice = v;
      u.onend = u.onerror = () => res(); setTimeout(res, 1500);
      speechSynthesis.speak(u);
    } catch { res(); }
  });
}

// ---------- ฟังเสียง (STT) ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, listening = false;
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const useAudioAI = () => IS_IOS || !SR || cfg.stt !== 'device'; // ค่าเริ่มต้น: ให้ Gemini ถอดเสียง (แม่นกว่า + รู้จักชื่อคน/ฟีดเดอร์)
const wav = new WavRecorder();
// iPhone/iPad (Safari 16.4+): 'playback' = เสียงพูดดังแม้เปิดโหมดเงียบ แต่ต้องสลับเป็น 'play-and-record' ก่อนเปิดไมค์
// ไม่บังคับโหมดเสียงอีกแล้ว (โหมด playback ทำให้ไอโฟนเปิดไมค์ไม่ได้) ตั้งกลับเป็น auto ก่อนอัดทุกครั้ง
function setAudioMode(type) { try { if (navigator.audioSession && type === 'auto') navigator.audioSession.type = 'auto'; } catch {} }

function micOn() { listening = true; $('btnMic').classList.add('listening'); mascot.setMood('listening'); setStatus('กำลังฟังอยู่ค่ะ…', 'listening'); }
function micOff() { listening = false; $('btnMic').classList.remove('listening'); mascot.setMood('normal'); }

// คำที่มักได้จากเสียงรอบข้าง ไม่ใช่คำถามจริง
const STRAY = /^(ค่ะ|คะ|ครับ|คับ|จ้า|อืม+|เอ่อ|อ่า|โอเค|ok|ขอบคุณ(ค่ะ|ครับ|มาก)?|ขอบคุณที่รับชม.*|สวัสดี(ค่ะ|ครับ)?|ไม่มีอะไร|ใช่|ไม่ใช่|หา|ฮะ|ห๊ะ|\[.*\])$/i;
const isStray = (t) => { const x = String(t || '').trim().replace(/[\s.,!?ๆ]+/g, ''); return x.length < 3 || STRAY.test(x); };
async function listenAudio(auto) {
  if (wav.active) { wav.stop(); return; }
  stopSpeaking(); abortAsk();
  setAudioMode('auto');
  wav.prime();
  if (auto) { // เปิดฟังเองตอนเห็นคน: ถ้าเครื่องยังไม่ยอมให้เปิดเสียง (ต้องแตะก่อน) ให้รอแตะไมค์แทน
    await new Promise((r) => setTimeout(r, 250));
    if (!wav.ctx || wav.ctx.state !== 'running') { try { wav.ctx && wav.ctx.close(); } catch {} wav.ctx = null; setStatus('แตะปุ่มไมค์แล้วพูดได้เลยค่ะ'); $('btnMic').classList.add('pulse'); setTimeout(() => $('btnMic').classList.remove('pulse'), 8000); return; }
  }
  micOn();
  bumpIdle();
  await tapCue('ค่ะ'); // ตอบรับก่อนเริ่มฟัง และปลดล็อกเสียงพูดบนไอโฟน
  try {
    const audio = await wav.record({ noSpeechMs: auto ? 6000 : 8000, minSpeechMs: auto ? 600 : 400, onSpeech: () => setStatus('ฟังอยู่ พูดจบแล้วรอสักครู่นะคะ', 'listening') });
    micOff();
    if (!audio) { setStatus(auto ? 'แตะไมค์แล้วพูดได้เลยค่ะ' : 'ไม่ได้ยินเสียง แตะไมค์แล้วพูดใหม่นะคะ'); return; }
    setStatus('กำลังแปลงเสียงเป็นข้อความ…'); mascot.setMood('thinking');
    const text = await transcribe(audio);
    mascot.setMood('normal');
    // ไมค์ที่เปิดเอง: ถ้าได้ยินแค่เสียงรอบข้าง/คำลอยๆ ให้เงียบไว้ ไม่ตอบเอง
    if (auto && (!text || isStray(text))) { setStatus('แตะไมค์แล้วพูดได้เลยค่ะ'); return; }
    if (!text) { setStatus('ฟังไม่ชัด แตะไมค์แล้วพูดใหม่อีกครั้งนะคะ'); speak('ขอโทษค่ะ ฟังไม่ชัด รบกวนพูดอีกครั้งนะคะ'); return; }
    if (voiceCommand(text)) return;
    confirmSend(text);
  } catch (e) {
    micOff();
    console.error(e);
    toast(e.name === 'NotAllowedError' ? 'กรุณาอนุญาตให้ใช้ไมโครโฟน' : 'เปิดไมค์ไม่ได้: ' + e.message, 6000);
    setStatus('แตะปุ่มไมค์แล้วพูดได้เลยค่ะ');
  }
}

function listen() {
  if (useAudioAI()) return listenAudio();
  if (listening) { rec.stop(); return; }
  stopSpeaking(); abortAsk();
  rec = new SR();
  rec.lang = 'th-TH'; rec.interimResults = true; rec.maxAlternatives = 1; rec.continuous = false;
  let finalText = '';
  rec.onstart = () => { listening = true; $('btnMic').classList.add('listening'); mascot.setMood('listening'); setStatus('กำลังฟังอยู่ค่ะ…', 'listening'); };
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) finalText += e.results[i][0].transcript; else interim += e.results[i][0].transcript;
    }
    const shown = (finalText + interim).trim();
    if (shown) { $('userSaid').textContent = '“' + shown + '”'; $('userSaid').hidden = false; }
  };
  rec.onerror = (e) => {
    if (e.error === 'not-allowed') toast('กรุณาอนุญาตให้ใช้ไมโครโฟน');
    if (e.error === 'service-not-allowed') toast('iPad: เปิด ตั้งค่า > Siri และ การป้อนตามคำบอก (Dictation) ก่อนนะคะ', 7000);
  };
  rec.onend = () => {
    listening = false; $('btnMic').classList.remove('listening'); mascot.setMood('normal');
    if (finalText.trim()) { const t = applyCorrections(finalText.trim()); if (!voiceCommand(t)) confirmSend(t); }
    else setStatus('แตะปุ่มไมค์แล้วพูดได้เลยค่ะ');
  };
  rec.start();
  bumpIdle();
}

// ---------- ถาม Gemini (สตรีม) ----------
const chat = [];
let controller = null;
const busy = () => listening || speakingNow || !!controller;
function abortAsk() { if (controller) { controller.abort(); controller = null; } }
function stopAll() { cancelConfirm(); abortAsk(); stopSpeaking(); if (listening && rec) rec.abort(); wav.cancel(); }

// ถ้าโควตาฟรีของรุ่นที่ใช้อยู่หมด (429) จะลองรุ่นถัดไปให้อัตโนมัติ
const FALLBACK_MODELS = ['gemini-3.5-flash-lite', 'gemini-flash-lite-latest', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];
async function callGemini(body, signal) {
  const models = [cfg.model, ...FALLBACK_MODELS.filter((m) => m !== cfg.model)];
  let res;
  for (const m of models) {
    const b = /2\.5/.test(m) ? { ...body, generationConfig: { ...body.generationConfig, thinkingConfig: { thinkingBudget: 0 } } } : body;
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:streamGenerateContent?alt=sse`,
      { method: 'POST', signal, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.apiKey }, body: JSON.stringify(b) });
    if (res.status !== 429 && res.status !== 404) return res;
  }
  return res;
}

// ---------- ถอดเสียงเป็นข้อความก่อน (แยกจากการตอบ) ให้ตรงกับที่พูดมากที่สุด ----------
let glossaryText = '';
glossary().then((g) => { glossaryText = g; }).catch(() => {});
async function transcribe(audio) {
  if (!cfg.apiKey) { openSettings(); toast('ใส่ Gemini API key ก่อนนะคะ'); return ''; }
  const prompt = `ถอดเสียงพูดในไฟล์นี้ออกมาเป็นข้อความตามที่ผู้พูดพูดจริงทุกคำ
- ภาษาไทยเป็นหลัก อาจมีคำภาษาอังกฤษ ตัวเลข หรือรหัส ให้เขียนตามที่ได้ยิน เช่น ALA06, KPI 2.11
- ห้ามตอบคำถาม ห้ามสรุป ห้ามแก้ใจความ ห้ามเติมคำที่ไม่ได้พูด ตัดเฉพาะคำซ้ำ เอ่อ อ่า
- ถ้าเสียงไม่ชัดให้เลือกคำที่ใกล้ที่สุดจากรายการคำศัพท์ด้านล่าง
- ถ้าไม่มีเสียงพูดของคน หรือเป็นเสียงคนคุยกันเองไกลๆ เสียงทีวี/วิทยุ/เพลง หรือฟังไม่ออกว่าพูดอะไร ให้ตอบว่า [ไม่มีเสียง] ห้ามเดา
ตอบเฉพาะข้อความที่ถอดได้ บรรทัดเดียว
คำศัพท์ที่อาจได้ยิน (ชื่อคน ฟีดเดอร์ ชื่อระบบ): ${glossaryText || 'กฟส.อ่าวลึก, เวรแก้ไฟ, ฟีดเดอร์, หม้อแปลง, Patrol'}${glossaryExtra() ? ', ' + glossaryExtra() : ''}`;
  const body = { contents: [{ role: 'user', parts: [{ inlineData: { mimeType: audio.mime, data: audio.b64 } }, { text: prompt }] }], generationConfig: { temperature: 0, maxOutputTokens: 300 } };
  // ทดสอบแล้ว: ชื่อรุ่น flash-lite-latest ถอดเสียงเร็วสุด (~2 วิ) ส่วน 3.5/3.1 flash-lite ใช้ 7–10 วิ
  for (const m of ['gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', cfg.model]) {
    try {
      const b = /2\.5/.test(m) ? { ...body, generationConfig: { ...body.generationConfig, thinkingConfig: { thinkingBudget: 0 } } } : body;
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.apiKey }, body: JSON.stringify(b) });
      if (r.status === 429 || r.status === 404) continue;
      const j = await r.json();
      const t = (j.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('').trim().replace(/^["“]|["”]$/g, '');
      const clean = t.replace(/([\u0E00-\u0E7F])\s+(?=[\u0E00-\u0E7F])/g, '$1'); // ตัดช่องว่างที่แทรกระหว่างคำไทย
      return /\[ไม่มีเสียง\]/.test(clean) || clean.length < 2 ? '' : applyCorrections(clean);
    } catch (e) { console.warn('transcribe', e); }
  }
  return '';
}

// คำสั่งเสียงที่ทำได้ทันที ไม่ต้องถาม AI
function voiceCommand(t) {
  const x = t.replace(/\s+/g, '').replace(/ค่ะ|ครับ|คะ|นะ/g, '');
  if (/^(กลับ)?หน้าแรก$|^กลับหน้าหลัก$|^เริ่มใหม่$/.test(x)) { goHome(); speak('กลับหน้าแรกแล้วค่ะ'); return true; }
  if (/^(หยุด|พอแล้ว|เงียบ|ยกเลิก)$/.test(x)) { stopAll(); setStatus('หยุดแล้วค่ะ'); return true; }
  return false;
}

const AUDIO_NOTE = 'ไฟล์เสียงนี้คือคำพูดของลูกค้า บรรทัดแรกให้ขึ้นต้นด้วย ###USER: ตามด้วยคำที่ลูกค้าพูดเป็นข้อความภาษาไทย แล้วขึ้นบรรทัดใหม่ตอบตามกฎปกติ ถ้าฟังไม่ออกให้ขอให้พูดอีกครั้งอย่างสุภาพ';

async function ask(question, audio, keepCue) {
  if (!audio && OPS() && CK_RE.test(String(question || '').trim()) && !CK_Q.test(question)) { startCheckin(); return; }
  if (!cfg.apiKey) { openSettings(); toast('ใส่ Gemini API key ก่อนนะคะ'); return; }
  if (keepCue) { abortAsk(); if (listening && rec) rec.abort(); wav.cancel(); } else stopAll();
  bumpIdle();
  setMode('answer');
  hideFeedback();
  if (!audio && answerVerified(question)) return;
  $('userSaid').textContent = audio ? 'กำลังฟังที่พูด…' : '“' + question + '”'; $('userSaid').hidden = false;
  $('bubbleTitle').textContent = 'น้องมีไฟตอบ';
  $('bubbleText').textContent = '…';
  $('card').hidden = true;
  clearResults();
  mascot.setMood('thinking');
  setStatus('กำลังหาคำตอบ…');

  chat.push(audio
    ? { role: 'user', parts: [{ inlineData: { mimeType: audio.mime, data: audio.b64 } }, { text: AUDIO_NOTE }] }
    : { role: 'user', parts: [{ text: question }] });
  while (chat.length > 12) chat.shift();

  controller = new AbortController();
  const myCtl = controller;
  let timedOut = false;
  const guard = setTimeout(() => { timedOut = true; myCtl.abort(); }, 45000);
  let full = '', spokenUpTo = 0, cardMode = false, gotFirst = false, heard = question || '';
  const usedTools = new Set();
  wantVerify = false;
  const filler = setTimeout(() => { if (!gotFirst) speak('ขอเช็คข้อมูลสักครู่นะคะ'); }, 1500);

  const flushLines = (final) => {
    const lines = full.split('\n');
    const upto = final ? lines.length : lines.length - 1; // บรรทัดสุดท้ายอาจยังไม่จบ
    for (let i = spokenUpTo; i < upto; i++) {
      let line = lines[i].trim().replace(/^###(?!USER|CARD|VERIFY)[^:\n]*:\s*/, '');
      if (line.startsWith('###USER:')) { const said = line.slice(8).trim(); if (said) { heard = said; $('userSaid').textContent = '“' + said + '”'; } continue; }
      if (line.startsWith('###')) { cardMode = true; continue; }
      if (!cardMode && line) speak(line);
    }
    spokenUpTo = Math.max(spokenUpTo, upto);
    const [talk] = full.replace(/^###USER:.*$/m, '').replace(/^###(?!USER|CARD|VERIFY)[^:\n]*:\s*/gm, '').split(/^###/m);
    $('bubbleText').textContent = talk.trim() || '…';
  };

  try {
    const turnStart = chat.length - 1;
    for (let round = 0; round < 4; round++) {
      const res = await callGemini({
        systemInstruction: { parts: [{ text: systemText() }] },
        contents: chat,
        tools: TOOL_DECLS,
        generationConfig: { temperature: 0.4, maxOutputTokens: 900 },
      }, myCtl.signal);
      if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + (await res.text()).slice(0, 200));

      const modelParts = [], calls = [];
      const reader = res.body.getReader(), dec = new TextDecoder();
      let buf = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
          if (!line.startsWith('data:')) continue;
          let j; try { j = JSON.parse(line.slice(5)); } catch { continue; }
          for (const p of j.candidates?.[0]?.content?.parts || []) {
            modelParts.push(p);
            if (p.functionCall) { calls.push(p.functionCall); continue; }
            if (p.thought || !p.text) continue;
            if (!gotFirst) { gotFirst = true; mascot.setMood('normal'); setStatus('น้องมีไฟกำลังตอบ'); }
            full += p.text; flushLines(false);
          }
        }
      }
      calls.forEach((c) => usedTools.add(c.name));
      if (!calls.length) break;
      // เรียกเครื่องมือแล้วส่งผลกลับให้ AI ตอบต่อ
      setStatus('กำลังดึงข้อมูล…');
      chat.push({ role: 'model', parts: modelParts });
      const results = await Promise.all(calls.map(async (c) => ({ functionResponse: { name: c.name, response: { result: await runTool(c.name, c.args, toolCtx) } } })));
      chat.push({ role: 'user', parts: results });
    }
    // เก็บประวัติแบบย่อ: คำถาม (เป็นข้อความ) + คำตอบสุดท้าย ไม่เก็บข้อมูลดิบจากเครื่องมือ
    chat.splice(turnStart);
    chat.push({ role: 'user', parts: [{ text: heard || '(ลูกค้าพูดด้วยเสียง)' }] });
    flushLines(true);
    chat.push({ role: 'model', parts: [{ text: full.replace(/^###USER:.*\n?/m, '') }] });

    // การ์ดแสดงบนจอ
    const cardPart = full.split(/^###CARD[ \t]*/m)[1];
    lastAnswer = { q: heard || question, a: $('bubbleText').textContent, card: (cardPart || '').trim(), tools: [...usedTools] };
    showFeedback();
    if (cardPart) {
      const ls = cardPart.split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('###'));
      const title = ls.find((s) => !s.startsWith('-')) || '';
      showCard(title, ls.filter((s) => s.startsWith('-')).map((s) => s.replace(/^-\s*/, '')));
    }

  } catch (err) {
    while (chat.length && chat.at(-1).role !== 'model') chat.pop();
    if (err.name === 'AbortError' && !timedOut) return;
    console.error(err);
    const quota = String(err.message).includes('429');
    const msg = quota ? 'ตอนนี้มีคนใช้งานเยอะ ขอพักสักครู่นะคะ ติดต่อเจ้าหน้าที่ที่เคาน์เตอร์ได้เลยค่ะ'
      : 'ขออภัยค่ะ ตอนนี้น้องมีไฟเชื่อมต่อไม่ได้ กรุณาติดต่อเจ้าหน้าที่ที่เคาน์เตอร์นะคะ';
    $('bubbleText').textContent = msg; speak(msg);
    if (String(err.message).includes('40')) toast('เรียก AI ไม่สำเร็จ: ' + err.message.slice(0, 120), 8000);
  } finally {
    clearTimeout(filler); clearTimeout(guard);
    if (controller === myCtl) controller = null;
    mascot.setMood('normal');
  }

  lastAsk = heard || question;
  if (wantVerify) { openPin(); return; }
  onQueueEmpty = () => {
    setStatus(staffOn() ? 'โหมดเจ้าหน้าที่ · ถามต่อได้เลยค่ะ' : 'ถามต่อได้เลยค่ะ');
    // ฟังต่อเองเฉพาะตอนมีคนยืนอยู่หน้าจอ (ถ้าเปิดกล้องไว้) ไม่งั้นรอแตะไมค์
    if (cfg.autoListen && document.body.classList.contains('mode-answer') && (!presenceOn() || someoneHere())) setTimeout(() => { if (!busy()) (useAudioAI() ? listenAudio('follow') : listen()); }, 400);
  };
  if (!speakingNow) { const f = onQueueEmpty; onQueueEmpty = null; f(); }
}


// ---------- ระบบเรียนรู้ ----------
let lastAnswer = null, pendingHeard = '';
const who = () => cfg.hubUser || 'ไม่ระบุ';
initLearn(cfg.learnUrl, cfg.learnSecret);

// ยืนยันก่อนส่ง: โชว์คำที่ได้ยิน 2 วินาที แก้ได้ ไม่แตะ = ส่งเอง
let cfTimer = null, cfText = '';
function confirmSend(text) {
  if (!cfg.confirm) { ask(text); return; }
  cfText = text; pendingHeard = text;
  $('cfText').textContent = '“' + text + '”';
  $('confirmBar').hidden = false; document.body.classList.add('confirming');
  const bar = $('cfProg'); bar.classList.remove('run'); void bar.offsetWidth; bar.classList.add('run');
  setStatus('ได้ยินว่า… แตะ "แก้" ถ้าไม่ตรง');
  clearTimeout(cfTimer); cfTimer = setTimeout(() => { const t = cfText; cancelConfirm(); ask(t); }, 2000);
}
function cancelConfirm() { clearTimeout(cfTimer); cfTimer = null; const b = $('confirmBar'); if (b) b.hidden = true; document.body.classList.remove('confirming'); }
$('cfSend').onclick = () => { const t = cfText; cancelConfirm(); stopSpeaking(); tapCue('ค่ะ'); ask(t, null, true); };
$('cfEdit').onclick = () => { const t = cfText; cancelConfirm(); editHeard(t); };
function editHeard(t) {
  pendingHeard = t;
  $('typeInput').value = t; $('btnSend').hidden = false; $('typeInput').focus();
  setStatus('แก้คำให้ถูกแล้วกดส่ง น้องมีไฟจะจำไว้ค่ะ');
}

// ตอบทันทีจากคำตอบที่เจ้าหน้าที่ยืนยันแล้ว (ไม่ต้องเรียก AI)
function answerVerified(q) {
  const v = findVerified(q);
  if (!v) return false;
  stopSpeaking();
  $('userSaid').textContent = '“' + q + '”'; $('userSaid').hidden = false;
  $('bubbleTitle').innerHTML = 'น้องมีไฟตอบ<span class="badge-verified">ตอบทันที · คำตอบที่ยืนยันแล้ว</span>';
  $('bubbleText').textContent = v.a;
  clearResults();
  const ls = String(v.card || '').split('\n').map((x) => x.trim()).filter(Boolean);
  showCard(ls.find((x) => !x.startsWith('-')) || '', ls.filter((x) => x.startsWith('-')).map((x) => x.replace(/^-\s*/, '')));
  v.a.split('\n').map((x) => x.trim()).filter(Boolean).forEach(speak);
  chat.push({ role: 'user', parts: [{ text: q }] }, { role: 'model', parts: [{ text: v.a }] });
  lastAsk = q;
  lastAnswer = { q, a: v.a, card: v.card || '', tools: [], verified: true };
  showFeedback();
  setStatus('ถามต่อได้เลยค่ะ');
  return true;
}

function hideFeedback() { const f = $('feedback'); if (f) f.hidden = true; }
function showFeedback() {
  if (!lastAnswer || !lastAnswer.a || lastAnswer.a === '…') return;
  $('feedback').hidden = false; $('fbAsk').hidden = false; $('fbWhy').hidden = true; $('fbFixForm').hidden = true; $('fbDone').hidden = true;
}
function fbDone(msg) { $('fbAsk').hidden = true; $('fbWhy').hidden = true; $('fbFixForm').hidden = true; $('fbDone').textContent = msg; $('fbDone').hidden = false; }
async function fbSend(extra) {
  const L = lastAnswer; if (!L) return;
  const cacheable = !L.verified && L.tools.every((t) => STATIC_TOOLS.includes(t));
  const r = await sendFeedback({ q: L.q, a: L.a, card: L.card, tools: L.tools.join(', '), cacheable, by: who(), ...extra });
  if (r === false) toast('บันทึกในเครื่องแล้ว แต่ส่งขึ้น Sheet ไม่สำเร็จค่ะ', 5000);
  return cacheable;
}
$('fbOk').onclick = async () => {
  mascot.gesture('cheer');
  fbDone('ขอบคุณค่ะ น้องมีไฟจำไว้แล้ว');
  const cacheable = await fbSend({ ok: true });
  if (cacheable) fbDone('ขอบคุณค่ะ ครั้งหน้าถามแบบนี้น้องมีไฟตอบได้ทันที');
  else if (lastAnswer && lastAnswer.tools.length) fbDone('ขอบคุณค่ะ น้องมีไฟจำวิธีหาข้อมูลเรื่องนี้ไว้แล้ว');
};
$('fbNo').onclick = () => { $('fbAsk').hidden = true; $('fbWhy').hidden = false; };
$('fbWhy').querySelectorAll('[data-r]').forEach((b) => (b.onclick = () => {
  const r = b.dataset.r;
  if (r === 'fix') { $('fbWhy').hidden = true; $('fbFixForm').hidden = false; $('fbFix').value = ''; $('fbFix').focus(); return; }
  fbSend({ ok: false, reason: r });
  if (r === 'ฟังผิด') { fbDone('แก้คำที่ช่องพิมพ์ด้านล่างแล้วกดส่งได้เลยค่ะ'); editHeard(lastAnswer.q); return; }
  fbDone('ขอบคุณค่ะ ส่งให้ผู้ดูแลตรวจแล้ว');
}));
$('fbFixForm').onsubmit = (e) => {
  e.preventDefault();
  const fix = $('fbFix').value.trim(); if (!fix) return;
  fbSend({ ok: false, reason: 'พิมพ์คำตอบที่ถูก', fix });
  fbDone('บันทึกแล้วค่ะ ครั้งหน้าน้องมีไฟจะตอบตามนี้');
};


// ---------- แจ้งเตือนอัปเดตจากศูนย์รวมงาน ----------
let alertNow = null, alertUnseen = 0, sayLater = [], alertQ = [];
function quietNow() {
  if (!cfg.quietOn) return false;
  const n = bkkNow(), m = n.getUTCHours() * 60 + n.getUTCMinutes();
  const t = (x) => { const [h, mm] = String(x || '0:0').split(':').map(Number); return h * 60 + (mm || 0); };
  const a = t(cfg.quietFrom), b = t(cfg.quietTo);
  return a <= b ? m >= a && m < b : m >= a || m < b;
}
// ลิงก์แอปของการแจ้งเตือนแบบเดิม (ตามหัวข้อ)
const TOPIC_APP = { notices: '/duty-roster/', tickets: '/duty-roster/', tmd: '/tmd/', ...Object.fromEntries(Object.values(SYS).map((x) => [x.k, x.app])) };
const TOPIC_ICON = { notices: '📢', tickets: '☎️', tmd: '⛈️', test: '🔔', ...Object.fromEntries(Object.values(SYS).map((x) => [x.k, x.icon])) };
const TOPIC_COLOR = Object.fromEntries(Object.values(SYS).map((x) => [x.k, x.color]));
const alApp = (a) => a.app || TOPIC_APP[a.topic] || '';
function showAlert(a, isNext) {
  alertNow = a;
  const card = $('alertCard');
  card.classList.remove('next'); if (isNext) { void card.offsetWidth; card.classList.add('next'); }
  $('alIcon').textContent = a.icon || TOPIC_ICON[a.topic] || '🔔';
  $('alertCard').style.setProperty('--al-c', a.color || TOPIC_COLOR[a.topic] || '#e24b4a');
  $('alTitle').textContent = a.title; $('alTime').textContent = a.time || '';
  $('alText').textContent = a.text || ''; $('alSub').textContent = a.sub || '';
  const ims = a.imgs || []; $('alImgs').hidden = !ims.length; $('alImgs').replaceChildren(...ims.map((u) => { const i = el('img'); i.alt = ''; i.src = u; i.onerror = () => i.remove(); return i; }));
  const im = $('alImg'); im.hidden = !a.img; if (a.img) { im.onerror = () => { im.hidden = true; }; im.src = a.img; } else im.removeAttribute('src');
  const ents = a.ents || [];
  $('alEnts').hidden = !ents.length;
  $('alEnts').replaceChildren(...(ents.length ? [el('span', null, 'เกี่ยวข้อง:'), ...ents.map((x) => { const b = el('button', null, x); b.type = 'button'; b.onclick = () => { ackAlert(false); stopSpeaking(); tapCue('ได้เลยค่ะ'); ask(x + ' มีความเคลื่อนไหวอะไรบ้างในทุกระบบ', null, true); }; return b; })] : []));
  $('alOpen').hidden = !alApp(a) || !OPS();
  $('alMore').hidden = !a.q;
  $('alertCard').hidden = false; $('alerts').hidden = false;
  renderQueue();
  const sc = $('alertCard').querySelector('.al-scroll'); sc.scrollTop = 0;
  const fade = () => sc.classList.toggle('more', sc.scrollHeight - sc.scrollTop - sc.clientHeight > 8);
  sc.onscroll = fade; requestAnimationFrame(fade);
}
// ตัวนับ "1 จาก N" · การ์ดซ้อนด้านหลัง · รายการถัดไป
function renderQueue() {
  const n = alertQ.length;
  $('alTop').hidden = n < 2;
  $('alCount').textContent = '1 จาก ' + n; $('alLeft').textContent = 'อีก ' + (n - 1) + ' เรื่องรออยู่';
  $('alertCard').classList.toggle('stacked', n > 1);
  $('alAck').textContent = n > 1 ? 'รับทราบ · ถัดไป' : 'รับทราบ';
  const nx = alertQ.slice(1, 4);
  $('alNext').hidden = !nx.length;
  $('alNext').replaceChildren(...(nx.length ? [el('span', null, 'ถัดไป:'), ...nx.map((a) => el('span', null, (a.icon || TOPIC_ICON[a.topic] || '🔔') + ' ' + a.title)), ...(n > 4 ? [el('span', null, '+' + (n - 4))] : [])] : []));
}
const sayOk = (a) => cfg.alertVoice && !quietNow() && (OPS() || a.topic === 'notices' || a.topic === 'test');
// รับทราบใบนี้ → ใบถัดไปขึ้นมา (อ่านให้ฟังถ้า speak) · ใบสุดท้ายกล่องหายไป
function ackAlert(speakNext) {
  alertQ.shift();
  alertUnseen = Math.max(0, alertUnseen - 1); setBell();
  if (alertQ.length) { const a = alertQ[0]; showAlert(a, true); if (speakNext && a.say && sayOk(a)) { stopSpeaking(); speak(a.say); } return; }
  alertNow = null; $('alertCard').hidden = true; $('alNext').hidden = true; alertUnseen = 0; setBell();
  if ($('alHist').hidden) $('alerts').hidden = true;
}
$('alAll').onclick = () => { alertQ = [alertQ[0]]; stopSpeaking(); ackAlert(false); };
$('alOpen').onclick = () => { const a = alertNow; if (!a) return; const app = alApp(a); ackAlert(false); openApp(app, (a.icon || TOPIC_ICON[a.topic] || '') + ' ' + (a.sys || a.title.split(' · ')[0])); };
function setBell() { $('bellCount').textContent = alertUnseen > 9 ? '9+' : alertUnseen; $('bellCount').hidden = !alertUnseen; }
function onAlerts(list) {
  if (!OPS()) { list = list.filter((a) => a.topic === 'notices' || a.topic === 'test'); if (!list.length) return; } // โหมดลูกค้า: ไม่แสดงข้อมูลภายในบนจอ
  wakeUp();
  const wasOpen = !$('alertCard').hidden && alertQ.length;
  alertQ.push(...list);
  if (wasOpen) renderQueue(); else showAlert(alertQ[0]); // เรื่องใหม่ต่อท้ายคิว ไม่แทรกใบที่กำลังดู
  alertUnseen += list.length; setBell();
  mascot.pulse();
  const publicOnly = list.every((a) => a.topic === 'notices' || a.topic === 'test'); // ประกาศงดจ่ายไฟเป็นข้อมูลสาธารณะ พูดในโหมดลูกค้าได้
  if (!cfg.alertVoice || quietNow() || (!OPS() && !publicOnly)) return; // โหมดลูกค้า: ไม่พูดข้อมูลภายในออกเสียง
  sayLater.push(wasOpen ? 'มีเรื่องใหม่เข้ามาอีก ' + list.length + ' เรื่องค่ะ' : alertQ.length > 1 ? 'มีอัปเดตจากศูนย์รวมงาน ' + alertQ.length + ' เรื่องค่ะ ' + alertQ[0].say : alertQ[0].say);
  flushSay();
}
function flushSay() {
  if (!sayLater.length || busy() || document.body.classList.contains('confirming') || $('settings').open) return;
  const t = sayLater.splice(0).join(' ');
  t.replace(/ค่ะ\s+/g, 'ค่ะ\n').split('\n').forEach(speak);
}
setInterval(flushSay, 2000);
$('alAck').onclick = () => ackAlert(true);
$('alMore').onclick = () => { const q = alertNow && alertNow.q; ackAlert(false); if (q) { stopSpeaking(); tapCue('ได้เลยค่ะ'); ask(q, null, true); } };
// ปุ่มปิด/เปิดเสียงที่หน้าจอหลัก (จำค่าไว้)
function setMute(m) {
  cfg.muted = !!m; saveCfg();
  const b = $('btnMute'); b.setAttribute('aria-pressed', String(cfg.muted)); b.setAttribute('aria-label', cfg.muted ? 'เปิดเสียงน้องมีไฟ' : 'ปิดเสียงน้องมีไฟ');
}
setMute(cfg.muted);
$('btnMute').onclick = () => {
  const m = !cfg.muted;
  if (m) { stopSpeaking(); setMute(true); toast('ปิดเสียงแล้ว น้องมีไฟจะตอบบนจออย่างเดียวค่ะ'); }
  else { setMute(false); speak('เปิดเสียงแล้วค่ะ'); }
};
$('btnBell').onclick = () => {
  const h = $('alHist');
  if (!h.hidden) { h.hidden = true; if ($('alertCard').hidden) $('alerts').hidden = true; return; }
  const log = alertLog();
  $('alList').replaceChildren(...(log.length ? log.slice(0, 30).map((a) => {
    const li = el('li'); li.append(el('span', 'li-ic', a.icon || TOPIC_ICON[a.topic] || '🔔'), a.title + ' · ' + (a.text || ''));
    const app = alApp(a);
    if (app && OPS()) { const ob = el('button', 'li-open', 'เปิดแอป'); ob.type = 'button'; ob.onclick = (e) => { e.stopPropagation(); h.hidden = true; $('alerts').hidden = $('alertCard').hidden; openApp(app, a.sys || a.title.split(' · ')[0]); }; li.append(ob); }
    li.append(el('small', null, [a.time, a.sub].filter(Boolean).join(' · ')));
    li.onclick = () => { if (!a.q) return; stopSpeaking(); tapCue('ได้เลยค่ะ'); ask(a.q, null, true); h.hidden = true; }; return li; }) : [el('li', null, 'ยังไม่มีอัปเดตค่ะ')]));
  h.hidden = false; $('alerts').hidden = false; alertUnseen = 0; setBell();
};
$('btnTestAlert').onclick = () => {
  $('settings').close();
  tapCue('ทดสอบค่ะ');
  setTimeout(() => onAlerts([{ topic: 'test', title: 'ทดสอบแจ้งเตือน', text: 'นี่คือตัวอย่างการ์ดแจ้งเตือนจากศูนย์รวมงาน', sub: 'ไม่ใช่ข้อมูลจริง', say: 'ทดสอบแจ้งเตือนจากศูนย์รวมงานค่ะ ถ้าได้ยินเสียงนี้ แปลว่าใช้งานได้ค่ะ', q: '', time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) }]), 1500);
};
$('alClose').onclick = () => { $('alHist').hidden = true; if ($('alertCard').hidden) $('alerts').hidden = true; };
startWatch({ cfg: () => cfg, toolCtx: () => toolCtx, creds: () => ({ user: cfg.hubUser, pass: cfg.hubPass }), learn: () => ({ url: cfg.learnUrl, secret: cfg.learnSecret }), onAlerts });
$('alertTopics').replaceChildren(...Object.entries(TOPICS).map(([k, name]) => { const l = el('label', 'check'); const c = Object.assign(document.createElement('input'), { type: 'checkbox', id: 'top_' + k }); l.append(c, ' ' + name); return l; }));


// ---------- โหมดรอ: เห็นคนเข้ามา → ทักและฟังเอง ----------
let sleeping = false;
function sleepNow() {
  if (sleeping || busy() || anyDialogOpen()) return;
  sleeping = true; $('sleepCover').hidden = false; mascot.gesture('yawn'); setTimeout(() => { if (sleeping) mascot.setMood('sleepy'); }, 1800);
}
function wakeUp() { if (!sleeping) return; sleeping = false; $('sleepCover').hidden = true; mascot.setMood('normal'); bumpIdle(); }
const anyDialogOpen = () => [...document.querySelectorAll('dialog')].some((d) => d.open) || document.body.classList.contains('confirming');
$('sleepCover').onclick = () => { wakeUp(); };
async function greetAndListen() {
  wakeUp();
  if (busy() || anyDialogOpen() || !document.body.classList.contains('mode-home')) return;
  const hi = OPS() ? 'สวัสดีค่ะ มีอะไรให้น้องมีไฟช่วยไหมคะ' : 'สวัสดีค่ะ ยินดีต้อนรับสู่การไฟฟ้าส่วนภูมิภาคสาขาอ่าวลึกค่ะ มีอะไรให้น้องมีไฟช่วยไหมคะ';
  setStatus(hi); mascot.setMood('normal'); mascot.gesture('wave');
  await tapCue(hi);
  mascot.setMood('normal');
  if (!busy() && !anyDialogOpen() && useAudioAI()) listenAudio(true);
  else if (!busy() && !anyDialogOpen()) listen();
}
async function startWake(quiet) {
  $('wakeCover').hidden = true;
  try {
    await startPresence({
      minSize: () => 0.12,
      gapMs: () => 60e3,
      sleepMs: () => 120e3,
      onLook: (x, y) => { if (!sleeping) mascot.lookAt(x * 0.9, y * 0.6); },
      onPresence: (here) => { if (here) wakeUp(); },
      onArrive: greetAndListen,
      onIdle: () => { if (cfg.wakeSleep) sleepNow(); },
      onStatus: (st, face) => { const d = $('camDot'); d.hidden = false; d.classList.toggle('face', face); },
      onError: (e) => { camStatus.err = String(e && e.message || e).slice(0, 120); },
    });
    if (!quiet) toast('โหมดรอเปิดแล้ว เดินเข้ามาหน้าจอ น้องมีไฟจะทักเองค่ะ', 4000);
  } catch (e) {
    camStatus.step = 'error'; camStatus.err = (e && e.name ? e.name + ': ' : '') + String(e && e.message || e).slice(0, 120);
    if (e && (e.name === 'NotFoundError' || e.name === 'OverconstrainedError')) { cfg.wakeFace = false; saveCfg(); toast('เครื่องนี้ไม่มีกล้อง ปิดโหมดทักเมื่อเห็นคนให้แล้วค่ะ', 6000); return; }
    toast(e && e.name === 'NotAllowedError' ? 'ต้องอนุญาตให้ใช้กล้องก่อนค่ะ (ตั้งค่าของเครื่อง > Safari > กล้อง)' : 'เปิดโหมดรอไม่ได้: ' + String(e && e.message || e).slice(0, 80), 7000);
  }
}
// ไอโฟน/ไอแพดต้องแตะหน้าจอ 1 ครั้งหลังเปิดแอป จึงจะเปิดกล้อง ไมค์ และเสียงพูดเองได้
function armWake() {
  if (!cfg.wakeFace) { stopPresence(); $('wakeCover').hidden = true; return; }
  if (presenceOn()) return;
  $('wakeCover').hidden = false;
}
$('wakeCover').onclick = () => { tapCue(' '); wav.prime(); startWake(); };
armWake();
const CAM_STEP = { off: 'ยังไม่เปิด (แตะจอเพื่อเริ่มโหมดรอ)', 'loading-model': 'กำลังโหลดตัวตรวจใบหน้า…', 'opening-camera': 'กำลังเปิดกล้อง…', 'waiting-video': 'เปิดกล้องแล้ว แต่ยังไม่ได้ภาพ', running: 'ทำงานอยู่', 'detect-error': 'ตรวจใบหน้าผิดพลาด', error: 'เปิดไม่ได้' };
function showCamStatus() {
  const s = camStatus, ago = (t) => (t ? Math.round((Date.now() - t) / 1000) + ' วิที่แล้ว' : '-');
  $('camInfo').textContent = !cfg.wakeFace ? 'สถานะกล้อง: ปิดอยู่' :
    `สถานะกล้อง: ${CAM_STEP[s.step] || s.step}${s.delegate ? ' (' + s.delegate + ')' : ''} · ภาพ ${s.w}×${s.h} · ตรวจแล้ว ${s.checks} ครั้ง (ล่าสุด ${ago(s.lastCheckAt)}) · เห็นหน้าล่าสุด ${ago(s.lastFaceAt)} · ขนาดหน้า ${Math.round(s.size * 100)}%${s.err ? ' · ข้อผิดพลาด: ' + s.err : ''}`;
}
setInterval(() => { if ($('settings').open) showCamStatus(); }, 1000);
// ท่าเล่นยามว่าง: เฉพาะหน้าแรก ไม่มีใครคุยอยู่ และไม่มีคนยืนหน้าจอ
setInterval(() => {
  const idleHome = document.body.classList.contains('mode-home') && !busy() && !someoneHere() && !anyDialogOpen();
  mascot.idlePlay = !!cfg.idlePlay && idleHome;
  // โหมดประหยัดพลังงาน: พักจอ = 5 ภาพ/วิ ตรวจหน้า 1 ครั้ง/วิ · รอที่หน้าแรก = 30 ภาพ/วิ · คุยอยู่ = เต็มที่
  const ps = !!cfg.powerSave;
  mascot.maxFps = !ps ? 0 : sleeping ? 5 : idleHome ? 30 : 0;
  setPresenceRate(ps && sleeping ? 1000 : 500);
  $('sleepCover').classList.toggle('deep', ps);
}, 1000);

// ---------- ปุ่มต่างๆ ----------
let unlocked = false;
async function unlockOnce() {
  if (unlocked) return; unlocked = true;
  // iPad/iPhone: ต้อง "ปลดล็อก" เสียงพูดด้วยการแตะครั้งแรก ไม่งั้นคำตอบแรกจะเงียบ
  try { const u = new SpeechSynthesisUtterance('สวัสดี'); u.lang = 'th-TH'; u.volume = 0; speechSynthesis.speak(u); } catch {}
  const el = document.documentElement;
  try { await (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el); } catch {}
  try { await navigator.wakeLock?.request('screen'); } catch {}
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') navigator.wakeLock?.request('screen').catch(() => {}); });
}
document.addEventListener('pointerdown', unlockOnce, { capture: true });
document.addEventListener('pointerdown', bumpIdle);

$('btnMic').onclick = listen;
$('btnHome').onclick = goHome;
$('btnHome2').onclick = goHome;
// แตะคำพูดที่ถอดได้ เพื่อแก้แล้วส่งใหม่
$('userSaid').addEventListener('click', () => {
  const t = $('userSaid').textContent.replace(/^“|”$/g, '').trim();
  if (!t || t === 'กำลังฟังที่พูด…') return;
  editHeard(t);
  toast('แก้คำแล้วกดส่งได้เลยค่ะ');
});
// ช่องพิมพ์คำถาม
$('typeInput').addEventListener('input', () => { $('btnSend').hidden = !$('typeInput').value.trim(); });
$('typeForm').onsubmit = (e) => {
  e.preventDefault();
  const q = $('typeInput').value.trim();
  if (!q) return;
  $('typeInput').value = ''; $('btnSend').hidden = true; $('typeInput').blur();
  if (pendingHeard && pendingHeard !== q) {
    addCorrection(pendingHeard, q, who()).then((d) => d && toast('จำแล้วค่ะ: ' + d.wrong + ' → ' + d.right, 4000));
  }
  pendingHeard = '';
  stopSpeaking(); tapCue('ค่ะ'); // ปลดล็อกเสียงพูดบนไอโฟนในจังหวะที่กดส่ง
  ask(q, null, true);
};
// ---------- ลงเวลาทำงานด้วยการสแกนหน้า ----------
initCheckin({
  cfg: () => cfg, speak: (t) => { stopSpeaking(); speak(t); }, toast: (t, ms) => toast(t, ms),
  learn: () => ({ url: cfg.learnUrl, secret: cfg.learnSecret }),
  pausePresence: () => stopPresence(),
  resumePresence: () => { if (cfg.wakeFace) startWake(true); },
});
function startCheckin() { stopAll(); bumpIdle(); openCheckin(); }
$('btnCheckin').onclick = startCheckin;
hooks.openCheckin = startCheckin;
// รูปหน้าพนักงานจากฐานข้อมูล (โหลดครั้งแรก แล้วรีเฟรชวันละครั้ง)
setTimeout(() => { if (OPS()) loadFaces(); }, 5000);
const CK_RE = /^(ลงเวลา|เช็[กค]อิน|เช็[กค]เอา(ท์|ต์)|สแกนหน้า)/;
const CK_Q = /ใคร|กี่|สรุป|ยัง|บ้าง|มั้ย|ไหม|เมื่อ|สาย/;
document.querySelectorAll('.mbtn[data-q]').forEach((b) => (b.onclick = () => { stopSpeaking(); tapCue('ได้เลยค่ะ'); ask(b.dataset.q, null, true); }));
$('btnInternal').onclick = () => { stopSpeaking(); tapCue('ขอรหัสยืนยันตัวตนเจ้าหน้าที่ค่ะ'); lastAsk = null; openPin(); };

// ---------- หน้าใส่ PIN เจ้าหน้าที่ ----------
function openPin() {
  if (!cfg.staffPin) { toast('ยังไม่ได้ตั้ง PIN เจ้าหน้าที่ — ตั้งได้ที่หน้าตั้งค่า', 6000); return; }
  $('pinInput').value = ''; $('pinMsg').textContent = '';
  $('pinDlg').showModal(); setTimeout(() => $('pinInput').focus(), 50);
}
$('pinForm').onsubmit = (e) => {
  e.preventDefault();
  if ($('pinInput').value.trim() !== String(cfg.staffPin)) { $('pinMsg').textContent = 'รหัสไม่ถูกต้อง'; $('pinInput').value = ''; return; }
  staffUntil = Date.now() + 5 * 60e3;
  $('pinDlg').close();
  setStatus('โหมดเจ้าหน้าที่ 5 นาที');
  tapCue('ยืนยันแล้วค่ะ');
  if (lastAsk) { const q = lastAsk; lastAsk = null; ask(q, null, true); }
};
$('pinCancel').onclick = () => { $('pinDlg').close(); setStatus('ถามเรื่องอื่นได้เลยค่ะ'); };

// มาสคอตมองตามนิ้วที่แตะจอ
$('stage').addEventListener('pointermove', (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  mascot.lookAt(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
});
// หยอกเล่นกับน้องมีไฟ: แตะมือ แตะหัว แก้ม ตา ปาก ตัว · ลากหมุน · แตะค้างกอด · แตะสองครั้งดีใจ
// แตะที่ว่างบนจอ = ปล่อยลูกแก้วแอปลงมาให้เล่น
const PLAY_SAY = {
  handL: ['ยินดีที่ได้รู้จักค่ะ', 'จับมือกันหน่อยค่ะ'], handR: ['ยินดีที่ได้รู้จักค่ะ', 'สวัสดีค่ะ จับมือกันค่ะ'],
  arm: ['ไฮไฟว์ค่ะ!', 'เย่!'], head: ['อิอิ จั๊กจี้ค่ะ', 'ลูบหัวน้องมีไฟเหรอคะ'], cheek: ['เขินจังค่ะ', 'อย่าแซวสิคะ'],
  eye: ['โอ๊ย แสบตาค่ะ', 'มองไม่เห็นแล้วค่ะ'], bolt: ['ซ่า! ไฟแรงเต็มที่ค่ะ', 'ระวังไฟช็อตนะคะ'], mouth: ['หม่ำๆ ค่ะ', 'อร่อยจังค่ะ'],
  body: ['จั๊กจี้ค่ะ ฮ่าๆ', 'อุ๊ย!'], hug: ['กอดๆ ค่ะ', 'อบอุ่นจังค่ะ'], dizzy: ['เวียนหัวแล้วค่ะ หมุนช้าๆ หน่อยนะคะ'],
  spin: ['ว้าว หมุนได้ด้วย'], double: ['เย่!'],
};
let playSaidAt = 0;
let marbleTips = 0;
mascot.onTouch = (kind, app) => {
  bumpIdle(); wakeUp && wakeUp();
  // ลูกแก้วแอป: แตะ = บอกชื่อ · แตะค้าง = เปิดแอป (เฉพาะใช้ภายใน)
  if (kind === 'marbleOpen' && app) {
    if (OPS() && !busy()) { speak('เปิด ' + app.n + ' ค่ะ'); setTimeout(() => openApp(app.p, app.e + ' ' + app.n), 500); }
    else if (!busy()) speak('นี่คือ ' + app.n + ' ค่ะ');
    return;
  }
  if (kind === 'marble' && app) {
    if (busy() || Date.now() - playSaidAt < 1500) return;
    playSaidAt = Date.now();
    speak(app.n + (OPS() && marbleTips++ < 2 ? ' ค่ะ แตะค้างไว้เพื่อเปิดแอปได้นะคะ' : ' ค่ะ'));
    return;
  }
  if (kind === 'marbleDrop') return;
  const lines = PLAY_SAY[kind];
  if (!lines || busy() || Date.now() - playSaidAt < 2500) return;
  playSaidAt = Date.now();
  speak(lines[Math.floor(Math.random() * lines.length)]);
};

// ---------- ตั้งค่า ----------
function openSettings() {
  loadVoices();
  $('setKey').value = cfg.apiKey; $('setModel').value = cfg.model; $('setVoice').value = cfg.voice;
  $('setRate').value = cfg.rate; $('rateVal').textContent = cfg.rate + 'x'; $('setAuto').checked = cfg.autoListen;
  $('setMode').value = cfg.mode; $('setStt').value = cfg.stt;
  $('set_budgetUser').value = cfg.budgetUser; $('set_budgetPass').value = cfg.budgetPass; $('set_officeCode').value = cfg.officeCode; $('set_cclUser').value = cfg.cclUser; $('set_cclPass').value = cfg.cclPass; $('set_olUser').value = cfg.olUser; $('set_olPass').value = cfg.olPass;
  $('setHubUser').value = cfg.hubUser; $('setHubPass').value = cfg.hubPass; $('setPin').value = cfg.staffPin;
  $('setIdlePlay').checked = cfg.idlePlay; $('setPowerSave').checked = cfg.powerSave;
  showCamStatus();
  $('setWakeFace').checked = cfg.wakeFace; $('setWakeSleep').checked = cfg.wakeSleep;
  $('setAlertOn').checked = cfg.alertOn; $('setAlertVoice').checked = cfg.alertVoice; $('setQuiet').checked = cfg.quietOn; $('setQuietFrom').value = cfg.quietFrom; $('setQuietTo').value = cfg.quietTo;
  Object.keys(TOPICS).forEach((k) => { $('top_' + k).checked = topicOn(cfg, k); });
  $('setLearnUrl').value = cfg.learnUrl; $('setLearnSecret').value = cfg.learnSecret; $('setConfirm').checked = cfg.confirm;
  const st = learnStats();
  $('learnInfo').textContent = (st.online ? 'เชื่อม Sheet แล้ว ✓ · ' : st.configured ? 'ใส่ค่าแล้วแต่เชื่อม Sheet ไม่สำเร็จ · ' : 'ยังไม่เชื่อม Sheet (เก็บในเครื่องนี้) · ') + `จำคำ ${st.corr} · คำตอบยืนยัน ${st.verified} · ตัวอย่าง ${st.examples}`;
  $('verLabel').textContent = 'เวอร์ชัน ' + VERSION;
  if (!$('settings').open) $('settings').showModal();
}
$('btnSettings').onclick = openSettings;
// QR สำหรับตั้งค่าเครื่องอื่นครั้งเดียว: มี API key + ระบบเรียนรู้ (สแกนด้วยกล้องแล้วเปิดในแอปที่ติดตั้งไว้)
$('btnQr').onclick = async () => {
  const box = $('qrBox');
  if (!box.hidden) { box.hidden = true; box.replaceChildren(); return; }
  const pack = Object.fromEntries(SHARE_KEYS.filter((k) => cfg[k] !== '' && cfg[k] != null).map((k) => [k, cfg[k]]));
  if (!Object.keys(pack).length) { toast('ยังไม่มีค่าที่จะส่งต่อค่ะ'); return; }
  const url = location.origin + location.pathname + '#cfg=' + packCfg(pack);
  if (!window.qrcode) await new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js'; sc.onload = ok; sc.onerror = no; document.head.append(sc); });
  const q = window.qrcode(0, 'M'); q.addData(url); q.make();
  const img = new Image(); img.src = q.createDataURL(6, 2); img.alt = 'QR ตั้งค่า';
  box.replaceChildren(img, el('p', null, 'สแกนด้วยกล้องไอแพด/ไอโฟน · มีการตั้งค่าทั้งหมดรวมรหัสผ่าน อย่าถ่ายรูปส่งต่อ'));
  box.hidden = false;
};
$('btnPaste').onclick = async () => {
  try { const t = (await navigator.clipboard.readText()).trim(); if (t) $('setKey').value = t; else toast('คลิปบอร์ดว่างค่ะ'); }
  catch { toast('วางไม่ได้ ลองกดค้างที่ช่องแล้วเลือก "วาง" นะคะ'); }
};
// วางลิงก์จาก QR (มี #lu=…&ls=…) แล้วแยกลิงก์กับรหัสลับให้เอง
// ย้ายการตั้งค่าทั้งหมดข้ามเครื่อง (API key, รหัสศูนย์รวมงาน, รหัสระบบอื่น, ระบบเรียนรู้, แจ้งเตือน)
const SHARE_KEYS = ['apiKey', 'model', 'rate', 'mode', 'stt', 'hubUser', 'hubPass', 'staffPin', 'budgetUser', 'budgetPass', 'officeCode', 'cclUser', 'cclPass', 'olUser', 'olPass', 'learnUrl', 'learnSecret', 'confirm', 'alertOn', 'alertVoice', 'quietOn', 'quietFrom', 'quietTo', 'alertTopics', 'wakeSleep', 'idlePlay', 'powerSave'];
function packCfg(o) { return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unpackCfg(t) { try { return JSON.parse(decodeURIComponent(escape(atob(t.replace(/-/g, '+').replace(/_/g, '/'))))); } catch { return null; } }
function importCfg(o) {
  if (!o || typeof o !== 'object') return false;
  SHARE_KEYS.forEach((k) => { if (k in o) cfg[k] = o[k]; });
  saveCfg(); initLearn(cfg.learnUrl, cfg.learnSecret);
  return true;
}
function fillLearn(v) {
  const i = v.indexOf('#'), h = new URLSearchParams(i >= 0 ? v.slice(i + 1) : '');
  if (h.get('cfg') && importCfg(unpackCfg(h.get('cfg')))) { openSettings(); toast('นำเข้าการตั้งค่าทั้งหมดแล้วค่ะ', 5000); return true; }
  if (h.get('key')) { cfg.apiKey = h.get('key'); saveCfg(); $('setKey').value = cfg.apiKey; }
  if (h.get('lu') && h.get('ls')) { $('setLearnUrl').value = h.get('lu'); $('setLearnSecret').value = h.get('ls'); toast('ใส่ลิงก์และรหัสลับให้แล้ว กดบันทึกได้เลยค่ะ', 5000); return true; }
  return false;
}
['input', 'change', 'paste'].forEach((ev) => $('setLearnUrl').addEventListener(ev, () => setTimeout(() => fillLearn($('setLearnUrl').value), 0)));
$('btnPasteLearn').onclick = async () => {
  try { const t = (await navigator.clipboard.readText()).trim(); if (!t) return toast('คลิปบอร์ดว่างค่ะ'); if (!fillLearn(t)) { $('setLearnUrl').value = t; toast('สิ่งที่วางไม่ใช่ลิงก์ตั้งค่าจาก QR ค่ะ ลองแตะ "แตะเพื่อคัดลอก" ใน Safari อีกครั้ง', 7000); } }
  catch { toast('วางไม่ได้ ลองกดค้างที่ช่องแล้วเลือก "วาง" นะคะ'); }
};
$('setRate').oninput = (e) => ($('rateVal').textContent = e.target.value + 'x');
$('btnTestVoice').onclick = () => { stopSpeaking(); cfg.voice = $('setVoice').value; cfg.rate = +$('setRate').value; speak('สวัสดีค่ะ น้องมีไฟยินดีให้บริการค่ะ'); };
$('settings').addEventListener('close', () => {
  $('qrBox').hidden = true; $('qrBox').replaceChildren();
  if ($('settings').returnValue !== 'save') return;
  cfg.apiKey = $('setKey').value.trim(); cfg.model = $('setModel').value.trim() || DEFAULTS.model;
  cfg.voice = $('setVoice').value; cfg.rate = +$('setRate').value; cfg.autoListen = $('setAuto').checked;
  cfg.budgetUser = $('set_budgetUser').value.trim(); cfg.budgetPass = $('set_budgetPass').value.trim(); cfg.officeCode = $('set_officeCode').value.trim(); cfg.cclUser = $('set_cclUser').value.trim(); cfg.cclPass = $('set_cclPass').value.trim(); cfg.olUser = $('set_olUser').value.trim(); cfg.olPass = $('set_olPass').value.trim();
  cfg.hubUser = $('setHubUser').value.trim(); cfg.hubPass = $('setHubPass').value; cfg.staffPin = $('setPin').value.trim();
  cfg.mode = $('setMode').value; cfg.stt = $('setStt').value;
  fillLearn($('setLearnUrl').value.trim());
  let lu = $('setLearnUrl').value.trim(), ls = $('setLearnSecret').value.trim();
  if (lu && !/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(lu)) { toast('ลิงก์ระบบเรียนรู้ไม่ถูกต้อง ใช้ค่าเดิมไว้ก่อนค่ะ', 6000); lu = cfg.learnUrl; ls = cfg.learnSecret; }
  const relearn = lu !== cfg.learnUrl || ls !== cfg.learnSecret;
  cfg.learnUrl = lu; cfg.learnSecret = ls; cfg.confirm = $('setConfirm').checked;
  const wf = $('setWakeFace').checked, wfChanged = wf !== cfg.wakeFace;
  cfg.wakeFace = wf; cfg.wakeSleep = $('setWakeSleep').checked; cfg.idlePlay = $('setIdlePlay').checked; cfg.powerSave = $('setPowerSave').checked;
  if (wfChanged) setTimeout(() => { if (cfg.wakeFace) { tapCue(' '); wav.prime(); startWake(); } else armWake(); }, 0);
  cfg.alertOn = $('setAlertOn').checked; cfg.alertVoice = $('setAlertVoice').checked; cfg.quietOn = $('setQuiet').checked; cfg.quietFrom = $('setQuietFrom').value || '22:00'; cfg.quietTo = $('setQuietTo').value || '06:00';
  cfg.alertTopics = Object.fromEntries(Object.keys(TOPICS).map((k) => [k, $('top_' + k).checked]));
  if (relearn) initLearn(lu, ls).then((ok) => lu && toast(ok ? 'เชื่อมระบบเรียนรู้แล้วค่ะ' : 'เชื่อมระบบเรียนรู้ไม่สำเร็จ ตรวจลิงก์/รหัสลับค่ะ', 5000));
  saveCfg(); toast('บันทึกแล้วค่ะ'); if (document.body.classList.contains('mode-home')) goHome(); else setMode('answer');
});

// รับ key ผ่านลิงก์ครั้งเดียว (#key=...) แล้วลบออกจากแถบที่อยู่ทันที
const rawHash = location.hash, hp = new URLSearchParams(location.hash.slice(1)), hashKey = hp.get('key');
// เปิดลิงก์ QR ใน Safari แต่ใช้งานจริงจากไอคอนหน้าจอโฮม (ข้อมูลแยกกัน) → ให้แตะคัดลอกไปวางในแอป
const inApp = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
if (rawHash.length > 5 && !inApp && /iPhone|iPad|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document) {
  const link = location.origin + location.pathname + rawHash;
  setTimeout(() => {
    $('cpDlg').showModal();
    $('cpBtn').onclick = async () => {
      try { await navigator.clipboard.writeText(link); $('cpMsg').textContent = 'คัดลอกแล้ว ✓ ไปเปิดน้องมีไฟจากไอคอนหน้าจอโฮม → ตั้งค่า → กด "วาง" ข้างช่องลิงก์ระบบเรียนรู้ → บันทึก'; }
      catch { $('cpMsg').textContent = 'คัดลอกไม่สำเร็จ ลองแตะอีกครั้งค่ะ'; }
    };
  }, 600);
}
if (hashKey) { cfg.apiKey = hashKey; saveCfg(); window.history.replaceState(null, "", location.pathname); toast('บันทึก API key แล้วค่ะ'); }
// ลิงก์ตั้งค่าระบบเรียนรู้ครั้งเดียว (#lu=...&ls=...)
if (hp.get('cfg')) {
  if (importCfg(unpackCfg(hp.get('cfg')))) toast('นำเข้าการตั้งค่าทั้งหมดแล้วค่ะ', 5000);
  window.history.replaceState(null, "", location.pathname);
}
if (hp.get('lu') && hp.get('ls')) {
  cfg.learnUrl = hp.get('lu'); cfg.learnSecret = hp.get('ls'); saveCfg(); window.history.replaceState(null, "", location.pathname);
  initLearn(cfg.learnUrl, cfg.learnSecret).then((ok) => toast(ok ? 'เชื่อมระบบเรียนรู้แล้วค่ะ' : 'เชื่อมระบบเรียนรู้ไม่สำเร็จค่ะ', 5000));
}

if (!cfg.apiKey) setTimeout(() => toast('แตะไอคอนตั้งค่ามุมขวาบน เพื่อใส่ Gemini API key', 6000), 800);
goHome();
