// เบิก/คืนรถที่น้องมีไฟ: สแกนหน้า (หรือเลือกแผนก → ชื่อ) → เลือกรถ → ภารกิจ/ไมล์ → บันทึกเข้าระบบยานพาหนะจริง
// หลังบ้านระบบยานพาหนะ (v17.5+) รับ onBehalf จากบัญชีผู้ดูแลที่ล็อกอินไว้ในเครื่องน้องมีไฟ แล้วบันทึกเป็นชื่อคนที่ยืนยันตัวตน
import { identify, ckScreen as screen, ckBtn as btn, ckEl as el, closeCheckin } from './checkin.js?v=11231615';
import { callName } from './faces.js?v=11231615';

const VEH_API = 'https://script.google.com/macros/s/AKfycbzLnelFGNLqynkfwm06vBDZE23p5_1-kDV3CZm_EuuMHDex4vEtNNYeJ9sRo-m0KLq1/exec';
const MISSIONS = ['แก้ไฟฟ้าขัดข้อง', 'ตรวจระบบ', 'ติดต่อราชการ', 'ประชุม', 'ส่งเอกสาร'];
const MAX_TRIP = 1000;
let X = null;
export function initVehicle(ctx) { X = ctx; }

const nm = (s) => String(s == null ? '' : s).replace(/[\s​-‍﻿]/g, '').toLowerCase();
const km = (n) => Number(n || 0).toLocaleString('th-TH');
const TITLE = 'เบิก/คืนรถ';

async function vcall(action, who, data = {}) {
  const c = X.cfg();
  if (!c.hubUser || !c.hubPass) return { ok: false, message: 'ยังไม่ได้ใส่บัญชีศูนย์รวมงานในตั้งค่าน้องมีไฟ' };
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 30000);
  try {
    const r = await fetch(VEH_API, { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, user: c.hubUser, pass: c.hubPass, onBehalf: who.e.name, onBehalfId: who.e.id, how: who.how, ...data }) });
    const t = await r.text();
    try { return JSON.parse(t); } catch { return { ok: false, message: 'ระบบยานพาหนะตอบกลับผิดรูปแบบ' }; }
  } catch (e) { return { ok: false, message: e.name === 'AbortError' ? 'ระบบยานพาหนะไม่ตอบภายใน 30 วินาที' : 'เชื่อมต่อระบบยานพาหนะไม่ได้' }; }
  finally { clearTimeout(to); }
}

export function openVehicle() { identify(TITLE, (e, how) => cars({ e, how })); }

function fail(who, msg) {
  screen(TITLE, el('div', 'ck-err', msg || 'ทำรายการไม่สำเร็จ'), btn('🔄 ลองใหม่', 'big', () => cars(who)), btn('ปิด', 'ghost', closeCheckin));
  X.express && X.express('sad', 3); X.speak('ขอโทษค่ะ ' + (msg || 'ทำรายการไม่สำเร็จ'));
}

async function cars(who) {
  screen(TITLE, el('div', 'ck-name', who.e.name), el('div', 'ck-wait', 'กำลังดูสถานะรถ…'));
  const j = await vcall('bootstrap', who);
  if (!j.ok) return fail(who, j.message);
  const me = nm(who.e.name), list = (j.vehicles || []).slice();
  const rank = (v) => (v.status === 'in-use' && nm(v.user) === me ? 0 : v.status !== 'in-use' ? 1 : 2);
  list.sort((a, b) => rank(a) - rank(b) || (b.myTrips || 0) - (a.myTrips || 0) || a.plate.localeCompare(b.plate, 'th'));
  const rows = list.map((v) => {
    const mine = v.status === 'in-use' && nm(v.user) === me, free = v.status !== 'in-use';
    const r = el('div', 'vh-car' + (mine ? ' mine' : free ? ' free' : ' busy'));
    const info = el('div', 'vh-info');
    info.append(el('div', 'vh-plate', '🚗 ' + v.plate + (v.model ? ' · ' + v.model : '')),
      el('div', 'vh-st', mine ? 'คุณใช้อยู่ · ' + (v.mission || '') : free ? 'ว่าง · ไมล์ ' + km(v.mile) : (v.user || 'มีคน') + 'ใช้อยู่' + (v.mission ? ' · ' + v.mission : '')));
    r.append(info);
    if (mine) r.append(btn('คืนรถ', 'vh-go', () => returnForm(who, v)));
    else if (free) r.append(btn('เบิกใช้', 'vh-go', () => checkoutForm(who, v)));
    return r;
  });
  const mineCar = list.find((v) => v.status === 'in-use' && nm(v.user) === me);
  screen(TITLE, el('div', 'ck-name', who.e.name), el('div', 'ck-sub', who.how === 'face' ? 'ยืนยันตัวตนด้วยใบหน้าแล้ว' : 'เลือกชื่อเอง (ระบบจะบันทึกไว้)'),
    el('div', 'vh-list'), btn('ปิด', 'ghost', closeCheckin));
  $q('.vh-list').append(...rows);
  X.speak(callName(who.e.name) + (mineCar ? ' ใช้รถ ' + mineCar.plate + ' อยู่ จะคืนรถไหมคะ' : ' เลือกรถที่จะใช้ได้เลยค่ะ'));
}
const $q = (s) => document.querySelector('#ckBody ' + s);

function numInput(val) { const i = el('input', 'vh-num'); i.type = 'number'; i.inputMode = 'numeric'; if (val) i.value = val; return i; }

function checkoutForm(who, v) {
  const mi = el('input', 'ck-search'); mi.placeholder = 'ภารกิจ / จุดหมาย เช่น แก้ไฟ ต.คลองหิน';
  const chips = el('div', 'vh-chips');
  chips.append(...MISSIONS.map((m) => btn(m, 'chip', () => { mi.value = m; })));
  const mile = numInput(v.mile), note = el('div', 'ck-sub', 'ตรวจกับหน้าปัดรถ ถ้าไม่ตรงแก้ได้');
  mile.oninput = () => { const n = Number(mile.value), d = n - v.mile; note.textContent = !mile.value ? 'กรุณากรอกเลขไมล์' : d === 0 ? 'ตรงกับที่บันทึกล่าสุด' : d > 0 ? 'มากกว่าที่บันทึกล่าสุด ' + km(d) + ' กม.' : '⚠️ น้อยกว่าที่บันทึกล่าสุด ' + km(-d) + ' กม.'; };
  const go = btn('ยืนยันเบิกรถ ' + v.plate, 'big', async () => {
    const n = Number(mile.value);
    if (mi.value.trim().length < 2) { X.toast('เลือกหรือพิมพ์ภารกิจก่อนค่ะ'); mi.focus(); return; }
    if (!n || n <= 0) { X.toast('กรอกเลขไมล์ขณะออกก่อนค่ะ'); return; }
    if (n < v.mile && go.dataset.ok !== '1') { go.dataset.ok = '1'; go.textContent = 'ไมล์น้อยกว่าเดิม · แตะอีกครั้งเพื่อยืนยัน'; return; }
    screen(TITLE, el('div', 'ck-wait', 'กำลังบันทึกการเบิกรถ…'));
    const j = await vcall('checkout', who, { carId: v.id, mission: mi.value.trim(), startMile: n });
    if (!j.ok) return fail(who, j.message);
    ok(who, j.message || 'เบิกรถ ' + v.plate + ' แล้ว', callName(who.e.name) + ' เบิกรถ ' + v.plate + ' แล้วค่ะ ขับขี่ปลอดภัยนะคะ');
  });
  screen('เบิกรถ ' + v.plate, el('div', 'ck-name', who.e.name), el('div', 'vh-lbl', 'ภารกิจ / จุดหมาย'), mi, chips,
    el('div', 'vh-lbl', 'เลขไมล์ขณะออก (กม.)'), mile, note,
    el('div', 'ck-sub', 'ตรวจรถก่อนใช้ (6103) ทำในแอประบบยานพาหนะ'), go, btn('‹ กลับ', 'ghost', () => cars(who)));
  X.speak('ไปทำภารกิจอะไรคะ');
}

function returnForm(who, v) {
  const mile = numInput(''), note = el('div', 'ck-sub', 'ไมล์ตอนออก ' + km(v.mile) + ' กม.');
  mile.placeholder = 'เลขไมล์ตอนนี้';
  mile.oninput = () => { const n = Number(mile.value), d = n - v.mile; note.textContent = !mile.value ? 'ไมล์ตอนออก ' + km(v.mile) + ' กม.' : d < 0 ? '⚠️ น้อยกว่าไมล์ตอนออก (' + km(v.mile) + ')' : 'วิ่งไป ' + km(d) + ' กม.' + (d > MAX_TRIP ? ' · มากผิดปกติ ตรวจเลขอีกครั้ง' : ''); };
  const go = btn('ยืนยันคืนรถ ' + v.plate, 'big', async () => {
    const n = Number(mile.value);
    if (!n || n <= 0) { X.toast('กรอกเลขไมล์ขณะคืนก่อนค่ะ'); mile.focus(); return; }
    if (n < v.mile) { X.toast('เลขไมล์ต้องไม่น้อยกว่าตอนออก (' + km(v.mile) + ')'); return; }
    const big = n - v.mile > MAX_TRIP;
    if (big && go.dataset.ok !== '1') { go.dataset.ok = '1'; go.textContent = 'วิ่ง ' + km(n - v.mile) + ' กม. · แตะอีกครั้งเพื่อยืนยัน'; return; }
    screen(TITLE, el('div', 'ck-wait', 'กำลังบันทึกการคืนรถ…'));
    const j = await vcall('returnCar', who, { carId: v.id, endMile: n, confirmBig: big });
    if (!j.ok) return fail(who, j.message);
    ok(who, j.message || 'คืนรถ ' + v.plate + ' แล้ว', 'คืนรถ ' + v.plate + ' เรียบร้อยค่ะ วิ่งไป ' + km(n - v.mile) + ' กิโลเมตร ขอบคุณค่ะ' + callName(who.e.name));
  });
  screen('คืนรถ ' + v.plate, el('div', 'ck-name', who.e.name), el('div', 'ck-sub', v.mission ? 'ภารกิจ: ' + v.mission : ''),
    el('div', 'vh-lbl', 'เลขไมล์ขณะคืน (กม.)'), mile, note, go, btn('‹ กลับ', 'ghost', () => cars(who)));
  setTimeout(() => mile.focus(), 200);
  X.speak('เลขไมล์ตอนนี้เท่าไหร่คะ');
}

function ok(who, msg, say) {
  screen(TITLE, el('div', 'ck-done', '✅ ' + msg), el('div', 'ck-name', who.e.name), btn('เสร็จ', 'big', closeCheckin));
  X.express && X.express('happy', 3);
  X.speak(say);
  setTimeout(() => { if (document.getElementById('ckTitle').textContent === TITLE && document.querySelector('#ckBody .ck-done')) closeCheckin(); }, 15000);
}
