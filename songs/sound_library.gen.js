#!/usr/bin/env node
/**
 * Sound Library — an audition of every synth preset, not a composition.
 * One 64-row pattern per preset (120 BPM, speed 6: 8 seconds each), in catalog
 * order: isolated hits, an accent figure and the pitch range for drums; a note,
 * both ends of the range and a held triad for pitched sounds. Levels are not
 * normalized per pattern, so balance differences between presets stay audible.
 * Catalog: docs/sound-library.md. Pattern recipe: tools/sound-library.js.
 */
import { writeSong } from './lib.js';
import { PRESETS } from '../tools/synth-presets.js';
import { AUDITION, auditionPattern, presetSample } from '../tools/sound-library.js';

const names = Object.keys(PRESETS);
writeSong(import.meta.url, {
  title: 'Sound Library', bpm: AUDITION.bpm, ticks: AUDITION.ticks, mixvol: 64,
  message: `Audition of the ${names.length} synth presets in docs/sound-library.md, one 8-second pattern each.\nSource: songs/sound_library.gen.js.`,
  samples: names.map(presetSample),
  channelnames: { 0: 'voice 1', 1: 'voice 2', 2: 'voice 3' },
  patterns: names.map((name, i) => auditionPattern(name, i)),
  order: names.map((_, i) => i),
});
