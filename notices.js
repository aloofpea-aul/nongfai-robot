// ประกาศงดจ่ายไฟ (จากระบบงานเวรแก้ไฟในศูนย์รวมงาน) — ใช้ร่วมกันระหว่างเครื่องมือถามตอบกับระบบแจ้งเตือน
export const DUTY_API = 'https://script.google.com/macros/s/AKfycbzIFoqXzNyJ56EOd2p-L6bdbO6ZNLQmYS5xoW4sTFJUuZKkxnnU2TEKJRMdusi1gwzr5g/exec';
const MS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const WD = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
// เวลาในประกาศเป็นเวลาไทย "YYYY-MM-DDTHH:MM"
export const ntT = (s) => (s ? Date.parse(String(s).slice(0, 16) + ':00+07:00') : NaN);
export const ntHm = (s) => (s ? String(s).slice(11, 16) : '');
export const ntDate = (ymd, long) => { const d = new Date(ymd + 'T00:00:00Z'); return (long ? 'วัน' + WD[d.getUTCDay()] + 'ที่ ' : '') + d.getUTCDate() + ' ' + MS[d.getUTCMonth()]; };
export function ntState(n, now = Date.now()) {
  if (n.status === 'cancel') return 'cancel'; if (n.draft) return 'draft'; if (n.status === 'done') return 'done'; if (n.status === 'live') return 'live';
  if (n.type === 'emg') return 'live'; if (ntT(n.startAt) <= now && (!n.endAt || ntT(n.endAt) > now)) return 'due'; if (n.endAt && ntT(n.endAt) <= now) return 'over'; return 'plan';
}
const place = (t) => String(t || '').replace(/\(นำเข้าจาก\s*GIS\)/gi, '').replace(/DCC_?/g, '').replace(/~?\s*\d+(\.\d+)?\s*ม\.?(?=\s|$)/g, '').replace(/\s+/g, ' ').trim();
export const ntArea = (n) => String(n.area || '').split(/\s*→\s*/).map(place).filter(Boolean).join(' ถึง ') || place(n.area);
export const ntWhen = (n) => ntDate(n.date, true) + ' เวลา ' + ntHm(n.actualOff || n.startAt) + (n.endAt ? '–' + ntHm(n.endAt) : '') + ' น.';
export async function loadNotices() {
  const j = await (await fetch(DUTY_API + '?action=notices')).json();
  return (j && j.notices || []).filter((n) => n && !n.draft);
}
