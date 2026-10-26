#!/usr/bin/env node
/**
 * Loopwright — "Sugar Rush" (race on Sweet Shop tracks). 2026-09-29.
 * C major, 12/8 shuffle, speed 4: 6 rows per dotted-quarter beat, 24 rows/bar,
 * 96 rows = 4 bars. BPM 116 sets the dotted quarter (IT tick = 2.5/116 s), so one
 * pattern is 8.28 s. Long-short swing = 4 rows + 2 rows.
 *
 * Candy tracks get a bouncier cue than the other races: a thin candy pulse lead,
 * shuffle hats, a swung root-fifth bass, and a music box that doubles the lead an
 * octave up in the third verse (the sparkle), then takes the tune in the bridge.
 * The wind-up motif swings: C (long) D (short) E, then a held G.
 * Studied: the chiptune idioms' compound-meter recipe (kick 1 and 3, snare 2 and 4
 * at speed 4) and Pocket Tram (a dotted pickup hopping to the third).
 *
 * Phrase map
 *   Intro   C Am F G              band only, snare pickup
 *   A       C Am F G              the swung motif, open on G5 over G
 *   A'      C Am Dm-G C           same opening, lands on C6
 *   A*      A with the music box an octave above the lead (the new element)
 *   B       F G Em-Am Dm-G        the music box sings; the lead rests; half-time hats
 * Form: Intro | A A' A* A' B A' -> A (order 1). Loop body 6 patterns, 49.7 s.
 * Unauditioned: lint and loudness are checks, not listening.
 */
import { kit, prog, phrase, lane, stabs, figure, nn, ns, assemble, loopTo, writeSong } from './loopwright.kit.js';

const ROWS = 96, BAR = 24;
const { samples, I } = kit(['thin', 'box', 'stab', 'bass', 'kick', 'snare', 'hat', 'crash', 'block']);

const P = {
  A: prog(['C', 'Am', 'F', 'G'], BAR),
  A2: prog(['C', 'Am', ['Dm', 12], ['G', 12], 'C'], BAR),
  B: prog(['F', 'G', ['Em', 12], ['Am', 12], ['Dm', 12], ['G', 12]], BAR),
};

const VERSE = [
  [0, 'C-6', 4, 38], [4, 'D-6', 2, 34], [6, 'E-6', 4, 40], [10, 'G-6', 8, 46], [18, 'E-6', 4, 38], [22, 'G-6', 2, 36],
  [24, 'A-6', 10, 46], [34, 'G-6', 2, 36], [36, 'E-6', 4, 38], [40, 'C-6', 2, 34], [42, 'E-6', 6, 40],
  [48, 'F-6', 4, 42], [52, 'E-6', 2, 34], [54, 'F-6', 4, 40], [58, 'A-6', 8, 46], [66, 'G-6', 4, 38], [70, 'F-6', 2, 34],
  [72, 'D-6', 10, 44], [82, 'B-5', 2, 34], [84, 'D-6', 4, 38], [88, 'G-5', 6, 38],
];
const VERSE2 = [
  ...VERSE.filter(([r]) => r < 48),
  [48, 'F-6', 4, 42], [52, 'E-6', 2, 34], [54, 'D-6', 4, 38], [58, 'F-6', 2, 34], [60, 'G-6', 6, 44], [66, 'F-6', 4, 38], [70, 'D-6', 2, 34],
  [72, 'E-6', 4, 42], [76, 'D-6', 2, 36], [78, 'C-6', 12, 44],
];
const BOX_TUNE = [
  [0, 'A-6', 4, 44], [4, 'G-6', 2, 36], [6, 'F-6', 4, 40], [10, 'C-6', 8, 42], [18, 'F-6', 4, 40], [22, 'A-6', 2, 38],
  [24, 'B-6', 4, 44], [28, 'A-6', 2, 36], [30, 'G-6', 4, 40], [34, 'D-6', 8, 42], [42, 'G-6', 6, 42],
  [48, 'G-6', 6, 44], [54, 'B-5', 6, 38], [60, 'C-6', 6, 42], [66, 'E-6', 6, 40],
  [72, 'F-6', 6, 44], [78, 'A-5', 6, 38], [84, 'B-5', 6, 40], [90, 'D-6', 6, 44],
];

const lead = (ev) => phrase(ev, I.thin, { rows: ROWS, vib: 'H42', vibDelay: 4, name: 'lead' });
const box = (ev, scale = 1) => phrase(ev.map(([r, n, l, v]) => [r, n, l, Math.round(v * scale)]), I.box, { rows: ROWS, sustain: 1, release: 1, name: 'box' });
const sparkle = (ev) => box(ev.map(([r, n, l, v]) => [r, ns(nn(n) + 12), l, v]), 0.5);

// Swung root-fifth bass: long root, short octave, long fifth, short octave, per beat pair.
const SHUFFLE = [[0, 'r', 4, 40], [4, 'o', 2, 22], [6, 'f', 4, 32], [10, 'o', 2, 20], [12, 'r', 4, 38], [16, 'o', 2, 22], [18, 'f', 4, 32], [22, 'o', 2, 20]];
const bass = (p) => figure(p, I.bass, SHUFFLE, { rows: ROWS, sustain: 0.65 });
const swungStabs = (p, vol = 20) => stabs(p, I.stab, { rows: ROWS, rhythm: '....x.....x.....x.....x.', vol, skip: (r) => r === 4 });

const DRUMS = { k: [I.kick, 36], s: [I.snare, 26], w: [I.block, 14] };
const FILL = { s: [I.snare, 24], S: [I.snare, 15] };
const beat = (fill) => lane('k.....s.....k.....s...w.', DRUMS, { rows: ROWS, name: 'drums', fill: fill ? 's...S.s.S.ss' : '', fillMap: FILL });
const hats = (crash = false, half = false) => {
  const ch = lane(half ? 'H...........H...........' : 'H...h.H...h.H...h.H...h.', { H: [I.hat, 12], h: [I.hat, 7] }, { rows: ROWS, name: 'hats' });
  if (crash) ch[0] = { note: 'C-5', instrument: I.crash, vol: 'v20' };
  return ch;
};

const LAYOUT = ['lead', 'box', 'stab', 'bass', 'drums', 'hats'];
const PANS = [0x70, 0xa0, 0x98, 0x80, 0x80, 0x60];
const pat = (name, parts) => assemble(name, ROWS, LAYOUT, PANS, parts);

const patterns = [
  pat('intro - unwrapping', { stab: swungStabs(P.A, 16), bass: bass(P.A), drums: beat(true), hats: hats() }),
  pat('A - swung motif', { lead: lead(VERSE), stab: swungStabs(P.A), bass: bass(P.A), drums: beat(false), hats: hats(true) }),
  pat("A' - lands home", { lead: lead(VERSE2), stab: swungStabs(P.A2), bass: bass(P.A2), drums: beat(true), hats: hats() }),
  pat('A* - sparkle', { lead: lead(VERSE), box: sparkle(VERSE), stab: swungStabs(P.A), bass: bass(P.A), drums: beat(false), hats: hats(true) }),
  pat('B - music box', { box: box(BOX_TUNE), stab: swungStabs(P.B, 16), bass: bass(P.B), drums: beat(true), hats: hats(false, true) }),
];
// The last A' is its own copy so the jump back to A only fires at the loop's end.
patterns.push({ ...structuredClone(patterns[2]), name: "A' - back to the top" });
loopTo(patterns[5].channels, ROWS, 1);

writeSong(import.meta.url, {
  title: 'Sugar Rush', bpm: 116, ticks: 4, mixvol: 64,
  message: 'Sugar Rush - Loopwright Sweet Shop race theme. C major 12/8 shuffle, speed 4.\nThe wind-up motif swung; a music-box sparkle.\nAll samples synthesized. Source: songs/loopwright_sugar_rush.gen.js',
  samples,
  channelnames: LAYOUT,
  patterns,
  order: [0, 1, 2, 3, 2, 4, 5],
});
