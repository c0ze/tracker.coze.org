#!/usr/bin/env node
/**
 * HELIOBANE - Stage 3 "The Hollow Fleet". A dead armada worn by the Umbrine.
 * D minor (Phrygian Eb colour, harmonic-minor A major dominant), 170 BPM,
 * speed 6: 4 rows/beat, 16 rows/bar, 64 rows = 4 bars = 5.65 s.
 *
 * Palette: detuned-saw "war horn" lead + dotted-8th echo, 12.5% pulse chord arps
 * (J on every row, 16th volume pulse), driven growl bass pumping 16ths,
 * industrial kit (driven kick, metal-ringing snare, pitched hull clanks,
 * timpani toms), a dark detuned pad for the dead-fleet breakdown.
 *
 * Phrase map
 *   Intro  Dm pad, hull clanks, timpani, snare roll.                (plays once)
 *   A1/A2  Dm Dm Bb A | Dm Dm Gm A   march fanfare: A-D-D, F E D C; the answer
 *                                    climbs to Bb6 over Gm and lands on C#6.
 *   B1/B2  Gm Dm Eb A | Gm Dm Bb A   higher and more urgent; Eb is the Phrygian
 *                                    bII; the A6 "scream" is held with vibrato.
 *   A1/A2' the fanfare again with a counter-line a 3rd/6th under held notes.
 *   R1/R2  Dm Bb Gm A x2             instrumental: pedal-riff on pulse with a
 *                                    2-row echo (lands on consonant chord tones).
 *   Brk    Dm Eb Dm A (half time)    the fleet drifts: pad, clank groans, a lonely
 *                                    broadcast phrase with a long echo.
 *   Build  Gm Gm A A                 snare roll crescendo, arps rise.
 *   D1/D2  F C Dm Bb | F C Bb A      "requiem": long soaring notes, 8th bass.
 *   C1/C2  theme A a semitone up (Eb minor) + counter-line.
 *   CB1/2  theme B in Eb minor.
 *   Turn   Bb Bb A A (D minor)       Bb pivots: V of Eb minor = VI of D minor;
 *                                    unison hits, A resolves into the loop.
 */
import { writeSong } from './lib.js';
import {
  up, bars, tr, vs, line, drums, pattern, ROWS,
  kick, snare, hat, clank, tom, crash, growlBass, fatLoop, pulse, echoHeld,
} from './heliobane_shop.kit.js';

const I = { horn: 0, arp: 1, bass: 2, kick: 3, snare: 4, hat: 5, clank: 6, tom: 7, crash: 8, pad: 9, pulse: 10 };

// chord: [bass root, arp base, J]
const CH = {
  Dm: ['D-3', 'D-5', 'J37'], Bb: ['A#2', 'A#4', 'J47'], Gm: ['G-3', 'A#4', 'J49'], A: ['A-2', 'A-4', 'J47'],
  Eb: ['D#3', 'A#4', 'J59'], C: ['C-3', 'G-4', 'J59'], F: ['F-3', 'A-4', 'J38'],
};
const chord = (c, semi) => { const [b, a, j] = CH[c]; return [up(b, semi), up(a, semi), j]; };
const PC = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];
const pc = (n) => PC.indexOf(n.slice(0, 2));

// ------------------------------------------------------------------ melodies
const A_head = [
  [[0, 'A-5', 3, 40], [3, 'D-6', 1, 34], [4, 'D-6', 4, 46], [8, 'F-6', 2, 42], [10, 'E-6', 2, 40], [12, 'D-6', 2, 40], [14, 'C-6', 2, 38]],
  [[0, 'D-6', 6, 44], [6, 'A-5', 2, 36], [8, 'A-5', 3, 40], [11, 'A#5', 1, 34], [12, 'A-5', 4, 40]],
];
const A1 = [...A_head,
  [[0, 'D-6', 3, 42], [3, 'F-6', 1, 36], [4, 'F-6', 4, 46], [8, 'A#6', 2, 46], [10, 'A-6', 2, 42], [12, 'F-6', 2, 40], [14, 'D-6', 2, 38]],
  [[0, 'E-6', 6, 44], [6, 'C#6', 2, 38], [8, 'E-6', 4, 42], [12, 'A-6', 4, 44]]];
const A2 = [...A_head,
  [[0, 'D-6', 3, 42], [3, 'G-6', 1, 36], [4, 'G-6', 4, 46], [8, 'A#6', 2, 46], [10, 'A-6', 2, 42], [12, 'G-6', 2, 40], [14, 'F-6', 2, 38]],
  [[0, 'E-6', 3, 44], [3, 'F-6', 1, 36], [4, 'E-6', 2, 40], [6, 'D-6', 2, 38], [8, 'C#6', 6, 44]]];
const B_head = [
  [[0, 'A#6', 4, 46], [4, 'A-6', 2, 40], [6, 'G-6', 2, 40], [8, 'D-6', 4, 42], [12, 'G-6', 2, 40], [14, 'A-6', 2, 42]],
  [[0, 'F-6', 4, 44], [4, 'E-6', 2, 38], [6, 'D-6', 2, 38], [8, 'A-5', 6, 42], [14, 'D-6', 2, 38]],
];
const B1 = [...B_head,
  [[0, 'G-6', 4, 46], [4, 'F-6', 2, 40], [6, 'D#6', 2, 40], [8, 'A#5', 4, 42], [12, 'D#6', 2, 40], [14, 'G-6', 2, 42]],
  [[0, 'A-6', 8, 48], [8, 'G-6', 2, 40], [10, 'F-6', 2, 40], [12, 'E-6', 2, 40], [14, 'C#6', 2, 40]]];
const B2 = [...B_head,
  [[0, 'F-6', 4, 44], [4, 'D-6', 2, 38], [6, 'F-6', 2, 40], [8, 'A#6', 4, 46], [12, 'A-6', 2, 42], [14, 'F-6', 2, 40]],
  [[0, 'E-6', 4, 44], [4, 'C#6', 4, 40], [8, 'E-6', 2, 40], [10, 'C#6', 2, 38], [12, 'A-5', 3, 40]]];
// counter-line: a third/sixth under the fanfare's held notes only
const A_counter = [
  [[4, 'A-5', 4, 30], [8, 'A-5', 6, 26]],
  [[0, 'F-5', 6, 30], [8, 'F-5', 8, 26]],
  [[4, 'D-6', 4, 30], [8, 'F-6', 4, 28]],
  [[0, 'C#6', 6, 30], [8, 'A-5', 6, 28]],
];
const A2_counter = [A_counter[0], A_counter[1], [[4, 'D-6', 8, 30]], [[0, 'A-5', 6, 30], [8, 'A-5', 6, 28]]];
const B_counter = [
  [[0, 'G-6', 4, 30], [8, 'A#5', 4, 26]],
  [[0, 'D-6', 4, 30], [8, 'F-5', 6, 26]],
  [[0, 'D#6', 4, 30], [8, 'G-5', 4, 26]],
  [[0, 'E-6', 8, 32]],
];
const B2_counter = [B_counter[0], B_counter[1], [[0, 'D-6', 4, 30], [8, 'F-6', 4, 28]], [[0, 'C#6', 4, 30], [4, 'A-5', 4, 28]]];
// requiem
const D1 = [
  [[0, 'C-6', 8, 44], [8, 'A-5', 4, 38], [12, 'C-6', 4, 40]],
  [[0, 'E-6', 8, 44], [8, 'G-6', 8, 46]],
  [[0, 'F-6', 6, 46], [6, 'E-6', 2, 40], [8, 'D-6', 8, 42]],
  [[0, 'D-6', 4, 42], [4, 'F-6', 4, 44], [8, 'A#6', 8, 48]]];
const D2 = [
  [[0, 'A-6', 8, 48], [8, 'G-6', 4, 42], [12, 'F-6', 4, 42]],
  [[0, 'E-6', 6, 44], [6, 'D-6', 2, 38], [8, 'C-6', 8, 42]],
  [[0, 'D-6', 6, 44], [6, 'C-6', 2, 38], [8, 'A#5', 8, 42]],
  [[0, 'A-5', 4, 40], [4, 'C#6', 4, 42], [8, 'E-6', 7, 46]]];
const BROADCAST = [
  [[0, 'A-5', 10, 34], [12, 'A#5', 4, 30]],
  [[0, 'G-5', 8, 32], [8, 'A#5', 8, 32]],
  [[0, 'A-5', 10, 34], [12, 'F-5', 4, 28]],
  [[0, 'E-5', 12, 32]]];
const TURN = [
  [[0, 'D-6', 3, 46], [4, 'D-6', 3, 46], [8, 'F-6', 2, 42], [10, 'D-6', 2, 40], [12, 'A#5', 4, 42]],
  [[0, 'C-6', 2, 40], [2, 'D-6', 2, 42], [4, 'F-6', 4, 44], [8, 'A#6', 8, 48]],
  [[0, 'A-6', 3, 48], [4, 'A-6', 3, 48], [8, 'G-6', 2, 44], [10, 'E-6', 2, 42], [12, 'C#6', 4, 44]],
  [[0, 'E-6', 12, 46]]];

// ------------------------------------------------------------------ parts
const HORN_GAIN = 1.3; // the detuned stack is peaky: its notes sit at ~v52-62
const horn = (b, semi = 0) => line(vs(bars(b.map((x) => tr(x, semi))), HORN_GAIN), I.horn, { vib: 'H43', vibDelay: 3, sustain: 0.78 });

const echoOf = (events, { delay = 3, scale = 0.4, min = 4, inst = I.horn } = {}) => echoHeld(inst === I.horn ? vs(events, HORN_GAIN) : events, inst, { delay, scale, min });

function bass(prog, semi, mode = 'pump') {
  const ev = [];
  prog.forEach((c, b) => {
    const [root] = chord(c, semi), o = b * 16;
    if (mode === 'pump') {
      const iv = c === 'Dm' ? [0, 0, 12, 0, 0, 0, 10, 0, 0, 0, 8, 0, 7, 0, 13, 0] : [0, 0, 12, 0, 0, 0, 12, 0, 0, 0, 7, 0, 0, 0, 12, 0];
      const vol = [48, 22, 36, 22, 42, 22, 36, 22, 44, 22, 36, 22, 40, 22, 38, 24];
      iv.forEach((s, r) => ev.push([o + r, up(root, s), 1, vol[r]]));
    } else if (mode === 'eighth') {
      for (let r = 0; r < 16; r += 2) ev.push([o + r, up(root, r % 4 ? 12 : 0), 2, r % 4 ? 30 : 44]);
    } else if (mode === 'half') {
      ev.push([o, root, 10, 46], [o + 12, root, 2, 30], [o + 14, up(root, 12), 2, 28]);
    } else if (mode === 'hits') {
      ev.push([o, root, 3, 50], [o + 4, root, 3, 50], [o + 8, root, 2, 44], [o + 10, root, 2, 44], [o + 12, root, 4, 48]);
    }
  });
  return line(ev, I.bass, { sustain: 0.85, release: 0.6 });
}

function arps(prog, semi, { vol = 26, rise = false, from = 0 } = {}) {
  const ev = [];
  prog.forEach((c, b) => {
    if (b < from) return;
    const [, base, j] = chord(c, semi);
    for (let beat = 0; beat < 4; beat++) {
      const k = rise ? 0.35 + 0.65 * ((b - from) * 4 + beat) / ((4 - from) * 4) : 1;
      ev.push([b * 16 + beat * 4, base, 4, Math.round(vol * k), j]);
    }
  });
  const ch = line(ev, I.arp, { sustain: 0.5, release: 0.75 });
  // 16th volume pulse on the held rows: a chip "chug" under the lead
  for (const [r, e] of Object.entries(ch)) if (!e.note && +r % 2 === 0) ch[r] = { ...e, vol: e.vol ?? `v${Math.round(vol * 0.75)}` };
  return ch;
}

function pad(prog, semi, vol = 22) {
  const ev = prog.map((c, b) => { const [, base, j] = chord(c, semi); return [b * 16, up(base, -12), 15, vol, j]; });
  return line(ev, I.pad, { sustain: 0.9, release: 0.7 });
}

function kitMarch({ roll = true, crashAt0 = false, double = false } = {}) {
  const ks = [], hh = [], mt = [], tc = [];
  for (let b = 0; b < 4; b++) {
    const o = b * 16;
    ks.push([o, I.kick, 60], [o + 2, I.snare, 14], [o + 4, I.snare, 54], [o + 6, I.snare, 12], [o + 7, I.kick, 40],
      [o + 8, I.kick, 58], [o + 10, I.kick, 46], [o + 12, I.snare, 54]);
    if (double) ks.push([o + 14, I.kick, 44], [o + 15, I.kick, 40]);
    else if (roll && b % 2 === 1) ks.push([o + 13, I.snare, 16], [o + 14, I.snare, 22], [o + 15, I.snare, 28]);
    else ks.push([o + 14, I.snare, 18]);
    for (let r = 0; r < 16; r += 2) hh.push([o + r, I.hat, r % 4 ? 22 : 30]);
    mt.push([o + 6, I.clank, 24, 'C-5'], [o + 14, I.clank, 20, b % 2 ? 'G-4' : 'A#4']);
  }
  if (crashAt0) tc.push([0, I.crash, 24, 'C-5']);
  return drumChans(ks, hh, mt, tc);
}

function kitHalf({ build = false } = {}) {
  const ks = [], hh = [], mt = [], tc = [];
  for (let b = 0; b < 4; b++) {
    const o = b * 16;
    if (build && b >= 2) continue;
    ks.push([o, I.kick, 58], [o + 8, I.snare, 50], [o + 11, I.kick, 36]);
    for (const r of [4, 12]) hh.push([o + r, I.hat, 12]);
    mt.push([o + 4, I.clank, 22, b % 2 ? 'F-4' : 'G-4'], [o + 14, I.clank, 14, 'D-4']);
    if (!build && b === 3) tc.push([o + 8, I.tom, 34, 'A-4'], [o + 10, I.tom, 34, 'F-4'], [o + 12, I.tom, 36, 'D-4'], [o + 14, I.tom, 38, 'A-3']);
  }
  if (build) {
    for (let r = 32; r < 64; r++) ks.push([r, r % 4 === 0 ? I.kick : I.snare, Math.round(16 + 40 * (r - 32) / 31)]);
    tc.push([0, I.tom, 40, 'D-4'], [16, I.tom, 40, 'D-4']);
  }
  return drumChans(ks, hh, mt, tc);
}

function drumChans(ks, hh, mt, tc) {
  const pitched = (list) => {
    const ch = drums(list.map(([r, i, v]) => [r, i, v]));
    for (const [r, , , n] of list) if (n) ch[r].note = n;
    return ch;
  };
  return [drums(ks), drums(hh), pitched(mt), pitched(tc)];
}

// ------------------------------------------------------------------ patterns
// channels: 0 horn, 1 echo, 2 counter, 3 arp, 4 bass, 5 kick/snare, 6 hats, 7 clank, 8 tom/crash, 9 pad
const PANS = [0x78, 0xb0, 0x50, 0x98, 0x80, 0x80, 0xa8, 0x60, 0x70, 0x88];
const MELODIC = [0, 1, 2, 3, 4, 9];
const patterns = [];
function P(name, ch) {
  const chans = [ch.lead, ch.echo, ch.counter, ch.arp, ch.bass, ...(ch.kit || [{}, {}, {}, {}]), ch.pad];
  const pat = pattern(name, chans, PANS);
  for (const i of [5, 6, 7, 8]) { // drums keep their natural tails across the bar line
    const e = pat.channels[i][0];
    if (e?.note === '^^' && !chans[i]?.[0]) { const { note, ...rest } = e; if (Object.keys(rest).length) pat.channels[i][0] = rest; else delete pat.channels[i][0]; }
  }
  patterns.push(pat);
  return patterns.length - 1;
}

function theme(name, prog, mel, { semi = 0, counter = null, echo = true, crashAt0 = false, double = false } = {}) {
  const abs = bars(mel.map((x) => tr(x, semi)));
  return P(name, {
    lead: horn(mel, semi), echo: echo ? echoOf(abs) : null,
    counter: counter ? line(bars(counter.map((x) => tr(x, semi))), I.pulse, { vib: 'H42', vibDelay: 3 }) : null,
    arp: arps(prog, semi, { vol: counter ? 22 : 26 }), bass: bass(prog, semi), kit: kitMarch({ crashAt0, double }),
  });
}

// intro: Dm pad, hull clanks, timpani, snare roll into the march
const INTRO = (() => {
  const tc = [[0, I.tom, 44, 'D-4'], [16, I.tom, 40, 'D-4'], [32, I.tom, 44, 'A-3'], [40, I.tom, 36, 'A-3'], [44, I.tom, 38, 'A-3'], [48, I.tom, 46, 'D-4']];
  const mt = [[0, I.clank, 34, 'D-4'], [12, I.clank, 18, 'G-4'], [24, I.clank, 26, 'C#4'], [36, I.clank, 18, 'G-4'], [44, I.clank, 28, 'D-4']];
  const ks = [];
  for (let r = 48; r < 64; r++) ks.push([r, I.snare, Math.round(12 + 44 * (r - 48) / 15)]);
  const [k, h, m, t] = drumChans(ks, [], mt, tc);
  return P('intro - hull groans', {
    lead: {}, arp: arps(['Dm', 'Dm', 'Eb', 'A'], 0, { vol: 20, rise: true, from: 2 }), bass: bass(['Dm', 'Dm', 'Eb', 'A'], 0, 'half'),
    kit: [k, h, m, t], pad: pad(['Dm', 'Dm', 'Eb', 'A'], 0, 24),
  });
})();

const A1p = theme('A1 - march fanfare', ['Dm', 'Dm', 'Bb', 'A'], A1, { crashAt0: true });
const A2p = theme('A2 - fanfare answer', ['Dm', 'Dm', 'Gm', 'A'], A2);
const B1p = theme('B1 - urgent', ['Gm', 'Dm', 'Eb', 'A'], B1, { crashAt0: true });
const B2p = theme('B2', ['Gm', 'Dm', 'Bb', 'A'], B2);
const A1c = theme("A1' - fanfare + counter", ['Dm', 'Dm', 'Bb', 'A'], A1, { counter: A_counter, crashAt0: true });
const A2c = theme("A2' + counter", ['Dm', 'Dm', 'Gm', 'A'], A2, { counter: A2_counter });

// riff: pedal sequence on pulse, 2-row echo (top->bottom, mid->mid, bottom->top: consonant)
function riff(prog, variant) {
  const ev = [];
  const shapes = { Dm: [['D-6', 'D-6', 'C-6', 'A-5'], 'A-5', 'F-5'], Bb: [['D-6', 'D-6', 'C-6', 'A#5'], 'F-5', 'D-5'],
    Gm: [['D-6', 'D-6', 'A#5', 'A-5'], 'G-5', 'D-5'], A: [['E-6', 'E-6', 'C#6', 'A-5'], 'E-5', 'C#5'] };
  prog.forEach((c, b) => {
    const [tops, mid, low] = shapes[c];
    for (let beat = 0; beat < 4; beat++) {
      const top = variant && b === 3 && beat === 3 ? 'G-5' : tops[beat];
      [top, mid, low, mid].forEach((n, k) => ev.push([b * 16 + beat * 4 + k, n, 1, k === 0 ? 34 : 24]));
    }
  });
  return line(ev, I.pulse, {});
}
const RP = ['Dm', 'Bb', 'Gm', 'A'];
function riffEcho(src) { // 2-row copy at 40%; nothing carries across a bar line (chord change)
  const o = {};
  for (const [k, e] of Object.entries(src)) {
    const t = +k + 2;
    if (t >= ROWS || Math.floor(t / 16) !== Math.floor(+k / 16)) continue;
    o[t] = { ...e, vol: e.vol ? `v${Math.round(+e.vol.slice(1) * 0.4)}` : e.vol };
  }
  for (let b = 16; b < ROWS; b += 16) if (!o[b]) o[b] = { note: '^^' };
  return o;
}
const R1 = P('R1 - pedal riff + echo', { counter: riff(RP, 0), echo: riffEcho(riff(RP, 0)),
  arp: {}, bass: bass(RP, 0), kit: kitMarch({ crashAt0: true }) });
const R2 = P('R2 - riff, double kick', { counter: riff(RP, 1), echo: riffEcho(riff(RP, 1)),
  arp: {}, bass: bass(RP, 0), kit: kitMarch({ double: true }) });
// the echo channel uses the pulse sample (instrument numbers copied from the riff)

const BRK = P('breakdown - the fleet drifts', {
  counter: line(bars(BROADCAST), I.pulse, { vib: 'H32', vibDelay: 4, sustain: 0.8 }),
  echo: (() => { const e = echoOf(bars(BROADCAST), { delay: 6, scale: 0.45, min: 4, inst: I.pulse }); return e; })(),
  arp: {}, bass: bass(['Dm', 'Eb', 'Dm', 'A'], 0, 'half'), kit: kitHalf(), pad: pad(['Dm', 'Eb', 'Dm', 'A'], 0, 26),
});
const BUILD = P('build - roll', {
  arp: arps(['Gm', 'Gm', 'A', 'A'], 0, { vol: 28, rise: true }), bass: bass(['Gm', 'Gm', 'A', 'A'], 0, 'half'),
  kit: kitHalf({ build: true }), pad: pad(['Gm', 'Gm', 'A', 'A'], 0, 22),
});

function requiem(name, prog, mel, crashAt0) {
  return P(name, {
    lead: horn(mel), echo: echoOf(bars(mel), { delay: 3, scale: 0.42 }), arp: arps(prog, 0, { vol: 22 }),
    bass: bass(prog, 0, 'eighth'), kit: kitMarch({ roll: false, crashAt0 }), pad: pad(prog, 0, 16),
  });
}
const D1p = requiem('D1 - requiem', ['F', 'C', 'Dm', 'Bb'], D1, true);
const D2p = requiem('D2 - requiem', ['F', 'C', 'Bb', 'A'], D2, false);

const C1p = theme('C1 - fanfare in Eb minor', ['Dm', 'Dm', 'Bb', 'A'], A1, { semi: 1, counter: A_counter, crashAt0: true, double: true });
const C2p = theme('C2 - in Eb minor', ['Dm', 'Dm', 'Gm', 'A'], A2, { semi: 1, counter: A2_counter, double: true });
const CB1 = theme('CB1 - theme B in Eb minor', ['Gm', 'Dm', 'Eb', 'A'], B1, { semi: 1, counter: B_counter, crashAt0: true });
const CB2 = theme('CB2 - in Eb minor, ends on Bb', ['Gm', 'Dm', 'Bb', 'A'], B2, { semi: 1, counter: B2_counter });

const TURNp = (() => {
  const prog = ['Bb', 'Bb', 'A', 'A'];
  const [k, h, m, t] = kitMarch({ roll: false, crashAt0: true });
  // bar 3: tom fill down into the loop
  const k2 = Object.fromEntries(Object.entries(k).filter(([r]) => +r < 48));
  k2[48] = { note: 'C-5', instrument: I.kick, vol: 'v60' };
  const t2 = { ...t };
  [[52, 'A-4'], [54, 'A-4'], [56, 'F-4'], [58, 'F-4'], [60, 'D-4'], [61, 'D-4'], [62, 'A-3'], [63, 'A-3']].forEach(([r, n], i) => { t2[r] = { note: n, instrument: I.tom, vol: `v${36 + i * 2}` }; });
  return P('turn - Bb pivot to A', {
    lead: horn(TURN), echo: echoOf(bars(TURN)), arp: arps(prog, 0, { vol: 24 }), bass: bass(prog, 0, 'hits'),
    kit: [k2, h, m, t2], pad: {},
  });
})();

writeSong(import.meta.url, {
  title: 'Heliobane - The Hollow Fleet', bpm: 170, ticks: 6, mixvol: 44,
  message: 'HELIOBANE - Stage 3: The Hollow Fleet. D minor march, 170 BPM, speed 6.\nFanfare A, urgent B, pedal riff, drifting breakdown, requiem, key change to Eb minor, Bb pivot home.\nAll samples synthesized. Source: songs/heliobane_stage3.gen.js (MUSIC-B)',
  samples: [
    fatLoop('war horn saw', { period: 32, k: 128, mix: 'saw', H: 10 }),
    pulse('arp pulse 12', 0.125),
    growlBass('hull bass', { drive: 2.2, sq: 0.5, gain: 0.62 }),
    kick('kick industrial', { f0: 210, f1: 55, decay: 11, drive: 3, click: 0.6, gain: 0.72 }),
    snare('snare metal', { tone: 170, ndecay: 13, drive: 2, metal: 0.8, gain: 0.72 }),
    hat('hat closed', 414),
    clank('clank perc hull', { base: 160, drive: 2 }),
    tom('tom timpani perc', { f0: 150, f1: 90, sweep: 9, decay: 5, sec: 0.5, gain: 0.7 }),
    crash('crash', 515),
    fatLoop('dead pad', { period: 32, k: 128, mix: 'soft', gain: 0.9 }),
    pulse('pulse 25', 0.25),
  ],
  channelnames: ['horn lead', 'echo', 'counter / riff', 'arp', 'bass', 'kick+snare', 'hats', 'hull clank', 'toms / crash', 'pad'],
  patterns,
  order: [INTRO, A1p, A2p, B1p, B2p, A1c, A2c, R1, R2, BRK, BUILD, D1p, D2p, C1p, C2p, CB1, CB2, TURNp],
});
