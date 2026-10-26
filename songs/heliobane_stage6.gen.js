#!/usr/bin/env node
/**
 * HELIOBANE stage 6 — "Ashfall Drift" (fleeing Aurel's collapsing shell). MUSIC-C, 2026-09-25.
 * F minor (→ E minor, a half step *down*), 175 BPM (exact in libopenmpt: 630 samples/tick),
 * speed 6: 4 rows/beat, 16 rows/bar, 8 bars = 11.0 s.
 *
 * Identity: everything falls. A lament bass walks down F E Eb D Db under the
 * chords; each beat of the bass drops from the octave to the root; glass bells
 * cascade down two octaves of the chord; the hook hammers a repeated note and
 * then drops (C C C Ab F), and 12.5% pulse J-arps warble like a klaxon.
 *
 * Phrase map
 *   Intro    Fm C Db C          falling bells alone, klaxon joins, bass, then a drum fill (not looped)
 *   A        Fm C/E Ab/Eb Bb/D Db Bbm C C   "C C C Ab F—" question falls to D5; answer falls from Db6,
 *                                           then climbs C E G—— to leave V open
 *   A2       same + ping-pong echo (3 and 6 rows) + klaxon arps
 *   B        Db Eb Cm Fm Db Eb C C          soaring long notes up to C7 over C, eighth kick
 *   Collapse same lament, half time          thunder, downlifters, sparse bells + canon, falling pairs
 *   Build    Db Eb C B                        C drops to B = V of E minor: the key falls a half step
 *   A↓ B↓    E minor with written harmony
 *   Turn     C Db Bbm C                       B → C pulls back up to V of F minor → loop to A
 * Loop body: orders 1–8 (56 bars, 76.8 s).
 */
import { kick, snare, cymbal, tom, noiseLoop, wave, pwm, BASS_AMPS, glassBell, thinPad, thunder,
  mel, line, echoOf, chart, arp, bass, pad, harmony, beat, rep, pattern, jump, writeSongCompact,
  ladder, pingpong, canon, gate, notesOf, drumKit, hits, riser, fall, roll, merge, coldPad , cutLanes } from './heliobane_stage6.kit.js';

const I = { kick: 0, snare: 1, hat: 2, ohat: 3, crash: 4, bass: 5, alarm: 6, bell: 7, lead: 8, pad: 9, noise: 10, thunder: 11, tom: 12 };
const LAYOUT = ['kick', 'snare', 'hat', 'bass', 'alarm', 'bells', 'lead', 'echo', 'echo2', 'pad', 'fx'];
const PANS = [0x80, 0x76, 0xb0, 0x80, 0x4c, 0xb4, 0x86, 0x50, 0xb0, 0x6c, 0x90];
const drums = drumKit({
  kick: { X: [I.kick, 64], x: [I.kick, 48] },
  snare: { X: [I.snare, 56], x: [I.snare, 40], g: [I.snare, 15], t: [I.tom, 44, null, 'C-5'], T: [I.tom, 48, null, 'G-4'] },
  hat: { X: [I.hat, 28], x: [I.hat, 18], g: [I.hat, 10], o: [I.ohat, 22] },
});
const G = {
  main: { kick: 'X...X.x.X...X.x.', snare: '....X.......X...', hat: 'XgxgXgxgXgxgXgxo' },
  B: { kick: 'X.X.X.X.X.X.X.X.', snare: '....X.......X..g', hat: 'XgxoXgxoXgxoXgxo' },
  half: { kick: 'X.........X.....', snare: '........X.......', hat: '..g...g...g...g.' },
  none: { kick: '................', snare: '................', hat: '................' },
  fill: { kick: 'X...X.x.X.......', snare: '....X...XxXxtTtT', hat: 'XgxgXgxg........' },
};
const CH = {
  intro: 'Fm C Db C', A: 'Fm C Ab Bb Db Bbm C C', B: 'Db Eb Cm Fm Db Eb C C',
  build: 'Db Eb C B', turn: 'C Db Bbm C',
};
const LAMENT = 'F5 E5 Eb5 D5 Db5 Bb5 C5 C5'; // the bass under CH.A (slash chords)

// ---------------------------------------------------------------- melodies
const A_MEL = 'c6/2 c6 c6 ab5 f5/4 g5/2 ab5 | g5/6 e5/2 c5/8 | eb6/2 eb6 eb6 c6 ab5/4 bb5/2 c6 | bb5/6 f5/2 d5/8'
  + ' | db6/2 db6 db6 bb5 f5/4 ab5/2 bb5 | db6/4 bb5 f5 db5 | e5/2 f5 g5/4 c6 bb5 | c6/2 e6 g6/12~';
const B_MEL = 'f6/8~ ab6/4 f6 | g6/8~ eb6/4 bb5 | c6/6 eb6/2 g6/8~ | f6/4 eb6 c6 ab5'
  + ' | ab6/8~ f6/4 db6 | bb6/8~ g6/4 eb6 | c7/8~ bb6/4 g6 | e6/4 c6 g5/8';
const FALL_MEL = 'ab5/8 f5 | g5/8 e5 | ab5/8 eb5 | f5/8 d5 | f5/8 db5 | db6/8 bb5 | e5/8 c5 | g5/16';
const BUILD_MEL = 'f5/4 ab5 c6 f6 | g6/4 eb6 bb5 g5 | e6/4 g6 c6 e6 | f#6/16~';
const TURN_MEL = 'g6/8 e6 | f6/8 ab6 | f6/8 db6 | e6/8 g6~';

// ---------------------------------------------------------------- parts
const BASS = { drop: ['O-rrO-rrO-rrO-ro'], B: ['R.rrR.rrR.rrR.oo'], half: ['R-------r-------'], build: ['R.R.R.R.R.R.R.R.', 'R.R.R.R.R.R.R.R.', 'RrRrRrRrRrRrRrRr', 'RrRrRrRrRRRRRRRR'] };
const KLAXON = ['X-x-X-x-X-x-X-xx'];
const DOWN = [7, 6, 5, 4, 3, 2, 1, 0];

function section(name, bars, chordStr, { semi = 0, melody, groove = G.main, fill = true, echo = false, harm = false,
  bassChart, bassR = BASS.drop, klaxon = true, bells = 2, inst = I.lead, extra = {} } = {}) {
  const rows = bars * 16, segs = chart(chordStr, { semi }), bsegs = bassChart ? chart(bassChart, { semi }) : segs;
  const parts = { ...drums(bars, groove, fill ? G.fill : null), fx: hits(I.crash, [0], { vol: 38 }),
    bass: bass(bsegs, bassR, I.bass, { rows, lo: 'C-3', vol: 40, soft: 0.7 }),
  };
  const refs = [];
  if (melody) {
    const notes = mel(melody, { semi, vol: 52 }), ch = line(notes, inst, { rows, vib: 'H43' });
    parts.lead = ch; refs.push(notes);
    if (echo) [parts.echo, parts.echo2] = pingpong(ch, notes, rows, { segs });
    if (harm) {
      parts.echo = line(harmony(notes, segs), I.lead, { rows, vib: null });
      parts.echo2 = canon(ch, notes, rows, { delay: 6, scale: 0.22, segs, refs: [notesOf(parts.echo, rows)] });
    }
    if (parts.echo) refs.push(notesOf(parts.echo, rows), notesOf(parts.echo2, rows));
  }
  parts.pad = coldPad(segs, I.pad, { rows, lo: 'C-5', vol: 10, refs });
  // klaxon arps and falling bells step aside wherever they would rub against the lead line(s)
  if (klaxon) parts.alarm = gate(arp(segs, KLAXON, I.alarm, { rows, lo: 'A-5', vol: 15 }), rows, { refs });
  if (bells) parts.bells = gate(line(ladder(segs, rows, DOWN, { lo: 'F-5', vol: 26, soft: 7, len: bells }), I.bell, { rows, vib: null }), rows, { refs });
  return pattern(name, bars, cutLanes({ ...parts, ...extra }), LAYOUT, PANS);
}

// intro: bells alone, klaxon in bar 2, bass in bar 3, drums in bar 4
const introSegs = chart(CH.intro), introBass = bass(introSegs, BASS.drop, I.bass, { rows: 64, lo: 'C-3', vol: 40, soft: 0.7 });
const intro = section('intro: falling bells', 4, CH.intro, { fill: false, groove: G.none, extra: {
  fx: fall(I.noise, 0, 30, { v0: 26 }), pad: undefined,
  alarm: Object.fromEntries(Object.entries(arp(introSegs, KLAXON, I.alarm, { rows: 64, lo: 'A-5', vol: 15 })).filter(([r]) => r >= 16)),
  bass: Object.fromEntries(Object.entries(introBass).filter(([r]) => r >= 32)),
  bells: line(ladder(introSegs, 64, DOWN, { lo: 'F-5', vol: 22, soft: 6 }), I.bell, { rows: 64, vib: null }),
  kick: beat(['................', '................', 'X...X.x.X...X.x.', 'X...X.x.X.......'], { X: [I.kick, 64], x: [I.kick, 48] }),
  snare: merge(beat(['................', '................', '....X.......X...', '....X...........'], { X: [I.snare, 56] }), roll(I.snare, 56, 8, { v0: 30, dv: 3 })),
} });

// collapse: half time, thunder, downlifters, bell canon, falling pairs with a long echo
const colSegs = chart(CH.A), colBells = ladder(colSegs, 128, DOWN, { lo: 'F-5', vol: 16, soft: 5 });
const colBellCh = line(colBells, I.bell, { rows: 128, vib: null });
const fallNotes = mel(FALL_MEL, { vol: 46 }); // one 6-row echo instead of the ping-pong: sparser, wider
const collapse = section('collapse: half time', 8, CH.A, { melody: FALL_MEL, groove: G.half, fill: false, bassChart: LAMENT,
  bassR: BASS.half, klaxon: false, bells: 0, extra: {
    bells: colBellCh, alarm: canon(colBellCh, colBells, 128, { delay: 3, scale: 0.5, segs: colSegs }),
    lead: line(fallNotes, I.lead, { rows: 128, vib: 'H43' }),
    echo: canon(line(fallNotes, I.lead, { rows: 128, vib: 'H43' }), fallNotes, 128, { delay: 6, scale: 0.45, segs: colSegs }),
    fx: merge(hits(I.thunder, [0, 64], { vol: 50 }), fall(I.noise, 48, 62, { v0: 22 }), fall(I.noise, 112, 126, { v0: 22 })),
  } });

const build = section('build: down to E minor', 4, CH.build, { melody: BUILD_MEL, bassR: BASS.build, fill: false, bells: 1,
  extra: { fx: riser(I.noise, 32, 64), snare: merge(beat(['....X.......X...', '..x...x...x...x.', 'x.x.x.x.x.x.x.x.', '................'], { X: [I.snare, 56], x: [I.snare, 40] }), roll(I.snare, 48, 16, { v0: 22, dv: 2 })),
    kick: beat(['X.......X.......', 'X...X...X...X...', 'X.X.X.X.X.X.X.X.', 'X...X...X...X...'], { X: [I.kick, 64] }) } });

const patterns = [
  intro,
  section('A: lament hook', 8, CH.A, { melody: A_MEL, bassChart: LAMENT, klaxon: false }),
  section('A2: hook + ping-pong echo + klaxon', 8, CH.A, { melody: A_MEL, bassChart: LAMENT, echo: true }),
  section('B: soaring', 8, CH.B, { melody: B_MEL, groove: G.B, bassR: BASS.B, echo: true, bells: 1 }),
  collapse,
  build,
  section('A down: E minor + harmony', 8, CH.A, { melody: A_MEL, semi: -1, bassChart: LAMENT, harm: true }),
  section('B down: E minor + harmony', 8, CH.B, { melody: B_MEL, semi: -1, groove: G.B, bassR: BASS.B, harm: true, bells: 1 }),
  jump(section('turn: back to F minor', 4, CH.turn, { melody: TURN_MEL, groove: G.B, bassR: BASS.B }), 1),
];

writeSongCompact(import.meta.url, {
  title: 'Heliobane - Ashfall Drift', bpm: 175, ticks: 6, mixvol: 44,
  message: 'HELIOBANE stage 6 "Ashfall Drift" (MUSIC-C, World 2).\nF minor -> E minor, 175 BPM. Orders 1-8 loop.\nAll samples synthesized. Source: songs/heliobane_stage6.gen.js',
  samples: [
    kick({ f0: 240, f1: 58, decay: 14 }), snare({ tone: 205, decay: 17, seed: 61, drive: 2 }), cymbal('hat closed', { seed: 63 }),
    cymbal('hat open', { sec: 0.32, decay: 9, seed: 64 }), cymbal('crash', { sec: 1.4, decay: 2.4, seed: 68, metalMix: 0.35 }),
    wave('saw bass', BASS_AMPS), { name: 'klaxon pulse', synth: { wave: 'square', pulse: 0.125 } }, glassBell(),
    pwm('thin pwm lead', { lo: 0.08, hi: 0.3, cycles: 64 }), thinPad('cold pad'), noiseLoop(), thunder(), tom(),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
