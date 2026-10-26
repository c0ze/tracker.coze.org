#!/usr/bin/env node
/**
 * FARSTRAND — "Mott's Stall" (Old Mott's stall in the Knot: his leitmotif). 2026-09-26.
 * A reprise of Heliobane's shop theme "The Magpie" (heliobane_shop.gen.js), rearranged for Farstrand.
 * F major blues (the Magpie's key; F is also the bII of Halm's E minor, the world's wrong-coloured light),
 * 100 BPM, swung like the Magpie: speed alternates 7/5 ticks a row on a control channel, so rows are swung
 * 16ths (58 %), 4 rows/beat, 16 rows/bar; one bar = 2.4 s. Rendered at 48 kHz, where 100 BPM is exact.
 *
 * Identity: the same tune, colder room. The Magpie's hook, its "shave and a haircut, two bits" gag and its
 * whistled rhythm-changes bridge are Heliobane's notes (copied below); everything around them is Farstrand's:
 * the hook on the hollow glass lead with a dotted-8th (3-row) echo, the clav stabs on the dark filtered-saw
 * pluck (shell voicings as J arpeggios) with their own echo, a round bass walking quarters instead of the
 * slap bass, a soft kit with glass ticks and a wood knock, Farstrand's thin cold pad (one held triad tone a
 * chord, kept clear of the tune), and a hiss of wind under it all:
 * the cold outside the stall. 20 BPM slower than the Magpie. The whistle is the title's soft lead (an ocarina),
 * and the gag rings on glass bells. On the second pass the hook itself turns to glass, an octave up.
 *
 * Phrase map (4-bar patterns)
 *   Intro   F7 vamp                   wind, the bass alone, then the pluck and the kit; the pickup A Bb B (not looped)
 *   A1      F7 F7 Bb7 F7              the hook "C..A C D (D# E) F", the answer's blue fall G# G F
 *   A2      Bb7 Bb7 F7 D7             the hook up a fourth, the answer falling to D7
 *   A3      Gm7 C7 F7 E7              the turnaround, then Mott's gag on lead and glass bells, stop-time "two bits"
 *   B1/B2   A7 A7 D7 D7 | G7 G7 C7 C7 the whistled bridge on the ocarina, down in fifths; bass in two; knock on 2, 4
 *   A1'     F7 F7 Bb7 F7              the hook on glass bells an octave up with a ping-pong echo, the lead resting
 *   A3'     Gm7 C7 F7 C7              the turnaround and the gag; "two bits" E-F on C7 and the pickup back to A1
 * Loop body: orders 1-7 (28 bars, 67.2 s). Everything synthesized. Source of truth: this file; the shared
 * helpers come from farstrand_halm.gen.js, the melodies from heliobane_shop.gen.js.
 */
import { kick, snare, cymbal, noiseLoop, wave, glassBell, thinPad, line, chart, beat, pattern, jump, writeSongCompact,
  canon, pingpong, notesOf, cutLanes, triads } from './heliobane_stage6.kit.js';
import { up } from './lib.js';
import { bars, tr } from './heliobane_shop.kit.js';
import { sawPluck, soften, wind, padLane } from './farstrand_halm.gen.js';

const I = { kick: 0, snare: 1, hat: 2, knock: 3, bass: 4, pluck: 5, lead: 6, whistle: 7, pad: 8, bell: 9, noise: 10 };
const LAYOUT = ['swing', 'kick', 'snare', 'hat', 'bass', 'comp', 'compEcho', 'lead', 'echo', 'pad', 'bells', 'bellEcho', 'bellEcho2', 'wind'];
const PANS = [0x80, 0x80, 0x78, 0xa8, 0x80, 0x5c, 0xa6, 0x88, 0x54, 0x70, 0x9c, 0x5a, 0xb0, 0x80];
const KEYS = ['lead', 'echo', 'comp', 'compEcho', 'pad', 'bells', 'bellEcho', 'bellEcho2'];
const MAPS = {
  kick: { X: [I.kick, 44], x: [I.kick, 30] },
  snare: { X: [I.snare, 26], x: [I.snare, 16], k: [I.knock, 30], K: [I.knock, 38] },
  hat: { X: [I.hat, 22], x: [I.hat, 15], g: [I.hat, 8] },
};

// ------------------------------------------------------------------ the Magpie's notes (heliobane_shop.gen.js)
// chord: bass root, shell voicing (3rd, 7th, root) as one J arpeggio
const CH = {
  F7: ['F-3', 'A-4', 'J68'], Bb7: ['A#2', 'D-5', 'J68'], C7: ['C-3', 'E-4', 'J68'], D7: ['D-3', 'F#4', 'J68'],
  Gm7: ['G-3', 'A#4', 'J79'], E7: ['E-3', 'G#4', 'J68'], A7: ['A-2', 'C#5', 'J68'], G7: ['G-2', 'B-4', 'J68'],
};
const A1 = [
  [[0, 'C-6', 3, 40], [3, 'A-5', 1, 30], [4, 'C-6', 2, 36], [6, 'D-6', 2, 36], [8, 'D#6', 1, 32], [9, 'E-6', 1, 34], [10, 'F-6', 5, 42]],
  [[0, 'D-6', 2, 38], [2, 'C-6', 2, 34], [4, 'A-5', 4, 38], [10, 'G#5', 1, 30], [11, 'A-5', 1, 32], [12, 'C-6', 3, 36]],
  [[0, 'D-6', 3, 40], [3, 'A#5', 1, 30], [4, 'D-6', 2, 36], [6, 'F-6', 2, 38], [8, 'G#6', 1, 36], [9, 'G-6', 1, 34], [10, 'F-6', 5, 40]],
  [[0, 'D-6', 2, 36], [2, 'C-6', 2, 34], [4, 'D#6', 1, 32], [5, 'D-6', 1, 30], [6, 'C-6', 2, 34], [8, 'A-5', 1, 32], [9, 'C-6', 1, 32], [10, 'F-5', 4, 38], [14, 'D-6', 1, 28], [15, 'E-6', 1, 30]],
];
const A2 = [
  tr(A1[0], 5), tr(A1[1], 5),
  [[0, 'C-6', 3, 40], [3, 'A-5', 1, 30], [4, 'C-6', 2, 36], [6, 'D#6', 2, 36], [8, 'D-6', 2, 34], [10, 'C-6', 2, 34], [12, 'A-5', 4, 36]],
  [[0, 'F#5', 2, 36], [2, 'A-5', 2, 34], [4, 'C-6', 2, 36], [6, 'D-6', 3, 38], [9, 'C-6', 1, 30], [10, 'A-5', 3, 34], [13, 'F#5', 1, 28], [14, 'G-5', 2, 32]],
];
const A3head = [
  [[0, 'A#5', 2, 36], [2, 'D-6', 2, 36], [4, 'F-6', 3, 40], [7, 'E-6', 1, 30], [8, 'D-6', 2, 36], [10, 'A#5', 2, 34], [12, 'G-5', 2, 34], [14, 'A-5', 1, 30], [15, 'A#5', 1, 32]],
  [[0, 'C-6', 3, 38], [3, 'A#5', 1, 30], [4, 'G-5', 2, 34], [6, 'E-5', 2, 32], [8, 'G-5', 1, 30], [9, 'A#5', 1, 32], [10, 'C-6', 2, 34], [12, 'E-6', 4, 38]],
];
const HAIRCUT = [[0, 'C-6', 4, 40], [4, 'G-5', 2, 34], [6, 'G-5', 2, 34], [8, 'A-5', 4, 38], [12, 'G-5', 3, 34]]; // shave and a haircut ...
const PICKUP = [[12, 'A-5', 1, 30], [13, 'A#5', 1, 32], [14, 'B-5', 2, 34]];                                  // chromatic walk into C
const TWO_BITS = [[4, 'G#5', 3, 40], [8, 'A-5', 4, 42]];                // ... two bits, on E7 (to the bridge's A7)
const TWO_BITS_HOME = [[4, 'E-6', 3, 40], [8, 'F-6', 3, 42], ...PICKUP]; // ... two bits E-F on C7, back to F
// bridge: a whistled phrase sequenced down in fifths (b7 resolves to the next 3rd)
const X = (root) => [[2, 4, 2, 32], [4, 7, 6, 38], [10, 4, 2, 32], [12, 0, 4, 34], [16, -2, 2, 30], [18, 0, 2, 32], [20, 4, 2, 34], [22, 7, 2, 36], [24, 10, 6, 40]]
  .map(([r, s, l, v]) => [r, up(root, s), l, v]);
const B1 = [...X('A-5'), ...X('D-5').map(([r, ...e]) => [r + 32, ...e])];
const B2 = [...X('G-5'),
  [34, 'E-6', 2, 32], [36, 'G-6', 6, 38], [42, 'E-6', 2, 32], [44, 'C-6', 4, 34],
  [48, 'A#5', 2, 32], [50, 'C-6', 2, 32], [52, 'E-6', 2, 34], [54, 'G-6', 2, 36], [56, 'A#6', 3, 40],
  [59, 'A-6', 1, 32], [60, 'G-6', 1, 32], [61, 'F-6', 1, 32], [62, 'E-6', 1, 34], [63, 'D-6', 1, 36]];

// ------------------------------------------------------------------ Farstrand's arrangement
const ROWS = 64;
const swing = () => Object.fromEntries(Array.from({ length: ROWS }, (_, r) => [r, { fx: r % 2 ? 'A05' : 'A07' }]));
const nextOf = (prog, b, next) => (b + 1 < prog.length ? prog[b + 1] : next);
const quality = (c) => (c.startsWith('Gm') ? 3 : 4);

/** A round bass walking quarters (root, 3rd, 5th, then a half step into the next root); `two`: half notes. */
function walk(prog, next, { stop = -1, two = false, vol = 37 } = {}) {
  const ev = [];
  prog.forEach((c, b) => {
    const root = CH[c][0], o = b * 16, nx = nextOf(prog, b, next);
    if (b === stop) { ev.push([o + 4, root, 3, vol + 4], [o + 8, root, 3, vol + 4]); return; }
    const app = nx === c ? up(root, 10) : up(CH[nx][0], -1);
    const steps = two ? [[0, root, 6], [8, up(root, 7), 4], [14, app, 2]]
      : [[0, root, 3], [4, up(root, quality(c)), 3], [8, up(root, 7), 3], [12, app, 3]];
    steps.forEach(([r, n, l], k) => ev.push([o + r, n, l, k === 0 ? vol : vol - 6]));
  });
  return line(ev, I.bass, { rows: ROWS, sustain: 0.85, release: 0.6, vib: null });
}
/** The clav's stabs on the pluck: the shell voicing as a J arpeggio, stamped on every row it sounds. */
function comp(prog, { stop = -1, light = false, vol = 32 } = {}) {
  const ch = {};
  prog.forEach((c, b) => {
    const [, base, j] = CH[c], o = b * 16;
    const hits = b === stop ? [[4, 3, vol + 6], [8, 3, vol + 6]]
      : light ? [[4, 2, vol], [12, 2, vol]] : [[2, 1, vol], [5, 1, vol - 7], [10, 1, vol], [13, 1, vol - 7]];
    for (const [r, l, v] of hits) {
      ch[o + r] = { note: base, instrument: I.pluck, vol: `v${v}`, fx: j };
      for (let k = 1; k < l; k++) ch[o + r + k] = { vol: `v${Math.round(v * 0.7)}`, fx: j };
      if (!ch[o + r + l]) ch[o + r + l] = { note: '^^' };
    }
  });
  return ch;
}
/** A plain echo of the stabs, `delay` rows later and softer (the dotted-8th of every Farstrand track); a stab
 *  whose echo would cross the bar line into the next chord is not echoed. */
function echoOfComp(ch, delay = 3, scale = 0.4) {
  const out = {};
  for (const [r, e] of Object.entries(ch)) {
    if (Math.floor((+r + delay) / 16) !== Math.floor(+r / 16)) continue;
    out[+r + delay] = e.vol ? { ...e, vol: `v${Math.round(Number(e.vol.slice(1)) * scale)}` } : { ...e };
  }
  for (let r = 16; r < ROWS; r += 16) if (!out[r]) out[r] = { note: '^^' }; // nothing rings into the next chord
  return out;
}
const GROOVE = {
  light: { kick: 'X.........x.....', snare: '....K.......K...', hat: 'x.g.x.g.x.g.x.g.' },
  full: { kick: 'X......x..X.....', snare: '....X.......X..x', hat: 'XgxgXgxgXgxgXgxg' },
  stop: { kick: '....X...........', snare: '........X.......', hat: '................' },
  fill: { kick: 'X......x..X.....', snare: '....X.......XxXX', hat: 'XgxgXgxgXgxg....' },
  none: { kick: '................', snare: '................', hat: '................' },
};
/** The kit's three lanes over four bars: the style's groove, silent before `from`, stop time, a last-bar fill. */
function kit(style, { stop = -1, from = 0, fillLast = false } = {}) {
  const grooves = [0, 1, 2, 3].map((b) => (b < from ? GROOVE.none : b === stop ? GROOVE.stop
    : fillLast && b === 3 ? GROOVE.fill : GROOVE[style]));
  return Object.fromEntries(Object.keys(MAPS).map((k) => [k, beat(grooves.map((g) => g[k]), MAPS[k])]));
}

/** One 4-bar pattern. `melody` and `bellMel` are [row, note, len, vol] lists over the 64 rows. */
function section(name, prog, next, { melody = null, whistle = false, bellMel = null, gag = null, stop = -1, style = 'full',
  from = 0, fillLast = false, walkTwo = false, compLight = false, compVol = 32, windHi = 7, extra = {} } = {}) {
  const segs = chart(prog.join(' ')), parts = { swing: swing(), ...kit(style, { stop, from, fillLast }),
    bass: walk(prog, next, { stop, two: walkTwo }), comp: comp(prog, { stop, light: compLight, vol: compVol }),
    wind: wind(4, { lo: 3, hi: windHi, inst: I.noise }) };
  parts.compEcho = echoOfComp(parts.comp);
  const refs = [];
  if (melody) {
    const notes = melody.map(([r, n, l, v]) => [r, n, l, v, '']);
    const ch = line(notes, whistle ? I.whistle : I.lead, { rows: ROWS, sustain: 0.8, release: 0.5, vib: whistle ? 'H33' : 'H43', vibDelay: 3 });
    parts.lead = ch; refs.push(notes);
    parts.echo = canon(ch, notes, ROWS, { delay: 3, scale: 0.42, segs });
    refs.push(notesOf(parts.echo, ROWS));
  }
  if (gag) { // the gag on glass bells, an octave over the lead, in the bars that hold it
    const notes = gag.map(([r, n, l, v]) => [r, up(n, 12), l, Math.round(v * 0.9), '']);
    const ch = soften(line(notes, I.bell, { rows: ROWS, vib: null }), ROWS, refs);
    parts.bells = ch;
    parts.bellEcho = canon(ch, notes, ROWS, { delay: 3, scale: 0.4, segs, refs });
    refs.push(notes, notesOf(parts.bellEcho, ROWS));
  }
  if (bellMel) {
    const notes = bellMel.map(([r, n, l, v]) => [r, up(n, 12), l, Math.min(60, v + 16), '']);
    const ch = line(notes, I.bell, { rows: ROWS, vib: null });
    parts.bells = ch;
    [parts.bellEcho, parts.bellEcho2] = pingpong(ch, notes, ROWS, { d1: 3, s1: 0.42, d2: 6, s2: 0.22, segs });
    refs.push(notes, notesOf(parts.bellEcho, ROWS), notesOf(parts.bellEcho2, ROWS));
  }
  // Farstrand's thin cold pad: one held triad tone a chord, the one that rubs least against the tune
  parts.pad = padLane(segs, chart(triads(prog.join(' '))), ROWS, refs, { lo: 'F-4', vol: 11, inst: I.pad });
  return pattern(name, 4, cutLanes({ ...parts, ...extra }, KEYS), LAYOUT, PANS);
}

const at16 = (b, events) => bars([...Array(b).fill([]), events]);
const intro = section('intro: Mott tunes up', ['F7', 'F7', 'F7', 'F7'], 'F7', { melody: at16(3, PICKUP), style: 'light', from: 2,
  windHi: 10, extra: { comp: Object.fromEntries(Object.entries(comp(['F7', 'F7', 'F7', 'F7'])).filter(([r]) => +r >= 16)) } });
const patterns = [
  intro,
  section('A1: the hook', ['F7', 'F7', 'Bb7', 'F7'], 'Bb7', { melody: bars(A1), style: 'light' }),
  section('A2: the hook up a fourth', ['Bb7', 'Bb7', 'F7', 'D7'], 'Gm7', { melody: bars(A2) }),
  section('A3: turnaround and the gag', ['Gm7', 'C7', 'F7', 'E7'], 'A7', { melody: bars([...A3head, HAIRCUT, TWO_BITS]), stop: 3,
    gag: [...at16(2, HAIRCUT), ...at16(3, TWO_BITS)] }),
  section('B1: the whistled bridge', ['A7', 'A7', 'D7', 'D7'], 'G7', { melody: B1, whistle: true, style: 'light', walkTwo: true,
    compLight: true, compVol: 26 }),
  section('B2: the bridge runs home', ['G7', 'G7', 'C7', 'C7'], 'F7', { melody: B2, whistle: true, style: 'light', walkTwo: true,
    compLight: true, compVol: 26, fillLast: true }),
  section('A1 in glass', ['F7', 'F7', 'Bb7', 'F7'], 'Bb7', { bellMel: bars(A1), compVol: 28, windHi: 9 }),
  jump(section('A3 home: two bits', ['Gm7', 'C7', 'F7', 'C7'], 'F7', { melody: bars([...A3head, HAIRCUT, TWO_BITS_HOME]), stop: 3,
    gag: [...at16(2, HAIRCUT), ...at16(3, TWO_BITS_HOME.slice(0, 2))] }), 1),
];

writeSongCompact(import.meta.url, {
  title: "Farstrand - Mott's Stall", bpm: 100, ticks: 7, mixvol: 48,
  message: "FARSTRAND \"Mott's Stall\": a reprise of HELIOBANE's shop theme \"The Magpie\".\nF blues, 100 BPM, swung 16ths (speed 7/5). Orders 1-7 loop.\nAll samples synthesized. Source: songs/farstrand_mott.gen.js",
  samples: [
    kick({ f0: 120, f1: 44, sweep: 24, decay: 8, click: 0.08, drive: 1.4, sec: 0.45 }),
    snare({ tone: 196, decay: 14, sec: 0.3, seed: 13, drive: 1.3 }),
    cymbal('glass tick', { sec: 0.05, decay: 90, seed: 17, metalMix: 0.7 }),
    { ...kick({ f0: 330, f1: 190, sweep: 70, decay: 28, click: 0.25, drive: 1.3, sec: 0.16 }), name: 'wood knock' },
    wave('round bass', [1, 0.35, 0.14, 0.06, 0.03]),
    sawPluck('saw pluck', { open: 3000, closed: 360, close: 6, decay: 3.4, sec: 1.0 }),
    wave('glass lead', [1, 0.03, 0.45, 0.02, 0.22, 0.02, 0.1, 0, 0.05]),
    wave('soft lead', [1, 0, 0.16, 0, 0.05, 0, 0.02]),
    thinPad('cold pad', { amps: [1, 0, 0.25, 0, 0.1], spread: 1 }),
    glassBell('glass bell', { sec: 1.4, partials: [[1, 1, 1.9], [2.76, 0.45, 4.5], [5.4, 0.22, 8], [8.93, 0.1, 14]] }),
    noiseLoop(),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
