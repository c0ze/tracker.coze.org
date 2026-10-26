#!/usr/bin/env node
/**
 * Loopwright — "Lamplight" (build mode at night, under the desk lamp). 2026-09-29.
 * B minor, 80 BPM, speed 6: 4 rows/beat, 16 rows/bar, 64 rows = 4 bars = 12 s.
 *
 * The same bench after dark: Tinker's Bench's relative minor, slower and emptier.
 * A long desk bell states the wind-up motif in minor (B-C#-D to F#), a triangle pad
 * holds one chord tone, the bass plays once a bar, and the clock only ticks. The
 * night ambience (crickets, a clock) plays under it in game, so the bed stays thin.
 * Studied: Farstrand's title (one lonely voice, one held pad tone, heartbeat bass)
 * and Winter Orbit's warning (bell tails bridge chords only where written).
 *
 * Phrase map
 *   A    Bm G  D  A          the motif in minor, then again in D (D-E-F# to A); open on A
 *   B    Em Bm/D G F#        lower; ends on A# over F#, the pull home
 *   A'   A with the bell's phrase endings echoed 6 rows late (the new element)
 *   C    Bm G  Em F#         pad, bass and a slow box arpeggio only
 * Form: A B A' C (loops whole). 4 patterns, 48 s.
 * Unauditioned: lint and loudness are checks, not listening.
 */
import { kit, prog, phrase, lane, figure, arp, pad, echoChannel, slice, join, assemble, writeSong } from './loopwright.kit.js';

const ROWS = 64;
const { samples, I } = kit(['bell', 'pad', 'box', 'bass', 'tick', 'tock']);

const P = {
  A: prog(['Bm', 'G', 'D', 'A']),
  B: prog(['Em', 'Bm/D', 'G', 'F#']),
  C: prog(['Bm', 'G', 'Em', 'F#']),
};

const TUNE = [
  [0, 'B-5', 2, 38], [2, 'C#6', 2, 40], [4, 'D-6', 2, 42], [6, 'F#6', 10, 48],
  [16, 'D-6', 8, 42], [24, 'B-5', 8, 38],
  [32, 'D-6', 2, 36], [34, 'E-6', 2, 38], [36, 'F#6', 2, 40], [38, 'A-6', 10, 46],
  [48, 'C#6', 8, 42], [56, 'A-5', 6, 38],
];
const LOW = [
  [0, 'G-5', 8, 38], [8, 'B-5', 8, 40],
  [16, 'F#5', 12, 40],
  [32, 'D-6', 8, 44], [40, 'B-5', 6, 38],
  [48, 'A#5', 12, 42],
];

const bell = (ev) => phrase(ev, I.bell, { rows: ROWS, sustain: 1, release: 1, name: 'bell' });
// The held notes' tails, an echo 6 rows (a dotted quarter) late and much softer.
// Only the two ten-row notes are echoed; an echoed B at row 24 rubbed the next pad tone.
const tails = (ev) => echoChannel(bell(ev.filter((e) => e[2] >= 10)), { delay: 6, scale: 0.4, rows: ROWS });

const bass = (p) => figure(p, I.bass, [[0, 'r', 14, 30]], { rows: ROWS, sustain: 0.8 });
// The pad holds each chord's fifth, under the bell and clear of its passing notes.
const padLine = (p, vol = 11) => pad(p, I.pad, { rows: ROWS, voice: 2, oct: 5, vol });
const clock = (vol = 13) => lane('t.......t.......', { t: [I.tick, vol] }, { rows: ROWS, name: 'clock' });

const LAYOUT = ['bell', 'echo', 'pad', 'arp', 'bass', 'clock'];
const PANS = [0x78, 0xb0, 0x68, 0x98, 0x80, 0xa0];
const pat = (name, parts) => assemble(name, ROWS, LAYOUT, PANS, parts);

const patterns = [
  pat('A - lamp on', { bell: bell(TUNE), pad: padLine(P.A), bass: bass(P.A), clock: clock() }),
  pat('B - low', { bell: bell(LOW), pad: padLine(P.B), bass: bass(P.B), clock: clock() }),
  pat("A' - with tails", { bell: bell(TUNE), echo: tails(TUNE), pad: padLine(P.A), bass: bass(P.A), clock: clock() }),
  pat('C - only the lamp', {
    pad: padLine(P.C, 13),
    arp: arp(P.C, I.box, { rows: ROWS, every: 4, order: [0, 1, 2, 1], vol: 20 }),
    bass: bass(P.C), clock: clock(11),
  }),
];

writeSong(import.meta.url, {
  title: 'Lamplight', bpm: 80, ticks: 6, mixvol: 64,
  message: 'Lamplight - Loopwright night build theme. B minor, 80 BPM.\nDesk bell, triangle pad, clock tick. All samples synthesized.\nSource: songs/loopwright_lamplight.gen.js',
  samples,
  channelnames: LAYOUT,
  patterns,
  order: [0, 1, 2, 3],
});
