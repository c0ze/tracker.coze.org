#!/usr/bin/env node
/**
 * HELIOBANE stage 8 — "The Stormglass" (the gas giant's atmosphere). MUSIC-C, 2026-09-25.
 * G minor, cycling up by minor thirds (G → Bb → C# → E → G → Bb), 168 BPM
 * (libopenmpt plays 168.06: 656 samples/tick), speed 6: 4 rows/beat, 16 rows/bar, 8 bars = 11.4 s.
 *
 * Identity: turbulence. The kick and bass are grouped 3-3-3-3-2-2 across each
 * bar, so the downbeat keeps getting pushed; the lead zig-zags down a broken chord
 * in dotted 8ths (lightning). Every section is written in G-minor terms, played in
 * another key, and ends on a "storm bar": the lead stops, thunder, unison hits on
 * the dominant of the NEXT key (always F in G-minor terms), so each section tips
 * a minor third higher and the storm never settles.
 *
 * Phrase map (chords in G-minor terms; the last bar is the storm bar)
 *   Intro   Gm Gm Eb D        wind, thunder, drums from bar 3 (not looped)
 *   A  (G)  Gm Eb Cm D Gm Eb Cm | F     "D Bb G | D C Bb" dotted-8th zig-zags
 *   A2 (Bb) same, + ping-pong echo, power-chord stabs and J-arps
 *   B  (C#) Eb F Gm Gm Cm Eb D | F      long wailing notes, low register
 *   Eye (E) Gm Gm Eb Eb Cm Cm D | F     the eye of the storm: kick on 1, glass bells, wind, thunder
 *   Squall (G) Gm Gm Eb F Gm Gm Eb | F  no lead: power chords + a 16th "gale" arp, double kick
 *   A3 (Bb) hook + written harmony | B  (B in G terms = D, V of G minor) → loop to A
 * Loop body: orders 1–6 (48 bars, 68.5 s).
 */
import { kick, snare, cymbal, tom, noiseLoop, wave, pwm, powerChord, glassBell, thinPad, thunder,
  mel, line, chart, arp, bass, pad, harmony, beat, rep, pattern, jump, writeSongCompact,
  ladder, pingpong, canon, gate, notesOf, drumKit, hits, roll, merge, coldPad , cutLanes } from './heliobane_stage6.kit.js';

const I = { kick: 0, snare: 1, hat: 2, ohat: 3, crash: 4, bass: 5, gtr: 6, arp: 7, lead: 8, pad: 9, noise: 10, thunder: 11, bell: 12, tom: 13 };
const LAYOUT = ['kick', 'snare', 'hat', 'bass', 'gtr', 'arp', 'lead', 'echo', 'echo2', 'pad', 'fx', 'storm'];
const PANS = [0x80, 0x76, 0xb2, 0x80, 0x5a, 0xaa, 0x88, 0x50, 0xb2, 0x6a, 0x96, 0x80];
const KM = { X: [I.kick, 64], x: [I.kick, 48] };
const drums = drumKit({
  kick: KM,
  snare: { X: [I.snare, 56], x: [I.snare, 40], g: [I.snare, 15], t: [I.tom, 46, null, 'C-5'], T: [I.tom, 50, null, 'F-4'] },
  hat: { X: [I.hat, 30], x: [I.hat, 20], g: [I.hat, 11], o: [I.ohat, 24] },
});
const SYNC = 'X..X..X..X..X.X.'; // 3-3-3-3-2-2
const G = {
  main: { kick: SYNC, snare: '..g.X..g...gX.g.', hat: 'XgxgXgxgXgxgXgxo' },
  B: { kick: 'X..X..X..X.XX.X.', snare: '....X..g....X..g', hat: 'XgxoXgxoXgxoXgxo' },
  eye: { kick: 'X...............', snare: '................', hat: '....o.......o...' },
  squall: { kick: 'XX.XX.XX.XX.XXXX', snare: '....X.......X...', hat: 'x.x.x.x.x.x.x.x.' },
  storm: { kick: 'X..X..X..X......', snare: '............xxtT', hat: 'X..X..X..X......' },
};
// the storm bar replaces each section's last bar
const drums8 = (g) => drums(8, g, G.storm);

// ---------------------------------------------------------------- harmony (G-minor terms, last bar = pivot)
const CH = {
  intro: 'Gm Gm Eb D', A: 'Gm Eb Cm D Gm Eb Cm F', B: 'Eb F Gm Gm Cm Eb D F', eye: 'Gm Gm Eb Eb Cm Cm D F',
  squall: 'Gm Gm Eb F Gm Gm Eb F', A3: 'Gm Eb Cm D Gm Eb Cm B',
};
const A_MEL = 'd6/3 bb5 g5 d6 c6/2 bb5 | bb5/3 g5 eb5 g5 bb5/4 | c6/3 g5 eb5 g5 c6/2 d6 | f#6/8~ e6/2 d6 c6 a5'
  + ' | d6/3 bb5 g5 d6 g6/2 f6 | eb6/3 bb5 g5 bb5 eb6/4 | g6/3 eb6 c6 eb6 d6/2 c6 | r/16';
const B_MEL = 'bb5/2 eb6 g6/12~ | a6/4 g6 f6/8~ | g6/6 f6/2 d6/8 | bb6/8~ a6/4 g6'
  + ' | eb6/6 d6/2 c6/4 g6 | g6/6 f6/2 eb6/4 bb5 | a6/8~ f#6/4 d6 | r/16';
const EYE_MEL = 'd6/8 bb5 | g5/16 | eb6/8 bb5 | g5/16 | c6/8 g5 | eb6/16 | f#6/16 | r/16';

// ---------------------------------------------------------------- parts
const BASS = { A: 'R-rR-rR-rR-rRrO-', B: 'R-rR-rR-rR-rR-O-', eye: 'R---------------', squall: 'RrrRrrRrrRrrRrRr', storm: 'R..R..R..R......' };
const bars8 = (main, last = BASS.storm) => rep(8, main, last);
const STAB = 'R..R..R..R..R.R.';
const GALE = [0, 2, 1, 3, 2, 4, 3, 5, 4, 6, 5, 7, 6, 4, 2, 0];

function section(name, chordStr, { semi = 0, melody, groove = G.main, bassR = BASS.A, echo = false, harm = false,
  gtr = false, arps = false, extraRefs = [], extra = {} } = {}) {
  const rows = 128, segs = chart(chordStr, { semi });
  const parts = { ...drums8(groove), fx: hits(I.crash, [0], { vol: 38 }),
    storm: hits(I.thunder, [112], { vol: 52 }),
    bass: bass(segs, bars8(bassR), I.bass, { rows, lo: 'C-3', vol: 42, soft: 0.66 }),
    gtr: bass(segs, bars8(gtr ? STAB : '................'), I.gtr, { rows, lo: 'G-3', vol: 28 }) };
  const refs = [];
  if (melody) {
    const notes = mel(melody, { semi, vol: 48 }), ch = line(notes, I.lead, { rows, vib: 'H44' });
    parts.lead = ch; refs.push(notes);
    if (echo) [parts.echo, parts.echo2] = pingpong(ch, notes, rows, { segs });
    if (harm) {
      parts.echo = line(harmony(notes, segs), I.lead, { rows, vib: null });
      parts.echo2 = canon(ch, notes, rows, { delay: 6, scale: 0.22, segs, refs: [notesOf(parts.echo, rows)] });
    }
    if (parts.echo) refs.push(notesOf(parts.echo, rows), notesOf(parts.echo2, rows));
  }
  parts.pad = coldPad(segs, I.pad, { rows, lo: 'C-5', vol: 10, refs: refs.concat(extraRefs) });
  if (arps) parts.arp = gate(arp(segs, rep(8, 'X-x-X-x-X-x-X-x-', '................'), I.arp, { rows, lo: 'G-4', vol: 17 }), rows, { refs });
  return pattern(name, 8, cutLanes({ ...parts, ...extra }), LAYOUT, PANS);
}

// intro: wind and thunder, drums in bar 3, storm hits on D in bar 4
const introSegs = chart(CH.intro);
const wind = { 0: { note: 'C-3', instrument: I.noise, vol: 'v6' } };
for (let r = 2; r < 64; r += 2) wind[r] = { vol: `v${Math.round(6 + 16 * Math.sin(Math.PI * r / 64) ** 2 + (r > 40 ? (r - 40) * 0.4 : 0))}` };
const intro = pattern('intro: wind', 4, {
  fx: wind, storm: hits(I.thunder, [0, 34], { vol: 54 }),
  kick: beat(['................', '................', SYNC, 'X..X..X..X......'], KM),
  snare: merge(beat(['................', '................', '..g.X..g...gX.g.', '................'], { X: [I.snare, 56], g: [I.snare, 15] }), roll(I.snare, 60, 4, { v0: 40, dv: 5, fx: null })),
  hat: beat(['................', '................', 'XgxgXgxgXgxgXgxo', 'X..X..X..X......'], { X: [I.hat, 30], x: [I.hat, 20], g: [I.hat, 11], o: [I.ohat, 24] }),
  bass: Object.fromEntries(Object.entries(bass(introSegs, ['R---------------', 'R---------------', BASS.A, BASS.storm], I.bass, { rows: 64, lo: 'C-3', vol: 42, soft: 0.66 }))),
  pad: pad(introSegs, I.pad, { rows: 64, lo: 'C-5', vol: 10 }),
}, LAYOUT, PANS);

// eye of the storm: bell melody with a 6-row echo, wind swells, thunder far away
const eyeSegs = chart(CH.eye, { semi: -3 }), eyeNotes = mel(EYE_MEL, { semi: -3, vol: 40 }), eyeLead = line(eyeNotes, I.bell, { rows: 128, vib: null });
const eyeWind = { 0: { note: 'C-3', instrument: I.noise, vol: 'v4' } };
for (let r = 2; r < 112; r += 2) eyeWind[r] = { vol: `v${Math.round(4 + 12 * Math.sin(Math.PI * r / 56) ** 2)}` };
eyeWind[112] = { note: '^^' };
const eye = section('eye: bells and wind', CH.eye, { semi: -3, groove: G.eye, bassR: BASS.eye, extraRefs: [eyeNotes], extra: {
  lead: eyeLead, echo: canon(eyeLead, eyeNotes, 128, { delay: 6, scale: 0.45, segs: eyeSegs }),
  arp: gate(line(ladder(eyeSegs, 112, [0, 2, 4, 2], { lo: 'G-4', span: 5, vol: 14, soft: 4, len: 2 }), I.bell, { rows: 128, vib: null }), 128, { refs: [eyeNotes] }),
  fx: eyeWind, storm: hits(I.thunder, [0, 56, 112], { vol: 44 }),
} });

const squallSegs = chart(CH.squall);
const squall = section('squall: gale', CH.squall, { groove: G.squall, bassR: BASS.squall, gtr: true, extra: {
  arp: line(ladder(squallSegs, 112, GALE, { lo: 'G-4', vol: 30, soft: 8 }), I.arp, { rows: 128, vib: null }),
  storm: hits(I.thunder, [0, 64, 112], { vol: 52 }),
} });

const patterns = [
  intro,
  section('A (G minor): zig-zag', CH.A, { melody: A_MEL }),
  section('A2 (Bb minor): + echo, stabs, arps', CH.A, { semi: 3, melody: A_MEL, echo: true, gtr: true, arps: true }),
  section('B (C# minor): wail', CH.B, { semi: -6, melody: B_MEL, groove: G.B, bassR: BASS.B, echo: true, gtr: true }),
  eye,
  squall,
  jump(section('A3 (Bb minor): + harmony', CH.A3, { semi: 3, melody: A_MEL, harm: true, gtr: true, arps: true }), 1),
];

writeSongCompact(import.meta.url, {
  title: 'Heliobane - The Stormglass', bpm: 168, ticks: 6, mixvol: 44,
  message: 'HELIOBANE stage 8 "The Stormglass" (MUSIC-C, World 2).\nG minor, modulating by minor thirds, 168 BPM. Orders 1-6 loop.\nAll samples synthesized. Source: songs/heliobane_stage8.gen.js',
  samples: [
    kick({ f0: 250, f1: 58, decay: 14, drive: 2.8 }), snare({ tone: 190, decay: 15, seed: 81, drive: 2.2 }), cymbal('hat closed', { seed: 83 }),
    cymbal('hat open', { sec: 0.32, decay: 9, seed: 84 }), cymbal('crash', { sec: 1.4, decay: 2.4, seed: 88, metalMix: 0.35 }),
    wave('grit bass', [1, 0.35, 0.5, 0.2, 0.3, 0.12, 0.2, 0.08, 0.14, 0.05, 0.1]), powerChord('power chord', { drive: 5 }),
    { name: 'arp pulse', synth: { wave: 'square', pulse: 0.25 } }, pwm('storm pwm lead', { lo: 0.18, hi: 0.5, cycles: 40 }),
    thinPad('storm pad', { amps: [1, 0.1, 0.25, 0, 0.1] }), noiseLoop(), thunder('thunder', { sec: 2.6, seed: 91 }), glassBell(), tom(),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
