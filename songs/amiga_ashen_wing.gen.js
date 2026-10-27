#!/usr/bin/env node
/**
 * Ashen Wing — an original, dark loop for an owl's flight over burnt fields, written with
 * skills/amiga-masters in the manner of Jeroen Tel's in-game music for Agony (1992)
 * (references/styles.md, "Jeroen Tel"). Borrowed: his numbers and habits; the melody, harmony
 * and sounds are new (sound library presets).
 *
 * C minor, speed 6 at 125 BPM: a row is 0.12 s, 16 rows a bar. A 8 bars, B 8, A' 8: about 46 s,
 * looping to A.
 *
 * What makes it his (STYLE.tel, Agony's levels 1, 2 and 4):
 *   - plain and sampled: every note of a channel at one volume (his flat 100%), no vibrato, no
 *     arpeggio, no slide, no drums; the music is in the notes;
 *   - one-shot "piano" samples (keys.tine, keys.mallet, bass.pluck) that ring and fade by
 *     themselves (Agony's level samples are long one-shots), notes of 2-3 rows (his 12-18 ticks);
 *   - three melodic lines as in Agony's levels (bass, support, lead; the levels leave channel 0
 *     silent), and here the fourth channel adds an off-beat line that rests while the lead moves;
 *   - B borrows level 3: a late vibrato on the lead's long notes, ±37 cents over 12 ticks from
 *     tick 12 (vibrato(12, 37) = H56, two rows in), and the support decaying under it.
 * Channels: 0 bass (left), 1 support on the beats (right), 2 support off the beats (right),
 * 3 lead (left).
 * This is a reasoned example: rendered and measured, not listened to.
 */
import { writeSong, nn, ns } from './lib.js';
import { fade, held, place, patternize, STYLE } from './amiga-kit.js';

const TEL = STYLE.tel;                             // speed 6, H56 two rows in, flat
const BAR = 16;
const S = { bass: 0, mallet: 1, tine: 2, lead: 3 };

// Chord tones: bass root, then three tones in C-5..C-6 for the support lines.
const CH = {
  Cm: ['C-3', 'C-5', 'D#5', 'G-5'], Ab: ['G#2', 'C-5', 'D#5', 'G#5'], Fm: ['F-2', 'C-5', 'F-5', 'G#5'],
  G: ['G-2', 'B-4', 'D-5', 'G-5'], Eb: ['D#3', 'D#5', 'G-5', 'A#5'], Bb: ['A#2', 'D-5', 'F-5', 'A#5'],
  Gm: ['G-2', 'D-5', 'G-5', 'A#5'],
};
// bass.pluck reads best from C-3: lower roots go up an octave
const root = (c) => (nn(CH[c][0]) < nn('C-3') ? ns(nn(CH[c][0]) + 12) : CH[c][0]);

const A = [
  [[0, 'G-5', 6], [6, 'D#5', 2], [8, 'C-5', 4], [12, 'G-5', 4]],
  [[0, 'D#5', 6], [6, 'C-5', 2], [8, 'G#4', 8]],
  [[0, 'F-5', 4], [4, 'G#5', 4], [8, 'C-6', 6], [14, 'A#5', 2]],
  [[0, 'B-5', 12], [12, 'D-6', 4]],
  [[0, 'C-6', 6], [6, 'G-5', 2], [8, 'D#5', 4], [12, 'G-5', 4]],
  [[0, 'A#5', 8], [8, 'G-5', 4], [12, 'D#5', 4]],
  [[0, 'G#5', 6], [6, 'F-5', 2], [8, 'C-5', 4], [12, 'F-5', 4]],
  [[0, 'D-5', 8], [8, 'B-4', 8]],
];
const B = [
  [[0, 'C-6', 12], [12, 'D#6', 4]],
  [[0, 'D-6', 8], [8, 'F-6', 8]],
  [[0, 'D-6', 6], [6, 'A#5', 2], [8, 'G-5', 8]],
  [[0, 'G-5', 4], [4, 'C-6', 4], [8, 'D#6', 8]],
  [[0, 'F-6', 12], [12, 'D#6', 4]],
  [[0, 'D-6', 8], [8, 'A#5', 8]],
  [[0, 'G-5', 6], [6, 'A#5', 2], [8, 'D#6', 8]],
  [[0, 'D-6', 8], [8, 'B-5', 8]],
];
const A2 = [...A.slice(0, 7), [[0, 'C-5', 15]]];
const FORM = [
  { name: 'A', chords: ['Cm', 'Ab', 'Fm', 'G', 'Cm', 'Eb', 'Fm', 'G'], lead: A },
  { name: 'B', chords: ['Ab', 'Bb', 'Gm', 'Cm', 'Fm', 'Bb', 'Eb', 'G'], lead: B, level3: true },
  { name: "A'", chords: ['Cm', 'Ab', 'Fm', 'G', 'Cm', 'Eb', 'Fm', 'Cm'], lead: A2 },
];

const bass = {}, sup1 = {}, sup2 = {}, lead = {};
const TOTAL = FORM.reduce((n, sec) => n + sec.chords.length, 0) * BAR;
let bar0 = 0;
for (const sec of FORM) {
  sec.chords.forEach((c, b) => {
    const at = (bar0 + b) * BAR, [, t1, t2, t3] = CH[c], notes = sec.lead[b];
    // Bass: the root on 1 and 3, flat.
    for (const r of [0, 8]) place(bass, at + r, { note: root(c), instrument: S.bass, vol: 'v44' });
    // Support 1, on the beats: up the chord. In B it decays under the lead (level 3).
    [t1, t2, t3, t2].forEach((note, k) => {
      place(sup1, at + 4 * k, { note, instrument: S.mallet, vol: 'v30' });
      if (sec.level3) Object.entries(fade(at + 4 * k + 1, 2, 2.3, { ticks: TEL.speed })).forEach(([r, e]) => place(sup1, Number(r), e));
    });
    // Support 2, off the beats, an octave down: it rests while the lead moves (4 notes or more).
    if (notes.length < 4) {
      // staccato: two rows each, so an off-beat never rings into the next chord
      [t2, t3, t1, t3].forEach((note, k) => {
        place(sup2, at + 4 * k + 2, { note: ns(nn(note) - 12), instrument: S.tine, vol: 'v26' });
        if (at + 4 * k + 4 < TOTAL) place(sup2, at + 4 * k + 4, { note: '^^' });
      });
    }
    // Lead: flat, one-shot; in B the long notes get the late vibrato two rows in.
    notes.forEach(([r, note, rows]) => {
      place(lead, at + r, { note, instrument: S.lead, vol: 'v48' });
      if (sec.level3 && rows >= 8) Object.entries(held(at + r, rows, TEL.vibrato, { from: 2 })).forEach(([x, e]) => place(lead, Number(x), e));
    });
  });
  bar0 += sec.chords.length;
}

// The loop: the last row cuts every channel, so A starts clean.
const end = bar0 * BAR, channels = [bass, sup1, sup2, lead];
for (const ch of channels) if (!ch[end - 1]?.note) ch[end - 1] = { ...(ch[end - 1] ?? {}), note: '^^' };
['X40', 'XC0', 'XC0', 'X40'].forEach((p, c) => place(channels[c], [...Array(BAR).keys()].find((r) => !channels[c][r]?.fx), { fx: p }));

const names = ['A bars 1-4', 'A bars 5-8', 'B bars 1-4', 'B bars 5-8', "A' bars 1-4", "A' bars 5-8"];
const { patterns, order } = patternize(channels, { rows: 4 * BAR, names });

writeSong(import.meta.url, {
  title: 'Ashen Wing', bpm: 125, ticks: TEL.speed, mixvol: 64,
  message: "Ashen Wing: an original loop in the manner of Jeroen Tel's music for Agony.\n"
    + "C minor, speed 6, A / B / A'. Flat one-shot piano lines, no drums, a support line that\n"
    + 'rests while the lead moves; a late vibrato in B. Sound library presets only.\n'
    + 'Source: songs/amiga_ashen_wing.gen.js. Rendered and measured, not listened to.',
  samples: [
    { name: 'bass', synth: { preset: 'bass.pluck' } },
    { name: 'mallet', synth: { preset: 'keys.mallet' } },
    { name: 'tine', synth: { preset: 'keys.tine' } },
    { name: 'lead', synth: { preset: 'keys.tine' } },
  ],
  channelnames: { 0: 'bass', 1: 'support (beats)', 2: 'support (off-beats)', 3: 'lead' },
  patterns,
  order,
});
