// รูปหน้าพนักงานจากฐานข้อมูล Safety Talk (ครบทุกคน) — ใช้ประกอบการลงเวลา แจ้งเตือน และผลค้นหา
// ใช้รหัสศูนย์รวมงานชุดเดิม · เก็บรูปย่อไว้ในเครื่อง (คีย์เดียวกับแอป Safety Talk) รีเฟรชวันละครั้ง
const ST_API = 'https://script.google.com/macros/s/AKfycbyfGC_-vovohq24RWL91hUEYWXxdiL8UkvJ5VOabKe2dGt9vERuCKocEieny86rhOBJXw/exec';
const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { return null; } };
export const normName = (n) => String(n || '').replace(/^\s*(นาย|นางสาว|นาง|น\.ส\.|ว่าที่\s*ร\.ต\.)\s*/, '').replace(/\s+/g, '');
let FACES = (() => { try { return JSON.parse(ls('st_faces') || '{}'); } catch { return {}; } })();
let BY = {}; const index = () => { BY = {}; for (const [k, v] of Object.entries(FACES)) BY[normName(k)] = v; }; index();
let loading = null;

const shrink = (src, w) => new Promise((ok) => { const i = new Image(); i.onload = () => { const s = Math.min(1, w / Math.max(i.width, i.height)), c = document.createElement('canvas'); c.width = Math.round(i.width * s); c.height = Math.round(i.height * s); c.getContext('2d').drawImage(i, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', 0.78)); }; i.onerror = () => ok(''); i.src = src; });

export async function loadFaces(force) {
  const at = Number(ls('st_faces_at') || 0);
  if (!force && Date.now() - at < 864e5 && Object.keys(FACES).length) return FACES;
  if (loading) return loading;
  const name = ls('pea_aoluek_username') || '', pass = ls('pea_aoluek_password') || '';
  if (!name || !pass) return FACES;
  loading = (async () => {
    try {
      const r = await fetch(ST_API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn: 'st', args: [{ action: 'faces', auth: { name, pass } }] }) });
      const j = await r.json();
      const f = j && j.ok && j.result;
      if (f && typeof f === 'object') {
        for (const k of Object.keys(f)) { const t = await shrink(f[k], 160); if (t) f[k] = t; }
        FACES = f; index();
        ls('st_faces', JSON.stringify(f)); ls('st_faces_at', String(Date.now()));
      }
    } catch {}
    loading = null; return FACES;
  })();
  return loading;
}
// รูปของคนนี้ (ชื่อจากระบบไหนก็ได้ — เทียบแบบตัดคำนำหน้าและช่องว่าง)
// ปะป๊า = ผู้สร้างน้องมีไฟ: ทุกที่ที่พูดถึงตัวปะป๊า ให้เรียก "ปะป๊า" · คนอื่นเรียก "พี่" + ชื่อเล่น
let PAPA = '', PAPA1 = '';
const first = (n) => String(n || '').replace(/^\s*(นาย|นางสาว|นาง|น\.ส\.|ว่าที่\s*ร\.ต\.)\s*/, '').trim().split(/\s+/)[0] || '';
export function setPapa(n) { PAPA = normName(n); PAPA1 = /\s/.test(String(n || '').replace(/^\s*(นาย|นางสาว|นาง|น\.ส\.)\s*/, '').trim()) ? '' : first(n); }
export const papaName = () => PAPA;
export const isPapa = (n) => !!n && !!PAPA && (normName(n) === PAPA || (!!PAPA1 && first(n) === PAPA1));
export const callName = (n) => (isPapa(n) ? 'ปะป๊า' : 'พี่' + first(n));
export const showName = (n) => (isPapa(n) ? 'ปะป๊า' : n);
export const faceOf = (name) => BY[normName(name)] || '';
export const faceCount = () => Object.keys(FACES).length;
