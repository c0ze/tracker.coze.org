#!/usr/bin/env node
/**
 * Loopwright — "Loopwright" (main theme: title, menus, results). 2026-09-29.
 * F major, 124 BPM, speed 6: 4 rows/beat, 16 rows/bar, 64 rows = 4 bars = 7.74 s.
 *
 * Identity: the wind-up motif as the hook's first gesture, C-D-E ratchet clicks
 * springing to a held F, then a skip down. The question ends on C over C (the
 * dominant); the answer turns through Gm7 and lands on F.
 * Studied: Peach Orchard (off-beat J stabs, octave-bounce bass, echo on cadences
 * only) and Lantern Walk (write the rests into the hook).
 *
 * Phrase map
 *   Intro  F Dm Bb C       clock ticks and a music-box arp; bass enters bar 3; snare pickup
 *   A      F Dm Bb C       the hook (question), open on the dominant
 *   A'     F Dm Gm7 C-F    same opening, the answer lands on the tonic
 *   A'e    A' plus a dotted-eighth echo of its cadence only (the new element)
 *   B      Bb C Am-Dm Gm-C lower, longer notes; clock ticks replace the hats, music box
 *                          returns under the held notes; snare fill back into A
 * Form: Intro | A A' A A'e B A'e -> back to A (order 1). Loop body 6 patterns, 46.5 s.
 * Clean lint and healthy RMS are not listening: audition before calling it finished.
 */
import { kit, prog, phrase, lane, stabs, bounce, arp, echoChannel, slice, assemble, loopTo, writeSong } from './loopwright.kit.js';

const ROWS = 64;
const { samples, I } = kit(['lead', 'box', 'stab', 'bass', 'kick', 'snare', 'hat', 'tick', 'tock', 'crash']);

const P = {
  A: prog(['F', 'Dm', 'Bb', 'C']),
  A2: prog(['F', 'Dm', 'Gm7', ['C', 8], ['F', 8]]),
  B: prog(['Bb', 'C', ['Am', 8], ['Dm', 8], ['Gm', 8], ['C', 8]]),
};

const HOOK = [
  [0, 'C-6', 2, 34], [2, 'D-6', 2, 36], [4, 'E-6', 2, 38], [6, 'F-6', 6, 44], [12, 'A-6', 2, 36], [14, 'G-6', 2, 34],
  [16, 'F-6', 4, 40], [20, 'D-6', 2, 34], [22, 'E-6', 2, 34], [24, 'F-6', 2, 36], [26, 'A-5', 6, 38],
  [32, 'A#5', 2, 34], [34, 'C-6', 2, 36], [36, 'D-6', 2, 38], [38, 'F-6', 6, 42], [44, 'D-6', 2, 34], [46, 'C-6', 2, 32],
  [48, 'C-6', 3, 36], [52, 'E-6', 2, 34], [54, 'D-6', 2, 32], [56, 'C-6', 6, 38],
];
const ANSWER = [
  ...HOOK.filter(([r]) => r < 32),
  [32, 'A#5', 2, 34], [34, 'C-6', 2, 36], [36, 'D-6', 2, 38], [38, 'G-6', 6, 42], [44, 'F-6', 2, 34], [46, 'E-6', 2, 32],
  [48, 'G-6', 4, 40], [52, 'E-6', 2, 34], [54, 'C-6', 2, 32], [56, 'F-6', 6, 42],
];
const BRIDGE = [
  [0, 'D-6', 6, 36], [8, 'F-6', 2, 30], [10, 'D-6', 4, 34], [14, 'A#5', 2, 28],
  [16, 'G-5', 6, 34], [24, 'A#5', 2, 30], [26, 'C-6', 4, 34],
  [32, 'C-6', 6, 36], [40, 'D-6', 4, 34], [44, 'F-6', 2, 32],
  [48, 'G-6', 6, 40], [56, 'E-6', 6, 36],
];

const lead = (ev) => phrase(ev, I.lead, { rows: ROWS, vib: 'H42', name: 'lead' });
// The cadence echo, an eighth late: G-E-C over C then the landing F. At 2 rows each echo
// sits a third, fourth or unison from the lead; 3 rows put E against the landing F.
const cadenceEcho = (ch) => echoChannel(slice(ch, 48, ROWS), { delay: 2, scale: 0.45, rows: ROWS });

// The stab sits out under the Bb bar's passing C clicks (rows 34 and 46).
const ratchet = (r) => r === 34 || r === 46;
const DRUMS = { k: [I.kick, 34], K: [I.kick, 24], s: [I.snare, 24], S: [I.snare, 16] };
const beat = (fill) => lane('k...s...k.K.s...', DRUMS, { rows: ROWS, name: 'drums', fill: fill ? 'S.S.s.ss' : '', fillMap: { s: [I.snare, 22], S: [I.snare, 14] } });
const hats = () => lane('h.H.h.H.h.H.h.H.', { h: [I.hat, 7], H: [I.hat, 12] }, { rows: ROWS, name: 'hats' });
const clock = (vol = 16) => lane('t...o...t...o...', { t: [I.tick, vol], o: [I.tock, Math.round(vol * 0.8)] }, { rows: ROWS, name: 'clock' });

const LAYOUT = ['lead', 'echo', 'box', 'stab', 'bass', 'drums', 'hats', 'clock'];
const PANS = [0x70, 0xa8, 0x98, 0x88, 0x80, 0x80, 0xa0, 0x60];
const pat = (name, parts) => assemble(name, ROWS, LAYOUT, PANS, parts);

const hookLead = lead(HOOK), answerLead = lead(ANSWER);
const introDrums = lane('................', {}, { rows: ROWS, fill: 's.s.ssss', fillMap: { s: [I.snare, 18] } });
const crashIn = (ch) => ({ ...ch, 0: { ...(ch[0] ?? {}), note: 'C-5', instrument: I.crash, vol: 'v16' } });

const patterns = [
  pat('intro - wind-up', {
    box: arp(P.A, I.box, { rows: ROWS, every: 2, vol: 22 }),
    bass: bounce(P.A.slice(2), I.bass, { rows: ROWS, vol: 32, soft: 18 }),
    drums: introDrums, clock: clock(18),
  }),
  pat('A - hook', { lead: hookLead, stab: stabs(P.A, I.stab, { rows: ROWS, skip: ratchet }), bass: bounce(P.A, I.bass, { rows: ROWS }), drums: beat(false), hats: crashIn(hats()) }),
  pat("A' - answer", { lead: answerLead, stab: stabs(P.A2, I.stab, { rows: ROWS, skip: ratchet }), bass: bounce(P.A2, I.bass, { rows: ROWS }), drums: beat(false), hats: hats() }),
  pat("A'e - answer with echo", { lead: answerLead, echo: cadenceEcho(answerLead), stab: stabs(P.A2, I.stab, { rows: ROWS, skip: ratchet }), bass: bounce(P.A2, I.bass, { rows: ROWS }), drums: beat(true), hats: hats() }),
  pat('B - bench talk', {
    lead: lead(BRIDGE),
    box: arp(P.B, I.box, { rows: ROWS, every: 4, order: [0, 2, 1, 3], vol: 16 }),
    stab: stabs(P.B, I.stab, { rows: ROWS, rhythm: '..x.............', vol: 16 }),
    bass: bounce(P.B, I.bass, { rows: ROWS, vol: 34, soft: 18 }),
    drums: lane('k.......s.......', DRUMS, { rows: ROWS, name: 'half', fill: 's.s.ssss', fillMap: { s: [I.snare, 20] } }),
    clock: clock(14),
  }),
];

// The last A'e is its own copy so the jump back to A only fires at the end of the loop.
patterns.push({ ...structuredClone(patterns[3]), name: "A'e - back to the top" });
loopTo(patterns[5].channels, ROWS, 1);
const order = [0, 1, 2, 1, 3, 4, 5];

writeSong(import.meta.url, {
  title: 'Loopwright', bpm: 124, ticks: 6, mixvol: 64,
  message: 'Loopwright - main theme. F major, 124 BPM.\nThe wind-up motif: C-D-E ratchet clicks spring to F.\nAll samples synthesized. Source: songs/loopwright_title.gen.js',
  samples,
  channelnames: LAYOUT,
  patterns,
  order,
});
