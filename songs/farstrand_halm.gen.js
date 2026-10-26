#!/usr/bin/env node
/**
 * FARSTRAND — "Halm" (the glass forest under a red dwarf). 2026-09-25.
 * E minor, 100 BPM, speed 6: 4 rows/beat, 16 rows/bar; one row = a 16th (150 ms), one bar = 2.4 s.
 * Rendered at 48 kHz, where 100 BPM is exact (1200 samples/tick).
 *
 * Identity: cold, lonely and still, not a chip banger (Axiom Verge is the reference for feel).
 * A filtered-saw pluck arpeggio rolls through add9/maj7 chords in 16ths, with a dotted-8th
 * (3-row) canon panned opposite: that is the pad. Over it a hollow glass lead plays an uneasy
 * cell, "E F# G——", bends up to the 9th, leans on the b6 (C over E minor) and the #11 (B over
 * F), and every phrase gets a 3- and 6-row ping-pong echo. The bII chord (F major in E minor)
 * is the world's wrong-coloured light. Drums stay sparse: a soft kick on 1, glass ticks and a
 * half-time snare with its own echo.
 *
 * Phrase map
 *   Intro    Emadd9 Emadd9 Cmaj7 Cmaj7   wind, low E, the arp fading in, one bell, reverse swell (not looped)
 *   A        Emadd9 Cmaj7 Emadd9 F | Emadd9 Cmaj7 Am7 B7   "E F# G——" / "D——B G——"; C and B lean;
 *                                        the answer peaks on G6 and opens on B7 (D# C B)
 *   A2       same question, darker answer sinking to A over B7; half-time snare + echo, bell pickups
 *   B        Cmaj7 D Bm7 Em Cmaj7 D F B7  the swell: long notes up to A6, fuller kick and hats, louder pad
 *   Breathe  Emadd9 Emadd9 Cmaj7 Cmaj7 Am7 Am7 F B7   no drums, no lead: the arp in 8ths, the cell an
 *                                        octave up on a glass bell with a 6-row echo, swell back into A
 * Loop body: orders 1-4 (32 bars, 76.8 s). Everything synthesized. Source of truth: this file.
 * The helpers marked `export` are shared with farstrand_title.gen.js (only these two files are Farstrand's).
 */
import { kick, snare, cymbal, noiseLoop, wave, glassBell, thinPad, swell,
  mel, line, chart, at, bass, beat, rep, pattern, jump, writeSongCompact,
  ladder, pingpong, notesOf, hits, triads, cutLanes } from './heliobane_stage6.kit.js';
import { nn, ns } from './lib.js';
import { pathToFileURL } from 'url';

const TAU = 2 * Math.PI, MID_C = 261.6256;
const I = { kick: 0, snare: 1, hat: 2, bass: 3, pluck: 4, lead: 5, pad: 6, bell: 7, noise: 8, swell: 9 };
const LAYOUT = ['kick', 'snare', 'snEcho', 'hat', 'bass', 'arp', 'canon', 'lead', 'echo', 'echo2', 'pad', 'bells', 'bellEcho', 'wind', 'fx'];
const PANS = [0x80, 0x78, 0xb0, 0xa8, 0x80, 0x50, 0xb0, 0x88, 0x50, 0xb4, 0x70, 0x64, 0xa0, 0x80, 0x90];
const KEYS = ['lead', 'echo', 'echo2', 'arp', 'canon', 'pad', 'bells', 'bellEcho'];

// ---------------------------------------------------------------- samples
/** Filtered-saw pluck: two saws 7 cents apart through a 2-pole low-pass that closes. C-5 = middle C. */
export function sawPluck(name, { sec = 1.1, open = 4200, closed = 380, close = 6, decay = 3.2, sr = 22050 } = {}) {
  const n = Math.round(sec * sr), d = new Array(n); let a = 0, b = 0;
  for (let i = 0; i < n; i++) {
    const t = i / sr; let s = 0;
    for (const f of [MID_C * 0.998, MID_C * 1.002]) for (let k = 1; k * f < sr / 2; k++) s += Math.sin(TAU * k * f * t) / k;
    const g = 1 - Math.exp(-TAU * (closed + (open - closed) * Math.exp(-close * t)) / sr);
    a += g * (s - a); b += g * (a - b);
    d[i] = b * Math.exp(-decay * t) * Math.min(1, t * 1500);
  }
  for (let i = 0; i < 64; i++) d[n - 1 - i] *= i / 64;
  let m = 0; for (const x of d) m = Math.max(m, Math.abs(x));
  return { name, samplerate: sr, c5speed: sr, channels: [d.map((x) => Math.round((x / m) * 970) / 1000)] };
}

// ---------------------------------------------------------------- melodies
const CELL = 'r/4 e5/2 f#5 g5/8~';
const A_MEL = `${CELL} | d6/6> b5/2 g5/8 | r/4 e5/2 f#5 g5/4 c6 | b5/10~ a5/2 f5/4`
  + ` | ${CELL} | d6/6> e6/2 g6/8~ | e6/6 d6/2 c6/4 a5 | d#6/6 e6/2 c6/4 b5`;
const A2_MEL = `${CELL} | d6/6> b5/2 g5/8 | r/4 e5/2 f#5 g5/4 c6 | b5/10~ a5/2 f5/4`
  + ' | r/4 e5/2 f#5 g5/4 b5 | c6/8~ b5/4 g5 | a5/6 g5/2 e5/8 | d#5/4 f#5 a5/8~';
const B_MEL = 'g5/4 b5 e6/8~ | f#6/8~ e6/4 d6 | d6/6 a5/2 b5/8~ | g5/4 b5 e6 f#6'
  + ' | g6/12~ f#6/2 e6 | a6/8~ f#6/4 d6 | c6/6 b5/2 a5/8~ | b5/8~ a5/4 f#5';
const BELL_A2 = 'b6/16 | r/16 | g6/16 | r/16 | e6/16 | r/16 | c7/16 | r/16'; // one ringing glint every other bar
const BELL_BREATHE = 'r/4 e6/2 f#6 g6/8 | r/16 | d6/8 b5 | r/16 | c6/8 a5 | r/16 | b5/16 | r/16';
const CH = {
  intro: 'Emadd9 Emadd9 Cmaj7 Cmaj7', A: 'Emadd9 Cmaj7 Emadd9 F Emadd9 Cmaj7 Am7 B7',
  B: 'Cmaj7 D Bm7 Em Cmaj7 D F B7', breathe: 'Emadd9 Emadd9 Cmaj7 Cmaj7 Am7 Am7 F B7',
};
const ROLL = [0, 2, 3, 5, 4, 2, 3, 1, 0, 2, 3, 5, 6, 5, 3, 2]; // 16ths through 8 chord-tone rungs
const SLOW = [0, 2, 4, 6, 5, 3, 1, 3];                           // 8ths, the breathing section

// ---------------------------------------------------------------- parts
const BASS = { A: ['R-----------r---'], B: ['R-----r---R---o-'], long: ['R---------------'] };
const KM = { X: [I.kick, 54], x: [I.kick, 36] };
const SM = { X: [I.snare, 46], x: [I.snare, 30] };
const HM = { X: [I.hat, 40], x: [I.hat, 30], g: [I.hat, 20] };
const G = {
  A: { kick: 'X.........x.....', snare: '................', hat: '..g...g...g...g.' },
  A2: { kick: 'X.........x.....', snare: '........X.......', hat: '..g.x.g...g.x.g.' },
  B: { kick: 'X.....x...X.....', snare: '........X.......', hat: 'x.g.x.g.x.g.x.gx' },
  out: { kick: 'X...............', snare: '........X.....x.', hat: 'x.g.x.g.........' },
};
function drums(bars, g, last = null) {
  const lane = (k, m) => beat(rep(bars, g[k], last?.[k]), m);
  return { kick: lane('kick', KM), snare: lane('snare', SM), hat: lane('hat', HM) };
}
/** The snare's own delay: each hit again 3 and 6 rows later, softer. */
function snareEcho(sn, rows) {
  const ch = {};
  for (const [r, e] of Object.entries(sn)) {
    if (!e.note || e.note === '^^') continue;
    for (const [d, s] of [[3, 0.4], [6, 0.18]]) {
      if (+r + d < rows && !ch[+r + d]) ch[+r + d] = { ...e, vol: `v${Math.round(Number(e.vol.slice(1)) * s)}` };
    }
  }
  return ch;
}
/** Wind: the looped noise (a soft hiss of air), swelling once across the section. */
export function wind(bars, { lo = 3, hi = 9, note = 'C-5', inst = I.noise } = {}) {
  const rows = bars * 16, ch = { 0: { note, instrument: inst, vol: `v${lo}` } };
  for (let r = 4; r < rows; r += 4) ch[r] = { vol: `v${Math.round(lo + (hi - lo) * Math.sin(Math.PI * r / rows))}` };
  return ch;
}
/** Fade a lane in: drop events before `from`, scale volumes from a quarter up to full at `to`. */
export function fadeIn(ch, from, to) {
  const out = { 0: { note: '^^' } };
  for (const [r, e] of Object.entries(ch)) {
    if (+r < from) continue;
    const k = Math.min(1, 0.25 + 0.75 * (+r - from) / (to - from));
    out[r] = e.vol?.startsWith('v') ? { ...e, vol: `v${Math.round(Number(e.vol.slice(1)) * k)}` } : e;
  }
  return out;
}
const rub = (a, b) => [1, 11].includes((((nn(a) - nn(b)) % 12) + 12) % 12);
/** Cut a note of `ch` where it sits a semitone (or major 7th) from a sounding `refs` note, at either onset. */
export function soften(ch, rows, refs) {
  const out = { ...ch }; let cur = null;
  for (let r = 0; r < rows; r++) {
    const e = out[r];
    if (e?.note === '^^') cur = null; else if (e?.note) cur = e.note;
    if (!cur) continue;
    const hit = refs.some((ref) => {
      const h = ref.find(([s, , l]) => r >= s && r < s + l);
      return h && rub(cur, h[1]) && (e?.note || h[0] === r);
    });
    if (hit) { out[r] = { note: '^^' }; cur = null; }
  }
  return out;
}
/** A plain delay line: the lane again `delay` rows later and softer; only a note that lands under a chord it
 *  does not belong to is cut (echo against its own source is the point). */
export function delayLine(ch, rows, segs, { delay = 3, scale = 0.45 } = {}) {
  const out = {};
  for (const [r, e] of Object.entries(ch)) {
    if (+r + delay >= rows) continue;
    out[+r + delay] = e.vol?.startsWith('v') ? { ...e, vol: `v${Math.round(Number(e.vol.slice(1)) * scale)}` } : { ...e };
  }
  let cur = null;
  for (let t = 0; t < rows; t++) {
    const e = out[t], seg = at(segs, t);
    if (e?.note === '^^') cur = null; else if (e?.note) cur = e.note;
    if (cur && (seg.row === t || e?.note) && !seg.tones.has(nn(cur) % 12)) { out[t] = { note: '^^' }; cur = null; }
  }
  return out;
}
/**
 * The pad: one held triad tone per chord, swelling in. Of the triad tones it takes the one that rubs least,
 * a semitone against the lead, the bells or the chord's own colour tone (add9, maj7, 7th) costing ten times
 * a whole tone, then the one nearest the last pad note.
 */
export function padLane(segs, tri, rows, refs, { lo = 'E-5', vol = 12, inst = I.pad } = {}) {
  const notes = []; let prev = nn(lo) + 6;
  const cost = (a, b) => ({ 1: 10, 11: 10, 2: 1, 10: 1 })[(((a - b) % 12) + 12) % 12] ?? 0;
  segs.forEach((s, i) => {
    if (s.row >= rows) return;
    const end = Math.min(s.row + s.len, rows), t = tri[i];
    const over = refs.flatMap((ref) => ref.filter(([r0, , l]) => r0 < end && r0 + l > s.row).map(([, n]) => nn(n)));
    over.push(...[...s.tones].filter((pc) => !t.tones.has(pc)));
    const score = (c) => over.reduce((sum, m) => sum + cost(c, m), 0) * 100 + Math.abs(c - prev);
    const n = [...t.tones].map((pc) => nn(lo) + ((pc - nn(lo)) % 12 + 12) % 12).sort((a, b) => score(a) - score(b))[0];
    prev = n; notes.push([s.row, ns(n), end - s.row, vol, '']);
  });
  const ch = line(notes, inst, { rows, sustain: 0.7, release: 0.55, vib: null });
  for (const [row, , len] of notes) for (const k of [2, 4]) if (k < len - 1) ch[row + k] = { vol: `v${Math.round(vol * (k === 2 ? 0.85 : 1))}` };
  return ch;
}
/** A glass-bell line and its 6-row echo, both kept a semitone clear of the lead. */
function bellParts(str, segs, rows, refs = [], vol = 30) {
  const ch = soften(line(mel(str, { vol }), I.bell, { rows, vib: null }), rows, refs);
  return { bells: ch, bellEcho: soften(delayLine(ch, rows, segs, { delay: 6, scale: 0.4 }), rows, [...refs, notesOf(ch, rows)]) };
}

function section(name, bars, chordStr, { melody, groove = null, last = null, bassR = BASS.A, bassVol = 32, shape = ROLL,
  step = 1, arpVol = 32, padVol = 16, windHi = 9, bell = null, bellVol = 34, extra = {} } = {}) {
  const rows = bars * 16, segs = chart(chordStr), tri = chart(triads(chordStr));
  const parts = { wind: wind(bars, { hi: windHi }), bass: bass(tri, bassR, I.bass, { rows, lo: 'C-3', vol: bassVol, decay: 0.95 }) };
  if (groove) { Object.assign(parts, drums(bars, groove, last)); parts.snEcho = snareEcho(parts.snare, rows); }
  const refs = [];
  if (melody) {
    const notes = mel(melody, { vol: 40 }), ch = line(notes, I.lead, { rows, vib: 'H33', vibDelay: 3 });
    parts.lead = ch; refs.push(notes);
    [parts.echo, parts.echo2] = pingpong(ch, notes, rows, { d1: 3, s1: 0.45, d2: 6, s2: 0.25, segs });
    refs.push(notesOf(parts.echo, rows), notesOf(parts.echo2, rows));
  }
  if (bell) {
    Object.assign(parts, bellParts(bell, segs, rows, refs, bellVol));
    refs.push(notesOf(parts.bells, rows), notesOf(parts.bellEcho, rows));
  }
  // The arp (a pluck with its dotted-8th delay) only yields where it would rub a semitone against the lead or
  // bells; the pad holds a triad tone kept a 2nd away from the lead, the bells and the chord's colour tones.
  const arpNotes = ladder(segs, rows, shape, { lo: 'E-4', span: 8, vol: arpVol, soft: 6, len: step });
  parts.arp = soften(line(arpNotes, I.pluck, { rows, vib: null }), rows, refs);
  parts.canon = soften(delayLine(parts.arp, rows, segs, { delay: 3, scale: 0.45 }), rows, [...refs, notesOf(parts.arp, rows)]);
  parts.pad = padLane(segs, tri, rows, refs, { vol: padVol });
  return pattern(name, bars, cutLanes({ ...parts, ...extra }, KEYS), LAYOUT, PANS);
}

// ---------------------------------------------------------------- sections
const introArp = section('tmp', 4, CH.intro, { arpVol: 28 }).channels;
const intro = section('intro: glass forest', 4, CH.intro, { bassR: BASS.long, bassVol: 28, padVol: 18, windHi: 11, extra: {
  arp: fadeIn(introArp[LAYOUT.indexOf('arp')], 16, 56), canon: fadeIn(introArp[LAYOUT.indexOf('canon')], 19, 56),
  bells: hits(I.bell, [36], { note: 'B-6', vol: 44 }), fx: hits(I.swell, [57], { vol: 30 }),
} });
const breathe = section('breathe: bells, no drums', 8, CH.breathe, { bassR: BASS.long, bassVol: 26, shape: SLOW, step: 2,
  arpVol: 30, padVol: 20, windHi: 12, bell: BELL_BREATHE, bellVol: 52, extra: { fx: hits(I.swell, [121], { vol: 30 }) } });

const patterns = [
  intro,
  section('A: E F# G', 8, CH.A, { melody: A_MEL, groove: G.A }),
  section('A2: darker answer + snare', 8, CH.A, { melody: A2_MEL, groove: G.A2, bell: BELL_A2 }),
  section('B: the swell', 8, CH.B, { melody: B_MEL, groove: G.B, last: G.out, bassR: BASS.B, bassVol: 34, arpVol: 36, padVol: 20, windHi: 7 }),
  jump(breathe, 1),
];

// farstrand_title.gen.js imports the helpers above, so only write the song when run directly.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) writeSongCompact(import.meta.url, {
  title: 'Farstrand - Halm', bpm: 100, ticks: 6, mixvol: 48,
  message: 'FARSTRAND world theme "Halm".\nE minor, 100 BPM. Orders 1-4 loop.\nAll samples synthesized. Source: songs/farstrand_halm.gen.js',
  samples: [
    kick({ f0: 150, f1: 46, sweep: 30, decay: 8, click: 0.15, drive: 1.5, sec: 0.45 }),
    snare({ tone: 196, decay: 11, sec: 0.36, seed: 13, drive: 1.4 }),
    cymbal('glass tick', { sec: 0.05, decay: 90, seed: 17, metalMix: 0.7 }),
    wave('round bass', [1, 0.35, 0.14, 0.06, 0.03]),
    sawPluck('saw pluck'),
    wave('glass lead', [1, 0.03, 0.45, 0.02, 0.22, 0.02, 0.1, 0, 0.05]),
    thinPad('cold pad', { amps: [1, 0, 0.3, 0, 0.12, 0, 0.05], spread: 1 }),
    glassBell('glass bell', { sec: 1.4, partials: [[1, 1, 1.9], [2.76, 0.45, 4.5], [5.4, 0.22, 8], [8.93, 0.1, 14]] }),
    noiseLoop(), swell('swell', { sec: 1.1, seed: 19 }),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
