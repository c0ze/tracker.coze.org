#!/usr/bin/env node
/**
 * "Paper Hearts" — melodic chip-pop in the her_kiss.xm mold.
 * Run: node songs/paper_hearts.gen.js  →  songs/paper_hearts.json
 *
 * Adopted recipes (from the her_kiss study):
 * - NO drum kit: bass-as-drums octave bounce on a D pedal, backbeat accented
 *   by a brighter instrument swap, every-2-rows accent roll as the fill
 * - liquid-harp channel: a chord tone on EVERY row, GFF instant porta after
 *   phrase starts, pan column walking across the stereo field
 * - chord-carrying melody: each lead note gets the J-arpeggio for its triad,
 *   inverted so the melody note stays on top; held notes get a v-pulse
 * - chorus-first form; repeats are re-orchestrations (arps → porta lead)
 * - harmony drifts i–VII–v over a bass that never leaves D
 *
 * D aeolian, 128 BPM, speed 3 (fast rows: bar = 16 rows, ~3.7s/pattern).
 */
import { nn, ns, up, rn, put, mel, echo, merge, writeSong } from "./lib.js";

const I = { bass: 0, accent: 1, lead: 2, harp: 3, pad: 4, ghost: 5 };
const ROWS = 64;

// chords: [root, harp tones (semis from root), pad arp fx]
const CHORDS = {
  Dm: ["D", [0, 3, 7], "J37"],
  C: ["C", [0, 4, 7], "J47"],
  Am: ["A", [0, 4, 7], "J37"], // A minor: 0,3,7 — fixed below
  F: ["F", [0, 4, 7], "J47"],
};
CHORDS.Am[1] = [0, 3, 7];

// --- channel builders (bar = 16 rows) --------------------------------------
// bass-as-drums: D pedal octave bounce, accent instrument on the backbeat
function bass({ fill = true } = {}) {
  const ch = {};
  for (let b = 0; b < 4; b++) {
    const o = b * 16;
    const hits = [[0, "D-2", I.bass, 48], [4, "D-3", I.bass, 40], [6, "D-2", I.bass, 36],
      [8, "D-3", I.accent, 44], [10, "D-2", I.bass, 36], [12, "D-2", I.bass, 40], [14, "D-3", I.bass, 38]];
    for (const [r, n, inst, v] of hits) put(ch, o + r, { note: n, instrument: inst, vol: `v${v}` });
  }
  if (fill) for (let r = 56; r <= 62; r += 2) put(ch, r, { note: r % 4 ? "D-3" : "D-2", instrument: I.accent, vol: `v${30 + (r - 56)}` });
  return ch;
}
// liquid harp: chord tone every row, GFF glides, pan walks p24→p38 and back
function harp(bars, { vol } = {}) {
  const ch = {};
  bars.forEach((name, b) => {
    const [root, tones] = CHORDS[name];
    const base = nn(rn(root, 5));
    for (let r = 0; r < 16; r++) {
      const t = tones[[0, 1, 2, 0, 2, 1, 1, 2][r % 8]] + (r % 8 >= 6 ? 12 : 0);
      const ev = { note: ns(base + t), instrument: I.harp, vol: `p${24 + (r % 8) * 2}` };
      if (r % 16 !== 0) ev.fx = "GFF";
      put(ch, b * 16 + r, ev);
    }
  });
  return ch;
}
// pad: sustained root arp chord + hard-panned ghost heartbeat (rows 8/10)
function pad(bars, { vol = 20, ghosts = true } = {}) {
  const ch = {};
  bars.forEach((name, b) => {
    const [root, , fx] = CHORDS[name];
    put(ch, b * 16, { note: rn(root, 4), instrument: I.pad, vol: `v${vol}`, fx });
    for (let r = 1; r < 6; r++) put(ch, b * 16 + r, { fx });
    if (ghosts) {
      put(ch, b * 16 + 8, { note: "D-4", instrument: I.ghost, vol: "v12", fx: "X10" });
      put(ch, b * 16 + 10, { note: "D-5", instrument: I.ghost, vol: "v10", fx: "XE0" });
    }
  });
  return ch;
}
// v-pulse on held chord-melody notes: alternate quiet/loud vol stamps
function addPulse(ch, rows = ROWS) {
  let active = false, arp = null;
  for (let r = 0; r < rows; r++) {
    const ev = ch[r];
    if (ev?.note) {
      active = ev.note !== "==" && ev.note !== "^^";
      arp = active && ev.fx?.startsWith("J") ? ev.fx : null;
    }
    if (!active) continue;
    if (arp && !ch[r]?.fx) ch[r] = { ...ch[r], fx: arp };
    if (r % 2 === 0 && !ch[r]?.vol) ch[r] = { ...ch[r], vol: r % 4 === 0 ? "v34" : "v10" };
  }
  return ch;
}

// --- melodies (chord-carrying: J-arp inversions keep melody on top) --------
const CHORUS = [ // bars: Dm Dm C Am
  [0, "D-6", 44, "J37"], [12, "A-5", 40, "J58"],
  [16, "F-6", 44, "J49"], [26, "A-5", 40, "J58"],
  [32, "E-6", 44, "J38"], [40, "G-5", 38, "J59"], [44, "C-6", 42, "J47"],
  [48, "C-6", 44, "J49"], [56, "A-5", 42, "J37"], [62, "^^"],
];
const VERSE = [ // bars: Dm C Dm Am — sparser, lower register
  [0, "F-5", 38, "J49"], [8, "E-5", 34], [12, "D-5", 36, "J37"],
  [16, "E-5", 38, "J38"], [28, "G-5", 34, "J59"],
  [32, "F-5", 38, "J49"], [40, "A-5", 36, "J58"], [44, "G-5", 32],
  [48, "E-5", 38, "J58"], [56, "C-5", 34, "J49"], [62, "^^"],
];
// theme = chorus re-orchestrated: portamento glides + vibrato, no arps
const THEME = CHORUS.map(([r, n, v], i) => [r, n, v, i === 0 ? "H21" : (n === "^^" ? undefined : "G18")]);

const CHORUS_BARS = ["Dm", "Dm", "C", "Am"];
const VERSE_BARS = ["Dm", "C", "Dm", "Am"];

// --- patterns ---------------------------------------------------------------
const patterns = [];
const P = (channels, name) => { patterns.push({ name, rows: ROWS, channels }); return patterns.length - 1; };

// P0 intro: rising cascade fading in over the harp alone
const introLead = {};
["D-4", "F-4", "A-4", "D-5", "F-5", "A-5", "D-6", "F-6"].forEach((n, i) => {
  put(introLead, 32 + i * 4, { note: n, instrument: I.lead, vol: `v${8 + i * 5}` });
});
put(introLead, 63, { note: "^^" });
const P0 = P([{}, introLead, {}, harp(CHORUS_BARS), pad(CHORUS_BARS, { ghosts: false, vol: 14 }), {}], "intro");

const P1 = P([bass({ fill: false }), addPulse(mel(CHORUS, { inst: I.lead, scale: 0.72 })), {},
  harp(CHORUS_BARS), pad(CHORUS_BARS, { vol: 14 }), {}], "chorus (quiet)");
const P2 = P([bass(), addPulse(mel(VERSE, { inst: I.lead })), echo(VERSE, { delay: 4, scale: 0.55, inst: I.lead }),
  harp(VERSE_BARS), pad(VERSE_BARS), {}], "verse");

// P3 build: staccato cascade + riser into the next section
const buildLead = mel([[0, "D-5", 36, "J37"], [8, "^^" ]], { inst: I.lead });
["D-5", "A-5", "D-6", "F-6", "A-6", "D-7"].forEach((n, i) => {
  put(buildLead, 40 + i * 2, { note: n, instrument: I.lead, vol: `v${28 + i * 4}`, fx: "SC2" });
});
put(buildLead, 56, { note: "A-6", instrument: I.lead, vol: "v40" });
[58, 60, 62].forEach((r) => put(buildLead, r, { fx: "F30" })); // porta-up riser
const P3 = P([bass(), buildLead, {}, harp(CHORUS_BARS), pad(CHORUS_BARS), {}], "build");

const P4 = P([bass(), addPulse(mel(THEME, { inst: I.lead })), echo(THEME, { delay: 4, scale: 0.6, inst: I.lead }),
  harp(CHORUS_BARS), pad(CHORUS_BARS), {}], "theme (porta)");

// P5 chorus full + panned counter-arp answering at bar ends
const counter = {};
for (const bar of [0, 1, 2]) {
  const notes = ["D-6", "A-5", "F-5"];
  [12, 13, 14].forEach((r, i) => put(counter, bar * 16 + r, { note: notes[i], instrument: I.harp, vol: `v${26 - i * 6}`, fx: i % 2 ? "X30" : "XC0" }));
}
const P5 = P([bass(), addPulse(mel(CHORUS, { inst: I.lead })), echo(CHORUS, { delay: 4, scale: 0.6, inst: I.lead }),
  harp(CHORUS_BARS), pad(CHORUS_BARS), counter], "chorus");

// P6 bridge: calm — long low notes, fading drone, heartbeat only
const bridgeLead = mel([[0, "A-4", 34, "H21"], [16, "C-5", 32], [32, "D-5", 34, "H21"], [48, "E-5", 30], [60, "^^"]], { inst: I.lead });
const bridgeDrone = { 0: { note: "D-3", instrument: I.pad, vol: "v22" } };
for (let r = 16; r < 64; r += 8) put(bridgeDrone, r, { fx: "D01" });
const P6 = P([{}, bridgeLead, echo([[0, "A-4", 34], [16, "C-5", 32], [32, "D-5", 34], [48, "E-5", 30]], { delay: 6, scale: 0.5, inst: I.lead }),
  {}, merge(bridgeDrone, pad(["Dm", "Dm", "Dm", "Dm"], { vol: 0, ghosts: true })), {}], "bridge");

// P7 final chorus with a global-volume fade
const fade = {};
for (let r = 8; r < 64; r += 6) put(fade, r, { fx: "W02" });
const P7 = P([bass({ fill: false }), addPulse(mel(CHORUS, { inst: I.lead, scale: 0.9 })), echo(CHORUS, { delay: 4, scale: 0.55, inst: I.lead }),
  harp(CHORUS_BARS), pad(CHORUS_BARS), fade], "chorus (fade out)");

// --- assemble ----------------------------------------------------------------
writeSong(import.meta.url, {
  title: "Paper Hearts",
  message: "Paper Hearts\n\nMelodic chip-pop after Drozerix's 'Her Kiss': no drums,\nbass-as-drums D pedal, liquid harp, chord-carrying melody.\nD aeolian, 128 BPM, speed 3. Source: songs/paper_hearts.gen.js",
  bpm: 128,
  ticks: 3,
  mixvol: 60,
  samples: [
    { name: "round bass", synth: { wave: "square", pulse: 0.5, volume: 40 } },
    { name: "bright accent", synth: { wave: "square", pulse: 0.25, volume: 44 } },
    { name: "piano lead (akwf)", file: "library/samples/akwf/AKWF/AKWF_piano/AKWF_piano_0001.wav", loop: "cycle", volume: 34 },
    { name: "harp (akwf aguitar)", file: "library/samples/akwf/AKWF/AKWF_aguitar/AKWF_aguitar_0001.wav", loop: "cycle", volume: 22 },
    { name: "organ pad (akwf)", file: "library/samples/akwf/AKWF/AKWF_eorgan/AKWF_eorgan_0004.wav", loop: "cycle", volume: 20 },
    { name: "ghost sine", synth: { wave: "sine", volume: 30 } },
  ],
  channelnames: { 0: "bass", 1: "lead", 2: "echo", 3: "harp", 4: "pad", 5: "counter" },
  order: [P0, P1, P1, P2, P2, P3, P4, P4, P5, P5, P2, P3, P4, P6, P6, P5, P5, P7, P7],
  patterns,
});
