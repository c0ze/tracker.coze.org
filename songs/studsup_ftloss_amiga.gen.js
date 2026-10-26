#!/usr/bin/env node
/**
 * STUDS UP sting "Full Time: Loss" (Amiga port, tools/json2mod.js), original:
 * after the full-time whistle, over the jeers, when the player's side lost.
 * The comic deflation of a brass band: B flat, A, A flat, G, the last one
 * wobbling (vibrato) and sagging (a slide down) before the cut.
 * G minor colour, 132 BPM, speed 6, 48 rows = 5.5 s, then the silent order 1.
 *   brass (2): bb4 a4 ab4 (6 rows each), g4 held 28 rows: vibrato, then
 *              8 rows sliding down, cut;
 *   low (3):   the bass an octave below each note, then two low, deflated
 *              kicks (the kick sample an octave down).
 */
import { SI, hits, sting, mel, line } from './studsup_amiga.kit.js';

const lead = line(mel('bb4/6 a4 ab4 g4/28~', { vol: 44 }), SI.brass, { rows: 48, vib: 'H44', vibDelay: 3 });
for (let r = 38; r < 46; r++) lead[r] = { fx: 'E04' };
const low = hits([
  [0, SI.bass, 'bb3', 44], [3, null, null, 36], [6, SI.bass, 'a3', 42], [9, null, null, 34],
  [12, SI.bass, 'g#3', 40], [15, null, null, 32], [18, SI.bass, 'g3', 42], [22, null, null, 34],
  [26, null, null, 26], [30, SI.kick, 'C-4', 50], [40, SI.kick, 'C-4', 44],
]);
sting(import.meta.url, { title: 'Full Time: Loss', bpm: 132, rows: 48, lead, low,
  message: 'G minor colour, 132 BPM, 5.5 s. Source: songs/studsup_ftloss_amiga.gen.js' });
