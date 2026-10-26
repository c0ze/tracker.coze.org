#!/usr/bin/env node
/**
 * HELIOBANE stage 9 — "Cold Harbour" (the outer shipyard, Concord hulls worn as shells). MUSIC-C, 2026-09-25.
 * Eb minor with a Phrygian Fb (→ E minor), 160 BPM (libopenmpt plays 160.02: 689 samples/tick),
 * speed 6: 4 rows/beat, 16 rows/bar, 8 bars = 12.0 s.
 *
 * Identity: a dead shipyard that still runs. A drop-tuned power-chord riff and the
 * bass chug on low Eb in unison and twist through Fb (the Phrygian b2); a metal lane
 * of pitched hull clanks, anvils and steam hisses plays a press-machine ostinato over
 * a four-on-the-floor kick. The horn hook is a crane's lift: "Eb Bb——— A Bb Gb" (up a
 * fifth, a chromatic lower neighbour, fall), with a long ping-pong echo off the hulls.
 *
 * Phrase map
 *   Intro   Eb5 Eb5 Eb5 Bb5      echoing clanks, steam, a siren; riff in bar 3, drums bar 4 (not looped)
 *   A       Ebm Ebm Cb Bb Ebm Ebm E(=Fb) Bb   crane hook, answer lifts to D6 over Bb
 *   A2      same + ping-pong echo + 12.5% machine arps
 *   B       Cb Db Bbm Ebm Cb Db Bb Bb        "cranes": long notes up to Bb6, half-time crash ride
 *   Press   Ebm Ebm Ebm Ebm Cb Cb Bb Bb      no hook: machine lane alone with the kick, half-time chugs,
 *                                            a siren glide and a Concord SOS (... --- ...) in Morse on a beacon
 *   Build   Cb Db Bb B                        B = V of E minor
 *   A↑ B↑   E minor with written harmony
 *   Turn    E5 E5 F Bb                        F = bII of E minor = the pivot; Bb = V of Eb minor → loop to A
 * Loop body: orders 1–8 (56 bars, 84.0 s).
 */
import { kick, cymbal, tom, noiseLoop, wave, powerChord, BRASS_AMPS, thinPad, clank, metalSnare, steam,
  mel, line, chart, arp, bass, pad, harmony, beat, rep, pattern, jump, writeSongCompact,
  pingpong, canon, gate, notesOf, drumKit, hits, riser, roll, merge, cut0, coldPad , cutLanes } from './heliobane_stage6.kit.js';

const I = { kick: 0, snare: 1, hat: 2, ohat: 3, crash: 4, bass: 5, gtr: 6, arp: 7, horn: 8, pad: 9, noise: 10,
  hull: 11, anvil: 12, steam: 13, beacon: 14, siren: 15, tom: 16 };
const LAYOUT = ['kick', 'snare', 'hat', 'metal', 'bass', 'gtr', 'arp', 'lead', 'echo', 'echo2', 'pad', 'fx'];
const PANS = [0x80, 0x78, 0xb0, 0x58, 0x80, 0x66, 0xa8, 0x86, 0x4c, 0xb8, 0x74, 0x92];
const KM = { X: [I.kick, 64], x: [I.kick, 46] };
const METAL = { M: [I.hull, 44], m: [I.hull, 28, null, 'G-4'], A: [I.anvil, 36], a: [I.anvil, 22, null, 'D-5'], h: [I.steam, 30], H: [I.steam, 40] };
const drums = drumKit({
  kick: KM,
  snare: { X: [I.snare, 58], x: [I.snare, 42], g: [I.snare, 16], t: [I.tom, 48, null, 'C-5'], T: [I.tom, 52, null, 'F-4'] },
  hat: { X: [I.hat, 36], x: [I.hat, 28], o: [I.ohat, 30], c: [I.crash, 24] },
  metal: METAL,
});
const PRESS = 'M..a..m.M..a.hA.';
const G = {
  main: { kick: 'X...X...X...X.x.', snare: '....X.......X...', hat: 'x.x.x.x.x.x.x.x.', metal: PRESS },
  B: { kick: 'X...X...X...X...', snare: '........X.......', hat: 'c.......c.......', metal: 'M.......m...A...' },
  press: { kick: 'X...X...X...X...', snare: '................', hat: '..o...o...o...o.', metal: 'M.aam.a.M.aamhA.' },
  fill: { kick: 'X...X...X.X.X...', snare: '....X...XxXxtTtT', hat: 'x.x.x.x.........', metal: 'M..a..m.A.A.A.A.' },
};
const CH = {
  intro: 'Eb5 Eb5 Eb5 Bb5', A: 'Ebm Ebm Cb Bb Ebm Ebm E Bb', B: 'Cb Db Bbm Ebm Cb Db Bb Bb',
  press: 'Ebm Ebm Ebm Ebm Cb Cb Bb Bb', build: 'Cb Db Bb B', turn: 'E5 E5 F Bb',
};

// ---------------------------------------------------------------- melodies
const A_MEL = 'eb5/2 bb5/6 a5/2 bb5 gb5/4 | f5/2 gb5 f5 eb5/10~ | eb5/2 cb6/6 bb5/2 cb6 gb5/4 | f5/2 a5 bb5 d6/10~'
  + ' | eb5/2 bb5/6 a5/2 bb5 gb5/4 | f5/2 gb5 bb5 eb6/10~ | e5/2 b5/6 a#5/2 b5 g#5/4 | f5/2 a5 c6 d6 bb5/8';
const B_MEL = 'gb5/4 bb5 eb6/8~ | f6/8~ db6/4 ab5 | db6/6 bb5/2 f5/8 | gb5/4 bb5 eb6/8~'
  + ' | gb6/8~ f6/4 eb6 | f6/8~ ab6/4 f6 | d6/8~ f6/4 bb6 | bb6/8~ ab6/4 f6';
const SIREN = 'r/16 | r/16 | bb4/4 eb5/12> | eb5/8 bb4/8> | r/16 | r/16 | bb4/4 eb5/12> | d5/16>';
const SOS = 'bb6/1 r bb6 r bb6 r/3 bb6/3 r/1 bb6/3 r/1 bb6/3 r/3 bb6/1 r bb6 r bb6 r/5';
const BUILD_MEL = 'gb5/4 bb5 eb6 gb6 | f6/4 ab6 db6 f6 | f6/4 d6 bb5 d6 | d#6/16~';
const TURN_MEL = 'r/16 | r/16 | f5/2 a5 c6/12~ | d6/4 c6 bb5/8~';

// ---------------------------------------------------------------- riff & parts
const RA = 'Rr.Rr.Rr.R1-R.rr', RB = 'Rr.Rr.Rr.R3-1-R.', CHUG = 'R-.rr.R-.rr.R.rr', CHUG2 = 'R-.rr.R-.R.R.RRR';
const RIFF = { A: [RA, RB, CHUG, CHUG, RA, RB, CHUG, CHUG2], B: ['R-------R-------', 'R-------R---R---'],
  press: ['R.......R.r.....', 'R.......R.r.R.r.'], riff: [RA, RB, RA, CHUG2], build: [CHUG, CHUG, 'RrRrRrRrRrRrRrRr', 'RRRRRRRRRRRRRRRR'] };

function section(name, bars, chordStr, { semi = 0, melody, groove = G.main, fill = true, echo = false, harm = false,
  riff = RIFF.A, arps = false, extra = {} } = {}) {
  const rows = bars * 16, segs = chart(chordStr, { semi }), power = chart(chordStr.replace(/m\b/g, '5').replace(/\b([A-G][b#]?)\b(?!5)/g, '$15'), { semi });
  const parts = { ...drums(bars, groove, fill ? G.fill : null), fx: hits(I.crash, [0], { vol: 38 }),
    bass: bass(power, riff, I.bass, { rows, lo: 'C-3', vol: 44, soft: 0.72 }),
    gtr: bass(power, riff, I.gtr, { rows, lo: 'A-3', vol: 34, soft: 0.75 }) };
  const refs = [];
  if (melody) {
    const notes = mel(melody, { semi, vol: 50 }), ch = cut0(line(notes, I.horn, { rows, vib: 'H33' }));
    parts.lead = ch; refs.push(notes);
    if (echo) [parts.echo, parts.echo2] = pingpong(ch, notes, rows, { segs, d1: 3, s1: 0.45, d2: 8, s2: 0.25 });
    if (harm) {
      parts.echo = line(harmony(notes, segs), I.horn, { rows, vib: null });
      parts.echo2 = canon(ch, notes, rows, { delay: 8, scale: 0.25, segs, refs: [notesOf(parts.echo, rows)] });
    }
    if (parts.echo) refs.push(notesOf(parts.echo, rows), notesOf(parts.echo2, rows));
  }
  parts.pad = coldPad(segs, I.pad, { rows, lo: 'A#4', vol: 9, refs });
  if (arps) parts.arp = gate(arp(segs, ['x.x.x.x.x.x.x.x.'], I.arp, { rows, lo: 'A#4', vol: 16 }), rows, { refs });
  return pattern(name, bars, cutLanes({ ...parts, ...extra }), LAYOUT, PANS);
}

// intro: clanks ringing in an empty dock (with a long echo), steam, siren; riff in bar 3
const introClanks = beat(['M.......m.....h.', '..a.....M.......', PRESS, 'M..a..m.A.A.A.A.'], METAL);
const introRiff = [RA, RB, RA, CHUG2];
const introSegs = chart(CH.intro), introSiren = mel('bb4/4 eb5/12> | eb5/8 bb4/8> | r/16 | r/16', { vol: 30 });
const intro = pattern('intro: empty dock', 4, {
  metal: introClanks, echo: Object.fromEntries(Object.entries(introClanks).filter(([r]) => r < 32).map(([r, e]) => [Number(r) + 6, { ...e, vol: 'v14' }])),
  lead: line(introSiren, I.siren, { rows: 64, vib: null }),
  bass: Object.fromEntries(Object.entries(bass(introSegs, introRiff, I.bass, { rows: 64, lo: 'C-3', vol: 44, soft: 0.72 })).filter(([r]) => r >= 32)),
  gtr: Object.fromEntries(Object.entries(bass(introSegs, introRiff, I.gtr, { rows: 64, lo: 'A-3', vol: 34, soft: 0.75 })).filter(([r]) => r >= 32)),
  kick: beat(['................', '................', 'X...X...X...X.x.', 'X...X...X.X.X...'], KM),
  snare: beat(['................', '................', '................', '....X...XxXxtTtT'], { X: [I.snare, 58], x: [I.snare, 42], t: [I.tom, 48, null, 'C-5'], T: [I.tom, 52, null, 'F-4'] }),
  hat: beat(['................', '................', 'x.x.x.x.x.x.x.x.', 'x.x.x.x.........'], { x: [I.hat, 28] }),
}, LAYOUT, PANS);

// press: the machine alone, half-time chugs, siren glides, SOS on the beacon (echoing)
const sos = mel(`${SOS} | r/16 | r/16 | ${SOS} | r/16 | r/16`, { vol: 30 }), sosCh = line(sos, I.beacon, { rows: 128, vib: null });
const pressSegs = chart(CH.press);
const press = section('press: machine + SOS', 8, CH.press, { groove: G.press, fill: false, riff: RIFF.press, extra: {
  lead: cut0(line(mel(SIREN, { vol: 34 }), I.siren, { rows: 128, vib: null })),
  arp: sosCh, echo: canon(sosCh, sos, 128, { delay: 3, scale: 0.4, segs: pressSegs }),
  echo2: canon(sosCh, sos, 128, { delay: 6, scale: 0.2, segs: pressSegs }),
  fx: merge(hits(I.crash, [0], { vol: 32 }), riser(I.noise, 112, 128, { v0: 4, slope: 1.6 })),
} });

const build = section('build to E minor', 4, CH.build, { melody: BUILD_MEL, riff: RIFF.build, fill: false, extra: {
  fx: cut0(riser(I.noise, 32, 64)), snare: merge(beat(['....X.......X...', '..x...x...x...x.', 'x.x.x.x.x.x.x.x.', '................'], { X: [I.snare, 58], x: [I.snare, 42] }), roll(I.snare, 48, 16, { v0: 22, dv: 2 })),
  metal: beat(['M...M...M...M...', 'M.M.M.M.M.M.M.M.', 'MMMMMMMMMMMMMMMM', 'A...A...A.A.AAAA'], METAL) } });

const patterns = [
  intro,
  section('A: crane hook', 8, CH.A, { melody: A_MEL }),
  section('A2: hook + ping-pong echo + arps', 8, CH.A, { melody: A_MEL, echo: true, arps: true }),
  section('B: cranes', 8, CH.B, { melody: B_MEL, groove: G.B, riff: RIFF.B, echo: true }),
  press,
  build,
  section('A up: E minor + harmony', 8, CH.A, { melody: A_MEL, semi: 1, harm: true, arps: true }),
  section('B up: E minor + harmony', 8, CH.B, { melody: B_MEL, semi: 1, groove: G.B, riff: RIFF.B, harm: true }),
  jump(section('turn: Fb to Bb', 4, CH.turn, { melody: TURN_MEL, riff: RIFF.riff }), 1),
];

writeSongCompact(import.meta.url, {
  title: 'Heliobane - Cold Harbour', bpm: 160, ticks: 6, mixvol: 44,
  message: 'HELIOBANE stage 9 "Cold Harbour" (MUSIC-C, World 2).\nEb minor -> E minor, 160 BPM. Orders 1-8 loop.\nAll samples synthesized. Source: songs/heliobane_stage9.gen.js',
  samples: [
    kick({ f0: 280, f1: 56, decay: 14, click: 0.8, drive: 3 }), metalSnare('snare', { tone: 180, metal: 0.8, drive: 2, seed: 91 }),
    cymbal('hat closed', { seed: 93 }), cymbal('hat open', { sec: 0.3, decay: 10, seed: 94 }), cymbal('crash', { sec: 1.4, decay: 2.4, seed: 98, metalMix: 0.45 }),
    wave('grit bass', [1, 0.4, 0.5, 0.25, 0.3, 0.15, 0.2, 0.1, 0.14, 0.06, 0.1]), powerChord('drop power chord', { drive: 6 }),
    { name: 'machine pulse', synth: { wave: 'square', pulse: 0.125 } }, wave('cold horn', BRASS_AMPS.slice(0, 12)),
    thinPad('dock pad', { amps: [1, 0, 0.18, 0, 0.06] }), noiseLoop(),
    { ...clank('hull clank', { base: 140, sec: 0.6, seed: 95 }), role: 'percussion' },
    { ...clank('anvil', { base: 410, sec: 0.35, bright: 1.3, drive: 2.4, seed: 96 }), role: 'percussion' }, steam(),
    wave('beacon', [1, 0, 0.12]), wave('siren', [1, 0.05]), tom(),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
