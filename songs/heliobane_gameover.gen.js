#!/usr/bin/env node
/**
 * HELIOBANE game-over jingle — "Lance Unspent". MUSIC-A, 2026-09-24. Non-looping, ~4.4 s.
 * D minor, 150 BPM, speed 6: one row = 100 ms, 44 rows.
 *
 * The title hook "D D A——" inverted and falling: "A A F D——" over Dm → Bb,
 * then Gm → A (harmonic-minor dominant, C# leading tone) resolving to a low
 * D minor that fades out under an orchestra hit. Brass lead, no drum groove.
 */
import { kick, cymbal, orchHit, wave, superSaw, BASS_AMPS, BRASS_AMPS,
  mel, line, chart, arp, bass, pad, pattern, writeSongCompact } from './heliobane_title.kit.js';

const I = { kick: 0, crash: 1, bass: 2, arp: 3, lead: 4, pad: 5, orch: 6 };
const LAYOUT = ['kick', 'bass', 'arp', 'lead', 'pad', 'orch', 'crash'];
const PANS = [0x80, 0x80, 0x58, 0x88, 0xa8, 0x80, 0x9c];
const ROWS = 44;

const segs = chart('Dm/8 Bb/8 | Gm/8 A/8 | Dm/12');
const LEAD = 'a5/2 a5 f5/4 d5/8 | g5/4 bb5 a5 c#5 | d5/12~';

const p = pattern('game over', ROWS / 16, {
  kick: { 32: { note: 'C-5', instrument: I.kick, vol: 'v44' } },
  bass: bass(segs, ['R---.---R---.---', 'R---.---R---.---', 'R-----------'], I.bass, { rows: ROWS, lo: 'D-3', vol: 42, decay: 0.88 }),
  arp: arp(segs, ['X-------X-------', 'X-------X-------', 'X-----------'], I.arp, { rows: ROWS, lo: 'F-4', vol: 20, decay: 0.84, floor: 0 }),
  lead: line(mel(LEAD, { vol: 42 }), I.lead, { rows: ROWS, sustain: 0.85, release: 0.1, vib: 'H32', vibDelay: 3 }),
  pad: pad(segs, I.pad, { rows: ROWS, lo: 'F-4', vol: 18 }),
  orch: { 32: { note: 'D-4', instrument: I.orch, vol: 'v36' } },
  crash: { 32: { note: 'C-4', instrument: I.crash, vol: 'v26' } },
}, LAYOUT, PANS);
// End every sustained voice on the last row (already faded to a few units).
for (const c of [1, 2, 3, 4]) if (!p.channels[c][ROWS - 1]?.note) p.channels[c][ROWS - 1] = { ...p.channels[c][ROWS - 1], note: '^^' };

writeSongCompact(import.meta.url, {
  title: 'Heliobane - Lance Unspent', bpm: 150, ticks: 6, mixvol: 46,
  message: 'HELIOBANE game-over jingle "Lance Unspent" (MUSIC-A).\nD minor, 150 BPM, plays once.\nAll samples synthesized. Source: songs/heliobane_gameover.gen.js',
  samples: [
    kick({ f0: 180, decay: 8, sec: 0.45 }), cymbal('crash', { sec: 1.3, decay: 2.2, seed: 8, metalMix: 0.35 }),
    wave('saw bass', BASS_AMPS), { name: 'arp pulse', synth: { wave: 'square', pulse: 0.25 } },
    wave('brass', BRASS_AMPS), superSaw('string pad'), orchHit(),
  ],
  channelnames: LAYOUT,
  patterns: [p],
  order: [0],
});
