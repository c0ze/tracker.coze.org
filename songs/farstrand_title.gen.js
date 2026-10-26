#!/usr/bin/env node
/**
 * FARSTRAND — "Far Strand" (title screen). 2026-09-25.
 * D minor, 90 BPM, speed 6: 4 rows/beat, 16 rows/bar; one row = a 16th (167 ms), one bar = 2.67 s.
 * Rendered at 44.1 kHz, where 90 BPM is exact (1225 samples/tick).
 *
 * Identity: slower and emptier than Halm. A lonely soft lead (sine plus a little of the odd harmonics,
 * an ocarina) leaps up a minor sixth and sinks, "A—F——E | D———", then reaches a minor seventh,
 * "A—G——F | E———". Under it a dark 8th-note pluck arpeggio with a dotted-8th delay, one held pad tone,
 * a sine-ish bass and wind; no drums except a heartbeat kick in A2.
 * The bridge is a memory kept in glass: Heliobane's title hook (heliobane_title.gen.js HOOK_Q bars 1-2,
 * "D D A—— G A C | Bb—— A F D", same key, same rows, so 1.7x slower at this tempo, an octave up) on a
 * glass bell with a 3- and 8-row echo; its second statement breaks off after "D D A——", and the lead
 * answers over Gm Eb (the bII, Halm's colour) Gm A.
 *
 * Phrase map
 *   Intro   Dm Dm                      wind, low D, the arp fading in, one bell, reverse swell (not looped)
 *   A       Dm Bbmaj7 Gm Asus4-A | Dm Bbmaj7 Gm7 A   the lonely motif and its answer (peak C7 over Bbmaj7),
 *                                      a single 6-row echo
 *   A2      same question; the answer climbs D F A to Bb6 and stops on E over A; ping-pong echo,
 *           heartbeat kick every other bar, bell glints
 *   Bridge  Dm Bb Dm Bb Gm Eb Gm A     the Heliobane hook on glass (bars 1-2), its broken echo (3-4),
 *                                      the lead's answer (5-8)
 *   Tail    Dm Bbmaj7 Gm A             arp, pad and two bell glints, reverse swell back into A
 * Loop body: orders 1-4 (28 bars, 74.7 s). Everything synthesized. Source of truth: this file; the
 * shared helpers come from farstrand_halm.gen.js.
 */
import { kick, wave, glassBell, thinPad, noiseLoop, swell, mel, line, chart, bass, beat, pattern, jump,
  writeSongCompact, ladder, pingpong, canon, notesOf, hits, triads, cutLanes } from './heliobane_stage6.kit.js';
import { sawPluck, soften, delayLine, padLane, wind, fadeIn } from './farstrand_halm.gen.js';

const I = { kick: 0, bass: 1, pluck: 2, lead: 3, pad: 4, bell: 5, noise: 6, swell: 7 };
const LAYOUT = ['kick', 'bass', 'arp', 'canon', 'lead', 'echo', 'echo2', 'pad', 'bells', 'bellEcho', 'bellEcho2', 'wind', 'fx'];
const PANS = [0x80, 0x80, 0x58, 0xa8, 0x84, 0x50, 0xb4, 0x74, 0x6c, 0xa4, 0x54, 0x80, 0x90];
const KEYS = ['lead', 'echo', 'echo2', 'arp', 'canon', 'pad', 'bells', 'bellEcho', 'bellEcho2'];

// ---------------------------------------------------------------- melodies
const QUESTION = 'a5/4 f6/10~ e6/2 | d6/12~ r/4 | a5/4 g6/10~ f6/2 | e6/16~';
const A_MEL = `${QUESTION} | a5/4 f6/8 a6/4 | c7/8~ bb6/4 a6 | g6/6 f6/2 e6/4 d6 | c#6/8~ e6/4 a5`;
const A2_MEL = `${QUESTION} | a5/4 d6 f6 a6 | bb6/12~ a6/2 f6 | g6/6 f6/2 d6/8 | e6/16~`;
const BRIDGE_MEL = 'r/16 | r/16 | r/16 | r/16 | bb5/4 g6/10~ f6/2 | eb6/16~ | d6/6 c6/2 bb5/8 | c#6/8~ e6/8';
/** Heliobane's title hook (heliobane_title.gen.js HOOK_Q, bars 1-2), an octave up, then broken off. */
const HELIOBANE_HOOK = 'd6/2 d6 a6/6 g6/2 a6 c7 | bb6/6 a6/2 f6/4 d6 | d6/2 d6 a6/12 | r/16 | r/16 | r/16 | r/16 | r/16';
const GLINTS_A2 = 'a6/16 | r/16 | d7/16 | r/16 | f6/16 | r/16 | d7/16 | r/16'; // left to ring
const GLINTS_TAIL = 'a6/16 | r/16 | d7/16 | r/16';
const CH = {
  intro: 'Dm Dm', A: 'Dm Bbmaj7 Gm Asus4/8 A/8 | Dm/16 Bbmaj7 Gm7 A', bridge: 'Dm Bb Dm Bb Gm Eb Gm A',
  tail: 'Dm Bbmaj7 Gm A',
};
const SHAPE = [0, 2, 4, 3, 1, 3, 5, 4]; // 8ths through 7 chord-tone rungs from D-4

// ---------------------------------------------------------------- sections
const heartbeat = (bars) => beat(Array.from({ length: bars }, (_, i) => (i % 2 ? '................' : 'X..x............')),
  { X: [I.kick, 46], x: [I.kick, 30] });

function section(name, bars, chordStr, { melody, echo = 'single', heart = false, bassVol = 30, arpVol = 30,
  padVol = 18, windHi = 9, bell = null, bellVol = 44, extra = {} } = {}) {
  const rows = bars * 16, segs = chart(chordStr), tri = chart(triads(chordStr));
  const parts = { wind: wind(bars, { hi: windHi, inst: I.noise }),
    bass: bass(tri, ['R---------------'], I.bass, { rows, lo: 'C-3', vol: bassVol, decay: 0.94 }) };
  if (heart) parts.kick = heartbeat(bars);
  const refs = [];
  if (melody) {
    const notes = mel(melody, { vol: 38 }), ch = line(notes, I.lead, { rows, vib: 'H23', vibDelay: 4 });
    parts.lead = ch; refs.push(notes);
    if (echo === 'pingpong') [parts.echo, parts.echo2] = pingpong(ch, notes, rows, { d1: 3, s1: 0.42, d2: 6, s2: 0.24, segs });
    else parts.echo = canon(ch, notes, rows, { delay: 6, scale: 0.4, segs });
    refs.push(notesOf(parts.echo, rows), ...(parts.echo2 ? [notesOf(parts.echo2, rows)] : []));
  }
  if (bell) {
    const notes = mel(bell, { vol: bellVol }), ch = soften(line(notes, I.bell, { rows, vib: null }), rows, refs);
    parts.bells = ch;
    [parts.bellEcho, parts.bellEcho2] = pingpong(ch, notes, rows, { d1: 3, s1: 0.45, d2: 8, s2: 0.25, segs });
    refs.push(notes, notesOf(parts.bellEcho, rows), notesOf(parts.bellEcho2, rows));
  }
  const arpNotes = ladder(segs, rows, SHAPE, { lo: 'D-4', span: 7, vol: arpVol, soft: 5, len: 2 });
  parts.arp = soften(line(arpNotes, I.pluck, { rows, vib: null }), rows, refs);
  parts.canon = soften(delayLine(parts.arp, rows, segs, { delay: 3, scale: 0.4 }), rows, [...refs, notesOf(parts.arp, rows)]);
  parts.pad = padLane(segs, tri, rows, refs, { lo: 'F-4', vol: padVol, inst: I.pad });
  return pattern(name, bars, cutLanes({ ...parts, ...extra }, KEYS), LAYOUT, PANS);
}

const introArp = section('tmp', 2, CH.intro).channels;
const intro = section('intro: alone', 2, CH.intro, { bassVol: 24, padVol: 16, windHi: 11, extra: {
  arp: fadeIn(introArp[LAYOUT.indexOf('arp')], 8, 30), canon: fadeIn(introArp[LAYOUT.indexOf('canon')], 11, 30),
  bells: hits(I.bell, [16], { note: 'A-6', vol: 40 }), fx: hits(I.swell, [25], { vol: 30 }),
} });

const patterns = [
  intro,
  section('A: the lonely motif', 8, CH.A, { melody: A_MEL }),
  section('A2: answer + heartbeat', 8, CH.A, { melody: A2_MEL, echo: 'pingpong', heart: true, bell: GLINTS_A2, bellVol: 36 }),
  section('bridge: Heliobane in glass', 8, CH.bridge, { melody: BRIDGE_MEL, bell: HELIOBANE_HOOK, bellVol: 60, arpVol: 22, padVol: 20 }),
  jump(section('tail: pad and arp', 4, CH.tail, { bell: GLINTS_TAIL, bellVol: 36, padVol: 22, windHi: 12,
    extra: { fx: hits(I.swell, [57], { vol: 30 }) } }), 1),
];

writeSongCompact(import.meta.url, {
  title: 'Farstrand - Far Strand', bpm: 90, ticks: 6, mixvol: 48,
  message: 'FARSTRAND title theme "Far Strand".\nD minor, 90 BPM. Orders 1-4 loop.\nThe bridge quotes the HELIOBANE title hook.\nAll samples synthesized. Source: songs/farstrand_title.gen.js',
  samples: [
    kick({ f0: 120, f1: 42, sweep: 24, decay: 7, click: 0.05, drive: 1.3, sec: 0.5 }),
    wave('round bass', [1, 0.3, 0.1, 0.04]),
    sawPluck('dark pluck', { open: 3600, closed: 320, close: 4, decay: 2.2, sec: 1.2 }),
    wave('soft lead', [1, 0, 0.16, 0, 0.05, 0, 0.02]),
    thinPad('cold pad', { amps: [1, 0, 0.25, 0, 0.1], spread: 1 }),
    glassBell('glass bell', { sec: 1.6, partials: [[1, 1, 1.6], [2.76, 0.45, 4], [5.4, 0.2, 7.5], [8.93, 0.08, 12]] }),
    noiseLoop(), swell('swell', { sec: 1.2, seed: 23 }),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
