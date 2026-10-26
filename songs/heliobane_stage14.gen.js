#!/usr/bin/env node
/**
 * HELIOBANE stage 14 — "Choirnest" (World 3 UMBRA: the breeding hall). MUSIC-D, 2026-09-25.
 * D Phrygian dominant (D Eb F# G A Bb C, the hijaz colour) → Eb, 172 BPM, speed 6, 16 rows/bar.
 * Rendered at 44376 Hz so a tick is exactly 645 samples (see render_d.py).
 *
 * Identity: a chant. A choir sings short repeated syllables "D D Eb D · F# A" in two octaves
 * (the low octave on an "ooh"), answered by choir J-chord stabs on the off-beats; the whole hall
 * rocks between D and Eb a half step above. Ritual percussion drives it: taiko in 3+3+2 against a
 * 3+3+2 kick, bone rattles on the 16ths.
 *
 * Phrase map
 *   Intro   D5 x4                  drum circle builds bar by bar over a choir drone (not looped)
 *   A       D Eb D Eb Gm Eb D D    the chant in octaves, rattles + taiko, no pad
 *   A2      same + off-beat choir stabs, 16th flesh bass
 *   B       Gm Eb D D Cm Eb D D    frantic saw lead in 16th hijaz runs, choir pad, stabs 3+3+4+3+3
 *   Brk     D5 D5 Eb D5 x2         drum circle: taiko solo patterns, the low chant alone
 *   Build   Gm Eb Ab D             16th runs climbing to D7, snare roll, riser
 *   A↑ B↑   everything a half step up (Eb)
 *   Tag     Ab Gm Eb Eb            unison stabs; Eb falls to D (the Phrygian cadence) at the loop
 * Loop body: orders 1–8 (56 bars, 78.1 s).
 */
import { kick, snare, cymbal, noiseLoop, wave, mel, line, jump, writeSongCompact,
  drum, rattle, choir, fleshBass, bell, sectionMaker, roll, riser } from './heliobane_stage11.kit.js';

const I = { kick: 0, snare: 1, hat: 2, crash: 3, drum: 4, rattle: 5, bass: 6, lead: 7, choir: 8, chant: 9, bell: 10, noise: 11 };
const LAYOUT = ['kick', 'snare', 'hat', 'perc', 'bass', 'gtr', 'lead', 'echo', 'c1', 'c2', 'c3', 'stab', 'fx'];
const PANS = [0x80, 0x78, 0xb8, 0x60, 0x80, 0x70, 0x8c, 0x74, 0x4c, 0x80, 0xb4, 0xa4, 0x94];
const maps = {
  kick: { X: [I.kick, 56], x: [I.kick, 40] },
  snare: { X: [I.snare, 54], x: [I.snare, 36], g: [I.snare, 14] },
  hat: { r: [I.rattle, 39], R: [I.rattle, 57], X: [I.hat, 45], x: [I.hat, 30], g: [I.hat, 18] },
  perc: { L: [I.drum, 46, null, 'G-4'], l: [I.drum, 32, null, 'G-4'], M: [I.drum, 44, null, 'D-5'], H: [I.drum, 44, null, 'G-5'], h: [I.drum, 30, null, 'G-5'] },
};
const fill = { kick: 'X..X..X.X.......', snare: '....X...XxXxXXXX', hat: 'rRrRrRrR........', perc: 'L..M..L.HHMMLLHH' };
const section = sectionMaker({ I, LAYOUT, PANS, maps, fill });

const G = {
  chant: { kick: 'X..X..X.X..X..X.', snare: '....X.......X...', hat: 'rRr.rRr.rRr.rRr.', perc: 'L.....M.L.....H.' },
  frantic: { kick: 'X..X..X.X..X..X.', snare: '....X..x....X.x.', hat: 'XgXgXgXgXgXgXgXg', perc: 'L..M..L.H..M..LH' },
  circle: { hat: 'r.R.r.R.r.R.rRrR', perc: ['L.....M.L.....M.', 'L..M..M.L..M..M.', 'L..M..L.H..M..L.', 'L.MM.ML.H.MM.MHH'] },
};
const B33 = ['R-.R-.R-R-.R-.R-'], B16 = ['RrrRrrRrRrrRrrRr'];
const CH = {
  intro: 'D5 D5 D5 D5', A: 'D Eb D Eb Gm Eb D D', B: 'Gm Eb D D Cm Eb D D', brk: 'D5 D5 Eb D5 D5 D5 Eb D5',
  build: 'Gm Eb Ab D', tag: 'Ab Gm Eb Eb',
};

// ---------------------------------------------------------------- melodies
const CHANT = 'd5/2 d5 eb5 d5 r f#5 a5/4 | g5/2 g5 bb5 g5 r d5 eb5/4 | d5/2 d5 eb5 d5 r f#5 a5 c6 | bb5/4 a5/2 g5 eb5/8'
  + ' | g5/2 g5 a5 bb5 r d6 bb5/4 | eb6/2 d6 c6 bb5 r g5 eb5/4 | f#5/2 g5 f#5 eb5 d5/8 | r/8 a4/2 c5 eb5 f#5';
const B_MEL = 'g5/1 a5 bb5 c6 d6/2 bb5 g5/1 a5 bb5 a5 g5/4 | eb6/2 d6/1 c6 bb5/2 g5 eb6/4 g6 | f#6/2 eb6/1 d6 c6/2 a5 f#5/4 d6'
  + ' | eb6/1 d6 c6 bb5 a5 g5 f#5 eb5 d5/8 | c6/1 d6 eb6 g6 c7/4 bb6/2 g6 eb6/4 | bb6/2 g6/1 eb6 d6/2 eb6 g6/4 bb6'
  + ' | a6/2 f#6/1 eb6 d6/2 c6 a5/4 f#5 | d6/1 eb6 f#6 g6 a6/4 f#6/2 eb6 d6/4';
const LOW_CHANT = 'd4/2 d4 eb4 d4 r/8 | r/16 | d4/2 d4 eb4 d4 r f#4 a4/4 | r/16';
const BUILD_MEL = 'g5/1 a5 bb5 d6 g6/4 d6/2 bb5 g5/4 | eb6/1 d6 c6 bb5 g5/4 bb5/2 eb6 g6/4'
  + ' | ab5/1 c6 eb6 ab6 c7/4 ab6/2 eb6 c6/4 | d6/1 eb6 f#6 a6 d7/12~';
const TAG_MEL = 'c6/3 bb5/3 ab5/2 c6/8 | bb5/3 g5/3 d5/2 g5/8 | g5/3 bb5/3 eb6/2 g6/8 | g6/4 eb6/4 bb5/8';

/** The chant in two octaves: the lead choir sings it, the "ooh" choir an octave below. */
function chant(str, rows, semi = 0, vol = 46) {
  return { lead: line(mel(str, { semi, vol }), I.choir, { rows, vib: null, sustain: 0.85 }),
    echo: line(mel(str, { semi: semi - 12, vol: Math.round(vol * 0.65) }), I.chant, { rows, vib: null, sustain: 0.85 }) };
}

// ---------------------------------------------------------------- sections
const nest = (name, bars, chords, o = {}) => section(name, bars, chords, { riff: B33, bassLo: 'C-3', bassVol: 32, choirLo: 'F-4', choirVol: 17, leadInst: I.lead, ...o });
const intro = nest('intro: drum circle', 4, CH.intro, {
  riff: ['................', '................', 'R---------------', 'R-.R-.R-R-.R-.R-'], fill: false, crash: false, choirVol: 13,
  groove: { perc: G.circle.perc, hat: ['................', 'r...r...r...r...', 'r.r.r.r.r.r.r.r.', 'rRrRrRrRrRrRrRrR'] },
  extra: { snare: roll(I.snare, { bars: 1, total: 4, from: 10, to: 46 }) },
});
const OFF = ['..X-..X...X-..X.'], CALL = ['X-.X-.X-..X-.X-.'];
const chantSec = (name, semi, o = {}) => nest(name, 8, CH.A, { semi, groove: G.chant, choir: false, extra: chant(CHANT, 128, semi), ...o });
const brk = nest('brk: the brood', 8, CH.brk, {
  riff: ['R---------------'], groove: G.circle, fill: false, crash: false, choirVol: 14,
  extra: { echo: line(mel(`${LOW_CHANT} | ${LOW_CHANT}`, { vol: 36 }), I.chant, { rows: 128, vib: null, sustain: 0.85 }) },
});
const build = nest('build', 4, CH.build, {
  riff: [B16[0]], melody: BUILD_MEL, fill: false,
  groove: { kick: ['X..X..X.X..X..X.', 'X..X..X.X..X..X.', 'X.X.X.X.X.X.X.X.', 'XXXXXXXXXXXXXXXX'], hat: 'rRrRrRrRrRrRrRrR', perc: 'L..M..L.H..M..LH' },
  extra: { snare: roll(I.snare, { bars: 3, total: 4 }), fx: riser(I.noise, 16, 64) },
});
const tag = nest('tag: Eb falls to D', 4, CH.tag, {
  riff: ['R..R..R.R..R..R.'], melody: TAG_MEL, stabs: ['X..X..X.X..X..X.'], stabInst: I.choir, stabLo: 'A-4', stabVol: 30,
  groove: { kick: 'X..X..X.X..X..X.', snare: '....X.......X...', hat: 'rRrRrRrRrRrRrRrR', perc: 'L..L..L.L..L..L.' },
});
const stabs = (rh, vol = 24) => ({ stabs: rh, stabInst: I.choir, stabLo: 'D-4', stabVol: vol });

const patterns = [
  intro,
  chantSec('A: the chant', 0),
  chantSec('A2: chant + stabs', 0, { riff: B16, ...stabs(OFF, 40) }),
  nest('B: frantic', 8, CH.B, { melody: B_MEL, groove: G.frantic, riff: B16, ...stabs(CALL, 30) }),
  brk,
  build,
  chantSec('A up: Eb, chant + stabs', 1, { riff: B16, ...stabs(OFF, 40) }),
  nest('B up: Eb, frantic', 8, CH.B, { semi: 1, melody: B_MEL, groove: G.frantic, riff: B16, ...stabs(CALL, 30) }),
  jump(tag, 1),
];

writeSongCompact(import.meta.url, {
  title: 'Heliobane - Choirnest', bpm: 172, ticks: 6, mixvol: 42,
  message: 'HELIOBANE stage 14 "Choirnest" (MUSIC-D, World 3 UMBRA).\nD Phrygian dominant -> Eb, 172 BPM. Orders 1-8 loop.\nAll samples synthesized. Source: songs/heliobane_stage14.gen.js',
  samples: [
    kick({ f0: 230, f1: 62, decay: 14, drive: 2.6 }), snare({ tone: 200, decay: 18, seed: 141, drive: 2.3 }), cymbal('hat closed', { seed: 143 }),
    cymbal('crash', { sec: 1.2, decay: 2.8, seed: 148, metalMix: 0.35 }), drum('ritual drum', { f: 125, seed: 145, slap: 0.7 }), rattle({ seed: 146 }),
    fleshBass('flesh bass', { drive: 2 }), wave('saw lead', Array.from({ length: 24 }, (_, k) => 1 / (k + 1))),
    choir('choir aah'), choir('choir ooh', { vowel: 'o' }), bell(), noiseLoop(),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
