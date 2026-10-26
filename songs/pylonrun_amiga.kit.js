/**
 * PYLON RUN (Amiga) kit: the samples and the one helper the pylonrun_*_amiga
 * generators share. Original music for 4-channel ProTracker MODs
 * (tools/json2mod.js) played by ptplayer in the game (pylonrun src/amiga/music.c).
 * The notation, articulation and assembly helpers are Studs Up's
 * (studsup_amiga.kit.js: mel, line, chart, bass, beat, pattern, jump,
 * silence, writeSong), re-exported here.
 *
 * The game: a flat-shaded slalom, low flight over a dusk plain (a sunset copper
 * gradient, amber pylons, cyan crystals) on a stock A500 (512K chip RAM).
 * All music together must stay under ~60 KB of chip RAM, so every sample is
 * synthesized and small: drums are short one-shots at 11 kHz, tones are
 * single-cycle loops shaped by authored volume steps.
 *
 * Channels (Paula: 0 and 3 left, 1 and 2 right; pylonrun src/amiga/music.c):
 *   title and game over: 0 drums, 1 lead, 2 colour (bell), 3 bass (no effects play);
 *   in flight:           0 bass, 1 lead, 2 drums; 3 stays empty for the effects.
 */
import { wave, pulse, kick, snare, hat, BASS_AMPS } from './studsup_amiga.samples.js';
import { nn, ns } from './lib.js';
import { at, v } from './studsup_amiga.kit.js';
export * from './studsup_amiga.kit.js';

/** The game's samples: one recipe for all three songs. */
export const S = {
  kick: () => kick({ sec: 0.16 }),
  snare: () => snare({ sec: 0.14 }),
  hat: () => hat({ sec: 0.04 }),
  bass: () => wave('bass', BASS_AMPS),
  // amber: a pulse with its top harmonics left out, warmer than a square
  lead: () => pulse('amber', 0.3, { cyc: 64, top: 10 }),
  // cyan: octaves over the fundamental (1, 2, 4, 8), a glassy flute that the
  // authored volume steps turn into a bell
  bell: () => wave('glass', [1, 0.55, 0, 0.3, 0, 0, 0, 0.14], { cyc: 64 }),
};

/**
 * Broken chords in 8ths for the bell: each chord's tones above `lo`, picked by
 * `pick` (indices into root, third, fifth, octave), a note every `step` rows,
 * struck at `vol` and dropped to `vol * 0.5` the row after (a bell's decay).
 * A chord change re-voices nothing: the tones stay in the octave above `lo`.
 */
export function broken(segs, inst, { rows, lo, vol = 24, pick = [0, 2, 1, 2], step = 2, from = 0, to = rows } = {}) {
  const ch = {}, base = nn(lo);
  for (let r = from, k = 0; r < to; r += step, k++) {
    const seg = at(segs, r), iv = [...seg.iv.slice(0, 3), 12][pick[k % pick.length]];
    const n = base + ((seg.root + iv - base) % 12 + 12) % 12 + (iv === 12 ? 12 : 0);
    ch[r] = { note: ns(n), instrument: inst, vol: v(k % 4 === 0 ? vol : vol * 0.8) };
    if (step > 1 && r + 1 < to) ch[r + 1] = { vol: v(vol * 0.5) };
  }
  return ch;
}
