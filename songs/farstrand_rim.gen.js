#!/usr/bin/env node
/**
 * FARSTRAND — "The Rim" (the Knot's frozen edge: deep cold, the tangle ending, the dark beyond). 2026-09-26.
 * A minor (the Knot's key), 64 BPM, speed 6: 4 rows/beat, 16 rows/bar; one row = a 16th (234 ms), one bar =
 * 3.75 s. Rendered at 48 kHz, where 64 BPM is exact (3750 samples/tick).
 *
 * Identity: wind, vast, slow. Wind is the foreground: the looped noise swelling, and a howl (a narrow band of
 * noise) that rises five semitones and falls back every two bars, sliding (F01/E01), in and out of phase with
 * the swells; frost ticks now and then. Vast: an open fifth held under everything (a round bass on the root, a
 * glass harmonica on the fifth), the cold pad with the glass harmonica an octave over it, and every voice
 * echoing 6 and 12 rows late (1.4 and 2.8 s). Slow: the chords change every two bars. The family: A plays the
 * Knot's question ("E B—— | A G E | E C—— | B A G#") at half speed on the Knot's glass lead, far off, so the
 * rim is heard as the last thread of the hub. B is the Choir (LORE: heard at the Knot; Heliobane's Ninth Light
 * voices, one voice with copies four semitones down and up, the augmented cluster): a formant pad ("ah") sings
 * that cluster, C E G# over A minor and F A C# over D minor, swelling in and out, and the glass answers it with
 * the Knot's own Choir bells ("E C", "E G#"). C is the dark beyond: the drone, the wind at its highest, one
 * far bell every two bars.
 *
 * Phrase map
 *   Intro  Am Am                         the wind alone, the howl, a low A fading in (not looped)
 *   A      Amadd9 Amadd9 Fmaj7 Fmaj7 | Dm Dm Esus4 E   the Knot's question at half speed on the glass lead,
 *                                        echoes 6 and 12 rows late; frost ticks
 *   B      Am Am Fmaj7 Fmaj7 | Dm Dm E E   the Choir: the cluster C E G# (bars 1-2) and F A C# (5-6) swelling;
 *                                        the glass answers "E C" (3-4) and "E G#" (7-8); the choir's E+ under
 *                                        the last answer
 *   C      Am Am Am Am | Fmaj7 Fmaj7 Esus4 E   the dark beyond: drone, wind and howl at their highest, one bell
 *                                        every two bars (A, E, C, B G#); a reverse swell back into A
 * Loop body: orders 1-3 (24 bars, 90 s). Everything synthesized. Source of truth: this file; the shared helpers
 * come from farstrand_halm.gen.js.
 */
import { cymbal, wave, glassBell, thinPad, swell, mel, line, chart, bass, pattern, jump, writeSongCompact,
  pingpong, notesOf, hits, triads, cutLanes } from './heliobane_stage6.kit.js';
import { echoChannel, nn, ns } from './lib.js';
import { soften, padLane, wind, fadeIn } from './farstrand_halm.gen.js';

const SR = 22050, TAU = 2 * Math.PI;
const q3 = (x) => Math.round(x * 1000) / 1000;
const I = { bass: 0, pad: 1, glass: 2, lead: 3, choir: 4, bell: 5, tick: 6, noise: 7, howl: 8, swell: 9 };
const LAYOUT = ['bass', 'drone', 'pad', 'glass', 'lead', 'echo', 'echo2', 'choirLo', 'choir', 'choirHi', 'bells', 'bellEcho',
  'bellEcho2', 'tick', 'wind', 'howl', 'fx'];
const PANS = [0x80, 0x74, 0x6c, 0x98, 0x88, 0x40, 0xc0, 0x58, 0x80, 0xa8, 0x68, 0xb4, 0x44, 0xa0, 0x80, 0x70, 0x90];
const KEYS = ['lead', 'echo', 'echo2', 'drone', 'pad', 'glass', 'choirLo', 'choir', 'choirHi', 'bells', 'bellEcho', 'bellEcho2'];

// ---------------------------------------------------------------- samples
function rand(seed) { // mulberry32, -1..1 (the kit's generator)
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let v = Math.imul(s ^ (s >>> 15), s | 1);
    v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
    return (((v ^ (v >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}
/** The howl: white noise through a resonant band-pass (Q 9) on middle C x 4 (1046 Hz at C-5), a seamless loop
 *  (its last 2048 samples cross-faded into its start). Its note moves the band: A-4 howls near 880 Hz. */
function howlLoop(name = 'howl', { sec = 1.6, seed = 73, f = 1046.5, q = 9 } = {}) {
  const r = rand(seed), n = Math.round(sec * SR), m = 2048, d = new Array(n + m);
  const w0 = TAU * f / SR, al = Math.sin(w0) / (2 * q), a0 = 1 + al, a1 = -2 * Math.cos(w0) / a0, a2 = (1 - al) / a0, b0 = al / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < n + m; i++) {
    const x = r(), y = b0 * x - b0 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y; d[i] = y;
  }
  for (let i = 0; i < m; i++) d[i] = d[i] * (i / m) + d[n + i] * (1 - i / m);
  let mx = 0; for (let i = 0; i < n; i++) mx = Math.max(mx, Math.abs(d[i]));
  return { name, samplerate: SR, c5speed: SR, channels: [d.slice(0, n).map((x) => q3((x / mx) * 0.85))], loop: { start: 0, end: n },
    role: 'percussion' };
}
/** The rim's wind: white noise through a two-pole low-pass near 1.8 kHz with a little of the raw hiss left on
 *  top (ice dust), darker than the kit's white noise loop; a seamless loop (last 2048 samples cross-faded in). */
function windLoop(name = 'cold wind', { sec = 1.8, seed = 79, lp = 0.4, air = 0.18 } = {}) {
  const r = rand(seed), n = Math.round(sec * SR), m = 2048, d = new Array(n + m);
  let a = 0, b = 0;
  for (let i = 0; i < n + m; i++) { const w = r(); a += lp * (w - a); b += lp * (a - b); d[i] = b + air * w; }
  for (let i = 0; i < m; i++) d[i] = d[i] * (i / m) + d[n + i] * (1 - i / m);
  let mx = 0; for (let i = 0; i < n; i++) mx = Math.max(mx, Math.abs(d[i]));
  return { name, samplerate: SR, channels: [d.slice(0, n).map((x) => q3((x / mx) * 0.85))], loop: { start: 0, end: n }, role: 'percussion' };
}
/** A far choir: three voices of a harmonic series shaped by an "ah" vowel (formants near 700, 1100 and 2500 Hz
 *  for a voice around 200 Hz), each a cycle apart per loop so they beat slowly. */
const choirPad = () => thinPad('choir ah', { amps: [0.5, 0.55, 0.9, 1, 0.7, 0.55, 0.3, 0.15, 0.08, 0.06, 0.08, 0.12, 0.1, 0.05],
  spread: 2, voices: [-1, 0, 1] });

// ---------------------------------------------------------------- melodies
const A_MEL = 'r/8 e5/8 | b5/16~ | a5/12 g5/4 | e5/16~ | r/8 e5/8 | c6/16~ | b5/8 a5/8 | g#5/16';
const B_BELLS = 'r/16 | r/16 | r/4 e6/4 c7/8 | r/16 | r/16 | r/16 | r/4 e6/4 g#6/8 | r/16';
const C_BELLS = 'a6/32 | e6/32 | c7/32 | b6/16 | g#6/16';
// the Choir: [bar, bars, its cluster (a voice and copies four semitones down and up)]
const B_CHOIR = [[0, 2, ['C-4', 'E-4', 'G#4']], [4, 2, ['F-4', 'A-4', 'C#5']], [7, 1, ['E-4', 'G#4', 'C-5']]];
const CH = {
  intro: 'Am Am', A: 'Amadd9/32 Fmaj7/32 Dm/32 Esus4/16 E/16', B: 'Am/32 Fmaj7/32 Dm/32 E/32',
  C: 'Am/64 Fmaj7/32 Esus4/16 E/16',
};

// ---------------------------------------------------------------- parts
/** The open fifth over the root: one held glass-harmonica note a chord (the fifth, or the sus4's fourth), swelling. */
function drone(segs, rows, { lo = 'C#5', vol = 9 } = {}) {
  const notes = segs.filter((s) => s.row < rows).map((s) => {
    const pc = (s.root + (s.iv.includes(5) ? 5 : 7)) % 12;
    return [s.row, ns(nn(lo) + ((pc - nn(lo)) % 12 + 12) % 12), Math.min(s.len, rows - s.row), vol, ''];
  });
  const ch = line(notes, I.glass, { rows, sustain: 0.8, release: 0.6, vib: null });
  for (const [row, , len] of notes) for (const k of [4, 8, 12]) if (k < len - 1) ch[row + k] = { vol: `v${Math.round(vol * (0.75 + 0.08 * k / 4))}` };
  return ch;
}
/** One lane of the Choir: its note of each cluster, swelling in over half the span and fading out. */
function choirLane(clusters, idx, rows, vol) {
  const ch = {};
  for (const [bar, bars, notes] of clusters) {
    const r0 = bar * 16, len = bars * 16;
    ch[r0] = { note: notes[idx], instrument: I.choir, vol: 'v2' };
    for (let k = 2; k < len; k += 2) ch[r0 + k] = { vol: `v${Math.round(2 + (vol - 2) * Math.sin(Math.PI * k / len) ** 1.5)}` };
    if (r0 + len < rows) ch[r0 + len] = { note: '^^' };
  }
  return ch;
}
/** The howl: every `every` rows a note of the howl band sliding up (F01) for half the span and back (E01), its
 *  volume rising with it and falling away. */
function howl(bars, { every = 32, lo = 2, hi = 16, note = 'A-4', offset = 0 } = {}) {
  const rows = bars * 16, ch = {};
  for (let c = offset; c < rows; c += every) {
    ch[c] = { note, instrument: I.howl, vol: `v${lo}` };
    for (let k = 1; k < every && c + k < rows; k++) {
      const up = k < every / 2;
      ch[c + k] = { vol: `v${Math.round(lo + (hi - lo) * Math.sin(Math.PI * k / every) ** 2)}`, fx: up ? 'F01' : 'E01' };
    }
  }
  return ch;
}

function section(name, bars, chordStr, { melody = null, melVol = 30, bells = null, bellVol = 34, choir = null, choirVol = 28,
  ticks = [], padVol = 14, glassVol = 7, droneVol = 9, bassVol = 18, windLo = 6, windHi = 20, howlHi = 16, extra = {} } = {}) {
  const rows = bars * 16, segs = chart(chordStr), tri = chart(triads(chordStr));
  const parts = { wind: wind(bars, { lo: windLo, hi: windHi, inst: I.noise }), howl: howl(bars, { hi: howlHi }),
    tick: hits(I.tick, ticks, { note: 'C-5', vol: 14 }), drone: drone(segs, rows, { vol: droneVol }),
    bass: bass(tri, ['R---------------'], I.bass, { rows, lo: 'A-2', vol: bassVol, decay: 0.98 }) };
  const refs = [];
  if (choir) {
    Object.assign(parts, { choirLo: choirLane(choir, 0, rows, choirVol), choir: choirLane(choir, 1, rows, choirVol),
      choirHi: choirLane(choir, 2, rows, Math.round(choirVol * 0.8)) });
    for (const k of ['choirLo', 'choir', 'choirHi']) refs.push(notesOf(parts[k], rows));
  }
  if (melody) {
    const notes = mel(melody, { vol: melVol }), ch = line(notes, I.lead, { rows, vib: 'H23', vibDelay: 6 });
    parts.lead = ch; refs.push(notes);
    [parts.echo, parts.echo2] = pingpong(ch, notes, rows, { d1: 6, s1: 0.45, d2: 12, s2: 0.25, segs });
    refs.push(notesOf(parts.echo, rows), notesOf(parts.echo2, rows));
  }
  if (bells) {
    const notes = mel(bells, { vol: bellVol }), ch = soften(line(notes, I.bell, { rows, vib: null }), rows, refs);
    parts.bells = ch;
    [parts.bellEcho, parts.bellEcho2] = pingpong(ch, notes, rows, { d1: 6, s1: 0.45, d2: 12, s2: 0.25, segs });
    refs.push(notes, notesOf(parts.bellEcho, rows), notesOf(parts.bellEcho2, rows));
  }
  parts.pad = padLane(segs, tri, rows, refs, { lo: 'E-4', vol: padVol, inst: I.pad });
  parts.glass = echoChannel(parts.pad, { delay: 0, semi: 12, scale: glassVol / padVol, inst: I.glass, rows });
  return pattern(name, bars, cutLanes({ ...parts, ...extra }, KEYS), LAYOUT, PANS);
}

// ---------------------------------------------------------------- sections
const introParts = section('tmp', 2, CH.intro).channels;
const intro = section('intro: the wind', 2, CH.intro, { windLo: 5, windHi: 18, extra: {
  bass: fadeIn(introParts[LAYOUT.indexOf('bass')], 8, 30), drone: fadeIn(introParts[LAYOUT.indexOf('drone')], 12, 32),
  pad: { 0: { note: '^^' } }, glass: { 0: { note: '^^' } }, howl: howl(2, { hi: 10, offset: 0 }),
  fx: hits(I.swell, [26], { vol: 24 }),
} });
const dark = section('C: the dark beyond', 8, CH.C, { bells: C_BELLS, bellVol: 28, ticks: [21, 23, 70, 73, 74, 110], padVol: 12,
  glassVol: 6, droneVol: 11, windLo: 8, windHi: 26, howlHi: 22, extra: { fx: hits(I.swell, [122], { vol: 26 }) } });

const patterns = [
  intro,
  section('A: the last thread', 8, CH.A, { melody: A_MEL, ticks: [13, 46, 49, 97] }),
  section('B: the Choir', 8, CH.B, { bells: B_BELLS, choir: B_CHOIR, padVol: 12, glassVol: 6, windHi: 16, howlHi: 12, ticks: [58, 90] }),
  jump(dark, 1),
];

writeSongCompact(import.meta.url, {
  title: 'Farstrand - The Rim', bpm: 64, ticks: 6, mixvol: 48,
  message: 'FARSTRAND "The Rim": the Knot\'s frozen edge.\nA minor, 64 BPM. Orders 1-3 loop.\nThe Choir, heard not met.\nAll samples synthesized. Source: songs/farstrand_rim.gen.js',
  samples: [
    wave('round bass', [1, 0.3, 0.1, 0.04]),
    thinPad('cold pad', { amps: [1, 0, 0.3, 0, 0.12, 0, 0.05], spread: 1 }),
    thinPad('glass harmonica', { amps: [1, 0, 0.18, 0, 0.06], spread: 2 }),
    wave('glass lead', [1, 0.03, 0.45, 0.02, 0.22, 0.02, 0.1, 0, 0.05]),
    choirPad(),
    glassBell('glass bell', { sec: 3.0, partials: [[1, 1, 0.8], [2.76, 0.45, 2.2], [5.4, 0.2, 4.5], [8.93, 0.08, 8]] }),
    cymbal('frost tick', { sec: 0.05, decay: 90, seed: 19, metalMix: 0.8 }),
    windLoop(), howlLoop(), swell('swell', { sec: 1.2, seed: 31 }),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
