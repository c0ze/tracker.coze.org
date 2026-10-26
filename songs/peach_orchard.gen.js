#!/usr/bin/env node
/**
 * Peach Orchard — Opus 5.5 batch. Bright chip-pop in A major.
 * 132 BPM, speed 6: 4 rows/beat, 16 rows/bar, 64 rows = 4 bars = 7.27 s.
 *
 * Borrowed from the Drozerix corpus (studied, not copied):
 * - Peachy Chip's canon shimmer: one broken chord on three channels, each a row
 *   later and quieter. Used in the intro and breakdown only, never under the hook.
 * - Pulsing J-arpeggio chord stabs on the off-beats with a short volume envelope.
 * - Octave-bounce bass with loud downbeats and soft off-beats.
 * - A dotted-eighth (3-row, 340 ms) echo, applied to phrase endings only.
 *
 * Phrase map (A): I  vi  IV  V  — hook rises C#-E-F#, peaks on A6 over D,
 * ends open on B over E. A': same opening, answer turns down and lands on A.
 * B: IV V iii-vi ii-V, half-time lead, drums thin, shimmer returns.
 * Form: intro A A' A A'(echo) B A'(echo). The shimmer never plays under the
 * hook: a delayed canon against the lead produced constant seconds.
 */
import { writeSong } from './lib.js';
import { phrase, hits, pan, slice, rest, echoChannel } from './opus55.js';

const ROWS = 64;
const I = { lead: 0, shimmer: 1, stab: 2, bass: 3, kick: 4, snare: 5, hat: 6 };

// Chord tables: stab = base note + J offsets kept in the A4-C#5 band for
// common-tone voice leading; arp = broken chord for the shimmer.
const CH = {
  A:   { root: 'A-3', stab: ['A-4', 'J47'], arp: ['A-5', 'C#6', 'E-6', 'A-6'] },
  'F#m': { root: 'F#3', stab: ['F#4', 'J37'], arp: ['F#5', 'A-5', 'C#6', 'F#6'] },
  D:   { root: 'D-3', stab: ['A-4', 'J59'], arp: ['D-5', 'F#5', 'A-5', 'D-6'] },
  E:   { root: 'E-3', stab: ['G#4', 'J38'], arp: ['E-5', 'G#5', 'B-5', 'E-6'] },
  'C#m': { root: 'C#3', stab: ['G#4', 'J58'], arp: ['C#5', 'E-5', 'G#5', 'C#6'] },
  Bm:  { root: 'B-2', stab: ['F#4', 'J58'], arp: ['B-4', 'D-5', 'F#5', 'B-5'] },
};
const up = (n) => n.replace(/\d$/, (d) => String(+d + 1));

// progression as [chord, lengthInRows]
const prog = (...xs) => xs.map((x) => (Array.isArray(x) ? x : [x, 16]));
const P = {
  A: prog('A', 'F#m', 'D', 'E'),
  A2: prog('A', 'F#m', ['D', 8], ['E', 8], 'A'),
  B: prog('D', 'E', ['C#m', 8], ['F#m', 8], ['Bm', 8], ['E', 8]),
};
const spans = (p) => { let r = 0; return p.map(([c, len]) => { const s = [c, r, len]; r += len; return s; }); };

const HOOK = [
  [0, 'C#6', 3, 38], [4, 'E-6', 2, 34], [6, 'F#6', 4, 40], [12, 'E-6', 2, 32], [14, 'C#6', 2, 30],
  [16, 'A-5', 6, 38], [24, 'B-5', 2, 30], [26, 'C#6', 4, 36],
  [32, 'D-6', 3, 38], [36, 'F#6', 2, 34], [38, 'A-6', 6, 42], [46, 'F#6', 2, 32],
  [48, 'E-6', 4, 38], [52, 'D-6', 2, 32], [54, 'C#6', 2, 32], [56, 'B-5', 6, 38],
];
const ANSWER = [
  ...HOOK.filter(([r]) => r < 32),
  [32, 'F#6', 3, 38], [36, 'E-6', 2, 34], [38, 'D-6', 2, 34], [40, 'B-5', 4, 36], [44, 'C#6', 2, 32], [46, 'D-6', 2, 34],
  [48, 'E-6', 2, 36], [50, 'C#6', 2, 34], [52, 'A-5', 8, 40],
];
const BRIDGE = [
  [0, 'F#6', 6, 36], [8, 'E-6', 2, 30], [10, 'D-6', 4, 34],
  [16, 'B-5', 6, 34], [24, 'G#5', 4, 30], [28, 'B-5', 2, 30],
  [32, 'C#6', 6, 36], [40, 'A-5', 6, 32],
  [48, 'B-5', 4, 34], [52, 'D-6', 2, 32], [56, 'E-6', 6, 38],
];

const lead = (events) => phrase(events, I.lead, { rows: ROWS, vib: 'H42', name: 'lead' });

function shimmerLine(p, vol) {
  // one note per row cycling up the chord; voices are delayed copies of this line
  const ch = {};
  for (const [c, start, len] of spans(p)) {
    for (let r = start; r < start + len; r++) {
      ch[r] = { note: CH[c].arp[(r - start) % 4], instrument: I.shimmer, vol: `v${vol}` };
    }
  }
  ch[ROWS - 1] = { note: '^^' };
  return ch;
}
function shimmer(p, voices) {
  // voices: [delay, scale] pairs over the base line (Peachy Chip canon)
  return voices.map(([delay, scale]) => {
    const line = echoChannel(shimmerLine(p, 20), { delay, scale, rows: ROWS });
    line[ROWS - 1] = { note: '^^' };
    return line;
  });
}

function stabs(p, { quiet = false } = {}) {
  const ev = [];
  for (const [c, start, len] of spans(p)) {
    const [note, fx] = CH[c].stab;
    // no stab on the final off-beat: it would ring across the loop seam
    for (let r = start + 2; r < start + len && r + 2 < ROWS; r += 4) ev.push([r, note, 2, quiet ? 16 : 24, fx]);
  }
  return phrase(ev, I.stab, { rows: ROWS, sustain: 0.45, name: 'stab' });
}

function bass(p, { halfTime = false } = {}) {
  const ev = [];
  for (const [c, start, len] of spans(p)) {
    const root = CH[c].root;
    if (halfTime) { ev.push([start, root, len - 2, 38], [start + len - 2, up(root), 2, 22]); continue; }
    for (let r = start; r < start + len; r += 2) {
      const beat = (r - start) % 4 === 0;
      ev.push([r, beat ? root : up(root), 2, beat ? 40 : 22]);
    }
  }
  return phrase(ev, I.bass, { rows: ROWS, sustain: 0.7, name: 'bass' });
}

function drums({ intro = false, half = false, fill = false } = {}) {
  const list = [];
  for (let r = 0; r < ROWS; r += 2) {
    const b = r % 16;
    if (half) {
      if (b === 0) list.push([r, I.kick, 30]);
      else if (b === 8) list.push([r, I.snare, 18]);
      else if (r % 4 === 2) list.push([r, I.hat, 7]);
      continue;
    }
    if (b === 0 || b === 8 || b === 10) list.push([r, I.kick, b === 10 ? 22 : 34]);
    else if (b === 4 || b === 12) { if (!intro || r >= 32) list.push([r, I.snare, 24]); }
    else list.push([r, I.hat, r % 4 === 2 ? 12 : 7]);
  }
  if (fill) { // snare pickup into the next section
    for (const [r, v] of [[58, 14], [60, 18], [62, 24]]) {
      const i = list.findIndex(([x]) => x === r); if (i >= 0) list.splice(i, 1);
      list.push([r, I.snare, v]);
    }
  }
  return hits(list, { rows: ROWS, name: 'drums' });
}

// channel layout: 0 lead, 1 echo, 2-4 shimmer canon, 5 stab, 6 bass, 7 drums
const PANS = [0x70, 0xa8, 0x40, 0xc0, 0x80, 0x98, 0x80, 0x80];
function pattern(name, parts) {
  const sh = [0, 1, 2].map((i) => parts.shimmer?.[i] ?? rest());
  const channels = [parts.lead ?? rest(), parts.echo ?? rest(), ...sh, parts.stab, parts.bass, parts.drums];
  return { name, rows: ROWS, channels: channels.map((ch, i) => pan({ ...ch }, PANS[i])) };
}
// Echo only the final cadence (E C# A): its delayed notes land a third or
// unison against the held tonic. Echoing the stepwise bar 3 made seconds.
const endEcho = (ch) => echoChannel(slice(ch, 48, ROWS), { delay: 3, scale: 0.45, rows: ROWS });

const hookLead = lead(HOOK), answerLead = lead(ANSWER);
const patterns = [
  pattern('intro - shimmer', { shimmer: shimmer(P.A, [[0, 1], [1, 0.6], [2, 0.35]]), stab: stabs(P.A, { quiet: true }), bass: bass(P.A, { halfTime: true }), drums: drums({ intro: true, fill: true }) }),
  pattern('A - hook', { lead: hookLead, stab: stabs(P.A), bass: bass(P.A), drums: drums() }),
  pattern("A' - answer", { lead: answerLead, stab: stabs(P.A2), bass: bass(P.A2), drums: drums({ fill: true }) }),
  pattern("A' - answer with echo", { lead: answerLead, echo: endEcho(answerLead), stab: stabs(P.A2), bass: bass(P.A2), drums: drums({ fill: true }) }),
  pattern('B - breakdown', { lead: lead(BRIDGE), shimmer: shimmer(P.B, [[0, 0.7], [1, 0.4]]), stab: stabs(P.B, { quiet: true }), bass: bass(P.B, { halfTime: true }), drums: drums({ half: true, fill: true }) }),
];

writeSong(import.meta.url, {
  title: 'Peach Orchard', bpm: 132, ticks: 6, mixvol: 64,
  message: 'Peach Orchard - Opus 5.5 batch.\nA major chip-pop, 132 BPM. Canon shimmer, pulsing stabs, octave bass.\nAll samples synthesized. Source: songs/peach_orchard.gen.js',
  samples: [
    { name: 'pulse lead', synth: { wave: 'square', pulse: 0.25 } },
    { name: 'shimmer', synth: { wave: 'square', pulse: 0.125 } },
    { name: 'stab', synth: { wave: 'square', pulse: 0.5 } },
    { name: 'triangle bass', synth: { wave: 'triangle' } },
    { name: 'kick', synth: { wave: 'kick', seconds: 0.14, decay: 30, freqStart: 160, freqEnd: 50 } },
    { name: 'snare', synth: { wave: 'noise', seconds: 0.12, decay: 30, seed: 5 } },
    { name: 'hat', synth: { wave: 'noise', seconds: 0.03, decay: 110, seed: 9 } },
  ],
  channelnames: ['lead', 'echo', 'shimmer 1', 'shimmer 2', 'shimmer 3', 'stab', 'bass', 'drums'],
  patterns,
  order: [0, 1, 2, 1, 3, 4, 3],
});
