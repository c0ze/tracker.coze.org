#!/usr/bin/env node
/**
 * FARSTRAND — "Credits" (the credits scroll after the ending). 2026-10-01.
 * D minor to D major, 80 BPM, speed 6: 4 rows/beat, 16 rows/bar; one row = a 16th (187.5 ms), one bar = 3 s.
 * Rendered at 48 kHz, where 80 BPM is exact (1500 samples/tick).
 *
 * Identity: the ending's room (its instruments, its tempo, its forty-one; farstrand_ending.gen.js) with a pulse to
 * scroll by: a heartbeat every other bar and soft glass ticks. A is the title theme whole on the family's glass lead
 * (farstrand_title.gen.js A: the question and its answer peaking on C7). B is the family in glass, two bars each on the
 * lead, all in D: Halm's cell ('D E F——', 'C> A F'), Sunder's flare ('A D E F——', 'A> G F'), Ninth Light's fall and
 * the Choir's chord ('F E D——', 'C# F A——'), and Kell's motif, kept ('G D G—— A Bb'), lifted at the end to C# E A over
 * A major. C is the Survey's call as it was, upright and warm (farstrand_benchmark.gen.js's bugle call, which Kell
 * turned inside out), on the title's ocarina over D A G D, then rung on glass bells an octave up while the lead holds
 * long notes under it: the Concord's call home, the route Hesper sent to Cold Harbour. D is the ending's last phrase (the cell
 * fallen, forty-one on the bells, the cell in D major), then four bars of pad and arp darkening back to D minor and a
 * reverse swell into A.
 *
 * Phrase map
 *   Intro  Dm Dm                          wind, a low D, the arp fading in, one bell (not looped)
 *   A      Dm Bbmaj7 Gm Asus4-A | Dm Bbmaj7 Gm7 A   the title theme on the glass lead; heartbeat and ticks
 *   B      Dm Bbmaj7 Dm Bbmaj7 | Dm Faug Gm A     Halm, Sunder, Ninth Light and the Choir, Kell
 *   C      D A G D | D A G D                the Survey's call on the ocarina, then on glass bells over F# A B A
 *   D      Bbmaj7 Gm A D | Bbmaj7 Gm Asus4 A   forty-one and the cell in D major; pad and arp, a swell back into A
 * Loop body: orders 1-4 (32 bars, 96 s). Everything synthesized. Source of truth: this file and
 * farstrand_ending.gen.js (its samples and section builder).
 */
import { jump, writeSongCompact, hits } from './heliobane_stage6.kit.js';
import { fadeIn } from './farstrand_halm.gen.js';
import { I, LAYOUT, SAMPLES, QUESTION, FORTY_ONE, HOME, section } from './farstrand_ending.gen.js';

// ---------------------------------------------------------------- melodies
const TITLE_A = `${QUESTION} | a5/4 f6/8 a6/4 | c7/8~ bb6/4 a6 | g6/6 f6/2 e6/4 d6 | c#6/8~ e6/4 a5`; // the title's A
const FAMILY = 'r/4 d6/2 e6 f6/8~ | c7/6> a6/2 f6/8'   // Halm's cell, in D
  + ' | a5/2 d6/2 e6/4 f6/8 | a6/6> g6/2 f6/8'        // Sunder's flare, in D
  + ' | r/4 f6/2 e6/2 d6/8~ | c#6/4 f6/4 a6/8~'       // Ninth Light's fall, the Choir's chord
  + ' | g6/2 d6/2 g5/8 a5/2 bb5/2 | c#6/4 e6/4 a6/8'; // Kell's motif, kept, lifted into A major
const CALL = 'a5/2 d6/2 a6/8 g6/2 f#6/2 | e6/4 d6/4 e6/8 | a5/2 d6/2 b6/8 a6/2 g6/2 | f#6/4 e6/4 d6/8';
const C_LEAD = 'r/16 | r/16 | r/16 | r/16 | f#5/16~ | a5/16~ | b5/16~ | a5/16~'; // under the bells' call
const C_BELLS = `r/16 | r/16 | r/16 | r/16 | ${CALL}`;
const D_BELLS = `r/16 | r/16 | ${FORTY_ONE} | a6/16 | r/16 | d7/16 | r/16`;
const CH = { intro: 'Dm Dm', A: 'Dm Bbmaj7 Gm Asus4/8 A/8 | Dm/16 Bbmaj7 Gm7 A', B: 'Dm Bbmaj7 Dm Bbmaj7 Dm Faug Gm A',
  C: 'D A G D D A G D', D: 'Bbmaj7 Gm A D Bbmaj7 Gm Asus4 A' };
const TICKS = 'x...g...x...g...';

// ---------------------------------------------------------------- sections
const introParts = section('tmp', 2, CH.intro).channels;
const intro = section('intro: alone', 2, CH.intro, { bassVol: 24, padVol: 14, windHi: 11, extra: {
  arp: fadeIn(introParts[LAYOUT.indexOf('arp')], 8, 30), canon: fadeIn(introParts[LAYOUT.indexOf('canon')], 11, 30),
  bells: hits(I.bell, [16], { note: 'A-6', vol: 38 }), fx: hits(I.swell, [25], { vol: 26 }),
} });
const close = section('D: forty-one, then home', 8, CH.D, { melody: `${HOME} | r/16 | r/16 | r/16 | r/16`,
  bells: D_BELLS, bellVol: 40, bellEcho: [6, 12],
  heart: 4, pad: I.warm, padVol: 22, glassVol: 8, extra: { fx: hits(I.swell, [121], { vol: 26 }) } });

const patterns = [
  intro,
  section('A: the title theme', 8, CH.A, { melody: TITLE_A, heart: 2, ticks: TICKS }),
  section('B: the family in glass', 8, CH.B, { melody: FAMILY, heart: 2, ticks: TICKS, pad: I.warm, padVol: 19 }),
  section('C: the call home', 8, CH.C, { whistle: `${CALL} | r/16 | r/16 | r/16 | r/16`, melody: C_LEAD, melVol: 28,
    bells: C_BELLS, bellVol: 40, bellEcho: [6, 12], heart: 2, ticks: TICKS, pad: I.warm, padVol: 21 }),
  jump(close, 1),
];

writeSongCompact(import.meta.url, {
  title: 'Farstrand - Credits', bpm: 80, ticks: 6, mixvol: 48,
  message: 'FARSTRAND "Credits": the title theme, the family in glass, the call home.\nD minor to D major, 80 BPM. Orders 1-4 loop.\nShares farstrand_ending\'s instruments.\nAll samples synthesized. Source: songs/farstrand_credits.gen.js',
  samples: SAMPLES(),
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
