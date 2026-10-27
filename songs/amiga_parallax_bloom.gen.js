#!/usr/bin/env node
/**
 * Parallax Bloom — an original demo-part loop for a scroller over layered starfields, written with
 * skills/amiga-masters in the manner of Jester's Sanity modules such as Elysium (1991)
 * (references/styles.md, "Jester"). Borrowed: his numbers and habits; the melody, harmony and
 * sounds are new (sound library presets).
 *
 * B minor, speed 6 at 125 BPM (Elysium's speed): a row is 0.12 s, 16 rows a bar. Intro 4 bars,
 * A 8, B 8, A' 8: about 54 s, looping to the intro.
 *
 * What makes it his (STYLE.jester, Elysium):
 *   - drums everywhere: the first channel interleaves kick and snare with a 16th mallet figure
 *     (Elysium's channel 0 is 60% drums), and the lead's channel plays open hats in the intro
 *     (his lead channel: 24% drums); a drum channel or drums on melodic channels in every tune;
 *   - an echo one row (6 ticks) behind: the second channel repeats the mallet figure a row later
 *     at half its level (Elysium echoes channel 0 on channel 1 six ticks later, on 90% of notes);
 *   - volume as the shaping tool: set volumes on the notes (his 32 per 100) and volume slides
 *     after them (his 19; Elysium 26): the bass and the lead's releases fall by D0y;
 *   - busy, about 16 notes a second over four channels (his median 20);
 *   - a light vibrato on the lead's long notes, H81 (8 ticks a cycle, depth 1, as his 48x).
 * Channels: 0 drums + mallet figure (left), 1 echo (right), 2 bass (right), 3 lead + hats (left).
 * This is a reasoned example: rendered and measured, not listened to.
 */
import { writeSong, nn, ns } from './lib.js';
import { echo, fade, held, place, patternize, STYLE } from './amiga-kit.js';

const J = STYLE.jester;
const BAR = 16, TICKS = 6;
const S = { kick: 0, snare: 1, hat: 2, mallet: 3, bass: 4, lead: 5 };

// chord: bass root (bass.pluck from C-3) and three tones for the mallet figure (C-5..C-6)
const CH = {
  Bm: ['B-2', 'D-5', 'F#5', 'B-5'], G: ['G-2', 'D-5', 'G-5', 'B-5'], D: ['D-3', 'D-5', 'F#5', 'A-5'],
  A: ['A-2', 'C#5', 'E-5', 'A-5'], Em: ['E-3', 'E-5', 'G-5', 'B-5'], 'F#': ['F#2', 'C#5', 'F#5', 'A#5'],
  'F#m': ['F#2', 'C#5', 'F#5', 'A-5'],
};
const root = (c) => (nn(CH[c][0]) < nn('C-3') ? ns(nn(CH[c][0]) + 12) : CH[c][0]);

const A = [
  [[0, 'F#5', 6], [6, 'D-5', 2], [8, 'B-4', 8]],
  [[0, 'D-5', 4], [4, 'G-5', 4], [8, 'B-5', 8]],
  [[0, 'A-5', 6], [6, 'F#5', 2], [8, 'D-5', 4], [12, 'F#5', 4]],
  [[0, 'E-5', 16]],
  [[0, 'B-5', 6], [6, 'D-6', 2], [8, 'F#5', 8]],
  [[0, 'G-5', 4], [4, 'B-5', 4], [8, 'D-6', 8]],
  [[0, 'E-6', 6], [6, 'D-6', 2], [8, 'B-5', 4], [12, 'G-5', 4]],
  [[0, 'F#5', 8], [8, 'A#5', 8]],
];
const B = [
  [[0, 'B-5', 8], [8, 'D-6', 8]],
  [[0, 'C#6', 8], [8, 'E-6', 8]],
  [[0, 'F#6', 12], [12, 'E-6', 4]],
  [[0, 'D-6', 16]],
  [[0, 'G-6', 8], [8, 'E-6', 8]],
  [[0, 'F#6', 8], [8, 'C#6', 8]],
  [[0, 'D-6', 8], [8, 'B-5', 8]],
  [[0, 'A#5', 8], [8, 'C#6', 8]],
];
const A2 = [...A.slice(0, 7), [[0, 'B-4', 15]]];
const FORM = [
  { name: 'intro', chords: ['Bm', 'G', 'D', 'A'], lead: null },
  { name: 'A', chords: ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'Em', 'F#'], lead: A },
  { name: 'B', chords: ['G', 'A', 'Bm', 'Bm', 'Em', 'F#m', 'G', 'F#'], lead: B },
  { name: "A'", chords: ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'Em', 'Bm'], lead: A2 },
];
const TOTAL = FORM.reduce((n, s) => n + s.chords.length, 0) * BAR;
const merge = (ch, events) => Object.entries(events).forEach(([r, e]) => place(ch, Number(r), e));

const drumArp = {}, figure = {}, bass = {}, lead = {};
let bar0 = 0;
for (const sec of FORM) {
  sec.chords.forEach((c, b) => {
    const at = (bar0 + b) * BAR, [, t1, t2, t3] = CH[c];
    // Channel 0: kick and snare on the beats, the mallet figure in the 16ths between them.
    for (const r of [0, 8]) place(drumArp, at + r, { note: 'C-5', instrument: S.kick, vol: 'v54' });
    for (const r of [4, 12]) place(drumArp, at + r, { note: 'C-5', instrument: S.snare, vol: 'v44' });
    [t1, t2, t3, t2, t1, t3, t2, t3].forEach((note, k) => {
      const r = [2, 3, 6, 7, 10, 11, 14, 15][k];
      const ev = { note, instrument: S.mallet, vol: `v${k % 2 ? 22 : 30}` };
      place(drumArp, at + r, ev);
      // the figure alone, for the echo; not the bar's last note, whose echo would sound the old
      // chord against the next bar's downbeat
      if (r < 15) place(figure, at + r, ev);
    });
    // Bass: 8ths on the root and its octave, each falling by a volume slide.
    for (let k = 0; k < 8; k++) {
      place(bass, at + 2 * k, { note: k % 4 === 3 ? ns(nn(root(c)) + 12) : root(c), instrument: S.bass, vol: `v${k % 2 ? 34 : 42}` });
      merge(bass, fade(at + 2 * k + 1, 1, 1.6, { ticks: TICKS }));
    }
    // Channel 3: open hats on the off-beats in the intro; the lead after it.
    if (!sec.lead) {
      for (const r of [2, 6, 10, 14]) place(lead, at + r, { note: 'C-5', instrument: S.hat, vol: 'v22' });
      return;
    }
    const notes = sec.lead[b];
    notes.forEach(([r, note, rows], k) => {
      const next = k + 1 < notes.length ? notes[k + 1][0] : BAR;
      place(lead, at + r, { note, instrument: S.lead, vol: 'v42' });
      if (rows >= 8) {
        merge(lead, held(at + r, rows - 3, J.vibrato, { from: 3 }));
        merge(lead, fade(at + r + rows - 3, 3, 1.6, { ticks: TICKS }));     // the release, sliding down
      } else if (rows >= 4) merge(lead, fade(at + r + rows - 2, 2, 1.6, { ticks: TICKS }));
      if (r + rows < next && at + r + rows < TOTAL) place(lead, at + r + rows, { note: '^^' });
    });
  });
  bar0 += sec.chords.length;
}
// Channel 1: the mallet figure again one row (6 ticks) later at half its level.
const echoCh = echo(figure, { delay: J.echo.delay, scale: J.echo.scale, rows: TOTAL });
// ...and silent on each downbeat, so no echo rings into the next chord
for (let at = BAR; at < TOTAL; at += BAR) if (!echoCh[at]) echoCh[at] = { note: '^^' };

const channels = [drumArp, echoCh, bass, lead];
for (const ch of channels) if (!ch[TOTAL - 1]?.note) ch[TOTAL - 1] = { ...(ch[TOTAL - 1] ?? {}), note: '^^' };
['X40', 'XC0', 'XC0', 'X40'].forEach((p, c) => place(channels[c], [...Array(BAR).keys()].find((r) => !channels[c][r]?.fx), { fx: p }));

const names = ['intro', 'A bars 1-4', 'A bars 5-8', 'B bars 1-4', 'B bars 5-8', "A' bars 1-4", "A' bars 5-8"];
const { patterns, order } = patternize(channels, { rows: 4 * BAR, names });

writeSong(import.meta.url, {
  title: 'Parallax Bloom', bpm: 125, ticks: TICKS, mixvol: 64,
  message: "Parallax Bloom: an original demo-part loop in the manner of Jester's Elysium (Sanity).\n"
    + "B minor, speed 6, intro / A / B / A'. Drums interleaved with a mallet figure, its echo a\n"
    + 'row behind, hats on the lead channel, volume slides. Sound library presets only.\n'
    + 'Source: songs/amiga_parallax_bloom.gen.js. Rendered and measured, not listened to.',
  samples: [
    { name: 'kick', synth: { preset: 'kick.punch' } },
    { name: 'snare', synth: { preset: 'snare.tight' } },
    { name: 'open hat', synth: { preset: 'hat.open', seconds: 0.3 } },
    { name: 'mallet', synth: { preset: 'keys.mallet' } },
    { name: 'bass', synth: { preset: 'bass.pluck' } },
    { name: 'lead', synth: { preset: 'lead.pwm' } },
  ],
  channelnames: { 0: 'drums + figure', 1: 'echo', 2: 'bass', 3: 'lead + hats' },
  patterns,
  order,
});
