#!/usr/bin/env node
/**
 * FARSTRAND — "Ninth Light" (the Ossuary of Stars under the young sun: stacked dead planets, the ark fleet of a
 * people the Umbrine ate ten thousand years ago, their glass thawing in the new light). 2026-09-26.
 * D minor (harmonic: the C# leading tone), 96 BPM, speed 6: 4 rows/beat, 16 rows/bar; one row = a 16th (156 ms),
 * one bar = 2.5 s. Rendered at 48 kHz, where 96 BPM is exact (1250 samples/tick).
 *
 * Identity: an ossuary under a new dawn, slower and warmer than Sunder, sadder than the Knot: a lament. The bass
 * falls D C# C B Bb A, and over the C# the harmony is F A C#, the Choir's augmented chord (`rim` hangs it over A
 * minor, unresolved). Here it is at home, D minor's own III+ and, spelled A C# F, its dominant: it resolves, to D
 * minor, and once to D major, the new sun. The family: the glass lead with 6/12-row ping-pong echoes, the pluck arp
 * with its 3-row canon, the glass harmonica over the pad, glass bells, the bII (Eb) with its #11 (A) held over it.
 * The cell is Halm's 'E F# G' fallen, 'F E D——', then it climbs the Choir's chord, 'C# F A——'. The thaw: the cold
 * pad in A, the warm one (even harmonics) from A2 on, meltwater drips on chord tones, more each section. The
 * belfry: the Sexton's great bell (church-bell partials, as synth_sexton.py's) tolls far off.
 *
 * Phrase map (the full notes: Farstrand's art/src/audio/music.json)
 *   Intro  Dm Dm Bbmaj7 Aaug            dawn: a far toll, the air, a low D, the pad fading in, drips, the choir's
 *                                       A C# F in bar 4, a reverse swell into A (not looped)
 *   A      Dm Faug Dm7 G | Bbmaj7 Eb Asus4-A Aaug   the ossuary: the lament bass, the cell and the Choir's chord
 *                                       climbed and fallen home; a soft kick, glass ticks, the cold pad
 *   A2     same                         the thaw: the warm pad, the answer climbing to A6 over Eb; half-time snare
 *   B      Bb Faug Dm Dm | Gm Eb Aaug D  the Choir: no lead, no drums; F A C# resolving to D minor, then to D major;
 *                                       the glass answers with the rim's figures a fourth up
 *   C      D D Bbmaj7 Bbmaj7 | Gm Gm Eb Aaug   the new sun on the old bones: the cell in major, then F natural
 *                                       again; bells over the lead; the far toll every two bars; the most drips
 * Loop body: orders 1-4 (32 bars, 80 s). Everything synthesized. Source of truth: this file; the shared helpers
 * come from farstrand_halm.gen.js.
 */
import { kick, snare, cymbal, noiseLoop, wave, glassBell, thinPad, swell, mel, line, chart, beat, rep, pattern, jump,
  writeSongCompact, ladder, pingpong, notesOf, hits, triads, cutLanes, at } from './heliobane_stage6.kit.js';
import { echoChannel, nn, ns } from './lib.js';
import { sawPluck, soften, delayLine, padLane, wind, fadeIn } from './farstrand_halm.gen.js';

const SR = 22050, TAU = 2 * Math.PI, MID_C = 261.6256;
const q3 = (x) => Math.round(x * 1000) / 1000;
const I = { kick: 0, snare: 1, hat: 2, bass: 3, pluck: 4, lead: 5, cold: 6, warm: 7, glass: 8, choir: 9, bell: 10,
  toll: 11, drip: 12, noise: 13, swell: 14 };
const LAYOUT = ['kick', 'snare', 'snEcho', 'hat', 'bass', 'arp', 'canon', 'lead', 'echo', 'echo2', 'pad', 'glass', 'choirLo',
  'choir', 'choirHi', 'bells', 'bellEcho', 'bellEcho2', 'drip', 'toll', 'wind', 'fx'];
const PANS = [0x80, 0x78, 0xb4, 0xa8, 0x80, 0x5c, 0xb0, 0x88, 0x44, 0xc0, 0x70, 0x94, 0x58, 0x80, 0xa8, 0x68, 0xb0, 0x40,
  0x98, 0x78, 0x80, 0x90];
const KEYS = ['lead', 'echo', 'echo2', 'arp', 'canon', 'pad', 'glass', 'choirLo', 'choir', 'choirHi', 'bells', 'bellEcho',
  'bellEcho2'];

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
/** Meltwater: a drop landing, a sine rising from middle C to about 1.7 times it in 25 ms and dying in 60 ms, with
 *  a hair of glass (the free-bar 2.76 partial) on the strike. C-5 plays middle C. */
function drip(name = 'thaw drip', { sec = 0.25 } = {}) {
  const n = Math.round(sec * SR), d = new Array(n); let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = MID_C * (1.7 - 0.7 * Math.exp(-t / 0.009));
    ph += TAU * f / SR;
    d[i] = (Math.sin(ph) + 0.25 * Math.sin(TAU * MID_C * 2.76 * t) * Math.exp(-t * 90)) * Math.exp(-t * 17) * Math.min(1, t * 1500);
  }
  for (let i = 0; i < 48; i++) d[n - 1 - i] *= i / 48;
  let m = 0; for (const x of d) m = Math.max(m, Math.abs(x));
  return { name, samplerate: SR, c5speed: SR, channels: [d.map((x) => q3((x / m) * 0.95))] };
}
/** A far choir: three voices of a harmonic series shaped by an "ah" vowel (as the rim's). */
const choirPad = () => thinPad('choir ah', { amps: [0.5, 0.55, 0.9, 1, 0.7, 0.55, 0.3, 0.15, 0.08, 0.06, 0.08, 0.12, 0.1, 0.05],
  spread: 2, voices: [-1, 0, 1] });
/** The Sexton's great bell, far off: church-bell partials (hum, prime, tierce, quint, nominal), glass on top. */
const tollBell = () => glassBell('far bell', { sec: 4.0, click: 0.08, partials: [[0.5, 0.35, 0.45], [1, 0.6, 0.8],
  [1.19, 0.5, 1.1], [1.5, 0.3, 1.5], [2, 1, 1.2], [2.66, 0.3, 2.4], [5.4, 0.3, 5], [8.93, 0.12, 8]] });

// ---------------------------------------------------------------- melodies
const CELL = 'r/4 f5/2 e5/2 d5/8~';                  // Halm's 'E F# G' fallen: b3 2 1
const CHOIR_UP = 'c#5/4 f5/4 a5/8~';                 // the Choir's chord climbed
const A_MEL = `${CELL} | ${CHOIR_UP} | a5/6 g5/2 f5/8 | d5/4 g5/4 b5/8~`
  + ` | ${CELL} | g5/4 bb5/4 a5/8~ | d6/8 c#6/8 | a5/4 f5/4 c#5/8`;
const A2_MEL = `${CELL} | ${CHOIR_UP} | c6/6 a5/2 f5/4 a5/4 | b5/4 d6/4 g6/8~`
  + ' | r/4 f6/2 e6/2 d6/8~ | g6/4 bb6/4 a6/8~ | d6/8 c#6/8 | f6/4 c#6/4 a5/8';
const C_MEL = 'r/4 f#5/2 e5/2 d5/8~ | a5/4 d6/4 f#6/8~ | r/4 f5/2 e5/2 d5/8~ | a5/12~ f5/4'
  + ' | r/4 d5/4 g5/4 bb5/4 | a5/8~ g5/8 | g5/4 bb5/4 a5/8~ | c#6/8 a5/4 f5/4';
const A2_BELLS = 'r/8 a6/8 | r/16 | r/8 f6/8 | r/16 | r/8 d7/8 | r/16 | r/8 e6/8 | r/16';
// the Choir's glass: the rim's answers ('E G#', 'E C') a fourth up, and the dawn
const B_BELLS = 'r/16 | r/4 a6/4 c#7/8 | r/16 | r/4 a6/4 f6/8 | r/16 | r/4 bb6/4 g6/8 | r/4 a6/4 c#7/8 | f#6/4 a6/4 d7/8';
// the Choir: [bar, bars, its cluster (low, middle, high)]
const B_CHOIR = [[0, 1, ['F-4', 'A#4', 'D-5']], [1, 1, ['F-4', 'A-4', 'C#5']], [2, 2, ['F-4', 'A-4', 'D-5']],
  [4, 1, ['G-4', 'A#4', 'D-5']], [5, 1, ['G-4', 'A#4', 'D#5']], [6, 1, ['F-4', 'A-4', 'C#5']], [7, 1, ['F#4', 'A-4', 'D-5']]];
const INTRO_CHOIR = [[3, 1, ['F-4', 'A-4', 'C#5']]];
const CH = {
  intro: 'Dm Dm Bbmaj7 Aaug', A: 'Dm Faug Dm7 G Bbmaj7 Eb Asus4/8 A/8 Aaug/16', B: 'Bb Faug Dm Dm Gm Eb Aaug D',
  C: 'D D Bbmaj7 Bbmaj7 Gm Gm Eb Aaug',
};
// the bass, a note a bar: the lament's fall in A, the chords' roots elsewhere
const LAMENT = ['D-3', 'C#3', 'C-3', 'B-2', 'A#2', 'A#2', 'A-2', 'C#3'];
const BASS_NOTES = { intro: ['D-3', 'D-3', 'A#2', 'C#3'], A: LAMENT, B: ['A#2', 'F-2', 'D-3', 'D-3', 'G-2', 'D#3', 'A-2', 'D-3'],
  C: ['D-3', 'D-3', 'A#2', 'A#2', 'G-2', 'G-2', 'D#3', 'A-2'] };
const EIGHTHS = [0, 2, 4, 6, 5, 3, 1, 3];  // 8ths through the chord tones (Halm's breathing shape)
const QUARTERS = [0, 4, 6, 4];              // quarters, the Choir

// ---------------------------------------------------------------- parts
const KIT = { kick: { X: [I.kick, 44], x: [I.kick, 28] }, snare: { X: [I.snare, 30], x: [I.snare, 20] },
  hat: { X: [I.hat, 26], x: [I.hat, 18], g: [I.hat, 12] } };
const EMPTY = '................';
const G = {
  A: { kick: 'X...............', snare: EMPTY, hat: '..g...g...g...g.' },
  A2: { kick: 'X.........x.....', snare: '........X.......', hat: '..g.x.g...g.x.g.' },
  out: { kick: 'X...............', snare: '........X...x...', hat: 'x.g.x.g.........' },
  C: { kick: 'X...............', snare: EMPTY, hat: '......g.......g.' },
};
const drums = (bars, g, last = null) => Object.fromEntries(Object.keys(KIT).map((k) => [k, beat(rep(bars, g[k], last?.[k]), KIT[k])]));
/** The snare's own echo: each hit again 6 and 12 rows later, softer (the Knot's wide delay). */
function snareEcho(sn, rows) {
  const ch = {};
  for (const [r, e] of Object.entries(sn)) if (e.note && e.note !== '^^') for (const [d, s] of [[6, 0.35], [12, 0.15]]) {
    if (+r + d < rows && !ch[+r + d]) ch[+r + d] = { ...e, vol: `v${Math.round(Number(e.vol.slice(1)) * s)}` };
  }
  return ch;
}
/** The bass, a note a bar from `notes`, per-bar rhythm: R accent, r soft, o the octave, - hold (decaying), . cut. */
function bassLine(notes, rhythm, rows, { vol = 30, soft = 0.7, decay = 0.95 } = {}) {
  const ch = {}; let level = 0, on = false;
  for (let r = 0; r < rows; r++) {
    const c = rhythm[r % 16], n = notes[Math.floor(r / 16) % notes.length];
    if ('Rro'.includes(c)) {
      level = c === 'R' ? vol : vol * soft; on = true;
      ch[r] = { note: c === 'o' ? ns(nn(n) + 12) : n, instrument: I.bass, vol: `v${Math.round(level)}` };
    } else if (c === '-' && on) { level *= decay; ch[r] = { vol: `v${Math.round(level)}` }; }
    else if (c === '.' && on) { ch[r] = { note: '^^' }; on = false; }
  }
  return ch;
}
/** One lane of the Choir: its note of each cluster, breathing in on the chord change and swelling through it, so
 *  clusters that follow each other sing on (a voice moving a semitone) rather than stopping. */
function choirLane(clusters, idx, rows, vol) {
  const ch = {};
  for (const [bar, bars, notes] of clusters) {
    const r0 = bar * 16, len = bars * 16;
    ch[r0] = { note: notes[idx], instrument: I.choir, vol: `v${Math.round(vol * 0.45)}` };
    for (let k = 2; k < len; k += 2) ch[r0 + k] = { vol: `v${Math.round(vol * (0.55 + 0.45 * Math.sin(Math.PI * k / len)))}` };
    if (r0 + len < rows && !clusters.some(([b]) => b * 16 === r0 + len)) ch[r0 + len] = { note: '^^' };
  }
  return ch;
}
/** Meltwater: `count` drips on chord tones (C-7 up), on rows a seeded generator picks (never twice on one row). */
function drips(segs, rows, count, seed, { vol = 36, lo = 'C-7' } = {}) {
  const r = rand(seed), ch = {};
  for (let i = 0, tries = 0; i < count && tries < 200; tries++) {
    const row = Math.floor((r() + 1) / 2 * rows);
    if (ch[row] || ch[row - 1] || ch[row + 1]) continue;
    const s = at(segs, row), tones = [];
    for (let p = nn(lo); tones.length < 5; p++) if (s.tones.has(p % 12)) tones.push(p);
    ch[row] = { note: ns(tones[Math.floor((r() + 1) / 2 * tones.length) % tones.length]), instrument: I.drip,
      vol: `v${Math.round(vol * (0.55 + 0.45 * (r() + 1) / 2))}` };
    i++;
  }
  return ch;
}

function section(name, bars, chordStr, { bassNotes, bassR = 'R-----------r---', bassVol = 30, melody = null, melVol = 36,
  doubled = false, groove = null, last = null, bells = null, bellVol = 32, choir = null, choirVol = 30, shape = EIGHTHS,
  step = 2, arpVol = 26, pad = I.warm, padVol = 15, glassVol = 6, windHi = 8, dripCount = 6, dripSeed = 1, tolls = [],
  extra = {} } = {}) {
  const rows = bars * 16, segs = chart(chordStr), tri = chart(triads(chordStr));
  const parts = { wind: wind(bars, { lo: 3, hi: windHi, inst: I.noise }), bass: bassLine(bassNotes, bassR, rows, { vol: bassVol }) };
  if (groove) { Object.assign(parts, drums(bars, groove, last)); parts.snEcho = snareEcho(parts.snare, rows); }
  const refs = [];
  if (choir) {
    Object.assign(parts, { choirLo: choirLane(choir, 0, rows, choirVol), choir: choirLane(choir, 1, rows, choirVol),
      choirHi: choirLane(choir, 2, rows, Math.round(choirVol * 0.8)) });
    for (const k of ['choirLo', 'choir', 'choirHi']) refs.push(notesOf(parts[k], rows));
  }
  if (melody) {
    const notes = mel(melody, { vol: melVol }), ch = line(notes, I.lead, { rows, vib: 'H23', vibDelay: 4 });
    parts.lead = ch; refs.push(notes);
    [parts.echo, parts.echo2] = pingpong(ch, notes, rows, { d1: 6, s1: 0.4, d2: 12, s2: 0.2, segs });
    refs.push(notesOf(parts.echo, rows), notesOf(parts.echo2, rows));
    if (doubled) { // glass bells an octave over the lead, far off
      parts.bells = soften(line(mel(melody, { vol: 20, semi: 12 }), I.bell, { rows, vib: null }), rows, refs.slice(1));
      refs.push(notesOf(parts.bells, rows));
    }
  }
  if (bells) {
    const notes = mel(bells, { vol: bellVol }), ch = soften(line(notes, I.bell, { rows, vib: null }), rows, refs);
    parts.bells = ch;
    [parts.bellEcho, parts.bellEcho2] = pingpong(ch, notes, rows, { d1: 6, s1: 0.45, d2: 12, s2: 0.25, segs });
    refs.push(notes, notesOf(parts.bellEcho, rows), notesOf(parts.bellEcho2, rows));
  }
  const arpNotes = ladder(segs, rows, shape, { lo: 'D-4', span: 8, vol: arpVol, soft: 6, len: step });
  parts.arp = soften(line(arpNotes, I.pluck, { rows, vib: null }), rows, refs);
  parts.canon = soften(delayLine(parts.arp, rows, segs, { delay: 3, scale: 0.4 }), rows, [...refs, notesOf(parts.arp, rows)]);
  parts.pad = padLane(segs, tri, rows, refs, { lo: 'D-4', vol: padVol, inst: pad });
  parts.glass = echoChannel(parts.pad, { delay: 0, semi: 12, scale: glassVol / padVol, inst: I.glass, rows });
  parts.drip = soften(drips(segs, rows, dripCount, dripSeed), rows, refs);
  if (tolls.length) { // each toll rings until the next; one that would ring into a chord it rubs against fades first
    parts.toll = Object.fromEntries(tolls.map(([r, n, v]) => [r, { note: n, instrument: I.toll, vol: `v${v}` }]));
    for (const [r, n] of tolls) for (let k = r + 1; k < rows && !parts.toll[k]; k++) {
      const s = at(segs, k);
      if (s.row !== k || s.tones.has(nn(n) % 12)) continue;
      [8, 4, 1].forEach((v, j) => { parts.toll[k - 3 + j] = { vol: `v${v}` }; });
      parts.toll[k] = { note: '^^' };
      break;
    }
  }
  return pattern(name, bars, cutLanes({ ...parts, ...extra }, KEYS), LAYOUT, PANS);
}

// ---------------------------------------------------------------- sections
const introParts = section('tmp', 4, CH.intro, { bassNotes: BASS_NOTES.intro }).channels;
const intro = section('intro: dawn', 4, CH.intro, { bassNotes: BASS_NOTES.intro, bassR: 'R---------------', choir: INTRO_CHOIR,
  choirVol: 22, padVol: 14, glassVol: 7, windHi: 10, dripCount: 4, dripSeed: 11, tolls: [[0, 'D-4', 44]], extra: {
    bass: fadeIn(introParts[LAYOUT.indexOf('bass')], 16, 48), pad: fadeIn(introParts[LAYOUT.indexOf('pad')], 0, 32),
    glass: fadeIn(introParts[LAYOUT.indexOf('glass')], 8, 40), arp: fadeIn(introParts[LAYOUT.indexOf('arp')], 32, 62),
    canon: fadeIn(introParts[LAYOUT.indexOf('canon')], 35, 62), fx: hits(I.swell, [57], { vol: 26 }),
  } });
const dawn = section('C: the new sun', 8, CH.C, { bassNotes: BASS_NOTES.C, bassR: 'R-------r-------', melody: C_MEL, melVol: 32,
  doubled: true, groove: G.C, padVol: 20, glassVol: 8, windHi: 7, dripCount: 16, dripSeed: 41,
  tolls: [[0, 'D-4', 44], [32, 'D-4', 38], [64, 'D-4', 38], [104, 'A-3', 42]], extra: { fx: hits(I.swell, [121], { vol: 28 }) } });

const patterns = [
  intro,
  section('A: the ossuary', 8, CH.A, { bassNotes: BASS_NOTES.A, melody: A_MEL, groove: G.A, pad: I.cold, dripCount: 6, dripSeed: 21 }),
  section('A2: the thaw', 8, CH.A, { bassNotes: BASS_NOTES.A, bassR: 'R-------r-------', melody: A2_MEL, groove: G.A2, last: G.out,
    bells: A2_BELLS, bellVol: 26, padVol: 20, dripCount: 10, dripSeed: 31 }),
  section('B: the Choir', 8, CH.B, { bassNotes: BASS_NOTES.B, bassR: 'R---------------', bassVol: 24, choir: B_CHOIR, choirVol: 50,
    bells: B_BELLS, bellVol: 44, shape: QUARTERS, step: 4, arpVol: 24, padVol: 12, glassVol: 7, windHi: 9, dripCount: 8,
    dripSeed: 51 }),
  jump(dawn, 1),
];

writeSongCompact(import.meta.url, {
  title: 'Farstrand - Ninth Light', bpm: 96, ticks: 6, mixvol: 48,
  message: 'FARSTRAND world theme "Ninth Light": an ossuary under a new dawn.\nD minor, 96 BPM. Orders 1-4 loop.\nThe Choir\'s chord (F A C#) at home: the lament\'s own.\nAll samples synthesized. Source: songs/farstrand_ninth_light.gen.js',
  samples: [
    kick({ f0: 120, f1: 42, sweep: 24, decay: 7, click: 0.05, drive: 1.3, sec: 0.5 }),
    snare({ tone: 180, decay: 12, sec: 0.34, seed: 13, drive: 1.2 }),
    cymbal('glass tick', { sec: 0.05, decay: 90, seed: 17, metalMix: 0.7 }),
    wave('warm bass', [1, 0.45, 0.25, 0.13, 0.07, 0.03]),
    sawPluck('thaw pluck', { open: 3000, closed: 360, close: 5, decay: 2.8, sec: 1.2 }),
    wave('glass lead', [1, 0.03, 0.45, 0.02, 0.22, 0.02, 0.1, 0, 0.05]),
    thinPad('cold pad', { amps: [1, 0, 0.3, 0, 0.12, 0, 0.05], spread: 1 }),
    thinPad('warm pad', { amps: [1, 0.5, 0.32, 0.2, 0.12, 0.07], spread: 1 }),
    thinPad('glass harmonica', { amps: [1, 0, 0.18, 0, 0.06], spread: 2 }),
    choirPad(),
    glassBell('glass bell', { sec: 2.2, partials: [[1, 1, 1.1], [2.76, 0.45, 3], [5.4, 0.2, 6], [8.93, 0.08, 10]] }),
    tollBell(), drip(), noiseLoop(), swell('swell', { sec: 1.2, seed: 31 }),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
