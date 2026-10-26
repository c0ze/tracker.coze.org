#!/usr/bin/env node
/**
 * json2it — compile a song JSON file to an Impulse Tracker .it module.
 *
 * Usage: node tools/json2it.js songs/demo.json [build/demo.it]
 *
 * The song JSON is the itwriter structure (see vendor/itwriter/UPSTREAM-README.md)
 * except samples may be declared as synth specs, WAV files or raw PCM; see
 * tools/resolve-sample.js.
 */

import fs from "fs";
import path from "path";
import itwriter from "../vendor/itwriter/index.js";
import { resolveSample, ROOT } from "./resolve-sample.js";
import { assertSong } from "./validate-song.js";

const [inFile, outFileArg] = process.argv.slice(2);
if (!inFile) {
  console.error("Usage: node tools/json2it.js <song.json> [out.it]");
  process.exit(1);
}

const song = JSON.parse(fs.readFileSync(inFile, "utf8"));
assertSong(song);
song.samples = (song.samples || []).map(resolveSample);
assertSong(song);

const outFile = outFileArg || path.join(ROOT, "build", path.basename(inFile, path.extname(inFile)) + ".it");
if (path.resolve(outFile) === path.resolve(inFile)) {
  console.error(`refusing to overwrite the input: ${inFile}`);
  process.exit(1);
}
fs.mkdirSync(path.dirname(outFile), { recursive: true });

const buf = itwriter(song);
fs.writeFileSync(outFile, Buffer.from(buf));
console.log(`${outFile} (${buf.byteLength} bytes, ${song.samples.length} samples, ${song.patterns.length} patterns, order length ${song.order.length})`);

// adaptive manifest: emitted next to the .it so game runtimes (CozyAdaptive)
// can drive layers and sections. Validated lightly here.
if (song.adaptive) {
  const a = song.adaptive;
  const nCh = Math.max(...song.patterns.map((p) => p.channels.length));
  for (const l of a.layers || []) {
    for (const c of l.channels) if (c >= nCh) console.warn(`manifest: layer "${l.name}" references channel ${c} (song has ${nCh})`);
  }
  for (const [name, [s, e]] of Object.entries(a.sections || {})) {
    if (s > e || e >= song.order.length) console.warn(`manifest: section "${name}" [${s},${e}] outside order list (length ${song.order.length})`);
  }
  if (a.loop && !(a.sections || {})[a.loop]) console.warn(`manifest: loop section "${a.loop}" not defined`);
  const mFile = /\.it$/i.test(outFile) ? outFile.replace(/\.it$/i, ".cozy.json") : `${outFile}.cozy.json`;
  fs.writeFileSync(mFile, JSON.stringify(a, null, 1));
  console.log(`${mFile} (adaptive manifest: ${(a.layers || []).length} layers, ${Object.keys(a.sections || {}).length} sections)`);
}
