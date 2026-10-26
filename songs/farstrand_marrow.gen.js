#!/usr/bin/env node
/**
 * FARSTRAND — "The Marrow" (the secret region: the cold hollow inside every strand, the oldest glass, Mott's road,
 * the last transmission's echo and the Hesper who said yes at the bottom; GDD 20: 70 BPM, almost ambient). 2026-10-07.
 * A (Aeolian, no thirds), 70 BPM, speed 6: 4 rows/beat, 16 rows/bar; one row = a 16th (214 ms), one bar = 3.43 s.
 * Rendered at 44.1 kHz, where 70 BPM is exact (1575 samples/tick). Mastered quieter than the worlds (music.json
 * `lufs`), a bed under the Marrow's echo (Wren and Mott talking).
 *
 * Identity: a hollow tube of old glass. Nothing in it has a third. The strand's foot hums on A (anchor_hum, 55 Hz),
 * and the Marrow is the hollow that hum runs down, so the drone is that A, an octave up, in a closed-pipe voice (odd
 * harmonics only, and no fifth harmonic, which would be a major third; the pad's voice is built the same way). Over
 * it a pad of open fifths moves in parallel, the oldest harmony there is (organum: the Warden's choir sings a fifth
 * up too), down the Phrygian tetrachord A G F E, the oldest sad line there is.
 * Glass bells strike the top of each fifth and ring for seconds into long echoes (6 and 12 rows: 1.3 and 2.6 s: the
 * tube's length); a soft knock on the pipe marks each change; frost ticks (the faint old marks); the cold breathes
 * through the tube (a dull wind, an octave down). No drums, no arp, no bass line.
 * The only tune is a ghost: Hesper's question (farstrand_title.gen.js: 5 up a minor sixth to b3, 2, 1) moved down a
 * fourth into A on the title's ocarina, far off, with long echoes, once whole and once its answer, since the Hesper
 * who said yes is the one at the bottom.
 *
 * Phrase map
 *   Intro  A5                        the hollow drone and the breath fade in, a fifth rises, one bell (not looped)
 *   A      A5 G5 F5 E5 (2 bars each)  the descent: parallel fifths, a bell on the top of each (E6 D6 C6 B5), a knock
 *   B      A5 (4) D5 E5               the ghost: 'E C B | A' (bar 2-3), 'E D C | B' (bar 6-7) on the ocarina; bells on A6, A6, B6
 *   C      A5 -- D5 E5                the hollow: the drone and the breath at their loudest, the pad gone for bars 3-4 and
 *                                     back as D5 and E5, a cluster of frost, a far A5 and E7, a reverse swell into A
 *                                     (the loop jumps to A: the drone and the breath retrigger there, both low)
 * Loop body: orders 1-3 (24 bars, 82.3 s). Everything synthesized. Source of truth: this file; the shared helpers
 * come from farstrand_halm.gen.js.
 */
import { kick, wave, glassBell, thinPad, cymbal, swell, mel, line, chart, pattern, jump, writeSongCompact, pingpong,
  notesOf, hits, cutLanes } from './heliobane_stage6.kit.js';
import { soften } from './farstrand_halm.gen.js';

const SR = 22050;
const q3 = (x) => Math.round(x * 1000) / 1000;
const v = (x) => `v${Math.max(0, Math.min(64, Math.round(x)))}`;
const I = { drone: 0, pad: 1, bell: 2, lead: 3, knock: 4, tick: 5, noise: 6, swell: 7 };
const LAYOUT = ['drone', 'padA', 'padAf', 'padB', 'padBf', 'bells', 'bellEcho', 'bellEcho2', 'ghost', 'ghostEcho', 'ghostEcho2',
  'knock', 'tick', 'wind', 'fx'];
const PANS = [0x80, 0x6c, 0x94, 0x78, 0x88, 0x9c, 0x5c, 0xb4, 0x84, 0x4c, 0xbc, 0x80, 0xa4, 0x80, 0x90];
const KEYS = ['padA', 'padAf', 'padB', 'padBf', 'bells', 'bellEcho', 'bellEcho2', 'ghost', 'ghostEcho', 'ghostEcho2'];

// ---------------------------------------------------------------- samples
function rand(seed) { // mulberry32, -1..1 (the kit's generator)
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = Math.imul(s ^ (s >>> 15), s | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return (((x ^ (x >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}
/** The cold breathing down the tube: white noise through a two-pole low-pass near 750 Hz with a little raw hiss, a
 *  seamless loop (its last 2048 samples cross-faded into its start); played an octave down it is dull and hollow. */
function windLoop(name = 'tube breath', { sec = 1.8, seed = 83, lp = 0.22, air = 0.06 } = {}) {
  const r = rand(seed), n = Math.round(sec * SR), m = 2048, d = new Array(n + m);
  let a = 0, b = 0;
  for (let i = 0; i < n + m; i++) { const w = r(); a += lp * (w - a); b += lp * (a - b); d[i] = b + air * w; }
  for (let i = 0; i < m; i++) d[i] = d[i] * (i / m) + d[n + i] * (1 - i / m);
  let mx = 0; for (let i = 0; i < n; i++) mx = Math.max(mx, Math.abs(d[i]));
  return { name, samplerate: SR, channels: [d.slice(0, n).map((x) => q3((x / mx) * 0.85))], loop: { start: 0, end: n }, role: 'percussion' };
}

// ---------------------------------------------------------------- the tune and the marks
const GHOST_B = 'r/16 | e5/4 c6/10~ b5/2 | a5/12~ r/4 | r/16 | r/16 | e5/4 d6/10~ c6/2 | b5/16~ | r/16'; // the question, in A
const BELLS_A = 'e6/16 | r/16 | d6/16 | r/16 | c6/16 | r/16 | b5/16 | r/16';
const BELLS_B = 'a6/16 | r/16 | r/16 | r/16 | a6/16 | r/16 | b6/16 | r/16';
const BELLS_C = 'r/16 | r/16 | a5/16 | r/16 | r/16 | e7/16 | r/16 | r/16';
// organum: [start row, length, root, fifth, level]; the chords' tones are the gate for the echoes
const FIFTHS = {
  A: [[0, 32, 'A-4', 'E-5', 1], [32, 32, 'G-4', 'D-5', 1], [64, 32, 'F-4', 'C-5', 1], [96, 32, 'E-4', 'B-4', 1]],
  B: [[0, 64, 'A-4', 'E-5', 1], [64, 32, 'D-4', 'A-4', 1], [96, 32, 'E-4', 'B-4', 1]],
  C: [[0, 32, 'A-4', 'E-5', 0.55], [64, 32, 'D-4', 'A-4', 0.6], [96, 32, 'E-4', 'B-4', 0.8]],
};
const CH = { intro: 'A5/32', A: 'A5/32 G5/32 F5/32 E5/32', B: 'A5/64 D5/32 E5/32', C: 'A5/64 D5/32 E5/32' };

/** `count` frost ticks over a section's 128 rows, in small clusters (the old marks), seeded; [row, volume]. */
function frost(count, seed, rows = 128) {
  const r = rand(seed), out = new Map();
  while (out.size < count) {
    const at = Math.floor((r() * 0.5 + 0.5) * (rows - 4)), n = 1 + Math.floor((r() * 0.5 + 0.5) * 3);
    for (let k = 0, row = at; k < n && out.size < count && row < rows; k++, row += 2) {
      if (!out.has(row)) out.set(row, Math.round(14 + (r() * 0.5 + 0.5) * 10));
    }
  }
  return [...out.entries()].sort((a, b) => a[0] - b[0]);
}
const tickLane = (list) => Object.fromEntries(list.map(([r, vol]) => [r, { note: 'C-5', instrument: I.tick, vol: v(vol) }]));
const FROST = { A: tickLane(frost(8, 47)), B: tickLane(frost(8, 53)), C: tickLane(frost(14, 59)) }; // C is the hollow: the most marks

// ---------------------------------------------------------------- parts
/** The drone: a low A held, swelling over the section and sinking back, low at both ends so the loop's retrigger is quiet. */
function drone(bars, { lo = 5, hi = 10, note = 'A-3' } = {}) {
  const rows = bars * 16, ch = { 0: { note, instrument: I.drone, vol: v(lo) } };
  for (let r = 4; r < rows; r += 4) ch[r] = { vol: v(lo + (hi - lo) * Math.sin(Math.PI * r / rows)) };
  return ch;
}
/** The breath: the looped noise an octave down, swelling once across the section. */
function breath(bars, { lo = 2, hi = 6 } = {}) {
  const rows = bars * 16, ch = { 0: { note: 'C-4', instrument: I.noise, vol: v(lo) } };
  for (let r = 4; r < rows; r += 4) ch[r] = { vol: v(lo + (hi - lo) * Math.sin(Math.PI * r / rows)) };
  return ch;
}
/** Organum: each chord a root and the fifth over it, each swelling in and out (a sine squared, so the pad breathes
 *  once per chord and is near silent where the fifths change: A to G rubs a second). `over` rows of overlap with the
 *  next chord are possible (the chords alternate between two lane pairs) but not used. */
function organum(segs, rows, { vol = 10, over = 0 } = {}) {
  const out = { padA: {}, padAf: {}, padB: {}, padBf: {} };
  segs.forEach(([row, len, root, fifth, level], i) => {
    const pair = i % 2 ? ['padB', 'padBf'] : ['padA', 'padAf'];
    const start = row > 0 ? row - over / 2 : 0, end = Math.min(rows, row + len + (row + len < rows ? over / 2 : 0));
    [root, fifth].forEach((note, k) => {
      const ch = out[pair[k]], hi = vol * level * (k ? 0.8 : 1);
      ch[start] = { note, instrument: I.pad, vol: v(1) };
      for (let r = start + 2; r < end - 1; r += 2) ch[r] = { vol: v(1 + hi * Math.sin(Math.PI * (r - start) / (end - start)) ** 2) };
      if (end < rows) ch[end] = { note: '^^' };
    });
  });
  return out;
}

function section(name, bars, chordStr, { fifths = [], bells = null, ghost = null, ticks = {}, knocks = [], droneLo = 5, droneHi = 10,
  breathHi = 6, padVol = 10, extra = {} } = {}) {
  const rows = bars * 16, segs = chart(chordStr);
  const parts = { drone: drone(bars, { lo: droneLo, hi: droneHi }), wind: breath(bars, { hi: breathHi }), tick: ticks,
    knock: hits(I.knock, knocks, { note: 'C-5', vol: 16 }), ...organum(fifths, rows, { vol: padVol }) };
  const refs = [];
  if (ghost) {
    const notes = mel(ghost, { vol: 17 }), ch = line(notes, I.lead, { rows, vib: 'H22', vibDelay: 6 });
    parts.ghost = ch; refs.push(notes);
    [parts.ghostEcho, parts.ghostEcho2] = pingpong(ch, notes, rows, { d1: 6, s1: 0.4, d2: 12, s2: 0.22, segs });
    refs.push(notesOf(parts.ghostEcho, rows), notesOf(parts.ghostEcho2, rows));
  }
  if (bells) {
    const notes = mel(bells, { vol: 30 }), ch = soften(line(notes, I.bell, { rows, vib: null }), rows, refs);
    parts.bells = ch;
    [parts.bellEcho, parts.bellEcho2] = pingpong(ch, notes, rows, { d1: 6, s1: 0.45, d2: 12, s2: 0.25, segs });
    refs.push(notes, notesOf(parts.bellEcho, rows), notesOf(parts.bellEcho2, rows));
  }
  return pattern(name, bars, cutLanes({ ...parts, ...extra }, KEYS), LAYOUT, PANS);
}

// ---------------------------------------------------------------- sections
const intro = section('intro: the hollow', 2, CH.intro, { fifths: [[0, 32, 'A-4', 'E-5', 0.6]], bells: 'r/16 | r/4 e6/12', droneLo: 1, droneHi: 8,
  breathHi: 5, extra: { fx: hits(I.swell, [26], { vol: 12 }) } });
const A = section('A: the descent', 8, CH.A, { fifths: FIFTHS.A, bells: BELLS_A, ticks: FROST.A, knocks: [0, 32, 64, 96] });
const B = section('B: the ghost', 8, CH.B, { fifths: FIFTHS.B, bells: BELLS_B, ghost: GHOST_B, ticks: FROST.B, knocks: [0, 64], padVol: 9 });
const C = section('C: the hollow', 8, CH.C, { fifths: FIFTHS.C, bells: BELLS_C, ticks: FROST.C, knocks: [64], droneHi: 14, breathHi: 8,
  padVol: 8, extra: { fx: hits(I.swell, [122], { vol: 12 }) } });

const patterns = [intro, A, B, jump(C, 1)];

writeSongCompact(import.meta.url, {
  title: 'Farstrand - The Marrow', bpm: 70, ticks: 6, mixvol: 48,
  message: 'FARSTRAND "The Marrow": the secret region, a hollow of old glass.\nA, 70 BPM. Orders 1-3 loop.\nOpen fifths, a ghost of the title question.\nAll samples synthesized. Source: songs/farstrand_marrow.gen.js',
  samples: [
    wave('hollow drone', [1, 0, 0.55, 0, 0, 0, 0.16, 0, 0.08]),
    thinPad('hollow pad', { amps: [1, 0, 0.55, 0, 0, 0, 0.18, 0, 0.1], spread: 1 }),
    glassBell('glass bell', { sec: 3.5, partials: [[1, 1, 0.7], [2.76, 0.45, 1.8], [5.4, 0.2, 3.8], [8.93, 0.08, 7]] }),
    wave('soft lead', [1, 0, 0.3, 0, 0.1, 0, 0.04]),
    { ...kick({ f0: 130, f1: 65, sweep: 22, decay: 7, click: 0, drive: 1.1, sec: 0.8 }), name: 'knock' },
    cymbal('frost tick', { sec: 0.05, decay: 90, seed: 19, metalMix: 0.8 }),
    windLoop(), swell('swell', { sec: 1.2, seed: 31 }),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
