#!/usr/bin/env node
/**
 * FARSTRAND — "The Strand" (the strand ride: Hesper falls down the outside of a strand). 2026-09-26.
 * D minor (the title's key: this is the far strand itself), 140 BPM, speed 6: 4 rows/beat, 16 rows/bar;
 * one row = a 16th (107 ms), one bar = 1.71 s. Rendered at 44128 Hz, the smallest rate over 44.1 kHz where
 * 140 BPM is exact (788 samples/tick).
 *
 * Identity: Heliobane's energy in Farstrand's palette. The ride is the Heliobane homage (a vertical fall), so
 * the drive is Heliobane's: a gritty rolled-off saw bass galloping 3+3+2 (the Heralds' rhythm), low dark drums
 * and glass ticks. The colour stays Farstrand's: the dark filtered-saw pluck rolling 16ths with its dotted-8th
 * (3-row) delay panned opposite, a held cold pad, the hollow glass lead with a 3/6-row ping-pong echo, wind.
 * The hook is the title motif ("A—F——E | D———", 5 up a minor sixth to b3, 2, 1) thrown into the 3-3-2 gallop;
 * its answer lifts onto Eb (bII, Halm's wrong light). In B glass shards fall past: falling three-note bell
 * figures on every half bar, with their own ping-pong echo. C quotes Heliobane stage 1's hook ("1 b3 4 | 5",
 * heliobane_stage1.gen.js "E G A | B——") in D over a falling Dm C Bb A, bells on the 3-3-2 accents.
 *
 * Phrase map
 *   Intro  Dm Dm                    the gallop bass and glass ticks, drums and a fill in bar 2, a riser (not looped)
 *   A      Dm Dm Bb C | Dm Dm Eb A7  "A F E | D——" in 3-3-2 and a run up; answer G F D | Bb, C D E | G;
 *                                    again, a run down, the lift onto Eb (Bb Eb G | Bb), A G E C#
 *   B      Bb C Dm Dm | Bb C Eb A    driving 8ths; long lead notes (D, E, A, then F E D A); shards falling past
 *   C      Dm C Bb A | Dm C Bb A     the Heliobane hook "D F G | A——" and its sequence down the chords; bells on
 *                                    the 3-3-2 accents two octaves up
 *   Turn   Eb A                      no lead: shards, a snare roll and a riser; the loop jumps back to A
 * Loop body: orders 1-4 (26 bars, 44.6 s). Everything synthesized. Source of truth: this file; the shared
 * helpers come from farstrand_halm.gen.js.
 */
import { kick, cymbal, noiseLoop, wave, glassBell, thinPad, mel, line, chart, at, bass, pattern, jump,
  writeSongCompact, ladder, pingpong, notesOf, drumKit, triads, cutLanes, riser } from './heliobane_stage6.kit.js';
import { nn, ns } from './lib.js';
import { sawPluck, soften, delayLine, padLane, wind } from './farstrand_halm.gen.js';

const I = { kick: 0, snare: 1, hat: 2, tom: 3, bass: 4, pluck: 5, lead: 6, pad: 7, bell: 8, noise: 9 };
const LAYOUT = ['kick', 'snare', 'hat', 'bass', 'arp', 'canon', 'lead', 'echo', 'echo2', 'pad', 'bells', 'bellEcho', 'wind', 'fx'];
const PANS = [0x80, 0x78, 0xac, 0x80, 0x56, 0xaa, 0x86, 0x50, 0xb4, 0x70, 0x9c, 0x5c, 0x80, 0x88];
const KEYS = ['lead', 'echo', 'echo2', 'arp', 'canon', 'pad', 'bells', 'bellEcho'];
const drums = drumKit({
  kick: { X: [I.kick, 60], x: [I.kick, 44] },
  snare: { X: [I.snare, 50], x: [I.snare, 34], g: [I.snare, 14], t: [I.tom, 46, null, 'C-5'], T: [I.tom, 50, null, 'G-4'] },
  hat: { X: [I.hat, 20], x: [I.hat, 13], g: [I.hat, 7] },
});

// ---------------------------------------------------------------- grooves (Heliobane's 3+3+2)
const G = {
  gallop: { kick: 'X..X..X.X..X..X.', snare: '....X.......X...', hat: 'XgxgXgxgXgxgXgxg' },
  drive: { kick: 'X.X.X.X.X.X.X.X.', snare: '....X.......X...', hat: 'XgxgXgxgXgxgXgxg' },
  ticks: { kick: '................', snare: '................', hat: 'x.g.x.g.x.g.x.g.' },
  fill: { kick: 'X..X..X.X.......', snare: '....X...XxXxtTtT', hat: 'XgxgXgxg........' },
  roll: { kick: 'X...X...X...X...', snare: 'XxXxXxXxXXXXXXXX', hat: '................' },
};
const BASS = { gallop: ['RroRroRoRroRroRo', 'RroRroRoRroRt-o-'], drive: ['R-r-R-r-R-r-R-o-'] };

// ---------------------------------------------------------------- melodies
const MOTIF = 'a5/3 f6/3 e6/2 d6/8~'; // the title motif, 5 up a minor sixth to b3, 2, 1, in 3-3-2
const A_MEL = `${MOTIF} | r/8 c6/2 d6 e6 f6 | g6/3 f6/3 d6/2 bb5/8~ | c6/3 d6/3 e6/2 g6/8`
  + ` | ${MOTIF} | r/8 f6/2 e6 d6 c6 | bb5/3 eb6/3 g6/2 bb6/8~ | a6/4 g6 e6 c#6`;
const B_MEL = 'd6/12~ f6/4 | e6/12~ g6/4 | a6/16~ | f6/4 e6 d6 a5 | d6/12~ f6/4 | g6/12~ c7/4 | bb6/8 g6/8 | a6/8~ e6/4 c#6';
const HOOK = 'd6/3 f6/3 g6/2 a6/8~'; // Heliobane stage 1's hook "E G A | B——" (1 b3 4 | 5), in D
const C_MEL = `${HOOK} | g6/3 e6/3 c6/2 e6/8 | f6/3 d6/3 bb5/2 d6/8 | e6/4 c#6 a5 c#6`
  + ` | ${HOOK} | c7/3 g6/3 e6/2 g6/8 | d7/3 bb6/3 f6/2 bb6/8 | a6/4 e6 c#6 e6`;
const CH = { intro: 'Dm Dm', A: 'Dm Dm Bb C Dm Dm Eb A7', B: 'Bb C Dm Dm Bb C Eb A', C: 'Dm C Bb A Dm C Bb A', turn: 'Eb A' };
const ROLL = [0, 2, 3, 5, 4, 2, 3, 1, 0, 2, 3, 5, 6, 5, 3, 2];

// ---------------------------------------------------------------- parts
const TAU = 2 * Math.PI, ACC = [0, 3, 6, 8, 11, 14];
/** The Herald's dark snare: a two-mode body, its noise through a two-pole low-pass (about 2 kHz). */
function darkSnare(name = 'dark snare', { tone = 170, sec = 0.3, seed = 43, lp = 0.45, drive = 1.5 } = {}) {
  const sr = 22050, n = Math.round(sec * sr), d = new Array(n);
  let s = seed >>> 0, a = 0, b = 0;
  const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 2147483648 - 1; };
  for (let i = 0; i < n; i++) {
    const t = i / sr, w = rnd();
    a += lp * (w - a); b += lp * (a - b);
    const body = (Math.sin(TAU * tone * t) * Math.exp(-t * 24) + 0.5 * Math.sin(TAU * tone * 1.71 * t) * Math.exp(-t * 34)) * 0.9;
    d[i] = Math.tanh(drive * (body + b * 2.4 * Math.exp(-t * 12) + w * Math.exp(-t * 400) * 0.25));
  }
  for (let i = 0; i < 48; i++) d[n - 1 - i] *= i / 48;
  let m = 0; for (const x of d) m = Math.max(m, Math.abs(x));
  return { name, samplerate: sr, channels: [d.map((x) => Math.round((x / m) * 970) / 1000)], role: 'percussion' };
}
/** The chord's `k` tones from `lo` upward. */
function rungsOf(seg, lo, k) {
  const out = [];
  for (let p = nn(lo); out.length < k; p++) if (seg.tones.has(p % 12)) out.push(p);
  return out;
}
/** Shards falling past: on every half bar a three-note fall down the chord (16ths), the last left to ring. */
function shards(segs, rows, { lo = 'F-6', vol = 38, starts = [2, 10], ring = 5 } = {}) {
  const notes = [];
  for (let b = 0; b < rows; b += 16) for (const s of starts) {
    const r = rungsOf(at(segs, b + s), lo, 4);
    [[r[3], 1, vol], [r[2], 1, vol - 6], [r[1], ring, vol - 10]].forEach(([n, len, v], i) => notes.push([b + s + i, ns(n), len, v, '']));
  }
  return notes;
}
/** Glass bells on the 3-3-2 accents: the chord's three tones from `lo` up, falling across each group. */
function accentBells(segs, rows, { lo = 'D-6', vol = 24 } = {}) {
  const notes = [];
  for (let r = 0; r < rows; r++) {
    const i = ACC.indexOf(r % 16);
    if (i < 0) continue;
    const next = ACC[i + 1] ?? 16;
    notes.push([r, ns(rungsOf(at(segs, r), lo, 3)[[2, 1, 0][i % 3]]), next - (r % 16), i % 3 ? vol - 6 : vol, '']);
  }
  return notes;
}

function section(name, bars, chordStr, { melody = null, melVol = 42, groove = G.gallop, fill = null, bassR = BASS.gallop,
  bassVol = 40, arpVol = 24, padVol = 16, bellNotes = null, windHi = 10, extra = {} } = {}) {
  const rows = bars * 16, segs = chart(chordStr), tri = chart(triads(chordStr));
  const parts = { ...drums(bars, groove, fill), wind: wind(bars, { lo: 4, hi: windHi, note: 'G-5', inst: I.noise }),
    bass: bass(tri, bassR, I.bass, { rows, lo: 'C-3', vol: bassVol, soft: 0.7, decay: 0.9 }) };
  const refs = [];
  if (melody) {
    const notes = mel(melody, { vol: melVol }), ch = line(notes, I.lead, { rows, vib: 'H33', vibDelay: 3 });
    parts.lead = ch; refs.push(notes);
    [parts.echo, parts.echo2] = pingpong(ch, notes, rows, { d1: 3, s1: 0.4, d2: 6, s2: 0.2, segs });
    refs.push(notesOf(parts.echo, rows), notesOf(parts.echo2, rows));
  }
  if (bellNotes) {
    const notes = bellNotes(segs, rows), ch = soften(line(notes, I.bell, { rows, vib: null }), rows, refs);
    parts.bells = ch;
    parts.bellEcho = soften(delayLine(ch, rows, segs, { delay: 3, scale: 0.4 }), rows, [...refs, notesOf(ch, rows)]);
    refs.push(notesOf(ch, rows), notesOf(parts.bellEcho, rows));
  }
  const arpNotes = ladder(segs, rows, ROLL, { lo: 'D-4', span: 8, vol: arpVol, soft: 7, len: 1 });
  parts.arp = soften(line(arpNotes, I.pluck, { rows, vib: null }), rows, refs);
  parts.canon = soften(delayLine(parts.arp, rows, segs, { delay: 3, scale: 0.4 }), rows, [...refs, notesOf(parts.arp, rows)]);
  parts.pad = padLane(segs, tri, rows, refs, { lo: 'F-4', vol: padVol, inst: I.pad });
  return pattern(name, bars, cutLanes({ ...parts, ...extra }, KEYS), LAYOUT, PANS);
}

// ---------------------------------------------------------------- sections
const intro = section('intro: the gallop', 2, CH.intro, { arpVol: 0, padVol: 12, bassVol: 36, windHi: 14, extra: {
  ...drums(1, G.ticks, null), ...(() => { const d = drums(1, G.gallop, G.fill); return {
    kick: Object.fromEntries(Object.entries(d.kick).map(([r, e]) => [+r + 16, e])),
    snare: Object.fromEntries(Object.entries(d.snare).map(([r, e]) => [+r + 16, e])),
    hat: { ...drums(1, G.ticks, null).hat, ...Object.fromEntries(Object.entries(d.hat).map(([r, e]) => [+r + 16, e])) },
  }; })(),
  arp: { 0: { note: '^^' } }, canon: { 0: { note: '^^' } },
  fx: riser(I.noise, 8, 32, { note: 'C-4', v0: 4, slope: 1.2, fx: 'F03' }),
} });
const turn = section('turn: shards and a roll', 2, CH.turn, { groove: G.drive, fill: G.roll, bassR: BASS.drive, bassVol: 42,
  arpVol: 26, padVol: 20, bellNotes: (s, r) => shards(s, r, { vol: 40, starts: [0, 4, 8, 12], ring: 2 }), windHi: 14,
  extra: { fx: riser(I.noise, 12, 32, { note: 'C-4', v0: 6, slope: 1.6, fx: 'F04' }) } });

const patterns = [
  intro,
  section('A: the title motif at a gallop', 8, CH.A, { melody: A_MEL, fill: G.fill }),
  section('B: shards falling past', 8, CH.B, { melody: B_MEL, melVol: 40, groove: G.drive, bassR: BASS.drive, bassVol: 42,
    arpVol: 26, padVol: 20, bellNotes: shards, fill: G.fill }),
  section('C: the Heliobane hook', 8, CH.C, { melody: C_MEL, melVol: 44, bellNotes: accentBells, padVol: 18, fill: G.fill }),
  jump(turn, 1),
];

writeSongCompact(import.meta.url, {
  title: 'Farstrand - The Strand', bpm: 140, ticks: 6, mixvol: 48,
  message: 'FARSTRAND strand ride "The Strand".\nD minor, 140 BPM. Orders 1-4 loop.\nThe hook is the Farstrand title motif in the HELIOBANE 3-3-2; C quotes HELIOBANE stage 1.\nAll samples synthesized. Source: songs/farstrand_strand.gen.js',
  samples: [
    kick({ f0: 160, f1: 46, sweep: 32, decay: 10, click: 0.3, drive: 2.0, sec: 0.35 }),
    darkSnare(),
    cymbal('glass tick', { sec: 0.05, decay: 100, seed: 17, metalMix: 0.7 }),
    { ...kick({ f0: 180, f1: 90, sweep: 25, decay: 12, click: 0.15, drive: 1.6, sec: 0.35 }), name: 'tom' },
    wave('grit bass', [1, 0.55, 0.38, 0.26, 0.18, 0.12, 0.08, 0.05, 0.03]),
    sawPluck('dark pluck', { open: 2600, closed: 300, close: 7, decay: 4, sec: 0.8 }),
    wave('glass lead', [1, 0.03, 0.45, 0.02, 0.22, 0.02, 0.1, 0, 0.05]),
    thinPad('cold pad', { amps: [1, 0, 0.3, 0, 0.12, 0, 0.05], spread: 1 }),
    glassBell('glass bell', { sec: 1.2, partials: [[1, 1, 2.2], [2.76, 0.45, 5], [5.4, 0.22, 9], [8.93, 0.1, 15]] }),
    noiseLoop(),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
