#!/usr/bin/env node
/**
 * HELIOBANE stage 11 — "Dead Light" (World 3 UMBRA: arrival at the dead star). MUSIC-D, 2026-09-25.
 * F minor, 158 BPM, speed 6: 4 rows/beat, 16 rows/bar, 8 bars = 12.2 s.
 * Rendered at 44240 Hz so a tick is exactly 700 samples (see render_d.py): the beat is exact.
 *
 * Identity: a slow-burning half-time riff (bass + power chord in unison) that leans on the
 * flat second and the flat fifth:  F— F F Ab— F— Gb— | F— F F Cb— Bb— Ab—.
 * Over it a gold horn sings; a formant choir holds voice-led chords; a church bell tolls.
 *
 * Phrase map
 *   Intro   Fm Fm Gb Fm            choir swell, bell tolls, riff enters on bass, taiko + roll (not looped)
 *   A       Fm x6 Db C             the riff alone, half time (kick 1, snare 3), bell on bars 1 and 5
 *   B       Fm Fm Db Db Gb Gb C C  verse: horn "C Db C Ab | F——", answer F Eb Db C, Gb with its maj7 F, C opens
 *   C       Db Eb Fm Fm Bbm Gb C C chorus, black-and-gold: arpeggios climbing to C7/Db7, drive groove
 *   A'      riff at full time, choir stabs on the downbeats, horn call C Db C
 *   Brk     Fm Fm Dbmaj7 x2 Bbm x2 C C   dead light: bell melody with a 6-row echo, whole-note bass, rattles
 *   Build   Bbm Db Eb C            snare roll, riser, horn climbs to E (leading tone)
 *   B' C'   verse + chorus with double-time riff, written harmony, taiko; the burn
 *   Tag     Fm Fm Gb C             riff + stabs, back to A
 * Loop body: orders 1–9 (64 bars, 97.2 s).
 */
import { kick, snare, cymbal, noiseLoop, wave, powerChord, BRASS_AMPS, mel, jump, writeSongCompact,
  drum, rattle, bell, choir, fleshBass, sectionMaker, roll, riser, toll } from './heliobane_stage11.kit.js';

const I = { kick: 0, snare: 1, hat: 2, ohat: 3, crash: 4, drum: 5, rattle: 6, bass: 7, gtr: 8, lead: 9, choir: 10, bell: 11, noise: 12 };
const LAYOUT = ['kick', 'snare', 'hat', 'perc', 'bass', 'gtr', 'lead', 'echo', 'c1', 'c2', 'c3', 'stab', 'fx'];
const PANS = [0x80, 0x78, 0xb0, 0x68, 0x80, 0x6c, 0x88, 0x56, 0x50, 0x80, 0xb0, 0xa0, 0x90];
const maps = {
  kick: { X: [I.kick, 64], x: [I.kick, 48] },
  snare: { X: [I.snare, 58], x: [I.snare, 40], g: [I.snare, 16] },
  hat: { X: [I.hat, 42], x: [I.hat, 27], g: [I.hat, 15], o: [I.ohat, 36] },
  perc: { L: [I.drum, 58, null, 'F-4'], l: [I.drum, 40, null, 'F-4'], M: [I.drum, 50, null, 'G-4'], H: [I.drum, 46, null, 'C-5'],
    r: [I.rattle, 26], R: [I.rattle, 40] },
};
const fill = { kick: 'X.....x.X.......', snare: '....X...XxXxXXXX', hat: 'x.x.x.x.x.......', perc: 'L.......L.L.MMHH' };
const section = sectionMaker({ I, LAYOUT, PANS, maps, fill });

// ---------------------------------------------------------------- riff & grooves
const RA = 'R---r-r-3--R--1-', RB = 'R---r-r-6--5--3-';           // F F F Ab F Gb | F F F Cb Bb Ab
const DA = 'RrrRrr3-RrrRrr1-', DB = 'RrrRrr6-5-3-r-1-';           // double-time burn
const VR = ['R---r-r-f--R--r-', 'R---r-r-f--o--f-'];               // verse: no b2/b3 under the horn
const VD = ['RrrRrrf-RrrRrro-', 'RrrRrrf-RrrRrrf-'];
const G = {
  half: { kick: 'X.........x.....', snare: '........X.......', hat: 'x...x...x...x.o.' },
  main: { kick: 'X.....x.X.x.....', snare: '....X.......X...', hat: 'x.x.x.x.x.x.x.xo' },
  drive: { kick: 'X.X...X.X.X...X.', snare: '....X.......X...', hat: 'XgxgXgxgXgxgXgxg' },
  burn: { kick: 'X.X.X.X.X.X.X.X.', snare: '....X.......X...', hat: 'x.x.x.x.x.x.x.x.', perc: ['L..L..L.........', 'L..L..L.....M.H.'] },
  brk: { kick: 'X...............', perc: 'l...r...r...r.r.' },
};
const CH = {
  intro: 'Fm Fm Gb Fm', A: 'Fm Fm Fm Fm Fm Fm Db C', B: 'Fm Fm Db Db Gb Gb C C', C: 'Db Eb Fm Fm Bbm Gb C C',
  brk: 'Fm Fm Dbmaj7 Dbmaj7 Bbm Bbm C C', build: 'Bbm Db Eb C', tag: 'Fm Fm Gb C',
};

// ---------------------------------------------------------------- melodies
const B_MEL = 'c6/6 db6/2 c6/4 ab5/4 | f5/12 r/4 | f6/6 eb6/2 db6/4 c6/4 | ab5/12 r/4'
  + ' | bb5/6 db6/2 gb6/8~ | f6/4 eb6/4 db6/8 | c6/6 e6/2 g6/8~ | g6/4 f6/4 e6/8~';
const C_MEL = 'ab6/8 f6/4 db6/4 | bb6/8 g6/4 eb6/4 | c7/12~ ab6/2 g6/2 | f6/16~'
  + ' | db7/8 bb6/4 f6/4 | bb6/6 ab6/2 gb6/4 db6/4 | e6/6 f6/2 g6/8~ | c7/8 bb6/4 g6/4';
const CALL = 'c6/6 db6/2 c6/8 | r/16 | c6/6 db6/2 f6/4 eb6/4 | c6/16 | ab5/6 bb5/2 c6/8 | r/16 | db6/8 c6/4 bb5/4 | c6/8 e6/8';
const BELL = 'f5/8 c6/8 | ab5/16 | f6/8 c6/8 | ab5/16 | f5/8 db6/8 | bb5/16 | e5/8 g5/8 | c6/16';
const BUILD_MEL = 'f5/4 ab5 bb5 db6 | db6/4 f6 ab6 f6 | eb6/4 g6 bb6 g6 | e6/16~';

const bellLine = (str, rows, vol = 46, len = 16) => toll(mel(str, { vol }).map(([r, n, , vv]) => [r, n, vv]), I.bell, { rows, len });

// ---------------------------------------------------------------- sections
const intro = section('intro: dead star', 4, CH.intro, {
  riff: ['................', '................', RA, RB], groove: { perc: ['................', '................', 'L...........L...', 'L.......L.L.MMHH'] },
  fill: false, crash: false, choirVol: 15,
  extra: { echo: bellLine('f5/16 | c5/16 | f5/8 c6/8 | f5/16', 64, 48, 16), snare: roll(I.snare, { bars: 1, total: 4, from: 12, to: 50 }) },
});
const riffA = (name, o = {}) => section(name, 8, CH.A, { riff: [RA, RB], gtr: [RA, RB], gtrVol: 34, gtrLo: 'D#3', ...o });
const brk = section('brk: dead light', 8, CH.brk, {
  riff: ['R---------------'], groove: G.brk, fill: false, crash: false, choirVol: 16,
  extra: { lead: bellLine(BELL, 128, 44), echo: shiftRows(bellLine(BELL, 128, 18), 6, 128) },
});
function shiftRows(ch, by, rows) { return Object.fromEntries(Object.entries(ch).map(([r, e]) => [Number(r) + by, e]).filter(([r]) => r < rows)); }
const build = section('build', 4, CH.build, {
  riff: [DA], gtr: [DA], melody: BUILD_MEL, fill: false,
  groove: { kick: ['X.......X.......', 'X...X...X...X...', 'X.X.X.X.X.X.X.X.', 'XXXXXXXXXXXXXXXX'], hat: 'x.x.x.x.x.x.x.x.' },
  extra: { snare: roll(I.snare, { bars: 3, total: 4 }), fx: riser(I.noise, 16, 64) },
});
const tag = section('tag', 4, CH.tag, { riff: [RA, RB], gtr: [RA, RB], gtrVol: 34, gtrLo: 'D#3', groove: G.main, stabs: ['X--.....X--.....'], stabInst: I.choir });

const patterns = [
  intro,
  riffA('A: riff, half time', { groove: G.half, choirVol: 15, gtrVol: 38, extra: { echo: bellLine('f5/16 | r/16 | r/16 | r/16 | c6/16 | r/16 | r/16 | r/16', 128, 40) } }),
  section('B: verse', 8, CH.B, { riff: VR, gtr: VR, melody: B_MEL, leadInst: I.lead, echo: 3, groove: G.main }),
  section('C: chorus', 8, CH.C, { riff: ['Rr.Rr.Rr.Rr.Rr.R'], gtr: ['R-------R-----r-'], melody: C_MEL, echo: 3, groove: G.drive, choirVol: 20 }),
  riffA("A': riff + stabs + call", { groove: G.main, melody: CALL, stabs: ['X--.....X--.....'], stabInst: I.choir }),
  brk,
  build,
  section("B': verse, double time", 8, CH.B, { riff: VD, gtr: VD, melody: B_MEL, harm: true, groove: G.drive }),
  section("C': chorus, the burn", 8, CH.C, { riff: ['RrrRrrRrRrrRrrRr'], gtr: ['R-------R-----r-'], melody: C_MEL, harm: true, groove: G.burn, choirVol: 20 }),
  jump(tag, 1),
];

writeSongCompact(import.meta.url, {
  title: 'Heliobane - Dead Light', bpm: 158, ticks: 6, mixvol: 42,
  message: 'HELIOBANE stage 11 "Dead Light" (MUSIC-D, World 3 UMBRA).\nF minor, 158 BPM. Orders 1-9 loop.\nAll samples synthesized. Source: songs/heliobane_stage11.gen.js',
  samples: [
    kick({ f0: 200, f1: 56, decay: 11, drive: 2.8 }), snare({ tone: 176, decay: 14, seed: 111, drive: 2.2 }), cymbal('hat closed', { seed: 113 }),
    cymbal('hat open', { sec: 0.3, decay: 10, seed: 114 }), cymbal('crash', { sec: 1.3, decay: 2.4, seed: 118, metalMix: 0.35 }),
    drum('ritual drum', { f: 120 }), rattle(), fleshBass(), powerChord('power chord', { drive: 4.5 }),
    wave('gold horn', BRASS_AMPS), choir('choir aah'), bell(), noiseLoop(),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
