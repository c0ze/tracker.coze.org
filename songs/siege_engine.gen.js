#!/usr/bin/env node
/**
 * "Siege Engine" — aggressive driving chip in the war_path.xm mold.
 * Run: node songs/siege_engine.gen.js  →  songs/siege_engine.json
 *
 * Adopted recipes (from the war_path study):
 * - choked octave-pulse bass: hit every 2 rows, v10 vol-stamp choke after
 * - ghost-accent snare march: every even row, v-accents outline the kick
 * - war-horn drone: one sustained root pedal with volume swells, all song
 * - one-chord harmony: Em pedal with a bVII (D) turnaround in the last bar
 *   of most patterns, snapping back at the pattern seam
 * - 8-row riff loop with loud/ghost 16th pairs; J37 pump pad in theme A
 * - two-channel canon echo for wailing porta leads and cascade runs
 * - layer-additive build with a dropout breath; strip-and-rebuild breaks
 *
 * E aeolian, 150 BPM, speed 4 (rows are 16ths, ~4.3s/pattern).
 */
import { nn, ns, up, rn, put, mel, echo, merge, writeSong } from "./lib.js";

const I = { kick: 0, snare: 1, hat: 2, bass: 3, drone: 4, riff: 5, lead: 6, stab: 7, noise: 8 };
const ROWS = 64;

// --- drums -------------------------------------------------------------------
// theme A kit: syncopated kick 0/6/14, paired snares in the gaps, hats between
function drumsA() {
  const kh = {}, sn = {};
  for (const o of [0, 32]) {
    for (const r of [0, 6, 14, 16]) put(kh, o + r, { note: "C-5", instrument: I.kick, vol: "v60" });
    for (const r of [8, 18, 24, 28, 30]) put(kh, o + r, { note: "C-5", instrument: I.hat, vol: "v30" });
    for (const r of [2, 4, 10, 12, 20, 22, 26]) put(sn, o + r, { note: "C-5", instrument: I.snare, vol: r % 8 === 2 ? "v44" : "v30" });
  }
  return [kh, sn];
}
// theme B kit: machine-gun snare march (every even row, accent vs ghost)
function drumsB() {
  const kh = {}, sn = {};
  for (const o of [0, 32]) {
    for (const r of [0, 4, 6, 14, 20, 22]) put(kh, o + r, { note: "C-5", instrument: I.kick, vol: "v60" });
    for (const r of [8, 18, 24, 28, 30]) put(kh, o + r, { note: "C-5", instrument: I.hat, vol: "v28" });
    for (let r = 0; r < 32; r += 2) put(sn, o + r, { note: "C-5", instrument: I.snare, vol: [0, 8, 18, 24, 28, 30].includes(r) ? "v46" : "v24" });
  }
  return [kh, sn];
}

// --- bass / drone / riff -------------------------------------------------------
// choked octave pulse; last bar drops to bVII (D) unless told not to
function bass({ turnaround = true, thin = false } = {}) {
  const ch = {};
  const oct = [0, 0, 12, 0, 12, 12, 0, 12];
  for (let r = 0; r < ROWS; r += 2) {
    if (thin && (r % 16) >= 8) continue;
    const root = turnaround && r >= 52 ? "D-2" : "E-2";
    put(ch, r, { note: up(root, oct[(r / 2) % 8]), instrument: I.bass, vol: "v46" });
    if (r + 1 < ROWS) put(ch, r + 1, { vol: "v10" }); // choke
  }
  return ch;
}
function drone({ turnaround = true } = {}) {
  const ch = {};
  for (const o of [0, 16, 32, 48]) {
    const n = turnaround && o >= 48 ? "D-4" : "E-4";
    put(ch, o, { note: n, instrument: I.drone, vol: "v16" });
    put(ch, o + 2, { vol: "v26" });
    put(ch, o + 5, { vol: "v34" }); // swell in
  }
  return ch;
}
// 8-row riff loop: octave leap then stepwise descent, loud/ghost pairs
const RIFF_NOTES = ["E-5", "E-6", "B-5", "A-5", "G-5", "F#5", "D-5", "F#5"];
const RIFF_VOLS = [44, 18, 38, 18, 34, 18, 30, 18];
function riff() {
  const ch = {};
  for (let r = 0; r < ROWS; r++) {
    put(ch, r, { note: RIFF_NOTES[r % 8], instrument: I.riff, vol: `v${RIFF_VOLS[r % 8]}` });
  }
  return ch;
}
// theme-A chord bed: sustained root with J37 buzz + stepped volume pump
function pumpPad({ turnaround = true } = {}) {
  const ch = {};
  for (const o of [0, 16, 32, 48]) {
    put(ch, o, { note: turnaround && o >= 48 ? "D-5" : "E-5", instrument: I.riff, vol: "v38", fx: "J37" });
    for (let r = 1; r < 16; r++) {
      const ev = { fx: "J37" };
      if (r % 2 === 0) ev.vol = `v${[38, 28, 18, 28][Math.floor(r / 2) % 4]}`;
      put(ch, o + r, ev);
    }
  }
  return ch;
}
// stabs: short cut chord hits on the offbeats
function stabs({ vols = [40, 40, 40, 40] } = {}) {
  const ch = {};
  [0, 1, 2, 3].forEach((bar) => {
    for (const r of [4, 12]) {
      put(ch, bar * 16 + r, { note: r === 4 ? "E-4" : "G-4", instrument: I.stab, vol: `v${vols[bar]}`, fx: "J37" });
      put(ch, bar * 16 + r + 2, { note: "^^" });
    }
  });
  return ch;
}

// --- leads --------------------------------------------------------------------
const WAIL = [ // long siren notes joined by tone porta, deep vibrato
  [0, "E-6", 46, "H42"], [14, undefined], [16, "G-6", 44, "G0C"], [24, "F#6", 42, "G08"],
  [32, "B-5", 44, "G0C"], [40, "D-6", 44, "G08"], [48, "E-6", 46, "G0C"], [56, "F#6", 40, "H42"], [62, "^^"],
].filter((e) => e[1] !== undefined);
const WAIL_PEAK = [
  [0, "G-6", 46, "H42"], [16, "B-6", 46, "G0C"], [28, "A-6", 42, "G08"],
  [32, "E-6", 44, "G0C"], [40, "G-6", 44, "G08"], [48, "E-7", 48, "G10"], [60, "^^"],
];
// climax counterpoint: descending step+neighbor chains every 2 rows
function chains() {
  const seq = ["E-6", "B-5", "A-5", "B-5", "A-5", "G-5", "F#5", "G-5", "F#5", "E-5", "D-5", "E-5", "D-5", "B-4", "A-4", "B-4"];
  const ev = [];
  for (let i = 0; i < 32; i++) ev.push([i * 2, seq[i % 16], 40 - (i % 4) * 6]);
  return ev;
}
// finale: two-octave cascade landing on a held root
const FINALE = (() => {
  const scale = ["E-6", "D-6", "B-5", "A-5", "G-5", "F#5", "E-5", "D-5", "B-4", "A-4", "G-4", "F#4"];
  const ev = scale.map((n, i) => [i * 4, n, 44 - i * 2]);
  ev.push([48, "E-4", 40, "H31"], [63, "^^"]);
  return ev;
})();

// --- patterns -------------------------------------------------------------------
const patterns = [];
const P = (channels, name) => { patterns.push({ name, rows: ROWS, channels }); return patterns.length - 1; };
const [khA, snA] = drumsA();
const [khB, snB] = drumsB();

// P0 intro: drums + drone, pickup run in the last 8 rows
const pickup = mel([[56, "E-6", 36], [57, "B-5", 32], [58, "A-5", 34], [59, "G-5", 30], [60, "F#5", 32], [61, "E-5", 28], [62, "D-5", 30], [63, "E-5", 34]], { inst: I.lead });
const P0 = P([khA, snA, {}, {}, drone({ turnaround: false }), {}, pickup, {}, {}], "intro: drums+drone");
const P1 = P([khA, snA, {}, bass(), drone(), {}, {}, {}, {}], "+bass");
const P2 = P([{}, {}, {}, { 0: { note: "E-2", instrument: I.bass, vol: "v40" }, 32: { note: "E-1", instrument: I.bass, vol: "v30" } },
  drone({ turnaround: false }), {}, {}, {}, {}], "breath");
const P3 = P([khA, snA, {}, bass(), drone(), riff(), {}, {}, {}], "+riff");
const P4 = P([khA, snA, {}, bass(), drone(), riff(), {}, stabs({ vols: [8, 16, 26, 36] }), {}], "stabs fade in");
const P5 = P([khA, snA, {}, bass(), drone(), pumpPad(), {}, stabs(), {}], "theme A: pump pad");

// P6 breakdown: strip bass, noise sweep falls, pad fades, walk to D
const sweep = { 0: { note: "C-6", instrument: I.noise, vol: "v26" } };
for (let r = 1; r < 24; r++) put(sweep, r, { fx: r === 1 ? "E08" : "E00" });
const fadePad = pumpPad({ turnaround: false });
for (let r = 32; r < 64; r += 4) fadePad[r] = { ...(fadePad[r] || {}), vol: undefined, fx: "D01" };
const walk = { 48: { note: "E-2", instrument: I.bass, vol: "v36" }, 52: { note: "F#2", instrument: I.bass, vol: "v34" }, 56: { note: "G-2", instrument: I.bass, vol: "v36" }, 60: { note: "D-2", instrument: I.bass, vol: "v40" } };
const P6 = P([{ 0: { note: "C-5", instrument: I.kick, vol: "v50" } }, {}, sweep, walk, drone(), fadePad, {}, {}, {}], "breakdown");

// P7 rebuild: snare march alone, then kick+bass join halfway
const snHalf = {}, khHalf = {}, bassHalf = {};
for (let r = 0; r < 64; r += 2) put(snHalf, r, { note: "C-5", instrument: I.snare, vol: r % 8 === 0 ? "v42" : "v22" });
for (const r of [32, 38, 46, 48, 52, 60]) put(khHalf, r, { note: "C-5", instrument: I.kick, vol: "v56" });
const bassFull = bass({ turnaround: false });
for (let r = 0; r < 32; r++) delete bassFull[r];
const P7 = P([khHalf, snHalf, {}, bassFull, drone({ turnaround: false }), {}, {}, {}, {}], "march rebuild");

const P8 = P([khB, snB, {}, bass(), drone(), riff(), mel(WAIL, { inst: I.lead }), {}, echo(WAIL, { delay: 3, scale: 0.5, inst: I.lead })], "theme B: wail");
const P9 = P([khB, snB, {}, bass(), drone(), riff(), mel(WAIL_PEAK, { inst: I.lead }), stabs(), echo(WAIL_PEAK, { delay: 3, scale: 0.5, inst: I.lead })], "theme B peak");
const P10 = P([khA, snA, {}, bass(), drone(), pumpPad(), mel(chains(), { inst: I.lead }), stabs(), echo(chains(), { delay: 2, scale: 0.5, inst: I.lead })], "climax: chains");

// P11 finale: cascade in canon, hats close it out
const hatsOut = {};
for (const r of [48, 52, 56, 58, 60, 61, 62, 63]) put(hatsOut, r, { note: "C-5", instrument: I.hat, vol: `v${34 - Math.floor((r - 48) / 4) * 4}` });
const P11 = P([{ 0: { note: "C-5", instrument: I.kick, vol: "v60" } }, {}, hatsOut,
  { 0: { note: "E-2", instrument: I.bass, vol: "v44" }, 32: { note: "E-1", instrument: I.bass, vol: "v36" } },
  drone({ turnaround: false }), {}, mel(FINALE, { inst: I.lead }), {}, echo(FINALE, { delay: 2, scale: 0.5, inst: I.lead })], "finale cascade");

// --- assemble ---------------------------------------------------------------------
writeSong(import.meta.url, {
  title: "Siege Engine",
  message: "Siege Engine\n\nAggressive driver after Drozerix's 'War Path': choked octave\nbass, ghost-accent snare march, war-horn drone, i->bVII turnarounds,\ncanon-echo leads. E aeolian, 150 BPM, speed 4.\nSource: songs/siege_engine.gen.js",
  bpm: 150,
  ticks: 4,
  mixvol: 54,
  samples: [
    { name: "909 kick (saga)", file: "library/samples/sagamusix/bass_drums/Clicky 909 BD.wav" },
    { name: "analog snare (saga)", file: "library/samples/sagamusix/drums/Analog Snare.wav", volume: 40 },
    { name: "hat closed (saga)", file: "library/samples/sagamusix/drums/Hi-Hat Closed.wav", volume: 30 },
    { name: "growl bass", synth: { wave: "square", pulse: 0.25, volume: 40 } },
    { name: "war horn (akwf sax)", file: "library/samples/akwf/AKWF/AKWF_altosax/AKWF_altosax_0004.wav", loop: "cycle", volume: 30 },
    { name: "riff square", synth: { wave: "square", pulse: 0.5, volume: 30 } },
    { name: "siren saw (akwf)", file: "library/samples/akwf/AKWF/AKWF_bw_saw/AKWF_saw_0002.wav", loop: "cycle", volume: 32 },
    { name: "stab", synth: { wave: "square", pulse: 0.125, volume: 38 } },
    { name: "noise", synth: { wave: "noise", seconds: 1.2, decay: 3, volume: 30 } },
  ],
  channelnames: { 0: "kick/hat", 1: "snare", 2: "fx", 3: "bass", 4: "drone", 5: "riff", 6: "lead", 7: "stabs", 8: "canon" },
  order: [P0, P1, P1, P2, P3, P3, P4, P5, P5, P6, P7, P8, P8, P9, P9, P6, P10, P10, P5, P5, P11],
  patterns,
  // adaptive manifest — emitted as build/siege_engine.cozy.json by json2it.
  // layers: ordered by intensity; a layer sounds while intensity >= above.
  // sections: [firstOrder, lastOrder] ranges in the order list above.
  adaptive: {
    layers: [
      { name: "core", channels: [3, 4], above: 0 },        // bass + drone
      { name: "riff", channels: [5], above: 0.25 },
      { name: "drums", channels: [0, 1, 2], above: 0.45 },
      { name: "stabs", channels: [7], above: 0.65 },
      { name: "lead", channels: [6, 8], above: 0.8 },      // wail + canon
    ],
    sections: {
      intro: [0, 2],
      explore: [7, 8],    // theme A pump
      bridge: [9, 9],     // breakdown — natural transition material
      combat: [11, 14],   // theme B march + peak
      boss: [16, 17],     // climax chains
      finale: [20, 20],
    },
    loop: "explore",
  },
});
