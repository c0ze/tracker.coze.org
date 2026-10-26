#!/usr/bin/env node
/**
 * THAWLINE — "Board held" (the sting for mission_win). 2026-09-25.
 * A major, 110 BPM (the Ossuary's tempo), speed 6: 4 rows/beat; one row = a 16th (136 ms). One pattern of
 * 28 rows, played once (not a loop): the held A6 ends on row 24, the last rows are for the tails; about
 * 3.5 s shipped.
 *
 * Identity: the Ossuary's cold C turned warm. F - G - A, the bVI-bVII-I climb, and the ember lead goes up
 * in thirds, A C | B D | C# E A——: the C of the Ossuary's cell comes back as C#, so the board's A minor
 * ends in A major (the young sun holding). Glass bells double C# E A an octave up with a 3-row echo, the
 * saw pluck runs up each chord in 16ths, the pulse bass steps F G A in 8ths, one soft kick on the arrival.
 * Played by tools/audio/build.py (Thawline) through the Paula chain as assets/sfx/mission_win.ogg.
 * Everything synthesized; the samples are the Ossuary's (songs/thawline_ossuary.gen.js).
 */
import { kick, wave, glassBell, thinPad, mel, line, pattern, writeSongCompact, hits } from './heliobane_stage6.kit.js';
import { sawPluck } from './farstrand_halm.gen.js';

const I = { kick: 0, bass: 1, pluck: 2, lead: 3, pad: 4, bell: 5 };
const LAYOUT = ['kick', 'bass', 'arp', 'lead', 'pad', 'bells', 'bellEcho'];
const PANS = [0x80, 0x80, 0x5c, 0x84, 0x70, 0x9c, 0x60];
const ROWS = 28;

const run = (notes, from, vol) => Object.fromEntries(notes.map((n, i) => [from + i, { note: n, instrument: I.pluck, vol: `v${Math.round(vol - i)}` }]));
const lead = line(mel('a5/2 c6 b5 d6 c#6 e6 a6/12~', { vol: 42 }), I.lead, { rows: ROWS, vib: 'H23', vibDelay: 3 });
const bells = { ...hits(I.bell, [8], { note: 'C#7', vol: 32 }), ...hits(I.bell, [10], { note: 'E-7', vol: 34 }), ...hits(I.bell, [12], { note: 'A-7', vol: 38 }) };
const bellEcho = Object.fromEntries(Object.entries(bells).map(([r, e]) => [+r + 3, { ...e, vol: `v${Math.round(Number(e.vol.slice(1)) * 0.4)}` }]));
const pad = line([[0, 'C-5', 4, 14, ''], [4, 'D-5', 4, 16, ''], [8, 'E-5', 16, 20, '']], I.pad, { rows: ROWS, sustain: 0.8, release: 0.3, vib: null });
const bass = line([[0, 'F-3', 2, 34, ''], [2, 'F-3', 2, 26, ''], [4, 'G-3', 2, 34, ''], [6, 'G-3', 2, 26, ''], [8, 'A-3', 16, 38, '']],
  I.bass, { rows: ROWS, sustain: 0.8, release: 0.35, vib: null });
const arp = { ...run(['F-4', 'A-4', 'C-5', 'E-5'], 0, 30), ...run(['G-4', 'B-4', 'D-5', 'G-5'], 4, 30),
  ...run(['A-4', 'C#5', 'E-5', 'A-5', 'C#6', 'E-6'], 8, 34) };

writeSongCompact(import.meta.url, {
  title: 'Thawline - Board held', bpm: 110, ticks: 6, mixvol: 48,
  message: 'THAWLINE mission_win sting.\nF G A (bVI bVII I), 110 BPM, one pass.\nAll samples synthesized. Source: songs/thawline_win.gen.js',
  samples: [
    kick({ f0: 170, f1: 48, sweep: 32, decay: 9, click: 0.2, drive: 1.7, sec: 0.4 }),
    sawPluck('pulse bass', { open: 3600, closed: 520, close: 10, decay: 3.5, sec: 0.9 }),
    sawPluck('saw pluck', { open: 3000, closed: 320, close: 6, decay: 3.4 }),
    wave('ember lead', [1, 0.42, 0.26, 0.12, 0.07, 0.035, 0.02]),
    thinPad('cold pad', { amps: [1, 0, 0.3, 0, 0.12, 0, 0.05], spread: 1 }),
    glassBell('glass bell', { sec: 1.4, partials: [[1, 1, 1.9], [2.76, 0.45, 4.5], [5.4, 0.22, 8], [8.93, 0.1, 14]] }),
  ],
  channelnames: LAYOUT,
  patterns: [pattern('board held', ROWS / 16, { kick: hits(I.kick, [8], { vol: 40 }), bass, arp, lead, pad, bells, bellEcho }, LAYOUT, PANS)],
  order: [0],
});
