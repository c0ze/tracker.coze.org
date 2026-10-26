/**
 * Shared kit for the MUSIC-B Heliobane tracks (shop, stage3, stage4, stage5, ending).
 * Named heliobane_shop.kit.js only to stay inside the heliobane_<id>.* file rule;
 * it is not a generator. Everything is synthesized here, deterministically, as raw
 * PCM (drums, clanks, power chord, detuned "fat" loops) so the songs need no
 * optional library/ assets and regenerate identically in the generator test.
 *
 * Tuning: looped cycles use c5speed = framesPerPeriod * 261.6256, so C-5 is middle C
 * like the repo's synth cycles. One-shots play at their own rate on C-5.
 */
import { up } from './lib.js';
import { phrase, hits } from './opus55.js';

export { up };
const MIDDLE_C = 261.6256;
const r4 = (x) => Math.round(x * 10000) / 10000;

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let v = Math.imul(s ^ (s >>> 15), s | 1);
    v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  };
}
const sat = (x, d) => Math.tanh(d * x) / Math.tanh(d);
function finish(data, fade = 48, gain = 1) {
  let peak = 0;
  for (const v of data) peak = Math.max(peak, Math.abs(v));
  const out = data.map((v) => gain * v / (peak || 1));
  for (let i = 0; i < fade && i < out.length; i++) out[out.length - 1 - i] *= i / fade;
  return out.map(r4);
}
const oneShot = (name, samplerate, data, gain = 1) => ({ name, samplerate, channels: [finish(data, 48, gain)] });

// ---------------------------------------------------------------- one-shots
export function kick(name = 'kick', { sr = 22050, sec = 0.24, f0 = 190, f1 = 48, sweep = 30, decay = 10, drive = 2.2, click = 0.5, seed = 11, gain = 1 } = {}) {
  const n = Math.round(sec * sr), rnd = rng(seed), d = [];
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, f = f1 + (f0 - f1) * Math.exp(-sweep * t);
    ph += 2 * Math.PI * f / sr;
    d.push(sat(Math.sin(ph) * Math.exp(-decay * t) + click * (rnd() * 2 - 1) * Math.exp(-t * 450), drive));
  }
  return oneShot(name, sr, d, gain);
}

export function snare(name = 'snare', { sr = 16000, sec = 0.2, tone = 185, noise = 0.9, ndecay = 16, drive = 1.6, metal = 0, seed = 21, gain = 1 } = {}) {
  const n = Math.round(sec * sr), rnd = rng(seed), d = [];
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr, w = rnd() * 2 - 1, hp = w - 0.5 * prev; prev = w;
    let v = 0.55 * Math.sin(2 * Math.PI * tone * t) * Math.exp(-t * 28)
      + 0.25 * Math.sin(2 * Math.PI * tone * 1.78 * t) * Math.exp(-t * 36)
      + noise * hp * Math.exp(-t * ndecay);
    if (metal) v += metal * (Math.sin(2 * Math.PI * 523 * t) + 0.8 * Math.sin(2 * Math.PI * 797 * t) + 0.6 * Math.sin(2 * Math.PI * 1231 * t)) * Math.exp(-t * 14) * 0.4;
    d.push(sat(v, drive));
  }
  return oneShot(name, sr, d, gain);
}

/** Inharmonic metal hit: hull plating, anvil, chain. Pitch it with the note. */
export function clank(name = 'clank perc', { sr = 16000, sec = 0.42, base = 180, drive = 1.8, seed = 31, bright = 1, gain = 1 } = {}) {
  const ratios = [1, 1.63, 2.62, 4.1, 6.6, 10.3, 16.2];
  const amps = [1, 0.85, 0.7, 0.55, 0.45 * bright, 0.35 * bright, 0.25 * bright];
  const decays = [5, 7, 9, 12, 15, 19, 25];
  const rnd = rng(seed), phases = ratios.map(() => rnd() * 2 * Math.PI);
  const n = Math.round(sec * sr), d = [];
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let v = (rnd() * 2 - 1) * Math.exp(-t * 90) * 0.8;
    ratios.forEach((r, k) => { v += amps[k] * Math.sin(2 * Math.PI * base * r * t + phases[k]) * Math.exp(-decays[k] * t); });
    d.push(sat(v * 0.5, drive));
  }
  return oneShot(name, sr, d, gain);
}

export function cowbell(name = 'cowbell perc', { sr = 16000, sec = 0.28, gain = 1 } = {}) {
  const n = Math.round(sec * sr), d = [];
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const sq = (f) => (Math.sin(2 * Math.PI * f * t) >= 0 ? 1 : -1);
    const env = 0.7 * Math.exp(-t * 30) + 0.3 * Math.exp(-t * 7);
    d.push((0.6 * sq(562) + 0.4 * sq(845)) * env);
  }
  // soften the square edges a little (one-pole lowpass)
  let y = 0;
  return oneShot(name, sr, d.map((v) => (y += 0.45 * (v - y))), gain);
}

export function tom(name = 'tom perc', opts = {}) {
  return kick(name, { sec: 0.34, f0: 230, f1: 105, sweep: 14, decay: 8, drive: 1.4, click: 0.25, seed: 41, ...opts });
}

// synth-spec noise drums (tiny JSON)
export const hat = (name = 'hat closed', seed = 404) => ({ name, synth: { wave: 'noise', seconds: 0.05, decay: 75, seed } });
export const openHat = (name = 'hat open', seed = 405) => ({ name, synth: { wave: 'noise', seconds: 0.36, decay: 9, seed } });
export const crash = (name = 'crash', seed = 505) => ({ name, synth: { wave: 'noise', seconds: 1.1, decay: 3.2, seed } });

// ---------------------------------------------------------------- loops
const blSaw = (phase, H) => { let v = 0; for (let h = 1; h <= H; h++) v += Math.sin(h * phase) / h; return v; };
const blSquare = (phase, H) => { let v = 0; for (let h = 1; h <= H; h += 2) v += Math.sin(h * phase) / h; return v; };
function loopSample(name, data, periodFrames, gain = 1) {
  let peak = 0;
  for (const v of data) peak = Math.max(peak, Math.abs(v));
  return {
    name, samplerate: 44100, c5speed: Math.round(periodFrames * MIDDLE_C),
    channels: [data.map((v) => r4(gain * v / peak))], loop: { start: 0, end: data.length },
  };
}

/**
 * Detuned oscillator stack in one seamless loop: k cycles of the reference,
 * k±1 cycles of the others over N = period*k frames (±1/k detune, e.g. 13.5 c).
 * mix: 'saw' | 'square' | 'soft' (sine-ish pad).
 */
export function fatLoop(name, { period = 32, k = 128, mix = 'saw', H = 12, spread = [0, 1, -1], weights = [1, 0.8, 0.8], drive = 0, gain = 1 } = {}) {
  const N = period * k, d = new Array(N).fill(0);
  spread.forEach((s, o) => {
    const cycles = k + s;
    for (let i = 0; i < N; i++) {
      const ph = 2 * Math.PI * cycles * i / N;
      let v;
      if (mix === 'saw') v = blSaw(ph, H);
      else if (mix === 'square') v = blSquare(ph, H);
      else v = Math.sin(ph) + 0.35 * Math.sin(2 * ph) + 0.12 * Math.sin(3 * ph) + 0.05 * Math.sin(5 * ph);
      d[i] += weights[o] * v;
    }
  });
  if (drive) { let p = 0; for (const v of d) p = Math.max(p, Math.abs(v)); for (let i = 0; i < N; i++) d[i] = sat(d[i] / p, drive); }
  return loopSample(name, d, period, gain);
}

/** Root + fifth + octave in one exact cycle (2:3:4 periods), overdriven. Pitch = root. */
export function powerChord(name = 'power chord', { period = 64, drive = 3.2, H = 10, gain = 1 } = {}) {
  const N = period * 2, d = [];
  for (let i = 0; i < N; i++) {
    const p = 2 * Math.PI * i / N;
    d.push(blSaw(2 * p, H) + 0.85 * blSaw(3 * p, H) + 0.45 * blSquare(4 * p, 6));
  }
  let pk = 0; for (const v of d) pk = Math.max(pk, Math.abs(v));
  return loopSample(name, d.map((v) => sat(v / pk, drive)), period, gain);
}

/** Growl bass: saw + square at the same pitch, gently driven. */
export function growlBass(name = 'growl bass', { period = 64, drive = 1.8, H = 18, sq = 0.55, gain = 1 } = {}) {
  const d = [];
  for (let i = 0; i < period; i++) {
    const p = 2 * Math.PI * i / period;
    d.push(blSaw(p, H) + sq * blSquare(p, 9) + 0.4 * Math.sin(p));
  }
  let pk = 0; for (const v of d) pk = Math.max(pk, Math.abs(v));
  return loopSample(name, d.map((v) => sat(v / pk, drive)), period, gain);
}

export const pulse = (name, duty) => ({ name, synth: { wave: 'square', pulse: duty } });
export const tri = (name) => ({ name, synth: { wave: 'triangle' } });
export const sine = (name) => ({ name, synth: { wave: 'sine' } });
export const saw = (name) => ({ name, synth: { wave: 'saw' } });

// ---------------------------------------------------------------- score helpers
export const ROWS = 64;

/** [[row, note, len, vol, fx?], ...] per 16-row bar -> absolute rows. */
export const bars = (list, rpb = 16) => list.flatMap((events, b) => (events || []).map(([r, ...e]) => [b * rpb + r, ...e]));

/** Transpose tuple events by semitones (notes only). */
export const tr = (events, semi) => events.map(([r, n, ...e]) => [r, semi ? up(n, semi) : n, ...e]);

/** Scale tuple volumes. */
export const vs = (events, k) => events.map(([r, n, l, v, ...e]) => [r, n, l, Math.min(64, Math.max(1, Math.round(v * k))), ...e]);

export const line = (events, inst, opts = {}) => phrase(events, inst, { rows: ROWS, sustain: 0.72, release: 0.45, ...opts });
export const drums = (list) => hits(list, { rows: ROWS });

/**
 * Build a pattern: every channel starts with an explicit event on row 0 (a ^^
 * when silent there) so no tail crosses a pattern seam, then gets its pan.
 */
export function pattern(name, channels, pans, rows = ROWS) {
  const out = channels.map((ch, c) => {
    const x = { ...(ch || {}) };
    if (!x[0]) x[0] = { note: '^^' };
    else if (!x[0].note) x[0] = { ...x[0], note: '^^' };
    return pans[c] === undefined ? x : stampPan(x, pans[c], rows);
  });
  return { name, rows, channels: out };
}

/**
 * Pan (Xxx) on the first row with a free effect column; a channel whose every
 * row carries an effect (continuous J arps) gets pNN in the volume column of its
 * first held (note-less) row instead. Never writes outside the pattern.
 */
function stampPan(ch, x, rows) {
  for (let r = 0; r < rows; r++) {
    if (!ch[r]) { ch[r] = { fx: `X${x.toString(16).toUpperCase().padStart(2, '0')}` }; return ch; }
    if (!ch[r].fx) { ch[r] = { ...ch[r], fx: `X${x.toString(16).toUpperCase().padStart(2, '0')}` }; return ch; }
  }
  for (let r = 0; r < rows; r++) if (!ch[r].note) { ch[r] = { ...ch[r], vol: `p${Math.round(x / 4)}` }; return ch; }
  return ch;
}

/** Delay-copy a channel map (effects/vol envelope kept), clipped to the pattern. */
export function delayCopy(ch, delay, scale, rows = ROWS) {
  const out = {};
  for (const [r, ev] of Object.entries(ch)) {
    const t = +r + delay;
    if (t >= rows) continue;
    const e = { ...ev };
    if (e.vol?.startsWith('v')) e.vol = `v${Math.max(1, Math.min(64, Math.round(+e.vol.slice(1) * scale)))}`;
    out[t] = e;
  }
  // make sure the copy ends inside the pattern
  const last = Math.max(...Object.keys(out).map(Number), -1);
  if (last >= 0 && out[last].note !== '^^' && last < rows - 1) out[rows - 1] = { note: '^^' };
  for (let r = 0; r < delay && r < rows; r++) if (!out[r]) { out[r] = { note: '^^' }; break; }
  return out;
}

/** Merge channel maps that must not collide. */
export function join(...chs) {
  const out = {};
  for (const ch of chs) for (const [r, ev] of Object.entries(ch || {})) {
    if (out[r]) throw new Error(`join: collision at row ${r}`);
    out[r] = ev;
  }
  return out;
}

const PCS = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];
export const pcOf = (n) => PCS.indexOf(n.slice(0, 2));

/**
 * Echo only held lead notes (len >= min), `delay` rows later at `scale` volume.
 * An echo is dropped if a lead note a 2nd/7th away is sounding when it starts,
 * cut where such a note begins, and cut at the next bar line (chord change).
 */
export function echoHeld(events, inst, { delay = 3, scale = 0.4, min = 4, vib = 'H42', barCut = true } = {}) {
  const ev = [...events].sort((a, b) => a[0] - b[0]);
  const bad = (a, b) => [1, 2, 10, 11].includes((pcOf(a) - pcOf(b) + 12) % 12);
  const out = [];
  for (const [r, n, l, v] of ev) {
    if (l < min) continue;
    const s = r + delay;
    let e = Math.min(s + l, ROWS - 1);
    if (barCut) e = Math.min(e, (Math.floor(s / 16) + 1) * 16);
    if (ev.some(([r2, n2, l2]) => r2 <= s && r2 + l2 > s && bad(n2, n))) continue;
    for (const [r2, n2] of ev) if (r2 > s && r2 < e && bad(n2, n)) { e = r2; break; }
    if (e - s >= 2) out.push([s, n, e - s, Math.max(1, Math.round(v * scale))]);
  }
  for (let i = 1; i < out.length; i++) if (out[i][0] < out[i - 1][0] + out[i - 1][2]) out[i - 1][2] = out[i][0] - out[i - 1][0];
  return line(out.filter((e) => e[2] >= 1), inst, { vib, vibDelay: 2 });
}
