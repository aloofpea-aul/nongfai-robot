// ภาพเคลื่อนไหวสภาพอากาศระดับ 1–6 (เกณฑ์เดียวกับงานแก้ไฟ) — วาดด้วย SVG + CSS ล้วน ไม่ต้องโหลดรูป
export const WX_LV = { 1: 'สภาพปกติ', 2: 'ชื้น', 3: 'ฝนตก', 4: 'ลมแรง', 5: 'ฝนตก ลมแรง', 6: 'ฝนตก ฟ้าคะนอง' };
export const WX_COLOR = { 1: '#3B9B4A', 2: '#1D9E9A', 3: '#2A7DE1', 4: '#D9952B', 5: '#E06A1F', 6: '#D0342C' };
export const WX_RISK = { 1: 'ความเสี่ยงไฟดับต่ำ', 2: 'เฝ้าระวังเล็กน้อย', 3: 'เฝ้าระวัง ฝนอาจทำให้ไฟดับ', 4: 'เฝ้าระวัง ลมอาจพัดต้นไม้/กิ่งไม้พาดสาย', 5: 'เสี่ยงสูง เตรียมทีมแก้ไฟ', 6: 'เสี่ยงสูงมาก เตรียมพร้อมทุกทีม' };

const cloud = (x, y, s, cls) => `<g transform="translate(${x} ${y}) scale(${s})"><g class="${cls || ''}"><circle cx="-20" cy="2" r="15"/><circle cx="2" cy="-9" r="20"/><circle cx="24" cy="3" r="14"/><rect x="-35" y="2" width="72" height="16" rx="8"/></g></g>`;
const drops = (n, x0, w, slant) => Array.from({ length: n }, (_, i) => `<line class="wx-drop" x1="${x0 + (i * w) / n}" y1="78" x2="${x0 + (i * w) / n - slant}" y2="90" style="animation-delay:${((i * 0.37) % 1).toFixed(2)}s"/>`).join('');
const winds = (n) => Array.from({ length: n }, (_, i) => `<path class="wx-wind" d="M20 ${48 + i * 20} q40 -10 80 0 t80 0" style="animation-delay:${(i * 0.45).toFixed(2)}s"/>`).join('');

function scene(lv) {
  const sun = `<g transform="translate(100 62)"><g class="wx-sun"><circle r="20"/>${Array.from({ length: 8 }, (_, i) => `<line x1="0" y1="-28" x2="0" y2="-38" transform="rotate(${i * 45})"/>`).join('')}</g></g>`;
  if (lv <= 1) return sun;
  if (lv === 2) return `<g opacity=".75" transform="translate(-14 -6)">${sun}</g>${cloud(102, 74, 1.05, 'wx-cloud drift')}<g class="wx-haze"><line x1="40" y1="104" x2="160" y2="104"/><line x1="55" y1="114" x2="145" y2="114"/></g>`;
  if (lv === 3) return `${cloud(100, 62, 1.1, 'wx-cloud rain')}<g class="wx-rain">${drops(9, 62, 80, 0)}</g>`;
  if (lv === 4) return `${cloud(118, 50, 0.8, 'wx-cloud drift fast')}<g class="wx-winds">${winds(4)}</g><g transform="translate(40 124)"><g class="wx-tree"><line x1="0" y1="0" x2="0" y2="-26"/><circle cx="0" cy="-36" r="14"/></g></g>`;
  if (lv === 5) return `${cloud(100, 56, 1.1, 'wx-cloud rain')}<g class="wx-rain slant">${drops(10, 64, 84, 9)}</g><g class="wx-winds">${winds(3)}</g>`;
  return `${cloud(100, 56, 1.2, 'wx-cloud storm')}<path class="wx-bolt" d="M104 64 l-14 24 h11 l-8 22 l22 -30 h-12 l9 -16z"/><g class="wx-rain slant">${drops(10, 60, 90, 6)}</g><rect class="wx-flash" x="0" y="0" width="200" height="130"/>`;
}

// การ์ดระดับสภาพอากาศ: ภาพเคลื่อนไหว + ตัวเลขระดับ + แถบ 1–6
export function wxCard(w) {
  const lv = Math.max(1, Math.min(6, Number(w.lv) || 1)), c = WX_COLOR[lv];
  const box = document.createElement('div');
  box.className = 'wxlv lv' + lv; box.style.setProperty('--wx', c);
  box.setAttribute('role', 'img'); box.setAttribute('aria-label', 'สภาพอากาศระดับ ' + lv + ' ' + WX_LV[lv]);
  box.innerHTML = `<svg viewBox="0 0 200 130" aria-hidden="true">${scene(lv)}</svg>
    <div class="wxlv-info"><div class="wxlv-num">${lv}<small>/6</small></div>
      <div class="wxlv-txt"><b>ระดับ ${lv} · ${WX_LV[lv]}</b><span>${WX_RISK[lv]}</span>${w.manual ? '<em>หน้างานตั้งเอง' + (w.manual.by ? ' · ' + w.manual.by : '') + '</em>' : '<em>ระบบวิเคราะห์อัตโนมัติ</em>'}${w.watch ? '<em class="warn">⚡ เฝ้าระวังฟ้าคะนอง ' + w.watch + '</em>' : ''}${w.pend6 ? '<em class="warn">⚡ เข้าเกณฑ์ระดับ 6 รอยืนยันรอบถัดไป</em>' : ''}</div></div>
    <div class="wxlv-bar">${[1, 2, 3, 4, 5, 6].map((n) => `<i class="${n <= lv ? 'f' : ''}" style="${n <= lv ? 'background:' + WX_COLOR[n] : ''}"><span>${n}</span></i>`).join('')}</div>`;
  return box;
}
