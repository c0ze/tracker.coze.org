#!/usr/bin/env node
/**
 * FARSTRAND — "Kell, Falling" (Kell worn, the third phase at the Taproot: the falling fight down the strand's face
 * into the corona, Hesper shooting down at him while the camera scrolls; the Heliobane homage). 2026-10-01.
 * D Phrygian, 176 BPM, speed 6: 4 rows/beat, 16 rows/bar; one row = a 16th (85 ms), one bar = 1.36 s.
 * Rendered at 44352 Hz, the smallest rate over 44.1 kHz where 176 BPM is exact (630 samples/tick).
 *
 * Identity: boss_kell re-scored for the fall. Its motif, KELL (the Survey's call turned inside out: 'G D G—— A Bb |
 * C D C——'), its keys, chords and sounds stay (D Phrygian, the march snare, the grit bass, the dark pluck, the glass
 * lead, the radio lead through static, the flesh), but the march is gone: this is Heliobane's pace, 176 BPM, the
 * tempo of its Heralds and of the First Mouth, with the Heralds' gallop under it (kick and grit bass in 3+3+2,
 * 16th-note glass ticks) and the strand's wind through it. A states KELL whole over the gallop. B is the fall: KELL
 * at half speed an octave down in the flesh voice (him, below her, and the hive with him), while the glass lead
 * throws falling figures, four chord tones down every half bar like glass shards going past (the strand ride's
 * shards). C is his channel: the Survey's call upright on the radio lead through static, answered by its mirror on
 * glass bells, over the drive. A3 doubles KELL in glass an octave up and the answer climbs to C7. The build is the
 * Phrygian cadence (bII to I) with a snare roll and a riser.
 *
 * Phrase map
 *   Intro  Dm Gm Dm D                   the drop: wind and static, KELL's head on the radio lead ('G D G——'), a
 *                                       downlifter; the gallop from bar 3, a fill and a riser into A (not looped)
 *   A      Gm Cm Dm Bb-Dm | Gm Cm Eb D   KELL whole over the gallop, its answer to D major (the Concord's chord)
 *   B      Gm Gm Cm Cm | Dm Dm Bb-Dm Dm  the fall: KELL at half speed in the flesh; falling glass figures
 *   C      D A G D | Gm Cm Eb D          the call upright on the radio through static, its mirror on bells; the drive
 *   A3     Gm Cm Dm Bb-Dm | Gm Cm Eb D   KELL doubled in glass, the answer climbing to C7, eighth-note kicks
 *   Build  Eb Eb D D7                    the Phrygian cadence, a snare roll, a riser; the loop jumps to A
 * Loop body: orders 1-5 (36 bars, 49.1 s). Everything synthesized. Source of truth: this file; the shared helpers come
 * from farstrand_halm.gen.js, the motif, the march snare and the radio static after farstrand_boss_kell.gen.js, the
 * gallop after farstrand_strand.gen.js.
 */
import { kick, cymbal, noiseLoop, wave, glassBell, thinPad, mel, line, chart, at, bass, pattern, jump, writeSongCompact,
  ladder, pingpong, canon, notesOf, drumKit, triads, cutLanes, riser, fall } from './heliobane_stage6.kit.js';
import { nn, ns } from './lib.js';
import { sawPluck, soften, delayLine, padLane, wind, fadeIn } from './farstrand_halm.gen.js';

const SR = 22050, TAU = 2 * Math.PI;
const q3 = (x) => Math.round(x * 1000) / 1000;
const I = { kick: 0, snare: 1, hat: 2, tom: 3, bass: 4, pluck: 5, lead: 6, radio: 7, pad: 8, bell: 9, stat: 10, noise: 11,
  flesh: 12 };
const LAYOUT = ['kick', 'snare', 'hat', 'bass', 'hive', 'arp', 'canon', 'lead', 'echo', 'echo2', 'radio', 'radioEcho', 'static',
  'pad', 'bells', 'bellEcho', 'wind', 'fx'];
const PANS = [0x80, 0x78, 0xac, 0x80, 0x80, 0x56, 0xaa, 0x86, 0x50, 0xb4, 0x8c, 0x4c, 0x9c, 0x70, 0x9c, 0x5c, 0x80, 0x88];
const KEYS = ['lead', 'echo', 'echo2', 'radio', 'radioEcho', 'hive', 'arp', 'canon', 'pad', 'bells', 'bellEcho'];

// ---------------------------------------------------------------- samples (boss_kell's)
function rand(seed) { // mulberry32, -1..1 (the kit's generator)
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let v = Math.imul(s ^ (s >>> 15), s | 1);
    v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
    return (((v ^ (v >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}
/** boss_kell's march snare: the two-mode body, its noise through a two-pole low-pass near 2.4 kHz, a short crack. */
function marchSnare(name = 'march snare', { tone = 180, sec = 0.26, seed = 43, lp = 0.5, drive = 1.6 } = {}) {
  const r = rand(seed), n = Math.round(sec * SR), d = new Array(n); let a = 0, b = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, w = r();
    a += lp * (w - a); b += lp * (a - b);
    const body = (Math.sin(TAU * tone * t) * Math.exp(-t * 26) + 0.5 * Math.sin(TAU * tone * 1.71 * t) * Math.exp(-t * 36)) * 0.9;
    d[i] = Math.tanh(drive * (body + b * 2.6 * Math.exp(-t * 15) + w * Math.exp(-t * 450) * 0.3));
  }
  for (let i = 0; i < 48; i++) d[n - 1 - i] *= i / 48;
  let m = 0; for (const x of d) m = Math.max(m, Math.abs(x));
  return { name, samplerate: SR, channels: [d.map((x) => q3((x / m) * 0.97))], role: 'percussion' };
}
/** boss_kell's radio static: noise band-passed about 700 Hz-3.5 kHz with crackle, a seamless loop. */
function radioStatic(name = 'radio static', { sec = 1.4, seed = 67 } = {}) {
  const r = rand(seed), n = Math.round(sec * SR), m = 2048, d = new Array(n + m);
  let lo1 = 0, lo2 = 0, hi1 = 0, hi2 = 0, pop = 0;
  for (let i = 0; i < n + m; i++) {
    const w = r();
    hi1 += 0.55 * (w - hi1); hi2 += 0.55 * (hi1 - hi2);
    lo1 += 0.2 * (hi2 - lo1); lo2 += 0.2 * (lo1 - lo2);
    if (r() > 0.9985) pop = r() * 3;
    pop *= 0.93;
    d[i] = hi2 - lo2 + pop * r();
  }
  for (let i = 0; i < m; i++) d[i] = d[i] * (i / m) + d[n + i] * (1 - i / m);
  let mx = 0; for (let i = 0; i < n; i++) mx = Math.max(mx, Math.abs(d[i]));
  return { name, samplerate: SR, channels: [d.slice(0, n).map((x) => q3((x / mx) * 0.8))], loop: { start: 0, end: n },
    role: 'percussion' };
}

// ---------------------------------------------------------------- melodies (KELL: boss_kell's, unchanged)
const CALL = 'a5/2 d6/2 a6/8 g6/2 f#6/2 | e6/4 d6/4 e6/8 | a5/2 d6/2 b6/8 a6/2 g6/2 | f#6/4 e6/4 d6/8'; // the Survey's
const KELL = 'g6/2 d6/2 g5/8 a5/2 bb5/2 | c6/4 d6/4 c6/8';                                          // turned inside out
const KELL2 = 'g6/2 d6/2 f5/8 g5/2 a5/2 | bb5/4 c6/4 d6/8~';
const ANSWER = 'g6/2 d6/2 g5/8 a5/2 bb5/2 | c6/4 d6/4 eb6/8 | g6/2 eb6/2 bb5/8 g5/2 bb5/2 | a5/4 f#5/4 d5/8';
const MIRROR = 'g6/2 d6/2 g5/8 a5/2 bb5/2 | c6/4 d6/4 c6/8 | g6/2 eb6/2 bb5/8 g5/2 bb5/2 | a5/4 f#5/4 d5/8';
const A_MEL = `${KELL} | ${KELL2} | ${ANSWER}`;
const A3_MEL = `${KELL} | ${KELL2} | d6/2 g6/2 bb6/8 a6/2 g6/2 | eb6/4 d6/4 c6/8 | eb6/2 g6/2 bb6/8 c7/2 bb6/2 | a6/8 f#6/4 a6/4`;
// the fall: KELL at half speed, an octave down in the flesh (him, below her)
const SLOW_KELL = 'g4/4 d4/4 g3/16 a3/4 bb3/4 | c4/8 d4/8 c4/16 | g4/4 d4/4 f3/16 g3/4 a3/4 | bb3/8 c4/8 d4/16';
const C_RADIO = `${CALL} | r/16 | r/16 | r/16 | r/16`;
const C_BELLS = `r/16 | r/16 | r/16 | r/16 | ${MIRROR}`;
const INTRO_RADIO = 'r/16 | g5/2 d5/2 g4/12 | r/16 | r/16';
const BUILD_MEL = 'g6/3 bb6/3 eb7/2 d7/8 | g6/3 bb6/3 eb7/2 f7/8 | f#6/3 a6/3 d7/2 c7/8 | a6/16~';
const CH = {
  intro: 'Dm Gm Dm D', A: 'Gm Cm Dm Bb/8 Dm/8 Gm/16 Cm Eb D', B: 'Gm Gm Cm Cm Dm Dm Bb/8 Dm/8 Dm/16',
  C: 'D A G D Gm Cm Eb D', build: 'Eb Eb D D7',
};
const ROLL = [0, 2, 1, 3, 2, 4, 3, 1, 0, 2, 1, 3, 4, 3, 2, 1]; // boss_kell's 16ths, a march's turn

/** Falling glass: every half bar, four tones of the chord in 16ths falling from under `top` (the second half bar one
 *  chord tone lower, so the figures keep falling), the last held into the next. */
function shards(segs, rows, { top = 'D-7', vol = 34 } = {}) {
  const notes = [];
  for (let r = 0; r < rows; r += 8) {
    const s = at(segs, r), tones = [], from = (r / 8) % 2;
    for (let p = nn(top); tones.length < 5; p--) if (s.tones.has(p % 12)) tones.push(p);
    tones.slice(from, from + 4).forEach((p, k) => notes.push([r + k, ns(p), k === 3 ? 5 : 1, vol - 3 * k, '']));
  }
  return notes;
}

// ---------------------------------------------------------------- the drive (Heliobane's 3+3+2)
const drums = drumKit({
  kick: { X: [I.kick, 46], x: [I.kick, 34] },
  snare: { X: [I.snare, 42], x: [I.snare, 26], g: [I.snare, 12], t: [I.tom, 44, null, 'C-5'], T: [I.tom, 48, null, 'G-4'] },
  hat: { X: [I.hat, 19], x: [I.hat, 12], g: [I.hat, 7] },
});
const G = {
  gallop: { kick: 'X..X..X.X..X..X.', snare: '....X.......X...', hat: 'XgxgXgxgXgxgXgxg' },
  drive: { kick: 'X.X.X.X.X.X.X.X.', snare: '....X.......X...', hat: 'XgxgXgxgXgxgXgxg' },
  fall: { kick: 'X..X..X.X..X..X.', snare: '........X.......', hat: 'XgxgXgxgXgxgXgxg' },
  ticks: { kick: '................', snare: '................', hat: 'x.g.x.g.x.g.x.g.' },
  fill: { kick: 'X..X..X.X.......', snare: '....X...XxXxtTtT', hat: 'XgxgXgxg........' },
  roll: { kick: 'X...X...X...X...', snare: 'XxXxXxXxXXXXXXXX', hat: '................' },
};
const BASS = { gallop: ['RroRroRoRroRroRo', 'RroRroRoRroRt-o-'], drive: ['R-r-R-r-R-r-R-o-'], drone: ['R---------------'] };
const bars = (list) => list.reduce((acc, [n, g, f]) => {
  const d = drums(n, g, f), off = acc.rows;
  for (const k of Object.keys(d)) for (const [r, e] of Object.entries(d[k])) acc.lanes[k][+r + off] = e;
  acc.rows += n * 16;
  return acc;
}, { rows: 0, lanes: { kick: {}, snare: {}, hat: {} } }).lanes;

function section(name, bars_, chordStr, { melody = null, melVol = 42, falling = false, groove = G.gallop, fill = G.fill,
  kit = null, bassR = BASS.gallop, bassVol = 32, arpVol = 20, padVol = 15, bells = null, bellVol = 30, doubled = false,
  hive = null, radio = null, windHi = 10, extra = {} } = {}) {
  const rows = bars_ * 16, segs = chart(chordStr), tri = chart(triads(chordStr));
  const parts = { ...(kit ?? drums(bars_, groove, fill)), wind: wind(bars_, { lo: 4, hi: windHi, inst: I.noise }),
    bass: bass(tri, bassR, I.bass, { rows, lo: 'C-3', vol: bassVol, soft: 0.72, decay: 0.9 }) };
  const refs = [];
  if (hive) {
    const notes = mel(hive, { vol: 40 });
    parts.hive = line(notes, I.flesh, { rows, sustain: 0.85, release: 0.6, vib: 'H43', vibDelay: 4 });
    refs.push(notes);
  }
  if (melody || falling) {
    const notes = falling ? shards(segs, rows) : mel(melody, { vol: melVol });
    const ch = soften(line(notes, I.lead, { rows, vib: falling ? null : 'H33', vibDelay: 3 }), rows, falling ? refs : []);
    parts.lead = ch; refs.push(notesOf(ch, rows));
    [parts.echo, parts.echo2] = pingpong(ch, notes, rows, { d1: 3, s1: 0.4, d2: 6, s2: 0.2, segs });
    refs.push(notesOf(parts.echo, rows), notesOf(parts.echo2, rows));
    if (doubled) {
      const up = mel(melody, { vol: 22, semi: 12 });
      parts.bells = soften(line(up, I.bell, { rows, vib: null }), rows, refs.slice(1));
      refs.push(notesOf(parts.bells, rows));
    }
  }
  if (radio) {
    const notes = mel(radio, { vol: 52 }), ch = line(notes, I.radio, { rows, sustain: 0.85, release: 0.6, vib: 'H22', vibDelay: 2 });
    parts.radio = ch; refs.push(notes);
    parts.radioEcho = canon(ch, notes, rows, { delay: 3, scale: 0.35, segs });
    refs.push(notesOf(parts.radioEcho, rows));
  }
  if (bells) {
    const notes = mel(bells, { vol: bellVol }), ch = soften(line(notes, I.bell, { rows, vib: null }), rows, refs);
    parts.bells = ch;
    parts.bellEcho = soften(delayLine(ch, rows, segs, { delay: 6, scale: 0.4 }), rows, [...refs, notesOf(ch, rows)]);
    refs.push(notes, notesOf(parts.bellEcho, rows));
  }
  const arpNotes = ladder(segs, rows, ROLL, { lo: 'D-4', span: 8, vol: arpVol, soft: 7, len: 1 });
  parts.arp = soften(line(arpNotes, I.pluck, { rows, vib: null }), rows, refs);
  parts.canon = soften(delayLine(parts.arp, rows, segs, { delay: 3, scale: 0.4 }), rows, [...refs, notesOf(parts.arp, rows)]);
  parts.pad = padLane(segs, tri, rows, refs, { lo: 'D-5', vol: padVol, inst: I.pad });
  return pattern(name, bars_, cutLanes({ ...parts, ...extra }, KEYS), LAYOUT, PANS);
}

// ---------------------------------------------------------------- sections
const introTmp = section('tmp', 4, CH.intro).channels;
const intro = section('intro: the drop', 4, CH.intro, { radio: INTRO_RADIO, windHi: 22,
  kit: bars([[1, G.ticks], [1, G.ticks], [1, G.gallop], [1, G.gallop, G.fill]]), bassR: BASS.drone, bassVol: 30, padVol: 12,
  extra: {
    arp: fadeIn(introTmp[LAYOUT.indexOf('arp')], 32, 60), canon: fadeIn(introTmp[LAYOUT.indexOf('canon')], 35, 60),
    bass: { ...fadeIn(introTmp[LAYOUT.indexOf('bass')], 32, 48), 0: { note: 'D-3', instrument: I.bass, vol: 'v24' }, 16: { vol: 'v18' } },
    static: { 0: { note: 'C-5', instrument: I.stat, vol: 'v14' }, 16: { vol: 'v12' }, 28: { vol: 'v6' }, 32: { note: '^^' } },
    fx: { ...fall(I.noise, 0, 24, { note: 'C-6', v0: 22 }), ...riser(I.noise, 48, 64, { note: 'C-4', v0: 4, slope: 1.4, fx: 'F03' }) },
  } });
const build = section('build: bII to I', 4, CH.build, { melody: BUILD_MEL, kit: bars([[2, G.drive], [2, G.drive, G.roll]]),
  bassR: BASS.drive, bassVol: 40, arpVol: 22, padVol: 17, windHi: 14,
  extra: { fx: riser(I.noise, 32, 64, { note: 'C-4', v0: 4, slope: 1.1, fx: 'F03' }) } });

const patterns = [
  intro,
  section('A: KELL over the gallop', 8, CH.A, { melody: A_MEL }),
  section('B: the fall', 8, CH.B, { falling: true, hive: SLOW_KELL, groove: G.fall, arpVol: 16, padVol: 18, windHi: 18,
    extra: { bass: { 0: { note: '^^' } } } }),
  section('C: his channel', 8, CH.C, { radio: C_RADIO, bells: C_BELLS, bellVol: 44, groove: G.drive, bassR: BASS.drive,
    arpVol: 18, padVol: 17, extra: {
      static: { 0: { note: 'C-5', instrument: I.stat, vol: 'v9' }, 60: { vol: 'v4' }, 64: { note: '^^' } },
    } }),
  section('A3: KELL in glass', 8, CH.A, { melody: A3_MEL, doubled: true, groove: G.drive, arpVol: 22, padVol: 17 }),
  jump(build, 1),
];

writeSongCompact(import.meta.url, {
  title: 'Farstrand - Kell, Falling', bpm: 176, ticks: 6, mixvol: 48,
  message: 'FARSTRAND boss theme "Kell, Falling": boss_kell re-scored for the fall.\nD Phrygian, 176 BPM. Orders 1-5 loop.\nKELL over Heliobane\'s gallop.\nAll samples synthesized. Source: songs/farstrand_boss_kell_fall.gen.js',
  samples: [
    kick({ f0: 170, f1: 48, sweep: 30, decay: 10, click: 0.2, drive: 2.0, sec: 0.35 }),
    marchSnare(),
    cymbal('glass tick', { sec: 0.05, decay: 100, seed: 17, metalMix: 0.7 }),
    { ...kick({ f0: 180, f1: 90, sweep: 25, decay: 12, click: 0.15, drive: 1.6, sec: 0.35 }), name: 'tom' },
    wave('grit bass', [1, 0.55, 0.38, 0.26, 0.18, 0.12, 0.08, 0.05, 0.03]),
    sawPluck('dark pluck', { open: 2600, closed: 300, close: 7, decay: 4, sec: 0.8 }),
    wave('glass lead', [1, 0.03, 0.45, 0.02, 0.22, 0.02, 0.1, 0, 0.05]),
    wave('radio lead', [0.45, 0.8, 0.9, 0.75, 0.55, 0.4, 0.25, 0.12, 0.06]),
    thinPad('warm pad', { amps: [1, 0.55, 0.35, 0.22, 0.14, 0.08], spread: 1 }),
    glassBell('glass bell', { sec: 1.6, partials: [[1, 1, 1.6], [2.76, 0.45, 4], [5.4, 0.2, 7.5], [8.93, 0.08, 12]] }),
    radioStatic(), noiseLoop(),
    wave('flesh', [1, 0.7, 0.45, 0.32, 0.22, 0.15, 0.1, 0.06]),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
