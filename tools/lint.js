#!/usr/bin/env node
// Source-level musical hygiene, not a perceptual quality score or a full IT player.
import fs from 'node:fs';
import { analyzeSong } from './song-analysis.js';

const args = process.argv.slice(2), options = {};
let file, strict = false, json = false;
try {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--strict') strict = true;
    else if (a === '--json') json = true;
    else if (a === '--max-ring' || a === '--max-voices') {
      const value = Number(args[++i]);
      if (!Number.isInteger(value) || value < 1) throw new Error(`${a} requires a positive integer`);
      options[a === '--max-ring' ? 'maxRing' : 'maxVoices'] = value;
    } else if (a.startsWith('-') || file) throw new Error(`Unexpected argument: ${a}`);
    else file = a;
  }
  if (!file) throw new Error('Usage: node tools/lint.js <song.json> [--strict] [--json] [--max-ring N] [--max-voices N]');
  const report = analyzeSong(JSON.parse(fs.readFileSync(file, 'utf8')), options);
  if (json) console.log(JSON.stringify(report, null, 2));
  else {
    for (const error of report.errors) console.error(`ERROR: ${error}`);
    for (const w of report.warnings) console.log(`  O${w.order} P${w.pattern} r${w.row}: ${w.message}`);
    for (const note of report.limitations) console.log(`  PARTIAL: ${note}`);
    if (!report.errors.length) console.log(`${file}: ${report.warnings.length} warning(s), ${report.metrics.seconds}s source timeline${report.limitations.length ? ' (partial simulation)' : ''}; musical quality requires audition`);
  }
  process.exitCode = report.errors.length ? 2 : strict && (report.warnings.length || report.limitations.length) ? 1 : 0;
} catch (e) { console.error(e.message); process.exitCode = 2; }
