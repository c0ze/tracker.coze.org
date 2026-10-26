/**
 * Heliobane World 3 (UMBRA) shared kit — MUSIC-D. Used by heliobane_{stage11..stage15,
 * boss_w3,ending_final}.gen.js. Named heliobane_stage11.* only to stay inside the
 * heliobane_<own id>.* file rule; it is not a generator.
 *
 * It extends MUSIC-A's kit (heliobane_title.kit.js: notation, line/echo/harmony,
 * chart/arp/bass/pad, beat/pattern/jump) instead of forking it, and adds:
 *   samples  heart thump, ritual drum, bone rattle, formant choir, gold bell,
 *            organ, detuned "flesh" bass (a slow 1 Hz beating throb)
 *   parts    choir(): voice-led 3-voice chords with a swell (or a beat-synced pulse)
 *            section(): one builder for the W3 channel layout
 * Everything is synthesized here, deterministically (no library/ assets).
 */
import { nn, ns } from './lib.js';
import { chart, at, mel, line, echoOf, harmony, arp, bass, beat, rep, pattern } from './heliobane_title.kit.js';
export * from './heliobane_title.kit.js';

const TAU = 2 * Math.PI, MID_C = 261.6256;
const q3 = (x) => Math.round(x * 1000) / 1000;
const v = (x) => `v${Math.max(0, Math.min(64, Math.round(x)))}`;
function rand(seed) { // mulberry32, -1..1
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}
function norm(a, peak = 0.95) { let m = 0; for (const x of a) m = Math.max(m, Math.abs(x)); return a.map((x) => q3((x / m) * peak)); }
function shot(name, sec, sr, fn, extra = {}) {
  const n = Math.round(sec * sr), d = new Array(n);
  for (let i = 0; i < n; i++) d[i] = fn(i / sr, i);
  for (let i = 0; i < 64 && i < n; i++) d[n - 1 - i] *= i / 64;
  return { name, samplerate: sr, channels: [norm(d)], ...extra };
}

// ---------------------------------------------------------------- one-shots
/** Deep round heartbeat thump (lub/dub): sub sine sweep, almost no click. */
export function heart({ f0 = 110, f1 = 40, sweep = 18, decay = 7, sec = 0.5 } = {}) {
  let ph = 0; const r = rand(71);
  return shot('heart', sec, 22050, (t) => {
    ph += TAU * (f1 + (f0 - f1) * Math.exp(-sweep * t)) / 22050;
    return Math.tanh(1.8 * (Math.sin(ph) * Math.exp(-decay * t) + r() * Math.exp(-t * 900) * 0.12));
  }, { role: 'percussion' });
}
/** Ritual drum (taiko / frame drum): two-mode skin + low-passed slap noise. Pitch with the note. */
export function drum(name = 'ritual drum', { f = 82, bend = 0.35, decay = 6, sec = 0.7, slap = 0.5, seed = 41 } = {}) {
  let p1 = 0, p2 = 0, lp = 0; const r = rand(seed);
  return shot(name, sec, 22050, (t) => {
    const g = 1 + bend * Math.exp(-t * 30);
    p1 += TAU * f * g / 22050; p2 += TAU * f * 1.593 * g / 22050;
    lp += 0.18 * (r() - lp);
    const body = Math.sin(p1) * Math.exp(-decay * t) + 0.35 * Math.sin(p2) * Math.exp(-decay * 1.8 * t);
    return Math.tanh(1.5 * (body + slap * lp * 3 * Math.exp(-t * 45)));
  }, { role: 'percussion' });
}
/** Bone rattle / shaker: a cluster of short band-passed grains. */
export function rattle({ sec = 0.11, grains = 7, seed = 51 } = {}) {
  const r = rand(seed), at = Array.from({ length: grains }, (_, i) => 0.004 + i * 0.011 + Math.abs(r()) * 0.006);
  let x1 = 0, x2 = 0;
  return shot('rattle', sec, 22050, (t) => {
    let env = 0; for (const a of at) if (t >= a) env += Math.exp(-(t - a) * 420) * (1 - a / sec);
    const x = r(), y = x - 1.2 * x1 + 0.5 * x2; x2 = x1; x1 = x;
    return y * env;
  }, { role: 'percussion' });
}
/** Gold bell: church-bell partials (hum, prime, minor tierce, quint, nominal...). C-5 = middle C strike. */
export function bell({ sec = 1.8, sr = 16000 } = {}) {
  const parts = [[0.5, 0.55, 1.1], [1, 1, 1.6], [1.19, 0.6, 2.1], [1.5, 0.35, 2.6], [2, 0.7, 3.2], [2.51, 0.3, 4.6], [2.99, 0.22, 5.5], [4.17, 0.12, 8]];
  return shot('gold bell', sec, sr, (t) => {
    let s = 0; for (const [ratio, a, d] of parts) s += a * Math.sin(TAU * MID_C * ratio * t) * Math.exp(-d * t);
    return s * Math.min(1, t * 900);
  }, { c5speed: sr });
}

// ---------------------------------------------------------------- loops
/** Detuned multi-voice loop: `amps(k, f)` gives harmonic k's level at frequency f (Hz at C-5). */
function ensemble(name, { base, cyc, voices, amps, drive = 0, peak = 0.9 }) {
  const L = base * cyc, d = new Array(L).fill(0);
  voices.forEach(([dm, w], vi) => {
    const m = base + dm;
    for (let k = 1; k * m < L * 0.45; k++) {
      const a = w * amps(k, k * MID_C * m / base); if (a < 1e-4) continue;
      const ph = (k * 0.618 + vi * 0.371) % 1;
      for (let i = 0; i < L; i++) d[i] += a * Math.sin(TAU * (k * m * i / L + ph));
    }
  });
  const y = drive ? d.map((x) => Math.tanh(drive * x)) : d;
  return { name, samplerate: 44100, c5speed: Math.round(cyc * MID_C), channels: [norm(y, peak)], loop: { start: 0, end: L } };
}
const VOWELS = {
  a: [[800, 1, 110], [1150, 0.55, 120], [2900, 0.2, 200], [3900, 0.1, 260]],
  o: [[450, 1, 80], [800, 0.5, 90], [2830, 0.1, 180]],
};
/** Formant choir ("aah"/"ooh"): five detuned voices, formants fixed at the C-5 reference. */
export function choir(name = 'choir', { vowel = 'a', base = 120, cyc = 64 } = {}) {
  const F = VOWELS[vowel];
  const env = (f) => 0.06 / Math.sqrt(f / 260) + F.reduce((s, [c, a, b]) => s + a / (1 + ((f - c) / b) ** 2), 0);
  return ensemble(name, { base, cyc, voices: [[0, 1], [-1, 0.8], [1, 0.8], [-2, 0.35], [2, 0.35]], amps: (k, f) => env(f) / Math.sqrt(k) });
}
/** Detuned two-voice growl bass: beats about once a second at C-3 (the "throb"). */
export function fleshBass(name = 'flesh bass', { base = 64, cyc = 64, drive = 1.6 } = {}) {
  const A = [1, 0.7, 0.5, 0.36, 0.3, 0.2, 0.16, 0.12, 0.1, 0.08, 0.06, 0.05];
  return ensemble(name, { base, cyc, voices: [[0, 1], [1, 0.7]], amps: (k) => A[k - 1] ?? 0, drive });
}
/** Cathedral organ: 8' + 4' + 2 2/3' + 2' + 1 1/3' + 1' drawbars, slight chorus. */
export function organ(name = 'organ', { base = 150, cyc = 64 } = {}) {
  const A = { 1: 1, 2: 0.75, 3: 0.5, 4: 0.55, 6: 0.35, 8: 0.3, 10: 0.08, 12: 0.1 };
  return ensemble(name, { base, cyc, voices: [[0, 1], [1, 0.45]], amps: (k) => A[k] ?? 0 });
}

// ---------------------------------------------------------------- parts
const place = (pc, lo) => lo + ((pc - lo) % 12 + 12) % 12;
function combos(list, n, from = 0) {
  if (!n) return [[]];
  const out = [];
  for (let i = from; i <= list.length - n; i++) for (const c of combos(list, n - 1, i + 1)) out.push([list[i], ...c]);
  return out;
}
/**
 * Voice-led chord in `n` channels (default 3). Common tones sustain across chord
 * changes; moving voices re-attack with a swell. `pulse` = per-row level multipliers
 * repeated through the bar (e.g. a beat-synced throb), instead of the swell.
 */
export function choir3(segs, inst, { rows, lo = 'F-4', span = 16, vol = 18, n = 3, pulse = null } = {}) {
  const chs = Array.from({ length: n }, () => ({}));
  let prev = Array.from({ length: n }, (_, i) => nn(lo) + 4 + i * 4);
  for (const s of segs) {
    if (s.row >= rows) break;
    const cands = [];
    for (let p = nn(lo); p <= nn(lo) + span; p++) if (s.tones.has(p % 12)) cands.push(p);
    let best = null;
    for (const c of combos(cands, n)) {
      const pcs = new Set(c.map((p) => p % 12));
      const third = [...s.tones].some((pc) => (pc - s.root + 12) % 12 === 3 || (pc - s.root + 12) % 12 === 4);
      const hasThird = c.some((p) => [3, 4].includes((p % 12 - s.root + 12) % 12));
      const cost = c.reduce((a, p, i) => a + Math.abs(p - prev[i]), 0) + (pcs.size < Math.min(n, s.tones.size) ? 20 : 0) + (third && !hasThird ? 12 : 0);
      if (!best || cost < best.cost) best = { c, cost };
    }
    const end = Math.min(rows, s.row + s.len);
    best.c.forEach((p, i) => {
      const ch = chs[i], keep = p === prev[i] && s.row > 0;
      for (let r = s.row; r < end; r++) {
        const k = r - s.row;
        const lvl = pulse ? vol * pulse[r % pulse.length] : vol * (keep ? 1 : [0.55, 0.75, 0.9][k] ?? 1) * (end - r <= 2 && end - s.row > 4 ? 0.85 : 1);
        const ev = {};
        if (k === 0 && !keep) Object.assign(ev, { note: ns(p), instrument: inst });
        if (pulse || k < 3 || k % 4 === 0 || end - r <= 2) ev.vol = v(lvl);
        if (Object.keys(ev).length) ch[r] = ev;
      }
    });
    prev = best.c;
  }
  return chs;
}

/**
 * Section builder for the W3 layout. `cfg`: { I, LAYOUT, PANS, maps: {kick,snare,hat,perc} (char -> [inst, vol, fx?, note?]),
 * fill: {kick,snare,hat,perc} }. Lane grooves are 16-char strings or arrays of them (per bar).
 */
export function sectionMaker(cfg) {
  const { I, LAYOUT, PANS, maps } = cfg;
  const lane = (bars, g, f, map) => {
    if (!g) return undefined;
    const list = Array.isArray(g) ? g : [g];
    return beat(Array.from({ length: bars }, (_, b) => (f && b === bars - 1 ? f : list[b % list.length])), map);
  };
  return function section(name, bars, chordStr, o = {}) {
    const rows = bars * 16, semi = o.semi ?? 0, segs = chart(chordStr, { semi });
    const bsegs = o.bassChart ? chart(o.bassChart, { semi }) : segs;
    const g = o.groove ?? {}, f = o.fill === false ? {} : (o.fill ?? cfg.fill ?? {});
    const parts = {};
    for (const k of ['kick', 'snare', 'hat', 'perc']) parts[k] = lane(bars, g[k], f[k], maps[k]);
    if (o.riff) parts.bass = bass(bsegs, o.riff, I.bass, { rows, lo: o.bassLo ?? 'C-3', vol: o.bassVol ?? 42, soft: 0.7 });
    if (o.gtr) parts.gtr = bass(bsegs, o.gtr, o.gtrInst ?? I.gtr, { rows, lo: o.gtrLo ?? 'D#3', vol: o.gtrVol ?? 30, soft: 0.75 });
    if (o.choir !== false && I.choir !== undefined) {
      const c = choir3(segs, o.choirInst ?? I.choir, { rows, lo: o.choirLo ?? 'F-4', span: o.span ?? 16, vol: o.choirVol ?? 17, pulse: o.pulse });
      c.forEach((ch, i) => { parts[`c${i + 1}`] = ch; });
    }
    if (o.stabs) parts.stab = arp(segs, o.stabs, o.stabInst ?? I.stab, { rows, lo: o.stabLo ?? 'G-4', vol: o.stabVol ?? 26, decay: 0.6 });
    if (o.melody) {
      const notes = mel(o.melody, { semi, vol: o.leadVol ?? 44 });
      const ch = line(notes, o.leadInst ?? I.lead, { rows, vib: o.vib ?? 'H42' });
      parts.lead = ch;
      if (o.echo) parts.echo = echoOf(ch, notes, { delay: o.echo, scale: 0.42, rows });
      if (o.harm) parts.echo = line(harmony(notes, segs), o.leadInst ?? I.lead, { rows, vib: null });
    }
    if (o.crash !== false) parts.fx = { 0: { note: 'C-5', instrument: I.crash, vol: 'v40' } };
    return pattern(name, bars, { ...parts, ...(o.extra ?? {}) }, LAYOUT, PANS);
  };
}

/** Snare roll crescendo over the last `bars` bars of a lane (16ths, then retrig in the last bar). */
export function roll(inst, { bars = 4, total = 4, from = 14, to = 56 } = {}) {
  const ch = {}, start = (total - bars) * 16, n = bars * 16;
  for (let i = 0; i < n; i++) {
    const r = start + i, last = i >= n - 16;
    if (!last && i % 2) continue;
    ch[r] = { note: 'C-5', instrument: inst, vol: v(from + (to - from) * i / n), ...(last ? { fx: 'Q03' } : {}) };
  }
  return ch;
}
/** Noise riser over rows [a, b) (pitch slides up with F). */
export function riser(inst, a, b, { top = 36 } = {}) {
  const ch = { [a]: { note: 'C-4', instrument: inst, vol: 'v4' } };
  for (let r = a + 1; r < b; r++) ch[r] = { vol: v(4 + (top - 4) * (r - a) / (b - a)), fx: 'F03' };
  return ch;
}
/** Tolling notes: [row, note, vol] one-shots with a hard cut after `len` rows. */
export function toll(list, inst, { rows, len = 14 } = {}) {
  const ch = {};
  for (const [r, note, vol] of list) {
    ch[r] = { note, instrument: inst, vol: v(vol) };
    if (r + len < rows && !list.some(([q]) => q > r && q <= r + len)) ch[r + len] = { note: '^^' };
  }
  return ch;
}
/** Root of the chord at row `r`, placed at or above `lo`. */
export const rootAt = (segs, r, lo) => ns(place(at(segs, r).root, nn(lo)));
export { place };
