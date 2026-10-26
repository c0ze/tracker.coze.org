#!/usr/bin/env node
/**
 * Crypt Lanterns — Opus 5.5 batch. A torch-lit dungeon gallop in E minor.
 * Speed 4 at 138 BPM: one row = 72.5 ms, 6 rows = one dotted-quarter beat.
 * Read as 12/8: 24 rows/bar, 96-row patterns = 4 bars = 6.96 s. A long-short
 * gallop (4 + 2 rows) and the 3-eighth beat come directly from this grid.
 *
 * Borrowed from the Drozerix corpus (studied, not copied):
 * - Necromancer's Castle's gated hats: a long noise sample cut after two ticks
 *   (SC2), so the hat has body but no wash.
 * - October Chip's octave flicker (J0C = base, base, +12) as a stab on beats 2/4.
 * - War Path's choked, accented repetition in the bass under a sustained line.
 *
 * Harmony (harmonic minor with a phrygian turn):
 *   A  = Em  C  Am  B      lead climbs to E6, falls B A G F# to a held D#.
 *   A' = Em  F  Em  B|Em   the F major (bII) darkens the answer; lands on E.
 *   B  = Am  Em F   B      low, long lead notes answered one beat later.
 * Form: intro A A' A A' B A'. The final E minor falls into the intro's E minor.
 */
import { writeSong } from './lib.js';
import { phrase, hits, pan, rest, echoChannel } from './opus55.js';

const ROWS = 96, BAR = 24, BEAT = 6;
const I = { lead: 0, flicker: 1, bass: 2, kick: 3, snare: 4, hat: 5 };

const CH = {
  Em: { root: 'E-3', tones: ['G-4', 'B-4'] },
  C: { root: 'C-3', tones: ['G-4', 'C-5'] },
  Am: { root: 'A-2', tones: ['C-5', 'E-5'] },
  B: { root: 'B-2', tones: ['D#5', 'F#5'] },
  F: { root: 'F-3', tones: ['A-4', 'C-5'] },
};
const up = (n) => n.replace(/\d$/, (d) => String(+d + 1));
const P = {
  A: [['Em', 24], ['C', 24], ['Am', 24], ['B', 24]],
  A2: [['Em', 24], ['F', 24], ['Em', 24], ['B', 12], ['Em', 12]],
  B: [['Am', 24], ['Em', 24], ['F', 24], ['B', 24]],
};
const spans = (p) => { let r = 0; return p.map(([c, len]) => { const s = [c, r, len]; r += len; return s; }); };

const BAR1 = [[0, 'E-5', 4, 38], [4, 'G-5', 2, 32], [6, 'B-5', 6, 40], [12, 'A-5', 4, 34], [16, 'G-5', 2, 30], [18, 'F#5', 6, 36]];
const LEAD = {
  A: [
    ...BAR1,
    [24, 'G-5', 4, 36], [28, 'E-5', 2, 30], [30, 'C-6', 6, 40], [36, 'B-5', 4, 34], [40, 'G-5', 2, 30], [42, 'E-5', 4, 34],
    [48, 'A-5', 4, 36], [52, 'C-6', 2, 32], [54, 'E-6', 6, 42], [60, 'D-6', 4, 36], [64, 'C-6', 2, 32], [66, 'B-5', 4, 34],
    [72, 'B-5', 4, 36], [76, 'A-5', 2, 32], [78, 'G-5', 4, 34], [82, 'F#5', 2, 32], [84, 'D#5', 8, 38],
  ],
  A2: [
    ...BAR1,
    [24, 'A-5', 4, 36], [28, 'F-5', 2, 30], [30, 'C-6', 6, 40], [36, 'A-5', 4, 34], [40, 'G-5', 2, 30], [42, 'F-5', 4, 34],
    [48, 'G-5', 4, 36], [52, 'B-5', 2, 32], [54, 'E-6', 6, 42], [60, 'D#6', 4, 36], [64, 'E-6', 2, 32], [66, 'B-5', 4, 34],
    [72, 'A-5', 4, 36], [76, 'F#5', 2, 32], [78, 'D#5', 4, 34], [84, 'E-5', 8, 38],
  ],
  B: [
    [0, 'C-5', 10, 34], [12, 'E-5', 8, 32],
    [24, 'B-4', 10, 32], [36, 'G-4', 6, 30],
    [48, 'A-4', 10, 32], [60, 'C-5', 6, 32],
    [72, 'B-4', 6, 32], [78, 'D#5', 6, 34], [84, 'F#5', 8, 36],
  ],
};
// the saw lead is bright; scale its written dynamics down as a whole
const lead = (key) => phrase(LEAD[key].map(([r, n, l, v]) => [r, n, l, Math.round(v * 0.85)]), I.lead,
  { rows: ROWS, vib: 'H44', vibDelay: 3, name: 'lead' });

function flicker(key) {
  const ev = [];
  for (const [c, start, len] of spans(P[key])) {
    for (let b = start + BEAT; b < start + len; b += 2 * BEAT) { // beats 2 and 4
      ev.push([b, CH[c].tones[((b - start) / BEAT - 1) / 2 % 2], 3, 22, 'J0C']);
    }
  }
  return phrase(ev, I.flicker, { rows: ROWS, sustain: 0.55, name: 'flicker' });
}

function bass(key, { drone = false } = {}) {
  const ev = [];
  for (const [c, start, len] of spans(P[key])) {
    const root = CH[c].root;
    if (drone) { ev.push([start, root, len - 2, 34]); continue; }
    for (let b = start; b < start + len; b += BEAT) {
      const last = b + BEAT >= start + len && len === BAR;
      const note = last ? up(root) : root; // octave lift on the bar's last beat
      ev.push([b, note, 4, b === start ? 40 : 34], [b + 4, note, 2, 22]);
    }
  }
  return phrase(ev, I.bass, { rows: ROWS, sustain: 0.75, name: 'bass' });
}

function drums({ intro = false, sparse = false, fill = false } = {}) {
  const kit = [], hat = [];
  for (let bar = 0; bar < ROWS / BAR; bar++) {
    const s = bar * BAR;
    kit.push([s, I.kick, 36]);
    if (!sparse) {
      kit.push([s + 12, I.kick, 30]);
      if (!intro) kit.push([s + 6, I.snare, 26], [s + 18, I.snare, 28]);
    }
    for (let b = s; b < s + BAR; b += BEAT) {
      hat.push([b + 2, I.hat, sparse ? 7 : 12, 'SC2'], [b + 4, I.hat, sparse ? 5 : 8, 'SC2']);
    }
  }
  if (fill) { // gallop pickup into the next pattern
    const i = kit.findIndex(([r]) => r === 90);
    if (i >= 0) kit.splice(i, 1);
    kit.push([88, I.snare, 16], [90, I.snare, 22], [92, I.snare, 30]);
  }
  return [hits(kit, { rows: ROWS, name: 'kit' }), hits(hat, { rows: ROWS, name: 'hat' })];
}

// channels: 0 lead, 1 echo, 2 flicker, 3 bass, 4 kit, 5 hats
const PANS = [0x78, 0xa8, 0x50, 0x80, 0x80, 0xb0];
function pattern(name, parts) {
  const [kit, hat] = parts.drums;
  const channels = [parts.lead, parts.echo, parts.flicker, parts.bass, kit, hat].map((c) => c ?? rest());
  return { name, rows: ROWS, channels: channels.map((ch, i) => pan({ ...ch }, PANS[i])) };
}

const patterns = [
  pattern('intro - gallop', { flicker: flicker('A'), bass: bass('A'), drums: drums({ intro: true, fill: true }) }),
  pattern('A - the climb', { lead: lead('A'), flicker: flicker('A'), bass: bass('A'), drums: drums() }),
  pattern("A' - phrygian answer", { lead: lead('A2'), flicker: flicker('A2'), bass: bass('A2'), drums: drums({ fill: true }) }),
  // B: long notes answered a beat later (435 ms) — consonant because the line barely moves
  pattern('B - lower vault', { lead: lead('B'), echo: echoChannel(lead('B'), { delay: BEAT, scale: 0.4, rows: ROWS }), bass: bass('B', { drone: true }), drums: drums({ sparse: true, fill: true }) }),
];

writeSong(import.meta.url, {
  title: 'Crypt Lanterns', bpm: 138, ticks: 4, mixvol: 64,
  message: 'Crypt Lanterns - Opus 5.5 batch.\nE minor 12/8 gallop, speed 4. Gated hats, octave-flicker stabs, phrygian turn.\nAll samples synthesized. Source: songs/crypt_lanterns.gen.js',
  samples: [
    { name: 'saw lead', synth: { wave: 'saw' } },
    { name: 'flicker', synth: { wave: 'square', pulse: 0.5 } },
    { name: 'saw bass', synth: { wave: 'saw' } },
    { name: 'kick', synth: { wave: 'kick', seconds: 0.16, decay: 26, freqStart: 140, freqEnd: 42 } },
    { name: 'snare', synth: { wave: 'noise', seconds: 0.14, decay: 26, seed: 101 } },
    { name: 'gated hat', synth: { wave: 'noise', seconds: 0.25, decay: 12, seed: 202 } },
  ],
  channelnames: ['lead', 'echo', 'flicker', 'bass', 'kit', 'hats'],
  patterns,
  order: [0, 1, 2, 1, 2, 3, 2],
});
