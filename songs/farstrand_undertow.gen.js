#!/usr/bin/env node
/**
 * FARSTRAND — "The Undertow" (Verrin's Herald: a flesh eel in a flooded trench of vents). 2026-09-26.
 * F# minor (Verrin's key), 150 BPM, speed 6: 4 rows/beat, 16 rows/bar; one row = a 16th (100 ms), one bar = 1.6 s.
 * Rendered at 44.1 kHz, where 150 BPM is exact (735 samples/tick).
 *
 * Identity: the Herald theme ("Herald", farstrand_boss.gen.js) re-scored for Verrin: heavy and surging. Heavy: 10
 * BPM slower than `boss`, a deeper kick, a half-time snare in A (beat 3 only), a gritty bass galloping the
 * Heralds' 3+3+2. Surging: every two bars the sea swells up and falls away (a looped noise rising and pitching
 * up, then dropping, like a wave pulling), and the bass, arp and pad swell with it (their volumes follow the
 * same two-bar wave), so the whole band surges and ebbs. Verrin's colour: the muffled pluck with its canons,
 * bubbles among the glass ticks, the cold pad, and the #11 over the bVI (G# over D) in the tune. The hook is
 * Heliobane's Herald motif ("5 1 b3 | 2 1" in 3-3-2-4-4) in F# minor, "C# F# A | G# F#"; its answer bends onto
 * G major (bII, the Heralds' wrong light). "Dark" is phase 3, the head alone in the dark: no lead, no snare, a
 * lub-dub kick, the bass pulsing, Verrin's cell ("C# A——", the title's leap) far off on glass bells with long
 * echoes; a riser brings the band back.
 *
 * Phrase map
 *   Intro   F#m F#m F#m C#7            the gallop bass and ticks, the first surge; drums from bar 3, a fill, a riser (not looped)
 *   A       F#m F#m D C#7 | F#m F#m G C#7   the Herald motif "C# F# A | G# F#", a held C#; up on D through the
 *                                      #11 (D F# G# A), down C#7; again, then "D B G B" over G (bII) and down to C#
 *   A2      same                       the answer climbs to F#7 and bends onto G; glass bells ring the 3-3-2
 *                                      accents; the snare on 2 and 4
 *   B       D E C#m F#m | D E G C#7    the chase: eighth-note kicks, the sequence rising (F# A F#, G# B G#,
 *                                      E G# C#, A; F# G# A, E D B, D B G, G# E# C#)
 *   Dark    F#m D Bm C#sus4-C# | F#m D G C#    the head alone in the dark: a lub-dub kick, the bass pulsing, Verrin's
 *                                      cell on glass bells with 6- and 12-row echoes; a riser over the last two bars
 *   A3      as A                       the motif doubled by glass bells an octave up, eighth-note kicks
 *   Build   D D#dim E C#7              the bass climbs D D# E to C#7, the motif's rhythm rising (D7, D#7, E7, E#7
 *                                      held), a snare roll and a riser; the loop jumps back to A
 * Loop body: orders 1-6 (44 bars, 70.4 s). Everything synthesized. Source of truth: this file; the shared
 * helpers come from farstrand_halm.gen.js, the sea and the bubble from farstrand_verrin.gen.js.
 */
import { kick, cymbal, wave, glassBell, thinPad, mel, line, chart, at, bass, pattern, jump, writeSongCompact, ladder,
  pingpong, notesOf, drumKit, triads, cutLanes, riser } from './heliobane_stage6.kit.js';
import { nn, ns } from './lib.js';
import { sawPluck, soften, delayLine, padLane } from './farstrand_halm.gen.js';
import { seaLoop, bubble } from './farstrand_verrin.gen.js';

const I = { kick: 0, snare: 1, hat: 2, tom: 3, bass: 4, pluck: 5, lead: 6, pad: 7, bell: 8, sea: 9, bub: 10 };
const LAYOUT = ['kick', 'snare', 'hat', 'bass', 'arp', 'canon', 'lead', 'echo', 'echo2', 'pad', 'bells', 'bellEcho', 'sea', 'fx'];
const PANS = [0x80, 0x78, 0xac, 0x80, 0x56, 0xaa, 0x86, 0x50, 0xb4, 0x70, 0x9c, 0x5c, 0x80, 0x88];
const KEYS = ['lead', 'echo', 'echo2', 'arp', 'canon', 'pad', 'bells', 'bellEcho'];
const drums = drumKit({
  kick: { X: [I.kick, 52], x: [I.kick, 40] },
  snare: { X: [I.snare, 50], x: [I.snare, 34], g: [I.snare, 14], t: [I.tom, 46, null, 'A-4'], T: [I.tom, 50, null, 'E-4'] },
  hat: { X: [I.hat, 20], x: [I.hat, 13], g: [I.hat, 7], b: [I.bub, 18, null, 'C-6'], d: [I.bub, 15, null, 'G-5'] },
});

// ---------------------------------------------------------------- grooves (3+3+2, heavier)
const G = {
  heavy: { kick: 'X..X..X.X..X..X.', snare: '........X.......', hat: 'XgxbXgxgXgxdXgxg' },
  main: { kick: 'X..X..X.X..X..X.', snare: '....X.......X...', hat: 'XgxgXgxbXgxgXgxd' },
  drive: { kick: 'X.X.X.X.X.X.X.X.', snare: '....X.......X...', hat: 'XgxgXgxgXgxgXgxg' },
  ticks: { kick: '................', snare: '................', hat: 'x.g.x.b.x.g.x.d.' },
  dark: { kick: 'X..x............', snare: '................', hat: '......b.......d.' },
  fill: { kick: 'X..X..X.X.......', snare: '....X...XxXxtTtT', hat: 'XgxgXgxg........' },
  roll: { kick: 'X...X...X...X...', snare: 'XxXxXxXxXXXXXXXX', hat: '................' },
};
const OST = ['RroRroRoRroRroRo', 'RroRroRoRroRt-o-'];
const BASS = { drive: ['R-r-R-r-R-r-R-o-'], pulse: ['R-------r-------'], climb: ['RroRroRoRroRroRo'] };

// ---------------------------------------------------------------- melodies
const MOTIF = 'c#6/3 f#6/3 a6/2 g#6/4 f#6/4';  // Heliobane's Herald motif in F# minor, 3-3-2-4-4
const QUESTION = `${MOTIF} | c#6/16~ | d6/3 f#6/3 g#6/2 a6/8~ | g#6/4 e#6/4 c#6/8`;
const A_MEL = `${QUESTION} | ${MOTIF} | a6/8 c#7/8~ | d7/3 b6/3 g6/2 b6/8~ | g#6/8 e#6/4 c#6/4`;
const A2_MEL = `${QUESTION} | f#6/3 a6/3 c#7/2 b6/4 a6/4 | c#7/8 f#7/8~ | g6/3 b6/3 d7/2 b6/8~ | c#7/4 b6/4 g#6/4 e#6/4`;
const B_MEL = 'f#6/6 a6/2 f#6/8 | g#6/6 b6/2 g#6/8 | e6/6 g#6/2 c#7/8 | a6/16~'
  + ' | f#6/6 g#6/2 a6/8 | e7/6 d7/2 b6/8 | d7/6 b6/2 g6/8 | g#6/4 e#6/4 c#6/8';
const DARK_BELLS = 'r/4 c#6/4 a6/8~ | g#6/16 | r/16 | r/16 | r/4 c#6/4 a6/8~ | f#6/16 | b6/16 | g#6/16';
const BUILD_MEL = 'f#6/3 a6/3 d7/2 c#7/8 | f#6/3 a6/3 d#7/2 c7/8 | g#6/3 b6/3 e7/2 d7/8 | e#7/16~';
const CH = {
  intro: 'F#m F#m F#m C#7', A: 'F#m F#m D C#7 F#m F#m G C#7', B: 'D E C#m F#m D E G C#7',
  dark: 'F#m D Bm C#sus4/8 C#/8 F#m/16 D G C#', build: 'D D#dim E C#7',
};
const ROLL = [0, 2, 3, 5, 4, 2, 3, 1, 0, 2, 3, 5, 6, 5, 3, 2];

// ---------------------------------------------------------------- parts
const TAU = 2 * Math.PI, ACC = [0, 3, 6, 8, 11, 14];
/** The Herald's dark snare (as in farstrand_boss): a two-mode body, its noise through a two-pole low-pass. */
function darkSnare(name = 'dark snare', { tone = 150, sec = 0.34, seed = 47, lp = 0.4, drive = 1.6 } = {}) {
  const sr = 22050, n = Math.round(sec * sr), d = new Array(n);
  let s = seed >>> 0, a = 0, b = 0;
  const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 2147483648 - 1; };
  for (let i = 0; i < n; i++) {
    const t = i / sr, w = rnd();
    a += lp * (w - a); b += lp * (a - b);
    const body = (Math.sin(TAU * tone * t) * Math.exp(-t * 22) + 0.5 * Math.sin(TAU * tone * 1.71 * t) * Math.exp(-t * 32)) * 0.9;
    d[i] = Math.tanh(drive * (body + b * 2.4 * Math.exp(-t * 12) + w * Math.exp(-t * 400) * 0.25));
  }
  for (let i = 0; i < 48; i++) d[n - 1 - i] *= i / 48;
  let m = 0; for (const x of d) m = Math.max(m, Math.abs(x));
  return { name, samplerate: sr, channels: [d.map((x) => Math.round((x / m) * 970) / 1000)], role: 'percussion' };
}
/** Glass bells on the 3-3-2 accents: the chord's three tones from `lo` up, falling across each group. */
function accentBells(segs, rows, { lo = 'F#6', vol = 24 } = {}) {
  const notes = [];
  for (let r = 0; r < rows; r++) {
    const i = ACC.indexOf(r % 16);
    if (i < 0) continue;
    const s = at(segs, r), rungs = [];
    for (let p = nn(lo); rungs.length < 3; p++) if (s.tones.has(p % 12)) rungs.push(p);
    notes.push([r, ns(rungs[[2, 1, 0][i % 3]]), (ACC[i + 1] ?? 16) - (r % 16), i % 3 ? vol - 6 : vol, '']);
  }
  return notes;
}
/** The two-bar wave: a volume factor that rises from `lo` to 1 over the first bar and a half and falls back. */
const wave2 = (r, lo) => lo + (1 - lo) * Math.sin(Math.PI * Math.min(1, (r % 32) / 26)) ** 2;
/** Scale every vNN stamp of a lane by the two-bar wave (the band surging with the sea). */
function surgeLane(ch, lo = 0.6) {
  return Object.fromEntries(Object.entries(ch).map(([r, e]) => [r, e.vol?.startsWith('v')
    ? { ...e, vol: `v${Math.round(Number(e.vol.slice(1)) * wave2(+r, lo))}` } : e]));
}
/** The sea surging: every two bars the looped noise rises (volume and pitch) and falls away. */
function surge(bars, { lo = 3, hi = 26, note = 'C-4' } = {}) {
  const ch = {};
  for (let b = 0; b < bars * 16; b += 32) {
    ch[b] = { note, instrument: I.sea, vol: `v${lo}` };
    for (let r = 1; r < 32 && b + r < bars * 16; r++) {
      const up = r < 26;
      ch[b + r] = { vol: `v${Math.round(lo + (hi - lo) * (up ? (r / 26) ** 1.5 : 1 - (r - 26) / 6))}`, fx: up ? 'F01' : 'E02' };
    }
  }
  return ch;
}

function section(name, bars, chordStr, { melody = null, melVol = 42, groove = G.main, fill = null, bassR = OST, bassVol = 46,
  arpVol = 24, padVol = 16, accents = false, bells = null, bellVol = 40, doubled = false, surgeHi = 40, extra = {} } = {}) {
  const rows = bars * 16, segs = chart(chordStr), tri = chart(triads(chordStr));
  const parts = { ...drums(bars, groove, fill), sea: surge(bars, { hi: surgeHi }),
    bass: surgeLane(bass(tri, bassR, I.bass, { rows, lo: 'F#2', vol: bassVol, soft: 0.7, decay: 0.9 })) };
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
    [parts.bellEcho, parts.echo2] = pingpong(ch, notes, rows, { d1: 6, s1: 0.42, d2: 12, s2: 0.22, segs });
    refs.push(notes, notesOf(parts.bellEcho, rows), notesOf(parts.echo2, rows));
  }
  if (accents) {
    parts.bellEcho = soften(line(accentBells(segs, rows), I.bell, { rows, vib: null }), rows, refs);
    refs.push(notesOf(parts.bellEcho, rows));
  }
  const arpNotes = ladder(segs, rows, ROLL, { lo: 'F#4', span: 8, vol: arpVol, soft: 7, len: 1 });
  parts.arp = surgeLane(soften(line(arpNotes, I.pluck, { rows, vib: null }), rows, refs), 0.45);
  parts.canon = soften(delayLine(parts.arp, rows, segs, { delay: 3, scale: 0.4 }), rows, [...refs, notesOf(parts.arp, rows)]);
  parts.pad = surgeLane(padLane(segs, tri, rows, refs, { lo: 'E-5', vol: padVol, inst: I.pad }), 0.45);
  return pattern(name, bars, cutLanes({ ...parts, ...extra }, KEYS), LAYOUT, PANS);
}
const shiftCh = (ch, by) => Object.fromEntries(Object.entries(ch).map(([r, e]) => [+r + by, e]));
const upTo = (ch, row) => Object.fromEntries(Object.entries(ch).filter(([r]) => +r < row));

// ---------------------------------------------------------------- sections
const intro = section('intro: the gallop, the first surge', 4, CH.intro, { arpVol: 0, padVol: 12, bassVol: 38, extra: {
  ...drums(4, G.ticks, null), ...(() => { const d = drums(2, G.heavy, G.fill); return {
    kick: shiftCh(d.kick, 32), snare: shiftCh(d.snare, 32) }; })(),
  arp: { 0: { note: '^^' } }, canon: { 0: { note: '^^' } },
  fx: riser(I.sea, 40, 64, { note: 'C-5', v0: 4, slope: 1.0, fx: 'F03' }),
} });
const dark = section('dark: the head alone', 8, CH.dark, { groove: G.dark, bassR: BASS.pulse, bassVol: 40, arpVol: 14, padVol: 14,
  bells: DARK_BELLS, bellVol: 44, surgeHi: 22, extra: { fx: riser(I.sea, 96, 128, { note: 'C-4', v0: 4, slope: 1.1, fx: 'F03' }) } });
const build = section('build: the climb', 4, CH.build, { melody: BUILD_MEL, groove: G.drive, bassR: BASS.climb, bassVol: 44,
  arpVol: 26, padVol: 18, extra: {
    ...(() => { const d = drums(4, G.drive, null), e = drums(2, G.drive, G.roll); return {
      kick: { ...upTo(d.kick, 32), ...shiftCh(e.kick, 32) }, snare: { ...upTo(d.snare, 32), ...shiftCh(e.snare, 32) },
      hat: { ...upTo(d.hat, 32), ...shiftCh(e.hat, 32) } }; })(),
    fx: riser(I.sea, 32, 64, { note: 'C-4', v0: 4, slope: 1.1, fx: 'F03' }),
  } });

const patterns = [
  intro,
  section('A: the Herald motif, heavy', 8, CH.A, { melody: A_MEL, groove: G.heavy, fill: G.fill }),
  section('A2: the answer climbs', 8, CH.A, { melody: A2_MEL, accents: true, padVol: 18, fill: G.fill }),
  section('B: the chase', 8, CH.B, { melody: B_MEL, melVol: 44, groove: G.drive, bassR: BASS.drive, bassVol: 44, arpVol: 26,
    padVol: 20, fill: G.fill, surgeHi: 44 }),
  dark,
  section('A3: the motif doubled in glass', 8, CH.A, { melody: A_MEL, doubled: true, groove: G.drive, arpVol: 26, padVol: 18,
    fill: G.fill, surgeHi: 44 }),
  jump(build, 1),
];

writeSongCompact(import.meta.url, {
  title: 'Farstrand - The Undertow', bpm: 150, ticks: 6, mixvol: 48,
  message: 'FARSTRAND Herald fight "The Undertow" (Verrin).\nF# minor, 150 BPM. Orders 1-6 loop.\nThe hook is the HELIOBANE Herald motif; the dark section quotes the Verrin cell.\nAll samples synthesized. Source: songs/farstrand_undertow.gen.js',
  samples: [
    kick({ f0: 130, f1: 40, sweep: 26, decay: 8, click: 0.25, drive: 2.2, sec: 0.42 }),
    darkSnare(),
    cymbal('glass tick', { sec: 0.05, decay: 100, seed: 17, metalMix: 0.7 }),
    { ...kick({ f0: 160, f1: 80, sweep: 22, decay: 10, click: 0.15, drive: 1.6, sec: 0.4 }), name: 'tom' },
    wave('grit bass', [1, 0.55, 0.38, 0.26, 0.18, 0.12, 0.08, 0.05, 0.03]),
    sawPluck('muffled pluck', { open: 2200, closed: 280, close: 6, decay: 3.6, sec: 0.9 }),
    wave('glass lead', [1, 0.03, 0.45, 0.02, 0.22, 0.02, 0.1, 0, 0.05]),
    thinPad('cold pad', { amps: [1, 0, 0.3, 0, 0.12, 0, 0.05], spread: 2 }),
    glassBell('glass bell', { sec: 1.6, partials: [[1, 1, 1.6], [2.76, 0.45, 4], [5.4, 0.22, 8], [8.93, 0.1, 13]] }),
    seaLoop('sea noise', { air: 0.6 }), bubble(),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
