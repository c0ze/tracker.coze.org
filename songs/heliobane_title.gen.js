#!/usr/bin/env node
/**
 * HELIOBANE — "Sun-Killer" (title / attract). MUSIC-A, 2026-09-24.
 * D minor → E minor, 156 BPM, speed 6: 4 rows/beat, 16 rows/bar.
 * Grid: one row = a 16th (96 ms); 8-bar sections = 128 rows = 12.3 s.
 *
 * Phrase map
 *   Intro   Dm Bb C A        brass fanfare over orchestra hits, snare roll (not looped)
 *   A       Dm Bb C A / Dm Bb C-A Dm   hook "D D A——" (short-short-leap), answer peaks F6, lands on D
 *   A2      same question; answer climbs to G6 over Gm and opens on C (V of F) + dotted-8th echo
 *   B       F C Dm Bb Gm C F A     relative major, long notes rising to A6 over F, open on A
 *   Break   Dm Bb Gm Bb      kick on 1, broken-chord shimmer (arp + 3-row canon), hook quote
 *   Build   Gm Bb C B        snare 8ths→16ths→32nd retrigs, noise riser, B = V of E minor
 *   A↑ B↑   whole step up (E minor / G major) with a written-out harmony under held notes
 *   Tag     C D Bb A         planing major chords back to A = V of D minor → loop to A
 * Loop body: orders 1–8 (52 bars, 80 s). Source of truth: this file.
 */
import { kick, snare, cymbal, tom, orchHit, noiseLoop, wave, pwm, superSaw, BASS_AMPS, BRASS_AMPS,
  mel, line, echoOf, chart, at, arp, bass, pad, harmony, beat, rep, pattern, jump, writeSongCompact } from './heliobane_title.kit.js';
import { nn, ns } from './lib.js';

const I = { kick: 0, snare: 1, hat: 2, ohat: 3, crash: 4, tom: 5, bass: 6, arp: 7, lead: 8, pad: 9, orch: 10, noise: 11, brass: 12 };
const LAYOUT = ['kick', 'snare', 'hat', 'bass', 'arp', 'lead', 'echo', 'pad', 'orch', 'crash'];
const PANS = [0x80, 0x74, 0xac, 0x80, 0x50, 0x8a, 0xb6, 0x5a, 0x80, 0x9c];
const K = { X: [I.kick, 64], x: [I.kick, 50] };
const S = { X: [I.snare, 58], x: [I.snare, 44], g: [I.snare, 18] };
const H = { X: [I.hat, 30], x: [I.hat, 20], g: [I.hat, 12], o: [I.ohat, 26] };

// ---------------------------------------------------------------- melodies
const HOOK_Q = 'd5/2 d5 a5/6 g5/2 a5 c6 | bb5/6 a5/2 f5/4 d5 | e5/2 f5 g5/6 f5/2 e5 c5 | e5/4 d5/2 c#5 e5/8';
const A_MEL = `${HOOK_Q} | d5/2 d5 a5/6 g5/2 a5 d6 | f6/6 e6/2 d6/4 bb5 | c6/2 bb5 a5 g5 e5/4 c#5 | d5/12 r/4`;
const A2_MEL = `${HOOK_Q} | d5/2 d5 a5/6 g5/2 a5 d6 | f6/6 e6/2 d6/4 f6 | g6/6 f6/2 d6/4 bb5 | e6/6 d6/2 c6/4 a5/2 bb5`;
const B_MEL = 'c6/6 a5/2 f5/4 a5 | g5/10 e5/2 g5 c6 | d6/6 c6/2 a5/4 f5 | f5/2 g5 bb5/4 d6/8 | bb5/4 d6 g6/8 | g6/2 f6 e6/4 c6 e6 | f6/6 e6/2 f6/4 a6 | a6/4 g6/2 f6 e6/8~';
const BRK_MEL = 'd5/2 d5 a5/12 | r/16 | d5/2 d5 bb5/12 | r/16';
const BUILD_MEL = 'g5/4 a5 bb5 d6 | d6/4 c6 bb5 d6 | e6/4 f6 g6 e6 | f#6/16~';
const TAG_MEL = 'e6/12 d6/2 e6 | f#6/16 | f6/8 d6 | e6/8 c#6/4 a5';
const FANFARE = 'a4/2 d5 f5 a5/10 | bb5/6 a5/2 f5/8 | g5/6 a5/2 c6/8 | c#6/16~';

const CH = {
  intro: 'Dm Bb C A', A: 'Dm Bb C A | Dm Bb C/8 A/8 Dm/16', A2: 'Dm Bb C A Dm Bb Gm C',
  B: 'F C Dm Bb Gm C F A', brk: 'Dm Bb Gm Bb', build: 'Gm Bb C B', tag: 'C D Bb A',
};

// ---------------------------------------------------------------- parts
const BASS = {
  A: ['R.RoR.RoR.RoR.oh'], B: ['R.O.r.O.R.O.r.OH'], whole: ['R---------------'],
  brk: ['R-------r-------'], build: ['R.R.R.R.R.R.R.R.', 'R.R.R.R.R.R.R.R.', 'RrRrRrRrRrRrRrRr', 'R.R.R.R.R.R.RrRr'],
};
const ARP = { A: ['X-x-X-x-X-x-X-x-'], B: ['X--x--x-X--x--x-'], hold: ['X---------------'] };

function lead(str, rows, { semi = 0, inst = I.lead, vol = 44 } = {}) {
  const notes = mel(str, { semi, vol });
  return { notes, ch: line(notes, inst, { rows }) };
}
/** Broken-chord 16ths (up-down through root/3rd/5th/octave) for the breakdown shimmer. */
function broken(segs, rows, lo = 'A-4') {
  const notes = [], steps = [0, 1, 2, 3, 2, 1];
  for (let r = 0; r < rows; r++) {
    const s = at(segs, r), base = nn(lo) + ((s.root - nn(lo)) % 12 + 12) % 12;
    const tones = [base, base + s.iv[1], base + s.iv[2], base + 12];
    notes.push([r, ns(tones[steps[r % 6]]), 1, r % 4 ? 18 : 26, '']);
  }
  return notes;
}
function orch(segs, rowsList, rows) {
  const ch = {};
  for (const r of rowsList) {
    const s = at(segs, r);
    ch[r] = { note: ns(nn('G-4') + ((s.root - nn('G-4')) % 12 + 12) % 12), instrument: I.orch, vol: 'v52' };
    if (r + 10 < rows && !rowsList.includes(r + 10)) ch[r + 10] = { note: '^^' };
  }
  return ch;
}
const crash = (rows = [0]) => Object.fromEntries(rows.map((r) => [r, { note: 'C-5', instrument: I.crash, vol: 'v40' }]));

const GROOVE = {
  A: { kick: 'X.....X.X.......', snare: '....X.......X...', hat: 'X.x.X.x.X.x.X.xo' },
  B: { kick: 'X.X...X.X.X...X.', snare: '....X.......X...', hat: 'XgxgXgxgXgxgXgxg' },
  fill: { kick: 'X.....X.X.X.....', snare: '....X.......XxXX', hat: 'X.x.X.x.X.x.....' },
};
function drums(bars, g, { fill = true } = {}) {
  return {
    kick: beat(rep(bars, g.kick, fill ? GROOVE.fill.kick : null), K),
    snare: beat(rep(bars, g.snare, fill ? GROOVE.fill.snare : null), S),
    hat: beat(rep(bars, g.hat, fill ? GROOVE.fill.hat : null), H),
  };
}
function section(name, bars, chordStr, { semi = 0, melody, echo = false, harm = false, groove = GROOVE.A,
  bassR = BASS.A, arpR = ARP.A, extra = {}, fill = true, cr = true } = {}) {
  const rows = bars * 16, segs = chart(chordStr, { semi });
  const parts = { ...drums(bars, groove, { fill }), bass: bass(segs, bassR, I.bass, { rows, lo: 'C-3', vol: 40 }),
    arp: arp(segs, arpR, I.arp, { rows, lo: 'F-4', vol: 24 }), pad: pad(segs, I.pad, { rows, lo: 'A-4', vol: 16 }) };
  if (cr) parts.crash = crash();
  if (melody) {
    const { notes, ch } = lead(melody, rows, { semi });
    parts.lead = ch;
    if (echo) parts.echo = echoOf(ch, notes, { delay: 3, scale: 0.42, rows });
    if (harm) parts.echo = line(harmony(notes, segs), I.lead, { rows, vib: null });
  }
  return pattern(name, bars, { ...parts, ...extra }, LAYOUT, PANS);
}

// ---------------------------------------------------------------- sections
const introSegs = chart(CH.intro);
const introHits = [0, 6, 12, 16, 22, 28, 32, 38, 44, 48];
const roll = Object.fromEntries(Array.from({ length: 16 }, (_, i) => [48 + i, { note: 'C-5', instrument: I.snare, vol: `v${16 + i * 3}` }]));
const intro = section('intro fanfare', 4, CH.intro, {
  bassR: BASS.whole, arpR: ARP.hold, fill: false, groove: { kick: 'X.....X.....X...', snare: '................', hat: '................' },
  extra: {
    lead: line(mel(FANFARE, { vol: 42 }), I.brass, { rows: 64 }), orch: orch(introSegs, introHits, 64),
    snare: roll, kick: beat(['X.....X.....X...', 'X.....X.....X...', 'X.....X.....X...', 'X...............'], K),
  },
});

const brkSegs = chart(CH.brk), brkNotes = broken(brkSegs, 64);
const brkArp = line(brkNotes, I.arp, { rows: 64, vib: null });
const breakdown = section('breakdown shimmer', 4, CH.brk, {
  melody: BRK_MEL, bassR: BASS.brk, cr: false,
  extra: {
    arp: brkArp, echo: echoOf(brkArp, brkNotes, { delay: 3, scale: 0.5, rows: 64 }),
    kick: beat(rep(4, 'X...............'), K), snare: { 0: { note: '^^' } }, hat: beat(rep(4, '..g...g...g...g.'), H),
  },
});

const riser = { 32: { note: 'C-4', instrument: I.noise, vol: 'v4' } };
for (let r = 33; r < 64; r++) riser[r] = { vol: `v${4 + Math.round((r - 32) * 1.1)}`, fx: 'F03' };
const buildSnare = beat(['....X.......X...', '..x...x...x...x.', 'x.x.x.x.x.x.x.x.', '................'], S);
for (let i = 0; i < 16; i++) buildSnare[48 + i] = { note: 'C-5', instrument: I.snare, vol: `v${22 + i * 2}`, fx: 'Q03' };
const build = section('build to E minor', 4, CH.build, {
  melody: BUILD_MEL, bassR: BASS.build, cr: false,
  extra: { snare: buildSnare, kick: beat(['X.......X.......', 'X...X...X...X...', 'X.X.X.X.X.X.X.X.', 'X...X...X...X...'], K),
    hat: beat(rep(4, 'x.x.x.x.x.x.x.x.'), H), crash: riser, orch: orch(chart(CH.build), [48], 64) },
});

const tagSegs = chart(CH.tag);
const tag = section('tag: C D Bb A', 4, CH.tag, { melody: TAG_MEL, groove: GROOVE.B, bassR: BASS.A,
  extra: { orch: orch(tagSegs, [0, 6, 16, 22, 32, 38, 48, 54], 64) } });

const patterns = [
  intro,
  section('A: hook', 8, CH.A, { melody: A_MEL }),
  section('A2: hook + echo', 8, CH.A2, { melody: A2_MEL, echo: true }),
  section('B: relative major', 8, CH.B, { melody: B_MEL, echo: true, groove: GROOVE.B, bassR: BASS.B, arpR: ARP.B }),
  breakdown,
  build,
  section('A up: E minor + harmony', 8, CH.A, { melody: A_MEL, semi: 2, harm: true, groove: GROOVE.B }),
  section('B up: G major + harmony', 8, CH.B, { melody: B_MEL, semi: 2, harm: true, groove: GROOVE.B, bassR: BASS.B, arpR: ARP.B }),
  jump(tag, 1),
];

writeSongCompact(import.meta.url, {
  title: 'Heliobane - Sun-Killer', bpm: 156, ticks: 6, mixvol: 44,
  message: 'HELIOBANE title theme "Sun-Killer" (MUSIC-A).\nD minor -> E minor, 156 BPM. Orders 1-8 loop.\nAll samples synthesized. Source: songs/heliobane_title.gen.js',
  samples: [
    kick(), snare(), cymbal('hat closed'), cymbal('hat open', { sec: 0.35, decay: 9, seed: 4 }),
    cymbal('crash', { sec: 1.3, decay: 2.6, seed: 8, metalMix: 0.35 }), tom(),
    wave('saw bass', BASS_AMPS), { name: 'arp pulse', synth: { wave: 'square', pulse: 0.25 } },
    pwm('pwm lead'), superSaw('string pad'), orchHit(), noiseLoop(), wave('brass', BRASS_AMPS),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
