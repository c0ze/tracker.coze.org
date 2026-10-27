// Runs a compiled SID tune in cRSID (player/vendor/crsid/crsid.wasm) under Node, one play
// call per frame, recording each call's CPU cycles and the SID registers after it.
import fs from 'fs';
import { POLICY } from './hosted/policy.js';

const WASM = new URL('../player/vendor/crsid/crsid.wasm', import.meta.url);
export const PAL_FRAME_CYCLES = 19656;   // 312 lines x 63 cycles (vic-ii.txt, 6569)
export const LINE_CYCLES = 63;

// The sample rate each instance was last initialized at.
const rates = new WeakMap();
const initAt = (w, rate) => {
  if (!w.crsid_init(rate)) throw new Error('cRSID init failed');
  rates.set(w, rate);
};

/** A fresh cRSID instance at `rate` Hz (one of POLICY.renderRates). */
export async function loadCrsid(rate = 44100) {
  if (!POLICY.renderRates.includes(rate)) throw new Error(`cRSID rate ${rate} is not one of ${POLICY.renderRates.join(', ')}`);
  const { instance } = await WebAssembly.instantiate(fs.readFileSync(WASM));
  const w = instance.exports;
  initAt(w, rate);
  return w;
}

/** Loads the PSID and runs its init routine. */
export function loadTune(w, psid) {
  if (psid.length > w.crsid_file_max()) throw new Error('tune too large');
  new Uint8Array(w.memory.buffer).set(psid, w.crsid_file());
  if (w.crsid_load(psid.length, 1)) throw new Error('cRSID rejected the file');
}

/** Calls play `frames` times. Returns [{ cycles, regs: Uint8Array(25) }]. */
export function playFrames(w, org, frames) {
  const out = [];
  for (let f = 0; f < frames; f++) {
    const cycles = w.crsid_call(org + 3, 0, PAL_FRAME_CYCLES);
    if (cycles < 0) throw new Error(`play ran past a whole frame at frame ${f}`);
    const regs = new Uint8Array(25);
    for (let r = 0; r < 25; r++) regs[r] = w.crsid_sid(r);
    out.push({ cycles, regs });
  }
  return out;
}

/** Calls the effect entry point with A = n (as the game would). */
export const playSfx = (w, org, n) => w.crsid_call(org + 6, n, 1000);

export function cycleStats(frames) {
  const c = frames.map((f) => f.cycles);
  const max = Math.max(...c), avg = c.reduce((a, b) => a + b, 0) / c.length;
  return { max, avg, maxLines: max / LINE_CYCLES, avgLines: avg / LINE_CYCLES };
}

// cRSID renders at most this many samples a call (OUT_MAX in vendor/crsid/wasm/crsid_wasm.c).
const RENDER_MAX = 4096;

/**
 * Renders `seconds` of the tune as cRSID plays it, mono 16-bit at `rate` Hz (one of
 * POLICY.renderRates), from driver order `order` when given; `model` 6581 or 8580 overrides the
 * header. Renders in batches of about a second (each of crsid_render calls of at most 4096
 * samples) and stops after the batch in which `deadlineMs` of wall clock have passed (`timedOut`).
 * Returns { left, right, frames, timedOut, railHits }: left is the PCM as a Float32Array
 * (sample / 32768) and right is the same array (cRSID is mono). cRSID clamps its output before
 * returning it, so a pre-clamp peak is not available: railHits counts samples at the clamp
 * limits (exactly -32768 or +32767), and a render that clips has railHits > 0.
 */
export function renderSidPcm(w, psid, org, { seconds, order = null, model = null, rate = 44100, deadlineMs = Infinity }) {
  const start = performance.now();
  if (!POLICY.renderRates.includes(rate)) throw new Error(`cRSID rate ${rate} is not one of ${POLICY.renderRates.join(', ')}`);
  const n = Math.round(seconds * rate);
  if (!(Number.isInteger(n) && n >= 0)) throw new Error(`cannot render ${seconds} seconds`);
  if (model !== null && ![6581, 8580].includes(Number(model))) throw new Error(`SID model ${model} is not 6581 or 8580`);
  if (rates.get(w) !== rate) initAt(w, rate);
  loadTune(w, psid);
  if (order !== null) { w.crsid_poke(org + 9, order); w.crsid_restart(); }
  if (model !== null) w.crsid_set_model(Number(model)); // after the restart, which takes the model from the header
  const left = new Float32Array(n);
  let frames = 0, railHits = 0, timedOut = false;
  while (frames < n) {
    if (frames > 0 && performance.now() - start > deadlineMs) { timedOut = true; break; }
    const batchEnd = Math.min(n, frames + rate);
    while (frames < batchEnd) {
      const k = Math.min(RENDER_MAX, batchEnd - frames);
      const pcm = new Int16Array(w.memory.buffer, w.crsid_render(k), k);
      for (let i = 0; i < k; i++) {
        const v = pcm[i];
        if (v === 32767 || v === -32768) railHits++;
        left[frames + i] = v / 32768;
      }
      frames += k;
    }
  }
  return { left: left.subarray(0, frames), right: left.subarray(0, frames), frames, timedOut, railHits };
}

/** A Node SID renderer for buildHosted's `renderSid` option: a fresh cRSID instance per render. */
export async function renderSid(psid, org, { seconds, model = null, rate = 48000, deadlineMs = Infinity }) {
  return renderSidPcm(await loadCrsid(rate), psid, org, { seconds, model, rate, deadlineMs });
}

/**
 * Renders `seconds` of the tune as cRSID plays it (mono, 16-bit, 44.1 kHz unless `rate` says
 * otherwise), from driver order `order` when given; `model` 6581 or 8580 overrides the header.
 * Returns a WAV file's bytes.
 */
export function renderWav(w, psid, org, { seconds, order = null, model = null, rate = 44100 }) {
  const { left, frames: n } = renderSidPcm(w, psid, org, { seconds, order, model, rate });
  const out = Buffer.alloc(44 + 2 * n);
  for (let i = 0; i < n; i++) out.writeInt16LE(Math.round(left[i] * 32768), 44 + 2 * i);
  out.write('RIFF', 0); out.writeUInt32LE(36 + 2 * n, 4); out.write('WAVEfmt ', 8);
  out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22);   // PCM, mono
  out.writeUInt32LE(rate, 24); out.writeUInt32LE(2 * rate, 28); out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34);
  out.write('data', 36); out.writeUInt32LE(2 * n, 40);
  return out;
}
