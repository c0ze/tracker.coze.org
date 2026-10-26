#!/usr/bin/env node
/**
 * HELIOBANE stage 2 — "Verdigris Tide" (the ocean moon). MUSIC-A, 2026-09-24.
 * B minor (→ C# minor), 165 BPM, speed 6: 4 rows/beat, 16 rows/bar, 8 bars = 11.6 s.
 *
 * Identity: a rolling 16th bell arpeggio that climbs and falls through two
 * octaves of each seventh chord (the tide), under a hollow glass lead whose
 * hook floats on chord sevenths and the Lydian #11 (C# over Gmaj7).
 *
 * Phrase map
 *   Intro   bell tide with a 3-row canon, pad swell, drum fill (not looped)
 *   A       Bm7 Gmaj7 D A Bm7 Gmaj7 Em7 F#    "F#—A B—D", answer opens on F# major (A# leading tone)
 *   A2      same + dotted-8th echo
 *   B       Gmaj7 A F#m Bm Em A D F#        sequence of rising sevenths, peak B6 over Em
 *   A3      hook again, bell doubles the lead an octave up (one new element)
 *   Abyss   Em7 F#m7 Gmaj7 F#m7 x2          drums thin out, bell-tide canon, sparse bell melody
 *   Build   Em F#m G G#                     to C# minor
 *   A↑ B↑   C# minor with written harmony
 *   Turn    A B Gmaj7 F#                    VI–VII of C#m, then bVI–V of B minor → loop to A
 * Loop body: orders 1–9 (64 bars, 93 s).
 */
import { kick, snare, cymbal, noiseLoop, wave, superSaw, BASS_AMPS,
  mel, line, echoOf, chart, at, bass, pad, harmony, beat, rep, pattern, jump, writeSongCompact } from './heliobane_title.kit.js';
import { nn, ns } from './lib.js';

const I = { kick: 0, snare: 1, hat: 2, ohat: 3, crash: 4, bass: 5, bell: 6, lead: 7, pad: 8, noise: 9 };
const LAYOUT = ['kick', 'snare', 'hat', 'bass', 'tide', 'canon', 'lead', 'echo', 'pad', 'fx'];
const PANS = [0x80, 0x78, 0xb0, 0x80, 0x48, 0xb8, 0x88, 0x60, 0x70, 0x98];
const K = { X: [I.kick, 62], x: [I.kick, 46] };
const S = { X: [I.snare, 54], x: [I.snare, 38], g: [I.snare, 16] };
const H = { X: [I.hat, 26], x: [I.hat, 17], g: [I.hat, 10], o: [I.ohat, 20] };

const G = {
  main: { kick: 'X.....X...X.....', snare: '....X.......X..x', hat: 'xgxgXgxgxgxgXgxo' },
  B: { kick: 'X.....X.X.X.....', snare: '....X.......X...', hat: 'XgxgXgxgXgxgXgxg' },
  abyss: { kick: 'X...............', snare: '................', hat: '..g...g...g...g.' },
  fill: { kick: 'X.....X...X.....', snare: '....X...X.xxXxXX', hat: 'xgxgXgxg........' },
};
const CH = {
  intro: 'Bm7 Gmaj7 Em7 F#', A: 'Bm7 Gmaj7 D A Bm7 Gmaj7 Em7 F#', B: 'Gmaj7 A F#m Bm Em A D F#',
  abyss: 'Em7 F#m7 Gmaj7 F#m7 Em7 F#m7 Gmaj7 A', build: 'Em F#m G G#', turn: 'A B Gmaj7 F#',
};
const A_MEL = 'f#5/6 a5/2 b5/4 d6/4 | d6/6 c#6/2 b5/8~ | a5/4 f#5/2 a5/2 d6/4 e6/4 | c#6/6 e6/2 a5/8~'
  + ' | f#5/6 a5/2 b5/4 f#6/4 | f#6/6 e6/2 d6/8~ | e6/4 g6/2 f#6/2 e6/4 b5/4 | c#6/6 a#5/2 f#5/8';
const B_MEL = 'b5/2 d6/2 f#6/12~ | e6/2 c#6/2 e6/12~ | c#6/2 a5/2 c#6/4 f#6/8~ | f#6/4 e6/4 d6/4 b5/4'
  + ' | g6/2 e6/2 b6/12~ | a6/4 g6/2 e6/2 c#6/8 | d6/6 e6/2 f#6/4 a6/4 | a#6/8~ f#6/4 c#6/4';
const ABYSS_MEL = 'e6/8 d6/4 b5/4 | c#6/8 a5/8 | d6/8 f#6/4 e6/4 | c#6/16 | e6/8 d6/4 b5/4 | c#6/8 e6/8 | f#6/8 a6/4 g6/4 | e6/16';
const BUILD_MEL = 'e5/4 f#5 g5 b5 | f#5/4 a5 c#6 a5 | g5/4 b5 d6 b5 | c6/16~';
const TURN_MEL = 'c#6/16~ | d#6/16~ | d6/8 b5/8 | a#5/8 c#6/8~';

/** The tide: one note per row, rising and falling through two octaves of chord tones. */
const WAVE = [0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 3, 4, 5, 6, 7];
function tide(segs, rows, { lo = 'F#4', vol = 24 } = {}) {
  const notes = [];
  for (let r = 0; r < rows; r++) {
    const s = at(segs, r), ladder = [];
    for (let p = nn(lo); ladder.length < 8; p++) if (s.tones.has(p % 12)) ladder.push(p);
    notes.push([r, ns(ladder[WAVE[r % 16]]), 1, r % 4 ? vol - 7 : vol, '']);
  }
  return notes;
}
function drums(bars, g, fill = true) {
  const f = fill ? G.fill : {};
  return { kick: beat(rep(bars, g.kick, f.kick), K), snare: beat(rep(bars, g.snare, f.snare), S), hat: beat(rep(bars, g.hat, f.hat), H) };
}
const crash = { 0: { note: 'C-5', instrument: I.crash, vol: 'v36' } };
const BASS = { main: ['R-.R-.R.R-.R-.o.'], B: ['R.RoR.RoR.RoR.Ro'], abyss: ['R---------------'], build: ['R.R.R.R.R.R.R.R.'] };

function section(name, bars, chordStr, { semi = 0, melody, groove = G.main, fill = true, echo = false, harm = false, sparkle = false,
  canon = false, bassR = BASS.main, inst = I.lead, extra = {} } = {}) {
  const rows = bars * 16, segs = chart(chordStr, { semi });
  const tideNotes = tide(segs, rows), tideCh = line(tideNotes, I.bell, { rows, vib: null });
  const parts = { ...drums(bars, groove, fill), fx: crash, tide: tideCh,
    bass: bass(segs, bassR, I.bass, { rows, lo: 'C#3', vol: 40 }), pad: pad(segs, I.pad, { rows, lo: 'A-4', vol: 15 }) };
  if (canon) parts.canon = echoOf(tideCh, tideNotes, { delay: 3, scale: 0.55, rows });
  if (melody) {
    const notes = mel(melody, { semi, vol: 44 }), ch = line(notes, inst, { rows, vib: 'H43' });
    parts.lead = ch;
    if (echo) parts.echo = echoOf(ch, notes, { delay: 3, scale: 0.42, rows });
    if (harm) parts.echo = line(harmony(notes, segs), I.lead, { rows, vib: null });
    if (sparkle) parts.canon = line(mel(melody, { semi: semi + 12, vol: 18 }), I.bell, { rows, vib: null });
  }
  return pattern(name, bars, { ...parts, ...extra }, LAYOUT, PANS);
}

const riser = { 32: { note: 'C-4', instrument: I.noise, vol: 'v4' } };
for (let r = 33; r < 64; r++) riser[r] = { vol: `v${4 + Math.round((r - 32) * 1.0)}`, fx: 'F03' };
const buildSnare = beat(['....X.......X...', '..x...x...x...x.', 'x.x.x.x.x.x.x.x.', '................'], S);
for (let i = 0; i < 16; i++) buildSnare[48 + i] = { note: 'C-5', instrument: I.snare, vol: `v${20 + i * 2}`, fx: 'Q03' };

const patterns = [
  section('intro: tide canon', 4, CH.intro, { canon: true, fill: false, bassR: BASS.abyss,
    extra: { fx: undefined, kick: beat(['................', '................', '................', 'X.....X...X.....'], K),
      snare: beat(['................', '................', '................', '....X...X.xxXxXX'], S), hat: beat(rep(4, '..g...g...g...g.'), H) } }),
  section('A: glass hook', 8, CH.A, { melody: A_MEL }),
  section('A2: hook + echo', 8, CH.A, { melody: A_MEL, echo: true }),
  section('B: rising sevenths', 8, CH.B, { melody: B_MEL, echo: true, groove: G.B, bassR: BASS.B }),
  section('A3: hook + bell octave', 8, CH.A, { melody: A_MEL, sparkle: true, echo: true }),
  section('abyss: bell canon', 8, CH.abyss, { melody: ABYSS_MEL, inst: I.bell, canon: true, groove: G.abyss, fill: false,
    bassR: BASS.abyss, extra: { fx: undefined } }),
  section('build to C# minor', 4, CH.build, { melody: BUILD_MEL, bassR: BASS.build, fill: false,
    extra: { fx: riser, snare: buildSnare, kick: beat(['X.......X.......', 'X...X...X...X...', 'X.X.X.X.X.X.X.X.', 'X...X...X...X...'], K) } }),
  section('A up: C# minor + harmony', 8, CH.A, { melody: A_MEL, semi: 2, harm: true }),
  section('B up: C# minor + harmony', 8, CH.B, { melody: B_MEL, semi: 2, harm: true, groove: G.B, bassR: BASS.B }),
  jump(section('turn: A B Gmaj7 F#', 4, CH.turn, { melody: TURN_MEL, groove: G.B }), 1),
];

writeSongCompact(import.meta.url, {
  title: 'Heliobane - Verdigris Tide', bpm: 165, ticks: 6, mixvol: 46,
  message: 'HELIOBANE stage 2 "Verdigris Tide" (MUSIC-A).\nB minor -> C# minor, 165 BPM. Orders 1-9 loop.\nAll samples synthesized. Source: songs/heliobane_stage2.gen.js',
  samples: [
    kick({ f0: 200, decay: 11 }), snare({ tone: 180, decay: 15, seed: 37, drive: 1.6 }), cymbal('hat closed', { seed: 33 }),
    cymbal('hat open', { sec: 0.35, decay: 8, seed: 34 }), cymbal('crash', { sec: 1.3, decay: 2.4, seed: 38, metalMix: 0.35 }),
    wave('round bass', BASS_AMPS.map((a, k) => a / (1 + k * 0.4))), { name: 'bell', synth: { wave: 'pluck', seconds: 1.2, decay: 3 } },
    wave('glass lead', [1, 0.05, 0.42, 0.03, 0.22, 0.02, 0.12, 0, 0.06]), superSaw('sea pad', { base: 90, cyc: 96 }), noiseLoop(),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
