#!/usr/bin/env node
/**
 * HELIOBANE stage 15 — "The First Mouth" (World 3 UMBRA: the final approach). MUSIC-D, 2026-09-25.
 * D minor (→ Eb minor), 176 BPM, speed 6: 4 rows/beat, 16 rows/bar, 8 bars = 10.9 s.
 * Rendered at 44352 Hz so a tick is exactly 630 samples (see render_d.py).
 *
 * Identity: the title anthem "Sun-Killer" come home, darkened. Its hook "D D A——" keeps its
 * first bar note for note on the same PWM lead, then the harmony turns: Bb becomes Bb minor
 * (so the hook's D falls to Db), C becomes Eb (the Neapolitan), and the answer's E over Bb
 * becomes Eb-Db. Under it a cathedral: organ pedal, five-voice choir chords, taiko, bells.
 *
 * Phrase map (title's chords in brackets)
 *   Intro   Dm Bbm Gm A            bells toll the hook augmented "D D A | Bb F | G Bb | A C# E" (not looped)
 *   A       Dm Bbm Eb A / Dm Bbm Gm-A Dm   [Dm Bb C A / Dm Bb C-A Dm]  the dark hook
 *   A2      same + 3-row echo + 25% pulse J-arps (Tyrian)
 *   B       Bbm F Gm Dm Eb Bbm Gm A     new minor-mode bridge; F major is the one bright chord
 *   Grand   Dm Dm Bbm Bbm Eb Eb A A     half time: the hook at half speed on brass over organ + choir
 *   Build   Gm Ab A Bb                  chromatic climb to Bb = V of Eb minor
 *   A↑ B↑   Eb minor, written harmony, taiko
 *   Tag     B Bb A A                    chromatic fall to V of D minor, orchestra hits
 * Loop body: orders 1–8 (56 bars, 76.4 s).
 */
import { kick, snare, cymbal, noiseLoop, wave, pwm, orchHit, BASS_AMPS, BRASS_AMPS, mel, jump, writeSongCompact,
  drum, bell, choir, organ, sectionMaker, roll, riser, toll, at, chart } from './heliobane_stage11.kit.js';
import { nn, ns } from './lib.js';

const I = { kick: 0, snare: 1, hat: 2, ohat: 3, crash: 4, drum: 5, bass: 6, lead: 7, choir: 8, organ: 9, brass: 10, orch: 11, bell: 12, noise: 13, arp: 14 };
const LAYOUT = ['kick', 'snare', 'hat', 'perc', 'bass', 'gtr', 'lead', 'echo', 'c1', 'c2', 'c3', 'stab', 'fx'];
const PANS = [0x80, 0x76, 0xb0, 0x6a, 0x80, 0x80, 0x8a, 0xb6, 0x4c, 0x80, 0xb4, 0x5a, 0x94];
const maps = {
  kick: { X: [I.kick, 62], x: [I.kick, 48] },
  snare: { X: [I.snare, 56], x: [I.snare, 40], g: [I.snare, 16] },
  hat: { X: [I.hat, 42], x: [I.hat, 27], g: [I.hat, 15], o: [I.ohat, 36] },
  perc: { L: [I.drum, 52, null, 'G-4'], M: [I.drum, 46, null, 'D-5'], H: [I.drum, 42, null, 'G-5'] },
};
const fill = { kick: 'X.....X.X.X.....', snare: '....X.......XxXX', hat: 'X.x.X.x.X.x.....', perc: 'L.......L...MMHH' };
const section = sectionMaker({ I, LAYOUT, PANS, maps, fill });

const G = {
  A: { kick: 'X.....X.X.......', snare: '....X.......X...', hat: 'X.x.X.x.X.x.X.xo' },
  drive: { kick: 'X.X...X.X.X...X.', snare: '....X.......X...', hat: 'XgxgXgxgXgxgXgxg' },
  up: { kick: 'X.X...X.X.X...X.', snare: '....X.......X...', hat: 'XgxgXgxgXgxgXgxg', perc: ['L...............', 'L.......M...H...'] },
  grand: { kick: 'X.........X.....', snare: '........X.......', hat: 'x...x...x...x.o.', perc: ['L.......L.......', 'L.......L...M.H.'] },
};
const BASS = { A: ['R.RoR.RoR.RoR.oh'], B: ['R.O.r.O.R.O.r.OH'], grand: ['R-------r-------'] };
const PEDAL = ['R---------------'];
const CH = {
  intro: 'Dm Bbm Gm A', A: 'Dm Bbm Eb A Dm Bbm Gm/8 A/8 Dm/16', B: 'Bbm F Gm Dm Eb Bbm Gm A',
  grand: 'Dm Dm Bbm Bbm Eb Eb A A', build: 'Gm Ab A Bb', tag: 'B Bb A A',
};

// ---------------------------------------------------------------- melodies
// title: d5/2 d5 a5/6 g5/2 a5 c6 | bb5/6 a5/2 f5/4 d5 | e5/2 f5 g5/6 f5/2 e5 c5 | e5/4 d5/2 c#5 e5/8 | ...
const A_MEL = 'd5/2 d5 a5/6 g5/2 a5 c6 | bb5/6 a5/2 f5/4 db5 | eb5/2 f5 g5/6 f5/2 eb5 bb4 | e5/4 d5/2 c#5 e5/8'
  + ' | d5/2 d5 a5/6 g5/2 a5 d6 | f6/6 eb6/2 db6/4 bb5 | c6/2 bb5 a5 g5 e5/4 c#5 | d5/12 r/4';
const B_MEL = 'db6/6 bb5/2 f5/4 bb5 | a5/10 f5/2 a5 c6 | d6/6 bb5/2 g5/4 d6 | f6/8 e6/4 d6'
  + ' | g6/6 f6/2 eb6/4 bb5 | f6/6 db6/2 bb5/4 f6 | bb6/6 a6/2 g6/4 d6 | c#6/4 e6 a6/8~';
const GRAND = 'd5/4 d5 a5/8~ | g5/4 a5 c6/8 | bb5/12 a5/4 | f5/8 db5 | eb5/4 f5 g5/8~ | f5/4 eb5 bb4/8 | e5/8 d5/4 c#5 | e5/16~';
const BELLS = 'd5/4 d5 a5/8 | bb5/8 f5 | g5/8 bb5 | a5/4 c#6 e6/8';
const BUILD_MEL = 'g5/4 bb5 d6 g6 | ab5/4 c6 eb6 ab6 | a5/4 c#6 e6 a6 | bb5/4 d6 f6 d6';
const TAG_MEL = 'd#6/8 f#6 | d6/8 f6 | c#6/8 e6 | a6/16~';

function orch(chords, rowsList) {
  const segs = chart(chords), ch = {};
  for (const r of rowsList) ch[r] = { note: ns(nn('G-4') + ((at(segs, r).root - nn('G-4')) % 12 + 12) % 12), instrument: I.orch, vol: 'v48' };
  return ch;
}

// ---------------------------------------------------------------- sections
const mouth = (name, bars, chords, o = {}) => section(name, bars, chords, {
  riff: BASS.A, bassLo: 'C-3', gtr: PEDAL, gtrInst: I.organ, gtrLo: 'C-4', gtrVol: 20, choirLo: 'D-4', span: 14, choirVol: 19, leadInst: I.lead, leadVol: 48, ...o });
const intro = mouth('intro: the bells', 4, CH.intro, {
  riff: PEDAL, fill: false, crash: false, choirVol: 15,
  groove: { perc: ['L...............', 'L...............', 'L.......L.......', 'L...L...L.L.MMHH'] },
  extra: { lead: toll(mel(BELLS, { vol: 48 }).map(([r, n, , vv]) => [r, n, vv]), I.bell, { rows: 64, len: 16 }), snare: roll(I.snare, { bars: 1, total: 4, from: 10, to: 50 }) },
});
const arps = { stabs: ['X-x-X-x-X-x-X-x-'], stabInst: I.arp, stabLo: 'F-4', stabVol: 16 };
const grand = mouth('grand: the hook at half speed', 8, CH.grand, {
  riff: BASS.grand, melody: GRAND, leadInst: I.brass, leadVol: 46, groove: G.grand, choirVol: 21, gtrVol: 26, echo: 6,
  extra: { stab: orch(CH.grand, [0, 32, 64, 96]) },
});
const build = mouth('build', 4, CH.build, {
  riff: ['R.R.R.R.R.R.R.R.', 'R.R.R.R.R.R.R.R.', 'RrRrRrRrRrRrRrRr', 'RrRrRrRrRrRrRrRr'], melody: BUILD_MEL, fill: false,
  groove: { kick: ['X.......X.......', 'X...X...X...X...', 'X.X.X.X.X.X.X.X.', 'X.X.X.X.XXXXXXXX'], hat: 'x.x.x.x.x.x.x.x.' },
  extra: { snare: roll(I.snare, { bars: 3, total: 4 }), fx: riser(I.noise, 16, 64), stab: orch(CH.build, [48]) },
});
const tag = mouth('tag: fall to A', 4, CH.tag, {
  melody: TAG_MEL, groove: G.drive, riff: BASS.B, extra: { stab: orch(CH.tag, [0, 6, 16, 22, 32, 38, 48, 54]) } });

const patterns = [
  intro,
  mouth('A: the dark hook', 8, CH.A, { melody: A_MEL, groove: G.A }),
  mouth('A2: hook + echo + arps', 8, CH.A, { melody: A_MEL, echo: 3, groove: G.A, ...arps }),
  mouth('B: minor bridge', 8, CH.B, { melody: B_MEL, echo: 3, groove: G.drive, riff: BASS.B, ...arps, choirVol: 19 }),
  grand,
  build,
  mouth('A up: Eb minor + harmony', 8, CH.A, { semi: 1, melody: A_MEL, harm: true, groove: G.up, ...arps }),
  mouth('B up: Eb minor + harmony', 8, CH.B, { semi: 1, melody: B_MEL, harm: true, groove: G.up, riff: BASS.B, choirVol: 19 }),
  jump(tag, 1),
];

writeSongCompact(import.meta.url, {
  title: 'Heliobane - The First Mouth', bpm: 176, ticks: 6, mixvol: 42,
  message: 'HELIOBANE stage 15 "The First Mouth" (MUSIC-D, World 3 UMBRA).\nD minor -> Eb minor, 176 BPM. The title hook, darkened. Orders 1-8 loop.\nAll samples synthesized. Source: songs/heliobane_stage15.gen.js',
  samples: [
    kick({ f0: 240, f1: 58, decay: 12, drive: 2.8 }), snare({ tone: 190, decay: 16, seed: 151, drive: 2.3 }), cymbal('hat closed', { seed: 153 }),
    cymbal('hat open', { sec: 0.3, decay: 10, seed: 154 }), cymbal('crash', { sec: 1.4, decay: 2.3, seed: 158, metalMix: 0.35 }),
    drum('ritual drum', { f: 115, seed: 155 }), wave('saw bass', BASS_AMPS), pwm('pwm lead'), choir('choir aah'), organ(),
    wave('brass', BRASS_AMPS), orchHit(), bell(), noiseLoop(), { name: 'arp pulse', synth: { wave: 'square', pulse: 0.25 } },
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
