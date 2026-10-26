#!/usr/bin/env node
/**
 * HELIOBANE stage 1 "Tharsis Rust", arranged for 4 Paula channels (Amiga port,
 * exported with tools/json2mod.js). Source: heliobane_stage1.gen.js, whose
 * material is copied here unchanged (riffs, grooves, chords, melodies, form);
 * keep the two in step by hand.
 * E minor -> F# minor, 168 BPM, speed 6: 4 rows/beat, 16 rows/bar. Same form,
 * order list and loop (orders 1-10, B01 on the solo's last row).
 *
 * Channels (Paula 0 and 3 play left, 1 and 2 right):
 *   0 drums  kick + snare (snare wins a shared row); hats fill rows that do
 *            not cut a kick after one row, when channel 3 is busy
 *   1 riff   guitar and bass merged: they played the same rhythm in unison,
 *            so one "power chord + sub" loop carries both. Dust: saw bass alone
 *   2 lead   lead / whistle
 *   3 colour hats (intro, A, riff), the lead's echo (A2, B, dust, solo), the
 *            written harmony (A up, B up), the noise riser (build); a crash on
 *            each section's first row when the channel is free for 3 rows
 * Dropped: the J-arpeggio pulses (A2, B, A up, B up) and the per-channel pans.
 * MOD cells hold one effect: volume stamps are removed on rows that carry
 * vibrato (the note holds its level instead of decaying), and the riser
 * alternates volume rows with slide rows.
 */
import { kick, snare, cymbal, noiseLoop, wave, pwm, BASS_AMPS,
  mel, line, echoOf, chart, bass, harmony, beat, rep, jump, writeSongCompact } from './heliobane_title.kit.js';

const I = { kick: 0, snare: 1, hat: 2, ohat: 3, crash: 4, bass: 5, riff: 6, lead: 7, whistle: 8, noise: 9 };
const K = { X: [I.kick, 64], x: [I.kick, 50] };
const S = { X: [I.snare, 58], x: [I.snare, 42], g: [I.snare, 16] };
const H = { X: [I.hat, 30], x: [I.hat, 20], g: [I.hat, 11], o: [I.ohat, 24] };

// ---------------------------------------------------------------- from heliobane_stage1.gen.js
const RE1 = 'Rr.Rr.3-Rr.6-5-3', RE2 = 'Rr.Rr.3-Rr.5-3-2', RE1a = 'Rr.Rr.3-Rr.o-5-3';
const CHUG = 'R-.rr.R-.rr.R.rr', CHUG2 = 'R-.rr.R-.R.R.RRR', HALF = 'R-------r-------';
const RIFF = { A: [RE1a, RE2, CHUG, CHUG, RE1a, RE2, CHUG, CHUG2], B: [CHUG, CHUG, RE1a, RE2, CHUG, CHUG, CHUG, CHUG2],
  riff: [RE1, RE2, RE1, CHUG2], dust: [HALF], build: [CHUG, CHUG, 'RrRrRrRrRrRrRrRr', 'R.R.R.R.RrRrRRRR'] };
const G = {
  main: { kick: 'X.x...X.X.x...X.', snare: '....X.......X...', hat: 'XgxgXgxgXgxgXgxg' },
  riff: { kick: 'XX.XX...XX......', snare: '....X.......X...', hat: 'x.x.x.x.x.x.x.x.' },
  dust: { kick: 'X.........X.....', snare: '........X.......', hat: 'x...x...x...x.o.' },
  solo: { kick: 'X...X...X...X...', snare: '....X.......X...', hat: '..o...o...o...o.' },
  fill: { kick: 'X.x...X.X.......', snare: '....X...X.xxXXXX', hat: 'XgxgXgxgX.......' },
};
const CH = {
  A: 'Em Em C D Em Em C B7', B: 'C D Em Em C D B B', riff: 'E5 E5 E5 E5', dust: 'Em C Am B Em C F B',
  build: 'Em C D C#', solo: 'Em Em C D Em Em C B7',
};
const A_MEL = 'e5/3 g5/3 a5/2 b5/4 d6/2 b5/2 | a5/3 g5/3 e5/2 g5/8 | e5/3 g5/3 a5/2 c6/4 b5/2 a5/2 | b5/3 a5/3 f#5/2 a5/8'
  + ' | e5/3 g5/3 a5/2 b5/4 d6/2 e6/2 | g6/3 f#6/3 e6/2 d6/4 b5/4 | c6/3 b5/3 a5/2 g5/4 e5/4 | f#5/3 a5/3 b5/2 d#6/8~';
const B_MEL = 'g5/6 e5/2 g5/4 c6/4 | a5/6 f#5/2 a5/4 d6/4 | b5/6 g5/2 b5/4 e6/4 | g6/8~ f#6/4 e6/4'
  + ' | e6/6 d6/2 c6/4 g5/4 | f#6/6 e6/2 d6/4 a5/4 | b5/4 d#6/4 f#6/8~ | f#6/4 e6/2 d#6/2 b5/8';
const DUST_MEL = 'e5/4 b5/12~ | a5/2 g5/2 e5/12~ | c6/4 e6/12~ | f#6/4 d#6/12~ | e6/4 g6/12~ | e6/2 d6/2 c6/12~ | a5/4 c6/4 f6/8~ | f#6/8 d#6/8~';
const BUILD_MEL = 'e5/4 g5 b5 e6 | e6/4 g6 e6 c6 | d6/4 f#6 a6 f#6 | g#6/16~';
const SOLO_MEL = 'e6/1 d6 b5 a5 g5 a5 b5 d6 e6/2 d6/1 b5 d6/4 | g6/2 e6/1 d6 e6/2 b5 d6 e6/6'
  + ' | c6/1 b5 a5 g5 e5 g5 a5 c6 e6/4 g6 | f#6/2 e6/1 d6 a5/4 d6/2 f#6 a6/4'
  + ' | b6/4 a6/2 g6 e6/1 d6 b5 d6 e6/4 | g6/1 f#6 e6 d6 e6 d6 b5 a5 b5/4 e6'
  + ' | c6/2 e6 g6 c7/6~ b6/2 g6 | a6/2 f#6 d#6 b5 f#6/8~';

// ---------------------------------------------------------------- 4-channel helpers
/** One effect per MOD cell: a row with vibrato keeps its effect, not a volume step. */
function oneEffect(ch) {
  const out = {};
  for (const [r, e] of Object.entries(ch)) out[r] = e.fx && e.vol && !e.note ? { fx: e.fx } : e;
  return out;
}
/** Kick and snare on one channel; hats only where they would not cut a kick after one row. */
function drumLane(kickCh, snareCh, hatCh, rows) {
  const ch = {};
  for (let r = 0; r < rows; r++) {
    const hit = snareCh[r] ?? kickCh[r];
    if (hit) ch[r] = hit;
    else if (hatCh?.[r] && ch[r - 1]?.instrument !== I.kick) ch[r] = hatCh[r];
  }
  return ch;
}
const crashEv = { note: 'C-5', instrument: I.crash, vol: 'v40' };
function withCrash(colour) {
  if ([0, 1, 2].some((r) => colour[r])) return colour;
  return { ...colour, 0: crashEv };
}

function section(name, bars, chordStr, { semi = 0, melody, riff, groove = G.main, fill = true, colour = 'hats',
  inst = I.lead, delay = 3, riffVol = 36, crash = true, over = {} } = {}) {
  const rows = bars * 16, segs = chart(chordStr, { semi }), f = fill ? G.fill : {};
  const k = over.kick ?? beat(rep(bars, groove.kick, f.kick), K);
  const s = over.snare ?? beat(rep(bars, groove.snare, f.snare), S);
  const h = over.hat ?? beat(rep(bars, groove.hat, f.hat), H);
  const parts = { riff: over.riff ?? bass(segs, riff, I.riff, { rows, lo: 'A-3', vol: riffVol, soft: 0.75 }) };
  let notes = null;
  if (melody) {
    notes = mel(melody, { semi, vol: 44 });
    parts.lead = oneEffect(line(notes, inst, { rows }));
  }
  if (colour === 'hats') {
    parts.colour = h;
    if (crash) {
      for (let r = 1; r < 8; r++) delete parts.colour[r];
      parts.colour[0] = crashEv;
    }
  } else {
    if (colour === 'echo') parts.colour = oneEffect(echoOf(parts.lead, notes, { delay, scale: 0.45, rows }));
    if (colour === 'harm') parts.colour = line(harmony(notes, segs), I.lead, { rows, vib: null });
    if (colour === 'riser') parts.colour = over.colour;
    if (crash) parts.colour = withCrash(parts.colour);
  }
  parts.drums = drumLane(k, s, colour === 'hats' ? null : h, rows);
  const channels = ['drums', 'riff', 'lead', 'colour'].map((key) => parts[key] ?? { 0: { note: '^^' } });
  return { name, rows, channels };
}

// Build: noise riser (volume rows and slide rows alternate), snare to retrigs.
const riser = { 32: { note: 'C-4', instrument: I.noise, vol: 'v4' } };
for (let r = 33; r < 64; r++) riser[r] = r % 2 ? { fx: 'F04' } : { vol: `v${4 + Math.round((r - 32) * 1.1)}` };
// The PC's last bar is 32nd retrigs rising v22..v52. A MOD cell cannot hold a
// volume and a retrig, so: 16ths rising for half a bar, then retrigs at the
// snare's default volume (v58 needs no Cxx, leaving the cell to E93).
const buildSnare = beat(['....X.......X...', '..x...x...x...x.', 'x.x.x.x.x.x.x.x.', '................'], S);
for (let i = 0; i < 8; i++) buildSnare[48 + i] = { note: 'C-5', instrument: I.snare, vol: `v${22 + i * 4}` };
for (let i = 8; i < 16; i++) buildSnare[48 + i] = { note: 'C-5', instrument: I.snare, vol: 'v58', fx: 'Q03' };
const introKick = beat(['................', '................', 'X.x...X.X.x...X.', 'X.x...X.X.......'], K);

/** Guitar + bass as one loop: the power chord (root, fifth, octave, distorted)
 * over a saw sub an octave below the root. C-5 plays a C power chord. */
function riffChord(name, { drive = 4, cyc = 256, sub = 0.5 } = {}) {
  const TAU = 2 * Math.PI, d = [];
  for (let i = 0; i < cyc; i++) {
    let s = 0;
    for (const [mult, w] of [[2, 1], [3, 0.75], [4, 0.45]]) for (let k = 1; k <= 12; k++) s += w * Math.sin(TAU * k * mult * i / cyc) / k;
    const low = BASS_AMPS.reduce((a, amp, k) => a + amp * Math.sin(TAU * (k + 1) * i / cyc), 0);
    d.push(Math.tanh(drive * s / 3) + sub * low / 2.2);
  }
  const m = Math.max(...d.map(Math.abs));
  return { name, samplerate: 44100, c5speed: Math.round((cyc / 2) * 261.6256),
    channels: [d.map((v) => Math.round((v / m) * 0.9 * 1000) / 1000)], loop: { start: 0, end: cyc } };
}

const riffSec = section('riff interlude', 4, CH.riff, { riff: RIFF.riff, groove: G.riff, riffVol: 42 });
const patterns = [
  section('intro: riff', 4, CH.riff, { riff: RIFF.riff, riffVol: 42, crash: false, over: { kick: introKick,
    snare: beat(['................', '................', '....X.......X...', '....X...X.xxXXXX'], S),
    hat: beat(['................', '................', 'x.x.x.x.x.x.x.x.', 'x.x.x.x.x.......'], H) } }),
  section('A: hook', 8, CH.A, { melody: A_MEL, riff: RIFF.A }),
  section('A2: hook + echo', 8, CH.A, { melody: A_MEL, riff: RIFF.A, colour: 'echo' }),
  section('B: rising sequence', 8, CH.B, { melody: B_MEL, riff: RIFF.B, colour: 'echo' }),
  riffSec,
  section('dust: half-time whistle', 8, CH.dust, { melody: DUST_MEL, groove: G.dust, inst: I.whistle, colour: 'echo',
    delay: 6, fill: false, over: { riff: bass(chart(CH.dust), RIFF.dust, I.bass, { rows: 128, lo: 'C-3', vol: 40, soft: 0.8 }) } }),
  section('build to F# minor', 4, CH.build, { melody: BUILD_MEL, riff: RIFF.build, fill: false, colour: 'riser', crash: false,
    over: { colour: riser, snare: buildSnare, kick: beat(['X.......X.......', 'X...X...X...X...', 'X.X.X.X.X.X.X.X.', 'X...X...X...X...'], K) } }),
  section('A up: F# minor + harmony', 8, CH.A, { melody: A_MEL, riff: RIFF.A, semi: 2, colour: 'harm' }),
  section('B up: F# minor', 8, CH.B, { melody: B_MEL, riff: RIFF.B, semi: 2, colour: 'harm' }),
  jump(section('solo', 8, CH.solo, { melody: SOLO_MEL, riff: RIFF.A, groove: G.solo, colour: 'echo', delay: 2 }), 1), // -> order 1
];

writeSongCompact(import.meta.url, {
  title: 'Heliobane - Tharsis Rust 4ch', bpm: 168, ticks: 6, mixvol: 48,
  message: 'HELIOBANE stage 1 "Tharsis Rust", 4-channel Amiga arrangement.\nE minor -> F# minor, 168 BPM. Orders 1-10 loop.\n'
    + 'All samples synthesized. Source: songs/heliobane_stage1_amiga.gen.js; MOD via tools/json2mod.js',
  samples: [
    kick({ f0: 240, decay: 12 }), snare({ tone: 200, decay: 18, seed: 17, drive: 2.2 }), cymbal('hat closed', { seed: 13 }),
    cymbal('hat open', { sec: 0.3, decay: 10, seed: 14 }), cymbal('crash', { sec: 1.3, decay: 2.6, seed: 18, metalMix: 0.35 }),
    wave('saw bass', BASS_AMPS), riffChord('riff chord'), pwm('pwm lead', { lo: 0.1, hi: 0.4, cycles: 80 }),
    wave('whistle', [1, 0.06, 0.04]), noiseLoop(),
  ],
  channelnames: ['drums', 'riff', 'lead', 'colour'],
  patterns,
  order: [0, 1, 2, 3, 4, 5, 6, 7, 8, 4, 9], // pattern 4 (riff) returns before the solo
});
