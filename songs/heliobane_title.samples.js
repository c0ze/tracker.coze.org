/**
 * Heliobane (MUSIC-A) synthesized samples (raw PCM / single-cycle loops).
 * Used by heliobane_{title,stage1,boss,stage2,clear,gameover}.gen.js. It is named
 * heliobane_title.* only because that agent may create heliobane_<own id>.* files.
 * Everything is synthesized here (no library/ dependency, nothing to license).
 */

const SR = 22050, MID_C = 261.6256, TAU = 2 * Math.PI;
const q3 = (x) => Math.round(x * 1000) / 1000;

function rand(seed) { // mulberry32, -1..1
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let v = Math.imul(s ^ (s >>> 15), s | 1);
    v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
    return (((v ^ (v >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}
function normalize(a, peak = 0.97) {
  let m = 0; for (const v of a) m = Math.max(m, Math.abs(v));
  return a.map((v) => (v / m) * peak);
}
function render(sec, fn, rate = SR) {
  const n = Math.round(sec * rate), out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / rate, i);
  for (let i = 0; i < 48; i++) out[n - 1 - i] *= i / 48; // no click at the end
  return out;
}
const oneShot = (name, data, extra = {}) => ({ name, samplerate: SR, channels: [normalize(data).map(q3)], ...extra });
const metal = (t) => [205.3, 304.4, 369.6, 522.7, 540, 800].reduce((s, f) => s + (Math.sin(TAU * f * t) > 0 ? 1 : -1), 0) / 6;

/** Punchy kick: click transient + pitch-swept sine body, soft-clipped. */
export function kick({ f0 = 220, f1 = 55, sweep = 36, decay = 11, click = 0.55, drive = 2.4, sec = 0.34 } = {}) {
  const r = rand(11); let ph = 0;
  return oneShot('kick', render(sec, (t) => {
    ph += TAU * (f1 + (f0 - f1) * Math.exp(-sweep * t)) / SR;
    const body = Math.sin(ph) * Math.exp(-decay * t);
    const clk = (r() * Math.exp(-t * 1400) + Math.sin(TAU * 2100 * t) * Math.exp(-t * 700) * 0.6) * click;
    return Math.tanh(drive * (body + clk)) / Math.tanh(drive);
  }), { role: 'percussion' });
}
/** Snare: two-mode tone body + bright noise + crack. */
export function snare({ tone = 188, decay = 16, sec = 0.26, seed = 7, drive = 1.8 } = {}) {
  const r = rand(seed); let prev = 0;
  return oneShot('snare', render(sec, (t) => {
    const w = r(), hp = w - prev; prev = w;
    const body = (Math.sin(TAU * tone * t) * Math.exp(-t * 26) + 0.5 * Math.sin(TAU * tone * 1.71 * t) * Math.exp(-t * 38)) * 0.8;
    const nz = (0.6 * hp + 0.45 * w) * Math.exp(-t * decay) + w * Math.exp(-t * 320) * 0.7;
    return Math.tanh(drive * (body + nz));
  }), { role: 'percussion' });
}
/** Metallic hat / crash: 808-style square cluster + noise, twice differentiated. */
export function cymbal(name, { sec = 0.07, decay = 60, seed = 3, metalMix = 0.55 } = {}) {
  const r = rand(seed); let x1 = 0, x2 = 0;
  return oneShot(name, render(sec, (t) => {
    const x = metalMix * metal(t * 1.7) + (1 - metalMix) * r();
    const y = x - 2 * x1 + x2; x2 = x1; x1 = x;
    return y * Math.exp(-decay * t) * Math.min(1, t * 4000);
  }), { role: 'percussion' });
}
/** Tom: pitched sweep, play it lower/higher with the note. */
export function tom() {
  let ph = 0; const r = rand(21);
  return oneShot('tom', render(0.4, (t) => {
    ph += TAU * (105 + 70 * Math.exp(-t * 22)) / SR;
    return Math.tanh(1.6 * (Math.sin(ph) * Math.exp(-t * 9) + r() * Math.exp(-t * 90) * 0.3));
  }), { role: 'percussion' });
}
/** Orchestra hit (root+5th+octaves, no third): C-5 plays middle C with a sub octave. */
export function orchHit({ sec = 0.95 } = {}) {
  const r = rand(5), voices = [[0.5, 0.8], [1, 1], [1.5, 0.75], [2, 0.6], [3, 0.3]];
  return oneShot('orchestra hit', render(sec, (t) => {
    let s = 0;
    for (const [ratio, w] of voices) for (const det of [0.996, 1.004]) {
      const f = MID_C * ratio * det;
      for (let k = 1; k * f < SR / 2 && k < 40; k++) s += w * Math.sin(TAU * k * f * t) / k * Math.exp(-t * (2.2 + 0.3 * k));
    }
    return s * Math.min(1, t * 250) + r() * Math.exp(-t * 30) * 1.2;
  }), { c5speed: SR });
}
/** Looped white noise for risers (slide it with F/E). */
export function noiseLoop() {
  const r = rand(99), d = render(0.4, () => r());
  for (let i = 0; i < 48; i++) d[d.length - 1 - i] = r(); // loop, no fade
  return { name: 'noise loop', samplerate: SR, channels: [normalize(d, 0.8).map(q3)], loop: { start: 0, end: d.length } };
}
/** Single-cycle additive wave from harmonic amplitudes (loop, C-5 = middle C). */
export function wave(name, amps, cyc = 128) {
  const d = []; for (let i = 0; i < cyc; i++) d.push(amps.reduce((s, a, k) => s + a * Math.sin(TAU * (k + 1) * i / cyc), 0));
  return { name, samplerate: 44100, c5speed: Math.round(cyc * MID_C), channels: [normalize(d, 0.95).map(q3)], loop: { start: 0, end: cyc } };
}
/** Distorted power chord (root+5th+octave) as one loop: C-5 plays a C power chord. */
export function powerChord(name, { drive = 4, cyc = 256 } = {}) {
  const d = [];
  for (let i = 0; i < cyc; i++) {
    let s = 0;
    for (const [mult, w] of [[2, 1], [3, 0.75], [4, 0.45]]) for (let k = 1; k <= 12; k++) s += w * Math.sin(TAU * k * mult * i / cyc) / k;
    d.push(Math.tanh(drive * s / 3));
  }
  return { name, samplerate: 44100, c5speed: Math.round((cyc / 2) * MID_C), channels: [normalize(d, 0.9).map(q3)], loop: { start: 0, end: cyc } };
}
export const BASS_AMPS = [1, 0.62, 0.45, 0.3, 0.25, 0.18, 0.14, 0.11, 0.09, 0.08, 0.07, 0.06];
export const BRASS_AMPS = Array.from({ length: 20 }, (_, k) => (k === 1 ? 0.8 : 1 / (k + 1) ** 1.15));
/** Amiga-style PWM lead: a loop of `cycles` pulses whose width sweeps hi→lo→hi. */
export function pwm(name, { cycles = 96, cyc = 64, lo = 0.13, hi = 0.5 } = {}) {
  const d = [];
  for (let c = 0; c < cycles; c++) {
    const duty = hi - (hi - lo) * (0.5 - 0.5 * Math.cos(TAU * c / cycles));
    const high = Math.round(duty * cyc), mean = (2 * high - cyc) / cyc;
    for (let j = 0; j < cyc; j++) d.push((j < high ? 1 : -1) - mean);
  }
  return { name, samplerate: 44100, c5speed: Math.round(cyc * MID_C), channels: [normalize(d, 0.9).map(q3)], loop: { start: 0, end: d.length } };
}
/** Detuned three-saw loop (strings/pad); `spread` = extra cycles per loop. */
export function superSaw(name, { base = 100, cyc = 96, spread = 1 } = {}) {
  const L = base * cyc, d = new Array(L).fill(0);
  for (const m of [base, base - spread, base + spread]) {
    for (let k = 1; k * m < L * 0.42; k++) {
      const ph = (k * 1.618 + m) % 1;
      for (let i = 0; i < L; i++) d[i] += Math.sin(TAU * (k * m * i / L + ph)) / k;
    }
  }
  return { name, samplerate: 44100, c5speed: Math.round(cyc * MID_C), channels: [normalize(d, 0.9).map(q3)], loop: { start: 0, end: L } };
}
