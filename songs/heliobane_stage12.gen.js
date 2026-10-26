#!/usr/bin/env node
/**
 * HELIOBANE stage 12 — "The Vein" (World 3 UMBRA: inside a feeding artery). MUSIC-D, 2026-09-25.
 * C# minor (→ D minor), 160 BPM exactly, speed 6: 4 rows/beat, 16 rows/bar, one bar = 1.5 s.
 * Rendered at 48000 Hz: a tick is exactly 750 samples, a beat exactly 18000. Gameplay pulses the
 * corridor walls on this beat, so the tempo never changes and the kick never leaves the beat.
 *
 * Identity: the heartbeat leads. A four-on-the-floor kick never stops (not even in the fills or
 * the breakdown); a deep "heart" thump doubles it with a lub-DUB (a dub one 16th after beats 1
 * and 3, every beat in the chorus). The bass throbs in 16ths but rests on every beat, like a
 * sidechain, and the choir pad breathes the same way (ducks on the beat, blooms after it).
 * Lead: a sinuous PWM line built on the neighbour cell G# A G# (the vein's pulse).
 *
 * Phrase map
 *   Intro   C#m x4                 heart alone, then kick, bass and choir (not looped)
 *   A       C#m A F#m G# / C#m A D G#   hook "G# A G# E C#", answer E F# E C#, D = Phrygian bII
 *   A2      same + 3-row echo + 12.5% pulse arps
 *   B       A E B C#m A E D G#     chorus: long arpeggio notes up to C#7, heart doubles to every beat
 *   Brk     C#m C#m D D C#m C#m G# G#  kick + heart + throb only; an "ooh" choir voice sings the cell
 *   Build   F#m G G# A             chromatic climb, snare roll, riser (the kick stays four-on-the-floor)
 *   A↑ B↑   D minor, written harmony
 *   Tag     Bb A G# G#             back down to V of C# minor
 * Loop body: orders 1–8 (56 bars = 224 beats, 84.0 s).
 */
import { kick, snare, cymbal, noiseLoop, pwm, jump, writeSongCompact,
  heart, rattle, choir, fleshBass, sectionMaker, roll, riser } from './heliobane_stage11.kit.js';

const I = { kick: 0, heart: 1, snare: 2, hat: 3, ohat: 4, crash: 5, rattle: 6, bass: 7, lead: 8, choir: 9, vox: 10, arp: 11, noise: 12 };
const LAYOUT = ['kick', 'snare', 'hat', 'perc', 'bass', 'gtr', 'lead', 'echo', 'c1', 'c2', 'c3', 'stab', 'fx'];
const PANS = [0x80, 0x76, 0xb4, 0x80, 0x80, 0x60, 0x88, 0x54, 0x4c, 0x80, 0xb4, 0xa8, 0x90];
const maps = {
  kick: { X: [I.kick, 60] },
  snare: { X: [I.snare, 54], x: [I.snare, 38], g: [I.snare, 14] },
  hat: { x: [I.hat, 30], g: [I.hat, 15], o: [I.ohat, 30], r: [I.rattle, 33] },
  perc: { L: [I.heart, 60], d: [I.heart, 44, null, 'A-4'] },
};
const fill = { kick: 'X...X...X...X...', snare: '....X...X.xxXxXX', hat: 'x.x.x.x.x.......' };
const section = sectionMaker({ I, LAYOUT, PANS, maps, fill });

// ---------------------------------------------------------------- groove: the heart leads
const HEART = 'Ld......Ld......', HEART2 = 'Ld..Ld..Ld..Ld..';
const G = {
  main: { kick: 'X...X...X...X...', snare: '....X.......X...', hat: '..o...o...o...o.', perc: HEART },
  drive: { kick: 'X...X...X...X...', snare: '....X.......X...', hat: 'xgxrxgxrxgxrxgxr', perc: HEART2 },
  brk: { kick: 'X...X...X...X...', perc: HEART2, hat: '..r...r...r...r.' },
};
const THROB = ['.rRr.rRr.rRr.rRr'], THROB2 = ['.rOr.rRr.rOr.rRr'];
const BREATH = [0.45, 0.8, 1, 0.9];                          // choir level per row in each beat
const CH = {
  A: 'C#m A F#m G# C#m A D G#', B: 'A E B C#m A E D G#', brk: 'C#m C#m D D C#m C#m G# G#',
  build: 'F#m G G# A', tag: 'Bb A G# G#', intro: 'C#m C#m C#m C#m',
};

// ---------------------------------------------------------------- melodies
const A_MEL = 'g#5/3 a5/3 g#5/2 e5/4 c#5/4 | e5/3 f#5/3 e5/2 c#5/8 | c#6/3 d6/3 c#6/2 a5/4 f#5/4 | c6/4 d#6/4 g#6/8~'
  + ' | g#5/3 a5/3 g#5/2 e5/4 g#5/4 | a5/3 b5/3 c#6/2 e6/8 | f#6/3 e6/3 d6/2 a5/8 | d#6/6 c6/2 g#5/8~';
const B_MEL = 'c#6/6 e6/2 a6/8 | g#6/6 e6/2 b5/8 | f#6/6 d#6/2 b5/4 f#6/4 | e6/4 g#6/4 c#7/8~'
  + ' | c#7/6 b6/2 a6/8 | g#6/6 b6/2 e6/8 | f#6/6 a6/2 d6/8 | d#6/4 c6/4 g#5/8~';
const VOX = 'g#5/12 a5/4 | g#5/16 | a5/12 f#5/4 | d5/16 | e5/12 d#5/4 | e5/16 | d#5/8 c6/8 | g#5/16';
const BUILD_MEL = 'f#5/4 a5 c#6 f#6 | g5/4 b5 d6 g6 | g#5/4 c6 d#6 g#6 | a5/4 c#6 e6 c#6';
const TAG_MEL = 'd6/8 bb5/8 | c#6/8 a5/8 | c6/8 d#6/8 | g#6/16~';

// ---------------------------------------------------------------- sections
const vein = (name, bars, chords, o = {}) => section(name, bars, chords, { riff: THROB, bassLo: 'C-3', pulse: BREATH, choirLo: 'E-4', choirVol: 18, ...o });
const intro = vein('intro: heartbeat', 4, CH.intro, {
  riff: ['................', '................', THROB[0], THROB[0]], fill: false, crash: false, choirVol: 14,
  groove: { perc: [HEART, HEART, HEART, HEART], kick: ['................', '................', 'X...X...X...X...', 'X...X...X...X...'],
    snare: ['................', '................', '................', '........X.xxXxXX'] },
});
const brk = vein('brk: inside the wall', 8, CH.brk, {
  groove: G.brk, fill: false, crash: false, choirVol: 15, melody: VOX, leadInst: I.vox, leadVol: 40, echo: 6,
});
const build = vein('build: climb', 4, CH.build, {
  melody: BUILD_MEL, fill: false, riff: ['.rRr.rRr.rRr.rRr', '.rRr.rRr.rRr.rRr', 'RrRrRrRrRrRrRrRr', 'RrRrRrRrRrRrRrRr'],
  groove: { kick: 'X...X...X...X...', hat: 'x.x.x.x.x.x.x.x.', perc: HEART2 },
  extra: { snare: roll(I.snare, { bars: 3, total: 4 }), fx: riser(I.noise, 16, 64) },
});
const tag = vein('tag: down to G#', 4, CH.tag, { melody: TAG_MEL, groove: G.main, stabs: ['X-.X-.X.X-.X-.X.'], stabInst: I.choir, stabVol: 22 });

const patterns = [
  intro,
  vein('A: the cell', 8, CH.A, { melody: A_MEL, groove: G.main }),
  vein('A2: cell + echo + arps', 8, CH.A, { melody: A_MEL, echo: 3, groove: G.main, stabs: ['X-x-X-x-X-x-X-x-'], stabInst: I.arp, stabVol: 16 }),
  vein('B: chorus', 8, CH.B, { melody: B_MEL, echo: 3, groove: G.drive, riff: THROB2, choirVol: 20 }),
  brk,
  build,
  vein('A up: D minor + harmony', 8, CH.A, { semi: 1, melody: A_MEL, harm: true, groove: G.main, stabs: ['X-x-X-x-X-x-X-x-'], stabInst: I.arp, stabVol: 16 }),
  vein('B up: D minor', 8, CH.B, { semi: 1, melody: B_MEL, harm: true, groove: G.drive, riff: THROB2, choirVol: 20 }),
  jump(tag, 1),
];

writeSongCompact(import.meta.url, {
  title: 'Heliobane - The Vein', bpm: 160, ticks: 6, mixvol: 42,
  message: 'HELIOBANE stage 12 "The Vein" (MUSIC-D, World 3 UMBRA).\nC# minor -> D minor, 160 BPM exactly (render at 48 kHz). Orders 1-8 loop.\nAll samples synthesized. Source: songs/heliobane_stage12.gen.js',
  samples: [
    kick({ f0: 180, f1: 55, decay: 12, drive: 2.4, click: 0.4 }), heart(), snare({ tone: 170, decay: 18, seed: 121, drive: 2 }),
    cymbal('hat closed', { seed: 123 }), cymbal('hat open', { sec: 0.26, decay: 12, seed: 124 }),
    cymbal('crash', { sec: 1.2, decay: 2.8, seed: 128, metalMix: 0.35 }), rattle({ seed: 125 }), fleshBass('flesh bass', { drive: 2 }),
    pwm('pwm lead', { lo: 0.12, hi: 0.45, cycles: 72 }), choir('choir aah'), choir('choir ooh', { vowel: 'o' }),
    { name: 'arp pulse', synth: { wave: 'square', pulse: 0.125 } }, noiseLoop(),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
