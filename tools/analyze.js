#!/usr/bin/env node
/**
 * analyze — dump structure & stats of tracker modules via libopenmpt.
 * The agent's tool for studying how modules are composed.
 *
 * Usage:
 *   node tools/analyze.js <module>                  # summary + stats
 *   node tools/analyze.js <module> --pattern 0      # print a pattern grid
 *   node tools/analyze.js <module> --json out.json  # full structured dump
 *   node tools/analyze.js --corpus <dir> --out build/analysis/corpus.json
 */

import fs from "fs";
import path from "path";
import { parseArgs } from "node:util";
import libopenmptFactory from "../player/vendor/chiptune3/libopenmpt.worklet.js";

const lib = await libopenmptFactory();

// command indices for get/format_pattern_row_channel_command
const CMD = { NOTE: 0, INSTRUMENT: 1, VOLEFFECT: 2, EFFECT: 3, VOLUME: 4, PARAMETER: 5 };

function cstr(ptr) {
  const s = lib.UTF8ToString(ptr);
  lib._openmpt_free_string(ptr);
  return s;
}

function loadModule(file) {
  const bytes = fs.readFileSync(file);
  const filePtr = lib._malloc(bytes.length);
  lib.HEAPU8.set(bytes, filePtr);
  const mod = lib._openmpt_module_create_from_memory(filePtr, bytes.length, 0, 0, 0);
  lib._free(filePtr);
  return mod;
}

function getMetadata(mod, key) {
  const buf = lib._malloc(key.length + 1);
  for (let i = 0; i < key.length; i++) lib.HEAP8[buf + i] = key.charCodeAt(i);
  lib.HEAP8[buf + key.length] = 0;
  const s = cstr(lib._openmpt_module_get_metadata(mod, buf));
  lib._free(buf);
  return s;
}

function fmtCell(mod, pat, row, ch, cmd) {
  return cstr(lib._openmpt_module_format_pattern_row_channel_command(mod, pat, row, ch, cmd));
}

function analyzeModule(file, opts = {}) {
  const mod = loadModule(file);
  if (!mod) return { file, error: "could not load" };

  const nCh = lib._openmpt_module_get_num_channels(mod);
  const nPat = lib._openmpt_module_get_num_patterns(mod);
  const nOrd = lib._openmpt_module_get_num_orders(mod);
  const nSmp = lib._openmpt_module_get_num_samples(mod);
  const nIns = lib._openmpt_module_get_num_instruments(mod);

  const info = {
    file: path.basename(file),
    title: getMetadata(mod, "title"),
    format: getMetadata(mod, "type"),
    tracker: getMetadata(mod, "tracker"),
    duration: +lib._openmpt_module_get_duration_seconds(mod).toFixed(2),
    tempo: lib._openmpt_module_get_current_tempo(mod),
    speed: lib._openmpt_module_get_current_speed(mod),
    channels: nCh,
    orders: nOrd,
    patterns: nPat,
    samples: nSmp,
    instruments: nIns,
    order: Array.from({ length: nOrd }, (_, i) => lib._openmpt_module_get_order_pattern(mod, i)),
    sampleNames: Array.from({ length: nSmp }, (_, i) => cstr(lib._openmpt_module_get_sample_name(mod, i))).filter(Boolean),
    instrumentNames: Array.from({ length: nIns }, (_, i) => cstr(lib._openmpt_module_get_instrument_name(mod, i))).filter(Boolean),
  };

  // stats sweep over all pattern cells
  const effectFreq = {};
  const volFreq = {};
  const perChannel = Array.from({ length: nCh }, () => ({ notes: 0, min: 999, max: -1, instruments: new Set() }));
  const patternRows = [];
  let noteEvents = 0, cells = 0, usedCells = 0;

  const dump = opts.dump ? [] : null;

  for (let p = 0; p < nPat; p++) {
    const rows = lib._openmpt_module_get_pattern_num_rows(mod, p);
    patternRows.push(rows);
    const patDump = dump ? { pattern: p, rows, grid: [] } : null;
    for (let r = 0; r < rows; r++) {
      const rowDump = patDump ? [] : null;
      for (let c = 0; c < nCh; c++) {
        cells++;
        const rawNote = lib._openmpt_module_get_pattern_row_channel_command(mod, p, r, c, CMD.NOTE);
        const rawInst = lib._openmpt_module_get_pattern_row_channel_command(mod, p, r, c, CMD.INSTRUMENT);
        const rawVolFx = lib._openmpt_module_get_pattern_row_channel_command(mod, p, r, c, CMD.VOLEFFECT);
        const rawFx = lib._openmpt_module_get_pattern_row_channel_command(mod, p, r, c, CMD.EFFECT);
        if (rawNote || rawInst || rawVolFx || rawFx) usedCells++;
        if (rawNote > 0 && rawNote < 128) { // real note (128+ = keyoff/cut/fade specials)
          noteEvents++;
          const pc = perChannel[c];
          pc.notes++;
          if (rawNote < pc.min) pc.min = rawNote;
          if (rawNote > pc.max) pc.max = rawNote;
          if (rawInst) pc.instruments.add(rawInst);
        }
        if (rawFx) {
          const letter = fmtCell(mod, p, r, c, CMD.EFFECT);
          effectFreq[letter] = (effectFreq[letter] || 0) + 1;
        }
        if (rawVolFx) {
          const v = fmtCell(mod, p, r, c, CMD.VOLEFFECT);
          volFreq[v] = (volFreq[v] || 0) + 1;
        }
        if (rowDump) {
          const note = fmtCell(mod, p, r, c, CMD.NOTE);
          const inst = fmtCell(mod, p, r, c, CMD.INSTRUMENT);
          const vol = fmtCell(mod, p, r, c, CMD.VOLEFFECT) + fmtCell(mod, p, r, c, CMD.VOLUME);
          const fx = fmtCell(mod, p, r, c, CMD.EFFECT) + fmtCell(mod, p, r, c, CMD.PARAMETER);
          rowDump.push(`${note}${inst.trim() ? " " + inst.trim() : ""}${vol.trim() ? " " + vol.trim() : ""}${fx.trim() ? " " + fx.trim() : ""}`.trim() || ".");
        }
      }
      if (patDump) patDump.grid.push(rowDump);
    }
    if (dump) dump.push(patDump);
  }

  // note value -> name (verified against libopenmpt formatting: 61 = C-5)
  const noteName = (n) => {
    const names = ["C-", "C#", "D-", "D#", "E-", "F-", "F#", "G-", "G#", "A-", "A#", "B-"];
    return names[(n - 1) % 12] + Math.floor((n - 1) / 12);
  };

  info.stats = {
    noteEvents,
    cellDensity: +(usedCells / cells).toFixed(3),
    patternRowLengths: [...new Set(patternRows)],
    effectFreq: Object.fromEntries(Object.entries(effectFreq).sort((a, b) => b[1] - a[1])),
    volCommandFreq: Object.fromEntries(Object.entries(volFreq).sort((a, b) => b[1] - a[1])),
    channels: perChannel.map((pc, i) => ({
      ch: i,
      notes: pc.notes,
      range: pc.notes ? `${noteName(pc.min)}..${noteName(pc.max)}` : null,
      instruments: [...pc.instruments],
    })),
  };
  if (dump) info.patternData = dump;

  lib._openmpt_module_destroy(mod);
  return info;
}

function printPattern(file, patIdx) {
  const mod = loadModule(file);
  if (!mod) fail(`${file}: could not load module`);
  const nPat = lib._openmpt_module_get_num_patterns(mod);
  if (patIdx >= nPat) {
    lib._openmpt_module_destroy(mod);
    fail(`${file}: pattern ${patIdx} out of range (0..${nPat - 1})`);
  }
  const nCh = lib._openmpt_module_get_num_channels(mod);
  const rows = lib._openmpt_module_get_pattern_num_rows(mod, patIdx);
  for (let r = 0; r < rows; r++) {
    const cols = [];
    for (let c = 0; c < nCh; c++) {
      cols.push(cstr(lib._openmpt_module_format_pattern_row_channel(mod, patIdx, r, c, 13, 1)));
    }
    console.log(String(r).padStart(2, "0"), "|", cols.join("|"));
  }
  lib._openmpt_module_destroy(mod);
}

// --- CLI ---
function fail(message) {
  console.error(message);
  process.exit(1);
}
const USAGE = "Usage: node tools/analyze.js <module> [--pattern N] [--json out.json] | --corpus <dir> [--out file]";
let flags, positionals;
try {
  ({ values: flags, positionals } = parseArgs({
    allowPositionals: true,
    options: { pattern: { type: "string" }, json: { type: "string" }, corpus: { type: "string" }, out: { type: "string" } },
  }));
} catch (e) {
  fail(`${e.message}\n${USAGE}`);
}

if (flags.corpus !== undefined) {
  if (positionals.length) fail(USAGE);
  const dir = flags.corpus;
  const out = flags.out || "build/analysis/corpus.json";
  const files = fs.readdirSync(dir).filter((f) => /\.(it|xm|mod|s3m)$/i.test(f));
  if (files.some((f) => path.resolve(dir, f) === path.resolve(out))) fail(`--out would overwrite a module: ${out}`);
  const results = [];
  for (const f of files) {
    process.stderr.write(`analyzing ${f}...\n`);
    try {
      results.push(analyzeModule(path.join(dir, f)));
    } catch (e) {
      results.push({ file: f, error: e.message });
    }
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(results, null, 1));
  console.log(`wrote ${out} (${results.length} modules)`);
} else {
  if (positionals.length !== 1) fail(USAGE);
  const [file] = positionals;
  if (flags.pattern !== undefined) {
    if (!/^\d+$/.test(flags.pattern)) fail(`--pattern expects a pattern index, got ${flags.pattern}`);
    printPattern(file, Number(flags.pattern));
  } else {
    const out = flags.json;
    if (out !== undefined && path.resolve(out) === path.resolve(file)) fail(`--json would overwrite the module: ${out}`);
    const info = analyzeModule(file, { dump: out !== undefined });
    if (info.error) fail(`${file}: ${info.error}`);
    if (out !== undefined) {
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, JSON.stringify(info, null, 1));
      const { patternData, ...rest } = info;
      console.log(JSON.stringify(rest, null, 2));
      console.log(`full dump (incl. pattern data): ${out}`);
    } else {
      console.log(JSON.stringify(info, null, 2));
    }
  }
}
