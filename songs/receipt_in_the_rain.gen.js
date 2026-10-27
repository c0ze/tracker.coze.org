#!/usr/bin/env node
/**
 * Receipt in the Rain — the jazz-hop example (skills/jazz-hop/SKILL.md).
 * Closing a neighbourhood shop while rain taps the awning.
 *
 * C major with borrowed F minor colour. 84 BPM, speed 6: 4 rows/beat,
 * 16 rows/bar, 64-row patterns (4 bars, 11.43 s). Form A / A' / B / A'',
 * 8 bars each (two patterns per section), 32 bars = 91.4 s, then it loops.
 *
 * Swing: every onset on an odd row (the second sixteenth of each eighth) gets
 * SD1, so a sixteenth pair is 7 + 5 ticks = 208 + 149 ms (58.3 %). The
 * swing() pass applies it to every channel, so no voice can drift off it.
 *
 * Channels: kick | rim/snare/ghost | shaker | bass | three tine voices
 * (rootless guide tones and colour, one note each) | mallet foreground.
 * Voicing tables list sounding pitches; C-5 is middle C.
 *
 * Structural teaching order in A: bass and drums carry bars 1-2 under the
 * motif, guide tones (3rd and 7th only) enter in bars 3-4, the colour tone
 * (9th/13th) in bar 5. The keys stay at or above F-4 and leave the root to the
 * bass; where a voicing does hold the root (Fm6, the low Em7) it is the top note.
 * Colour yields to the melody: no keys note sits a minor ninth under it.
 * Lint and renders are structural evidence only; nobody has listened yet.
 */
import { writeSong } from './lib.js';

const ROWS = 64, BAR = 16, SECTION = 128;
const I = { kick: 0, rim: 1, snare: 2, ghost: 3, shaker: 4, bass: 5, tine: 6, tineSoft: 7, vibes: 8, mallet: 9 };
const PAN = { 0: 'X80', 1: 'X70', 2: 'XB0', 3: 'X80', 4: 'X58', 5: 'X80', 6: 'XA8', 7: 'X94' };

// --- Voicings: [low, mid, high] tine voices over the bass root (sounding pitch).
// fn names each voice's chord function; guide-tone mode keeps only 3rds/7ths/6ths.
const CHORD = {
  Cmaj9: { root: 'C-3', fifth: 'G-3', v: ['B-4', 'D-5', 'E-5'], fn: ['7', '9', '3'] },
  // Melody on the root: a maj7 under it is a minor ninth, so the 6th replaces it.
  C69: { root: 'C-3', fifth: 'G-3', v: ['A-4', 'D-5', 'E-5'], fn: ['6', '9', '3'] },
  Am9: { root: 'A-3', fifth: 'E-3', v: ['B-4', 'C-5', 'G-5'], fn: ['9', '3', '7'] },
  // Melody on C or B: the 9th (B) would sit a minor ninth under the melody's C.
  Am11: { root: 'A-3', fifth: 'E-3', v: ['C-5', 'D-5', 'G-5'], fn: ['3', '11', '7'] },
  // Melody on F (the minor 3rd): no E under it; the melody supplies the 9th itself.
  Dm11: { root: 'D-3', fifth: 'A-3', v: ['C-5', 'F-5', 'G-5'], fn: ['7', '3', '11'] },
  G13: { root: 'G-3', fifth: 'D-3', v: ['B-4', 'E-5', 'F-5'], fn: ['3', '13', '7'] },
  // An F triad's notes over a G bass: G9sus4, the turnaround back to C.
  G9sus: { root: 'G-3', fifth: 'D-3', v: ['A-4', 'C-5', 'F-5'], fn: ['9', '11', '7'] },
  Em7: { root: 'E-3', fifth: 'B-3', v: ['B-4', 'D-5', 'G-5'], fn: ['5', '7', '3'] },
  // The natural 5th (E) would rub against the b13 (F): the bass repeats the root.
  A7b13: { root: 'A-3', fifth: 'A-3', v: ['C#5', 'F-5', 'G-5'], fn: ['3', 'b13', '7'] },
  // B drops to a lower, darker position and leads mostly by semitone.
  Fmaj9: { root: 'F-3', fifth: 'C-3', v: ['A-4', 'E-5', 'G-5'], fn: ['3', '7', '9'] },
  Fm6: { root: 'F-3', fifth: 'C-3', v: ['G#4', 'D-5', 'F-5'], fn: ['b3', '6', 'R'] },
  Em7low: { root: 'E-3', fifth: 'B-3', v: ['G-4', 'D-5', 'E-5'], fn: ['3', '7', 'R'] },
  A7b13low: { root: 'A-3', fifth: 'A-3', v: ['G-4', 'C#5', 'F-5'], fn: ['7', '3', 'b13'] },
  Dm9low: { root: 'D-3', fifth: 'A-3', v: ['F-4', 'C-5', 'E-5'], fn: ['3', '7', '9'] },
  // A'' cadence: Fm6 (its 6th, D, in the mallet) to Cadd9: A-flat falls to G, F to E.
  Fm6cad: { root: 'F-3', fifth: 'C-3', v: ['G#4', 'C-5', 'F-5'], fn: ['b3', '5', 'R'] },
  Cadd9: { root: 'C-3', fifth: 'G-3', v: ['G-4', 'D-5', 'E-5'], fn: ['5', '9', '3'] },
};
const GUIDE = new Set(['3', 'b3', '7', '6']);
const NAMES = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];
const semis = (n) => NAMES.indexOf(n.slice(0, 2)) + 12 * Number(n[2]);
const name = (s) => NAMES[s % 12] + Math.floor(s / 12);

// --- A channel that knows note lengths. Onsets refuse collisions; a written
// end becomes ^^ unless the next onset already replaces the note there.
class Voice {
  constructor() { this.ev = {}; this.cuts = new Set(); this.fades = {}; }
  onset(row, ev) {
    if (!Number.isInteger(row) || row < 0 || row >= SECTION) throw new Error(`row ${row} outside the section`);
    if (this.ev[row]?.note) throw new Error(`onset collision at row ${row}`);
    this.ev[row] = { ...this.ev[row], ...ev };
  }
  stamp(row, ev) { if (row < SECTION && !this.ev[row]?.note) this.ev[row] = { ...this.ev[row], ...ev }; }
  // len rows; fade = level on the last row; carry = let it ring past the section.
  note(row, note, instrument, len, vol, { fade, carry = false, vib } = {}) {
    this.onset(row, { note, instrument, vol: `v${vol}` });
    if (fade !== undefined && len >= 3) this.fades[row + len - 1] = fade;
    if (vib) for (let r = row + 2; r < Math.min(row + len, SECTION); r++) this.stamp(r, { fx: r === row + 2 ? vib : 'H00' });
    if (row + len < SECTION) this.cuts.add(row + len);
    else if (!carry && row + len > SECTION) throw new Error(`note at ${row} runs past the section`);
  }
  build() {
    for (const [r, v] of Object.entries(this.fades)) this.stamp(Number(r), { vol: `v${v}` });
    for (const r of this.cuts) if (!this.ev[r]?.note) this.ev[r] = { ...this.ev[r], note: '^^' };
    return this.ev;
  }
}

// --- Swing: every onset (or cut) on an odd row is delayed one tick.
function swing(ch, delay = 'SD1') {
  for (const [r, ev] of Object.entries(ch)) {
    if (Number(r) % 2 === 0 || !ev.note) continue;
    if (ev.fx && ev.fx !== delay) throw new Error(`row ${r}: ${ev.fx} occupies the swing slot`);
    ev.fx = delay;
  }
  return ch;
}

// --- Bass: root on 1 with the kick, fifth on the and-of-3, a swung chromatic
// approach on the last sixteenth. bass.round is a loop: every note is shaped and cut.
function bassNote(b, row, note, len, vol) {
  b.note(row, note, I.bass, len, vol, { fade: Math.round(vol * 0.55) });
  if (len >= 2) b.stamp(row + 1, { vol: `v${Math.round(vol * 0.82)}` });
}
function bassLine(bars, next, { halfTime = false, bounce = false, approach = {} } = {}) {
  const b = new Voice();
  bars.forEach((chords, i) => {
    const o = i * BAR, c1 = CHORD[chords[0]];
    const nextRoot = CHORD[(bars[i + 1] ?? next)[0]].root;
    const appr = approach[i] ?? name(semis(nextRoot) - 1);
    if (chords.length === 2) {
      bassNote(b, o, c1.root, 5, 46);
      bassNote(b, o + 8, CHORD[chords[1]].root, 6, 42);
    } else if (halfTime) {
      bassNote(b, o, c1.root, 8, 38);
      bassNote(b, o + 10, c1.fifth, 4, 30);
    } else {
      bassNote(b, o, c1.root, 6, 46);
      if (bounce && i % 2 === 1) b.note(o + 7, c1.root, I.bass, 1, 26);
      bassNote(b, o + 10, c1.fifth, 3, 38);
    }
    b.note(o + 15, appr, I.bass, 1, halfTime ? 26 : 32);
  });
  return b.build();
}

// --- Tines: one voice per channel. hits: [row, chord, len, level].
function tines(hits, { soft = false, guidesOnly = () => false, entryCut = false } = {}) {
  const voices = [new Voice(), new Voice(), new Voice()];
  const weight = [1, 0.85, 0.95];
  if (entryCut) voices.forEach((v) => v.onset(0, { note: '^^' }));
  for (const [row, chord, len, level] of hits) {
    const c = CHORD[chord];
    c.v.forEach((pitch, k) => {
      if (guidesOnly(row) && !GUIDE.has(c.fn[k])) return;
      const vol = Math.round(level * weight[k]);
      voices[k].note(row, pitch, soft ? I.tineSoft : I.tine, len, vol, { fade: Math.max(6, Math.round(vol * 0.4)) });
    });
  }
  return voices.map((v) => v.build());
}
// Comping rhythms. A: hit, lighter re-strike, room for the motif. Pushes are
// the next chord struck on the swung last sixteenth of the bar before.
function compA(bars, from = 0, pushes = []) {
  const hits = [];
  bars.forEach((chords, i) => {
    if (i < from) return;
    const o = i * BAR;
    if (chords.length === 2) {
      if (!pushes.includes(i - 1)) hits.push([o, chords[0], 6, 24]);
      hits.push([o + 8, chords[1], 8, 24]);
      return;
    }
    if (!pushes.includes(i - 1)) hits.push([o, chords[0], 6, 24]);
    hits.push([o + 6, chords[0], pushes.includes(i) ? 6 : 5, 18]);
    if (pushes.includes(i)) hits.push([o + 15, bars[i + 1][0], 7, 22]);
  });
  return hits;
}
function compBusy(bars, pushes = []) {
  const hits = [];
  bars.forEach((chords, i) => {
    const o = i * BAR;
    if (chords.length === 2) {
      if (!pushes.includes(i - 1)) hits.push([o, chords[0], 3, 26]);
      hits.push([o + 3, chords[0], 3, 13], [o + 8, chords[1], 8, 24]);
      return;
    }
    if (!pushes.includes(i - 1)) hits.push([o, chords[0], 3, 26]);
    hits.push([o + 3, chords[0], 3, 13], [o + 6, chords[0], pushes.includes(i) ? 6 : 4, 21]);
    if (pushes.includes(i)) hits.push([o + 15, bars[i + 1][0], 4, 24]);
  });
  return hits;
}
function compHalf(bars) {
  return bars.flatMap((chords, i) => [[i * BAR, chords[0], 8, 20], [i * BAR + 8, chords[0], 8, 13]]);
}

// --- Drums. Ghost notes are a separate, darker snare sample, not just a quieter hit.
function drums(bars, { style, shaker16 = () => true, lastFill = true }) {
  const k = new Voice(), s = new Voice(), h = new Voice();
  const hit = (v, row, inst, vol) => v.onset(row, { note: 'C-5', instrument: inst, vol: `v${vol}` });
  bars.forEach((_, i) => {
    const o = i * BAR, fill = lastFill && i === bars.length - 1;
    if (style === 'half') {
      hit(k, o, I.kick, 46);
      if (i % 2 === 1) hit(k, o + 10, I.kick, 34);
      hit(s, o + 8, I.rim, 44);
      if (!fill) hit(s, o + 13, I.ghost, 12);
    } else {
      hit(k, o, I.kick, 54);
      if (i % 2 === 1) hit(k, o + 7, I.kick, 32);
      hit(k, o + 10, I.kick, 46);
      const back = style === 'rim' ? I.rim : I.snare, bv = style === 'rim' ? 46 : 40;
      hit(s, o + 4, back, bv);
      hit(s, o + 12, back, bv);
      if (style !== 'rim') hit(s, o + 7, I.ghost, 14);
      else if (i % 2 === 1) hit(s, o + 9, I.ghost, 12);
      if (!fill) hit(s, o + 15, I.ghost, 14);
    }
    if (fill) { hit(s, o + 13, I.ghost, 16); hit(s, o + 14, I.ghost, 20); hit(s, o + 15, I.ghost, 26); }
    for (let r = 0; r < BAR; r++) {
      const off8 = r % 4 === 2, beat = r % 4 === 0;
      if (style === 'half' && !shaker16(i)) { if (off8) hit(h, o + r, I.shaker, 12); continue; }
      if (r % 2 === 1 && !shaker16(i)) continue;
      hit(h, o + r, I.shaker, off8 ? 18 : beat ? 13 : 8);
    }
  });
  return [k.build(), s.build(), h.build()];
}

// --- Melody: [bar, row, note, len, vol, vib?]. The motif: a swung G-5 pickup,
// a held E-6, D-6 and a rest. The answer settles on C-6 over Cmaj9.
const VIB = 'H32';
function melody(events, inst, { carryLast = false } = {}) {
  const m = new Voice();
  events.forEach(([bar, row, note, len, vol, vib], i) =>
    m.note(bar * BAR + row, note, inst, len, vol, { vib: vib ? VIB : undefined, carry: carryLast && i === events.length - 1 }));
  return m.build();
}
const MOTIF = (bar) => [[bar, 3, 'G-5', 1, 30], [bar, 4, 'E-6', 7, 40, true], [bar, 11, 'D-6', 3, 34]];
const RISE = (bar) => [[bar, 3, 'A-5', 1, 30], [bar, 4, 'F-6', 7, 40, true], [bar, 11, 'E-6', 3, 34]];
const FILL = (bar) => [[bar, 6, 'C-6', 2, 28], [bar, 8, 'B-5', 2, 26], [bar, 10, 'G-5', 4, 30]];
const OPEN = (bar) => [[bar, 2, 'D-6', 2, 32], [bar, 4, 'B-5', 2, 30], [bar, 7, 'A-5', 7, 36, true]];

const SECTIONS = {
  A: {
    bars: [['Cmaj9'], ['Am9'], ['Dm11'], ['G13'], ['Cmaj9'], ['Am9'], ['Dm11', 'G13'], ['C69', 'G9sus']],
    next: ['Cmaj9'],
    lead: [...MOTIF(0), ...RISE(2), ...OPEN(3), ...MOTIF(4),
      [6, 3, 'A-5', 1, 30], [6, 4, 'F-6', 4, 38], [6, 8, 'E-6', 3, 34], [6, 11, 'D-6', 5, 34],
      [7, 0, 'C-6', 7, 40, true]],
    leadInst: I.vibes,
    keys: () => tines(compA(SECTIONS.A.bars, 2, [3, 5]), { guidesOnly: (r) => r < 4 * BAR, entryCut: true }),
    drums: (bars) => drums(bars, { style: 'rim', shaker16: (i) => i >= 4 }),
    bass: (bars, next) => bassLine(bars, next),
  },
  A2: {
    bars: [['Cmaj9'], ['Am11'], ['Dm11'], ['G13'], ['Em7'], ['A7b13'], ['Dm11'], ['G13']],
    next: ['Fmaj9'],
    lead: [...MOTIF(0), ...FILL(1), ...RISE(2), ...OPEN(3),
      [4, 3, 'B-5', 1, 30], [4, 4, 'G-6', 7, 42, true], [4, 11, 'E-6', 3, 34],
      [5, 4, 'F-6', 2, 32], [5, 6, 'E-6', 2, 30], [5, 8, 'C#6', 6, 36, true],
      [6, 3, 'A-5', 1, 30], [6, 4, 'F-6', 4, 38], [6, 8, 'E-6', 3, 34], [6, 11, 'D-6', 5, 34],
      [7, 0, 'B-5', 4, 32], [7, 4, 'A-5', 12, 36, true]],
    leadInst: I.vibes, carryLast: true, // the held A rings on, fading, as the 3rd of Fmaj9's downbeat
    keys: () => tines(compBusy(SECTIONS.A2.bars, [1, 3, 5])),
    drums: (bars) => drums(bars, { style: 'snare' }),
    bass: (bars, next) => bassLine(bars, next, { bounce: true }),
  },
  B: {
    bars: [['Fmaj9'], ['Fm6'], ['Em7low'], ['A7b13low'], ['Dm9low'], ['Fm6'], ['Em7low'], ['G13']],
    next: ['Cmaj9'],
    // A three-note cell in the back half of each bar answers the tines' downbeat:
    // up over the major chords, down onto the borrowed A-flat over Fm6.
    lead: [[0, 10, 'C-6', 1, 30], [0, 11, 'E-6', 1, 32], [0, 12, 'G-6', 4, 40],
      [1, 10, 'D-6', 1, 30], [1, 11, 'C-6', 1, 32], [1, 12, 'G#5', 4, 40],
      [2, 10, 'B-5', 1, 30], [2, 11, 'D-6', 1, 32], [2, 12, 'G-6', 4, 40],
      [3, 10, 'F-6', 1, 30], [3, 11, 'E-6', 1, 32], [3, 12, 'C#6', 4, 40],
      [4, 10, 'C-6', 1, 30], [4, 11, 'E-6', 1, 32], [4, 12, 'A-6', 4, 42],
      [5, 10, 'D-6', 1, 30], [5, 11, 'C-6', 1, 32], [5, 12, 'G#5', 4, 40],
      [6, 10, 'B-5', 1, 30], [6, 11, 'D-6', 1, 32], [6, 12, 'E-6', 4, 32],
      [7, 8, 'D-6', 2, 32], [7, 10, 'B-5', 1, 30], [7, 11, 'A-5', 3, 30]],
    leadInst: I.mallet,
    keys: () => tines(compHalf(SECTIONS.B.bars), { soft: true }),
    drums: (bars) => drums(bars, { style: 'half', shaker16: (i) => i >= 6 }),
    bass: (bars, next) => bassLine(bars, next, { halfTime: true }),
  },
  A3: {
    bars: [['Cmaj9'], ['Am11'], ['Dm11'], ['G13'], ['Cmaj9'], ['Am11'], ['Dm11', 'Fm6cad'], ['Cadd9', 'G9sus']],
    next: ['Cmaj9'],
    lead: [...MOTIF(0), ...FILL(1), ...RISE(2), ...OPEN(3), ...MOTIF(4), ...FILL(5),
      [6, 3, 'A-5', 1, 30], [6, 4, 'F-6', 4, 38], [6, 8, 'D-6', 8, 36, true],
      [7, 0, 'C-6', 10, 42, true]],
    leadInst: I.vibes,
    keys: () => tines(compBusy(SECTIONS.A3.bars, [1, 3])),
    drums: (bars) => drums(bars, { style: 'snare' }),
    bass: (bars, next) => bassLine(bars, next, { bounce: true, approach: { 6: 'C#3' } }),
  },
};

function section(key) {
  const s = SECTIONS[key];
  const [kick, snare, shaker] = s.drums(s.bars);
  const [t1, t2, t3] = s.keys();
  const chans = [kick, snare, shaker, s.bass(s.bars, s.next), t1, t2, t3,
    melody(s.lead, s.leadInst, { carryLast: s.carryLast })].map((c) => swing(c));
  // Split the 8-bar section into two 64-row patterns; stamp pan at each entry.
  return [0, 1].map((half) => chans.map((ch, c) => {
    const out = {};
    for (const [r, ev] of Object.entries(ch)) {
      const row = Number(r) - half * ROWS;
      if (row >= 0 && row < ROWS) out[row] = ev;
    }
    if (!out[0]?.fx) out[0] = { ...out[0], fx: PAN[c] };
    return out;
  }));
}

const order = ['A', 'A2', 'B', 'A3'];
const titles = { A: 'A', A2: "A'", B: 'B', A3: "A''" };
const patterns = order.flatMap((key) => section(key).map((channels, half) =>
  ({ name: `${titles[key]} bars ${half * 4 + 1}-${half * 4 + 4}`, rows: ROWS, channels })));

writeSong(import.meta.url, {
  title: 'Receipt in the Rain', bpm: 84, ticks: 6, mixvol: 60,
  message: 'Jazz-hop example: C major with borrowed F minor, 84 BPM, sixteenth swing SD1 (58%).\n' +
    'A / A\' / B / A\'\', 8 bars each. All samples synthesized. Source: songs/receipt_in_the_rain.gen.js.\n' +
    'See skills/jazz-hop/SKILL.md. Audition before treating this as a finished score.',
  samples: [
    { name: 'kick soft', synth: { preset: 'kick.soft' } },
    { name: 'rim', synth: { preset: 'rim' } },
    { name: 'snare', synth: { preset: 'snare.tight', tone: 188, snap: 0.3 } },
    // Ghost-note variant: less crack and noise. Sample mode has no velocity layers.
    { name: 'snare ghost', synth: { preset: 'snare.tight', tone: 170, snap: 0.08, noise: 0.55, noiseDecay: 30, seconds: 0.12 } },
    { name: 'shaker', synth: { preset: 'shaker' } },
    { name: 'bass round', synth: { preset: 'bass.round' } },
    { name: 'tine', synth: { preset: 'keys.tine' } },
    // B's darker tine: lower FM index, quieter tine ping.
    { name: 'tine soft', synth: { preset: 'keys.tine', index: 1.4, tine: 0.07 } },
    // Vibes-like mallet: a slower fundamental decay so the motif's held notes hold.
    // 3.8 s at C-5 is 2.26 s at A-5: long enough for A2's last A (held 2.14 s) to reach B instead of ending early
    { name: 'mallet vibes', synth: { preset: 'keys.mallet', seconds: 3.8, partials: [[1, 1, 1.1], [3.93, 0.2, 9], [9.2, 0.04, 28]] } },
    { name: 'mallet', synth: { preset: 'keys.mallet' } },
  ],
  channelnames: { 0: 'kick', 1: 'rim/snare', 2: 'shaker', 3: 'bass', 4: 'tine low', 5: 'tine mid', 6: 'tine high', 7: 'mallet' },
  patterns,
  order: patterns.map((_, i) => i),
});
