// น้องมีไฟ — มาสคอต 3D สร้างด้วยโค้ดทั้งตัว (three.js) ไม่ต้องใช้ไฟล์โมเดล
import * as THREE from 'three';

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
    const skull = new THREE.Mesh(new THREE.SphereGeometry(1.4, 64, 48), this.headMat);
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
    bolt.position.set(0, 1.62, 0.2);
    this.head.add(bolt);

    // ตา
    this.eyes = [];
    for (const x of [-0.48, 0.48]) {
      const g = new THREE.Group();
      g.position.set(x, 0.15, 1.22);
      const white = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), mat(0xffffff, { roughness: 0.2 }));
      white.scale.set(0.22, 0.3, 0.13);
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
    for (const x of [-0.86, 0.86]) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), new THREE.MeshBasicMaterial({ color: 0xF28CB1, transparent: true, opacity: 0.75 }));
      c.scale.set(0.2, 0.11, 0.05);
      c.position.set(x, -0.2, 1.06);
      c.lookAt(x * 3, -0.6, 4);
      this.head.add(c);
    }

    // ปาก
    this.mouth = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), mat(0x1E1030));
    this.mouth.position.set(0, -0.4, 1.27);
    this.head.add(this.mouth);
    this.tongue = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), mat(0xF2758F));
    this.tongue.position.set(0, -0.48, 1.31);
    this.head.add(this.tongue);

    // ขั้วหลอดไฟ
    [[0.62, -1.48], [0.52, -1.7], [0.36, -1.9]].forEach(([rad, y], i) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 0.95, 0.18, 40), mat([0xC9B8DD, 0xA992C6, 0x8C72AE][i]));
      c.position.y = y;
      this.root.add(c);
    });

    this.clock = new THREE.Clock();
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  resize() {
    const w = this.container.clientWidth || 1, h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.camera.aspect = w / h;
    // ให้ทั้งตัวพอดีกรอบเสมอ ไม่ว่าจอจะแนวตั้งหรือแนวนอน
    const fitH = 4.6, fitW = 3.6;
    const dist = Math.max(fitH / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))),
      fitW / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) / this.camera.aspect);
    this.camera.position.z = dist;
    this.camera.updateProjectionMatrix();
  }

  setMood(m) { this.mood = m; }
  pulse() { this.pulseUntil = this.clock.elapsedTime + 0.18; }
  lookAt(x, y) { this.lookTarget.set(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(y, -1, 1)); }

  tick() {
    const dt = Math.min(this.clock.getDelta(), 0.05), t = this.clock.elapsedTime;
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

    this.renderer.render(this.scene, this.camera);
  }
}
