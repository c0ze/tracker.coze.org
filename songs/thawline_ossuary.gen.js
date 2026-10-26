#!/usr/bin/env node
/**
 * THAWLINE — "The Ossuary" (missions on the Ossuary of Stars: dead worlds stacked like bones, the
 * first region the young sun thaws). 2026-09-25.
 * A minor with a Dorian F# (the D major chord), 110 BPM, speed 6: 4 rows/beat, 16 rows/bar; one row =
 * a 16th (136 ms), one bar = 2.18 s. Rendered at 44132 Hz, the smallest rate over 44.1 kHz where
 * 110 BPM is exact (1003 samples/tick).
 *
 * Identity: tactics music to think over, a steady pulse between Heliobane's drive and Farstrand's space.
 * The drive is Heliobane's: a plucked saw bass in legato 8ths that never stops. The space is Farstrand's:
 * the saw-pluck arp with its dotted-8th canon, a cold pad, glass bells, wind. The colour is the thaw:
 * every A phrase turns on F# (D major, warm: the young sun) and falls back to F (Fmaj7, cold), the heat
 * ladder as harmony. A warm, rounded "ember" lead (a rolled-off saw) plays the Ossuary's cell,
 * "A B C—— B", with space after every phrase; half the loop has no snare and a fifth has no lead,
 * so it can run for a whole board without wearing.
 *
 * Phrase map
 *   Intro   Am Am Fmaj7 E7                  the pulse bass alone, wind, the arp fading in, one bell,
 *                                           kick from bar 3, reverse swell (not looped)
 *   A       Am D Fmaj7 G | Am D Fmaj7 E7    the cell "A B C—— B", F# held over D; the answer peaks on
 *                                           F#6 and opens on B over E7. Arp in 8ths (canon makes 16ths),
 *                                           kick on 1 and 3, bone ticks on the off-beats
 *   A2      same                            same question; the answer falls F# E D, C A F (the thaw
 *                                           freezing back) and climbs E G# B into B; arp in 16ths,
 *                                           soft backbeat, bells glint every other bar
 *   B       Fmaj7 G Em7 Am | Fmaj7 G Esus4 E7   the lift: long notes up to G6, fuller kick and hats
 *   Plan    Am Am Fmaj7 Fmaj7 D D Esus4 E7  no lead, no snare: the cell on glass bells with a 6-row echo,
 *                                           the arp slows to 8ths, the bass to quarters; room to think
 *   Bones   Dm7 Am Dm7 Am | Fmaj7 C Dm7 E7  the lead low and slow (A4-A5), the bass in a 3+3+2 pulse,
 *                                           a bone knock, half-time snare; a reverse swell back into A
 * Loop body: orders 1-5 (40 bars, 87.3 s). Everything synthesized. Source of truth: this file; the
 * shared helpers come from heliobane_stage6.kit.js and farstrand_halm.gen.js.
 */
import { kick, snare, cymbal, noiseLoop, wave, glassBell, thinPad, swell,
  mel, line, chart, bass, beat, rep, pattern, jump, writeSongCompact,
  ladder, pingpong, notesOf, hits, triads, cutLanes } from './heliobane_stage6.kit.js';
import { sawPluck, soften, delayLine, padLane, wind, fadeIn } from './farstrand_halm.gen.js';

const I = { kick: 0, snare: 1, hat: 2, knock: 3, bass: 4, pluck: 5, lead: 6, pad: 7, bell: 8, noise: 9, swell: 10 };
const LAYOUT = ['kick', 'snare', 'hat', 'knock', 'bass', 'arp', 'canon', 'lead', 'echo', 'echo2', 'pad', 'bells', 'bellEcho', 'wind', 'fx'];
const PANS = [0x80, 0x78, 0xa8, 0x60, 0x80, 0x54, 0xac, 0x84, 0x58, 0xb0, 0x74, 0x68, 0x9c, 0x80, 0x90];
const KEYS = ['lead', 'echo', 'echo2', 'arp', 'canon', 'pad', 'bells', 'bellEcho'];

// ---------------------------------------------------------------- melodies
const CELL = 'r/4 a5/2 b5 c6/6 b5/2'; // the Ossuary's cell: a step up, a lean on C, a step back
const Q = `${CELL} | a5/4 f#5/12~ | r/4 a5/2 b5 c6/4 e6 | d6/8~ b5/4 g5`;
const A_MEL = `${Q} | r/4 a5/2 b5 c6/6 d6/2 | e6/4 f#6/12~ | e6/6 c6/2 a5/8 | g#5/6 a5/2 b5/8~`;
const A2_MEL = `${Q} | r/4 a5/2 b5 c6/4 e6 | f#6/6 e6/2 d6/8 | c6/6 a5/2 f5/8~ | e5/4 g#5 b5/8~`;
const B_MEL = 'a5/4 c6 e6/8~ | d6/8~ b5/4 d6 | e6/12~ d6/2 b5 | c6/8~ a5/8'
  + ' | a5/4 c6 f6/8~ | g6/12~ f6/2 d6 | e6/8~ a5/8 | g#5/6 b5/2 d6/8';
const BONES_MEL = 'a4/12~ c5/4 | b4/4 a4/12 | d5/8 f5/4 a5 | e5/16~'
  + ' | c5/8 e5/4 f5 | g5/8~ e5/8 | f5/8 d5/4 a4 | g#4/8 b4/4 e5';
const BELL_A2 = 'a6/16 | r/16 | c7/16 | r/16 | a6/16 | r/16 | e6/16 | r/16'; // a glint every other bar, left to ring
const BELL_PLAN = 'r/4 a6/2 b6 c7/8 | r/16 | r/4 a6/2 b6 e7/8 | r/16 | r/4 a6/2 f#6 a6/8 | r/16 | e6/16 | b6/16';
const BELL_BONES = 'r/16 | r/16 | r/16 | r/4 a6/2 b6 c7/8 | r/16 | r/16 | r/16 | r/16';
const CH = {
  intro: 'Am Am Fmaj7 E7', A: 'Am D Fmaj7 G Am D Fmaj7 E7', B: 'Fmaj7 G Em7 Am Fmaj7 G Esus4 E7',
  plan: 'Am Am Fmaj7 Fmaj7 D D Esus4 E7', bones: 'Dm7 Am Dm7 Am Fmaj7 C Dm7 E7',
};
const ROLL = [0, 2, 3, 5, 4, 2, 3, 1, 0, 2, 3, 4, 5, 4, 3, 2]; // 16ths through 6 chord-tone rungs, E-4 up
const EIGHTS = [0, 2, 4, 3, 1, 3, 5, 4];                        // 8ths

// ---------------------------------------------------------------- rhythm
const BASS = {
  pulse: ['R-r-r-r-R-r-r-r-'], A: ['R-r-r-o-R-r-f-r-'], B: ['R-r-r-o-R-r-f-n-'],
  plan: ['R-------r-----r-'], bones: ['R--r--r-R--r--n-'],
};
const KM = { X: [I.kick, 50], x: [I.kick, 34] };
const SM = { X: [I.snare, 36], x: [I.snare, 22] };
const HM = { X: [I.hat, 32], x: [I.hat, 24], g: [I.hat, 15] };
const NM = { X: [I.knock, 34], x: [I.knock, 24] };
const G = {
  intro: { kick: '................', snare: '................', hat: '................', knock: '................' },
  introK: { kick: 'X.......X.......', snare: '................', hat: '..g...g...g...g.', knock: '................' },
  A: { kick: 'X.......X.......', snare: '................', hat: '..g...g...g...g.', knock: '................' },
  A2: { kick: 'X.......X.....x.', snare: '....x.......X...', hat: 'g.x.g.x.g.x.g.x.', knock: '................' },
  B: { kick: 'X.....x.X.......', snare: '....X.......X...', hat: 'g.x.g.xgg.x.g.xg', knock: '................' },
  Bout: { kick: 'X.......X.......', snare: '....X.......X.x.', hat: 'g.x.g.x.........', knock: '................' },
  plan: { kick: 'X...............', snare: '................', hat: '......g.......g.', knock: '..........x.....' },
  bones: { kick: 'X.......X..x....', snare: '........X.......', hat: 'g.g.g.g.g.g.g.g.', knock: '...x..x....x..x.' },
};
const MAPS = { kick: KM, snare: SM, hat: HM, knock: NM };
const drums = (bars, g, last = null, first = null) => Object.fromEntries(Object.keys(MAPS).map((k) =>
  [k, beat(rep(bars, g[k], last?.[k]).map((s, i) => (first && i < first.bars ? first.g[k] : s)), MAPS[k])]));

// ---------------------------------------------------------------- sections
function section(name, bars, chordStr, { melody = null, leadVol = 38, groove = G.A, last = null, first = null,
  bassR = BASS.A, bassVol = 34, shape = ROLL, step = 1, arpVol = 30, padVol = 16, windHi = 8, bell = null,
  bellVol = 34, extra = {} } = {}) {
  const rows = bars * 16, segs = chart(chordStr), tri = chart(triads(chordStr));
  const parts = { wind: wind(bars, { hi: windHi, inst: I.noise }), ...drums(bars, groove, last, first),
    bass: bass(tri, bassR, I.bass, { rows, lo: 'E-3', vol: bassVol, soft: 0.74, decay: 0.9 }) };
  const refs = [];
  if (melody) {
    const notes = mel(melody, { vol: leadVol }), ch = line(notes, I.lead, { rows, vib: 'H23', vibDelay: 4 });
    parts.lead = ch; refs.push(notes);
    [parts.echo, parts.echo2] = pingpong(ch, notes, rows, { d1: 3, s1: 0.4, d2: 6, s2: 0.22, segs });
    refs.push(notesOf(parts.echo, rows), notesOf(parts.echo2, rows));
  }
  if (bell) { // a glass-bell line and its 6-row echo, both kept a semitone clear of the lead
    parts.bells = soften(line(mel(bell, { vol: bellVol }), I.bell, { rows, vib: null }), rows, refs);
    parts.bellEcho = soften(delayLine(parts.bells, rows, segs, { delay: 6, scale: 0.4 }), rows, [...refs, notesOf(parts.bells, rows)]);
    refs.push(notesOf(parts.bells, rows), notesOf(parts.bellEcho, rows));
  }
  // The arp stays under the lead (its top rung is the lead's lowest notes) and yields only where it would
  // rub a semitone against the lead or the bells; its canon trails 3 rows.
  const arpNotes = ladder(segs, rows, shape, { lo: 'E-4', span: 6, vol: arpVol, soft: 6, len: step });
  parts.arp = soften(line(arpNotes, I.pluck, { rows, vib: null }), rows, refs);
  parts.canon = soften(delayLine(parts.arp, rows, segs, { delay: 3, scale: 0.42 }), rows, [...refs, notesOf(parts.arp, rows)]);
  parts.pad = padLane(segs, tri, rows, refs, { lo: 'C-5', vol: padVol, inst: I.pad });
  return pattern(name, bars, cutLanes({ ...parts, ...extra }, KEYS), LAYOUT, PANS);
}

const introArp = section('tmp', 4, CH.intro, { shape: EIGHTS, step: 2, arpVol: 26 }).channels;
const intro = section('intro: the pulse alone', 4, CH.intro, { groove: G.introK, first: { bars: 2, g: G.intro },
  bassR: BASS.pulse, bassVol: 30, padVol: 18, windHi: 11, extra: {
    arp: fadeIn(introArp[LAYOUT.indexOf('arp')], 16, 60), canon: fadeIn(introArp[LAYOUT.indexOf('canon')], 19, 60),
    bells: hits(I.bell, [20], { note: 'E-6', vol: 40 }), fx: hits(I.swell, [56], { vol: 30 }),
  } });

const patterns = [
  intro,
  section('A: A B C, F# over D', 8, CH.A, { melody: A_MEL, shape: EIGHTS, step: 2, arpVol: 30 }),
  section('A2: the thaw freezes back', 8, CH.A, { melody: A2_MEL, groove: G.A2, bell: BELL_A2, bellVol: 30 }),
  section('B: the lift', 8, CH.B, { melody: B_MEL, groove: G.B, last: G.Bout, bassR: BASS.B, bassVol: 36, arpVol: 33,
    padVol: 19, windHi: 6 }),
  section('plan: bells, no lead', 8, CH.plan, { groove: G.plan, bassR: BASS.plan, bassVol: 30, shape: EIGHTS, step: 2,
    arpVol: 26, padVol: 20, windHi: 12, bell: BELL_PLAN, bellVol: 54 }),
  jump(section('bones: low and slow', 8, CH.bones, { melody: BONES_MEL, leadVol: 41, groove: G.bones,
    bassR: BASS.bones, bassVol: 32, arpVol: 24, padVol: 17, windHi: 9, bell: BELL_BONES, bellVol: 32,
    extra: { fx: hits(I.swell, [120], { vol: 30 }) } }), 1),
];

writeSongCompact(import.meta.url, {
  title: 'Thawline - The Ossuary', bpm: 110, ticks: 6, mixvol: 48,
  message: 'THAWLINE mission theme "The Ossuary".\nA minor (Dorian F#), 110 BPM. Orders 1-5 loop.\nAll samples synthesized. Source: songs/thawline_ossuary.gen.js',
  samples: [
    kick({ f0: 170, f1: 48, sweep: 32, decay: 9, click: 0.2, drive: 1.7, sec: 0.4 }),
    snare({ tone: 190, decay: 13, sec: 0.3, seed: 29, drive: 1.4 }),
    cymbal('bone tick', { sec: 0.05, decay: 90, seed: 23, metalMix: 0.5 }),
    { ...kick({ f0: 640, f1: 390, sweep: 60, decay: 34, click: 0.3, drive: 1.3, sec: 0.12 }), name: 'bone knock' },
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
