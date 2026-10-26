#!/usr/bin/env node
/**
 * "Night Bus" — laid-back groove, composed under the restraint rules
 * (from the this_is_how_we_do_it + silicon_dancer studies and Arda's feedback).
 * Run: node songs/night_bus.gen.js  →  songs/night_bus.json
 *
 * Rules applied:
 * - budget 4 elements: bass, ONE chord gesture, drums, hat. The lead only
 *   ever REPLACES the chords (swap, don't stack)
 * - every sustained note has a written death: chords are re-struck or ^^,
 *   lead notes end with ^^ within a few rows; bass is a self-decaying pluck
 * - register bands with buffer octaves: bass oct 2, chords oct 5 (spread by
 *   pan, not pitch), lead oct 6; percussion in between
 * - two chords only (Am7 -> Fmaj7, i -> bVI), 3+1 bars; melody uses chord
 *   tones + pentatonic so nothing fights the harmony
 * - repeats are verbatim (groove); variation = one added stab or a fill
 * - verification: lint, render, then audition sustained texture and loop seams
 *
 * A minor, 112 BPM, speed 6 (16 rows/bar, 64-row patterns, ~8.6s each).
 */
import { put, mel, writeSong } from "./lib.js";

const I = { kick: 0, snare: 1, hat: 2, bass: 3, keys: 4, flute: 5 };
const ROWS = 64;

// --- drums: two alternating bars, snare-roll fill at pattern end ------------
function drums({ fill = true } = {}) {
  const ch = {};
  for (let bar = 0; bar < 4; bar++) {
    const o = bar * 16;
    const kicks = bar % 2 === 0 ? [0, 6, 10] : [0, 6, 8, 14];
    for (const r of kicks) put(ch, o + r, { note: "C-5", instrument: I.kick, vol: "v56" });
    for (const r of [4, 12]) put(ch, o + r, { note: "C-5", instrument: I.snare, vol: "v42" });
  }
  if (fill) [60, 61, 62, 63].forEach((r, i) => put(ch, r, { note: "C-5", instrument: I.snare, vol: `v${8 + i * 8}` }));
  return ch;
}
function hats({ bars = [0, 1, 2, 3] } = {}) {
  const ch = {};
  for (const b of bars) for (let r = 0; r < 16; r += 2) {
    put(ch, b * 16 + r, { note: "C-5", instrument: I.hat, vol: r % 4 === 0 ? "v32" : "v20" });
  }
  return ch;
}
// --- bass: pluck one-shots (self-terminating), root groove with ghost echo --
// bars: 3x A, 1x F
function bass() {
  const ch = {};
  const roots = ["A-2", "A-2", "A-2", "F-2"];
  roots.forEach((root, bar) => {
    const o = bar * 16;
    const up = root[0] === "A" ? "A-3" : "F-3";
    put(ch, o, { note: root, instrument: I.bass, vol: "v52" });
    put(ch, o + 6, { note: root, instrument: I.bass, vol: "v40" });
    put(ch, o + 10, { note: up, instrument: I.bass, vol: "v36" });
    put(ch, o + 13, { note: root, instrument: I.bass, vol: "v18" }); // written ghost echo
  });
  return ch;
}
// --- ONE chord gesture: 3 notes in the oct-5 band, spread by pan ------------
// struck twice a bar, ends written: re-strike or ^^ before the bar turns
const VOICING = { A: [["C-5", "p10"], ["E-5", "p20"], ["G-5", "p30"]], F: [["C-5", "p10"], ["E-5", "p20"], ["A-5", "p30"]] };
function chords({ turnStab = false } = {}) {
  const chs = [{}, {}, {}];
  ["A", "A", "A", "F"].forEach((c, bar) => {
    const o = bar * 16;
    VOICING[c].forEach(([n, pan], i) => {
      put(chs[i], o, { note: n, instrument: I.keys, vol: "v30" });
      put(chs[i], o + 1, { vol: pan });
      put(chs[i], o + 8, { note: n, instrument: I.keys, vol: "v24" });
      put(chs[i], o + 14, { note: "^^" });
    });
    if (turnStab && bar === 3) VOICING.F.forEach(([n], i) => {
      put(chs[i], o + 12, { note: n, instrument: I.keys, vol: "v20" });
      // ^^ at o+14 above still closes it
    });
  });
  return chs;
}
// --- lead (replaces chords): short phrases, every note dies within 4 rows ---
// oct 6, A-minor pentatonic + chord tones
const LEAD = [
  [0, "E-6", 36], [3, "^^"], [4, "G-6", 34], [6, "^^"], [8, "A-6", 38], [12, "^^"],
  [20, "G-6", 34], [23, "^^"], [24, "E-6", 36], [28, "^^"],
  [32, "C-6", 34], [35, "^^"], [36, "D-6", 34], [39, "^^"], [40, "E-6", 38], [44, "^^"],
  [48, "A-5", 36], [52, "^^"], [54, "C-6", 32], [57, "^^"], [58, "E-6", 30], [61, "^^"],
];
const LEAD_B = [
  [0, "A-6", 36], [4, "^^"], [6, "G-6", 32], [9, "^^"], [12, "E-6", 34], [16, "^^"],
  [24, "D-6", 34], [27, "^^"], [28, "C-6", 32], [31, "^^"],
  [32, "E-6", 36], [36, "^^"], [40, "G-6", 34], [43, "^^"], [44, "A-6", 36], [48, "^^"],
  [52, "E-6", 32], [55, "^^"], [56, "C-6", 30], [60, "^^"],
];
// written echo: same line 1 row later (as in the corpus), quiet, own ends —
// 1-row delay means the echo's ^^ lands before/with the lead's next note
const echoOf = (events) => mel(events.map(([r, n, v]) => [r + 1, n, v ? Math.round(v * 0.45) : v]), { inst: I.flute });

// --- patterns ----------------------------------------------------------------
const patterns = [];
const P = (channels, name) => { patterns.push({ name, rows: ROWS, channels }); return patterns.length - 1; };

const P0 = P([drums(), hats(), bass(), {}, {}, {}], "groove (no chords)");
const [c1, c2, c3] = chords();
const P1 = P([drums(), hats(), bass(), c1, c2, c3], "groove + chords");
const P2 = P([drums(), hats(), bass(), mel(LEAD, { inst: I.flute }), echoOf(LEAD), {}], "lead (chords off)");
const [d1, d2, d3] = chords({ turnStab: true });
const P3 = P([drums(), hats(), bass(), d1, d2, d3], "chords + turn stab");
const P2b = P([drums(), hats(), bass(), mel(LEAD_B, { inst: I.flute }), echoOf(LEAD_B), {}], "lead B");

// breakdown: drums out, chords fading — bass + hats carry it
const [f1, f2, f3] = chords();
for (const ch of [f1, f2, f3]) {
  for (const r of Object.keys(ch)) {
    const ev = ch[r];
    if (ev.vol?.startsWith("v")) ev.vol = `v${Math.round(parseInt(ev.vol.slice(1)) * 0.6)}`;
  }
}
const P4 = P([{}, hats(), bass(), f1, f2, f3], "breakdown");

// outro: groove thins, hats fade out, one last chord that ends itself
const outroHats = hats({ bars: [0, 1] });
[32, 34, 36, 38].forEach((r, i) => put(outroHats, r, { note: "C-5", instrument: I.hat, vol: `v${16 - i * 4}` }));
const outroChord = [{}, {}, {}];
VOICING.A.forEach(([n, pan], i) => {
  put(outroChord[i], 0, { note: n, instrument: I.keys, vol: "v26" });
  put(outroChord[i], 1, { vol: pan });
  for (let r = 8; r <= 24; r += 8) put(outroChord[i], r, { fx: "D01" });
  put(outroChord[i], 30, { note: "^^" });
});
const outroBass = {};
put(outroBass, 0, { note: "A-2", instrument: I.bass, vol: "v48" });
put(outroBass, 16, { note: "A-2", instrument: I.bass, vol: "v30" });
put(outroBass, 32, { note: "A-1", instrument: I.bass, vol: "v22" });
const P5 = P([{ 0: { note: "C-5", instrument: I.kick, vol: "v50" } }, outroHats, outroBass, ...outroChord], "outro");

// --- assemble ------------------------------------------------------------------
writeSong(import.meta.url, {
  title: "Night Bus",
  message: "Night Bus\n\nLaid-back groove. Composed under restraint rules:\nmax 4 elements, swap don't stack, every note's end written,\none chord gesture, register bands. Written cuts in sample mode.\nSource: songs/night_bus.gen.js",
  bpm: 112,
  ticks: 6,
  mixvol: 64,
  samples: [
    { name: "909 kick (saga)", file: "library/samples/sagamusix/bass_drums/Clicky 909 BD.wav" },
    { name: "short snare (saga)", file: "library/samples/sagamusix/drums/short snare.wav", volume: 44 },
    { name: "hat closed (saga)", file: "library/samples/sagamusix/drums/Hi-Hat Closed.wav", volume: 32 },
    { name: "pluck bass", synth: { wave: "pluck", seconds: 1.4, decay: 3.2, volume: 46 } },
    { name: "epiano keys (akwf)", file: "library/samples/akwf/AKWF/AKWF_epiano/AKWF_epiano_0042.wav", loop: "cycle", volume: 26 },
    { name: "flute lead (akwf)", file: "library/samples/akwf/AKWF/AKWF_flute/AKWF_flute_0011.wav", loop: "cycle", volume: 30 },
  ],
  channelnames: { 0: "drums", 1: "hat", 2: "bass", 3: "keys1", 4: "keys2", 5: "keys3" },
  order: [P0, P1, P1, P2, P2, P3, P3, P2b, P2b, P4, P1, P3, P5],
  patterns,
  // adaptive manifest — emitted as build/night_bus.cozy.json by json2it
  adaptive: {
    layers: [
      { name: "bass", channels: [2], above: 0 },
      { name: "hat", channels: [1], above: 0.3 },
      { name: "drums", channels: [0], above: 0.5 },
      { name: "keys", channels: [3, 4, 5], above: 0.7 },
    ],
    sections: {
      intro: [0, 0],
      groove: [1, 2],
      lead: [3, 4],
      full: [5, 6],
      leadB: [7, 8],
      breakdown: [9, 9],
      outro: [12, 12],
    },
    loop: "groove",
  },
});
