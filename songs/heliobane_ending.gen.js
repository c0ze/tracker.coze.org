#!/usr/bin/env node
/**
 * HELIOBANE - Ending. After the Solar Lance: bittersweet, triumphant, then quiet.
 * D major (B minor shadows), 120 BPM, speed 6: 4 rows/beat, 16 rows/bar,
 * 64 rows = 4 bars = 8 s. Eleven patterns, ~88 s; the whole piece loops.
 *
 * Thematic callbacks (no new "ending" theme; the game's own tunes come home):
 *   - the stage 5 hero hook (rising arpeggio to a held note, answered A G F# G D)
 *     is rewritten in D major as the anthem;
 *   - Oda's log (the hook at half speed, B minor) is the bittersweet section;
 *   - Old Mott's shop hook returns slowly on a music box, blue notes intact,
 *     because "the last transmission is Wren laughing at something Mott said";
 *   - a distress-beacon ping and a rising two-note "Kid-do?" end it.
 *
 * Phrase map
 *   Dawn    D G Bm A      pad swell, music-box arpeggio, triangle bass.
 *   A1      D G Bm A      anthem hook: D F# A D -> F#6 (held); G F# E F# D.
 *   A2      D G Em A      climbs to B6 over G; the stage-5 descent E G B A G F# E.
 *   B       G A F#m Bm    bridge: long rising notes.
 *   A1+h    anthem with a harmony a chord-tone below.
 *   A2 end  D G A D       cadence; the hook lands on D6 and the drums stop.
 *   Bitter1 Bm G D A      Oda's log on a soft pulse, brushes.
 *   Bitter2 G A F#m Bm    falling answer, ends on B minor.
 *   Mott    D D G D       the shop hook on the music box (blue C and F).
 *   Home    G A D D       the hook in major, slow, on the music box.
 *   Beacon  D             pad, beacon pings, "Kid-do?" -> loops to Dawn.
 */
import { writeSong } from './lib.js';
import {
  up, bars, tr, vs, line, drums, pattern, ROWS, pcOf,
  kick, snare, hat, crash, tom, growlBass, fatLoop, pulse, tri, echoHeld,
} from './heliobane_shop.kit.js';

const I = { lead: 0, arp: 1, pluck: 2, bass: 3, tbass: 4, kick: 5, snare: 6, hat: 7, crash: 8, tom: 9, pad: 10, beacon: 11, soft: 12 };
const TRIAD = { D: [2, 6, 9], G: [7, 11, 2], Bm: [11, 2, 6], A: [9, 1, 4], Em: [4, 7, 11], Fm: [6, 9, 1] }; // Fm = F# minor
const BASS = { D: 'D-3', G: 'G-3', Bm: 'B-2', A: 'A-2', Em: 'E-3', Fm: 'F#3' };
const PAD = { D: ['D-4', 'J47'], G: ['D-4', 'J59'], Bm: ['D-4', 'J49'], A: ['C#4', 'J38'], Em: ['E-4', 'J37'], Fm: ['C#4', 'J58'] };
const nn = (n) => pcOf(n) + 12 * +n[2];
const NAMES = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];
const ns = (v) => NAMES[v % 12] + Math.floor(v / 12);

// ------------------------------------------------------------------ melodies
const A1 = [
  [[0, 'D-5', 2, 40], [2, 'F#5', 2, 42], [4, 'A-5', 2, 44], [6, 'D-6', 2, 46], [8, 'F#6', 8, 52]],
  [[0, 'G-6', 2, 48], [2, 'F#6', 2, 46], [4, 'E-6', 2, 44], [6, 'F#6', 2, 46], [8, 'D-6', 8, 48]],
  [[0, 'D-5', 2, 40], [2, 'F#5', 2, 42], [4, 'B-5', 2, 44], [6, 'D-6', 2, 46], [8, 'F#6', 6, 50], [14, 'G-6', 2, 46]],
  [[0, 'A-6', 6, 52], [6, 'G-6', 2, 46], [8, 'E-6', 7, 48]]];
const A2 = [
  [[0, 'D-5', 2, 40], [2, 'F#5', 2, 42], [4, 'A-5', 2, 44], [6, 'D-6', 2, 46], [8, 'A-6', 6, 52], [14, 'B-6', 2, 50]],
  [[0, 'B-6', 8, 56], [8, 'A-6', 4, 50], [12, 'G-6', 4, 48]],
  [[0, 'E-6', 2, 46], [2, 'G-6', 2, 48], [4, 'B-6', 4, 52], [8, 'A-6', 2, 48], [10, 'G-6', 2, 46], [12, 'F#6', 2, 46], [14, 'E-6', 2, 46]],
  [[0, 'E-6', 4, 48], [4, 'G-6', 4, 48], [8, 'F#6', 4, 46], [12, 'E-6', 4, 44]]];
const BR = [
  [[0, 'B-5', 4, 44], [4, 'D-6', 4, 46], [8, 'G-6', 8, 50]],
  [[0, 'A-6', 4, 50], [4, 'E-6', 4, 46], [8, 'C#6', 8, 48]],
  [[0, 'C#6', 4, 46], [4, 'F#6', 4, 48], [8, 'A-6', 8, 52]],
  [[0, 'B-6', 8, 54], [8, 'F#6', 7, 48]]];
const A2END = [A2[0], A2[1],
  [[0, 'C#6', 4, 48], [4, 'E-6', 4, 50], [8, 'A-6', 8, 54]],
  [[0, 'D-6', 14, 52]]];
const BITTER1 = [
  [[0, 'F#5', 4, 36], [4, 'B-5', 4, 38], [8, 'D-6', 8, 40]],
  [[0, 'B-5', 14, 38]],
  [[0, 'F#5', 4, 36], [4, 'A-5', 4, 38], [8, 'D-6', 8, 40]],
  [[0, 'C#6', 12, 40]]];
const BITTER2 = [
  [[0, 'D-6', 8, 40], [8, 'B-5', 8, 36]],
  [[0, 'C#6', 8, 38], [8, 'E-6', 8, 40]],
  [[0, 'C#6', 12, 38], [12, 'A-5', 4, 34]],
  [[0, 'B-5', 14, 36]]];
// the shop hook (F7 -> D), straight time, blue notes kept: C natural and F natural
const MOTT = [
  [[0, 'A-5', 3, 40], [3, 'F#5', 1, 30], [4, 'A-5', 2, 36], [6, 'B-5', 2, 36], [8, 'C-6', 1, 32], [9, 'C#6', 1, 34], [10, 'D-6', 5, 42]],
  [[0, 'B-5', 2, 38], [2, 'A-5', 2, 34], [4, 'F#5', 4, 38], [10, 'F-5', 1, 30], [11, 'F#5', 1, 32], [12, 'A-5', 3, 36]],
  [[0, 'B-5', 3, 40], [3, 'G-5', 1, 30], [4, 'B-5', 2, 36], [6, 'D-6', 2, 38], [8, 'F-6', 1, 36], [9, 'E-6', 1, 34], [10, 'D-6', 5, 40]],
  [[0, 'B-5', 2, 36], [2, 'A-5', 2, 34], [4, 'C-6', 1, 32], [5, 'B-5', 1, 30], [6, 'A-5', 2, 34], [8, 'F#5', 1, 32], [9, 'A-5', 1, 32], [10, 'D-5', 5, 38]]];
const HOME = [
  [[0, 'D-5', 4, 38], [4, 'F#5', 4, 40], [8, 'A-5', 4, 42], [12, 'D-6', 4, 44]],
  [[0, 'C#6', 8, 42], [8, 'E-6', 8, 40]],
  [[0, 'F#6', 16, 42]],
  [[0, 'D-6', 14, 36]]];

const LEAD_GAIN = 1.1;
const leadLine = (b) => line(vs(bars(b), LEAD_GAIN), I.lead, { vib: 'H54', vibDelay: 3, sustain: 0.8 });
const softLine = (b) => line(bars(b), I.soft, { vib: 'H43', vibDelay: 4, sustain: 0.8, release: 0.5 });
/** Music box: onsets only, no cuts - each pluck decays by itself until the next note. */
const pluckLine = (b) => Object.fromEntries(bars(b).map(([r, n, , v]) => [r, { note: n, instrument: I.pluck, vol: `v${v}` }]));

function harmony(b, prog, scale = 0.6) {
  const ev = [];
  bars(b).forEach(([r, n, l, v]) => {
    const t = TRIAD[prog[Math.min(3, Math.floor(r / 16))]];
    let h = null;
    for (let d = 3; d <= 9 && h === null; d++) if (t.includes(((nn(n) - d) % 12 + 12) % 12)) h = nn(n) - d;
    if (h !== null && l >= 2) ev.push([r, ns(h), l, Math.round(v * scale * LEAD_GAIN)]);
  });
  return line(ev, I.lead, { vib: 'H54', vibDelay: 3, sustain: 0.8 });
}

function arps(prog, { vol = 28, lowFrom = 'D-4', inst = I.arp, gate = 1 } = {}) {
  const ev = [];
  prog.forEach((c, b) => {
    const tones = [];
    for (let v = nn(lowFrom); tones.length < 5; v++) if (TRIAD[c].includes(v % 12)) tones.push(v);
    [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1].forEach((i, k) => {
      if (k % gate) return;
      ev.push([b * 16 + k, ns(tones[i]), gate, k % 4 === 0 ? vol : Math.round(vol * 0.72)]);
    });
  });
  return line(ev, inst, inst === I.pluck ? { sustain: 1, release: 1 } : {});
}

function bass(prog, mode) {
  const ev = [];
  prog.forEach((c, b) => {
    const root = BASS[c], o = b * 16;
    if (mode === 'anthem') for (let r = 0; r < 16; r += 2) ev.push([o + r, r % 4 ? up(root, 12) : root, 2, r % 4 ? 30 : 44]);
    else if (mode === 'soft') ev.push([o, root, 8, 40], [o + 8, up(root, 7), 6, 30]);
    else if (mode === 'held') ev.push([o, root, 14, 40]);
  });
  return line(ev, mode === 'anthem' ? I.bass : I.tbass, { sustain: 0.85, release: 0.6 });
}

const pad = (prog, vol = 22) => line(prog.map((c, b) => [b * 16, PAD[c][0], 15, vol, PAD[c][1]]), I.pad, { sustain: 0.9, release: 0.75 });

function kit(mode, { crashEvery = 0, stopAfter = 99, fill = false } = {}) {
  const k = [], s = [], p = [];
  for (let b = 0; b < 4; b++) {
    const o = b * 16;
    if (b > stopAfter) continue;
    if (mode === 'anthem') {
      k.push([o, I.kick, 56], [o + 8, I.kick, 54], [o + 10, I.kick, 34]);
      s.push([o + 4, I.snare, 50], [o + 12, I.snare, 50]);
      for (let r = 2; r < 16; r += 4) p.push([o + r, I.hat, 20]);
    } else if (mode === 'brush') {
      k.push([o, I.kick, 38]);
      s.push([o + 8, I.snare, 20]);
      for (const r of [4, 12]) p.push([o + r, I.hat, 14]);
    }
    if (crashEvery && b % crashEvery === 0) p.push([o, I.crash, 26]);
  }
  if (fill) { // snare pickup + toms into the next section
    for (let i = s.length - 1; i >= 0; i--) if (s[i][0] >= 56) s.splice(i, 1);
    for (let i = p.length - 1; i >= 0; i--) if (p[i][0] >= 56) p.splice(i, 1);
    s.push([56, I.snare, 30], [58, I.snare, 36], [60, I.snare, 42], [61, I.snare, 44], [62, I.snare, 48], [63, I.snare, 52]);
  }
  if (mode === 'end') { k.push([0, I.kick, 58]); p.push([0, I.crash, 34]); }
  const dedupe = (list) => Object.values(Object.fromEntries(list.map((e) => [e[0], e])));
  return [drums(dedupe(k)), drums(dedupe(s)), drums(dedupe(p))];
}

// ------------------------------------------------------------------ patterns
// channels: 0 lead, 1 echo/harmony, 2 arp, 3 pluck, 4 bass, 5 kick, 6 snare, 7 hats/crash, 8 pad, 9 beacon
const PANS = [0x78, 0xa8, 0x58, 0x98, 0x80, 0x80, 0x84, 0xa8, 0x88, 0x60];
const patterns = [];
function P(name, c) {
  const chans = [c.lead, c.echo, c.arp, c.pluck, c.bass, ...(c.kit || [{}, {}, {}]), c.pad, c.beacon];
  const pat = pattern(name, chans, PANS);
  for (const i of [5, 6, 7]) {
    const e = pat.channels[i][0];
    if (e?.note === '^^' && !chans[i]?.[0]) { const { note, ...rest } = e; if (Object.keys(rest).length) pat.channels[i][0] = rest; else delete pat.channels[i][0]; }
  }
  patterns.push(pat);
  return patterns.length - 1;
}
const echo = (mel, o = {}) => echoHeld(vs(bars(mel), LEAD_GAIN), I.lead, { delay: 3, scale: 0.36, ...o });

const P1 = ['D', 'G', 'Bm', 'A'], P2 = ['D', 'G', 'Em', 'A'], PB = ['G', 'A', 'Fm', 'Bm'], PE = ['D', 'G', 'A', 'D'];

const DAWN = P('dawn', { pluck: arps(P1, { vol: 30, lowFrom: 'A-4', inst: I.pluck, gate: 2 }), bass: bass(P1, 'soft'), pad: pad(P1, 26),
  kit: (() => { const [k, s, p] = kit('none', { fill: true }); return [k, s, p]; })() });
const A1p = P('A1 - anthem hook', { lead: leadLine(A1), echo: echo(A1), arp: arps(P1), bass: bass(P1, 'anthem'), kit: kit('anthem', { crashEvery: 2 }), pad: pad(P1, 14) });
const A2p = P('A2 - climb to B6', { lead: leadLine(A2), echo: echo(A2), arp: arps(P2), bass: bass(P2, 'anthem'), kit: kit('anthem', { crashEvery: 2, fill: true }), pad: pad(P2, 14) });
const Bp = P('B - bridge', { lead: leadLine(BR), echo: echo(BR), arp: arps(PB), bass: bass(PB, 'anthem'), kit: kit('anthem', { crashEvery: 2, fill: true }), pad: pad(PB, 16) });
const A1h = P('A1 + harmony', { lead: leadLine(A1), echo: harmony(A1, P1), arp: arps(P1), bass: bass(P1, 'anthem'), kit: kit('anthem', { crashEvery: 1 }), pad: pad(P1, 14) });
const AEND = P('A2 end - cadence, drums stop', { lead: leadLine(A2END), echo: harmony(A2END, PE), arp: arps(PE.slice(0, 3)), bass: { ...bass(PE.slice(0, 3), 'anthem'), 48: { note: 'D-3', instrument: I.bass, vol: 'v44' }, 49: { vol: 'v36' }, 56: { vol: 'v20' }, 62: { note: '^^' } },
  kit: (() => { const [k, s, p] = kit('anthem', { crashEvery: 2, stopAfter: 2 }); k[48] = { note: 'C-5', instrument: I.kick, vol: 'v58' }; p[48] = { note: 'C-5', instrument: I.crash, vol: 'v36' }; return [k, s, p]; })(),
  pad: pad(PE, 18) });
const BIT1 = P('bittersweet - Oda\'s log in B minor', { lead: softLine(BITTER1), echo: echoHeld(bars(BITTER1), I.soft, { delay: 6, scale: 0.4, barCut: false }),
  bass: bass(['Bm', 'G', 'D', 'A'], 'soft'), kit: kit('brush'), pad: pad(['Bm', 'G', 'D', 'A'], 24) });
const BIT2 = P('bittersweet - falling answer', { lead: softLine(BITTER2), echo: echoHeld(bars(BITTER2), I.soft, { delay: 6, scale: 0.4, barCut: false }),
  arp: arps(PB, { vol: 16, lowFrom: 'A-4', gate: 2 }), bass: bass(PB, 'soft'), kit: kit('brush'), pad: pad(PB, 24) });
const MOTTp = P("Mott's tune on the music box", { pluck: pluckLine(MOTT), bass: bass(['D', 'D', 'G', 'D'], 'held'), pad: pad(['D', 'D', 'G', 'D'], 20) });
const HOMEp = P('home - the hook, slow', { pluck: pluckLine(HOME), echo: echoHeld(bars(HOME), I.pluck, { delay: 6, scale: 0.45, barCut: false, vib: undefined }),
  bass: bass(['G', 'A', 'D', 'D'], 'held'), pad: pad(['G', 'A', 'D', 'D'], 22) });
// beacon: pings on A6 (short, fading), then the pluck asks "Kid-do?" (A5 -> D6, rising)
const beacon = {};
[[0, 15], [8, 10], [16, 15], [24, 10], [32, 12], [40, 7]].forEach(([r, v]) => { beacon[r] = { note: 'A-6', instrument: I.beacon, vol: `v${v}` }; beacon[r + 1] = { note: '^^' }; });
const BEACONp = P('beacon - "Kid-do?"', { beacon, pluck: pluckLine([[], [], [], [[0, 'A-5', 3, 40], [4, 'D-6', 8, 42]]]),
  bass: bass(['D', 'D', 'D', 'D'], 'held'), pad: { ...pad(['D', 'D', 'D'], 20), 48: { note: 'D-4', instrument: I.pad, vol: 'v16', fx: 'J47' },
    ...Object.fromEntries(Array.from({ length: 15 }, (_, i) => [49 + i, { vol: `v${Math.max(0, 16 - (i + 1))}`, fx: 'J47' }])) } });

writeSong(import.meta.url, {
  title: 'Heliobane - Ending', bpm: 120, ticks: 6, mixvol: 46,
  message: 'HELIOBANE - Ending. D major, 120 BPM. The stage 5 hook as an anthem, Oda\'s log in B minor,\nMott\'s shop tune on a music box, a beacon, "Kid-do?". Loops.\nAll samples synthesized. Source: songs/heliobane_ending.gen.js (MUSIC-B)',
  samples: [
    fatLoop('hero lead square', { period: 32, k: 128, mix: 'square', H: 11, weights: [1, 0.7, 0.7] }),
    pulse('arp pulse 12', 0.125),
    { name: 'music box pluck', synth: { wave: 'pluck', seconds: 1.6, decay: 2.2 } },
    growlBass('anthem bass', { drive: 1.6, sq: 0.4, gain: 0.62 }),
    tri('triangle bass'),
    kick('kick', { f0: 180, f1: 48, decay: 10, drive: 2.2, gain: 0.75 }),
    snare('snare', { tone: 185, ndecay: 12, drive: 1.8, gain: 0.85 }),
    hat('hat closed', 444),
    crash('crash', 545),
    tom('tom perc', { gain: 0.8 }),
    fatLoop('dawn pad', { period: 32, k: 128, mix: 'soft', gain: 0.9 }),
    pulse('beacon pulse 50', 0.5),
    pulse('soft pulse 25', 0.25),
  ],
  channelnames: ['hero lead / soft lead', 'echo / harmony', 'arp', 'music box', 'bass', 'kick', 'snare', 'hats / crash', 'pad', 'beacon'],
  patterns,
  order: [DAWN, A1p, A2p, Bp, A1h, AEND, BIT1, BIT2, MOTTp, HOMEp, BEACONp],
});
