#!/usr/bin/env node
/**
 * Window Herbarium — condensation moving across a greenhouse window.
 * An original ambient study (skills/ambient/SKILL.md): A Lydian, 66 BPM, speed 12,
 * 2 rows/beat, 8 rows/bar, one row = 0.4545 s. Form A 6 / A' 6 / B 4 / A'' 8 bars
 * (48/48/32/64 rows, about 87 s), looping back to A.
 *
 * Channels: 0 low anchor (bass.round), 1-3 three voice-led pad tones (pad.warm),
 * 4-5 bells alternating so each tail rings under the next strike, 6 vowel colour
 * (pad.vowel), 7 mallet answering echoes and drips (keys.mallet).
 *
 * Phrase map (pads low/mid/high over the anchor; bells on top):
 *   A    Aadd9 (E B C#) -> A (E A C#) -> A6 (F# A C#)   motif A-5 E-6 B-5, then a settled C#6 ending
 *   A'   A6 held across the seam -> B/A (F# B D#)        motif, then C#6 -> D#6: the raised fourth arrives
 *   B    anchor F#, F#m7 (A C# + vowel E) -> anchor E, E (G# B)   mallet drips, no bell motif
 *   A''  Aadd9 -> B/A -> Amaj7 (E G# C#) -> Aadd9 fading   the answer finally lands on E-6
 * Loop: A'' ends on A's first voicing, faded to v00 and cut; its last bell (A-5)
 * rings across the seam until A's first A-5 re-strikes it.
 * Perceptual quality needs listening; this was verified by lint and renders only.
 */
import { writeSong } from './lib.js';

const S = { anchor: 0, pad: 1, bell: 2, vowel: 3, mallet: 4, wash: 5 };
const CH = 8;

// A lane is one channel of one pattern. set() merges fields and refuses to
// overwrite a different value, so a ramp can never silently eat a note or a cut.
function lanes(rows) {
  const make = () => {
    const ev = {};
    const lane = {
      ev,
      set(row, fields) {
        if (!Number.isInteger(row) || row < 0 || row >= rows) throw new Error(`row ${row} outside ${rows}-row pattern`);
        const cur = ev[row] ?? {};
        for (const [k, v] of Object.entries(fields))
          if (cur[k] !== undefined && cur[k] !== v) throw new Error(`collision at row ${row}: ${k} ${cur[k]} vs ${v}`);
        ev[row] = { ...cur, ...fields };
        return lane;
      },
      // Piecewise-linear volume through [[row, vol], ...], one stamp per row:
      // sample mode has no envelopes, so every swell and fade is written out.
      shape(points) {
        for (let i = 0; i < points.length; i++) {
          const [r0, v0] = points[i];
          lane.set(r0, { vol: `v${String(v0).padStart(2, '0')}` });
          if (i + 1 === points.length) break;
          const [r1, v1] = points[i + 1];
          for (let r = r0 + 1; r < r1; r++) {
            const v = Math.round(v0 + ((v1 - v0) * (r - r0)) / (r1 - r0));
            lane.set(r, { vol: `v${String(v).padStart(2, '0')}` });
          }
        }
        return lane;
      },
      // A sustained tone: attack row, volume path, optional fade-then-cut row.
      tone(row, note, sample, points, cut) {
        lane.set(row, { note, instrument: sample });
        lane.shape([[row, points[0][1]], ...points.slice(points[0][0] === row ? 1 : 0)]);
        if (cut !== undefined) lane.set(cut, { note: '^^' });
        return lane;
      },
      // A shot (bell, mallet, wash) rings by itself; no cut unless asked.
      hit(row, note, sample, vol) { return lane.set(row, { note, instrument: sample, vol: `v${vol}` }); },
      pan(row, x) { return lane.set(row, { fx: `X${x.toString(16).toUpperCase().padStart(2, '0')}` }); },
      cut(row) { return lane.set(row, { note: '^^' }); },
    };
    return lane;
  };
  return Array.from({ length: CH }, make);
}

// Breathing hold: a held pad that only sits at one level is the "endless ordinary
// loop" failure. Each voice drifts +-amount with its own period, so the three
// tones never swell in step.
function breathe(lane, from, to, level, period, amount = 2) {
  const pts = [], half = period / 2;
  for (let r = from, k = 0; r < to; r += half, k++) pts.push([r, k % 2 ? level + amount : level]);
  pts.push([to, level]); // always hand back at the held level
  lane.shape(pts);
}

// Home pans, re-stamped on every pattern's first row so each section is safe to enter.
const HOME = [0x80, 0x68, 0x98, 0x78, 0x40, 0xC0, 0x80, 0xA8];
function home(L) { L.forEach((lane, c) => lane.pan(0, HOME[c])); }

// Slow pan drift for the vowel colour: one X stamp every two rows.
function drift(lane, from, to, x0, x1) {
  for (let r = from; r <= to; r += 2) lane.pan(r, Math.round(x0 + ((x1 - x0) * (r - from)) / (to - from)));
}

const [ANCHOR, LOW, MID, HIGH, BELL_L, BELL_R, VOWEL, MALLET] = [0, 1, 2, 3, 4, 5, 6, 7];

// Answering echo: the same pitch on the mallet three rows (1.4 s) later, quieter,
// panned to the side opposite the bell it answers.
function answer(L, row, note, vol, from) {
  L[MALLET].hit(row, note, S.mallet, vol).pan(row, from === BELL_L ? 0xB0 : 0x50);
}

// The motif: three widely spaced bell strikes, the last one left to ring.
function motif(L, at, first, second) {
  L[first].hit(at + 2, 'A-5', S.bell, 36);
  L[second].hit(at + 5, 'E-6', S.bell, 30);
  L[first].hit(at + 10, 'B-5', S.bell, 34);
  answer(L, at + 13, 'B-5', 16, first);
}

// ---------------------------------------------------------------- A (48 rows)
function partA() {
  const L = lanes(48);
  home(L);
  L[ANCHOR].tone(0, 'A-3', S.anchor, [[0, 4], [6, 20]]);
  breathe(L[ANCHOR], 6, 47, 20, 16, 1);
  // Low E holds four bars, then steps up to F#, which is held into A'.
  L[LOW].tone(0, 'E-4', S.pad, [[0, 4], [4, 17]]);
  breathe(L[LOW], 4, 30, 17, 10);
  L[LOW].shape([[30, 17], [31, 14], [32, 8]]);
  L[LOW].tone(32, 'F#4', S.pad, [[32, 8], [36, 17]]);   // E -> F#: a dip, then the new tone swells
  breathe(L[LOW], 36, 47, 17, 10);
  // Mid voice walks down B -> A, one step per two bars.
  L[MID].tone(0, 'B-4', S.pad, [[0, 3], [6, 15]]);
  breathe(L[MID], 6, 12, 15, 6);
  L[MID].shape([[12, 15], [15, 6]]);
  L[MID].tone(16, 'A-4', S.pad, [[16, 6], [20, 15]]);
  breathe(L[MID], 20, 47, 15, 12);
  // High C# holds the whole section (and the next one).
  L[HIGH].tone(0, 'C#5', S.pad, [[0, 2], [8, 14]]);
  breathe(L[HIGH], 8, 47, 14, 14);

  motif(L, 0, BELL_L, BELL_R);
  // Second statement: same rhythm, a settled ending on C#6 (the third).
  L[BELL_R].hit(18, 'A-5', S.bell, 32);
  L[BELL_L].hit(21, 'E-6', S.bell, 28);
  L[BELL_R].hit(26, 'C#6', S.bell, 30);
  answer(L, 29, 'C#6', 15, BELL_R);
  // Space, then one question on the seventh.
  L[BELL_L].hit(38, 'G#5', S.bell, 24);
  return L;
}

// ---------------------------------------------------------------- A' (48 rows)
function partAprime() {
  const L = lanes(48);
  home(L);
  // Anchor, low F#, mid A and high C# continue from A without a retrigger.
  breathe(L[ANCHOR], 0, 32, 20, 16, 1);
  L[ANCHOR].shape([[32, 20], [46, 0]]).cut(47);        // the pedal leaves before B
  breathe(L[LOW], 0, 47, 17, 10);
  breathe(L[MID], 0, 13, 15, 12);
  L[MID].shape([[13, 15], [15, 6]]);
  L[MID].tone(16, 'B-4', S.pad, [[16, 6], [20, 15]]);
  breathe(L[MID], 20, 47, 15, 12);
  breathe(L[HIGH], 0, 17, 14, 14);
  L[HIGH].shape([[17, 14], [19, 6]]);
  // The raised fourth: the pad's D# swells in on the same row the bell strikes D#6.
  L[HIGH].tone(20, 'D#5', S.pad, [[20, 6], [24, 15]]);
  breathe(L[HIGH], 24, 47, 15, 14);

  motif(L, 0, BELL_R, BELL_L);
  L[BELL_L].hit(16, 'C#6', S.bell, 30);
  L[BELL_R].hit(20, 'D#6', S.bell, 38);
  answer(L, 23, 'D#6', 18, BELL_R);
  L[BELL_L].hit(36, 'B-5', S.bell, 26);
  L[BELL_R].hit(42, 'F#5', S.bell, 22);

  // Vowel colour arrives with the Lydian chord and drifts left to right.
  L[VOWEL].tone(18, 'F#5', S.vowel, [[18, 0], [26, 14], [32, 14], [40, 0]], 41);
  drift(L[VOWEL], 18, 40, 0x50, 0xB0);
  return L;
}

// ---------------------------------------------------------------- B (32 rows)
function partB() {
  const L = lanes(32);
  home(L);
  // A breath without the pedal, then a new low anchor: F# then E.
  L[ANCHOR].tone(4, 'F#3', S.anchor, [[4, 0], [10, 18]]);
  L[ANCHOR].shape([[10, 18], [13, 17], [15, 6]]);
  L[ANCHOR].tone(16, 'E-3', S.anchor, [[16, 6], [20, 18]]);
  L[ANCHOR].shape([[20, 18], [24, 18], [30, 0]]).cut(31);
  // Low F# doubled the new anchor: fade it out.
  L[LOW].shape([[0, 17], [6, 0]]).cut(7);
  // Low E enters at the end to prepare A'' (held across that boundary).
  L[LOW].tone(24, 'E-4', S.pad, [[24, 0], [31, 15]]);
  // Mid B -> A -> G#; high D# -> C# -> B, so B ends on an open E-B fifth.
  breathe(L[MID], 0, 5, 15, 12);
  L[MID].shape([[5, 15], [7, 6]]);
  L[MID].tone(8, 'A-4', S.pad, [[8, 6], [12, 14]]);
  L[MID].shape([[12, 14], [15, 6]]);
  L[MID].tone(16, 'G#4', S.pad, [[16, 6], [20, 14], [24, 14], [30, 0]], 31);
  L[HIGH].shape([[0, 15], [3, 6]]);
  L[HIGH].tone(4, 'C#5', S.pad, [[4, 6], [8, 14]]);
  breathe(L[HIGH], 8, 17, 14, 10);
  L[HIGH].shape([[17, 14], [19, 6]]);
  L[HIGH].tone(20, 'B-4', S.pad, [[20, 6], [24, 15]]);
  breathe(L[HIGH], 24, 31, 15, 8);
  // Vowel E on top, drifting back right to left.
  L[VOWEL].tone(4, 'E-5', S.vowel, [[4, 0], [11, 15], [20, 15], [30, 0]], 31);
  drift(L[VOWEL], 4, 30, 0xB0, 0x50);
  // A low, slow downwash where the bells used to be.
  L[BELL_L].hit(0, 'G-4', S.wash, 18);
  // Condensation drips: short mallet pairs at irregular distances (7, 6, 7 rows),
  // each one further across the glass from left to right.
  L[MALLET].hit(6, 'E-6', S.mallet, 24).pan(6, 0x48).hit(7, 'C#6', S.mallet, 17);
  L[MALLET].hit(13, 'A-5', S.mallet, 22).pan(13, 0x70);
  L[MALLET].hit(19, 'G#5', S.mallet, 22).pan(19, 0x98).hit(20, 'E-5', S.mallet, 15);
  L[MALLET].hit(26, 'B-5', S.mallet, 20).pan(26, 0xC0).hit(27, 'G#5', S.mallet, 14);
  L[BELL_R].hit(24, 'B-5', S.bell, 22);
  return L;
}

// ---------------------------------------------------------------- A'' (64 rows)
function partAfinal() {
  const L = lanes(64);
  home(L);
  L[ANCHOR].tone(0, 'A-3', S.anchor, [[0, 0], [8, 20]]);
  breathe(L[ANCHOR], 8, 52, 20, 16, 1);
  L[ANCHOR].shape([[52, 20], [62, 1]]).cut(63);
  // In A'' the high channel carries the middle tone and the mid channel the top:
  // B ended on LOW E-4 and HIGH B-4, so both are held across the boundary.
  // LOW: E (held) -> F# (Lydian) -> E -> fade.
  L[LOW].shape([[0, 15], [4, 17]]);
  breathe(L[LOW], 4, 13, 17, 10);
  L[LOW].shape([[13, 17], [15, 8]]);
  L[LOW].tone(16, 'F#4', S.pad, [[16, 8], [20, 17]]);
  breathe(L[LOW], 20, 29, 17, 10);
  L[LOW].shape([[29, 17], [31, 8]]);
  L[LOW].tone(32, 'E-4', S.pad, [[32, 8], [36, 17]]);
  breathe(L[LOW], 36, 54, 17, 10);
  L[LOW].shape([[54, 17], [62, 1]]).cut(63);
  // HIGH: B (held) through B/A -> G# (Amaj7) -> B, then fade.
  breathe(L[HIGH], 0, 29, 15, 12);
  L[HIGH].shape([[29, 15], [31, 6]]);
  L[HIGH].tone(32, 'G#4', S.pad, [[32, 6], [36, 15]]);
  breathe(L[HIGH], 36, 45, 15, 12);
  L[HIGH].shape([[45, 15], [47, 6]]);
  L[HIGH].tone(48, 'B-4', S.pad, [[48, 6], [52, 14], [55, 15], [62, 1]], 63);
  // MID: enters on C#, rises to D# with the bell, returns to C#, fades.
  L[MID].tone(4, 'C#5', S.pad, [[4, 0], [10, 14]]);
  breathe(L[MID], 10, 17, 14, 14);
  L[MID].shape([[17, 14], [19, 6]]);
  L[MID].tone(20, 'D#5', S.pad, [[20, 6], [24, 15]]);
  breathe(L[MID], 24, 29, 15, 14);
  L[MID].shape([[29, 15], [31, 6]]);
  L[MID].tone(32, 'C#5', S.pad, [[32, 6], [36, 14]]);
  breathe(L[MID], 36, 54, 14, 14);
  L[MID].shape([[54, 14], [62, 1]]).cut(63);

  motif(L, 0, BELL_L, BELL_R);
  L[BELL_R].hit(16, 'C#6', S.bell, 30);
  L[BELL_L].hit(20, 'D#6', S.bell, 36);
  answer(L, 23, 'D#6', 16, BELL_L);
  // The answer completes: E-6 on the downbeat where the pads return home.
  L[BELL_R].hit(32, 'E-6', S.bell, 36);
  answer(L, 35, 'E-6', 18, BELL_R);
  L[BELL_L].hit(40, 'C#6', S.bell, 26);
  L[BELL_R].hit(50, 'B-5', S.bell, 24);
  // Last strike: A-5 rings across the loop seam until A's first A-5 replaces it.
  L[BELL_L].hit(60, 'A-5', S.bell, 30);

  L[VOWEL].tone(18, 'F#5', S.vowel, [[18, 0], [28, 13], [36, 13], [46, 0]], 47);
  drift(L[VOWEL], 18, 46, 0xB0, 0x50);
  return L;
}

const pattern = (name, rows, L) => ({ name, rows, channels: L.map((l) => l.ev) });

writeSong(import.meta.url, {
  title: 'Window Herbarium', bpm: 66, ticks: 12, mixvol: 96,
  message: 'Original ambient study: A Lydian, 66 BPM, speed 12, A / A\' / B / A\'\'.\n' +
    'All sounds from the synthesized preset library. Source: songs/window_herbarium.gen.js.\n' +
    'Verified by lint and renders only; audition before treating it as finished.',
  samples: [
    { name: 'anchor', synth: { preset: 'bass.round' } },
    // Beating rate = note Hz x voice offset / periods. The draft's 120 periods beat
    // 2.6 Hz at D#5; 240 halves that to a slow swell (and became the preset default).
    { name: 'pad', synth: { preset: 'pad.warm', periods: 240 } },
    // Revision: the draft's bell (2.4 s at C-5, fundamental decaying 1.4/s) lasted
    // only 1.4 s at A-5 and 0.95 s at E-6, so the alternating channels never
    // overlapped and the seam went silent. Slower partial decay and a 7 s buffer
    // give 4.2 s at A-5 and 2.8 s at E-6; the 1 s release fades the buffer's end.
    { name: 'bell', synth: { preset: 'bell.clear', seconds: 7, release: 1,
      partials: [[1, 1, 0.55], [2, 0.5, 0.9], [3.01, 0.32, 1.4], [4.17, 0.18, 2], [5.43, 0.12, 2.8], [6.79, 0.06, 4]] } },
    // Five voices at offsets +-1 and +-2: at F#5, 120 periods beat 3.1 and 6.2 Hz,
    // a vibrato-speed warble; 360 periods bring that to 1.0 and 2.1 Hz.
    { name: 'vowel', synth: { preset: 'pad.vowel', periods: 360 } },
    { name: 'mallet', synth: { preset: 'keys.mallet' } },
    { name: 'downwash', synth: { preset: 'fx.downwash' } },
  ],
  channelnames: { 0: 'anchor', 1: 'pad low', 2: 'pad mid', 3: 'pad high', 4: 'bell L', 5: 'bell R', 6: 'vowel', 7: 'mallet' },
  patterns: [
    pattern('A - motif', 48, partA()),
    pattern("A' - the raised fourth", 48, partAprime()),
    pattern('B - drips, no pedal', 32, partB()),
    pattern("A'' - the answer lands", 64, partAfinal()),
  ],
  order: [0, 1, 2, 3],
});
