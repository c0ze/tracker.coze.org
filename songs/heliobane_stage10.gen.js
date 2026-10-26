#!/usr/bin/env node
/**
 * HELIOBANE stage 10 — "The Heliopause" (the edge of the system; the speed stage and chase). MUSIC-C, 2026-09-25.
 * C# minor (→ D# minor), 188 BPM, the fastest track in the game (libopenmpt plays 188.14:
 * 586 samples/tick), speed 6: 4 rows/beat, 16 rows/bar, 8 bars = 10.2 s.
 *
 * Identity: the chase. Four-on-the-floor kick, a galloping octave bass, a glass-bell
 * ladder that only ever climbs (the Seed is always ahead), tick-rate J-arps, and a
 * euphoric-but-cold hook on a hero PWM lead: "C# E G#— G# F# E" rising through the
 * i–VI–III–VII (C#m A E B) that shmup trance loves. It never breaks down: every
 * section adds one thing, the key lifts a whole step, and the loop drops back to the
 * lead-less drive to build again.
 *
 * Phrase map
 *   Intro   C#m A E B            kick from bar 1, bells + arps under a riser, swell into the drive (not looped)
 *   Drive   C#m A E B C#m A E G#   no lead: bass, kick, bells climbing in 16ths, J-arps
 *   A       same                  + hook (bells go to 8ths under it)
 *   A2      same                  + ping-pong echo, bells back to 16ths, busier snare
 *   B       A B E C#m A B C# A#   soaring, rising; A# = V of D# minor
 *   A↑      D# minor              + written harmony, 16th hats, double kick pickups
 *   Peak    B C# F# D#m B C# D# D#   B melody a step up, ends on D# MAJOR (picardy) at D#7, the game's top note
 *   Turn    B C# G# G#            bVI bVII of D#m → V of C# minor; last bar drums, bass, riser, swell → loop to Drive
 * Loop body: orders 1–7 (52 bars, 66.4 s).
 */
import { kick, snare, cymbal, tom, noiseLoop, wave, pwm, BASS_AMPS, glassBell, thinPad, swell,
  mel, line, chart, arp, bass, harmony, beat, rep, pattern, jump, writeSongCompact,
  ladder, pingpong, canon, gate, notesOf, drumKit, hits, riser, roll, merge, cut0, coldPad , cutLanes } from './heliobane_stage6.kit.js';

const I = { kick: 0, snare: 1, hat: 2, ohat: 3, crash: 4, bass: 5, arp: 6, bell: 7, lead: 8, pad: 9, noise: 10, swell: 11, tom: 12 };
const LAYOUT = ['kick', 'snare', 'hat', 'bass', 'arp', 'bells', 'lead', 'echo', 'echo2', 'pad', 'fx'];
const PANS = [0x80, 0x78, 0xb2, 0x80, 0x4e, 0xb2, 0x88, 0x52, 0xae, 0x70, 0x94];
const KM = { X: [I.kick, 64], x: [I.kick, 46] };
const drums = drumKit({
  kick: KM,
  snare: { X: [I.snare, 56], x: [I.snare, 40], g: [I.snare, 15], t: [I.tom, 46, null, 'C-5'], T: [I.tom, 50, null, 'F-4'] },
  hat: { X: [I.hat, 30], x: [I.hat, 21], g: [I.hat, 12], o: [I.ohat, 25] },
});
const G = {
  drive: { kick: 'X...X...X...X...', snare: '....X.......X...', hat: 'x.o.x.o.x.o.x.o.' },
  A: { kick: 'X...X...X...X...', snare: '....X.......X.g.', hat: 'xgoxxgoxxgoxxgox' },
  A2: { kick: 'X...X...X...X...', snare: '....X..g.g..X.gg', hat: 'xgoxxgoxxgoxxgox' },
  up: { kick: 'X...X...X...X.xx', snare: '....X..g....X.gg', hat: 'XgxoXgxoXgxoXgxo' },
  fill: { kick: 'X...X...X...X...', snare: '....X...XxXxXXXX', hat: 'xgoxxgox........' },
};
const CH = {
  intro: 'C#m A E B', A: 'C#m A E B C#m A E G#', B: 'A B E C#m A B C# A#', peak: 'A B E C#m A B C# C#', turn: 'B C# G# G#',
};

// ---------------------------------------------------------------- melodies
const A_MEL = 'c#6/3 e6 g#6/2 g#6/4 f#6/2 e6 | e6/3 c#6 a5/2 c#6/8~ | b5/3 e6 g#6/2 b6/4 g#6 | f#6/12~ d#6/4'
  + ' | c#6/3 e6 g#6/2 g#6/4 b6 | c#7/3 b6 a6/2 e6/8~ | e6/3 f#6 g#6/2 b6/4 g#6 | d#6/6 g#6/2 c7/8~';
const B_BARS = 'c#6/4 e6 a6/8~ | b6/4 a6 f#6/8~ | g#6/4 f#6 e6 b5 | c#6/4 e6 g#6/8~ | a6/8~ g#6/4 e6 | d#6/4 f#6 b6/8~ | g#6/8~ e#6/4 c#6';
const B_MEL = `${B_BARS} | a#5/4 d6 f6/8~`;
const PEAK_MEL = `${B_BARS} | c#6/4 g#6 c#7/8~`;
const TURN_MEL = 'd#6/4 f#6 b6/8~ | e#6/4 g#6 c#7/8~ | c7/8~ g#6/4 d#6 | r/16';

// ---------------------------------------------------------------- parts
const BASS = { drive: ['R.OrR.OrR.OrR.Or'], B: ['RrOrRrOrRrOrRrOr'], intro: ['R---------------', 'R---------------', 'R.OrR.OrR.OrR.Or', 'R.OrR.OrR.OrRrRr'] };
const CLIMB = [0, 1, 2, 3, 4, 5, 6, 7];
const ARPS = ['XxXxXxXxXxXxXxXx'];

function section(name, chordStr, { semi = 0, melody, groove = G.A, echo = false, harm = false, bellLen = 1,
  bassR = BASS.drive, arpVol = 13, extra = {} } = {}) {
  const rows = 128, segs = chart(chordStr, { semi });
  const parts = { ...drums(8, groove, G.fill), fx: hits(I.crash, [0], { vol: 40 }),
    bass: bass(segs, bassR, I.bass, { rows, lo: 'C-3', vol: 42, soft: 0.7 }) };
  const refs = [];
  if (melody) {
    const notes = mel(melody, { semi, vol: 50 }), ch = cut0(line(notes, I.lead, { rows, vib: 'H43' }));
    parts.lead = ch; refs.push(notes);
    if (echo) [parts.echo, parts.echo2] = pingpong(ch, notes, rows, { segs });
    if (harm) {
      parts.echo = line(harmony(notes, segs), I.lead, { rows, vib: null });
      parts.echo2 = canon(ch, notes, rows, { delay: 6, scale: 0.22, segs, refs: [notesOf(parts.echo, rows)] });
    }
    if (parts.echo) refs.push(notesOf(parts.echo, rows), notesOf(parts.echo2, rows));
  }
  parts.arp = gate(arp(segs, ARPS, I.arp, { rows, lo: 'G#4', vol: arpVol, decay: 0.9 }), rows, { refs });
  parts.bells = gate(line(ladder(segs, rows, CLIMB, { lo: 'C#5', vol: 22, soft: 6, len: bellLen }), I.bell, { rows, vib: null }), rows, { refs });
  parts.pad = coldPad(segs, I.pad, { rows, lo: 'E-5', vol: 9, refs });
  return pattern(name, 8, cutLanes({ ...parts, ...extra }), LAYOUT, PANS);
}

// intro: kick from bar 1, bells and arps rise under a noise riser; swell into the drive
const introSegs = chart(CH.intro);
const intro = pattern('intro: launch', 4, {
  kick: beat(rep(4, 'X...X...X...X...'), KM),
  hat: beat(['................', '..o...o...o...o.', 'x.o.x.o.x.o.x.o.', 'xgoxxgox........'], { x: [I.hat, 21], g: [I.hat, 12], o: [I.ohat, 25] }),
  snare: merge(beat(['................', '................', '....X.......X...', '....X...........'], { X: [I.snare, 56] }), roll(I.snare, 56, 8, { v0: 28, dv: 4 })),
  bass: bass(introSegs, BASS.intro, I.bass, { rows: 64, lo: 'C-3', vol: 42, soft: 0.7 }),
  bells: line(ladder(introSegs, 64, CLIMB, { lo: 'C#5', vol: 20, soft: 6 }), I.bell, { rows: 64, vib: null }),
  arp: Object.fromEntries(Object.entries(arp(introSegs, ARPS, I.arp, { rows: 64, lo: 'G#4', vol: 13, decay: 0.9 })).filter(([r]) => r >= 32)),
  fx: merge(riser(I.noise, 0, 52, { slope: 0.5 }), hits(I.swell, [52], { vol: 40 })),
}, LAYOUT, PANS);

const turnSegs = chart(CH.turn);
// 4-bar turn: last bar = drums, bass, riser and a swell (no lead, arps or bells)
const turnRows = 64, tn = mel(TURN_MEL, { vol: 50 }), tch = cut0(line(tn, I.lead, { rows: turnRows, vib: 'H43' }));
const [te1, te2] = pingpong(tch, tn, turnRows, { segs: turnSegs });
const turn4 = pattern('turn: to the drop', 4, {
  kick: beat(['X...X...X...X.xx', 'X...X...X...X.xx', 'X...X...X...X.xx', 'X...X...X.X.XXXX'], KM),
  snare: merge(beat(['....X..g....X.gg', '....X..g....X.gg', '....X..g....X.gg', '................'], { X: [I.snare, 56], g: [I.snare, 15] }), roll(I.snare, 48, 16, { v0: 24, dv: 2 })),
  hat: beat(['XgxoXgxoXgxoXgxo', 'XgxoXgxoXgxoXgxo', 'XgxoXgxoXgxoXgxo', 'x.x.x.x.x.x.x.x.'], { X: [I.hat, 30], x: [I.hat, 21], g: [I.hat, 12], o: [I.ohat, 25] }),
  bass: bass(turnSegs, ['RrOrRrOrRrOrRrOr', 'RrOrRrOrRrOrRrOr', 'RrOrRrOrRrOrRrOr', 'R.R.R.R.RrRrRRRR'], I.bass, { rows: 64, lo: 'C-3', vol: 42, soft: 0.7 }),
  lead: tch, echo: te1, echo2: te2,
  arp: gate(arp(turnSegs, [...rep(3, ARPS[0]), '................'], I.arp, { rows: 64, lo: 'G#4', vol: 13, decay: 0.9 }), 64, { refs: [tn] }),
  bells: gate(line(ladder(turnSegs, 48, CLIMB, { lo: 'C#5', vol: 22, soft: 6 }), I.bell, { rows: 64, vib: null }), 64, { refs: [tn] }),
  fx: merge(hits(I.crash, [0], { vol: 40 }), riser(I.noise, 32, 52, { slope: 1.6 }), hits(I.swell, [52], { vol: 44 })),
}, LAYOUT, PANS);

const patterns = [
  intro,
  section('drive: no lead', CH.A, { groove: G.drive, arpVol: 16 }),
  section('A: hook', CH.A, { melody: A_MEL, bellLen: 2 }),
  section('A2: hook + ping-pong echo', CH.A, { melody: A_MEL, groove: G.A2, echo: true }),
  section('B: soaring to D# minor', CH.B, { melody: B_MEL, groove: G.A2, bassR: BASS.B, echo: true }),
  section('A up: D# minor + harmony', CH.A, { melody: A_MEL, semi: 2, groove: G.up, harm: true, bassR: BASS.B }),
  section('peak: D# major', CH.peak, { melody: PEAK_MEL, semi: 2, groove: G.up, echo: true, bassR: BASS.B }),
  jump(turn4, 1),
];

writeSongCompact(import.meta.url, {
  title: 'Heliobane - The Heliopause', bpm: 188, ticks: 6, mixvol: 44,
  message: 'HELIOBANE stage 10 "The Heliopause" (MUSIC-C, World 2).\nC# minor -> D# minor, 188 BPM. Orders 1-7 loop.\nAll samples synthesized. Source: songs/heliobane_stage10.gen.js',
  samples: [
    kick({ f0: 260, f1: 58, decay: 15, drive: 3 }), snare({ tone: 210, decay: 18, seed: 101, drive: 2.2 }), cymbal('hat closed', { seed: 103 }),
    cymbal('hat open', { sec: 0.28, decay: 11, seed: 104 }), cymbal('crash', { sec: 1.4, decay: 2.4, seed: 108, metalMix: 0.3 }),
    wave('saw bass', BASS_AMPS), { name: 'arp pulse', synth: { wave: 'square', pulse: 0.125 } },
    glassBell('chase bell', { sec: 0.9, partials: [[1, 1, 3.2], [2.76, 0.45, 7], [5.4, 0.22, 12], [8.93, 0.1, 18]] }),
    pwm('hero pwm lead', { lo: 0.12, hi: 0.5, cycles: 72 }), thinPad('edge pad', { amps: [1, 0, 0.2, 0, 0.1] }),
    noiseLoop(), swell('swell', { sec: 0.9 }), tom(),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
