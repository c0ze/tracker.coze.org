#!/usr/bin/env node
/**
 * Raster Picnic: an original invitation-screen tune for a tiny computer-club
 * gathering, written as an Amiga / ProTracker demoscene study
 * (skills/amiga-demoscene/SKILL.md).
 * D major, 126 BPM, speed 6: 4 rows/beat, 16 rows/bar, 64 rows (4 bars) per
 * pattern. Form A8 / A'8 / B8 / A''8 bars, about 61 s, looping to A.
 *
 * Four channels, arranged for Paula from the start (Paula plays 0 and 3 on
 * the left, 1 and 2 on the right; the IT previews that at half width):
 *   0 drums  kick 0/8, snare 4/12, hats on the off-beats, one shared lane:
 *            nothing cuts a kick sooner than two rows (its 0.24 s body)
 *   1 lead   brass: short-short-long cell, delayed vibrato on held notes,
 *            two glides in the whole song
 *   2 bass   rounded cycle, root / syncopated root / fifth / approach
 *   3 organ  drawbar stabs as a rising broken chord on the off-beats, and
 *            answers (a brief arpeggio flick, a run) in the lead's rests
 * B moves to B minor (with a Dorian E/G#), half-time drums and a calmer organ;
 * A'' returns with the same four roles, a bVII (C) colour and a glide up.
 *
 * MOD discipline (tools/json2mod.js): every cell after a note carries a volume
 * OR an effect, never both, so the IT and the MOD play the same thing; note
 * rows with an effect use the sample's usual note volume, which becomes its MOD
 * default and needs no Cxx. Arpeggios stay within 7 semitones (J47 only) and
 * the glides move a semitone, so each fits one ranged copy in tune (see the skill).
 * The pans are expected losses in the export report: Paula's sides are fixed.
 * This is a reasoned example; it has been rendered and checked, not listened to.
 */
import { writeSong, nn, NAMES } from './lib.js';

const ROWS = 64, BAR = 16;
const S = { kick: 0, snare: 1, hat: 2, ohat: 3, tom: 4, bass: 5, organ: 6, lead: 7 };
const VIB = 'H52';                       // shallow (±12.5 cents in IT, 11-14 on ptplayer from the MOD), from half a beat into a held note

// Chords: bass root and its row-8 partner (D-3..D-4: audible on small speakers),
// and three organ tones voiced in A-4..G-5 so neighbouring chords share tones.
const CHORD = {
  'D':      { root: 'D-4', alt: 'A-3', tones: ['A-4', 'D-5', 'F#5'] },
  // C# arrives on beat 3, under the held A: on beat 1 it sat a minor ninth
  // under the answer's D (lint's first finding), so beat 1 keeps the root.
  'A/C#':   { root: 'A-3', alt: 'C#4', tones: ['A-4', 'C#5', 'E-5'] },
  'Bm':     { root: 'B-3', alt: 'F#3', tones: ['B-4', 'D-5', 'F#5'] },
  'G':      { root: 'G-3', alt: 'D-4', tones: ['B-4', 'D-5', 'G-5'] },
  'Em7':    { root: 'E-3', alt: 'B-3', tones: ['D-5', 'E-5', 'G-5'] },
  'F#m7':   { root: 'F#3', alt: 'C#4', tones: ['A-4', 'C#5', 'E-5'] },   // rootless: A major over F#
  'A':      { root: 'A-3', alt: 'E-3', tones: ['A-4', 'C#5', 'E-5'] },
  'C':      { root: 'C-4', alt: 'G-3', tones: ['G-4', 'C-5', 'E-5'] },   // bVII: the modal colour
  'E/G#':   { root: 'G#3', alt: 'B-3', tones: ['G#4', 'B-4', 'E-5'] },   // Dorian IV in B minor
  'Gmaj7':  { root: 'G-3', alt: 'D-4', tones: ['B-4', 'D-5', 'F#5'] },
  'F#sus4': { root: 'F#3', alt: 'C#4', tones: ['B-4', 'C#5', 'F#5'] },
  'F#':     { root: 'F#3', alt: 'C#4', tones: ['A#4', 'C#5', 'F#5'] },
  'Asus4':  { root: 'A-3', alt: 'E-3', tones: ['A-4', 'D-5', 'E-5'] },
  // Open fifths: the lead carries the third and passes through D (lint: a
  // C# stab under that D was a minor ninth).
  'A5':     { root: 'A-3', alt: 'E-3', tones: ['E-4', 'A-4', 'E-5'] },
};

// ------------------------------------------------------------------ the tune
// Lead per bar: [row, note, length, options]. The cell is short-short-long
// (2+2 rows, then a held note); the answer keeps the rhythm and turns down.
const A_LEAD = [
  [[0, 'F#5', 2], [2, 'A-5', 2], [4, 'D-6', 10]],                  // D      question
  [[0, 'E-6', 2], [2, 'D-6', 2], [4, 'A-5', 8]],                   // A/C#   answer
  [[0, 'B-5', 2], [2, 'D-6', 2], [4, 'F#6', 10]],                  // Bm     question, higher
  [[0, 'G-6', 2], [2, 'F#6', 2], [4, 'D-6', 8]],                   // G      answer
  [[0, 'E-6', 3], [3, 'F#6', 3], [6, 'G-6', 8]],                   // Em7    dotted climb
  [[0, 'A-6', 3], [3, 'F#6', 3], [6, 'C#6', 8]],                   // F#m7   the one peak
  [[0, 'D-6', 2], [2, 'E-6', 2], [4, 'D-6', 2], [6, 'B-5', 6]],    // G
  [[0, 'C#6', 2], [2, 'D-6', 2], [4, 'E-6', 10]],                  // A      open: held 5th
];
// A' keeps six bars and closes: a scale into the leading tone, then D.
const A2_LEAD = [...A_LEAD.slice(0, 6),
  [[0, 'D-6', 2], [2, 'E-6', 2], [4, 'D-6', 2], [6, 'B-5', 2], [8, 'A-5', 2], [10, 'B-5', 2], [12, 'C#6', 4]],
  [[0, 'D-6', 12]],
];
// B: the cell inverted on Bm, then recoloured on E major (G#: Dorian),
// lower and quieter; one slide down resolves the sus4.
const B_LEAD = [
  [[0, 'F#6', 2], [2, 'D-6', 2], [4, 'B-5', 10]],                  // Bm
  [[0, 'G#5', 2], [2, 'B-5', 2], [4, 'E-6', 8]],                   // E/G#
  [[0, 'F#6', 6], [6, 'E-6', 2], [8, 'D-6', 6]],                   // Gmaj7
  [[0, 'B-5', 8, { hold: true }], [8, 'A#5', 6, { glide: 'G02' }]], // F#sus4 -> F#
  [[0, 'D-6', 2], [2, 'C#6', 2], [4, 'B-5', 2], [6, 'F#5', 8]],    // Bm
  [[0, 'G#5', 2], [2, 'B-5', 2], [4, 'D-6', 2], [6, 'E-6', 8]],    // E/G#
  [[0, 'B-5', 2], [2, 'C#6', 2], [4, 'D-6', 8]],                   // G (C#: a lydian flash)
  [[0, 'E-6', 8]],                                                 // Asus4 -> A, then the fill
];
// A'': the same opening (pattern reused); bar 6 recolours the peak gesture on
// C (bVII), and the cadence bends up into D instead of stepping.
const A3_LEAD = [...A_LEAD.slice(0, 5),
  [[0, 'G-6', 3], [3, 'E-6', 3], [6, 'C-6', 8]],                   // C      the peak shape, modal
  [[0, 'B-5', 2], [2, 'D-6', 2], [4, 'G-6', 4], [8, 'E-6', 2], [10, 'D-6', 2], [12, 'C#6', 4, { hold: true }]],
  [[0, 'D-6', 8, { glide: 'G02' }]],      // a semitone bend; ends before the A7 flick's C#
];

// Organ answers in the lead's rests (rows within the bar), replacing the stabs from their first row.
const ANSWERS = {
  A:  { 1: [[12, 'A-4', 2, 'J47'], [14, 'C#5', 2]], 3: [[12, 'G-4', 2, 'J47'], [14, 'D-5', 2]],
        6: [[12, 'G-4', 2, 'J47'], [14, 'D-5', 2]] },
  A2: { 1: [[12, 'A-4', 2, 'J47'], [14, 'C#5', 2]], 3: [[12, 'G-4', 2, 'J47'], [14, 'D-5', 2]],
        7: [[12, 'F#5', 1], [13, 'E-5', 1], [14, 'D-5', 1], [15, 'C#5', 1]] },        // a run into B minor
  B:  { 1: [[12, 'E-5', 2, 'J47'], [14, 'B-4', 2]],
        7: [[8, 'D-5', 2], [10, 'C#5', 2], [12, 'A-4', 2, 'J47'], [14, 'E-5', 2]] },    // the sus4 resolves, then a flick
  A3: { 1: [[12, 'A-4', 2, 'J47'], [14, 'C#5', 2]], 3: [[12, 'G-4', 2, 'J47'], [14, 'D-5', 2]],
        7: [[8, 'A-4', 2, 'J47'], [10, 'C#5', 2], [12, 'E-5', 2], [14, 'G-5', 2]] },  // A7: G falls to the F# that opens A
};

// Drums, one character per row: k kick, s snare, g ghost snare, h closed hat,
// o open hat (choked by the next hit), t tom (pitches descend through a fill).
const DR = {
  main: 'k.h.s.h.k.h.s.h.', push: 'k.h.s.h.k.k.s.o.', fill: 'k.h.s.h.k.h.sgss',
  close: 'k.h.s.h.k.h.o...', half: 'k...h...s...h...', halfUp: 'k...h...s...h.h.',
  eighth: 'k.h.h.h.s.h.h.h.', toms: 'k.......t.t.t.t.', lift: 'k.h.s.h.k.h.s.ho',
};

const SECTIONS = {
  A:  { chords: ['D', 'A/C#', 'Bm', 'G', 'Em7', 'F#m7', 'G', 'A'], lead: A_LEAD, answers: ANSWERS.A,
        drums: ['main', 'main', 'main', 'push', 'main', 'main', 'main', 'fill'] },
  A2: { chords: ['D', 'A/C#', 'Bm', 'G', 'Em7', 'F#m7', 'G|A', 'D'], lead: A2_LEAD, answers: ANSWERS.A2,
        drums: ['main', 'main', 'main', 'push', 'main', 'main', 'main', 'close'] },
  B:  { chords: ['Bm', 'E/G#', 'Gmaj7', 'F#sus4|F#', 'Bm', 'E/G#', 'G', 'Asus4|A'], lead: B_LEAD, answers: ANSWERS.B,
        drums: ['half', 'half', 'half', 'halfUp', 'eighth', 'eighth', 'eighth', 'toms'], calm: true },
  A3: { chords: ['D', 'A/C#', 'Bm', 'G', 'Em7', 'C', 'G|A5', 'D|A'], lead: A3_LEAD, answers: ANSWERS.A3,
        drums: ['main', 'main', 'main', 'push', 'main', 'main', 'main', 'lift'] },
};

// ------------------------------------------------------------------ helpers
const put = (ch, row, ev) => {
  if (ch[row]) throw new Error(`collision at row ${row}: ${JSON.stringify(ch[row])} vs ${JSON.stringify(ev)}`);
  ch[row] = ev;
};
const v = (n) => `v${Math.round(n)}`;

/** Render [{r, note, len, ...}] (sorted) with an articulation; cut unless the next note is legato. */
function voice(list, rows, artic) {
  const ch = {};
  list.forEach((e, i) => {
    const next = list[i + 1]?.r ?? rows;
    if (e.r + e.len > next) throw new Error(`overlap at row ${e.r}`);
    artic(ch, e);
    if (e.r + e.len < next) put(ch, e.r + e.len, { note: '^^' });
  });
  return ch;
}

// Brass: accent, a lower held level, delayed vibrato on long notes, a two-step
// release. Rows with vibrato carry no volume (MOD: one command per cell).
function brass(ch, { r, note, len, vol = 40, glide, hold }) {
  const held = vol - 4;
  if (glide) {                            // no instrument, no volume: the cell is free for the slide
    put(ch, r, { note, fx: glide });
    if (len > 1) put(ch, r + 1, { fx: glide });
    if (len > 2) put(ch, r + 2, { vol: v(vol) });   // the bend arrives with a small swell
  } else {
    put(ch, r, { note, instrument: S.lead, vol: v(vol) });
    if (len > 1) put(ch, r + 1, { vol: v(held) });
  }
  if (len >= 8) for (let k = 4; k < len - 2; k++) put(ch, r + k, { fx: k === 4 ? VIB : 'H00' });
  if (hold) return;
  if (len >= 6) { put(ch, r + len - 2, { vol: v(vol * 0.62) }); put(ch, r + len - 1, { vol: v(vol * 0.34) }); }
  else if (len >= 4) put(ch, r + len - 1, { vol: v(vol * 0.6) });
}
function bassArtic(ch, { r, note, len, vol }) {
  put(ch, r, { note, instrument: S.bass, vol: v(vol) });
  if (len > 1) put(ch, r + 1, { vol: v(vol * 0.72) });
  if (len > 3) put(ch, r + len - 1, { vol: v(vol * 0.45) });
}
// Organ stab: a drawbar cycle never decays, so every stab is shaped and cut.
// A brief arpeggio keeps its J on the second row instead of a volume step.
function organArtic(ch, { r, note, len, vol, fx }) {
  put(ch, r, { note, instrument: S.organ, vol: v(vol), ...(fx ? { fx } : {}) });
  if (len > 1) put(ch, r + 1, fx ? { fx } : { vol: v(vol * 0.55) });
  if (len > 2) put(ch, r + 2, { vol: v(vol * 0.35) });
}

const pcs = (c) => new Set([c.root, ...c.tones].map((n) => nn(n) % 12));
const split = (name) => name.split('|').map((n) => CHORD[n]);
/** The chord tone of `c` nearest below `target` (no lower than D-3): the bass's approach. */
function approach(c, target) {
  const set = pcs(c);
  for (let n = nn(target) - 1; n >= nn('D-3'); n--) if (set.has(n % 12)) return NAMES[n % 12] + Math.floor(n / 12);
  return c.root;
}

function buildSection(sec, nextRoot) {
  const bars = sec.chords.length, rows = bars * BAR;
  const leadList = [], bassList = [], organList = [], drums = {};
  sec.chords.forEach((name, b) => {
    const at = b * BAR, [c1, c2 = c1] = split(name);
    for (const [r, note, len, opt = {}] of sec.lead[b])
      leadList.push({ r: at + r, note, len, vol: sec.calm ? 34 : 40, ...opt });

    // Bass: root, a syncopated root, the partner on beat 3 (or the second
    // chord's root), and an approach into the next bar.
    const following = b + 1 < bars ? split(sec.chords[b + 1])[0].root : nextRoot;
    const bv = sec.calm ? 36 : 44;
    if (sec.calm) bassList.push({ r: at, note: c1.root, len: 6, vol: bv }, { r: at + 8, note: c2 === c1 ? c1.root : c2.root, len: 5, vol: bv - 4 });
    else bassList.push({ r: at, note: c1.root, len: 3, vol: bv }, { r: at + 6, note: c1.root, len: 2, vol: bv - 8 },
      { r: at + 8, note: c2 === c1 ? c1.alt : c2.root, len: 3, vol: bv - 4 });
    bassList.push({ r: at + 14, note: approach(c2, following), len: 2, vol: bv - 10 });

    // Organ: a rising broken chord (A: off-beats of beats 2-4; B: 3+3+2 over the half-time drums),
    // replaced by an answer from its first row.
    const ans = sec.answers[b] ?? [], from = ans.length ? ans[0][0] : BAR, stabVol = 28;
    const stabs = sec.calm ? [[0, 0, 3], [6, 1, 3], [12, 2, 3]] : [[6, 0, 2], [10, 1, 2], [14, 2, 2]];
    for (const [r, t, len] of stabs) {
      if (r >= from) continue;
      const c = r < 8 ? c1 : c2;
      organList.push({ r: at + r, note: c.tones[t], len: Math.min(len, from - r), vol: stabVol });
    }
    // Answers step forward; a note carrying an arpeggio keeps the stab volume,
    // the sample's usual one, so in the MOD its cell needs no Cxx and keeps the J.
    for (const [r, note, len, fx] of ans) organList.push({ r: at + r, note, len, vol: fx ? stabVol : stabVol + 6, fx });

    // Drums on one lane.
    const toms = ['G-5', 'E-5', 'C-5', 'G-4'];
    [...DR[sec.drums[b]]].forEach((k, r) => {
      const quietHat = sec.calm ? 14 : (r % 4 === 2 ? 20 : 16);
      const hit = { k: [S.kick, sec.calm ? 46 : 54], s: [S.snare, sec.calm ? 30 : 46], g: [S.snare, 18],
        h: [S.hat, quietHat], o: [S.ohat, 20], t: [S.tom, 40] }[k];
      if (!hit) return;
      const note = k === 't' ? toms.shift() : 'C-5';
      put(drums, at + r, { note, instrument: hit[0], vol: v(hit[1] - (k === 't' ? (3 - toms.length) * 3 : 0)) });
    });
  });
  const channels = [drums, voice(leadList, rows, brass), voice(bassList, rows, bassArtic), voice(organList, rows, organArtic)];
  // Each section is safe to enter from anywhere: a free row 0 cuts what rang before.
  for (const ch of channels) if (!ch[0]) ch[0] = { note: '^^' };
  // The song's last row: the loops stop, so a single play ends clean and the
  // loop's downbeat starts from silence (a 0.12 s breath under the open hat).
  if (sec.last) for (const ch of channels.slice(1)) if (!ch[rows - 1]?.note) ch[rows - 1] = { note: '^^' };
  return { rows, channels };
}

// Paula sides (0 and 3 left, 1 and 2 right), previewed at half width in the IT.
const PAN = ['X40', 'XC0', 'XC0', 'X40'];
function chunk(sec, name, start) {
  const channels = sec.channels.map((ch, c) => {
    const out = {};
    for (const [r, e] of Object.entries(ch)) if (r >= start && r < start + ROWS) out[r - start] = { ...e };
    const free = [0, 1, 2, 3].find((r) => !out[r]?.fx);
    out[free] = { ...(out[free] ?? {}), fx: PAN[c] };
    return out;
  });
  return { name, rows: ROWS, channels };
}

// Build the form, then keep one copy of each identical pattern (A, A' and A''
// open with the same four bars: a reused pattern costs no extra memory).
const FORM = [['A', 'A'], ['A2', "A'"], ['B', 'B'], ['A3', "A''"]];
const patterns = [], order = [];
FORM.forEach(([key, label], i) => {
  const nextKey = FORM[(i + 1) % FORM.length][0];
  const sec = buildSection({ ...SECTIONS[key], last: i === FORM.length - 1 }, split(SECTIONS[nextKey].chords[0])[0].root);
  [0, 1].forEach((half) => {
    const p = chunk(sec, `${label} bars ${half * 4 + 1}-${half * 4 + 4}`, half * ROWS);
    const same = patterns.findIndex((q) => JSON.stringify(q.channels) === JSON.stringify(p.channels));
    if (same >= 0) { order.push(same); patterns[same].name += ` / ${label}`; return; }
    order.push(patterns.length);
    patterns.push(p);
  });
});

writeSong(import.meta.url, {
  title: 'Raster Picnic', bpm: 126, ticks: 6, mixvol: 64,
  message: 'Raster Picnic: an invitation screen for a tiny computer-club gathering.\n'
    + "D major, 126 BPM, A / A' / B / A'', four channels for Paula.\n"
    + 'All samples synthesized (sound library presets). Source: songs/raster_picnic.gen.js;\n'
    + 'MOD via tools/json2mod.js. Rendered and checked, not yet listened to.',
  samples: [
    { name: 'kick', synth: { preset: 'kick.punch' } },
    { name: 'snare', synth: { preset: 'snare.tight' } },
    { name: 'hat closed', synth: { preset: 'hat.closed' } },
    { name: 'hat open', synth: { preset: 'hat.open', seconds: 0.3 } },
    { name: 'tom', synth: { preset: 'tom.round' } },
    { name: 'bass', synth: { preset: 'bass.round' } },
    { name: 'organ', synth: { preset: 'organ.drawbar' } },
    { name: 'brass lead', synth: { preset: 'lead.brass' } },
  ],
  channelnames: { 0: 'drums', 1: 'lead', 2: 'bass', 3: 'organ' },
  patterns,
  order,
});
