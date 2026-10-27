/**
 * render-core — render a module (.it/.xm/.mod/.s3m/…) to PCM with libopenmpt, bounded in frames
 * and wall clock. Portable (no Node APIs): tools/render.js and tools/hosted/build.js use it, and
 * it runs in a browser or worker the same way. It loads the libopenmpt WASM build the player
 * uses, so what it renders is what the player plays.
 */
import libopenmptFactory from '../player/vendor/chiptune3/libopenmpt.worklet.js';

export class RenderError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RenderError';
    this.code = code;
  }
}

// One libopenmpt instance, created on first use. A render that fails inside the WASM drops it,
// so the next render starts from a fresh instance; a load that fails is not cached either.
let libPromise = null;
let libFactory = libopenmptFactory;
function loadLib() {
  if (!libPromise) {
    const p = Promise.resolve().then(() => libFactory()).catch((e) => {
      if (libPromise === p) libPromise = null;
      throw new RenderError('init', `libopenmpt failed to initialize: ${e?.message ?? e}`);
    });
    libPromise = p;
  }
  return libPromise;
}

/** Test seam: the factory the next load uses (the bundled libopenmpt build when omitted). */
export function setLibopenmptFactory(factory = libopenmptFactory) {
  libFactory = factory;
  libPromise = null;
}

const CHUNK = 1024;
// The interactive interface is a struct of function pointers; slot 10 is set_channel_mute_status.
const SET_CHANNEL_MUTE = 10;

const channelSet = (list, name) => {
  if (list === null || list === undefined) return null;
  const set = new Set(list);
  for (const c of set) if (!(Number.isInteger(c) && c >= 0 && c < 64))
    throw new RenderError('channels', `${name} takes zero-based channel numbers below 64, not ${c}`);
  return set;
};

/**
 * Renders `bytes` once through (no repeat) at `rate` Hz into two Float32Arrays allocated once at
 * `maxFrames`. Stops early at `maxFrames` (`truncated` when the module still had audio) or when
 * `deadlineMs` of wall clock have passed (`timedOut`). `solo` / `mute` list zero-based channels
 * to keep / silence. Returns { left, right, frames, truncated, timedOut, stats: { peak, rms, clipped } }
 * with left and right cut to `frames`; `clipped` counts samples past full scale. Throws
 * RenderError (with `code`) for bad options, a module libopenmpt cannot load, or a libopenmpt
 * build that fails to initialize (`init`; the next render tries again).
 */
export async function renderModule(bytes, { rate = 48000, maxFrames, deadlineMs = Infinity, solo = null, mute = null } = {}) {
  const start = performance.now();
  if (!Number.isInteger(rate) || rate < 8000 || rate > 192000)
    throw new RenderError('rate', 'rate must be an integer from 8000 to 192000 Hz');
  if (!Number.isInteger(maxFrames) || maxFrames <= 0)
    throw new RenderError('maxFrames', 'maxFrames must be a positive integer');
  if (!(deadlineMs >= 0)) throw new RenderError('deadline', 'deadlineMs must be a number of milliseconds');
  if (solo != null && mute != null) throw new RenderError('channels', 'give solo or mute, not both');
  const soloSet = channelSet(solo, 'solo'), muteSet = channelSet(mute, 'mute');
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) throw new RenderError('module', 'the module is empty');

  const left = new Float32Array(maxFrames), right = new Float32Array(maxFrames);
  const lib = await loadLib();
  let ext = 0, leftPtr = 0, rightPtr = 0;
  try {
    const filePtr = lib._malloc(bytes.length);
    lib.HEAPU8.set(bytes, filePtr);
    // The ext module reaches libopenmpt's interactive interface (channel mute), as the player does.
    ext = lib._openmpt_module_ext_create_from_memory(filePtr, bytes.length, 0, 0, 0, 0, 0, 0, 0);
    lib._free(filePtr);
    const mod = ext ? lib._openmpt_module_ext_get_module(ext) : 0;
    if (!mod) throw new RenderError('load', 'libopenmpt could not load the module');

    const only = soloSet ?? muteSet;
    if (only) {
      const channels = lib._openmpt_module_get_num_channels(mod);
      for (const c of only) if (c >= channels)
        throw new RenderError('channels', `the module has ${channels} channels (0..${channels - 1}); no channel ${c}`);
      const label = new TextEncoder().encode('interactive\0');
      const name = lib._malloc(label.length), iface = lib._malloc(64);
      lib.HEAPU8.set(label, name);
      const found = lib._openmpt_module_ext_get_interface(ext, name, iface, 64);
      const setMute = found ? lib.wasmTable.get(new DataView(lib.HEAPU8.buffer, iface, 64).getUint32(SET_CHANNEL_MUTE * 4, true)) : null;
      lib._free(name); lib._free(iface);
      if (!setMute) throw new RenderError('channels', 'this libopenmpt build has no channel mute; cannot solo or mute');
      for (let c = 0; c < channels; c++) setMute(ext, c, (soloSet ? !soloSet.has(c) : muteSet.has(c)) ? 1 : 0);
    }
    lib._openmpt_module_set_repeat_count(mod, 0); // play once

    leftPtr = lib._malloc(4 * CHUNK);
    rightPtr = lib._malloc(4 * CHUNK);
    let frames = 0, truncated = false, timedOut = false;
    for (;;) {
      if (frames === maxFrames) {
        // Full: the render is truncated if the module has anything left to play.
        truncated = lib._openmpt_module_read_float_stereo(mod, rate, 1, leftPtr, rightPtr) > 0;
        break;
      }
      if (performance.now() - start > deadlineMs) { timedOut = true; break; }
      const n = lib._openmpt_module_read_float_stereo(mod, rate, Math.min(CHUNK, maxFrames - frames), leftPtr, rightPtr);
      if (n === 0) break;
      left.set(lib.HEAPF32.subarray(leftPtr / 4, leftPtr / 4 + n), frames);
      right.set(lib.HEAPF32.subarray(rightPtr / 4, rightPtr / 4 + n), frames);
      frames += n;
    }

    let peak = 0, sumSq = 0, clipped = 0;
    for (const buf of [left, right]) {
      for (let i = 0; i < frames; i++) {
        const v = Math.abs(buf[i]);
        if (v > peak) peak = v;
        if (v > 1) clipped++;
        sumSq += buf[i] * buf[i];
      }
    }
    const rms = frames ? Math.sqrt(sumSq / (frames * 2)) : 0;
    return { left: left.subarray(0, frames), right: right.subarray(0, frames), frames, truncated, timedOut, stats: { peak, rms, clipped } };
  } catch (e) {
    if (!(e instanceof RenderError)) { libPromise = null; ext = 0; leftPtr = rightPtr = 0; }
    throw e instanceof RenderError ? e : new RenderError('wasm', `libopenmpt failed: ${e?.message ?? e}`);
  } finally {
    if (ext) lib._openmpt_module_ext_destroy(ext);
    if (leftPtr) lib._free(leftPtr);
    if (rightPtr) lib._free(rightPtr);
  }
}
