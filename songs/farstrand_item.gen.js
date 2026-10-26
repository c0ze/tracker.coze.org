#!/usr/bin/env node
/**
 * FARSTRAND — "Item" (the sting for a collectible: Integrity Plate, Heat Cell, Power Cell). 2026-09-25.
 * D, 96 BPM, speed 6: 4 rows/beat; one row = a 16th (156 ms). One pattern of 24 rows, played once
 * (not a loop): 16 rows of music (the held F# ends on row 16) and 8 rows for the tails; about 2.8 s shipped.
 *
 * Identity: a short fanfare in Farstrand's glass rather than Heliobane's chip arpeggio. It turns Halm's
 * wrong light the right way round: Eb (the bII of D) resolves to D major, the only major tonic in the
 * score so far, so finding something reads as warmth. The glass lead climbs G Bb | A D F#—— (the third of
 * Eb, then up the D major triad to an F# held for two beats with vibrato), glass bells double A D F# two octaves up with
 * a 3-row echo, the saw pluck runs up the chords in 16ths (Eb G Bb Eb, then D F# A D F# A D F#), a pad
 * tone and a sine-ish bass move Eb to D. Played by tools/audio/build.py (Farstrand) through the Paula
 * chain as assets/sfx/item_get.ogg. Everything synthesized.
 */
import { wave, glassBell, thinPad, mel, line, pattern, writeSongCompact, hits } from './heliobane_stage6.kit.js';
import { sawPluck } from './farstrand_halm.gen.js';

const I = { bass: 0, pluck: 1, lead: 2, pad: 3, bell: 4 };
const LAYOUT = ['bass', 'arp', 'lead', 'pad', 'bells', 'bellEcho'];
const PANS = [0x80, 0x5c, 0x84, 0x70, 0x9c, 0x60];
const ROWS = 24;

const run = (notes, from, vol) => Object.fromEntries(notes.map((n, i) => [from + i, { note: n, instrument: I.pluck, vol: `v${Math.round(vol - i)}` }]));
const lead = line(mel('g5/2 bb5 a5 d6 f#6/8~', { vol: 44 }), I.lead, { rows: ROWS, vib: 'H33', vibDelay: 3 });
const bells = { ...hits(I.bell, [4], { note: 'A-6', vol: 34 }), ...hits(I.bell, [6], { note: 'D-7', vol: 36 }), ...hits(I.bell, [8], { note: 'F#7', vol: 40 }) };
const bellEcho = Object.fromEntries(Object.entries(bells).map(([r, e]) => [+r + 3, { ...e, vol: `v${Math.round(Number(e.vol.slice(1)) * 0.4)}` }]));
const pad = line([[0, 'G-5', 4, 16, ''], [4, 'F#5', 10, 20, '']], I.pad, { rows: ROWS, sustain: 0.8, release: 0.3, vib: null });
const bass = line([[0, 'D#3', 4, 30, ''], [4, 'D-3', 10, 34, '']], I.bass, { rows: ROWS, sustain: 0.8, release: 0.35, vib: null });
const arp = { ...run(['D#4', 'G-4', 'A#4', 'D#5'], 0, 30), ...run(['D-4', 'F#4', 'A-4', 'D-5', 'F#5', 'A-5', 'D-6', 'F#6'], 4, 34) };

writeSongCompact(import.meta.url, {
  title: 'Farstrand - Item', bpm: 96, ticks: 6, mixvol: 48,
  message: 'FARSTRAND item sting.\nEb -> D major, 96 BPM, one pass.\nAll samples synthesized. Source: songs/farstrand_item.gen.js',
  samples: [
    wave('round bass', [1, 0.35, 0.14, 0.06, 0.03]),
    sawPluck('saw pluck', { open: 4800, closed: 420, close: 6, decay: 3.2 }),
    wave('glass lead', [1, 0.03, 0.45, 0.02, 0.22, 0.02, 0.1, 0, 0.05]),
    thinPad('cold pad', { amps: [1, 0, 0.3, 0, 0.12, 0, 0.05], spread: 1 }),
    glassBell('glass bell', { sec: 1.6, partials: [[1, 1, 1.6], [2.76, 0.45, 4], [5.4, 0.2, 7.5], [8.93, 0.08, 12]] }),
  ],
  channelnames: LAYOUT,
  patterns: [pattern('item', ROWS / 16, { bass, arp, lead, pad, bells, bellEcho }, LAYOUT, PANS)],
  order: [0],
});
