#!/usr/bin/env node
/**
 * FARSTRAND — "The Hollow Bell" (the chamber of Verrin's Worn: a great glass bell under the ice). 2026-09-26.
 * F# minor (Verrin's key), 60 BPM, speed 6: 4 rows/beat, 16 rows/bar; one row = a 16th (250 ms), one bar = 4 s.
 * Rendered at 48 kHz, where 60 BPM is exact (2000 samples/tick).
 *
 * Identity: sparse, glassy, slow. Almost nothing moves: a held open fifth (a round bass on the root, a glass
 * harmonica on the fifth), one cold-pad tone a chord with the glass harmonica an octave over it, the sea very low,
 * a bubble now and then. Over it the Hollow Bell (the church-bell sample of farstrand_verrin.gen.js, the partials
 * its voice lines ring) says its own words: the motif is its voice phrases (Farstrand tools/audio/synth_bell.py),
 * v_bell_2 "F# C#" (a falling fourth), v_bell_3 "C# E F#" (a question), v_bell_4 "A C# B F#", v_bell_7 "F# E C# B A
 * F#"; its strikes alternate between two channels so each rings on under the next, and echo 6 and 12 rows late
 * (1.5 and 3 s: the chamber). In B the glass answers: the same phrases turned over (rising where the bell fell)
 * on glass bells two octaves up, while the bell tolls each chord's root. C is the chamber alone: the drone, one
 * toll, glints.
 *
 * Phrase map
 *   Intro  F#madd9                   the drone and the sea fading in, one far glint (not looped)
 *   A      F#madd9 F#madd9 F#m7 F#m7 Bm7 Dmaj7 C#sus4 F#m   the bell speaks: F# C#; C# E F#; A C# B F#; F# E C# B A F#
 *   B      Dmaj7 Dmaj7 A A Bm7 Bm7 C#sus4 C#   the glass answers, turned over (C# F#; F# E C#; B D F# A; G# C# F# E#);
 *                                    the bell tolls the roots
 *   C      F#madd9 F#madd9 Dmaj7 C#    the chamber alone: the drone, one toll, two glints; back to A
 * Loop body: orders 1-3 (20 bars, 80 s). Everything synthesized. Source of truth: this file.
 */
import { wave, glassBell, thinPad, mel, line, chart, bass, pattern, jump, writeSongCompact, pingpong, notesOf, hits,
  triads, cutLanes } from './heliobane_stage6.kit.js';
import { echoChannel, nn, ns } from './lib.js';
import { soften, padLane, wind, fadeIn } from './farstrand_halm.gen.js';
import { seaLoop, bubble, hollowBell } from './farstrand_verrin.gen.js';

const I = { bass: 0, pad: 1, glass: 2, hollow: 3, bell: 4, sea: 5, bub: 6 };
const LAYOUT = ['bass', 'drone', 'pad', 'glass', 'hollow', 'hollowB', 'hollowEcho', 'hollowEcho2', 'bells', 'bellEcho', 'bellEcho2',
  'hat', 'sea'];
const PANS = [0x80, 0x74, 0x6c, 0x98, 0x88, 0x78, 0x50, 0xb4, 0x90, 0x44, 0xc0, 0xa0, 0x80];
const KEYS = ['drone', 'pad', 'glass', 'hollow', 'hollowB', 'hollowEcho', 'hollowEcho2', 'bells', 'bellEcho', 'bellEcho2'];

// ---------------------------------------------------------------- the bell's words and the glass's answer
const WORDS = 'f#5/8 c#5/24 | c#5/2 e5/2 f#5/28 | a4/2 c#5/2 b4/2 f#4/26 | f#5/2 e5/2 c#5/2 b4/2 a4/2 f#4/22';
const TOLLS = 'd5/32 | a4/32 | b4/32 | c#5/32';
const ANSWER = 'c#6/8 f#6/24 | f#6/2 e6/2 c#6/28 | b5/2 d6/2 f#6/2 a6/26 | g#5/2 c#6/2 f#6/12~ | e#6/16';
const C_TOLL = 'f#4/32 | r/32';
const C_GLINTS = 'r/8 c#7/8 | r/16 | r/8 a6/8 | g#6/16';
const CH = {
  intro: 'F#madd9', A: 'F#madd9 F#madd9 F#m7 F#m7 Bm7 Dmaj7 C#sus4 F#m', B: 'Dmaj7 Dmaj7 A A Bm7 Bm7 C#sus4 C#',
  C: 'F#madd9 F#madd9 Dmaj7 C#',
};

// ---------------------------------------------------------------- parts
/** The open fifth over the root: one held glass-harmonica note a chord (the fifth, or the sus4's fourth), swelling. */
function drone(segs, rows, { lo = 'C#5', vol = 10 } = {}) {
  const notes = segs.filter((s) => s.row < rows).map((s) => {
    const pc = (s.root + (s.iv.includes(5) ? 5 : 7)) % 12;
    return [s.row, ns(nn(lo) + ((pc - nn(lo)) % 12 + 12) % 12), Math.min(s.len, rows - s.row), vol, ''];
  });
  const ch = line(notes, I.glass, { rows, sustain: 0.8, release: 0.6, vib: null });
  for (const [row, , len] of notes) for (const k of [2, 4, 6]) if (k < len - 1) ch[row + k] = { vol: `v${Math.round(vol * (0.7 + 0.1 * k / 2))}` };
  return ch;
}
/** Strikes alternate between two channels so each rings on under the next: a strike lasts until its channel's
 *  next strike or the end of the strike after it, whichever comes first (never shorter than written). */
function split(notes) {
  const out = notes.map((n, i) => {
    const after = notes[i + 1], lane = notes[i + 2];
    const end = Math.min(lane ? lane[0] : Infinity, after ? after[0] + after[2] : n[0] + n[2]);
    return [n[0], n[1], Math.max(n[2], end - n[0]), n[3], n[4]];
  });
  return [out.filter((_, i) => i % 2 === 0), out.filter((_, i) => i % 2 === 1)];
}
/** A bell line and its two echoes (6 and 12 rows late), cut where they would rub; `ringOn` splits the dry line
 *  over two channels (split above), else the second is empty. */
function rung(str, inst, rows, segs, refs, { vol = 40, s1 = 0.42, s2 = 0.24, ringOn = false } = {}) {
  const notes = mel(str, { vol }), ring = (n) => soften(line(n, inst, { rows, sustain: 0.9, release: 0.7, vib: null }), rows, refs);
  const [a, b] = ringOn ? split(notes) : [notes, []];
  const [e1, e2] = pingpong(line(notes, inst, { rows, sustain: 0.9, release: 0.7, vib: null }), notes, rows, { d1: 6, s1, d2: 12, s2, segs });
  return [ring(a), b.length ? ring(b) : { 0: { note: '^^' } }, e1, e2, notes];
}

function section(name, bars, chordStr, { hollow = null, hollowVol = 56, bells = null, bellVol = 40, padVol = 11, glassVol = 6,
  droneVol = 10, bassVol = 13, seaHi = 9, bubbles = [], extra = {} } = {}) {
  const rows = bars * 16, segs = chart(chordStr), tri = chart(triads(chordStr));
  const parts = { sea: wind(bars, { lo: 3, hi: seaHi, inst: I.sea }), drone: drone(segs, rows, { vol: droneVol }),
    bass: bass(tri, ['R---------------'], I.bass, { rows, lo: 'F#2', vol: bassVol, decay: 0.97 }),
    hat: hits(I.bub, bubbles, { note: 'D-6', vol: 14 }) };
  const refs = [];
  if (hollow) {
    const [ch, chB, e1, e2, notes] = rung(hollow, I.hollow, rows, segs, refs, { vol: hollowVol, ringOn: true });
    Object.assign(parts, { hollow: ch, hollowB: chB, hollowEcho: e1, hollowEcho2: e2 });
    refs.push(notes, notesOf(e1, rows), notesOf(e2, rows));
  }
  if (bells) {
    const [ch, , e1, e2, notes] = rung(bells, I.bell, rows, segs, refs, { vol: bellVol });
    Object.assign(parts, { bells: ch, bellEcho: e1, bellEcho2: e2 });
    refs.push(notes, notesOf(e1, rows), notesOf(e2, rows));
  }
  parts.pad = padLane(segs, tri, rows, refs, { lo: 'E-4', vol: padVol, inst: I.pad });
  parts.glass = echoChannel(parts.pad, { delay: 0, semi: 12, scale: glassVol / padVol, inst: I.glass, rows });
  return pattern(name, bars, cutLanes({ ...parts, ...extra }, KEYS), LAYOUT, PANS);
}

// ---------------------------------------------------------------- sections
const introParts = section('tmp', 1, CH.intro).channels;
const intro = section('intro: the chamber', 1, CH.intro, { seaHi: 8, extra: {
  drone: fadeIn(introParts[LAYOUT.indexOf('drone')], 0, 16), pad: fadeIn(introParts[LAYOUT.indexOf('pad')], 0, 16),
  bells: hits(I.bell, [10], { note: 'C#7', vol: 20 }),
} });
const chamber = section('C: the chamber alone', 4, CH.C, { hollow: C_TOLL, hollowVol: 46, bells: C_GLINTS, bellVol: 30, padVol: 13,
  glassVol: 8, droneVol: 12, seaHi: 11, bubbles: [5, 22, 39, 58] });

const patterns = [
  intro,
  section('A: the bell speaks', 8, CH.A, { hollow: WORDS, bubbles: [13, 45, 90, 117] }),
  section('B: the glass answers', 8, CH.B, { hollow: TOLLS, hollowVol: 40, bells: ANSWER, padVol: 12, glassVol: 7,
    bubbles: [27, 60, 101] }),
  jump(chamber, 1),
];

writeSongCompact(import.meta.url, {
  title: 'Farstrand - The Hollow Bell', bpm: 60, ticks: 6, mixvol: 48,
  message: 'FARSTRAND Worn chamber "The Hollow Bell" (Verrin).\nF# minor, 60 BPM. Orders 1-3 loop.\nThe motif is the Hollow Bell\'s voice phrases.\nAll samples synthesized. Source: songs/farstrand_bell.gen.js',
  samples: [
    wave('round bass', [1, 0.3, 0.1, 0.04]),
    thinPad('cold pad', { amps: [1, 0, 0.3, 0, 0.12, 0, 0.05], spread: 2 }),
    thinPad('glass harmonica', { amps: [1, 0, 0.18, 0, 0.06], spread: 2 }),
    hollowBell(),
    glassBell('glass bell', { sec: 2.4, partials: [[1, 1, 0.9], [2.76, 0.45, 2.6], [5.4, 0.2, 5.5], [8.93, 0.08, 9]] }),
    seaLoop(), bubble(),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
