#!/usr/bin/env node
/**
 * THAWLINE — "Venn's Landing" (the Landing phase between regions, and the founding). 2026-10-01.
 * A major with a Mixolydian G (the bVII chord), 90 BPM, speed 6: 4 rows/beat, 16 rows/bar; one row =
 * a 16th (167 ms), one bar = 2.67 s. Rendered at 44100 Hz, where 90 BPM is exact (1225 samples/tick).
 *
 * Identity: the colony at work between raids, warm and a little hopeful; a shipwrights' work song, not
 * a fanfare. The Ossuary's cell "A B C—— B" comes back with its C turned to C# ("A B C#—— B"), the same
 * turn the win sting makes: the Landing is what holding the boards is for. The harmony is folk-warm
 * (I bVII IV V, the Mixolydian G), the young sun's F# gets the local peak, and the Ossuary's cold stays
 * as a shadow: in B every warm chord is answered by its cold twin (D then Dm, the F# of the lead turned
 * F), and the workbench section closes on F G A (bVI bVII I, the win sting's climb) with the bells
 * playing the Ossuary's own cell over F. Work is in the percussion: a small hammer on plate (Heliobane's
 * shop clank, soft) strikes on 2 and bounces, a bone knock answers on 4-and. The pad is warm (even
 * harmonics) where the Ossuary's is cold; the arp walks in 8ths; no snare until A2.
 *
 * Phrase map
 *   Intro   A E                         pad, the bass on A, one bell, the hammer from bar 2, the arp fading
 *                                       in, reverse swell into A (not looped)
 *   A       A G D E | A F#m D/E A       the cell "A B C#—— B", "D—B G——" over G; up through D to E held
 *                                       over E (the question); the answer peaks on F#6 over F#m and comes
 *                                       home on A. Arp in 8ths, kick on 1 and 3, hammer on 2, knock on 4&
 *   A2      same                        same question; the answer climbs to A6 over F#m and lands on C# A,
 *                                       a second voice in thirds under the long notes; arp in 16ths,
 *                                       soft backbeat
 *   B       D Dm A F#m | D Dm Bm7 E     evening: long notes, "F#—— E D" over D then "F—— E D" over Dm
 *                                       (the thaw and the cold as one gesture), up to A6 over D, down to E
 *   Bench   A G D A | F#m D F G         no lead: the cell on glass bells with a 6-row echo (over F it is
 *                                       the Ossuary's own "A B C"), arp in 8ths, the hammer working, sparse
 *                                       bass; F G climbs into A (the loop jumps to order 1)
 * Loop body: orders 1-4 (32 bars, 85.3 s). Everything synthesized. Source of truth: this file; the
 * shared helpers come from heliobane_stage6.kit.js and farstrand_halm.gen.js, the palette from
 * thawline_ossuary.gen.js.
 */
import { kick, snare, cymbal, noiseLoop, wave, glassBell, thinPad, swell, clank,
  mel, line, chart, bass, beat, rep, pattern, jump, writeSongCompact,
  ladder, pingpong, notesOf, hits, triads, cutLanes, harmony } from './heliobane_stage6.kit.js';
import { sawPluck, soften, delayLine, padLane, wind, fadeIn } from './farstrand_halm.gen.js';

const I = { kick: 0, snare: 1, hat: 2, knock: 3, anvil: 4, bass: 5, pluck: 6, lead: 7, pad: 8, bell: 9, noise: 10, swell: 11 };
const LAYOUT = ['kick', 'snare', 'hat', 'knock', 'anvil', 'bass', 'arp', 'canon', 'lead', 'echo', 'harm', 'pad', 'bells', 'bellEcho', 'wind', 'fx'];
const PANS = [0x80, 0x78, 0xa8, 0x60, 0x9c, 0x80, 0x54, 0xac, 0x84, 0x58, 0x74, 0x70, 0x68, 0x9c, 0x80, 0x90];
const KEYS = ['lead', 'echo', 'harm', 'arp', 'canon', 'pad', 'bells', 'bellEcho'];

// ---------------------------------------------------------------- melodies
const CELL = 'r/4 a5/2 b5 c#6/6 b5/2'; // the Ossuary's cell with the C turned to C#
const Q = `${CELL} | d6/6 b5/2 g5/8~ | r/4 a5/2 b5 d6/4 f#6 | e6/10~ d6/2 c#6 b5`;
const A_MEL = `${Q} | r/4 a5/2 b5 c#6/6 e6/2 | f#6/6 e6/2 c#6/8~ | d6/4 c#6 b5 g#5 | a5/16~`;
const A2_MEL = `${Q} | r/4 a5/2 b5 c#6/4 e6 | a6/8~ f#6/4 e6 | f#6/6 e6/2 d6/4 b5 | c#6/4 a5/12~`;
const B_MEL = 'f#6/12~ e6/2 d6 | f6/12~ e6/2 d6 | c#6/8~ e6/4 a5 | c#6/6 b5/2 a5/8~'
  + ' | d6/4 f#6 a6/8~ | a6/6 g6/2 f6/8~ | f#6/8 d6/4 b5 | b5/6 c#6/2 e6/8~';
const BELL_BENCH = 'r/4 a6/2 b6 c#7/8 | r/16 | r/4 a6/2 b6 d7/8 | r/16 | r/4 a6/2 b6 c#7/8 | r/16'
  + ' | r/4 a6/2 b6 c7/8 | r/4 b6/4 d7/8';
const CH = {
  intro: 'A E', A: 'A G D E A F#m D/8 E/8 A/16', B: 'D Dm A F#m D Dm Bm7 E', bench: 'A G D A F#m D F G',
};
const ROLL = [0, 2, 3, 5, 4, 2, 3, 1, 0, 2, 3, 4, 5, 4, 3, 2]; // 16ths through 6 chord-tone rungs, E-4 up
const EIGHTS = [0, 2, 4, 3, 1, 3, 5, 4];                        // 8ths

// ---------------------------------------------------------------- rhythm
const BASS = {
  pedal: ['R-------r-------'], A: ['R-----r-R---f-r-'], A2: ['R-----r-R---f-n-'], B: ['R---f---R---t-n-'],
  bench: ['R-------r-----n-'],
};
const KM = { X: [I.kick, 44], x: [I.kick, 30] };
const SM = { X: [I.snare, 30], x: [I.snare, 20] };
const HM = { X: [I.hat, 28], x: [I.hat, 20], g: [I.hat, 13] };
const NM = { X: [I.knock, 30], x: [I.knock, 22] };
const AM = { X: [I.anvil, 26], x: [I.anvil, 15] };
const G = {
  none: { kick: '................', snare: '................', hat: '................', knock: '................', anvil: '................' },
  intro: { kick: '................', snare: '................', hat: '..g...g...g...g.', knock: '..............x.', anvil: '....X.x.........' },
  A: { kick: 'X.......X.......', snare: '................', hat: '..g...g...g...g.', knock: '..............x.', anvil: '....X.x.........' },
  A2: { kick: 'X.......X.....x.', snare: '....x.......x...', hat: 'g.x.g.x.g.x.g.x.', knock: '..............x.', anvil: '....X.x.........' },
  A2out: { kick: 'X.......X.......', snare: '....x.......x.x.', hat: 'g.x.g.x.g.x.....', knock: '................', anvil: '....X.x.........' },
  B: { kick: 'X.....x.X.......', snare: '....X.......X...', hat: 'g.x.g.xgg.x.g.x.', knock: '..x.......x.....', anvil: '................' },
  Bout: { kick: 'X.......X.......', snare: '....X...........', hat: 'g.x.g.x.........', knock: '..x.............', anvil: '............X.x.' },
  bench: { kick: 'X...............', snare: '................', hat: '......g.......g.', knock: '..........x.....', anvil: '....X.x.....x...' },
  benchOut: { kick: 'X.......X.......', snare: '............x.x.', hat: '......g...g.g.g.', knock: '................', anvil: '....X.x.........' },
};
const MAPS = { kick: KM, snare: SM, hat: HM, knock: NM, anvil: AM };
const drums = (bars, g, last = null, first = null) => Object.fromEntries(Object.keys(MAPS).map((k) =>
  [k, beat(rep(bars, g[k], last?.[k]).map((s, i) => (first && i < first.bars ? first.g[k] : s)), MAPS[k])]));

// ---------------------------------------------------------------- sections
function section(name, bars, chordStr, { melody = null, leadVol = 38, harm = false, groove = G.A, last = null, first = null,
  bassR = BASS.A, bassVol = 35, shape = EIGHTS, step = 2, arpVol = 28, padVol = 21, windHi = 5, bell = null,
  bellVol = 34, extra = {} } = {}) {
  const rows = bars * 16, segs = chart(chordStr), tri = chart(triads(chordStr));
  const parts = { wind: wind(bars, { hi: windHi, inst: I.noise }), ...drums(bars, groove, last, first),
    bass: bass(tri, bassR, I.bass, { rows, lo: 'E-3', vol: bassVol, soft: 0.74, decay: 0.92 }) };
  const refs = [];
  if (melody) {
    const notes = mel(melody, { vol: leadVol }), ch = line(notes, I.lead, { rows, vib: 'H23', vibDelay: 4 });
    parts.lead = ch; refs.push(notes);
    [parts.echo] = pingpong(ch, notes, rows, { d1: 3, s1: 0.36, segs });
    refs.push(notesOf(parts.echo, rows));
    if (harm) { // a second voice a third to a sixth under the long notes: the crew singing along
      parts.harm = soften(line(harmony(notes, segs, { minLen: 6, scale: 0.55 }), I.lead, { rows, vib: null }), rows, refs.slice(1));
      refs.push(notesOf(parts.harm, rows));
    }
  }
  if (bell) { // a glass-bell line and its 6-row echo, both kept a semitone clear of the lead
    parts.bells = soften(line(mel(bell, { vol: bellVol }), I.bell, { rows, vib: null }), rows, refs);
    parts.bellEcho = soften(delayLine(parts.bells, rows, segs, { delay: 6, scale: 0.4 }), rows, [...refs, notesOf(parts.bells, rows)]);
    refs.push(notesOf(parts.bells, rows), notesOf(parts.bellEcho, rows));
  }
  // The arp stays under the lead and yields where it would rub a semitone against the lead, the second
  // voice or the bells; its canon trails 3 rows (a dotted 8th, 500 ms).
  const arpNotes = ladder(segs, rows, shape, { lo: 'E-4', span: 6, vol: arpVol, soft: 6, len: step });
  parts.arp = soften(line(arpNotes, I.pluck, { rows, vib: null }), rows, refs);
  parts.canon = soften(delayLine(parts.arp, rows, segs, { delay: 3, scale: 0.4 }), rows, [...refs, notesOf(parts.arp, rows)]);
  parts.pad = padLane(segs, tri, rows, refs, { lo: 'C-5', vol: padVol, inst: I.pad });
  return pattern(name, bars, cutLanes({ ...parts, ...extra }, KEYS), LAYOUT, PANS);
}

const introArp = section('tmp', 2, CH.intro, { arpVol: 24 }).channels;
const intro = section('intro: morning at the Landing', 2, CH.intro, { groove: G.intro, first: { bars: 1, g: G.none },
  bassR: BASS.pedal, bassVol: 34, padVol: 24, windHi: 9, extra: {
    arp: fadeIn(introArp[LAYOUT.indexOf('arp')], 8, 28), canon: fadeIn(introArp[LAYOUT.indexOf('canon')], 11, 28),
    bells: hits(I.bell, [4], { note: 'C#6', vol: 36 }), fx: hits(I.swell, [25], { vol: 26 }),
  } });

const patterns = [
  intro,
  section('A: A B C#, the cell thawed', 8, CH.A, { melody: A_MEL }),
  section('A2: the crew sings along', 8, CH.A, { melody: A2_MEL, harm: true, groove: G.A2, last: G.A2out, bassR: BASS.A2,
    shape: ROLL, step: 1, arpVol: 26, padVol: 20 }),
  section('B: evening, F# and F', 8, CH.B, { melody: B_MEL, leadVol: 40, groove: G.B, last: G.Bout, bassR: BASS.B, bassVol: 37,
    shape: ROLL, step: 1, arpVol: 27, padVol: 23, windHi: 7 }),
  jump(section('bench: bells, no lead', 8, CH.bench, { groove: G.bench, last: G.benchOut, bassR: BASS.bench, bassVol: 33,
    arpVol: 26, padVol: 24, windHi: 9, bell: BELL_BENCH, bellVol: 50 }), 1),
];

writeSongCompact(import.meta.url, {
  title: "Thawline - Venn's Landing", bpm: 90, ticks: 6, mixvol: 48,
  message: "THAWLINE Landing theme \"Venn's Landing\".\nA major (Mixolydian G), 90 BPM. Orders 1-4 loop.\nAll samples synthesized. Source: songs/thawline_landing.gen.js",
  samples: [
    kick({ f0: 150, f1: 46, sweep: 30, decay: 8, click: 0.12, drive: 1.5, sec: 0.45 }),
    snare({ tone: 190, decay: 14, sec: 0.28, seed: 29, drive: 1.3 }),
    cymbal('bone tick', { sec: 0.05, decay: 90, seed: 23, metalMix: 0.5 }),
    { ...kick({ f0: 640, f1: 390, sweep: 60, decay: 34, click: 0.3, drive: 1.3, sec: 0.12 }), name: 'bone knock' },
    { ...clank('hammer on plate', { base: 330, bright: 0.55, drive: 1.3, sec: 0.32, seed: 37 }), role: 'percussion' },
    sawPluck('pulse bass', { open: 3200, closed: 480, close: 9, decay: 3.2, sec: 0.9 }),
    sawPluck('saw pluck', { open: 2800, closed: 320, close: 6, decay: 3.2 }),
    wave('ember lead', [1, 0.42, 0.26, 0.12, 0.07, 0.035, 0.02]),
    thinPad('hearth pad', { amps: [1, 0.5, 0.32, 0.2, 0.12, 0.07, 0.04], spread: 1 }),
    glassBell('glass bell', { sec: 1.4, partials: [[1, 1, 1.9], [2.76, 0.45, 4.5], [5.4, 0.22, 8], [8.93, 0.1, 14]] }),
    noiseLoop(), swell('swell', { sec: 1.1, seed: 31 }),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
