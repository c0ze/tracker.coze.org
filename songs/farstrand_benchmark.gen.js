#!/usr/bin/env node
/**
 * FARSTRAND — "The Benchmark" (inside Survey Six's dead ship, jammed in the Knot). 2026-09-26.
 * D minor (the title's key: the far strand, the Survey's job), 80 BPM, speed 6: 4 rows/beat, 16 rows/bar;
 * one row = a 16th (188 ms), one bar = 3 s. Rendered at 48 kHz, where 80 BPM is exact (1500 samples/tick).
 *
 * Identity: sparse, mechanical, cold, and the Survey's own small theme heard through static. Mechanical: the
 * ship still ticks: a relay clicking every beat like a clock, a failing pump (a dull lub-dub and a hiss of
 * hydraulics once a bar), a loose hull plate knocking in the draught at odd rows. Cold: the family's cold pad
 * with a glass harmonica an octave over it, a low held root, a breath of wind through the torn side. The
 * Survey's theme is a small bugle-like call in D major, the cheer of the launch: a sighting (5 up to 1 up to
 * 5, "A D A——"), stepping down, an answer that reaches the sixth and comes home ("A D B——", "F# E D——"). It
 * plays on a radio lead (a weak fundamental, strong 2nd-4th harmonics: a small speaker) with a slow wow, over
 * static, and the signal drops out: at each dropout the lead falls to a whisper and the static surges. The
 * hull throws it back 3 rows late. In A and C the head is only a memory, far off on glass bells in minor.
 *
 * Phrase map
 *   Intro   Dm Dm                          wind, a low D, the relay starting, one knock, a reverse swell (not looped)
 *   A       Dm Bbmaj7 Gm A | Dm Bbmaj7 Eb A   the dead ship: relay, pump, knocks; the pads; the theme's head far
 *                                         off on glass bells in minor ("A D A——", "A D F——") with 6/12-row echoes
 *   B       D A G D | D A G A              the beacon: the Survey's theme on the radio lead through static, whole,
 *                                         then again breaking up (it never reaches home: E over A)
 *   C       Gm Dm Bbmaj7 A | Gm Dm Eb Asus4-A   cold: the pump every other bar, the head on glass bells in minor,
 *                                         the radio back once, faint ("A D A——" in static); a swell back into A
 * Loop body: orders 1-3 (24 bars, 72 s). Everything synthesized. Source of truth: this file; the shared helpers
 * come from farstrand_halm.gen.js.
 */
import { kick, cymbal, steam, clank, noiseLoop, wave, glassBell, thinPad, swell, mel, line, chart, bass, beat, rep, pattern,
  jump, writeSongCompact, pingpong, canon, notesOf, hits, triads, cutLanes } from './heliobane_stage6.kit.js';
import { echoChannel } from './lib.js';
import { soften, padLane, wind, fadeIn } from './farstrand_halm.gen.js';

const SR = 22050;
const q3 = (x) => Math.round(x * 1000) / 1000;
const I = { pump: 0, steam: 1, tick: 2, clank: 3, bass: 4, radio: 5, pad: 6, glass: 7, bell: 8, noise: 9, stat: 10, swell: 11 };
const LAYOUT = ['pump', 'steam', 'tick', 'clank', 'bass', 'radio', 'radioEcho', 'static', 'pad', 'glass', 'bells', 'bellEcho',
  'bellEcho2', 'wind', 'fx'];
const PANS = [0x80, 0x98, 0xa8, 0x5c, 0x80, 0x88, 0x4c, 0x9c, 0x70, 0x94, 0x68, 0xb0, 0x40, 0x80, 0x90];
const KEYS = ['radio', 'radioEcho', 'pad', 'glass', 'bells', 'bellEcho', 'bellEcho2'];

// ---------------------------------------------------------------- samples
function rand(seed) { // mulberry32, -1..1 (the kit's generator)
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let v = Math.imul(s ^ (s >>> 15), s | 1);
    v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
    return (((v ^ (v >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}
/** Radio static: white noise through a two-pole band (about 700-3500 Hz) with crackle pops, a seamless loop (its
 *  last 2048 samples cross-faded into its start). */
function radioStatic(name = 'radio static', { sec = 1.4, seed = 61 } = {}) {
  const r = rand(seed), n = Math.round(sec * SR), m = 2048, d = new Array(n + m);
  let lo1 = 0, lo2 = 0, hi1 = 0, hi2 = 0, pop = 0;
  for (let i = 0; i < n + m; i++) {
    const w = r();
    hi1 += 0.55 * (w - hi1); hi2 += 0.55 * (hi1 - hi2);          // low-pass near 3.5 kHz
    lo1 += 0.2 * (hi2 - lo1); lo2 += 0.2 * (lo1 - lo2);          // minus a low-pass near 700 Hz
    if (r() > 0.9985) pop = r() * 3;
    pop *= 0.93;
    d[i] = hi2 - lo2 + pop * r();
  }
  for (let i = 0; i < m; i++) d[i] = d[i] * (i / m) + d[n + i] * (1 - i / m);
  let mx = 0; for (let i = 0; i < n; i++) mx = Math.max(mx, Math.abs(d[i]));
  return { name, samplerate: SR, channels: [d.slice(0, n).map((x) => q3((x / mx) * 0.8))], loop: { start: 0, end: n },
    role: 'percussion' };
}

// ---------------------------------------------------------------- the Survey's theme
const THEME = 'a4/2 d5/2 a5/8 g5/2 f#5/2 | e5/4 d5/4 e5/8 | a4/2 d5/2 b5/8 a5/2 g5/2 | f#5/4 e5/4 d5/8';
const BREAKING = 'a4/2 d5/2 a5/8 g5/2 f#5/2 | e5/4 d5/4 e5/8 | a4/2 d5/2 b5/8 a5/2 g5/2 | f#5/4 e5/12';
const A_BELLS = 'r/8 a5/2 d6/2 a6/4 | r/16 | r/16 | r/16 | r/8 a5/2 d6/2 f6/4 | r/16 | r/16 | r/16';
const C_BELLS = 'r/4 a5/2 d6/2 g6/8 | r/16 | r/4 a5/2 d6/2 f6/8 | r/16 | r/4 bb5/2 d6/2 g6/8 | r/16 | r/4 bb5/2 eb6/2 g6/8 | r/16';
const C_RADIO = 'r/16 | r/16 | r/16 | r/16 | r/16 | a4/2 d5/2 a5/12 | r/16 | r/16';
const CH = {
  intro: 'Dm Dm', A: 'Dm Bbmaj7 Gm A Dm Bbmaj7 Eb A', B: 'D A G D D A G A', C: 'Gm Dm Bbmaj7 A Gm Dm Eb Asus4/8 A/8',
};
// [row, rows]: where the signal drops out (the lead to a whisper, the static up)
const B_DROPS = [[26, 2], [45, 1], [60, 2], [85, 3], [100, 7], [113, 2], [118, 10]];
const C_DROPS = [[85, 2], [90, 4]];

// ---------------------------------------------------------------- parts
const MACHINE = {
  pump: { X: [I.pump, 22], x: [I.pump, 13] }, steam: { S: [I.steam, 13], s: [I.steam, 8] }, tick: { X: [I.tick, 20], x: [I.tick, 12] },
};
const G = {
  run: { pump: 'X..x............', steam: '......S.........', tick: 'X...x...x...x...' },
  thin: { pump: '................', steam: '................', tick: 'x.......x.......' },
  slow: { pump: 'X..x............', steam: '......s.........', tick: 'x.......x.......' },
};
function machine(bars, grooves) {
  const lane = (k) => beat(Array.from({ length: bars }, (_, b) => grooves[b % grooves.length][k]), MACHINE[k]);
  return { pump: lane('pump'), steam: lane('steam'), tick: lane('tick') };
}
/** The static bed: the loop held at `base`, surging to `surge` at each dropout and settling back after it. */
function staticLane(rows, drops, { base = 5, surge = 24 } = {}) {
  const ch = { 0: { note: 'C-5', instrument: I.stat, vol: `v${base}` } };
  for (const [r, len] of drops) {
    ch[r] = { vol: `v${surge}` };
    if (len > 2) ch[r + 1] = { vol: `v${Math.round(surge * 0.8)}` };
    if (r + len < rows) ch[r + len] = { vol: `v${Math.round(base + (surge - base) * 0.3)}` };
    if (r + len + 1 < rows) ch[r + len + 1] = { vol: `v${base}` };
  }
  return ch;
}
/** The signal dropping out: from each [row, len] the lead is a whisper (v3), then back where its own envelope is. */
function dropouts(ch, rows, drops, floor = 3) {
  const out = { ...ch };
  const volAt = (r) => { for (let k = r; k >= 0; k--) if (ch[k]?.vol) return ch[k].vol; return null; };
  for (const [r, len] of drops) {
    const back = volAt(r + len);
    for (let k = r; k < r + len && k < rows; k++) {
      if (out[k]?.note === '^^') continue;
      if (out[k] || k === r) out[k] = { ...(out[k] ?? {}), vol: `v${floor}` };
    }
    const e = out[r + len];
    if (r + len < rows && back && !e?.note) out[r + len] = { ...(e ?? {}), vol: back };
  }
  return out;
}

function section(name, bars, chordStr, { radio = null, radioVol = 34, drops = [], statBase = 5, bells = null, bellVol = 30,
  grooves = [G.run], knocks = [], padVol = 14, glassVol = 6, bassVol = 16, windHi = 7, extra = {} } = {}) {
  const rows = bars * 16, segs = chart(chordStr), tri = chart(triads(chordStr));
  const parts = { ...machine(bars, grooves), clank: hits(I.clank, knocks, { note: 'A-4', vol: 20 }),
    wind: wind(bars, { lo: 2, hi: windHi, inst: I.noise }),
    bass: bass(tri, ['R---------------'], I.bass, { rows, lo: 'D-3', vol: bassVol, decay: 0.97 }) };
  const refs = [];
  if (radio) {
    const notes = mel(radio, { vol: radioVol });
    const ch = dropouts(line(notes, I.radio, { rows, sustain: 0.85, release: 0.6, vib: 'H22', vibDelay: 2 }), rows, drops);
    parts.radio = ch; refs.push(notes);
    parts.radioEcho = canon(ch, notes, rows, { delay: 3, scale: 0.35, segs });  // the hull throws it back
    refs.push(notesOf(parts.radioEcho, rows));
    parts.static = staticLane(rows, drops, { base: statBase });
  }
  if (bells) {
    const notes = mel(bells, { vol: bellVol }), ch = soften(line(notes, I.bell, { rows, vib: null }), rows, refs);
    parts.bells = ch;
    [parts.bellEcho, parts.bellEcho2] = pingpong(ch, notes, rows, { d1: 6, s1: 0.42, d2: 12, s2: 0.22, segs });
    refs.push(notes, notesOf(parts.bellEcho, rows), notesOf(parts.bellEcho2, rows));
  }
  parts.pad = padLane(segs, tri, rows, refs, { lo: 'F-4', vol: padVol, inst: I.pad });
  parts.glass = echoChannel(parts.pad, { delay: 0, semi: 12, scale: glassVol / padVol, inst: I.glass, rows });
  return pattern(name, bars, cutLanes({ ...parts, ...extra }, KEYS), LAYOUT, PANS);
}

// ---------------------------------------------------------------- sections
const introParts = section('tmp', 2, CH.intro).channels;
const intro = section('intro: the hull', 2, CH.intro, { grooves: [G.thin], knocks: [10], padVol: 12, extra: {
  bass: fadeIn(introParts[LAYOUT.indexOf('bass')], 0, 16), pad: fadeIn(introParts[LAYOUT.indexOf('pad')], 4, 24),
  tick: beat(['................', 'X...x...x...x...'], MACHINE.tick),
  static: { 0: { note: 'C-5', instrument: I.stat, vol: 'v2' }, 20: { vol: 'v10' }, 22: { vol: 'v3' }, 26: { note: '^^' } },
  fx: hits(I.swell, [25], { vol: 24 }),
} });
const cold = section('C: cold', 8, CH.C, { radio: C_RADIO, radioVol: 22, drops: C_DROPS, statBase: 3, bells: C_BELLS, bellVol: 32,
  grooves: [G.slow, G.thin], knocks: [44], padVol: 16, glassVol: 8, windHi: 10, extra: { fx: hits(I.swell, [121], { vol: 22 }) } });

const patterns = [
  intro,
  section('A: the dead ship', 8, CH.A, { bells: A_BELLS, knocks: [6, 37, 58, 101, 118] }),
  section('B: the beacon', 8, CH.B, { radio: `${THEME} | ${BREAKING}`, drops: B_DROPS, knocks: [70], padVol: 12, windHi: 5 }),
  jump(cold, 1),
];

writeSongCompact(import.meta.url, {
  title: 'Farstrand - The Benchmark', bpm: 80, ticks: 6, mixvol: 48,
  message: 'FARSTRAND "The Benchmark": inside Survey Six\'s dead ship.\nD minor, 80 BPM. Orders 1-3 loop.\nThe Survey\'s theme through static.\nAll samples synthesized. Source: songs/farstrand_benchmark.gen.js',
  samples: [
    kick({ f0: 110, f1: 46, sweep: 18, decay: 8, click: 0.03, drive: 1.3, sec: 0.5 }),
    steam('hydraulic hiss', { sec: 0.5, seed: 83 }),
    cymbal('relay tick', { sec: 0.04, decay: 120, seed: 23, metalMix: 0.9 }),
    { ...clank('hull knock', { base: 150, drive: 1.4, seed: 37, bright: 0.6 }), role: 'percussion' },
    wave('round bass', [1, 0.3, 0.1, 0.04]),
    wave('radio lead', [0.45, 0.8, 0.9, 0.75, 0.55, 0.4, 0.25, 0.12, 0.06]),
    thinPad('cold pad', { amps: [1, 0, 0.3, 0, 0.12, 0, 0.05], spread: 1 }),
    thinPad('glass harmonica', { amps: [1, 0, 0.18, 0, 0.06], spread: 2 }),
    glassBell('glass bell', { sec: 2.0, partials: [[1, 1, 1.2], [2.76, 0.45, 3.2], [5.4, 0.2, 6.5], [8.93, 0.08, 10]] }),
    noiseLoop(), radioStatic(), swell('swell', { sec: 1.2, seed: 31 }),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
