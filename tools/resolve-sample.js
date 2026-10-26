/**
 * Turn a song JSON sample definition into an itwriter-ready sample
 * ({ name, samplerate, channels, loop?, c5speed?, volume? }). Shared by
 * json2it.js and json2mod.js so both formats get the same synthesized PCM.
 *
 *   { "name": "bass", "synth": { "wave": "square", "pulse": 0.25 } }
 *   { "name": "flute", "file": "library/samples/akwf/AKWF_0001.wav", "loop": "cycle" }
 *   { "name": "raw", "samplerate": 44100, "channels": [[...]] }
 *
 * file samples: loop may be "cycle" (loop whole file as a single-cycle
 * waveform, auto-tuned so C-5 = middle C) or {start, end}. Paths are
 * relative to the project root.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { synthesize } from "./synth.js";
import { readWav } from "./wav.js";

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const MIDDLE_C = 261.6256;

export function resolveSample(def) {
  if (def.synth) {
    const s = synthesize(def.synth);
    const loop = def.loop ? { loop: def.loop } : {}; // validator allows only {start,end} here
    return applyDetune({ name: def.name, ...s, ...loop, ...overrides(def) }, def);
  }
  if (def.file) {
    const wav = readWav(fs.readFileSync(path.resolve(ROOT, def.file)));
    const s = { name: def.name || path.basename(def.file), ...wav };
    if (def.loop === "cycle") {
      const n = wav.channels[0].length;
      s.loop = { start: 0, end: n };
      s.c5speed = Math.round(n * MIDDLE_C);
    } else if (def.loop) {
      s.loop = def.loop;
    }
    return applyDetune({ ...s, ...overrides(def) }, def);
  }
  return applyDetune({ ...def }, def); // raw itwriter sample
}

// explicit per-sample settings win over derived ones
function overrides(def) {
  const out = {};
  for (const k of ["volume", "c5speed", "susloop"]) {
    if (def[k] !== undefined) out[k] = def[k];
  }
  return out;
}

// detune in cents (e.g. +4/-4 for chorus layering) applied to final c5speed
function applyDetune(s, def) {
  if (def.detune) s.c5speed = Math.round((s.c5speed || s.samplerate) * Math.pow(2, def.detune / 1200));
  return s;
}
