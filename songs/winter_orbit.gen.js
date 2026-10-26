#!/usr/bin/env node
/**
 * "Winter Orbit" — sparse ambient in the sleepy_snow.xm mold.
 * Run: node songs/winter_orbit.gen.js  →  songs/winter_orbit.json
 *
 * Adopted recipes (from the sleepy_snow study):
 * - slow clock + ring: speed 12 (~242ms/row), one event per 2-8 rows,
 *   long-decay bells that ring across empty rows — silence is the reverb
 * - one arpeggio split across 3 bell channels (anchor / ostinato / answer)
 *   so successive notes overlap into a chord
 * - channel echo cascade: each pad source has a partner channel repeating
 *   every note 2 rows later at low volume (a hard-wired delay line)
 * - shimmer-hold vibrato: pads enter with fast/shallow HA1, then H00 on
 *   every held row — motion without wobble
 * - phrase-length patterns (8/16/32/40 rows), a 4-row all-note-off
 *   "exhale" cell, symmetric bookends (intro cells = outro cells)
 * - signature gestures: hard-panned L/R semitone call-answer pair and a
 *   porta-down "sighing" pedal tone
 *
 * E aeolian (Em <-> D sway, C major bridge), 124 BPM, speed 12.
 */
import { nn, ns, up, rn, put, mel, echo, merge, writeSong } from "./lib.js";

const I = { bell: 0, bellLow: 1, pad: 2, flute: 3, epiano: 4 };

// channels:
// 0 bell anchor | 1 bell ostinato | 2 bell answer | 3 bell bass
// 4 sigh (porta-down pedal) | 5 pan-pair R | 6 pan-pair L
// 7 pad drone | 8 pad src A | 9 pad src B | 10 pad echo A | 11 pad echo B
const NCH = 12;
const blank = () => Array.from({ length: NCH }, () => ({}));

const patterns = [];
const P = (channels, rows, name) => { patterns.push({ name, rows, channels }); return patterns.length - 1; };

// bells: one arpeggio split across three channels so the notes ring together
function bellTrio(chs, notes, { rows = 32, vol = 40 } = {}) {
  const [anchor, osti, answer] = notes; // arrays of note names
  for (let r = 0; r < rows; r += 8) put(chs[0], r, { note: anchor[(r / 8) % anchor.length], instrument: I.bell, vol: `v${vol}` });
  for (let r = 2; r < rows; r += 4) put(chs[1], r, { note: osti[((r - 2) / 4) % osti.length], instrument: I.bell, vol: `v${vol - 8}` });
  for (let r = 4; r < rows; r += 8) put(chs[2], r, { note: answer[((r - 4) / 8) % answer.length], instrument: I.bell, vol: `v${vol - 4}` });
}
// bell bass double-taps at phrase starts
function bellBass(ch, roots, rows = 32) {
  roots.forEach((n, i) => {
    const r = i * 16;
    if (r + 8 >= rows) return;
    put(ch, r + 8, { note: n, instrument: I.bellLow, vol: "v34" });
    if (r + 9 < rows) put(ch, r + 9, { note: n, instrument: I.bellLow, vol: "v18" });
  });
}
// sighing pedal: a note that droops in pitch each time it sounds
function sigh(ch, note, rowsList) {
  for (const r of rowsList) {
    put(ch, r, { note, instrument: I.flute, vol: "v20", fx: "E04" });
    put(ch, r + 1, { fx: "E02" });
  }
}
// hard-panned semitone call/answer pair
function panPair(chs, [hi, lo], rowsList) {
  for (const r of rowsList) {
    put(chs[0], r, { note: hi, instrument: I.epiano, vol: "v24", fx: "XD8" });
    put(chs[1], r + 1, { note: lo, instrument: I.epiano, vol: "v24", fx: "X28" });
  }
}
// pad with shimmer-hold vibrato; its echo partner repeats 2 rows later at ~40%
function padPair(src, ech, events, { holdTo = 32 } = {}) {
  for (const [r, note, vol] of events) {
    put(src, r, { note, instrument: I.pad, vol: `v${vol}`, fx: "HA1" });
    for (let h = r + 1; h < holdTo && h < r + 14; h++) if (!src[h]) put(src, h, { fx: "H00" });
    put(ech, r + 2, { note, instrument: I.pad, vol: `v${Math.round(vol * 0.4)}` });
  }
}
// pad root drone in octaves
function padDrone(ch, roots, rows = 32) {
  roots.forEach((n, i) => {
    const r = i * 16;
    if (r >= rows) return;
    put(ch, r, { note: n, instrument: I.pad, vol: "v18", fx: "HA1" });
    for (let h = r + 1; h < Math.min(r + 14, rows); h++) put(ch, h, { fx: "H00" });
    put(ch, r + 6, { note: up(n, -12), instrument: I.pad, vol: "v14", fx: "HA1" });
  });
}

// --- P0/P1: 8-row bookend cells (single ringing arpeggio in a void) ----------
const cellEm = blank();
[["E-5", 0], ["B-5", 2], ["A-5", 4], ["B-5", 6]].forEach(([n, r], i) => put(cellEm[i % 3], r, { note: n, instrument: I.bell, vol: "v36" }));
const P0 = P(cellEm, 8, "cell Em");
const cellD = blank();
[["D-5", 0], ["A-5", 2], ["G-5", 4], ["A-5", 6]].forEach(([n, r], i) => put(cellD[i % 3], r, { note: n, instrument: I.bell, vol: "v34" }));
const P1 = P(cellD, 8, "cell D");

// --- P2: main A (32 rows) — bells only, pads withheld -------------------------
const A = blank();
bellTrio(A, [["E-5", "G-5", "D-5", "G-5"], ["B-5", "B-5", "A-5", "A-5"], ["G-5", "F#5"]]);
bellBass(A[3], ["E-3", "D-3"]);
sigh(A[4], "B-5", [12, 28]);
panPair([A[5], A[6]], ["C-6", "B-5"], [6, 22]);
const P2 = P(A, 32, "main A (bells)");

// --- P3: exhale (4 rows of release tails) --------------------------------------
const ex = blank();
for (const c of [7, 8, 9, 10, 11]) put(ex[c], 0, { note: "^^" });
const P3 = P(ex, 4, "exhale");

// --- P4: main B (32 rows) — pads enter, full texture ---------------------------
const B = blank();
bellTrio(B, [["E-5", "G-5", "D-5", "F#5"], ["B-5", "B-5", "A-5", "A-5"], ["G-5", "A-5"]], { vol: 38 });
bellBass(B[3], ["E-3", "D-3"]);
sigh(B[4], "B-5", [12, 28]);
panPair([B[5], B[6]], ["C-6", "B-5"], [6, 14, 22]);
padDrone(B[7], ["E-3", "D-3"]);
padPair(B[8], B[10], [[0, "G-5", 30], [16, "F#5", 28]]);
padPair(B[9], B[11], [[3, "B-5", 26], [19, "A-5", 26]]);
const P4 = P(B, 32, "main B (pads)");

// --- P5: bridge (40 rows) — C major, long scalar pad descent -------------------
const BR = blank();
put(BR[0], 0, { note: "C-5", instrument: I.bell, vol: "v38" });
put(BR[0], 16, { note: "C-5", instrument: I.bell, vol: "v32" });
put(BR[0], 32, { note: "B-4", instrument: I.bell, vol: "v34" });
bellBass(BR[3], ["C-3", "G-2", "E-3"], 40);
padDrone(BR[7], ["C-3", "G-2"], 40);
// descent: C6 B5 A5 G5 A5 F#5 E5 — echoed through the bell channels at v low
const DESC = [[0, "C-6", 30], [6, "B-5", 28], [12, "A-5", 28], [18, "G-5", 26], [24, "A-5", 26], [30, "F#5", 26], [36, "E-5", 30]];
padPair(BR[8], BR[10], DESC, { holdTo: 40 });
DESC.forEach(([r, n, v]) => put(BR[2], Math.min(39, r + 4), { note: n, instrument: I.bell, vol: `v${Math.round(v * 0.45)}` }));
sigh(BR[4], "G-5", [20, 36]);
const P5 = P(BR, 40, "bridge (C)");

// --- P6: winddown (8 rows) ------------------------------------------------------
const W = blank();
for (const c of [4, 7, 8, 9]) put(W[c], 0, { note: "^^" });
[["E-5", 1], ["B-5", 3], ["G-5", 5]].forEach(([n, r], i) => put(W[i % 3], r, { note: n, instrument: I.bell, vol: `v${26 - i * 6}` }));
put(W[3], 6, { note: "E-3", instrument: I.bellLow, vol: "v16" });
const P6 = P(W, 8, "winddown");

// --- assemble: symmetric arch — bookends open and close -------------------------
writeSong(import.meta.url, {
  title: "Winter Orbit",
  message: "Winter Orbit\n\nSparse ambient after Drozerix's 'Sleepy Snow': speed-12 clock,\nsplit-arpeggio bells, channel echo cascades, shimmer-hold vibrato,\nphrase-length patterns with exhale cells. E aeolian.\nSource: songs/winter_orbit.gen.js",
  bpm: 124,
  ticks: 12,
  mixvol: 64,
  samples: [
    { name: "music box", synth: { wave: "pluck", seconds: 2.2, decay: 2.2, volume: 44 } },
    { name: "music box low", synth: { wave: "pluck", seconds: 2.8, decay: 1.6, volume: 40 } },
    { name: "violin pad (akwf)", file: "library/samples/akwf/AKWF/AKWF_violin/AKWF_violin_0006.wav", loop: "cycle", volume: 22 },
    { name: "flute sigh (akwf)", file: "library/samples/akwf/AKWF/AKWF_flute/AKWF_flute_0003.wav", loop: "cycle", volume: 20 },
    { name: "epiano pair (akwf)", file: "library/samples/akwf/AKWF/AKWF_epiano/AKWF_epiano_0012.wav", loop: "cycle", volume: 22 },
  ],
  channelnames: {
    0: "bell", 1: "osti", 2: "answer", 3: "bass", 4: "sigh", 5: "pairR", 6: "pairL",
    7: "drone", 8: "padA", 9: "padB", 10: "echoA", 11: "echoB",
  },
  order: [P0, P0, P1, P1, P2, P3, P4, P4, P5, P3, P4, P2, P6, P0, P0, P1, P1],
  patterns,
});
