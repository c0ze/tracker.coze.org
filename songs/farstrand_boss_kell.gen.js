#!/usr/bin/env node
/**
 * FARSTRAND — "Kell" (both Kell fights: the duel at his cocoon on Sunder, and Kell worn at the Taproot). 2026-09-26.
 * D Phrygian, 160 BPM, speed 6: 4 rows/beat, 16 rows/bar; one row = a 16th (94 ms), one bar = 1.5 s.
 * Rendered at 48 kHz, where 160 BPM is exact (750 samples/tick).
 *
 * Identity: a Concord march turned inside out. The Concord's own music in Farstrand is the Survey's call (the
 * bugle-like theme of farstrand_benchmark.gen.js, D major: 'A D A—— G F# | E D E——'). Kell's theme is that call
 * mirrored about D: every interval turned upside down, in the call's own march rhythm (2-2-8-2-2 | 4-4-8). Mirroring
 * D major gives D Phrygian, so the theme owns the bII (Eb), the family's wrong-coloured light, without leaving his
 * key; mirroring the call's chords (D A G) gives Gm Cm Dm, the V-I cadences turn into iv-i. The answer ends on D
 * major, the Concord's chord, for one bar: the man under the hive. The march is inside out too: B (the hive speaking
 * with him, "we") puts the kick on the offbeats and the snare on the downbeats, and the motif goes down into a
 * warm fleshy voice two octaves under, while Kell's glass lead holds long notes over it. The break is the call as it
 * was, upright, on the benchmark's radio lead through static, answered by its mirror on glass bells.
 *
 * KELL (the motif, for re-scoring: M3c's falling fight at the Taproot): 'G D G—— A Bb | C D C——', i.e. 5 1 5(down)
 * 6 b7 | 1(up) 2 1 of G, in 2-2-8-2-2 | 4-4-8 rows, over Gm | Cm; its second half 'G D F—— G A | Bb C D——' over
 * Dm | Bb Dm. It works an octave down (the hive), on bells, at half speed, or in 3+3+2 against a Herald drive.
 *
 * Phrase map
 *   Intro  D D Gm Cm                    static, the Survey's call on the radio lead ('A D A—— G F# | E D E——'), a
 *                                       snare roll; then the call inverted on the glass lead with the march (not looped)
 *   A      Gm Cm Dm Bb-Dm | Gm Cm Eb D   KELL whole: 'G D G—— A Bb | C D C—— | G D F—— G A | Bb C D——', then
 *                                       'C D Eb——' over Cm, 'G Eb Bb——' over Eb, 'A F# D——' over D (the Concord's)
 *   A2     same                         the answer climbs to Bb6 and C7, ends open on A over D; march bells on 1 and 3
 *   B      Gm Cm Dm Dm | Eb Cm Eb D     "we": inside-out drums, the motif two octaves down in the flesh voice, the lead
 *                                       holding D G F D, G-Bb G Bb A over it
 *   Break  D A G D | Gm Cm Eb D         half time: the call upright on the radio lead through static; its mirror
 *                                       answers on glass bells
 *   A3     as A                         KELL doubled by glass bells an octave up, eighth-note kicks
 *   Build  Eb Eb D D7                    the Phrygian cadence (bII to I), a snare roll and a riser; the loop jumps to A
 * Loop body: orders 1-6 (44 bars, 66 s). Everything synthesized. Source of truth: this file; the shared helpers
 * come from farstrand_halm.gen.js, the dark snare after farstrand_boss.gen.js, the radio lead and static after
 * farstrand_benchmark.gen.js.
 */
import { kick, cymbal, noiseLoop, wave, glassBell, thinPad, mel, line, chart, bass, pattern, jump, writeSongCompact,
  ladder, pingpong, canon, notesOf, drumKit, triads, cutLanes, riser } from './heliobane_stage6.kit.js';
import { sawPluck, soften, delayLine, padLane, fadeIn } from './farstrand_halm.gen.js';

const SR = 22050, TAU = 2 * Math.PI;
const q3 = (x) => Math.round(x * 1000) / 1000;
const I = { kick: 0, snare: 1, hat: 2, tom: 3, bass: 4, pluck: 5, lead: 6, radio: 7, pad: 8, bell: 9, stat: 10, noise: 11,
  flesh: 12 };
const LAYOUT = ['kick', 'snare', 'hat', 'bass', 'hive', 'arp', 'canon', 'lead', 'echo', 'echo2', 'radio', 'radioEcho', 'static',
  'pad', 'bells', 'bellEcho', 'fx'];
const PANS = [0x80, 0x78, 0xac, 0x80, 0x80, 0x56, 0xaa, 0x86, 0x50, 0xb4, 0x8c, 0x4c, 0x9c, 0x70, 0x9c, 0x5c, 0x88];
const KEYS = ['lead', 'echo', 'echo2', 'radio', 'radioEcho', 'hive', 'arp', 'canon', 'pad', 'bells', 'bellEcho'];

// ---------------------------------------------------------------- samples
function rand(seed) { // mulberry32, -1..1 (the kit's generator)
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let v = Math.imul(s ^ (s >>> 15), s | 1);
    v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
    return (((v ^ (v >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}
/** A march snare, dark (farstrand_boss.gen.js's dark snare, tighter): the two-mode body, its noise through a two-pole
 *  low-pass near 2.4 kHz with a short crack. */
function marchSnare(name = 'march snare', { tone = 180, sec = 0.26, seed = 43, lp = 0.5, drive = 1.6 } = {}) {
  const r = rand(seed), n = Math.round(sec * SR), d = new Array(n); let a = 0, b = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, w = r();
    a += lp * (w - a); b += lp * (a - b);
    const body = (Math.sin(TAU * tone * t) * Math.exp(-t * 26) + 0.5 * Math.sin(TAU * tone * 1.71 * t) * Math.exp(-t * 36)) * 0.9;
    d[i] = Math.tanh(drive * (body + b * 2.6 * Math.exp(-t * 15) + w * Math.exp(-t * 450) * 0.3));
  }
  for (let i = 0; i < 48; i++) d[n - 1 - i] *= i / 48;
  let m = 0; for (const x of d) m = Math.max(m, Math.abs(x));
  return { name, samplerate: SR, channels: [d.map((x) => q3((x / m) * 0.97))], role: 'percussion' };
}
/** Radio static (as farstrand_benchmark.gen.js's): noise band-passed about 700 Hz-3.5 kHz with crackle, a seamless loop. */
function radioStatic(name = 'radio static', { sec = 1.4, seed = 67 } = {}) {
  const r = rand(seed), n = Math.round(sec * SR), m = 2048, d = new Array(n + m);
  let lo1 = 0, lo2 = 0, hi1 = 0, hi2 = 0, pop = 0;
  for (let i = 0; i < n + m; i++) {
    const w = r();
    hi1 += 0.55 * (w - hi1); hi2 += 0.55 * (hi1 - hi2);
    lo1 += 0.2 * (hi2 - lo1); lo2 += 0.2 * (lo1 - lo2);
    if (r() > 0.9985) pop = r() * 3;
    pop *= 0.93;
    d[i] = hi2 - lo2 + pop * r();
  }
  for (let i = 0; i < m; i++) d[i] = d[i] * (i / m) + d[n + i] * (1 - i / m);
  let mx = 0; for (let i = 0; i < n; i++) mx = Math.max(mx, Math.abs(d[i]));
  return { name, samplerate: SR, channels: [d.slice(0, n).map((x) => q3((x / mx) * 0.8))], loop: { start: 0, end: n },
    role: 'percussion' };
}

// ---------------------------------------------------------------- melodies
const CALL = 'a5/2 d6/2 a6/8 g6/2 f#6/2 | e6/4 d6/4 e6/8 | a5/2 d6/2 b6/8 a6/2 g6/2 | f#6/4 e6/4 d6/8'; // the Survey's
const KELL = 'g6/2 d6/2 g5/8 a5/2 bb5/2 | c6/4 d6/4 c6/8';                                          // turned inside out
const KELL2 = 'g6/2 d6/2 f5/8 g5/2 a5/2 | bb5/4 c6/4 d6/8~';
const ANSWER = 'g6/2 d6/2 g5/8 a5/2 bb5/2 | c6/4 d6/4 eb6/8 | g6/2 eb6/2 bb5/8 g5/2 bb5/2 | a5/4 f#5/4 d5/8';
const A_MEL = `${KELL} | ${KELL2} | ${ANSWER}`;
const A2_MEL = `${KELL} | ${KELL2} | d6/2 g6/2 bb6/8 a6/2 g6/2 | eb6/4 d6/4 c6/8 | eb6/2 g6/2 bb6/8 c7/2 bb6/2 | a6/8 f#6/4 a6/4`;
const A2_BELLS = 'd7/8 bb6/8 | g6/8 eb7/8 | f6/8 a6/8 | f6/8 a6/8 | d7/8 bb6/8 | eb7/8 g6/8 | bb6/8 g6/8 | f#6/8 a6/8';
const HIVE = 'g4/2 d4/2 g3/8 a3/2 bb3/2 | c4/4 d4/4 c4/8 | g4/2 d4/2 f3/8 g3/2 a3/2 | bb3/4 c4/4 d4/8'
  + ' | g4/2 eb4/2 bb3/8 g3/2 bb3/2 | c4/4 d4/4 eb4/8 | g4/2 eb4/2 bb3/8 c4/2 d4/2 | a3/4 f#3/4 d3/8';
const B_MEL = 'd6/16~ | g6/16~ | f6/16~ | d6/16~ | g6/8 bb6/8 | g6/16~ | bb6/16~ | a6/16~';
const BREAK_BELLS = 'r/16 | r/16 | r/16 | r/16 | g6/2 d6/2 g5/8 a5/2 bb5/2 | c6/4 d6/4 c6/8 | g6/2 eb6/2 bb5/8 g5/2 bb5/2'
  + ' | a5/4 f#5/4 d5/8';
const BREAK_RADIO = `${CALL} | r/16 | r/16 | r/16 | r/16`;
const BUILD_MEL = 'g6/3 bb6/3 eb7/2 d7/8 | g6/3 bb6/3 eb7/2 f7/8 | f#6/3 a6/3 d7/2 c7/8 | a6/16~';
const CH = {
  intro: 'D D Gm Cm', A: 'Gm Cm Dm Bb/8 Dm/8 Gm/16 Cm Eb D', B: 'Gm Cm Dm Dm Eb Cm Eb D', brk: 'D A G D Gm Cm Eb D',
  build: 'Eb Eb D D7',
};
const ROLL = [0, 2, 1, 3, 2, 4, 3, 1, 0, 2, 1, 3, 4, 3, 2, 1]; // 16ths, a march's turn rather than Halm's roll

// ---------------------------------------------------------------- the march
const drums = drumKit({
  kick: { X: [I.kick, 50], x: [I.kick, 36] },
  snare: { X: [I.snare, 40], x: [I.snare, 24], g: [I.snare, 12], t: [I.tom, 44, null, 'C-5'], T: [I.tom, 48, null, 'G-4'] },
  hat: { X: [I.hat, 18], x: [I.hat, 12], g: [I.hat, 7] },
});
const G = {
  march: { kick: 'X.......X.......', snare: '....X..x....X.xx', hat: 'x.g.x.g.x.g.x.g.' },
  drive: { kick: 'X...X...X...X...', snare: '....X..x....X.xx', hat: 'XgxgXgxgXgxgXgxg' },
  inside: { kick: '..X...X...X...X.', snare: 'X..g....X..g....', hat: '..x...x...x...x.' },
  half: { kick: 'X.........X.....', snare: '........X.......', hat: 'x.g.x.g.x.g.x.g.' },
  fill: { kick: 'X.......X...X.X.', snare: '....X..xXxXxtTtT', hat: 'x.g.x.g.........' },
  toms: { kick: 'X.........X.....', snare: '........tTtTtTtT', hat: 'x...x...........' },
  ticks: { kick: '................', snare: '................', hat: 'x.g.x.g.x.g.x.g.' },
  press: { kick: '................', snare: 'g.g.g.g.x.x.x.xx', hat: 'x.g.x.g.x.g.x.g.' },
  roll: { kick: 'X...X...X...X...', snare: 'XxXxXxXxXXXXXXXX', hat: '................' },
};
const BASS = { march: ['R.o.F.o.R.o.F.o.'], drone: ['R---------------'], quarter: ['R...r...R...r...'], drive: ['R.r.R.r.R.r.R.r.'] };
const bars = (list) => list.reduce((acc, [n, g, f]) => {
  const d = drums(n, g, f), off = acc.rows;
  for (const k of Object.keys(d)) for (const [r, e] of Object.entries(d[k])) acc.lanes[k][+r + off] = e;
  acc.rows += n * 16;
  return acc;
}, { rows: 0, lanes: { kick: {}, snare: {}, hat: {} } }).lanes;

function section(name, bars_, chordStr, { melody = null, melVol = 42, groove = G.march, fill = G.fill, kit = null,
  bassR = BASS.march, bassVol = 38, arpVol = 22, padVol = 15, bells = null, bellVol = 30, doubled = false, hive = null,
  radio = null, extra = {} } = {}) {
  const rows = bars_ * 16, segs = chart(chordStr), tri = chart(triads(chordStr));
  const parts = { ...(kit ?? drums(bars_, groove, fill)),
    bass: bass(tri, bassR, I.bass, { rows, lo: 'C-3', vol: bassVol, soft: 0.72, decay: 0.9 }) };
  const refs = [];
  if (melody) {
    const notes = mel(melody, { vol: melVol }), ch = line(notes, I.lead, { rows, vib: 'H33', vibDelay: 3 });
    parts.lead = ch; refs.push(notes);
    [parts.echo, parts.echo2] = pingpong(ch, notes, rows, { d1: 3, s1: 0.4, d2: 6, s2: 0.2, segs });
    refs.push(notesOf(parts.echo, rows), notesOf(parts.echo2, rows));
    if (doubled) {
      const up = mel(melody, { vol: 22, semi: 12 });
      parts.bells = soften(line(up, I.bell, { rows, vib: null }), rows, refs.slice(1));
      refs.push(notesOf(parts.bells, rows));
    }
  }
  if (radio) {
    const notes = mel(radio, { vol: 52 }), ch = line(notes, I.radio, { rows, sustain: 0.85, release: 0.6, vib: 'H22', vibDelay: 2 });
    parts.radio = ch; refs.push(notes);
    parts.radioEcho = canon(ch, notes, rows, { delay: 3, scale: 0.35, segs });
    refs.push(notesOf(parts.radioEcho, rows));
  }
  if (hive) {
    const notes = mel(hive, { vol: 44 }), ch = line(notes, I.flesh, { rows, sustain: 0.85, release: 0.6, vib: 'H43', vibDelay: 4 });
    parts.hive = ch; refs.push(notes);
  }
  if (bells) {
    const notes = mel(bells, { vol: bellVol }), ch = soften(line(notes, I.bell, { rows, vib: null }), rows, refs);
    parts.bells = ch;
    parts.bellEcho = soften(delayLine(ch, rows, segs, { delay: 6, scale: 0.4 }), rows, [...refs, notesOf(ch, rows)]);
    refs.push(notes, notesOf(parts.bellEcho, rows));
  }
  const arpNotes = ladder(segs, rows, ROLL, { lo: 'D-4', span: 8, vol: arpVol, soft: 7, len: 1 });
  parts.arp = soften(line(arpNotes, I.pluck, { rows, vib: null }), rows, refs);
  parts.canon = soften(delayLine(parts.arp, rows, segs, { delay: 3, scale: 0.4 }), rows, [...refs, notesOf(parts.arp, rows)]);
  parts.pad = padLane(segs, tri, rows, refs, { lo: 'D-5', vol: padVol, inst: I.pad });
  return pattern(name, bars_, cutLanes({ ...parts, ...extra }, KEYS), LAYOUT, PANS);
}

// ---------------------------------------------------------------- sections
const introTmp = section('tmp', 4, CH.intro).channels;
const intro = section('intro: the call, turned', 4, CH.intro, { melody: `r/16 | r/16 | ${KELL}`, radio: `${CALL.split(' | ').slice(0, 2).join(' | ')} | r/16 | r/16`,
  kit: bars([[1, G.ticks], [1, G.press], [2, G.march, G.fill]]), bassR: BASS.drone, bassVol: 30, padVol: 12, extra: {
    arp: fadeIn(introTmp[LAYOUT.indexOf('arp')], 32, 60), canon: fadeIn(introTmp[LAYOUT.indexOf('canon')], 35, 60),
    bass: { ...fadeIn(introTmp[LAYOUT.indexOf('bass')], 32, 48), 0: { note: 'D-3', instrument: I.bass, vol: 'v22' }, 16: { vol: 'v16' } },
    static: { 0: { note: 'C-5', instrument: I.stat, vol: 'v14' }, 16: { vol: 'v10' }, 28: { vol: 'v6' }, 32: { note: '^^' } },
    fx: riser(I.noise, 48, 64, { note: 'C-4', v0: 4, slope: 1.4, fx: 'F03' }),
  } });
const brk = section('break: the call as it was', 8, CH.brk, { radio: BREAK_RADIO, bells: BREAK_BELLS, bellVol: 46, groove: G.half,
  fill: G.toms, bassR: BASS.quarter, bassVol: 34, arpVol: 18, padVol: 18, extra: {
    static: { 0: { note: 'C-5', instrument: I.stat, vol: 'v8' }, 60: { vol: 'v4' }, 64: { note: '^^' } },
  } });
const build = section('build: bII to I', 4, CH.build, { melody: BUILD_MEL, kit: bars([[2, G.drive], [2, G.drive, G.roll]]),
  bassR: BASS.drive, bassVol: 40, arpVol: 24, padVol: 17, extra: { fx: riser(I.noise, 32, 64, { note: 'C-4', v0: 4, slope: 1.1, fx: 'F03' }) } });

const patterns = [
  intro,
  section('A: the call turned inside out', 8, CH.A, { melody: A_MEL }),
  section('A2: the answer climbs', 8, CH.A, { melody: A2_MEL, bells: A2_BELLS, bellVol: 26, padVol: 17 }),
  section('B: we', 8, CH.B, { melody: B_MEL, melVol: 34, hive: HIVE, groove: G.inside, fill: G.fill, arpVol: 20, padVol: 19,
    extra: { bass: { 0: { note: '^^' } } } }),
  brk,
  section('A3: the call doubled in glass', 8, CH.A, { melody: A_MEL, doubled: true, groove: G.drive, arpVol: 24, padVol: 17 }),
  jump(build, 1),
];

writeSongCompact(import.meta.url, {
  title: 'Farstrand - Kell', bpm: 160, ticks: 6, mixvol: 48,
  message: 'FARSTRAND boss theme "Kell": a Concord march turned inside out.\nD Phrygian, 160 BPM. Orders 1-6 loop.\nThe Survey\'s call (farstrand_benchmark) mirrored.\nAll samples synthesized. Source: songs/farstrand_boss_kell.gen.js',
  samples: [
    kick({ f0: 170, f1: 48, sweep: 30, decay: 10, click: 0.2, drive: 2.0, sec: 0.35 }),
    marchSnare(),
    cymbal('glass tick', { sec: 0.05, decay: 100, seed: 17, metalMix: 0.7 }),
    { ...kick({ f0: 180, f1: 90, sweep: 25, decay: 12, click: 0.15, drive: 1.6, sec: 0.35 }), name: 'tom' },
    wave('grit bass', [1, 0.55, 0.38, 0.26, 0.18, 0.12, 0.08, 0.05, 0.03]),
    sawPluck('dark pluck', { open: 2600, closed: 300, close: 7, decay: 4, sec: 0.8 }),
    wave('glass lead', [1, 0.03, 0.45, 0.02, 0.22, 0.02, 0.1, 0, 0.05]),
    wave('radio lead', [0.45, 0.8, 0.9, 0.75, 0.55, 0.4, 0.25, 0.12, 0.06]),
    thinPad('warm pad', { amps: [1, 0.55, 0.35, 0.22, 0.14, 0.08], spread: 1 }),
    glassBell('glass bell', { sec: 1.6, partials: [[1, 1, 1.6], [2.76, 0.45, 4], [5.4, 0.2, 7.5], [8.93, 0.08, 12]] }),
    radioStatic(), noiseLoop(),
    wave('flesh', [1, 0.7, 0.45, 0.32, 0.22, 0.15, 0.1, 0.06]),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
