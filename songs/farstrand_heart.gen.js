#!/usr/bin/env node
/**
 * FARSTRAND — "The Grove Heart" (the approach to the Pollard, Halm). 2026-09-25.
 * B minor over a B pedal, 96 BPM, speed 6: 4 rows/beat, 16 rows/bar; one row = a 16th (156 ms), one bar = 2.5 s.
 * Rendered at 48 kHz, where 96 BPM is exact (1250 samples/tick).
 *
 * Identity: walking into something alive. A heartbeat (a deep synthesized thump, "lub" and a softer "dub")
 * is the pulse under everything and it quickens: two beats a bar (a 48 bpm heart) in A, one a beat in B
 * and C, then it slows and stops so the loop can start over calm. The key sits on a B pedal, which is
 * the dominant of Halm's E minor (the boss that follows is in E), and the chords above it lean on the bII
 * (C over B), the colour of Halm's wrong light, then reach the tritone (F) before the dominant F#.
 * Farstrand's DNA stays: a filtered-saw pluck arpeggio with its dotted-8th (3-row) delay panned opposite,
 * one held cold-pad tone, the hollow glass lead with a 3/6-row ping-pong echo, wind. The lead is Halm's
 * cell transposed, "B C# D——", and in B it climbs a step a bar as an ostinato (B C# D, C D E, D E F#,
 * E F# G ... G A B) until it breaks on A# over F#.
 *
 * Phrase map
 *   Intro    B pedal                    the heart alone (two beats a bar), wind, the pedal (not looped)
 *   A        Bm Bm C Bm | Bm G C F#     dark pluck in 8ths, pad, pedal; the lead enters in bar 5:
 *                                       "B C# D——", "E D B——", "C B C——" (C over the pedal: the bII), A#
 *   B        Bm C Bm C | Em F Em F#      the heart one a beat, 16th arp, glass ticks; the cell climbs a step
 *                                       every bar; F over the B pedal is the tritone
 *   C        Bm C Bm C | G C F# F#       the heart: heartbeat on every beat, a soft snare on 3; the pedal gives
 *                                       way, octave bass 8ths rock B C B C a semitone apart; the brighter pluck,
 *                                       glass bells on the 3-3-2 accents, long high lead notes up to C7; a noise
 *                                       riser across the last two bars
 *   Release  Bm Bm Bm Bm                 everything drops; the heart slows (a beat, two a bar, one) and the
 *                                       loop jumps back to A
 * Loop body: orders 1-4 (28 bars, 70 s). Everything synthesized. Source of truth: this file; the shared
 * helpers come from farstrand_halm.gen.js.
 */
import { kick, snare, cymbal, noiseLoop, wave, glassBell, thinPad, swell, mel, line, chart, bass, beat, rep, pattern,
  jump, writeSongCompact, ladder, pingpong, notesOf, hits, triads, cutLanes, riser } from './heliobane_stage6.kit.js';
import { sawPluck, soften, delayLine, padLane, wind, fadeIn } from './farstrand_halm.gen.js';

const I = { heart: 0, snare: 1, tick: 2, bass: 3, dark: 4, pluck: 5, lead: 6, pad: 7, bell: 8, noise: 9, swell: 10 };
const LAYOUT = ['heart', 'snare', 'tick', 'bass', 'arp', 'canon', 'lead', 'echo', 'echo2', 'pad', 'bells', 'wind', 'fx'];
const PANS = [0x80, 0x78, 0xac, 0x80, 0x54, 0xac, 0x86, 0x50, 0xb4, 0x70, 0x9c, 0x80, 0x88];
const KEYS = ['lead', 'echo', 'echo2', 'arp', 'canon', 'pad', 'bells'];

// ---------------------------------------------------------------- melodies
const A_MEL = 'r/16 | r/16 | r/16 | r/16 | b5/2 c#6 d6/12~ | e6/4 d6 b5/8~ | c6/2 b5 c6/12~ | a#5/16~';
const B_MEL = 'b5/2 c#6 d6/12~ | c6/2 d6 e6/12~ | d6/2 e6 f#6/12~ | e6/2 f#6 g6/12~'
  + ' | e6/2 f#6 g6/12~ | f6/2 g6 a6/12~ | g6/2 a6 b6/12~ | c#7/8 a#6/8~';
const C_MEL = 'f#6/16~ | g6/16~ | f#6/8 d6/8 | e6/8 g6/8 | b6/16~ | c7/16~ | a#6/8 c#7/8 | f#6/16~';
/** Glass bells on the 3-3-2 accents of each half bar, chord tones two octaves up. */
const C_BELLS = 'b6/3 f#6/3 d6/2 b6/3 f#6/3 d6/2 | c7/3 g6/3 e6/2 c7/3 g6/3 e6/2 | b6/3 f#6/3 d6/2 b6/3 f#6/3 d6/2'
  + ' | c7/3 g6/3 e6/2 c7/3 g6/3 e6/2 | b6/3 g6/3 d6/2 b6/3 g6/3 d6/2 | c7/3 g6/3 e6/2 c7/3 g6/3 e6/2'
  + ' | c#7/3 a#6/3 f#6/2 c#7/3 a#6/3 f#6/2 | c#7/3 a#6/3 f#6/2 r/8';
const CH = {
  intro: 'Bm Bm', A: 'Bm Bm C Bm Bm G C F#', B: 'Bm C Bm C Em F Em F#', C: 'Bm C Bm C G C F# F#', release: 'Bm Bm Bm Bm',
};
const SLOW8 = [0, 2, 4, 3, 1, 3, 5, 4];                           // 8ths through 7 rungs
const ROLL = [0, 2, 3, 5, 4, 2, 3, 1, 0, 2, 3, 5, 6, 5, 3, 2];    // 16ths (Halm's roll)

// ---------------------------------------------------------------- parts
const HM = { X: [I.heart, 60], x: [I.heart, 38] };
const HEART = { slow: 'X.x.....X.x.....', quick: 'Xx..Xx..Xx..Xx..', one: 'X.x.............', none: '................' };
const pedal = (bars) => chart(Array(bars).fill('Bm').join(' '));
const BASS = { long: ['R---------------'], half: ['R-------R-------'], oct: ['R-o-R-o-R-o-R-o-'] };

function section(name, bars, chordStr, { melody = null, melVol = 40, heart = ['slow'], snareBars = null, tickBar = null, bassR = BASS.long,
  bassVol = 30, pedalBass = true, arp = 'dark', shape = SLOW8, step = 2, arpVol = 26, padVol = 16, windHi = 9, bells = null, extra = {} } = {}) {
  const rows = bars * 16, segs = chart(chordStr), tri = chart(triads(chordStr));
  const parts = {
    wind: wind(bars, { hi: windHi, inst: I.noise }),
    bass: bass(pedalBass ? pedal(bars) : tri, bassR, I.bass, { rows, lo: 'G-2', vol: bassVol, decay: 0.95 }),
    heart: beat(Array.from({ length: bars }, (_, i) => HEART[heart[i % heart.length]]), HM),
  };
  if (snareBars) parts.snare = beat(Array(bars).fill(snareBars), { X: [I.snare, 34], x: [I.snare, 22] });
  if (tickBar) parts.tick = beat(Array(bars).fill(tickBar), { g: [I.tick, 18], x: [I.tick, 26] });
  const refs = [];
  if (melody) {
    const notes = mel(melody, { vol: melVol }), ch = line(notes, I.lead, { rows, vib: 'H33', vibDelay: 3 });
    parts.lead = ch; refs.push(notes);
    [parts.echo, parts.echo2] = pingpong(ch, notes, rows, { d1: 3, s1: 0.42, d2: 6, s2: 0.22, segs });
    refs.push(notesOf(parts.echo, rows), notesOf(parts.echo2, rows));
  }
  if (bells) {
    const notes = mel(bells, { vol: 34 });
    parts.bells = soften(line(notes, I.bell, { rows, vib: null }), rows, refs);
    refs.push(notesOf(parts.bells, rows));
  }
  const arpNotes = ladder(segs, rows, shape, { lo: 'B-3', span: 8, vol: arpVol, soft: 6, len: step });
  parts.arp = soften(line(arpNotes, arp === 'dark' ? I.dark : I.pluck, { rows, vib: null }), rows, refs);
  parts.canon = soften(delayLine(parts.arp, rows, segs, { delay: 3, scale: 0.42 }), rows, [...refs, notesOf(parts.arp, rows)]);
  parts.pad = padLane(segs, tri, rows, refs, { lo: 'D-5', vol: padVol, inst: I.pad });
  return pattern(name, bars, cutLanes({ ...parts, ...extra }, KEYS), LAYOUT, PANS);
}

// ---------------------------------------------------------------- sections
const intro = section('intro: the heart alone', 2, CH.intro, { bassVol: 22, arpVol: 0, padVol: 10, windHi: 11,
  extra: { arp: { 0: { note: '^^' } }, canon: { 0: { note: '^^' } } } });
const C = section('C: the heart', 8, CH.C, { melody: C_MEL, melVol: 44, heart: ['quick'], snareBars: '........X.......', tickBar: '.g.g.g.g.g.g.g.g',
  bassR: BASS.oct, bassVol: 36, pedalBass: false, arp: 'bright', shape: ROLL, step: 1, arpVol: 36, padVol: 20, windHi: 7, bells: C_BELLS,
  extra: { fx: riser(I.noise, 96, 128, { note: 'C-4', v0: 4, slope: 0.7, fx: 'F02' }) } });
const releaseArp = section('tmp', 4, CH.release, { arpVol: 22 }).channels;
const release = section('release: the heart slows', 4, CH.release, { heart: ['quick', 'slow', 'one', 'one'], bassR: BASS.long,
  bassVol: 26, arpVol: 22, padVol: 14, windHi: 12, extra: {
    arp: fadeOut(releaseArp[LAYOUT.indexOf('arp')], 0, 40), canon: fadeOut(releaseArp[LAYOUT.indexOf('canon')], 3, 43),
  } });

/** Fade a lane out: volumes scaled from full at `from` down to nothing at `to`, cut there. */
function fadeOut(ch, from, to) {
  const out = {};
  for (const [r, e] of Object.entries(ch)) {
    if (+r >= to) continue;
    const k = +r < from ? 1 : 1 - (+r - from) / (to - from);
    out[r] = e.vol?.startsWith('v') ? { ...e, vol: `v${Math.round(Number(e.vol.slice(1)) * k)}` } : e;
  }
  out[to] = { note: '^^' };
  return out;
}

const patterns = [
  intro,
  section('A: the approach', 8, CH.A, { melody: A_MEL, heart: ['slow'], arpVol: 24 }),
  section('B: closer, the cell climbs', 8, CH.B, { melody: B_MEL, melVol: 36, heart: ['quick'], tickBar: '..g...g...g...g.', bassR: BASS.half,
    bassVol: 30, arp: 'dark', shape: ROLL, step: 1, arpVol: 24, padVol: 16 }),
  C,
  jump(release, 1),
];

writeSongCompact(import.meta.url, {
  title: 'Farstrand - The Grove Heart', bpm: 96, ticks: 6, mixvol: 48,
  message: 'FARSTRAND "The Grove Heart" (the approach to the Pollard).\nB minor over a B pedal, 96 BPM. Orders 1-4 loop.\nAll samples synthesized. Source: songs/farstrand_heart.gen.js',
  samples: [
    { ...kick({ f0: 100, f1: 46, sweep: 18, decay: 7, click: 0.1, drive: 2.4, sec: 0.5 }), name: 'heart' },
    snare({ tone: 150, decay: 10, sec: 0.4, seed: 31, drive: 1.3 }),
    cymbal('glass tick', { sec: 0.05, decay: 90, seed: 17, metalMix: 0.7 }),
    wave('round bass', [1, 0.35, 0.14, 0.06, 0.03]),
    sawPluck('dark pluck', { open: 2800, closed: 300, close: 5, decay: 2.6, sec: 1.1 }),
    sawPluck('saw pluck', { open: 4800, closed: 420, close: 6, decay: 3.2 }),
    wave('glass lead', [1, 0.03, 0.45, 0.02, 0.22, 0.02, 0.1, 0, 0.05]),
    thinPad('cold pad', { amps: [1, 0, 0.3, 0, 0.12, 0, 0.05], spread: 1 }),
    glassBell('glass bell', { sec: 1.4, partials: [[1, 1, 1.9], [2.76, 0.45, 4.5], [5.4, 0.22, 8], [8.93, 0.1, 14]] }),
    noiseLoop(), swell('swell', { sec: 1.1, seed: 19 }),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
