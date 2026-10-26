#!/usr/bin/env node
/**
 * HELIOBANE stage 1 — "Tharsis Rust" (the mining belt). MUSIC-A, 2026-09-24.
 * E minor (→ F# minor), 168 BPM, speed 6: 4 rows/beat, 16 rows/bar, 8 bars = 11.4 s.
 *
 * Identity: a galloping 16th power-chord riff (guitar + bass in unison) whose
 * turnaround digs through the flat fifth: E E . E E . G— E E . Bb— A— G.
 *
 * Phrase map
 *   Intro   riff alone, drums join with a fill (not looped)
 *   A       Em Em C D / Em Em C B     3-3-2 hook "E G A | B——", answer peaks G6, opens on B7
 *   A2      same + dotted-8th echo and J-arp pulses
 *   B       C D Em Em C D B B         rising sequence G→A→B, long notes, B major lift
 *   Riff    four bars of riff and snare, lead rests
 *   Dust    Em C Am B Em C F B        half time, lonely whistle with a 6-row echo (F = Phrygian bII)
 *   Build   Em C D C#                 snare to 32nd retrigs, noise riser
 *   A↑ B↑   F# minor with written harmony
 *   Riff    back in E, abrupt and heavy
 *   Solo    riff chords, 16th pentatonic runs over a four-on-the-floor kick
 * Loop body: orders 1–10 (68 bars, 97 s).
 */
import { kick, snare, cymbal, noiseLoop, wave, pwm, powerChord, BASS_AMPS,
  mel, line, echoOf, chart, arp, bass, harmony, beat, rep, pattern, jump, writeSongCompact } from './heliobane_title.kit.js';

const I = { kick: 0, snare: 1, hat: 2, ohat: 3, crash: 4, bass: 5, gtr: 6, arp: 7, lead: 8, whistle: 9, noise: 10 };
const LAYOUT = ['kick', 'snare', 'hat', 'bass', 'gtr', 'arp', 'lead', 'echo', 'crash'];
const PANS = [0x80, 0x78, 0xb0, 0x80, 0x5c, 0xa8, 0x88, 0x50, 0x9c];
const K = { X: [I.kick, 64], x: [I.kick, 50] };
const S = { X: [I.snare, 58], x: [I.snare, 42], g: [I.snare, 16] };
const H = { X: [I.hat, 30], x: [I.hat, 20], g: [I.hat, 11], o: [I.ohat, 24] };

// ---------------------------------------------------------------- riff & grooves
const RE1 = 'Rr.Rr.3-Rr.6-5-3', RE2 = 'Rr.Rr.3-Rr.5-3-2', RE1a = 'Rr.Rr.3-Rr.o-5-3'; // RE1a: no b5 under the hook
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

// ---------------------------------------------------------------- melodies
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

// ---------------------------------------------------------------- sections
function drums(bars, g, fill = true) {
  const f = fill ? G.fill : {};
  return { kick: beat(rep(bars, g.kick, f.kick), K), snare: beat(rep(bars, g.snare, f.snare), S), hat: beat(rep(bars, g.hat, f.hat), H) };
}
const crash = { 0: { note: 'C-5', instrument: I.crash, vol: 'v40' } };
function section(name, bars, chordStr, { semi = 0, melody, riff, groove = G.main, fill = true, echo = false, harm = false,
  arps = false, inst = I.lead, delay = 3, gtrVol = 30, extra = {} } = {}) {
  const rows = bars * 16, segs = chart(chordStr, { semi });
  const parts = { ...drums(bars, groove, fill), crash,
    bass: bass(segs, riff, I.bass, { rows, lo: 'C-3', vol: 40, soft: 0.8 }),
    gtr: bass(segs, riff, I.gtr, { rows, lo: 'A-3', vol: gtrVol, soft: 0.75 }) };
  if (arps) parts.arp = arp(segs, ['X-x-X-x-X-x-X-x-'], I.arp, { rows, lo: 'G-4', vol: 18 });
  if (melody) {
    const notes = mel(melody, { semi, vol: 44 }), ch = line(notes, inst, { rows });
    parts.lead = ch;
    if (echo) parts.echo = echoOf(ch, notes, { delay, scale: 0.45, rows });
    if (harm) parts.echo = line(harmony(notes, segs), I.lead, { rows, vib: null });
  }
  return pattern(name, bars, { ...parts, ...extra }, LAYOUT, PANS);
}

const riser = { 32: { note: 'C-4', instrument: I.noise, vol: 'v4' } };
for (let r = 33; r < 64; r++) riser[r] = { vol: `v${4 + Math.round((r - 32) * 1.1)}`, fx: 'F03' };
const buildSnare = beat(['....X.......X...', '..x...x...x...x.', 'x.x.x.x.x.x.x.x.', '................'], S);
for (let i = 0; i < 16; i++) buildSnare[48 + i] = { note: 'C-5', instrument: I.snare, vol: `v${22 + i * 2}`, fx: 'Q03' };
const introKick = beat(['................', '................', 'X.x...X.X.x...X.', 'X.x...X.X.......'], K);

const riffSec = section('riff interlude', 4, CH.riff, { riff: RIFF.riff, groove: G.riff, gtrVol: 38 });
const patterns = [
  section('intro: riff', 4, CH.riff, { riff: RIFF.riff, gtrVol: 38, extra: { crash: undefined, kick: introKick,
    snare: beat(['................', '................', '....X.......X...', '....X...X.xxXXXX'], S),
    hat: beat(['................', '................', 'x.x.x.x.x.x.x.x.', 'x.x.x.x.x.......'], H) } }),
  section('A: hook', 8, CH.A, { melody: A_MEL, riff: RIFF.A }),
  section('A2: hook + echo + arps', 8, CH.A, { melody: A_MEL, riff: RIFF.A, echo: true, arps: true }),
  section('B: rising sequence', 8, CH.B, { melody: B_MEL, riff: RIFF.B, echo: true, arps: true }),
  riffSec,
  section('dust: half-time whistle', 8, CH.dust, { melody: DUST_MEL, riff: RIFF.dust, groove: G.dust, inst: I.whistle,
    echo: true, delay: 6, gtrVol: 0, fill: false, extra: { gtr: undefined } }),
  section('build to F# minor', 4, CH.build, { melody: BUILD_MEL, riff: RIFF.build, fill: false,
    extra: { crash: riser, snare: buildSnare, kick: beat(['X.......X.......', 'X...X...X...X...', 'X.X.X.X.X.X.X.X.', 'X...X...X...X...'], K) } }),
  section('A up: F# minor + harmony', 8, CH.A, { melody: A_MEL, riff: RIFF.A, semi: 2, harm: true, arps: true }),
  section('B up: F# minor', 8, CH.B, { melody: B_MEL, riff: RIFF.B, semi: 2, harm: true, arps: true }),
  jump(section('solo', 8, CH.solo, { melody: SOLO_MEL, riff: RIFF.A, groove: G.solo, echo: true, delay: 2 }), 1), // → order 1
];

writeSongCompact(import.meta.url, {
  title: 'Heliobane - Tharsis Rust', bpm: 168, ticks: 6, mixvol: 44,
  message: 'HELIOBANE stage 1 "Tharsis Rust" (MUSIC-A).\nE minor -> F# minor, 168 BPM. Orders 1-10 loop.\nAll samples synthesized. Source: songs/heliobane_stage1.gen.js',
  samples: [
    kick({ f0: 240, decay: 12 }), snare({ tone: 200, decay: 18, seed: 17, drive: 2.2 }), cymbal('hat closed', { seed: 13 }),
    cymbal('hat open', { sec: 0.3, decay: 10, seed: 14 }), cymbal('crash', { sec: 1.3, decay: 2.6, seed: 18, metalMix: 0.35 }),
    wave('saw bass', BASS_AMPS), powerChord('power chord'), { name: 'arp pulse', synth: { wave: 'square', pulse: 0.125 } },
    pwm('pwm lead', { lo: 0.1, hi: 0.4, cycles: 80 }), wave('whistle', [1, 0.06, 0.04]), noiseLoop(),
  ],
  channelnames: LAYOUT,
  patterns,
  order: [0, 1, 2, 3, 4, 5, 6, 7, 8, 4, 9], // pattern 4 (riff) returns before the solo
});
