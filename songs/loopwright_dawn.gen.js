#!/usr/bin/env node
/**
 * Loopwright — "Dawn Over the Desk" (ending: the lamp goes out, the window lightens,
 * the cuckoo calls six). 2026-09-29.
 * F major, 76 BPM, speed 6: 4 rows/beat, 16 rows/bar, 64 rows = 4 bars = 12.6 s.
 *
 * The main theme's key and motif, slowed to a morning: the music box plays C-D-E to a
 * long F, a triangle pad holds each chord's third, the bass moves once a bar, and a
 * few bird chirps (sine with a fast upward arpeggio, one row each) answer in the gaps.
 * No drums; the clock ticks only in the first pattern, as the night ends.
 * Studied: Farstrand's title (a lonely lead over a single held pad tone) and Lantern
 * Walk's closing breath (the last phrase stops early and leaves a bar of air).
 *
 * Phrase map
 *   A    F C/E Dm Bb          the motif at a walk; the clock still ticking
 *   A'   F/A Bb Gm7 Csus4-C   higher answer, a suspension that resolves
 *   A"   A with the box's long notes answered by the desk bell, two rows late (new)
 *   End  Bb C F F             long notes, then a bar of pad, birds and air
 * Form: A A' A" End (loops whole). 4 patterns, 50.5 s.
 * Unauditioned: lint and loudness are checks, not listening.
 */
import { kit, prog, phrase, lane, figure, pad, assemble, writeSong } from './loopwright.kit.js';

const ROWS = 64;
const { samples, I } = kit(['box', 'bell', 'pad', 'bass', 'chirp', 'tick']);

const P = {
  A: prog(['F', 'C/E', 'Dm', 'Bb']),
  A2: prog(['F/A', 'Bb', 'Gm7', ['Csus4', 8], ['C', 8]]),
  End: prog(['Bb', 'C', 'F', 'F']),
};

const TUNE = [
  [0, 'C-6', 2, 40], [2, 'D-6', 2, 42], [4, 'E-6', 2, 44], [6, 'F-6', 10, 50],
  [16, 'G-6', 6, 46], [22, 'E-6', 2, 40], [24, 'C-6', 8, 44],
  [32, 'D-6', 2, 40], [34, 'E-6', 2, 42], [36, 'F-6', 2, 44], [38, 'A-6', 10, 50],
  [48, 'F-6', 8, 46], [56, 'D-6', 8, 42],
];
const ANSWER = [
  [0, 'C-6', 2, 40], [2, 'D-6', 2, 42], [4, 'E-6', 2, 44], [6, 'F-6', 6, 48], [12, 'A-6', 4, 44],
  [16, 'A#6', 8, 50], [24, 'A-6', 4, 44], [28, 'F-6', 4, 40],
  [32, 'F-6', 8, 46], [40, 'D-6', 8, 42],
  [48, 'F-6', 8, 46], [56, 'E-6', 8, 44],
];
const END = [
  [0, 'D-6', 8, 44], [8, 'F-6', 8, 46],
  [16, 'E-6', 8, 44], [24, 'G-6', 8, 46],
  [32, 'F-6', 16, 48],
];

const box = (ev) => phrase(ev, I.box, { rows: ROWS, sustain: 1, release: 1, name: 'box' });
// The bell answers each long box note two rows late, a third or sixth below, whichever
// is a tone of the chord under it (A under F, E under C/E, F under Dm, D and F under Bb).
const BELL = [[8, 'A-5', 8, 30], [26, 'E-5', 6, 26], [40, 'F-6', 8, 30], [50, 'D-6', 6, 28], [58, 'F-5', 6, 26]];
const bellAnswer = () => phrase(BELL, I.bell, { rows: ROWS, sustain: 1, release: 1, name: 'bell' });

const bass = (p) => figure(p, I.bass, [[0, 'r', 14, 30]], { rows: ROWS, sustain: 0.8 });
const padLine = (p) => pad(p, I.pad, { rows: ROWS, voice: 1, oct: 4, vol: 14 });
// A bird: one high sine row with a fast upward arpeggio, then silence.
const birds = (rows) => {
  const ch = {};
  for (const [r, note, fx, v] of rows) {
    ch[r] = { note, instrument: I.chirp, vol: `v${v}`, fx };
    ch[r + 1] = { vol: `v${Math.round(v * 0.4)}`, fx };
    ch[r + 2] = { note: '^^' };
  }
  return ch;
};
const clock = () => lane('t.......t.......', { t: [I.tick, 12] }, { rows: ROWS, name: 'clock', skip: (r) => r >= 32 });

const LAYOUT = ['box', 'bell', 'pad', 'bass', 'birds', 'clock'];
const PANS = [0x78, 0x98, 0x68, 0x80, 0xc0, 0xa0];
const pat = (name, parts) => assemble(name, ROWS, LAYOUT, PANS, parts);

const patterns = [
  pat('A - lamp off', { box: box(TUNE), pad: padLine(P.A), bass: bass(P.A), birds: birds([[44, 'F-7', 'J47', 14]]), clock: clock() }),
  pat("A' - window", { box: box(ANSWER), pad: padLine(P.A2), bass: bass(P.A2), birds: birds([[13, 'C-8', 'J57', 12], [60, 'A-7', 'J38', 14]]) }),
  pat('A" - bell answers', { box: box(TUNE), bell: bellAnswer(), pad: padLine(P.A), bass: bass(P.A), birds: birds([[20, 'G-7', 'J58', 14], [37, 'A-7', 'J38', 10]]) }),
  pat('End - morning', { box: box(END), pad: padLine(P.End), bass: bass(P.End), birds: birds([[50, 'C-8', 'J57', 14], [54, 'F-7', 'J47', 12], [56, 'A-7', 'J38', 10]]) }),
];

writeSong(import.meta.url, {
  title: 'Dawn Over the Desk', bpm: 76, ticks: 6, mixvol: 64,
  message: 'Dawn Over the Desk - Loopwright ending. F major, 76 BPM.\nThe wind-up motif at a walk; music box, bell, birds.\nAll samples synthesized. Source: songs/loopwright_dawn.gen.js',
  samples,
  channelnames: LAYOUT,
  patterns,
  order: [0, 1, 2, 3],
});
