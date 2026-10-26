#!/usr/bin/env node
/**
 * FARSTRAND — "The Taproot" (the last region: Kell's strand plunging into Ninth Light's young sun, sunfed and
 * growing; he has grown into it). 2026-10-01.
 * D minor with Kell's Phrygian Eb, 130 BPM, speed 6: 4 rows/beat, 16 rows/bar; one row = a 16th (115 ms), one bar
 * = 1.85 s. Rendered at 44148 Hz, the smallest rate over 44.1 kHz where 130 BPM is exact (849 samples/tick).
 *
 * Identity: the family's motifs burning. The fastest world (Sunder 120), in D: Ninth Light's young sun and Kell's
 * key at once, so the bII (Eb, the family's wrong-coloured light and Kell's own note) is everywhere. Sunder's
 * scorched glass lead with its 3/6-row ping-pong echoes and a wide, hot vibrato; the bright pluck with its
 * dotted-8th (3-row) canon; shimmer pads and a white glass over them; glass bells. Under it the corona roars
 * (looped low noise breathing once a bar) and the root's feeding hearts beat, lub-dub, on every downbeat (the boss's
 * lamp-hearts); the bass pulses in 8ths. The motifs come in turn and each one is scorched: the title's question
 * 'A—F——E | D———' and its second phrase, whose E burns to Eb over Eb; Halm's cell 'D E F——' flaring up a fifth;
 * Ninth Light's 'G Bb A' over Eb and the Choir's chord climbed, 'C# F A'. B is Kell grown into it: his motif
 * (boss_kell's KELL, the Survey's call turned inside out) two octaves down in the flesh voice, 'we', while the lead
 * holds long notes that melt into each other (glides) and the bells ring the title's question far off. C is the
 * corona: no lead and no kit, only the hearts, the roar loud and the pads swelling, two glints.
 *
 * Phrase map
 *   Intro  Dm Dm Eb Dm                  the roar and the hearts alone, a low D; the pads fade in, the arp from bar 3,
 *                                       the kit in bar 4, a reverse swell into A (not looped)
 *   A      Dm Bbmaj7 Gm Eb | Dm Bbmaj7 Eb Aaug   'A F E | D', 'A G F | Eb' (the motif burnt); Halm's cell
 *                                       'D E F', flaring 'C> A F'; 'G Bb A' over Eb; 'C# F A' over Aaug
 *   A2     same                         the same question; the answer climbs, 'F G A', 'D> C A', 'Bb G A',
 *                                       'F C# A' (the Choir's chord falling home); snare on the backbeat, sparks
 *   B      Gm Cm Dm Dm | Eb Cm Eb Aaug   we: KELL in the flesh two octaves down; the lead melting D> G> A, D,
 *                                       G Bb G> Bb> A; the title's question on bells over Dm and Eb
 *   C      Dm Dm Bbmaj7 Bbmaj7 | Gm Gm Eb Aaug   the corona: the hearts, the roar, the pads, the arp in 8ths,
 *                                       two glints; the roar easing in the last half bar, a reverse swell back into A
 * Loop body: orders 1-4 (32 bars, 59.1 s). Everything synthesized. Source of truth: this file; the shared helpers
 * come from farstrand_halm.gen.js, the scorched glass and the bright pluck after farstrand_sunder.gen.js, the flesh
 * voice and KELL after farstrand_boss_kell.gen.js.
 */
import { kick, cymbal, wave, glassBell, thinPad, swell, mel, line, chart, bass, beat, pattern, jump,
  writeSongCompact, ladder, pingpong, notesOf, hits, triads, cutLanes } from './heliobane_stage6.kit.js';
import { echoChannel } from './lib.js';
import { sawPluck, soften, delayLine, padLane, fadeIn } from './farstrand_halm.gen.js';

const SR = 22050, TAU = 2 * Math.PI;
const q3 = (x) => Math.round(x * 1000) / 1000;
const I = { kick: 0, snare: 1, hat: 2, heart: 3, roar: 4, bass: 5, pluck: 6, lead: 7, pad: 8, glass: 9, bell: 10,
  flesh: 11, swell: 12 };
const LAYOUT = ['kick', 'snare', 'hat', 'heart', 'roar', 'bass', 'arp', 'canon', 'lead', 'echo', 'echo2', 'hive', 'pad',
  'glass', 'bells', 'bellEcho', 'bellEcho2', 'fx'];
const PANS = [0x80, 0x78, 0xa8, 0x80, 0x80, 0x80, 0x54, 0xae, 0x88, 0x4c, 0xb8, 0x80, 0x70, 0x94, 0x64, 0xa4, 0x48, 0x90];
const KEYS = ['lead', 'echo', 'echo2', 'hive', 'arp', 'canon', 'pad', 'glass', 'bells', 'bellEcho', 'bellEcho2'];

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
function oneShot(name, sec, fn, extra = {}) {
  const n = Math.round(sec * SR), d = new Array(n);
  for (let i = 0; i < n; i++) d[i] = fn(i / SR);
  for (let i = 0; i < 64; i++) d[n - 1 - i] *= i / 64;
  let m = 0; for (const x of d) m = Math.max(m, Math.abs(x));
  return { name, samplerate: SR, channels: [d.map((x) => q3((x / m) * 0.95))], role: 'percussion', ...extra };
}
/** The hot snare (farstrand_sunder.gen.js's): the two-mode body, its noise low-passed near 2.8 kHz. */
function hotSnare(name = 'hot snare', { tone = 205, sec = 0.3, seed = 29, lp = 0.55, drive = 1.5 } = {}) {
  const r = rand(seed); let a = 0, b = 0;
  return oneShot(name, sec, (t) => {
    const w = r();
    a += lp * (w - a); b += lp * (a - b);
    const body = (Math.sin(TAU * tone * t) * Math.exp(-t * 24) + 0.5 * Math.sin(TAU * tone * 1.71 * t) * Math.exp(-t * 34)) * 0.9;
    return Math.tanh(drive * (body + b * 2.4 * Math.exp(-t * 13) + w * Math.exp(-t * 400) * 0.25));
  });
}
/** A feeding heart: a soft wet thud (a sine gliding 120 to 55 Hz, saturated so a small speaker hears it) with a
 *  short sunfed sizzle on it; 'X..x' in a groove is its lub-dub. */
function heartThud(name = 'root heart', { sec = 0.5, seed = 61 } = {}) {
  const r = rand(seed); let ph = 0, a = 0;
  return oneShot(name, sec, (t) => {
    ph += TAU * (55 + 65 * Math.exp(-t * 22)) / SR;
    const w = r(); a += 0.35 * (w - a);
    return Math.tanh(2.2 * Math.sin(ph) * Math.exp(-t * 9) * Math.min(1, t * 400)) + (w - a) * 0.25 * Math.exp(-t * 30);
  });
}
/** The corona: noise through a two-pole low-pass near 420 Hz with a slow roll, a seamless loop (its last 2048
 *  samples cross-faded into its start). The pattern breathes its volume once a bar. */
function coronaRoar(name = 'corona roar', { sec = 1.6, seed = 73 } = {}) {
  const r = rand(seed), n = Math.round(sec * SR), m = 2048, d = new Array(n + m);
  const g = 1 - Math.exp(-TAU * 420 / SR); let a = 0, b = 0;
  for (let i = 0; i < n + m; i++) {
    a += g * (r() - a); b += g * (a - b);
    d[i] = b * (1 + 0.25 * Math.sin(TAU * 3 * i / n));
  }
  for (let i = 0; i < m; i++) d[i] = d[i] * (i / m) + d[n + i] * (1 - i / m);
  let mx = 0; for (let i = 0; i < n; i++) mx = Math.max(mx, Math.abs(d[i]));
  return { name, samplerate: SR, channels: [d.slice(0, n).map((x) => q3((x / mx) * 0.9))], loop: { start: 0, end: n },
    role: 'percussion' };
}

// ---------------------------------------------------------------- melodies
const QUESTION = 'a5/4 f6/10~ e6/2 | d6/12~ r/4 | a5/4 g6/10~ f6/2 | eb6/12~ r/4'; // the title's, its E burnt to Eb
const A_MEL = `${QUESTION} | r/4 d6/2 e6 f6/8~ | c7/6> a6/2 f6/8 | g6/4 bb6 a6/8~ | c#6/4 f6 a6/8~`;
const A2_MEL = `${QUESTION} | r/4 f6/2 g6 a6/8~ | d7/6> c7/2 a6/8 | bb6/4 g6 a6/8~ | f6/4 c#6 a5/8`;
// B: the lead melting from one long note into the next (glides), over KELL in the flesh
const B_MEL = 'd6/16~ | g6/16~> | a6/16~> | d6/16~ | g6/8 bb6/8 | g6/16~ | bb6/16~> | a6/16~>';
const HIVE = 'g4/2 d4/2 g3/8 a3/2 bb3/2 | c4/4 d4/4 c4/8 | g4/2 d4/2 f3/8 g3/2 a3/2 | bb3/4 c4/4 d4/8'
  + ' | g4/2 eb4/2 bb3/8 g3/2 bb3/2 | c4/4 d4/4 eb4/8 | g4/2 eb4/2 bb3/8 c4/2 d4/2 | c#4/4 f4/4 a3/8';
const B_BELLS = 'r/16 | r/16 | a6/4 f7/10 e7/2 | d7/16 | a6/4 g7/10 f7/2 | r/16 | r/16 | r/16';
const A2_SPARKS = 'r/8 d7/8 | r/16 | r/8 a6/8 | r/16 | r/8 f7/8 | r/16 | r/8 g6/8 | r/16';
const C_BELLS = 'r/16 | r/8 d7/8 | r/16 | r/16 | r/16 | r/8 bb6/8 | r/16 | r/16';
const CH = {
  intro: 'Dm Dm Eb Dm', A: 'Dm Bbmaj7 Gm Eb Dm Bbmaj7 Eb Aaug', B: 'Gm Cm Dm Dm Eb Cm Eb Aaug',
  C: 'Dm Dm Bbmaj7 Bbmaj7 Gm Gm Eb Aaug',
};
const ROLL = [0, 2, 3, 5, 4, 2, 3, 1, 0, 2, 3, 5, 6, 5, 3, 2]; // 16ths through 8 chord-tone rungs (Halm's roll)
const SLOW = [0, 2, 4, 6, 5, 3, 1, 3];                           // 8ths, the corona

// ---------------------------------------------------------------- the kit, the hearts, the corona, the bass
const K = {
  kick: { X: [I.kick, 50], x: [I.kick, 36] }, snare: { X: [I.snare, 40], x: [I.snare, 24] },
  hat: { X: [I.hat, 17], x: [I.hat, 11], g: [I.hat, 6] },
  heart: { X: [I.heart, 36], x: [I.heart, 24], H: [I.heart, 48], h: [I.heart, 32] },
};
const EMPTY = '................';
const LUBDUB = 'X..x............';
const G = {
  A: { kick: 'X.....x...X.....', snare: EMPTY, hat: 'XgxgXgxgXgxgXgxg', heart: LUBDUB },
  A2: { kick: 'X.....x...X.....', snare: '....X.......X...', hat: 'XgxgXgxgXgxgXgxg', heart: LUBDUB },
  B: { kick: 'X.....x.X.x.....', snare: '....X.......X..x', hat: 'XgxgXgxgXgxgXgxg', heart: LUBDUB },
  fill: { kick: 'X.....x.X.x.X.X.', snare: '....X...X.xxXxXx', hat: 'XgxgXgxg........', heart: LUBDUB },
  hearts: { kick: EMPTY, snare: EMPTY, hat: EMPTY, heart: 'H..h............' },
  feeding: { kick: EMPTY, snare: EMPTY, hat: '......g.......g.', heart: 'H..h....H..h....' }, // the corona: they feed harder
  start: { kick: 'X.........X.....', snare: '............X.xx', hat: 'x.g.x.g.XgxgXgxg', heart: LUBDUB },
};
const kit = (grooves) => Object.fromEntries(Object.keys(K).map((k) => [k, beat(grooves.map((g) => g[k]), K[k])]));
const each = (bars, list) => Array.from({ length: bars }, (_, b) => list[b % list.length]);
const PULSE = 'R.r.r.r.R.r.f.o.';
// the pulse in 8ths; its last bar (Aaug) takes the third for the fifth, which the augmented chord does not have
const BASS = { pulse: [...Array(7).fill(PULSE), 'R.r.r.r.R.r.t.o.'], held: ['R-------r-------'], drone: ['R---------------'] };
/** The corona's roar: one looped note, its volume breathing once a bar (low on the downbeat, swelling to the next). */
function roar(bars, { lo = 14, hi = 32 } = {}) {
  const ch = { 0: { note: 'C-5', instrument: I.roar, vol: `v${lo}` } };
  for (let r = 2; r < bars * 16; r += 2) {
    const k = (r % 16) / 16;
    ch[r] = { vol: `v${Math.round(lo + (hi - lo) * k * k)}` };
  }
  return ch;
}

function section(name, bars, chordStr, { grooves, melody = null, melVol = 38, hive = null, bells = null, bellVol = 30,
  bassR = BASS.pulse, bassVol = 34, shape = ROLL, step = 1, arpVol = 24, padVol = 16, glassVol = 6, roarLo = 14,
  roarHi = 32, extra = {} } = {}) {
  const rows = bars * 16, segs = chart(chordStr), tri = chart(triads(chordStr));
  const parts = { ...kit(grooves), roar: roar(bars, { lo: roarLo, hi: roarHi }),
    bass: bass(tri, bassR, I.bass, { rows, lo: 'C-3', vol: bassVol, soft: 0.78, decay: 0.93 }) };
  const refs = [];
  if (melody) {
    const notes = mel(melody, { vol: melVol }), ch = line(notes, I.lead, { rows, vib: 'H64', vibDelay: 3 });
    parts.lead = ch; refs.push(notes);
    [parts.echo, parts.echo2] = pingpong(ch, notes, rows, { d1: 3, s1: 0.42, d2: 6, s2: 0.22, segs });
    refs.push(notesOf(parts.echo, rows), notesOf(parts.echo2, rows));
  }
  if (hive) {
    const notes = mel(hive, { vol: 32 });
    parts.hive = line(notes, I.flesh, { rows, sustain: 0.85, release: 0.6, vib: 'H43', vibDelay: 4 });
    refs.push(notes);
  }
  if (bells) {
    const notes = mel(bells, { vol: bellVol }), ch = soften(line(notes, I.bell, { rows, vib: null }), rows, refs);
    parts.bells = ch;
    [parts.bellEcho, parts.bellEcho2] = pingpong(ch, notes, rows, { d1: 6, s1: 0.42, d2: 12, s2: 0.22, segs });
    refs.push(notes, notesOf(parts.bellEcho, rows), notesOf(parts.bellEcho2, rows));
  }
  const arpNotes = ladder(segs, rows, shape, { lo: 'D-4', span: 8, vol: arpVol, soft: 7, len: step });
  parts.arp = soften(line(arpNotes, I.pluck, { rows, vib: null }), rows, refs);
  parts.canon = soften(delayLine(parts.arp, rows, segs, { delay: 3, scale: 0.42 }), rows, [...refs, notesOf(parts.arp, rows)]);
  parts.pad = padLane(segs, tri, rows, refs, { lo: 'D-5', vol: padVol, inst: I.pad });
  parts.glass = echoChannel(parts.pad, { delay: 0, semi: 12, scale: glassVol / padVol, inst: I.glass, rows });
  return pattern(name, bars, cutLanes({ ...parts, ...extra }, KEYS), LAYOUT, PANS);
}

// ---------------------------------------------------------------- sections
const introParts = section('tmp', 4, CH.intro, { grooves: each(4, [G.A]) }).channels;
const at = (k) => introParts[LAYOUT.indexOf(k)];
const intro = section('intro: the root', 4, CH.intro, { grooves: [G.hearts, G.hearts, G.hearts, G.start], bassR: BASS.drone,
  padVol: 14, roarLo: 16, roarHi: 38, extra: {
    bass: { ...fadeIn(at('bass'), 32, 56), 0: { note: 'D-3', instrument: I.bass, vol: 'v18' }, 16: { vol: 'v14' } },
    arp: fadeIn(at('arp'), 32, 60), canon: fadeIn(at('canon'), 35, 60), pad: fadeIn(at('pad'), 0, 32),
    glass: fadeIn(at('glass'), 8, 40), fx: hits(I.swell, [56], { vol: 28 }),
  } });
const corona = section('C: the corona', 8, CH.C, { grooves: each(8, [G.feeding]), bells: C_BELLS, bellVol: 34,
  bassR: BASS.held, bassVol: 28, shape: SLOW, step: 2, arpVol: 22, padVol: 20, glassVol: 9, roarLo: 20, roarHi: 46,
  extra: { fx: hits(I.swell, [120], { vol: 28 }),
    roar: { ...roar(8, { lo: 20, hi: 46 }), 122: { vol: 'v22' }, 124: { vol: 'v16' }, 126: { vol: 'v12' } } } }); // eases into the loop

const patterns = [
  intro,
  section('A: the motifs burning', 8, CH.A, { grooves: [...each(7, [G.A]), G.fill], melody: A_MEL }),
  section('A2: the answer climbs', 8, CH.A, { grooves: [...each(7, [G.A2]), G.fill], melody: A2_MEL, bells: A2_SPARKS,
    bellVol: 26, padVol: 16 }),
  section('B: we', 8, CH.B, { grooves: [...each(7, [G.B]), G.fill], melody: B_MEL, melVol: 32, hive: HIVE, bells: B_BELLS,
    bellVol: 40, bassVol: 30, arpVol: 20, padVol: 17, glassVol: 7, extra: { bass: { 0: { note: '^^' } } } }),
  jump(corona, 1),
];

writeSongCompact(import.meta.url, {
  title: 'Farstrand - The Taproot', bpm: 130, ticks: 6, mixvol: 48,
  message: 'FARSTRAND "The Taproot": the family\'s motifs burning.\nD minor / Phrygian, 130 BPM. Orders 1-4 loop.\nB sinks Kell\'s motif (boss_kell) into the flesh.\nAll samples synthesized. Source: songs/farstrand_taproot.gen.js',
  samples: [
    kick({ f0: 150, f1: 48, sweep: 30, decay: 9, click: 0.12, drive: 1.6, sec: 0.4 }),
    hotSnare(),
    cymbal('sizzle tick', { sec: 0.07, decay: 55, seed: 31, metalMix: 0.4 }),
    heartThud(), coronaRoar(),
    wave('warm bass', [1, 0.45, 0.25, 0.13, 0.07, 0.03]),
    sawPluck('bright pluck', { open: 3800, closed: 520, close: 6, decay: 4, sec: 0.8 }),
    wave('scorched glass', [1, 0.06, 0.5, 0.05, 0.3, 0.04, 0.2, 0.03, 0.13, 0.02, 0.08, 0.02, 0.04]),
    thinPad('shimmer pad', { amps: [1, 0.4, 0.35, 0.2, 0.15, 0.08, 0.07], spread: 2 }),
    thinPad('white glass', { amps: [1, 0, 0.15, 0, 0.05], spread: 3 }),
    glassBell('glass bell', { sec: 2.0, partials: [[1, 1, 1.2], [2.76, 0.45, 3.2], [5.4, 0.2, 6.5], [8.93, 0.08, 10]] }),
    wave('flesh', [1, 0.7, 0.45, 0.32, 0.22, 0.15, 0.1, 0.06]),
    swell('swell', { sec: 0.9, seed: 41 }), // 8 rows are 0.92 s: it ends just before the downbeat
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
