#!/usr/bin/env node
/**
 * STUDS UP sting "Goal!" (Amiga port, tools/json2mod.js), original: played over
 * the crowd's cheer (channels 0-1) the moment the net bulges. Channel 3 stays
 * silent for its first 4 rows (0.42 s): the net's impact (0.29 s) plays there.
 * F major, 144 BPM, speed 6, 32 rows = 3.3 s, then the silent order 1.
 *   brass (2): the title's hook cell (c c F) shouted, its F chord held in
 *              arpeggio, a-g, and F again held, faded and cut;
 *   low (3):   glam stomp (kick, clap) from row 4, the bass F, a snare run home.
 */
import { SI, hits, sting } from './studsup_amiga.kit.js';

const J = (r, fx, n) => Array.from({ length: n }, (_, i) => [r + i, null, null, null, fx]);
const lead = hits([
  [0, SI.brass, 'c5'], [1, null, null, 30], [2, SI.brass, 'c5'], [3, null, null, 30],
  [4, SI.brass, 'f5', null, 'J47'], ...J(5, 'J47', 7),
  [12, SI.brass, 'a5'], [13, null, null, 32], [14, SI.brass, 'g5'], [15, null, null, 32],
  [16, SI.brass, 'f5', null, 'J47'], ...J(17, 'J47', 9), [26, null, null, 34], [27, null, null, 26],
  [28, null, null, 18], [29, null, null, 10], [30, null, '^^'],
]);
const low = hits([
  [4, SI.kick, 'C-5', 60], [8, SI.clap, 'C-5', 54], [10, SI.kick, 'C-5', 50], [12, SI.kick, 'C-5', 58],
  [14, SI.clap, 'C-5', 54], [16, SI.bass, 'f3', 48], [18, null, null, 40], [20, null, null, 34], [22, null, null, 28],
  [24, SI.snare, 'C-5', 46], [26, SI.snare, 'C-5', 40], [27, SI.snare, 'C-5', 46], [28, SI.snare, 'C-5', 52],
  [29, SI.snare, 'C-5', 58], [30, SI.kick, 'C-5', 62],
]);
sting(import.meta.url, { title: 'Goal!', bpm: 144, rows: 32, lead, low,
  message: 'F major, 144 BPM, 3.3 s. Source: songs/studsup_goal_amiga.gen.js' });
