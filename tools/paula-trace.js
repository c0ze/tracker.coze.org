/**
 * paula-trace — what an Amiga tune writes to Paula, call by call, from UADE.
 *
 * UADE (https://zakalwe.fi/uade/, Homebrew `uade`) plays 200+ Amiga music formats by
 * running their own replay code. With `--write-audio` it logs every Paula audio register
 * write (src/include/write_audio_ext.h): a 16-byte header, then 12-byte frames whose
 * big-endian tdelta (Paula colour clocks) has its top byte set for an event frame
 * { channel, type, value } and clear for a frame of four output samples. Events:
 * VOL, PER, DAT, LEN, LCH, LCL, LOOP (the DMA reloaded the sample's loop) and
 * START_BUFFER (DMA switched on: a note starts). The log is streamed, not stored:
 * output frames make it about 2 MB per second of music.
 *
 * A replay routine writes its registers in a burst once per call (a VBlank at 50 Hz, or a
 * CIA timer); `traceAmiga` groups events into calls by the gaps between them and returns
 * each channel's state after every call. Nothing is played aloud: UADE writes its audio
 * to /dev/null.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const PAULA_CLOCK = 3546895; // PAL colour clock, Hz
const PET = { VOL: 1, PER: 2, DAT: 3, LEN: 4, LCH: 5, LCL: 6, LOOP: 7, OUTPUT: 8, START: 9 };
const MAGIC = Buffer.from('uade_osc_0\x00\xec\x17\x31\x03\x09', 'latin1');

/**
 * Run UADE on `file` and collect its Paula events.
 * Returns { clock, seconds, events: [{ t, ch, type, value }] } with `t` in colour clocks.
 * The log goes to UADE's stdout; where UADE cannot reopen /dev/stdout (some sandboxes) it goes
 * to a temporary file instead, deleted afterwards. A UADE that exits with an error, dies on a
 * signal or reports a crashed player is a failed trace, even if it wrote a header first.
 */
export async function readPaulaEvents(file, opts = {}) {
  try {
    return await readPaulaEventsTo(file, '/dev/stdout', opts);
  } catch (e) {
    if (!/Can not open \/dev\/stdout/.test(e.stderr ?? e.message)) throw e;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paula-trace-'));
    try { return await readPaulaEventsTo(file, path.join(dir, 'trace'), opts); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
}

function readPaulaEventsTo(file, out, { seconds = 120, subsong = null, uade = 'uade123' } = {}) {
  const args = ['--stderr', '-k', '0', '-f', '/dev/null', '--write-audio', out, '-t', String(seconds), '-y', '-1'];
  if (subsong !== null) args.push('-s', String(subsong));
  args.push(file);
  return new Promise((resolve, reject) => {
    const proc = spawn(uade, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    const events = [];
    let t = 0, header = null, rest = Buffer.alloc(0), stderr = '';
    // keep the start (player messages) and the end (how the song ended) of UADE's chatter
    proc.stderr.on('data', (d) => { stderr = stderr.length < 4000 ? stderr + d : stderr.slice(0, 2000) + String(d).slice(-2000); });
    const parse = (chunk) => {
      let buf = rest.length ? Buffer.concat([rest, chunk]) : chunk, o = 0;
      if (!header) {
        if (buf.length < 16) { rest = buf; return; }
        header = buf.subarray(0, 16);
        if (!header.subarray(0, MAGIC.length).equals(MAGIC)) { proc.kill(); reject(new Error('not a UADE write-audio stream')); return; }
        o = 16;
      }
      for (; o + 12 <= buf.length; o += 12) {
        const d = buf.readUInt32BE(o);
        t += d & 0xffffff;
        if (d >>> 24 === 0) continue; // four output samples: not needed
        const type = buf.readInt8(o + 5);
        if (type === PET.OUTPUT) continue;
        events.push({ t, ch: buf.readInt8(o + 4), type, value: buf.readUInt16BE(o + 6) });
      }
      rest = buf.subarray(o);
    };
    if (out === '/dev/stdout') proc.stdout.on('data', parse);
    else proc.stdout.resume();
    proc.on('error', reject);
    proc.on('close', (code, signal) => {
      if (out !== '/dev/stdout' && fs.existsSync(out)) parse(fs.readFileSync(out));
      const tail = stderr.replace(/\r/g, '\n').split('\n').filter((l) => l.trim() && !/^Playing time/.test(l)).slice(-3).join(' | ');
      const fail = (message) => reject(Object.assign(new Error(message), { stderr }));
      if (code !== 0 || signal) fail(`uade123 failed (${signal ?? `exit ${code}`}): ${tail}`);
      // UADE's own words when a player dies ("bad song end: score crashed"), not a file name
      else if (/score crashed|song end:.*crash/i.test(stderr)) fail(`the player crashed in UADE: ${tail}`);
      else if (!header) fail(`uade123 produced no trace: ${tail}`);
      else resolve({ clock: PAULA_CLOCK, seconds: t / PAULA_CLOCK, events });
    });
  });
}

// Paula's AUDxVOL: bit 6 set is full volume, else the low six bits (UADE's audio.c); 64 = full
const paulaVolume = (v) => (v & 64 ? 64 : v & 63);

/**
 * Group events into replay calls and return per-call channel state.
 * A gap longer than `gapMs` between register writes starts a new call (4 ms: shorter than
 * the fastest CIA tempo's 9.8 ms, longer than ProTracker's DMA wait between a note's
 * start and its loop writes). Calls in which the routine wrote nothing (a tracker on a quiet
 * tick) are filled in from the call rate, so each entry of `calls` is one tick, up to `end`
 * (colour clocks) when given. One rate for the whole trace: a section at half the tempo that
 * writes on every call looks like ticks with nothing written, and is filled.
 * Returns { callHz, calls: [{ t, ch: [{ per, vol, addr, len, start, loopLen, pointed, lc,
 * lenReg }] }] }: `start` is true when the routine started the DMA on a sample it
 * had just pointed the channel at (a note), `addr` is that sample's start address, `loopLen`
 * the length written after it (1 word = a one-shot that ends in silence).
 */
export function callsFromEvents(events, { gapMs = 4, end = null } = {}) {
  const gap = (gapMs / 1000) * PAULA_CLOCK;
  const state = [0, 1, 2, 3].map(() => ({ per: 0, vol: 0, lch: 0, lcl: 0, len: 0, addr: 0, startLen: 0, loopLen: null, pending: null }));
  const calls = [];
  let cur = null, last = -Infinity;
  const flush = () => {
    if (!cur) return;
    cur.ch = state.map((s, c) => ({ per: s.per, vol: s.vol, addr: s.addr, len: s.startLen, loopLen: s.loopLen,
      start: cur.starts.has(c),
      // the pointer registers after this call, and whether the routine wrote them in it:
      // players that never restart the DMA start a new sound this way at the next reload
      pointed: cur.pointed.has(c), lc: (s.lch << 16) | s.lcl, lenReg: s.len }));
    delete cur.starts; delete cur.pointed;
    calls.push(cur);
  };
  // A DMA switch-on and a buffer reload are both logged as START (custom.c). Only a switch-on
  // is followed, at the next hsync, by LOOP: UADE logs LOOP when the audio state machine leaves
  // its "DMA was just turned on" state (audio.c, state 1) with the pointer still at the loop
  // start. So a START waits for its LOOP, or, if the routine pointed the channel earlier in the
  // same burst, for it re-pointing the channel before that hsync (then pt != lc and no LOOP
  // comes; the DMA has latched the sample already).
  // The sample is the one latched at the START.
  const HSYNCS = 0.0005 * PAULA_CLOCK;
  const confirm = (s, c) => {
    cur.starts.add(c);
    s.addr = s.pending.addr; s.startLen = s.pending.len; s.loopLen = null; s.started = true; s.pointedSinceStart = false;
    s.pending = null;
  };
  for (const e of events) {
    const s = state[e.ch];
    if (e.type === PET.START && s) {
      // A note: the routine switched the DMA on inside its burst, on a channel it has pointed
      // at a sample since the last note (ProTracker writes pointer and length, then DMACON;
      // Art & Magic's player writes them a call before), the first start on that channel in
      // the call. A 1-2 word buffer is a one-shot's silent tail.
      const inCall = cur && e.t - last <= gap;
      s.pending = inCall && s.len > 2 && s.pointedSinceStart && !cur.starts.has(e.ch)
        ? { t: e.t, addr: (s.lch << 16) | s.lcl, len: s.len, pointedHere: cur.pointed.has(e.ch) } : null;
      continue;
    }
    if (s?.pending && e.t - s.pending.t > HSYNCS) s.pending = null;       // a reload: no switch-on followed
    if (e.type === PET.LOOP && s?.pending) { confirm(s, e.ch); continue; }
    // a re-point right after the start counts only when this burst also pointed the channel
    // before it (a reload that happens to precede the routine's pointer writes does not)
    if ((e.type === PET.LCH || e.type === PET.LCL || e.type === PET.LEN) && s?.pending?.pointedHere) confirm(s, e.ch);
    // Only the replay routine's register writes make calls.
    if (e.type !== PET.LOOP && e.type !== PET.START) {
      if (e.t - last > gap) { flush(); cur = { t: e.t, starts: new Set(), pointed: new Set() }; }
      last = e.t;
    } else if (!cur || e.t - last > gap) continue;
    if (!s) continue;
    switch (e.type) {
      case PET.VOL: s.vol = paulaVolume(e.value); break;
      case PET.PER: s.per = e.value; break;
      case PET.LEN: s.len = e.value; if (s.started) s.loopLen = e.value; cur.pointed.add(e.ch); s.pointedSinceStart = true; break;
      case PET.LCH: s.lch = e.value; cur.pointed.add(e.ch); s.pointedSinceStart = true; break;
      case PET.LCL: s.lcl = e.value; cur.pointed.add(e.ch); s.pointedSinceStart = true; break;
      default: break;
    }
  }
  flush();
  // The call period: the commonest spacing (within 2%). Some players also write between their
  // calls (a software mixer refilling buffers); a tracker may write nothing on quiet ticks.
  const gaps = calls.slice(1).map((c, i) => c.t - calls[i].t).filter((g) => g > 0).sort((a, b) => a - b);
  if (!gaps.length) return { callHz: null, calls };
  let best = [];
  for (let i = 0, j = 0; i < gaps.length; i++) {
    while (gaps[i] - gaps[j] > 0.02 * gaps[i]) j++;
    if (i - j + 1 > best.length) best = gaps.slice(j, i + 1);
  }
  // a routine's writes start at varying points of its call (by up to a few percent, alternating
  // early and late): the mean spacing within 15% of the commonest is the call period
  const mode = best[Math.floor(best.length / 2)], around = gaps.filter((g) => Math.abs(g - mode) <= 0.15 * mode);
  let period = around.reduce((a, b) => a + b, 0) / around.length;
  // Under 30 Hz is not a replay rate (CIA tempos start at 12.8 Hz but no player studied runs
  // that slow): a routine that writes only on rows, at speed k. Assume about 50 Hz ticks.
  const hz = PAULA_CLOCK / period;
  if (hz < 30) period /= Math.round(50 / hz);
  // fill the ticks the routine left silent: the state carries over, nothing starts
  const filled = [calls[0]];
  for (let i = 1; i < calls.length; i++) {
    const k = Math.round((calls[i].t - calls[i - 1].t) / period);
    for (let j = 1; j < k; j++) {
      filled.push({ t: calls[i - 1].t + j * period, filled: true, ch: calls[i - 1].ch.map((x) => ({ ...x, start: false, pointed: false })) });
    }
    filled.push(calls[i]);
  }
  // and the ticks after the last write, to the end of the trace: a note held to the end lasts
  for (let t = calls.at(-1).t + period; end !== null && t <= end; t += period) {
    filled.push({ t, filled: true, ch: calls.at(-1).ch.map((x) => ({ ...x, start: false, pointed: false })) });
  }
  return { callHz: PAULA_CLOCK / period, calls: filled };
}

export async function traceAmiga(file, opts = {}) {
  const { events, seconds } = await readPaulaEvents(file, opts);
  return { file, seconds, ...callsFromEvents(events, { ...opts, end: seconds * PAULA_CLOCK }) };
}

// Paula period -> pitch. ProTracker's period 428 is its C-2 (8287 Hz for a sample at its
// base rate), which these names call C-2; a module's samples set their own root, so the
// names are for intervals and registers, not concert pitch.
export const periodToSemitone = (per) => (per > 0 ? 24 + 12 * Math.log2(428 / per) : null);
const NAMES = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];
export const semitoneName = (s) => (s === null ? '---' : NAMES[((Math.round(s) % 12) + 12) % 12] + Math.floor(Math.round(s) / 12));
