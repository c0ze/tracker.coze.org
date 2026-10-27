#!/usr/bin/env node
/**
 * Warren Pulse (SID) — Hexwarren's in-Warren loop arranged for the SID's three voices, for
 * the C64 port (hexwarren-c64). The source is ../hexwarren/assets/audio/warren_pulse.it:
 * 8 channels at speed 6, 132 BPM, order 0 1 2 3 3 4 5 6 6 7 7 4 5 8 0.
 *
 * The driver runs at the PAL frame rate, so 6 frames per row is 125 BPM (5% slower).
 *
 * Voice 1: the octave pulse bass on 8ths, staccato (the original drops to v10 on the odd
 *   rows; here a key off does it). The 909 kick lands on the low notes, so those notes use
 *   a kick+bass instrument: a noise click and a falling pulse thump, then the bass.
 * Voice 2: the kit. The soft snare ticks on 8ths, its accents as a real snare, and where
 *   the original has offbeat hats, a hat replaces the tick on those rows.
 * Voice 3: the E drone (patterns 0-2, 5, 8), the E minor / D minor pad as a chord arpeggio in
 *   the instrument (patterns 3-5; the original's J37), then the hunter call with its echo
 *   three rows later on the same voice (6-7). The game's sound effects borrow this voice.
 *
 * Not carried over: the pad's and drone's volume pumping (the SID has no per-voice volume;
 * the drone gets a pulse sweep and a filter opening instead).
 */
import { writeSong } from './lib.js';

const ROWS = 64;
const I = { bass: 0, kickBass: 1, tick: 2, hat: 3, snare: 4, drone: 5, pad: 6, lead: 7, echo: 8, zap: 9, burst: 10, fall: 11, rise: 12,
  major: 13, bell: 14, softPad: 15, heartbeat: 16, blast: 17, kick: 18, stab: 19, snareStab: 20, horn: 21, toll: 22, wail: 23, roll: 24, kickBassShort: 25 };
const n = (note, instrument) => ({ note, instrument });

// Voice 1. kick: rows with a kick (quarters); turn: D instead of E in the last bar.
function bass({ kick = () => false, turn = true, until = ROWS } = {}) {
  const ch = {};
  for (let r = 0; r < until; r += 2) {
    const root = turn && r >= 56 ? 'D' : 'E';
    const note = `${root}-${r % 4 === 0 ? 2 : 3}`;
    ch[r] = n(note, kick(r) ? I.kickBass : I.bass);
    ch[r + 1] = { note: '==' };
  }
  return ch;
}
const quarters = (r) => r % 4 === 0;

// Voice 2. hats: offbeat hats; accents: snare rows; every: tick spacing; until: last row.
function kit({ hats = false, accents = [], every = 2, until = ROWS } = {}) {
  const ch = {};
  for (let r = 0; r < until; r += every) {
    if (accents.includes(r)) ch[r] = n('C-5', I.snare);
    else if (hats && r % 4 === 2) ch[r] = n('C-5', I.hat);
    else ch[r] = n('C-5', I.tick);
  }
  return ch;
}
const BACKBEAT = [8, 24, 40, 56];
const PUSHED = [8, 22, 24, 30, 40, 54, 56, 62];

// Voice 3.
const drone = (from = 0) => ({ [from]: n('E-4', I.drone), 62: { note: '^^' } });
const pad = () => ({ 0: n('E-5', I.pad), 16: n('E-5', I.pad), 32: n('E-5', I.pad), 48: n('D-5', I.pad), 63: { note: '^^' } });
function call(notes) {
  const ch = {};
  notes.forEach((note, i) => {
    ch[i * 8] = n(note, I.lead);
    ch[i * 8 + 3] = n(note, I.echo);
    ch[i * 8 + 7] = { note: '^^' };
  });
  return ch;
}
const CALL_A = ['B-5', 'D-6', 'E-6', 'D-6', 'B-5', 'G-5', 'A-5', 'B-5'];
const CALL_B = ['B-5', 'D-6', 'E-6', 'G-6', 'E-6', 'D-6', 'B-5', 'E-6'];

const pattern = (name, v1, v2, v3) => ({ name, rows: ROWS, channels: [v1, v2, v3] });
const patterns = [
  pattern('0 intro', bass({ turn: false }), {}, drone()),
  pattern('1 ticks', bass({ turn: false }), kit({ accents: [8, 40] }), drone()),
  pattern('2 kick', bass({ kick: quarters }), kit({ accents: BACKBEAT }), drone()),
  pattern('3 pad', bass({ kick: quarters }), kit({ hats: true, accents: BACKBEAT }), pad()),
  pattern('4 pad, pushed snare', bass({ kick: quarters }), kit({ hats: true, accents: PUSHED }), pad()),
  pattern('5 breakdown',
    { ...bass({ kick: (r) => r === 0, turn: false, until: 32 }), 32: { note: '^^' },
      48: n('E-2', I.bass), 52: n('F-2', I.bass), 56: n('G-2', I.bass), 60: n('D-2', I.bass), 63: { note: '==' } },
    kit({ every: 4, until: 48 }),
    { 0: n('E-5', I.pad), 2: { note: '==' }, ...drone(16) }),
  pattern('6 hunter call', bass({ kick: quarters }), kit({ accents: BACKBEAT }), call(CALL_A)),
  pattern('7 hunter call, higher', bass({ kick: quarters }), kit({ hats: true, accents: PUSHED }), call(CALL_B)),
  pattern('8 turnaround', bass({ kick: (r) => quarters(r) && r < 32, turn: false }), kit({ until: 32 }), drone()),
  cleared(),
  fallen(),
  { name: '11 silence (after fallen)', rows: 4, channels: [{ 0: { note: '^^' }, 3: { fx: 'B11' } }, { 0: { note: '^^' } }, { 0: { note: '^^' } }] },
];
// The loop starts at 6 frames a row (the stings change the speed) and closes with a copy of
// the intro that jumps back to the start, so the stings can follow it in the order list.
patterns[0].channels[1] = { 0: { fx: 'A06' } };
patterns.push({ ...patterns[0], name: '12 intro again, then the loop', channels: [patterns[0].channels[0], { 0: { fx: 'A06' }, 63: { fx: 'B00' } }, patterns[0].channels[2]] });

// Section "cleared" (warren_cleared.it, speed 3 at 96 BPM: 4 frames a row): the music-box bell
// climbs E G A B with its echo three rows later; E minor, C, D and G major chords as arpeggios in
// the instrument; the pad's bass notes. It ends by going back to the loop (B00).
function cleared() {
  const bell = {}, chords = {}, low = {};
  ['E-5', 'G-5', 'A-5', 'B-5'].forEach((note, i) => {
    bell[i * 10] = n(note, I.bell);
    bell[i * 10 + 3] = n(note, I.echo);
  });
  [['E-4', I.pad], ['C-4', I.major], ['D-4', I.major], ['G-4', I.major]].forEach(([note, inst], i) => {
    chords[i * 10] = n(note, inst);
    chords[i * 10 + 8] = { note: '==' };
  });
  delete chords[38];
  chords[0].fx = 'A04';
  chords[34] = { note: '==' };                   // the last chord fades out on its release
  ['E-3', 'C-3', 'D-3', 'G-3'].forEach((note, i) => {
    low[i * 10] = n(note, I.softPad);
    low[i * 10 + 8] = { note: '==' };
  });
  delete low[38];
  low[34] = { note: '==' };
  bell[63] = { fx: 'B00' };
  return { name: '9 cleared', rows: 64, channels: [bell, chords, low] };
}

// Section "fallen" (fallen.it, speed 6 at 112 BPM: 7 frames a row): the bell falls from E-5 to
// F#4; a heartbeat, then the lower line from bar three; the cello drone swells and fades. Then
// the silent pattern.
function fallen() {
  const bell = { 0: { fx: 'A07' } }, low = {}, cello = { 0: n('E-2', I.drone), 52: { note: '==' } };
  [[8, 'E-5'], [16, 'D-5'], [24, 'C-5'], [30, 'B-4'], [36, 'A-4'], [42, 'G-4'], [48, 'F#4']].forEach(([r, note]) => {
    bell[r] = n(note, I.bell);
  });
  bell[56] = { note: '==' };
  for (const r of [0, 3, 14, 17, 30, 33]) low[r] = n('C-5', I.heartbeat);
  [[37, 'E-4'], [43, 'D-4'], [49, 'C#4']].forEach(([r, note]) => { low[r] = n(note, I.bell); });
  low[56] = { note: '==' };
  bell[63] = { fx: 'B11' };
  return { name: '10 fallen', rows: 64, channels: [bell, low, cello] };
}

// Section "boss" (crone_duel.it: the Crone and the Red Abbess; E minor, speed 4 at 150 BPM,
// rows are 16ths). 3.33 frames a row at 50 Hz: funktempo plays rows of 4 and 3 frames, so the
// 8ths stay even at 143 BPM. The original's nine channels on three voices:
// - voice 1: the choked octave bass on 8ths (a key off chokes each note), the 909 kick folded
//   into the notes on the beat (a shorter kick than the loop's, so the bass sounds before the choke);
// - voice 2: the duel kit (the loop's backbeat kit: ghost ticks, offbeat hats, the snare on 8, 24,
//   40, 56). The J37 minor stabs take the tick's row; where a stab meets the snare, one
//   instrument plays both. In the breath and the march the voice plays the low horn, then the roll;
// - voice 3: the foreground. The Abbess's bell tolls, the war horn when nothing else is there,
//   and the witch's wail. The wail's glides (G08) go on for two more rows, so they arrive; in the
//   original they stop after one row, a semitone and a half short. Its canon echo is not carried
//   over, nor are the horn's two-row swell pumps (its filter opens over each bar instead).
// It loops to its own start, as the PC game loops crone_duel.it.
const BOSS = 18; // its first order
const OCT = [0, 0, 12, 0, 12, 0, 0, 12];
function bossBass({ turn = true, from = 0, to = 60, octaves = true } = {}) {
  const ch = {};
  for (let r = from; r <= to; r += 2) {
    const root = turn && r >= 48 ? 'D' : 'E';
    ch[r] = n(`${root}-${octaves && OCT[(r / 2) % 8] ? 3 : 2}`, quarters(r) ? I.kickBassShort : I.bass);
    ch[r + 1] = { note: '==' };
  }
  return ch;
}
// Stabs: [row, 'a' root | 'b' fifth]; on a snare row the stab carries the snare.
function duelKit({ stabs = [], turn = false, accents = BACKBEAT, until = ROWS } = {}) {
  const ch = kit({ hats: true, accents, until });
  for (const [r, kind] of stabs) {
    const root = kind === 'b' ? 'G-4' : turn && r >= 48 ? 'D-4' : 'E-4';
    ch[r] = n(root, accents.includes(r) ? I.snareStab : I.stab);
  }
  return ch;
}
const STABS_OFF = [[4, 'a'], [12, 'b'], [20, 'a'], [28, 'b'], [36, 'a'], [44, 'b'], [52, 'a'], [60, 'b']];
const STABS_ANSWER = [[8, 'a'], [12, 'b'], [24, 'a'], [28, 'b'], [40, 'a'], [44, 'b'], [56, 'a'], [60, 'b']];
// The war horn, struck each bar; D in the last bar on the turnaround.
function horn({ from = 0, note = 'E-4', turn = true, vol, until = ROWS } = {}) {
  const ch = {};
  for (let r = from; r < until; r += 16) ch[r] = { ...n(turn && r >= 48 ? 'D-4' : note, I.horn), ...(vol && { vol }) };
  if (until === ROWS) ch[62] = { note: '==' };
  return ch;
}
function tolls(list) {
  const ch = {};
  for (const [r, note] of list) {
    ch[r] = n(note, I.toll);
    if (r + 14 < ROWS) ch[r + 14] = { note: '==' };
  }
  return ch;
}
// The wail: [row, note, 'H' vibrato | 'G' glide] and a final key off. A glide keeps going for
// two more rows (G00) so it arrives; a held note keeps its vibrato (H00) to the next note.
function wail(events) {
  const ch = {};
  events.forEach(([r, note, kind], i) => {
    if (note === '==') { ch[r] = { note }; return; }
    const next = events[i + 1][0];
    ch[r] = { ...n(note, I.wail), fx: kind === 'G' ? 'G08' : 'H42' };
    for (let k = r + 1; k < next; k++) ch[k] = { fx: kind === 'G' && k <= r + 2 ? 'G00' : 'H00' };
  });
  return ch;
}
const WAIL_A = [[0, 'E-6', 'H'], [12, 'G-6', 'G'], [24, 'B-6', 'G'], [32, 'D-7', 'G'], [44, 'B-6', 'G'], [52, 'G-6', 'H'], [60, '==']];
const WAIL_PEAK = [[0, 'G-6', 'H'], [10, 'B-6', 'G'], [20, 'D-7', 'G'], [30, 'F#7', 'G'], [42, 'D-7', 'G'], [50, 'B-6', 'H'], [58, '==']];
// The climax chain: a seven-note aeolian descent on 8ths against the four-beat bar.
function chain() {
  const seq = ['B-6', 'A-6', 'G-6', 'F#6', 'E-6', 'D-6', 'B-5'], ch = {};
  for (let i = 0; i <= 30; i++) ch[i * 2] = { ...n(seq[i % 7], I.wail), vol: i % 2 ? 'v40' : 'v56' };
  ch[62] = { note: '==' };
  return ch;
}

const bossPatterns = [
  ['ceremony: the tolls alone', { ...horn({ from: 32, turn: false, vol: 'v40' }), 0: { fx: 'T96' } }, { 0: { fx: 'A04' } },
    tolls([[0, 'E-5'], [16, 'E-5'], [32, 'D-5'], [48, 'B-4']])],
  ['the band answers', (() => {
    const ch = {};
    [8, 10, 12, 24, 26, 28, 40, 42, 44].forEach((r, i) => {
      ch[r] = n(i % 3 === 1 ? 'E-3' : 'E-2', quarters(r) ? I.kickBassShort : I.bass);
      ch[r + 1] = { note: '==' };
    });
    return { ...ch, 48: n('E-2', I.kickBassShort), 49: { note: '==' }, 56: n('D-2', I.kickBassShort), 57: { note: '==' } };
  })(), (() => {
    const ch = { 52: n('C-5', I.hat), 56: n('C-5', I.snare), 60: n('C-5', I.hat) };
    for (const r of [10, 26, 42]) ch[r] = n('C-5', I.snare);
    for (const [r, kind] of [[8, 'a'], [12, 'b'], [24, 'a'], [28, 'b'], [40, 'a'], [44, 'b']]) ch[r] = n(kind === 'b' ? 'G-4' : 'E-4', I.stab);
    ch[48] = n('E-4', I.snareStab);
    return ch;
  })(), { ...tolls([[0, 'E-5'], [16, 'G-5'], [32, 'E-5']]), ...horn({ from: 48, turn: false }) }],
  ['drive', bossBass(), duelKit(), horn()],
  ['drive + stabs', bossBass(), duelKit({ stabs: STABS_OFF, turn: true }), horn()],
  ['bell duel', bossBass({ turn: false }), duelKit({ stabs: STABS_ANSWER }), tolls([[0, 'E-5'], [16, 'D-5'], [32, 'G-5'], [48, 'B-4']])],
  ['wail', bossBass(), duelKit(), wail(WAIL_A)],
  ['wail peak', bossBass({ turn: false }), duelKit(), wail(WAIL_PEAK)],
  ['breath', { 0: n('C-5', I.kick), 32: n('C-5', I.kick) }, horn({ note: 'E-3', turn: false, vol: 'v40' }),
    tolls([[0, 'E-5'], [32, 'B-4']])],
  ['march', { 32: n('C-5', I.kick), 36: n('C-5', I.kick), 40: n('C-5', I.kick), 44: n('C-5', I.kick), ...bossBass({ turn: false, from: 48 }) },
    (() => {
      const ch = {};
      for (let r = 0; r < ROWS; r += 2) {
        const base = [18, 24, 30, 36][r >> 4];
        ch[r] = { ...n('C-5', I.roll), vol: `v${BACKBEAT.includes(r) ? base + 16 : base}` };
        ch[r + 1] = { note: '==' };
      }
      return ch;
    })(), horn({ from: 32, turn: false, vol: 'v48' })],
  ['climax: the chain', bossBass(), duelKit({ stabs: STABS_OFF, turn: true }), chain()],
  ['strip', { ...bossBass({ turn: false, to: 30, octaves: false }), 40: n('C-5', I.kick), 48: n('C-5', I.kick), 56: n('C-5', I.kick),
    32: n('C-5', I.kick) },
  (() => {
    const ch = kit({ hats: true, accents: [8, 24], until: 32 });
    for (let r = 34; r < ROWS; r += 4) ch[r] = n('C-5', I.hat);
    return { ...ch, 56: n('C-5', I.snare) };
  })(), { ...horn({ from: 32, turn: false, until: 48 }), ...tolls([[48, 'E-5']]) }],
  ['rebuild and cadence, then the start', bossBass({ turn: false }),
    { ...duelKit({ stabs: [[22, 'a'], [30, 'b'], [48, 'a']] }), 63: { fx: `B${BOSS.toString(16).padStart(2, '0').toUpperCase()}` } },
    { ...horn({ turn: false, until: 32 }), ...wail([[32, 'E-6', 'H'], [38, 'G-6', 'G'], [44, '==']]), ...tolls([[48, 'E-5'], [56, 'B-4']]) }],
];
const B0 = patterns.length;
for (const [name, ...channels] of bossPatterns) patterns.push(pattern(`${patterns.length} boss: ${name}`, ...channels));
// crone_duel.it's order list.
const BOSS_ORDER = [0, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6, 4, 3, 5, 7, 8, 9, 9, 4, 6, 6, 10, 2, 3, 9, 11].map((p) => B0 + p);

const PULSE_BASS = { width: 0x500, speed: 12, min: 0x300, max: 0xa00 };
if (BOSS !== 18) throw new Error('BOSS must be the first order after the stings');
writeSong(import.meta.url, {
  title: 'Warren Pulse (SID)', bpm: 125, ticks: 6,
  message: "Hexwarren's in-Warren loop (warren_pulse.it) for the SID's three voices + sound effects.\n" +
    'Voice 1 bass + kick, voice 2 kit, voice 3 drone / pad / hunter call. Sections: the cleared and fallen stings\n' +
    'and the boss music (crone_duel.it). Source: songs/hexwarren_warren_pulse_sid.gen.js',
  sid: {
    model: '6581', author: 'Hexwarren', released: '2026',
    // The game's sound effects, on voice 3 (hexwarren-c64 plays them by number).
    sfx: [
      { name: 'shot', instrument: I.zap, note: 'C-6', frames: 5, tail: 3 },
      { name: 'kill', instrument: I.burst, note: 'C-5', frames: 8, tail: 10 },
      { name: 'death', instrument: I.fall, note: 'G-5', frames: 40, tail: 12 },
      { name: 'promote', instrument: I.rise, note: 'E-5', frames: 12, tail: 4 },
      { name: 'boss', instrument: I.blast, note: 'E-6', frames: 20, tail: 15 },
    ],
    // Stings in the same song, started by the game (sid/FORMAT.md, "Sections").
    sections: { cleared: 15, fallen: 16, silence: 17, boss: BOSS },
    funktempo: true, // the boss section's speed 4 at 150 BPM: rows of 4 and 3 frames
  },
  samples: [
    { name: 'pulse bass', sid: { adsr: [0, 6, 10, 3], wave: [['pulse']], pulse: PULSE_BASS } },
    { name: 'kick + bass', sid: { adsr: [0, 7, 10, 3], wave: [['noise', 'C-7'], ['pulse', 'A-4'], ['pulse', 'E-4'], ['pulse', 'B-3'], ['pulse', 0]], pulse: PULSE_BASS } },
    { name: 'tick', sid: { adsr: [0, 2, 0, 0], wave: [['noise', 'C#7']] } },
    { name: 'hat', sid: { adsr: [0, 1, 0, 0], wave: [['noise', 'G-8']] } },
    { name: 'snare', sid: { adsr: [0, 7, 0, 0], wave: [['noise', 'D-7'], ['pulse', 'G-4'], ['noise', 'C-7'], ['noise', 'A-6']], pulse: { width: 0x800 } } },
    { name: 'drone', sid: { adsr: [9, 0, 12, 9], wave: [['pulse']], pulse: { width: 0x300, speed: 6, min: 0x200, max: 0xd00 },
      filter: { mode: 'low', resonance: 8, cutoff: 500, speed: 1, max: 1200 } } },
    { name: 'pad arpeggio', sid: { adsr: [2, 8, 9, 10], wave: [['pulse', 0], ['pulse', 3], ['pulse', 7]], loop: 0, pulse: { width: 0x800, speed: 20, min: 0x400, max: 0xc00 } } },
    { name: 'hunter call', sid: { adsr: [1, 6, 10, 5], wave: [['saw']] } },
    { name: 'call echo', sid: { adsr: [0, 4, 4, 5], wave: [['tri']] } },
    { name: 'sfx zap', sid: { adsr: [0, 5, 0, 0], wave: [['pulse', 12], ['pulse', 7], ['pulse', 2], ['pulse', -3], ['pulse', -8], ['pulse', -13]], pulse: { width: 0x400 } } },
    { name: 'sfx burst', sid: { adsr: [0, 8, 0, 0], wave: [['noise', 'C-7'], ['noise', 'A-6'], ['noise', 'F-6'], ['noise', 'D-6'], ['noise', 'A-5'], ['noise', 'F-5'], ['noise', 'C-5']] } },
    { name: 'sfx fall', sid: { adsr: [0, 0, 15, 8], wave: [...Array(36)].map((_, i) => ['saw', -i]) } },
    { name: 'sfx rise', sid: { adsr: [0, 6, 0, 0], wave: [['pulse', 0], ['pulse', 0], ['pulse', 4], ['pulse', 4], ['pulse', 7], ['pulse', 7], ['pulse', 12]], pulse: { width: 0x600 } } },
    { name: 'major arpeggio', sid: { adsr: [0, 8, 9, 10], wave: [['pulse', 0], ['pulse', 4], ['pulse', 7]], loop: 0, pulse: { width: 0x800, speed: 20, min: 0x400, max: 0xc00 } } },
    { name: 'music-box bell', sid: { adsr: [0, 9, 0, 9], wave: [['tri']] } },
    { name: 'soft pad', sid: { adsr: [3, 0, 12, 9], wave: [['tri']] } },
    { name: 'heartbeat', sid: { adsr: [0, 6, 0, 0], wave: [['noise', 'C-6'], ['pulse', 'C-3'], ['pulse', 'A-2'], ['pulse', 'F-2']], pulse: { width: 0x800 } } },
    { name: 'sfx blast', sid: { adsr: [0, 10, 0, 0], wave: [...Array(14)].map((_, i) => [i % 3 === 1 ? 'pulse' : 'noise', -2 * i]), pulse: { width: 0x800 } } },
    // The boss section's own.
    { name: 'kick', sid: { adsr: [0, 6, 0, 0], wave: [['noise', 'C-7'], ['pulse', 'A-4'], ['pulse', 'E-4'], ['pulse', 'B-3'], ['pulse', 'G-3'], ['pulse', 'E-3']], pulse: { width: 0x800 } } },
    { name: 'minor stab', sid: { adsr: [0, 7, 0, 0], wave: [['pulse', 0], ['pulse', 3], ['pulse', 7]], loop: 0, pulse: { width: 0x300 } } },
    { name: 'snare + stab', sid: { adsr: [0, 8, 0, 0], wave: [['noise', 'D-7'], ['noise', 'C-7'], ['pulse', 0], ['pulse', 3], ['pulse', 7]], loop: 2, pulse: { width: 0x300 } } },
    { name: 'war horn', sid: { adsr: [9, 0, 10, 6], wave: [['pulse']], pulse: { width: 0x600, speed: 16, min: 0x300, max: 0xb00 },
      filter: { mode: 'low', resonance: 9, cutoff: 320, speed: 2, max: 1400 } } },
    { name: 'abbess bell', sid: { adsr: [0, 10, 0, 6], wave: [['pulse', 12], ['tri', 0]], pulse: { width: 0x400 } } },
    { name: 'witch wail', sid: { adsr: [2, 0, 15, 8], wave: [['tri']], pulse: { width: 0x800 } } }, // stops the horn's sweep
    { name: 'march roll', sid: { adsr: [0, 0, 8, 1], wave: [['noise', 'D-7'], ['noise', 'A-6'], ['noise', 'F-6']], pulse: { width: 0x800 } } },
    // The loop's kick + bass reaches the bass on frame 4, when a 4-frame row's choke closes the gate.
    { name: 'kick + bass, short', sid: { adsr: [0, 7, 10, 3], wave: [['noise', 'C-7'], ['pulse', 'G-4'], ['pulse', 0]], pulse: PULSE_BASS } },
  ],
  channelnames: ['bass + kick', 'kit', 'drone / pad / call'],
  patterns,
  order: [0, 1, 2, 3, 3, 4, 5, 6, 6, 7, 7, 4, 5, 8, 12, 9, 10, 11, ...BOSS_ORDER],
});
