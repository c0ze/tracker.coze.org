#!/usr/bin/env node
/**
 * Skyline Relay — Opus 5.5 batch. A rooftop chase in G minor.
 * 150 BPM, speed 6: 4 rows/beat, 16 rows/bar, 64 rows = 4 bars = 6.4 s.
 *
 * Borrowed from the Drozerix corpus (studied, not copied):
 * - Silicon Dancer / Peachy Chip octave-bounce bass on straight eighths.
 * - Off-beat one-row J-arpeggio stabs: harmony as rhythm, not sustain.
 * - 16th hats with a strong/weak accent pattern instead of equal hits.
 * - War Path's late pickup (snare fill) preparing each section.
 *
 * Phrase map
 *   Verse   Gm Eb Bb F   syncopated climb G-Bb-D, peak Bb6 over Bb, open on F.
 *   Verse'  same, but the last bar rises A-C-D into the chorus.
 *   Chorus  Eb F Gm D    starts a sixth higher, ends on the leading tone F#.
 *   Bridge  Cm Gm Eb D   half-time drums and bass, long lead notes.
 * The second chorus adds one written harmony voice under the held notes only;
 * it is the single new element, not a louder/higher/busier stack of everything.
 * Form: intro V V' C C+harmony bridge C+harmony; D falls back into the Gm intro.
 */
import { writeSong } from './lib.js';
import { phrase, hits, pan, rest } from './opus55.js';

const ROWS = 64;
const I = { lead: 0, harm: 1, stab: 2, bass: 3, kick: 4, snare: 5, hat: 6, crash: 7 };

const CH = {
  Gm: { root: 'G-3', stab: ['G-4', 'J37'] },  // G Bb D
  Eb: { root: 'D#3', stab: ['G-4', 'J38'] },  // G Bb Eb
  Bb: { root: 'A#3', stab: ['F-4', 'J59'] },  // F Bb D
  F: { root: 'F-3', stab: ['F-4', 'J47'] },   // F A C
  Cm: { root: 'C-4', stab: ['G-4', 'J58'] },  // G C Eb
  D: { root: 'D-3', stab: ['F#4', 'J38'] },   // F# A D
};
const up = (n) => n.replace(/\d$/, (d) => String(+d + 1));
const P = { V: ['Gm', 'Eb', 'Bb', 'F'], C: ['Eb', 'F', 'Gm', 'D'], BR: ['Cm', 'Gm', 'Eb', 'D'] };

const VERSE = [
  [0, 'G-5', 2, 36], [2, 'A#5', 2, 34], [4, 'D-6', 4, 40], [10, 'C-6', 2, 32], [12, 'A#5', 4, 36],
  [16, 'G-5', 6, 38], [22, 'A#5', 2, 32], [24, 'D#6', 4, 38], [28, 'D-6', 4, 34],
  [32, 'D-6', 2, 36], [34, 'F-6', 2, 36], [36, 'A#6', 6, 42], [42, 'A-6', 2, 34], [44, 'F-6', 4, 36],
  [48, 'C-6', 6, 38], [54, 'A-5', 2, 32], [56, 'F-5', 6, 36],
];
const VERSE2 = [...VERSE.filter(([r]) => r < 48), [48, 'A-5', 4, 36], [52, 'C-6', 4, 36], [56, 'D-6', 6, 40]];
const CHORUS = [
  [0, 'A#5', 2, 36], [2, 'D#6', 6, 42], [10, 'D-6', 2, 34], [12, 'D#6', 2, 34], [14, 'F-6', 2, 36],
  [16, 'F-6', 4, 40], [20, 'D#6', 2, 34], [22, 'D-6', 2, 34], [24, 'C-6', 6, 38],
  [32, 'D-6', 6, 40], [38, 'A#5', 2, 34], [40, 'G-5', 4, 36], [44, 'A#5', 2, 32], [46, 'C-6', 2, 34],
  [48, 'D-6', 4, 38], [52, 'C-6', 2, 34], [54, 'A-5', 2, 32], [56, 'F#5', 6, 38],
];
// Harmony under the chorus's held notes only: chord tones a third to a sixth below.
const HARMONY = [
  [2, 'G-5', 6, 24], [16, 'A-5', 4, 24], [24, 'A-5', 6, 24],
  [32, 'A#5', 6, 26], [40, 'D-5', 4, 22], [48, 'A-5', 4, 24], [56, 'D-5', 6, 24],
];
const BRIDGE = [
  [0, 'C-6', 8, 36], [10, 'D#6', 4, 34], [16, 'D-6', 12, 38],
  [32, 'A#5', 8, 34], [42, 'G-5', 4, 32], [48, 'F#5', 6, 34], [56, 'A-5', 6, 36],
];

const line = (events, inst, name) => phrase(events, inst, { rows: ROWS, vib: 'H43', vibDelay: 3, name });

function stabs(key, vol) {
  const ev = [];
  P[key].forEach((c, bar) => {
    for (const off of [2, 6, 10, 14]) ev.push([bar * 16 + off, ...CH[c].stab.slice(0, 1), 1, vol, CH[c].stab[1]]);
  });
  return phrase(ev, I.stab, { rows: ROWS, name: 'stab' });
}

function bass(key, { half = false } = {}) {
  const ev = [];
  P[key].forEach((c, bar) => {
    const r = bar * 16, root = CH[c].root;
    if (half) { ev.push([r, root, 8, 38], [r + 8, root, 6, 30], [r + 14, up(root), 2, 24]); return; }
    for (let i = 0; i < 16; i += 2) ev.push([r + i, i % 4 ? up(root) : root, 2, i % 4 ? 24 : 40]);
  });
  return phrase(ev, I.bass, { rows: ROWS, sustain: 0.7, name: 'bass' });
}

function kit({ intro = false, chorus = false, half = false, fill = true } = {}) {
  const list = [];
  for (let bar = 0; bar < 4; bar++) {
    const r = bar * 16;
    if (intro && bar < 2) continue;
    if (half) { list.push([r, I.kick, 34], [r + 8, I.snare, 26]); continue; }
    list.push([r, I.kick, 36], [r + 4, I.snare, 28], [r + 8, I.kick, 32], [r + 12, I.snare, 30]);
    list.push([r + (chorus ? 7 : 10), I.kick, 24]);
    if (chorus) list.push([r + 14, I.kick, 22]);
  }
  if (fill) { // snare pickup over the last beat
    for (const x of [60, 62]) { const i = list.findIndex(([row]) => row === x); if (i >= 0) list.splice(i, 1); }
    list.push([60, I.snare, 18], [61, I.snare, 22], [62, I.snare, 26], [63, I.snare, 30]);
  }
  return hits(list, { rows: ROWS, name: 'kit' });
}

function hats({ crash = false, eighths = false } = {}) {
  const list = [];
  const accent = [11, 4, 7, 4];
  for (let r = 0; r < ROWS; r += eighths ? 2 : 1) list.push([r, I.hat, eighths ? (r % 4 ? 5 : 8) : accent[r % 4]]);
  if (crash) list[0] = [0, I.crash, 24];
  return hits(list, { rows: ROWS, name: 'hats' });
}

// channels: 0 lead, 1 harmony, 2 stab, 3 bass, 4 kit, 5 hats
const PANS = [0x70, 0x98, 0xa0, 0x80, 0x80, 0x60];
function pattern(name, parts) {
  const channels = [parts.lead, parts.harm, parts.stab, parts.bass, parts.kit, parts.hats].map((c) => c ?? rest());
  return { name, rows: ROWS, channels: channels.map((ch, i) => pan({ ...ch }, PANS[i])) };
}

const patterns = [
  pattern('intro - engine start', { stab: stabs('V', 14), bass: bass('V'), kit: kit({ intro: true }), hats: hats({ eighths: true }) }),
  pattern('verse', { lead: line(VERSE, I.lead, 'verse'), stab: stabs('V', 16), bass: bass('V'), kit: kit({ fill: false }), hats: hats() }),
  pattern("verse' - lift", { lead: line(VERSE2, I.lead, 'verse2'), stab: stabs('V', 16), bass: bass('V'), kit: kit(), hats: hats() }),
  pattern('chorus', { lead: line(CHORUS, I.lead, 'chorus'), stab: stabs('C', 20), bass: bass('C'), kit: kit({ chorus: true, fill: false }), hats: hats({ crash: true }) }),
  pattern('chorus + harmony', { lead: line(CHORUS, I.lead, 'chorus'), harm: line(HARMONY, I.harm, 'harmony'), stab: stabs('C', 20), bass: bass('C'), kit: kit({ chorus: true }), hats: hats({ crash: true }) }),
  pattern('bridge - half time', { lead: line(BRIDGE, I.lead, 'bridge'), stab: stabs('BR', 12), bass: bass('BR', { half: true }), kit: kit({ half: true }), hats: hats({ eighths: true }) }),
];

writeSong(import.meta.url, {
  title: 'Skyline Relay', bpm: 150, ticks: 6, mixvol: 60,
  message: 'Skyline Relay - Opus 5.5 batch.\nG minor, 150 BPM. Octave bass, off-beat stabs, harmonised final chorus.\nAll samples synthesized. Source: songs/skyline_relay.gen.js',
  samples: [
    { name: 'pulse lead', synth: { wave: 'square', pulse: 0.25 } },
    { name: 'pulse harmony', synth: { wave: 'square', pulse: 0.25 } },
    { name: 'stab', synth: { wave: 'square', pulse: 0.125 } },
    { name: 'triangle bass', synth: { wave: 'triangle' } },
    { name: 'kick', synth: { wave: 'kick', seconds: 0.13, decay: 30, freqStart: 170, freqEnd: 50 } },
    { name: 'snare', synth: { wave: 'noise', seconds: 0.11, decay: 32, seed: 303 } },
    { name: 'hat', synth: { wave: 'noise', seconds: 0.025, decay: 120, seed: 404 } },
    { name: 'crash', synth: { wave: 'noise', seconds: 0.7, decay: 5, seed: 505 } },
  ],
  channelnames: ['lead', 'harmony', 'stab', 'bass', 'kit', 'hats'],
  patterns,
  order: [0, 1, 2, 3, 4, 5, 4],
});
