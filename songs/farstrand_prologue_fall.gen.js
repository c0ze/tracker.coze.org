#!/usr/bin/env node
/**
 * FARSTRAND — "Prologue: the fall" (the Plumbline's first strand fall, playable, between the prologue's stills and
 * its crash; GDD §15). 2026-10-02.
 * D minor, 150 BPM, speed 6: 4 rows/beat, 16 rows/bar; one row = a 16th (100 ms), one bar = 1.6 s.
 * Rendered at 44.1 kHz, where 150 BPM is exact (735 samples/tick).
 *
 * Identity: the prologue's theme at a gallop. It starts on the downbeat where `prologue` (farstrand_prologue.gen.js,
 * 100 BPM) ends, its roll and reverse swell landing on this cue's first beat; at 150 BPM its dotted quarter is the
 * prologue's beat. The drive is the strand ride's (Heliobane's 3+3+2 gallop: a gritty rolled-off saw bass, low dark
 * drums, glass ticks; the dark pluck rolling 16ths with its dotted-8th canon), the tunes are the prologue's: A is the
 * Survey's call (`benchmark`, the Concord's own theme, here in D minor: 'A D A—— G F | E D E——') flung into the
 * gallop, then the title's question in 3-3-2 ('A F E | D——') lifting onto Eb (the bII). B is the warm thing on the
 * line, coming: the warm pad (even harmonics: sunfed) takes over from the cold one and KELL, its motif (`boss_kell`:
 * the call turned inside out), walks under the glass lead two octaves down in the flesh voice while the lead holds
 * long cold notes; then glass shards fall past and a roll turns it back to A. It loops until the warm thing takes the
 * line (the engine stops it there; the take and the crash are sfx).
 *
 * Phrase map
 *   Drop   Dm A                       the downbeat (kick, low tom, a glass crash, D7 on the bell) and straight into the
 *                                     gallop: drums, bass, the arp; bar 2 turns into A as B's last bar does (A, a snare
 *                                     roll, the same riser), so the loop's seam matches its first entry (not looped)
 *   A      Dm C Bb Gm-A | Dm Dm Eb A7  the call at a gallop, 'A D A—— G F | E D E—— | A D Bb—— A G | F E D C#';
 *                                     the question, 'A F E | D——', a run up, 'Bb G Eb | Bb——', 'A C# E G'
 *   B      Gm Cm Gm Cm | Eb Eb Gm A    8th kicks, the warm pad, KELL twice in the flesh voice under long notes
 *                                     (D G D7 C7); then the gallop, shards falling, 'Bb G | Eb | D Bb | C# E'; a roll
 * Loop body: orders 1-2 (16 bars, 25.6 s). Everything synthesized. Source of truth: this file; the shared helpers come
 * from farstrand_halm.gen.js.
 */
import { kick, snare, cymbal, noiseLoop, wave, glassBell, thinPad, swell, mel, line, chart, at, bass, pattern, jump,
  writeSongCompact, ladder, pingpong, notesOf, drumKit, hits, triads, cutLanes, riser } from './heliobane_stage6.kit.js';
import { nn, ns } from './lib.js';
import { sawPluck, soften, delayLine, padLane, wind } from './farstrand_halm.gen.js';

const I = { kick: 0, snare: 1, hat: 2, tom: 3, bass: 4, pluck: 5, glass: 6, flesh: 7, pad: 8, warm: 9, bell: 10,
  crash: 11, noise: 12 };
const LAYOUT = ['kick', 'snare', 'hat', 'tom', 'bass', 'arp', 'canon', 'lead', 'echo', 'echo2', 'hive', 'pad', 'bells',
  'bellEcho', 'crash', 'wind', 'fx'];
const PANS = [0x80, 0x78, 0xac, 0x84, 0x80, 0x56, 0xaa, 0x86, 0x50, 0xb4, 0x7c, 0x70, 0x9c, 0x5c, 0x8c, 0x80, 0x88];
const KEYS = ['lead', 'echo', 'echo2', 'hive', 'arp', 'canon', 'pad', 'bells', 'bellEcho'];
const drums = drumKit({
  kick: { X: [I.kick, 60], x: [I.kick, 44] },
  snare: { X: [I.snare, 46], x: [I.snare, 30], g: [I.snare, 12], t: [I.tom, 46, null, 'C-5'], T: [I.tom, 50, null, 'G-4'] },
  hat: { X: [I.hat, 20], x: [I.hat, 13], g: [I.hat, 7] },
});

// ---------------------------------------------------------------- grooves (the strand's 3+3+2)
const G = {
  gallop: { kick: 'X..X..X.X..X..X.', snare: '....X.......X...', hat: 'XgxgXgxgXgxgXgxg' },
  drive: { kick: 'X.X.X.X.X.X.X.X.', snare: '....X.......X...', hat: 'XgxgXgxgXgxgXgxg' },
  ticks: { kick: 'X...............', snare: '................', hat: 'x.g.x.g.x.g.x.g.' },
  fill: { kick: 'X..X..X.X.......', snare: '....X...XxXxtTtT', hat: 'XgxgXgxg........' },
  roll: { kick: 'X...X...X...X...', snare: 'XxXxXxXxXXXXXXX.', hat: '................' }, // a 16th's breath before the downbeat
};
const BASS = { gallop: ['RroRroRoRroRroRo', 'RroRroRoRroRt-o-'], drive: ['R-r-R-r-R-r-R-o-'] };

// ---------------------------------------------------------------- melodies
const CALL = 'a5/2 d6/2 a6/8 g6/2 f6/2 | e6/4 d6/4 e6/8 | a5/2 d6/2 bb6/8 a6/2 g6/2 | f6/4 e6/4 d6/4 c#6/4'; // minor
const QUESTION = 'a5/3 f6/3 e6/2 d6/8~ | r/8 a5/2 d6/2 f6/2 a6/2 | bb6/3 g6/3 eb6/2 bb5/8~ | a5/4 c#6/4 e6/4 g6/4';
const B_MEL = 'd6/16~ | g6/16~ | d7/16~ | c7/16~ | bb6/8 g6/8 | eb6/16~ | d6/8 bb5/8 | c#6/8~ e6/8';
const KELL = 'g4/2 d4/2 g3/8 a3/2 bb3/2 | c4/4 d4/4 c4/8';               // boss_kell's motif, two octaves down
const CH = { drop: 'Dm A', A: 'Dm C Bb Gm/8 A/8 Dm/16 Dm Eb A7', B: 'Gm Cm Gm Cm Eb Eb Gm A' };
const ROLL = [0, 2, 3, 5, 4, 2, 3, 1, 0, 2, 3, 5, 6, 5, 3, 2];

// ---------------------------------------------------------------- parts
/** Shards falling past: on every half bar a three-note fall down the chord's tones from `lo`, the last left ringing. */
function shards(segs, rows, { lo = 'F-6', vol = 36, from = 0 } = {}) {
  const notes = [];
  for (let b = from; b < rows; b += 16) for (const s of [2, 10]) {
    const seg = at(segs, b + s), r = [];
    for (let p = nn(lo); r.length < 4; p++) if (seg.tones.has(p % 12)) r.push(p);
    [[r[3], 1, vol], [r[2], 1, vol - 6], [r[1], 5, vol - 10]].forEach(([n, len, v], i) => notes.push([b + s + i, ns(n), len, v, '']));
  }
  return notes;
}
const shift = (ch, by) => Object.fromEntries(Object.entries(ch).map(([r, e]) => [+r + by, e]));

function section(name, bars, chordStr, { melody = null, melVol = 42, hive = null, groove = null, bassR = BASS.gallop,
  bassVol = 40, arpVol = 24, pad = I.pad, padVol = 16, bellNotes = null, windHi = 12, extra = {} } = {}) {
  const rows = bars * 16, segs = chart(chordStr), tri = chart(triads(chordStr));
  const parts = { wind: wind(bars, { lo: 4, hi: windHi, note: 'G-5', inst: I.noise }),
    bass: bass(tri, bassR, I.bass, { rows, lo: 'C-3', vol: bassVol, soft: 0.7, decay: 0.9 }), ...(groove ? groove(bars) : {}) };
  const refs = [];
  if (melody) {
    const notes = mel(melody, { vol: melVol }), ch = line(notes, I.glass, { rows, vib: 'H33', vibDelay: 3 });
    parts.lead = ch; refs.push(notes);
    [parts.echo, parts.echo2] = pingpong(ch, notes, rows, { d1: 3, s1: 0.4, d2: 6, s2: 0.2, segs });
    refs.push(notesOf(parts.echo, rows), notesOf(parts.echo2, rows));
  }
  if (hive) {
    const notes = mel(hive, { vol: 46 });
    parts.hive = line(notes, I.flesh, { rows, sustain: 0.85, release: 0.6, vib: 'H43', vibDelay: 4 });
    refs.push(notes);
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
  parts.pad = padLane(segs, tri, rows, refs, { lo: 'F-4', vol: padVol, inst: pad });
  return pattern(name, bars, cutLanes({ ...parts, ...extra }, KEYS), LAYOUT, PANS);
}

// ---------------------------------------------------------------- sections
const fillLast = (n, main) => (bars) => drums(bars, main, n ? G.fill : null);
const drop = section('drop: off the end of the prologue', 2, CH.drop, { groove: (bars) => drums(bars, G.gallop, G.roll), arpVol: 20, padVol: 14,
  bassVol: 40, windHi: 15, extra: {
    tom: hits(I.tom, [0], { note: 'D-4', vol: 64 }), crash: hits(I.crash, [0], { note: 'C-5', vol: 56 }),
    bells: hits(I.bell, [0], { note: 'D-7', vol: 60 }), fx: riser(I.noise, 16, 32, { note: 'C-4', v0: 6, slope: 1.8, fx: 'F04' }), // as B's turn
  } });
const A = section('A: the call at a gallop', 8, CH.A, { melody: `${CALL} | ${QUESTION}`, groove: fillLast(1, G.gallop),
  extra: { crash: hits(I.crash, [0, 64], { note: 'C-5', vol: 30 }) } });
const bDrums = (bars) => { const a = drums(4, G.drive), b = drums(4, G.gallop, G.roll); return Object.fromEntries(
  ['kick', 'snare', 'hat'].map((k) => [k, { ...a[k], ...shift(b[k], 64) }])); };
const B = section('B: the warm thing on the line', 8, CH.B, { melody: B_MEL, melVol: 40, hive: `${KELL} | ${KELL} | r/16 | r/16 | r/16 | r/16`,
  groove: bDrums, bassR: [...Array(4).fill(BASS.drive[0]), ...BASS.gallop, ...BASS.gallop], bassVol: 42, arpVol: 22,
  pad: I.warm, padVol: 20, bellNotes: (s, r) => shards(s, r, { from: 64, vol: 46 }), windHi: 15,
  extra: { crash: hits(I.crash, [0, 64], { note: 'C-5', vol: 28 }), fx: riser(I.noise, 112, 128, { note: 'C-4', v0: 6, slope: 1.8, fx: 'F04' }) } });

// The roll and the riser stop on the turn's last row: a breath before the downbeat (and the loop's seam on tonal sound).
for (const [p, r] of [[drop, 31], [B, 127]]) for (const k of ['snare', 'fx']) p.channels[LAYOUT.indexOf(k)][r] = { note: '^^' };

const patterns = [drop, A, jump(B, 1)];

writeSongCompact(import.meta.url, {
  title: 'Farstrand - Prologue: the fall', bpm: 150, ticks: 6, mixvol: 48,
  message: 'FARSTRAND "Prologue: the fall".\nD minor, 150 BPM. Orders 1-2 loop.\nThe Survey\'s call at a gallop; the warm thing\'s motif under it.\nAll samples synthesized. Source: songs/farstrand_prologue_fall.gen.js',
  samples: [
    kick({ f0: 160, f1: 46, sweep: 32, decay: 10, click: 0.3, drive: 2.0, sec: 0.35 }),
    snare({ tone: 170, decay: 20, sec: 0.25, seed: 43, drive: 1.5 }),
    cymbal('glass tick', { sec: 0.05, decay: 100, seed: 17, metalMix: 0.7 }),
    { ...kick({ f0: 180, f1: 90, sweep: 25, decay: 12, click: 0.15, drive: 1.6, sec: 0.35 }), name: 'tom' },
    wave('grit bass', [1, 0.55, 0.38, 0.26, 0.18, 0.12, 0.08, 0.05, 0.03]),
    sawPluck('dark pluck', { open: 2600, closed: 300, close: 7, decay: 4, sec: 0.8 }),
    wave('glass lead', [1, 0.03, 0.45, 0.02, 0.22, 0.02, 0.1, 0, 0.05]),
    wave('flesh', [1, 0.7, 0.45, 0.32, 0.22, 0.15, 0.1, 0.06]),
    thinPad('cold pad', { amps: [1, 0, 0.3, 0, 0.12, 0, 0.05], spread: 1 }),
    thinPad('warm pad', { amps: [1, 0.5, 0.32, 0.2, 0.12, 0.07], spread: 1 }),
    glassBell('glass bell', { sec: 1.2, partials: [[1, 1, 2.2], [2.76, 0.45, 5], [5.4, 0.22, 9], [8.93, 0.1, 15]] }),
    cymbal('glass crash', { sec: 1.4, decay: 3.2, seed: 5, metalMix: 0.45 }),
    noiseLoop(),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
