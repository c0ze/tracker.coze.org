#!/usr/bin/env node
/**
 * Ironhull Ascent — an original action loop for a climb through a machine fortress, written with
 * skills/amiga-masters in the manner of Chris Hülsbeck's Turrican and Apidya music (1990-92)
 * (references/styles.md, "Chris Hülsbeck"). Borrowed: his numbers and habits; the melody,
 * harmony and sounds are new (sound library presets).
 *
 * A minor, speed 4 at tempo 100: a tick is 25 ms, a row 0.1 s (a 16th at 150 BPM), 16 rows a
 * bar. Intro 4 bars, A 8, B 8, A' 8: about 45 s, looping to the intro.
 *
 * What makes it his (STYLE.huelsbeck):
 *   - drums between the bass notes, on the bass channel (Apidya's level 1: a drum hit between
 *     bass notes, a third of that channel's notes): kick and snare on the beats, the bass in
 *     the gaps, each cutting the other;
 *   - chord arpeggios in Turrican's flight shapes, inversions rather than root chords: 0-4-9
 *     (A minor over its C), 0-5-9 (F over C), 0-3-8 (G over B, E over G#), 0-5-8 (E minor over B),
 *     4 ticks a step's cycle of 3 (J stamped on every row);
 *   - a lead with a late, gentle vibrato: H64 (±25 cents, 10 ticks a cycle) two rows (8 ticks)
 *     into its long notes (his ±27 cents from tick 9);
 *   - an echo channel three rows (12 ticks) behind the lead at 60%, trimmed so it re-strikes
 *     without holding a step against the lead (his 3-12 ticks, in 8 of 33 tunes);
 *   - fast rows and busy notes (his median 16 notes a second; this tune about 9).
 * Channels: 0 bass + drums (left), 1 lead (right), 2 chord arpeggios (right), 3 echo (left).
 * This is a reasoned example: rendered and measured, not listened to.
 */
import { writeSong } from './lib.js';
import { arp, echo, held, place, patternize, STYLE } from './amiga-kit.js';

const H = STYLE.huelsbeck;                         // speed 4, H64 two rows in, echo 3 rows at 0.6
const BAR = 16;
const S = { kick: 0, snare: 1, bass: 2, lead: 3, chord: 4 };

// Chords: bass root and fifth (bass.pluck, D-3..A-3), and the arpeggio's lowest note with its
// shape (an inversion, as Turrican's flight plays them).
const CH = {
  Am: { bass: ['A-2', 'E-3'], arp: ['C-5', '0-4-9'] },
  F: { bass: ['F-2', 'C-3'], arp: ['C-5', '0-5-9'] },
  G: { bass: ['G-2', 'D-3'], arp: ['B-4', '0-3-8'] },
  Em: { bass: ['E-2', 'B-2'], arp: ['B-4', '0-5-8'] },
  E: { bass: ['E-2', 'B-2'], arp: ['G#4', '0-3-8'] },
  C: { bass: ['C-3', 'G-2'], arp: ['C-5', '0-4-7'] },
};

const A = [
  [[0, 'E-5', 3], [3, 'A-5', 3], [6, 'B-5', 2], [8, 'C-6', 6], [14, 'B-5', 2]],
  [[0, 'A-5', 8], [8, 'G-5', 2], [10, 'F-5', 2], [12, 'E-5', 4]],
  [[0, 'D-5', 3], [3, 'G-5', 3], [6, 'A-5', 2], [8, 'B-5', 6], [14, 'D-6', 2]],
  [[0, 'E-6', 12], [12, 'D-6', 2], [14, 'B-5', 2]],
  [[0, 'C-6', 3], [3, 'B-5', 3], [6, 'A-5', 2], [8, 'E-6', 6], [14, 'D-6', 2]],
  [[0, 'C-6', 4], [4, 'A-5', 4], [8, 'F-5', 4], [12, 'A-5', 4]],
  [[0, 'B-5', 4], [4, 'D-6', 4], [8, 'G-6', 6], [14, 'F-6', 2]],
  [[0, 'E-6', 8], [8, 'G#5', 8]],
];
const B = [
  [[0, 'A-5', 6], [6, 'C-6', 2], [8, 'F-6', 8]],
  [[0, 'G-6', 6], [6, 'F-6', 2], [8, 'D-6', 8]],
  [[0, 'E-6', 12], [12, 'C-6', 4]],
  [[0, 'A-5', 16]],
  [[0, 'F-5', 4], [4, 'A-5', 4], [8, 'C-6', 4], [12, 'F-6', 4]],
  [[0, 'G-6', 4], [4, 'F-6', 4], [8, 'D-6', 4], [12, 'B-5', 4]],
  [[0, 'C-6', 4], [4, 'E-6', 4], [8, 'G-6', 8]],
  [[0, 'G#6', 8], [8, 'B-6', 8]],
];
const A2 = [...A.slice(0, 6), [[0, 'B-5', 4], [4, 'E-6', 4], [8, 'G#5', 8]], [[0, 'A-5', 15]]];
const FORM = [
  { name: 'intro', chords: ['Am', 'F', 'G', 'E'], lead: null },
  { name: 'A', chords: ['Am', 'F', 'G', 'Em', 'Am', 'F', 'G', 'E'], lead: A },
  { name: 'B', chords: ['F', 'G', 'Am', 'Am', 'F', 'G', 'C', 'E'], lead: B },
  { name: "A'", chords: ['Am', 'F', 'G', 'Em', 'Am', 'F', 'E', 'Am'], lead: A2 },
];
const TOTAL = FORM.reduce((n, s) => n + s.chords.length, 0) * BAR;

const low = {}, lead = {}, chords = {};
let bar0 = 0;
for (const sec of FORM) {
  sec.chords.forEach((c, b) => {
    const at = (bar0 + b) * BAR, { bass: [r1, r5], arp: [base, shape] } = CH[c];
    // Bass channel: kick on 1 and 3, snare on 2 and 4, the bass between them (each hit cuts the last)
    for (const r of [0, 8]) place(low, at + r, { note: 'C-5', instrument: S.kick, vol: 'v50' });
    for (const r of [4, 12]) place(low, at + r, { note: 'C-5', instrument: S.snare, vol: 'v40' });
    for (const [r, note] of [[2, r1], [6, r1], [7, r5], [10, r1], [14, r5]]) place(low, at + r, { note, instrument: S.bass, vol: 'v40' });
    // Chords: two stabs a bar, the arpeggio stamped on each of their four rows, then cut.
    for (const r of [0, 8]) {
      place(chords, at + r, { note: base, instrument: S.chord, vol: 'v30' });
      Object.entries(held(at + r, 4, arp(shape))).forEach(([x, e]) => place(chords, Number(x), e));
      place(chords, at + r + 4, { note: '^^' });
    }
    // Lead: long notes get the late vibrato two rows in.
    if (sec.lead) {
      const notes = sec.lead[b];
      notes.forEach(([r, note, rows], k) => {
        const next = k + 1 < notes.length ? notes[k + 1][0] : BAR;
        place(lead, at + r, { note, instrument: S.lead, vol: 'v50' });
        if (rows >= 6) Object.entries(held(at + r, rows, H.vibrato, { from: 2 })).forEach(([x, e]) => place(lead, Number(x), e));
        if (r + rows < next && at + r + rows < TOTAL) place(lead, at + r + rows, { note: '^^' });
      });
    }
  });
  bar0 += sec.chords.length;
}
// The echo channel: the lead three rows later at 60%, trimmed (no effects copied).
const echoCh = echo(lead, { delay: H.echo.delay, scale: H.echo.scale, rows: TOTAL, trim: true });

// The loop: every channel stops on the last row.
const channels = [low, lead, chords, echoCh];
for (const ch of channels) if (!ch[TOTAL - 1]?.note) ch[TOTAL - 1] = { ...(ch[TOTAL - 1] ?? {}), note: '^^' };
['X40', 'XC0', 'XC0', 'X40'].forEach((p, c) => place(channels[c], [...Array(BAR).keys()].find((r) => !channels[c][r]?.fx), { fx: p }));

const names = ['intro', 'A bars 1-4', 'A bars 5-8', 'B bars 1-4', 'B bars 5-8', "A' bars 1-4", "A' bars 5-8"];
const { patterns, order } = patternize(channels, { rows: 4 * BAR, names });

writeSong(import.meta.url, {
  title: 'Ironhull Ascent', bpm: 100, ticks: H.speed, mixvol: 64,
  message: "Ironhull Ascent: an original action loop in the manner of Chris Hulsbeck's Turrican and Apidya.\n"
    + "A minor, speed 4, intro / A / B / A'. Drums between the bass notes, inversion arpeggios,\n"
    + 'a late vibrato, an echo three rows behind. Sound library presets only.\n'
    + 'Source: songs/amiga_ironhull_ascent.gen.js. Rendered and measured, not listened to.',
  samples: [
    { name: 'kick', synth: { preset: 'kick.punch' } },
    { name: 'snare', synth: { preset: 'snare.tight' } },
    { name: 'bass', synth: { preset: 'bass.pluck' } },
    { name: 'lead', synth: { preset: 'lead.pwm' } },
    { name: 'chord', synth: { preset: 'pad.warm' } },
  ],
  channelnames: { 0: 'bass + drums', 1: 'lead', 2: 'chords', 3: 'echo' },
  patterns,
  order,
});
