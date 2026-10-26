#!/usr/bin/env node
/**
 * "Siege Engine -> Night Bus" — two songs + a composed bridge in ONE module.
 * Run: node songs/siege_to_night.gen.js  →  songs/siege_to_night.json
 *
 * The bridge is the LLM-composed transition (this file IS the "generate a
 * bridge between combat music and exploration music" story):
 * - Harmony: Siege is E aeolian, Night Bus is A minor — E is the DOMINANT
 *   of A, so the bridge sits on an E pedal and resolves v -> i at arrival.
 * - Tempo: ramps 150 -> 140 -> 130 -> 120 (P1) then 116 -> 112 (P2) via Txx
 *   stamps; speed switches 4 -> 6 at P2 where Night Bus material takes over.
 * - Material: P1 dissolves Siege (drone fading, bass pulse thinning, sparse
 *   kick) and hands the E pedal to Night Bus's pluck bass — a timbral
 *   handoff. P2 resolves to Am: pluck groove lands on A, one warm Am7 keys
 *   swell (with its written death), offbeat hats fade in.
 * - Restraint rules apply: <=4 elements, every sustain ends, register bands.
 *
 * Usage from a game: music.transitionTo('nb:groove', { via: 'bridge' })
 */
import fs from "fs";
import { mergeSongs } from "../tools/merge.js";
import { writeSong } from "./lib.js";

const load = (f) => JSON.parse(fs.readFileSync(new URL(f, import.meta.url)));
const siege = load("./siege_engine.json");
const night = load("./night_bus.json");

const merged = mergeSongs(siege, night, {
  nameA: "siege",
  nameB: "nb",
  title: "Siege -> Night Bus",
  loop: "siege:explore",
  message: "Siege Engine + Night Bus + a composed bridge, in one adaptive\nmodule. transitionTo('nb:groove', {via:'bridge'}) walks combat into\nthe groove: E pedal (v of Am), tempo 150->112, timbral handoff.\nSource: songs/siege_to_night.gen.js",

  bridge: (ctx) => {
    const { hex2 } = ctx;
    // siege voices                       // night bus voices
    const iDrone = ctx.iA(4), iBassA = ctx.iA(3), iKick = ctx.iA(0);
    const iPluck = ctx.iB(3), iKeys = ctx.iB(4), iHat = ctx.iB(2);
    const cDrone = ctx.chA(4), cBassA = ctx.chA(3), cKick = ctx.chA(0);
    const cPluck = ctx.chB(2), cHat = ctx.chB(1);
    const cK = [ctx.chB(3), ctx.chB(4), ctx.chB(5)];
    const [cT, cS, cV] = ctx.ctrl;

    const blank = () => Array.from({ length: ctx.totalCh }, () => ({}));

    // --- P1 "dissolve": siege thins over an E pedal, clock falls 150->120
    const p1 = blank();
    p1[cT][0] = { fx: "T" + hex2(150) };
    p1[cT][16] = { fx: "T" + hex2(140) };
    p1[cT][32] = { fx: "T" + hex2(130) };
    p1[cT][48] = { fx: "T" + hex2(120) };
    p1[cS][0] = { fx: "A" + hex2(ctx.aTicks) };
    p1[cV][0] = { fx: "V" + hex2(ctx.gvA) };
    // war-horn drone: one last long breath, fading, ended
    p1[cDrone][0] = { note: "E-4", instrument: iDrone, vol: "v30" };
    for (const r of [8, 16, 24, 32, 40]) p1[cDrone][r] = { fx: "D01" };
    p1[cDrone][48] = { note: "^^" };
    // siege bass pulse thinning out (looped square — every hit choked/ended)
    [[0, "E-2", 40], [8, "E-2", 32], [16, "E-3", 26], [24, "E-2", 20], [32, "E-2", 14]].forEach(([r, n, v]) => {
      p1[cBassA][r] = { note: n, instrument: iBassA, vol: `v${v}` };
      p1[cBassA][r + 2] = { vol: "v08" };
    });
    p1[cBassA][36] = { note: "^^" };
    // sparse kick heartbeat, fading (one-shots)
    [[0, 50], [16, 36], [32, 24]].forEach(([r, v]) => { p1[cKick][r] = { note: "C-5", instrument: iKick, vol: `v${v}` }; });
    // timbral handoff: night's pluck takes the E pedal (self-decaying)
    [[40, "E-2", 40], [48, "E-2", 36], [56, "B-2", 30]].forEach(([r, n, v]) => {
      p1[cPluck][r] = { note: n, instrument: iPluck, vol: `v${v}` };
    });

    // --- P2 "arrival": resolve v -> i, night bus groove materializes
    const p2 = blank();
    p2[cT][0] = { fx: "T" + hex2(116) };
    p2[cT][32] = { fx: "T" + hex2(112) };
    p2[cS][0] = { fx: "A" + hex2(ctx.bTicks) };
    p2[cV][0] = { fx: "V" + hex2(ctx.gvB) };
    // dominant tail: pluck holds E, then RESOLVES to A at row 32
    [[0, "E-2", 44], [8, "E-2", 34], [16, "E-3", 28], [24, "B-2", 26],
     [32, "A-2", 50], [38, "A-2", 36], [42, "A-3", 32], [48, "A-2", 44], [54, "A-2", 34], [58, "A-3", 30]]
      .forEach(([r, n, v]) => { p2[cPluck][r] = { note: n, instrument: iPluck, vol: `v${v}` }; });
    // last breath of the drone (ended quickly)
    p2[cDrone][0] = { note: "E-4", instrument: iDrone, vol: "v16" };
    p2[cDrone][4] = { fx: "D01" };
    p2[cDrone][8] = { fx: "D01" };
    p2[cDrone][14] = { note: "^^" };
    // one warm Am7 swell at the resolution, with its written death
    [["C-5", 0], ["E-5", 1], ["G-5", 2]].forEach(([n, i]) => {
      p2[cK[i]][32] = { note: n, instrument: iKeys, vol: "v24" };
      p2[cK[i]][33] = { vol: `p${16 + i * 16}` };
      p2[cK[i]][44] = { fx: "D01" };
      p2[cK[i]][46] = { note: "^^" };
    });
    // offbeat hats fade in with the groove (one-shots)
    for (let r = 34; r < 64; r += 4) p2[cHat][r] = { note: "C-5", instrument: iHat, vol: `v${r < 48 ? 18 : 26}` };

    return { patterns: [
      { name: "bridge: dissolve", rows: 64, channels: p1 },
      { name: "bridge: arrival", rows: 64, channels: p2 },
    ] };
  },
});

writeSong(import.meta.url, merged);
