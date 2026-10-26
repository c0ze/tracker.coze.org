#!/usr/bin/env node
/**
 * Loopwright — "Tin Grand Prix" (race, bright). 2026-09-29.
 * G major, 152 BPM, speed 6: 4 rows/beat, 16 rows/bar, 64 rows = 4 bars = 6.32 s.
 *
 * Wind-up cars off the line: the verse opens with the motif in G (G-A-B to D), the
 * chorus augments it (E-G to a held C7). Straight eighth octave-bounce bass,
 * off-beat J stabs, 16th hats with accents, a snare pickup before each chorus.
 * Studied: Skyline Relay (verse/chorus hierarchy, a written harmony under held chorus
 * notes as the only new element) and Peach Orchard (stabs as rhythm, not sustain).
 *
 * Phrase map
 *   Intro   G Em C D          drums, bass and stabs; the lead waits; snare pickup
 *   A       G Em C D          the motif, a skip up to G6, open on A over D
 *   A'      G Em C-D G        rises to a held G6, pickup D-E into the chorus
 *   C       C D Bm-Em Am-D    the augmented motif, peak C7, ends F#6 over D
 *   C+      C with a diatonic third under the held notes (the new element)
 *   Br      Em C G D          half-time drums and bass, long notes, a fill out
 * Form: Intro | A A' C C+ A A' Br C+ -> A (order 1). Loop body 8 patterns, 50.5 s.
 * Unauditioned: lint and loudness are checks, not listening.
 */
import { kit, prog, phrase, lane, stabs, bounce, figure, harmony, MAJOR, assemble, loopTo, writeSong } from './loopwright.kit.js';

const ROWS = 64;
const { samples, I } = kit(['lead', 'thin', 'stab', 'bass', 'kick', 'snare', 'hat', 'crash']);
const G = MAJOR('G');

const P = {
  A: prog(['G', 'Em', 'C', 'D']),
  A2: prog(['G', 'Em', ['C', 8], ['D', 8], 'G']),
  C: prog(['C', 'D', ['Bm', 8], ['Em', 8], ['Am', 8], ['D', 8]]),
  Br: prog(['Em', 'C', 'G', 'D']),
};

const VERSE = [
  [0, 'G-5', 2, 36], [2, 'A-5', 2, 38], [4, 'B-5', 2, 40], [6, 'D-6', 4, 46], [10, 'B-5', 2, 36], [12, 'D-6', 2, 38], [14, 'G-6', 2, 42],
  [16, 'E-6', 4, 42], [20, 'D-6', 2, 36], [22, 'B-5', 4, 38], [26, 'G-5', 2, 34], [28, 'B-5', 4, 38],
  [32, 'C-6', 2, 36], [34, 'D-6', 2, 38], [36, 'E-6', 2, 40], [38, 'G-6', 4, 46], [42, 'E-6', 2, 36], [44, 'G-6', 2, 38], [46, 'A-6', 2, 40],
  [48, 'F#6', 6, 44], [54, 'E-6', 2, 36], [56, 'D-6', 2, 36], [58, 'A-5', 4, 38],
];
const VERSE2 = [
  ...VERSE.filter(([r]) => r < 32),
  [32, 'C-6', 2, 36], [34, 'D-6', 2, 38], [36, 'E-6', 2, 40], [38, 'G-6', 2, 42], [40, 'F#6', 4, 42], [44, 'A-6', 4, 44],
  [48, 'G-6', 8, 46], [56, 'D-6', 2, 36], [58, 'B-5', 2, 34], [60, 'D-6', 2, 38], [62, 'E-6', 2, 40],
];
const CHORUS = [
  [0, 'E-6', 3, 42], [3, 'G-6', 3, 44], [6, 'C-7', 6, 50], [12, 'B-6', 2, 40], [14, 'A-6', 2, 40],
  [16, 'A-6', 6, 46], [22, 'F#6', 2, 38], [24, 'A-6', 2, 40], [26, 'D-6', 6, 42],
  [32, 'D-6', 3, 42], [35, 'F#6', 3, 44], [38, 'B-6', 2, 46], [40, 'G-6', 4, 44], [44, 'B-5', 4, 38],
  [48, 'C-6', 3, 42], [51, 'E-6', 3, 44], [54, 'A-6', 2, 46], [56, 'F#6', 8, 46],
];
const BRIDGE = [
  [0, 'B-5', 8, 40], [8, 'G-5', 4, 34], [12, 'B-5', 4, 36],
  [16, 'C-6', 8, 40], [24, 'E-6', 8, 42],
  [32, 'D-6', 8, 42], [40, 'B-5', 8, 38],
  [48, 'A-5', 6, 40], [54, 'C-6', 2, 34], [56, 'F#5', 8, 38],
];

const lead = (ev) => phrase(ev, I.lead, { rows: ROWS, vib: 'H42', name: 'lead' });
// A third under the held chorus notes on the thinner pulse: A6 under C7, F#6 under A6,
// D6 under the last F#6. Under the D6 of bar 2 a third (B5) rubbed the stab's A, so
// that one takes A5, a fourth below and a chord tone.
const harm = (ev) => phrase(harmony(ev, G, { minLen: 6, scale: 0.55 }).map((e) => (e[0] === 26 ? [26, 'A-5', ...e.slice(2)] : e)),
  I.thin, { rows: ROWS, sustain: 0.8, name: 'harm' });

const DRUMS = { k: [I.kick, 36], K: [I.kick, 26], s: [I.snare, 26] };
const FILL = { s: [I.snare, 24], S: [I.snare, 15] };
const beat = (fill) => lane('k...s...k.K.s...', DRUMS, { rows: ROWS, name: 'drums', fill: fill ? 'S.S.s.ss' : '' , fillMap: FILL });
const hats = (crash = false) => {
  const ch = lane('HhhhHhhhHhhhHhhh', { H: [I.hat, 13], h: [I.hat, 6] }, { rows: ROWS, name: 'hats' });
  if (crash) ch[0] = { note: 'C-5', instrument: I.crash, vol: 'v20' };
  return ch;
};

const LAYOUT = ['lead', 'harm', 'stab', 'bass', 'drums', 'hats'];
const PANS = [0x70, 0x98, 0xa0, 0x80, 0x80, 0x60];
const pat = (name, parts) => assemble(name, ROWS, LAYOUT, PANS, parts);
// In the verses the stab sits out under the motif's passing A (row 2), a second against its G.
const band = (p, { fill = false, crash = false, motif = false } = {}) => ({
  stab: stabs(p, I.stab, { rows: ROWS, skip: (r) => motif && r === 2 }), bass: bounce(p, I.bass, { rows: ROWS }), drums: beat(fill), hats: hats(crash),
});

const patterns = [
  pat('intro - on the line', { ...band(P.A, { fill: true }), stab: stabs(P.A, I.stab, { rows: ROWS, vol: 18 }) }),
  pat('A - verse', { lead: lead(VERSE), ...band(P.A, { crash: true, motif: true }) }),
  pat("A' - verse to chorus", { lead: lead(VERSE2), ...band(P.A2, { fill: true, motif: true }) }),
  pat('C - chorus', { lead: lead(CHORUS), ...band(P.C, { crash: true }) }),
  pat('C+ - chorus with harmony', { lead: lead(CHORUS), harm: harm(CHORUS), ...band(P.C) }),
  pat('Br - half time', {
    lead: lead(BRIDGE),
    stab: stabs(P.Br, I.stab, { rows: ROWS, rhythm: '......x.......x.', vol: 18 }),
    bass: figure(P.Br, I.bass, [[0, 'r', 12, 38], [12, 'o', 4, 22]], { rows: ROWS }),
    drums: lane('k.......s.......', DRUMS, { rows: ROWS, name: 'half', fill: 'S.S.s.ssS.s.ssss', fillMap: FILL }),
    hats: lane('..h...h...h...h.', { h: [I.hat, 9] }, { rows: ROWS, name: 'half hats' }),
  }),
];
// The last chorus is its own copy so the jump back to the verse only fires at the loop's end.
patterns.push({ ...structuredClone(patterns[4]), name: 'C+ - back to the verse' });
loopTo(patterns[6].channels, ROWS, 1);

writeSong(import.meta.url, {
  title: 'Tin Grand Prix', bpm: 152, ticks: 6, mixvol: 64,
  message: 'Tin Grand Prix - Loopwright race theme. G major, 152 BPM.\nThe wind-up motif as verse and augmented chorus.\nAll samples synthesized. Source: songs/loopwright_grand_prix.gen.js',
  samples,
  channelnames: LAYOUT,
  patterns,
  order: [0, 1, 2, 3, 4, 1, 2, 5, 6],
});
