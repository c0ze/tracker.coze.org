#!/usr/bin/env node
/**
 * FARSTRAND — "Ending" (after Kell worn: Hesper quenches the Taproot, the cold runs back up the strands to the Knot,
 * the map is finished, Cold Harbour answers, Mott's tug comes up out of the Marrow). 2026-10-01.
 * D minor to D major, 80 BPM, speed 6: 4 rows/beat, 16 rows/bar; one row = a 16th (187.5 ms), one bar = 3 s.
 * Rendered at 48 kHz, where 80 BPM is exact (1500 samples/tick).
 *
 * Identity: gentle, not triumphant. The family's glass lead carried home: five four-bar phrases of 12 s, one per
 * still (the manifest lists each order's start as `cues`, as the prologue's), then a bar that turns back. No drums
 * but a heartbeat. 1, the cold running up the strands: no lead, the pluck climbing the chords in 16ths with its
 * canon, frost ticks thickening and rising two octaves, one glint a bar rising up the D minor triad. 2, the Knot
 * gone cold, the map finished: the title's question on the family's glass lead, home ('A—F——E | D———',
 * 'A—G——F | E———'). 3, Cold Harbour: Heliobane's title melody, once, whole (heliobane_title.gen.js HOOK_Q, all four
 * bars, its own chords Dm Bb C A), an octave up on a glass bell with 3- and 8-row echoes; the title's bridge quotes
 * only its first two bars and breaks off after 'D D A——', and here it is finished. 4, Mott's tug: the Magpie's hook
 * (Mott's leitmotif, heliobane_shop.gen.js / farstrand_mott.gen.js) whistled on the title's ocarina, in D, slow and
 * unswung, over D7; then the glass lead holds B over G and lets it fall to Bb over G minor. 5, forty-one: the cell
 * fallen ('F E D——') over Bbmaj7, the glass bells ring the Tally's forty-one (four tones on A, one on D: carcanet's
 * count, v_tally_7) over A and D, and the cell comes back in major ('F# E D——'), the only D major tonic in the loop.
 * The turn lets the D ring and a reverse swell darkens it back to D minor.
 *
 * Phrase map (cues: 0, 3, 15, 27, 39, 51, 63 s)
 *   Intro  Dm                   the quench ringing out: one glass bell, a low D, wind (not looped)
 *   1      Dm Dm Bbmaj7 A       the cold running up: the arp climbing, frost rising, glints A D F A
 *   2      Dm Bbmaj7 Gm A       the title's question on the glass lead, home; a heartbeat
 *   3      Dm Bb C A            Heliobane's title melody whole on the glass bell
 *   4      D7 D7 G Gm           the Magpie's hook on the ocarina; B falling to Bb
 *   5      Bbmaj7 Gm A D        'F E D'; forty-one on bells (A A A A | D); 'F# E D' in D major
 *   Turn   D                    the D ringing, a reverse swell back to phrase 1
 * Loop body: orders 1-6 (21 bars, 63 s). Everything synthesized. Source of truth: this file; the shared helpers come
 * from farstrand_halm.gen.js. farstrand_credits.gen.js imports the samples and the section builder below.
 */
import { kick, cymbal, noiseLoop, wave, glassBell, thinPad, swell, mel, line, chart, at, bass, beat, pattern, jump,
  writeSongCompact, ladder, pingpong, notesOf, hits, triads, cutLanes } from './heliobane_stage6.kit.js';
import { echoChannel, nn, ns } from './lib.js';
import { sawPluck, soften, delayLine, padLane, wind, fadeIn } from './farstrand_halm.gen.js';
import { pathToFileURL } from 'url';

export const I = { kick: 0, hat: 1, frost: 2, bass: 3, pluck: 4, lead: 5, whistle: 6, pad: 7, warm: 8, glass: 9, bell: 10,
  noise: 11, swell: 12 };
export const LAYOUT = ['kick', 'hat', 'frost', 'bass', 'arp', 'canon', 'lead', 'echo', 'echo2', 'whistle', 'whistleEcho', 'pad',
  'glass', 'bells', 'bellEcho', 'bellEcho2', 'wind', 'fx'];
const PANS = [0x80, 0xa8, 0x98, 0x80, 0x58, 0xa8, 0x86, 0x50, 0xb4, 0x7a, 0xa0, 0x70, 0x94, 0x6c, 0xa4, 0x54, 0x80, 0x90];
const KEYS = ['lead', 'echo', 'echo2', 'whistle', 'whistleEcho', 'arp', 'canon', 'pad', 'glass', 'bells', 'bellEcho', 'bellEcho2'];

/** The instruments (credits shares them). */
export const SAMPLES = () => [
  kick({ f0: 120, f1: 42, sweep: 24, decay: 7, click: 0.05, drive: 1.3, sec: 0.5 }),
  cymbal('glass tick', { sec: 0.05, decay: 90, seed: 17, metalMix: 0.7 }),
  cymbal('frost tick', { sec: 0.05, decay: 90, seed: 19, metalMix: 0.8 }),
  wave('round bass', [1, 0.3, 0.1, 0.04]),
  sawPluck('dark pluck', { open: 3600, closed: 320, close: 4, decay: 2.2, sec: 1.2 }),
  wave('glass lead', [1, 0.03, 0.45, 0.02, 0.22, 0.02, 0.1, 0, 0.05]),
  wave('soft lead', [1, 0, 0.16, 0, 0.05, 0, 0.02]),
  thinPad('cold pad', { amps: [1, 0, 0.3, 0, 0.12, 0, 0.05], spread: 1 }),
  thinPad('warm pad', { amps: [1, 0.5, 0.32, 0.2, 0.12, 0.07], spread: 1 }),
  thinPad('glass harmonica', { amps: [1, 0, 0.18, 0, 0.06], spread: 2 }),
  glassBell('glass bell', { sec: 2.2, partials: [[1, 1, 1.1], [2.76, 0.45, 3], [5.4, 0.2, 6], [8.93, 0.08, 10]] }),
  noiseLoop(), swell('swell', { sec: 1.3, seed: 29 }), // 7 rows are 1.31 s: it ends just before the downbeat
];

// ---------------------------------------------------------------- melodies
export const QUESTION = 'a5/4 f6/10~ e6/2 | d6/12~ r/4 | a5/4 g6/10~ f6/2 | e6/16~';       // farstrand_title.gen.js
/** Heliobane's title melody (heliobane_title.gen.js HOOK_Q, all four bars), an octave up. */
const HELIOBANE_TITLE = 'd6/2 d6 a6/6 g6/2 a6 c7 | bb6/6 a6/2 f6/4 d6 | e6/2 f6 g6/6 f6/2 e6 c6 | e6/4 d6/2 c#6 e6/8';
/** The Magpie's hook (heliobane_shop.gen.js, farstrand_mott.gen.js A1 bars 1-2) down a minor third, in D, unswung. */
const MAGPIE = 'a5/3 f#5/1 a5/2 b5/2 c6/1 c#6/1 d6/5 r/1 | b5/2 a5/2 f#5/4 r/2 f5/1 f#5/1 a5/3 r/1 | r/16 | r/16';
const MOTT_LEAD = 'r/16 | r/16 | b5/16~ | bb5/16~';
export const FORTY_ONE = 'a6/4 a6 a6 a6 | d7/16';                                           // carcanet's count, in D
export const HOME = 'r/4 f6/2 e6/2 d6/8~ | bb5/4 d6/4 g6/8~ | r/16 | r/4 f#6/2 e6/2 d6/8~'; // the cell fallen, then major
const RISING = 'a5/16 | d6/16 | f6/16 | a6/16';                                              // a glint a bar, rising
const CH = { intro: 'Dm', cold: 'Dm Dm Bbmaj7 A', knot: 'Dm Bbmaj7 Gm A', harbour: 'Dm Bb C A', mott: 'D7 D7 G Gm',
  map: 'Bbmaj7 Gm A D', turn: 'D' };
const CLIMB = [0, 1, 2, 3, 4, 5, 6, 7, 1, 2, 3, 4, 5, 6, 7, 8];                             // 16ths, running up
export const SHAPE = [0, 2, 4, 3, 1, 3, 5, 4];                                               // the title's 8ths

// ---------------------------------------------------------------- parts
/** The heartbeat (the title's lub-dub), on the first of every `every` bars. */
export const heartbeat = (bars, every = 2) => beat(Array.from({ length: bars }, (_, i) => (i % every ? '................'
  : 'X..x............')), { X: [I.kick, 40], x: [I.kick, 26] });
/** Frost: `count` ticks over `rows`, thickening toward the end, each a little higher (C-4 up two octaves). */
function frostRising(rows, count, seed = 7) {
  const ch = {}; let s = seed;
  for (let i = 0; i < count; i++) {
    s = (s * 1103515245 + 12345) % 2147483648;
    let row = Math.min(rows - 1, Math.floor(Math.sqrt((i + (s / 2147483648)) / count) * rows));
    while (ch[row] && row > 0) row--; // taken: the tick before it (they crowd toward the top)
    const k = row / rows;
    ch[row] = { note: ns(nn('C-4') + Math.round(24 * k)), instrument: I.frost, vol: `v${Math.round(22 + 26 * k)}` };
  }
  return ch;
}

/** A section: an optional lead, whistle and bells with their echoes, the arp and its canon, a pad (cold or warm) with
 *  the glass harmonica over it, a held bass, wind, and an optional heartbeat. */
export function section(name, bars, chordStr, { melody = null, melVol = 36, whistle = null, bells = null, bellVol = 40,
  bellEcho = [3, 8], heart = 0, ticks = null, shape = SHAPE, step = 2, arpVol = 24, pad = I.cold, padVol = 16, glassVol = 6,
  bassR = 'R---------------', bassVol = 28, windHi = 9, extra = {} } = {}) {
  const rows = bars * 16, segs = chart(chordStr), tri = chart(triads(chordStr));
  const parts = { wind: wind(bars, { lo: 3, hi: windHi, inst: I.noise }),
    bass: bass(tri, [bassR], I.bass, { rows, lo: 'C-3', vol: bassVol, decay: 0.94 }) };
  if (heart) parts.kick = heartbeat(bars, heart);
  if (ticks) parts.hat = beat(Array(bars).fill(ticks), { x: [I.hat, 12], g: [I.hat, 7] });
  const refs = [];
  if (melody) {
    const notes = mel(melody, { vol: melVol }), ch = line(notes, I.lead, { rows, vib: 'H23', vibDelay: 4 });
    parts.lead = ch; refs.push(notes);
    [parts.echo, parts.echo2] = pingpong(ch, notes, rows, { d1: 6, s1: 0.4, d2: 12, s2: 0.2, segs });
    refs.push(notesOf(parts.echo, rows), notesOf(parts.echo2, rows));
  }
  if (whistle) {
    const notes = mel(whistle, { vol: 40 }), ch = line(notes, I.whistle, { rows, vib: 'H22', vibDelay: 3 });
    parts.whistle = ch; refs.push(notes);
    parts.whistleEcho = soften(delayLine(ch, rows, segs, { delay: 3, scale: 0.4 }), rows, refs);
    refs.push(notesOf(parts.whistleEcho, rows));
  }
  if (bells) {
    const notes = mel(bells, { vol: bellVol }), ch = soften(line(notes, I.bell, { rows, vib: null }), rows, refs);
    parts.bells = ch;
    [parts.bellEcho, parts.bellEcho2] = pingpong(ch, notes, rows, { d1: bellEcho[0], s1: 0.45, d2: bellEcho[1], s2: 0.25, segs });
    refs.push(notes, notesOf(parts.bellEcho, rows), notesOf(parts.bellEcho2, rows));
  }
  const arpNotes = ladder(segs, rows, shape, { lo: 'D-4', span: 9, vol: arpVol, soft: 5, len: step });
  parts.arp = soften(line(arpNotes, I.pluck, { rows, vib: null }), rows, refs);
  parts.canon = soften(delayLine(parts.arp, rows, segs, { delay: 3, scale: 0.4 }), rows, [...refs, notesOf(parts.arp, rows)]);
  parts.pad = padLane(segs, tri, rows, refs, { lo: 'F-4', vol: padVol, inst: pad });
  parts.glass = echoChannel(parts.pad, { delay: 0, semi: 12, scale: glassVol / padVol, inst: I.glass, rows });
  return pattern(name, bars, cutLanes({ ...parts, ...extra }, KEYS), LAYOUT, PANS);
}

// ---------------------------------------------------------------- sections
const introParts = section('tmp', 1, CH.intro).channels;
const intro = section('intro: the quench ringing out', 1, CH.intro, { bassVol: 22, padVol: 12, windHi: 10, extra: {
  bells: hits(I.bell, [0], { note: 'D-7', vol: 44 }), arp: fadeIn(introParts[LAYOUT.indexOf('arp')], 8, 15),
  canon: fadeIn(introParts[LAYOUT.indexOf('canon')], 11, 15),
} });
const turn = section('turn: the D ringing', 1, CH.turn, { pad: I.warm, padVol: 22, arpVol: 18, windHi: 10,
  extra: { bells: hits(I.bell, [0], { note: 'F#6', vol: 26 }), fx: hits(I.swell, [9], { vol: 26 }) } });

const patterns = [
  intro,
  section('1: the cold running up', 4, CH.cold, { bells: RISING, bellVol: 34, bellEcho: [6, 12], shape: CLIMB, step: 1,
    arpVol: 22, windHi: 12, extra: { frost: frostRising(64, 40) } }),
  section('2: the Knot gone cold', 4, CH.knot, { melody: QUESTION, heart: 2, padVol: 17 }),
  section('3: Cold Harbour', 4, CH.harbour, { bells: HELIOBANE_TITLE, bellVol: 54, arpVol: 20, padVol: 19, glassVol: 7 }),
  section('4: Mott\'s tug', 4, CH.mott, { whistle: MAGPIE, melody: MOTT_LEAD, melVol: 30, heart: 2, ticks: '....x.......x...',
    pad: I.warm, padVol: 21 }),
  section('5: forty-one', 4, CH.map, { melody: HOME, bells: `r/16 | r/16 | ${FORTY_ONE}`, bellVol: 40, bellEcho: [6, 12],
    heart: 4, pad: I.warm, padVol: 22, glassVol: 8 }),
  jump(turn, 1),
];

// farstrand_credits.gen.js imports the parts above, so only write the song when run directly.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) writeSongCompact(import.meta.url, {
  title: 'Farstrand - Ending', bpm: 80, ticks: 6, mixvol: 48,
  message: 'FARSTRAND "Ending": the cold running home.\nD minor to D major, 80 BPM. Orders 1-6 loop, one still a phrase.\nPhrase 3 is HELIOBANE\'s title melody, whole.\nAll samples synthesized. Source: songs/farstrand_ending.gen.js',
  samples: SAMPLES(),
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
