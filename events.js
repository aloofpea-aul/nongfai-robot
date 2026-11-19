// แจ้งเตือนจาก "สมุดเหตุการณ์" (ตัวเฝ้าฐานข้อมูลทุกระบบ ฝั่ง Apps Script)
// ถามหาเหตุการณ์ใหม่ทุก 20 วิ เฉพาะตอนแอปเปิดอยู่บนจอ · ส่งแค่เลขล่าสุดที่เคยเห็น จึงเบาทั้งเครื่องและเซิร์ฟเวอร์
// ครั้งแรกจำเลขล่าสุดไว้เฉยๆ ไม่ประกาศของเก่า
import { describe, isNoise, sysInfo } from './systems.js?v=11191715';
const KEY = 'nongfai.events';
const S = JSON.parse(localStorage.getItem(KEY) || '{}');
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };
// ระบบที่มีตัวแจ้งเตือนเฉพาะอยู่แล้ว (ข้อความละเอียดกว่า) → ไม่แจ้งซ้ำ แต่ยังเก็บไว้ตอบคำถาม
const OWN = new Set(['งานเวรแก้ไฟ', 'เตือนภัยกรมอุตุ']);
let live = false, timer = null, ctxRef = null, running = false;
export const eventsLive = () => live;

async function post(L, body) {
  const r = await fetch(L.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...body, secret: L.secret }) });
  return r.json();
}
// ค้นเหตุการณ์ข้ามระบบ (ใช้ในเครื่องมือตอบคำถาม)
export async function findEvents(L, args) {
  if (!L || !L.url || !L.secret) throw new Error('ยังไม่ได้ตั้งค่าระบบเรียนรู้ (ลิงก์/รหัสลับ) ในหน้าตั้งค่า');
  const j = await post(L, { action: 'find', ...args });
  if (!j || !j.ok) throw new Error((j && j.error) || 'สมุดเหตุการณ์ไม่ตอบ');
  return j;
}

async function tick() {
  const ctx = ctxRef; if (!ctx || running) return;
  const cfg = ctx.cfg(), L = ctx.learn();
  if (!L.url || !L.secret || document.visibilityState !== 'visible') return;
  running = true;
  try {
    const first = S.last == null;
    const j = await post(L, { action: 'events', since: S.last || 0, limit: 60 });
    if (!j || !j.ok) { live = false; return; }
    live = true;
    if (first) { S.last = j.last || 0; save(); return; }
    const evs = (j.events || []).filter((e) => e.id > (S.last || 0));
    if (j.last) S.last = Math.max(S.last || 0, j.last); save();
    if (!cfg.alertOn) return;
    const cards = evs.filter((e) => !OWN.has(e.sys) && !isNoise(e)).map(describe).filter((c) => ctx.topicOn(cfg, c.topic));
    if (!cards.length) return;
    // ยานพาหนะ: เบิก/คืนรถครั้งเดียวแก้ทั้ง Log และสถานะรถ → แจ้งครั้งเดียว
    const logged = new Set(cards.filter((c) => c.vs === 'log' && c.vk).map((c) => c.vk));
    for (let i = cards.length - 1; i >= 0; i--) if (cards[i].vs === 'car' && logged.has(cards[i].vk)) cards.splice(i, 1);
    // ระบบเดียวเปลี่ยนเยอะในรอบเดียว = สรุปรวบ ไม่ประกาศทีละรายการ
    const by = {}; cards.forEach((c) => (by[c.sys] = by[c.sys] || []).push(c));
    const out = [];
    for (const [sys, list] of Object.entries(by)) {
      if (list.length <= 3) { out.push(...list); continue; }
      const s = sysInfo(sys), names = [...new Set(list.map((c) => c.text))];
      if (s.k === 'vehicles') { const ppl = [...new Set(list.map((c) => c.text.split(' · ')[0]).filter((n) => n && n !== 'ไม่ระบุชื่อ'))]; out.push({ ...list[0], title: 'ยานพาหนะ · ' + list.length + ' รายการ', text: list.map((c) => '• ' + c.title.split(' · ')[1] + ' ' + c.text).join('\n'), sub: ppl.length ? 'ผู้ใช้: ' + ppl.join(', ') : '', say: 'ยานพาหนะมีความเคลื่อนไหว ' + list.length + ' รายการค่ะ' + (ppl.length ? ' ผู้ใช้คือ ' + ppl.slice(0, 4).map((n) => 'พี่' + n.replace(/^(นาย|นางสาว|นาง|น\.ส\.)\s*/, '').split(' ')[0]).join(' ') : ''), q: 'วันนี้ใครใช้รถคันไหนบ้าง' }); continue; }
      if (s.k === 'checkin') { out.push({ ...list[0], img: '', imgs: list.map((c) => c.img).filter(Boolean).slice(0, 8), title: 'ลงเวลา · ' + list.length + ' คน', text: list.map((c) => '• ' + c.text + (c.sub ? ' ' + c.sub : '')).join('\n'), sub: '', say: 'มีคนลงเวลาเพิ่ม ' + list.length + ' คนค่ะ' }); continue; }
      out.push({ ...list[0], title: sys + ' · ความเคลื่อนไหว ' + list.length + ' รายการ', text: names.join(', '), sub: [...new Set(list.map((c) => c.title.split(' · ')[1]))].join(' · '), say: sys + ' มีความเคลื่อนไหว ' + list.length + ' รายการค่ะ', q: sys + ' วันนี้มีความเคลื่อนไหวอะไรบ้าง', ents: [...new Set(list.flatMap((c) => c.ents))].slice(0, 4), icon: s.icon, color: s.color });
    }
    ctx.push(out.reverse());
  } catch (e) { live = false; console.warn('events', e); }
  finally { running = false; }
}
export function startEvents(ctx) {
  ctxRef = ctx;
  clearInterval(timer);
  timer = setInterval(tick, 20000);
  setTimeout(tick, 4000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(tick, 2000); });
}
export const eventsNow = () => tick();
