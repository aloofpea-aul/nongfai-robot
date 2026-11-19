// อัดเสียงเป็น WAV 16 kHz แล้วหยุดเองเมื่อคนพูดจบ — ใช้บน iPad/iPhone ที่ระบบฟังเสียงของเบราว์เซอร์ใช้ไม่ได้
// เสียงที่อัดจะส่งให้ Gemini ถอดความและตอบในครั้งเดียว (ฟรี)
export class WavRecorder {
  constructor() { this.ctx = null; this._stop = null; }

  // เรียกทันทีในจังหวะที่ผู้ใช้แตะ (iOS ต้องเปิด AudioContext ในจังหวะแตะ)
  prime() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state !== 'running') this.ctx.resume();
  }

  get active() { return !!this._stop; }
  stop() { if (this._stop) this._stop(true); }
  cancel() { if (this._stop) this._stop(false); }

  // ถือว่า "เริ่มพูด" เมื่อเสียงดังแบบเสียงคนต่อเนื่อง ~0.25 วิ (กันเสียงประตู ไอ จาม เคาะโต๊ะ) และต้องพูดรวม ≥ minSpeechMs
  async record({ maxMs = 20000, silenceMs = 1500, noSpeechMs = 8000, minSpeechMs = 450, onSpeech } = {}) {
    this.prime();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const ctx = this.ctx;
    const src = ctx.createMediaStreamSource(stream);
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    const chunks = [];
    const t0 = performance.now();
    let speech = false, lastLoud = 0, floor = 0, speechChunk = 0, run = 0, voiced = 0;

    return new Promise((resolve) => {
      const finish = (ok) => {
        if (!this._stop) return;
        this._stop = null;
        proc.onaudioprocess = null;
        try { proc.disconnect(); src.disconnect(); } catch {}
        stream.getTracks().forEach((t) => t.stop()); // ปล่อยไมค์ เสียงพูดจะได้ออกลำโพงดังตามปกติ
        // ปิด AudioContext ของไมค์ทิ้ง ให้ไอโฟนคืนเสียงลำโพงให้ระบบพูด (สร้างใหม่ตอนแตะไมค์ครั้งหน้า)
        const rate = ctx.sampleRate; ctx.close().catch(() => {}); this.ctx = null;
        if (!ok || !speech || voiced < minSpeechMs) return resolve(null);
        // เก็บเสียงตั้งแต่ก่อนเริ่มพูดเล็กน้อย ตัดความเงียบช่วงต้นทิ้ง
        resolve({ b64: encodeWav(chunks.slice(Math.max(0, speechChunk - 6)), rate), mime: 'audio/wav' });
      };
      this._stop = finish;
      proc.onaudioprocess = (e) => {
        const d = e.inputBuffer.getChannelData(0);
        chunks.push(new Float32Array(d));
        let s = 0; for (let i = 0; i < d.length; i++) s += d[i] * d[i];
        const rms = Math.sqrt(s / d.length), now = performance.now() - t0;
        if (now < 300) { floor = Math.max(floor, rms); return; }
        let zc = 0; for (let i = 1; i < d.length; i++) if ((d[i] >= 0) !== (d[i - 1] >= 0)) zc++;
        const zcr = zc / d.length, ms = (d.length / ctx.sampleRate) * 1000;
        const loud = rms > Math.max(0.014, floor * 2.4) && zcr > 0.01 && zcr < 0.35; // ช่วงความถี่แบบเสียงพูด
        if (loud) {
          run++;
          if (speech) voiced += ms;
          else if (run >= 3) { speech = true; voiced = run * ms; speechChunk = chunks.length - run; onSpeech?.(); }
          lastLoud = now;
        } else run = 0;
        if (speech && now - lastLoud > silenceMs) finish(true);
        else if (!speech && now > noSpeechMs) finish(false);
        else if (now > maxMs) finish(true);
      };
      src.connect(proc);
      proc.connect(ctx.destination);
    });
  }
}

function encodeWav(chunks, rate, outRate = 16000) {
  let len = 0; for (const c of chunks) len += c.length;
  const all = new Float32Array(len); let o = 0;
  for (const c of chunks) { all.set(c, o); o += c.length; }
  const ratio = rate / outRate, n = Math.floor(len / ratio);
  const buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (p, s) => { for (let i = 0; i < s.length; i++) v.setUint8(p + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, outRate, true); v.setUint32(28, outRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * ratio), b = Math.min(len, Math.floor((i + 1) * ratio));
    let sum = 0; for (let j = a; j < b; j++) sum += all[j];
    const x = Math.max(-1, Math.min(1, sum / Math.max(1, b - a)));
    v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true);
  }
  const bytes = new Uint8Array(buf); let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
