#!/usr/bin/env node
/**
 * HELIOBANE boss — "Herald" (every Herald fight). MUSIC-A, 2026-09-24.
 * C minor (→ C# minor), 176 BPM, speed 6: 4 rows/beat, 16 rows/bar, 8 bars = 10.9 s.
 *
 * Identity: a relentless 16th saw-bass ostinato accented 3+3+2 (C C C | C C C | C C)
 * that turns through Db / Gb–F at the bar end, with power-chord stabs on the accents (stabs stay on the chord root).
 *
 * Phrase map
 *   Intro   ostinato + a glide siren C→G, drums enter with a fill (not looped)
 *   A       Cm Cm Ab G / Cm Cm Db G       3-3-2 cell "G C Eb | D—C—", G major (B natural) keeps it tense
 *   A2      same + echo and J-arp pulses
 *   B       Fm Fm Cm Cm Ab Bb G G         longer notes climbing to B6 over G, b13 (Eb) against G at the end
 *   Hammer  Cm Cm Ab Bb Cm Cm Db G        no lead: orchestra hits and power chords on 3-3-2-3-3-2 accents
 *   Alarm   Cm Db Bb Cm C Fm D7 G# over a C pedal, 16th arp alarm, chromatic siren C6→G#6
 *           (G# = Ab of C minor = V of C# minor: the pivot into phase two)
 *   A↑ B↑   half step up (C# minor), written harmony; phase-two lift
 *   Break   drums + ostinato only, back in C
 * Loop body: orders 1–8 (60 bars, 82 s).
 */
import { kick, snare, cymbal, orchHit, noiseLoop, wave, superSaw, powerChord,
  mel, line, echoOf, chart, at, arp, bass, pad, harmony, beat, rep, pattern, jump, writeSongCompact } from './heliobane_title.kit.js';
import { nn, ns } from './lib.js';

const I = { kick: 0, snare: 1, hat: 2, ohat: 3, crash: 4, bass: 5, gtr: 6, arp: 7, lead: 8, pad: 9, orch: 10, noise: 11 };
const LAYOUT = ['kick', 'snare', 'hat', 'bass', 'gtr', 'arp', 'lead', 'echo', 'pad', 'fx'];
const PANS = [0x80, 0x78, 0xb0, 0x80, 0x5a, 0xa8, 0x88, 0x54, 0x70, 0x90];
const K = { X: [I.kick, 64], x: [I.kick, 48] };
const S = { X: [I.snare, 58], x: [I.snare, 42], g: [I.snare, 16] };
const H = { X: [I.hat, 30], x: [I.hat, 20], g: [I.hat, 11], o: [I.ohat, 24] };

// ---------------------------------------------------------------- ostinato & grooves
const OST = ['RrrRrrRrRrrRrr1-', 'RrrRrrRrRrrR6-5-'];
const STAB = ['R..R..R.R..R..R.'];
const G = {
  main: { kick: 'X..X..X.X..X..X.', snare: '....X.......X...', hat: 'XgxgXgxgXgxgXgxg' },
  drive: { kick: 'X.X.X.X.X.X.X.X.', snare: '....X.......X...', hat: 'XgxgXgxgXgxgXgxg' },
  hammer: { kick: 'X..X..X...X..X..', snare: '......X.......X.', hat: 'x.x.x.x.x.x.x.x.' },
  alarm: { kick: 'X...X...X...X...', snare: '....X.......X...', hat: '..o...o...o...o.' },
  fill: { kick: 'X..X..X.X.......', snare: '....X...XxXxXXXX', hat: 'XgxgXgxg........' },
};
const CH = {
  A: 'Cm Cm Ab G Cm Cm Db G', B: 'Fm Fm Cm Cm Ab Bb G G', hammer: 'Cm Cm Ab Bb Cm Cm Db G',
  alarm: 'Cm Db Bb Cm C Fm D7 G#', pedal: 'C5 C5 C5 C5 C5 C5 C5 C5', brk: 'C5 C5 C5 C5',
};

// ---------------------------------------------------------------- melodies
const A_MEL = 'g5/3 c6/3 eb6/2 d6/4 c6/4 | g5/3 c6/3 eb6/2 g6/4 f6/2 eb6/2 | eb6/3 c6/3 ab5/2 c6/4 eb6/4 | d6/3 b5/3 g5/2 b5/8~'
  + ' | g5/3 c6/3 eb6/2 d6/4 c6/4 | g5/3 c6/3 eb6/2 g6/4 ab6/2 g6/2 | f6/3 db6/3 ab5/2 db6/4 f6/4 | g6/3 f6/3 d6/2 b5/8~';
const B_MEL = 'c6/8~ ab5/4 f5/4 | c6/4 f6/4 eb6/4 c6/4 | eb6/8~ d6/4 c6/4 | g6/6 f6/2 eb6/4 c6/4'
  + ' | ab6/6 g6/2 eb6/4 c6/4 | bb6/6 ab6/2 f6/4 d6/4 | b6/8~ g6/4 d6/4 | f6/4 eb6/4 d6/4 b5/4';
const SIREN = 'c6/16~ | db6/16~ | d6/16~ | eb6/16~ | e6/16~ | f6/16~ | f#6/16~ | g#6/16~';
const INTRO = 'c6/4 g6/12> | c6/4 g6/12> | c6/4 ab6/12> | g6/16~';

// ---------------------------------------------------------------- sections
function drums(bars, g, fill = true) {
  const f = fill ? G.fill : {};
  return { kick: beat(rep(bars, g.kick, f.kick), K), snare: beat(rep(bars, g.snare, f.snare), S), hat: beat(rep(bars, g.hat, f.hat), H) };
}
function orch(segs, rowsList) {
  const ch = {};
  for (const r of rowsList) ch[r] = { note: ns(nn('G-4') + ((at(segs, r).root - nn('G-4')) % 12 + 12) % 12), instrument: I.orch, vol: 'v50' };
  return ch;
}
const crash = { 0: { note: 'C-5', instrument: I.crash, vol: 'v40' } };
function section(name, bars, chordStr, { semi = 0, melody, groove = G.main, fill = true, echo = false, harm = false,
  arps = null, bassChart, stabs = STAB, extra = {} } = {}) {
  const rows = bars * 16, segs = chart(chordStr, { semi }), bsegs = bassChart ? chart(bassChart, { semi }) : segs;
  const parts = { ...drums(bars, groove, fill), fx: crash,
    bass: bass(bsegs, OST, I.bass, { rows, lo: 'C-3', vol: 40, soft: 0.66 }),
    gtr: stabs && bass(bsegs, stabs, I.gtr, { rows, lo: 'G-3', vol: 30 }),
    pad: pad(segs, I.pad, { rows, lo: 'G-4', vol: 14 }) };
  if (arps) parts.arp = arp(segs, arps, I.arp, { rows, lo: 'G-4', vol: 18 });
  if (melody) {
    const notes = mel(melody, { semi, vol: 44 }), ch = line(notes, I.lead, { rows });
    parts.lead = ch;
    if (echo) parts.echo = echoOf(ch, notes, { delay: 3, scale: 0.42, rows });
    if (harm) parts.echo = line(harmony(notes, segs), I.lead, { rows, vib: null });
  }
  return pattern(name, bars, { ...parts, ...extra }, LAYOUT, PANS);
}

const PULSE = ['X-x-X-x-X-x-X-x-'];
const hammerSegs = chart(CH.hammer);
const hammerRows = [];
for (let b = 0; b < 8; b++) for (const r of [0, 3, 6, 10, 13]) hammerRows.push(b * 16 + r);
const patterns = [
  section('intro: siren', 4, CH.brk, { melody: INTRO, stabs: null, fill: false, groove: { kick: '................', snare: '................', hat: '................' },
    extra: { fx: undefined, pad: undefined, kick: beat(['................', '................', 'X..X..X.X..X..X.', 'X..X..X.X.......'], K),
      snare: beat(['................', '................', '....X.......X...', '....X...XxXxXXXX'], S) } }),
  section('A: ostinato hook', 8, CH.A, { melody: A_MEL }),
  section('A2: hook + echo + arps', 8, CH.A, { melody: A_MEL, echo: true, arps: PULSE }),
  section('B: climb', 8, CH.B, { melody: B_MEL, echo: true, arps: PULSE, groove: G.drive }),
  section('hammer: orchestra hits', 8, CH.hammer, { groove: G.hammer, stabs: ['R..R..R...R..R..'],
    extra: { fx: { ...orch(hammerSegs, hammerRows), 0: { note: 'C-5', instrument: I.crash, vol: 'v40' } } } }),
  section('alarm: siren over C pedal', 8, CH.alarm, { melody: SIREN, bassChart: CH.pedal, groove: G.alarm, stabs: null,
    arps: ['XxXxXxXxXxXxXxXx'] }),
  section('A up: C# minor + harmony', 8, CH.A, { melody: A_MEL, semi: 1, harm: true, arps: PULSE }),
  section('B up: C# minor', 8, CH.B, { melody: B_MEL, semi: 1, harm: true, arps: PULSE, groove: G.drive }),
  jump(section('break: ostinato', 4, CH.brk, { groove: G.main, extra: { pad: undefined } }), 1),
];

writeSongCompact(import.meta.url, {
  title: 'Heliobane - Herald', bpm: 176, ticks: 6, mixvol: 42,
  message: 'HELIOBANE boss theme "Herald" (MUSIC-A).\nC minor -> C# minor, 176 BPM. Orders 1-8 loop.\nAll samples synthesized. Source: songs/heliobane_boss.gen.js',
  samples: [
    kick({ f0: 260, decay: 12, drive: 3 }), snare({ tone: 196, decay: 17, seed: 27, drive: 2.4 }), cymbal('hat closed', { seed: 23 }),
    cymbal('hat open', { sec: 0.3, decay: 10, seed: 24 }), cymbal('crash', { sec: 1.3, decay: 2.6, seed: 28, metalMix: 0.35 }),
    wave('grit bass', [1, 0.35, 0.5, 0.2, 0.3, 0.12, 0.2, 0.08, 0.14, 0.05, 0.1]), powerChord('power chord', { drive: 5 }),
    { name: 'arp pulse', synth: { wave: 'square', pulse: 0.25 } },
    wave('saw lead', Array.from({ length: 24 }, (_, k) => 1 / (k + 1))), superSaw('dark strings', { base: 80, cyc: 96 }),
    orchHit(), noiseLoop(),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
