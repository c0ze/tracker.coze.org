#!/usr/bin/env node
/**
 * FARSTRAND — "The Arbour" (the Halmfolk's grown city, Halm). 2026-09-25.
 * E minor, 84 BPM in 3/4, speed 6: 4 rows/beat, 12 rows/bar; one row = a 16th (179 ms), one bar = 2.14 s.
 * Rendered at 44184 Hz, the smallest rate over 44.1 kHz where 84 BPM is exact (1315 samples/tick).
 *
 * Identity: a music box left running in an empty city. The Halmfolk grew their houses out of trees and the
 * cold grew them into glass; the tune they wound for their children still plays. A waltz-time lullaby on
 * a music-box comb (a tine sample: a clamped bar's 1 : 6.27 partials) over its own lower comb rolling
 * broken chords in 8ths, with Farstrand's dotted-8th (3-row) delay panned opposite, glassy pads (the cold
 * pad and a glass-harmonica octave above it) and a round bass. The lullaby is the title motif turned
 * into a cradle song: "B—G——F#, E———" (5, up a minor sixth to b3, 2, 1), then "B—A——G, F#———"; the
 * answer rises through Cmaj7 and bends on Halm's wrong-coloured bII (F natural: "A G F", F major) before
 * it settles on E. No drums: a wood knock and a glass tick keep the box's clockwork in A2, and the
 * box is wound (a ratchet of ticks) before every pass.
 *
 * Phrase map (chords one per 3/4 bar)
 *   Intro     Em Em Cmaj7 B7            wind, low E, the pads, one tine, the box being wound (not looped)
 *   A         Em Cmaj7 Am Bm | Em Cmaj7 F Em   the lullaby: question "B G F# | E", "B A G | F#"; answer
 *                                         "B G F# | E G B | A G F | E" (the bII F is the wrong note)
 *   A2        same; the glass lead follows the box a bar later and an octave down (a canon, gated so it
 *             never rubs a 2nd against the box); clockwork: a wood knock on 1, glass ticks on 2 and 3
 *   B         C D Bm Em | C D F B7        the box stops. The hollow glass lead of "Halm" sings the world's
 *                                         cell, "E F# G——" (F# is the #11 over C), with its ping-pong
 *                                         echo; the comb slows to quarters; single high tines answer
 *   Run-down  Em Cmaj7 Am Bm | Em Cmaj7 F B7   the box again, running down: two tines are missing (G6, A6
 *                                         leave holes), the tune slows, the wrong F is left alone, the
 *                                         comb thins and fades; last bar: the ratchet winds it, a reverse
 *                                         swell, and the loop jumps back to A
 * Loop body: orders 1-4 (32 bars, 68.6 s). Everything synthesized. Source of truth: this file; the
 * shared helpers come from farstrand_halm.gen.js.
 */
import { kick, cymbal, noiseLoop, wave, thinPad, swell, mel, line, chart, pattern, jump, writeSongCompact,
  ladder, pingpong, canon, notesOf, hits, triads, cutLanes } from './heliobane_stage6.kit.js';
import { nn, ns, echoChannel } from './lib.js';
import { soften, delayLine, padLane, wind } from './farstrand_halm.gen.js';

const TAU = 2 * Math.PI, MID_C = 261.6256, BAR = 12;
const I = { tick: 0, knock: 1, bass: 2, box: 3, lead: 4, pad: 5, glass: 6, noise: 7, swell: 8 };
const LAYOUT = ['knock', 'tick', 'bass', 'comb', 'combEcho', 'box', 'boxEcho', 'lead', 'echo', 'echo2', 'pad', 'glass', 'wind', 'fx'];
const PANS = [0x80, 0xa8, 0x80, 0x5c, 0xac, 0x90, 0x54, 0x84, 0x50, 0xb4, 0x70, 0x98, 0x80, 0x90];
const KEYS = ['comb', 'combEcho', 'box', 'boxEcho', 'lead', 'echo', 'echo2', 'pad', 'glass'];
const v = (x) => `v${Math.max(0, Math.min(64, Math.round(x)))}`;

// ---------------------------------------------------------------- samples
/**
 * Music-box tine: a clamped steel bar (partials 1 : 6.27, a faint octave from the comb) and a pluck click.
 * Synthesized two octaves up (C-7) and tuned down by c5speed, so the high tines play near the native rate
 * and ring about two seconds instead of shrinking to a blip. C-5 = middle C.
 */
function musicBox(name, { sec = 2.6, sr = 44100 } = {}) {
  const n = Math.round(sec * sr), d = new Array(n), f0 = MID_C * 4;
  let s = 7;
  const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 2147483648 - 1; };
  const P = [[1, 1, 1.5], [2, 0.04, 3], [6.27, 0.3, 7]];
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let x = rnd() * Math.exp(-t * 2500) * 0.25;
    for (const [r, a, dec] of P) x += a * Math.sin(TAU * f0 * r * t) * Math.exp(-dec * t);
    d[i] = x * Math.min(1, t * 6000);
  }
  for (let i = 0; i < 256; i++) d[n - 1 - i] *= i / 256;
  let m = 0; for (const x of d) m = Math.max(m, Math.abs(x));
  return { name, samplerate: sr, c5speed: sr / 4, channels: [d.map((x) => Math.round((x / m) * 970) / 1000)] };
}

// ---------------------------------------------------------------- melodies (3/4: 12 rows a bar, no '|')
const A_BOX = 'b5/4 g6/6 f#6/2 e6/12 b5/4 a6/6 g6/2 f#6/12'
  + ' b5/4 g6/6 f#6/2 e6/4 g6 b6 a6/6 g6/2 f6/4 e6/12';
const RUN_BOX = 'b5/4 r/6 f#6/2 e6/12 b5/4 r/6 g6/2 f#6/12'   // two tines gone: G6 and A6 are holes
  + ' b5/6 g6/6 e6/12 f6/12 r/12';                          // slowing, the wrong F alone, then silence
const B_LEAD = 'e5/2 f#5 g5/8 a5/8 f#5/4 d6/6 b5/2 f#5/4 g5/12'
  + ' e5/2 f#5 g5/8 a5/6 b5/2 c6/4 a5/12 d#5/4 f#5 b5';
const B_BOX = 'r/12 a6/12 r/12 g6/12 r/12 f#6/12 r/12 b6/12';  // single tines answering the lead
const CH = {
  intro: 'Em/12 Em Cmaj7 B7', A: 'Em/12 Cmaj7 Am Bm Em Cmaj7 F Em', B: 'C/12 D Bm Em C D F B7',
  run: 'Em/12 Cmaj7 Am Bm Em Cmaj7 F B7',
};
const COMB = [0, 2, 4, 3, 2, 1];  // 8ths through six chord-tone rungs from E4: up and back down, a bar per arch
const COMB_SLOW = [0, 2, 4];      // quarters

// ---------------------------------------------------------------- parts
/** Plucked notes that ring on: only the onset is written, the tine's own decay ends it (with `cut`, a
 *  note is stopped at the end of its written length instead, where nothing else starts there). */
function pluckLane(notes, inst, { cut = false, rows = Infinity } = {}) {
  const ch = Object.fromEntries(notes.map(([r, n, , vol]) => [r, { note: n, instrument: inst, vol: v(vol) }]));
  if (cut) for (const [r, , l] of notes) if (r + l < rows && !ch[r + l]) ch[r + l] = { note: '^^' };
  return ch;
}
/** The chord root on the round bass, held for the chord. */
function rootBass(segs, rows, { lo = 'C-3', vol = 28 } = {}) {
  const notes = segs.filter((s) => s.row < rows)
    .map((s) => [s.row, ns(nn(lo) + ((s.root - nn(lo)) % 12 + 12) % 12), Math.min(s.len, rows - s.row), vol, '']);
  return line(notes, I.bass, { rows, sustain: 0.8, release: 0.45, vib: null });
}
/** Percussion from 12-row (3/4) bar strings; map char -> [instrument, volume, note]. */
function beat3(bars, map) {
  const ch = {};
  bars.forEach((str, b) => [...str].forEach((c, i) => {
    if (c !== '.') ch[b * BAR + i] = { note: map[c][2] ?? 'C-5', instrument: map[c][0], vol: v(map[c][1]) };
  }));
  return ch;
}
/** Winding the box: a ratchet of glass ticks, one per row, getting firmer. */
function ratchet(from, n) {
  const ch = {};
  for (let i = 0; i < n; i++) ch[from + i] = { note: i % 2 ? 'A-5' : 'E-5', instrument: I.tick, vol: v(12 + 1.6 * i + (i % 2 ? 0 : 6)) };
  return ch;
}

function section(name, bars, chordStr, { box = null, boxVol = 48, boxCut = false, fade = null, comb = COMB, combStep = 2, combVol = 24,
  lead = null, follow = false, clock = false, bassVol = 28, padVol = 14, glassVol = 7, windHi = 9, extra = {} } = {}) {
  const rows = bars * BAR, segs = chart(chordStr), tri = chart(triads(chordStr));
  const k = (r) => (fade ? fade(r) : 1);
  const parts = { wind: wind(rows / 16, { hi: windHi, inst: I.noise }), bass: rootBass(tri, rows, { vol: bassVol }) };
  const refs = [];
  let boxNotes = null;
  if (box) {
    boxNotes = mel(box, { vol: boxVol }).map(([r, n, l, vol, m]) => [r, n, l, vol * k(r), m]);
    parts.box = pluckLane(boxNotes, I.box, { cut: boxCut, rows });
    parts.boxEcho = soften(delayLine(parts.box, rows, segs, { delay: 6, scale: 0.34 }), rows, [boxNotes]);
    refs.push(boxNotes, notesOf(parts.boxEcho, rows));
  }
  if (follow && boxNotes) {
    // the glass lead follows the box a bar later, an octave down: a canon gated against the box and the chords
    const notes = boxNotes.map(([r, n, l]) => [r, ns(nn(n) - 12), l, 30, '']);
    parts.lead = canon(line(notes, I.lead, { rows, vib: 'H23', vibDelay: 4 }), boxNotes, rows,
      { delay: BAR, scale: 1, segs, refs: [notesOf(parts.boxEcho, rows)] });
    refs.push(notesOf(parts.lead, rows));
  }
  if (lead) {
    const notes = mel(lead, { vol: 38 }), ch = line(notes, I.lead, { rows, vib: 'H23', vibDelay: 4 });
    parts.lead = ch;
    [parts.echo, parts.echo2] = pingpong(ch, notes, rows, { d1: 3, s1: 0.42, d2: 6, s2: 0.22, segs });
    refs.push(notes, notesOf(parts.echo, rows), notesOf(parts.echo2, rows));
  }
  const combNotes = ladder(segs, rows, comb, { lo: 'E-4', span: 6, vol: combVol, soft: 6, len: combStep })
    .map(([r, n, l, vol, m]) => [r, n, l, vol * k(r), m]).filter(([, , , vol]) => vol >= 4);
  parts.comb = soften(pluckLane(combNotes, I.box), rows, refs);
  parts.combEcho = soften(delayLine(parts.comb, rows, segs, { delay: 3, scale: 0.4 }), rows, [...refs, notesOf(parts.comb, rows)]);
  parts.pad = padLane(segs, tri, rows, refs, { lo: 'E-4', vol: padVol, inst: I.pad });
  parts.glass = echoChannel(parts.pad, { delay: 0, semi: 12, scale: glassVol / padVol, inst: I.glass, rows });
  if (clock) Object.assign(parts, {
    knock: beat3(Array(bars).fill('x...........'), { x: [I.knock, 30] }),
    tick: beat3(Array(bars).fill('....g...g...'), { g: [I.tick, 16] }),
  });
  return pattern(name, rows / 16, cutLanes({ ...parts, ...extra }, KEYS), LAYOUT, PANS);
}

// ---------------------------------------------------------------- sections
const intro = section('intro: the box is wound', 4, CH.intro, { comb: [0], combStep: 48, combVol: 0, bassVol: 24,
  padVol: 12, glassVol: 6, windHi: 11, extra: {
    box: { 12: { note: 'B-6', instrument: I.box, vol: 'v40' } }, boxEcho: { 18: { note: 'B-6', instrument: I.box, vol: 'v14' } },
    tick: ratchet(33, 12), fx: hits(I.swell, [41], { vol: 28 }),
  } });
const runDown = section('run-down: missing tines', 8, CH.run, { box: RUN_BOX, boxVol: 42, bassVol: 24, padVol: 16, windHi: 12,
  fade: (r) => Math.max(0, 1 - 0.1 * Math.floor(r / BAR)), // the box and its comb lose a tenth a bar
  extra: { tick: ratchet(84, 12), fx: hits(I.swell, [89], { vol: 28 }) } });

const patterns = [
  intro,
  section('A: the lullaby', 8, CH.A, { box: A_BOX }),
  section('A2: the canon + clockwork', 8, CH.A, { box: A_BOX, follow: true, clock: true, padVol: 15 }),
  section('B: the Halm cell', 8, CH.B, { box: B_BOX, boxVol: 34, boxCut: true, lead: B_LEAD, comb: COMB_SLOW, combStep: 4, combVol: 22,
    bassVol: 30, padVol: 16, glassVol: 8, windHi: 7,
    extra: { knock: beat3(Array(8).fill('x...........'), { x: [I.knock, 24] }) } }),
  jump(runDown, 1),
];

writeSongCompact(import.meta.url, {
  title: 'Farstrand - The Arbour', bpm: 84, ticks: 6, mixvol: 48,
  message: 'FARSTRAND "The Arbour" (Halm\'s grown city).\nE minor, 84 BPM, 3/4. Orders 1-4 loop.\nAll samples synthesized. Source: songs/farstrand_arbour.gen.js',
  samples: [
    cymbal('glass tick', { sec: 0.05, decay: 90, seed: 17, metalMix: 0.7 }),
    { ...kick({ f0: 330, f1: 190, sweep: 70, decay: 28, click: 0.25, drive: 1.3, sec: 0.16 }), name: 'wood knock' },
    wave('round bass', [1, 0.3, 0.1, 0.04]),
    musicBox('music box'),
    wave('glass lead', [1, 0.03, 0.45, 0.02, 0.22, 0.02, 0.1, 0, 0.05]),
    thinPad('cold pad', { amps: [1, 0, 0.3, 0, 0.12, 0, 0.05], spread: 1 }),
    thinPad('glass harmonica', { amps: [1, 0, 0.18, 0, 0.06], spread: 2 }),
    noiseLoop(), swell('swell', { sec: 1.2, seed: 29 }),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
