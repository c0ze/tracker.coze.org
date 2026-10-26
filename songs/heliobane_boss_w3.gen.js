#!/usr/bin/env node
/**
 * HELIOBANE boss_w3 — "Herald of the Source" (World 3 Heralds and the final boss). MUSIC-D, 2026-09-25.
 * G minor (→ G# minor), 178 BPM, speed 6: 4 rows/beat, 16 rows/bar, 8 bars = 10.8 s.
 * Rendered at 44144 Hz so a tick is exactly 620 samples (see render_d.py).
 *
 * Identity: a cathedral toccata. An organ plays unbroken 16th broken chords (root 3rd 5th 8ve,
 * rolling up and turning back) under everything, the engine of the piece, where the World 1
 * "Herald" ran on a grit-bass ostinato. The Herald motif is quoted note for note, a fourth
 * lower: "G C Eb | D—C—" over Cm Cm Ab G becomes "D G Bb | A—G—" over Gm Gm Eb D, then the
 * answer leaves the quote and climbs to the Neapolitan Ab. Choir chords, bells, taiko.
 *
 * Phrase map
 *   Intro    Gm Gm Eb D              bells toll G, choir swells, toccata enters in bar 3 (not looped)
 *   A        Gm Gm Eb D Gm Gm Ab D   the quote (bars 1-4), answer G Bb D | G F D Bb | C Eb Ab | F# Eb D A
 *   A2       same + 3-row echo, taiko
 *   B        Cm Cm Gm Gm Eb F D D    climbs to C7 over F, falls through Eb (b9) to D
 *   Mass     Gm Gm Eb Eb Ab Ab D D   half time, no toccata: organ chords + the motif augmented 6-6-4 on choir
 *   Frenzy   Gm F Eb D x2            toccata + 16th double kick + choir stabs 3-3-2, no lead
 *   A↑ B↑    G# minor, written harmony
 *   Break    Gm x4                   toccata and drums alone, back in G
 * Loop body: orders 1–8 (60 bars, 80.9 s).
 */
import { kick, snare, cymbal, wave, jump, writeSongCompact,
  drum, bell, choir, organ, sectionMaker, roll, toll, chart, at, place } from './heliobane_stage11.kit.js';
import { nn, ns } from './lib.js';

const I = { kick: 0, snare: 1, hat: 2, ohat: 3, crash: 4, drum: 5, bass: 6, organ: 7, lead: 8, choir: 9, bell: 10 };
const LAYOUT = ['kick', 'snare', 'hat', 'perc', 'bass', 'gtr', 'lead', 'echo', 'c1', 'c2', 'c3', 'stab', 'fx'];
const PANS = [0x80, 0x76, 0xb0, 0x68, 0x80, 0x7a, 0x88, 0xb4, 0x4c, 0x84, 0xb8, 0x5c, 0x94];
const maps = {
  kick: { X: [I.kick, 60], x: [I.kick, 40] },
  snare: { X: [I.snare, 56], x: [I.snare, 38], g: [I.snare, 14] },
  hat: { X: [I.hat, 48], x: [I.hat, 33], g: [I.hat, 20], o: [I.ohat, 39] },
  perc: { L: [I.drum, 46, null, 'G-4'], M: [I.drum, 44, null, 'D-5'], H: [I.drum, 42, null, 'G-5'] },
};
const fill = { kick: 'X.X.X.X.X.......', snare: '....X...XxXxXXXX', hat: 'XgxgXgxgX.......', perc: 'L.......L.L.MMHH' };
const section = sectionMaker({ I, LAYOUT, PANS, maps, fill });

const G = {
  main: { kick: 'X.x.X.x.X.x.X.x.', snare: '....X.......X...', hat: 'XgxgXgxgXgxgXgxg' },
  taiko: { kick: 'X.x.X.x.X.x.X.x.', snare: '....X.......X...', hat: 'XgxgXgxgXgxgXgxg', perc: ['L..L..L.........', 'L..L..L.....M.H.'] },
  mass: { kick: 'X.........X.....', snare: '........X.......', hat: 'x...x...x...x.o.', perc: ['L.......L.......', 'L.......L...MMHH'] },
  frenzy: { kick: 'XxxxXxxxXxxxXxxx', snare: '....X.......X...', hat: 'x.x.x.x.x.x.x.x.', perc: 'L..L..L.L..L..L.' },
};
const CH = {
  intro: 'Gm Gm Eb D', A: 'Gm Gm Eb D Gm Gm Ab D', B: 'Cm Cm Gm Gm Eb F D D', mass: 'Gm Gm Eb Eb Ab Ab D D',
  frenzy: 'Gm F Eb D Gm F Eb D', brk: 'Gm Gm Gm Gm',
};
const PEDAL = ['R-------R-------'], DRIVE = ['R-.R-.R-R-.R-.R-'];

// ---------------------------------------------------------------- the toccata
const TOC = [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 2, 1, 0, 1];   // root 3rd 5th 8ve, rolling, turning back
function toccata(chords, rows, { semi = 0, lo = 'C-4', vol = 56, from = 0 } = {}) {
  const segs = chart(chords, { semi }), ch = {};
  for (let r = from; r < rows; r++) {
    const s = at(segs, r), base = place(s.root, nn(lo));
    const tones = [base, base + s.iv[1], base + s.iv[2], base + 12];
    ch[r] = { note: ns(tones[TOC[r % 16]]), instrument: I.organ, vol: `v${r % 4 ? vol - 10 : vol}` };
  }
  return ch;
}

// ---------------------------------------------------------------- melodies
// World 1 boss: g5/3 c6/3 eb6/2 d6/4 c6/4 | g5/3 c6/3 eb6/2 g6/4 f6/2 eb6/2 | eb6/3 c6/3 ab5/2 c6/4 eb6/4 | d6/3 b5/3 g5/2 b5/8~
const A_MEL = 'd5/3 g5/3 bb5/2 a5/4 g5/4 | d5/3 g5/3 bb5/2 d6/4 c6/2 bb5/2 | bb5/3 g5/3 eb5/2 g5/4 bb5/4 | a5/3 f#5/3 d5/2 f#5/8~'
  + ' | g5/4 bb5/4 d6/8~ | g6/6 f6/2 d6/4 bb5/4 | c6/4 eb6/4 ab6/8~ | f#6/6 eb6/2 d6/4 a5/4';
const B_MEL = 'c6/6 eb6/2 g6/8~ | g6/4 f6 eb6 c6 | d6/6 g6/2 bb6/8~ | bb6/4 a6 g6 d6'
  + ' | eb6/6 g6/2 bb6/8~ | c7/8~ a6/4 f6 | a6/6 f#6/2 d6/4 a5 | f#6/4 eb6 d6/8~';
const MASS = 'd5/6 g5/6 bb5/4 | a5/8 g5/8 | bb5/6 g5/6 eb5/4 | g5/8 bb5/8 | c6/6 ab5/6 eb5/4 | ab5/16 | a5/6 f#5/6 d5/4 | f#5/16';

// ---------------------------------------------------------------- sections
const herald = (name, bars, chords, o = {}) => {
  const semi = o.semi ?? 0, rows = bars * 16;
  return section(name, bars, chords, { riff: DRIVE, bassLo: 'C-3', bassVol: 36, choirLo: 'F-4', choirVol: 16, leadInst: I.lead, leadVol: 50,
    ...o, extra: { gtr: toccata(chords, rows, { semi }), ...(o.extra ?? {}) } });
};
const intro = herald('intro: bells', 4, CH.intro, {
  riff: ['R---------------'], fill: false, crash: false, choirVol: 14,
  groove: { perc: ['L...............', 'L...............', 'L.......L.......', 'L...L...L.L.MMHH'] },
  extra: { gtr: toccata(CH.intro, 64, { from: 32 }), lead: toll([[0, 'G-5', 50], [16, 'D-5', 44], [32, 'G-5', 50], [48, 'D-5', 46]], I.bell, { rows: 64, len: 16 }),
    snare: roll(I.snare, { bars: 1, total: 4, from: 10, to: 50 }) },
});
const massSegs = chart(CH.mass);
const mass = section('mass: the motif augmented', 8, CH.mass, {
  riff: ['R---------------'], bassLo: 'C-3', choirInst: I.organ, choirLo: 'D-4', choirVol: 22, groove: G.mass,
  melody: MASS, leadInst: I.choir, leadVol: 46, vib: 'H32',
  extra: { stab: toll([0, 32, 64, 96].map((r) => [r, ns(place(at(massSegs, r).root, nn('C-5'))), 46]), I.bell, { rows: 128, len: 24 }) },
});
const frenzy = herald('frenzy: toccata + double kick', 8, CH.frenzy, {
  groove: G.frenzy, stabs: ['X-.X-.X-X-.X-.X-'], stabInst: I.choir, stabLo: 'A-4', stabVol: 34, choirVol: 13,
});
const brk = herald('break: toccata alone', 4, CH.brk, { groove: G.main, choir: false });

const patterns = [
  intro,
  herald('A: the quote', 8, CH.A, { melody: A_MEL, groove: G.main }),
  herald('A2: quote + echo + taiko', 8, CH.A, { melody: A_MEL, echo: 3, groove: G.taiko }),
  herald('B: climb', 8, CH.B, { melody: B_MEL, echo: 3, groove: G.taiko, choirVol: 18 }),
  mass,
  frenzy,
  herald('A up: G# minor + harmony', 8, CH.A, { semi: 1, melody: A_MEL, harm: true, groove: G.taiko }),
  herald('B up: G# minor + harmony', 8, CH.B, { semi: 1, melody: B_MEL, harm: true, groove: G.taiko, choirVol: 18 }),
  jump(brk, 1),
];

writeSongCompact(import.meta.url, {
  title: 'Heliobane - Herald of the Source', bpm: 178, ticks: 6, mixvol: 42,
  message: 'HELIOBANE World 3 boss "Herald of the Source" (MUSIC-D).\nG minor -> G# minor, 178 BPM. Quotes the World 1 Herald motif. Orders 1-8 loop.\nAll samples synthesized. Source: songs/heliobane_boss_w3.gen.js',
  samples: [
    kick({ f0: 250, f1: 60, decay: 14, drive: 3 }), snare({ tone: 196, decay: 17, seed: 161, drive: 2.4 }), cymbal('hat closed', { seed: 163 }),
    cymbal('hat open', { sec: 0.3, decay: 10, seed: 164 }), cymbal('crash', { sec: 1.4, decay: 2.3, seed: 168, metalMix: 0.35 }),
    drum('ritual drum', { f: 118, seed: 165 }), wave('grit bass', [1, 0.35, 0.5, 0.2, 0.3, 0.12, 0.2, 0.08, 0.14, 0.05, 0.1]),
    organ(), wave('saw lead', Array.from({ length: 24 }, (_, k) => 1 / (k + 1))), choir('choir aah'), bell(),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
