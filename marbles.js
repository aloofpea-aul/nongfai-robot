// ลูกแก้วแอป: โลโก้ (ไอคอน) ของทุกแอปในศูนย์รวมงานอยู่ในลูกแก้วใส ให้น้องมีไฟเล่นยามว่าง
// แตะลูกแก้ว = เด้ง + บอกชื่อแอป · แตะค้าง = เปิดแอปนั้น
import * as THREE from 'three';

export const HUB_APPS = [
  { e: '🗺️', n: 'Single Line Diagram', p: '/sld-ala/' }, { e: '🔌', n: 'สำรวจหม้อแปลง', p: '/sld-ala/transformer-survey/' },
  { e: '🚶', n: 'Patrol ระบบจำหน่าย', p: '/sld-ala/patrol-index.html' }, { e: '🌳', n: 'งานตัดต้นไม้', p: '/tree-ala/' },
  { e: '📊', n: 'สถิติไฟดับ', p: '/pea-analytics-data/' }, { e: '⚡', n: 'วิเคราะห์โหลด Load01', p: '/load01/' },
  { e: '🏗️', n: 'CCL ควบคุมงานก่อสร้าง', p: '/ccl/' }, { e: '📏', n: 'สำรวจงานก่อสร้าง', p: '/construction/' },
  { e: '🗓️', n: 'งานเวรแก้ไฟ', p: '/duty-roster/' }, { e: '🛰️', n: 'ห้องควบคุมรถแก้ไฟ', p: '/ops/' },
  { e: '⛈️', n: 'ประกาศเตือนภัยกรมอุตุ', p: '/tmd/' }, { e: '🏆', n: 'สรุปลงเวลา', p: '/pea-checkin/dashboard_mobile.html' },
  { e: '📄', n: 'ออกเลขหนังสือ', p: '/booknum/' }, { e: '💰', n: 'ตัดงบทำการ', p: '/budget/' },
  { e: '🩺', n: 'ใบเบิกค่ารักษาพยาบาล', p: '/medical/' }, { e: '🛒', n: 'งานจัดซื้อจัดจ้าง', p: '/procure/' },
  { e: '📦', n: 'คลังพัสดุ', p: '/stock/' }, { e: '🏷️', n: 'ทรัพย์สิน ผปร.', p: '/asset/' },
  { e: '🔋', n: 'จัดซื้อหม้อแปลง', p: '/tfbuy/' }, { e: '🚗', n: 'ยานพาหนะ', p: '/vehicle/' },
  { e: '🎯', n: 'KPI กฟต.2', p: '/kpi-pea-region2-2569/' }, { e: '📋', n: 'แผน K04', p: '/k04/' },
  { e: '🤝', n: 'แผนงานระดมทีม', p: '/teamplan-krabi/' }, { e: '🛡️', n: 'Office Love', p: '/office-love/' },
  { e: '⛑️', n: 'Safety Talk', p: '/safety-talk/' }, { e: '📐', n: 'แบบมาตรฐาน กฟภ.', p: '/pea-drawings/' },
  { e: '⚖️', n: 'กฎหมายและระเบียบ', p: '/regulations/' }, { e: '📚', n: 'หนังสือ คู่มือ', p: '/pea-drawings/books.html' },
];
const TINTS = [0x8fd3ff, 0xc9a7ff, 0xffd27a, 0x9cf0c4, 0xff9fc4, 0xa7b8ff, 0x7fe3e0, 0xffb38a];

// แก้วใส: ขอบสว่าง (fresnel) + แสงสะท้อน 2 จุด · เบา ไม่ต้องใช้ภาพสะท้อนรอบข้าง
const V = `varying vec3 vN; varying vec3 vV;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const F = `uniform vec3 uTint; uniform float uFade; varying vec3 vN; varying vec3 vV;
void main(){
  float f = pow(1.0 - max(dot(vN, vV), 0.0), 1.9);
  vec3 L = normalize(vec3(-0.45, 0.75, 0.6)); float sp = pow(max(dot(vN, normalize(L + vV)), 0.0), 90.0) * 1.4;
  vec3 L2 = normalize(vec3(0.5, -0.55, 0.5)); float sp2 = pow(max(dot(vN, normalize(L2 + vV)), 0.0), 18.0) * 0.22;
  vec3 c = mix(uTint * 0.75, uTint * 1.15, f) + vec3(sp + sp2);
  gl_FragColor = vec4(c, clamp((0.07 + f * 0.8 + sp + sp2) * uFade, 0.0, 1.0));
  #include <colorspace_fragment>
}`;
const iconTex = new Map();
function emojiTexture(e) {
  if (iconTex.has(e)) return iconTex.get(e);
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '88px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.fillText(e, 64, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; iconTex.set(e, t); return t;
}

const R = 0.4, FLOOR = -2.2, WALL = 2.0;
const geo = new THREE.SphereGeometry(R, 32, 24);
const hitGeo = new THREE.SphereGeometry(R * 1.5, 8, 6);

class Marble {
  constructor(app, tint) {
    this.app = app;
    this.mat = new THREE.ShaderMaterial({ vertexShader: V, fragmentShader: F, transparent: true, depthWrite: false, uniforms: { uTint: { value: new THREE.Color(tint) }, uFade: { value: 1 } } });
    this.g = new THREE.Group();
    this.icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture(app.e), transparent: true, depthWrite: false }));
    this.icon.scale.setScalar(R * 1.35);
    this.shell = new THREE.Mesh(geo, this.mat); this.shell.renderOrder = 2;
    const hit = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false })); hit.userData.marble = this;
    this.g.add(this.icon, this.shell, hit);
    this.v = new THREE.Vector3(); this.free = false; this.life = 1; this.dying = false; this.scale = 0.01; this.spinV = 0;
  }
  set fade(a) { this.mat.uniforms.uFade.value = a; this.icon.material.opacity = a; }
}

export class Marbles {
  constructor(mascot) {
    this.m = mascot; this.list = []; this.game = null; this.group = new THREE.Group();
    mascot.scene.add(this.group);
    this.nextGame = 6;
  }
  get busy() { return !!this.game || this.list.length > 0; }
  pick(n) {
    const pool = [...HUB_APPS].sort(() => Math.random() - 0.5).slice(0, n);
    return pool.map((a, i) => { const mb = new Marble(a, TINTS[(i + Math.floor(Math.random() * 8)) % TINTS.length]); this.group.add(mb.g); this.list.push(mb); return mb; });
  }
  handPos(side) { const v = new THREE.Vector3(); this.m.arms[side < 0 ? 0 : 1].hand.getWorldPosition(v); return v; }
  clear(soft = true) {
    this.game = null;
    for (const b of this.list) { if (soft) { b.free = true; b.dying = b.dying || 1.6 + Math.random() * 0.6; } else b.dying = 0.001; }
  }
  // เริ่มเกมยามว่าง (คืน false ถ้าไม่ได้เริ่ม)
  start(name) {
    if (this.game) return false;
    const games = ['juggle', 'orbit', 'rain', 'roll', 'fountain'];
    name = name || games[Math.floor(Math.random() * games.length)];
    const t = this.m.clock.elapsedTime;
    if (name === 'juggle') this.game = { name, t0: t, dur: 7, balls: this.pick(3) };
    else if (name === 'orbit') this.game = { name, t0: t, dur: 7, balls: this.pick(5) };
    else if (name === 'rain') { this.game = { name, t0: t, dur: 7, balls: this.pick(6) }; this.game.balls.forEach((b, i) => { b.free = true; b.scale = 1; b.g.position.set(-1.7 + i * 0.68 + (Math.random() - 0.5) * 0.2, 3 + i * 0.5, 0.6 + Math.random() * 0.5); b.v.set((Math.random() - 0.5) * 0.6, 0, 0); }); }
    else if (name === 'roll') { this.game = { name, t0: t, dur: 7, balls: this.pick(4) }; this.game.balls.forEach((b, i) => { b.free = true; b.scale = 1; b.g.position.set(-WALL - 0.4 - i * 0.75, FLOOR + R, 0.9); b.v.set(2.2 + Math.random() * 0.6, 0, 0); }); }
    else if (name === 'fountain') { this.game = { name, t0: t, dur: 6, balls: this.pick(7), shot: 0 }; this.game.balls.forEach((b) => { b.g.visible = false; }); }
    return true;
  }
  tick(t, dt) {
    const G = this.game, m = this.m, sm = (x) => x * x * (3 - 2 * x);
    let pose = null; // ท่าแขนระหว่างเล่น {L, R}
    if (G) {
      const p = (t - G.t0) / G.dur, T = t - G.t0;
      if (p >= 1 || m.mood === 'sleepy' || m.speaking || m.mood === 'listening' || m.mood === 'thinking') { this.clear(true); }
      else if (G.name === 'juggle') {
        // โยนสลับมือแบบนักกายกรรม 3 ลูก
        const speed = 0.95, hl = new THREE.Vector3(-0.95, -1.05 + m.root.position.y, 1.3), hr = new THREE.Vector3(0.95, -1.05 + m.root.position.y, 1.3);
        G.balls.forEach((b, i) => {
          b.scale = Math.min(1, b.scale + dt * 3);
          const ph = (T * speed + i / 3) % 1, fromL = Math.floor(T * speed + i / 3) % 2 === 0;
          const a = fromL ? hl : hr, c = fromL ? hr : hl;
          b.g.position.lerpVectors(a, c, ph); b.g.position.y += Math.sin(ph * Math.PI) * 2.3; b.g.position.z += Math.sin(ph * Math.PI) * 0.3;
          b.spinV = 4;
        });
        const bob = Math.sin(T * speed * Math.PI * 2);
        pose = { L: [1.15 + bob * 0.25, -1.0, -0.9], R: [1.15 - bob * 0.25, -1.0, -0.9] };
        m.lookAt(0, 0.5);
      } else if (G.name === 'orbit') {
        // ลูกแก้วโคจรรอบหัวเหมือนดาวเคราะห์
        const cy = 0.15 + m.root.position.y;
        G.balls.forEach((b, i) => {
          b.scale = Math.min(1, b.scale + dt * 2);
          const ang = T * 1.6 + (i / G.balls.length) * Math.PI * 2, rad = 1.85 + Math.sin(T * 2 + i) * 0.1;
          b.g.position.set(Math.cos(ang) * rad, cy + Math.sin(ang * 2) * 0.35, Math.sin(ang) * rad * 0.6 + 0.3);
          b.spinV = 2;
        });
        pose = { L: [1.9 + Math.sin(T * 3) * 0.2, -0.2, -0.3], R: [1.9 - Math.sin(T * 3) * 0.2, -0.2, -0.3] };
        m.lookAt(Math.cos(T * 1.6) * 0.6, 0.2);
        if (p > 0.82) G.balls.forEach((b) => { if (!b.free) { b.free = true; b.v.set(-b.g.position.z * 0.5, 1.5, 0); } }); // ปล่อยลงพื้นตอนจบ
      } else if (G.name === 'rain') {
        const lowest = G.balls.reduce((a, b) => (b.g.position.y < a.g.position.y ? b : a), G.balls[0]);
        m.lookAt(lowest.g.position.x / 2, -0.6);
        pose = { L: [2.7, -0.1, 0.2], R: [2.7, -0.1, 0.2] };
        if (T > 1.2) pose = { L: [0.9, -0.6, -0.5], R: [0.9, -0.6, -0.5] };
      } else if (G.name === 'roll') {
        const lead = G.balls[0]; m.lookAt(THREE.MathUtils.clamp(lead.g.position.x / 2, -1, 1), -0.7);
        pose = { L: [0.4, -0.3, -0.6], R: [0.6 + Math.sin(T * 6) * 0.2, -0.8, -0.3] };
      } else if (G.name === 'fountain') {
        // ยิงลูกแก้วขึ้นจากสายฟ้าบนหัวทีละลูก
        const n = Math.min(G.balls.length, Math.floor(T / 0.45));
        for (; G.shot < n; G.shot++) {
          const b = G.balls[G.shot]; b.g.visible = true; b.free = true; b.scale = 0.2;
          b.g.position.set(0, 1.9 + m.root.position.y, 0.4); b.v.set((Math.random() - 0.5) * 3.2, 4.2 + Math.random() * 1.2, 0.6 + Math.random() * 0.6);
          m.burst(4); m.pulse();
        }
        pose = { L: [2.5, -0.1, 0.1], R: [2.5, -0.1, 0.1] };
        m.lookAt(0, 0.9);
      }
    }
    // ฟิสิกส์ลูกที่เป็นอิสระ: แรงโน้มถ่วง เด้งพื้น ชนขอบ กลิ้ง
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i], P = b.g.position;
      if (b.free) {
        b.scale = Math.min(1, b.scale + dt * 3);
        b.v.y -= 9 * dt; P.addScaledVector(b.v, dt);
        if (P.y < FLOOR + R) { P.y = FLOOR + R; if (b.v.y < -0.4) { b.v.y *= -0.62; } else b.v.y = 0; b.v.x *= 0.985; b.v.z *= 0.9; }
        if (P.z > 1.4) { P.z = 1.4; b.v.z *= -0.5; } if (P.z < -0.5) { P.z = -0.5; b.v.z *= -0.5; }
        if (this.game && this.game.name === 'roll') { if (P.x > WALL + 0.8) { b.dying = 0.001; } }
        else if (Math.abs(P.x) > WALL) { P.x = Math.sign(P.x) * WALL; b.v.x *= -0.7; }
        b.spinV = -b.v.x / R;
      }
      b.icon.material.rotation -= b.spinV * dt * 0.5;
      if (b.dying) {
        b.dying -= dt;
        if (b.dying <= 0) { if (Math.abs(P.x) < WALL + 0.5) this.sparkAt(P); this.group.remove(b.g); b.mat.dispose(); b.icon.material.dispose(); this.list.splice(i, 1); continue; }
        if (b.dying < 0.35) b.scale = Math.max(0.01, b.dying / 0.35);
      }
      b.g.scale.setScalar(b.scale);
    }
    if (!this.list.length) this.game = null;
    return pose;
  }
  sparkAt(p) {
    const m = this.m;
    for (let i = 0; i < 6; i++) {
      const s = new THREE.Mesh(m.sparkGeo, m.sparkMat.clone()); s.position.copy(p);
      s.userData.v = new THREE.Vector3((Math.random() - 0.5) * 2.5, 1 + Math.random() * 2, (Math.random() - 0.5) * 1); s.userData.life = 0.8;
      m.scene.add(s); m.sparks.push(s);
    }
  }
  // แตะลูกแก้ว: เด้งขึ้น
  poke(b) {
    if (!b.free) { b.free = true; b.v.set(0, 0, 0); }
    b.v.y = 4.5; b.v.x += (Math.random() - 0.5) * 1.5; b.dying = Math.max(b.dying || 0, 3);
    this.sparkAt(b.g.position); this.m.lookAt(b.g.position.x / 2, b.g.position.y / 2);
  }
  // ปล่อยลูกแก้วลูกเดียวให้แตะเล่น (ตอนแตะพื้นที่ว่าง)
  drop(x) {
    const [b] = this.pick(1); b.free = true; b.scale = 1; b.g.position.set(THREE.MathUtils.clamp(x, -1.8, 1.8), 2.6, 0.9); b.v.set(0, 0, 0); b.dying = 6;
    return b;
  }
  hits(ray) { const h = ray.intersectObjects(this.group.children, true).find((x) => x.object.userData.marble); return h ? h.object.userData.marble : null; }
}
