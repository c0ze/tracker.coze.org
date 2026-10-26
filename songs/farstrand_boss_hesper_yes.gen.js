#!/usr/bin/env node
/**
 * FARSTRAND — "Hesper, Turned" (the Hesper who said yes, the secret boss at the bottom of the Marrow: a fully worn
 * Hesper, clear glass with gold veins, who quenches and kindles Hesper's footing back at her). 2026-10-07.
 * D Dorian, 150 BPM, speed 6: 4 rows/beat, 16 rows/bar; one row = a 16th (100 ms), one bar = 1.6 s.
 * Rendered at 44.1 kHz, where 150 BPM is exact (1470 samples/tick).
 *
 * Identity: Hesper's own theme turned against her. Her theme is the title's question (farstrand_title.gen.js: 'A—F——E
 * | D———': 5 up a minor sixth to b3, then 2, 1) and its answer, which the prologue quotes; the Survey's call (the
 * prologue's plumbline, benchmark's bugle) and KELL (the call mirrored: what she said yes to) are the other two.
 * Everything mirrors about D6. D Dorian is the one mode that is its own mirror (D E F G A B C inverted is the same
 * seven notes), so the question and its inversion live in one key: the question climbs a minor sixth and falls home
 * ('a5 f6 e6 | d6'), its mirror drops a minor sixth and climbs home ('g6 b5 c6 | d6'), and played together they are
 * a canon in contrary motion that crosses on a sustained tritone (F against B: the dominant of G over a D pedal) and
 * resolves on a unison D. The title's whole A section mirrored note for note is the yes (A2): its answer comes back
 * low and rising ('g6 b5 g5 | e5 f#5 g5 | a5 b5 c6 d6 | eb6 c6 g6') carrying the two notes the original never had,
 * F# (the warm major third, the Concord's D major) and Eb (the family's wrong light), over the mirrored chords (Dm
 * Bbmaj7 Gm7 A become G Gmaj7 D6 Cm; D7 stands for D6 where the mirrored line passes C). The rest mirrors too. The
 * canon's grooves are palindromes (kick, snare and bass hit rows r and 15-r of every bar: the backbeat comes a 16th
 * early on the way back), and the yes stands square. The Break reads the question backwards (its retrograde, 'd6 e6
 * f6 | a5': a rising step-step like Halm's cell, then the leap down), and the Build resolves both wrong notes, Eb (the
 * family's) and C# (its mirror), a semitone either side of D, into D.
 * The ladder (B) is her kit: two bars cold (the Survey's call upright on glass bells, no kick, the cold pad: quench)
 * and two bars warm (KELL in the flesh voice an octave down, the square groove, the warm pad: kindle), twice over.
 * The bass and the arp's rungs have no third (D and A: open fifths) until the yes brings the thirds, and the bass's and
 * the cold pad's own tones have none either: both are built without a fifth harmonic, which would be a major third.
 *
 * Phrase map
 *   Intro  D5 A5                          the question read backwards on far glass bells (retrograde), ticks, a snare press,
 *                                         a riser (not looped)
 *   A      D5 A5 D5 A5                    the mirror canon: the question (ocarina) against its inversion (glass lead), then
 *                                         the voices trade parts; the tritone F/B over the D pedal
 *   A2     G Gmaj7 D Gsus4-Cm | G Gmaj7 D7 Cm    the yes: the title's A mirrored note for note on the glass lead, the warm pad,
 *                                         bells glinting on the chords' tones, a square backbeat (no skew)
 *   B      D A Gm Cm G D Eb D             the ladder: cold bars (the call, bells) and warm bars (KELL, flesh, kick) alternating
 *   Break  D5 A5 D5 A5 | G5 C5 ...        half time: the question's retrograde on bells (twice), then the inversion's on flesh
 *   A3     as A                           the canon again, the glass lead doubled by bells an octave up, a driving kick
 *   Build  Eb Eb C#dim A7                 Eb and C# into D; the loop jumps to A
 * Loop body: orders 1-6 (44 bars, 70.4 s). Everything synthesized. Source of truth: this file; the shared helpers
 * come from farstrand_halm.gen.js, the march snare after farstrand_boss_kell.gen.js.
 */
import { kick, cymbal, noiseLoop, wave, glassBell, thinPad, swell, mel, line, chart, bass, pattern, jump, writeSongCompact,
  ladder, canon, notesOf, drumKit, triads, cutLanes, riser } from './heliobane_stage6.kit.js';
import { sawPluck, soften, delayLine, padLane, wind, fadeIn } from './farstrand_halm.gen.js';
import { nn } from './lib.js';

const SR = 22050, TAU = 2 * Math.PI;
const q3 = (x) => Math.round(x * 1000) / 1000;
const I = { kick: 0, snare: 1, hat: 2, tom: 3, bass: 4, pluck: 5, lead: 6, soft: 7, flesh: 8, pad: 9, warm: 10, bell: 11, noise: 12,
  swell: 13 };
const LAYOUT = ['kick', 'snare', 'hat', 'bass', 'hive', 'arp', 'canon', 'lead', 'echo', 'echo2', 'soft', 'softEcho', 'pad', 'warmPad',
  'bells', 'bellEcho', 'fx'];
const PANS = [0x80, 0x78, 0xac, 0x80, 0x80, 0x56, 0xaa, 0x86, 0x50, 0xb4, 0x7c, 0x4c, 0x70, 0x90, 0x9c, 0x5c, 0x88];
const KEYS = ['lead', 'echo', 'echo2', 'soft', 'softEcho', 'hive', 'arp', 'canon', 'pad', 'warmPad', 'bells', 'bellEcho'];

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
/** A dark snare (farstrand_boss_kell.gen.js's march snare): the two-mode body, its noise through a two-pole low-pass
 *  near 2.4 kHz with a short crack. */
function darkSnare(name = 'dark snare', { tone = 165, sec = 0.26, seed = 53, lp = 0.5, drive = 1.6 } = {}) {
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

// ---------------------------------------------------------------- melodies
// Hesper's: the title's question and its answer (farstrand_title.gen.js A). Mirrored about D6 every pitch p goes to 148 - p.
const Q1 = 'a5/4 f6/10~ e6/2 | d6/12~ r/4', Q2 = 'a5/4 g6/10~ f6/2 | e6/16~';
const MQ1 = 'g6/4 b5/10~ c6/2 | d6/12~ r/4', MQ2 = 'g6/4 a5/10~ b5/2 | c6/16~';          // the inversion
const QUESTION = `${Q1} | ${Q2}`, MQUESTION = `${MQ1} | ${MQ2}`;
const M_ANSWER = 'g6/4 b5/8 g5/4 | e5/8~ f#5/4 g5 | a5/6 b5/2 c6/4 d6 | eb6/8~ c6/4 g6'; // the title's answer, inverted
// read backwards: each note keeps its length and takes the place of its mirror image in time
const RQ1 = 'd6/12~ e6/2 f6/10~ a5/4 r/4', RQ2 = 'e6/16~ f6/2 g6/10~ a5/4';
const RMQ1 = 'd6/12~ c6/2 b5/10~ g6/4 r/4', RMQ2 = 'c6/16~ b5/2 a5/10~ g6/4';
// the Survey's call (hers) and KELL (its mirror: what she said yes to), each in two halves (benchmark, boss_kell)
const CALL1 = 'a5/2 d6/2 a6/8 g6/2 f#6/2 | e6/4 d6/4 e6/8', CALL2 = 'a5/2 d6/2 b6/8 a6/2 g6/2 | f#6/4 e6/4 d6/8';
const KELL1 = 'g6/2 d6/2 g5/8 a5/2 bb5/2 | c6/4 d6/4 c6/8', KELL2 = 'g6/2 d6/2 f5/8 g5/2 a5/2 | bb5/4 c6/4 d6/8~';
const A_GLASS = `${MQUESTION} | ${QUESTION}`, A_SOFT = `${QUESTION} | ${MQUESTION}`;      // the voices trade parts in bars 5-8
const A2_GLASS = `${MQUESTION} | ${M_ANSWER}`;
const A2_BELLS = 'd7/8 b6/8 | g6/8 f#6/8 | a6/8 f#6/8 | c7/8 eb7/8 | d7/8 b6/8 | g6/8 f#6/8 | f#6/8 a6/8 | eb7/8 g6/8';
const B_BELLS = `${CALL1} | r/16 | r/16 | ${CALL2} | r/16 | r/16`;
const B_HIVE = `r/16 | r/16 | ${KELL1} | r/16 | r/16 | ${KELL2}`;
const INTRO_BELLS = `${RQ1} ${RQ2}`;
const BREAK_BELLS = `${RQ1} ${RQ2} r/16 r/16 r/16 r/16`;
const BREAK_HIVE = `r/64 ${RMQ1} ${RMQ2}`;
const BUILD_MEL = 'bb5/3 d6/3 eb6/2 d6/8 | bb5/3 d6/3 eb6/2 c#6/8 | e6/3 g6/3 c#7/2 d7/8~ | a6/16~';
const CH = {
  intro: 'D5/32 A5/32', A: 'D5/32 A5/32 D5/32 A5/32', A2: 'G Gmaj7 D Gsus4/8 Cm/8 | G/16 Gmaj7 D7 Cm', B: 'D A Gm Cm G D Eb D',
  brk: 'D5/32 A5/32 G5/32 C5/32', build: 'Eb/32 C#dim/16 A7/16',
};
const ROLL = [0, 2, 1, 3, 2, 4, 3, 1, 0, 2, 1, 3, 4, 3, 2, 1]; // 16ths, as Kell's march: a turn rather than Halm's roll

// ---------------------------------------------------------------- the mirrored kit: kick, snare and bass hit rows r and 15-r
const drums = drumKit({
  kick: { X: [I.kick, 50], x: [I.kick, 36] },
  snare: { X: [I.snare, 40], x: [I.snare, 24], g: [I.snare, 12], t: [I.tom, 44, null, 'C-5'], T: [I.tom, 48, null, 'G-4'] },
  hat: { X: [I.hat, 18], x: [I.hat, 12], g: [I.hat, 7] },
});
const G = {
  mirror: { kick: 'X..x.x....x.x..X', snare: '....X......X....', hat: '.x..x..xx..x..x.' },
  yes: { kick: 'X.....x...x...x.', snare: '....X.......X...', hat: 'x.g.x.g.x.g.x.g.' },   // the yes stands square: no mirror
  drive: { kick: 'X.x...x..x...x.X', snare: '....X......X....', hat: 'x.g.x.g.x.g.x.g.' },
  cold: { kick: '................', snare: '................', hat: '.x..x..xx..x..x.' },
  half: { kick: 'X..x........x..X', snare: '.......Xx.......', hat: 'x.g.x.g.x.g.x.g.' },
  fill: { kick: 'X.......X...X.X.', snare: '....X..xXxXxtTtT', hat: 'x.g.x.g.........' },
  toms: { kick: 'X.........X.....', snare: '........tTtTtTtT', hat: 'x...x...........' },
  ticks: { kick: '................', snare: '................', hat: 'x.g.x.g.x.g.x.g.' },
  press: { kick: '................', snare: 'g.g.g.g.x.x.x.xx', hat: 'x.g.x.g.x.g.x.g.' },
  roll: { kick: 'X...X...X...X...', snare: 'XxXxXxXxXXXXXXXX', hat: '................' },
};
const BASS = { mirror: 'R--o--r--r--o--R', yes: 'R.o.r.o.R.o.r.o.', drone: 'R---------------', quarter: 'R...r...R...r...', drive: 'R.r.R.r.R.r.R.r.' };
const bars = (list) => list.reduce((acc, [n, g, f]) => {
  const d = drums(n, g, f), off = acc.rows;
  for (const k of Object.keys(d)) for (const [r, e] of Object.entries(d[k])) acc.lanes[k][+r + off] = e;
  acc.rows += n * 16;
  return acc;
}, { rows: 0, lanes: { kick: {}, snare: {}, hat: {} } }).lanes;
/** The arp rolls in the leads' own register over a bare fifth, so besides soften's semitones it also drops a note a whole
 *  tone or less (raw pitch distance, so a ninth is left alone) from a sounding note of `refs`. */
function nearCut(ch, rows, refs, within = 2) {
  const out = { ...ch }; let cur = null;
  for (let r = 0; r < rows; r++) {
    const e = out[r];
    if (e?.note === '^^') cur = null; else if (e?.note) cur = e.note;
    if (!cur) continue;
    const hit = refs.some((ref) => {
      const h = ref.find(([s0, , l]) => r >= s0 && r < s0 + l), d = h ? Math.abs(nn(cur) - nn(h[1])) : 99;
      return h && d > 0 && d <= within && (e?.note || h[0] === r);
    });
    if (hit) { out[r] = { note: '^^' }; cur = null; }
  }
  return out;
}
/** Keep only the events of `ch` inside the row ranges (a held note is cut where a range ends). */
function onlyIn(ch, ranges, rows) {
  const out = {}; let inside = false;
  const keep = (r) => ranges.some(([a, b]) => r >= a && r < b);
  for (const r of Object.keys(ch).map(Number).sort((a, b) => a - b)) {
    const here = keep(r);
    if (here) { out[r] = ch[r]; inside = true; } else if (inside) { out[r] = { note: '^^' }; inside = false; }
  }
  for (const [, b] of ranges) if (b < rows && !out[b] && !keep(b)) out[b] = { note: '^^' };
  return out;
}

function section(name, bars_, chordStr, { glass = null, glassVol = 42, soft = null, softVol = 34, hive = null, hiveVol = 44, hiveSemi = 0,
  bells = null, bellVol = 30, doubled = false, groove = G.mirror, fill = G.fill, kit = null, bassR = [BASS.mirror], bassVol = 38,
  arpVol = 22, padVol = 15, padInst = I.pad, warmRanges = null, coldRanges = null, extra = {} } = {}) {
  const rows = bars_ * 16, segs = chart(chordStr), tri = chart(triads(chordStr));
  const parts = { ...(kit ?? drums(bars_, groove, fill)),
    bass: bass(tri, bassR, I.bass, { rows, lo: 'C-3', vol: bassVol, soft: 0.72, decay: 0.9 }) };
  const refs = [];
  let gN = null, sN = null;
  if (glass) { gN = mel(glass, { vol: glassVol }); parts.lead = line(gN, I.lead, { rows, vib: 'H33', vibDelay: 3 }); refs.push(gN); }
  if (soft) { sN = mel(soft, { vol: softVol }); parts.soft = line(sN, I.soft, { rows, vib: 'H23', vibDelay: 4 }); refs.push(sN); }
  if (glass) { // the echoes keep clear of the other voice
    const other = sN ? [sN] : [];
    parts.echo = canon(parts.lead, gN, rows, { delay: 3, scale: 0.4, segs, refs: other });
    parts.echo2 = canon(parts.lead, gN, rows, { delay: 6, scale: 0.2, segs, refs: [notesOf(parts.echo, rows), ...other] });
    refs.push(notesOf(parts.echo, rows), notesOf(parts.echo2, rows));
    if (doubled) {
      const up = mel(glass, { vol: 22, semi: 12 });
      parts.bells = soften(line(up, I.bell, { rows, vib: null }), rows, refs.slice(1));
      refs.push(notesOf(parts.bells, rows));
    }
  }
  if (soft) {
    parts.softEcho = canon(parts.soft, sN, rows, { delay: 6, scale: 0.3, segs, refs: gN ? [gN, notesOf(parts.echo, rows)] : [] });
    refs.push(notesOf(parts.softEcho, rows));
  }
  if (hive) {
    const notes = mel(hive, { vol: hiveVol, semi: hiveSemi }), ch = line(notes, I.flesh, { rows, sustain: 0.85, release: 0.6, vib: 'H43', vibDelay: 4 });
    parts.hive = ch; refs.push(notes);
  }
  if (bells) {
    const notes = mel(bells, { vol: bellVol }), ch = soften(line(notes, I.bell, { rows, vib: null }), rows, refs);
    parts.bells = ch;
    parts.bellEcho = soften(delayLine(ch, rows, segs, { delay: 6, scale: 0.4 }), rows, [...refs, notesOf(ch, rows)]);
    refs.push(notes, notesOf(parts.bellEcho, rows));
  }
  const arpNotes = ladder(segs, rows, ROLL, { lo: 'D-4', span: 8, vol: arpVol, soft: 7, len: 1 });
  parts.arp = nearCut(soften(line(arpNotes, I.pluck, { rows, vib: null }), rows, refs), rows, refs);
  parts.canon = nearCut(soften(delayLine(parts.arp, rows, segs, { delay: 3, scale: 0.4 }), rows, [...refs, notesOf(parts.arp, rows)]),
    rows, refs);
  const pad = padLane(segs, tri, rows, refs, { lo: 'D-5', vol: padVol, inst: padInst });
  if (warmRanges) { // the ladder: the cold pad in the cold bars, the warm one in the warm bars
    parts.pad = onlyIn(pad, coldRanges, rows);
    parts.warmPad = onlyIn(Object.fromEntries(Object.entries(pad).map(([r, e]) => [r, e.instrument === undefined ? e : { ...e, instrument: I.warm }])), warmRanges, rows);
  } else if (padInst === I.warm) { parts.warmPad = pad; } else parts.pad = pad;
  return pattern(name, bars_, cutLanes({ ...parts, ...extra }, KEYS), LAYOUT, PANS);
}

// ---------------------------------------------------------------- sections
const introTmp = section('tmp', 4, CH.intro, { bells: INTRO_BELLS }).channels;
const intro = section('intro: read backwards', 4, CH.intro, { bells: INTRO_BELLS, bellVol: 48,
  kit: bars([[2, G.ticks], [1, G.press], [1, G.roll]]), bassR: [BASS.drone], bassVol: 32, padVol: 14, extra: {
    arp: fadeIn(introTmp[LAYOUT.indexOf('arp')], 32, 60), canon: fadeIn(introTmp[LAYOUT.indexOf('canon')], 35, 60),
    bass: { ...fadeIn(introTmp[LAYOUT.indexOf('bass')], 16, 48), 0: { note: 'D-3', instrument: I.bass, vol: 'v20' }, 16: { vol: 'v16' } },
    fx: { ...wind(4, { lo: 3, hi: 10, inst: I.noise }), ...riser(I.noise, 48, 64, { note: 'C-4', v0: 4, slope: 1.4, fx: 'F03' }) },
  } });
const brk = section('break: read back', 8, CH.brk, { bells: BREAK_BELLS, bellVol: 60, hive: BREAK_HIVE, hiveSemi: -12, hiveVol: 48,
  kit: bars([[7, G.half], [1, G.toms]]), bassR: [BASS.quarter], bassVol: 38, arpVol: 18, padVol: 18, padInst: I.warm });
const build = section('build: Eb and C# into D', 4, CH.build, { glass: BUILD_MEL, kit: bars([[2, G.drive], [2, G.drive, G.roll]]),
  bassR: [BASS.drive], bassVol: 40, arpVol: 24, padVol: 17, extra: { fx: riser(I.noise, 32, 64, { note: 'C-4', v0: 4, slope: 1.1, fx: 'F03' }) } });
const ladderBars = [[0, 32], [64, 96]], warmBars = [[32, 64], [96, 128]];
const B = section('B: the ladder, cold and warm', 8, CH.B, { bells: B_BELLS, bellVol: 60, hive: B_HIVE, hiveSemi: -12, hiveVol: 52,
  kit: bars([[2, G.cold], [2, G.yes], [2, G.cold], [2, G.yes, G.fill]]),
  bassR: [BASS.drone, BASS.drone, BASS.yes, BASS.yes, BASS.drone, BASS.drone, BASS.yes, BASS.yes], bassVol: 42,
  arpVol: 22, padVol: 20, warmRanges: warmBars, coldRanges: ladderBars });

const patterns = [
  intro,
  section('A: the mirror canon', 8, CH.A, { glass: A_GLASS, soft: A_SOFT }),
  section('A2: the yes, the title mirrored', 8, CH.A2, { glass: A2_GLASS, bells: A2_BELLS, bellVol: 26, padVol: 17, padInst: I.warm, groove: G.yes, bassR: [BASS.yes] }),
  B,
  brk,
  section('A3: the canon in glass', 8, CH.A, { glass: A_GLASS, soft: A_SOFT, doubled: true, groove: G.drive, arpVol: 24, padVol: 17 }),
  jump(build, 1),
];

writeSongCompact(import.meta.url, {
  title: 'Farstrand - Hesper, Turned', bpm: 150, ticks: 6, mixvol: 48,
  message: 'FARSTRAND boss theme "Hesper, Turned": the Hesper who said yes.\nD Dorian (its own mirror), 150 BPM. Orders 1-6 loop.\nThe title question, inverted; the Survey call and KELL.\nAll samples synthesized. Source: songs/farstrand_boss_hesper_yes.gen.js',
  samples: [
    kick({ f0: 160, f1: 46, sweep: 30, decay: 9, click: 0.15, drive: 1.8, sec: 0.4 }),
    darkSnare(),
    cymbal('glass tick', { sec: 0.05, decay: 100, seed: 17, metalMix: 0.7 }),
    { ...kick({ f0: 180, f1: 90, sweep: 25, decay: 12, click: 0.15, drive: 1.6, sec: 0.35 }), name: 'tom' },
    wave('hollow bass', [1, 0.25, 0.6, 0.12, 0, 0.14, 0, 0.06, 0.05]),
    sawPluck('dark pluck', { open: 2600, closed: 300, close: 7, decay: 4, sec: 0.8 }),
    wave('glass lead', [1, 0.03, 0.45, 0.02, 0.22, 0.02, 0.1, 0, 0.05]),
    wave('soft lead', [1, 0, 0.16, 0, 0.05, 0, 0.02]),
    wave('flesh', [1, 0.7, 0.45, 0.32, 0.22, 0.15, 0.1, 0.06]),
    thinPad('cold pad', { amps: [1, 0, 0.5, 0, 0, 0, 0.12], spread: 1 }),
    thinPad('warm pad', { amps: [1, 0.55, 0.35, 0.22, 0.14, 0.08], spread: 1 }),
    glassBell('glass bell', { sec: 1.6, partials: [[1, 1, 1.6], [2.76, 0.45, 4], [5.4, 0.2, 7.5], [8.93, 0.08, 12]] }),
    noiseLoop(), swell('swell', { sec: 1.2, seed: 29 }),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
