#!/usr/bin/env node
/**
 * FARSTRAND — "Aft" (the Plumbline's aft section, behind the cabin's membrane: dark and cold, forty tally marks on
 * the bulkhead, and Hesper's own body in glass in the crash seat). 2026-09-26.
 * E minor (Halm's key: the Plumbline's rooms play "Halm"), 60 BPM, speed 6: 4 rows/beat, 16 rows/bar; one row =
 * a 16th (250 ms), one bar = 4 s. Rendered at 48 kHz, where 60 BPM is exact (2000 samples/tick).
 *
 * Identity: near silence. No drums, no arp, no pulse: a low E held very softly (the hull), a breath of the cold
 * (the Rim's dark wind, barely there), frost ticking in the glass (forty ticks in the loop, one for each mark on
 * the bulkhead), the hull creaking twice, one cold-pad tone. Over it the Plumbline's own motif, the cell of 'Halm'
 * ('E F# G——', then 'D——B G——', farstrand_halm.gen.js), on Halm's own glass lead, far off, slower (a note is
 * 500 ms where Halm's is 300) and with long echoes (6 and 12 rows: 1.5 and 3 s), and broken: whole once; its
 * answer stops before the G; then it stops on F#; in B the G comes back wrong, F natural (the bII, Halm's wrong
 * light, as in the Arbour's run-down), and last only the E is left. The loop is 16 bars, 64 s.
 *
 * Phrase map
 *   Intro  Em                            the wind and the low E fading in (not looped)
 *   A      Em Em Em Em Cmaj7 Cmaj7 Em Em  the cell whole ('E F# G——', bar 2); the answer 'D——B' with no G (bar 4);
 *                                        the cell again, stopping on F# (bar 6); frost; a creak; one far glint
 *   B      Em Em Em F Em Em Cmaj7 Cmaj7   'E F#' and the G gone wrong, F over F major (bars 3-4); only the E
 *                                        (bar 6); frost; a creak; a glint; the loop jumps back to A
 * Loop body: orders 1-2 (16 bars, 64 s). Everything synthesized. Source of truth: this file; the shared helpers
 * come from farstrand_halm.gen.js.
 */
import { wave, glassBell, thinPad, clank, cymbal, swell, mel, line, chart, pattern, jump, writeSongCompact, pingpong,
  notesOf, hits, triads, cutLanes } from './heliobane_stage6.kit.js';
import { soften, padLane, wind, fadeIn } from './farstrand_halm.gen.js';

const SR = 22050;
const q3 = (x) => Math.round(x * 1000) / 1000;
const I = { drone: 0, pad: 1, lead: 2, bell: 3, tick: 4, creak: 5, noise: 6, swell: 7 };
const LAYOUT = ['drone', 'pad', 'lead', 'echo', 'echo2', 'bells', 'bellEcho', 'tick', 'creak', 'wind', 'fx'];
const PANS = [0x80, 0x70, 0x84, 0x48, 0xbc, 0x9c, 0x5c, 0xa4, 0x68, 0x80, 0x90];
const KEYS = ['lead', 'echo', 'echo2', 'pad', 'bells', 'bellEcho'];

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
/** The cold: the Rim's wind (white noise through a two-pole low-pass near 1.8 kHz with a little raw hiss for ice
 *  dust), a seamless loop (its last 2048 samples cross-faded into its start). */
function windLoop(name = 'cold wind', { sec = 1.8, seed = 79, lp = 0.4, air = 0.18 } = {}) {
  const r = rand(seed), n = Math.round(sec * SR), m = 2048, d = new Array(n + m);
  let a = 0, b = 0;
  for (let i = 0; i < n + m; i++) { const w = r(); a += lp * (w - a); b += lp * (a - b); d[i] = b + air * w; }
  for (let i = 0; i < m; i++) d[i] = d[i] * (i / m) + d[n + i] * (1 - i / m);
  let mx = 0; for (let i = 0; i < n; i++) mx = Math.max(mx, Math.abs(d[i]));
  return { name, samplerate: SR, channels: [d.slice(0, n).map((x) => q3((x / mx) * 0.85))], loop: { start: 0, end: n }, role: 'percussion' };
}

// ---------------------------------------------------------------- the broken cell
const A_MEL = 'r/16 | r/4 e5/2 f#5/2 g5/8~ | r/16 | r/2 d6/6 b5/2 r/6 | r/16 | r/4 e5/2 f#5/6 r/4 | r/16 | r/16';
const B_MEL = 'r/16 | r/16 | r/12 e5/2 f#5/2 | f5/12~ r/4 | r/16 | r/8 e5/8~ | r/16 | r/16';
const A_BELLS = 'r/16 | r/16 | r/16 | r/16 | r/16 | r/16 | r/8 b6/8 | r/16';
const B_BELLS = 'r/16 | r/16 | r/16 | r/16 | r/16 | r/16 | r/8 g6/8 | r/16';
const CH = { intro: 'Em', A: 'Em Em Em Em Cmaj7 Cmaj7 Em Em', B: 'Em Em Em F Em Em Cmaj7 Cmaj7' };
/** Forty frost ticks over the loop's 256 rows, in small clusters (the marks), seeded; [row, volume]. */
function frost(count = 40, rows = 256, seed = 41) {
  const r = rand(seed), out = new Map();
  while (out.size < count) {
    const at = Math.floor((r() * 0.5 + 0.5) * (rows - 4)), n = 1 + Math.floor((r() * 0.5 + 0.5) * 4);
    for (let k = 0, row = at; k < n && out.size < count && row < rows; k++, row += 1 + ((r() > 0) ? 1 : 0)) {
      if (!out.has(row)) out.set(row, Math.round(14 + (r() * 0.5 + 0.5) * 10));
    }
  }
  return [...out.entries()].sort((a, b) => a[0] - b[0]);
}
const FROST = frost();
const ticksIn = (from, to) => Object.fromEntries(FROST.filter(([r]) => r >= from && r < to)
  .map(([r, v]) => [r - from, { note: 'C-5', instrument: I.tick, vol: `v${v}` }]));

// ---------------------------------------------------------------- parts
/** The hull: a low E held, swelling in over the first half of the section and sinking back, low at both ends so
 *  the loop's retrigger is quiet. */
function drone(bars, { lo = 5, hi = 10 } = {}) {
  const rows = bars * 16, ch = { 0: { note: 'E-3', instrument: I.drone, vol: `v${lo}` } };
  for (let r = 4; r < rows; r += 4) ch[r] = { vol: `v${Math.round(lo + (hi - lo) * Math.sin(Math.PI * r / rows))}` };
  return ch;
}

function section(name, bars, chordStr, { melody = null, bells = null, ticks = {}, creaks = [], padVol = 8, windHi = 6, extra = {} } = {}) {
  const rows = bars * 16, segs = chart(chordStr), tri = chart(triads(chordStr));
  const parts = { drone: drone(bars), wind: wind(bars, { lo: 2, hi: windHi, inst: I.noise }), tick: ticks,
    creak: hits(I.creak, creaks, { note: 'C-4', vol: 20 }) };
  const refs = [];
  if (melody) {
    const notes = mel(melody, { vol: 30 }), ch = line(notes, I.lead, { rows, vib: 'H22', vibDelay: 6 });
    parts.lead = ch; refs.push(notes);
    [parts.echo, parts.echo2] = pingpong(ch, notes, rows, { d1: 6, s1: 0.4, d2: 12, s2: 0.2, segs });
    refs.push(notesOf(parts.echo, rows), notesOf(parts.echo2, rows));
  }
  if (bells) {
    const notes = mel(bells, { vol: 20 }), ch = soften(line(notes, I.bell, { rows, vib: null }), rows, refs);
    parts.bells = ch;
    parts.bellEcho = pingpong(ch, notes, rows, { d1: 6, s1: 0.4, d2: 12, s2: 0.2, segs })[0];
    refs.push(notes, notesOf(parts.bellEcho, rows));
  }
  parts.pad = padLane(segs, tri, rows, refs, { lo: 'G-4', vol: padVol, inst: I.pad });
  return pattern(name, bars, cutLanes({ ...parts, ...extra }, KEYS), LAYOUT, PANS);
}

// ---------------------------------------------------------------- sections
const introParts = section('tmp', 1, CH.intro).channels;
const intro = section('intro: the cold', 1, CH.intro, { extra: {
  drone: fadeIn(introParts[LAYOUT.indexOf('drone')], 0, 16), pad: { 0: { note: '^^' } }, fx: hits(I.swell, [11], { vol: 10 }),
} });
const B = section('B: the wrong note', 8, CH.B, { melody: B_MEL, bells: B_BELLS, ticks: ticksIn(128, 256), creaks: [22] });

const patterns = [
  intro,
  section('A: the cell, broken', 8, CH.A, { melody: A_MEL, bells: A_BELLS, ticks: ticksIn(0, 128), creaks: [40] }),
  jump(B, 1),
];

writeSongCompact(import.meta.url, {
  title: 'Farstrand - Aft', bpm: 60, ticks: 6, mixvol: 48,
  message: 'FARSTRAND "Aft": the Plumbline\'s aft section.\nE minor, 60 BPM. Orders 1-2 loop.\nHalm\'s cell, broken.\nAll samples synthesized. Source: songs/farstrand_aft.gen.js',
  samples: [
    wave('round bass', [1, 0.3, 0.1, 0.04]),
    thinPad('cold pad', { amps: [1, 0, 0.3, 0, 0.12, 0, 0.05], spread: 1 }),
    wave('glass lead', [1, 0.03, 0.45, 0.02, 0.22, 0.02, 0.1, 0, 0.05]),
    glassBell('glass bell', { sec: 3.0, partials: [[1, 1, 0.8], [2.76, 0.45, 2.2], [5.4, 0.2, 4.5], [8.93, 0.08, 8]] }),
    cymbal('frost tick', { sec: 0.05, decay: 90, seed: 19, metalMix: 0.8 }),
    { ...clank('hull creak', { base: 110, drive: 1.2, seed: 29, bright: 0.5, sec: 0.9 }), role: 'percussion' },
    windLoop(), swell('swell', { sec: 1.2, seed: 31 }),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
