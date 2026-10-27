#!/usr/bin/env node
/**
 * Witchfinder (SID) — a new set for Hexwarren's C64 port, written with skills/sid-music: the
 * in-Warren loop, the cleared and fallen stings, silence, and the music while a holder is out.
 * It keeps Warren Pulse's interface (hexwarren_warren_pulse_sid.gen.js): order 0 starts the
 * loop, the same section names, and the same five sound effects on voice 3.
 *
 * Folk horror at a gallop: the Witchfinder going down the warren. E minor, with the Phrygian F
 * for the witchcraft and an abbey bell that tolls through every section. A row is a 16th note;
 * bars are 16-row patterns, so a bar that comes back costs nothing.
 *
 * Voice 1: bass and drums (kick in front of the bass note, snare and hats between the notes).
 * Voice 2: the lead (chiff attack, vibrato on held notes), the plucked figure of the B section.
 * Voice 3: bells, echo, a filtered pad, harmony and stabs. The game's sound effects borrow this
 *   voice (a shot every few frames in a fight), so nothing the tune needs lives on it.
 *
 * Loop, 6 frames a row (125 BPM):
 *   intro  2 bars  Em pedal, the bell tolls (only from order 0)
 *   A      4 bars  Em Em C B: the hook (E, G, B, then down to G), the bell on 1 and 3
 *   A'     4 bars  Em Em Am B: the hook climbs to the high E; voice 3 echoes it three rows later
 *   B      4 bars  F Em F B: the lead becomes a plucked broken chord; a filtered saw pad opens
 *   A''    4 bars  the hook with thirds under it, hats, a snare roll back to A
 * cleared  2 bars  an E major fanfare, then the loop's A
 * fallen   4 bars  7 frames a row (about 9 s): the bell falls from E-6 to E-5 over a slow bass
 * silence  4 rows  every voice cut, looping on itself
 * boss     8 bars  5 frames a row (150 BPM): Em F alternating over a pumping octave bass, a wailing
 *                  lead with glides and late vibrato, chord stabs; it loops to its own start
 */
import { writeSong, nn, ns, up } from './lib.js';
import { kit, VIBRATO, RESTART, vibrato } from './sid-kit.js';

const BAR = 16;

// ---------------------------------------------------------------- instruments
const I = {};
const samples = [];
const add = (key, inst) => { I[key] = samples.length; samples.push(inst); };
add('bass', kit.sweepBass({ name: 'sweep bass', adsr: [0, 9, 9, 12], width: 0x180, speed: 24 }));
add('kickBass', kit.kickBass({ name: 'kick + bass', adsr: [0, 9, 9, 12], speed: 24 }));
add('snare', { name: 'noise snare', sid: { adsr: [0, 9, 0, 9], wave: [['noise', 'E-7'], ['noise', 'C-7'], ['noise', 'G-6'], ['noise', 'D-6']] } });
add('hat', kit.noise({ name: 'hat', adsr: [0, 6, 0, 6] }));
add('roll', kit.snare({ name: 'roll snare' }));
add('lead', kit.chiffLead({ name: 'chiff lead', adsr: [0, 6, 9, 9], width: 0x180, speed: 48 }));
add('bell', { name: 'abbey bell', sid: { adsr: [0, 10, 0, 10], wave: [['pulse', 12], ['tri', 12], ['tri', 0]], pulse: { width: 0x400 } } });
add('echo', { name: 'echo pulse', sid: { adsr: [0, 5, 4, 7], wave: ['pulse'], pulse: { width: 0x700, speed: -20, min: 0x300, max: 0xa00 } } });
add('pluck', { name: 'pluck', sid: { adsr: [0, 5, 0, 4], wave: ['pulse'], pulse: { width: 0x500, speed: 20, min: 0x300, max: 0xa00 } } });
add('pad', kit.filterBass({ name: 'filter pad', adsr: [2, 9, 12, 6], wave: 'saw', cutoff: 256, speed: 1, max: 1536, resonance: 15 }));
add('harmony', { name: 'harmony pulse', sid: { adsr: [0, 7, 6, 9], wave: ['pulse'], pulse: { width: 0x500, speed: 32, min: 0x200, max: 0xc00 } } });
add('fanfare', kit.chord([0, 4, 7, 12], { name: 'major arpeggio', adsr: [0, 8, 10, 6], width: 0x400, speed: 16 }));
add('stabMin', kit.chord([0, 3, 7], { name: 'stab minor', adsr: [0, 7, 0, 0], width: 0x300, speed: 12 }));
add('stabMaj', kit.chord([0, 4, 7], { name: 'stab major', adsr: [0, 7, 0, 0], width: 0x300, speed: 12 }));
add('wail', { name: 'wail lead', sid: { adsr: [0, 8, 11, 8], wave: [['noise', 0], ['pulse', 0]], pulse: { width: 0x200, speed: 64, min: 0x200, max: 0xd00 } } });
add('knell', { name: 'knell', sid: { adsr: [0, 11, 0, 11], wave: [['pulse', 12], ['tri', 0]], pulse: { width: 0x300 } } });
add('lowBass', { name: 'low pulse', sid: { adsr: [4, 0, 11, 10], wave: ['pulse'], pulse: { width: 0x300, speed: 6, min: 0x200, max: 0x900 } } });
add('shroud', { name: 'shroud', sid: { adsr: [6, 0, 9, 10], wave: ['tri'] } });
// The sound effects, as Warren Pulse has them (the game's SFX_* numbers follow sid.sfx).
add('zap', { name: 'sfx zap', sid: { adsr: [0, 5, 0, 0], wave: [['pulse', 12], ['pulse', 7], ['pulse', 2], ['pulse', -3], ['pulse', -8], ['pulse', -13]], pulse: { width: 0x400 } } });
add('burst', { name: 'sfx burst', sid: { adsr: [0, 8, 0, 0], wave: [['noise', 'C-7'], ['noise', 'A-6'], ['noise', 'F-6'], ['noise', 'D-6'], ['noise', 'A-5'], ['noise', 'F-5'], ['noise', 'C-5']] } });
add('fall', { name: 'sfx fall', sid: { adsr: [0, 0, 15, 8], wave: [...Array(36)].map((_, i) => ['saw', -i]) } });
add('rise', { name: 'sfx rise', sid: { adsr: [0, 6, 0, 0], wave: [['pulse', 0], ['pulse', 0], ['pulse', 4], ['pulse', 4], ['pulse', 7], ['pulse', 7], ['pulse', 12]], pulse: { width: 0x600 } } });
add('blast', { name: 'sfx blast', sid: { adsr: [0, 10, 0, 0], wave: [...Array(14)].map((_, i) => [i % 3 === 1 ? 'pulse' : 'noise', -2 * i]), pulse: { width: 0x800 } } });

// ---------------------------------------------------------------- helpers
// events: [row, note, len, extra?]. A note shorter than the gap to the next one ends with a key
// off. A note of minVib+ rows gets a vibrato from vibAt rows in (H once, then H00: an effect lasts
// one row). glide: the note slides in (G, then G00 for `glide` rows) before its vibrato.
function line(events, instrument, { rows, vib = VIBRATO.hubbard, vibAt = 1, minVib = 5 } = {}) {
  const ch = {};
  const sorted = [...events].sort((a, b) => a[0] - b[0]);
  sorted.forEach(([row, note, len, extra = {}], i) => {
    const next = i + 1 < sorted.length ? sorted[i + 1][0] : rows;
    const end = Math.min(row + len, next);
    const { glide, ...cell } = extra;
    ch[row] = { note, instrument, ...cell };
    let from = row + vibAt;
    if (glide) {
      for (let r = row + 1; r <= row + glide && r < end; r++) ch[r] = { fx: 'G00' };
      from = Math.max(from, row + glide + 1);
    }
    if (vib && len >= minVib) for (let r = from; r < end; r++) if (!ch[r]) ch[r] = { fx: r === from ? vib : 'H00' };
    if (row + len < next && row + len < rows && !ch[row + len]) ch[row + len] = { note: '==' };
  });
  return ch;
}
// Bars of [row, ...] events -> absolute rows.
const bars = (list) => list.flatMap((rows, b) => rows.map(([r, ...rest]) => [b * BAR + r, ...rest]));
const set = (ch, row, ev) => { ch[row] = { ...ch[row], ...ev }; };

// Voice 1, one bar. drive: the gallop (root on 1, a 16th before 2, the octave on the upbeats), snares
// on 2 and 4; half: kicks on 1 and 3, the octave between; pump: 16th octaves (the boss). The kick is
// in front of the bass note (kit.kickBass); snares and hats sit in the gaps.
function v1Bar(root, kind, { hats = false, end = 'fifth', next } = {}) {
  const r0 = root, oct = up(root, 12), e = [];
  const B = (r, n, i = I.bass) => e.push([r, n, i]);
  const S = (r, i = I.snare) => e.push([r, 'C-5', i]);
  if (kind === 'half') {
    B(0, r0, I.kickBass); B(3, oct); S(4); B(6, r0); B(8, r0, I.kickBass); B(11, oct); S(12); B(14, oct);
    return e;
  }
  if (kind === 'pump') {
    B(0, r0, I.kickBass); B(1, r0); B(2, oct); B(3, r0); S(4); B(5, r0); B(6, oct); B(7, r0);
    B(8, r0, I.kickBass); B(9, r0); B(10, oct); B(11, r0); S(12); B(13, r0); B(14, oct); B(15, next ?? r0);
    return e;
  }
  B(0, r0, I.kickBass); B(3, r0); S(4); B(6, oct); B(7, r0); B(8, r0, I.kickBass); B(10, oct); B(11, r0);
  if (hats) for (const r of [1, 5, 9, 13]) e.push([r, 'C-5', I.hat]);
  if (end === 'fifth') { S(12); B(14, oct); B(15, next ?? up(root, 7)); }
  else if (end === 'roll') for (const r of [12, 13, 14, 15]) S(r, I.roll);
  return e;
}
function v1(list) {
  const ch = {};
  list.forEach((evs, b) => { for (const [r, note, instrument] of evs) ch[b * BAR + r] = { note, instrument }; });
  return ch;
}

// ---------------------------------------------------------------- the loop
const LOOP_ROOTS = { Em: 'E-3', C: 'C-3', Am: 'A-2', B: 'B-2', F: 'F-3' };
// The hook: E, G, B, down to G; the answer settles on the open B.
const HOOK = [[0, 'E-5', 3], [3, 'G-5', 1], [4, 'B-5', 4], [8, 'A-5', 2], [10, 'G-5', 2], [12, 'F#5', 2], [14, 'G-5', 2]];
const ANSWER = [[0, 'E-5', 6], [6, 'D-5', 2], [8, 'E-5', 2], [10, 'G-5', 2], [12, 'B-5', 4]];
const OVER_C = [[0, 'C-6', 3], [3, 'B-5', 1], [4, 'A-5', 4], [8, 'G-5', 2], [10, 'A-5', 2], [12, 'E-5', 4]];
const TURN = [[0, 'D#5', 3], [3, 'E-5', 1], [4, 'F#5', 4], [8, 'B-5', 6], [14, 'A-5', 1], [15, 'G-5', 1]];
const A_LEAD = [HOOK, ANSWER, OVER_C, TURN];
const A2_LEAD = [HOOK,
  [[0, 'E-5', 2], [2, 'G-5', 2], [4, 'B-5', 2], [6, 'E-6', 6], [12, 'D-6', 2], [14, 'B-5', 2]],
  [[0, 'C-6', 3], [3, 'B-5', 1], [4, 'A-5', 2], [6, 'C-6', 2], [8, 'E-6', 4], [12, 'D-6', 2], [14, 'C-6', 2]],
  [[0, 'B-5', 6], [6, 'A-5', 1], [7, 'G-5', 1], [8, 'F#5', 4], [12, 'D#5', 2], [14, 'F#5', 2]]];
const A3_LEAD = [HOOK, ANSWER, OVER_C,
  [[0, 'D#5', 3], [3, 'E-5', 1], [4, 'F#5', 4], [8, 'B-5', 4], [12, 'A-5', 1], [13, 'G-5', 1], [14, 'F#5', 1], [15, 'D#5', 1]]];

// The bell: on 1 and 3, from the chord, an octave above the lead's range.
const TOLLS = { Em: ['E-6', 'E-6'], Em2: ['G-6', 'E-6'], C: ['E-6', 'G-6'], Am: ['C-6', 'E-6'], B: ['D#6', 'F#6'] };
const tolls = (names) => bars(names.map((k) => [[0, TOLLS[k][0], 6], [8, TOLLS[k][1], 6]]));

// A third under the lead, in E harmonic minor (D# in the B chord).
const SCALE = [4, 6, 7, 9, 11, 0, 2];
function third(note, chord) {
  const m = nn(note), pc = m % 12;
  if (pc === 3) return ns(m - 4);                  // D#: the B under it
  if (chord === 'B' && pc === 6) return ns(m - 3); // F#: D# under it
  if (chord === 'B' && pc === 4) return ns(m - 5); // E passing over B: the B under it
  const t = SCALE[(SCALE.indexOf(pc) + 5) % 7];
  return ns(m - ((pc - t + 12) % 12));
}

const intro = {
  bars: 2,
  v1: v1([v1Bar('E-3', 'drive', { end: 'none' }), v1Bar('E-3', 'drive', { next: 'B-2' })]),
  v2: line([[28, 'B-4', 2], [30, 'D#5', 2]], I.lead, { rows: 32 }),
  v3: line(tolls(['Em', 'Em']), I.bell, { rows: 32, vib: null }),
};
const sectionA = {
  bars: 4,
  v1: v1([v1Bar('E-3', 'drive'), v1Bar('E-3', 'drive', { next: 'G-3' }), v1Bar('C-3', 'drive'), v1Bar('B-2', 'drive', { next: 'B-3' })]),
  v2: line(bars(A_LEAD), I.lead, { rows: 64 }),
  v3: line(tolls(['Em', 'Em2', 'C', 'B']), I.bell, { rows: 64, vib: null }),
};
const a2Lead = bars(A2_LEAD);
// The lead's pitch sounding at a row, or null.
const leadAt = (events, row) => {
  const e = events.filter(([r, , len]) => r <= row && row < r + len).at(-1);
  return e ? nn(e[1]) : null;
};
// An echo DELAY rows behind, keeping only notes that sound a consonance (unison, third, fourth,
// fifth, sixth) against the lead on every row they sound (skills/chiptune: the echo test).
const DELAY = 3, CONSONANT = new Set([0, 3, 4, 5, 7, 8, 9]);
const echoOf = (events, rows) => events.map(([r, n, len]) => [r + DELAY, n, Math.min(len, 2)])
  .filter(([r, n, len]) => r < rows && [...Array(len).keys()].every((k) => {
    const l = leadAt(events, r + k);
    return l === null || CONSONANT.has(((nn(n) - l) % 12 + 12) % 12);
  }));
const sectionA2 = {
  bars: 4,
  v1: v1([v1Bar('E-3', 'drive'), v1Bar('E-3', 'drive', { next: 'G-3' }), v1Bar('A-2', 'drive'), v1Bar('B-2', 'drive', { next: 'C-4' })]),
  v2: line(a2Lead, I.lead, { rows: 64 }),
  v3: { 0: { note: '==' }, ...line(echoOf(a2Lead, 64), I.echo, { rows: 64, vib: null }) },
};
const CHORD = { F: ['F-5', 'A-5', 'C-6', 'F-6'], Em: ['E-5', 'G-5', 'B-5', 'E-6'], B: ['D#5', 'F#5', 'B-5', 'D#6'] };
const FIG = [0, 1, 2, 3, 2, 1, 2, 1, 0, 1, 2, 3, 2, 3, 2, 1];
const sectionB = {
  bars: 4,
  v1: v1([v1Bar('F-3', 'half'), v1Bar('E-3', 'half'), v1Bar('F-3', 'half'), v1Bar('B-2', 'drive', { end: 'roll' })]),
  v2: Object.fromEntries(['F', 'Em', 'F', 'B'].flatMap((c, b) => FIG.map((k, r) => [b * BAR + r, { note: CHORD[c][k], instrument: I.pluck }]))),
  v3: line([[0, 'A-4', 16], [16, 'G-4', 16], [32, 'A-4', 16], [48, 'F#4', 16]], I.pad, { rows: 64, vib: vibrato(10, 14), vibAt: 4 }),
};
const a3Lead = bars(A3_LEAD);
const chordAt = (r) => ['Em', 'Em', 'C', 'B'][r >> 4];
const sectionA3 = {
  bars: 4,
  v1: v1([v1Bar('E-3', 'drive', { hats: true }), v1Bar('E-3', 'drive', { hats: true, next: 'G-3' }),
    v1Bar('C-3', 'drive', { hats: true }), v1Bar('B-2', 'drive', { hats: true, end: 'roll' })]),
  v2: line(a3Lead, I.lead, { rows: 64 }),
  v3: line(a3Lead.map(([r, n, len]) => [r, third(n, chordAt(r)), len]), I.harmony, { rows: 64 }),
};

// ---------------------------------------------------------------- the stings
const cleared = {
  bars: 2,
  v1: (() => {
    const ch = v1([[[0, 'E-3', I.kickBass], [4, 'C-5', I.snare], [8, 'E-3', I.kickBass], [12, 'C-5', I.snare], [14, 'B-2', I.bass]],
      [[0, 'E-3', I.kickBass]]]);
    set(ch, 28, { note: '==' });
    return ch;
  })(),
  v2: line([[0, 'B-5', 2], [2, 'E-6', 2], [4, 'G#6', 4], [8, 'B-6', 8], [16, 'E-6', 12]], I.lead, { rows: 32 }),
  v3: line([[0, 'E-5', 14], [16, 'E-6', 12]], I.fanfare, { rows: 32, vib: null }),
};
cleared.v3[16].instrument = I.bell;

const fallen = {
  bars: 4,
  v1: line([[0, 'E-3', 16], [16, 'C-3', 16], [32, 'A-2', 16], [48, 'B-2', 8], [56, 'E-2', 7]], I.lowBass, { rows: 64, vib: null }),
  v2: line([[0, 'E-6', 8], [8, 'D-6', 8], [16, 'C-6', 8], [24, 'B-5', 8], [32, 'A-5', 8], [40, 'G-5', 8], [48, 'F#5', 8], [56, 'E-5', 7]],
    I.knell, { rows: 64, vib: null }),
  v3: line([[0, 'B-4', 16], [16, 'G-4', 16], [32, 'E-4', 16], [48, 'D#4', 8], [56, 'E-4', 7]], I.shroud, { rows: 64, vib: vibrato(12, 10), vibAt: 6, minVib: 8 }),
};

const silence = { bars: 0, rows: 4, v1: { 0: { note: '^^' } }, v2: { 0: { note: '^^' } }, v3: { 0: { note: '^^' } } };

// ---------------------------------------------------------------- the holder (boss)
const BOSS_HARMONY = ['Em', 'F', 'Em', 'F', 'C', 'B', 'Em', 'B'];
const BOSS_ROOT = { Em: 'E-3', F: 'F-3', C: 'C-3', B: 'B-2' };
const BOSS_LEAD = [
  [[0, 'B-5', 6], [6, 'C-6', 2], [8, 'B-5', 4], [12, 'G-5', 2], [14, 'E-5', 2]],
  [[0, 'F-5', 6], [6, 'A-5', 2], [8, 'C-6', 6], [14, 'B-5', 2]],
  [[0, 'E-6', 8], [8, 'D-6', 2], [10, 'C-6', 2], [12, 'B-5', 4]],
  [[0, 'C-6', 4], [4, 'A-5', 4], [8, 'F-6', 8, { fx: 'G20', glide: 3 }]],
  [[0, 'E-6', 6], [6, 'G-6', 2], [8, 'E-6', 4], [12, 'C-6', 4]],
  [[0, 'D#6', 6], [6, 'F#6', 2], [8, 'B-6', 8, { fx: 'G20', glide: 2 }]],
  [[0, 'G-6', 4], [4, 'F#6', 4], [8, 'F-6', 4], [12, 'E-6', 4]],
  [[0, 'D#6', 8], [8, 'B-5', 4], [12, 'F#5', 2], [14, 'G-5', 2]],
];
const bossBars = BOSS_HARMONY.map((c, b) => v1Bar(BOSS_ROOT[c], 'pump', { next: b === 7 ? 'B-3' : undefined }));
// Bar 7 turns to F halfway: its second half pumps F.
bossBars[6] = [...bossBars[6].filter(([r]) => r < 8), ...v1Bar('F-3', 'pump').filter(([r]) => r >= 8)];
const stab = (c) => (c === 'Em' ? I.stabMin : I.stabMaj);
const STAB_NOTE = { Em: 'E-5', F: 'F-5', C: 'C-5', B: 'B-4' };
const boss = {
  bars: 8,
  v1: v1(bossBars),
  v2: line(bars(BOSS_LEAD), I.wail, { rows: 128, vib: VIBRATO.tel, vibAt: 2, minVib: 6 }),
  v3: line(BOSS_HARMONY.flatMap((c, b) => [2, 6, 10, 14].map((r) => {
    const ch = b === 6 && r >= 8 ? 'F' : c;
    return [b * BAR + r, STAB_NOTE[ch], 1, { instrument: stab(ch) }];
  })), I.stabMin, { rows: 128, vib: null }),
};

// ---------------------------------------------------------------- bars -> patterns, orders
const patterns = [], patternIndex = new Map(), order = [];
function place(name, section, { first = {}, last = {} } = {}) {
  const at = order.length;
  const n = section.bars || 1, rows = section.rows ?? BAR;
  for (let b = 0; b < n; b++) {
    const channels = [section.v1, section.v2, section.v3].map((ch) => {
      const out = {};
      for (const [r, ev] of Object.entries(ch)) if (r >= b * rows && r < (b + 1) * rows) out[r - b * rows] = ev;
      return out;
    });
    if (b === 0) for (const [c, ev] of Object.entries(first)) channels[c][0] = { ...channels[c][0], ...ev };
    if (b === n - 1) for (const [c, ev] of Object.entries(last)) channels[c][rows - 1] = { ...channels[c][rows - 1], ...ev };
    const key = JSON.stringify([rows, channels]);
    if (!patternIndex.has(key)) { patternIndex.set(key, patterns.length); patterns.push({ name: `${name} ${b + 1}`, rows, channels }); }
    order.push(patternIndex.get(key));
  }
  return at;
}
const hex = (n) => n.toString(16).toUpperCase().padStart(2, '0');
place('intro', intro);
const LOOP = order.length;
place('A', sectionA);
place("A'", sectionA2);
place('B', sectionB);
place("A''", sectionA3, { last: { 0: { fx: `B${hex(LOOP)}` } } });
const CLEARED = place('cleared', cleared, { last: { 0: { fx: `B${hex(LOOP)}` } } });
const SILENCE_AT = CLEARED + cleared.bars + fallen.bars;
const FALLEN = place('fallen', fallen, { first: { 0: { fx: 'A07' } }, last: { 0: { fx: `B${hex(SILENCE_AT)}` } } });
const SILENCE = place('silence', silence, { last: { 0: { fx: `B${hex(SILENCE_AT)}` } } });
const BOSS = order.length;
place('boss', boss, { first: { 0: { fx: 'A05' } }, last: { 0: { fx: `B${hex(BOSS)}` } } });
if (SILENCE !== SILENCE_AT) throw new Error('the silence is not where the fallen sting jumps');

writeSong(import.meta.url, {
  title: 'Witchfinder (SID)', bpm: 125, ticks: 6,
  message: "Hexwarren's C64 music: the in-Warren loop, the cleared and fallen stings, silence and the holder's music,\n" +
    'written with the sid-music skill. Voice 1 bass + drums, voice 2 lead, voice 3 bells / echo / pad / harmony / stabs\n' +
    '(the sound effects borrow it). Sections: cleared, fallen, silence, boss; order 0 is the loop.',
  sid: {
    model: '6581', author: 'Claude Opus 5.5', released: '2026 Hexwarren', ...RESTART.hubbard,
    loop: LOOP,
    sfx: [
      { name: 'shot', instrument: I.zap, note: 'C-6', frames: 5, tail: 3 },
      { name: 'kill', instrument: I.burst, note: 'C-5', frames: 8, tail: 10 },
      { name: 'death', instrument: I.fall, note: 'G-5', frames: 40, tail: 12 },
      { name: 'promote', instrument: I.rise, note: 'E-5', frames: 12, tail: 4 },
      { name: 'boss', instrument: I.blast, note: 'E-6', frames: 20, tail: 15 },
    ],
    sections: { cleared: CLEARED, fallen: FALLEN, silence: SILENCE, boss: BOSS },
  },
  samples,
  channelnames: ['bass + drums', 'lead', 'bells / echo / pad / harmony / stabs'],
  patterns,
  order,
});
