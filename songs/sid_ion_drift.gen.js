#!/usr/bin/env node
/**
 * Ion Drift (SID) — an original action loop for the C64 in the manner of Jeroen Tel's Cybernoid era,
 * written with skills/sid-music. D minor, 6 frames a row (a row is a 16th, 125 BPM); bars are 16-row
 * patterns, so a bar that comes back costs nothing.
 *
 * Voice 1: bass and drums. The kick sits in front of the bass note (kit.kickBass); a Tel snare
 *   (triangle, noise, pulse, pulse, noise) and noise hats go between the bass notes. Staccato $00D9 bass.
 * Voice 2: the lead (thin sweeping pulse, late vibrato, legato semitone trills); in B the staccato
 *   broken-chord figure.
 * Voice 3: changes role per section — staccato broken chords (A), a resonant low+band filtered pad
 *   sweeping open over two bars (A'), the filtered B melody (legato inside two-bar groups, so one
 *   filter sweep runs across the phrase), harmony under the lead (A'' consequent).
 *
 * Phrase map (lead goal / harmony):
 *   intro 2  Dm pedal, the filter opens on voice 3; the pickup A4 C#5 (only from order 0)
 *   A     4  Dm Bb C A      question (D up to A, held F) and an answer that climbs to C6 and stalls
 *                           on a trilled E over A: a half cadence; the pickup A4 C#5 again
 *   A'    4  Dm Bb Gm-A Dm  same question; the answer climbs 3+3+2 to the one peak, D6, and closes on D5
 *   B     8  Bb C F Dm Gm Eb A A   the lead becomes a broken-chord figure; the filtered melody rises
 *                           in arpeggios and falls back (Bb5 leaning on A over Dm), the Neapolitan Eb,
 *                           a trill on E over A, a snare roll and the pickup back into the theme
 *   A''   8  A + A' again with hats; harmony under the consequent; ends Dm-A with a roll and the
 *            pickup, so the loop lands on the hook's first D
 */
import { writeSong, nn, ns, up } from './lib.js';
import { kit, VIBRATO, RESTART } from './sid-kit.js';

const BAR = 16;

// ---------------------------------------------------------------- instruments
const I = {};
const samples = [];
const add = (key, inst) => { I[key] = samples.length; samples.push(inst); };
// Tel's bass: ADSR $00D9, gated a few frames, width $600 sweeping 64 a frame.
add('bass', kit.sweepBass({ name: 'staccato bass', adsr: [0, 0, 13, 9], width: 0x600, speed: 64, min: 0x200, max: 0xa00 }));
add('kickBass', kit.kickBass({ name: 'kick + bass', adsr: [0, 0, 13, 9], width: 0x600, speed: 64 }));
// Tel's drum wavetable: triangle thump, noise, two pulse frames, noise tail (Cybernoid: 10 80 40 40 80 80).
add('snare', { name: 'tel snare', sid: { adsr: [0, 8, 13, 8],
  wave: [['tri', 'D-2'], ['noise', 'A-6'], ['pulse', 'E-4'], ['pulse', 'C-4'], ['noise', 'D-6'], ['noise', 'A#5']], pulse: { width: 0x800 } } });
add('hat', kit.noise({ name: 'hat', adsr: [0, 5, 0, 5] }));
// Lead: Tel's $0ACE-like held pulse (release shortened so rests read), width $600 sweeping.
add('lead', { name: 'lead pulse', sid: { adsr: [0, 10, 12, 9], wave: ['pulse'], pulse: { width: 0x600, speed: 24, min: 0x300, max: 0xb00 } } });
// Staccato broken chords: $0099, width $400 sweeping as fast as the driver allows (Tel: ±128).
add('figure', { name: 'staccato figure', sid: { adsr: [0, 0, 9, 9], wave: ['pulse'], pulse: { width: 0x400, speed: 127, min: 0x200, max: 0xe00 } } });
// The one filtered part: low+band, resonance 15, cutoff 448 opening 8 a frame to 1792 (28 rows).
add('swell', { name: 'filter swell', sid: { adsr: [0, 9, 12, 9], wave: ['pulse'], pulse: { width: 0x500, speed: 16, min: 0x300, max: 0xb00 },
  filter: { mode: 'low+band', cutoff: 448, resonance: 15, speed: 1, min: 448, max: 1792 } } });
add('harmony', { name: 'harmony pulse', sid: { adsr: [0, 8, 10, 9], wave: ['pulse'], pulse: { width: 0x400, speed: 40, min: 0x200, max: 0xc00 } } });

// ---------------------------------------------------------------- helpers
// events: [row, note, len, extra?]. A note shorter than the gap to the next one ends with a key off.
// A note of minVib+ rows gets Tel's late vibrato from vibAt rows in (H once, then H00 on each row).
// extra.fx 'G30' makes the note legato (no restart: the wavetable, pulse sweep and filter run on).
function line(events, instrument, { rows, vib = VIBRATO.tel, vibAt = 2, minVib = 4 } = {}) {
  const ch = {};
  const sorted = [...events].sort((a, b) => a[0] - b[0]);
  sorted.forEach(([row, note, len, extra = {}], i) => {
    const next = i + 1 < sorted.length ? sorted[i + 1][0] : rows;
    const end = Math.min(row + len, next);
    ch[row] = { note, instrument, ...extra };
    if (vib && len >= minVib) for (let r = row + vibAt; r < end; r++) if (!ch[r]) ch[r] = { fx: r === row + vibAt ? vib : 'H00' };
    if (row + len < next && row + len < rows && !ch[row + len]) ch[row + len] = { note: '==' };
  });
  return ch;
}
// Bars of [row, ...] events -> absolute rows.
const bars = (list) => list.flatMap((rows, b) => rows.map(([r, ...rest]) => [b * BAR + r, ...rest]));
const LEG = { fx: 'G30' }; // a legato step: 3 semitones a frame, so a trill or a leap lands in a frame or two
// A trill: legato notes a semitone apart, one row (6 frames) each, starting on the upper note.
const trill = (row, lower, count) => [...Array(count)].map((_, k) => [row + k, k % 2 ? lower : up(lower, 1), 1, LEG]);
// A legato group: the first note restarts (and retakes the filter), the rest slur on.
const slur = (events) => events.map((e, i) => (i ? [e[0], e[1], e[2], { ...LEG, ...(e[3] || {}) }] : e));

// ---------------------------------------------------------------- the theme (voice 2)
// The hook: D, up a fifth to A, F-G back to a held A, stepping down; the held F over Bb answers it.
const Q1 = [[0, 'D-5', 2], [2, 'A-5', 2], [4, 'F-5', 1], [5, 'G-5', 1], [6, 'A-5', 4], [10, 'G-5', 2], [12, 'F-5', 2], [14, 'E-5', 2]];
const Q2 = [[0, 'F-5', 8], [8, 'D-5', 2], [10, 'F-5', 2], [12, 'A#5', 2], [14, 'A-5', 2]];
// The antecedent's answer: the hook's rhythm a step up over C, then a trilled E over A (half cadence).
const ANS = [[0, 'G-5', 2], [2, 'C-6', 2], [4, 'A#5', 1], [5, 'A-5', 1], [6, 'G-5', 4], [10, 'E-5', 2], [12, 'G-5', 2], [14, 'F-5', 2]];
const PICKUP = [[12, 'A-4', 2], [14, 'C#5', 2]];
const STALL = [[0, 'E-5', 4], ...trill(4, 'E-5', 5), [9, 'E-5', 3, LEG], ...PICKUP];
// The consequent: the held F, then 3+3+2 up to the peak D6 over Gm, down through A to D.
const CLIMB = [[0, 'F-5', 6], [6, 'D-5', 1], [7, 'F-5', 1], [8, 'A-5', 3], [11, 'A#5', 3], [14, 'C-6', 2]];
const PEAK = [[0, 'D-6', 6], [6, 'C-6', 1], [7, 'A#5', 1], [8, 'A-5', 4], [12, 'G-5', 2], [14, 'E-5', 2]];
const HOME = [[0, 'F-5', 2], [2, 'E-5', 2], [4, 'D-5', 10]];
const HOME_LOOP = [[0, 'F-5', 2], [2, 'E-5', 2], [4, 'D-5', 8], ...PICKUP];
const A_LEAD = [Q1, Q2, ANS, STALL];
const A2_LEAD = [Q1, CLIMB, PEAK, HOME];
const A3_LEAD = [Q1, Q2, ANS, STALL, Q1, CLIMB, PEAK, HOME_LOOP];

// ---------------------------------------------------------------- chords
// Close voicings with common tones kept: [low, mid, high, top].
const LOW = { Dm: ['D-4', 'F-4', 'A-4', 'D-5'], Bb: ['D-4', 'F-4', 'A#4', 'D-5'], C: ['C-4', 'E-4', 'G-4', 'C-5'],
  A: ['E-4', 'A-4', 'C#5', 'E-5'], Gm: ['D-4', 'G-4', 'A#4', 'D-5'] };
const MID = { Bb: ['A#3', 'D-4', 'F-4', 'A#4'], C: ['C-4', 'E-4', 'G-4', 'C-5'], F: ['A-3', 'C-4', 'F-4', 'A-4'],
  Dm: ['A-3', 'D-4', 'F-4', 'A-4'], Gm: ['A#3', 'D-4', 'G-4', 'A#4'], Eb: ['A#3', 'D#4', 'G-4', 'A#4'], A: ['A-3', 'C#4', 'E-4', 'A-4'] };
const PCS = { Dm: [2, 5, 9], Bb: [10, 2, 5], C: [0, 4, 7], A: [9, 1, 4], Gm: [7, 10, 2], F: [5, 9, 0], Eb: [3, 7, 10] };

// Tel's chords: a staccato broken-chord figure (2 and 1 row steps, accents 3+3+2), each note gated
// for a row. `upto` stops the figure early (the pickup takes the voice).
const FIG = [[0, 1], [2, 2], [3, 0], [4, 1], [6, 2], [7, 0], [9, 1], [11, 2], [12, 3], [14, 2], [15, 0]];
function figure(chords, voicing, { upto = BAR } = {}) {
  const ch = {};
  chords.forEach((c, b) => FIG.forEach(([r, k], i) => {
    if (r >= upto) return;
    ch[b * BAR + r] = { note: voicing[c][k], instrument: I.figure };
    const next = i + 1 < FIG.length ? FIG[i + 1][0] : BAR;
    if (next - r > 1 && r + 1 < upto) ch[b * BAR + r + 1] = { note: '==' };
  }));
  return ch;
}

// Harmony under the lead: the nearest chord tone a third or sixth below, else a fourth or fifth.
function under(note, chord) {
  const m = nn(note);
  for (const d of [3, 4, 8, 9, 5, 7]) if (PCS[chord].includes((m - d) % 12)) return ns(m - d);
  return ns(m - 12);
}

// ---------------------------------------------------------------- bass and drums (voice 1)
const ROOT = { Dm: 'D-3', Bb: 'A#2', C: 'C-3', A: 'A-2', Gm: 'G-2', F: 'F-3', Eb: 'D#3' };
// One bar. kinds: 'drive' (16th bass with the kick on 1 and 3, snare on 2 and 4), 'half' (half time:
// kick on 1 and 4, snare on 3, 8th octaves), 'intro' (drive without the snare). chords: [first half,
// second half]. end: 'fifth' (snare, octave, the fifth), 'roll' (four snares), 'fill' (snare, two more).
function v1Bar([c1, c2 = c1], kind, { end = 'fifth', hats = false } = {}) {
  const r1 = ROOT[c1], r2 = ROOT[c2], o1 = up(r1, 12), o2 = up(r2, 12), e = [];
  const B = (r, n, i = I.bass) => e.push([r, n, i]);
  const S = (r) => e.push([r, 'C-5', I.snare]);
  const H = (r) => e.push([r, 'C-5', I.hat]);
  if (kind === 'half') {
    B(0, r1, I.kickBass); B(2, o1); B(4, r1); B(6, o1); S(8); B(10, o2); B(12, r2, I.kickBass); B(14, o2); B(15, up(r2, 7));
    return e;
  }
  B(0, r1, I.kickBass); B(2, o1); B(3, r1); B(6, r1); B(7, o1); B(8, r2, I.kickBass); B(10, o2); B(11, r2);
  if (kind === 'intro') { H(4); H(12); } else S(4);
  if (hats) [1, 5, 9].forEach(H);
  if (end === 'roll') [12, 13, 14, 15].forEach(S);
  else if (end === 'fill') { S(12); S(14); S(15); }
  else {
    if (kind !== 'intro') S(12);
    if (hats) H(13);
    B(14, o2); B(15, up(r2, 7));
  }
  return e;
}
function v1(list) {
  const ch = {};
  list.forEach((evs, b) => { for (const [r, note, instrument] of evs) ch[b * BAR + r] = { note, instrument }; });
  return ch;
}

// ---------------------------------------------------------------- sections
const intro = {
  bars: 2,
  v1: v1([v1Bar(['Dm'], 'intro'), v1Bar(['Dm', 'A'], 'drive', { end: 'roll' })]),
  v2: line(bars([[], PICKUP]), I.lead, { rows: 32 }),
  // The filter opens over both bars; the D slurs down to C# under the A chord.
  v3: line(slur([[0, 'D-4', 24], [24, 'C#4', 8]]), I.swell, { rows: 32, vib: null }),
};

const sectionA = {
  bars: 4,
  v1: v1([v1Bar(['Dm'], 'drive'), v1Bar(['Bb'], 'drive'), v1Bar(['C'], 'drive'), v1Bar(['A'], 'drive')]),
  v2: line(bars(A_LEAD), I.lead, { rows: 64 }),
  v3: figure(['Dm', 'Bb', 'C', 'A'], LOW),
};

const sectionA2 = {
  bars: 4,
  v1: v1([v1Bar(['Dm'], 'drive'), v1Bar(['Bb'], 'drive'), v1Bar(['Gm', 'A'], 'drive'), v1Bar(['Dm'], 'drive', { end: 'fill' })]),
  v2: line(bars(A2_LEAD), I.lead, { rows: 64 }),
  // A filtered inner voice: F held over Dm and Bb (one sweep), then G-E-F over Gm A Dm (another).
  v3: line([[0, 'F-4', 32], ...slur([[32, 'G-4', 8], [40, 'E-4', 8], [48, 'F-4', 16]])], I.swell, { rows: 64, vib: null }),
};

// B: the melody rises in arpeggios and falls back, two bars to a slur (one filter sweep each).
const B_MELODY = [
  ...slur(bars([[[0, 'D-5', 6], [6, 'F-5', 2], [8, 'A#5', 8]], [[0, 'A-5', 4], [4, 'G-5', 4], [8, 'E-5', 8]]])),
  ...slur(bars([[], [], [[0, 'F-5', 6], [6, 'A-5', 2], [8, 'C-6', 8]], [[0, 'A#5', 4], [4, 'A-5', 4], [8, 'F-5', 8]]])),
  ...slur(bars([[], [], [], [], [[0, 'D-5', 6], [6, 'G-5', 2], [8, 'A#5', 8]], [[0, 'A#5', 4], [4, 'G-5', 4], [8, 'D#5', 8]]])),
  ...slur(bars([[], [], [], [], [], [], [[0, 'E-5', 4], [4, 'C#5', 4], [8, 'E-5', 2], ...trill(10, 'E-5', 6)], [[0, 'E-5', 12]]])),
];
const B_CHORDS = ['Bb', 'C', 'F', 'Dm', 'Gm', 'Eb', 'A', 'A'];
const sectionB = {
  bars: 8,
  v1: v1([...B_CHORDS.slice(0, 7).map((c) => v1Bar([c], 'half')), v1Bar(['A'], 'drive', { end: 'roll' })]),
  v2: { ...figure(B_CHORDS.slice(0, 7), MID), ...Object.fromEntries(Object.entries(figure(['A'], MID, { upto: 12 })).map(([r, e]) => [+r + 7 * BAR, e])),
    ...line(PICKUP.map(([r, n, l]) => [7 * BAR + r, n, l]), I.lead, { rows: 128 }) },
  v3: line(B_MELODY, I.swell, { rows: 128, vibAt: 2, minVib: 6 }),
};

const a3Lead = bars(A3_LEAD);
const A3_CHORDS = ['Dm', 'Bb', 'C', 'A', 'Dm', 'Bb', 'Gm', 'Dm'];
const chordAt = (r) => {
  const b = r >> 4, half = (r & 15) >= 8;
  if (b === 6 && half) return 'A';
  if (b === 7 && half) return 'A';
  return A3_CHORDS[b];
};
const sectionA3 = {
  bars: 8,
  v1: v1([v1Bar(['Dm'], 'drive', { hats: true }), v1Bar(['Bb'], 'drive', { hats: true }), v1Bar(['C'], 'drive', { hats: true }),
    v1Bar(['A'], 'drive', { hats: true }), v1Bar(['Dm'], 'drive', { hats: true }), v1Bar(['Bb'], 'drive', { hats: true }),
    v1Bar(['Gm', 'A'], 'drive', { hats: true }), v1Bar(['Dm', 'A'], 'drive', { hats: true, end: 'roll' })]),
  v2: line(a3Lead, I.lead, { rows: 128 }),
  v3: {
    ...figure(['Dm', 'Bb', 'C', 'A'], LOW),
    ...line(a3Lead.filter(([r]) => r >= 64).map(([r, n, len, extra]) => [r, under(n, chordAt(r)), len, extra]), I.harmony, { rows: 128, vib: null }),
  },
};

// ---------------------------------------------------------------- bars -> patterns, orders
const patterns = [], patternIndex = new Map(), order = [];
function place(name, section, { last = {} } = {}) {
  const n = section.bars;
  for (let b = 0; b < n; b++) {
    const channels = [section.v1, section.v2, section.v3].map((ch) => {
      const out = {};
      for (const [r, ev] of Object.entries(ch)) if (r >= b * BAR && r < (b + 1) * BAR) out[r - b * BAR] = ev;
      return out;
    });
    if (b === n - 1) for (const [c, ev] of Object.entries(last)) channels[c][BAR - 1] = { ...channels[c][BAR - 1], ...ev };
    const key = JSON.stringify(channels);
    if (!patternIndex.has(key)) { patternIndex.set(key, patterns.length); patterns.push({ name: `${name} ${b + 1}`, rows: BAR, channels }); }
    order.push(patternIndex.get(key));
  }
}
const hex = (n) => n.toString(16).toUpperCase().padStart(2, '0');
place('intro', intro);
const LOOP = order.length;
place('A', sectionA);
place("A'", sectionA2);
place('B', sectionB);
place("A''", sectionA3, { last: { 0: { fx: `B${hex(LOOP)}` } } });

writeSong(import.meta.url, {
  title: 'Ion Drift (SID)', bpm: 125, ticks: 6,
  message: 'An original action loop for the C64 in the manner of Jeroen Tel (Cybernoid era), written with the sid-music skill.\n' +
    'D minor, 6 frames a row. Voice 1 bass + kick + snare, voice 2 lead / broken-chord figure, voice 3 broken chords /\n' +
    'filtered swell / filtered B melody / harmony. Order 0 plays a 2-bar intro; the loop returns to order 2.',
  sid: { model: '6581', author: 'Claude Opus 5.5', released: '2026', ...RESTART.tel, loop: LOOP },
  samples,
  channelnames: ['bass + drums', 'lead / figure', 'chords / filter / harmony'],
  patterns,
  order,
});
