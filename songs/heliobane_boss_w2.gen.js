#!/usr/bin/env node
/**
 * HELIOBANE boss_w2 — "Herald of the Wake" (every World 2 Herald). MUSIC-C, 2026-09-25.
 * A minor (→ Bb minor for phase two), 176 BPM like World 1's "Herald" (libopenmpt plays
 * 176.12: 626 samples/tick), speed 6: 4 rows/beat, 16 rows/bar, 8 bars = 10.9 s.
 *
 * Shared DNA with `boss` (heliobane_boss.gen.js), deliberately:
 *   - the relentless 16th grit-bass ostinato accented 3+3+2, with power-chord stabs on
 *     the accents and orchestra hits on 3-3-2 in a lead-less "hammer" section;
 *   - the harmony shape i i bVI V / i i bII V (here Am F Dm E / Am F Bb E);
 *   - a siren section over a pedal that pivots up a half step for phase two;
 *   - the Herald motif "5 1 b3 | 2 1" in 3-3-2-4-4: World 1 plays G C Eb D C.
 * What makes it the World 2 Herald: the hook is that motif INVERTED and falling
 * ("A E C | D E", the same rhythm), the B section quotes the original motif outright
 * (A D F E D, then E A C B A), the ostinato leaps octaves and turns up through b7 / b3-b2
 * instead of down, a glass-bell "shell" rings on the 3-3-2 accents two octaves up, the
 * sirens fall instead of rise, and everything has a ping-pong echo.
 *
 * Phrase map
 *   Intro   A5 pedal         ostinato + glass, falling glides E7→A6, drums in bar 3 (not looped)
 *   A       Am F Dm E Am F Bb E       inverted motif "A E C | D E", answer on the Neapolitan Bb
 *   A2      same + ping-pong echo + J-arps
 *   B       Dm Dm Am Am F G E E       the World 1 motif quoted in D minor, then in A minor at C7
 *   Shatter Am Am F G Am Am Bb E      no lead: orchestra hits + power chords on 3-3-2, glass shards
 *   Alarm   Am E Bb Am Fm C D F       A pedal broken by E, Bb and F, 16th arp alarm, siren falling C7 → F6; F = V of Bb minor
 *   A↑ B↑   Bb minor with written harmony (phase two)
 *   Break   A5 A5 F5 E5               ostinato and drums back in A → loop to A
 * Loop body: orders 1–8 (60 bars, 81.8 s).
 */
import { kick, snare, cymbal, tom, orchHit, noiseLoop, wave, powerChord, glassBell, thinPad,
  mel, line, chart, at, arp, bass, harmony, beat, rep, pattern, jump, writeSongCompact,
  ladder, pingpong, canon, gate, notesOf, drumKit, hits, roll, merge, cut0, coldPad , cutLanes } from './heliobane_stage6.kit.js';
import { nn, ns } from './lib.js';

const I = { kick: 0, snare: 1, hat: 2, ohat: 3, crash: 4, bass: 5, gtr: 6, arp: 7, lead: 8, pad: 9, orch: 10, noise: 11, glass: 12, tom: 13 };
const LAYOUT = ['kick', 'snare', 'hat', 'bass', 'gtr', 'arp', 'glass', 'lead', 'echo', 'echo2', 'pad', 'fx'];
const PANS = [0x80, 0x78, 0xb0, 0x80, 0x5a, 0xa8, 0xbc, 0x88, 0x4e, 0xb4, 0x6e, 0x90];
const KM = { X: [I.kick, 64], x: [I.kick, 48] };
const drums = drumKit({
  kick: KM,
  snare: { X: [I.snare, 58], x: [I.snare, 42], g: [I.snare, 16], t: [I.tom, 46, null, 'C-5'], T: [I.tom, 50, null, 'F-4'] },
  hat: { X: [I.hat, 30], x: [I.hat, 20], g: [I.hat, 11], o: [I.ohat, 24] },
});

// ---------------------------------------------------------------- ostinato & grooves (3+3+2 DNA)
const OST = ['RroRroRoRroRrob-', 'RroRroRoRroRt-1-'], PEDAL = ['RroRroRoRroRroRo'];
const STAB = ['R..R..R.R..R....'];
const ACC = [0, 3, 6, 8, 11, 14];
const G = {
  main: { kick: 'X..X..X.X..X..X.', snare: '....X.......X...', hat: 'XgxgXgxgXgxgXgxg' },
  B: { kick: 'X.XXX.XXX.XXX.XX', snare: '....X.......X...', hat: 'XgxoXgxoXgxoXgxo' },
  shatter: { kick: 'X..X..X...X..X..', snare: '......X.......X.', hat: 'x.x.x.x.x.x.x.x.' },
  alarm: { kick: 'X...X...X...X...', snare: '....X.......X...', hat: '..o...o...o...o.' },
  fill: { kick: 'X..X..X.X.......', snare: '....X...XxXxtTtT', hat: 'XgxgXgxg........' },
};
const CH = {
  A: 'Am F Dm E Am F Bb E', B: 'Dm Dm Am Am F G E E', shatter: 'Am Am F G Am Am Bb E',
  alarm: 'Am E Bb Am Fm C D F', pedal: 'A5 E5 Bb5 A5 F5 A5 D5 F5', brk: 'A5 A5 F5 E5', intro: 'A5 A5 A5 E5',
};

// ---------------------------------------------------------------- melodies
const A_MEL = 'a6/3 e6 c6/2 d6/4 e6 | f6/3 c6 a5/2 g5/4 a5 | d6/3 a5 f5/2 g5/4 a5 | g#5/4 b5 e6/8~'
  + ' | a6/3 e6 c6/2 d6/4 e6 | f6/3 c6 a5/2 a6/4 g6 | f6/3 d6 bb5/2 d6/4 f6 | b5/4 d6 g#6/8~';
const B_MEL = 'a5/3 d6 f6/2 e6/4 d6 | a5/3 d6 f6/2 a6/4 g6/2 f6 | e6/8~ c6/4 a5 | e6/3 a6 c7/2 b6/4 a6'
  + ' | a6/6 g6/2 f6/4 c6 | b6/6 a6/2 g6/4 d6 | g#6/8~ e6/4 b5 | d6/4 c6 b5 g#5';
const SIREN = 'c7/16~ | b6/16> | bb6/16> | a6/16> | ab6/16> | g6/16> | f#6/16> | f6/16>';
const INTRO = 'e7/4 a6/12> | e7/4 a6/12> | e7/4 bb6/12> | a6/16~';

// ---------------------------------------------------------------- parts
/** The glass shell: a falling chord-tone ladder two octaves up, only on the 3-3-2 accents. */
function glassShell(segs, rows, { vol = 26, lo = 'A-5', shape = [5, 4, 3, 2, 1, 0] } = {}) {
  const all = ladder(segs, rows, [0], { lo, span: 6, vol });
  const notes = [];
  for (const [r] of all) {
    const k = ACC.indexOf(r % 16); if (k < 0) continue;
    const s = at(segs, r), rungs = [];
    for (let p = nn(lo); rungs.length < 6; p++) if (s.tones.has(p % 12)) rungs.push(p);
    notes.push([r, ns(rungs[shape[k]]), k === 5 ? 2 : k === 2 ? 2 : 3, k === 0 ? vol + 6 : vol, '']);
  }
  return notes;
}
function orch(segs, rowsList) {
  const ch = {};
  for (const r of rowsList) ch[r] = { note: ns(nn('G-4') + ((at(segs, r).root - nn('G-4')) % 12 + 12) % 12), instrument: I.orch, vol: 'v50' };
  return ch;
}
function section(name, bars, chordStr, { semi = 0, melody, groove = G.main, fill = true, echo = false, harm = false,
  arps = null, bassChart, ost = OST, stabs = STAB, shell = true, extra = {} } = {}) {
  const rows = bars * 16, segs = chart(chordStr, { semi }), bsegs = bassChart ? chart(bassChart, { semi }) : segs;
  const parts = { ...drums(bars, groove, fill ? G.fill : null), fx: hits(I.crash, [0], { vol: 40 }),
    bass: bass(bsegs, ost, I.bass, { rows, lo: 'C-3', vol: 40, soft: 0.66 }),
    gtr: stabs && bass(bsegs, stabs, I.gtr, { rows, lo: 'G-3', vol: 30 }) };
  const refs = [];
  if (melody) {
    const notes = mel(melody, { semi, vol: 48 }), ch = cut0(line(notes, I.lead, { rows, vib: 'H43' }));
    parts.lead = ch; refs.push(notes);
    if (echo) [parts.echo, parts.echo2] = pingpong(ch, notes, rows, { segs });
    if (harm) {
      parts.echo = line(harmony(notes, segs), I.lead, { rows, vib: null });
      parts.echo2 = canon(ch, notes, rows, { delay: 6, scale: 0.22, segs, refs: [notesOf(parts.echo, rows)] });
    }
    if (parts.echo) refs.push(notesOf(parts.echo, rows), notesOf(parts.echo2, rows));
  }
  if (arps) parts.arp = gate(arp(segs, arps, I.arp, { rows, lo: 'G-4', vol: 17 }), rows, { refs });
  if (shell) parts.glass = gate(line(glassShell(segs, rows), I.glass, { rows, vib: null }), rows, { refs });
  parts.pad = coldPad(segs, I.pad, { rows, lo: 'C-5', vol: 10, refs });
  return pattern(name, bars, cutLanes({ ...parts, ...extra }), LAYOUT, PANS);
}

const PULSE = ['X-x-X-x-X-x-X-x-'];
const shatterSegs = chart(CH.shatter), hammerRows = [], shardRows = [];
for (let b = 0; b < 8; b++) { for (const r of [0, 3, 6, 10, 13]) hammerRows.push(b * 16 + r); shardRows.push(b * 16 + 8, b * 16 + 15); }
const shards = line(shardRows.map((r) => {
  const s = at(shatterSegs, r), top = nn('E-6') + ((s.root + s.iv[1] - nn('E-6')) % 12 + 12) % 12;
  return [r, ns(top), r % 16 === 8 ? 3 : 1, 34, ''];
}), I.glass, { rows: 128, vib: null });

const introSegs = chart(CH.intro);
const intro = pattern('intro: siren', 4, {
  bass: bass(introSegs, OST, I.bass, { rows: 64, lo: 'C-3', vol: 40, soft: 0.66 }),
  glass: line(glassShell(introSegs, 64, { vol: 24 }), I.glass, { rows: 64, vib: null }),
  lead: line(mel(INTRO, { vol: 42 }), I.lead, { rows: 64 }),
  echo: line(mel(INTRO, { vol: 18 }).map(([r, n, l, v, m]) => [r + 6, n, Math.min(l, 64 - r - 6), v, m]).filter(([r]) => r < 64), I.lead, { rows: 64 }),
  kick: beat(['................', '................', 'X..X..X.X..X..X.', 'X..X..X.X.......'], KM),
  snare: beat(['................', '................', '....X.......X...', '....X...XxXxtTtT'], { X: [I.snare, 58], x: [I.snare, 42], t: [I.tom, 46, null, 'C-5'], T: [I.tom, 50, null, 'F-4'] }),
}, LAYOUT, PANS);

const patterns = [
  intro,
  section('A: inverted motif', 8, CH.A, { melody: A_MEL }),
  section('A2: + ping-pong echo + arps', 8, CH.A, { melody: A_MEL, echo: true, arps: PULSE }),
  section('B: the World 1 motif', 8, CH.B, { melody: B_MEL, echo: true, arps: PULSE, groove: G.B }),
  section('shatter: orchestra hits + glass', 8, CH.shatter, { groove: G.shatter, stabs: ['R..R..R...R..R..'], shell: false,
    extra: { glass: shards, fx: merge(orch(shatterSegs, hammerRows), hits(I.crash, [0], { vol: 40 })) } }),
  section('alarm: falling siren over A', 8, CH.alarm, { melody: SIREN, bassChart: CH.pedal, ost: PEDAL, groove: G.alarm, stabs: null, shell: false,
    arps: ['XxXxXxXxXxXxXxXx'] }),
  section('A up: Bb minor + harmony', 8, CH.A, { melody: A_MEL, semi: 1, harm: true, arps: PULSE }),
  section('B up: Bb minor + harmony', 8, CH.B, { melody: B_MEL, semi: 1, harm: true, arps: PULSE, groove: G.B }),
  jump(section('break: ostinato', 4, CH.brk, { shell: true, extra: { pad: undefined } }), 1),
];

writeSongCompact(import.meta.url, {
  title: 'Heliobane - Herald of the Wake', bpm: 176, ticks: 6, mixvol: 42,
  message: 'HELIOBANE World 2 boss theme "Herald of the Wake" (MUSIC-C).\nA minor -> Bb minor, 176 BPM. Orders 1-8 loop. Quotes the World 1 Herald motif.\nAll samples synthesized. Source: songs/heliobane_boss_w2.gen.js',
  samples: [
    kick({ f0: 260, f1: 58, decay: 13, drive: 3 }), snare({ tone: 200, decay: 17, seed: 117, drive: 2.4 }), cymbal('hat closed', { seed: 113 }),
    cymbal('hat open', { sec: 0.3, decay: 10, seed: 114 }), cymbal('crash', { sec: 1.4, decay: 2.4, seed: 118, metalMix: 0.3 }),
    wave('grit bass', [1, 0.35, 0.5, 0.2, 0.3, 0.12, 0.2, 0.08, 0.14, 0.05, 0.1]), powerChord('power chord', { drive: 5 }),
    { name: 'arp pulse', synth: { wave: 'square', pulse: 0.25 } },
    wave('glass saw lead', Array.from({ length: 18 }, (_, k) => (k % 2 ? 0.55 : 1) / (k + 1))), thinPad('herald pad', { amps: [1, 0.08, 0.24, 0, 0.1] }),
    orchHit(), noiseLoop(), glassBell('glass shell', { sec: 1.0 }), tom(),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
