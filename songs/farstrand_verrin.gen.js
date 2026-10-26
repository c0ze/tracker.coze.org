#!/usr/bin/env node
/**
 * FARSTRAND — "Verrin" (an ocean world under a kilometre of ice; vents keep the reefs warm). 2026-09-26.
 * F# minor, 90 BPM, speed 6: 4 rows/beat, 16 rows/bar; one row = a 16th (167 ms), one bar = 2.67 s.
 * Rendered at 44.1 kHz, where 90 BPM is exact (1225 samples/tick).
 *
 * Identity: under the ice. Slow, echoing, cold, a little warm near the vents. Slow: the lead holds long notes
 * and sinks (glides into some of them), the drums are a soft kick on 1 and a half-time snare at most. Echoing:
 * every voice has long echoes, the lead's 6 and 12 rows late (a dotted quarter and a dotted half), the arp's two
 * canons 6 and 12 rows late panned hard apart, the snare's 6 and 12 rows late. Cold: a muffled pluck (its
 * filter barely opens: under water), a slowly beating cold pad with a glass harmonica over it, the sea under
 * everything (a looped brown noise swelling), bubbles and glass ticks for hats, an ice-rim click for a snare. Warm: in B, at the vents, the pad turns
 * to a warm one (even harmonics), the chords turn major (D A E) and the arp rises instead of sinking.
 * The family: the lead's cell is the title's leap, 5 up a minor sixth to b3 ("C# A——"); Verrin's own colour
 * is the #11 over the bVI (G# over Dmaj7), as Halm's is B over F. The deep section (C) is the Hollow Bell,
 * Verrin's Worn, heard far off: its six-tone phrase (v_bell_7: F# E C# B A F#) on a church-bell sample with
 * the same partials as its voice, with 6- and 12-row echoes.
 *
 * Phrase map
 *   Intro   F#madd9 F#madd9 Dmaj7 Dmaj7   the sea, a low F#, one far toll of the Hollow Bell, bubbles, the arp and
 *                                         its canons fading in, a reverse swell (not looped)
 *   A       F#madd9 Dmaj7 Bm7 C#sus4-C# | F#madd9 Dmaj7 E F#madd9   "C# A—— | G#——— F# E | D F# B | C#——— B G#";
 *                                         the answer climbs (G#> A C#——) and settles on F# over E major; kick on 1
 *   A2      F#madd9 Dmaj7 Bm7 C#sus4-C# (twice)   the same question; the answer sinks to C# (the dominant);
 *                                         half-time snare and its long echo; bell glints
 *   B       Dmaj7 A E F#m | Dmaj7 A Bm7 C#     the vents: the warm pad, the soft lead (an ocarina) rising in
 *                                         pickups, the arp rising in 8ths, bubbling hats, a fuller kick
 *   C       F#m F#m Bm Bm Dmaj7 Dmaj7 C#sus4 C#   the deep: no drums, no lead; the Hollow Bell's phrase far off
 *                                         with 6- and 12-row echoes over the glass harmonica; the arp in quarters
 *   A3      as A                          the tune on the ocarina with glass bells an octave over it; half-time kit
 *   Tail    Dmaj7 E F#madd9 F#madd9 | Bm7 Dmaj7 C#sus4 C#   no lead: arp, pads, bell glints (the cell C# A);
 *                                         a reverse swell back into A
 * Loop body: orders 1-6 (48 bars, 128 s). Everything synthesized. Source of truth: this file; the shared
 * helpers come from farstrand_halm.gen.js. The Verrin samples marked `export` are shared with
 * farstrand_undertow.gen.js and farstrand_bell.gen.js.
 */
import { kick, cymbal, wave, glassBell, thinPad, swell, mel, line, chart, bass, beat, rep, pattern, jump,
  writeSongCompact, ladder, pingpong, notesOf, hits, triads, cutLanes } from './heliobane_stage6.kit.js';
import { echoChannel } from './lib.js';
import { sawPluck, soften, delayLine, padLane, wind, fadeIn } from './farstrand_halm.gen.js';
import { pathToFileURL } from 'url';

const SR = 22050, TAU = 2 * Math.PI, MID_C = 261.6256;
const q3 = (x) => Math.round(x * 1000) / 1000;
const I = { kick: 0, snare: 1, bub: 2, bass: 3, pluck: 4, lead: 5, soft: 6, pad: 7, glass: 8, warm: 9, bell: 10, hollow: 11,
  sea: 12, swell: 13, tick: 14 };
const LAYOUT = ['kick', 'snare', 'snEcho', 'hat', 'bass', 'arp', 'canon', 'canon2', 'lead', 'echo', 'echo2', 'pad', 'glass',
  'bells', 'bellEcho', 'bellEcho2', 'sea', 'fx'];
const PANS = [0x80, 0x78, 0xb4, 0x9c, 0x80, 0x64, 0xbc, 0x2c, 0x88, 0x48, 0xc0, 0x70, 0x94, 0x6c, 0xac, 0x40, 0x80, 0x90];
const KEYS = ['lead', 'echo', 'echo2', 'arp', 'canon', 'canon2', 'pad', 'glass', 'bells', 'bellEcho', 'bellEcho2'];

// ---------------------------------------------------------------- Verrin samples (shared)
function rand(seed) { // mulberry32, -1..1 (the kit's generator)
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let v = Math.imul(s ^ (s >>> 15), s | 1);
    v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
    return (((v ^ (v >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}
const norm = (d, peak = 0.97) => { let m = 0; for (const x of d) m = Math.max(m, Math.abs(x)); return d.map((x) => q3((x / m) * peak)); };
/** The sea under the ice: brown noise, DC removed, a gentle low-pass, a breath of differentiated white noise
 *  on top (the air of the ice); a seamless loop (its last 2048 samples
 *  cross-faded into its start). Swell it with the wind helper. */
export function seaLoop(name = 'sea noise', { sec = 1.6, seed = 57, lp = 0.2, air = 0.45 } = {}) {
  const r = rand(seed), n = Math.round(sec * SR), m = 2048, d = new Array(n + m);
  let b = 0, a = 0, dc = 0, w1 = 0;
  for (let i = 0; i < n + m; i++) {
    const w = r();
    b = 0.99 * b + 0.1 * w; dc += 0.002 * (b - dc); a += lp * (b - dc - a); d[i] = a + air * (w - w1); w1 = w;
  }
  for (let i = 0; i < m; i++) d[i] = d[i] * (i / m) + d[n + i] * (1 - i / m);
  return { name, samplerate: SR, channels: [norm(d.slice(0, n), 0.8)], loop: { start: 0, end: n } };
}
/** A bubble: a sine rising from its note (x1.7 over its life) and ringing about 20 ms. C-5 starts at middle C. */
export function bubble(name = 'bubble', { sec = 0.1, tau = 0.02 } = {}) {
  const n = Math.round(sec * SR), d = new Array(n); let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    d[i] = Math.sin(ph) * Math.exp(-t / tau) * Math.min(1, t * 2000);
    ph += TAU * MID_C * (1 + 7 * t) / SR;
  }
  return { name, samplerate: SR, c5speed: SR, channels: [norm(d)], role: 'percussion' };
}
/** The Hollow Bell: a church bell's partials over its prime (hum 0.5, prime, the minor-third tierce 1.19, quint
 *  1.5, nominal 2, 2.5, 2.66, 3, 4), each a doublet 0.15 % apart (the warble), two glass partials (5.4, 8.93) on
 *  top, a muffled knock, through a one-pole low-pass (under water). C-5 plays a middle-C prime. Its voice lines
 *  (Farstrand tools/audio/synth_bell.py) ring the same partials. */
export function hollowBell(name = 'hollow bell', { sec = 3.2, lp = 0.52, seed = 29 } = {}) {
  const P = [[0.5, 0.35, 0.5], [1, 0.6, 1.0], [1.19, 0.55, 1.4], [1.5, 0.3, 1.9], [2, 1, 1.6], [2.5, 0.3, 3], [2.66, 0.35, 3.3],
    [3, 0.35, 4], [4, 0.18, 5.5], [5.4, 0.4, 7], [8.93, 0.22, 11]];
  const r = rand(seed), phase = P.map(() => [r() * Math.PI, r() * Math.PI]), n = Math.round(sec * SR), d = new Array(n);
  let a = 0, k = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR; let s = 0;
    P.forEach(([ratio, w, dec], j) => {
      const e = w * Math.exp(-dec * t);
      s += e * (Math.sin(TAU * MID_C * ratio * t + phase[j][0]) + 0.6 * Math.sin(TAU * MID_C * ratio * 1.0015 * t + phase[j][1]));
    });
    k += 0.15 * (r() - k);
    s = s * Math.min(1, t * 700) + 1.2 * k * Math.exp(-t / 0.012);
    a += lp * (s - a); d[i] = a;
  }
  for (let i = 0; i < 64; i++) d[n - 1 - i] *= i / 64;
  return { name, samplerate: SR, c5speed: SR, channels: [norm(d)] };
}

// ---------------------------------------------------------------- melodies
const CELL = 'r/4 c#5/4 a5/8~';  // the title's leap, 5 up a minor sixth to b3, held
const QUESTION = `${CELL} | g#5/10~ f#5/2 e5/4 | r/4 d5/4 f#5/4 b5 | c#6/8~ b5/4 g#5`;
const A_MEL = `${QUESTION} | ${CELL} | g#5/6> a5/2 c#6/8~ | b5/6 g#5/2 e5/8 | f#5/16~`;
const A2_MEL = `${QUESTION} | ${CELL} | g#5/8 f#5/4 d5 | d5/12~ c#5/2 b4 | c#5/16~`;
const B_MEL = 'r/2 e5/2 f#5/12~ | e5/4 c#5/12 | r/2 b4/2 e5/12~ | f#5/4 c#5/4 a4/8 | r/2 f#5/2 a5/8~ g#5/4 | e5/16'
  + ' | r/2 d5/2 f#5/8 b5/4 | g#5/8~ e#5/8';
const BELL_PHRASE = 'f#5/4 e5/4 c#5/24 | b4/4 a4/4 f#4/24 | f#5/4 e5/4 c#5/24 | g#4/32';  // v_bell_7, left to ring
const GLINTS = 'c#7/16 | r/16 | a6/16 | r/16 | f#6/16 | r/16 | g#6/16 | r/16';
const TAIL_BELLS = 'r/4 c#6/4 a6/8 | r/16 | r/4 c#6/4 a6/8 | r/16 | r/4 b5/4 f#6/8 | r/16 | g#6/16 | e#6/16';
const CH = {
  intro: 'F#madd9 F#madd9 Dmaj7 Dmaj7', A: 'F#madd9 Dmaj7 Bm7 C#sus4/8 C#/8 F#madd9/16 Dmaj7 E F#madd9',
  A2: 'F#madd9 Dmaj7 Bm7 C#sus4/8 C#/8 F#madd9/16 Dmaj7 Bm7 C#sus4/8 C#/8', B: 'Dmaj7 A E F#m Dmaj7 A Bm7 C#',
  C: 'F#m F#m Bm Bm Dmaj7 Dmaj7 C#sus4 C#', tail: 'Dmaj7 E F#madd9 F#madd9 Bm7 Dmaj7 C#sus4 C#',
};
const SINK = [8, 6, 7, 5, 3, 4, 2, 0];  // 8ths: drops sinking through three octaves of the triad from F#3
const RISE = [0, 2, 1, 3, 5, 4, 6, 8];  // 8ths: the vents, rising
const SLOW = [0, 4, 7, 5];              // quarters, the deep

// ---------------------------------------------------------------- parts
const KM = { X: [I.kick, 44], x: [I.kick, 30] };
const SM = { X: [I.snare, 40], x: [I.snare, 26] };
const BM = { b: [I.bub, 20, null, 'C-6'], c: [I.bub, 14, null, 'E-6'], d: [I.bub, 17, null, 'A-5'], B: [I.bub, 24, null, 'G-5'],
  g: [I.tick, 11], x: [I.tick, 17] };
const G = {
  A: { kick: 'X...............', snare: '................', hat: '..gb..g..dg...c.' },
  half: { kick: 'X.........x.....', snare: '........X.......', hat: '..b.x.c...d.x.g.' },
  vent: { kick: 'X.....x...X.....', snare: '........X.......', hat: 'bgc.dgb.cgB.dgc.' },
  out: { kick: 'X...............', snare: '........X...x...', hat: 'bgc.dg..........' },
};
function drums(bars, g, last = null) {
  const lane = (k, m) => beat(rep(bars, g[k], last?.[k]), m);
  return { kick: lane('kick', KM), snare: lane('snare', SM), hat: lane('hat', BM) };
}
/** The snare's own echo: each hit again 6 and 12 rows later, softer. */
function snareEcho(sn, rows) {
  const ch = {};
  for (const [r, e] of Object.entries(sn)) {
    if (!e.note || e.note === '^^') continue;
    for (const [d, s] of [[6, 0.38], [12, 0.18]]) {
      if (+r + d < rows && !ch[+r + d]) ch[+r + d] = { ...e, vol: `v${Math.round(Number(e.vol.slice(1)) * s)}` };
    }
  }
  return ch;
}

function section(name, bars, chordStr, { melody = null, leadInst = I.lead, melVol = 38, groove = null, last = null,
  bassR = ['R-----------r---'], bassVol = 30, shape = SINK, step = 2, arpVol = 30, padInst = I.pad, padVol = 15,
  glassVol = 6, seaHi = 11, bell = null, bellInst = I.bell, bellVol = 30, doubled = false, extra = {} } = {}) {
  const rows = bars * 16, segs = chart(chordStr), tri = chart(triads(chordStr));
  const parts = { sea: wind(bars, { lo: 5, hi: seaHi, inst: I.sea }),
    bass: bass(tri, bassR, I.bass, { rows, lo: 'F#2', vol: bassVol, decay: 0.95 }) };
  if (groove) { Object.assign(parts, drums(bars, groove, last)); parts.snEcho = snareEcho(parts.snare, rows); }
  const refs = [];
  if (melody) {
    const notes = mel(melody, { vol: melVol }), ch = line(notes, leadInst, { rows, vib: 'H22', vibDelay: 5, glide: 'G08' });
    parts.lead = ch; refs.push(notes);
    [parts.echo, parts.echo2] = pingpong(ch, notes, rows, { d1: 6, s1: 0.42, d2: 12, s2: 0.22, segs });
    refs.push(notesOf(parts.echo, rows), notesOf(parts.echo2, rows));
    if (doubled) { // glass bells an octave over the lead
      const up = mel(melody.replace(/>/g, ''), { vol: 24, semi: 12 });
      parts.bells = soften(line(up, I.bell, { rows, vib: null }), rows, refs.slice(1));
      refs.push(notesOf(parts.bells, rows));
    }
  }
  if (bell) {
    const notes = mel(bell, { vol: bellVol }), ch = soften(line(notes, bellInst, { rows, vib: null }), rows, refs);
    parts.bells = ch;
    [parts.bellEcho, parts.bellEcho2] = pingpong(ch, notes, rows, { d1: 6, s1: 0.42, d2: 12, s2: 0.22, segs });
    refs.push(notes, notesOf(parts.bellEcho, rows), notesOf(parts.bellEcho2, rows));
  }
  const arpNotes = ladder(tri, rows, shape, { lo: 'F#3', span: 9, vol: arpVol, soft: 5, len: step });
  parts.arp = soften(line(arpNotes, I.pluck, { rows, vib: null }), rows, refs);
  const arpRef = notesOf(parts.arp, rows);
  parts.canon = soften(delayLine(parts.arp, rows, segs, { delay: 6, scale: 0.4 }), rows, [...refs, arpRef]);
  parts.canon2 = soften(delayLine(parts.arp, rows, segs, { delay: 12, scale: 0.22 }), rows, [...refs, arpRef, notesOf(parts.canon, rows)]);
  parts.pad = padLane(segs, tri, rows, refs, { lo: 'E-4', vol: padVol, inst: padInst });
  parts.glass = echoChannel(parts.pad, { delay: 0, semi: 12, scale: glassVol / padVol, inst: I.glass, rows });
  return pattern(name, bars, cutLanes({ ...parts, ...extra }, KEYS), LAYOUT, PANS);
}

// ---------------------------------------------------------------- sections
const introArp = section('tmp', 4, CH.intro, { arpVol: 28 }).channels;
const intro = section('intro: under the ice', 4, CH.intro, { bassR: ['R---------------'], bassVol: 26, padVol: 16, glassVol: 8,
  seaHi: 14, extra: {
    arp: fadeIn(introArp[LAYOUT.indexOf('arp')], 16, 60), canon: fadeIn(introArp[LAYOUT.indexOf('canon')], 22, 60),
    canon2: fadeIn(introArp[LAYOUT.indexOf('canon2')], 28, 60),
    bells: hits(I.hollow, [4], { note: 'F#4', vol: 34 }), bellEcho: hits(I.hollow, [10], { note: 'F#4', vol: 12 }),
    hat: hits(I.bub, [13, 27, 30, 45], { note: 'D-6', vol: 16 }), fx: hits(I.swell, [57], { vol: 28 }),
  } });
const tail = section('tail: back under', 8, CH.tail, { arpVol: 30, padVol: 17, glassVol: 8, seaHi: 13, bell: TAIL_BELLS,
  bellVol: 30, groove: G.A, extra: { fx: hits(I.swell, [121], { vol: 28 }) } });

const patterns = [
  intro,
  section('A: C# A, the title leap', 8, CH.A, { melody: A_MEL, groove: G.A }),
  section('A2: sinking to the dominant', 8, CH.A2, { melody: A2_MEL, groove: G.half, bell: GLINTS, bellVol: 24 }),
  section('B: the vents', 8, CH.B, { melody: B_MEL, leadInst: I.soft, melVol: 42, groove: G.vent, last: G.out, shape: RISE,
    bassR: ['R-----r-R-------'], bassVol: 32, arpVol: 32, padInst: I.warm, padVol: 18, glassVol: 4, seaHi: 9 }),
  section('C: the Hollow Bell, far off', 8, CH.C, { shape: SLOW, step: 4, arpVol: 26, padVol: 19, glassVol: 10, seaHi: 14,
    bell: BELL_PHRASE, bellInst: I.hollow, bellVol: 40, bassR: ['R---------------'], bassVol: 26 }),
  section('A3: the ocarina', 8, CH.A, { melody: A_MEL, leadInst: I.soft, melVol: 42, doubled: true, groove: G.half, padVol: 16 }),
  jump(tail, 1),
];

// farstrand_undertow.gen.js and farstrand_bell.gen.js import the samples above, so only write the song when run directly.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) writeSongCompact(import.meta.url, {
  title: 'Farstrand - Verrin', bpm: 90, ticks: 6, mixvol: 48,
  message: 'FARSTRAND world theme "Verrin" (under the ice).\nF# minor, 90 BPM. Orders 1-6 loop.\nAll samples synthesized. Source: songs/farstrand_verrin.gen.js',
  samples: [
    kick({ f0: 110, f1: 40, sweep: 22, decay: 6, click: 0.04, drive: 1.3, sec: 0.55 }),
    cymbal('ice rim', { sec: 0.12, decay: 30, seed: 23, metalMix: 0.8 }),
    bubble(),
    wave('round bass', [1, 0.3, 0.1, 0.04]),
    sawPluck('muffled pluck', { open: 2600, closed: 300, close: 4, decay: 2.3, sec: 1.4 }),
    wave('glass lead', [1, 0.03, 0.45, 0.02, 0.22, 0.02, 0.1, 0, 0.05]),
    wave('soft lead', [1, 0, 0.16, 0, 0.05, 0, 0.02]),
    thinPad('cold pad', { amps: [1, 0, 0.3, 0, 0.12, 0, 0.05], spread: 2 }),
    thinPad('glass harmonica', { amps: [1, 0, 0.18, 0, 0.06], spread: 2 }),
    thinPad('warm pad', { amps: [1, 0.45, 0.3, 0.18, 0.1, 0.06], spread: 1 }),
    glassBell('glass bell', { sec: 2.0, partials: [[1, 1, 1.2], [2.76, 0.45, 3.2], [5.4, 0.2, 6.5], [8.93, 0.08, 10]] }),
    hollowBell(),
    seaLoop(), swell('swell', { sec: 1.3, seed: 37 }),
    cymbal('glass tick', { sec: 0.05, decay: 90, seed: 17, metalMix: 0.7 }),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
