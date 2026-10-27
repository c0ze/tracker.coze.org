#!/usr/bin/env node
/**
 * json2sid — compile a SID song JSON (sid/FORMAT.md) to a PSID file, and optionally a PRG
 * for a game.
 *
 * Usage: node tools/json2sid.js songs/<song>.json [build/<song>.sid] [--org 0x1000]
 *                               [--prg build/<song>.prg] [--measure seconds]
 *                               [--wav build/<song>.wav --seconds 60 [--order N] [--model 8580]]
 *
 * --measure runs the tune in cRSID for that many seconds and reports the play routine's CPU
 * cycles per frame (worst and average), the driver's cost to a game. --wav renders the tune in
 * cRSID to a file (it plays nothing aloud), from song order N with --order.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { compileSid, report, DRIVER_FILES } from './sid-compile.js';
import { loadCrsid, loadTune, playFrames, cycleStats, renderWav } from './sid-run.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const readDriver = () => DRIVER_FILES.map((f) => fs.readFileSync(path.join(ROOT, 'sid', f), 'utf8')).join('\n');

function parseArgs(argv) {
  const opts = { files: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--org') opts.org = Number(argv[++i]);
    else if (a === '--prg') opts.prg = argv[++i];
    else if (a === '--measure') opts.measure = Number(argv[++i]);
    else if (a === '--wav') opts.wav = argv[++i];
    else if (a === '--seconds') opts.seconds = Number(argv[++i]);
    else if (a === '--order') opts.order = Number(argv[++i]);
    else if (a === '--model') opts.model = Number(argv[++i]);
    else opts.files.push(a);
  }
  return opts;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const opts = parseArgs(process.argv.slice(2));
  const [inFile, outArg] = opts.files;
  if (!inFile || (opts.org !== undefined && !(opts.org >= 0x0200 && opts.org < 0xff00))) {
    console.error('Usage: node tools/json2sid.js <song.json> [out.sid] [--org 0x1000] [--prg out.prg] [--measure seconds] [--wav out.wav --seconds S [--order N] [--model 6581|8580]]');
    process.exit(1);
  }
  const outFile = outArg || path.join(ROOT, 'build', path.basename(inFile, path.extname(inFile)) + '.sid');
  if ([outFile, opts.prg, opts.wav].some((f) => f && path.resolve(f) === path.resolve(inFile))) {
    console.error(`refusing to overwrite the input: ${inFile}`);
    process.exit(1);
  }
  try {
    const song = JSON.parse(fs.readFileSync(inFile, 'utf8'));
    const result = compileSid(song, { driver: readDriver(), org: opts.org });
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, result.psid);
    console.log(`${outFile}\n${report(result)}`);
    if (opts.prg) {
      fs.mkdirSync(path.dirname(opts.prg), { recursive: true });
      fs.writeFileSync(opts.prg, result.prg);
      console.log(`${opts.prg} (load address $${result.org.toString(16)})`);
    }
    if (opts.measure) {
      const w = await loadCrsid();
      loadTune(w, result.psid);
      const s = cycleStats(playFrames(w, result.org, Math.round(opts.measure * 50)));
      console.log(`play over ${opts.measure} s: worst ${s.max} cycles (${s.maxLines.toFixed(1)} raster lines), ` +
        `average ${Math.round(s.avg)} (${s.avgLines.toFixed(1)} lines)`);
    }
    if (opts.wav) {
      const order = opts.order === undefined ? null : result.orderMap[opts.order];
      if (order === undefined) throw new Error(`--order ${opts.order}: no such order`);
      if (opts.model !== undefined && ![6581, 8580].includes(opts.model)) throw new Error('--model must be 6581 or 8580');
      const w = await loadCrsid();
      fs.mkdirSync(path.dirname(opts.wav), { recursive: true });
      fs.writeFileSync(opts.wav, renderWav(w, result.psid, result.org, { seconds: opts.seconds ?? 60, order, model: opts.model ?? null }));
      console.log(`${opts.wav} (${opts.seconds ?? 60} s, rendered in cRSID, not played)`);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
