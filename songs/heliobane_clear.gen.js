#!/usr/bin/env node
/**
 * HELIOBANE stage-clear jingle — "Herald Down". MUSIC-A, 2026-09-24. Non-looping, ~5 s.
 * D major, 150 BPM, speed 6: one row = 100 ms, 48 rows.
 *
 *   bar 1  D        the title hook turned major: "D D A——" climbing to D6
 *   bar 2  Bb | C   bVI–bVII fanfare, quarter-8th-8th repeated notes, orchestra hits, snare roll
 *   bar 3  D        F#6 over D with brass a third below, crash, everything fades by the last row
 */
import { kick, snare, cymbal, orchHit, wave, pwm, superSaw, BASS_AMPS, BRASS_AMPS,
  mel, line, chart, arp, bass, pad, beat, pattern, writeSongCompact } from './heliobane_title.kit.js';

const I = { kick: 0, snare: 1, hat: 2, crash: 3, bass: 4, arp: 5, lead: 6, brass: 7, pad: 8, orch: 9 };
const LAYOUT = ['kick', 'snare', 'hat', 'bass', 'arp', 'lead', 'brass', 'pad', 'orch', 'crash'];
const PANS = [0x80, 0x74, 0xac, 0x80, 0x50, 0x8a, 0xb0, 0x5a, 0x80, 0x9c];
const ROWS = 48;

const segs = chart('D | Bb/8 C/8 | D/16');
const LEAD = 'd5/2 d5 a5/6 f#5/2 a5 d6 | d6/4 d6/2 d6 e6/4 e6/2 e6 | f#6/16~';
const BRASS = 'r/16 | bb5/4 bb5/2 bb5 c6/4 c6/2 c6 | d6/16~';
const finalLine = (str, inst, vol) => line(mel(str, { vol }), inst, { rows: ROWS, sustain: 0.85, release: 0.08, vib: 'H42' });

const kickCh = beat(['X...X...X...X...', 'X.......X.......', 'X...............'], { X: [I.kick, 56] });
const snareCh = beat(['....X.......X...', '....X.......XxXX', '................'], { X: [I.snare, 56], x: [I.snare, 40] });
const hatCh = beat(['xgxgxgxgxgxgxgxg', 'x.x.x.x.x.x.....', '................'], { x: [I.hat, 22], g: [I.hat, 12] });
const orch = {};
for (const [r, note] of [[16, 'A#4'], [24, 'C-5'], [32, 'D-5']]) orch[r] = { note, instrument: I.orch, vol: 'v44' };

const p = pattern('clear fanfare', 3, {
  kick: kickCh, snare: snareCh, hat: hatCh,
  bass: bass(segs, ['R.O.R.O.R.O.R.O.', 'R.O.R.O.R.O.RrRr', 'R---------------'], I.bass, { rows: ROWS, lo: 'C-3', vol: 40, decay: 0.86 }),
  arp: arp(segs, ['X-x-X-x-X-x-X-x-', 'X-x-X-x-X-x-X-x-', 'X---------------'], I.arp, { rows: ROWS, lo: 'F#4', vol: 22, decay: 0.86, floor: 0 }),
  lead: finalLine(LEAD, I.lead, 42), brass: finalLine(BRASS, I.brass, 30),
  pad: pad(segs, I.pad, { rows: ROWS, lo: 'A-4', vol: 16 }), orch,
  crash: { 32: { note: 'C-5', instrument: I.crash, vol: 'v44' } },
}, LAYOUT, PANS);
// End every sustained voice on the last row (already faded to a few units).
for (const c of [3, 4, 5, 6, 7]) if (!p.channels[c][ROWS - 1]?.note) p.channels[c][ROWS - 1] = { ...p.channels[c][ROWS - 1], note: '^^' };

writeSongCompact(import.meta.url, {
  title: 'Heliobane - Herald Down', bpm: 150, ticks: 6, mixvol: 44,
  message: 'HELIOBANE stage-clear jingle "Herald Down" (MUSIC-A).\nD major, 150 BPM, plays once.\nAll samples synthesized. Source: songs/heliobane_clear.gen.js',
  samples: [
    kick(), snare(), cymbal('hat closed'), cymbal('crash', { sec: 1.3, decay: 2.2, seed: 8, metalMix: 0.35 }),
    wave('saw bass', BASS_AMPS), { name: 'arp pulse', synth: { wave: 'square', pulse: 0.25 } },
    pwm('pwm lead'), wave('brass', BRASS_AMPS), superSaw('string pad'), orchHit(),
  ],
  channelnames: LAYOUT,
  patterns: [p],
  order: [0],
});
