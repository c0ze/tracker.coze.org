#!/usr/bin/env node
/**
 * hosted-build-cli — build a song as the hosted studio does (tools/hosted/build.js): admission,
 * hosted samples only, the IT module (or the .sid for a SID song), a bounded render and the lint.
 *
 * Usage: node tools/hosted-build-cli.js <song.json> [--assets <dir>] [--out <dir>] [--rate 48000]
 *                                       [--model 6581|8580]
 *
 * --assets names a directory with an assets.json manifest:
 *   { "<id>": { "sha256": "<hex>", "file": "<path relative to the directory>" } }
 * Each file must hash to its sha256. --out (default build/hosted/<song>) receives song.it or
 * song.sid, song.wav (the render; nothing is played), lint.json and report.json. Exits 0 only
 * when the build is ok.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { buildHosted } from './hosted/build.js';
import { describeAsset } from './hosted/assets.js';
import { readDriver } from './json2sid.js';
import { renderSid } from './sid-run.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const USAGE = 'Usage: node tools/hosted-build-cli.js <song.json> [--assets <dir>] [--out <dir>] [--rate 48000] [--model 6581|8580]';
const fail = (text) => { console.error(text); process.exit(1); };

let values, positionals;
try {
  ({ values, positionals } = parseArgs({
    allowPositionals: true,
    options: { assets: { type: 'string' }, out: { type: 'string' }, rate: { type: 'string', default: '48000' }, model: { type: 'string' } },
  }));
} catch (e) {
  fail(`${e.message}\n${USAGE}`);
}
if (positionals.length !== 1) fail(USAGE);
const [songFile] = positionals;
if (!/^\d+$/.test(values.rate)) fail('--rate must be a whole number of Hz (22050, 44100 or 48000)');
const rate = Number(values.rate);
if (values.model !== undefined && !['6581', '8580'].includes(values.model)) fail('--model must be 6581 or 8580');
const outDir = values.out ?? path.join(ROOT, 'build', 'hosted', path.basename(songFile, path.extname(songFile)));

/** Reads <dir>/assets.json and each file it names into one map of metadata and bytes. */
async function readAssets(dir) {
  const manifestFile = path.join(dir, 'assets.json');
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')); } catch (e) { fail(`${manifestFile}: ${e.message}`); }
  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) fail(`${manifestFile}: expected an object of assets`);
  const assets = {}, base = path.resolve(dir);
  for (const [id, entry] of Object.entries(manifest)) {
    if (entry === null || typeof entry !== 'object' || typeof entry.sha256 !== 'string' || typeof entry.file !== 'string')
      fail(`${manifestFile}: asset ${JSON.stringify(id)} needs "sha256" and "file"`);
    const file = path.resolve(base, entry.file);
    if (path.isAbsolute(entry.file) || !file.startsWith(base + path.sep)) fail(`asset ${JSON.stringify(id)}: ${entry.file} is outside ${dir}`);
    let bytes, meta;
    try {
      bytes = new Uint8Array(fs.readFileSync(file));
      meta = await describeAsset(bytes);
    } catch (e) { fail(`asset ${JSON.stringify(id)} (${entry.file}): ${e.message}`); }
    if (meta.sha256 !== entry.sha256.toLowerCase())
      fail(`asset ${JSON.stringify(id)} (${entry.file}): sha256 ${meta.sha256} does not match the manifest's ${entry.sha256}`);
    assets[id] = { ...meta, bytes };
  }
  return assets;
}

/** 16-bit PCM WAV of a render; mono when both sides are one array (cRSID). */
function wavFile({ left, right, frames, rate: hz }) {
  const sides = left === right || left.buffer === right.buffer && left.byteOffset === right.byteOffset ? [left] : [left, right];
  const n = sides.length, data = Buffer.alloc(44 + frames * 2 * n);
  data.write('RIFF', 0); data.writeUInt32LE(36 + frames * 2 * n, 4); data.write('WAVE', 8);
  data.write('fmt ', 12); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(n, 22);
  data.writeUInt32LE(hz, 24); data.writeUInt32LE(hz * 2 * n, 28); data.writeUInt16LE(2 * n, 32); data.writeUInt16LE(16, 34);
  data.write('data', 36); data.writeUInt32LE(frames * 2 * n, 40);
  const clamp = (v) => Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
  let off = 44;
  for (let i = 0; i < frames; i++) for (const side of sides) { data.writeInt16LE(clamp(side[i]), off); off += 2; }
  return data;
}

let song;
try { song = JSON.parse(fs.readFileSync(songFile, 'utf8')); } catch (e) { fail(`${songFile}: ${e.message}`); }
const assets = values.assets === undefined ? {} : await readAssets(values.assets);
const result = await buildHosted(song, { assets, rate, model: values.model, sidDriver: readDriver(), renderSid });

const { left, right, ...stats } = result.render ?? {};
const { report, ...admission } = result.admission ?? {};
fs.mkdirSync(outDir, { recursive: true });
const written = [];
const write = (name, bytes) => { fs.writeFileSync(path.join(outDir, name), bytes); written.push(name); };
if (result.it) write('song.it', result.it);
if (result.sid) write('song.sid', result.sid);
if (result.render) write('song.wav', wavFile(result.render));
write('lint.json', JSON.stringify(result.lint, null, 1));
write('report.json', JSON.stringify({
  ok: result.ok, errors: result.errors,
  admission: result.admission ? { ...admission, metrics: report?.metrics ?? null } : null,
  stats: result.render ? stats : null,
}, null, 1));

console.log(`${outDir}: ${written.join(', ')}`);
if (result.render) console.log(`${stats.seconds.toFixed(2)}s @ ${stats.rate}Hz, peak ${stats.peakDbfs.toFixed(1)} dBFS, rms ${stats.rmsDbfs.toFixed(1)} dBFS (rendered, not played)`);
console.log(`lint: ${result.lint.warnings.length} warnings, ${result.lint.limitations.length} limitations`);
if (!result.ok) {
  for (const e of result.errors) console.error(e);
  process.exit(1);
}
