// Hosted sample resolver: synth specs and registered assets only, no filesystem. Browser-safe.
// `assets` is the host's map { [id]: AssetEntry } (tools/hosted/assets.js); resolution needs the
// entry's `bytes`, which must still hash to the entry's `sha256` and hold the frames, channels and
// samplerate the entry declares (admission sized the asset from those).
import { synthesize } from '../synth.js';
import { readWav, readWavHeader } from '../wav.js';
import { applySampleDef } from '../sample-overrides.js';
import { sha256Hex } from './assets.js';

// A {start,end} loop must lie inside the decoded frames; `end` defaults to the last frame.
function checkLoopBounds(def, frames) {
  for (const k of ['loop', 'susloop']) {
    const l = def[k];
    if (l === undefined || l === 'cycle') continue;
    const start = l.start ?? 0, end = l.end ?? frames;
    if (!(start >= 0 && end <= frames && start < end)) {
      throw new Error(`${k} ${start}..${end} lies outside asset "${def.asset}" (${frames} frames)`);
    }
  }
}

export async function resolveHostedSample(def, assets) {
  if (def.synth) {
    return applySampleDef({ name: def.name, ...synthesize(def.synth) }, def);
  }
  if (def.asset !== undefined) {
    const entry = assets && Object.hasOwn(assets, def.asset) ? assets[def.asset] : undefined;
    if (!entry) throw new Error(`unknown asset "${def.asset}"`);
    if (!entry.bytes) throw new Error(`asset "${def.asset}" has no bytes to resolve`);
    if (await sha256Hex(entry.bytes) !== entry.sha256) throw new Error(`asset "${def.asset}" does not match its sha256`);
    // Compare the header before decoding: a long WAV registered as a short one never allocates.
    const head = readWavHeader(entry.bytes);
    if (head.frames !== entry.frames || head.channels !== entry.channels || head.samplerate !== entry.samplerate) {
      throw new Error(`asset "${def.asset}" (${head.frames} frames, ${head.channels} ch, ${head.samplerate} Hz) does not match its entry ` +
        `(${entry.frames} frames, ${entry.channels} ch, ${entry.samplerate} Hz)`);
    }
    const wav = readWav(entry.bytes);
    checkLoopBounds(def, wav.channels[0].length);
    return applySampleDef({ name: def.asset, ...wav }, def);
  }
  throw new Error('hosted songs use synth or asset samples');
}

export function resolveHostedSamples(song, assets) {
  return Promise.all((song.samples || []).map((def) => resolveHostedSample(def, assets)));
}
