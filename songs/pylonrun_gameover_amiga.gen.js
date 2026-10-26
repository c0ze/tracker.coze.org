#!/usr/bin/env node
/**
 * PYLON RUN jingle "Time Up" (tools/json2mod.js), original: the clock has run
 * out and the craft glides to a stop (the game's S_OVER, 8 s at most). The
 * motif turned around and slowed: the run's "A g f e" falls on through C# to
 * D, over Bb, A and D minor, and the bells ring out the last chord.
 * D minor, 84 BPM, speed 6: 32 rows = 5.7 s, then the silent order 1 the game
 * halts on (pylonrun src/amiga/music.c). Every voice is cut before the end.
 * Channels (title layout): 0 drums, 1 lead, 2 bell, 3 bass; no effects play.
 */
import { S, hits, pattern, silence, writeSong } from './pylonrun_amiga.kit.js';

const I = { kick: 0, bass: 1, lead: 2, bell: 3 };
const samples = [S.kick(), S.bass(), S.lead(), S.bell()];
const fade = (r, inst, note, vols) => vols.map((vol, i) => [r + i, i ? null : inst, i ? null : note, vol]);

const lead = hits([
  [0, I.lead, 'a5', 42], [1, null, null, 32], [2, I.lead, 'g5', 40], [3, null, null, 30],
  [4, I.lead, 'f5', 40], [5, null, null, 32], [7, null, null, 26],
  [8, I.lead, 'e5', 40], [9, null, null, 32], [11, null, null, 26],
  [12, I.lead, 'c#5', 38], [13, null, null, 30], [15, null, null, 24],
  ...fade(16, I.lead, 'd5', [42, 36, 33, 30, 27, 24, 21, 18, 15, 12, 9, 6]), [28, null, '^^'],
]);
const bell = hits([
  [0, I.bell, 'd5', 20], [2, I.bell, 'bb4', 16], [4, I.bell, 'bb5', 16], [6, I.bell, 'f5', 12],
  [8, I.bell, 'c#5', 20], [10, I.bell, 'e5', 16], [12, I.bell, 'a5', 16], [14, I.bell, 'e5', 12],
  ...fade(16, I.bell, 'd5', [24, 14]), ...fade(19, I.bell, 'f5', [22, 13]), ...fade(22, I.bell, 'a5', [20, 12]),
  ...fade(25, I.bell, 'd6', [18, 11, 8, 6, 4]), [30, null, '^^'],
]);
const low = hits([
  ...fade(0, I.bass, 'bb2', [46, 40, 36, 32, 29, 26, 23, 20]),
  ...fade(8, I.bass, 'a2', [46, 40, 36, 32, 29, 26, 23, 20]),
  ...fade(16, I.bass, 'd3', [48, 42, 38, 34, 30, 27, 24, 21, 18, 15, 12, 9, 6]), [29, null, '^^'],
]);
const drums = hits([[0, I.kick, 'C-5', 50], [8, I.kick, 'C-5', 40], [16, I.kick, 'C-5', 54]]);

writeSong(import.meta.url, {
  title: 'Pylon Run - Time Up', bpm: 84, ticks: 6, mixvol: 48, samples,
  patterns: [pattern('time up', 32, [drums, lead, bell, low]), silence(1, 3)], order: [0, 1],
  channelnames: { 0: 'drums', 1: 'lead', 2: 'bell', 3: 'bass' },
  message: 'PYLON RUN jingle "Time Up" (game over), original, for the Amiga game (4-channel MOD).\n'
    + 'D minor, 84 BPM, 5.7 s, then the silent order 1. Source: songs/pylonrun_gameover_amiga.gen.js',
});
