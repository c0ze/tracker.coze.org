#!/usr/bin/env node
/**
 * "First Light" v2 — generates songs/first_light.json (run: node songs/first_light.gen.js).
 *
 * A minor → B minor, 132 BPM, speed 6 (4 rows/beat, 64-row patterns = 4 bars).
 * v2: motif-based hook melody, detuned dual-lead (±4 cents), pad stacked in
 * fifths, dedicated build pattern, key change climax, ~110s arrangement.
 *
 * Channels: kick snare hat bass lead lead2 echo arp pad pad5
 * Structure: intro → A → A'(echo) → B → break → A → A'(echo) → build →
 *            climax Bm → peak Bm (counter-melody) → break → build →
 *            climax Bm → peak Bm → outro
 */

import fs from "fs";
import { echo as echoPhrase } from "./lib.js";

// --- note helpers ---------------------------------------------------------
const NAMES = ["C-", "C#", "D-", "D#", "E-", "F-", "F#", "G-", "G#", "A-", "A#", "B-"];
const nn = (s) => NAMES.indexOf(s.slice(0, 2)) + 12 * parseInt(s[2]); // "A-2"/"F#4" -> semitones
const ns = (n) => NAMES[n % 12] + Math.floor(n / 12);                 // 33 -> "A-2"
const up = (s, semi) => ns(nn(s) + semi);
const rn = (root, oct) => root.length === 2 ? root + oct : root + "-" + oct; // "F#",4 -> "F#4"; "A",4 -> "A-4"

// chords: [root, arpeggio fx] — J37 minor, J47 major
const CH = {
  Am: ["A", "J37"], F: ["F", "J47"], C: ["C", "J47"], G: ["G", "J47"],
  Dm: ["D", "J37"], E: ["E", "J47"], "F#": ["F#", "J47"],
  Bm: ["B", "J37"], D: ["D", "J47"], A: ["A", "J47"],
};

// instrument indices (0-based)
const I = { kick: 0, snare: 1, hatC: 2, hatO: 3, bass: 4, lead: 5, lead2: 6, arp: 7, pad: 8 };

// --- channel builders (each returns {row: event} for one 64-row pattern) --
const put = (ch, row, ev) => { ch[row] = ev; };

function drumsKick(bars = [0, 1, 2, 3]) {
  const ch = {};
  for (const b of bars) for (const r of [0, 4, 8, 12]) put(ch, b * 16 + r, { note: "C-5", instrument: I.kick, vol: "v64" });
  return ch;
}
function drumsSnare(bars = [0, 1, 2, 3], { roll = false } = {}) {
  const ch = {};
  for (const b of bars) for (const r of [4, 12]) put(ch, b * 16 + r, { note: "C-5", instrument: I.snare, vol: "v50" });
  if (roll) [56, 58, 60, 61, 62, 63].forEach((r, i) => put(ch, r, { note: "C-5", instrument: I.snare, vol: `v${26 + i * 7}` }));
  return ch;
}
function drumsHat(bars = [0, 1, 2, 3], { open = false, dense = false } = {}) {
  const ch = {};
  for (const b of bars) {
    if (dense) for (let r = 0; r < 16; r += 2) put(ch, b * 16 + r, { note: "C-5", instrument: I.hatC, vol: r % 4 === 0 ? "v38" : "v24" });
    else for (const r of [2, 6, 10, 14]) put(ch, b * 16 + r, { note: "C-5", instrument: I.hatC, vol: r === 2 ? "v38" : "v26" });
    if (open) put(ch, b * 16 + 14, { note: "C-5", instrument: I.hatO, vol: "v30" });
  }
  return ch;
}
function bass(chords, { sparse = false } = {}) {
  const ch = {};
  chords.forEach((name, b) => {
    const root = nn(rn(CH[name][0], 2));
    const next = nn(rn(CH[chords[(b + 1) % chords.length]][0], 2));
    const o = b * 16;
    if (sparse) {
      put(ch, o, { note: ns(root), instrument: I.bass, vol: "v44" });
      put(ch, o + 8, { note: ns(root + 12), instrument: I.bass, vol: "v32" });
      put(ch, o + 14, { note: "^^" });
      return;
    }
    const line = [[0, 0, 50], [2, 0, 34], [4, 12, 42], [6, 0, 38], [8, 0, 46], [10, 12, 38], [12, 0, 42]];
    for (const [r, t, v] of line) put(ch, o + r, { note: ns(root + t), instrument: I.bass, vol: `v${v}` });
    const walk = next > root ? next - 1 : next + 1;
    put(ch, o + 14, { note: ns(walk === root ? root + 7 : walk), instrument: I.bass, vol: "v40" });
  });
  return ch;
}
// chip chord: note + J effect repeated on sustained rows
function arp(chords, { oct = 4, vols = [32, 28] } = {}) {
  const ch = {};
  chords.forEach((name, b) => {
    const [root, fx] = CH[name];
    for (const [start, vol] of [[0, vols[0]], [8, vols[1]]]) {
      const o = b * 16 + start;
      put(ch, o, { note: rn(root, oct), instrument: I.arp, vol: `v${vol}`, fx });
      for (let r = 1; r < 6; r++) put(ch, o + r, { fx });
      put(ch, o + 6, { note: "^^" });
    }
  });
  return ch;
}
// pad root; pad5 = same a fifth up, panned opposite for width
function pad(chords, { oct = 3, vol = 24, semi = 0, inst = I.pad, fadeFrom = null } = {}) {
  const ch = {};
  chords.forEach((name, b) => {
    put(ch, b * 16, { note: up(rn(CH[name][0], oct), semi), instrument: inst, vol: `v${vol}` });
    if (fadeFrom !== null) for (let r = fadeFrom; r < 16; r += 4) put(ch, b * 16 + r, { fx: "D01" });
  });
  return ch;
}
const pad5 = (chords, o = {}) => pad(chords, { ...o, semi: 7, vol: o.vol ?? 18 });

// melody: [row, note, vol?, fx?]; transposable, scalable
function mel(events, { semi = 0, inst = I.lead, scale = 1 } = {}) {
  const ch = {};
  for (const [r, note, vol, fx] of events) {
    if (r > 63) continue;
    if (note === "==" || note === "^^") { put(ch, r, { note }); continue; }
    const ev = { note: up(note, semi), instrument: inst, vol: `v${Math.round(vol * scale)}` };
    if (fx) ev.fx = fx;
    put(ch, r, ev);
  }
  return ch;
}
const echo = (events, { delay = 3, scale = 0.5, semi = 0, inst = I.lead } = {}) =>
  echoPhrase(events, { delay, scale, semi, inst });

// --- the music -------------------------------------------------------------
const KEY_A = ["Am", "F", "C", "G"];
const KEY_B = ["Dm", "F", "E", "E"];
const KEY_C = ["Bm", "G", "D", "A"];   // climax key: up a whole step
const BUILD = ["Am", "Am", "F#", "F#"]; // F# major = V of Bm

// hook: short-short-LEAP motif in bars 1 & 3, answered in bars 2 & 4
const HOOK = [
  [0, "A-5", 48], [2, "^^"], [4, "A-5", 44], [6, "C-6", 46], [10, "E-6", 48, "H21"], [14, "^^"],
  [16, "D-6", 44], [18, "C-6", 40], [20, "A-5", 42], [24, "F-5", 44, "H21"], [30, "^^"],
  [32, "G-5", 44], [34, "^^"], [36, "G-5", 42], [38, "C-6", 44], [42, "E-6", 46, "H21"], [46, "^^"],
  [48, "D-6", 44], [50, "B-5", 40], [52, "G-5", 40], [54, "A-5", 42], [56, "B-5", 44, "H21"], [62, "^^"],
];
const MELODY_B = [
  [0, "D-5", 46], [4, "F-5", 42], [8, "E-5", 40], [10, "D-5", 38], [12, "^^"],
  [16, "F-5", 44, "H21"], [22, "^^"], [24, "A-5", 42], [28, "G-5", 40], [30, "^^"],
  [32, "G#5", 44], [36, "B-5", 42], [40, "E-5", 44, "H21"], [46, "^^"],
  [48, "G#5", 42], [52, "B-5", 44], [56, "D-6", 46, "H31"], [62, "^^"],
];
const FRAGMENT = [
  [0, "E-6", 36, "H21"], [8, "^^"], [16, "C-6", 34], [24, "^^"],
  [32, "B-5", 34], [40, "^^"], [48, "A-5", 36, "H21"], [60, "^^"],
];
// counter-melody: long weaving notes under the peak lead
const COUNTER = [
  [0, "C-5", 34], [6, "^^"], [8, "E-5", 34], [14, "^^"],
  [16, "D-5", 34], [24, "C-5", 32], [30, "^^"],
  [32, "E-5", 34], [40, "G-5", 36], [46, "^^"],
  [48, "D-5", 34], [56, "B-4", 32], [62, "^^"],
];
// build: rising line over the F# dominant
const RISE = [
  [0, "E-6", 34, "H21"], [12, "^^"],
  [32, "F#5", 40], [38, "^^"], [40, "A#5", 42], [46, "^^"],
  [48, "C#6", 44], [54, "^^"], [56, "E-6", 46, "H21"], [63, "^^"],
];

const patterns = [];
const P = (channels, name) => { patterns.push({ name, rows: 64, channels }); return patterns.length - 1; };
const dual = (events, o = {}) => [mel(events, { ...o, inst: I.lead }), mel(events, { ...o, inst: I.lead2, scale: (o.scale ?? 1) * 0.85 })];

// P0 intro
const introKick = {};
[48, 52, 56, 60].forEach((r, i) => put(introKick, r, { note: "C-5", instrument: I.kick, vol: `v${44 + i * 6}` }));
const intro = [introKick, {}, drumsHat([2, 3]), bass(KEY_A, { sparse: true }), {}, {}, {},
  arp(KEY_A, { vols: [24, 20] }), pad(KEY_A), pad5(KEY_A)];
// pan the stage once (vol col p on free cells; pads via fx X since row 0 has notes)
intro[2][0] = { vol: "p42" };   // hat
intro[4][0] = { vol: "p22" };   // lead left
intro[5][0] = { vol: "p42" };   // lead2 right (detuned pair spread)
intro[6][0] = { vol: "p12" };   // echo/counter far left
intro[7][7] = { vol: "p50" };   // arp right
intro[8][0].fx = "X60";         // pad left-ish
intro[9][0].fx = "XA0";         // pad5 right-ish
const P0 = P(intro, "intro");

const [leadA, lead2A] = dual(HOOK);
const P1 = P([drumsKick(), drumsSnare(), drumsHat(), bass(KEY_A), leadA, lead2A, {}, arp(KEY_A), pad(KEY_A), pad5(KEY_A)], "theme A");
const P2 = P([drumsKick(), drumsSnare(), drumsHat([0, 1, 2, 3], { open: true }), bass(KEY_A), leadA, lead2A,
  echo(HOOK), arp(KEY_A), pad(KEY_A), pad5(KEY_A)], "theme A + echo");
const [leadB, lead2B] = dual(MELODY_B);
const P3 = P([drumsKick(), drumsSnare([0, 1, 2, 3], { roll: true }), drumsHat(), bass(KEY_B), leadB, lead2B,
  {}, arp(KEY_B), pad(KEY_B), pad5(KEY_B)], "B section");
const P4 = P([{}, {}, drumsHat(), bass(["Am", "Am", "F", "E"], { sparse: true }), mel(FRAGMENT), {},
  echo(FRAGMENT, { delay: 4, scale: 0.45 }), arp(["Am", "Am", "F", "E"], { vols: [22, 18] }),
  pad(["Am", "Am", "F", "E"]), pad5(["Am", "Am", "F", "E"])], "break");
// build: drums thin out then roll, bass climbs, rising dual lead
const buildBass = bass(BUILD);
[56, 58, 60, 62].forEach((r, i) => put(buildBass, r, { note: i % 2 ? "F#3" : "F#2", instrument: I.bass, vol: `v${40 + i * 3}` }));
const [riseL, riseL2] = dual(RISE);
const P5 = P([drumsKick([0, 1]), drumsSnare([0, 1], { roll: true }), drumsHat([2, 3], { dense: true }), buildBass,
  riseL, riseL2, {}, arp(BUILD, { vols: [28, 30] }), pad(BUILD), pad5(BUILD)], "build");
// climax in Bm (+2)
const [leadC, lead2C] = dual(HOOK, { semi: 2 });
const P6 = P([drumsKick(), drumsSnare(), drumsHat([0, 1, 2, 3], { open: true }), bass(KEY_C), leadC, lead2C,
  echo(HOOK, { semi: 2 }), arp(KEY_C), pad(KEY_C), pad5(KEY_C)], "climax Bm");
// peak: lead up an octave + counter-melody, everything on
const [peakL, peakL2] = dual(HOOK, { semi: 14 });
const P7 = P([drumsKick(), drumsSnare(), drumsHat([0, 1, 2, 3], { open: true, dense: true }), bass(KEY_C), peakL, peakL2,
  mel(COUNTER, { semi: 2, inst: I.lead2 }), arp(KEY_C, { oct: 5 }), pad(KEY_C, { oct: 4 }), pad5(KEY_C, { oct: 4 })], "peak Bm");
// outro on Bm
const outroLead = mel([[0, "F#5", 40], [4, "D-5", 38], [8, "C#5", 36], [12, "B-4", 42, "H21"]]);
for (let r = 20; r <= 44; r += 4) outroLead[r] = { fx: "D01" };
outroLead[48] = { note: "^^" };
const outroBass = { 0: { note: "B-2", instrument: I.bass, vol: "v44" }, 16: { note: "B-1", instrument: I.bass, vol: "v38" } };
for (let r = 32; r <= 56; r += 8) outroBass[r] = { fx: "D01" };
const P8 = P([{}, {}, drumsHat([0, 1]), outroBass, outroLead, {},
  {}, arp(["Bm", "Bm"], { vols: [20, 16] }), pad(["Bm", "Bm", "Bm", "Bm"], { fadeFrom: 32 }),
  pad5(["Bm", "Bm", "Bm", "Bm"], { fadeFrom: 32 })], "outro");

// --- assemble --------------------------------------------------------------
const song = {
  title: "First Light",
  message: "First Light (v2)\n\nComposed by Claude via the mod-music pipeline.\nAKWF single-cycle waveforms (PD) + Saga Musix drums.\nA minor -> B minor, 132 BPM. songs/first_light.gen.js is the source.",
  bpm: 132,
  ticks: 6,
  mixvol: 58,
  samples: [
    { name: "909 kick (saga)", file: "library/samples/sagamusix/bass_drums/Clicky 909 BD.wav" },
    { name: "analog snare (saga)", file: "library/samples/sagamusix/drums/Analog Snare.wav", volume: 44 },
    { name: "hat closed (saga)", file: "library/samples/sagamusix/drums/Hi-Hat Closed.wav", volume: 34 },
    { name: "hat open (saga)", file: "library/samples/sagamusix/drums/Hi-Hat Open.wav", volume: 30 },
    { name: "saw bass (akwf)", file: "library/samples/akwf/AKWF/AKWF_bw_saw/AKWF_saw_0006.wav", loop: "cycle", volume: 38 },
    { name: "violin lead L (akwf)", file: "library/samples/akwf/AKWF/AKWF_violin/AKWF_violin_0001.wav", loop: "cycle", volume: 30, detune: -4 },
    { name: "violin lead R (akwf)", file: "library/samples/akwf/AKWF/AKWF_violin/AKWF_violin_0001.wav", loop: "cycle", volume: 30, detune: 4 },
    { name: "epiano arp (akwf)", file: "library/samples/akwf/AKWF/AKWF_epiano/AKWF_epiano_0042.wav", loop: "cycle", volume: 28 },
    { name: "eorgan pad (akwf)", file: "library/samples/akwf/AKWF/AKWF_eorgan/AKWF_eorgan_0001.wav", loop: "cycle", volume: 20 },
  ],
  channelnames: { 0: "kick", 1: "snare", 2: "hat", 3: "bass", 4: "lead", 5: "lead2", 6: "echo", 7: "arp", 8: "pad", 9: "pad5" },
  order: [P0, P1, P2, P3, P4, P1, P2, P3, P5, P6, P7, P4, P5, P6, P7, P8],
  patterns,
};

fs.writeFileSync(new URL("./first_light.json", import.meta.url), JSON.stringify(song, null, 1));
console.log(`first_light.json: ${patterns.length} patterns, order [${song.order}] (${song.order.length} entries)`);
