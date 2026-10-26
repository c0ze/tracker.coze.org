#!/usr/bin/env node
/**
 * HELIOBANE stage 13 — "Ossuary of Stars" (World 3 UMBRA: a graveyard of eaten worlds). MUSIC-D, 2026-09-25.
 * A minor (→ Bb minor), 166 BPM, speed 6: 4 rows/beat, 16 rows/bar, 8 bars = 11.6 s.
 * Rendered at 44156 Hz so a tick is exactly 665 samples (see render_d.py).
 *
 * Identity: a mournful "wail" lead made of sighs (E D C B A: long note, falling steps) over a
 * driving 8th-note octave bass and 16th hats, with a five-voice formant choir holding voice-led
 * chords the whole way. "Beautiful and wrong": a Bb (Neapolitan) chord whose F is sung against
 * an E (#11) for two rows, and an A that leans on G# over E before it falls.
 *
 * Phrase map
 *   Intro   Am Am F E                choir swell, bell tolls, taiko (not looped)
 *   A       Am F Dm E / Am F Bb E    the lament: "E— D C B A | C— A F", answer lands on the sigh A→G#
 *   A2      same + 6-row echo + 25% pulse arps a register below
 *   B       F G Em Am Dm G C E       relative-major lift, long arpeggio notes peaking A6/B6
 *   Brk     Am Am F F Dm Dm E E      the graveyard: kick on 1 only, bell tolls, the wail alone with a long echo
 *   Build   Dm E F F                 F is V of Bb minor; snare roll, riser
 *   A↑ B↑   Bb minor, written harmony, taiko on the downbeats
 *   Tag     Gb F E E                 chromatic fall back to V of A minor
 * Loop body: orders 1–8 (56 bars, 81.0 s).
 */
import { kick, snare, cymbal, noiseLoop, wave, BASS_AMPS, jump, writeSongCompact,
  drum, bell, choir, sectionMaker, roll, riser, toll } from './heliobane_stage11.kit.js';

const I = { kick: 0, snare: 1, hat: 2, ohat: 3, crash: 4, drum: 5, bass: 6, lead: 7, choir: 8, bell: 9, arp: 10, noise: 11 };
const LAYOUT = ['kick', 'snare', 'hat', 'perc', 'bass', 'gtr', 'lead', 'echo', 'c1', 'c2', 'c3', 'stab', 'fx'];
const PANS = [0x80, 0x78, 0xb0, 0x6c, 0x80, 0x70, 0x8a, 0x52, 0x4c, 0x80, 0xb4, 0xa4, 0x94];
const maps = {
  kick: { X: [I.kick, 62], x: [I.kick, 46] },
  snare: { X: [I.snare, 56], x: [I.snare, 38], g: [I.snare, 14] },
  hat: { X: [I.hat, 39], x: [I.hat, 24], g: [I.hat, 14], o: [I.ohat, 33] },
  perc: { L: [I.drum, 56, null, 'C-4'], M: [I.drum, 46, null, 'G-4'], H: [I.drum, 42, null, 'C-5'] },
};
const fill = { kick: 'X.....x.X.......', snare: '....X...X.xxXXXX', hat: 'XgxgXgxgX.......', perc: 'L.......L...MMHH' };
const section = sectionMaker({ I, LAYOUT, PANS, maps, fill });

const G = {
  drive: { kick: 'X.....x.X.x.....', snare: '....X.......X...', hat: 'XgxgXgxgXgxgXgxo' },
  lift: { kick: 'X.x...x.X.x...x.', snare: '....X.......X...', hat: 'XgxgXgxgXgxgXgxg' },
  up: { kick: 'X.x...x.X.x...x.', snare: '....X.......X...', hat: 'XgxgXgxgXgxgXgxg', perc: ['L...............', 'L.......M.......'] },
  brk: { kick: 'X...............', hat: '....g.......g...' },
};
const BOUNCE = ['R.o.R.o.R.o.R.o.'], BOUNCE2 = ['R.o.R.o.R.o.RoRo'];
const CH = {
  intro: 'Am Am F E', A: 'Am F Dm E Am F Bb E', B: 'F G Em Am Dm G C E', brk: 'Am Am F F Dm Dm E E',
  build: 'Dm E F F', tag: 'Gb F E E',
};

// ---------------------------------------------------------------- melodies
const A_MEL = 'e6/6 d6/2 c6/4 b5/2 a5/2 | c6/8~ a5/4 f5/4 | a5/6 g5/2 f5/4 d5/4 | e5/4 g#5/4 b5/8~'
  + ' | e6/6 d6/2 c6/4 b5/2 a5/2 | c6/6 a5/2 c6/4 f6/4 | f6/8~ e6/2 d6/2 bb5/4 | a5/4 g#5/4 e5/8~';
const B_MEL = 'c6/4 f6/4 a6/8~ | b6/6 a6/2 g6/4 d6/4 | e6/6 g6/2 b6/8~ | a6/6 g6/2 e6/4 c6/4'
  + ' | f6/6 e6/2 d6/4 a5/4 | b5/4 d6/4 g6/8~ | g6/6 f6/2 e6/4 c6/4 | b5/4 g#5/4 e5/8';
const LAMENT = 'e6/16~ | c6/16~ | a5/16~ | f5/8 a5/8 | d6/16~ | f6/8 e6/4 d6/4 | b5/16~ | g#5/16~';
const BUILD_MEL = 'a5/4 d6 f6 d6 | b5/4 e6 g#6 e6 | a5/4 c6 f6 c6 | eb6/16~';
const TAG_MEL = 'bb5/8 db6/8 | c6/8 a5/8 | g#5/8 b5/8 | e6/16~';
const TOLLS = (list, rows) => toll(list.map(([r, n]) => [r, n, 44]), I.bell, { rows, len: 16 });

// ---------------------------------------------------------------- sections
const bone = (name, bars, chords, o = {}) => section(name, bars, chords, { riff: BOUNCE, bassLo: 'C-3', choirLo: 'E-4', choirVol: 18, leadInst: I.lead, ...o });
const intro = bone('intro: the ossuary', 4, CH.intro, {
  riff: ['................', '................', 'R.......R.......', 'R.o.R.o.R.o.RoRo'], fill: false, crash: false, choirVol: 15,
  groove: { perc: ['L...............', 'L...............', 'L.......L.......', 'L...L...L.L.MMHH'] },
  extra: { echo: TOLLS([[0, 'E-5'], [16, 'A-4'], [32, 'C-5'], [48, 'B-4']], 64), snare: roll(I.snare, { bars: 1, total: 4, from: 10, to: 48 }) },
});
const brk = bone('brk: graveyard', 8, CH.brk, {
  riff: ['R-------r-------'], groove: G.brk, fill: false, crash: false, choirVol: 17, melody: LAMENT, echo: 6, leadVol: 40,
  extra: { stab: TOLLS([[0, 'A-4'], [32, 'F-4'], [64, 'D-5'], [96, 'E-5']], 128) },
});
const build = bone('build', 4, CH.build, {
  melody: BUILD_MEL, fill: false, riff: ['R.o.R.o.R.o.R.o.', 'R.o.R.o.R.o.R.o.', 'RoRoRoRoRoRoRoRo', 'RoRoRoRoRoRoRoRo'],
  groove: { kick: ['X.......X.......', 'X...X...X...X...', 'X.X.X.X.X.X.X.X.', 'X.X.X.X.XXXXXXXX'], hat: 'x.x.x.x.x.x.x.x.' },
  extra: { snare: roll(I.snare, { bars: 3, total: 4 }), fx: riser(I.noise, 16, 64) },
});
const arps = { stabs: ['X-x-X-x-X-x-X-x-'], stabInst: I.arp, stabLo: 'E-4', stabVol: 15 };

const patterns = [
  intro,
  bone('A: lament', 8, CH.A, { melody: A_MEL, groove: G.drive }),
  bone('A2: lament + echo + arps', 8, CH.A, { melody: A_MEL, echo: 6, groove: G.drive, ...arps }),
  bone('B: lift', 8, CH.B, { melody: B_MEL, echo: 3, groove: G.lift, riff: BOUNCE2, choirVol: 20 }),
  brk,
  build,
  bone('A up: Bb minor + harmony', 8, CH.A, { semi: 1, melody: A_MEL, harm: true, groove: G.up, ...arps }),
  bone('B up: Bb minor', 8, CH.B, { semi: 1, melody: B_MEL, harm: true, groove: G.up, riff: BOUNCE2, choirVol: 20 }),
  jump(bone('tag: fall to E', 4, CH.tag, { melody: TAG_MEL, groove: G.drive, riff: BOUNCE2 }), 1),
];

writeSongCompact(import.meta.url, {
  title: 'Heliobane - Ossuary of Stars', bpm: 166, ticks: 6, mixvol: 42,
  message: 'HELIOBANE stage 13 "Ossuary of Stars" (MUSIC-D, World 3 UMBRA).\nA minor -> Bb minor, 166 BPM. Orders 1-8 loop.\nAll samples synthesized. Source: songs/heliobane_stage13.gen.js',
  samples: [
    kick({ f0: 220, f1: 56, decay: 12, drive: 2.6 }), snare({ tone: 190, decay: 16, seed: 131, drive: 2.2 }), cymbal('hat closed', { seed: 133 }),
    cymbal('hat open', { sec: 0.3, decay: 10, seed: 134 }), cymbal('crash', { sec: 1.3, decay: 2.6, seed: 138, metalMix: 0.35 }),
    drum('ritual drum', { f: 110, seed: 135 }), wave('saw bass', BASS_AMPS), wave('wail', [1, 0.5, 0.33, 0.14, 0.1, 0.05, 0.04]),
    choir('choir aah'), bell(), { name: 'arp pulse', synth: { wave: 'square', pulse: 0.25 } }, noiseLoop(),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
