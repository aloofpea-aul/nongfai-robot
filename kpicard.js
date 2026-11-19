// การ์ดนำเสนอ KPI: คะแนนเฉลี่ย (วงแหวน) + สัดส่วนระดับ + แนวโน้มรายเดือน
const C = ['#1D9E75', '#7BB661', '#EF9F27', '#E24B4A'], L = ['ดีมาก ≥4.5', 'ดี 4–4.49', 'พอใช้ 3–3.99', 'ต้องเร่ง <3'];
export function kpiCard(k) {
  const box = document.createElement('div'); box.className = 'kpic';
  const avg = k.avg == null ? null : Math.round(k.avg * 100) / 100, pct = avg == null ? 0 : avg / 5, R = 52, len = 2 * Math.PI * R;
  const col = avg == null ? '#999' : avg >= 4.5 ? C[0] : avg >= 4 ? C[1] : avg >= 3 ? C[2] : C[3];
  const tot = k.bands.reduce((a, b) => a + b, 0) || 1;
  const tr = k.trend || [], W = 600, H = 120, mn = Math.max(0, Math.min(...tr.map((t) => t.v)) - 0.3), mx = Math.min(5, Math.max(...tr.map((t) => t.v)) + 0.1);
  const pts = tr.map((t, i) => [tr.length > 1 ? 24 + (i * (W - 48)) / (tr.length - 1) : W / 2, H - 22 - ((t.v - mn) / (mx - mn || 1)) * (H - 50)]);
  box.innerHTML = `<div class="kpic-top">
    <svg class="kpic-ring" viewBox="0 0 130 130" role="img" aria-label="คะแนนเฉลี่ย ${avg ?? '-'} จาก 5"><circle cx="65" cy="65" r="${R}" fill="none" stroke="#eee" stroke-width="14"/><circle cx="65" cy="65" r="${R}" fill="none" stroke="${col}" stroke-width="14" stroke-linecap="round" stroke-dasharray="${len}" stroke-dashoffset="${len}" transform="rotate(-90 65 65)" class="kpic-arc" style="--to:${len * (1 - pct)}"/><text x="65" y="66" text-anchor="middle" font-size="30" font-weight="700" fill="${col}">${avg ?? '-'}</text><text x="65" y="88" text-anchor="middle" font-size="12" fill="#888">เต็ม 5</text></svg>
    <div class="kpic-info"><b>${k.who}</b><span>ตัวชี้วัด ${k.n} ตัว · มีผลแล้ว ${k.rated} ตัว</span>
      <div class="kpic-bar">${k.bands.map((n, i) => (n ? `<i style="flex:${n};background:${C[i]}" title="${L[i]} ${n}"></i>` : '')).join('')}</div>
      <div class="kpic-leg">${k.bands.map((n, i) => `<span><i style="background:${C[i]}"></i>${L[i]} <b>${n}</b></span>`).join('')}</div></div></div>
    ${tr.length > 1 ? `<div class="kpic-tr"><span>แนวโน้มคะแนนเฉลี่ยรายเดือน</span><svg viewBox="0 0 ${W} ${H}"><polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="#7a4fd0" stroke-width="4" stroke-linejoin="round" class="kpic-line"/>${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="6" fill="#7a4fd0"/><text x="${p[0]}" y="${H - 1}" text-anchor="middle" font-size="15" fill="#888">${tr[i].m}</text><text x="${p[0]}" y="${p[1] - 12}" text-anchor="middle" font-size="15" fill="#555">${tr[i].v}</text>`).join('')}</svg></div>` : ''}`;
  return box;
}
