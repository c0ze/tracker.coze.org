#!/usr/bin/env node
/**
 * HELIOBANE - Stage 4 "Cinder Crown". The forge world cracked open by the siphon.
 * E minor (Phrygian/tritone riff colour), 175 BPM, speed 6: 4 rows/beat,
 * 16 rows/bar, 64 rows = 4 bars = 5.49 s.
 *
 * Palette: overdriven root+5th+octave power-chord cycle (palm-muted gallops =
 * 1-row notes, open chords = held), driven growl bass in unison with the riff,
 * distorted detuned-saw lead and a twin lead a chord-tone below (Maiden-style
 * harmony), 25% pulse shred sweeps, separate kick/snare channels for 16th double
 * kick, bright anvil clanks for the forge.
 *
 * Phrase map
 *   Intro  anvil strikes + the riff alone, drums crash in.          (plays once)
 *   V1/V2  2-bar riff x2: gallop E-E-E G / F#, then E Bb A G ... D. The lead
 *          answers in the riff's gaps: B-E-G (held), F# E D; then rests while the
 *          riff does its Bb-A-G turn.
 *   Pre    C D Em B      rising long notes, B major arpeggio into the chorus.
 *   C1/C2  Em C G D | Em C D B   the hook: G F# G A B, twin lead in harmony,
 *                                double kick, open chords.
 *   R1/R2  riff + shred sweeps (sweeps only in the riff's first bar).
 *   V1/V2  verses return, twin lead now doubling the answer.
 *   Brk1/2 half-time low-E chugs, anvil, a slow creeping lead (B C B A#).
 *   S1/S2  Am Em B Em: sweep solo, then lead runs in E harmonic minor.
 *   R2     the riff under double kick; sweeps, and in the riff's chromatic bar the
 *          shred taps the riff's own root/fifth/octave.
 *   Pre'   as before.
 *   K1/K2  chorus a whole step up (F# minor), last chord C#.
 *   Turn   C D B B in E: C# slides down to C; stop-time hits, fill, loop to V1.
 */
import { writeSong } from './lib.js';
import {
  up, bars, tr, vs, line, drums, pattern, ROWS, pcOf,
  kick, snare, hat, clank, crash, growlBass, fatLoop, powerChord, pulse, echoHeld,
} from './heliobane_shop.kit.js';

const I = { lead: 0, pc: 1, bass: 2, kick: 3, snare: 4, hat: 5, anvil: 6, crash: 7, shred: 8 };

// chord triads (pitch classes) and roots for bass (octave 3) / power chord (octave 4)
const TRIAD = { Em: [4, 7, 11], C: [0, 4, 7], G: [7, 11, 2], D: [2, 6, 9], B: [11, 3, 6], Am: [9, 0, 4] };
const BASS = { Em: 'E-3', C: 'C-3', G: 'G-3', D: 'D-3', B: 'B-2', Am: 'A-2' };   // 55..98 Hz
const PCR = { Em: 'E-4', C: 'C-4', G: 'G-4', D: 'D-4', B: 'B-3', Am: 'A-3' };     // power-chord roots
const bassRoot = (c, semi) => up(BASS[c], semi);
const pcRoot = (c, semi) => up(PCR[c], semi);
const nn = (n) => pcOf(n) + 12 * +n[2];
const NAMES = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];
const ns = (v) => NAMES[v % 12] + Math.floor(v / 12);

// ------------------------------------------------------------------ riff
// power-chord roots at octave 4 (E-4 = 165 Hz); a = accent (open), m = palm mute
const RIFF = [
  [[0, 'E', 2, 'a'], [2, 'E', 1, 'm'], [3, 'E', 1, 'm'], [4, 'E', 2, 'a'], [6, 'E', 1, 'm'], [7, 'E', 1, 'm'],
   [8, 'G', 2, 'a'], [10, 'E', 1, 'm'], [11, 'E', 1, 'm'], [12, 'F#', 2, 'a'], [14, 'E', 1, 'm'], [15, 'E', 1, 'm']],
  [[0, 'E', 2, 'a'], [2, 'E', 1, 'm'], [3, 'E', 1, 'm'], [4, 'A#', 2, 'a'], [6, 'A', 2, 'a'], [8, 'G', 3, 'a'],
   [11, 'F#', 1, 'm'], [12, 'G', 1, 'm'], [13, 'F#', 1, 'm'], [14, 'D', 2, 'a']],
];
const riffRoot = (n, oct) => (n.length === 1 ? n + '-' : n) + oct;
function riffPart(inst, oct, { accent = 50, mute = 30, semi = 0, bars: nb = 4 } = {}) {
  const ev = [];
  for (let b = 0; b < nb; b++) for (const [r, n, l, k] of RIFF[b % 2]) {
    const note = up(riffRoot(n, oct), semi);
    ev.push([b * 16 + r, note, l, k === 'a' ? accent : mute]);
  }
  return line(ev, inst, { sustain: 0.8, release: 0.7 });
}

// ------------------------------------------------------------------ melodies
const V1 = [
  [[0, 'B-5', 2, 42], [2, 'E-6', 2, 44], [4, 'G-6', 4, 48], [8, 'F#6', 2, 44], [10, 'E-6', 2, 42], [12, 'D-6', 4, 44]],
  [[0, 'E-6', 4, 46], [12, 'B-5', 2, 40], [14, 'D-6', 2, 42]],
  [[0, 'B-5', 2, 42], [2, 'E-6', 2, 44], [4, 'G-6', 4, 48], [8, 'A-6', 2, 46], [10, 'G-6', 2, 44], [12, 'F#6', 4, 46]],
  [[0, 'G-6', 4, 48], [12, 'D-6', 2, 40], [14, 'F#6', 2, 42]]];
const V2 = [V1[0], V1[1],
  [[0, 'B-5', 2, 42], [2, 'E-6', 2, 44], [4, 'G-6', 4, 48], [8, 'B-6', 4, 50], [12, 'A-6', 2, 46], [14, 'G-6', 2, 44]],
  [[0, 'F#6', 8, 48]]];
const PRE = [
  [[0, 'G-6', 6, 46], [6, 'E-6', 2, 40], [8, 'C-6', 8, 42]],
  [[0, 'A-6', 6, 46], [6, 'F#6', 2, 40], [8, 'D-6', 8, 42]],
  [[0, 'B-6', 6, 48], [6, 'G-6', 2, 42], [8, 'E-6', 8, 44]],
  [[0, 'D#6', 4, 44], [4, 'F#6', 4, 46], [8, 'A-6', 4, 48], [12, 'B-6', 4, 50]]];
const CHO_head = [
  [[0, 'G-6', 3, 48], [3, 'F#6', 1, 40], [4, 'G-6', 2, 46], [6, 'A-6', 2, 46], [8, 'B-6', 6, 52], [14, 'A-6', 2, 44]],
  [[0, 'G-6', 3, 48], [3, 'F#6', 1, 40], [4, 'E-6', 4, 46], [8, 'C-6', 2, 42], [10, 'E-6', 2, 44], [12, 'G-6', 4, 46]]];
const CHO1 = [...CHO_head,
  [[0, 'D-6', 3, 46], [3, 'E-6', 1, 40], [4, 'G-6', 4, 48], [8, 'B-6', 4, 50], [12, 'A-6', 2, 46], [14, 'G-6', 2, 44]],
  [[0, 'F#6', 6, 48], [6, 'E-6', 2, 42], [8, 'D-6', 4, 44], [12, 'F#6', 4, 46]]];
const CHO2 = [...CHO_head,
  [[0, 'F#6', 3, 46], [3, 'G-6', 1, 40], [4, 'A-6', 4, 48], [8, 'F#6', 4, 46], [12, 'D-6', 4, 44]],
  [[0, 'D#6', 6, 48], [6, 'F#6', 2, 44], [8, 'B-6', 7, 52]]];
const BRK_LEAD = [
  [[0, 'B-5', 12, 44]], [[0, 'C-6', 12, 44]], [[0, 'B-5', 12, 44]], [[0, 'A#5', 6, 42], [8, 'B-5', 7, 46]]];
const SOLO_RUNS = [
  [[0, 'A-6', 4, 48], [4, 'G-6', 1, 40], [5, 'F#6', 1, 40], [6, 'E-6', 1, 40], [7, 'C-6', 1, 40], [8, 'E-6', 2, 44], [10, 'A-6', 2, 46], [12, 'C-7', 4, 50]],
  [[0, 'B-6', 4, 50], [4, 'A-6', 1, 42], [5, 'G-6', 1, 42], [6, 'F#6', 1, 42], [7, 'E-6', 1, 42], [8, 'B-5', 2, 44], [10, 'E-6', 2, 46], [12, 'G-6', 4, 48]],
  [[0, 'F#6', 2, 46], [2, 'D#6', 1, 40], [3, 'F#6', 1, 40], [4, 'A-6', 2, 46], [6, 'F#6', 1, 40], [7, 'A-6', 1, 42], [8, 'B-6', 2, 48], [10, 'A-6', 1, 42], [11, 'G-6', 1, 42], [12, 'F#6', 1, 42], [13, 'E-6', 1, 42], [14, 'D#6', 2, 44]],
  [[0, 'E-6', 8, 50], [8, 'G-6', 2, 44], [10, 'F#6', 2, 44], [12, 'E-6', 2, 44], [14, 'D#6', 2, 44]]];
const TURN = [
  [[0, 'G-6', 6, 48], [6, 'E-6', 2, 42], [8, 'C-6', 4, 44], [12, 'E-6', 4, 46]],
  [[0, 'F#6', 6, 48], [6, 'A-6', 2, 44], [8, 'D-6', 4, 44], [12, 'F#6', 4, 46]],
  [[0, 'D#6', 3, 50], [3, 'D#6', 3, 50], [6, 'F#6', 4, 50], [12, 'B-6', 4, 52]],
  [[0, 'A-6', 4, 48], [4, 'F#6', 4, 46]]];

const LEAD_GAIN = 1.2;
const lead = (b, semi = 0) => line(vs(bars(b.map((x) => tr(x, semi))), LEAD_GAIN), I.lead, { vib: 'H54', vibDelay: 3, sustain: 0.82 });

/** Twin lead: under each lead note, the nearest chord tone 3..9 semitones below. */
function twin(b, prog, semi = 0, { scale = 0.72 } = {}) {
  const ev = [];
  bars(b.map((x) => tr(x, semi))).forEach(([r, n, l, v, fx]) => {
    const tri = TRIAD[prog[Math.min(3, Math.floor(r / 16))]].map((p) => (p + semi) % 12);
    let h = null;
    for (let d = 3; d <= 9 && h === null; d++) if (tri.includes(((nn(n) - d) % 12 + 12) % 12)) h = nn(n) - d;
    if (h !== null) ev.push([r, ns(h), l, Math.round(v * scale * LEAD_GAIN), fx]);
  });
  return line(ev, I.lead, { vib: 'H54', vibDelay: 3, sustain: 0.82 });
}

// ------------------------------------------------------------------ parts
function pcPart(prog, semi, mode) {
  const ev = [];
  prog.forEach((c, b) => {
    const root = pcRoot(c, semi), o = b * 16;
    if (mode === 'eighths') for (let r = 0; r < 16; r += 2) ev.push([o + r, root, 2, r % 8 === 0 ? 50 : r % 4 ? 32 : 40]);
    else if (mode === 'held') ev.push([o, root, 6, 50], [o + 6, root, 2, 34], [o + 8, root, 8, 44]);
    else if (mode === 'hits') ev.push([o, root, 3, 52], [o + 4, root, 3, 52], [o + 8, root, 3, 52], [o + 12, root, 2, 44], [o + 14, root, 2, 44]);
    else if (mode === 'stop') ev.push([o, root, 2, 54], [o + 3, root, 2, 54], [o + 6, root, 3, 54]);
  });
  return line(ev, I.pc, { sustain: 0.8, release: 0.7 });
}

function bassPart(prog, semi, mode) {
  const ev = [];
  prog.forEach((c, b) => {
    const root = bassRoot(c, semi), o = b * 16;
    if (mode === 'eighths') for (let r = 0; r < 16; r += 2) ev.push([o + r, root, 2, r % 4 ? 36 : 46]);
    else if (mode === 'held') ev.push([o, root, 8, 48], [o + 8, root, 4, 40], [o + 12, root, 4, 40]);
    else if (mode === 'hits') ev.push([o, root, 3, 50], [o + 4, root, 3, 50], [o + 8, root, 3, 50], [o + 12, root, 2, 44], [o + 14, root, 2, 44]);
    else if (mode === 'stop') ev.push([o, root, 2, 54], [o + 3, root, 2, 54], [o + 6, root, 3, 54]);
  });
  return line(ev, I.bass, { sustain: 0.85, release: 0.7 });
}

// breakdown chugs: low E (E-3 power chord), syncopated 3+3+2 against a half-time snare
const CHUG = [[0, 2, 54], [3, 2, 50], [6, 1, 40], [7, 1, 40], [8, 2, 52], [11, 1, 40], [12, 2, 50], [14, 1, 38], [15, 1, 38]];
function chugs(inst, note) {
  const ev = [];
  for (let b = 0; b < 4; b++) for (const [r, l, v] of CHUG) {
    if (b === 3 && r >= 12) continue;
    ev.push([b * 16 + r, b === 3 && r >= 8 ? up(note, 1) : note, l, v]);
  }
  return line(ev, inst, { sustain: 0.8, release: 0.7 });
}

function sweeps(prog, semi, { onlyFirstOfTwo = false, followRiff = false, vol = 30 } = {}) {
  const ev = [];
  prog.forEach((c, b) => {
    if (onlyFirstOfTwo && b % 2) return;
    if (followRiff && b % 2) { // the riff's chromatic bar: tap its own root / fifth / octave
      const at = (r) => RIFF[1].filter(([r0]) => r0 <= r).pop()[1];
      for (let r = 0; r < 16; r++) ev.push([b * 16 + r, up(riffRoot(at(r), 5), semi + [0, 7, 12, 7][r % 4]), 1, r % 4 === 0 ? vol + 6 : vol - 4]);
      return;
    }
    const tri = TRIAD[c].map((p) => (p + semi) % 12);
    const tones = [];
    for (let v = nn('C-5') + semi; v <= nn('B-6') + semi; v++) if (tri.includes(v % 12)) tones.push(v);
    const t = tones.slice(-6); // six chord tones, ~2 octaves
    const seq = [0, 1, 2, 3, 4, 5, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5].map((i) => t[i]);
    seq.forEach((v, k) => ev.push([b * 16 + k, ns(v), 1, k % 4 === 0 ? vol + 6 : vol - 4]));
  });
  return line(ev, I.shred, {});
}

function kit(mode, { crashEvery = 0, fillLast = false } = {}) {
  const k = [], s = [], h = [], p = [];
  for (let b = 0; b < 4; b++) {
    const o = b * 16;
    if (mode === 'gallop') {
      for (const r of [0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15]) k.push([o + r, I.kick, r % 4 === 0 ? 58 : 42]);
      s.push([o + 4, I.snare, 56], [o + 12, I.snare, 56]);
      for (let r = 0; r < 16; r += 2) h.push([o + r, I.hat, r % 4 ? 26 : 36]);
    } else if (mode === 'double') {
      for (let r = 0; r < 16; r++) k.push([o + r, I.kick, r % 2 ? 40 : 52]);
      s.push([o + 4, I.snare, 58], [o + 12, I.snare, 58]);
      for (let r = 2; r < 16; r += 4) h.push([o + r, I.hat, 32]);
    } else if (mode === 'half') {
      for (const [r] of CHUG) if (!(b === 3 && r >= 12)) k.push([o + r, I.kick, 54]);
      s.push([o + 8, I.snare, 58]);
      h.push([o + 4, I.hat, 20], [o + 12, I.hat, 20]);
      p.push([o + 4, I.anvil, 36, b % 2 ? 'D-5' : 'C-5'], [o + 12, I.anvil, 30, 'G-5']);
    } else if (mode === 'build') {
      for (let r = 0; r < 16; r += 2) k.push([o + r, I.kick, 50]);
      if (b < 3) s.push([o + 4, I.snare, 54], [o + 12, I.snare, 54]);
      else for (let r = 0; r < 16; r++) s.push([o + r, I.snare, 22 + 2 * r]);
      for (let r = 0; r < 16; r += 2) h.push([o + r, I.hat, 22]);
    } else if (mode === 'stop') {
      for (const r of [0, 3, 6]) k.push([o + r, I.kick, 58]);
      s.push([o + 6, I.snare, 54]);
      if (b === 3) for (let r = 8; r < 16; r++) s.push([o + r, I.snare, 30 + 3 * (r - 8)]);
    }
    if (crashEvery && b % crashEvery === 0) p.push([o, I.crash, 28, 'C-5']);
  }
  if (mode !== 'half' && mode !== 'stop' && mode !== 'build') for (const r of [22, 54]) p.push([r, I.anvil, 18, 'E-5']);
  const pitched = (list) => { const ch = drums(list.map(([r, i, v]) => [r, i, v])); for (const [r, , , n] of list) if (n) ch[r].note = n; return ch; };
  const dedupe = (list) => Object.values(Object.fromEntries(list.map((e) => [e[0], e])));
  return [drums(dedupe(k)), drums(dedupe(s)), drums(h), pitched(dedupe(p))];
}

// ------------------------------------------------------------------ patterns
// channels: 0 lead, 1 twin/echo, 2 power chord, 3 bass, 4 kick, 5 snare, 6 hats, 7 perc, 8 shred
const PANS = [0x74, 0x9c, 0x60, 0x80, 0x80, 0x84, 0xa8, 0x6c, 0xb0];
const MELODIC = [0, 1, 2, 3, 8];
const patterns = [];
function P(name, c) {
  const chans = [c.lead, c.twin, c.pc, c.bass, ...(c.kit || [{}, {}, {}, {}]), c.shred];
  const pat = pattern(name, chans, PANS);
  for (const i of [4, 5, 6, 7]) {
    const e = pat.channels[i][0];
    if (e?.note === '^^' && !chans[i]?.[0]) { const { note, ...rest } = e; if (Object.keys(rest).length) pat.channels[i][0] = rest; else delete pat.channels[i][0]; }
  }
  patterns.push(pat);
  return patterns.length - 1;
}

const INTRO = (() => {
  const riff = riffPart(I.pc, 4);
  const anv = [[0, I.anvil, 44, 'C-5'], [6, I.anvil, 36, 'C-5'], [12, I.anvil, 40, 'G-5'], [16, I.anvil, 44, 'C-5'], [22, I.anvil, 36, 'C-5'], [28, I.anvil, 40, 'G-5']];
  const [k, s, h, p] = kit('gallop', {});
  const cut = (ch) => Object.fromEntries(Object.entries(ch).filter(([r]) => +r >= 32));
  const pp = drums(anv.map(([r, i, v]) => [r, i, v])); for (const [r, , , n] of anv) pp[r].note = n;
  pp[32] = { note: 'C-5', instrument: I.crash, vol: 'v32' };
  return P('intro - anvil + riff', { pc: riff, bass: Object.fromEntries(Object.entries(riffPart(I.bass, 3, { accent: 48, mute: 34 })).filter(([r]) => +r >= 32)),
    kit: [cut(k), cut(s), cut(h), pp] });
})();

function verse(name, mel, { twinOn = false } = {}) {
  const prog = ['Em', 'Em', 'Em', 'Em'];
  return P(name, {
    lead: lead(mel), twin: twinOn ? twin(mel, prog) : echoHeld(vs(bars(mel), LEAD_GAIN), I.lead, { delay: 3, scale: 0.38 }),
    pc: riffPart(I.pc, 4), bass: riffPart(I.bass, 3, { accent: 48, mute: 34 }), kit: kit('gallop', { crashEvery: 4 }),
  });
}
const V1p = verse('V1 - riff + answer', V1);
const V2p = verse('V2', V2);
const PRE_PROG = ['C', 'D', 'Em', 'B'];
const PREp = P('pre - C D Em B', {
  lead: lead(PRE), twin: echoHeld(vs(bars(PRE), LEAD_GAIN), I.lead, { delay: 3, scale: 0.4 }),
  pc: pcPart(PRE_PROG, 0, 'held'), bass: bassPart(PRE_PROG, 0, 'held'), kit: kit('build', { crashEvery: 2 }),
});
function chorus(name, mel, prog, semi = 0) {
  return P(name, {
    lead: lead(mel, semi), twin: twin(mel, prog, semi), pc: pcPart(prog, semi, 'eighths'), bass: bassPart(prog, semi, 'eighths'),
    kit: kit('double', { crashEvery: 1 }),
  });
}
const C1p = chorus('C1 - hook + twin', CHO1, ['Em', 'C', 'G', 'D']);
const C2p = chorus('C2 - hook to B', CHO2, ['Em', 'C', 'D', 'B']);
const R1p = P('R1 - riff + sweeps', { pc: riffPart(I.pc, 4), bass: riffPart(I.bass, 3, { accent: 48, mute: 34 }), kit: kit('gallop', { crashEvery: 4 }),
  shred: sweeps(['Em', 'Em', 'Em', 'Em'], 0, { onlyFirstOfTwo: true }) });
const V1t = verse('V1 - twin answer', V1, { twinOn: true });
const V2t = verse('V2 - twin answer', V2, { twinOn: true });
const BRK1 = P('breakdown - low chugs + anvil', { lead: lead(BRK_LEAD), twin: echoHeld(vs(bars(BRK_LEAD), LEAD_GAIN), I.lead, { delay: 6, scale: 0.35, barCut: false }),
  pc: chugs(I.pc, 'E-3'), bass: chugs(I.bass, 'E-3'), kit: kit('half') });
const BRK2 = P('breakdown 2 - chugs', { pc: chugs(I.pc, 'E-3'), bass: chugs(I.bass, 'E-3'), kit: kit('half'),
  shred: sweeps(['Em', 'Em', 'Em', 'Em'], 0, { vol: 24 }) });
const SOLO_PROG = ['Am', 'Em', 'B', 'Em'];
const S1 = P('solo 1 - sweeps', { pc: pcPart(SOLO_PROG, 0, 'eighths'), bass: bassPart(SOLO_PROG, 0, 'eighths'), kit: kit('double', { crashEvery: 2 }),
  shred: sweeps(SOLO_PROG, 0, { vol: 34 }) });
const S2 = P('solo 2 - lead runs', { lead: lead(SOLO_RUNS), twin: echoHeld(vs(bars(SOLO_RUNS), LEAD_GAIN), I.lead, { delay: 3, scale: 0.35 }),
  pc: pcPart(SOLO_PROG, 0, 'eighths'), bass: bassPart(SOLO_PROG, 0, 'eighths'), kit: kit('double', { crashEvery: 2 }) });
const R2p = P('R2 - riff, double kick, full sweeps', { pc: riffPart(I.pc, 4), bass: riffPart(I.bass, 3, { accent: 48, mute: 34 }), kit: kit('double', { crashEvery: 2 }),
  shred: sweeps(['Em', 'Em', 'Em', 'Em'], 0, { vol: 30, followRiff: true }) });
const K1 = chorus('K1 - chorus in F# minor', CHO1, ['Em', 'C', 'G', 'D'], 2);
const K2 = chorus('K2 - chorus in F# minor, to C#', CHO2, ['Em', 'C', 'D', 'B'], 2);
const TURN_PROG = ['C', 'D', 'B', 'B'];
const TURNp = P('turn - C D B, stop-time, fill', {
  lead: lead(TURN), twin: twin(TURN, TURN_PROG), pc: pcPart(TURN_PROG, 0, 'stop'), bass: bassPart(TURN_PROG, 0, 'stop'), kit: kit('stop', { crashEvery: 2 }),
});

writeSong(import.meta.url, {
  title: 'Heliobane - Cinder Crown', bpm: 175, ticks: 6, mixvol: 42,
  message: 'HELIOBANE - Stage 4: Cinder Crown. E minor chip metal, 175 BPM, speed 6.\nGallop riff, twin-lead chorus, low-E breakdown with anvils, sweep solo, chorus up a whole step.\nAll samples synthesized. Source: songs/heliobane_stage4.gen.js (MUSIC-B)',
  samples: [
    fatLoop('scream lead saw', { period: 32, k: 128, mix: 'saw', H: 12, drive: 2.2 }),
    powerChord('power chord', { drive: 3.5, gain: 0.7 }),
    growlBass('forge bass', { drive: 2.8, sq: 0.6, gain: 0.62 }),
    kick('kick metal', { f0: 220, f1: 50, decay: 16, drive: 3, click: 0.7, sec: 0.16, gain: 0.72 }),
    snare('snare crack', { tone: 200, ndecay: 15, drive: 2.2, metal: 0.3, gain: 0.92 }),
    hat('hat closed', 424),
    clank('anvil perc', { base: 420, drive: 2.2, bright: 1.4, sec: 0.5, gain: 0.8 }),
    crash('crash china', 525),
    pulse('shred pulse 25', 0.25),
  ],
  channelnames: ['lead', 'twin / echo', 'power chords', 'bass', 'kick', 'snare', 'hats', 'anvil / crash', 'shred arp'],
  patterns,
  order: [INTRO, V1p, V2p, PREp, C1p, C2p, R1p, V1t, V2t, BRK1, BRK2, S1, S2, R2p, PREp, K1, K2, TURNp],
});
