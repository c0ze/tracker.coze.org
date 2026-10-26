#!/usr/bin/env node
/**
 * THAWLINE — "Raid on the Landing" (the hive comes for Venn's Landing: round 3 of a region). 2026-10-01.
 * A minor, 130 BPM, speed 6: 4 rows/beat, 16 rows/bar; one row = a 16th (115 ms), one bar = 1.85 s.
 * Rendered at 44148 Hz, the smallest rate over 44.1 kHz where 130 BPM is exact (849 samples/tick).
 *
 * Identity: tense and driving, in the Ossuary's harmonic world and palette (the same samples): A minor,
 * Fmaj7's cold, E7's pull, the warm Dorian D, plus the hive's own chord, Bb, the Phrygian half step
 * above the tonic (the lose sting's Bbmaj7). The drive is a galloping pulse bass (R-rr, 16ths) that
 * only lets go in the hold; the Ossuary's cell "A B C—— B" opens every A phrase at the raid's tempo and
 * is answered by an alarm of repeated A's and a fall; the bells in the hold play the cell over F, Dm
 * and E with the Phrygian F. The arp stays in 16ths the whole way with its dotted-8th canon.
 *
 * Phrase map
 *   Intro   Am Am Bb E7                 the gallop alone with bone ticks, kick from bar 3, a snare fill,
 *                                       a noise riser into A (not looped)
 *   A       Am Am F E | Am Am Bb E7     the cell, then "A A E— D B C—" (the alarm); the cell up to F over
 *                                       F, E held over E; again, "E C A——", the hive's Bb ("F—D Bb——"),
 *                                       an E7 arpeggio up into the repeat. Kick on 1, 2& and 3, backbeat
 *   A2      Am Am F E | Am D Bb E7      same question; the answer turns to D (the Landing's warmth, F#6)
 *                                       and falls through Bbmaj7 (A over Bb) to E
 *   B       Dm Bb Am E | Dm Bb F E7     the hive presses: long notes from A6, up to Bb6 over Bb; kick in
 *                                       3+3+2, bass in 3+3+2, 16th ticks; a snare fill
 *   Hold    Am Am F F Dm Dm E E7        half time, no lead: the cell on glass bells with a 6-row echo,
 *                                       the bass back to a pulse in 8ths, bone knocks; a swell into A3
 *   A3      Am Am F E | Am D Bb E7      A2's line doubled an octave up on glass bells, four on the floor
 *   Build   F G Bb E7                   the cell climbing in sequence (A B C, B C D, D E F, E G# B), 8th
 *                                       snares into a 16th roll, a riser; the loop jumps back to A
 * Loop body: orders 1-6 (44 bars, 81.2 s). Everything synthesized. Source of truth: this file; the
 * shared helpers come from heliobane_stage6.kit.js and farstrand_halm.gen.js, the samples from
 * thawline_ossuary.gen.js.
 */
import { kick, snare, cymbal, tom, noiseLoop, wave, glassBell, thinPad, swell,
  mel, line, chart, bass, beat, rep, pattern, jump, writeSongCompact,
  ladder, pingpong, notesOf, hits, triads, cutLanes, riser } from './heliobane_stage6.kit.js';
import { sawPluck, soften, delayLine, padLane } from './farstrand_halm.gen.js';

const I = { kick: 0, snare: 1, hat: 2, knock: 3, tom: 4, bass: 5, pluck: 6, lead: 7, pad: 8, bell: 9, noise: 10, swell: 11 };
const LAYOUT = ['kick', 'snare', 'hat', 'knock', 'bass', 'arp', 'canon', 'lead', 'echo', 'echo2', 'pad', 'bells', 'bellEcho', 'wind', 'fx'];
const PANS = [0x80, 0x78, 0xa8, 0x60, 0x80, 0x54, 0xac, 0x84, 0x58, 0xb0, 0x74, 0x68, 0x9c, 0x80, 0x90];
const KEYS = ['lead', 'echo', 'echo2', 'arp', 'canon', 'pad', 'bells', 'bellEcho'];

// ---------------------------------------------------------------- melodies
const CELL = 'r/4 a5/2 b5 c6/6 b5/2'; // the Ossuary's cell, at the raid's tempo
const Q = `${CELL} | a5/2 a5 e6/4 d6/2 b5 c6/4 | r/4 a5/2 b5 c6/4 f6 | e6/8~ g#5/4 b5`;
const A_MEL = `${Q} | r/4 a5/2 b5 c6/6 d6/2 | e6/4 c6 a5/8 | f6/6 d6/2 bb5/8 | g#5/4 b5 d6 e6`;
const A2_MEL = `${Q} | r/4 a5/2 b5 c6/6 e6/2 | f#6/6 e6/2 d6/8 | f6/6 d6/2 bb5/4 a5 | g#5/4 b5 e6/8~`;
const B_MEL = 'a6/12~ g6/2 f6 | f6/8 d6 | e6/12~ c6/4 | b5/16~'
  + ' | a6/12~ g6/2 f6 | f6/6 g6/2 bb6/8~ | a6/8~ f6/4 c6 | g#6/8 e6/4 b5';
const BELL_HOLD = 'r/4 a6/2 b6 c7/8 | r/16 | r/4 a6/2 b6 c7/8 | a6/16 | r/4 f6/2 g6 a6/8 | r/16 | r/4 e6/2 f6 g#6/8 | b6/16';
const BUILD_MEL = 'r/4 a5/2 b5 c6/8 | r/4 b5/2 c6 d6/8 | r/4 d6/2 e6 f6/8 | e6/4 g#6 b6/8~';
const CH = {
  intro: 'Am Am Bb E7', A: 'Am Am F E Am Am Bb E7', A2: 'Am Am F E Am D Bb E7', B: 'Dm Bb Am E Dm Bb F E7',
  hold: 'Am Am F F Dm Dm E E7', build: 'F G Bb E7',
};
const ROLL = [0, 2, 3, 5, 4, 2, 3, 1, 0, 2, 3, 4, 5, 4, 3, 2]; // 16ths through 6 chord-tone rungs, E-4 up
const CLIMB = [0, 1, 2, 3, 4, 5, 4, 3, 1, 2, 3, 4, 5, 4, 3, 2];

// ---------------------------------------------------------------- rhythm
const BASS = {
  gallop: ['R-rrR-rrR-rrR-rr'], gallopOut: ['R-rrR-rrR-rrR-o-'], B: ['R--r--R-R--r--R-'], pulse: ['R-r-r-r-R-r-r-r-'],
  build: ['R-r-R-r-R-r-R-r-'],
};
const KM = { X: [I.kick, 54], x: [I.kick, 38] };
const SM = { X: [I.snare, 42], x: [I.snare, 26] };
const HM = { X: [I.hat, 30], x: [I.hat, 24], g: [I.hat, 13] };
const NM = { X: [I.knock, 34], x: [I.knock, 24], t: [I.tom, 40, null, 'C-5'], T: [I.tom, 44, null, 'G-4'] };
const G = {
  ticks: { kick: '................', snare: '................', hat: 'x.g.x.g.x.g.x.g.', knock: '................' },
  intro: { kick: 'X.......X.......', snare: '................', hat: 'x.gxx.gxx.gxx.gx', knock: '...x..x....x..x.' },
  introOut: { kick: 'X.....x.X.......', snare: '....X...X.XxXxXx', hat: 'x.gxx.gx........', knock: '................' },
  A: { kick: 'X.....x.X.......', snare: '....X.......X...', hat: 'x.gxx.gxx.gxx.gx', knock: '................' },
  A2: { kick: 'X.....x.X.x.....', snare: '....X.......X...', hat: 'x.gxx.gxx.gxx.gx', knock: '..............x.' },
  fill: { kick: 'X.....x.X.......', snare: '....X.......XxXx', hat: 'x.gxx.gxx.gx....', knock: '................' },
  B: { kick: 'X..x..x.X..x..x.', snare: '....X.......X...', hat: 'xgggxgggxgggxggg', knock: '................' },
  Bout: { kick: 'X..x..x.X.......', snare: '....X...X.X.....', hat: 'xgxgxgxg........', knock: '............tTtT' },
  hold: { kick: 'X.........x.....', snare: '........X.......', hat: 'x.g.x.g.x.g.x.g.', knock: '...x..x....x..x.' },
  holdOut: { kick: 'X.........x.....', snare: '........X...X.X.', hat: 'x.g.x.g.........', knock: '...x..x.........' },
  drive: { kick: 'X...X...X...X...', snare: '....X.......X...', hat: 'xgxgxgxgxgxgxgxg', knock: '................' },
  build: { kick: 'X...X...X...X...', snare: 'x.x.x.x.x.x.x.x.', hat: 'xgxgxgxgxgxgxgxg', knock: '................' },
  roll: { kick: 'X...X...X...X...', snare: 'XxXxXxXxXXXXXXXX', hat: '................', knock: '................' },
};
const MAPS = { kick: KM, snare: SM, hat: HM, knock: NM };
const drums = (bars, g, last = null, first = null) => Object.fromEntries(Object.keys(MAPS).map((k) =>
  [k, beat(rep(bars, g[k], last?.[k]).map((s, i) => (first && i < first.bars ? first.g[k] : s)), MAPS[k])]));

// ---------------------------------------------------------------- sections
function section(name, bars, chordStr, { melody = null, leadVol = 50, doubled = false, groove = G.A, last = G.fill,
  first = null, bassR = BASS.gallop, bassVol = 36, shape = ROLL, arpVol = 26, padVol = 15, bell = null, bellVol = 34,
  extra = {} } = {}) {
  const rows = bars * 16, segs = chart(chordStr), tri = chart(triads(chordStr));
  const parts = { ...drums(bars, groove, last, first),
    bass: bass(tri, bassR, I.bass, { rows, lo: 'E-3', vol: bassVol, soft: 0.68, decay: 0.88 }) };
  const refs = [];
  if (melody) {
    const notes = mel(melody, { vol: leadVol }), ch = line(notes, I.lead, { rows, vib: 'H23', vibDelay: 4 });
    parts.lead = ch; refs.push(notes);
    [parts.echo, parts.echo2] = pingpong(ch, notes, rows, { d1: 3, s1: 0.4, d2: 6, s2: 0.2, segs });
    refs.push(notesOf(parts.echo, rows), notesOf(parts.echo2, rows));
    if (doubled) { // the line again an octave up on glass bells, kept a semitone clear of the echoes
      parts.bells = soften(line(mel(melody, { vol: 22, semi: 12 }), I.bell, { rows, vib: null }), rows, refs.slice(1));
      refs.push(notesOf(parts.bells, rows));
    }
  }
  if (bell) { // a glass-bell line and its 6-row echo
    parts.bells = soften(line(mel(bell, { vol: bellVol }), I.bell, { rows, vib: null }), rows, refs);
    parts.bellEcho = soften(delayLine(parts.bells, rows, segs, { delay: 6, scale: 0.4 }), rows, [...refs, notesOf(parts.bells, rows)]);
    refs.push(notesOf(parts.bells, rows), notesOf(parts.bellEcho, rows));
  }
  // The arp rolls 16ths under the lead and yields where it would rub a semitone against it or the bells;
  // its canon trails 3 rows.
  const arpNotes = ladder(segs, rows, shape, { lo: 'E-4', span: 6, vol: arpVol, soft: 7, len: 1 });
  parts.arp = soften(line(arpNotes, I.pluck, { rows, vib: null }), rows, refs);
  parts.canon = soften(delayLine(parts.arp, rows, segs, { delay: 3, scale: 0.4 }), rows, [...refs, notesOf(parts.arp, rows)]);
  parts.pad = padLane(segs, tri, rows, refs, { lo: 'C-5', vol: padVol, inst: I.pad });
  return pattern(name, bars, cutLanes({ ...parts, ...extra }, KEYS), LAYOUT, PANS);
}

const intro = section('intro: the gallop', 4, CH.intro, { groove: G.intro, last: G.introOut, first: { bars: 2, g: G.ticks },
  arpVol: 0, padVol: 13, extra: {
    arp: { 0: { note: '^^' } }, canon: { 0: { note: '^^' } },
    wind: riser(I.noise, 32, 64, { note: 'C-4', v0: 3, slope: 0.9, fx: 'F03' }),
  } });
const hold = section('hold: bells, no lead', 8, CH.hold, { groove: G.hold, last: G.holdOut, bassR: BASS.pulse, bassVol: 32,
  arpVol: 22, padVol: 18, bell: BELL_HOLD, bellVol: 50, extra: { fx: hits(I.swell, [118], { vol: 30 }) } });
const build = section('build: the cell climbs', 4, CH.build, { melody: BUILD_MEL, leadVol: 52, groove: G.build, last: G.roll,
  bassR: BASS.build, bassVol: 38, shape: CLIMB, arpVol: 26, padVol: 17, extra: {
    wind: riser(I.noise, 32, 64, { note: 'C-4', v0: 4, slope: 1.1, fx: 'F03' }),
  } });

const patterns = [
  intro,
  section('A: the cell and the alarm', 8, CH.A, { melody: A_MEL }),
  section('A2: D, then the hive', 8, CH.A2, { melody: A2_MEL, groove: G.A2, last: G.fill, bassR: BASS.gallopOut, padVol: 16 }),
  section('B: the hive presses', 8, CH.B, { melody: B_MEL, leadVol: 52, groove: G.B, last: G.Bout, bassR: BASS.B, bassVol: 38,
    arpVol: 28, padVol: 18 }),
  hold,
  section('A3: doubled in glass', 8, CH.A2, { melody: A2_MEL, doubled: true, groove: G.drive, last: G.fill, bassVol: 38,
    arpVol: 27, padVol: 17 }),
  jump(build, 1),
];

writeSongCompact(import.meta.url, {
  title: 'Thawline - Raid on the Landing', bpm: 130, ticks: 6, mixvol: 48,
  message: 'THAWLINE Landing raid theme.\nA minor (Phrygian Bb), 130 BPM. Orders 1-6 loop.\nAll samples synthesized. Source: songs/thawline_raid.gen.js',
  samples: [
    kick({ f0: 170, f1: 48, sweep: 32, decay: 9, click: 0.25, drive: 1.9, sec: 0.4 }),
    snare({ tone: 190, decay: 13, sec: 0.3, seed: 29, drive: 1.5 }),
    cymbal('bone tick', { sec: 0.05, decay: 90, seed: 23, metalMix: 0.5 }),
    { ...kick({ f0: 640, f1: 390, sweep: 60, decay: 34, click: 0.3, drive: 1.3, sec: 0.12 }), name: 'bone knock' },
    tom(),
    sawPluck('pulse bass', { open: 3600, closed: 520, close: 10, decay: 3.5, sec: 0.9 }),
    sawPluck('saw pluck', { open: 3000, closed: 320, close: 6, decay: 3.4 }),
    wave('ember lead', [1, 0.42, 0.26, 0.12, 0.07, 0.035, 0.02]),
    thinPad('cold pad', { amps: [1, 0, 0.3, 0, 0.12, 0, 0.05], spread: 1 }),
    glassBell('glass bell', { sec: 1.4, partials: [[1, 1, 1.9], [2.76, 0.45, 4.5], [5.4, 0.22, 8], [8.93, 0.1, 14]] }),
    noiseLoop(), swell('swell', { sec: 1.1, seed: 31 }),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
