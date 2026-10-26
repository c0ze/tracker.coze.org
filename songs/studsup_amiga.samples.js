/**
 * STUDS UP (Amiga port) synthesized samples, shared by the studsup_*_amiga
 * generators (studsup_amiga.kit.js re-exports them). Everything is made here:
 * no library/ files, nothing to license. Sized for chip RAM: drums are short
 * one-shots at 11,025 Hz (json2mod never upsamples, so a drum played at C-5
 * stays near that rate), tones are single-cycle loops of 64-128 samples.
 * After heliobane_title.samples.js (its rand, kick, snare, cymbal, wave);
 * changed: rates, lengths, the organ, the clap and the pulse.
 */

const MID_C = 261.6256, TAU = 2 * Math.PI;
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
function render(sec, rate, fn) {
  const n = Math.round(sec * rate), out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / rate, i);
  for (let i = 0; i < 24; i++) out[n - 1 - i] *= i / 24; // no click at the end
  return out;
}
const shot = (name, rate, data) => ({ name, samplerate: rate, channels: [normalize(data).map(q3)], role: 'percussion' });

/** Kick: pitch-swept sine body and a click, soft-clipped. 0.2 s at 11 kHz. */
export function kick({ f0 = 190, f1 = 52, sweep = 32, decay = 13, sec = 0.2 } = {}) {
  const SR = 11025, r = rand(11); let ph = 0;
  return shot('kick', SR, render(sec, SR, (t) => {
    ph += TAU * (f1 + (f0 - f1) * Math.exp(-sweep * t)) / SR;
    const body = Math.sin(ph) * Math.exp(-decay * t), clk = r() * Math.exp(-t * 900) * 0.5;
    return Math.tanh(2.2 * (body + clk));
  }));
}
/** Snare: a tone body under bright noise with a crack. 0.17 s at 11 kHz. */
export function snare({ tone = 196, decay = 18, sec = 0.17, seed = 7 } = {}) {
  const SR = 11025, r = rand(seed); let prev = 0;
  return shot('snare', SR, render(sec, SR, (t) => {
    const w = r(), hp = w - prev; prev = w;
    const body = Math.sin(TAU * tone * t) * Math.exp(-t * 30) * 0.7;
    return Math.tanh(1.8 * (body + (0.7 * hp + 0.4 * w) * Math.exp(-t * decay)));
  }));
}
/** Terrace clap: three quick noise bursts then a short tail. 0.14 s. */
export function clap({ sec = 0.14, seed = 31 } = {}) {
  const SR = 11025, r = rand(seed); let prev = 0;
  return shot('clap', SR, render(sec, SR, (t) => {
    const w = r(), hp = w - prev; prev = w;
    const k = t < 0.024 ? Math.exp(-((t % 0.008) * 500)) : Math.exp(-(t - 0.024) * 28);
    return hp * k;
  }));
}
/** Closed hat: metallic squares and noise, differentiated twice. 0.045 s at 22 kHz. */
export function hat({ sec = 0.045, decay = 70, seed = 3 } = {}) {
  const SR = 22050, r = rand(seed); let x1 = 0, x2 = 0;
  const metal = (t) => [205.3, 304.4, 369.6, 522.7, 540, 800].reduce((s, f) => s + (Math.sin(TAU * f * 1.7 * t) > 0 ? 1 : -1), 0) / 6;
  return shot('hat', SR, render(sec, SR, (t) => {
    const x = 0.5 * metal(t) + 0.5 * r(), y = x - 2 * x1 + x2; x2 = x1; x1 = x;
    return y * Math.exp(-decay * t);
  }));
}
/** Single-cycle additive wave from harmonic amplitudes (loop, C-5 = middle C). */
export function wave(name, amps, { cyc = 128, drive = 0 } = {}) {
  const d = [];
  for (let i = 0; i < cyc; i++) {
    const s = amps.reduce((a, amp, k) => a + amp * Math.sin(TAU * (k + 1) * i / cyc), 0);
    d.push(drive ? Math.tanh(drive * s) : s);
  }
  return { name, samplerate: 44100, c5speed: Math.round(cyc * MID_C), channels: [normalize(d, 0.95).map(q3)], loop: { start: 0, end: cyc } };
}
/** Band-limited pulse of duty `duty` as one cycle (harmonics of a pulse train). */
export function pulse(name, duty = 0.25, { cyc = 64, top = 24 } = {}) {
  const amps = Array.from({ length: top }, (_, k) => Math.sin(Math.PI * (k + 1) * duty) / (k + 1));
  return wave(name, amps, { cyc });
}
// Harmonic recipes.
export const BASS_AMPS = [1, 0.62, 0.45, 0.3, 0.25, 0.18, 0.14, 0.11, 0.09, 0.08, 0.07, 0.06];
export const BRASS_AMPS = Array.from({ length: 20 }, (_, k) => (k === 1 ? 0.8 : 1 / (k + 1) ** 1.15));
/** Organ drawbars as harmonics 1, 2, 3, 4, 6, 8, clipped a little (wave's drive): the GDD's "distorted organ". */
export const ORGAN_AMPS = [0.9, 1, 0.55, 0.5, 0, 0.2, 0, 0.35];
