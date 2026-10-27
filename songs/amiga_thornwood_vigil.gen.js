#!/usr/bin/env node
/**
 * Thornwood Vigil — an original night-forest loop for four Paula channels, written with
 * skills/amiga-masters in the manner of David Whittaker's Shadow of the Beast (1989)
 * (references/styles.md, "David Whittaker"). Borrowed: his numbers and habits, measured from
 * the corpus; the melody, harmony and sounds are new (sound library presets).
 *
 * E minor, speed 5 at 125 BPM: a row is 0.1 s, 16 rows a bar, four bars a pattern; Beast's
 * title runs 5 ticks a row. Intro 4 bars, A 8, B 8, A' 8: about 45 s, looping to the intro.
 *
 * What makes it his (STYLE.whittaker):
 *   - no drums at all: the bass's half-bar pulse and the bells' quarters keep time;
 *   - vibrato from the very first tick, shallow and quick: H83 (±18 cents, 8 ticks a cycle) on
 *     the note row of every long note, held with H00 (Beast's title: 42% of notes);
 *   - per-tick decays on the bass and bells, about 0.8 a tick: D01 on every row of the note
 *     (fade), as his player lowers the volume each frame;
 *   - two support channels that interlock (bell quarters, pad halves), and in B the pad
 *     channel becomes an echo of the lead two rows (10 ticks) behind, as Beast's fifth tune
 *     echoes channel 2 on channel 1 twelve ticks later.
 * Channels: 0 bass (left), 1 bells (right), 2 pad / echo (right), 3 choir lead (left).
 * MOD discipline: notes that carry an effect are written at their sample's usual volume, so
 * the MOD keeps the effect (tools/json2mod.js: one command per cell).
 * This is a reasoned example: rendered and measured, not listened to.
 */
import { writeSong, nn, ns } from './lib.js';
import { fade, held, place, patternize, STYLE } from './amiga-kit.js';

const W = STYLE.whittaker;                         // speed 5, H83 from tick 0, fade about 1
const BAR = 16, TICKS = W.speed;
const S = { bass: 0, bell: 1, pad: 2, choir: 3 };

// Chords: bass root, and three tones in the bells' octave (C-5..C-6).
const CH = {
  Em: ['E-3', 'E-5', 'G-5', 'B-5'], C: ['C-3', 'E-5', 'G-5', 'C-6'], Am: ['A-3', 'E-5', 'A-5', 'C-6'],
  B: ['B-3', 'D#5', 'F#5', 'B-5'], D: ['D-3', 'D-5', 'F#5', 'A-5'], G: ['G-3', 'D-5', 'G-5', 'B-5'],
  'D/F#': ['F#3', 'D-5', 'F#5', 'A-5'], Bsus4: ['B-3', 'E-5', 'F#5', 'B-5'],
};
// bass roots below E-3 sit an octave up (bass.round reads well from D-3)
const root = (c) => (nn(CH[c][0]) < nn('D-3') ? ns(nn(CH[c][0]) + 12) : CH[c][0]);

// Lead per bar: [row, note, rows]. A question in E minor that climbs to the dominant's D#.
const A = [
  [[0, 'B-4', 6], [6, 'C-5', 2], [8, 'B-4', 4], [12, 'G-4', 4]],
  [[0, 'E-5', 10], [10, 'D-5', 2], [12, 'C-5', 4]],
  [[0, 'E-5', 6], [6, 'C-5', 2], [8, 'A-4', 4], [12, 'C-5', 4]],
  [[0, 'D#5', 12], [12, 'F#5', 4]],
  [[0, 'G-5', 6], [6, 'F#5', 2], [8, 'E-5', 4], [12, 'B-4', 4]],
  [[0, 'C-5', 4], [4, 'E-5', 4], [8, 'G-5', 8]],
  [[0, 'F#5', 6], [6, 'E-5', 2], [8, 'D-5', 4], [12, 'A-4', 4]],
  [[0, 'B-4', 16]],
];
// B: the relative major, higher; the Bsus4 holds E over the bass before it falls to D#.
const B = [
  [[0, 'D-5', 4], [4, 'G-5', 8], [12, 'F#5', 4]],
  [[0, 'A-5', 10], [10, 'F#5', 2], [12, 'D-5', 4]],
  [[0, 'G-5', 6], [6, 'E-5', 2], [8, 'B-4', 8]],
  [[0, 'C-5', 4], [4, 'E-5', 4], [8, 'G-5', 4], [12, 'A-5', 4]],
  [[0, 'C-6', 12], [12, 'E-5', 4]],
  [[0, 'A-5', 6], [6, 'F#5', 2], [8, 'D-5', 8]],
  [[0, 'E-5', 8], [8, 'D#5', 8]],
  [[0, 'F#5', 8], [8, 'D#5', 4], [12, 'F#5', 4]],
];
// A' keeps six bars, then closes on the tonic instead of the open dominant.
const A2 = [...A.slice(0, 6), [[0, 'F#5', 6], [6, 'D#5', 2], [8, 'B-4', 8]], [[0, 'E-5', 14]]];

const FORM = [
  { name: 'intro', chords: ['Em', 'Em', 'C', 'B'], lead: null },
  { name: 'A', chords: ['Em', 'C', 'Am', 'B', 'Em', 'C', 'D', 'B'], lead: A },
  { name: 'B', chords: ['G', 'D/F#', 'Em', 'C', 'Am', 'D', 'Bsus4', 'B'], lead: B, echo: true },
  { name: "A'", chords: ['Em', 'C', 'Am', 'B', 'Em', 'C', 'B', 'Em'], lead: A2 },
];

const bass = {}, bell = {}, pad = {}, lead = {};
const v = (n) => `v${Math.round(n)}`;

// A held lead note: the choir at its usual v48 with H83 from the note row when it is long
// (6 rows or more), H00 after it, a two-step release, and a cut if a rest follows.
function choirNote(ch, at, note, rows, gapAfter, { instrument = S.choir, vol = 48 } = {}) {
  place(ch, at, { note, instrument, vol: v(vol) });
  const sway = rows >= 6;
  if (sway) Object.entries(held(at, rows - 2, W.vibrato)).forEach(([r, e]) => place(ch, Number(r), e));
  else if (rows > 1) place(ch, at + 1, { vol: v(vol * 0.85) });
  if (rows >= 4) { place(ch, at + rows - 2, { vol: v(vol * 0.6) }); place(ch, at + rows - 1, { vol: v(vol * 0.3) }); }
  if (gapAfter) place(ch, at + rows, { note: '^^' });
}

let bar0 = 0;
for (const sec of FORM) {
  sec.chords.forEach((c, b) => {
    const at = (bar0 + b) * BAR, [, t1, t2, t3] = CH[c];
    // Bass: the root on beats 1 and 3, decaying every tick, cut a row before the next.
    for (const r of [0, 8]) {
      place(bass, at + r, { note: root(c), instrument: S.bass, vol: 'v38' });
      Object.entries(fade(at + r + 1, 6, 0.8, { ticks: TICKS })).forEach(([row, e]) => place(bass, Number(row), e));
      place(bass, at + r + 7, { note: '^^' });
    }
    // Bells: quarters through the chord, softer off the beat; a shot that rings, faded per tick.
    [t1, t3, t2, t3].forEach((note, k) => {
      place(bell, at + k * 4, { note, instrument: S.bell, vol: v(k % 2 ? 22 : 28) });
      Object.entries(fade(at + k * 4 + 1, 3, 0.8, { ticks: TICKS })).forEach(([row, e]) => place(bell, Number(row), e));
    });
    // Pad: the chord's third, an octave down, in halves, swaying from the first tick (from bar 3).
    if (!sec.echo && !(sec.name === 'intro' && b < 2)) {
      for (const r of [0, 8]) choirNote(pad, at + r, ns(nn(t2) - 12), 8, false, { instrument: S.pad, vol: 24 });
    }
    // Lead
    if (sec.lead) {
      const notes = sec.lead[b];
      notes.forEach(([r, note, rows], k) => {
        const next = k + 1 < notes.length ? notes[k + 1][0] : BAR;
        choirNote(lead, at + r, note, rows, r + rows < next);
      });
    }
  });
  // B: the pad channel echoes the lead two rows behind, at less than half its level: each
  // echoed note re-strikes the lead's pitch and is cut when the lead moves on, so the echo
  // never holds a step against the next note.
  if (sec.echo) {
    const start = bar0 * BAR, end = start + sec.chords.length * BAR;
    const onsets = Object.keys(lead).map(Number).filter((r) => r >= start && r < end && lead[r].note && lead[r].note !== '^^').sort((a, b) => a - b);
    onsets.forEach((r, k) => {
      const stop = Math.min(onsets[k + 1] ?? end, end - 1);
      if (r + 2 >= stop) return;
      // the echo's note row carries its own (lower) volume, which a MOD cell cannot hold with
      // an effect: its vibrato starts a row later, where the lead has H00
      let carry = null;
      for (let row = r; row < stop - 2; row++) {
        const e = lead[row];
        if (!e) continue;
        const out = { ...e };
        if (out.note === '^^') continue;
        if (out.instrument !== undefined) out.instrument = S.choir;
        if (out.vol) out.vol = v(Number(out.vol.slice(1)) * 0.45);
        if (out.note && out.fx) { carry = out.fx; delete out.fx; } else if (carry && out.fx === 'H00') { out.fx = carry; carry = null; }
        place(pad, row + 2, out);
      }
      place(pad, stop, { note: '^^' });
    });
  }
  bar0 += sec.chords.length;
}

// The loop: every channel stops on the last row, so the intro starts clean.
const last = bar0 * BAR - 1;
for (const ch of [bass, bell, pad, lead]) if (!ch[last]?.note) ch[last] = { note: '^^' };
// Paula's sides, previewed at half width in the IT (the MOD drops these: Paula's sides are fixed).
const channels = [bass, bell, pad, lead];
['X40', 'XC0', 'XC0', 'X40'].forEach((p, c) => place(channels[c], [...Array(BAR).keys()].find((r) => !channels[c][r]?.fx), { fx: p }));

const names = ['intro', 'A bars 1-4', 'A bars 5-8', 'B bars 1-4', 'B bars 5-8', "A' bars 1-4", "A' bars 5-8"];
const { patterns, order } = patternize(channels, { rows: 4 * BAR, names });

writeSong(import.meta.url, {
  title: 'Thornwood Vigil', bpm: 125, ticks: TICKS, mixvol: 64,
  message: 'Thornwood Vigil: an original night-forest loop in the manner of David Whittaker\n'
    + "(Shadow of the Beast). E minor, speed 5, intro / A / B / A'. No drums; vibrato from the\n"
    + 'first tick; per-tick decays; an echo channel in B. Sound library presets only.\n'
    + 'Source: songs/amiga_thornwood_vigil.gen.js. Rendered and measured, not listened to.',
  samples: [
    { name: 'bass', synth: { preset: 'bass.round' } },
    { name: 'bell', synth: { preset: 'bell.clear' } },
    { name: 'pad', synth: { preset: 'pad.warm' } },
    { name: 'choir', synth: { preset: 'pad.vowel' } },
  ],
  channelnames: { 0: 'bass', 1: 'bells', 2: 'pad / echo', 3: 'choir' },
  patterns,
  order,
});
