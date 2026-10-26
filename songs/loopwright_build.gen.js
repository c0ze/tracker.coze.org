#!/usr/bin/env node
/**
 * Loopwright — "Tinker's Bench" (build mode, daytime). 2026-09-29.
 * D major, 100 BPM, speed 6: 4 rows/beat, 16 rows/bar, 64 rows = 4 bars = 9.6 s.
 *
 * A bed to think over: the player spends minutes here turning track pieces, so the
 * cue stays low and unhurried and leaves the upper-mid free for the placing clicks.
 * No kick or snare; a clock tick-tock keeps the beat and a soft shaker the eighths.
 * The music box carries the tune, starting with the wind-up motif in D (D-E-F# to A).
 * Studied: Lantern Walk (hook rests, short chord punctuation) and Winter Orbit's
 * warning (end every tail explicitly: plucks here are cut when the next note lands).
 *
 * Phrase map
 *   A    D  A/C#  Bm  G       the motif and its descending answer, open on E over G
 *   A'   D  A/C#  G   A-D     same opening, lands on D
 *   B    Em F#m G  A         a whistle takes the tune in long notes; the box arpeggiates
 *   C    D  Bm  G  A         quiet bench: box arp, bass and clock only
 *   A+   A with a whistle counter-line in thirds under its held notes (the new element)
 * Form: A A' B A' C A+ B A' (loops whole). 8 patterns, 76.8 s.
 * Unauditioned: lint and loudness are checks, not listening.
 */
import { kit, prog, phrase, lane, figure, arp, harmony, MAJOR, assemble, writeSong } from './loopwright.kit.js';

const ROWS = 64;
const { samples, I } = kit(['box', 'sine', 'tri', 'bass', 'soft', 'shake', 'tick', 'tock', 'block']);
const D = MAJOR('D');

const P = {
  A: prog(['D', 'A/C#', 'Bm', 'G']),
  A2: prog(['D', 'A/C#', 'G', ['A', 8], ['D', 8]]),
  B: prog(['Em', 'F#m', 'G', 'A']),
  C: prog(['D', 'Bm', 'G', 'A']),
};

const TUNE = [
  [0, 'D-6', 2, 40], [2, 'E-6', 2, 42], [4, 'F#6', 2, 44], [6, 'A-6', 6, 50], [12, 'F#6', 4, 42],
  [16, 'E-6', 6, 46], [22, 'C#6', 2, 38], [24, 'E-6', 2, 40], [26, 'A-5', 6, 42],
  [32, 'B-5', 2, 40], [34, 'C#6', 2, 42], [36, 'D-6', 2, 44], [38, 'F#6', 6, 48], [44, 'D-6', 4, 40],
  [48, 'B-5', 4, 42], [52, 'D-6', 2, 38], [54, 'E-6', 8, 44],
];
const ANSWER = [
  ...TUNE.filter(([r]) => r < 32),
  [32, 'B-5', 2, 40], [34, 'D-6', 2, 42], [36, 'G-6', 6, 48], [44, 'F#6', 2, 40], [46, 'E-6', 2, 38],
  [48, 'E-6', 4, 42], [52, 'C#6', 2, 38], [54, 'A-5', 2, 36], [56, 'D-6', 6, 46],
];
const WHISTLE = [
  [0, 'B-5', 10, 30], [12, 'A-5', 2, 24], [14, 'G-5', 2, 24],
  [16, 'A-5', 10, 30], [28, 'C#6', 4, 26],
  [32, 'D-6', 10, 32], [44, 'B-5', 4, 26],
  [48, 'C#6', 8, 30], [56, 'E-6', 6, 30],
];

// Plucks decay by themselves; the cut only lands when the next note would.
const box = (ev) => phrase(ev, I.box, { rows: ROWS, sustain: 1, release: 1, name: 'box' });
const whistle = (ev) => phrase(ev, I.sine, { rows: ROWS, sustain: 0.85, release: 0.45, vib: 'H32', vibDelay: 4, name: 'whistle' });
// A third under the held tune notes, on the whistle, quietly. The last one (E over G)
// would put C# against the G bass, a tritone, so it takes B, a chord tone, instead.
const counter = (ev) => phrase(harmony(ev, D, { minLen: 6, scale: 0.55 }).map((e) => (e[0] === 54 ? [54, 'B-5', ...e.slice(2)] : e)),
  I.sine, { rows: ROWS, sustain: 0.85, release: 0.45, name: 'counter' });

// Bass: root on 1, fifth on 3, a soft pickup; quiet (this is a bed).
const BASS = [[0, 'r', 6, 34], [8, 'f', 4, 26], [12, 'r', 4, 22]];
const bass = (p, fig = BASS) => figure(p, I.bass, fig, { rows: ROWS });
const clock = (vol = 18) => lane('t...o...t...o...', { t: [I.tick, vol], o: [I.tock, Math.round(vol * 0.85)] }, { rows: ROWS, name: 'clock' });
const shaker = (vol = 7) => lane('..s...s...s...s.', { s: [I.shake, vol] }, { rows: ROWS, name: 'shaker' });
const knock = () => lane('k...............', { k: [I.soft, 22] }, { rows: ROWS, name: 'knock' });
const blocks = () => lane('..........b.b...', { b: [I.block, 12] }, { rows: ROWS, name: 'blocks', skip: (r) => r < 48 });

const LAYOUT = ['tune', 'whistle', 'arp', 'bass', 'knock', 'clock', 'shaker'];
const PANS = [0x78, 0x98, 0x60, 0x80, 0x80, 0xa8, 0x58];
const pat = (name, parts) => assemble(name, ROWS, LAYOUT, PANS, parts);

const patterns = [
  pat('A - the wind-up', { tune: box(TUNE), bass: bass(P.A), knock: knock(), clock: clock(), shaker: shaker() }),
  pat("A' - the answer", { tune: box(ANSWER), bass: bass(P.A2), knock: knock(), clock: clock(), shaker: shaker() }),
  pat('B - whistle', {
    whistle: whistle(WHISTLE),
    arp: arp(P.B, I.box, { rows: ROWS, every: 2, order: [0, 1, 2, 3, 2, 1, 0, 2], vol: 20 }),
    bass: bass(P.B), knock: knock(), clock: clock(16), shaker: blocks(),
  }),
  pat('C - quiet bench', {
    arp: arp(P.C, I.box, { rows: ROWS, every: 4, order: [0, 2, 1, 3], vol: 22 }),
    bass: bass(P.C, [[0, 'r', 12, 28]]), clock: clock(14),
  }),
  pat('A+ - with counter', { tune: box(TUNE), whistle: counter(TUNE), bass: bass(P.A), knock: knock(), clock: clock(), shaker: shaker() }),
];

writeSong(import.meta.url, {
  title: "Tinker's Bench", bpm: 100, ticks: 6, mixvol: 64,
  message: "Tinker's Bench - Loopwright build theme. D major, 100 BPM.\nMusic box, whistle, clock tick-tock. All samples synthesized.\nSource: songs/loopwright_build.gen.js",
  samples,
  channelnames: LAYOUT,
  patterns,
  order: [0, 1, 2, 1, 3, 4, 2, 1],
});
