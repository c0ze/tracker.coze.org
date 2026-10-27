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
import { applySampleDef } from "./sample-overrides.js";

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export function resolveSample(def) {
  if (def.synth) {
    return applySampleDef({ name: def.name, ...synthesize(def.synth) }, def);
  }
  if (def.file) {
    const wav = readWav(fs.readFileSync(path.resolve(ROOT, def.file)));
    return applySampleDef({ name: path.basename(def.file), ...wav }, def);
  }
  if (def.asset !== undefined) throw new Error("asset samples need the hosted resolver");
  return applySampleDef({ ...def }, def); // raw itwriter sample
}
