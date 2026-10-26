#!/usr/bin/env node
/**
 * STUDS UP sting "Kick-off" (Amiga port, tools/json2mod.js), original: played
 * before the kick-off whistle while the crowd's bed comes up on channels 0-1.
 * F major, 144 BPM, speed 6, 32 rows = 3.3 s, then the silent order 1.
 *   brass (2): three F stabs (da-da-da), a rising run of chord stabs (Gm Am Bb
 *              Bdim) and the dominant C held with its arpeggio: the whistle answers it;
 *   low (3):   kicks under the three stabs, a snare roll swelling under the run,
 *              the bass C under the held chord, faded and cut.
 */
import { SI, hits, sting } from './studsup_amiga.kit.js';

const J = (r, fx, n) => Array.from({ length: n }, (_, i) => [r + i, null, null, null, fx]);
const lead = hits([
  [0, SI.brass, 'f4', null, 'J47'], ...J(1, 'J47', 1), [2, null, '^^'],
  [3, SI.brass, 'f4', null, 'J47'], ...J(4, 'J47', 1), [5, null, '^^'],
  [6, SI.brass, 'f4', null, 'J47'], ...J(7, 'J47', 1),
  [8, SI.brass, 'g4', null, 'J37'], ...J(9, 'J37', 1), [10, SI.brass, 'a4', null, 'J37'], ...J(11, 'J37', 1),
  [12, SI.brass, 'bb4', null, 'J47'], ...J(13, 'J47', 1), [14, SI.brass, 'b4', null, 'J36'], ...J(15, 'J36', 1),
  [16, SI.brass, 'c5', null, 'J47'], ...J(17, 'J47', 9), [26, null, null, 34], [27, null, null, 26],
  [28, null, null, 18], [29, null, null, 10], [30, null, '^^'],
]);
const low = hits([
  [0, SI.kick, 'C-5', 60], [3, SI.kick, 'C-5', 54], [6, SI.kick, 'C-5', 58],
  ...[22, 26, 30, 34, 38, 44, 50, 56].map((vol, i) => [8 + i, SI.snare, 'C-5', vol]),
  [16, SI.bass, 'c3', 48], ...[40, 34, 28, 22, 16, 10].map((vol, i) => [18 + 2 * i, null, null, vol]), [30, null, '^^'],
]);
sting(import.meta.url, { title: 'Kick-off', bpm: 144, rows: 32, lead, low,
  message: 'F major, 144 BPM, 3.3 s. Source: songs/studsup_kickoff_amiga.gen.js' });
