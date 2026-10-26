#!/usr/bin/env node
/**
 * THAWLINE — "Board lost" (the sting for mission_lose). 2026-09-25.
 * A minor, 96 BPM (slower than the Ossuary's 110), speed 6: 4 rows/beat; one row = a 16th (156 ms). One
 * pattern of 32 rows, played once (not a loop): the held E5 ends on row 30; about 4.5 s shipped.
 *
 * Identity: the Ossuary's cell run backwards and let fall. Dm7 - Bbmaj7 - Am: the ember lead sings
 * C—— B | A F | E——— (the cell's "A B C" reversed, then past the cold F down to the fifth), the bass falls
 * D, Bb, A (the Phrygian half step onto the tonic), the saw pluck walks down each chord in 8ths and slows,
 * a glass bell tolls A6 and E6 with a 6-row echo, the pad settles on C, and the wind swells and goes out.
 * One dull kick on the landing, no other drums. Played by tools/audio/build.py (Thawline) through the
 * Paula chain as assets/sfx/mission_lose.ogg. Everything synthesized; the samples are the Ossuary's.
 */
import { kick, wave, glassBell, thinPad, noiseLoop, mel, line, pattern, writeSongCompact, hits } from './heliobane_stage6.kit.js';
import { sawPluck } from './farstrand_halm.gen.js';

const I = { kick: 0, bass: 1, pluck: 2, lead: 3, pad: 4, bell: 5, noise: 6 };
const LAYOUT = ['kick', 'bass', 'arp', 'lead', 'pad', 'bells', 'bellEcho', 'wind'];
const PANS = [0x80, 0x80, 0x5c, 0x84, 0x70, 0x9c, 0x60, 0x80];
const ROWS = 32;

const lead = line(mel('c6/6 b5/2 a5/4 f5 e5/14~', { vol: 40 }), I.lead, { rows: ROWS, vib: 'H23', vibDelay: 4 });
const steps = [[0, 'C-5'], [2, 'A-4'], [4, 'F-4'], [6, 'D-4'], [8, 'A-4'], [10, 'F-4'], [12, 'D-4'], [14, 'A#3'],
  [16, 'A-4'], [20, 'E-4'], [25, 'C-4']];
const arp = Object.fromEntries(steps.map(([r, n], i) => [r, { note: n, instrument: I.pluck, vol: `v${30 - i}` }]));
const bells = { ...hits(I.bell, [16], { note: 'A-6', vol: 40 }), ...hits(I.bell, [22], { note: 'E-6', vol: 30 }) };
const bellEcho = Object.fromEntries(Object.entries(bells).map(([r, e]) => [+r + 6, { ...e, vol: `v${Math.round(Number(e.vol.slice(1)) * 0.4)}` }]));
const pad = line([[0, 'A-4', 8, 14, ''], [8, 'A-4', 8, 16, ''], [16, 'C-5', 14, 18, '']], I.pad, { rows: ROWS, sustain: 0.8, release: 0.3, vib: null });
const bass = line([[0, 'D-4', 8, 30, ''], [8, 'A#3', 8, 32, ''], [16, 'A-3', 14, 36, '']], I.bass, { rows: ROWS, sustain: 0.8, release: 0.4, vib: null });
const wind = { 0: { note: 'C-5', instrument: I.noise, vol: 'v3' } };
for (let r = 4; r < ROWS - 1; r += 4) wind[r] = { vol: `v${Math.round(3 + 9 * Math.sin(Math.PI * r / ROWS))}` };
wind[ROWS - 1] = { note: '^^' };

writeSongCompact(import.meta.url, {
  title: 'Thawline - Board lost', bpm: 96, ticks: 6, mixvol: 48,
  message: 'THAWLINE mission_lose sting.\nDm7 Bbmaj7 Am, 96 BPM, one pass.\nAll samples synthesized. Source: songs/thawline_lose.gen.js',
  samples: [
    kick({ f0: 120, f1: 44, sweep: 24, decay: 7, click: 0.05, drive: 1.4, sec: 0.5 }),
    wave('round bass', [1, 0.35, 0.14, 0.06, 0.03]),
    sawPluck('saw pluck', { open: 3000, closed: 320, close: 6, decay: 3.4 }),
    wave('ember lead', [1, 0.42, 0.26, 0.12, 0.07, 0.035, 0.02]),
    thinPad('cold pad', { amps: [1, 0, 0.3, 0, 0.12, 0, 0.05], spread: 1 }),
    glassBell('glass bell', { sec: 1.4, partials: [[1, 1, 1.9], [2.76, 0.45, 4.5], [5.4, 0.22, 8], [8.93, 0.1, 14]] }),
    noiseLoop(),
  ],
  channelnames: LAYOUT,
  patterns: [pattern('board lost', ROWS / 16, { kick: hits(I.kick, [16], { vol: 36 }), bass, arp, lead, pad, bells, bellEcho, wind }, LAYOUT, PANS)],
  order: [0],
});
