// Hosted sample assets. A song names an asset by id (`{ "asset": "<id>" }`); the host keeps one
// map from id to AssetEntry for both admission (metadata only) and resolution (bytes, checked
// against the same sha256):
//   AssetEntry = { sha256: string, frames: number, channels: 1|2, samplerate: number, bytes?: Uint8Array }
import { readWav } from '../wav.js';

/** Lower-case hex SHA-256 of bytes (Web Crypto: Node 20 and browsers). */
export async function sha256Hex(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Metadata for an uploaded WAV; throws when the bytes are not a WAV tools/wav.js reads. */
export async function describeAsset(bytes) {
  const wav = readWav(bytes);
  return { sha256: await sha256Hex(bytes), byteSize: bytes.byteLength,
    frames: wav.channels[0].length, channels: wav.channels.length, samplerate: wav.samplerate };
}
