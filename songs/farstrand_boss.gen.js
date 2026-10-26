#!/usr/bin/env node
/**
 * FARSTRAND — "Herald" (every Herald fight: the Pollard first). 2026-09-25.
 * E minor, 160 BPM, speed 6: 4 rows/beat, 16 rows/bar; one row = a 16th (94 ms), one bar = 1.5 s.
 * Rendered at 48 kHz, where 160 BPM is exact (750 samples/tick).
 *
 * Identity: relentless and driving, but in Farstrand's palette, not Heliobane's chip brightness: no
 * power chords, no orchestra hits, no pulse leads. The drive comes from a gritty rolled-off saw bass in
 * 16ths accented 3+3+2 (the Heralds' rhythm in Heliobane), low dark drums (the snare's noise low-passed)
 * with glass ticks for hats, the dark filtered-saw pluck rolling 16ths with Farstrand's dotted-8th
 * (3-row) delay panned opposite, a held cold pad, the hollow glass lead with its 3/6-row ping-pong echo,
 * and glass bells ringing the 3-3-2 accents two octaves up. The hook is Heliobane's Herald motif ("5 1
 * b3 | 2 1" in 3-3-2-4-4, heliobane_boss.gen.js) in E minor, "B E G | F# E"; its answer bends onto F
 * major (bII, Halm's wrong light). The break quotes the title motif ("B—G——F#, E———", 5 up a minor sixth
 * to b3, 2, 1) on glass bells over half-time drums, its second statement broken off.
 *
 * Phrase map
 *   Intro   Em Em Em B7                ostinato and glass ticks, drums from bar 3, a fill, a riser (not looped)
 *   A       Em Em C B7 | Em Em F B7    the Herald motif "B E G | F# E", held B; up on C (C E G B), B7;
 *                                      again, then "C A F" over F (bII) and down to B
 *   A2      same                       the answer climbs ("E G B | A G", E7), the bells ring the 3-3-2 accents
 *   B       C D Bm Em | C D F B7        eighth-note kicks; a rising sequence in the lead, dotted quarter +
 *                                      8th + half, E G E, F# A F#, D F# B, G; E G C, D C A, C A F, F# D# B
 *   Break   Em C Am B | Em C F B7       half time, 8th bass, no lead; the title motif on glass bells with a
 *                                      ping-pong echo, broken off after "B G F# | E"; toms in the last bar
 *   A3      Em Em C B7 | Em Em F B7    the motif again, doubled by glass bells an octave up, eighth kicks
 *   Build   C C#dim D B7                the bass climbs C C# D to B7; snare in 8ths, then a 16th roll and a
 *                                      riser; the loop jumps back to A
 * Loop body: orders 1-6 (44 bars, 66 s). Everything synthesized. Source of truth: this file; the shared
 * helpers come from farstrand_halm.gen.js.
 */
import { kick, cymbal, noiseLoop, wave, glassBell, thinPad, mel, line, chart, at, bass, pattern, jump,
  writeSongCompact, ladder, pingpong, notesOf, drumKit, triads, cutLanes, riser } from './heliobane_stage6.kit.js';
import { nn, ns } from './lib.js';
import { sawPluck, soften, delayLine, padLane } from './farstrand_halm.gen.js';

const I = { kick: 0, snare: 1, hat: 2, tom: 3, bass: 4, pluck: 5, lead: 6, pad: 7, bell: 8, noise: 9 };
const LAYOUT = ['kick', 'snare', 'hat', 'bass', 'arp', 'canon', 'lead', 'echo', 'echo2', 'pad', 'bells', 'bellEcho', 'fx'];
const PANS = [0x80, 0x78, 0xac, 0x80, 0x56, 0xaa, 0x86, 0x50, 0xb4, 0x70, 0x9c, 0x5c, 0x88];
const KEYS = ['lead', 'echo', 'echo2', 'arp', 'canon', 'pad', 'bells', 'bellEcho'];
const drums = drumKit({
  kick: { X: [I.kick, 60], x: [I.kick, 44] },
  snare: { X: [I.snare, 50], x: [I.snare, 34], g: [I.snare, 14], t: [I.tom, 46, null, 'C-5'], T: [I.tom, 50, null, 'G-4'] },
  hat: { X: [I.hat, 20], x: [I.hat, 13], g: [I.hat, 7] },
});

// ---------------------------------------------------------------- grooves (3+3+2 DNA)
const G = {
  main: { kick: 'X..X..X.X..X..X.', snare: '....X.......X...', hat: 'XgxgXgxgXgxgXgxg' },
  drive: { kick: 'X.X.X.X.X.X.X.X.', snare: '....X.......X...', hat: 'XgxgXgxgXgxgXgxg' },
  half: { kick: 'X.........X.....', snare: '........X.......', hat: 'x.g.x.g.x.g.x.g.' },
  ticks: { kick: '................', snare: '................', hat: 'x.g.x.g.x.g.x.g.' },
  fill: { kick: 'X..X..X.X.......', snare: '....X...XxXxtTtT', hat: 'XgxgXgxg........' },
  toms: { kick: 'X.........X.....', snare: '........tTtTtTtT', hat: 'x...x...........' },
  eights: { kick: 'X.X.X.X.X.X.X.X.', snare: '....X...X.X.X.X.', hat: 'XgxgXgxgXgxgXgxg' },
  roll: { kick: 'X...X...X...X...', snare: 'XxXxXxXxXXXXXXXX', hat: '................' },
};
const OST = ['RroRroRoRroRroRo', 'RroRroRoRroRt-o-'];
const BASS = { drive: ['R-r-R-r-R-r-R-o-'], held: ['R---------------'], climb: ['RroRroRoRroRroRo'] };

// ---------------------------------------------------------------- melodies
const MOTIF = 'b5/3 e6/3 g6/2 f#6/4 e6/4';  // Heliobane's Herald motif in E minor, 3-3-2-4-4
const A_MEL = `${MOTIF} | b5/16~ | c6/3 e6/3 g6/2 b6/8~ | a6/4 f#6/4 d#6/8`
  + ` | ${MOTIF} | g6/8 b6/8~ | c7/3 a6/3 f6/2 a6/8~ | f#6/8 d#6/4 b5/4`;
const A2_MEL = `${MOTIF} | b5/16~ | c6/3 e6/3 g6/2 b6/8~ | a6/4 f#6/4 d#6/8`
  + ' | e6/3 g6/3 b6/2 a6/4 g6/4 | b6/8 e7/8~ | f6/3 a6/3 c7/2 a6/8~ | b6/4 a6/4 f#6/4 d#6/4';
const B_MEL = 'e6/6 g6/2 e6/8 | f#6/6 a6/2 f#6/8 | d6/6 f#6/2 b6/8 | g6/16~'
  + ' | e6/6 g6/2 c7/8 | d7/6 c7/2 a6/8 | c7/6 a6/2 f6/8 | f#6/4 d#6/4 b5/8';
const BREAK_BELLS = 'b5/4 g6/10 f#6/2 | e6/16 | b5/4 a6/10 g6/2 | f#6/16 | b5/4 g6/10 f#6/2 | e6/16 | r/16 | r/16';
const BUILD_MEL = 'e6/3 g6/3 c7/2 b6/8 | e6/3 g6/3 c#7/2 a#6/8 | f#6/3 a6/3 d7/2 c7/8 | d#7/16~';
const CH = {
  intro: 'Em Em Em B7', A: 'Em Em C B7 Em Em F B7', B: 'C D Bm Em C D F B7', brk: 'Em C Am B Em C F B7',
  build: 'C C#dim D B7',
};
const ROLL = [0, 2, 3, 5, 4, 2, 3, 1, 0, 2, 3, 5, 6, 5, 3, 2];

// ---------------------------------------------------------------- parts
const TAU = 2 * Math.PI, ACC = [0, 3, 6, 8, 11, 14];
/** A darker snare than the kit's: the same two-mode body, but its noise through a two-pole low-pass
 *  (about 2 kHz) with only a short bright crack, so the backbeat does not sparkle. */
function darkSnare(name = 'dark snare', { tone = 165, sec = 0.32, seed = 41, lp = 0.45, drive = 1.5 } = {}) {
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
/** Glass bells on the 3-3-2 accents: the chord's three tones from `lo` up, falling across each group. */
function accentBells(segs, rows, { lo = 'E-6', vol = 24 } = {}) {
  const notes = [];
  for (let r = 0; r < rows; r++) {
    const i = ACC.indexOf(r % 16);
    if (i < 0) continue;
    const s = at(segs, r), rungs = [];
    for (let p = nn(lo); rungs.length < 3; p++) if (s.tones.has(p % 12)) rungs.push(p);
    const next = ACC[i + 1] ?? 16;
    notes.push([r, ns(rungs[[2, 1, 0][i % 3]]), next - (r % 16), i % 3 ? vol - 6 : vol, '']);
  }
  return notes;
}

function section(name, bars, chordStr, { melody = null, melVol = 42, groove = G.main, fill = null, bassR = OST, bassVol = 40,
  arpVol = 24, padVol = 16, accents = false, bells = null, bellVol = 40, doubled = false, extra = {} } = {}) {
  const rows = bars * 16, segs = chart(chordStr), tri = chart(triads(chordStr));
  const parts = { ...drums(bars, groove, fill), bass: bass(tri, bassR, I.bass, { rows, lo: 'C-3', vol: bassVol, soft: 0.7, decay: 0.9 }) };
  const refs = [];
  if (melody) {
    const notes = mel(melody, { vol: melVol }), ch = line(notes, I.lead, { rows, vib: 'H33', vibDelay: 3 });
    parts.lead = ch; refs.push(notes);
    [parts.echo, parts.echo2] = pingpong(ch, notes, rows, { d1: 3, s1: 0.4, d2: 6, s2: 0.2, segs });
    refs.push(notesOf(parts.echo, rows), notesOf(parts.echo2, rows));
    if (doubled) {
      const up = mel(melody, { vol: 22, semi: 12 });
      parts.bells = soften(line(up, I.bell, { rows, vib: null }), rows, refs.slice(1));
      refs.push(notesOf(parts.bells, rows));
    }
  }
  if (bells) {
    const notes = mel(bells, { vol: bellVol }), ch = soften(line(notes, I.bell, { rows, vib: null }), rows, refs);
    parts.bells = ch;
    [parts.bellEcho, parts.echo2] = pingpong(ch, notes, rows, { d1: 3, s1: 0.42, d2: 6, s2: 0.22, segs });
    refs.push(notes, notesOf(parts.bellEcho, rows), notesOf(parts.echo2, rows));
  }
  if (accents) {
    parts.bellEcho = soften(line(accentBells(segs, rows), I.bell, { rows, vib: null }), rows, refs);
    refs.push(notesOf(parts.bellEcho, rows));
  }
  const arpNotes = ladder(segs, rows, ROLL, { lo: 'E-4', span: 8, vol: arpVol, soft: 7, len: 1 });
  parts.arp = soften(line(arpNotes, I.pluck, { rows, vib: null }), rows, refs);
  parts.canon = soften(delayLine(parts.arp, rows, segs, { delay: 3, scale: 0.4 }), rows, [...refs, notesOf(parts.arp, rows)]);
  parts.pad = padLane(segs, tri, rows, refs, { lo: 'E-5', vol: padVol, inst: I.pad });
  return pattern(name, bars, cutLanes({ ...parts, ...extra }, KEYS), LAYOUT, PANS);
}

// ---------------------------------------------------------------- sections
const intro = section('intro: the ostinato', 4, CH.intro, { arpVol: 0, padVol: 12, bassVol: 36, extra: {
  ...drums(4, G.ticks, null), ...(() => { const d = drums(2, G.main, G.fill); return {
    kick: Object.fromEntries(Object.entries(d.kick).map(([r, e]) => [+r + 32, e])),
    snare: Object.fromEntries(Object.entries(d.snare).map(([r, e]) => [+r + 32, e])),
  }; })(),
  arp: { 0: { note: '^^' } }, canon: { 0: { note: '^^' } },
  fx: riser(I.noise, 40, 64, { note: 'C-4', v0: 4, slope: 1.0, fx: 'F03' }),
} });
const build = section('build: the climb', 4, CH.build, { melody: BUILD_MEL, groove: G.drive, bassR: BASS.climb, bassVol: 42,
  arpVol: 26, padVol: 18, extra: {
    ...(() => { const d = drums(4, G.drive, null), e = drums(2, G.eights, G.roll); return {
      kick: { ...Object.fromEntries(Object.entries(d.kick).filter(([r]) => +r < 32)), ...Object.fromEntries(Object.entries(e.kick).map(([r, x]) => [+r + 32, x])) },
      snare: { ...Object.fromEntries(Object.entries(d.snare).filter(([r]) => +r < 32)), ...Object.fromEntries(Object.entries(e.snare).map(([r, x]) => [+r + 32, x])) },
      hat: { ...Object.fromEntries(Object.entries(d.hat).filter(([r]) => +r < 32)), ...Object.fromEntries(Object.entries(e.hat).map(([r, x]) => [+r + 32, x])) },
    }; })(),
    fx: riser(I.noise, 32, 64, { note: 'C-4', v0: 4, slope: 1.1, fx: 'F03' }),
  } });

const patterns = [
  intro,
  section('A: the Herald motif', 8, CH.A, { melody: A_MEL, fill: G.fill }),
  section('A2: the answer climbs', 8, CH.A, { melody: A2_MEL, accents: true, padVol: 18, fill: G.fill }),
  section('B: the sequence', 8, CH.B, { melody: B_MEL, melVol: 44, groove: G.drive, bassR: BASS.drive, bassVol: 42, arpVol: 26, padVol: 20, fill: G.fill }),
  section('break: the title motif in glass', 8, CH.brk, { bells: BREAK_BELLS, bellVol: 48, groove: G.half, fill: G.toms, bassR: BASS.drive,
    bassVol: 38, arpVol: 24, padVol: 22 }),
  section('A3: the motif doubled in glass', 8, CH.A, { melody: A_MEL, doubled: true, groove: G.drive, arpVol: 26, padVol: 18, fill: G.fill }),
  jump(build, 1),
];

writeSongCompact(import.meta.url, {
  title: 'Farstrand - Herald', bpm: 160, ticks: 6, mixvol: 48,
  message: 'FARSTRAND boss theme "Herald".\nE minor, 160 BPM. Orders 1-6 loop.\nThe hook is the HELIOBANE Herald motif; the break quotes the Farstrand title motif.\nAll samples synthesized. Source: songs/farstrand_boss.gen.js',
  samples: [
    kick({ f0: 160, f1: 46, sweep: 32, decay: 10, click: 0.3, drive: 2.0, sec: 0.35 }),
    darkSnare(),
    cymbal('glass tick', { sec: 0.05, decay: 100, seed: 17, metalMix: 0.7 }),
    { ...kick({ f0: 180, f1: 90, sweep: 25, decay: 12, click: 0.15, drive: 1.6, sec: 0.35 }), name: 'tom' },
    wave('grit bass', [1, 0.55, 0.38, 0.26, 0.18, 0.12, 0.08, 0.05, 0.03]),
    sawPluck('dark pluck', { open: 2600, closed: 300, close: 7, decay: 4, sec: 0.8 }),
    wave('glass lead', [1, 0.03, 0.45, 0.02, 0.22, 0.02, 0.1, 0, 0.05]),
    thinPad('cold pad', { amps: [1, 0, 0.3, 0, 0.12, 0, 0.05], spread: 1 }),
    glassBell('glass bell', { sec: 1.4, partials: [[1, 1, 1.9], [2.76, 0.45, 4.5], [5.4, 0.22, 8], [8.93, 0.1, 14]] }),
    noiseLoop(),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
