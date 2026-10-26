/**
 * Zork "Underworld" score — synthesized samples and pattern assembly.
 * Used by songs/zork_underworld.gen.js. Everything is synthesized here.
 *
 * Channel layout (every pattern): 0 ctrl (tempo stamps, Bxx jumps), 1 lead,
 * 2 echo/counter, 3 pad A, 4 pad B, 5 bass, 6 kit, 7 metal (hats, drips, bells).
 */
import { rest } from './opus55.js';

const MID_C = 261.6256, TAU = 2 * Math.PI;
const q3 = (x) => Math.round(x * 1000) / 1000;
function normalize(a, peak = 0.95) {
  let m = 0; for (const v of a) m = Math.max(m, Math.abs(v));
  return a.map((v) => (v / m) * peak);
}

/** Single-cycle additive wave from harmonic amplitudes (loop, C-5 = middle C). */
export function wave(name, amps, cyc = 128) {
  const d = [];
  for (let i = 0; i < cyc; i++) d.push(amps.reduce((s, a, k) => s + a * Math.sin(TAU * (k + 1) * i / cyc), 0));
  return { name, samplerate: 44100, c5speed: Math.round(cyc * MID_C), channels: [normalize(d).map(q3)], loop: { start: 0, end: cyc } };
}

/**
 * Tolling bell. Church-bell partials: hum (octave below), prime, MINOR tierce,
 * quint, nominal and a few upper partials, each with its own decay, so the
 * bell itself sounds a minor chord. C-5 plays a C prime (middle C).
 */
export function bell(name = 'bell', { sec = 3, rate = 16000 } = {}) {
  const partials = [[0.5, 0.5, 0.8], [1, 0.9, 1.5], [1.2, 0.62, 1.9], [1.5, 0.3, 2.6],
    [2, 0.65, 2.2], [2.52, 0.22, 3.4], [3.01, 0.18, 4.4], [4.07, 0.1, 6]];
  const n = Math.round(sec * rate), d = new Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    let s = 0;
    for (const [ratio, amp, decay] of partials) s += amp * Math.sin(TAU * MID_C * ratio * t + ratio) * Math.exp(-decay * t);
    d[i] = s * Math.min(1, t * 400); // 2.5 ms strike, no click
  }
  for (let i = 0; i < 64; i++) d[n - 1 - i] *= i / 64;
  return { name, samplerate: rate, c5speed: rate, channels: [normalize(d, 0.9).map(q3)] };
}

export const DRONE_AMPS = [1, 0.55, 0.18, 0.3, 0.06, 0.14, 0.03, 0.07]; // hollow organ
export const BASS_AMPS = [1, 0.62, 0.45, 0.3, 0.25, 0.18, 0.14, 0.11, 0.09, 0.08, 0.07, 0.06];

export const I = { lead: 0, thin: 1, hollow: 2, stab: 3, drone: 4, bass: 5, drip: 6, bell: 7, kick: 8, snare: 9, hat: 10, tom: 11 };
export const SAMPLES = [
  { name: 'pulse lead', synth: { wave: 'square', pulse: 0.25 } },
  { name: 'thin pulse', synth: { wave: 'square', pulse: 0.125 } },
  { name: 'hollow', synth: { wave: 'triangle' } },
  { name: 'stab', synth: { wave: 'square', pulse: 0.5 } },
  wave('drone', DRONE_AMPS),
  wave('bass', BASS_AMPS),
  { name: 'drip', synth: { wave: 'pluck', seconds: 0.9, decay: 5 } },
  bell(),
  { name: 'kick', synth: { wave: 'kick', seconds: 0.4, decay: 9, freqStart: 95, freqEnd: 38 } },
  { name: 'snare', synth: { wave: 'noise', seconds: 0.16, decay: 22, seed: 404 } },
  { name: 'hat', synth: { wave: 'noise', seconds: 0.3, decay: 10, seed: 1977 } },
  { name: 'tom', synth: { wave: 'kick', seconds: 0.45, decay: 7, freqStart: 150, freqEnd: 72 } },
];

export const ROLES = ['ctrl', 'lead', 'echo', 'padA', 'padB', 'bass', 'kit', 'metal'];
const PANS = [0x80, 0x78, 0xa8, 0x58, 0xa8, 0x80, 0x80, 0x98];
export const hex2 = (n) => n.toString(16).toUpperCase().padStart(2, '0');

/** Stamp pan on the first row whose effect column is free (channel state reset). */
function pan(ch, x) {
  for (let r = 0; ; r++) {
    if (!ch[r]) { ch[r] = { fx: `X${hex2(x)}` }; return ch; }
    if (!ch[r].fx) { ch[r] = { ...ch[r], fx: `X${hex2(x)}` }; return ch; }
  }
}

/**
 * One self-contained pattern. `tempo` is stamped on row 0 of the ctrl channel
 * (or pass `ctrl` for a tempo ramp). A role left out is cut on row 0, so the
 * pattern is safe to enter from any other pattern.
 */
export function pattern(name, rows, parts, { tempo, ctrl } = {}) {
  const channels = ROLES.map((role, i) => {
    if (role === 'ctrl') return { ...(ctrl ?? { 0: { fx: `T${hex2(tempo)}` } }) };
    const ch = parts[role] ? { ...parts[role] } : rest();
    return pan(ch, PANS[i]);
  });
  for (const ch of channels) for (const r of Object.keys(ch)) {
    if (+r >= rows) throw new Error(`${name}: event at row ${r} outside ${rows} rows`);
  }
  return { name, rows, channels };
}

/** Fade whatever a channel was playing over four rows, then cut. */
export const dissolve = (from = 12) => ({ 0: { vol: `v${from}` }, 1: { vol: `v${from >> 1}` }, 2: { vol: `v${from >> 2}` }, 3: { note: '^^' } });

/** Held pad note that continues the previous pattern's note: level only, no retrigger. */
export const hold = (vol) => ({ 0: { vol: `v${vol}` } });

/** Pitched one-shots: [row, note, volume] (drips, bells). */
export function strikes(list, instrument) {
  const ch = {};
  for (const [row, note, vol] of list) {
    if (ch[row]) throw new Error(`strikes: collision at row ${row}`);
    ch[row] = { note, instrument, vol: `v${vol}` };
  }
  return ch;
}
