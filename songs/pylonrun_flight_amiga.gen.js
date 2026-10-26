#!/usr/bin/env node
/**
 * PYLON RUN in-flight loop "Low Flight" for 3 Paula channels (tools/json2mod.js):
 * it plays under the whole run, minutes at a time, while channel 3 carries the
 * game's sound effects. Original. Driving but not tiring: a steady staccato
 * bass in 8ths and a light backbeat keep the speed; the lead speaks in
 * phrases with rests, and a breakdown takes the lead and the backbeat away
 * for 4 bars in every minute.
 * D dorian, 126 BPM, speed 6: 4 rows a beat, 16 a bar, 64 rows = 4 bars = 7.6 s.
 *
 * The motif is the title's ("d - A g f e"), tightened: a rest, d, the fifth
 * leap, three steps down. Phrase map (each line 4 bars):
 *   A1 (Dm F C G)   the cell; F answers with the high C6 held; the cell again
 *                   on C; an open D over G, with a pickup (b c) into A2;
 *   A2 (Dm F C G)   the cell with a repeated d; a climb to C6; down through
 *                   the B natural; the 9th (A) held over G: still open;
 *   B1 (F G Dm Dm)  contrast: longer notes, rising then falling in one rhythm;
 *   B2 (F G A A)    the same rise, up to C#6 over A (the dominant), then a bar's
 *                   rest with a drum fill;
 *   C1 (Dm F C G)   breakdown: no lead, the kick and hats only, the bass held;
 *   C2 (Dm F C G)   the motif in long notes (augmented), the backbeat back;
 *   A1, A3          A3 is A2 with the high point moved to D6 and a fill; it
 *                   jumps back to A1 (B00).
 * Form: A1 A2 B1 B2 C1 C2 A1 A3, 32 bars, 61 s, then from the top.
 * Loop seam: A3's last bar ends on the open A over G and a fill; A1's first
 * row retriggers the bass and the kick, and the lead rests 2 rows.
 *
 * Channels (flight layout, pylonrun_amiga.kit.js): 0 bass (left), 1 lead
 * (right), 2 drums (right); 3 stays empty: the game's effects play there.
 */
import { S, mel, line, chart, bass, beat, rep, pattern, jump, writeSong } from './pylonrun_amiga.kit.js';

const I = { kick: 0, snare: 1, hat: 2, bass: 3, lead: 4 };
const samples = [S.kick(), S.snare(), S.hat(), S.bass(), S.lead()];
const D = { K: [I.kick, 56], k: [I.kick, 42], S: [I.snare, 44], s: [I.snare, 26], h: [I.hat, 16], H: [I.hat, 24] };

const DR = {
  run: 'K.h.S.h.K.hKS.h.', run2: 'K.h.S.hKh.K.S.h.', fill: 'K.h.S.h.K.S.SsSS',
  gap: 'K.h.S.h.K.h.S...', bare: 'K...h...K...h...', half: 'K...h...S...h.h.',
};
const CH = { A: 'Dm F C G', B1: 'F G Dm Dm', B2: 'F G A A' };
const A1 = 'r/2 d5 a5/4 g5/2 f5 e5 f5 | a5/6 c6/2 a5/4 r/4 | r/2 c5 g5/4 f5/2 e5 d5 e5 | d5/8~ r/4 b4/2 c5';
const A2 = 'd5/2 r d5 a5/4 g5/2 f5 e5 | f5/4 a5 c6/6! r/2 | c6/2 b5 g5/4 e5 g5 | a5/12~ r/4';
const A3 = 'd5/2 r d5 a5/4 g5/2 f5 e5 | f5/4 a5 c6/4 d6/4! | c6/2 b5 g5/4 e5 g5 | a5/12~ r/4';
const B1 = 'c5/4 f5 a5/8~ | b4/4 d5 g5/8~ | a5/2 g5 f5/4 e5 d5 | f5/12~ r/4';
const B2 = 'c5/4 f5 a5/6 g5/2 | f5/4 g5 b5/8~ | c#6/6 b5/2 a5/8~ | r/16';
const C2 = 'd5/4 a5/12~ | g5/4 f5 e5/8 | e5/4 g5/12~ | f5/4 e5 d5/8~';

const B_RUN = ['R.r.o.r.R.r.f.o.'], B_RUN2 = ['R.r.o.r.R.r.o.r.', 'R.r.o.r.R.f.o.n.'];
const B_HOLD = ['R-------r-------'];

function section(name, { chords, melody, drums, bassR, vol = 40 }) {
  const segs = chart(chords), rows = 64;
  return pattern(name, rows, [
    bass(segs, bassR, I.bass, { rows, lo: 'C-3', vol: 46, soft: 0.7 }),
    melody ? line(mel(melody, { vol }), I.lead, { rows, sustain: 0.78, release: 0.45 }) : { 0: { note: '^^' } },
    beat(drums, D),
    {},
  ], { empty: [3] });
}

const a1 = section('A1', { chords: CH.A, melody: A1, drums: rep(4, DR.run), bassR: B_RUN });
const a2 = section('A2', { chords: CH.A, melody: A2, drums: rep(4, DR.run, DR.run2), bassR: B_RUN2 });
const b1 = section('B1', { chords: CH.B1, melody: B1, drums: rep(4, DR.run2), bassR: B_RUN });
const b2 = section('B2', { chords: CH.B2, melody: B2, drums: [DR.run2, DR.run2, DR.gap, DR.fill], bassR: B_RUN2 });
const c1 = section('C1', { chords: CH.A, drums: rep(4, DR.bare), bassR: B_HOLD });
const c2 = section('C2', { chords: CH.A, melody: C2, drums: rep(4, DR.half), bassR: B_HOLD, vol: 36 });
const a3 = jump(section('A3', { chords: CH.A, melody: A3, drums: rep(4, DR.run, DR.fill), bassR: B_RUN2 }), 0, [2, 0]);

writeSong(import.meta.url, {
  title: 'Pylon Run - Low Flight', bpm: 126, ticks: 6, mixvol: 48, samples,
  patterns: [a1, a2, b1, b2, c1, c2, a3], order: [0, 1, 2, 3, 4, 5, 0, 6],
  channelnames: { 0: 'bass', 1: 'lead', 2: 'drums', 3: 'effects (empty)' },
  message: 'PYLON RUN in-flight loop "Low Flight", original, for the Amiga game (3-channel MOD via tools/json2mod.js;\n'
    + 'channel 3 is the game\'s effects). D dorian, 126 BPM; loops from the top. All samples synthesized.\n'
    + 'Source: songs/pylonrun_flight_amiga.gen.js',
});
