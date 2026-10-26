#!/usr/bin/env node
/**
 * FARSTRAND — "Carcanet" (a moon of a ringed gas giant: a machine people's foundries, worn by the hive as a shell,
 * plating over sunfed hearts; the line still runs by itself). 2026-09-26.
 * C minor, 105 BPM, speed 6: 4 rows/beat, 16 rows/bar; one row = a 16th (143 ms), one bar = 2.29 s.
 * Rendered at 44.1 kHz, where 105 BPM is exact (1050 samples/tick).
 *
 * Identity: machine rhythm, a foundry nobody works that still runs. The machine is the foreground: a drop hammer
 * striking the Heralds' 3+3+2 (rows 0, 6, 12), an anvil ringing the backbeat, relays clicking every 8th with the
 * hammer's accents, a hiss of steam as the press lifts, a chain rattling every other bar, and a steady pulse: the
 * bass on every 8th like a piston. Under it the furnace roars (a dark looped noise) where Halm has wind. The family
 * stays: the dark filtered-saw pluck, here a sequencer ostinato (the lowest chord tone taking turns with three
 * others, a machine's pattern) with Farstrand's dotted-8th (3-row) canon panned opposite; the cold pad; the hollow
 * glass lead far off with echoes 6 and 12 rows late (a foundry hall); glass bells; Db major, the bII (Halm's wrong
 * light). The lead counts up the chord in the 3+3+2, 'C Eb G', then the wrong tooth: F# slipping up into G.
 * B is the hearts under the plating: the machine thins to a lub-dub hammer, a warm pad (even harmonics) replaces
 * the cold one, the chords turn major. C is the count: the line stops, relays tick on, and glass bells ring the
 * Tally's number (four tones on G, one on C: forty-one, its voice line v_tally_7) far off; the hammer comes back
 * in the last bar and the line starts again.
 *
 * Phrase map
 *   Intro  Cm Cm Cm Gsus4-G              the line starting: the furnace and a low C, relays from bar 2, the hammer
 *                                        and the pulse from bar 3, the whole machine in bar 4 (not looped)
 *   A      Cm Cm Abmaj7 Ab | Fm Db Gsus4 G   the lead 'C Eb G | F#>G——', 'Ab G Eb | C———', 'C F Ab | Ab——F',
 *                                        'G F C | B D' (the leading tone, open); the whole machine
 *   A2     same                          the same question; the answer climbs to C6 over Db (its major 7th),
 *                                        'C G F' over Gsus4, and holds G; glass-bell sparks on bars 1, 3, 5, 7
 *   B      Ab Eb Bb Fm | Ab Eb Db G     the hearts: warm pad, lub-dub hammer, relays in quarters, the bass in
 *                                        halves; long lead notes rising to D6 and back to G
 *   C      Cm Cm Fm Fm | Ab Ab Gsus4 G   the count: no hammer, no lead, relays in 8ths, the arp in 8ths; the
 *                                        Tally's forty-one on glass bells (G G G G | C———) twice with 6/12-row
 *                                        echoes; the machine restarts in bar 8 (loop to A)
 * Loop body: orders 1-4 (32 bars, 73.1 s). Everything synthesized. Source of truth: this file; the shared helpers
 * come from farstrand_halm.gen.js.
 */
import { kick, cymbal, steam, clank, wave, glassBell, thinPad, swell, mel, line, chart, bass, beat, pattern, jump,
  writeSongCompact, ladder, pingpong, notesOf, hits, triads, cutLanes } from './heliobane_stage6.kit.js';
import { sawPluck, soften, delayLine, padLane, wind, fadeIn } from './farstrand_halm.gen.js';

const SR = 22050;
const q3 = (x) => Math.round(x * 1000) / 1000;
const I = { hammer: 0, anvil: 1, relay: 2, steam: 3, chain: 4, bass: 5, pluck: 6, lead: 7, pad: 8, warm: 9, bell: 10,
  furnace: 11, swell: 12 };
const LAYOUT = ['hammer', 'anvil', 'relay', 'steam', 'chain', 'bass', 'arp', 'canon', 'lead', 'echo', 'echo2', 'pad', 'bells',
  'bellEcho', 'bellEcho2', 'furnace', 'fx'];
const PANS = [0x80, 0x9c, 0xa8, 0x68, 0x5c, 0x80, 0x54, 0xae, 0x86, 0x48, 0xbc, 0x70, 0x98, 0x60, 0xb0, 0x80, 0x90];
const KEYS = ['lead', 'echo', 'echo2', 'arp', 'canon', 'pad', 'bells', 'bellEcho', 'bellEcho2'];

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
/** The furnace: white noise through a two-pole low-pass near 600 Hz (a roar, darker than Halm's wind) with a
 *  crackle of sparks, a seamless loop (its last 2048 samples cross-faded into its start). */
function furnaceLoop(name = 'furnace roar', { sec = 1.7, seed = 97, lp = 0.16 } = {}) {
  const r = rand(seed), n = Math.round(sec * SR), m = 2048, d = new Array(n + m);
  let a = 0, b = 0, pop = 0;
  for (let i = 0; i < n + m; i++) {
    const w = r();
    a += lp * (w - a); b += lp * (a - b);
    if (r() > 0.9992) pop = r() * 1.5;
    pop *= 0.9;
    d[i] = b + pop * r() * 0.3;
  }
  for (let i = 0; i < m; i++) d[i] = d[i] * (i / m) + d[n + i] * (1 - i / m);
  let mx = 0; for (let i = 0; i < n; i++) mx = Math.max(mx, Math.abs(d[i]));
  return { name, samplerate: SR, channels: [d.slice(0, n).map((x) => q3((x / mx) * 0.85))], loop: { start: 0, end: n }, role: 'percussion' };
}

// ---------------------------------------------------------------- melodies
const Q = 'c5/6 eb5/6 g5/4 | f#5/4 g5/12> | ab5/6 g5/6 eb5/4 | c5/16~';
const A_MEL = `${Q} | c5/6 f5/6 ab5/4 | ab5/12 f5/4 | g5/6 f5/6 c5/4 | b4/8 d5/8`;
const A2_MEL = `${Q} | c5/6 f5/6 ab5/4 | c6/12~ bb5/4 | c6/6 g5/6 f5/4 | g5/16~`;
const B_MEL = 'eb5/16~ | g5/8 bb5/8 | d6/16~ | c6/8 ab5/8 | c6/16~ | bb5/8 g5/8 | ab5/8 f5/8 | g5/16~';
const A2_BELLS = 'g6/16 | r/16 | eb6/16 | r/16 | c6/16 | r/16 | g6/16 | r/16';
const COUNT = 'g5/4 g5/4 g5/4 g5/4 | c6/16 | r/16 | r/16';
const C_BELLS = `${COUNT} | ${COUNT}`;
const CH = {
  intro: 'Cm Cm Cm Gsus4/8 G/8', A: 'Cm Cm Abmaj7 Ab Fm Db Gsus4 G', B: 'Ab Eb Bb Fm Ab Eb Db G',
  C: 'Cm Cm Fm Fm Ab Ab Gsus4 G',
};
const SEQ = [0, 3, 1, 3, 2, 3, 1, 3]; // the sequencer: the lowest tone taking turns with the others, a half bar
const SEQ_SLOW = [0, 2, 1, 3];         // 8ths, the count

// ---------------------------------------------------------------- the machine
const M = {
  hammer: { X: [I.hammer, 50], x: [I.hammer, 36] }, anvil: { X: [I.anvil, 42], x: [I.anvil, 28] },
  relay: { X: [I.relay, 50], x: [I.relay, 34] }, steam: { S: [I.steam, 30], s: [I.steam, 20] },
  chain: { C: [I.chain, 34, 'Q03'], c: [I.chain, 24, 'Q03'] },
};
const EMPTY = '................';
const G = {
  run: { hammer: 'X.....x.....x...', anvil: '....X.......X...', relay: 'X.x.x.X.x.x.X.x.', steam: '..........s.....', chain: EMPTY },
  runChain: { hammer: 'X.....x.....x...', anvil: '....X.......X...', relay: 'X.x.x.X.x.x.X.x.', steam: '..........s.....', chain: '..............Cc' },
  heart: { hammer: 'X..x............', anvil: EMPTY, relay: 'x...x...x...x...', steam: '......s.........', chain: EMPTY },
  count: { hammer: EMPTY, anvil: EMPTY, relay: 'X.x.x.x.X.x.x.x.', steam: EMPTY, chain: EMPTY },
  restart: { hammer: 'X.....x.....x.x.', anvil: '....X.......X...', relay: 'X.x.x.X.x.x.X.xx', steam: '..S.............', chain: '..........C.....' },
  off: { hammer: EMPTY, anvil: EMPTY, relay: EMPTY, steam: EMPTY, chain: EMPTY },
  relays: { hammer: EMPTY, anvil: EMPTY, relay: 'x...x...x...x...', steam: EMPTY, chain: '..............c.' },
  start: { hammer: 'X.......X.......', anvil: EMPTY, relay: 'x.x.x.x.x.x.x.x.', steam: '..........s.....', chain: EMPTY },
};
/** The machine's lanes from one groove per bar. */
function machine(grooves) {
  return Object.fromEntries(Object.keys(M).map((k) => [k, beat(grooves.map((g) => g[k]), M[k])]));
}
const each = (bars, list) => Array.from({ length: bars }, (_, b) => list[b % list.length]);
const BASS = { pulse: ['R.r.r.R.r.r.R.o.'], halves: ['R-------r-------'], drone: ['R---------------'] };

function section(name, bars, chordStr, { grooves, melody = null, bells = null, bellVol = 30, bassR = BASS.pulse, bassVol = 30,
  seq = SEQ, step = 1, arpVol = 26, padVol = 14, padInst = I.pad, furnLo = 4, furnHi = 10, extra = {} } = {}) {
  const rows = bars * 16, segs = chart(chordStr), tri = chart(triads(chordStr));
  const parts = { ...machine(grooves), furnace: wind(bars, { lo: furnLo, hi: furnHi, inst: I.furnace }),
    bass: bass(tri, bassR, I.bass, { rows, lo: 'C-3', vol: bassVol, soft: 0.7, decay: 0.95 }) };
  const refs = [];
  if (melody) {
    const notes = mel(melody, { vol: 32 }), ch = line(notes, I.lead, { rows, vib: 'H23', vibDelay: 4 });
    parts.lead = ch; refs.push(notes);
    [parts.echo, parts.echo2] = pingpong(ch, notes, rows, { d1: 6, s1: 0.42, d2: 12, s2: 0.22, segs });
    refs.push(notesOf(parts.echo, rows), notesOf(parts.echo2, rows));
  }
  if (bells) {
    const notes = mel(bells, { vol: bellVol }), ch = soften(line(notes, I.bell, { rows, vib: null }), rows, refs);
    parts.bells = ch;
    [parts.bellEcho, parts.bellEcho2] = pingpong(ch, notes, rows, { d1: 6, s1: 0.42, d2: 12, s2: 0.22, segs });
    refs.push(notes, notesOf(parts.bellEcho, rows), notesOf(parts.bellEcho2, rows));
  }
  const arpNotes = ladder(segs, rows, seq, { lo: 'C-4', span: 8, vol: arpVol, soft: 8, len: step });
  parts.arp = soften(line(arpNotes, I.pluck, { rows, vib: null }), rows, refs);
  parts.canon = soften(delayLine(parts.arp, rows, segs, { delay: 3, scale: 0.45 }), rows, [...refs, notesOf(parts.arp, rows)]);
  parts.pad = padLane(segs, tri, rows, refs, { lo: 'E-4', vol: padVol, inst: padInst });
  return pattern(name, bars, cutLanes({ ...parts, ...extra }, KEYS), LAYOUT, PANS);
}

// ---------------------------------------------------------------- sections
const introParts = section('tmp', 4, CH.intro, { grooves: each(4, [G.run]) }).channels;
const intro = section('intro: the line starting', 4, CH.intro, { grooves: [G.off, G.relays, G.start, G.runChain], bassR: BASS.drone,
  furnLo: 3, furnHi: 12, extra: {
    bass: { ...fadeIn(introParts[LAYOUT.indexOf('bass')], 32, 48), 0: { note: 'C-3', instrument: I.bass, vol: 'v18' }, 16: { vol: 'v14' } },
    arp: fadeIn(introParts[LAYOUT.indexOf('arp')], 32, 60), canon: fadeIn(introParts[LAYOUT.indexOf('canon')], 35, 60),
    pad: fadeIn(introParts[LAYOUT.indexOf('pad')], 8, 40), fx: hits(I.swell, [57], { vol: 26 }),
  } });
const count = section('C: the count', 8, CH.C, { grooves: [...each(7, [G.count]), G.restart], bells: C_BELLS, bellVol: 34,
  bassR: BASS.drone, bassVol: 22, seq: SEQ_SLOW, step: 2, arpVol: 20, padVol: 16, furnLo: 5, furnHi: 14,
  extra: { fx: hits(I.swell, [121], { vol: 26 }) } });

const patterns = [
  intro,
  section('A: the shift', 8, CH.A, { grooves: each(8, [G.run, G.runChain]), melody: A_MEL }),
  section('A2: sparks', 8, CH.A, { grooves: each(8, [G.run, G.runChain]), melody: A2_MEL, bells: A2_BELLS }),
  section('B: the hearts', 8, CH.B, { grooves: each(8, [G.heart]), melody: B_MEL, bassR: BASS.halves, bassVol: 26, arpVol: 22,
    padVol: 18, padInst: I.warm, furnHi: 13 }),
  jump(count, 1),
];

writeSongCompact(import.meta.url, {
  title: 'Farstrand - Carcanet', bpm: 105, ticks: 6, mixvol: 48,
  message: 'FARSTRAND world theme "Carcanet": the foundry runs by itself.\nC minor, 105 BPM. Orders 1-4 loop.\nAll samples synthesized. Source: songs/farstrand_carcanet.gen.js',
  samples: [
    kick({ f0: 130, f1: 42, sweep: 22, decay: 9, click: 0.2, drive: 1.8, sec: 0.5 }),
    { ...clank('anvil', { base: 210, drive: 1.6, seed: 53, bright: 1.3 }), role: 'percussion' },
    cymbal('relay tick', { sec: 0.06, decay: 80, seed: 23, metalMix: 0.9 }),
    steam('steam', { sec: 0.5, seed: 83 }),
    { ...clank('chain', { base: 880, drive: 1.3, seed: 61, bright: 1.2, sec: 0.12 }), role: 'percussion' },
    wave('piston bass', [1, 0.5, 0.33, 0.2, 0.12, 0.07, 0.04]),
    sawPluck('dark pluck', { open: 2600, closed: 300, close: 7, decay: 4, sec: 0.8 }),
    wave('glass lead', [1, 0.03, 0.45, 0.02, 0.22, 0.02, 0.1, 0, 0.05]),
    thinPad('cold pad', { amps: [1, 0, 0.3, 0, 0.12, 0, 0.05], spread: 1 }),
    thinPad('warm pad', { amps: [1, 0.55, 0.35, 0.22, 0.14, 0.08], spread: 1 }),
    glassBell('glass bell', { sec: 2.0, partials: [[1, 1, 1.2], [2.76, 0.45, 3.2], [5.4, 0.2, 6.5], [8.93, 0.08, 10]] }),
    furnaceLoop(), swell('swell', { sec: 1.2, seed: 31 }),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
