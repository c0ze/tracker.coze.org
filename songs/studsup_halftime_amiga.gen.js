#!/usr/bin/env node
/**
 * STUDS UP sting "Half Time" (Amiga port, tools/json2mod.js), original: after
 * the half-time whistle, a music-hall oom-pah, off to the bar for a pint.
 * F major (F | C7 F), 144 BPM, speed 6, 32 rows = 3.3 s, then the silent order 1.
 *   brass (2): a broken F chord tumbling down and up to B flat, the C7 answer
 *              climbing back, home on F with a rest before the end;
 *   low (3):   oom-pah: bass on the beats (root, fifth), a soft snare between,
 *              a kick to finish.
 */
import { SI, hits, sting, mel, line } from './studsup_amiga.kit.js';

const lead = line(mel('c6/2 a5 f5 a5 bb5/4 g5 | e5/2 g5 bb5 c6 a5/4 f5/2 r/2', { vol: 44 }), SI.brass, { rows: 32, vib: null });
const oom = [[0, 'f3'], [4, 'c3'], [8, 'f3'], [12, 'c3'], [16, 'c3'], [20, 'g3'], [24, 'f3']];
const low = hits([
  ...oom.map(([r, n], i) => [r, SI.bass, n, i % 2 ? 40 : 46]),
  ...[2, 6, 10, 14, 18, 22, 26].map((r) => [r, SI.snare, 'C-5', r === 14 || r === 26 ? 26 : 20]),
  [28, SI.kick, 'C-5', 56],
]);
sting(import.meta.url, { title: 'Half Time', bpm: 144, rows: 32, lead, low,
  message: 'F major, 144 BPM, 3.3 s. Source: songs/studsup_halftime_amiga.gen.js' });
