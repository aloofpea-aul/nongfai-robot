// น้องมีไฟ — มาสคอต 3D สร้างด้วยโค้ดทั้งตัว (three.js) ไม่ต้องใช้ไฟล์โมเดล
import * as THREE from 'three';
import { Marbles } from './marbles.js?v=11182365';

export class Mascot {
  constructor(container) {
    this.container = container;
    this.speaking = false;
    this.mood = 'normal';          // normal | listening | thinking | sleepy
    this.look = new THREE.Vector2(0, 0);
    this.lookTarget = new THREE.Vector2(0, 0);
    this.mouthOpen = 0.05;
    this.pulseUntil = 0;
    this.nextBlink = 1.5;
    this.blinkT = -1;
    this.nextGlance = 3;
    this.action = null;            // ท่าทางครั้งเดียว: wave | point | cheer | toss | spin | stretch | yawn
    this.idlePlay = false;         // ให้เล่นเองยามว่าง (แอปเปิด/ปิดให้)
    this.nextIdle = 12;
    this.pointSide = 'right';      // ชี้ไปทางการ์ด: right (จอกว้าง) | down (มือถือ)
    this.sparks = [];
    this.userSpin = 0; this.spinVel = 0; this.spunTotal = 0; // หมุนเล่นด้วยนิ้ว
    this.onTouch = null;           // แอปรับเหตุการณ์ไปพูดตอบ
    this.blush = 0;

    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(r.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    this.camera.position.set(0, 0, 9);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb9a6d6, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(2, 3, 5);
    this.scene.add(key);

    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.head = new THREE.Group();
    this.root.add(this.head);

    const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.4, metalness: 0.05, ...o });

    // หัวหลอดไฟ
    this.headMat = mat(0x7B3FB0, { emissive: 0x2a0f44, emissiveIntensity: 0.6 });
    const skull = new THREE.Mesh(new THREE.SphereGeometry(1.4, 64, 48), this.headMat); skull.userData.part = 'head';
    this.head.add(skull);

    // วงแสงรอบหัว
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xF5B942 });
    this.ring = new THREE.Mesh(new THREE.TorusGeometry(1.47, 0.045, 16, 120), this.ringMat);
    this.root.add(this.ring);

    // สายฟ้าบนหัว
    const s = new THREE.Shape();
    [[0.05, 0.42], [-0.17, 0.0], [0.0, 0.0], [-0.1, -0.34], [0.2, 0.1], [0.03, 0.1], [0.12, 0.42]]
      .forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    const bolt = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false }), mat(0xF5B942, { emissive: 0x8a5a00, emissiveIntensity: 0.5 }));
    bolt.position.set(0, 1.62, 0.2); bolt.userData.part = 'bolt'; this.bolt = bolt;
    this.head.add(bolt);

    // ตา
    this.eyes = [];
    for (const x of [-0.48, 0.48]) {
      const g = new THREE.Group();
      g.position.set(x, 0.15, 1.22);
      const white = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), mat(0xffffff, { roughness: 0.2 }));
      white.scale.set(0.22, 0.3, 0.13); white.userData.part = 'eye';
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16), mat(0x1E1030, { roughness: 0.2 }));
      pupil.scale.set(1, 1, 0.5);
      pupil.position.z = 0.1;
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      shine.position.set(0.04, 0.05, 0.17);
      pupil.add(shine);
      g.add(white, pupil);
      g.userData.pupil = pupil;
      this.head.add(g);
      this.eyes.push(g);
    }

    // แก้ม
    this.cheeks = [];
    for (const x of [-0.86, 0.86]) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), new THREE.MeshBasicMaterial({ color: 0xF28CB1, transparent: true, opacity: 0.75 }));
      c.userData.part = 'cheek'; this.cheeks.push(c);
      c.scale.set(0.2, 0.11, 0.05);
      c.position.set(x, -0.2, 1.06);
      c.lookAt(x * 3, -0.6, 4);
      this.head.add(c);
    }

    // ปาก
    this.mouth = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mat(0x1E1030));
    this.mouth.position.set(0, -0.4, 1.27); this.mouth.userData.part = 'mouth';
    this.head.add(this.mouth);
    this.tongue = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), mat(0xF2758F));
    this.tongue.position.set(0, -0.48, 1.31);
    this.head.add(this.tongue);

    // ขั้วหลอดไฟ
    [[0.62, -1.48], [0.52, -1.7], [0.36, -1.9]].forEach(([rad, y], i) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 0.95, 0.18, 40), mat([0xC9B8DD, 0xA992C6, 0x8C72AE][i]));
      c.position.y = y; c.userData.part = 'body';
      this.root.add(c);
    });

    // แขน 2 ข้าง: ไหล่ → แขนบน → ศอก → แขนล่าง → มือ (สร้างด้วยโค้ด)
    const armMat = mat(0x9B6BD3, { emissive: 0x2a0f44, emissiveIntensity: 0.35 }), handMat = mat(0xF5B942, { emissive: 0x8a5a00, emissiveIntensity: 0.35 });
    this.arms = [-1, 1].map((side) => {
      const sh = new THREE.Group(); sh.position.set(side * 1.25, -0.8, 0.35);
      const up = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.42, 6, 16), armMat); up.position.y = -0.27; sh.add(up);
      const el = new THREE.Group(); el.position.y = -0.56; sh.add(el);
      const lo = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.36, 6, 16), armMat); lo.position.y = -0.24; el.add(lo);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.19, 24, 16), handMat); hand.position.y = -0.52; el.add(hand);
      // จุดแตะมือให้ใหญ่กว่ามือจริง (นิ้วแตะง่าย)
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.42, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = -0.52; hit.userData.part = side < 0 ? 'handL' : 'handR'; el.add(hit);
      up.userData.part = lo.userData.part = 'arm';
      this.root.add(sh);
      return { side, sh, el, hand, a: 0.25, f: 0, e: -0.15 };
    });
    // โลโก้ กฟภ. สำหรับโยนเล่น (ใช้ไฟล์โลโก้ที่มีในระบบงานเวรแก้ไฟ)
    const logoMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
    new THREE.TextureLoader().load('/duty-roster/notice/pea.png', (tx) => { tx.colorSpace = THREE.SRGBColorSpace; logoMat.map = tx; logoMat.needsUpdate = true; }, undefined, () => {});
    this.logo = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.42, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.38, 48), logoMat); face.position.z = 0.01;
    const back = face.clone(); back.rotation.y = Math.PI; back.position.z = -0.01;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 10, 60), new THREE.MeshBasicMaterial({ color: 0xF5B942 }));
    this.logo.add(disc, face, back, rim); this.logo.visible = false;
    this.scene.add(this.logo);
    this.sparkGeo = new THREE.SphereGeometry(0.05, 8, 6);
    this.sparkMat = new THREE.MeshBasicMaterial({ color: 0xF5B942, transparent: true });
    this.marbles = new Marbles(this); // ลูกแก้วแอปในศูนย์รวมงาน

    this.clock = new THREE.Clock();
    this.setupTouch();
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    // จำกัดจำนวนภาพต่อวินาทีได้ (โหมดประหยัดพลังงาน): maxFps = 0 คือเต็มที่
    this.maxFps = 0; this._lastFrame = 0;
    this.renderer.setAnimationLoop((now) => {
      if (this.maxFps && now - this._lastFrame < 1000 / this.maxFps - 2) return;
      this._lastFrame = now;
      this.tick();
    });
  }

  resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    // ให้ทั้งตัวพอดีกรอบเสมอ ไม่ว่าจอจะแนวตั้งหรือแนวนอน
    const fitH = 5.0, fitW = 4.6; // เผื่อที่ให้แขนกางและโยนโลโก้
    const dist = Math.max(fitH / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))),
      fitW / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) / this.camera.aspect);
    this.camera.position.z = dist;
    this.camera.updateProjectionMatrix();
  }

  setMood(m) { this.mood = m; }
  pulse() { this.pulseUntil = this.clock.elapsedTime + 0.18; }
  gesture(name) {
    if (this.action && this.action.name === name) return;
    const dur = { wave: 1.9, point: 2.2, cheer: 1.6, toss: 2.6, spin: 1.5, stretch: 2.4, yawn: 2.2, shakeL: 2.0, shakeR: 2.0, giggle: 1.6, blush: 2.2, jump: 1.0, hug: 2.4, dizzy: 2.8, squint: 1.0, zap: 1.4, munch: 1.4, highfive: 1.2 }[name];
    if (!dur) return;
    this.action = { name, t0: this.clock.elapsedTime, dur };
    if (name === 'cheer') this.burst(14);
  }
  burst(n) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.sparkGeo, this.sparkMat.clone());
      m.position.set((Math.random() - 0.5) * 0.6, 1.4 + this.root.position.y, 0.6);
      m.userData.v = new THREE.Vector3((Math.random() - 0.5) * 3, 2 + Math.random() * 2, (Math.random() - 0.2) * 1.5);
      m.userData.life = 1.1;
      this.scene.add(m); this.sparks.push(m);
    }
  }
  lookAt(x, y) { this.lookTarget.set(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(y, -1, 1)); }

  tick() {
    const dt = Math.min(this.clock.getDelta(), this.maxFps && this.maxFps < 20 ? 0.25 : 0.05), t = this.clock.elapsedTime;
    const sleepy = this.mood === 'sleepy';

    // ลอยขึ้นลงเบาๆ
    this.root.position.y = Math.sin(t * 1.4) * (sleepy ? 0.02 : 0.06) + 0.25;

    // มองไปรอบๆ เองเป็นระยะ
    if (t > this.nextGlance && this.mood === 'normal') {
      this.lookAt((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.4);
      this.nextGlance = t + 2 + Math.random() * 3;
    }
    const tgt = this.mood === 'thinking' ? new THREE.Vector2(0.5, 0.6) : this.lookTarget;
    this.look.lerp(tgt, 1 - Math.exp(-dt * 5));
    this.head.rotation.y = this.look.x * 0.35;
    this.head.rotation.x = -this.look.y * 0.2 + (sleepy ? 0.18 : 0);
    for (const e of this.eyes) {
      e.userData.pupil.position.x = this.look.x * 0.07;
      e.userData.pupil.position.y = this.look.y * 0.08;
    }

    // กะพริบตา
    if (t > this.nextBlink && this.blinkT < 0) { this.blinkT = 0; }
    let eyeY = this.mood === 'listening' ? 1.12 : 1;
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      const p = this.blinkT / 0.16;
      eyeY *= p < 1 ? Math.abs(1 - p * 2) * 0.9 + 0.1 : 1;
      if (p >= 1) { this.blinkT = -1; this.nextBlink = t + 1.8 + Math.random() * 3.5; }
    }
    if (sleepy) eyeY = 0.15;
    const an = this.action && this.action.name;
    if (an === 'giggle' || an === 'squint' || an === 'hug') eyeY = 0.25;   // ตายิ้ม/หยีตา
    if (an === 'dizzy') { for (const e of this.eyes) { e.userData.pupil.position.x = Math.cos(t * 14) * 0.07; e.userData.pupil.position.y = Math.sin(t * 14) * 0.08; } }
    if (an === 'zap') this.bolt.rotation.z = Math.sin(t * 40) * 0.25; else this.bolt.rotation.z *= 0.8;
    for (const e of this.eyes) e.scale.y = eyeY;

    // ปากขยับตามเสียง
    let target = sleepy ? 0.03 : 0.06;
    if (this.speaking) {
      const n = (Math.sin(t * 17) + Math.sin(t * 23.3 + 1.7) + Math.sin(t * 9.1)) / 3;
      target = 0.12 + Math.abs(n) * 0.22 + (t < this.pulseUntil ? 0.1 : 0);
    }
    this.mouthOpen += (target - this.mouthOpen) * (1 - Math.exp(-dt * 22));
    this.mouth.scale.set(0.3 - this.mouthOpen * 0.25, this.mouthOpen, 0.09);
    this.tongue.visible = this.mouthOpen > 0.1;
    this.tongue.scale.set(0.16, Math.max(this.mouthOpen * 0.35, 0.01), 0.06);

    // วงแสง: กำลังฟัง = สว่างเต้นเป็นจังหวะ, ง่วง = จาง
    const glow = this.mood === 'listening' ? 0.75 + Math.sin(t * 6) * 0.25 : sleepy ? 0.35 : 1;
    this.ringMat.color.setRGB(0.96 * glow, 0.725 * glow, 0.26 * glow);
    this.ring.scale.setScalar(1 + (this.mood === 'listening' ? Math.sin(t * 6) * 0.015 : 0));
    this.headMat.emissiveIntensity = sleepy ? 0.1 : 0.6;

    this.animateArms(t, dt);
    this.renderer.render(this.scene, this.camera);
  }

  // ---------- ท่าทางแขน ----------
  // ค่าท่าของแขนแต่ละข้าง: a = กางออก/ยกขึ้น (0 = ห้อย, π = ชูตรง), f = ยื่นมาข้างหน้า (ลบ = เข้าหากล้อง), e = งอศอก (ลบ = งอเข้าหาตัว)
  animateArms(t, dt) {
    const P = (a, f, e) => ({ a, f, e });
    const sm = (x) => x * x * (3 - 2 * x);
    let L = P(0.25, 0.05, -0.15), Rt = P(0.25, 0.05, -0.15), rate = 7;
    const sleepy = this.mood === 'sleepy';
    // ท่าตามอารมณ์
    if (sleepy) { L = P(0.08, 0.15, 0); Rt = P(0.08, 0.15, 0); rate = 3; }
    else if (this.mood === 'thinking') { Rt = P(2.25, -0.2, -2.05 + Math.sin(t * 14) * 0.12); L = P(0.55, -0.7, -1.3); }
    else if (this.mood === 'listening') { L = P(2.15, -0.15, -2.0); Rt = P(0.35, -0.1, -0.3); }
    else if (this.speaking) {
      Rt = P(0.5 + Math.sin(t * 3.1) * 0.25, -0.35, -0.6 + Math.sin(t * 4.3) * 0.35);
      L = P(0.45 + Math.sin(t * 2.6 + 1.3) * 0.22, -0.3, -0.55 + Math.sin(t * 3.7 + 0.6) * 0.3);
    }
    // ท่าครั้งเดียว
    let spin = 0, extraMouth = 0, headTilt = 0;
    const A = this.action;
    if (A) {
      const p = (t - A.t0) / A.dur;
      if (p >= 1) { this.action = null; this.logo.visible = false; }
      else {
        rate = 12;
        const k = A.name;
        if (k === 'wave') Rt = P(2.8, -0.15, -0.35 + Math.sin(t * 11) * 0.5);
        else if (k === 'point') { if (this.pointSide === 'down') Rt = P(0.55, -1.15, -0.05); else Rt = P(1.5, -0.25, 0.05); headTilt = 0.08; }
        else if (k === 'cheer') { const b = Math.sin(t * 16) * 0.12; Rt = P(2.75 + b, -0.1, 0.2); L = P(2.75 - b, -0.1, 0.2); }
        else if (k === 'spin') { Rt = P(1.45, 0, 0); L = P(1.45, 0, 0); spin = sm(Math.min(1, p / 0.9)) * Math.PI * 2; }
        else if (k === 'stretch') { const h = p < 0.2 ? p / 0.2 : p > 0.8 ? (1 - p) / 0.2 : 1; Rt = P(3.0 * h + 0.25 * (1 - h), -0.05, 0); L = Rt; headTilt = Math.sin(t * 2) * 0.12 * h; }
        else if (k === 'shakeL' || k === 'shakeR') { const sh = P(1.15, -1.05, -0.2 + Math.sin(t * 13) * 0.28); if (k === 'shakeR') Rt = sh; else L = sh; }
        else if (k === 'highfive') Rt = P(2.4, -0.9, 0.1);
        else if (k === 'hug') { const h = P(1.35, -1.25, -1.1 + Math.sin(t * 3) * 0.08); L = h; Rt = h; }
        else if (k === 'giggle') { Rt = P(1.1, -1.2, -1.7); L = P(0.6, -0.4, -0.8); headTilt = Math.sin(t * 18) * 0.06; }
        else if (k === 'blush') { Rt = P(1.25, -1.15, -1.9); L = P(1.25, -1.15, -1.9); headTilt = 0.12; }
        else if (k === 'squint') { Rt = P(1.4, -1.0, -2.0); }
        else if (k === 'zap') { const b = Math.sin(t * 30) * 0.2; Rt = P(1.6 + b, 0, 0.3); L = P(1.6 - b, 0, 0.3); }
        else if (k === 'munch') { extraMouth = Math.abs(Math.sin(t * 12)) * 0.25; }
        else if (k === 'jump') { Rt = P(2.2, 0, 0.2); L = Rt; this.root.position.y += Math.sin(Math.min(1, p) * Math.PI) * 0.6; }
        else if (k === 'dizzy') { headTilt = Math.sin(t * 5) * 0.18; Rt = P(0.6 + Math.sin(t * 4) * 0.3, 0, -0.3); L = P(0.6 - Math.sin(t * 4) * 0.3, 0, -0.3); }
        else if (k === 'yawn') { Rt = P(1.0, -1.25, -1.65); extraMouth = p > 0.15 && p < 0.75 ? 0.32 : 0; }
        else if (k === 'toss') {
          // 0–0.2 ประคองโลโก้ · 0.2–0.85 โลโก้ลอยขึ้นแล้วตกกลับ · 0.85–1 รับไว้แล้วเก็บ
          const hold = P(0.75, -1.05, -1.1), ready = P(2.1, -0.5, -0.5);
          Rt = p < 0.2 || p > 0.85 ? hold : ready; L = Rt;
          this.logo.visible = p < 0.95;
          const base = new THREE.Vector3(0, -1.05 + this.root.position.y, 1.45); // ถือไว้ระดับอก ไม่บังหน้า
          if (p < 0.2 || p > 0.85) { this.logo.position.copy(base); this.logo.rotation.set(0, 0, 0); }
          else { const q = (p - 0.2) / 0.65; this.logo.position.set(0, base.y + 4 * q * (1 - q) * 3.9, 1.45); this.logo.rotation.y = q * Math.PI * 4; }
        }
      }
    }
    // ลูกแก้วแอป (ฟิสิกส์ + ท่าแขนตอนเล่น)
    const pose = this.marbles.tick(t, dt);
    if (!A && pose) { L = P(...pose.L); Rt = P(...pose.R); rate = 10; }
    // เล่นเองยามว่าง: สลับเล่นลูกแก้วกับท่าทางต่างๆ ถี่ขึ้น
    const free = !A && !this.speaking && this.mood === 'normal' && !this.marbles.busy;
    if (this.idlePlay && t > this.nextIdle && (free || sleepy) && !A) {
      if (sleepy) { this.gesture('yawn'); this.nextIdle = t + 25; }
      else if (Math.random() < 0.6) { this.marbles.start(); this.nextIdle = t + 13 + Math.random() * 7; }
      else { const opts = ['toss', 'spin', 'stretch', 'wave', 'cheer', 'jump']; this.gesture(opts[Math.floor(Math.random() * opts.length)]); this.nextIdle = t + 6 + Math.random() * 6; }
    } else if (!this.idlePlay) { if (this.marbles.game) this.marbles.clear(true); if (t > this.nextIdle) this.nextIdle = t + 8; }
    // ขยับไปหาท่าเป้าหมายแบบนุ่มๆ
    const k = 1 - Math.exp(-dt * rate);
    [[this.arms[0], L], [this.arms[1], Rt]].forEach(([arm, tg]) => {
      arm.a += (tg.a - arm.a) * k; arm.f += (tg.f - arm.f) * k; arm.e += (tg.e - arm.e) * k;
      arm.sh.rotation.x = arm.f;
      arm.sh.rotation.z = arm.side * arm.a;
      arm.el.rotation.z = arm.side * arm.e;
    });
    // หมุนเล่นด้วยนิ้ว: ปล่อยแล้วหมุนต่อตามแรงปัด แล้วค่อยๆ กลับมาหน้าตรง
    if (!this.dragging) {
      this.userSpin += this.spinVel * dt;
      this.spunTotal += Math.abs(this.spinVel * dt);
      this.spinVel *= Math.exp(-dt * 1.6);
      if (Math.abs(this.spinVel) < 0.6) {
        const home = Math.round(this.userSpin / (Math.PI * 2)) * Math.PI * 2;
        this.userSpin += (home - this.userSpin) * (1 - Math.exp(-dt * 4));
        if (this.spunTotal > Math.PI * 3) { this.spunTotal = 0; this.gesture('dizzy'); this.emit('dizzy'); }
        else if (Math.abs(this.spinVel) < 0.05) this.spunTotal = 0;
      }
    }
    this.root.rotation.y = spin + this.userSpin;
    // แก้มแดงตอนเขิน
    this.blush += ((this.action && this.action.name === 'blush' ? 1 : 0) - this.blush) * (1 - Math.exp(-dt * 6));
    for (const c of this.cheeks) { c.material.opacity = 0.75 + this.blush * 0.25; c.material.color.setRGB(0.95, 0.55 - this.blush * 0.25, 0.69 - this.blush * 0.3); }
    if (headTilt) this.head.rotation.z = headTilt; else this.head.rotation.z *= 0.9;
    if (extraMouth) this.mouth.scale.y = Math.max(this.mouth.scale.y, extraMouth);
    // ประกายดีใจ
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const m = this.sparks[i]; m.userData.life -= dt;
      m.userData.v.y -= 6 * dt; m.position.addScaledVector(m.userData.v, dt);
      m.material.opacity = Math.max(0, m.userData.life / 1.1);
      if (m.userData.life <= 0) { this.scene.remove(m); m.material.dispose(); this.sparks.splice(i, 1); }
    }
  }

  emit(kind, data) { try { this.onTouch && this.onTouch(kind, data); } catch {} }

  // ---------- หยอกเล่นด้วยการแตะ ----------
  setupTouch() {
    const cv = this.renderer.domElement, ray = new THREE.Raycaster(), v2 = new THREE.Vector2();
    cv.style.touchAction = 'none';
    const pick = (e) => {
      const r = cv.getBoundingClientRect();
      v2.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(v2, this.camera);
      const mb = this.marbles.hits(ray);
      if (mb) return { marble: mb };
      const hit = ray.intersectObjects(this.root.children, true).find((h) => h.object.userData.part);
      return hit ? hit.object.userData.part : null;
    };
    // ตำแหน่งแตะ → พิกัดแนวนอนในฉาก (ไว้ปล่อยลูกแก้วตรงที่แตะ)
    const worldX = (e) => { const r = cv.getBoundingClientRect(), h = 2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * (this.camera.position.z - 0.9); return (((e.clientX - r.left) / r.width) * 2 - 1) * h * this.camera.aspect / 2; };
    let down = null, lastTap = 0, longT = null;
    cv.addEventListener('pointerdown', (e) => {
      let part = pick(e), marble = null;
      if (part && part.marble) { marble = part.marble; part = null; }
      down = { x: e.clientX, y: e.clientY, t: performance.now(), part, marble, wx: worldX(e), lastX: e.clientX, lastT: performance.now(), moved: false };
      clearTimeout(longT);
      if (marble) longT = setTimeout(() => { if (down && !down.moved) { down.long = true; this.marbles.poke(marble); this.gesture('cheer'); this.emit('marbleOpen', marble.app); } }, 650);
      else if (part) longT = setTimeout(() => { if (down && !down.moved) { down.long = true; this.gesture('hug'); this.emit('hug'); } }, 650);
      try { cv.setPointerCapture(e.pointerId); } catch {}
    });
    cv.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - down.x;
      if (!down.moved && Math.abs(dx) > 10) { down.moved = true; clearTimeout(longT); this.dragging = true; this.dragBase = this.userSpin; }
      if (this.dragging) {
        const now = performance.now(), w = cv.clientWidth || 300;
        this.userSpin = this.dragBase + (dx / w) * Math.PI * 1.6;
        const dt = Math.max(1, now - down.lastT);
        this.spinVel = ((e.clientX - down.lastX) / w) * Math.PI * 1.6 / (dt / 1000);
        down.lastX = e.clientX; down.lastT = now;
      }
    });
    const up = () => {
      clearTimeout(longT);
      if (!down) return;
      const d = down; down = null;
      if (this.dragging) { this.dragging = false; this.spinVel = THREE.MathUtils.clamp(this.spinVel, -25, 25); if (Math.abs(this.spinVel) > 3) this.emit('spin'); return; }
      if (d.long) return;
      if (d.marble) { this.marbles.poke(d.marble); this.emit('marble', d.marble.app); return; }
      const now = performance.now();
      if (now - lastTap < 320) { this.gesture('cheer'); this.emit('double'); lastTap = 0; return; }
      lastTap = now;
      const map = { handL: 'shakeL', handR: 'shakeR', head: 'giggle', cheek: 'blush', eye: 'squint', bolt: 'zap', mouth: 'munch', body: 'jump', arm: 'highfive' };
      const g = d.part && map[d.part];
      if (g) { this.action = null; this.gesture(g); if (g === 'zap' || g === 'highfive') this.burst(10); this.emit(d.part); }
      else { if (this.mood !== 'sleepy' && this.marbles.list.length < 10) { const b = this.marbles.drop(d.wx); this.emit('marbleDrop', b.app); } else this.emit('none'); }
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  }
}
