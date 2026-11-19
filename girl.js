// น้องมีไฟ (ผู้หญิง): โบว์บนหัว ขนตา ปากสีชมพู กระโปรงที่ขั้วหลอดไฟ — สร้างด้วยโค้ดทั้งหมด
import * as THREE from 'three';

export function addGirlLook(m, o = {}) {
  const mat = (c, x = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: 0.05, ...x });
  const pink = mat(0xF27BAA, { emissive: 0x5a1030, emissiveIntensity: 0.25 }), gold = mat(0xF5B942, { emissive: 0x8a5a00, emissiveIntensity: 0.4 });
  const parts = {};
  if (o.bow !== false) { // โบว์ข้างสายฟ้า
    const bow = new THREE.Group();
    const wing = (side) => {
      const s = new THREE.Shape(); s.moveTo(0, 0); s.bezierCurveTo(side * 0.25, 0.32, side * 0.62, 0.3, side * 0.6, 0); s.bezierCurveTo(side * 0.62, -0.3, side * 0.25, -0.32, 0, 0);
      const w = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 3 }), pink);
      w.position.z = -0.06; return w;
    };
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 14), gold); knot.scale.set(1, 1, 0.7);
    bow.add(wing(-1), wing(1), knot);
    bow.position.set(0.72, 1.18, 0.62); bow.rotation.set(-0.35, 0.35, -0.5); bow.scale.setScalar(0.85);
    bow.traverse((x) => { x.userData.part = 'bow'; });
    m.head.add(bow); parts.bow = bow;
  }
  if (o.lashes !== false) { // ขนตา 3 เส้นด้านนอกของแต่ละตา (ขยับตามการกะพริบ)
    const lm = mat(0x1E1030, { roughness: 0.3 });
    m.eyes.forEach((g, i) => {
      const side = i ? 1 : -1;
      [[0.1, 0.27, 0.35], [0.17, 0.22, 0.75], [0.21, 0.13, 1.1]].forEach(([x, y, r]) => {
        const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.1, 4, 8), lm);
        l.position.set(side * x, y, 0.08); l.rotation.z = -side * r; g.add(l);
      });
    });
  }
  if (o.brows) { // คิ้วโค้งบาง (แอปขยับขึ้นลงตามอารมณ์ได้)
    const bm = mat(0xF3E3FF, { roughness: 0.35, emissive: 0x3a2060, emissiveIntensity: 0.2 });
    parts.brows = [-1, 1].map((side) => {
      const c = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.026, 8, 24, Math.PI * 0.62), bm);
      c.position.set(side * 0.5, 0.55, 1.2); c.rotation.set(-0.25, side * 0.3, Math.PI / 2 - Math.PI * 0.31 + side * 0.12);
      c.userData.base = { y: c.position.y, rz: c.rotation.z, side }; m.head.add(c); return c;
    });
  }
  if (o.lips) { m.mouth.material = mat(0xC2185B); m.tongue.material = mat(0xF7A1C0); }
  if (o.skirt) { // กระโปรงบานรอบขั้วหลอดไฟ
    const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.95, 0.42, 48, 1, true), mat(0xF7A1C0, { side: THREE.DoubleSide }));
    sk.position.y = -1.95; sk.userData.part = 'body'; m.root.add(sk); parts.skirt = sk;
    const hem = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.03, 8, 64), gold); hem.rotation.x = Math.PI / 2; hem.position.y = -2.16; m.root.add(hem);
  }
  // ปากยิ้ม/ปากเศร้า (โค้ง) — ใช้ตอนไม่ได้พูด
  const lip = mat(o.lips ? 0xC2185B : 0x1E1030);
  parts.smile = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.032, 10, 32, Math.PI), lip);
  parts.smile.position.set(0, -0.36, 1.37); m.head.add(parts.smile);
  // หัวใจลอย
  const hs = new THREE.Shape(); hs.moveTo(0, -0.12); hs.bezierCurveTo(-0.2, 0.02, -0.12, 0.2, 0, 0.08); hs.bezierCurveTo(0.12, 0.2, 0.2, 0.02, 0, -0.12);
  parts.heartGeo = new THREE.ExtrudeGeometry(hs, { depth: 0.05, bevelEnabled: false });
  parts.hearts = []; parts.f = { bl: 0, br: 0, al: 0, ar: 0, smile: 0.6, o: 0, wl: 1, wr: 1 };
  m.girl = parts;
  return parts;
}

// สีหน้าตามอารมณ์/ท่าทาง: คิ้ว (สูง/เอียง) · ตา (โต/หยี/ขยิบ) · ปาก (ยิ้ม/บึ้ง/ตกใจ O) · หัวใจลอย
const FACES = {
  //        คิ้วซ้าย คิ้วขวา เอียงซ้าย เอียงขวา ยิ้ม(+)/บึ้ง(-) ปากO ตาซ้าย ตาขวา
  neutral:  [0.00, 0.00, 0.00, 0.00, 0.55, 0, 1, 1],
  happy:    [0.06, 0.06, 0.10, 0.10, 1.00, 0, 1, 1],
  surprise: [0.14, 0.14, 0.00, 0.00, 0.00, 1, 1.25, 1.25],
  curious:  [0.12, -0.02, 0.15, -0.20, 0.30, 0, 1.08, 0.95],
  sad:      [0.04, 0.04, -0.45, -0.45, -0.80, 0, 0.85, 0.85],
  shy:      [0.05, 0.05, -0.20, -0.20, 0.80, 0, 0.30, 0.30],
  wink:     [0.08, -0.04, 0.10, -0.15, 1.00, 0, 1.05, 0.12],
  love:     [0.07, 0.07, 0.15, 0.15, 1.00, 0, 0.30, 0.30],
  sleepy:   [-0.05, -0.05, 0.10, 0.10, 0.20, 0, 0.15, 0.15],
  listen:   [0.10, 0.10, 0.05, 0.05, 0.50, 0, 1.12, 1.12],
  focus:    [-0.03, 0.10, -0.15, 0.20, 0.10, 0, 0.92, 1.05],
};
const BY_ACTION = { cheer: 'happy', jump: 'happy', wave: 'happy', dance: 'happy', clap: 'happy', heart: 'love', love: 'love', hug: 'love', toss: 'happy', spin: 'happy',
  giggle: 'shy', blush: 'shy', squint: 'shy', wink: 'wink', surprise: 'surprise', zap: 'surprise', highfive: 'happy', sad: 'sad', dizzy: 'curious', yawn: 'sleepy', munch: 'happy', stretch: 'happy', point: 'happy', shakeL: 'happy', shakeR: 'happy' };

export function faceTick(m, t, dt) {
  const g = m.girl; if (!g) return;
  const an = m.action && m.action.name;
  let key = (m.feel && t < m.feelUntil ? m.feel : null) || (an && BY_ACTION[an]) ||
    (m.mood === 'sleepy' ? 'sleepy' : m.mood === 'thinking' ? 'focus' : m.mood === 'listening' ? 'listen' : m.speaking ? 'happy' : 'neutral');
  const T = FACES[key] || FACES.neutral, f = g.f, k = 1 - Math.exp(-dt * 10);
  const tg = { bl: T[0], br: T[1], al: T[2], ar: T[3], smile: T[4], o: T[5], wl: T[6], wr: T[7] };
  if (key === 'neutral' || key === 'listen') { const w = Math.sin(t * 0.7) * 0.015; tg.bl += w; tg.br += w; } // คิ้วขยับเบาๆ ให้ดูมีชีวิต
  for (const x in tg) f[x] += (tg[x] - f[x]) * k;
  if (g.brows) g.brows.forEach((b) => {
    const B = b.userData.base, L = B.side < 0;
    b.position.y = B.y + (L ? f.bl : f.br);
    b.rotation.z = B.rz - B.side * (L ? f.al : f.ar); // บวก = ปลายคิ้วด้านนอกยกขึ้น
  });
  // ตา: ใช้ค่ากะพริบเดิมคูณกับรูปตาของอารมณ์ (ไม่ทับตอนหลับ/เวียนหัว)
  if (m.mood !== 'sleepy' || key === 'sleepy') m.eyes.forEach((e, i) => {
    const want = i ? f.wr : f.wl, bp = m.blinkT / 0.16, blink = m.blinkT >= 0 && bp < 1 ? Math.abs(1 - bp * 2) * 0.9 + 0.1 : 1;
    e.scale.y = Math.min(want, 1.3) * blink;
    e.scale.x = 1 + Math.max(0, want - 1) * 0.5;
  });
  // ปาก: พูด = ปากขยับเดิม · ไม่พูด = โค้งยิ้ม/บึ้ง หรือ O ตอนตกใจ
  const talking = m.speaking || m.mouth.scale.y > 0.11;
  if (f.o > 0.3 && !m.speaking) { m.mouth.visible = true; m.mouth.scale.set(0.12 + f.o * 0.05, 0.13 + f.o * 0.07, 0.12); g.smile.visible = false; m.tongue.visible = false; }
  else if (talking) { m.mouth.visible = true; g.smile.visible = false; }
  else {
    m.mouth.visible = false; g.smile.visible = true;
    const s = f.smile, a = Math.abs(s);
    g.smile.rotation.z = s >= 0 ? Math.PI : 0;             // ∪ ยิ้ม · ∩ บึ้ง
    g.smile.scale.set(0.7 + a * 0.5, 0.25 + a * 0.75, 1);
    g.smile.position.y = s >= 0 ? -0.3 : -0.46;
    g.smile.position.z = Math.sqrt(1.96 - g.smile.position.y ** 2) + (s >= 0 ? 0.005 : 0.05); g.smile.rotation.x = -Math.asin(g.smile.position.y / 1.4) * -1;
  }
  // หัวใจลอยตอนรัก/ดีใจมาก
  if (key === 'love' && Math.random() < dt * 5) {
    const h = new THREE.Mesh(g.heartGeo, new THREE.MeshBasicMaterial({ color: 0xFF5C9A, transparent: true }));
    h.position.set((Math.random() - 0.5) * 2.2, 0.6 + m.root.position.y, 1.3); h.userData.life = 1.6; h.userData.v = (Math.random() * 0.4 + 0.8);
    h.scale.setScalar(0.8 + Math.random() * 0.8); m.scene.add(h); g.hearts.push(h);
  }
  for (let i = g.hearts.length - 1; i >= 0; i--) {
    const h = g.hearts[i]; h.userData.life -= dt; h.position.y += h.userData.v * dt; h.position.x += Math.sin(t * 4 + i) * 0.004; h.rotation.y += dt * 2;
    h.material.opacity = Math.min(1, h.userData.life);
    if (h.userData.life <= 0) { m.scene.remove(h); h.material.dispose(); g.hearts.splice(i, 1); }
  }
}

