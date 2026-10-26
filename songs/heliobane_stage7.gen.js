#!/usr/bin/env node
/**
 * HELIOBANE stage 7 — "Halvard's Rings" (the gas giant's ice rings). MUSIC-C, 2026-09-25.
 * F# minor (→ G# minor), 164 BPM (libopenmpt plays 164.06: 672 samples/tick),
 * speed 6: 4 rows/beat, 16 rows/bar, 8 bars = 11.7 s.
 *
 * Identity: ice. A glass-bell ladder rolls up and down two octaves of each chord
 * in 16ths, with a 3-row canon an octave higher panned opposite (the ring). The hook climbs in
 * fourths, G# C# F#, in a 3-3-2 rhythm and falls back by thirds; quartal leaps and
 * add9 / maj7 colours keep it glassy. Four-on-the-floor kick with offbeat open hats.
 *
 * Phrase map
 *   Intro   F#madd9 Dadd9 A E            bell ladder + canon, ice cracks, pad swell, kick in bar 3 (not looped)
 *   A       F#madd9 Dadd9 A E / F#madd9 Dmaj7 Bm7 C#   "G# C# F#—" fourths; answer peaks B6, opens on C#
 *   A2      same + ping-pong echo
 *   B       Dmaj7 E C#m7 F#m Bm7 E A C#   long notes, A6 over F#m
 *   Rings   Dmaj7 E F#m F#m Dmaj7 E C# C#  no lead: bell melody with a 6-row echo over the ladder, kick + hats only
 *   Build   Bm7 C#m D D#                   D# = V of G# minor
 *   A↑ B↑   G# minor with written harmony
 *   Turn    E D C# C#                      VI–bVI–V of F# minor → loop to A
 * Loop body: orders 1–8 (56 bars, 81.9 s).
 */
import { kick, snare, cymbal, noiseLoop, wave, BASS_AMPS, glassBell, thinPad, swell, clank,
  mel, line, chart, bass, pad, harmony, beat, pattern, jump, writeSongCompact,
  ladder, pingpong, canon, gate, notesOf, drumKit, hits, riser, roll, merge, triads, coldPad , cutLanes } from './heliobane_stage6.kit.js';
import { nn, ns } from './lib.js';

const I = { kick: 0, snare: 1, hat: 2, ohat: 3, crash: 4, bass: 5, bell: 6, lead: 7, pad: 8, noise: 9, ice: 10, swell: 11 };
const LAYOUT = ['kick', 'snare', 'hat', 'bass', 'bells', 'canon', 'lead', 'echo', 'echo2', 'pad', 'fx'];
const PANS = [0x80, 0x78, 0xb4, 0x80, 0x44, 0xbc, 0x88, 0x54, 0xac, 0x70, 0x94];
const KMAP = { X: [I.kick, 62], x: [I.kick, 46] };
const drums = drumKit({
  kick: KMAP,
  snare: { X: [I.snare, 54], x: [I.snare, 38], g: [I.snare, 14] },
  hat: { X: [I.hat, 34], x: [I.hat, 25], g: [I.hat, 15], o: [I.ohat, 28], O: [I.ohat, 32] },
});
const G = {
  main: { kick: 'X...X...X...X..x', snare: '....X.......X...', hat: 'xgoxxgoxxgoxxgox' },
  B: { kick: 'X...X...X.x.X...', snare: '....X..g....X...', hat: 'xgoxxgoxxgoxxgOx' },
  rings: { kick: 'X.......X.......', snare: '................', hat: '..o...o...o...o.' },
  fill: { kick: 'X...X...X...X.x.', snare: '....X...X.xxXxXX', hat: 'xgoxxgox........' },
};
const CH = {
  intro: 'F#madd9 Dadd9 A E', A: 'F#madd9 Dadd9 A E F#madd9 Dmaj7 Bm7 C#', B: 'Dmaj7 E C#m7 F#m Bm7 E A C#',
  rings: 'Dmaj7 E F#m F#m Dmaj7 E C# C#', build: 'Bm7 C#m D D#', turn: 'E D C# C#',
};

// ---------------------------------------------------------------- melodies
const A_MEL = 'g#5/3 c#6/3 f#6/2 c#6/4 a5/4 | e6/3 a5/3 d6/2 e6/8~ | c#6/3 e6/3 a6/2 e6/4 c#6/4 | b5/12~ g#5/4'
  + ' | g#5/3 c#6/3 f#6/2 c#6/4 a5/4 | a5/3 d6/3 f#6/2 e6/4 c#6/4 | d6/3 f#6/3 b6/2 a6/4 f#6/4 | g#6/8~ f6/4 c#6/4';
const B_MEL = 'a5/4 c#6/4 f#6/8~ | g#6/8~ e6/4 b5/4 | b5/4 c#6/4 e6/4 g#6/4 | a6/8~ g#6/4 f#6/4'
  + ' | f#6/6 d6/2 a5/8 | g#6/6 e6/2 b5/8 | c#6/4 e6/4 a6/8~ | g#6/8~ f6/4 c#6/4';
const RING_MEL = 'f#6/8 c#6 | e6/8 b5 | c#6/16 | a5/8 c#6 | f#6/8 a6 | g#6/8 e6 | f6/16 | g#6/16';
const BUILD_MEL = 'f#5/4 b5 d6 f#6 | e6/4 g#6 c#6 e6 | f#6/4 a6 d6 f#6 | g6/16~';
const TURN_MEL = 'g#6/8 e6 | f#6/8 a6 | g#6/16~ | f6/8 c#6';

// ---------------------------------------------------------------- parts
const BASS = { A: ['R.RoR.RoR.RoR.fo'], B: ['R.RrR.RoR.RrR.Ro'], rings: ['R-------R---o---'], build: ['R.R.R.R.R.R.R.R.', 'R.R.R.R.R.R.R.R.', 'RrRrRrRrRrRrRrRr', 'RrRrRrRrRRRRRRRR'] };
const RING = [0, 2, 4, 6, 5, 4, 3, 1, 0, 1, 3, 5, 6, 4, 2, 1];

/** Bell ladder + a 3-row canon an octave higher (the ice glint), both thinned wherever they would rub against the lead (`refs`). */
const octaveUp = (ch) => Object.fromEntries(Object.entries(ch).map(([r, e]) => [r, e.note && e.note !== '^^' ? { ...e, note: ns(nn(e.note) + 12) } : e]));
function ringParts(segs, rows, { vol = 28, lo = 'F#4', refs = [] } = {}) {
  const notes = ladder(segs, rows, RING, { lo, span: 7, vol, soft: 6 }), ch = gate(line(notes, I.bell, { rows, vib: null }), rows, { refs });
  return { bells: ch, canon: gate(octaveUp(canon(ch, notes, rows, { delay: 3, scale: 0.42, segs })), rows, { refs }) };
}
function section(name, bars, chordStr, { semi = 0, melody, groove = G.main, fill = true, echo = false, harm = false,
  bassR = BASS.A, bellVol = 28, extraRefs = [], extra = {} } = {}) {
  const rows = bars * 16, segs = chart(chordStr, { semi }), tri = chart(triads(chordStr), { semi });
  const parts = { ...drums(bars, groove, fill ? G.fill : null), fx: hits(I.crash, [0], { vol: 36 }),
    bass: bass(tri, bassR, I.bass, { rows, lo: 'C#3', vol: 40 }) };
  const refs = [];
  if (melody) {
    const notes = mel(melody, { semi, vol: 44 }), ch = line(notes, I.lead, { rows, vib: 'H43' });
    parts.lead = ch; refs.push(notes);
    if (echo) {
      [parts.echo, parts.echo2] = pingpong(ch, notes, rows, { segs });
      refs.push(notesOf(parts.echo, rows), notesOf(parts.echo2, rows));
    }
    if (harm) {
      parts.echo = line(harmony(notes, tri), I.lead, { rows, vib: null });
      parts.echo2 = canon(ch, notes, rows, { delay: 6, scale: 0.22, segs, refs: [notesOf(parts.echo, rows)] });
      refs.push(notesOf(parts.echo, rows));
    }
  }
  Object.assign(parts, ringParts(tri, rows, { vol: bellVol, refs: refs.concat(extraRefs) }));
  parts.pad = coldPad(tri, I.pad, { rows, lo: 'E-5', vol: 11, refs: refs.concat(extraRefs) });
  return pattern(name, bars, cutLanes({ ...parts, ...extra }), LAYOUT, PANS);
}

const intro = section('intro: ring', 4, CH.intro, { fill: false, bellVol: 30, extra: {
  fx: merge(hits(I.ice, [0, 24, 40], { note: 'C-6', vol: 30 }), hits(I.swell, [52], { vol: 34 })),
  bass: { 0: { note: '^^' }, ...Object.fromEntries(Object.entries(bass(chart(CH.intro), BASS.A, I.bass, { rows: 64, lo: 'C#3', vol: 40 })).filter(([r]) => r >= 32)) },
  kick: beat(['................', '................', 'X...X...X...X...', 'X...X...X...X.x.'], KMAP),
  snare: merge(beat(['................', '................', '................', '....X...........'], { X: [I.snare, 54] }), roll(I.snare, 56, 8, { v0: 26, dv: 3 })),
  hat: beat(['................', '................', '..o...o...o...o.', 'xgoxxgox........'], { x: [I.hat, 17], g: [I.hat, 10], o: [I.ohat, 21] }),
} });

const ringSegs = chart(triads(CH.rings)), ringNotes = mel(RING_MEL, { vol: 36 }), ringLead = line(ringNotes, I.bell, { rows: 128, vib: null });
const rings = section('rings: bell melody', 8, CH.rings, { groove: G.rings, fill: false, bassR: BASS.rings, bellVol: 22, extraRefs: [ringNotes], extra: {
  lead: ringLead, echo: canon(ringLead, ringNotes, 128, { delay: 6, scale: 0.45, segs: ringSegs }),
  fx: merge(hits(I.crash, [0], { vol: 30 }), hits(I.ice, [24, 56, 88], { note: 'C-6', vol: 26 }), hits(I.swell, [116], { vol: 32 })),
} });

const build = section('build to G# minor', 4, CH.build, { melody: BUILD_MEL, bassR: BASS.build, fill: false, extra: {
  fx: riser(I.noise, 32, 64), snare: merge(beat(['....X.......X...', '..x...x...x...x.', 'x.x.x.x.x.x.x.x.', '................'], { X: [I.snare, 54], x: [I.snare, 38] }), roll(I.snare, 48, 16, { v0: 22, dv: 2 })),
  kick: beat(['X...X...X...X...', 'X...X...X...X...', 'X.X.X.X.X.X.X.X.', 'X.X.X.X.X.X.X.X.'], KMAP) } });

const patterns = [
  intro,
  section('A: fourths hook', 8, CH.A, { melody: A_MEL }),
  section('A2: hook + ping-pong echo', 8, CH.A, { melody: A_MEL, echo: true }),
  section('B: long notes', 8, CH.B, { melody: B_MEL, groove: G.B, bassR: BASS.B, echo: true }),
  rings,
  build,
  section('A up: G# minor + harmony', 8, CH.A, { melody: A_MEL, semi: 2, harm: true }),
  section('B up: G# minor + harmony', 8, CH.B, { melody: B_MEL, semi: 2, groove: G.B, bassR: BASS.B, harm: true }),
  jump(section('turn: E D C#', 4, CH.turn, { melody: TURN_MEL, groove: G.B, bassR: BASS.B }), 1),
];

writeSongCompact(import.meta.url, {
  title: "Heliobane - Halvard's Rings", bpm: 164, ticks: 6, mixvol: 44,
  message: 'HELIOBANE stage 7 "Halvard\'s Rings" (MUSIC-C, World 2).\nF# minor -> G# minor, 164 BPM. Orders 1-8 loop.\nAll samples synthesized. Source: songs/heliobane_stage7.gen.js',
  samples: [
    kick({ f0: 230, decay: 13 }), snare({ tone: 215, decay: 18, seed: 71, drive: 1.7 }), cymbal('hat closed', { seed: 73 }),
    cymbal('hat open', { sec: 0.3, decay: 10, seed: 74 }), cymbal('crash', { sec: 1.5, decay: 2.2, seed: 78, metalMix: 0.3 }),
    wave('round bass', BASS_AMPS.map((a, k) => a / (1 + k * 0.5))),
    glassBell('ice bell', { sec: 1.3, partials: [[1, 1, 2.2], [2.76, 0.5, 5], [5.4, 0.26, 9], [8.93, 0.12, 15], [13.3, 0.05, 22]] }),
    wave('glass lead', [1, 0.04, 0.4, 0.03, 0.2, 0.02, 0.12, 0, 0.06]), thinPad('ice pad', { amps: [1, 0, 0.3, 0, 0.14, 0, 0.06] }),
    noiseLoop(), { ...clank('ice crack', { base: 620, sec: 0.5, bright: 1.4, seed: 75 }), role: 'percussion' }, swell(),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
