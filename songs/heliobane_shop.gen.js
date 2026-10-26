#!/usr/bin/env node
/**
 * HELIOBANE - "The Magpie" (shop). Old Mott's salvage tug: cheeky, swung, funky.
 * F major blues, 120 BPM. Speed alternates 7/5 ticks per row on a control
 * channel: rows are swung 16ths (58%), 4 rows/beat, 16 rows/bar, 64 rows = 4 bars = 8 s.
 *
 * Phrase map (4-bar patterns)
 *   Intro  F7 vamp: bass alone, then hats/kit, clav; chromatic pickup A-Bb-B -> C.
 *   A1     F7 F7 Bb7 F7   hook: C..A C D (D# E) F - the answer mirrors it on Bb7
 *                         with the blue fall G# G F, then settles on low F.
 *   A2     Bb7 Bb7 F7 D7  hook up a fourth (the local peak, Bb6), answer falls to D7.
 *   A3     Gm7 C7 F7 E7   ii-V turnaround, then Mott's gag: "shave and a haircut"
 *                         and a stop-time "two bits" on E7 (V of the bridge's A7).
 *   B1/B2  A7 A7 D7 D7 | G7 G7 C7 C7   rhythm-changes bridge: a whistled phrase
 *                         sequenced down in fifths over a walking bass, light kit,
 *                         echo on held notes; ends with a whistled run into A1.
 *   Brk    F7 F7 F7 D7    slap-bass solo + cowbell, wolf-whistle glides, tom fill;
 *                         D7 pivots up a whole step.
 *   A1-A3 in G           the new element is an echo on held lead notes; the last
 *                         turnaround is Am7 D7 G7 C7 and the "two bits" E-F on C7
 *                         pivot back to F for the loop.
 * Loop: intro plays once; the body (A1 .. A3 in G) loops.
 */
import { writeSong } from './lib.js';
import {
  up, bars, tr, line, drums, pattern, join, delayCopy, ROWS,
  kick, snare, hat, openHat, cowbell, crash, tom, growlBass, pulse, sine, echoHeld,
} from './heliobane_shop.kit.js';

const I = { lead: 0, whistle: 1, clav: 2, bass: 3, kick: 4, snare: 5, hat: 6, ohat: 7, bell: 8, crash: 9, tom: 10 };

// chord: bass root, shell voicing (3rd, 7th, root) as one J arpeggio
const CH = {
  F7: ['F-3', 'A-4', 'J68'], Bb7: ['A#2', 'D-5', 'J68'], C7: ['C-3', 'E-4', 'J68'],
  D7: ['D-3', 'F#4', 'J68'], Gm7: ['G-3', 'A#4', 'J79'], E7: ['E-3', 'G#4', 'J68'],
  A7: ['A-2', 'C#5', 'J68'], G7: ['G-3', 'B-4', 'J68'], G7lo: ['G-2', 'B-4', 'J68'],
  Am7: ['A-3', 'C-5', 'J79'],
};
const iv = (root, n) => up(root, n);

// ------------------------------------------------------------------ melodies
const A1 = [
  [[0, 'C-6', 3, 40], [3, 'A-5', 1, 30], [4, 'C-6', 2, 36], [6, 'D-6', 2, 36], [8, 'D#6', 1, 32], [9, 'E-6', 1, 34], [10, 'F-6', 5, 42]],
  [[0, 'D-6', 2, 38], [2, 'C-6', 2, 34], [4, 'A-5', 4, 38], [10, 'G#5', 1, 30], [11, 'A-5', 1, 32], [12, 'C-6', 3, 36]],
  [[0, 'D-6', 3, 40], [3, 'A#5', 1, 30], [4, 'D-6', 2, 36], [6, 'F-6', 2, 38], [8, 'G#6', 1, 36], [9, 'G-6', 1, 34], [10, 'F-6', 5, 40]],
  [[0, 'D-6', 2, 36], [2, 'C-6', 2, 34], [4, 'D#6', 1, 32], [5, 'D-6', 1, 30], [6, 'C-6', 2, 34], [8, 'A-5', 1, 32], [9, 'C-6', 1, 32], [10, 'F-5', 4, 38], [14, 'D-6', 1, 28], [15, 'E-6', 1, 30]],
];
const A2 = [
  tr(A1[0], 5),
  tr(A1[1], 5),
  [[0, 'C-6', 3, 40], [3, 'A-5', 1, 30], [4, 'C-6', 2, 36], [6, 'D#6', 2, 36], [8, 'D-6', 2, 34], [10, 'C-6', 2, 34], [12, 'A-5', 4, 36]],
  [[0, 'F#5', 2, 36], [2, 'A-5', 2, 34], [4, 'C-6', 2, 36], [6, 'D-6', 3, 38], [9, 'C-6', 1, 30], [10, 'A-5', 3, 34], [13, 'F#5', 1, 28], [14, 'G-5', 2, 32]],
];
const A3head = [
  [[0, 'A#5', 2, 36], [2, 'D-6', 2, 36], [4, 'F-6', 3, 40], [7, 'E-6', 1, 30], [8, 'D-6', 2, 36], [10, 'A#5', 2, 34], [12, 'G-5', 2, 34], [14, 'A-5', 1, 30], [15, 'A#5', 1, 32]],
  [[0, 'C-6', 3, 38], [3, 'A#5', 1, 30], [4, 'G-5', 2, 34], [6, 'E-5', 2, 32], [8, 'G-5', 1, 30], [9, 'A#5', 1, 32], [10, 'C-6', 2, 34], [12, 'E-6', 4, 38]],
  // shave and a haircut ...
  [[0, 'C-6', 4, 40], [4, 'G-5', 2, 34], [6, 'G-5', 2, 34], [8, 'A-5', 4, 38], [12, 'G-5', 3, 34]],
];
const A3 = [...A3head, [[4, 'G#5', 3, 40], [8, 'A-5', 4, 42]]];                 // ... two bits (to A7)
const PICKUP = [[12, 'A-5', 1, 30], [13, 'A#5', 1, 32], [14, 'B-5', 2, 34]];     // chromatic walk into C
const A3end = [...A3head.map((b) => tr(b, 2)), [[4, 'E-6', 3, 40], [8, 'F-6', 3, 42], ...PICKUP]]; // two bits E-F: back to F

// bridge: a whistled phrase sequenced down in fifths (b7 resolves to the next 3rd)
const X = (root) => [[2, 4, 2, 32], [4, 7, 6, 38], [10, 4, 2, 32], [12, 0, 4, 34], [16, -2, 2, 30], [18, 0, 2, 32], [20, 4, 2, 34], [22, 7, 2, 36], [24, 10, 6, 40]]
  .map(([r, s, l, v]) => [r, iv(root, s), l, v]);
const B1 = [...X('A-5'), ...X('D-5').map(([r, ...e]) => [r + 32, ...e])];
const B2 = [...X('G-5'),
  [34, 'E-6', 2, 32], [36, 'G-6', 6, 38], [42, 'E-6', 2, 32], [44, 'C-6', 4, 34],
  [48, 'A#5', 2, 32], [50, 'C-6', 2, 32], [52, 'E-6', 2, 34], [54, 'G-6', 2, 36], [56, 'A#6', 3, 40],
  [59, 'A-6', 1, 32], [60, 'G-6', 1, 32], [61, 'F-6', 1, 32], [62, 'E-6', 1, 34], [63, 'D-6', 1, 36]];

const echoOf = (events, { delay = 3, scale = 0.42, min = 4, inst = I.lead } = {}) => echoHeld(events, inst, { delay, scale, min });

// ------------------------------------------------------------------ parts
const nextOf = (prog, b, next) => (b + 1 < prog.length ? prog[b + 1] : next);

function funkBass(prog, next, { stop = -1, variant = 0 } = {}) {
  const ev = [];
  prog.forEach((c, b) => {
    const root = CH[c][0], o = b * 16, nx = CH[nextOf(prog, b, next)][0];
    if (b === stop) { ev.push([o + 4, root, 3, 44], [o + 8, root, 3, 44]); return; }
    const app = nextOf(prog, b, next) === c ? iv(root, 10) : up(nx, -1);
    const cell = (variant + b) % 2 === 0
      ? [[0, 0, 2, 46], [3, 0, 1, 24], [4, 12, 1, 38], [6, 10, 2, 34], [8, 0, 2, 42], [10, 7, 1, 32], [11, 10, 1, 28], [12, 12, 2, 38]]
      : [[0, 0, 3, 46], [3, 12, 1, 30], [4, 0, 1, 30], [6, 12, 2, 38], [8, 10, 1, 32], [9, 12, 1, 30], [10, 7, 2, 36], [12, 0, 1, 40], [13, 3, 1, 26]];
    for (const [r, s, l, v] of cell) ev.push([o + r, iv(root, s), l, v]);
    ev.push([o + 14, app, 2, 34]);
  });
  return line(ev, I.bass, { sustain: 0.8, release: 0.6 });
}

function walkBass(prog, next) {
  const ev = [];
  prog.forEach((c, b) => {
    const root = CH[c][0], nx = nextOf(prog, b, next);
    const last = nx === c ? iv(root, 10) : up(CH[nx][0], -1);
    [[0, root], [4, iv(root, 4)], [8, iv(root, 7)], [12, last]].forEach(([r, n], k) => ev.push([b * 16 + r, n, 3, k === 0 ? 44 : 36]));
  });
  return line(ev, I.bass, { sustain: 0.85, release: 0.7 });
}

function slapBass() { // breakdown: F7 F7 F7 D7
  const cellA = [[0, 0, 2, 48], [2, 12, 1, 36], [3, 12, 1, 22], [4, 10, 2, 38], [6, 12, 1, 34], [7, 0, 1, 24], [8, 3, 1, 30], [9, 4, 1, 36], [10, 7, 2, 38], [12, 12, 1, 40], [13, 10, 1, 30], [14, 7, 1, 32], [15, 4, 1, 28]];
  const cellB = [[0, 0, 3, 48], [4, 0, 1, 26], [5, 12, 1, 36], [6, 10, 1, 30], [7, 12, 1, 36], [8, 0, 2, 44], [12, 7, 1, 34], [13, 10, 1, 34], [14, 11, 2, 36]];
  const ev = [];
  ['F7', 'F7', 'F7'].forEach((c, b) => (b === 1 ? cellB : cellA).forEach(([r, s, l, v]) => ev.push([b * 16 + r, iv('F-3', s), l, v])));
  [[0, 0, 2, 46], [2, 12, 1, 34], [4, 0, 1, 30], [6, 10, 2, 36], [8, 12, 2, 38], [10, 9, 1, 32], [11, 7, 1, 30], [12, 6, 1, 32], [13, 4, 1, 30], [14, 3, 2, 34]]
    .forEach(([r, s, l, v]) => ev.push([48 + r, iv('D-3', s), l, v])); // walks down to F (the 3rd of D7 / leading to G)
  return line(ev, I.bass, { sustain: 0.8, release: 0.6 });
}

function clav(prog, { stop = -1, light = false, vol = 26 } = {}) {
  const ev = [];
  prog.forEach((c, b) => {
    const [, base, j] = CH[c], o = b * 16;
    if (b === stop) { ev.push([o + 4, base, 3, vol + 8, j], [o + 8, base, 3, vol + 8, j]); return; }
    const rhythm = light ? [[4, 2, vol], [12, 2, vol]] : [[2, 1, vol], [5, 1, vol - 7], [10, 1, vol], [13, 1, vol - 7]];
    for (const [r, l, v] of rhythm) ev.push([o + r, base, l, v, j]);
  });
  return line(ev, I.clav, { sustain: 0.6 });
}

function kit({ stop = -1, from = 0, light = false, fillLast = false } = {}) {
  const ks = [], hh = [];
  for (let b = from; b < 4; b++) {
    const o = b * 16;
    if (b === stop) { ks.push([o + 4, I.kick, 44], [o + 8, I.snare, 44]); continue; }
    if (light) {
      ks.push([o, I.kick, 34], [o + 4, I.snare, 16], [o + 10, I.kick, 22], [o + 12, I.snare, 18]);
      for (const r of [0, 4, 6, 8, 12, 14]) hh.push([o + r, r % 4 === 2 ? I.hat : I.hat, r % 4 === 2 ? 10 : 16]);
      continue;
    }
    if (fillLast && b === 3) {
      ks.push([o, I.kick, 42], [o + 4, I.snare, 38], [o + 7, I.kick, 30], [o + 8, I.snare, 22], [o + 9, I.snare, 26], [o + 10, I.snare, 30],
        [o + 11, I.snare, 32], [o + 12, I.snare, 36], [o + 13, I.snare, 38], [o + 14, I.snare, 40], [o + 15, I.snare, 42]);
    } else ks.push([o, I.kick, 44], [o + 4, I.snare, 40], [o + 7, I.kick, 28], [o + 10, I.kick, 38], [o + 12, I.snare, 40], [o + 15, I.snare, 13]);
    for (let r = 0; r < 16; r++) {
      if (r === 15) continue;
      if (r === 14) hh.push([o + r, I.ohat, 21]);
      else if (r % 2 === 0) hh.push([o + r, I.hat, r % 4 === 0 ? 26 : 19]);
      else hh.push([o + r, I.hat, 10]);
    }
  }
  // drums sit forward in the mix: +2.6 dB on kick/snare
  return [drums(ks.map(([r, i, v]) => [r, i, Math.min(64, Math.round(v * 1.35))])), drums(hh)];
}

function swing() {
  const ch = {};
  for (let r = 0; r < ROWS; r++) ch[r] = { fx: r % 2 ? 'A05' : 'A07' };
  return ch;
}

// ------------------------------------------------------------------ patterns
const PANS = [undefined, 0x70, 0xa8, 0x58, 0x80, 0x80, 0xa0, 0x68];
const MELODIC = [1, 2, 3, 4];
const patterns = [];
function P(name, { lead, echo, clavs, bass, ks, hh, perc }) {
  const chans = [swing(), lead, echo, clavs, bass, ks, hh, perc];
  const pat = pattern(name, chans.map((c, i) => (MELODIC.includes(i) || c ? c || {} : {})), PANS);
  // drum/perc channels keep their natural tails: undo the row-0 cut on them
  for (const i of [5, 6, 7]) if (pat.channels[i][0]?.note === '^^' && !chans[i]?.[0]) { const { note, ...rest } = pat.channels[i][0]; pat.channels[i][0] = rest; if (!Object.keys(rest).length) delete pat.channels[i][0]; }
  patterns.push(pat);
  return patterns.length - 1;
}
const leadLine = (b, inst = I.lead) => line(bars(b), inst, { vib: 'H43', vibDelay: 3 });

// Intro: bass alone, then kit, clav; pickup into A1
{
  const [ks, hh] = kit({ from: 1 });
  var P_INTRO = P('intro - Mott tunes up', {
    lead: leadLine([[], [], [], PICKUP]),
    clavs: Object.fromEntries(Object.entries(clav(['F7', 'F7', 'F7', 'F7'])).filter(([r]) => +r >= 32)),
    bass: funkBass(['F7', 'F7', 'F7', 'F7'], 'F7'), ks, hh,
    perc: drums([[16, I.crash, 22]]),
  });
}

function aSection(name, prog, next, melody, { semi = 0, stop = -1, withEcho = false, crashIn = false, pickupFill = false } = {}) {
  const [ks, hh] = kit({ stop, fillLast: pickupFill });
  const lead = leadLine(melody);
  const perc = [];
  if (crashIn) perc.push([0, I.crash, 24]);
  if (semi) for (let b = 0; b < 4; b++) if (b !== stop) perc.push([b * 16 + 6, I.bell, 12], [b * 16 + 14, I.bell, 9]);
  return P(name, {
    lead, echo: withEcho ? echoOf(bars(melody)) : null, clavs: clav(prog, { stop }),
    bass: funkBass(prog, next, { stop, variant: semi ? 1 : 0 }), ks, hh, perc: drums(perc),
  });
}

const A1p = aSection('A1 - hook (F)', ['F7', 'F7', 'Bb7', 'F7'], 'Bb7', A1, { crashIn: true });
const A2p = aSection('A2 - hook up a 4th', ['Bb7', 'Bb7', 'F7', 'D7'], 'Gm7', A2);
const A3p = aSection('A3 - turnaround + two bits', ['Gm7', 'C7', 'F7', 'E7'], 'A7', A3, { stop: 3 });

function tomFill(list) {
  const ch = drums(list.map(([r, , v]) => [r, I.tom, v]));
  for (const [r, n] of list) ch[r].note = n;
  return ch;
}

function bridge(name, prog, next, mel, last) {
  const lead = line(mel, I.whistle, { vib: 'H33', vibDelay: 2 });
  const [ks, hh] = kit({ light: true });
  return P(name, {
    lead, echo: echoOf(mel, { inst: I.whistle, scale: 0.4 }), clavs: clav(prog, { light: true, vol: 20 }),
    bass: walkBass(prog, next), ks, hh,
    perc: last ? tomFill([[56, 'C-5', 26], [58, 'A#4', 24], [60, 'G-4', 22], [62, 'F-4', 20]]) : {},
  });
}
const B1p = bridge('B1 - whistled bridge A7 D7', ['A7', 'A7', 'D7', 'D7'], 'G7lo', B1);
const B2p = bridge('B2 - bridge G7 C7 + run', ['G7lo', 'G7lo', 'C7', 'C7'], 'F7', B2, true);

// breakdown: slap bass + cowbell + wolf whistles; tom fill modulates up
{
  const [ks, hh] = kit({});
  const lead = {
    24: { note: 'G-5', instrument: I.whistle, vol: 'v30' }, 25: { note: 'D-6', vol: 'v34', fx: 'G0C' }, 26: { fx: 'G0C' },
    27: { vol: 'v28', fx: 'H33' }, 28: { note: 'G#5', vol: 'v30', fx: 'G08' }, 29: { fx: 'G08' }, 30: { fx: 'G08', vol: 'v18' }, 31: { note: '^^' },
    40: { note: 'A-5', instrument: I.whistle, vol: 'v30' }, 41: { note: 'F-6', vol: 'v34', fx: 'G0C' }, 42: { fx: 'G0C' },
    43: { vol: 'v28', fx: 'H33' }, 44: { note: 'A#5', vol: 'v30', fx: 'G08' }, 45: { fx: 'G08' }, 46: { fx: 'G08', vol: 'v18' }, 47: { note: '^^' },
  };
  const bell = [];
  for (let b = 0; b < 3; b++) for (const [r, v] of [[0, 20], [3, 12], [6, 16], [8, 12], [10, 18], [12, 12], [14, 14]]) bell.push([b * 16 + r, I.bell, v]);
  bell.push([48, I.tom, 30], [52, I.tom, 26], [54, I.tom, 26], [56, I.tom, 24], [58, I.tom, 22], [60, I.tom, 20], [62, I.tom, 18]);
  const toms = drums(bell);
  for (const [r, n] of [[48, 'C-5'], [52, 'A#4'], [54, 'A#4'], [56, 'G-4'], [58, 'G-4'], [60, 'F-4'], [62, 'D-4']]) toms[r].note = n;
  var P_BRK = P('breakdown - slap bass, cowbell, wolf whistle', {
    lead, clavs: clav(['F7', 'F7', 'F7', 'D7'], { light: true, vol: 18 }), bass: slapBass(), ks, hh, perc: toms,
  });
}

const A1g = aSection('A1 in G - hook + echo', ['G7', 'G7', 'C7', 'G7'], 'C7', A1.map((b) => tr(b, 2)), { semi: 2, withEcho: true, crashIn: true });
const A2g = aSection('A2 in G', ['C7', 'C7', 'G7', 'E7'], 'Am7', A2.map((b) => tr(b, 2)), { semi: 2, withEcho: true });
const A3g = aSection('A3 in G - two bits back to F', ['Am7', 'D7', 'G7', 'C7'], 'F7', A3end, { semi: 2, withEcho: true, stop: 3 });

writeSong(import.meta.url, {
  title: 'Heliobane - The Magpie', bpm: 120, ticks: 7, mixvol: 50,
  message: 'HELIOBANE - The Magpie (shop). F blues shuffle, 120 BPM, swung 16ths (speed 7/5).\n12-bar A, rhythm-changes bridge, slap breakdown, A again in G.\nAll samples synthesized. Source: songs/heliobane_shop.gen.js (MUSIC-B)',
  samples: [
    pulse('pulse lead 25', 0.25), sine('whistle sine'), pulse('clav pulse 12', 0.125),
    growlBass('slap bass', { drive: 1.4, sq: 0.4, gain: 0.67 }),
    kick('kick', { f0: 170, f1: 50, decay: 12, drive: 2 }), snare('snare', { tone: 200, ndecay: 20, drive: 1.5 }),
    hat('hat closed'), openHat('hat open'), cowbell('cowbell perc'), crash('crash'), tom('tom perc'),
  ],
  channelnames: ['swing ctl', 'lead / whistle', 'echo', 'clav', 'bass', 'kick+snare', 'hats', 'perc'],
  patterns,
  order: [P_INTRO, A1p, A2p, A3p, B1p, B2p, P_BRK, A1g, A2g, A3g],
});
