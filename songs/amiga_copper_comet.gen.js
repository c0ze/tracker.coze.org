#!/usr/bin/env node
/**
 * Copper Comet — an original chase loop for a racer on a copper-plated track, written with
 * skills/amiga-masters in the manner of Rob Hubbard's Goldrunner (1987) on the Amiga
 * (references/styles.md, "Rob Hubbard"). Borrowed: his numbers and habits; the melody and
 * harmony are new, and the sounds are synthesized single cycles, as his early Amiga player's were.
 *
 * D minor, speed 3 at 125 BPM: a tick is 20 ms, a row 60 ms, 8 rows a beat, 32 rows a bar,
 * two bars a pattern. A 8 bars, B 8, A' 8: about 46 s, looping to A.
 *
 * What makes it his (STYLE.hubbard, Goldrunner):
 *   - no samples and no drums: four short waveforms (pulse 50% bass, thin 25% pulse lead, two
 *     triangles), a C64 tune on Paula;
 *   - the octave flicker on held chord notes, root and octave alternating every row (his 10% of
 *     notes, periods alternating every 1-2 ticks; a row here is 3);
 *   - vibrato from the first tick on the long notes: HB2 (±12 cents, 6 ticks a cycle) on the note
 *     row itself (his 27% of notes);
 *   - hard decays on everything else, about 4 volume steps a tick: D06 on every row after the
 *     note (86% of his notes decay at 4 a tick);
 *   - upward rips (his 14% of notes slide, 408 cents a tick): struck a fourth low, ripped to the
 *     note on the next row with GE0 (his go an octave; the MOD's shortest period stops that);
 *   - an octave-bouncing bass in 8ths, and in B a second voice a diatonic third under the lead,
 *     the C64 habit of harmony leads on two voices.
 * Channels: 0 bass (left), 1 lead (right), 2 octave flicker (right), 3 fifths / harmony (left).
 * This is a reasoned example: rendered and measured, not listened to.
 */
import { writeSong, nn, ns } from './lib.js';
import { envelope, fade, held, place, patternize, STYLE } from './amiga-kit.js';

const RH = STYLE.hubbard;
const TICKS = 3, BAR = 32, Q = 2;                  // a 16th is two rows
const S = { bass: 0, lead: 1, flick: 2, tri: 3 };

// chord: bass root (octave 2), the flicker's note (its third), the long fifth
const CH = {
  Dm: ['D-2', 'F-4', 'A-4'], Bb: ['A#1', 'D-4', 'F-4'], C: ['C-2', 'E-4', 'G-4'], Gm: ['G-1', 'A#3', 'D-4'],
  A: ['A-1', 'C#4', 'E-4'], F: ['F-1', 'A-3', 'C-4'],
};
const DMINOR = ['D-', 'E-', 'F-', 'G-', 'A-', 'A#', 'C-'];
/** the diatonic third below a note (C# counts as the raised seventh, a third above A) */
function thirdBelow(note) {
  const name = note.slice(0, 2) === 'C#' ? 'C-' : note.slice(0, 2);
  const i = DMINOR.indexOf(name), target = DMINOR[(i + 5) % 7];
  for (let n = nn(note) - 1; n > nn(note) - 6; n--) if (ns(n).slice(0, 2) === target) return ns(n);
  throw new Error(`no third below ${note}`);
}

// Lead per bar in 16ths: [position, note, length, { rise }]. rise: the note is struck a fourth
// low and ripped up to its pitch on the next row.
const A = [
  [[0, 'D-5', 2], [2, 'F-5', 2], [4, 'A-5', 4], [8, 'D-6', 2], [10, 'C-6', 2], [12, 'A-5', 2], [14, 'F-5', 2]],
  [[0, 'D-5', 6], [6, 'A-4', 2], [8, 'D-5', 2], [10, 'A-5', 2], [12, 'F-5', 4]],
  [[0, 'G-5', 4], [4, 'F-5', 2], [6, 'D-5', 2], [8, 'A#4', 4], [12, 'D-5', 4]],
  [[0, 'E-5', 8], [8, 'G-5', 4], [12, 'C-6', 4, { rise: true }]],
  [[0, 'D-6', 4], [4, 'C-6', 2], [6, 'A-5', 2], [8, 'F-5', 4], [12, 'A-5', 4]],
  [[0, 'D-6', 8], [8, 'E-6', 4], [12, 'F-6', 4]],
  [[0, 'G-6', 4], [4, 'F-6', 2], [6, 'D-6', 2], [8, 'A#5', 4], [12, 'G-5', 4]],
  [[0, 'A-5', 8], [8, 'C#6', 4], [12, 'E-6', 4]],
];
const B = [
  [[0, 'F-5', 2], [2, 'A-5', 2], [4, 'C-6', 2], [6, 'F-6', 2], [8, 'E-6', 4], [12, 'C-6', 4]],
  [[0, 'G-5', 2], [2, 'C-6', 2], [4, 'E-6', 2], [6, 'G-6', 2], [8, 'E-6', 4], [12, 'G-6', 4]],
  [[0, 'D-6', 8], [8, 'F-6', 4], [12, 'A-6', 4]],
  [[0, 'A#5', 8], [8, 'D-6', 8]],
  [[0, 'G-5', 4], [4, 'A#5', 4], [8, 'D-6', 4], [12, 'G-6', 4]],
  [[0, 'E-6', 8], [8, 'C-6', 4], [12, 'G-5', 4]],
  [[0, 'A-5', 4], [4, 'C#6', 4], [8, 'E-6', 4], [12, 'A-6', 4, { rise: true }]],
  [[0, 'A-6', 16]],
];
const A2 = [...A.slice(0, 6), [[0, 'E-5', 4], [4, 'C#5', 4], [8, 'A-4', 4], [12, 'C#5', 4]], [[0, 'D-5', 15]]];
const FORM = [
  { name: 'A', chords: ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Gm', 'A'], lead: A },
  { name: 'B', chords: ['F', 'C', 'Dm', 'Bb', 'Gm', 'C', 'A', 'A'], lead: B, harmony: true },
  { name: "A'", chords: ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'A', 'Dm'], lead: A2 },
];
const TOTAL = FORM.reduce((n, s) => n + s.chords.length, 0) * BAR;
const merge = (ch, events) => Object.entries(events).forEach(([r, e]) => place(ch, Number(r), e));

// A note in his manner: a long one (8 rows or more) sways from its first tick and holds, then
// releases; a short one decays at about 4 a tick. A rise is struck a fourth low (a chord tone
// under the target) and ripped up on the next row with GE0 (14 semitones a tick: there at the
// first slide tick). Tone portamento stops on the note exactly; an F slide would hold off pitch
// in the MOD, and an octave rip would run into Paula's shortest period.
function strike(ch, at, note, rows, instrument, vol, { rise = false, gap = true } = {}) {
  if (rise) {
    place(ch, at, { note: ns(nn(note) - 5), instrument, vol: `v${vol}` });
    place(ch, at + 1, { note, fx: 'GE0' });
    merge(ch, fade(at + 2, rows - 2, RH.fade, { ticks: TICKS }));
    if (gap && at + rows < TOTAL) place(ch, at + rows, { note: '^^' });
    return;
  }
  place(ch, at, { note, instrument, vol: `v${vol}` });
  if (rows >= 8) {
    merge(ch, held(at, rows - 2, RH.vibrato));
    merge(ch, envelope(at + rows - 2, [vol * 0.6, vol * 0.3]));
  } else {
    merge(ch, fade(at + 1, rows - 1, RH.fade, { ticks: TICKS }));
  }
  if (gap && at + rows < TOTAL) place(ch, at + rows, { note: '^^' });
}

const bass = {}, lead = {}, flick = {}, low = {};
let bar0 = 0;
for (const sec of FORM) {
  sec.chords.forEach((c, b) => {
    const at = (bar0 + b) * BAR, [root, third, fifth] = CH[c];
    // Bass: 8ths bouncing an octave, each decaying; the last two climb to the next bar.
    for (let k = 0; k < 8; k++) strike(bass, at + 4 * k, k % 2 ? ns(nn(root) + 12) : root, 4, S.bass, k % 2 ? 26 : 32, { gap: false });
    // Octave flicker: the chord's third, half a bar each, its octave on every other row. Written
    // as notes (a row, 3 ticks, a step) rather than J0C: an arpeggio over an octave shares one
    // ranged copy in the MOD, whose low note then aliases audibly (mod-check's image limit).
    for (const r of [0, 16]) {
      for (let k = 0; k < 12; k++) place(flick, at + r + k, k ? { note: k % 2 ? ns(nn(third) + 12) : third } : { note: third, instrument: S.flick, vol: 'v32' });
      merge(flick, envelope(at + r + 12, [18, 10]));
      place(flick, at + r + 14, { note: '^^' });
    }
    // Lead
    const notes = sec.lead[b];
    notes.forEach(([p, note, len, opt = {}], k) => {
      const next = k + 1 < notes.length ? notes[k + 1][0] : 16;
      strike(lead, at + p * Q, note, len * Q, S.lead, 52, { rise: opt.rise, gap: p + len < next });
      // B: the harmony a third below, softer, its rises too
      if (sec.harmony) strike(low, at + p * Q, thirdBelow(note), len * Q, S.tri, 34, { rise: opt.rise, gap: p + len < next });
    });
    // A: a long fifth under the lead, swaying from its first tick
    if (!sec.harmony) strike(low, at, fifth, BAR - 2, S.tri, 26);
  });
  bar0 += sec.chords.length;
}

const channels = [bass, lead, flick, low];
for (const ch of channels) if (!ch[TOTAL - 1]?.note) ch[TOTAL - 1] = { ...(ch[TOTAL - 1] ?? {}), note: '^^' };
['X40', 'XC0', 'XC0', 'X40'].forEach((p, c) => place(channels[c], [...Array(BAR).keys()].find((r) => !channels[c][r]?.fx), { fx: p }));

const names = [];
for (const s of ['A', 'B', "A'"]) for (let i = 1; i <= 8; i += 2) names.push(`${s} bars ${i}-${i + 1}`);
const { patterns, order } = patternize(channels, { rows: 2 * BAR, names });

writeSong(import.meta.url, {
  title: 'Copper Comet', bpm: 125, ticks: TICKS, mixvol: 64,
  message: "Copper Comet: an original chase loop in the manner of Rob Hubbard's Goldrunner (Amiga).\n"
    + "D minor, speed 3, A / B / A'. Single-cycle waves only: octave flicker, vibrato from the first\n"
    + 'tick, hard decays, octave rips, a harmony a third below in B. No samples, no drums.\n'
    + 'Source: songs/amiga_copper_comet.gen.js. Rendered and measured, not listened to.',
  samples: [
    { name: 'pulse bass', synth: { wave: 'square', pulse: 0.5, cycle: 64 } },
    { name: 'thin pulse', synth: { wave: 'square', pulse: 0.25, cycle: 32 } },
    { name: 'flicker', synth: { wave: 'triangle', cycle: 32 } },
    { name: 'triangle', synth: { wave: 'triangle', cycle: 64 } },
  ],
  channelnames: { 0: 'bass', 1: 'lead', 2: 'octave flicker', 3: 'fifths / harmony' },
  patterns,
  order,
});
