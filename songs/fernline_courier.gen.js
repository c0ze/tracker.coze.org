#!/usr/bin/env node
/**
 * Fernline Courier — melodic jungle / breakbeat example for skills/jungle.
 * Small parcels crossing a wet canopy by cable railway.
 *
 * G minor (aeolian, with one dorian bar), 164 BPM, speed 3:
 * 8 rows/beat, 32 rows/bar, one 64-row pattern = two bars = 2.93 s.
 * A row is a 32nd note (45.7 ms); a 16th step is 2 rows.
 * Form: Intro 4 / A 8 / space 4 / B 8 / A' 8 bars = 16 patterns, about 47 s.
 *
 * Channels: kick, main snare, ghost snare, hats/shaker, bass, pad low, pad high,
 * mallet hook. Every pattern is one chord and one two-bar break. Breaks are
 * built from bar-level cells (one 16-step string per drum lane) and only one
 * cell changes from one break to the next inside a section.
 * Explicit notes only: no Qxy retriggers, Oxx offsets or SDx delays.
 * This is a reasoned example; it has not been listened to.
 */
import { writeSong } from './lib.js';

const ROWS = 64;
const S = {
  kick: 0, snare: 1, ghost: 2, hatC: 3, hatO: 4, shaker: 5,
  bass: 6, pad: 7, mallet: 8,
};
const CH = { kick: 0, snare: 1, ghost: 2, hats: 3, bass: 4, padLo: 5, padHi: 6, mallet: 7 };
const PAN = { kick: 'X80', snare: 'X70', ghost: 'X98', hats: 'XB0', bass: 'X80', padLo: 'X50', padHi: 'XB0', mallet: 'X68' };

// ------------------------------------------------------------------ break cells
// One bar per cell. Each lane is 16 sixteenth steps (2 rows each) or 32 rows,
// grouped by beat. The letter sets the hit's weight; the lane sets the sample.
//   kick:  K main v56, k displaced/soft v38
//   snare: S backbeat v54, s pickup v42
//   ghost: G v26, g v19, h v12  (ghosts sit 9-13 dB under the backbeat)
const HIT = {
  k: { K: 56, k: 38 },
  s: { S: 54, s: 42 },
  g: { G: 26, g: 19, h: 12 },
};
const CELL = {
  NONE:    { k: '', s: '', g: '' },
  // A section
  HOME:    { k: 'K... .... ..K. ....', s: '.... S... .... S...', g: '..g. ...g .g.. ..g.' },
  HOME2:   { k: 'K..k .... ..K. ....', s: '.... S... .... S...', g: '.g.. ..g. .g.. ..gg' },
  REPLY1:  { k: 'K... ..K. .... ....', s: '.... S... .... S..s', g: '.g.. .... g..g .g..' },
  // 32-row lane: the last beat ends in a four-32nd ghost drag that crescendos into the bar line.
  REPLY2:  { k: 'K... ..K. ..k. ....', s: '.... S... .... S...', g: '..g..... ........ g....... ....hgGG' },
  // A' only: the last beat turns into three ghost 16ths instead of a rest.
  REPLY3:  { k: 'K... ...K ..k. ....', s: '.... S... .... S...', g: '.g.. .g.. g... .gGg' },
  // Early backbeat on step 11, then an empty last beat: the exhale into the space section.
  EXHALE:  { k: 'K... .... ..K. ....', s: '.... S... ...S ....', g: '.g.. ..g. g... ....' },
  // Loop seam: no beat-4 backbeat, so the drums stop before the intro's drumless bar.
  END:     { k: 'K... ..K. .... ....', s: '', g: '.g.. .... g.g. ....' },
  // Intro: the kick skeleton and very soft ghosts; the first backbeat is a pickup.
  IN1:     { k: 'K... .... ..K. ....', s: '', g: '..h. ...h .h.. ..h.' },
  IN2:     { k: 'K... ..K. .... ....', s: '.... .... .... ..sS', g: '.h.. .... h... ....' },
  // Space: main snare removed, kick + ghost skeleton kept (open hats mark 2 and 4);
  // only each bar's downbeat kick keeps full weight.
  SP1:     { k: 'K... .... ..k. ....', s: '', g: '..h. ...g .h.. ..g.' },
  SP2:     { k: 'K... ..k. .... ....', s: '', g: '.h.. .... g..h .g..' },
  SPLIFT:  { k: 'K... ..k. .... ....', s: '', g: '.h...... ........ g....... h.g.g.GG' },
  // B section: more displaced kicks, same backbeat.
  B_HOME:  { k: 'K... ...k ..K. ....', s: '.... S... .... S...', g: '..g. .g.. ...g ..g.' },
  B_HOME2: { k: 'K... ...k .... ..k.', s: '.... S... .... S...', g: '..g. .g.. g..g ....' },
  B_REP1:  { k: 'K.K. .... ..k. ....', s: '.... S... .... S...', g: '.g.. ..g. g... .gg.' },
  B_REP2:  { k: 'K... ..K. ...K ....', s: '.... S... .... S..s', g: '.g.. ...g .g.. .g..' },
  B_FILL:  { k: 'K... .... ..K. ....', s: '.... S... .... S.S.', g: '.g.. ..g. .gG. ...G' },
};
// Hats/shaker lane: c closed v20, C closed v26, o open v18 (choked by the next hit), S shaker v14, s shaker v9.
const HAT = { c: [S.hatC, 20], C: [S.hatC, 26], o: [S.hatO, 18], S: [S.shaker, 14], s: [S.shaker, 9] };
const HATS = {
  none:  '',
  intro: 'S.s. S.s. S.s. S.s.',
  main:  'Sscs Sscs Sscs Sscs',
  turn:  'Sscs Sscs Sscs Ssos',
  space: 'S.s. o.s. S.s. o.s.',
  b:     'S.cs S.c. S.cs S.c.',
  bTurn: 'S.cs S.c. S.cs S.o.',
  rest:  'Sscs Sscs S.c. ....',
};

function lane(str) {
  const s = str.replace(/[\s|]/g, '');
  if (!s) return [];
  if (s.length !== 16 && s.length !== 32) throw new Error(`Lane must be 16 steps or 32 rows: "${str}"`);
  const step = 32 / s.length;
  return [...s].map((c, i) => [i * step, c]).filter(([, c]) => c !== '.');
}
function place(ch, row, ev) {
  if (!Number.isInteger(row) || row < 0 || row >= ROWS || ch[row]) throw new Error(`Event collision/outside pattern at row ${row}`);
  ch[row] = ev;
}
function drums([bar1, bar2], [hats1, hats2]) {
  const out = { kick: {}, snare: {}, ghost: {}, hats: {} };
  const lanes = [['k', 'kick', S.kick], ['s', 'snare', S.snare], ['g', 'ghost', S.ghost]];
  [bar1, bar2].forEach((cell, bar) => {
    for (const [key, chName, sample] of lanes) {
      for (const [row, c] of lane(CELL[cell][key] ?? '')) {
        const vol = HIT[key][c];
        if (vol === undefined) throw new Error(`Unknown ${key} hit "${c}" in ${cell}`);
        place(out[chName], bar * 32 + row, { note: 'C-5', instrument: sample, vol: `v${vol}` });
      }
    }
  });
  [hats1, hats2].forEach((pattern, bar) => {
    for (const [row, c] of lane(HATS[pattern])) {
      const [sample, vol] = HAT[c];
      place(out.hats, bar * 32 + row, { note: 'C-5', instrument: sample, vol: `v${vol}` });
    }
  });
  return out;
}

// ------------------------------------------------------------------ harmony
// The bass is bass.round (harmonics 2-4 strong). Roots: G-3 98 Hz, D#3 78 Hz,
// D-3 73 Hz, F-3 87 Hz, C-3 65 Hz: below ~100 Hz a phone speaker hears the
// 2nd-4th harmonics (130-390 Hz), which this preset has.
// Pads: two guide tones per chord, one per channel, voice-led by steps.
const CHORD = {
  Gm:   { root: 'G-3', low: 'D-3', pads: ['A#4', 'D-5'] },  // Gm (F-5 sat a step under the answer's G-5)
  Gm6:  { root: 'G-3', low: 'D-3', pads: ['A-4', 'E-5'] },  // Gm6/9, the dorian bar
  Eb:   { root: 'D#3', low: 'A#3', pads: ['G-4', 'D-5'] },  // Ebmaj7
  Cm:   { root: 'C-3', low: 'G-3', pads: ['A#4', 'D#5'] },  // Cm7
  D:    { root: 'D-3', low: 'A-3', pads: ['C-5', 'F#5'] },  // D7
  F:    { root: 'F-3', low: 'C-4', pads: ['A-4', 'C-5'] },  // F
};

// A looping cycle needs a written shape: accent, held level, release, ^^.
function bassLine(notes) {
  const ch = {};
  for (const [row, note, len, vol] of notes) {
    if (!Number.isInteger(len) || len < 3) throw new Error('Bass notes need at least three rows');
    place(ch, row, { note, instrument: S.bass, vol: `v${vol}` });
    place(ch, row + 1, { vol: `v${Math.round(vol * 0.75)}` });
    if (len > 5) place(ch, row + len - 2, { vol: `v${Math.round(vol * 0.4)}` });
    if (row + len < ROWS) place(ch, row + len, { note: '^^' });
  }
  return ch;
}
// Root on the downbeat, the low note with the beat-3 kick, the root again with
// bar 2's displaced kick, then a short approach into the next chord. The first
// half of bar 2 (and its downbeat) is left empty on purpose.
function bassA(chord, approach, v = 46) {
  const c = CHORD[chord];
  const notes = [[0, c.root, 12, v], [20, c.low, 6, v - 8], [44, c.root, 10, v - 4]];
  if (approach) notes.push([58, approach, 4, v - 10]);
  return bassLine(notes);
}

// Pads change chords by dip and retrigger (not a true cross-fade): each pattern's note
// replaces the loop at the level the previous one ended on, so there is no gap to click.
function pad(note, level, { fadeIn = false, end = false } = {}) {
  const ch = {};
  const shape = fadeIn
    ? [[0, 3], [4, 6], [8, 9], [12, 12], [16, level]]
    : [[0, Math.round(level * 0.55)], [2, Math.round(level * 0.8)], [4, level]];
  shape.forEach(([r, v], i) => place(ch, r, i === 0 ? { note, instrument: S.pad, vol: `v${v}` } : { vol: `v${v}` }));
  const tail = end
    ? [[48, Math.round(level * 0.7)], [54, Math.round(level * 0.4)], [58, 4], [62, '^^']]
    : [[50, Math.round(level * 0.8)], [56, Math.round(level * 0.65)], [60, Math.round(level * 0.55)]];
  // A slow written swell keeps the held loop alive (and attended) between attack and release.
  if (!fadeIn) { place(ch, 20, { vol: `v${level + 2}` }); place(ch, 36, { vol: `v${level}` }); }
  else { place(ch, 28, { vol: `v${level + 1}` }); place(ch, 42, { vol: `v${level + 2}` }); }
  for (const [r, v] of tail) place(ch, r, v === '^^' ? { note: '^^' } : { vol: `v${v}` });
  return ch;
}

// ------------------------------------------------------------------ the hook
// keys.mallet is a shot: it decays by itself, so a "long" note is a rest after
// the strike. Motif: D-F-D in a 3+2+3 sixteenth rhythm, then a longer C.
// Answer: rest, then a fall through A#5 to G-5. [row, note, vol]
const HOOK = {
  in1: [[38, 'D-6', 22], [44, 'F-6', 19], [48, 'D-6', 22]],           // fragment, no C yet
  in2: [[38, 'D-6', 26], [44, 'F-6', 22], [48, 'D-6', 26]],
  A1: [[0, 'D-6', 40], [6, 'F-6', 35], [10, 'D-6', 38], [16, 'C-6', 42],
       [38, 'A#5', 34], [44, 'A-5', 31], [48, 'G-5', 38]],             // question, tonic answer
  A2: [[0, 'D-6', 40], [6, 'F-6', 35], [10, 'D-6', 38], [16, 'C-6', 42],
       [38, 'D-6', 34], [44, 'C-6', 31], [48, 'A#5', 38]],             // same question, answer stops on Eb's 5th
  A3: [[0, 'D#6', 40], [6, 'G-6', 35], [10, 'D#6', 38], [16, 'D-6', 42],
       [38, 'C-6', 34], [44, 'A#5', 31], [48, 'G-5', 38]],             // motif shape a step higher
  A4: [[0, 'D-6', 40], [6, 'C-6', 35], [10, 'A-5', 40]],              // falls, open on D's 5th; bar 2 is the break
  S1: [[38, 'A#5', 24], [44, 'A-5', 21], [48, 'G-5', 26]],            // answer only, far away
  S2: [[0, 'D-6', 26], [6, 'E-6', 23], [10, 'D-6', 26]],             // motif with the dorian E
  // B: long-short-long, lower and slower; the contrast is rhythm and harmony.
  B1: [[0, 'G-5', 36], [12, 'A#5', 29], [16, 'D-6', 38], [40, 'C-6', 32], [48, 'A#5', 36]],
  B2: [[0, 'A-5', 36], [12, 'C-6', 29], [16, 'F-6', 40], [40, 'D#6', 32], [48, 'D-6', 36]],
  B3: [[0, 'D#6', 38], [12, 'D-6', 29], [16, 'C-6', 36], [40, 'A#5', 32], [48, 'G-5', 36]],
  B4: [[0, 'F#5', 34], [12, 'A-5', 29], [16, 'C-6', 36], [40, 'A-5', 26]],
  // A': the return keeps the first question, then changes its answers.
  R2: [[0, 'D-6', 40], [6, 'F-6', 35], [10, 'D-6', 38], [16, 'C-6', 42],
       [38, 'A#5', 33], [44, 'D-6', 35], [48, 'F-6', 40]],             // answer rises instead of falling
  R3: [[0, 'F-6', 42], [6, 'G-6', 38], [10, 'F-6', 40], [16, 'D#6', 44],
       [38, 'D-6', 35], [44, 'C-6', 32], [48, 'G-5', 38]],             // the song's peak
  R4: [[0, 'D-6', 40], [6, 'C-6', 35], [10, 'A-5', 36], [16, 'F#5', 40]], // ends on the leading tone; loops to Gm
};
// Revision 1: at C-6 the mallet's fundamental falls ~20 dB within one beat, so a
// "long" target sounded as short as the 16ths around it and sat ~4 dB under the
// snare's peak. Foreground hooks now play 1.3x louder and roll each target held
// 8+ rows with three soft 16th re-strikes (a marimba roll), then let it ring.
const HOOK_GAIN = 1.3;
const ROLL = [0.42, 0.34, 0.26];
function mallet(events, { roll = true } = {}) {
  const ch = {};
  events.forEach(([row, note, vol], i) => {
    const v = Math.min(64, Math.round(vol * HOOK_GAIN));
    const hold = (events[i + 1]?.[0] ?? ROWS) - row;
    place(ch, row, { note, instrument: S.mallet, vol: `v${v}` });
    if (roll && hold >= 8) ROLL.forEach((k, j) => place(ch, row + 2 * (j + 1), { note, instrument: S.mallet, vol: `v${Math.round(v * k)}` }));
  });
  return ch;
}

// ------------------------------------------------------------------ patterns
function pattern(name, spec) {
  const d = drums(spec.cells, spec.hats ?? ['main', 'turn']);
  const c = CHORD[spec.chord];
  const padLevel = spec.padLevel ?? 18;
  const channels = [
    d.kick, d.snare, d.ghost, d.hats,
    spec.bass ?? {},
    pad(c.pads[0], padLevel, spec.padOpts),
    pad(c.pads[1], padLevel - 3, spec.padOpts),
    mallet(HOOK[spec.hook] ?? [], { roll: !spec.distant }),
  ];
  // Every pattern sets its own pan, so any entry point sounds the same.
  Object.entries(CH).forEach(([key, i]) => {
    const ch = channels[i];
    ch[0] = ch[0] ? { ...ch[0], fx: ch[0].fx ?? PAN[key] } : { fx: PAN[key] };
  });
  return { name, rows: ROWS, channels };
}

const patterns = [
  // Intro: pads alone, then the kick skeleton; the hook is only hinted (no C).
  pattern('Intro 1 - canopy', { chord: 'Gm', cells: ['NONE', 'NONE'], hats: ['none', 'intro'], hook: 'in1', distant: true, padOpts: { fadeIn: true } }),
  pattern('Intro 2 - cable hum', { chord: 'Gm', cells: ['IN1', 'IN2'], hats: ['intro', 'main'], hook: 'in2', distant: true,
    bass: bassLine([[0, 'G-3', 14, 40], [44, 'G-3', 8, 38], [58, 'D-3', 4, 34]]) }),
  // A: Gm | Eb | Cm | D, one cell changes per break.
  pattern('A1 - question', { chord: 'Gm', cells: ['HOME', 'REPLY1'], hook: 'A1', bass: bassA('Gm', 'F-3') }),
  pattern('A2 - same question', { chord: 'Eb', cells: ['HOME', 'REPLY2'], hook: 'A2', bass: bassA('Eb', 'D-3') }),
  pattern('A3 - step up', { chord: 'Cm', cells: ['HOME2', 'REPLY2'], hook: 'A3', bass: bassA('Cm', 'C#3') }),
  pattern('A4 - open on D', { chord: 'D', cells: ['HOME2', 'EXHALE'], hats: ['main', 'rest'], hook: 'A4', bass: bassA('D', 'F#3') }),
  // Space: no main snare. Kick and ghost skeleton, open hats on 2 and 4, louder pads.
  pattern('Space 1', { chord: 'Gm', cells: ['SP1', 'SP2'], hats: ['space', 'space'], hook: 'S1', distant: true, padLevel: 22,
    bass: bassLine([[0, 'G-3', 20, 42]]) }),
  pattern('Space 2 - dorian', { chord: 'Gm6', cells: ['SP1', 'SPLIFT'], hats: ['space', 'space'], hook: 'S2', distant: true, padLevel: 22,
    bass: bassLine([[0, 'G-3', 16, 40], [56, 'F-3', 6, 36]]) }),
  // B: Eb | F | Cm | D, lyrical mallet, more displaced kicks.
  pattern('B1', { chord: 'Eb', cells: ['B_HOME', 'B_REP1'], hats: ['b', 'bTurn'], hook: 'B1', bass: bassA('Eb', 'E-3') }),
  pattern('B2', { chord: 'F', cells: ['B_HOME', 'B_REP2'], hats: ['b', 'bTurn'], hook: 'B2', bass: bassA('F', 'D-3') }),
  pattern('B3', { chord: 'Cm', cells: ['B_HOME2', 'B_REP2'], hats: ['b', 'bTurn'], hook: 'B3', bass: bassA('Cm', 'C#3') }),
  pattern('B4 - fill', { chord: 'D', cells: ['B_HOME2', 'B_FILL'], hats: ['b', 'main'], hook: 'B4', bass: bassA('D', 'F#3') }),
  // A': the first question returns verbatim; answers change; the peak is R3.
  pattern("A'1 - return", { chord: 'Gm', cells: ['HOME', 'REPLY1'], hook: 'A1', bass: bassA('Gm', 'F-3') }),
  pattern("A'2 - rising answer", { chord: 'Eb', cells: ['HOME', 'REPLY3'], hook: 'R2', bass: bassA('Eb', 'D-3') }),
  pattern("A'3 - peak", { chord: 'Cm', cells: ['HOME2', 'REPLY3'], hook: 'R3', bass: bassA('Cm', 'C#3') }),
  pattern("A'4 - leading tone", { chord: 'D', cells: ['HOME2', 'END'], hats: ['main', 'rest'], hook: 'R4', padOpts: { end: true },
    bass: bassLine([[0, 'D-3', 12, 46], [20, 'A-3', 6, 38], [44, 'D-3', 14, 42]]) }),
];

writeSong(import.meta.url, {
  title: 'Fernline Courier', bpm: 164, ticks: 3, mixvol: 56,
  message: [
    'Fernline Courier: parcels crossing a wet canopy by cable railway.',
    'Melodic jungle in G minor, 164 BPM, speed 3 (8 rows/beat, 32 rows/bar).',
    'Intro 4 / A 8 / space 4 / B 8 / A\' 8 bars. All sounds synthesized.',
    'Source: songs/fernline_courier.gen.js. Not yet auditioned by ear.',
  ].join('\n'),
  samples: [
    { name: 'kick', role: 'percussion', synth: { preset: 'kick.punch' } },
    { name: 'snare', role: 'percussion', synth: { preset: 'snare.tight' } },
    // Ghost: same family, lighter body, less crack, shorter; a different noise seed.
    { name: 'ghost snare', role: 'percussion', synth: { preset: 'snare.tight', seed: 9, tone: 228, seconds: 0.11, noise: 0.75, noiseDecay: 26, snap: 0.2, drive: 1.2 } },
    { name: 'hat closed', role: 'percussion', synth: { preset: 'hat.closed' } },
    { name: 'hat open', role: 'percussion', synth: { preset: 'hat.open' } },
    { name: 'shaker', role: 'percussion', synth: { preset: 'shaker' } },
    { name: 'bass', synth: { preset: 'bass.round' } },
    { name: 'pad', synth: { preset: 'pad.warm' } },
    { name: 'mallet', synth: { preset: 'keys.mallet' } },
  ],
  channelnames: { 0: 'kick', 1: 'snare', 2: 'ghosts', 3: 'hats', 4: 'bass', 5: 'pad low', 6: 'pad high', 7: 'mallet' },
  patterns,
  order: patterns.map((_, i) => i),
});
