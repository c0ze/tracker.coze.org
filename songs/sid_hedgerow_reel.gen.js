#!/usr/bin/env node
/**
 * Hedgerow Reel (SID) — a bright folk dance in D major, in the manner of Ben Daglish's 1986-87
 * game tunes (skills/sid-music/references/styles.md, "Ben Daglish"). Original melody; only his
 * sound and arrangement habits are borrowed.
 *
 * Grid: 5 frames a row (Krakout's 5/10-frame grid), a row is a 16th note, 4 rows a beat, 16 rows
 * a bar: a bar is 1.6 s, a quarter note 150 BPM. Each 16-row bar is a pattern, so bars that come
 * back cost nothing. 32 bars, 51.2 s, then the loop returns to bar 1.
 *
 * Form (AABB, as a dance tune is played):
 *   A   8 bars  D G D A | D G Em-A D. Dotted gesture (F#. E D F# A--), the same gesture a fourth
 *               up over G, a running bar, A7 half cadence; the answer climbs to the high G and
 *               closes on D. First ending: a pickup back into A. Voice 3 holds chord arpeggios.
 *   A'  8 bars  the tune again with scoops on the accents and a 16th run in bar 3; voice 3 plays
 *               off-beat chord stabs (an open fifth on D). Second ending: held D, pickup into B.
 *   B   8 bars  Bm G Em A | Bm C G-A D: the relative minor, then a mixolydian C (C natural in
 *               the tune) for colour. Voice 3 drops the chords for a slow octave-arpeggio line
 *               D D E C# D C B-C# D under the tune.
 *   B'  8 bars  B again: the stabs come back, the bass turns to quarter notes with a light noise
 *               tick between them, the held A of bar 4 flickers in octaves, and the last two
 *               bars quote A's second bar and A's cadence: the planned return into A.
 *
 * Voice 1: pulse bass in 8ths (root, octave, fifth, octave, an approach note into the next
 *   chord); in B' quarter notes with a noise tick between.
 * Voice 2: the tune (pulse from $400 sweeping 50 a frame, ±22-cent vibrato over 8 frames from the
 *   attack on held notes, scoops from a major third below).
 * Voice 3: chord arpeggios at a frame a step (held, then as stabs) and the octave line of B.
 */
import { writeSong, up } from './lib.js';
import { kit, VIBRATO, RESTART } from './sid-kit.js';

const BAR = 16;
const SECTION = 8 * BAR;

// ---------------------------------------------------------------- instruments
const I = {};
const samples = [];
const add = (key, inst) => { I[key] = samples.length; samples.push(inst); };
// Daglish's pulse (Krakout, voices 0-1): width $400 at the attack, sweeping 50 a frame; ADSR near
// his $185A (attack 1, decay 8), with more sustain on the tune so it stays in front.
const PULSE = { width: 0x400, speed: 50, min: 0x100, max: 0xe00 };
const LEAD_ADSR = [1, 8, 10, 9];
add('bass', { name: 'bass pulse', sid: { adsr: [1, 8, 7, 9], wave: ['pulse'], pulse: PULSE } });
add('lead', { name: 'lead pulse', sid: { adsr: LEAD_ADSR, wave: ['pulse'], pulse: PULSE } });
add('scoop', kit.flick([-4], { name: 'lead scoop', adsr: LEAD_ADSR, width: PULSE.width, speed: PULSE.speed }));
add('scoop3', kit.flick([-4, -3, -1], { name: 'lead slow scoop', adsr: LEAD_ADSR, width: PULSE.width, speed: PULSE.speed }));
add('leadOct', kit.octave({ name: 'lead octave', adsr: LEAD_ADSR, frames: 2, wave: 'pulse', width: PULSE.width, speed: PULSE.speed }));
add('tick', kit.noise({ name: 'noise tick', adsr: [0, 3, 0, 3] }));
add('line', kit.octave({ name: 'octave line', adsr: [1, 9, 9, 8], frames: 2, wave: 'tri' }));
// One instrument per chord shape: held (A) and stabbed (A', B').
const SHAPES = { maj: [0, 4, 7], six4: [0, 5, 9], min: [0, 3, 7], min6: [0, 4, 9], open: [0, 7, 12] };
for (const [k, s] of Object.entries(SHAPES)) {
  add(`pad_${k}`, kit.chord(s, { name: `held ${s.join('-')}`, adsr: [1, 9, 7, 8], width: 0x600, speed: 20 }));
  add(`stab_${k}`, kit.chord(s, { name: `stab ${s.join('-')}`, adsr: [0, 7, 0, 4], width: 0x500, speed: 24 }));
}

// ---------------------------------------------------------------- harmony
// Voice 3's voicings stay round D-4..E-4 and move by step: D (D F# A), G/D (D G B), A/E (E A C#),
// Em (E G B), Bm/D (D F# B), C (C E G).
const VOICING = { D: ['D-4', 'maj'], G: ['D-4', 'six4'], A: ['E-4', 'six4'], Em: ['E-4', 'min'], Bm: ['D-4', 'min6'], C: ['C-4', 'maj'] };
const ROOT = { D: 'D-3', G: 'G-2', A: 'A-2', Em: 'E-3', Bm: 'B-2', C: 'C-3' };
const HARM_A = ['D', 'G', 'D', 'A', 'D', 'G', ['Em', 'A'], 'D'];
const HARM_B = ['Bm', 'G', 'Em', 'A', 'Bm', 'C', ['G', 'A'], 'D'];
// The bass's last 8th of a bar leads into the next chord: a chord tone of this bar a step from the
// next root where one exists, else the step above it.
const APPROACH = { 'D>G': 'F#2', 'G>D': 'E-3', 'D>A': 'B-2', 'A>D': 'C#3', 'G>Em': 'D-3', 'D>D': 'A-2', 'D>Bm': 'A-2',
  'Bm>G': 'F#2', 'Em>A': 'B-2', 'A>Bm': 'C#3', 'Bm>C': 'B-2', 'C>G': 'A-2' };
const halves = (h) => (Array.isArray(h) ? h : [h, h]);

// ---------------------------------------------------------------- the tune (voice 2)
// [row in bar, note, rows, mark?]: mark 's' scoop (a frame from a major third below), 'S' slow
// scoop (-4 -3 -1), 'o' octave flicker.
const A = [
  [[0, 'F#5', 3], [3, 'E-5', 1], [4, 'D-5', 2], [6, 'F#5', 2], [8, 'A-5', 4], [12, 'F#5', 2], [14, 'A-5', 2]],
  [[0, 'B-5', 3], [3, 'A-5', 1], [4, 'G-5', 2], [6, 'B-5', 2], [8, 'D-6', 4], [12, 'B-5', 2], [14, 'G-5', 2]],
  [[0, 'A-5', 2], [2, 'F#5', 2], [4, 'D-5', 2], [6, 'F#5', 2], [8, 'A-5', 2], [10, 'B-5', 2], [12, 'A-5', 2], [14, 'F#5', 2]],
  [[0, 'E-5', 3], [3, 'F#5', 1], [4, 'G-5', 2], [6, 'E-5', 2], [8, 'C#5', 4], [12, 'E-5', 2], [14, 'G-5', 2]],
  null, // = bar 1
  [[0, 'B-5', 3], [3, 'A-5', 1], [4, 'G-5', 2], [6, 'B-5', 2], [8, 'D-6', 4], [12, 'E-6', 2], [14, 'F#6', 2]],
  [[0, 'G-6', 3], [3, 'F#6', 1], [4, 'E-6', 2], [6, 'D-6', 2], [8, 'C#6', 2], [10, 'A-5', 2], [12, 'B-5', 2], [14, 'C#6', 2]],
];
A[4] = A[0];
const A_FIRST = [[0, 'D-6', 4, 'S'], [4, 'A-5', 2], [6, 'F#5', 2], [8, 'D-5', 6], [14, 'E-5', 2]];
const A_SECOND = [[0, 'D-6', 10, 'S'], [12, 'A-5', 2], [14, 'E-5', 2]];
const A_RUN = [[0, 'A-5', 2], [2, 'F#5', 2], [4, 'D-5', 2], [6, 'F#5', 2], [8, 'A-5', 2], [10, 'B-5', 1], [11, 'C#6', 1], [12, 'D-6', 2], [14, 'A-5', 2]];
const B = [
  [[0, 'F#5', 2], [2, 'B-5', 2], [4, 'D-6', 3, 's'], [7, 'B-5', 1], [8, 'F#6', 4, 's'], [12, 'E-6', 2], [14, 'D-6', 2]],
  [[0, 'D-6', 3, 's'], [3, 'B-5', 1], [4, 'G-5', 2], [6, 'B-5', 2], [8, 'G-6', 4, 's'], [12, 'F#6', 2], [14, 'E-6', 2]],
  [[0, 'B-5', 2], [2, 'G-5', 2], [4, 'E-5', 2], [6, 'G-5', 2], [8, 'B-5', 2], [10, 'E-6', 2], [12, 'D-6', 2], [14, 'B-5', 2]],
  [[0, 'C#6', 3], [3, 'D-6', 1], [4, 'E-6', 2], [6, 'C#6', 2], [8, 'A-5', 8, 'S']],
  null, // = bar 1
  [[0, 'E-6', 3, 's'], [3, 'D-6', 1], [4, 'C-6', 2], [6, 'E-6', 2], [8, 'G-6', 4, 's'], [12, 'E-6', 2], [14, 'C-6', 2]],
  [[0, 'B-5', 3], [3, 'A-5', 1], [4, 'G-5', 2], [6, 'B-5', 2], [8, 'A-5', 2], [10, 'C#6', 2], [12, 'E-6', 2], [14, 'C#6', 2]],
];
B[4] = B[0];
const B_FIRST = [[0, 'D-6', 8, 'S'], [8, 'A-5', 2], [10, 'F#5', 2], [12, 'D-5', 2], [14, 'E-5', 2]];
// B' closes as A's first ending does and quotes A's second bar before it: the way back into A.
const B_LAST = [[0, 'B-5', 3, 's'], [3, 'A-5', 1], [4, 'G-5', 2], [6, 'B-5', 2], [8, 'A-5', 2], [10, 'C#6', 2], [12, 'E-6', 2], [14, 'C#6', 2]];

// A's accents scooped the second time: the dotted notes that start bars 1, 2, 5, 6 and the high G.
const scoopHeads = (bars, which) => bars.map((evs, b) => evs.map((e) => (which.includes(b) && e[0] === 0 && !e[3] ? [...e.slice(0, 3), 's'] : e)));

const MARK = { s: I.scoop, S: I.scoop3, o: I.leadOct };
// Events -> one channel of `rows` rows. A note shorter than the gap to the next ends with a key
// off. A plain or scooped note of 4+ rows gets Daglish's vibrato from its attack (H on the note's
// row, then H00 on each row it holds: an effect lasts one row).
function tune(bars) {
  const ch = {};
  const evs = bars.flatMap((list, b) => list.map(([r, note, len, mark]) => [b * BAR + r, note, len, mark]));
  const rows = bars.length * BAR;
  evs.forEach(([row, note, len, mark], i) => {
    const next = i + 1 < evs.length ? evs[i + 1][0] : rows;
    const end = Math.min(row + len, next);
    ch[row] = { note, instrument: mark ? MARK[mark] : I.lead };
    if (len >= 4 && mark !== 'o') {
      ch[row].fx = VIBRATO.daglish;
      for (let r = row + 1; r < end; r++) ch[r] = { fx: 'H00' };
    }
    if (row + len < next && row + len < rows) ch[row + len] = { note: '==' };
  });
  return ch;
}

// ---------------------------------------------------------------- bass (voice 1)
// Each bar in 8ths: root, octave, fifth, octave | root, octave, fifth, approach. A bar with two
// chords plays four 8ths of each. ticks: quarter notes (root, fifth) with a noise tick on the 8th between.
function bass(harm, nextAfter, { ticks = false } = {}) {
  const ch = {};
  harm.forEach((h, b) => {
    const [c1, c2] = halves(h);
    const next = b + 1 < harm.length ? halves(harm[b + 1])[0] : nextAfter;
    const fig = (c) => { const r = ROOT[c]; return [r, up(r, 12), up(r, 7), up(r, 12)]; };
    const notes = [...fig(c1), ...fig(c2)];
    notes[7] = APPROACH[`${c2}>${next}`] ?? notes[7];
    notes.forEach((note, k) => {
      const row = b * BAR + 2 * k;
      if (!ticks || k === 7) ch[row] = { note, instrument: I.bass };
      else if (k % 2 === 0) ch[row] = { note, instrument: I.bass };
      else ch[row] = { note: 'C-7', instrument: I.tick };
    });
  });
  return ch;
}

// ---------------------------------------------------------------- voice 3
function chordAt(c, kind) {
  const [note, shape] = VOICING[c];
  return { note, instrument: I[`${kind}_${shape}`] };
}
// Held arpeggios: one per half bar (the chord sounds again on beat 3).
function held(harm) {
  const ch = {};
  harm.forEach((h, b) => halves(h).forEach((c, k) => { ch[b * BAR + 8 * k] = chordAt(c, 'pad'); }));
  return ch;
}
// Stabs on the off-beat 8ths; D as an open fifth (D A D), a drone more than a chord.
function stabs(harm) {
  const ch = {};
  harm.forEach((h, b) => [2, 6, 10, 14].forEach((r) => {
    const c = halves(h)[r < 8 ? 0 : 1];
    ch[b * BAR + r] = c === 'D' ? { note: 'D-4', instrument: I.stab_open } : chordAt(c, 'stab');
    ch[b * BAR + r + 1] = { note: '==' };
  }));
  return ch;
}
// B's slow line, a note and its octave two frames each: D D E C# D C B-C# D.
const LINE = [['D-4', 16], ['D-4', 16], ['E-4', 16], ['C#4', 16], ['D-4', 16], ['C-4', 16], ['B-3', 8], ['C#4', 8], ['D-4', 16]];
function octaveLine() {
  const ch = {};
  let row = 0;
  for (const [note, len] of LINE) { ch[row] = { note, instrument: I.line }; row += len; }
  ch[SECTION - 2] = { note: '==' };
  return ch;
}

// ---------------------------------------------------------------- sections
const sections = [
  { name: 'A', v1: bass(HARM_A, 'D'), v2: tune([...A, A_FIRST]), v3: held(HARM_A) },
  { name: "A'", v1: bass(HARM_A, 'Bm'),
    v2: tune(scoopHeads([A[0], A[1], A_RUN, A[3], A[4], A[5], A[6].map((e) => (e[0] === 0 ? [...e, 's'] : e)), A_SECOND], [0, 1, 4, 5])),
    v3: stabs(HARM_A) },
  { name: 'B', v1: bass(HARM_B, 'Bm'), v2: tune([...B, B_FIRST]), v3: octaveLine() },
  { name: "B'", v1: bass(HARM_B, 'D', { ticks: true }),
    v2: tune([B[0], B[1], B[2], [...B[3].slice(0, 4), [8, 'A-5', 8, 'o']], B[4], B[5], B_LAST, A_FIRST]),
    v3: stabs(HARM_B) },
];

// ---------------------------------------------------------------- bars -> patterns, orders
const patterns = [], patternIndex = new Map(), order = [];
for (const s of sections) {
  for (let b = 0; b < SECTION / BAR; b++) {
    const channels = [s.v1, s.v2, s.v3].map((ch) => {
      const out = {};
      for (const [r, ev] of Object.entries(ch)) if (r >= b * BAR && r < (b + 1) * BAR) out[r - b * BAR] = ev;
      return out;
    });
    const key = JSON.stringify(channels);
    if (!patternIndex.has(key)) { patternIndex.set(key, patterns.length); patterns.push({ name: `${s.name} ${b + 1}`, rows: BAR, channels }); }
    order.push(patternIndex.get(key));
  }
}

writeSong(import.meta.url, {
  title: 'Hedgerow Reel (SID)', bpm: 125, ticks: 5,
  message: 'A folk reel in D in the manner of Ben Daglish: AABB, 32 bars at 5 frames a row.\n' +
    'Voice 1 pulse bass (noise ticks in the last B), voice 2 the tune (scoops, vibrato), voice 3 chord arpeggios\n' +
    "and B's octave line.",
  sid: { model: '6581', author: 'Claude Opus 5.5', released: '2026 cozy-tracker', ...RESTART.soft },
  samples,
  channelnames: ['bass', 'tune', 'chords / octave line'],
  patterns,
  order,
});
