#!/usr/bin/env node
/**
 * STUDS UP sting "Full Time: Win" (Amiga port, tools/json2mod.js), original:
 * after the full-time whistle, over the crowd's cheer, when the player's side won.
 * F major, 144 BPM, speed 6, 48 rows = 5.0 s, then the silent order 1.
 *   brass (2): the title's hook (c c F, a g), then the same cell lifted to the
 *              high C and D, and the F chord held in arpeggio, faded and cut;
 *   low (3):   two bars of glam stomp (kick, clap) with a clap run, then the
 *              bass F under the last chord and a final kick, kick, clap, kick.
 */
import { SI, hits, sting, mel, line, beat } from './studsup_amiga.kit.js';

const J = (r, fx, n) => Array.from({ length: n }, (_, i) => [r + i, null, null, null, fx]);
const lead = {
  ...line(mel('c5/2 c5 f5/6 r/2 a5/2 g5 | f5/2 a5 c6/6 r/2 d6/2 c6', { vol: 44 }), SI.brass, { rows: 32, vib: null }),
  ...hits([[32, SI.brass, 'f5', null, 'J47'], ...J(33, 'J47', 9), [42, null, null, 36], [43, null, null, 28],
    [44, null, null, 20], [45, null, null, 12], [46, null, '^^']]),
};
const D = { K: [SI.kick, 60], k: [SI.kick, 48], C: [SI.clap, 54], c: [SI.clap, 40] };
const low = {
  ...beat(['K...C...K.k.C...', 'K...C...K.k.CcCC'], D),
  ...hits([[32, SI.bass, 'f3', 50], [34, null, null, 44], [36, null, null, 38], [38, null, null, 32],
    [40, SI.kick, 'C-5', 60], [42, SI.kick, 'C-5', 52], [44, SI.clap, 'C-5', 58], [46, SI.kick, 'C-5', 64]]),
};
sting(import.meta.url, { title: 'Full Time: Win', bpm: 144, rows: 48, lead, low,
  message: 'F major, 144 BPM, 5.0 s. Source: songs/studsup_ftwin_amiga.gen.js' });
