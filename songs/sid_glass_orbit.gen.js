#!/usr/bin/env node
/**
 * Glass Orbit (SID) — a bouncy, bright platformer loop in F major, written with skills/sid-music in
 * the manner of Chris Hülsbeck's C64 tunes (techniques and numbers only; the melody is original).
 *
 * Grid: 6 frames a row (125 BPM), a row is a 16th, 16 rows a bar (1.92 s), one 16-row pattern per
 * bar so a bar that comes back costs nothing. 24 bars, about 46 s, no intro: order 0 is the hook.
 *
 *   A    4 bars  F  C  Dm  Bb|C       the hook (F A C, up to the high F, down) and an open answer on G;
 *                                      the second half climbs to the A-6 and steps down to the E into F
 *   A'   4 bars  F  C  Bb|Bbm  F       the hook again; the answer rises to E-6, the borrowed iv (Db)
 *                                      falls to C, and the phrase closes on F
 *   B    8 bars  Dm Bb Gm C Dm Bb Eb C  contrast by rhythm: the lead sings long notes with late vibrato,
 *                                      voice 3 runs octave arpeggios in 8ths, half-time drums; the bVII
 *                                      (Eb) lifts it, C holds, the lead rests over a snare roll
 *   A''  8 bars  A + A' with voice 3 singing chord tones under the hook (bars 1-4), hats between the
 *                bass notes; the last bar turns F|C with the pickup C-5 E-5 into the loop's F-5
 *
 * Voice 1: pulse bass through the low-pass filter (as in Giana Sisters), kick in front of the bar's first
 *   note, a noise snare between the bass notes on 2 and 4 (half time in B), hats in A''.
 * Voice 2: the lead, kit.blipLead (noise click, an octave-up blip, then the note), Hülsbeck's late gentle
 *   vibrato (VIBRATO.huelsbeck two rows in) on notes of four rows or more.
 * Voice 3: octave arpeggios at 4 frames a step (kit.octave({ frames: 4 })) on the chord's tones; the
 *   harmony under the hook in A''.
 *
 * The filter sweeps once a bar: the bar's kick starts it at that bar's cutoff level (rising through
 * each phrase) and the bass notes carry it on (filter: "carry"), so it does not start again on every
 * note; the drums between them unroute it for a moment. The slowest sweep is 8 a frame, so one bar is
 * as long as a sweep across this range can last.
 */
import { writeSong, nn, ns, up } from './lib.js';
import { kit, VIBRATO, RESTART } from './sid-kit.js';

const BAR = 16;

// ---------------------------------------------------------------- instruments
const I = {};
const samples = [];
const add = (key, inst) => { I[key] = samples.length; samples.push(inst); };

add('lead', kit.blipLead({ name: 'blip lead', adsr: [0, 9, 9, 8], width: 0x240, speed: 32 }));
add('arp', kit.octave({ name: 'glass octave', frames: 4, adsr: [0, 8, 6, 6], width: 0x200, speed: 24 }));
add('harmony', { name: 'harmony pulse', sid: { adsr: [0, 8, 7, 8], wave: ['pulse'], pulse: { width: 0x600, speed: -24, min: 0x300, max: 0xa00 } } });
// Hülsbeck's R-Type drums are noise, pulse, noise, noise (80 40 80 80 80): a noise snare with a pulse thud.
add('snare', { name: 'noise snare', sid: { adsr: [0, 9, 0, 9], wave: [['noise', 'D-7'], ['pulse', 'C-5'], ['noise', 'A-6'], ['noise', 'F-6'], ['noise', 'D-6']], pulse: { width: 0x800 } } });
add('roll', { name: 'roll snare', sid: { adsr: [0, 7, 0, 7], wave: [['noise', 'E-7'], ['pulse', 'D-5'], ['noise', 'B-6'], ['noise', 'G-6']], pulse: { width: 0x800 } } });
add('hat', kit.noise({ name: 'hat', adsr: [0, 5, 0, 5] }));

// The filtered bass: a kick per cutoff level (a step of 128 out of 2047) starts the bar's sweep;
// the bass notes carry it on.
const LEVELS = [512, 640, 768, 896, 1024, 1152];
const filter = (cutoff) => ({ mode: 'low', cutoff, resonance: 15, speed: 1, max: cutoff + 256 });
const BASS_PULSE = { width: 0x280, speed: 32, min: 0x200, max: 0xb00 };
add('bassCarry', { name: 'filter bass (carry)', sid: { adsr: [0, 9, 9, 9], wave: ['pulse'], pulse: BASS_PULSE, filter: 'carry' } });
for (const c of LEVELS) {
  // kit.kickBass's shape (noise click, pulse falling into the note), starting the sweep at c.
  add(`kick${c}`, { name: `kick bass ${c}`, sid: { adsr: [0, 9, 9, 9],
    wave: [['noise', 'A#6'], ['pulse', 19], ['pulse', 12], ['pulse', 5], ['pulse', 0]], pulse: BASS_PULSE, filter: filter(c) } });
}

// ---------------------------------------------------------------- helpers
// events: [row, note, len, extra?]. A note shorter than the gap to the next one ends with a key off.
// A note of minVib+ rows gets the vibrato from vibAt rows in (H once, then H00: an effect lasts one row).
function line(events, instrument, { rows, vib = VIBRATO.huelsbeck, vibAt = 2, minVib = 4 } = {}) {
  const ch = {};
  const sorted = [...events].sort((a, b) => a[0] - b[0]);
  sorted.forEach(([row, note, len, extra = {}], i) => {
    const next = i + 1 < sorted.length ? sorted[i + 1][0] : rows;
    const end = Math.min(row + len, next);
    ch[row] = { note, instrument, ...extra };
    if (vib && len >= minVib) for (let r = row + vibAt; r < end; r++) if (!ch[r]) ch[r] = { fx: r === row + vibAt ? vib : 'H00' };
    if (row + len < next && row + len < rows && !ch[row + len]) ch[row + len] = { note: '==' };
  });
  return ch;
}
// Bars of [row, ...] events -> absolute rows.
const bars = (list) => list.flatMap((rows, b) => rows.map(([r, ...rest]) => [b * BAR + r, ...rest]));

// ---------------------------------------------------------------- harmony
// A bar is one chord or two (a half bar each).
const A_CHORDS = [['F'], ['C'], ['Dm'], ['Bb', 'C']];
const A2_CHORDS = [['F'], ['C'], ['Bb', 'Bbm'], ['F']];
const B_CHORDS = [['Dm'], ['Bb'], ['Gm'], ['C'], ['Dm'], ['Bb'], ['Eb'], ['C']];
const A3_CHORDS = [...A_CHORDS, ['F'], ['C'], ['Bb', 'Bbm'], ['F', 'C']];
const chordAt = (chords, row) => { const c = chords[row >> 4]; return c[(row & 15) >= 8 ? c.length - 1 : 0]; };

const ROOT = { F: 'F-3', C: 'C-3', Dm: 'D-3', Bb: 'A#2', Bbm: 'A#2', Gm: 'G-3', Eb: 'D#3' };
const PCS = { F: [5, 9, 0], C: [0, 4, 7], Dm: [2, 5, 9], Bb: [10, 2, 5], Bbm: [10, 1, 5], Gm: [7, 10, 2], Eb: [3, 7, 10] };
// Voice 3's close voicings (low, middle, high), voice-led around A-3..G-4; the arpeggio adds the octave.
const VOICING = {
  F: ['A-3', 'C-4', 'F-4'], C: ['G-3', 'C-4', 'E-4'], Dm: ['A-3', 'D-4', 'F-4'], Bb: ['A#3', 'D-4', 'F-4'],
  Bbm: ['A#3', 'C#4', 'F-4'], Gm: ['A#3', 'D-4', 'G-4'], Eb: ['A#3', 'D#4', 'G-4'],
};

// ---------------------------------------------------------------- the lead
const HOOK = [[0, 'F-5', 2], [2, 'A-5', 2], [4, 'C-6', 3], [7, 'A-5', 1], [8, 'F-6', 4], [12, 'E-6', 2], [14, 'C-6', 2]];
const QUESTION = [[0, 'D-6', 3], [3, 'C-6', 1], [4, 'A#5', 2], [6, 'A-5', 2], [8, 'G-5', 6]];
const HOOK_ON_D = [[0, 'A-5', 2], [2, 'D-6', 2], [4, 'F-6', 3], [7, 'D-6', 1], [8, 'A-6', 4], [12, 'G-6', 2], [14, 'F-6', 2]];
const TO_F = [[0, 'F-6', 3], [3, 'D-6', 1], [4, 'A#5', 4], [8, 'C-6', 2], [10, 'A#5', 2], [12, 'G-5', 2], [14, 'E-5', 2]];
const RISE = [[0, 'D-6', 3], [3, 'C-6', 1], [4, 'A#5', 2], [6, 'A-5', 2], [8, 'G-5', 2], [10, 'C-6', 2], [12, 'E-6', 4]];
const MINOR_IV = [[0, 'F-6', 3], [3, 'D-6', 1], [4, 'A#5', 4], [8, 'C#6', 4], [12, 'A#5', 2], [14, 'C#6', 2]];
const HOME = [[0, 'C-6', 4], [4, 'A-5', 2], [6, 'G-5', 2], [8, 'F-5', 6]];
const TURN = [[0, 'C-6', 4], [4, 'A-5', 2], [6, 'F-5', 2], [8, 'G-5', 4], [12, 'C-5', 2], [14, 'E-5', 2]];

const A_LEAD = [HOOK, QUESTION, HOOK_ON_D, TO_F];
const A2_LEAD = [HOOK, RISE, MINOR_IV, HOME];
const B_LEAD = [
  [[0, 'A-5', 6], [6, 'D-6', 2], [8, 'F-6', 6], [14, 'E-6', 2]],
  [[0, 'D-6', 8], [8, 'A#5', 4], [12, 'F-5', 4]],
  [[0, 'A#5', 6], [6, 'D-6', 2], [8, 'G-6', 6], [14, 'F-6', 2]],
  [[0, 'E-6', 8], [8, 'C-6', 4], [12, 'G-5', 4]],
  [[0, 'A-5', 6], [6, 'D-6', 2], [8, 'F-6', 4], [12, 'A-6', 4]],
  [[0, 'A#6', 8], [8, 'F-6', 4], [12, 'D-6', 4]],
  [[0, 'D#6', 6], [6, 'F-6', 2], [8, 'G-6', 8]],
  [[0, 'E-6', 6], [6, 'D-6', 1], [7, 'C-6', 1], [8, 'G-5', 4]],
];
const A3_LEAD = [HOOK, QUESTION, HOOK_ON_D, TO_F, HOOK, RISE, MINOR_IV, TURN];

// ---------------------------------------------------------------- voice 1: bass and drums
// bounce: kick+root on 1, octave bounce, snare on 2 and 4, a fifth leading on; half: snare on 3 only
// (B); roll: the last four rows a snare roll. `level` picks the bar's cutoff instrument.
function v1Bar(chords, kind, level, { hats = false, roll = false } = {}) {
  const bass = I.bassCarry, kick = I[`kick${level}`];
  const R = (half) => ROOT[chords[half ? chords.length - 1 : 0]];
  const e = [];
  const B = (r, n, len = 1, ins = bass) => e.push([r, n, len, { instrument: ins }]);
  const S = (r, ins = I.snare) => e.push([r, 'C-5', 1, { instrument: ins }]);
  if (kind === 'bounce') {
    const r0 = R(0), r1 = R(1);
    B(0, r0, 2, kick); B(2, up(r0, 12)); S(4); B(6, r0); B(7, up(r0, 12));
    B(8, r1, 2, chords.length > 1 ? kick : bass); B(10, up(r1, 12)); B(11, r1);
    if (!roll) { S(12); B(14, up(r1, 12)); B(15, up(r1, 7)); }
  } else {
    const r0 = R(0);
    B(0, r0, 3, kick); B(3, r0); B(6, up(r0, 12), 2); S(8); B(10, r0, 2); B(13, up(r0, 12));
    if (!roll) { B(14, r0); B(15, up(r0, 7)); }
  }
  if (roll) for (const r of [12, 13, 14, 15]) S(r, I.roll);
  if (hats) for (const r of [1, 5, 9, 13]) if (!e.some(([x]) => x === r)) e.push([r, 'C-5', 1, { instrument: I.hat }]);
  return e;
}
const v1 = (list, rows) => line(bars(list), I.bassCarry, { rows, vib: null });

// ---------------------------------------------------------------- voice 3
// The A figure: low, middle, high on a 3-3-2 rhythm, twice a bar; octave arps 4 frames a step.
const FIGURE = [[0, 0], [3, 1], [6, 2], [8, 0], [11, 1], [14, 2]];
const figureBars = (chords) => bars(chords.map((c) => FIGURE.map(([r, k]) => [r, VOICING[(r >= 8 ? c[c.length - 1] : c[0])][k], 2])));
// The B figure: running 8ths low, middle, high, middle.
const RUN = [0, 1, 2, 1, 0, 1, 2, 1];
const runBars = (chords) => bars(chords.map((c) => RUN.map((k, i) => [i * 2, VOICING[c[0]][k], 2])));
// Under the hook: the nearest chord tone at least a minor third below the lead note.
function under(note, chord) {
  for (let m = nn(note) - 3; m > nn(note) - 12; m--) if (PCS[chord].includes(m % 12)) return ns(m);
  throw new Error(`no chord tone under ${note} in ${chord}`);
}

// ---------------------------------------------------------------- sections
const section = (n, v1ch, v2ch, v3ch) => ({ bars: n, v1: v1ch, v2: v2ch, v3: v3ch });

const sectionA = section(4,
  v1([v1Bar(A_CHORDS[0], 'bounce', 640), v1Bar(A_CHORDS[1], 'bounce', 768), v1Bar(A_CHORDS[2], 'bounce', 896), v1Bar(A_CHORDS[3], 'bounce', 1024)], 64),
  line(bars(A_LEAD), I.lead, { rows: 64 }),
  line(figureBars(A_CHORDS), I.arp, { rows: 64, vib: null }));

const sectionA2 = section(4,
  v1([v1Bar(A2_CHORDS[0], 'bounce', 768), v1Bar(A2_CHORDS[1], 'bounce', 896), v1Bar(A2_CHORDS[2], 'bounce', 1024), v1Bar(A2_CHORDS[3], 'bounce', 1152)], 64),
  line(bars(A2_LEAD), I.lead, { rows: 64 }),
  line(figureBars(A2_CHORDS), I.arp, { rows: 64, vib: null }));

const B_LEVELS = [512, 512, 640, 640, 768, 896, 1024, 1152];
const sectionB = section(8,
  v1(B_CHORDS.map((c, b) => v1Bar(c, 'half', B_LEVELS[b], { roll: b === 7 })), 128),
  line(bars(B_LEAD), I.lead, { rows: 128 }),
  line(runBars(B_CHORDS), I.arp, { rows: 128, vib: null }));

const A3_LEVELS = [640, 768, 896, 1024, 768, 896, 1024, 1152];
const a3Lead = bars(A3_LEAD);
const sectionA3 = section(8,
  v1(A3_CHORDS.map((c, b) => v1Bar(c, 'bounce', A3_LEVELS[b], { hats: true, roll: b === 7 })), 128),
  line(a3Lead, I.lead, { rows: 128 }),
  { ...line(a3Lead.filter(([r]) => r < 64).map(([r, n, len]) => [r, under(n, chordAt(A3_CHORDS, r)), len]), I.harmony, { rows: 64 }),
    ...line(figureBars(A3_CHORDS.slice(4)).map(([r, ...rest]) => [r + 64, ...rest]), I.arp, { rows: 128, vib: null }) });

// ---------------------------------------------------------------- bars -> patterns, orders
const patterns = [], patternIndex = new Map(), order = [];
function place(name, s) {
  for (let b = 0; b < s.bars; b++) {
    const channels = [s.v1, s.v2, s.v3].map((ch) => {
      const out = {};
      for (const [r, ev] of Object.entries(ch)) if (r >= b * BAR && r < (b + 1) * BAR) out[r - b * BAR] = ev;
      return out;
    });
    const key = JSON.stringify(channels);
    if (!patternIndex.has(key)) { patternIndex.set(key, patterns.length); patterns.push({ name: `${name} ${b + 1}`, rows: BAR, channels }); }
    order.push(patternIndex.get(key));
  }
}
place('A', sectionA);
place("A'", sectionA2);
place('B', sectionB);
place("A''", sectionA3);

writeSong(import.meta.url, {
  title: 'Glass Orbit (SID)', bpm: 125, ticks: 6,
  message: 'A bouncy F major platformer loop in the manner of Chris Huelsbeck, written with the sid-music skill.\n' +
    'Voice 1 filtered bass + drums, voice 2 blip lead, voice 3 octave arpeggios / harmony. A A\' B A\'\', 24 bars.',
  sid: { model: '6581', author: 'Claude Opus 5.5', released: '2026', ...RESTART.soft, loop: 0 },
  samples,
  channelnames: ['filtered bass + drums', 'lead', 'octave arps / harmony'],
  patterns,
  order,
});
