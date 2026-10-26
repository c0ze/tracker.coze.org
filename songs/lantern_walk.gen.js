#!/usr/bin/env node
/**
 * Lantern Walk — an original, portable composition study.
 * G major, 118 BPM, speed 6: 4 rows/beat, 16 rows/bar, 64 rows/phrase.
 * Four voices: pulse lead, triangle bass, sparse harmony, shared chip drums.
 * Form A / A' / B / A'': related questions/answers, quieter contrasting middle,
 * then a tonic answer with a short breath into the first phrase.
 * This is a reasoned teaching example; perceptual quality needs listening.
 */
import { writeSong } from './lib.js';

const ROWS = 64;
const I = { lead: 0, bass: 1, harmony: 2, kick: 3, snare: 4, hat: 5 };

// Author duration with pitch. Refuse accidental overlaps instead of losing cuts.
function voice(events, instrument, sustain = 0.7) {
  const ch = {};
  const place = (row, ev) => {
    if (!Number.isInteger(row) || row < 0 || row >= ROWS || ch[row])
      throw new Error(`Voice event collision/outside pattern at row ${row}`);
    ch[row] = ev;
  };
  for (const [row, note, length, volume] of events) {
    if (!Number.isInteger(length) || length < 2) throw new Error('Write at least two rows per articulated note');
    place(row, { note, instrument, vol: `v${volume}` });
    // Lower the held level immediately: a looped pulse has no built-in envelope.
    place(row + 1, { vol: `v${Math.round(volume * sustain)}` });
    if (length > 3) place(row + length - 1, { vol: `v${Math.round(volume * 0.3)}` });
    place(row + length, { note: '^^' });
  }
  return ch;
}

// The recognizable cell is a short pickup, rising fourth, then a longer target.
// The answer retains that rhythm but turns downward. Rests are part of the hook.
const A = [
  [2, 'D-6', 3, 36], [6, 'G-6', 5, 42], [12, 'B-6', 2, 34],
  [16, 'A-6', 3, 36], [20, 'G-6', 6, 40], [28, 'E-6', 2, 31],
  [34, 'E-6', 3, 36], [38, 'G-6', 5, 39], [44, 'A-6', 2, 33],
  [48, 'F#6', 4, 37], [54, 'E-6', 2, 31], [58, 'D-6', 4, 35],
];
const answer = [
  ...A.filter(([r]) => r < 48),
  [48, 'B-6', 3, 37], [52, 'A-6', 2, 32], [56, 'G-6', 6, 39],
];
const B = [
  [0, 'E-6', 6, 34], [10, 'C-6', 4, 30],
  [18, 'D-6', 3, 31], [24, 'E-6', 6, 34],
  [34, 'D-6', 6, 33], [44, 'B-5', 2, 29],
  [48, 'A-5', 4, 31], [54, 'C-6', 2, 30], [58, 'D-6', 4, 35],
];
const finalAnswer = answer.map(e => [...e]);
// One changed pickup, not an automatic octave-up stack of the full arrangement.
finalAnswer[0] = [2, 'B-5', 3, 34];

const chords = {
  G: { bass: 'G-3', fifth: 'D-4', harmony: 'B-4', arp: 'J38' }, // B D G
  Em: { bass: 'E-3', fifth: 'B-3', harmony: 'B-4', arp: 'J58' }, // B E G
  C: { bass: 'C-3', fifth: 'G-3', harmony: 'C-5', arp: 'J47' },
  D: { bass: 'D-3', fifth: 'A-3', harmony: 'A-4', arp: 'J59' },  // A D F#
  Am: { bass: 'A-3', fifth: 'E-4', harmony: 'C-5', arp: 'J49' }, // C E A
};
function bass(progression, quiet) {
  return voice(progression.flatMap((name, b) => {
    const c = chords[name], r = 16 * b, v = quiet ? 32 : 40;
    return [[r, c.bass, 5, v], [r + 8, c.fifth, 3, v - 8], [r + 12, c.bass, 2, v - 5]];
  }), I.bass, 0.65);
}
function harmony(progression, quiet) {
  const ch = {};
  progression.forEach((name, b) => {
    const c = chords[name], r = b * 16;
    // Brief chord punctuation, then silence under the lead's main target.
    ch[r] = { note: c.harmony, instrument: I.harmony, vol: quiet ? 'v12' : 'v17', fx: c.arp };
    ch[r + 1] = { vol: quiet ? 'v08' : 'v11', fx: c.arp };
    ch[r + 2] = { note: '^^' };
  });
  return ch;
}
function drums(quiet, fill) {
  const ch = {};
  for (let r = 0; r < ROWS; r += 2) {
    const beat = r % 16;
    let inst = I.hat, vol = r % 4 === 0 ? 13 : 8;
    if (beat === 0 || beat === 10) { inst = I.kick; vol = quiet ? 22 : 32; }
    if (beat === 4 || beat === 12) { inst = I.snare; vol = quiet ? 12 : 22; }
    // A short middle-section dropout exposes the changed melodic shape.
    if (quiet && r < 16 && inst !== I.kick) continue;
    ch[r] = { note: 'C-5', instrument: inst, vol: `v${vol}` };
  }
  if (fill) ch[60] = { note: 'C-5', instrument: I.snare, vol: 'v12' };
  ch[63] = { note: '^^' }; // no percussion tail leaks into the loop's pickup
  return ch;
}
function pattern(name, melody, progression, { quiet = false, fill = false } = {}) {
  const channels = [voice(melody, I.lead), bass(progression, quiet), harmony(progression, quiet), drums(quiet, fill)];
  // Each pattern is safe to enter directly; bass/drums center, gentle upper spread.
  channels[0][0] = { vol: 'p28', ...(channels[0][0] ?? {}) };
  if (channels[0][0].note) channels[0][0].fx = 'X70';
  channels[1][0].fx = 'X80';
  channels[2][3] = { vol: 'p38' };
  channels[3][0].fx = 'X80';
  return { name, rows: ROWS, channels };
}

writeSong(import.meta.url, {
  title: 'Lantern Walk', bpm: 118, ticks: 6, mixvol: 80,
  message: 'Original composition study: G major, 4/4, A / A\' / B / A\'\'.\nFour voices; all samples synthesized. Source: songs/lantern_walk.gen.js.\nAudition before treating this as a finished score.',
  samples: [
    { name: 'pulse lead', synth: { wave: 'square', pulse: 0.25 } },
    { name: 'triangle bass', synth: { wave: 'triangle' } },
    { name: 'soft harmony', synth: { wave: 'triangle' } },
    { name: 'chip kick', synth: { wave: 'kick', seconds: 0.12, decay: 32, freqStart: 150, freqEnd: 48 } },
    { name: 'noise snare', synth: { wave: 'noise', seconds: 0.09, decay: 36, seed: 17 } },
    { name: 'noise hat', synth: { wave: 'noise', seconds: 0.025, decay: 90, seed: 29 } },
  ],
  channelnames: { 0: 'lead', 1: 'bass', 2: 'harmony', 3: 'drums' },
  patterns: [
    pattern('A - open question', A, ['G', 'Em', 'C', 'D']),
    pattern("A' - tonic answer", answer, ['G', 'Em', 'C', 'G'], { fill: true }),
    pattern('B - lower conversation', B, ['Am', 'C', 'G', 'D'], { quiet: true }),
    pattern("A'' - return and breath", finalAnswer, ['G', 'Em', 'C', 'G']),
  ],
  order: [0, 1, 2, 3],
});
