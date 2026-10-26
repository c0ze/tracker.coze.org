#!/usr/bin/env node
/**
 * FARSTRAND — "Sunder" (a hot world close to a white star; Kell tapped a strand into the star and the hive is sunfed
 * everywhere). 2026-09-26.
 * B minor, 120 BPM, speed 6: 4 rows/beat, 16 rows/bar; one row = a 16th (125 ms), one bar = 2 s.
 * Rendered at 48 kHz, where 120 BPM is exact (1000 samples/tick).
 *
 * Identity: white heat. The fastest and brightest of the worlds (Halm 100, the Knot 92, Verrin 90, Carcanet 105), in
 * sharps a fifth over Halm's E minor, but the family stays and is scorched: the glass lead with its 3/6-row ping-pong
 * echoes, here a hotter glass (more upper harmonics) with a quick shallow shimmer on its held notes; the pluck arp
 * with its dotted-8th (3-row) canon, brighter; glass bells; the bII (C major, Halm's wrong light) with the #11 over
 * it (F# over C). The pads shimmer: two copies beating five times a second, and a white glass an octave over them.
 * Under it the furnace breathes, once a bar: a dark inhale swelling for the last half bar and the exhale on the
 * downbeat (a soft deep thud and a roar), and the bass pulses in 8ths whose level breathes with it.
 * The lead's cell is a flare: 'F# B C# D——' (5 1 2 b3, rising like heat), then the maj7 shimmer over G.
 * B is Kell's lamps: Kell's own call (boss_kell: the Survey's call turned inside out) on glass bells in B, far off
 * with 6/12-row echoes, on Kell's chords (Em Am Bm, C the bII, B major his Concord moment), the lead holding long
 * notes over it. C is the furnace alone: no lead, no drums, the breath loud, the pads swelling, two glints.
 *
 * Phrase map
 *   Intro  Bm Bm Bm F#                  the furnace breathing alone, the shimmer pad fading in, the arp from bar 3,
 *                                       the kit in bar 4 and a reverse swell into A (not looped)
 *   A      Bmadd9 Gmaj7 D A | Bmadd9 Gmaj7 C F#   the flare 'F# B C# D——', 'F#> E D——', 'A D E F#——', 'E—— C#';
 *                                       'F# B C# D——', 'B—— A F#', 'G F# E——' over C (the #11), 'C#—— A#——'
 *   A2     same                         the same question; the answer climbs white: 'B D F#——' over Gmaj7, 'E D C B'
 *                                       over C, 'A#—— C#——' open; snare on the backbeat, glass sparks
 *   B      Em Am Bm Bm | Em Am C B       Kell's lamps: his call on glass bells ('E B E—— F# G | A B A——' ...
 *                                       'F# D# B——'), the lead holding B E F# D B E G F#; kick and snare fuller
 *   C      Bm Bm Gmaj7 Gmaj7 | Em Em C F#sus4-F#   the furnace: no lead, no kit, the breath and the pads, the
 *                                       arp in 8ths, two bell glints; a reverse swell back into A
 * Loop body: orders 1-4 (32 bars, 64 s). Everything synthesized. Source of truth: this file; the shared helpers
 * come from farstrand_halm.gen.js.
 */
import { kick, cymbal, wave, glassBell, thinPad, swell, mel, line, chart, bass, beat, pattern, jump,
  writeSongCompact, ladder, pingpong, notesOf, hits, triads, cutLanes } from './heliobane_stage6.kit.js';
import { echoChannel } from './lib.js';
import { sawPluck, soften, delayLine, padLane, fadeIn } from './farstrand_halm.gen.js';

const SR = 22050, TAU = 2 * Math.PI;
const q3 = (x) => Math.round(x * 1000) / 1000;
const I = { kick: 0, snare: 1, hat: 2, exhale: 3, inhale: 4, bass: 5, pluck: 6, lead: 7, pad: 8, glass: 9, bell: 10,
  swell: 11 };
const LAYOUT = ['kick', 'snare', 'hat', 'exhale', 'inhale', 'bass', 'arp', 'canon', 'lead', 'echo', 'echo2', 'pad', 'glass',
  'bells', 'bellEcho', 'bellEcho2', 'fx'];
const PANS = [0x80, 0x78, 0xa8, 0x80, 0x80, 0x80, 0x54, 0xae, 0x88, 0x4c, 0xb8, 0x70, 0x94, 0x64, 0xa4, 0x48, 0x90];
const KEYS = ['lead', 'echo', 'echo2', 'arp', 'canon', 'pad', 'glass', 'bells', 'bellEcho', 'bellEcho2'];

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
/** A snare darker than the kit's (after farstrand_boss.gen.js's): the two-mode body, its noise through a two-pole
 *  low-pass near 2.8 kHz and only a short bright crack, so the backbeat does not glare. */
function hotSnare(name = 'hot snare', { tone = 205, sec = 0.3, seed = 29, lp = 0.55, drive = 1.5 } = {}) {
  const r = rand(seed); let a = 0, b = 0;
  return oneShot(name, sec, (t) => {
    const w = r();
    a += lp * (w - a); b += lp * (a - b);
    const body = (Math.sin(TAU * tone * t) * Math.exp(-t * 24) + 0.5 * Math.sin(TAU * tone * 1.71 * t) * Math.exp(-t * 34)) * 0.9;
    return Math.tanh(drive * (body + b * 2.4 * Math.exp(-t * 13) + w * Math.exp(-t * 400) * 0.25));
  });
}
/** The furnace breathing in: noise through a two-pole low-pass opening from about 150 Hz to 1.6 kHz as it swells
 *  (the level rising as the square), for 1 s (half a bar), stopping short into the exhale. */
function inhale(name = 'furnace inhale', { sec = 1.0, seed = 57 } = {}) {
  const r = rand(seed); let a = 0, b = 0;
  return oneShot(name, sec, (t) => {
    const k = t / sec, g = 1 - Math.exp(-TAU * (150 + 1450 * k * k) / SR);
    a += g * (r() - a); b += g * (a - b);
    return b * k * k * (k > 0.97 ? (1 - k) / 0.03 : 1);
  });
}
/** The furnace breathing out: a soft deep thud (a sine gliding 78 to 38 Hz) and a roar (noise low-passed near
 *  500 Hz) falling away over a bar. */
function exhale(name = 'furnace exhale', { sec = 1.8, seed = 59 } = {}) {
  const r = rand(seed); let a = 0, b = 0, ph = 0;
  const g = 1 - Math.exp(-TAU * 500 / SR);
  return oneShot(name, sec, (t) => {
    ph += TAU * (38 + 40 * Math.exp(-t * 18)) / SR;
    a += g * (r() - a); b += g * (a - b);
    const thud = Math.tanh(1.8 * Math.sin(ph) * Math.exp(-t * 7));
    return thud * 0.8 + 5 * b * Math.exp(-t * 2.2) * Math.min(1, t * 60);
  });
}

// ---------------------------------------------------------------- melodies
const FLARE = 'f#5/2 b5/2 c#6/4 d6/8';
const A_MEL = `${FLARE} | f#6/6> e6/2 d6/8 | a5/2 d6/2 e6/4 f#6/8 | e6/12~ c#6/4`
  + ` | ${FLARE} | b6/8~ a6/4 f#6/4 | g6/6 f#6/2 e6/8 | c#6/8 a#5/8`;
const A2_MEL = `${FLARE} | f#6/6> e6/2 d6/8 | a5/2 d6/2 e6/4 f#6/8 | e6/12~ c#6/4`
  + ` | ${FLARE} | b6/4 d7/4 f#7/8~ | e7/6 d7/2 c7/4 b6/4 | a#6/8 c#7/8~`;
const B_MEL = 'b5/16~ | e6/16~ | f#6/16~ | d6/16~ | b5/16~ | e6/16~ | g6/16~ | f#6/16~';
// Kell's call (boss_kell, in D Phrygian) a minor third down, in B: the Survey's call turned inside out
const KELL_B = 'e6/2 b5/2 e5/8 f#5/2 g5/2 | a5/4 b5/4 a5/8 | e6/2 b5/2 d5/8 e5/2 f#5/2 | g5/4 a5/4 b5/8'
  + ' | e6/2 b5/2 e5/8 f#5/2 g5/2 | a5/4 b5/4 c6/8 | e6/2 c6/2 g5/8 e5/2 g5/2 | f#5/4 d#5/4 b4/8';
const A2_BELLS = 'r/8 b6/8 | r/16 | r/8 a6/8 | r/16 | r/8 f#6/8 | r/16 | r/8 e7/8 | r/16';
const C_BELLS = 'r/16 | r/8 b6/8 | r/16 | r/16 | r/16 | r/8 g6/8 | r/16 | r/16';
const CH = {
  intro: 'Bm Bm Bm F#', A: 'Bmadd9 Gmaj7 D A Bmadd9 Gmaj7 C F#', B: 'Em Am Bm Bm Em Am C B',
  C: 'Bm Bm Gmaj7 Gmaj7 Em Em C F#sus4/8 F#/8',
};
const ROLL = [0, 2, 3, 5, 4, 2, 3, 1, 0, 2, 3, 5, 6, 5, 3, 2]; // 16ths through 8 chord-tone rungs (Halm's roll)
const SLOW = [0, 2, 4, 6, 5, 3, 1, 3];                           // 8ths, the furnace section

// ---------------------------------------------------------------- the kit, the furnace, the bass
const K = {
  kick: { X: [I.kick, 50], x: [I.kick, 36] }, snare: { X: [I.snare, 40], x: [I.snare, 24] },
  hat: { X: [I.hat, 17], x: [I.hat, 11], g: [I.hat, 6] }, exhale: { E: [I.exhale, 54], e: [I.exhale, 38] },
  inhale: { I: [I.inhale, 44], i: [I.inhale, 30] },
};
const EMPTY = '................';
const BREATH = { exhale: 'E...............', inhale: '........I.......' };
const G = {
  A: { kick: 'X.....x...X.....', snare: EMPTY, hat: 'XgxgXgxgXgxgXgxg', ...BREATH },
  A2: { kick: 'X.....x...X.....', snare: '....X.......X...', hat: 'XgxgXgxgXgxgXgxg', ...BREATH },
  B: { kick: 'X.....x.X.x.....', snare: '....X.......X..x', hat: 'XgxgXgxgXgxgXgxg', ...BREATH },
  fill: { kick: 'X.....x.X.x.X.X.', snare: '....X...X.xxXxXx', hat: 'XgxgXgxg........', ...BREATH },
  furnace: { kick: EMPTY, snare: EMPTY, hat: EMPTY, exhale: 'E...............', inhale: '........I.......' },
  breath: { kick: EMPTY, snare: EMPTY, hat: EMPTY, exhale: 'e...............', inhale: EMPTY },  // the swell breathes in
  start: { kick: 'X.........X.....', snare: '............X.xx', hat: 'x.g.x.g.XgxgXgxg', ...BREATH },
};
const kit = (grooves) => Object.fromEntries(Object.keys(K).map((k) => [k, beat(grooves.map((g) => g[k]), K[k])]));
const each = (bars, list) => Array.from({ length: bars }, (_, b) => list[b % list.length]);
const BASS = { pulse: ['R.r.r.r.R.r.f.o.'], held: ['R-------r-------'], drone: ['R---------------'] };
const LUNG = [1, 0.72, 0.58, 0.52, 0.55, 0.64, 0.78, 0.92]; // the bass's level by 8th in a bar: out, ebb, in
/** The bass, its level breathing with the furnace: each note scaled by where it falls in the bar. */
function breathing(ch) {
  const out = {};
  for (const [r, e] of Object.entries(ch)) {
    const k = LUNG[Math.floor((+r % 16) / 2)];
    out[r] = e.vol?.startsWith('v') ? { ...e, vol: `v${Math.round(Number(e.vol.slice(1)) * k)}` } : e;
  }
  return out;
}

function section(name, bars, chordStr, { grooves, melody = null, melVol = 38, bells = null, bellVol = 30, bassR = BASS.pulse,
  bassVol = 34, shape = ROLL, step = 1, arpVol = 24, padVol = 15, glassVol = 6, extra = {} } = {}) {
  const rows = bars * 16, segs = chart(chordStr), tri = chart(triads(chordStr));
  const parts = { ...kit(grooves), bass: breathing(bass(tri, bassR, I.bass, { rows, lo: 'C-3', vol: bassVol, soft: 0.78, decay: 0.93 })) };
  const refs = [];
  if (melody) {
    const notes = mel(melody, { vol: melVol }), ch = line(notes, I.lead, { rows, vib: 'H62', vibDelay: 3 });
    parts.lead = ch; refs.push(notes);
    [parts.echo, parts.echo2] = pingpong(ch, notes, rows, { d1: 3, s1: 0.42, d2: 6, s2: 0.22, segs });
    refs.push(notesOf(parts.echo, rows), notesOf(parts.echo2, rows));
  }
  if (bells) {
    const notes = mel(bells, { vol: bellVol }), ch = soften(line(notes, I.bell, { rows, vib: null }), rows, refs);
    parts.bells = ch;
    [parts.bellEcho, parts.bellEcho2] = pingpong(ch, notes, rows, { d1: 6, s1: 0.42, d2: 12, s2: 0.22, segs });
    refs.push(notes, notesOf(parts.bellEcho, rows), notesOf(parts.bellEcho2, rows));
  }
  const arpNotes = ladder(segs, rows, shape, { lo: 'F#4', span: 8, vol: arpVol, soft: 7, len: step });
  parts.arp = soften(line(arpNotes, I.pluck, { rows, vib: null }), rows, refs);
  parts.canon = soften(delayLine(parts.arp, rows, segs, { delay: 3, scale: 0.42 }), rows, [...refs, notesOf(parts.arp, rows)]);
  parts.pad = padLane(segs, tri, rows, refs, { lo: 'D-5', vol: padVol, inst: I.pad });
  parts.glass = echoChannel(parts.pad, { delay: 0, semi: 12, scale: glassVol / padVol, inst: I.glass, rows });
  return pattern(name, bars, cutLanes({ ...parts, ...extra }, KEYS), LAYOUT, PANS);
}

// ---------------------------------------------------------------- sections
const introParts = section('tmp', 4, CH.intro, { grooves: each(4, [G.A]) }).channels;
const at = (k) => introParts[LAYOUT.indexOf(k)];
const intro = section('intro: the furnace', 4, CH.intro, { grooves: [G.furnace, G.furnace, G.furnace, G.start], bassR: BASS.drone,
  padVol: 14, extra: {
    bass: { ...fadeIn(at('bass'), 32, 56), 0: { note: 'B-2', instrument: I.bass, vol: 'v16' }, 16: { vol: 'v12' } },
    arp: fadeIn(at('arp'), 32, 60), canon: fadeIn(at('canon'), 35, 60), pad: fadeIn(at('pad'), 0, 32),
    glass: fadeIn(at('glass'), 8, 40), fx: hits(I.swell, [56], { vol: 28 }),
  } });
const furnace = section('C: the furnace', 8, CH.C, { grooves: [...each(7, [G.furnace]), G.breath], bells: C_BELLS, bellVol: 34,
  bassR: BASS.held, bassVol: 28, shape: SLOW, step: 2, arpVol: 22, padVol: 20, glassVol: 9,
  extra: { fx: hits(I.swell, [120], { vol: 28 }) } });

const patterns = [
  intro,
  section('A: the flare', 8, CH.A, { grooves: [...each(7, [G.A]), G.fill], melody: A_MEL }),
  section('A2: white', 8, CH.A, { grooves: [...each(7, [G.A2]), G.fill], melody: A2_MEL, bells: A2_BELLS, padVol: 16 }),
  section("B: Kell's lamps", 8, CH.B, { grooves: [...each(7, [G.B]), G.fill], melody: B_MEL, melVol: 30, bells: KELL_B,
    bellVol: 36, bassVol: 36, arpVol: 22, padVol: 17, glassVol: 7 }),
  jump(furnace, 1),
];

writeSongCompact(import.meta.url, {
  title: 'Farstrand - Sunder', bpm: 120, ticks: 6, mixvol: 48,
  message: 'FARSTRAND world theme "Sunder": white heat, the furnace breathing.\nB minor, 120 BPM. Orders 1-4 loop.\nB rings Kell\'s call (boss_kell) on glass bells.\nAll samples synthesized. Source: songs/farstrand_sunder.gen.js',
  samples: [
    kick({ f0: 150, f1: 48, sweep: 30, decay: 9, click: 0.12, drive: 1.6, sec: 0.4 }),
    hotSnare(),
    cymbal('sizzle tick', { sec: 0.07, decay: 55, seed: 31, metalMix: 0.4 }),
    exhale(), inhale(),
    wave('warm bass', [1, 0.45, 0.25, 0.13, 0.07, 0.03]),
    sawPluck('bright pluck', { open: 3800, closed: 520, close: 6, decay: 4, sec: 0.8 }),
    wave('scorched glass', [1, 0.06, 0.5, 0.05, 0.3, 0.04, 0.2, 0.03, 0.13, 0.02, 0.08, 0.02, 0.04]),
    thinPad('shimmer pad', { amps: [1, 0, 0.35, 0, 0.15, 0, 0.07], spread: 2 }),
    thinPad('white glass', { amps: [1, 0, 0.15, 0, 0.05], spread: 3 }),
    glassBell('glass bell', { sec: 2.0, partials: [[1, 1, 1.2], [2.76, 0.45, 3.2], [5.4, 0.2, 6.5], [8.93, 0.08, 10]] }),
    swell('swell', { sec: 1.0, seed: 37 }),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
