#!/usr/bin/env node
/**
 * FARSTRAND — "Kell, a dirge" (both Kell fights: the duel at his cocoon on Sunder, and Kell worn's first two phases
 * at the Taproot; replaces the 160 BPM march of farstrand_boss_kell.gen.js, which stays as it was). 2026-10-22.
 * D Phrygian, 100 BPM, speed 6: 4 rows/beat, 16 rows/bar; one row = a 16th (150 ms), one bar = 2.4 s.
 * Rendered at 48 kHz, where 100 BPM is exact (1200 samples/tick).
 *
 * Identity: the same man, slower and heavier. KELL (the Survey's call turned inside out: 'G D G—— A Bb | C D C——') is
 * unchanged in pitch and proportion but stretched two to one, so the pairs of 8ths of the march are quarters here and
 * each long note lasts a whole bar: a funeral march's gait with no march under it. No oom-pah, no ticks, no arp:
 * a low D drone (the grit bass, held) with the Eb (bII, the family's wrong light) grinding against it from a second
 * voice a semitone up, swelling in and out so the two beat; a kick on 1 and a ghost before the snare, the snare (deep,
 * long) only on beat 3. The tune is carried low in the flesh voice (him, and the hive under him) and on tolling glass
 * bells, each strike left to ring on a channel of its own (two bell channels alternate).
 * The doom builds section by section: bells alone; the flesh sings and the snare comes; the furnace breathes (Sunder's
 * exhale and inhale, once a bar), the hive's chorus joins in the flesh voice, floor toms and a rumble that rises for
 * sixteen bars; then the furnace alone with the chorus loud. The one moment of light: bar 7 of B, the only bar of D
 * major and the only bar where an F# is struck (A F# D over the drone, the chorus on D F# A, glass bells two octaves
 * over the low ones; the F# bell's last ring runs about 70 ms into bar 8), with no drums, no furnace and no Eb in it.
 *
 * KELL (stretched; the same in the flesh, an octave and a bit up on bells):
 *   'G D G—— A Bb | C D C——' = 4-4-16-4-4 | 8-8-16 rows over Gm | Cm (two bars a chord), its second half
 *   'G D F—— G A | Bb C D——' over Dm | Bb Dm; the answer ends 'A F# D——' over D major (bar 7) and a bare D (bar 8).
 *
 * Phrase map
 *   Intro  D5 (4 bars)            static, the Survey's call broken off ('A D A——', radio, far), the drone and the grind
 *                                 fading in, a great bell on D to open and again in bar 4, a kick and a reverse swell into A (not looped)
 *   A      Gm Cm Dm Bb-Dm         the toll: KELL whole on bells (an octave under the old lead), drone, grind, a cold pad
 *   A2     same                   the flesh: KELL low in the flesh voice, the bells strike its long notes; snare on 3, the
 *                                 furnace every two bars
 *   B      Gm Cm Eb D D5          the hive: the answer in the flesh, doubled on bells; the chorus (G held under Gm Cm Eb,
 *                                 then A, D F# A, A D A); the furnace every bar; floor toms; the rumble begins to rise;
 *                                 bar 7 is the light
 *   C      Gm Cm Eb Eb D5         the furnace: the rumble at its height, the chorus loud and doubled an octave under, the
 *                                 furnace every bar, KELL's head and the Eb phrase in the flesh, a great bell on D every two
 *                                 bars, a drum fill and a reverse swell back into A (the loop jumps to order 1)
 * Loop body: orders 1-4 (32 bars, 76.8 s). Everything synthesized. Source of truth: this file; the shared helpers come
 * from farstrand_halm.gen.js, the motif, snare and static after farstrand_boss_kell.gen.js, the furnace after
 * farstrand_sunder.gen.js.
 * A sustained voice must restart once a loop or the loop is not periodic (music.py checks passes 2 and 3 match): the
 * drone and the grind restart at A at near silence, the rumble at B, every swell of the chorus and every pad chord on
 * its own.
 */
import { kick, wave, glassBell, thinPad, swell, mel, line, chart, beat, pattern, jump, writeSongCompact, canon, hits, triads,
  cutLanes, T } from './heliobane_stage6.kit.js';
import { padLane } from './farstrand_halm.gen.js';

const SR = 22050, TAU = 2 * Math.PI;
const q3 = (x) => Math.round(x * 1000) / 1000;
const v = (x) => `v${Math.max(0, Math.min(64, Math.round(x)))}`;
const I = { kick: 0, snare: 1, tom: 2, bass: 3, flesh: 4, bell: 5, pad: 6, stat: 7, rumble: 8, exhale: 9, inhale: 10,
  radio: 11, swell: 12 };
const LAYOUT = ['kick', 'snare', 'tom', 'exhale', 'inhale', 'bass', 'grind', 'flesh', 'hive1', 'hive2', 'hive3', 'hive4',
  'bellA', 'bellB', 'pad', 'radio', 'radioEcho', 'static', 'rumble', 'fx'];
const PANS = [0x80, 0x78, 0x88, 0x80, 0x80, 0x80, 0x8c, 0x84, 0x60, 0x80, 0xa0, 0x74, 0x6c, 0x94, 0x70, 0x8c, 0x4c, 0x9c, 0x80, 0x88];
const KEYS = ['flesh', 'hive1', 'hive2', 'hive3', 'hive4', 'pad', 'radio', 'radioEcho'];

// ---------------------------------------------------------------- samples
function rand(seed) { // mulberry32, -1..1 (the kit's generator)
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = Math.imul(s ^ (s >>> 15), s | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return (((x ^ (x >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}
function oneShot(name, sec, fn, extra = {}) {
  const n = Math.round(sec * SR), d = new Array(n);
  for (let i = 0; i < n; i++) d[i] = fn(i / SR);
  for (let i = 0; i < 64; i++) d[n - 1 - i] *= i / 64;
  let m = 0; for (const x of d) m = Math.max(m, Math.abs(x));
  return { name, samplerate: SR, channels: [d.map((x) => q3((x / m) * 0.95))], role: 'percussion', ...extra };
}
/** boss_kell's march snare slowed to a dirge: the body down near 125 Hz and longer, its noise through a two-pole
 *  low-pass near 1.2 kHz with a long soft tail and a short crack. */
function dirgeSnare(name = 'dirge snare', { tone = 125, sec = 0.55, seed = 43, lp = 0.3, drive = 1.5 } = {}) {
  const r = rand(seed); let a = 0, b = 0;
  return oneShot(name, sec, (t) => {
    const w = r();
    a += lp * (w - a); b += lp * (a - b);
    const body = (Math.sin(TAU * tone * t) * Math.exp(-t * 15) + 0.5 * Math.sin(TAU * tone * 1.71 * t) * Math.exp(-t * 22)) * 0.9;
    return Math.tanh(drive * (body + b * 3.0 * Math.exp(-t * 8) + w * Math.exp(-t * 400) * 0.2));
  });
}
/** Radio static (boss_kell's): noise band-passed about 700 Hz-3.5 kHz with crackle, a seamless loop. */
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
  return { name, samplerate: SR, channels: [d.slice(0, n).map((x) => q3((x / mx) * 0.8))], loop: { start: 0, end: n }, role: 'percussion' };
}
/** The rumble that rises: white noise through a two-pole low-pass near 370 Hz, a seamless loop; played at C-3 it is
 *  a sub-bass roar, and it climbs with Fxx to a dull wind. */
function rumbleLoop(name = 'rumble', { sec = 1.8, seed = 71, lp = 0.1 } = {}) {
  const r = rand(seed), n = Math.round(sec * SR), m = 2048, d = new Array(n + m);
  let a = 0, b = 0;
  for (let i = 0; i < n + m; i++) { a += lp * (r() - a); b += lp * (a - b); d[i] = b; }
  for (let i = 0; i < m; i++) d[i] = d[i] * (i / m) + d[n + i] * (1 - i / m);
  let mx = 0; for (let i = 0; i < n; i++) mx = Math.max(mx, Math.abs(d[i]));
  return { name, samplerate: SR, channels: [d.slice(0, n).map((x) => q3((x / mx) * 0.85))], loop: { start: 0, end: n }, role: 'percussion' };
}
/** Sunder's furnace breathing in: noise through a low-pass opening 150 Hz to 1.6 kHz as it swells, 1 s. */
function inhale(name = 'furnace inhale', { sec = 1.0, seed = 57 } = {}) {
  const r = rand(seed); let a = 0, b = 0;
  return oneShot(name, sec, (t) => {
    const k = t / sec, g = 1 - Math.exp(-TAU * (150 + 1450 * k * k) / SR);
    a += g * (r() - a); b += g * (a - b);
    return b * k * k * (k > 0.97 ? (1 - k) / 0.03 : 1);
  });
}
/** Sunder's furnace breathing out: a soft deep thud (a sine gliding 78 to 38 Hz) and a roar low-passed near 500 Hz. */
function exhale(name = 'furnace exhale', { sec = 1.8, seed = 59 } = {}) {
  const r = rand(seed); let a = 0, b = 0, ph = 0;
  const g = 1 - Math.exp(-TAU * 500 / SR);
  return oneShot(name, sec, (t) => {
    ph += TAU * (38 + 40 * Math.exp(-t * 18)) / SR;
    a += g * (r() - a); b += g * (a - b);
    return Math.tanh(1.8 * Math.sin(ph) * Math.exp(-t * 7)) * 0.8 + 5 * b * Math.exp(-t * 2.2) * Math.min(1, t * 60);
  });
}

// ---------------------------------------------------------------- the tune (KELL, stretched two to one)
const KELL = 'g5/4 d5/4 g4/16 a4/4 bb4/4 | c5/8 d5/8 c5/16', KELL2 = 'g5/4 d5/4 f4/16 g4/4 a4/4 | bb4/8 c5/8 d5/16';
const ANS = 'g5/4 d5/4 g4/16 a4/4 bb4/4 | c5/8 d5/8 eb5/16 | g5/4 eb5/4 bb4/16 g4/4 bb4/4';
const BELL_S1 = `${KELL} | ${KELL2}`;                                       // bells: an octave under the old lead
const BELL_B = `${ANS} | a6/8 f#6/8 | d6/16`;                               // the answer; the light, high
const FLESH_S1 = 'g4/4 d4/4 g3/16 a3/4 bb3/4 | c4/8 d4/8 c4/16 | g4/4 d4/4 f3/16 g3/4 a3/4 | bb3/8 c4/8 d4/16~';
const FLESH_B = 'g4/4 d4/4 g3/16 a3/4 bb3/4 | c4/8 d4/8 eb4/16 | g4/4 eb4/4 bb3/16 g3/4 bb3/4 | a3/8 f#3/8 | d3/16~';
const FLESH_C = 'g4/4 d4/4 g3/16 a3/4 bb3/4 | r/32 | g4/4 eb4/4 bb3/16 g3/4 bb3/4 | r/32';
const CALL_HEAD = 'r/16 | a5/4 d6/4 a6/16~ r/8 | r/16';              // the Survey's call, broken off after its first line
const CH = { S1: 'Gm/32 Cm Dm Bb/16 Dm', B: 'Gm/32 Cm Eb D/16 D5', C: 'Gm/32 Cm Eb Eb/16 D5', intro: 'D5/64' };

// ---------------------------------------------------------------- levels over the loop (rows from A's start; A 0, A2 128, B 256, C 384)
const lerp = (pts, g) => {
  for (let i = 1; i < pts.length; i++) if (g <= pts[i][0]) { const [g0, a] = pts[i - 1], [g1, b] = pts[i]; return a + (b - a) * (g - g0) / (g1 - g0); }
  return pts[pts.length - 1][1];
};
const DRONE = [[0, 2], [16, 15], [128, 17], [256, 20], [384, 26], [488, 28], [511, 2]];       // restarts at A, near silence
const GRIND = [[32, 64, 11], [96, 128, 13], [160, 192, 16], [208, 256, 18], [256, 288, 18], [288, 320, 21], [320, 352, 27],
  [368, 384, 11], [384, 416, 24], [416, 448, 27], [448, 480, 30], [480, 496, 32]];            // Eb swells; none in bar 7 of B
const grind = (g, win = GRIND) => {
  for (const [s, e, p] of win) if (g >= s && g < e) return p * Math.sin(Math.PI * (g - s) / (e - s)) ** 2;
  return 0;
};
const rumble = (g) => 2 + 36 * ((g - 256) / 256) ** 1.4;
function levels(rows, g0, f, { note = null, inst, step = 2, fx = null } = {}) {
  const ch = {};
  for (let r = 0; r < rows; r += step) ch[r] = { vol: v(f(g0 + r)), ...(fx && r % 4 === 0 ? { fx } : {}) };
  if (note) ch[0] = { note, instrument: inst, vol: v(f(g0)) };
  return ch;
}
/** Bell strikes left to ring: notes alternate between two channels so the last one still sounds under the next. */
function tolls(notes, rows) {
  const lanes = [{}, {}];
  notes.forEach(([row, note, , vol], i) => { if (row < rows) lanes[i % 2][row] = { note, instrument: I.bell, vol: v(vol) }; });
  return lanes;
}
/** A held tone that breathes: [row, len, note, peak] each a sin² swell from silence, restarted on its own; k scales the
 *  peaks, p > 1 skews the swell to peak late (a crescendo that falls off at the change). */
function swells(list, rows, inst, { step = 2, k = 1, p = 1 } = {}) {
  const ch = {};
  for (const [row, len] of list) if (row + len < rows) ch[row + len] = { note: '^^' };
  for (const [row, len, note, peak] of list) {
    ch[row] = { note, instrument: inst, vol: v(1) };
    for (let r = row + step; r < row + len - 1 && r < rows; r += step) ch[r] = { vol: v(1 + peak * k * Math.sin(Math.PI * ((r - row) / len) ** p) ** 2) };
    if (row + len - 1 < rows) ch[row + len - 1] = { vol: v(1) };
  }
  return ch;
}
const fleshLine = (str, vol, rows = 128) => {
  const notes = mel(str, { vol });
  return [notes, line(notes, I.flesh, { rows, sustain: 0.85, release: 0.6, vib: 'H43', vibDelay: 4 })];
};

// ---------------------------------------------------------------- the kit: a slow heavy kick, the snare on 3, the furnace
const KM = { X: [I.kick, 54], x: [I.kick, 34] }, SM = { X: [I.snare, 44], x: [I.snare, 26], t: [I.tom, 40, null, 'C-5'], T: [I.tom, 46, null, 'G-4'] };
const TM = { t: [I.tom, 40, null, 'C-5'], T: [I.tom, 46, null, 'G-4'] };
const EM = { E: [I.exhale, 36], e: [I.exhale, 24] }, IM = { I: [I.inhale, 26], i: [I.inhale, 18] };
const E = '................', bars = (s, n) => Array(n).fill(s);
const dr = (b, map, k = 1) => beat(b, Object.fromEntries(Object.entries(map).map(([c, d]) => [c, [d[0], Math.round(d[1] * k), d[2], d[3]]])));
const KICK = 'X.....x.........', SNARE = '........X.......';

// ---------------------------------------------------------------- sections
function section(name, nbars, parts, { drone, g0, bells, notes, chords = null, padVol = 0 }) {
  const rows = nbars * 16, [bellA, bellB] = tolls(bells, rows);
  const all = { ...parts, bellA, bellB, bass: drone, grind: levels(rows, g0, (g) => grind(g), { note: g0 === 0 ? 'D#3' : null, inst: I.bass }) };
  if (chords && padVol) all.pad = padLane(chart(chords), chart(triads(chords)), rows, notes, { lo: 'D-4', vol: padVol, inst: I.pad });
  return pattern(name, nbars, cutLanes(all, KEYS), LAYOUT, PANS);
}
const droneLane = (g0, first = false) => levels(128, g0, (g) => lerp(DRONE, g), { note: first ? 'D-3' : null, inst: I.bass });

const introGrind = [[28, 60, 10]];
const intro = (() => {
  const rows = 64, notes = mel(CALL_HEAD, { vol: 38 }), ch = line(notes, I.radio, { rows, sustain: 0.85, release: 0.6, vib: 'H22', vibDelay: 2 });
  const [bellA, bellB] = tolls([[0, T('d4'), 16, 44], [48, T('d4'), 16, 48]], rows);
  return pattern('intro: the call, broken off', 4, cutLanes({
    radio: ch, radioEcho: canon(ch, notes, rows, { delay: 6, scale: 0.35, segs: chart(CH.intro) }),
    static: { 0: { note: 'C-5', instrument: I.stat, vol: 'v18' }, 16: { vol: 'v14' }, 28: { vol: 'v6' }, 40: { note: '^^' } },
    bass: levels(rows, 0, (r) => (r < 24 ? 4 + 12 * r / 24 : 16 - 14 * (r - 24) / 40), { note: 'D-3', inst: I.bass }),
    grind: levels(rows, 0, (r) => grind(r, introGrind), { note: 'D#3', inst: I.bass }),
    kick: dr([E, E, E, 'X...............'], KM, 1.1), bellA, bellB, fx: hits(I.swell, [54], { vol: 30 }),
  }, KEYS), LAYOUT, PANS);
})();

const bellsA = mel(BELL_S1, { vol: 50 }), bellsB = mel(BELL_B, { vol: 38 }).map((n) => (n[0] >= 96 ? [n[0], n[1], n[2], n[0] < 112 ? 52 : 44, n[4]] : n));
const [fleshA2Notes, fleshA2] = fleshLine(FLESH_S1, 54);
const [fleshBNotes, fleshB] = fleshLine(FLESH_B, 56);
const [, fleshC] = fleshLine(FLESH_C, 54);
const tollsA2 = mel(BELL_S1, { vol: 46 }).filter((n) => n[2] >= 16);

const A = section('A: the toll', 8, { kick: dr([...bars('X...............', 4), ...bars(KICK, 4)], KM, 0.85) },
  { drone: droneLane(0, true), g0: 0, bells: bellsA, notes: [bellsA], chords: CH.S1, padVol: 17 });
const A2 = section('A2: the flesh', 8, {
  flesh: fleshA2, kick: dr(bars(KICK, 8), KM, 0.95), snare: dr(bars(SNARE, 8), SM, 0.85),
  exhale: dr([...Array(4)].flatMap(() => ['e...............', E]), EM), inhale: dr([...Array(4)].flatMap(() => [E, '........i.......']), IM),
}, { drone: droneLane(128), g0: 128, bells: tollsA2, notes: [fleshA2Notes], chords: CH.S1, padVol: 18 });

const choirB = [[[0, 96, T('g4'), 16], [96, 32, T('a4'), 16]], [[0, 32, T('bb4'), 14], [32, 32, T('c5'), 14], [64, 32, T('bb4'), 14], [96, 32, T('d5'), 14]],
  [[0, 32, T('d5'), 13], [32, 64, T('eb5'), 14], [96, 16, T('f#5'), 20], [112, 16, T('a5'), 12]]];
const B = section('B: the hive', 8, {
  flesh: fleshB, kick: dr([...bars(KICK, 6), E, KICK], KM, 1.05), snare: dr([...bars(SNARE, 6), E, SNARE], SM, 1),
  tom: dr([E, E, E, E, ...bars('............T...', 2), E, '............T...'], TM),
  exhale: dr([...bars('E...............', 6), E, 'E...............'], EM), inhale: dr([...bars('........I.......', 6), E, '........I.......'], IM),
  hive1: swells(choirB[0], 128, I.flesh), hive2: swells(choirB[1], 128, I.flesh), hive3: swells(choirB[2], 128, I.flesh),
  rumble: levels(128, 256, rumble, { note: 'C-3', inst: I.rumble, step: 4, fx: 'F01' }),
}, { drone: droneLane(256), g0: 256, bells: bellsB, notes: [fleshBNotes], chords: CH.B, padVol: 18 });

const choirC = [[[0, 64, T('g4'), 22], [64, 48, T('g4'), 24], [112, 16, T('a4'), 20]], [[0, 32, T('bb4'), 20], [32, 32, T('c5'), 20], [64, 48, T('bb4'), 22], [112, 16, T('d5'), 18]],
  [[0, 32, T('d5'), 18], [32, 80, T('eb5'), 22], [112, 16, T('a5'), 16]], [[0, 64, T('g3'), 22], [64, 48, T('g3'), 24], [112, 16, T('a3'), 20]]];
const CW = { k: 1.25, p: 1.7 };
const C = section('C: the furnace', 8, {
  flesh: fleshC, kick: dr([...bars('X.....x.X.......', 7), 'X.......X.....X.'], KM, 1.1), snare: dr(bars(SNARE, 8), SM, 1.05),
  tom: dr([E, E, ...bars('............tT..', 5), '..........tTtTtT'], TM, 1.1),
  exhale: dr(bars('E...............', 8), EM, 1.7), inhale: dr([...bars('........I.......', 7), E], IM, 1.7),
  hive1: swells(choirC[0], 128, I.flesh, CW), hive2: swells(choirC[1], 128, I.flesh, CW), hive3: swells(choirC[2], 128, I.flesh, CW),
  hive4: swells(choirC[3], 128, I.flesh, CW),
  rumble: { ...levels(127, 384, rumble, { step: 4, fx: 'F01' }), 127: { note: '^^' } }, fx: hits(I.swell, [118], { vol: 40 }),
}, { drone: droneLane(384), g0: 384, bells: [0, 32, 64, 96].map((r) => [r, T('d4'), 16, 46]), notes: [] });

const patterns = [intro, A, A2, B, jump(C, 1)];

writeSongCompact(import.meta.url, {
  title: 'Farstrand - Kell, a dirge', bpm: 100, ticks: 6, mixvol: 48,
  message: 'FARSTRAND boss theme "Kell", a dirge: his march slowed to a funeral.\nD Phrygian, 100 BPM. Orders 1-4 loop.\nKELL (the Survey\'s call turned inside out) stretched two to one, low and on bells; the Eb grinding on a D drone.\nAll samples synthesized. Source: songs/farstrand_boss_kell_dirge.gen.js',
  samples: [
    kick({ f0: 140, f1: 40, sweep: 20, decay: 7.5, click: 0.2, drive: 1.9, sec: 0.6 }),
    dirgeSnare(),
    { ...kick({ f0: 120, f1: 55, sweep: 16, decay: 6, click: 0.05, drive: 1.3, sec: 0.8 }), name: 'floor tom' },
    wave('grit bass', [1, 0.55, 0.38, 0.26, 0.18, 0.12, 0.08, 0.05, 0.03]),
    wave('flesh', [1, 0.7, 0.45, 0.32, 0.22, 0.15, 0.1, 0.06]),
    glassBell('glass bell', { sec: 3.6, partials: [[1, 1, 0.8], [2.76, 0.45, 2], [5.4, 0.2, 4], [8.93, 0.08, 7.5]] }),
    thinPad('cold pad', { amps: [1, 0, 0.3, 0, 0.1], spread: 1 }),
    radioStatic(), rumbleLoop(), exhale(), inhale(),
    wave('radio lead', [0.45, 0.8, 0.9, 0.75, 0.55, 0.4, 0.25, 0.12, 0.06]),
    swell('swell', { sec: 1.5, seed: 23 }),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
