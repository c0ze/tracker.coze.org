#!/usr/bin/env node
/**
 * THAWLINE — "The Ark-Mother" (the Ossuary's Herald: a Ninth Light ark worn as a shell, trying to
 * launch). 2026-10-01.
 * A minor, 150 BPM, speed 6: 4 rows/beat, 16 rows/bar; one row = a 16th (100 ms), one bar = 1.6 s.
 * Rendered at 44100 Hz, where 150 BPM is exact (735 samples/tick).
 *
 * Identity: urgent and heavy, still tracker-sized: the Ossuary's palette (pulse bass, saw pluck, ember
 * lead, cold pad, glass bells, bone ticks) made heavier with a hull (a big low metal clank, the shell),
 * toms and a round drone an octave under the bass. The hook is the Heralds' motif, Heliobane's "5 1 b3 |
 * 2 1" in 3-3-2-4-4 (heliobane_boss.gen.js; Farstrand's Herald used it in E minor), here in A minor,
 * "E A C | B A": the Ossuary's cell inside it. Heavy is the motif low on the ember lead over a half-time
 * snare and the hull; urgent is the pulse bass in 16ths accented 3+3+2 (the Heralds' rhythm) and 16th
 * ticks. The launch is the B section: the bass climbs a step a bar (F G A A Bb C D E) under long lead
 * notes rising with it, the warm D (F#) burning near the top, kicks in 8ths, snares in 8ths, a riser.
 * It fails: the hold section falls (a noise downlifter), half time, the engine sputtering between Am and
 * Bb (the hive's half step), the hull cracking on 3 and the Ossuary's cell on low glass bells, reversed
 * into the lose sting's fall over Bb. Then the motif doubled in glass, and a chromatic climb back in.
 *
 * Phrase map
 *   Intro   Am Am Am E7                 the ostinato and the drone with bone ticks, one low bell, drums
 *                                       from bar 3, a fill, a riser (not looped)
 *   A       Am Am F E | Am Am Bb E7     the motif low ("E A C | B A"), E held; its shape over F up to F6;
 *                                       down E7; again, up to C E, "F D Bb D" over Bb. Half-time snare
 *                                       with the hull on 3, kick on the 3+3+2 (its 2 lands with them)
 *   A2      same                        same question; the answer takes the motif up an octave, then over
 *                                       Bb ("F Bb D | C Bb"), and falls through E7; backbeat on 2 and 4
 *   B       F G Am Am | Bb C D E7       the launch: a step a bar in the bass, long lead notes C D E, F G A
 *                                       with F# over D, G# held; 8th kicks, then 8th snares, a roll, a riser
 *   Hold    Am Bb Am Bb | F E F E7      it falls back: a downlifter, half time, the drone and whole-note
 *                                       bass, no lead; the cell on low glass bells with a 6-row echo,
 *                                       "Bb A F" over Bb; the hull on 3; toms in the last bar
 *   A3      Am Am F E | Am Am Bb E7     A2's line doubled an octave up on glass bells, the hull on 2 and 4
 *   Climb   F F#dim G G#dim             the motif's 3-3-2 on each chord as the bass climbs F F# G G# into
 *                                       A; 8th kicks, a snare roll, a riser; the loop jumps back to A
 * Loop body: orders 1-6 (44 bars, 70.4 s). Everything synthesized. Source of truth: this file; the
 * shared helpers come from heliobane_stage6.kit.js and farstrand_halm.gen.js, the palette from
 * thawline_ossuary.gen.js.
 */
import { kick, snare, cymbal, tom, noiseLoop, wave, glassBell, thinPad, clank,
  mel, line, chart, bass, beat, rep, pattern, jump, writeSongCompact,
  ladder, pingpong, notesOf, hits, triads, cutLanes, riser, fall } from './heliobane_stage6.kit.js';
import { sawPluck, soften, delayLine, padLane } from './farstrand_halm.gen.js';

const I = { kick: 0, snare: 1, hat: 2, hull: 3, tom: 4, bass: 5, drone: 6, pluck: 7, lead: 8, pad: 9, bell: 10, noise: 11 };
const LAYOUT = ['kick', 'snare', 'hat', 'hull', 'bass', 'drone', 'arp', 'canon', 'lead', 'echo', 'echo2', 'pad', 'bells', 'bellEcho', 'fx'];
const PANS = [0x80, 0x78, 0xa8, 0x88, 0x80, 0x80, 0x56, 0xaa, 0x84, 0x58, 0xb0, 0x70, 0x9c, 0x5c, 0x80];
const KEYS = ['lead', 'echo', 'echo2', 'arp', 'canon', 'pad', 'bells', 'bellEcho'];

// ---------------------------------------------------------------- melodies
const MOTIF = 'e5/3 a5/3 c6/2 b5/4 a5/4'; // the Heralds' motif (5 1 b3 | 2 1, 3-3-2-4-4) in A minor
const Q = `${MOTIF} | e5/16~ | f5/3 a5/3 c6/2 f6/8~ | e6/4 d6 b5 g#5`;
const A_MEL = `${Q} | ${MOTIF} | c6/8 e6/8~ | f6/3 d6/3 bb5/2 d6/8~ | e6/4 d6 b5 g#5`;
const A2_MEL = `${Q} | e6/3 a6/3 c7/2 b6/4 a6/4 | e6/16~ | f6/3 bb6/3 d7/2 c7/4 bb6/4 | g#6/4 e6 d6 b5`;
const B_MEL = 'c6/16~ | d6/16~ | e6/12~ c6/2 d6 | e6/8 a6/8 | f6/16~ | g6/16~ | a6/12~ f#6/2 g6 | g#6/16~';
const BELL_HOLD = 'r/4 a5/2 b5 c6/8 | r/4 bb5/2 a5 f5/8 | r/4 a5/2 b5 c6/8 | r/4 d6/2 c6 bb5/8'
  + ' | r/4 a5/2 b5 c6/8 | r/4 b5/2 g#5 e5/8 | r/4 c6/2 b5 a5/8 | g#5/16';
const CLIMB_MEL = 'f5/3 a5/3 c6/2 f6/8 | f#5/3 a5/3 c6/2 f#6/8 | g5/3 b5/3 d6/2 g6/8 | g#5/3 b5/3 d6/2 g#6/8';
const CH = {
  intro: 'Am Am Am E7', A: 'Am Am F E Am Am Bb E7', B: 'F G Am Am Bb C D E7', hold: 'Am Bb Am Bb F E F E7',
  climb: 'F F#dim G G#dim',
};
const ROLL = [0, 2, 3, 5, 4, 2, 3, 1, 0, 2, 3, 4, 5, 4, 3, 2]; // 16ths through 6 chord-tone rungs, E-4 up
const RISE = [0, 1, 2, 3, 4, 5, 4, 3, 1, 2, 3, 4, 5, 4, 3, 2];
const SLOW = [0, 2, 4, 3, 1, 3, 5, 4];                           // 8ths, the hold

// ---------------------------------------------------------------- rhythm
const BASS = { ost: ['RroRroRoRroRroRo'], whole: ['R-------R-------'], climb: ['RrRrRrRrRrRrRrRr'] };
const KM = { X: [I.kick, 50], x: [I.kick, 36] };
const SM = { X: [I.snare, 42], x: [I.snare, 28] };
const HM = { X: [I.hat, 28], x: [I.hat, 22], g: [I.hat, 12] };
const UM = { X: [I.hull, 34], x: [I.hull, 24], t: [I.tom, 44, null, 'C-5'], T: [I.tom, 48, null, 'G-4'] };
const G = {
  ticks: { kick: '................', snare: '................', hat: 'x.g.x.g.x.g.x.g.', hull: '................' },
  main: { kick: 'X..X..X.X.......', snare: '........X.......', hat: 'xgxgxgxgxgxgxgxg', hull: '........X.......' },
  fill: { kick: 'X..X..X.X.......', snare: '........X...XxXx', hat: 'xgxgxgxgxgxg....', hull: '........X.......' },
  A2: { kick: 'X..X..X.X..X..X.', snare: '....X.......X...', hat: 'xgxgxgxgxgxgxgxg', hull: '............X...' },
  burn: { kick: 'X.x.X.x.X.x.X.x.', snare: '....X.......X...', hat: 'xgxgxgxgxgxgxgxg', hull: '................' },
  burn8: { kick: 'X.x.X.x.X.x.X.x.', snare: 'x.x.X.x.x.x.X.x.', hat: 'xgxgxgxgxgxgxgxg', hull: '................' },
  roll: { kick: 'X...X...X...X...', snare: 'XxXxXxXxXXXXXXXX', hat: '................', hull: '................' },
  crack: { kick: 'X.........X.....', snare: '........X.......', hat: 'x...x...x...x...', hull: '........X.....x.' },
  crackOut: { kick: 'X.........X.....', snare: '........X.......', hat: 'x...x...........', hull: '........tTtTtTtT' },
  drive: { kick: 'X..X..X.X..X..X.', snare: '....X.......X...', hat: 'xgxgxgxgxgxgxgxg', hull: '....X.......X...' },
};
const MAPS = { kick: KM, snare: SM, hat: HM, hull: UM };
/** Drum lanes from per-bar grooves: `bars` of `g`, with `plan` overriding chosen bars ({bar index: groove}). */
const drums = (bars, g, plan = {}) => Object.fromEntries(Object.keys(MAPS).map((k) =>
  [k, beat(Array.from({ length: bars }, (_, i) => (plan[i] ?? plan[i - bars] ?? g)[k]), MAPS[k])]));

// ---------------------------------------------------------------- sections
function section(name, bars, chordStr, { melody = null, leadVol = 56, doubled = false, groove = G.main, plan = { [-1]: G.fill },
  bassR = BASS.ost, bassVol = 38, droneVol = 18, shape = ROLL, step = 1, arpVol = 22, padVol = 15, bell = null, bellVol = 40,
  extra = {} } = {}) {
  const rows = bars * 16, segs = chart(chordStr), tri = chart(triads(chordStr));
  const parts = { ...drums(bars, groove, plan),
    bass: bass(tri, bassR, I.bass, { rows, lo: 'E-3', vol: bassVol, soft: 0.66, decay: 0.88 }),
    drone: bass(tri, ['R---------------'], I.drone, { rows, lo: 'E-2', vol: droneVol, decay: 0.97 }) };
  const refs = [];
  if (melody) {
    const notes = mel(melody, { vol: leadVol }), ch = line(notes, I.lead, { rows, vib: 'H23', vibDelay: 4 });
    parts.lead = ch; refs.push(notes);
    [parts.echo, parts.echo2] = pingpong(ch, notes, rows, { d1: 3, s1: 0.38, d2: 6, s2: 0.2, segs });
    refs.push(notesOf(parts.echo, rows), notesOf(parts.echo2, rows));
    if (doubled) { // the line again an octave up on glass bells, kept a semitone clear of the echoes
      parts.bells = soften(line(mel(melody, { vol: 24, semi: 12 }), I.bell, { rows, vib: null }), rows, refs.slice(1));
      refs.push(notesOf(parts.bells, rows));
    }
  }
  if (bell) { // a glass-bell line and its 6-row echo
    parts.bells = soften(line(mel(bell, { vol: bellVol }), I.bell, { rows, vib: null }), rows, refs);
    parts.bellEcho = soften(delayLine(parts.bells, rows, segs, { delay: 6, scale: 0.4 }), rows, [...refs, notesOf(parts.bells, rows)]);
    refs.push(notesOf(parts.bells, rows), notesOf(parts.bellEcho, rows));
  }
  // The arp rolls 16ths (8ths in the hold) and yields where it would rub a semitone against the lead or
  // the bells; its canon trails 3 rows.
  const arpNotes = ladder(segs, rows, shape, { lo: 'E-4', span: 6, vol: arpVol, soft: 7, len: step });
  parts.arp = soften(line(arpNotes, I.pluck, { rows, vib: null }), rows, refs);
  parts.canon = soften(delayLine(parts.arp, rows, segs, { delay: 3, scale: 0.4 }), rows, [...refs, notesOf(parts.arp, rows)]);
  parts.pad = padLane(segs, tri, rows, refs, { lo: 'C-5', vol: padVol, inst: I.pad });
  return pattern(name, bars, cutLanes({ ...parts, ...extra }, KEYS), LAYOUT, PANS);
}

const intro = section('intro: the engine', 4, CH.intro, { plan: { 0: G.ticks, 1: G.ticks, 3: G.fill }, arpVol: 0, padVol: 12,
  extra: {
    arp: { 0: { note: '^^' } }, canon: { 0: { note: '^^' } }, bells: hits(I.bell, [0], { note: 'A-5', vol: 44 }),
    fx: riser(I.noise, 32, 64, { note: 'C-4', v0: 3, slope: 0.9, fx: 'F03' }),
  } });
const hold = section('hold: the launch fails', 8, CH.hold, { groove: G.crack, plan: { 7: G.crackOut }, bassR: BASS.whole,
  bassVol: 40, droneVol: 22, shape: SLOW, step: 2, arpVol: 20, padVol: 18, bell: BELL_HOLD, bellVol: 52,
  extra: { fx: fall(I.noise, 0, 16, { note: 'C-6', v0: 24, fx: 'E06' }) } });
const climb = section('climb: back in', 4, CH.climb, { melody: CLIMB_MEL, leadVol: 58, groove: G.burn, plan: { 3: G.roll },
  bassR: BASS.climb, bassVol: 40, shape: RISE, arpVol: 22, padVol: 16, extra: {
    fx: riser(I.noise, 32, 64, { note: 'C-4', v0: 4, slope: 1.1, fx: 'F03' }),
  } });

const patterns = [
  intro,
  section('A: the motif, low', 8, CH.A, { melody: A_MEL }),
  section('A2: the answer climbs', 8, CH.A, { melody: A2_MEL, groove: G.A2, padVol: 16 }),
  section('B: the launch burn', 8, CH.B, { melody: B_MEL, leadVol: 58, groove: G.burn, plan: { 4: G.burn8, 5: G.burn8, 6: G.burn8, 7: G.roll },
    shape: RISE, arpVol: 24, padVol: 18, extra: { fx: riser(I.noise, 64, 128, { note: 'C-4', v0: 3, slope: 0.5, fx: 'F02' }) } }),
  hold,
  section('A3: doubled in glass', 8, CH.A, { melody: A2_MEL, doubled: true, groove: G.drive, arpVol: 23, padVol: 17 }),
  jump(climb, 1),
];

writeSongCompact(import.meta.url, {
  title: 'Thawline - The Ark-Mother', bpm: 150, ticks: 6, mixvol: 48,
  message: 'THAWLINE Herald theme "The Ark-Mother".\nA minor, 150 BPM. Orders 1-6 loop.\nThe hook is the HELIOBANE Herald motif.\nAll samples synthesized. Source: songs/thawline_herald.gen.js',
  samples: [
    kick({ f0: 170, f1: 52, sweep: 34, decay: 11, click: 0.3, drive: 2.0, sec: 0.36 }),
    snare({ tone: 165, decay: 11, sec: 0.32, seed: 41, drive: 1.7 }),
    cymbal('bone tick', { sec: 0.05, decay: 90, seed: 23, metalMix: 0.5 }),
    { ...clank('hull', { base: 110, bright: 0.45, drive: 2.2, sec: 0.55, seed: 43 }), role: 'percussion' },
    tom(),
    sawPluck('pulse bass', { open: 3000, closed: 420, close: 10, decay: 3.8, sec: 0.8 }),
    wave('hull drone', [1, 0.5, 0.25, 0.12, 0.06, 0.03]),
    sawPluck('dark pluck', { open: 2400, closed: 280, close: 7, decay: 4, sec: 0.8 }),
    wave('ember lead', [1, 0.42, 0.26, 0.12, 0.07, 0.035, 0.02]),
    thinPad('cold pad', { amps: [1, 0, 0.3, 0, 0.12, 0, 0.05], spread: 1 }),
    glassBell('glass bell', { sec: 1.4, partials: [[1, 1, 1.9], [2.76, 0.45, 4.5], [5.4, 0.22, 8], [8.93, 0.1, 14]] }),
    noiseLoop(),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
