// Traces any PSID/RSID file in cRSID (player/vendor/crsid/crsid.wasm): the SID registers once
// per play call, for studying how a tune is built (tools/sid-study.js). Unlike sid-run.js,
// which calls our own driver's play routine directly, this runs the tune as a player does
// (cRSID calls play on its timer, or runs the tune's own interrupts for RSID).
//
// It finds the play calls exactly where it can: a PSID's play address is replaced by a stub in
// free memory that writes a count to $D41F (no SID register) and jumps to the real routine.
// Where it cannot (RSID, play address 0, play under ROM, no free memory), it guesses the calls
// from the bursts of register writes they make.
import crypto from 'crypto';
import { loadCrsid } from './sid-run.js';

export { loadCrsid };

const CLOCK = { PAL: 985248, NTSC: 1022727 };
// One video frame in CPU cycles: lines x cycles per line (vic-ii.txt; cRSID C64.c).
const FRAME_CYCLES = { PAL: 312 * 63, NTSC: 263 * 65 };
const SAMPLE_RATE = 44100;     // loadCrsid() initialises cRSID at this rate
const CHUNK = 4;               // samples rendered between register reads (about 90 cycles)
const QUIET = 12;              // chunks without a write that separate two play calls

const text = (b, at) => String.fromCharCode(...b.slice(at, at + 32)).replace(/\0.*$/s, '').trim();

/** The PSID/RSID header (SID_file_format.txt). */
export function parseSidHeader(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const magic = String.fromCharCode(...bytes.slice(0, 4));
  if (magic !== 'PSID' && magic !== 'RSID') throw new Error('not a PSID or RSID file');
  const version = v.getUint16(4), dataOffset = v.getUint16(6);
  const flags = version >= 2 ? v.getUint16(0x76) : 0;
  const clockBits = (flags >> 2) & 3, modelBits = (flags >> 4) & 3;
  const h = {
    magic, version, dataOffset,
    load: v.getUint16(8) || bytes[dataOffset] | (bytes[dataOffset + 1] << 8),
    embeddedLoad: !v.getUint16(8), // the load address is the data's first two bytes
    init: v.getUint16(0x0a), play: v.getUint16(0x0c),
    songs: v.getUint16(0x0e), startSong: v.getUint16(0x10), speed: v.getUint32(0x12),
    title: text(bytes, 0x16), author: text(bytes, 0x36), released: text(bytes, 0x56),
    video: clockBits === 2 ? 'NTSC' : 'PAL',
    model: ['unknown', '6581', '8580', '6581/8580'][modelBits],
    extraSids: version >= 3 && bytes[0x7a] ? (version >= 4 && bytes[0x7b] ? 2 : 1) : 0,
    // Free memory for relocation (v2+): page 0 means only the tune's own range is used, $FF none.
    startPage: version >= 2 ? bytes[0x78] : null, pageLength: version >= 2 ? bytes[0x79] : 0,
  };
  return h;
}

/** True when song n (1-based) is called on a CIA timer rather than the vertical blank. */
export function ciaTimed(h, n) {
  if (h.magic === 'RSID') return null; // the tune sets up its own interrupts
  return Boolean(h.speed & (1 << Math.min(31, n - 1)));
}

/** HVSC Songlengths.md5 text -> Map(md5 -> [seconds per song]). */
export function parseSonglengths(textData) {
  const map = new Map();
  for (const line of textData.split(/\r?\n/)) {
    const m = /^([0-9a-f]{32})=(.*)$/.exec(line.trim());
    if (!m) continue;
    map.set(m[1], m[2].trim().split(/\s+/).map((t) => {
      const [mm, ss] = t.replace(/\(.*\)$/, '').split(':');
      return Number(mm) * 60 + Number(ss);
    }));
  }
  return map;
}

export const md5 = (bytes) => crypto.createHash('md5').update(bytes).digest('hex');

/** Where the call stub can go (an address in RAM the tune leaves alone), or null. */
function stubAddress(h, dataLength) {
  if (h.magic !== 'PSID' || !h.play) return null;
  // The stub runs with the banking cRSID sets up for the play address: keep both in plain RAM.
  const ram = (a) => (a >= 0x0400 && a < 0xa000) || (a >= 0xc000 && a < 0xd000);
  if (!ram(h.play)) return null;
  const end = h.load + dataLength;
  const free = (a) => ram(a) && ram(a + 15) && (a + 16 <= h.load || a >= end);
  if (h.startPage && h.startPage !== 0xff) return free(h.startPage << 8) ? h.startPage << 8 : null;
  if (h.startPage === 0) return [0xc000, 0x0400, 0x9f00].find(free) ?? null; // a "clean" tune
  return null; // no information (v1) or no free memory
}

/**
 * The smallest period (in chunks, up to `max`) at which nearly every burst start finds another
 * one a period later. A call that writes in two bursts does not fool it: the gap inside a call
 * does not repeat from the call's second burst. Returns null without a period.
 */
function measurePeriod(bursts, chunks, max) {
  // A player's first write moves a few chunks from call to call: look within half a quiet gap.
  const tol = QUIET >> 1, sum = new Uint32Array(chunks + 2);
  for (const c of bursts) sum[c + 1]++;
  for (let i = 1; i < sum.length; i++) sum[i] += sum[i - 1];
  const near = (c) => sum[Math.min(chunks + 1, c + tol + 1)] - sum[Math.max(0, c - tol)] > 0;
  const score = (p) => {
    let hit = 0, n = 0;
    for (const c of bursts) {
      if (c + p + tol >= chunks) break;
      n++;
      if (near(c + p)) hit++;
    }
    return n ? hit / n : 0;
  };
  const scores = [];
  for (let p = QUIET + 1; p <= Math.ceil(max); p++) scores.push([p, score(p)]);
  const best = Math.max(...scores.map(([, v]) => v));
  if (!(best > 0)) return null;
  return scores.find(([, v]) => v >= 0.9 * best)[0];
}

/**
 * Runs `seconds` of song `song` and returns the registers after each play call:
 * { header, song, clock, video, cyclesPerCall, callsPerFrame, callsPerSecond, calls, regs, fit,
 * bursts } where regs is a Uint8Array of calls x 25 ($D400-$D418, the values last written) and
 * fit is the share of calls with writes that write in one burst (below about 0.8 the period
 * may be wrong).
 */
export function traceSid(w, bytes, { song, seconds = 60 } = {}) {
  const header = parseSidHeader(bytes);
  const n = song ?? header.startSong ?? 1;
  if (bytes.length > w.crsid_file_max()) throw new Error('tune too large');
  const stub = stubAddress(header, bytes.length - header.dataOffset - (header.embeddedLoad ? 2 : 0));
  const file = new Uint8Array(bytes);
  if (stub !== null) new DataView(file.buffer).setUint16(0x0c, stub);
  new Uint8Array(w.memory.buffer).set(file, w.crsid_file());
  if (w.crsid_load(file.length, n)) throw new Error('cRSID rejected the file');
  if (stub !== null) {
    // lda #1 / sta $d41f / inc stub+1 / jmp play: a new value in $D41F on every call.
    const code = [0xa9, 1, 0x8d, 0x1f, 0xd4, 0xee, (stub + 1) & 0xff, (stub + 1) >> 8, 0x4c, header.play & 0xff, header.play >> 8];
    code.forEach((b, i) => w.crsid_poke(stub + i, b));
  }
  const video = header.video, clock = CLOCK[video];
  // cRSID advances (clock << 4) / rate sixteenths of a cycle per sample (C64.c).
  const cyclesPerChunk = (Math.floor((clock << 4) / SAMPLE_RATE) / 16) * CHUNK;
  const chunks = Math.ceil((seconds * SAMPLE_RATE) / CHUNK);

  // Every chunk's registers, the chunks where a burst of writes begins, and with the stub the
  // chunks where a call begins.
  const all = new Uint8Array(chunks * 25), starts = [], calls = [];
  const prev = new Uint8Array(25);
  let quiet = QUIET, count = w.crsid_sid(31);
  for (let c = 0; c < chunks; c++) {
    w.crsid_render(CHUNK);
    let changed = false;
    for (let r = 0; r < 25; r++) {
      const x = w.crsid_sid(r);
      // $D418 is left out: a tune playing samples through the volume writes it all the time.
      if (x !== prev[r] && r < 24) changed = true;
      prev[r] = x;
      all[c * 25 + r] = x;
    }
    if (changed) {
      if (quiet >= QUIET) starts.push(c);
      quiet = 0;
    } else quiet++;
    if (stub !== null && w.crsid_sid(31) !== count) { count = w.crsid_sid(31); calls.push(c); }
  }
  if (!starts.length && !calls.length) throw new Error('no register writes');

  let out, period, fit;
  if (stub !== null && calls.length > 1) {
    // The registers just before each call (the first sample is what init left).
    out = calls.map((c) => c - 1).filter((c) => c >= 0);
    period = (calls[calls.length - 1] - calls[0]) / (calls.length - 1);
    fit = 1;
  } else {
    ({ out, period, fit } = guessCalls(starts, chunks, FRAME_CYCLES[video] / cyclesPerChunk));
  }
  const regs = new Uint8Array(out.length * 25);
  out.forEach((at, i) => regs.set(all.subarray(at * 25, at * 25 + 25), i * 25));
  const cyclesPerCall = period * cyclesPerChunk;
  return {
    header, song: n, clock, video, cia: ciaTimed(header, n), regs, calls: out.length, fit, bursts: starts.length,
    method: stub !== null && calls.length > 1 ? 'hooked' : 'bursts',
    cyclesPerCall: Math.round(cyclesPerCall),
    callsPerFrame: +(FRAME_CYCLES[video] / cyclesPerCall).toFixed(2),
    callsPerSecond: +(clock / cyclesPerCall).toFixed(2),
  };
}

// Without the stub: the call period and phase from the bursts of writes. Returns the chunks to
// sample (just before each call), the period in chunks and the fit: of the call intervals with
// any writes, the share that hold exactly one burst (about 1 when the period is right, however
// late a player writes; low when calls do not all write, or write in several bursts).
function guessCalls(starts, chunks, frame) {
  // cRSID calls a PSID on the vertical blank unless its init set a CIA timer (whatever the
  // header says), and an RSID runs its own interrupts. The init's writes (chunk 0) are left out.
  const bursts = starts.filter((c) => c > 0);
  let period = bursts.length < 3 ? frame : measurePeriod(bursts, chunks, 2 * frame);
  if (period === null) throw new Error('no play calls found (silent tune?)');
  // Phase: where a call starts. Writes come some time after it, so on the circle of one period
  // they gather into a cluster; the call starts at the cluster's first write, after the largest gap.
  const phaseOf = (p) => {
    const r = bursts.map((c) => c % p).sort((a, b) => a - b);
    if (!r.length) return 0;
    let at = r[0], gap = r[0] + p - r[r.length - 1];
    for (let i = 1; i < r.length; i++) if (r[i] - r[i - 1] > gap) { gap = r[i] - r[i - 1]; at = r[i]; }
    return at;
  };
  // Refine over longer and longer spans: the mean distance between bursts m periods apart.
  for (let m = 1; m <= 64; m *= 2) {
    const tol = QUIET >> 1, ds = [];
    for (let i = 0, j = 0; i < bursts.length; i++) {
      while (j < bursts.length && bursts[j] < bursts[i] + m * period - tol) j++;
      if (j < bursts.length && bursts[j] <= bursts[i] + m * period + tol) ds.push((bursts[j] - bursts[i]) / m);
    }
    if (ds.length >= 3) period = ds.reduce((a, b) => a + b, 0) / ds.length;
  }
  if (Math.abs(period - frame) < frame / 100) period = frame; // the vertical blank, exactly
  const phase = phaseOf(period);

  const perCall = new Map();
  for (const c of bursts) {
    const k = Math.floor((c - phase) / period);
    perCall.set(k, (perCall.get(k) || 0) + 1);
  }
  const fit = perCall.size ? +([...perCall.values()].filter((x) => x === 1).length / perCall.size).toFixed(2) : 0;
  // The registers just before each call, from the first call seen (the first sample is what
  // init left).
  const first = bursts.length ? phase + period * Math.round((bursts[0] - phase) / period) : phase;
  const out = [];
  for (let k = 0; ; k++) {
    const at = Math.floor(first + k * period) - 1;
    if (at >= chunks) break;
    if (at >= 0) out.push(at);
  }
  return { out, period, fit };
}
