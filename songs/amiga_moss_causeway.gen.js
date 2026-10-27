#!/usr/bin/env node
/**
 * Moss Causeway — an original loop for a stone path through a drowned forest, written with
 * skills/amiga-masters in the manner of Tim Wright's Shadow of the Beast II and III (1990-92)
 * (references/styles.md, "Tim Wright"). Borrowed: his numbers and habits; the melody, harmony
 * and sounds are new (sound library presets).
 *
 * D Dorian, speed 5 at 125 BPM (his speed in 41 of 41 MODs): a row is 0.1 s, 16 rows a bar.
 * Four stages of eight bars on one progression, each adding a part, as the Beast II level
 * files grow from 1-1 to 1-4: drums and ostinato; the pad; the bell melody; the melody again,
 * varied, with an echo. About 51 s, looping to the first stage.
 *
 * What makes it his (STYLE.wright):
 *   - dynamics are set volumes only (Cxx, 36 per 100 notes in his MODs): swells and fades
 *     written as volume steps on the rows after a note, never a volume slide or an envelope;
 *   - no arpeggios (0 of 41 tunes); long notes (his median 20 ticks, 4 rows; Beast II's title
 *     80): the bell melody holds 4-16 rows and rings;
 *   - Beast III's forest shimmer: a tiny vibrato on every row of the melody (4xy depth 1 there;
 *     H71 here, a cycle every 9 ticks, ±6 cents), not a vibrato you hear as one;
 *   - a drum channel of struck sounds (kick.soft, pitched toms) in a 3+3+2 figure, and one-shot
 *     samples for almost everything (his MODs loop 25% of their samples);
 *   - two portamento bends in the whole tune (E04: a semitone down over a row);
 *   - in the last stage the pad channel echoes the melody four rows (20 ticks) behind, as
 *     Beast III's temple tunes do 20-24 ticks behind.
 * Channels: 0 drums (left), 1 ostinato (right), 2 pad / echo (right), 3 bell melody (left).
 * This is a reasoned example: rendered and measured, not listened to.
 */
import { writeSong } from './lib.js';
import { echo, held, place, patternize, STYLE } from './amiga-kit.js';

const T = STYLE.wright;                            // speed 5, H71 shimmer, no fades
const BAR = 16, STAGE = 8;
const S = { kick: 0, tom: 1, tine: 2, pad: 3, bell: 4 };
const v = (n) => `v${String(Math.max(0, Math.round(n))).padStart(2, '0')}`;

// One progression for every stage: Dorian vamp, then the turn through Bb and C to A.
const CHORDS = ['Dm', 'Dm', 'C', 'Dm', 'Bb', 'C', 'Am', 'A'];
// ostinato tones (keys.tine, C-4..C-5), and the pad's held tone
const TONES = {
  Dm: { arp: ['D-4', 'A-4', 'F-4', 'D-5', 'A-4', 'C-5'], pad: 'F-4' },
  C: { arp: ['C-4', 'G-4', 'E-4', 'C-5', 'G-4', 'E-4'], pad: 'E-4' },
  Bb: { arp: ['D-4', 'F-4', 'A#4', 'D-5', 'F-4', 'A#4'], pad: 'D-4' },
  Am: { arp: ['C-4', 'A-4', 'E-4', 'C-5', 'A-4', 'E-4'], pad: 'C-4' },
  A: { arp: ['E-4', 'A-4', 'E-4', 'C#5', 'A-4', 'E-4'], pad: 'A-4' }, // the root: the bent D sits a fourth above it
};
// 3+3+2 twice: the ostinato's rows in a bar
const OST_ROWS = [0, 3, 6, 8, 11, 14];

// Bell melody: [row, note, rows, { bend }] per bar. Stage 3 states it, stage 4 varies it.
const MEL3 = [
  [[0, 'A-5', 8], [8, 'C-6', 4], [12, 'D-6', 4]],
  [[0, 'F-6', 12], [12, 'E-6', 4]],
  [[0, 'E-6', 8], [8, 'D-6', 4], [12, 'C-6', 4]],
  [[0, 'D-6', 16]],
  [[0, 'D-6', 8], [8, 'F-6', 8]],
  [[0, 'G-6', 8], [8, 'E-6', 8]],
  [[0, 'C-6', 8], [8, 'E-6', 4], [12, 'D-6', 4]],
  [[0, 'D-6', 8, { bend: true }], [8, 'C#6', 8]],
];
const MEL4 = [
  [[0, 'A-5', 4], [4, 'D-6', 4], [8, 'F-6', 8]],
  [[0, 'A-6', 12], [12, 'G-6', 4]],
  [[0, 'G-6', 8], [8, 'E-6', 8]],
  [[0, 'F-6', 8], [8, 'D-6', 8]],
  [[0, 'D-6', 8], [8, 'F-6', 4], [12, 'G-6', 4]],
  [[0, 'E-6', 8], [8, 'C-6', 8]],
  [[0, 'C-6', 8], [8, 'E-6', 8]],
  [[0, 'D-6', 8, { bend: true }], [8, 'C#6', 7]],
];

const drums = {}, ost = {}, pad = {}, bell = {};

for (let stage = 0; stage < 4; stage++) {
  CHORDS.forEach((c, b) => {
    const bar = stage * STAGE + b, at = bar * BAR, last = b === STAGE - 1;
    // Drums: kick on 1 and 3, toms in the 3+3+2 gaps; the stage's last bar rolls the toms down.
    const hits = last && stage < 3
      ? [[0, 'k'], [8, 'C-5'], [10, 'A-4'], [12, 'G-4'], [14, 'E-4']]
      : [[0, 'k'], [6, 'C-5'], [8, 'k'], [11, 'G-4'], [14, 'G-4']];
    for (const [r, h] of hits) {
      place(drums, at + r, h === 'k' ? { note: 'C-5', instrument: S.kick, vol: 'v44' } : { note: h, instrument: S.tom, vol: v(r % 8 === 6 ? 32 : 26) });
    }
    // Ostinato: the chord in 3+3+2, accents on the bar's two downbeats (set volumes).
    TONES[c].arp.forEach((note, k) => place(ost, at + OST_ROWS[k], { note, instrument: S.tine, vol: v(k % 3 === 0 ? 28 : 21) }));
    // Pad in stages 2 and 3: the chord's third, a bar long, swelled and faded by volume steps.
    if (stage === 1 || stage === 2) {
      const steps = [6, 10, 14, 18, 22, 24];
      place(pad, at, { note: TONES[c].pad, instrument: S.pad, vol: v(steps[0]) });
      steps.slice(1).forEach((x, k) => place(pad, at + k + 1, { vol: v(x) }));
      [18, 12, 6].forEach((x, k) => place(pad, at + 12 + k, { vol: v(x) }));
      place(pad, at + 15, { note: '^^' });
    }
  });
  // Melody in stages 3 and 4
  if (stage >= 2) {
    const mel = stage === 2 ? MEL3 : MEL4;
    mel.forEach((notes, b) => {
      const at = (stage * STAGE + b) * BAR;
      notes.forEach(([r, note, rows, opt = {}], k) => {
        const next = k + 1 < notes.length ? notes[k + 1][0] : BAR;
        place(bell, at + r, { note, instrument: S.bell, vol: 'v56' });
        // the shimmer from the second row (the note row keeps its volume, for the MOD)
        if (opt.bend) {
          // hold, then bend a semitone down over row 4 into the next note's pitch
          Object.entries(held(at + r, 4, T.vibrato, { from: 1 })).forEach(([x, e]) => place(bell, Number(x), e));
          place(bell, at + r + 4, { fx: 'E04' });
          place(bell, at + r + 6, { vol: 'v42' });
        } else {
          Object.entries(held(at + r, rows, T.vibrato, { from: 1 })).forEach(([x, e]) => place(bell, Number(x), e));
        }
        if (r + rows < next) place(bell, at + r + rows, { note: '^^' });
      });
    });
  }
}

// Stage 4: the pad channel echoes the melody four rows behind (20 ticks), a third as loud.
const stage4 = 3 * STAGE * BAR, end = 4 * STAGE * BAR;
const src = Object.fromEntries(Object.entries(bell).filter(([r]) => r >= stage4).map(([r, e]) => [r - stage4, e]));
Object.entries(echo(src, { delay: 4, scale: 0.4, rows: end - stage4, trim: true })).forEach(([r, e]) => place(pad, stage4 + Number(r), e));

// The loop: every channel stops on the last row, so stage 1 starts clean.
const channels = [drums, ost, pad, bell];
for (const ch of channels) if (!ch[end - 1]?.note) ch[end - 1] = { ...(ch[end - 1] ?? {}), note: '^^' };
// Paula's sides, previewed at half width in the IT (the MOD drops these).
['X40', 'XC0', 'XC0', 'X40'].forEach((p, c) => place(channels[c], [...Array(BAR).keys()].find((r) => !channels[c][r]?.fx), { fx: p }));

const names = [];
for (const s of ['stage 1', 'stage 2', 'stage 3', 'stage 4']) names.push(`${s} bars 1-4`, `${s} bars 5-8`);
const { patterns, order } = patternize(channels, { rows: 4 * BAR, names });

writeSong(import.meta.url, {
  title: 'Moss Causeway', bpm: 125, ticks: T.speed, mixvol: 64,
  message: 'Moss Causeway: an original loop in the manner of Tim Wright (Shadow of the Beast II/III).\n'
    + 'D Dorian, speed 5, four stages that add parts. Set volumes only, a shimmer on the melody,\n'
    + 'two bends, an echo four rows behind at the end. Sound library presets only.\n'
    + 'Source: songs/amiga_moss_causeway.gen.js. Rendered and measured, not listened to.',
  samples: [
    { name: 'kick', synth: { preset: 'kick.soft' } },
    { name: 'tom', synth: { preset: 'tom.round' } },
    { name: 'tine', synth: { preset: 'keys.tine' } },
    { name: 'pad', synth: { preset: 'pad.warm' } },
    { name: 'bell', synth: { preset: 'bell.clear' } },
  ],
  channelnames: { 0: 'drums', 1: 'ostinato', 2: 'pad / echo', 3: 'bell' },
  patterns,
  order,
});
