/**
 * Heliobane World 2 ("The Wake", MUSIC-C) kit. It extends the MUSIC-A kit
 * (heliobane_title.kit.js: notation, articulation, harmony, drums, assembly)
 * and borrows MUSIC-B's metal clank, then adds the colder World 2 sounds and a
 * few arrangement helpers. Used by heliobane_{stage6..stage10,boss_w2}.gen.js;
 * named heliobane_stage6.* only for the heliobane_<own id>.* file rule.
 * Everything is synthesized and deterministic (no library/ assets).
 */
import { nn, ns } from './lib.js';
import { at, beat, rep, echoOf, line } from './heliobane_title.kit.js';

export * from './heliobane_title.kit.js';
export { clank, snare as metalSnare } from './heliobane_shop.kit.js';

const SR = 22050, MID_C = 261.6256, TAU = 2 * Math.PI;
const q3 = (x) => Math.round(x * 1000) / 1000;
function rand(seed) { // mulberry32, -1..1 (same generator as the MUSIC-A samples)
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let v = Math.imul(s ^ (s >>> 15), s | 1);
    v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
    return (((v ^ (v >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}
function oneShot(name, sec, fn, extra = {}) {
  const n = Math.round(sec * SR), d = new Array(n);
  for (let i = 0; i < n; i++) d[i] = fn(i / SR);
  for (let i = 0; i < 48; i++) d[n - 1 - i] *= i / 48;
  let m = 0; for (const x of d) m = Math.max(m, Math.abs(x));
  return { name, samplerate: SR, channels: [d.map((x) => q3((x / m) * 0.97))], ...extra };
}

// ---------------------------------------------------------------- World 2 samples
/**
 * Struck glass / glockenspiel bar: inharmonic partials [ratio, amp, decay/s].
 * C-5 plays middle C (the fundamental dominates, so it reads as a pitch).
 */
export function glassBell(name = 'glass bell', { sec = 1.2, partials = [[1, 1, 2.6], [2.76, 0.42, 6], [5.4, 0.2, 11], [8.93, 0.09, 18]], click = 0.25 } = {}) {
  const r = rand(41);
  return oneShot(name, sec, (t) => {
    let s = r() * Math.exp(-t * 900) * click;
    for (const [ratio, w, d] of partials) s += w * Math.sin(TAU * MID_C * ratio * t) * Math.exp(-d * t);
    return s * Math.min(1, t * 3000);
  }, { c5speed: SR });
}
/**
 * Thin, cold pad loop: `voices` copies of a sparse (mostly odd) harmonic series,
 * each `spread` cycles apart per loop, so it beats slowly instead of shimmering.
 */
export function thinPad(name, { base = 200, cyc = 64, amps = [1, 0, 0.22, 0, 0.08], spread = 1, voices = [-1, 1] } = {}) {
  const L = base * cyc, d = new Array(L).fill(0);
  voices.forEach((dv, j) => amps.forEach((a, k) => {
    if (!a) return;
    const m = (base + dv * spread) * (k + 1), ph = 0.37 * (j + 1) * (k + 1);
    for (let i = 0; i < L; i++) d[i] += a * Math.sin(TAU * (m * i / L + ph));
  }));
  let mx = 0; for (const x of d) mx = Math.max(mx, Math.abs(x));
  return { name, samplerate: 44100, c5speed: Math.round(cyc * MID_C), channels: [d.map((x) => q3((x / mx) * 0.9))], loop: { start: 0, end: L } };
}
/** Thunder: a bright crack, then low rolling rumble with a few re-strikes. */
export function thunder(name = 'thunder', { sec = 2.4, seed = 71 } = {}) {
  const r = rand(seed); let a = 0, b = 0, c = 0;
  const strikes = [[0, 1], [0.35, 0.55], [0.8, 0.4], [1.3, 0.25]];
  return oneShot(name, sec, (t) => {
    const w = r();
    a += 0.08 * (w - a); b += 0.08 * (a - b); c += 0.3 * (w - c); // rumble (two-pole low pass) / crackle
    let env = 0;
    for (const [s, g] of strikes) if (t >= s) env += g * Math.exp(-(t - s) * 2.2) * Math.min(1, (t - s) * 40);
    return 9 * b * env + (w - c) * Math.exp(-t * 28) * 0.9 + c * Math.exp(-t * 6) * 0.25;
  }, { role: 'percussion' });
}
/** Reversed-cymbal swell (rises into the downbeat that follows it). */
export function swell(name = 'swell', { sec = 1.1, seed = 77 } = {}) {
  const r = rand(seed); let x1 = 0;
  return oneShot(name, sec, (t) => {
    const x = r(), y = x - x1; x1 = x;
    const k = t / sec;
    return y * k ** 3 * (k > 0.97 ? (1 - k) / 0.03 : 1);
  }, { role: 'percussion' });
}

/** Steam / hydraulic hiss: bright noise burst with a quick decay. */
export function steam(name = 'steam', { sec = 0.4, seed = 83 } = {}) {
  const r = rand(seed); let p = 0;
  return oneShot(name, sec, (t) => { const w = r(), y = w - 0.85 * p; p = w; return y * Math.exp(-t * 9) * Math.min(1, t * 200); }, { role: 'percussion' });
}

// ---------------------------------------------------------------- arrangement helpers
/**
 * Chord-tone ladder: from `lo` upward, the `span` lowest tones of the current
 * chord; shape[step] picks the rung. One note every `len` rows, accent on beats.
 */
export function ladder(segs, rows, shape, { lo = 'F#4', span = 8, vol = 24, soft = 7, len = 1, off = 0 } = {}) {
  const notes = [];
  for (let r = off; r < rows; r += len) {
    const s = at(segs, r), rungs = [];
    for (let p = nn(lo); rungs.length < span; p++) if (s.tones.has(p % 12)) rungs.push(p);
    const k = Math.floor((r - off) / len);
    notes.push([r, ns(rungs[shape[k % shape.length]]), len, r % 4 ? vol - soft : vol, '']);
  }
  return notes;
}
/** [row, note, len] list of the notes a channel actually sounds (for gating). */
export function notesOf(ch, rows) {
  const out = []; let cur = null;
  for (let r = 0; r < rows; r++) {
    const n = ch[r]?.note; if (!n) continue;
    if (cur) cur[2] = r - cur[0];
    cur = n === '^^' || n === '==' ? null : [r, n, rows - r];
    if (cur) out.push(cur);
  }
  return out;
}
const badIv = (a, b) => [1, 2, 10, 11].includes((((nn(a) - nn(b)) % 12) + 12) % 12);
/**
 * Cut a delayed/secondary voice where it would rub: a 2nd/7th against a note of
 * any `refs` voice (checked at either voice's onset), or a held non-chord tone
 * at a chord change of `segs`. With `delay`, an onset copied from under another
 * chord must also be a tone of the chord it now sounds against.
 */
export function gate(ch, rows, { refs = [], segs = null, delay = 0 } = {}) {
  const out = { ...ch }; let cur = null, offs = [0];
  for (let r = 0; r < rows; r++) {
    const e = out[r];
    if (e?.note === '^^' || e?.note === '==') cur = null; else if (e?.note) cur = e.note;
    if (!cur) continue;
    const j = /^J([0-9A-F])([0-9A-F])$/.exec(e?.fx ?? '');
    if (j) offs = [0, parseInt(j[1], 16), parseInt(j[2], 16)]; else if (e?.note) offs = [0]; // J-arp: every sounding pitch
    const seg = segs && at(segs, r);
    const moved = delay && e?.note && r >= delay && at(segs, r - delay) !== seg;
    const offChord = seg && (seg.row === r || moved) && !seg.tones.has(nn(cur) % 12);
    const clash = refs.some((ref) => {
      const h = ref.find(([s, , l]) => r >= s && r < s + l);
      return h && offs.some((o) => badIv(ns(nn(cur) + o), h[1])) && (e?.note || h[0] === r);
    });
    if (offChord || clash) { out[r] = { note: '^^' }; cur = null; }
  }
  return out;
}
/** Delayed copy (canon/echo) gated against the source and the harmony. */
export function canon(ch, notes, rows, { delay = 3, scale = 0.5, segs = null, refs = [] } = {}) {
  return gate(echoOf(ch, notes, { delay, scale, rows }), rows, { refs, segs, delay });
}
/** Ping-pong echo: two delayed copies of a lead for two channels (World 2 is wetter). */
export function pingpong(ch, notes, rows, { d1 = 3, s1 = 0.42, d2 = 6, s2 = 0.22, segs = null } = {}) {
  const e1 = canon(ch, notes, rows, { delay: d1, scale: s1, segs });
  return [e1, canon(ch, notes, rows, { delay: d2, scale: s2, segs, refs: [notesOf(e1, rows)] })];
}
/** Drum lanes from per-bar grooves: kit(bars, groove, fill) → {lane: channel}. */
export function drumKit(maps) {
  return (bars, groove, fill = null) => Object.fromEntries(Object.entries(groove)
    .map(([k, s]) => [k, beat(rep(bars, s, fill?.[k]), maps[k])]));
}
/** One-shot hits on the given rows. */
export const hits = (inst, rowsList, { note = 'C-5', vol = 40 } = {}) =>
  Object.fromEntries(rowsList.map((r) => [r, { note, instrument: inst, vol: `v${vol}` }]));
/** Looped-noise riser from row `from` to `to` (pitch up with Fxx, volume up). */
export function riser(inst, from, to, { note = 'C-4', v0 = 4, slope = 1.1, fx = 'F03' } = {}) {
  const ch = { [from]: { note, instrument: inst, vol: `v${v0}` } };
  for (let r = from + 1; r < to; r++) ch[r] = { vol: `v${Math.min(64, v0 + Math.round((r - from) * slope))}`, fx };
  return ch; // the next pattern's first event (or its absent-part cut) ends it
}
/** Downlifter: looped noise falling in pitch (Exx) and fading out. */
export function fall(inst, from, to, { note = 'C-6', v0 = 30, fx = 'E06' } = {}) {
  const ch = { [from]: { note, instrument: inst, vol: `v${v0}` } };
  for (let r = from + 1; r < to; r++) ch[r] = { vol: `v${Math.max(0, Math.round(v0 * (1 - (r - from) / (to - from))))}`, fx };
  ch[to] = { note: '^^' };
  return ch;
}
/** Snare/drum roll: n retriggered hits getting louder (Qxy retrigger). */
export function roll(inst, from, n, { v0 = 20, dv = 2, fx = 'Q03', note = 'C-5' } = {}) {
  const ch = {};
  for (let i = 0; i < n; i++) ch[from + i] = { note, instrument: inst, vol: `v${Math.min(64, v0 + i * dv)}`, ...(fx ? { fx } : {}) };
  return ch;
}
/** Chord chart reduced to triads (drop maj7/7/add9) for accompaniment that must not rub. */
export const triads = (str) => str.replace(/maj7|add9|7/g, '');
/**
 * Thin sustained pad: one voice-led chord tone per chord (like the kit's pad), but it
 * skips any tone that would sit a 2nd/7th from a lead note sounding in that chord.
 */
export function coldPad(segs, inst, { rows, lo = 'A-4', vol = 11, refs = [] } = {}) {
  const notes = []; let prev = nn(lo) + 6;
  for (const s of segs) {
    if (s.row >= rows) break;
    const end = Math.min(s.row + s.len, rows);
    const lead = refs.flatMap((ref) => ref.filter(([r0, , l]) => r0 < end && r0 + l > s.row).map(([, n]) => n));
    const cands = [...s.tones].map((pc) => nn(lo) + ((pc - nn(lo)) % 12 + 12) % 12).sort((a, b) => Math.abs(a - prev) - Math.abs(b - prev));
    const n = cands.find((c) => !lead.some((m) => badIv(ns(c), m))) ?? cands[0];
    prev = n; notes.push([s.row, ns(n), end - s.row, vol, '']);
  }
  const ch = line(notes, inst, { rows, sustain: 0.7, release: 0.55, vib: null });
  for (const [row, , len] of notes) for (const k of [2, 4]) if (k < len - 1) ch[row + k] = { vol: `v${Math.round(vol * (k === 2 ? 0.85 : 1))}` };
  return ch;
}
/** Hard-cut a channel at row 0 when its part starts later (stops the previous pattern's held note). */
export const cut0 = (ch) => (ch[0] ? ch : { 0: { note: '^^' }, ...ch });
/** Section assembly: hard-cut these melodic lanes at row 0 so nothing held rings into a new section. */
export function cutLanes(parts, keys = ['lead', 'echo', 'echo2', 'alarm', 'bells', 'canon', 'arp', 'glass', 'gtr', 'pad']) {
  for (const k of keys) if (parts[k]) parts[k] = cut0(parts[k]);
  return parts;
}
/** Merge channels (later wins on a shared row). */
export const merge = (...chs) => Object.assign({}, ...chs.filter(Boolean));
