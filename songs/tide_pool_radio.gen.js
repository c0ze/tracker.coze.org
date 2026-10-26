#!/usr/bin/env node
/**
 * Tide Pool Radio — Opus 5.5 batch. Unhurried D dorian, late-afternoon loop.
 * 96 BPM, speed 6: 4 rows/beat, 16 rows/bar, 64 rows = 4 bars = 10 s.
 *
 * Borrowed from the Drozerix corpus (studied, not copied):
 * - October Chip's auto-panned broken chord: the volume column carries a pan
 *   sweep instead of volume, so the arp drifts left-right across each bar and
 *   back across the next. Its level comes from the sample's default volume.
 * - Vibrato only on held rows, entering a few rows after the attack.
 * - Portamento used as a bass gesture on selected approach notes, not everywhere.
 *
 * Harmony: A = Dm7 G Dm7 Am7 (dorian B natural over G), A' = Bbmaj7 C Am7 Dm,
 * B = Gm7 Am7 Bbmaj7 C. A low guide-tone pad moves by step or holds a common
 * tone: C B C C / D E E F / D C D E.
 * The lead's cell is a pickup F into a held A; A' keeps it over Bbmaj7, where
 * the same A becomes a major seventh.
 */
import { writeSong } from './lib.js';
import { phrase, hits, pan, rest, slice, echoChannel } from './opus55.js';

const ROWS = 64;
const I = { lead: 0, arp: 1, pad: 2, bass: 3, kick: 4, rim: 5, shaker: 6 };

const CH = {
  Dm7: { root: 'D-3', arp: ['D-5', 'F-5', 'A-5', 'C-6', 'D-6'] },
  Dm: { root: 'D-3', arp: ['D-5', 'F-5', 'A-5', 'D-6', 'F-6'] },
  G: { root: 'G-3', arp: ['G-4', 'B-4', 'D-5', 'G-5', 'B-5'] },
  Am7: { root: 'A-3', arp: ['A-4', 'C-5', 'E-5', 'G-5', 'A-5'] },
  Bbmaj7: { root: 'A#3', arp: ['A#4', 'D-5', 'F-5', 'A-5', 'A#5'] },
  C: { root: 'C-4', arp: ['C-5', 'E-5', 'G-5', 'C-6', 'E-6'] },
  Gm7: { root: 'G-3', arp: ['G-4', 'A#4', 'D-5', 'F-5', 'G-5'] },
};
const P = {
  A: ['Dm7', 'G', 'Dm7', 'Am7'],
  A2: ['Bbmaj7', 'C', 'Am7', 'Dm'],
  B: ['Gm7', 'Am7', 'Bbmaj7', 'C'],
};
// Guide tones sit below the arp's register (G4 and up): an A4 pad under an
// A#4 arp note made a same-octave semitone.
const GUIDE = { A: ['C-4', 'B-3', 'C-4', 'C-4'], A2: ['D-4', 'E-4', 'E-4', 'F-4'], B: ['D-4', 'C-4', 'D-4', 'E-4'] };
// bass approach into the next bar: [note, glide?]. Roots sit in D-3..C-4 (73-131 Hz).
const APPROACH = {
  A: [['F-3', true], ['E-3', false], ['G-3', false], ['C-4', false]],
  A2: [['B-3', true], ['G-3', false], ['E-3', false], ['F-3', true]],
  B: [['A#3', true], ['C-4', false], ['B-3', true], ['D-4', true]], // D-4 falls an octave into Dm7
};

const LEAD = {
  A: [
    [2, 'F-5', 2, 34], [4, 'A-5', 8, 40], [14, 'G-5', 2, 30],
    [16, 'B-5', 6, 38], [24, 'A-5', 2, 32], [26, 'G-5', 4, 34],
    [34, 'F-5', 2, 32], [36, 'A-5', 4, 36], [40, 'D-6', 6, 40], [46, 'C-6', 2, 32],
    [48, 'C-6', 4, 36], [52, 'A-5', 2, 32], [54, 'G-5', 2, 32], [56, 'E-5', 6, 36],
  ],
  A2: [
    [2, 'F-5', 2, 34], [4, 'A-5', 8, 40], [14, 'G-5', 2, 30],
    [16, 'G-5', 6, 38], [24, 'E-5', 2, 32], [26, 'C-6', 4, 36],
    [32, 'C-6', 4, 36], [36, 'B-5', 2, 30], [38, 'A-5', 6, 38], [46, 'G-5', 2, 30],
    [48, 'F-5', 4, 36], [52, 'E-5', 2, 32], [54, 'D-5', 8, 38],
  ],
  B: [
    [0, 'D-6', 8, 36], [10, 'A#5', 4, 32],
    [16, 'C-6', 8, 36], [26, 'A-5', 4, 32],
    [32, 'D-6', 6, 36], [40, 'F-6', 6, 40],
    [48, 'E-6', 6, 38], [56, 'C-6', 4, 34],
  ],
};

const lead = (key) => phrase(LEAD[key], I.lead, { rows: ROWS, vib: 'H32', vibDelay: 3, sustain: 0.8, name: 'lead' });

function sweepArp(key) {
  const ch = {};
  const shape = [0, 1, 2, 3, 4, 3, 2, 1];
  P[key].forEach((c, bar) => {
    for (let i = 0; i < 16; i++) {
      const r = bar * 16 + i;
      const t = bar % 2 ? 1 - i / 15 : i / 15; // left->right, then right->left
      ch[r] = { note: CH[c].arp[shape[i % 8]], instrument: I.arp, vol: `p${Math.round(8 + 48 * t)}` };
    }
  });
  ch[ROWS - 1] = { note: '^^' };
  return ch;
}

function pad(key) {
  // slow swell: a sine has no envelope of its own
  const ch = {};
  GUIDE[key].forEach((note, bar) => {
    const r = bar * 16;
    Object.assign(ch, {
      [r]: { note, instrument: I.pad, vol: 'v06' }, [r + 1]: { vol: 'v10' }, [r + 2]: { vol: 'v13' },
      [r + 12]: { vol: 'v09' }, [r + 13]: { vol: 'v05' }, [r + 14]: { note: '^^' },
    });
  });
  return ch;
}

function bass(key) {
  const ch = {};
  P[key].forEach((c, bar) => {
    const r = bar * 16;
    const [target, glide] = APPROACH[key][bar];
    Object.assign(ch, {
      [r]: { note: CH[c].root, instrument: I.bass, vol: 'v38' }, [r + 1]: { vol: 'v30' }, [r + 10]: { vol: 'v22' },
      // a glide keeps the sounding note and bends into the approach tone
      [r + 12]: glide ? { note: target, vol: 'v26', fx: 'G10' } : { note: target, instrument: I.bass, vol: 'v28' },
      [r + 13]: glide ? { fx: 'G10' } : { vol: 'v22' },
      [r + 15]: { vol: 'v14' },
    });
  });
  ch[ROWS - 1] = { ...ch[ROWS - 1], note: '^^' };
  delete ch[ROWS - 1].vol;
  return ch;
}

function drums({ light = false } = {}) {
  const list = [];
  for (let r = 0; r < ROWS; r += 2) {
    const b = r % 16;
    if (b === 0 || b === 10) list.push([r, I.kick, light ? 16 : 26]);
    else if (b === 8 && !light) list.push([r, I.rim, 20]);
    else list.push([r, I.shaker, r % 4 === 2 ? 10 : 6]);
  }
  return hits(list, { rows: ROWS, name: 'drums' });
}

// channels: 0 lead, 1 echo, 2 arp, 3 pad, 4 bass, 5 drums
const PANS = [0x68, 0xa0, null, 0x90, 0x80, 0x80];
function pattern(name, parts) {
  const channels = [parts.lead, parts.echo, parts.arp, parts.pad, parts.bass, parts.drums].map((c) => c ?? rest());
  return { name, rows: ROWS, channels: channels.map((ch, i) => (PANS[i] === null ? ch : pan({ ...ch }, PANS[i]))) };
}
// Echo of the settled final bar only, 6 rows (940 ms) late: its F lands a third
// over the held D. A one-beat delay put F against the lead's E.
const tailEcho = (ch) => echoChannel(slice(ch, 48, ROWS), { delay: 6, scale: 0.3, rows: ROWS });

const patterns = [
  pattern('intro - sweep and bass', { arp: sweepArp('A'), bass: bass('A') }),
  pattern('A - question', { lead: lead('A'), arp: sweepArp('A'), bass: bass('A'), drums: drums() }),
  pattern("A' - answer", { lead: lead('A2'), arp: sweepArp('A2'), bass: bass('A2'), drums: drums() }),
  pattern('B - low tide', { lead: lead('B'), arp: sweepArp('B'), pad: pad('B'), bass: bass('B'), drums: drums({ light: true }) }),
  pattern('A - with guide tones', { lead: lead('A'), arp: sweepArp('A'), pad: pad('A'), bass: bass('A'), drums: drums() }),
  pattern("A' - answer, echoed close", { lead: lead('A2'), echo: tailEcho(lead('A2')), arp: sweepArp('A2'), pad: pad('A2'), bass: bass('A2'), drums: drums() }),
];

writeSong(import.meta.url, {
  title: 'Tide Pool Radio', bpm: 96, ticks: 6, mixvol: 64,
  message: 'Tide Pool Radio - Opus 5.5 batch.\nD dorian, 96 BPM. Auto-panned arp sweep, guide-tone pad, gliding bass.\nAll samples synthesized. Source: songs/tide_pool_radio.gen.js',
  samples: [
    { name: 'triangle lead', synth: { wave: 'triangle' } },
    { name: 'sweep arp', synth: { wave: 'square', pulse: 0.25 }, volume: 13 },
    { name: 'sine pad', synth: { wave: 'sine' } },
    { name: 'triangle bass', synth: { wave: 'triangle' } },
    { name: 'soft kick', synth: { wave: 'kick', seconds: 0.18, decay: 22, freqStart: 120, freqEnd: 45 } },
    { name: 'rim', synth: { wave: 'noise', seconds: 0.05, decay: 70, seed: 41 } },
    { name: 'shaker', synth: { wave: 'noise', seconds: 0.04, decay: 80, seed: 77 } },
  ],
  channelnames: ['lead', 'echo', 'sweep arp', 'pad', 'bass', 'drums'],
  patterns,
  order: [0, 1, 2, 3, 4, 5],
});
