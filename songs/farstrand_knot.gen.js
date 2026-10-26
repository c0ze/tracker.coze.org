#!/usr/bin/env node
/**
 * FARSTRAND — "The Knot" (the hub: a moon-sized tangle of strands drifting between stars). 2026-09-26.
 * A minor with a Dorian lift (D major, the raised sixth F#), 92 BPM, speed 6: 4 rows/beat, 16 rows/bar;
 * one row = a 16th (163 ms), one bar = 2.61 s. Rendered at 44160 Hz, the smallest rate over 44.1 kHz where
 * 92 BPM is exact (1200 samples/tick).
 *
 * Identity: wide, cold, a little hopeful. Wide: a pluck arpeggio in 8ths that spreads each triad over three
 * octaves (root, fifth, third, root, fifth, then down), with two canons (3 and 6 rows late) panned hard apart, a round bass an octave under
 * everything, bells high above, and a lead whose echoes come 6 and 12 rows late. Cold: the cold pad with a
 * glass harmonica an octave over it, glass ticks, wind, sparse soft drums. Hopeful: the tune opens on fifths
 * (the strands meeting: "E B——"), the title's minor-sixth leap turns up in it ("E C——"), and each answer lifts
 * onto D major, the Dorian sixth F#, before E major turns back; the last bar of the loop is A major.
 * Halm's #11 stays in the family: B over Fmaj7. The long quiet middle is the Choir, heard not met (LORE):
 * the tune far off on glass bells over the glass harmonica, no drums.
 *
 * Phrase map
 *   Intro    Amadd9 Amadd9 Fmaj7 Fmaj7    wind, a low A, two far bells, the arp fading in, a reverse swell (not looped)
 *   A        Amadd9 Fmaj7 C G | Amadd9 Fmaj7 D Esus4-E   "E B—— | A G E | E C—— | B A G D"; "E B—— | C B A |
 *                                         F# A D | E———": the lift onto D; a soft kick on 1, glass ticks
 *   A2       same                         the answer climbs to F#6 over D and G#5 over E; half-time snare and
 *                                         its echo; bell glints
 *   B        F C G Am | F C D E           between stars: long lead notes rising a step a bar to G#6 over E,
 *                                         fuller kit, louder arp and pad
 *   Choir    Am Fmaj7 C G | Am Fmaj7 Dm Esus4-E   no drums, no lead: the arp slows to quarters, the pads
 *                                         swell, the tune far off on glass bells with 6- and 12-row echoes
 *   A3       as A                         the tune on the title's soft lead (an ocarina), glass bells an octave
 *                                         over it, the half-time kit
 *   Tail     Fmaj7 G Am Em | Fmaj7 G E Asus4-A   no lead: arp, pads, bell glints ending on C#7 over A major; a
 *                                         reverse swell back into A
 * Loop body: orders 1-6 (48 bars, 125.2 s). Everything synthesized. Source of truth: this file; the shared
 * helpers come from farstrand_halm.gen.js.
 */
import { kick, snare, cymbal, noiseLoop, wave, glassBell, thinPad, swell, mel, line, chart, bass, beat, rep,
  pattern, jump, writeSongCompact, ladder, pingpong, notesOf, hits, triads, cutLanes } from './heliobane_stage6.kit.js';
import { echoChannel } from './lib.js';
import { sawPluck, soften, delayLine, padLane, wind, fadeIn } from './farstrand_halm.gen.js';

const I = { kick: 0, snare: 1, hat: 2, bass: 3, pluck: 4, lead: 5, soft: 6, pad: 7, glass: 8, bell: 9, noise: 10, swell: 11 };
const LAYOUT = ['kick', 'snare', 'snEcho', 'hat', 'bass', 'arp', 'canon', 'canon2', 'lead', 'echo', 'echo2', 'pad', 'glass',
  'bells', 'bellEcho', 'bellEcho2', 'wind', 'fx'];
const PANS = [0x80, 0x78, 0xb4, 0xa8, 0x80, 0x60, 0xb8, 0x30, 0x88, 0x44, 0xc0, 0x70, 0x94, 0x68, 0xb0, 0x40, 0x80, 0x90];
const KEYS = ['lead', 'echo', 'echo2', 'arp', 'canon', 'canon2', 'pad', 'glass', 'bells', 'bellEcho', 'bellEcho2'];

// ---------------------------------------------------------------- melodies
const QUESTION = 'r/4 e5/4 b5/8~ | a5/6 g5/2 e5/8 | r/4 e5/4 c6/8~ | b5/6 a5/2 g5/4 d5';
const A_MEL = `${QUESTION} | r/4 e5/4 b5/8~ | c6/6 b5/2 a5/8 | r/4 f#5/4 a5/4 d6 | e6/12~ d6/2 b5`;
const A2_MEL = `${QUESTION} | r/4 e5/4 b5/4 e6 | g6/8~ f6/4 e6 | f#6/12~ e6/2 d6 | e6/8 b5/4 g#5`;
const B_MEL = 'a5/16~ | g5/8 c6/8 | d6/16~ | e6/8 c6/4 b5 | c6/16~ | e6/8~ g6/8 | f#6/8 a6/8~ | g#6/12~ e6/4';
const CHOIR_BELLS = 'r/4 e6/4 b6/8 | r/16 | r/4 e6/4 c7/8 | r/16 | r/4 e6/4 b6/8 | r/16 | r/4 f6/4 a6/8 | r/16';
const TAIL_BELLS = 'a6/16 | r/16 | e6/16 | r/16 | c7/16 | r/16 | e6/16 | c#7/16';
const GLINTS = 'b6/16 | r/16 | g6/16 | r/16 | e6/16 | r/16 | a6/16 | r/16';
const CH = {
  intro: 'Amadd9 Amadd9 Fmaj7 Fmaj7', A: 'Amadd9 Fmaj7 C G Amadd9 Fmaj7 D Esus4/8 E/8', B: 'F C G Am F C D E',
  choir: 'Am Fmaj7 C G Am Fmaj7 Dm Esus4/8 E/8', tail: 'Fmaj7 G Am Em Fmaj7 G E Asus4/8 A/8',
};
const WIDE = [0, 2, 4, 6, 8, 7, 5, 3];  // 8ths: the triad spread over three octaves from A-3 (root 5th 3rd root 5th, down)
const SLOW = [0, 4, 8, 6];              // quarters, the Choir

// ---------------------------------------------------------------- parts
const KM = { X: [I.kick, 46], x: [I.kick, 30] };
const SM = { X: [I.snare, 34], x: [I.snare, 22] };
const HM = { X: [I.hat, 30], x: [I.hat, 22], g: [I.hat, 14] };
const G = {
  A: { kick: 'X...............', snare: '................', hat: '..g...g...g...g.' },
  half: { kick: 'X.........x.....', snare: '........X.......', hat: '..g.x.g...g.x.g.' },
  B: { kick: 'X.....x...X.....', snare: '........X.......', hat: 'x.g.x.g.x.g.x.gx' },
  out: { kick: 'X...............', snare: '........X...x...', hat: 'x.g.x.g.........' },
};
function drums(bars, g, last = null) {
  const lane = (k, m) => beat(rep(bars, g[k], last?.[k]), m);
  return { kick: lane('kick', KM), snare: lane('snare', SM), hat: lane('hat', HM) };
}
/** The snare's own echo: each hit again 6 and 12 rows later, softer (the Knot's wide delay). */
function snareEcho(sn, rows) {
  const ch = {};
  for (const [r, e] of Object.entries(sn)) {
    if (!e.note || e.note === '^^') continue;
    for (const [d, s] of [[6, 0.35], [12, 0.15]]) {
      if (+r + d < rows && !ch[+r + d]) ch[+r + d] = { ...e, vol: `v${Math.round(Number(e.vol.slice(1)) * s)}` };
    }
  }
  return ch;
}

function section(name, bars, chordStr, { melody = null, leadInst = I.lead, melVol = 38, groove = null, last = null,
  bassVol = 30, shape = WIDE, step = 2, arpVol = 31, padVol = 15, glassVol = 6, windHi = 9, bell = null, bellVol = 34,
  bellDelays = [3, 8], doubled = false, extra = {} } = {}) {
  const rows = bars * 16, segs = chart(chordStr), tri = chart(triads(chordStr));
  const parts = { wind: wind(bars, { hi: windHi, inst: I.noise }),
    bass: bass(tri, ['R-----------r---'], I.bass, { rows, lo: 'A-2', vol: bassVol, decay: 0.95 }) };
  if (groove) { Object.assign(parts, drums(bars, groove, last)); parts.snEcho = snareEcho(parts.snare, rows); }
  const refs = [];
  if (melody) {
    const notes = mel(melody, { vol: melVol }), ch = line(notes, leadInst, { rows, vib: 'H23', vibDelay: 4 });
    parts.lead = ch; refs.push(notes);
    [parts.echo, parts.echo2] = pingpong(ch, notes, rows, { d1: 6, s1: 0.4, d2: 12, s2: 0.2, segs });
    refs.push(notesOf(parts.echo, rows), notesOf(parts.echo2, rows));
    if (doubled) { // glass bells an octave over the lead
      const up = mel(melody, { vol: 26, semi: 12 });
      parts.bells = soften(line(up, I.bell, { rows, vib: null }), rows, refs.slice(1));
      refs.push(notesOf(parts.bells, rows));
    }
  }
  if (bell) {
    const notes = mel(bell, { vol: bellVol }), ch = soften(line(notes, I.bell, { rows, vib: null }), rows, refs);
    parts.bells = ch;
    [parts.bellEcho, parts.bellEcho2] = pingpong(ch, notes, rows, { d1: bellDelays[0], s1: 0.45, d2: bellDelays[1], s2: 0.25, segs });
    refs.push(notes, notesOf(parts.bellEcho, rows), notesOf(parts.bellEcho2, rows));
  }
  // the arp spreads the triad wide in 8ths (colour tones stay in the tune and the pad); its canons, 3 and 6
  // rows late, sit hard left and right
  const arpNotes = ladder(tri, rows, shape, { lo: 'A-3', span: 10, vol: arpVol, soft: 5, len: step });
  parts.arp = soften(line(arpNotes, I.pluck, { rows, vib: null }), rows, refs);
  const arpRef = notesOf(parts.arp, rows);
  parts.canon = soften(delayLine(parts.arp, rows, segs, { delay: 3, scale: 0.42 }), rows, [...refs, arpRef]);
  parts.canon2 = soften(delayLine(parts.arp, rows, segs, { delay: 6, scale: 0.24 }), rows, [...refs, arpRef, notesOf(parts.canon, rows)]);
  parts.pad = padLane(segs, tri, rows, refs, { lo: 'E-4', vol: padVol, inst: I.pad });
  parts.glass = echoChannel(parts.pad, { delay: 0, semi: 12, scale: glassVol / padVol, inst: I.glass, rows });
  return pattern(name, bars, cutLanes({ ...parts, ...extra }, KEYS), LAYOUT, PANS);
}

// ---------------------------------------------------------------- sections
const introArp = section('tmp', 4, CH.intro, { arpVol: 28 }).channels;
const intro = section('intro: the tangle', 4, CH.intro, { bassVol: 26, padVol: 16, glassVol: 8, windHi: 12, extra: {
  arp: fadeIn(introArp[LAYOUT.indexOf('arp')], 16, 60), canon: fadeIn(introArp[LAYOUT.indexOf('canon')], 19, 60),
  canon2: fadeIn(introArp[LAYOUT.indexOf('canon2')], 22, 60),
  bells: hits(I.bell, [4, 36], { note: 'E-7', vol: 30 }), bellEcho: hits(I.bell, [12, 44], { note: 'B-6', vol: 14 }),
  fx: hits(I.swell, [57], { vol: 30 }),
} });
const tail = section('tail: A major', 8, CH.tail, { bassVol: 28, arpVol: 31, padVol: 18, glassVol: 8, windHi: 11, bell: TAIL_BELLS,
  bellVol: 36, groove: G.A, extra: { fx: hits(I.swell, [121], { vol: 30 }) } });

const patterns = [
  intro,
  section('A: the hub', 8, CH.A, { melody: A_MEL, groove: G.A }),
  section('A2: the answer climbs', 8, CH.A, { melody: A2_MEL, groove: G.half, bell: GLINTS, bellVol: 28 }),
  section('B: between stars', 8, CH.B, { melody: B_MEL, melVol: 40, groove: G.B, last: G.out, bassVol: 32, arpVol: 35, padVol: 18,
    glassVol: 7, windHi: 7 }),
  section('Choir: heard, not met', 8, CH.choir, { shape: SLOW, step: 4, arpVol: 30, padVol: 20, glassVol: 10, windHi: 12,
    bell: CHOIR_BELLS, bellVol: 54, bellDelays: [6, 12] }),
  section('A3: the ocarina', 8, CH.A, { melody: A_MEL, leadInst: I.soft, melVol: 42, doubled: true, groove: G.half, padVol: 16 }),
  jump(tail, 1),
];

writeSongCompact(import.meta.url, {
  title: 'Farstrand - The Knot', bpm: 92, ticks: 6, mixvol: 48,
  message: 'FARSTRAND hub theme "The Knot".\nA minor / Dorian, 92 BPM. Orders 1-6 loop.\nAll samples synthesized. Source: songs/farstrand_knot.gen.js',
  samples: [
    kick({ f0: 120, f1: 42, sweep: 24, decay: 7, click: 0.05, drive: 1.3, sec: 0.5 }),
    snare({ tone: 190, decay: 12, sec: 0.34, seed: 13, drive: 1.3 }),
    cymbal('glass tick', { sec: 0.05, decay: 90, seed: 17, metalMix: 0.7 }),
    wave('round bass', [1, 0.3, 0.1, 0.04]),
    sawPluck('saw pluck', { open: 3400, closed: 340, close: 5, decay: 2.6, sec: 1.2 }),
    wave('glass lead', [1, 0.03, 0.45, 0.02, 0.22, 0.02, 0.1, 0, 0.05]),
    wave('soft lead', [1, 0, 0.16, 0, 0.05, 0, 0.02]),
    thinPad('cold pad', { amps: [1, 0, 0.3, 0, 0.12, 0, 0.05], spread: 1 }),
    thinPad('glass harmonica', { amps: [1, 0, 0.18, 0, 0.06], spread: 2 }),
    glassBell('glass bell', { sec: 1.8, partials: [[1, 1, 1.4], [2.76, 0.45, 3.6], [5.4, 0.2, 7], [8.93, 0.08, 11]] }),
    noiseLoop(), swell('swell', { sec: 1.2, seed: 31 }),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
