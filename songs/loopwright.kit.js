/**
 * Shared kit for the Loopwright soundtrack (songs/loopwright_*.gen.js), 2026-09-29.
 * Loopwright is a clockwork toy racer built on a hobby desk: puzzle-piece track tiles,
 * wind-up tin cars, a cuckoo clock on the wall, a desk lamp at night.
 *
 * The palette follows that desk: a tin pulse lead, a music box and bell (pluck), a
 * triangle bass, chip drums, and clock percussion (tick, tock, woodblock) that stands
 * in for hats in the quiet sections.
 *
 * Leitmotif, "the wind-up": scale degrees 1-2-3 as three short ratchet clicks, then a
 * held 5 (the spring let go). Every cue states it in its own key and tempo.
 *
 * Helpers here only write articulated notes (opus55 `phrase`: attack, held level,
 * release, cut) and one-shot hits; collisions throw rather than silently overwrite.
 */
import { writeSong, nn, ns } from './lib.js';
import { phrase, hits, pan, slice, rest, echoChannel, join } from './opus55.js';
export { phrase, hits, pan, slice, rest, echoChannel, join, writeSong, nn, ns };

// ---- samples ------------------------------------------------------------------------
const SYNTH = {
  lead:  ['tin lead',     { wave: 'square', pulse: 0.25 }],
  thin:  ['candy pulse',  { wave: 'square', pulse: 0.125 }],
  stab:  ['stab pulse',   { wave: 'square', pulse: 0.5 }],
  tri:   ['triangle',     { wave: 'triangle' }],
  sine:  ['whistle',      { wave: 'sine' }],
  pad:   ['lamp pad',     { wave: 'triangle', cycle: 128 }],
  box:   ['music box',    { wave: 'pluck', seconds: 1.6, decay: 3.4 }],
  bell:  ['desk bell',    { wave: 'pluck', seconds: 3.0, decay: 1.4 }],
  bass:  ['tri bass',     { wave: 'triangle' }],
  kick:  ['chip kick',    { wave: 'kick', seconds: 0.14, decay: 30, freqStart: 160, freqEnd: 50 }],
  soft:  ['soft kick',    { wave: 'kick', seconds: 0.12, decay: 36, freqStart: 110, freqEnd: 48 }],
  snare: ['noise snare',  { wave: 'noise', seconds: 0.12, decay: 30, seed: 5 }],
  hat:   ['noise hat',    { wave: 'noise', seconds: 0.03, decay: 110, seed: 9 }],
  shake: ['shaker',       { wave: 'noise', seconds: 0.05, decay: 70, seed: 21 }],
  crash: ['crash',        { wave: 'noise', seconds: 0.9, decay: 5, seed: 33 }],
  tick:  ['clock tick',   { wave: 'kick', seconds: 0.03, decay: 160, freqStart: 3400, freqEnd: 2600, sweep: 60 }],
  tock:  ['clock tock',   { wave: 'kick', seconds: 0.05, decay: 90, freqStart: 1500, freqEnd: 1100, sweep: 50 }],
  block: ['woodblock',    { wave: 'kick', seconds: 0.07, decay: 70, freqStart: 1100, freqEnd: 820, sweep: 40 }],
  chirp: ['chirp',        { wave: 'sine' }],
};

/** Pick samples by kit name; returns the IT sample list and a name -> instrument index map. */
export function kit(names) {
  const I = {};
  const samples = names.map((n, i) => {
    if (!SYNTH[n]) throw new Error(`kit: unknown sample ${n}`);
    I[n] = i;
    return { name: SYNTH[n][0], synth: SYNTH[n][1] };
  });
  return { samples, I };
}

// ---- harmony ------------------------------------------------------------------------
const PC = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const QUAL = { '': [0, 4, 7], m: [0, 3, 7], sus4: [0, 5, 7], sus2: [0, 2, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11] };
const hex = (n) => n.toString(16).toUpperCase();

/**
 * 'F', 'Dm', 'Gm7', 'Csus4', 'C/E'. Bass root sits in D-3..C#4; the stab is a triad
 * inversion whose lowest note lies in G-4..F#5 (common tones stay put between chords);
 * arp is the chord spelled upward from `arpOct`.
 */
export function chord(name, { arpOct = 5 } = {}) {
  const m = name.match(/^([A-G][#b]?)(m7|maj7|m|sus4|sus2|7)?(?:\/([A-G][#b]?))?$/);
  if (!m) throw new Error(`chord: cannot read ${name}`);
  const root = PC[m[1]], ivs = QUAL[m[2] ?? ''], bassPc = m[3] ? PC[m[3]] : root;
  const inRange = (pc, lo) => { let n = pc; while (n < lo) n += 12; return n; };
  const bass = ns(inRange(bassPc, nn('D-3')));
  const triad = ivs.slice(0, 3).map((i) => (root + i) % 12);
  let best = null;
  for (let k = 0; k < 3; k++) {
    const base = inRange(triad[k], nn('G-4'));
    const x = (triad[(k + 1) % 3] - triad[k] + 12) % 12, y0 = (triad[(k + 2) % 3] - triad[k] + 12) % 12;
    const y = y0 <= x ? y0 + 12 : y0;
    const score = Math.abs(base + y / 2 - nn('C-5') - 4);
    if (!best || score < best.score) best = { score, note: ns(base), fx: `J${hex(x)}${hex(y)}` };
  }
  const r0 = inRange(root, nn(`C-${arpOct}`));
  const arp = [...ivs.map((i) => ns(r0 + i)), ns(r0 + 12)];
  return { name, bass, fifth: ns(inRange((root + 7) % 12, nn('D-3'))), stab: [best.note, best.fx], arp, pcs: ivs.map((i) => (root + i) % 12) };
}

/** Progression: names (one bar each) or [name, rows]. Returns [{c, start, len}]. */
export function prog(items, bar = 16) {
  let r = 0;
  return items.map((x) => {
    const [n, len] = Array.isArray(x) ? x : [x, bar];
    const s = { c: chord(n), start: r, len };
    r += len;
    return s;
  });
}

/** Move a note by diatonic steps within a scale (pitch classes). */
export function diatonic(note, steps, scale) {
  let n = nn(note);
  const dir = Math.sign(steps);
  for (let k = 0; k < Math.abs(steps); k++) {
    do n += dir; while (!scale.includes(((n % 12) + 12) % 12));
  }
  return ns(n);
}
export const MAJOR = (tonic) => [0, 2, 4, 5, 7, 9, 11].map((i) => (PC[tonic] + i) % 12);
export const MINOR = (tonic) => [0, 2, 3, 5, 7, 8, 10].map((i) => (PC[tonic] + i) % 12);

/** A written harmony: a diatonic third (or `steps`) under the held notes only. */
export function harmony(events, scale, { steps = -2, minLen = 4, scale: vs = 0.6 } = {}) {
  return events.filter((e) => e[2] >= minLen).map(([r, n, l, v, fx]) => [r, diatonic(n, steps, scale), l, Math.round(v * vs), fx]);
}

// ---- parts --------------------------------------------------------------------------
/**
 * Rhythm lane from a per-bar string, one char per row: '.' rest, other chars look up
 * [instrument, volume] in `map`. `fill` replaces the last rows of the pattern.
 */
export function lane(bar, map, { rows, fill = '', fillMap = map, name = 'lane', skip = () => false } = {}) {
  const list = [];
  for (let r = 0; r < rows; r++) {
    const fromFill = fill && r >= rows - fill.length;
    const c = fromFill ? fill[r - (rows - fill.length)] : bar[r % bar.length];
    const m = fromFill ? fillMap : map;
    if (c === '.' || c === ' ' || (!fromFill && skip(r))) continue;
    if (!m[c]) throw new Error(`${name}: no mapping for '${c}'`);
    list.push([r, ...m[c]]);
  }
  return hits(list, { rows, name });
}

/** Chord stabs on a per-chord rhythm string (row offsets from the chord's start).
 *  `skip(row)` drops a stab, e.g. under a melody's passing note. */
export function stabs(p, inst, { rows, rhythm = '..x...x...x...x.', vol = 22, len = 2, sustain = 0.45, skip = () => false } = {}) {
  const ev = [];
  for (const { c, start, len: cl } of p) {
    for (let i = 0; i < cl; i++) {
      if (rhythm[i % rhythm.length] !== 'x') continue;
      const r = start + i;
      if (r + len >= rows || skip(r)) continue;  // nothing rings over the loop seam
      ev.push([r, c.stab[0], len, vol, c.stab[1]]);
    }
  }
  return phrase(ev, inst, { rows, sustain, name: 'stab' });
}

/** Octave-bounce bass on eighths: loud roots, soft octaves. */
export function bounce(p, inst, { rows, step = 2, vol = 40, soft = 22 } = {}) {
  const ev = [];
  for (const { c, start, len } of p) {
    for (let r = start; r < start + len; r += step) {
      const on = (r - start) % (2 * step) === 0;
      ev.push([r, on ? c.bass : ns(nn(c.bass) + 12), step, on ? vol : soft]);
    }
  }
  return phrase(ev, inst, { rows, sustain: 0.7, name: 'bounce' });
}

/** Bass from a per-chord figure: [offset, 'r'|'f'|'o'|'5o', len, vol]. */
export function figure(p, inst, fig, { rows, sustain = 0.7 } = {}) {
  const ev = [];
  for (const { c, start, len } of p) {
    for (const [off, which, l, v] of fig) {
      if (off >= len) continue;
      const note = { r: c.bass, o: ns(nn(c.bass) + 12), f: c.fifth }[which];
      ev.push([start + off, note, Math.min(l, len - off), v]);
    }
  }
  return phrase(ev, inst, { rows, sustain, name: 'bass figure' });
}

/** Broken chord, one tone per hit, `order` indexes the chord's arp tones. */
export function arp(p, inst, { rows, every = 2, order = [0, 1, 2, 3, 2, 1], vol = 18, len = null, from = 0, to = rows } = {}) {
  const ev = [];
  for (const { c, start, len: cl } of p) {
    let k = 0;
    for (let r = start; r < start + cl; r += every, k++) {
      if (r < from || r >= to) continue;
      ev.push([r, c.arp[order[k % order.length] % c.arp.length], len ?? every, k % 4 === 0 ? vol : Math.round(vol * 0.75)]);
    }
  }
  return phrase(ev, inst, { rows, sustain: 0.8, name: 'arp' });
}

/** Held chord tones (pad): `voice` picks a tone of each chord, `oct` its octave. */
export function pad(p, inst, { rows, voice = 1, oct = 5, vol = 14, sustain = 0.85, release = 0.5 } = {}) {
  const ev = p.map(({ c, start, len }) => {
    const pc = c.pcs[voice % c.pcs.length];
    let n = pc + 12 * oct;
    return [start, ns(n), len, vol];
  });
  return phrase(ev, inst, { rows, sustain, release, name: 'pad' });
}

/** Stamp a jump to `order` on the last row of the first channel that has a free fx cell. */
export function loopTo(channels, rows, order) {
  const fx = `B${order.toString(16).toUpperCase().padStart(2, '0')}`;
  for (const ch of channels) {
    const ev = ch[rows - 1];
    if (!ev) { ch[rows - 1] = { fx }; return; }
    if (!ev.fx) { ch[rows - 1] = { ...ev, fx }; return; }
  }
  throw new Error('loopTo: no free effect cell on the last row');
}

/** Assemble a pattern from named parts in `layout` order, panning each channel once. */
export function assemble(name, rows, layout, pans, parts) {
  const unknown = Object.keys(parts).filter((k) => !layout.includes(k));
  if (unknown.length) throw new Error(`${name}: unknown parts ${unknown}`);
  const channels = layout.map((k, i) => pan({ ...(parts[k] ?? rest()) }, pans[i]));
  return { name, rows, channels };
}
