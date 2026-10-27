// Node adapter for the source-level analysis in tools/analysis-core.js: sample lengths
// come from WAV files (`file`, relative to the repository root) and raw `channels`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readWav } from './wav.js';
import { analyzeSongCore } from './analysis-core.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));

export function analyzeSong(song, { root = ROOT, maxRing = 16, maxVoices = 4, trace = false } = {}) {
  const sampleMeta = (s) => {
    const wav = s.file ? readWav(fs.readFileSync(path.resolve(root, s.file))) : s.channels ? s : null;
    return wav && { frames: wav.channels[0].length, samplerate: wav.samplerate };
  };
  return analyzeSongCore(song, { sampleMeta, maxRing, maxVoices, trace });
}
