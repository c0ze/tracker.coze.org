#!/usr/bin/env node
/**
 * PYLON RUN title theme "Dusk Plain" for 4 Paula channels (the game's title and
 * attract mode; tools/json2mod.js). Original. The scene: the craft waits low
 * over a plain at sunset; the music is the horizon before the run, warm and
 * open, not yet driving. D dorian (the B natural is the sunset's warm colour),
 * 96 BPM, speed 6: 4 rows a beat, 16 a bar, 64 rows = 4 bars = 10 s.
 *
 * The motif (the game's, also the flight loop's): a leap up a fifth, held,
 * then three steps down, "d - A g f e". Phrase map:
 *   A1 (Dm C G A)  the cell, its rhythm again a step lower (e - G f e c), the
 *                  cell's leap widened to the B natural, and an open A held
 *                  over the A chord: the question;
 *   A2 (Dm C G Dm) the cell, then the second bar climbs instead of falling,
 *                  to the one high point (D6) and home to D: the answer;
 *   B  (Bb F C A)  contrast: the sun going down (Bb), long notes rising and
 *                  falling in one rhythm, the leading tone C# turning back to A;
 *   A2b            A2 with the drums' fill into the loop.
 * Form: intro A1 A2 B A1 A2b, looping to A1 (B01): 60 s, a 50 s loop. The
 * intro has no lead: bells, bass and hats only.
 * Loop seam: A2b ends on the lead's D held and cut on its last row, the
 * bass on D, so A1's first D starts clean.
 *
 * Channels (title layout, pylonrun_amiga.kit.js): 0 drums (left), 1 lead
 * (right), 2 bell (right), 3 bass (left). No sound effects play on the title.
 */
import { S, broken, mel, line, chart, bass, beat, rep, pattern, jump, writeSong } from './pylonrun_amiga.kit.js';

const I = { kick: 0, snare: 1, hat: 2, bass: 3, lead: 4, bell: 5 };
const samples = [S.kick(), S.snare(), S.hat(), S.bass(), S.lead(), S.bell()];
const D = { K: [I.kick, 52], k: [I.kick, 38], S: [I.snare, 40], s: [I.snare, 24], h: [I.hat, 14], H: [I.hat, 22] };

const DR = {
  hats: 'h...h...h...h...', soft: 'K...h...S...h...', walk: 'K...h.k.S...h.h.',
  fill: 'K...h.k.S.s.SsSS',
};
const CH = { A1: 'Dm C G A', A2: 'Dm C G Dm', B: 'Bb F C A' };
const A1 = 'd5/2 a5/6 g5/2 f5 e5/4 | e5/2 g5/6 f5/2 e5 c5/4 | d5/2 b5/6! a5/2 g5 a5/4 | a5/12~ r/4';
const A2 = 'd5/2 a5/6 g5/2 f5 e5/4 | e5/2 g5/6 c6/2 b5 g5/4 | a5/2 b5 d6/6! c6/2 b5/4 | a5/2 f5 d5/12~';
const BM = 'd5/4 f5 bb5/8~ | a5/4 g5 f5/8 | e5/4 g5 c6/8~ | c#6/4 b5 a5/8~';

const B_A = ['R-----r-R---f---'], B_B = ['R-------r---f---'], B_IN = ['R---------------'];

function section(name, { chords, melody, drums, bassR, bell = [0, 2, 1, 2], bellVol = 22, cutLast = false }) {
  const segs = chart(chords), rows = 64;
  const lead = melody ? line(mel(melody, { vol: 42 }), I.lead, { rows, sustain: 0.8, release: 0.45 }) : { 0: { note: '^^' } };
  if (cutLast) lead[63] = { note: '^^' };
  return pattern(name, rows, [
    beat(drums, D),
    lead,
    broken(segs, I.bell, { rows, lo: 'D-4', vol: bellVol, pick: bell }),
    bass(segs, bassR, I.bass, { rows, lo: 'C-3', vol: 44, decay: 0.9 }),
  ]);
}

const intro = section('intro', { chords: CH.A1, drums: rep(4, DR.hats), bassR: B_IN, bell: [0, 1, 2, 3, 2, 1], bellVol: 26 });
const a1 = section('A1', { chords: CH.A1, melody: A1, drums: rep(4, DR.soft, DR.walk), bassR: B_A });
const a2 = section('A2', { chords: CH.A2, melody: A2, drums: rep(4, DR.soft, DR.walk), bassR: B_A });
const b = section('B', { chords: CH.B, melody: BM, drums: rep(4, DR.walk), bassR: B_B, bell: [0, 1, 2, 3] });
const a2b = jump(section('A2b', { chords: CH.A2, melody: A2, drums: rep(4, DR.walk, DR.fill), bassR: B_A, cutLast: true }), 1);

writeSong(import.meta.url, {
  title: 'Pylon Run - Dusk Plain', bpm: 96, ticks: 6, mixvol: 48, samples,
  patterns: [intro, a1, a2, b, a2b], order: [0, 1, 2, 3, 1, 4],
  channelnames: { 0: 'drums', 1: 'lead', 2: 'bell', 3: 'bass' },
  message: 'PYLON RUN title theme "Dusk Plain", original, for the Amiga game (4-channel MOD via tools/json2mod.js).\n'
    + 'D dorian, 96 BPM; loops orders 1-5. All samples synthesized. Source: songs/pylonrun_title_amiga.gen.js',
});
