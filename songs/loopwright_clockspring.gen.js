#!/usr/bin/env node
/**
 * Loopwright — "Clockspring Chase" (race, driving minor). 2026-09-29.
 * E minor, 158 BPM, speed 6: 4 rows/beat, 16 rows/bar, 64 rows = 4 bars = 6.08 s.
 *
 * The mainspring wound tight: the motif in E minor (E-F#-G to B) over a pumping
 * eighth-note bass, with a clock tick on every 16th standing in for hats, so the
 * whole cue sounds like an escapement running fast. The chorus lifts to C and D and
 * turns the V (B major, D#) into a deceptive step to C.
 * Studied: Siege Engine's warning (a riff plus drone plus arp all pushing the same
 * energy tires fast: here the stab rests in the breakdown and the ticks drop out in
 * the chorus) and War Path (short gates, tension before the return).
 *
 * Phrase map
 *   Intro   Em Em C B            bass pedal and ticks, stabs enter bar 3, fill
 *   A       Em C D B             the motif, a falling answer; D walks up to D# over B
 *   A'      Em C Am B            same opening, climbs to A6, pickup into the chorus
 *   C       C D Em-D C-B         long notes up to C7 and D7; hats replace the ticks
 *   A'e     A' with a 3-row echo on its last bar only (the new element)
 *   Br      Em Em C B            breakdown: half-time, bass pedal, motif fragments
 *                                and their echo; the stab rests
 *   C+      C with a third under the held notes
 * Form: Intro | A A' C A A'e Br C+ -> A (order 1). Loop body 7 patterns, 42.5 s.
 * Unauditioned: lint and loudness are checks, not listening.
 */
import { kit, prog, phrase, lane, stabs, figure, harmony, MINOR, echoChannel, slice, assemble, loopTo, writeSong } from './loopwright.kit.js';

const ROWS = 64;
const { samples, I } = kit(['lead', 'thin', 'stab', 'bass', 'kick', 'snare', 'hat', 'crash', 'tick']);
const E = MINOR('E');
E[E.indexOf(2)] = 3;  // harmonic minor for the written harmony: D# under B

const P = {
  intro: prog(['Em', 'Em', 'C', 'B']),
  A: prog(['Em', 'C', 'D', 'B']),
  A2: prog(['Em', 'C', 'Am', 'B']),
  C: prog(['C', 'D', ['Em', 8], ['D', 8], ['C', 8], ['B', 8]]),
  Br: prog(['Em', 'Em', 'C', 'B']),
};

const VERSE = [
  [0, 'E-6', 2, 38], [2, 'F#6', 2, 40], [4, 'G-6', 2, 42], [6, 'B-6', 4, 48], [10, 'A-6', 2, 38], [12, 'G-6', 2, 38], [14, 'F#6', 2, 36],
  [16, 'E-6', 6, 44], [22, 'G-6', 2, 38], [24, 'E-6', 2, 36], [26, 'C-6', 4, 40],
  [32, 'D-6', 2, 38], [34, 'E-6', 2, 40], [36, 'F#6', 2, 42], [38, 'A-6', 4, 46], [42, 'F#6', 2, 38], [44, 'E-6', 2, 36], [46, 'D-6', 2, 36],
  [48, 'D#6', 6, 44], [54, 'F#6', 2, 38], [56, 'B-5', 6, 40],
];
const VERSE2 = [
  ...VERSE.filter(([r]) => r < 32),
  [32, 'C-6', 2, 38], [34, 'D-6', 2, 40], [36, 'E-6', 2, 42], [38, 'A-6', 6, 48], [44, 'G-6', 2, 38], [46, 'E-6', 2, 36],
  [48, 'F#6', 4, 42], [52, 'D#6', 4, 40], [56, 'B-5', 4, 38], [60, 'D#6', 2, 38], [62, 'F#6', 2, 40],
];
const CHORUS = [
  [0, 'G-6', 6, 46], [6, 'E-6', 2, 38], [8, 'G-6', 2, 40], [10, 'C-7', 6, 50],
  [16, 'A-6', 6, 46], [22, 'F#6', 2, 38], [24, 'A-6', 2, 40], [26, 'D-7', 6, 50],
  [32, 'B-6', 6, 46], [38, 'G-6', 2, 40], [40, 'A-6', 6, 44], [46, 'F#6', 2, 38],
  [48, 'G-6', 6, 44], [54, 'E-6', 2, 38], [56, 'D#6', 8, 44],
];
const FRAGMENTS = [
  [0, 'E-6', 2, 38], [2, 'F#6', 2, 40], [4, 'G-6', 2, 42], [6, 'B-6', 8, 46],
  [32, 'C-6', 2, 38], [34, 'D-6', 2, 40], [36, 'E-6', 2, 42], [38, 'G-6', 4, 46],
  [48, 'F#6', 8, 42], [56, 'D#6', 8, 42],
];

const lead = (ev) => phrase(ev, I.lead, { rows: ROWS, vib: 'H43', name: 'lead' });
const harm = (ev) => phrase(harmony(ev, E, { minLen: 6, scale: 0.55 }), I.thin, { rows: ROWS, sustain: 0.8, name: 'harm' });
// Echo lands 3 rows late: F#-D#-B over B spell the chord, so every echo is a chord tone.
const tailEcho = (ch) => echoChannel(slice(ch, 48, 60), { delay: 3, scale: 0.45, rows: ROWS });
const fragEcho = (ch) => echoChannel(ch, { delay: 6, scale: 0.4, rows: ROWS });

// Pumping eighths: every eighth the root, accented on the beat, the octave on the last.
const PUMP = [[0, 'r', 2, 40], [2, 'r', 2, 24], [4, 'r', 2, 34], [6, 'r', 2, 24], [8, 'r', 2, 38], [10, 'r', 2, 24], [12, 'r', 2, 34], [14, 'o', 2, 26]];
const pump = (p) => figure(p, I.bass, PUMP, { rows: ROWS, sustain: 0.6 });
const pedal = (p) => figure(p, I.bass, [[0, 'r', 6, 38], [6, 'r', 2, 22], [8, 'r', 6, 34], [14, 'o', 2, 22]], { rows: ROWS });

const DRUMS = { k: [I.kick, 36], K: [I.kick, 26], s: [I.snare, 26] };
const FILL = { s: [I.snare, 24], S: [I.snare, 15] };
const beat = (fill) => lane('k...s..Kk.K.s...', DRUMS, { rows: ROWS, name: 'drums', fill: fill ? 'S.SSs.ss' : '', fillMap: FILL });
const ticks = (vol = 11) => lane('TttoTttoTttoTtto', { T: [I.tick, vol + 5], t: [I.tick, vol - 3], o: [I.tick, vol] }, { rows: ROWS, name: 'ticks' });
const hats = (crash = false) => {
  const ch = lane('H.h.H.h.H.h.H.h.', { H: [I.hat, 13], h: [I.hat, 8] }, { rows: ROWS, name: 'hats' });
  if (crash) ch[0] = { note: 'C-5', instrument: I.crash, vol: 'v20' };
  return ch;
};

const LAYOUT = ['lead', 'harm', 'stab', 'bass', 'drums', 'hats'];
const PANS = [0x70, 0x98, 0xa0, 0x80, 0x80, 0x60];
const pat = (name, parts) => assemble(name, ROWS, LAYOUT, PANS, parts);
// The stab sits out under the motif's passing F# (row 2) in the verses.
const verseBand = (p, fill) => ({ stab: stabs(p, I.stab, { rows: ROWS, skip: (r) => r === 2 }), bass: pump(p), drums: beat(fill), hats: ticks() });

const patterns = [
  pat('intro - winding', {
    stab: stabs(P.intro, I.stab, { rows: ROWS, vol: 18, skip: (r) => r < 32 }),
    bass: pedal(P.intro), drums: lane('k.......k.......', DRUMS, { rows: ROWS, name: 'intro kick', fill: 'S.S.s.ssS.s.ssss', fillMap: FILL }), hats: ticks(9),
  }),
  pat('A - verse', { lead: lead(VERSE), ...verseBand(P.A, false) }),
  pat("A' - verse to chorus", { lead: lead(VERSE2), ...verseBand(P.A2, true) }),
  pat('C - chorus', { lead: lead(CHORUS), stab: stabs(P.C, I.stab, { rows: ROWS }), bass: pump(P.C), drums: beat(false), hats: hats(true) }),
  pat("A'e - verse with echo", { lead: lead(VERSE2), harm: tailEcho(lead(VERSE2)), ...verseBand(P.A2, true) }),
  pat('Br - breakdown', {
    lead: lead(FRAGMENTS), harm: fragEcho(lead(FRAGMENTS)),
    bass: pedal(P.Br), drums: lane('k.......s.......', DRUMS, { rows: ROWS, name: 'half', fill: 'S.S.s.ssS.s.ssss', fillMap: FILL }), hats: ticks(8),
  }),
  pat('C+ - chorus with harmony', { lead: lead(CHORUS), harm: harm(CHORUS), stab: stabs(P.C, I.stab, { rows: ROWS }), bass: pump(P.C), drums: beat(false), hats: hats(true) }),
];
loopTo(patterns[6].channels, ROWS, 1);

writeSong(import.meta.url, {
  title: 'Clockspring Chase', bpm: 158, ticks: 6, mixvol: 64,
  message: 'Clockspring Chase - Loopwright race theme. E minor, 158 BPM.\nPumping bass, 16th clock ticks, the wind-up motif in minor.\nAll samples synthesized. Source: songs/loopwright_clockspring.gen.js',
  samples,
  channelnames: LAYOUT,
  patterns,
  order: [0, 1, 2, 3, 1, 4, 5, 6],
});
