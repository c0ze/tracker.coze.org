#!/usr/bin/env node
/**
 * render — render a module (.it/.xm/.mod/.s3m/…) to WAV via libopenmpt,
 * and print analysis stats so an agent can inspect its own output.
 *
 * Usage:
 *   node tools/render.js build/demo.it [out.wav] [--rate 48000] [--stats-only]
 *                        [--solo 0,3 | --mute 2]
 *
 * --solo / --mute take zero-based channel numbers (as in the song JSON) and
 * silence the other / those channels, for stem checks: balance, swing onsets,
 * a lead against the pads. The module's mix and timing are otherwise unchanged.
 *
 * Reuses the exact same libopenmpt WASM build the browser player uses
 * (through tools/render-core.js), so what you render is what you hear.
 * A render stops after 30 minutes of audio.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseArgs } from "node:util";
import { renderModule, RenderError } from "./render-core.js";

const MAX_SECONDS = 30 * 60; // a render stops after half an hour of audio

let options, positionals;
try {
  ({ values: options, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      rate: { type: "string", default: "48000" }, "stats-only": { type: "boolean", default: false },
      solo: { type: "string" }, mute: { type: "string" },
    },
  }));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
const [inFile, outArg] = positionals;
if (!inFile || positionals.length > 2) {
  console.error("Usage: node tools/render.js <module> [out.wav] [--rate 48000] [--stats-only] [--solo 0,3 | --mute 2]");
  process.exit(1);
}
const RATE = Number(options.rate);
if (!Number.isInteger(RATE) || RATE < 8000 || RATE > 192000) {
  console.error("--rate must be an integer from 8000 to 192000 Hz");
  process.exit(1);
}
const statsOnly = options["stats-only"];
if (options.solo !== undefined && options.mute !== undefined) {
  console.error("Give --solo or --mute, not both");
  process.exit(1);
}
const channelList = (text, flag) => {
  const fields = text.split(",").map((c) => c.trim()), list = fields.map(Number);
  if (!fields.every((c) => /^\d+$/.test(c)) || !list.every((c) => c < 64)) {
    console.error(`${flag} takes zero-based channel numbers, e.g. ${flag} 0,3`);
    process.exit(1);
  }
  return new Set(list);
};
const solo = options.solo === undefined ? null : channelList(options.solo, "--solo");
const muted = options.mute === undefined ? null : channelList(options.mute, "--mute");
const outFile = outArg || path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "build", path.basename(inFile, path.extname(inFile)) + ".wav");
if (!statsOnly && path.resolve(outFile) === path.resolve(inFile)) {
  console.error(`refusing to overwrite the input: ${inFile}`);
  process.exit(1);
}
if (statsOnly && outArg) {
  console.error("--stats-only writes no WAV; drop the output path or the flag");
  process.exit(1);
}

let result;
try {
  result = await renderModule(new Uint8Array(fs.readFileSync(inFile)), { rate: RATE, maxFrames: MAX_SECONDS * RATE, solo, mute: muted });
} catch (error) {
  if (!(error instanceof RenderError)) throw error;
  console.error(error.code === "load" ? `libopenmpt could not load ${inFile}` : `${inFile}: ${error.message}`);
  process.exit(1);
}
const { left, right, frames, truncated, stats: { peak, rms, clipped } } = result;

const dur = frames / RATE;
const only = solo ? ` (solo ${[...solo].join(",")})` : muted ? ` (muted ${[...muted].join(",")})` : "";
console.log(`${inFile}${only}: ${dur.toFixed(2)}s @ ${RATE}Hz, ${frames} frames`);
console.log(`peak ${peak.toFixed(3)} (${(20 * Math.log10(peak || 1e-9)).toFixed(1)} dBFS), rms ${rms.toFixed(4)} (${(20 * Math.log10(rms || 1e-9)).toFixed(1)} dBFS), clipped samples: ${clipped}`);
if (peak === 0) console.warn("WARNING: silence — something is wrong");
if (peak > 1) console.warn("WARNING: clipping — lower mixvol or sample volumes");
if (truncated) console.warn(`WARNING: stopped after ${MAX_SECONDS / 60} minutes; the module plays on`);

if (!statsOnly) {
  // 16-bit PCM stereo WAV
  const data = Buffer.alloc(44 + frames * 4);
  data.write("RIFF", 0); data.writeUInt32LE(36 + frames * 4, 4); data.write("WAVE", 8);
  data.write("fmt ", 12); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22);
  data.writeUInt32LE(RATE, 24); data.writeUInt32LE(RATE * 4, 28); data.writeUInt16LE(4, 32); data.writeUInt16LE(16, 34);
  data.write("data", 36); data.writeUInt32LE(frames * 4, 40);
  let off = 44;
  const clamp = (v) => Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
  for (let i = 0; i < frames; i++) {
    data.writeInt16LE(clamp(left[i]), off); off += 2;
    data.writeInt16LE(clamp(right[i]), off); off += 2;
  }
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, data);
  console.log(`wrote ${outFile} (${(data.length / 1024 / 1024).toFixed(1)} MB)`);
}
