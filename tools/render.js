#!/usr/bin/env node
/**
 * render — render a module (.it/.xm/.mod/.s3m/…) to WAV via libopenmpt,
 * and print analysis stats so an agent can inspect its own output.
 *
 * Usage:
 *   node tools/render.js build/demo.it [out.wav] [--rate 48000] [--stats-only]
 *
 * Reuses the exact same libopenmpt WASM build the browser player uses,
 * so what you render is what you hear.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { parseArgs } from "node:util";
import libopenmptFactory from "../player/vendor/chiptune3/libopenmpt.worklet.js";

let options, positionals;
try {
  ({ values: options, positionals } = parseArgs({
    allowPositionals: true,
    options: { rate: { type: "string", default: "48000" }, "stats-only": { type: "boolean", default: false } },
  }));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
const [inFile, outArg] = positionals;
if (!inFile || positionals.length > 2) {
  console.error("Usage: node tools/render.js <module> [out.wav] [--rate 48000] [--stats-only]");
  process.exit(1);
}
const RATE = Number(options.rate);
if (!Number.isInteger(RATE) || RATE < 8000 || RATE > 192000) {
  console.error("--rate must be an integer from 8000 to 192000 Hz");
  process.exit(1);
}
const statsOnly = options["stats-only"];
if (statsOnly && outArg) {
  console.error("--stats-only writes no WAV; drop the output path or the flag");
  process.exit(1);
}

const lib = await libopenmptFactory();

const bytes = fs.readFileSync(inFile);
const filePtr = lib._malloc(bytes.length);
lib.HEAPU8.set(bytes, filePtr);
const mod = lib._openmpt_module_create_from_memory(filePtr, bytes.length, 0, 0, 0);
lib._free(filePtr);
if (!mod) {
  console.error("libopenmpt could not load", inFile);
  process.exit(1);
}
lib._openmpt_module_set_repeat_count(mod, 0); // play once

const CHUNK = 1024;
const leftPtr = lib._malloc(4 * CHUNK);
const rightPtr = lib._malloc(4 * CHUNK);
const left = [];
const right = [];
for (;;) {
  const n = lib._openmpt_module_read_float_stereo(mod, RATE, CHUNK, leftPtr, rightPtr);
  if (n === 0) break;
  left.push(lib.HEAPF32.slice(leftPtr / 4, leftPtr / 4 + n));
  right.push(lib.HEAPF32.slice(rightPtr / 4, rightPtr / 4 + n));
}

const frames = left.reduce((a, c) => a + c.length, 0);

// stats
let peak = 0, sumSq = 0, clipped = 0;
for (const bufs of [left, right]) {
  for (const buf of bufs) {
    for (let i = 0; i < buf.length; i++) {
      const v = Math.abs(buf[i]);
      if (v > peak) peak = v;
      if (v > 1) clipped++;
      sumSq += buf[i] * buf[i];
    }
  }
}
const rms = Math.sqrt(sumSq / (frames * 2));
const dur = frames / RATE;
console.log(`${inFile}: ${dur.toFixed(2)}s @ ${RATE}Hz, ${frames} frames`);
console.log(`peak ${peak.toFixed(3)} (${(20 * Math.log10(peak || 1e-9)).toFixed(1)} dBFS), rms ${rms.toFixed(4)} (${(20 * Math.log10(rms || 1e-9)).toFixed(1)} dBFS), clipped samples: ${clipped}`);
if (peak === 0) console.warn("WARNING: silence — something is wrong");
if (peak > 1) console.warn("WARNING: clipping — lower mixvol or sample volumes");

if (!statsOnly) {
  const outFile = outArg || path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "build", path.basename(inFile, path.extname(inFile)) + ".wav");
  // 16-bit PCM stereo WAV
  const data = Buffer.alloc(44 + frames * 4);
  data.write("RIFF", 0); data.writeUInt32LE(36 + frames * 4, 4); data.write("WAVE", 8);
  data.write("fmt ", 12); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22);
  data.writeUInt32LE(RATE, 24); data.writeUInt32LE(RATE * 4, 28); data.writeUInt16LE(4, 32); data.writeUInt16LE(16, 34);
  data.write("data", 36); data.writeUInt32LE(frames * 4, 40);
  let off = 44;
  const clamp = (v) => Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
  for (let b = 0; b < left.length; b++) {
    for (let i = 0; i < left[b].length; i++) {
      data.writeInt16LE(clamp(left[b][i]), off); off += 2;
      data.writeInt16LE(clamp(right[b][i]), off); off += 2;
    }
  }
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, data);
  console.log(`wrote ${outFile} (${(data.length / 1024 / 1024).toFixed(1)} MB)`);
}

lib._openmpt_module_destroy(mod);
lib._free(leftPtr);
lib._free(rightPtr);
