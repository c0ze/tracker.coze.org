#!/usr/bin/env node
/**
 * FARSTRAND — "Taproot Quench" (the sting for the moment Hesper quenches Kell worn's heart and the fight ends).
 * 2026-10-01. D, 80 BPM, speed 6: 4 rows/beat; one row = a 16th (187.5 ms). One pattern of 24 rows, played once (not a
 * loop): 18 rows of music and 6 for the tails; about 4.4 s shipped.
 *
 * Identity: the heat stopped and the cold let in. Row 0 is Kell's chord, Eb major (his bII), on the warm pad with his
 * motif's head in the flesh voice ('G D', KELL from farstrand_boss_kell.gen.js) and an Eb in the bass; on row 2 it is
 * cut off and glass takes its place: struck glass bells spread a cold D minor add9 upward (D6 A6 F6 E7 D7 A6, four of
 * them with a 3-row echo) as the cold pad and the glass harmonica come in on D minor; the glass lead holds A and falls
 * to D (the title's 5 to 1), the pluck runs up the D minor triad in 16ths from D4 to F6 (the cold running up the
 * strand, as `cold_run` does) and the bass settles on D. Played by tools/audio/build.py (Farstrand) through the Paula
 * chain as assets/sfx/taproot_quench.ogg.
 * Everything synthesized.
 */
import { wave, glassBell, thinPad, mel, line, pattern, writeSongCompact, hits } from './heliobane_stage6.kit.js';
import { sawPluck } from './farstrand_halm.gen.js';

const I = { bass: 0, pluck: 1, lead: 2, warm: 3, cold: 4, glass: 5, bell: 6, flesh: 7 };
const LAYOUT = ['bass', 'arp', 'lead', 'hive', 'warm', 'cold', 'glass', 'bells', 'bells2', 'bellEcho'];
const PANS = [0x80, 0x5c, 0x86, 0x80, 0x74, 0x70, 0x94, 0x9c, 0x64, 0x58];
const ROWS = 24;

const run = (notes, from, vol) => Object.fromEntries(notes.map((n, i) => [from + i, { note: n, instrument: I.pluck, vol: `v${Math.round(vol - i)}` }]));
const hold = (rows, note, inst, vol, len) => line([[rows, note, len, vol, '']], inst, { rows: ROWS, sustain: 0.85, release: 0.4, vib: null });
const bass = { ...hold(0, 'D#3', I.bass, 34, 2), ...hold(2, 'D-3', I.bass, 34, 16) };
const hive = line(mel('g4/1 d4/1 r/22', { vol: 46 }), I.flesh, { rows: ROWS, vib: null });
const warm = { ...hold(0, 'A#4', I.warm, 30, 2), 2: { note: '^^' } };
const cold = hold(2, 'F-5', I.cold, 24, 16);
const glass = hold(4, 'A-5', I.glass, 10, 14);
const lead = line(mel('r/2 a5/6~ d6/10~ r/6', { vol: 44 }), I.lead, { rows: ROWS, vib: 'H23', vibDelay: 3 });
const bells = { ...hits(I.bell, [2], { note: 'D-6', vol: 48 }), ...hits(I.bell, [5], { note: 'F-6', vol: 36 }),
  ...hits(I.bell, [9], { note: 'E-7', vol: 30 }), ...hits(I.bell, [14], { note: 'A-6', vol: 28 }) };
const bells2 = { ...hits(I.bell, [3], { note: 'A-6', vol: 40 }), ...hits(I.bell, [11], { note: 'D-7', vol: 32 }) };
const bellEcho = Object.fromEntries(Object.entries(bells).map(([r, e]) => [+r + 3, { ...e, vol: `v${Math.round(Number(e.vol.slice(1)) * 0.4)}` }]));
const arp = run(['D-4', 'F-4', 'A-4', 'D-5', 'F-5', 'A-5', 'D-6', 'F-6'], 4, 34);

writeSongCompact(import.meta.url, {
  title: 'Farstrand - Taproot Quench', bpm: 80, ticks: 6, mixvol: 48,
  message: 'FARSTRAND sting: the Taproot quenched.\nEb (Kell\'s bII) cut off by D minor in glass, 80 BPM, one pass.\nAll samples synthesized. Source: songs/farstrand_taproot_quench.gen.js',
  samples: [
    wave('round bass', [1, 0.35, 0.14, 0.06, 0.03]),
    sawPluck('saw pluck', { open: 4800, closed: 420, close: 6, decay: 3.2 }),
    wave('glass lead', [1, 0.03, 0.45, 0.02, 0.22, 0.02, 0.1, 0, 0.05]),
    thinPad('warm pad', { amps: [1, 0.55, 0.35, 0.22, 0.14, 0.08], spread: 1 }),
    thinPad('cold pad', { amps: [1, 0, 0.3, 0, 0.12, 0, 0.05], spread: 1 }),
    thinPad('glass harmonica', { amps: [1, 0, 0.18, 0, 0.06], spread: 2 }),
    glassBell('glass bell', { sec: 2.4, partials: [[1, 1, 1.1], [2.76, 0.45, 3], [5.4, 0.2, 6], [8.93, 0.08, 10]] }),
    wave('flesh', [1, 0.7, 0.45, 0.32, 0.22, 0.15, 0.1, 0.06]),
  ],
  channelnames: LAYOUT,
  patterns: [pattern('quench', ROWS / 16, { bass, arp, lead, hive, warm, cold, glass, bells, bells2, bellEcho }, LAYOUT, PANS)],
  order: [0],
});
