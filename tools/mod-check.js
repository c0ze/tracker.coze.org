#!/usr/bin/env node
/**
 * mod-check — judge a ProTracker MOD as ptplayer plays it on Paula: is every
 * held note in tune, and do its loops image below 16 kHz?
 *
 * Usage: node tools/mod-check.js build/<song>.mod [...]   (exit 1 on a failure)
 *
 * Two things put an exported lead off key (docs/handoff-2026-10-22-mod-tuning.md):
 * - ProTracker's periods are whole numbers, so a note lands 0 to 6 cents off
 *   equal temperament depending on the note;
 * - Paula plays a sample without interpolation, a zero-order hold (HRM 05
 *   "Aliasing distortion"): a loop of L samples holding c cycles has lines at
 *   m x fs / L, and those with m not a multiple of c are images between the
 *   harmonics, an out-of-tune shimmer. ptplayer switches the LED filter off,
 *   so images up to 16 kHz are heard.
 *
 * The song is replayed tick by tick as ptplayer 6 plays it (mt_music,
 * mt_checkfx, mt_checkmorefx): notes, 1xx/2xx and E1x/E2x slides, 3xx/5xy
 * glides, 4xy/6xy sine vibrato, 0xy arpeggio, pattern delay, mt_pernop
 * (tick 0 for effects 0-8 and A, later ticks for no effect) and set_pervol
 * (the volume slides A, 5, 6, EAx and EBx write the period back). The period that
 * sounds on a tick is the last one written to AUDxPER by then. Over the song's
 * path and its loop, until the channels' state repeats:
 * - images: every whole-sample loop with two cycles or more, at every period
 *   that sounds while the channel has it selected (a sample given with no note
 *   plays at the channel's period), must stay under LIMIT_DB below BAND_HZ;
 *   a channel at volume 0 is not heard, so its periods are not judged;
 * - tuning: every single waveform's held pitches (singleWave) must be within
 *   TUNE_CENTS of equal temperament (A-4 = 440 Hz). Held: a note, an arpeggio step, a
 *   glide's arrival, and a period that sounds on every tick of a row; not what
 *   a glide, a slide or a vibrato passes through. A period overwritten on the
 *   same tick (a note with E1x) never sounds and is not judged.
 * What it can't model it refuses: finetune, E3x-E6x, EDx, F00.
 */
import fs from 'fs';
import { pathToFileURL } from 'url';
import { PAL_CLOCK, PERIODS, BAND_HZ } from './mod-samples.js';

export const LIMIT_DB = -37;      // images under the harmonics (8-bit's own floor is about -39 to -53)
export const TUNE_CENTS = 3;      // a held note against equal temperament
export const SINGLE_CYCLE_BYTES = 4096;   // the longest loop the exporter builds for a single-cycle waveform
export const WAVE_HARMONICS = 16;         // a single waveform's strongest line is one of its first harmonics
const TABLE = [...PERIODS];       // ptplayer mt_Tuning0, C-1..B-3
const SINE = [0, 24, 49, 74, 97, 120, 141, 161, 180, 197, 212, 224, 235, 244, 250, 253,
  255, 253, 250, 244, 235, 224, 212, 197, 180, 161, 141, 120, 97, 74, 49, 24];
// ptplayer's mt_VibratoSineTable (64 x amplitude + position), checked against ptplayer 6.4's table
const vibrato = (amp, pos) => { const d = (SINE[pos & 31] * amp) >> 7; return pos & 32 ? -d : d; };
const ARP = [0, 1, 2];            // arptab by mt_Counter: the note, then x, then y

/** Parse an M.K. module: { title, samples[31] { name, len, fine, vol, rep, replen (bytes), data Int8Array }, songlen, orders, patterns }. */
export function parseMod(buf) {
  const b = Buffer.from(buf);
  if (b.toString('latin1', 1080, 1084) !== 'M.K.') throw new Error('not a 4-channel M.K. module');
  const songlen = b[950], orders = [...b.subarray(952, 1080)];
  const npat = Math.max(...orders) + 1, patterns = [];
  for (let p = 0; p < npat; p++) patterns.push(b.subarray(1084 + p * 1024, 1084 + (p + 1) * 1024));
  let at = 1084 + npat * 1024;
  const samples = [];
  for (let i = 0; i < 31; i++) {
    const o = 20 + i * 30, len = b.readUInt16BE(o + 22) * 2;
    samples.push({
      name: b.toString('latin1', o, o + 22).replace(/\0.*$/s, ''), len, fine: b[o + 24] & 15, vol: b[o + 25],
      rep: b.readUInt16BE(o + 26) * 2, replen: b.readUInt16BE(o + 28) * 2,
      data: new Int8Array(b.buffer.slice(b.byteOffset + at, b.byteOffset + at + len)),
    });
    at += len;
  }
  return { title: b.toString('latin1', 0, 20).replace(/\0.*$/s, ''), samples, songlen, orders, patterns };
}

export const cellAt = (pat, row, ch) => {
  const o = 16 * row + 4 * ch;
  return { smp: (pat[o] & 0xf0) | (pat[o + 2] >> 4), per: ((pat[o] & 15) << 8) | pat[o + 1], cmd: pat[o + 2] & 15, par: pat[o + 3] };
};

/** The rows in play order, as ptplayer steps: { rows: [[order, row]], loop }. Bxx sets the break row back to 0. */
export function modPath(mod) {
  const seen = new Map(), rows = [];
  let order = 0, row = 0;
  for (;;) {
    if (order >= mod.songlen) order = 0;            // the order wraps, the break row stays
    const key = `${order}:${row}`;
    if (seen.has(key)) return { rows, loop: seen.get(key) };
    seen.set(key, rows.length);
    rows.push([order, row]);
    const pat = mod.patterns[mod.orders[order]];
    let jump = null, brk = null;
    for (let c = 0; c < 4; c++) {
      const { cmd, par } = cellAt(pat, row, c);
      if (cmd === 0xb) { jump = par; brk = null; }
      else if (cmd === 0xd) { brk = (par >> 4) * 10 + (par & 15); if (brk > 63) brk = 0; }
    }
    if (jump != null || brk != null) [order, row] = [jump ?? order + 1, brk ?? 0];
    else if (row === 63) [order, row] = [order + 1, 0];
    else row++;
  }
}

/**
 * Replay the song: { all, held } (Map sample number -> Set of periods: every
 * period that sounds with the sample selected, and the held ones), plus
 * `refused`, the effects the replay does not model. `trace`, if given, is
 * called with { order, row, channel, sample, period } for each held period.
 */
export function soundingPeriods(mod, { trace } = {}) {
  const { rows, loop } = modPath(mod), refused = new Set();
  mod.samples.forEach((s, i) => { if (s.len && s.fine) refused.add(`sample ${i + 1} has finetune ${s.fine}`); });
  const chans = Array.from({ length: 4 }, () => ({
    period: 0, noteoff: 0, wanted: 0, tpspeed: 0, vamp: 0, vspd: 0, vpos: 0, smp: 0, sound: 0, held: false, vol: 0,
  }));
  const all = new Map(), held = new Map(), seen = new Set();
  let at = null;
  const add = (m, c, v) => {
    const s = chans[c].smp;
    if (!s || !v || !chans[c].vol) return;          // a channel at volume 0 is not heard
    (m.get(s) ?? m.set(s, new Set()).get(s)).add(v);
    if (trace && m === held) trace({ order: at[0], row: at[1], channel: c, sample: s, period: v });
  };
  let speed = 6;
  for (let turn = 0; turn < 1000; turn++) {
    for (const [order, r] of turn ? rows.slice(loop) : rows) {
      at = [order, r];
      const pat = mod.patterns[mod.orders[order]], cells = [0, 1, 2, 3].map((c) => cellAt(pat, r, c));
      let delay = 0;
      for (const { cmd, par } of cells) {
        if (cmd === 0xf && par > 0 && par < 32) speed = par;
        if (cmd === 0xf && par === 0) refused.add('F00 (stop)');
        if (cmd === 0xe && par >> 4 === 0xe) delay = par & 15;
        if (cmd === 0xe && [3, 4, 5, 6, 0xd].includes(par >> 4)) refused.add(`E${(par >> 4).toString(16).toUpperCase()}x`);
      }
      const ticks = [[], [], [], []];
      let base = chans.map((ch) => [ch.sound, ch.held]);
      // a write: the tick's sounding period so far; held if the write is, or if it
      // restates the period the tick started with and that one was held
      const write = (c, v, isHeld = false) => {
        const ch = chans[c];
        ch.sound = v;
        ch.held = isHeld || (v === base[c][0] && base[c][1]);
      };
      const endTick = () => {
        chans.forEach((ch, c) => {
          ticks[c].push(ch.sound);
          add(all, c, ch.sound);
          if (ch.held) add(held, c, ch.sound);
        });
        base = chans.map((ch) => [ch.sound, ch.held]);
      };
      cells.forEach(({ smp, per, cmd, par }, c) => {     // tick 0: mt_playvoice, then mt_checkmorefx
        const ch = chans[c], x = par >> 4, y = par & 15;
        if (smp > 0 && smp <= 31) { ch.smp = smp; ch.vol = Math.min(64, mod.samples[smp - 1].vol); }
        if (cmd === 0xc) ch.vol = Math.min(64, par);
        else if (cmd === 0xe && x === 0xa) ch.vol = Math.min(64, ch.vol + y);
        else if (cmd === 0xe && x === 0xb) ch.vol = Math.max(0, ch.vol - y);
        else if (cmd === 0xe && x === 0xc && y === 0) ch.vol = 0;
        if (per) {
          const j = TABLE.findIndex((p) => per >= p), k = j < 0 ? 35 : j;
          ch.noteoff = k;
          if (cmd === 3 || cmd === 5) ch.wanted = TABLE[k] === ch.period ? 0 : TABLE[k];
          else {
            ch.period = TABLE[k];
            write(c, ch.period, true);
            ch.vpos = 0;
          }
        }
        if (cmd === 0xe && x === 1) { ch.period = Math.max(113, ch.period - y); write(c, ch.period); }
        else if (cmd === 0xe && x === 2) { ch.period = Math.min(856, ch.period + y); write(c, ch.period); }
        if ((cmd <= 8 || cmd === 0xa) && ch.period) write(c, ch.period);   // mt_pernop
        if (cmd === 0xe && (x === 0xa || x === 0xb) && ch.period) write(c, ch.period);   // fine volume slides end in set_pervol
      });
      endTick();
      const later = (t, first) => cells.forEach(({ cmd, par }, c) => {   // mt_checkfx
        const ch = chans[c], x = par >> 4, y = par & 15;
        if (cmd === 0xa || cmd === 5 || cmd === 6) ch.vol = x ? Math.min(64, ch.vol + x) : Math.max(0, ch.vol - y);
        else if (cmd === 0xe && x === 0xc && t === y) ch.vol = 0;
        else if (cmd === 0xe && first && x === 0xa) ch.vol = Math.min(64, ch.vol + y);
        else if (cmd === 0xe && first && x === 0xb) ch.vol = Math.max(0, ch.vol - y);
        if (cmd === 0 && !par) { if (ch.period) write(c, ch.period); }
        else if (cmd === 0) {
          const step = ARP[t % 3];
          if (!step) { if (ch.period) write(c, ch.period, TABLE.includes(ch.period)); }
          else if (ch.noteoff + (step === 1 ? x : y) < 36) write(c, TABLE[ch.noteoff + (step === 1 ? x : y)], true);
        } else if (cmd === 1) { ch.period = Math.max(113, ch.period - par); write(c, ch.period); }
        else if (cmd === 2) { ch.period = Math.min(856, ch.period + par); write(c, ch.period); }
        else if (cmd === 3 || cmd === 5) {
          if (cmd === 3 && par) ch.tpspeed = par;
          if (!ch.wanted) return;
          const up = ch.period >= ch.wanted;
          let p = up ? ch.period - ch.tpspeed : ch.period + ch.tpspeed;
          const arrived = up ? p <= ch.wanted : p >= ch.wanted;
          if (arrived) { p = ch.wanted; ch.wanted = 0; }
          ch.period = p;
          write(c, p, arrived);
        } else if (cmd === 4 || cmd === 6) {
          if (cmd === 4) { if (y) ch.vamp = y; if (x) ch.vspd = x; }
          write(c, ch.period + vibrato(ch.vamp, ch.vpos & 63));
          ch.vpos = (ch.vpos + ch.vspd) & 0xff;
        } else if (cmd === 0xe && first && (x === 1 || x === 2)) {   // a pattern delay replays fine slides
          ch.period = x === 1 ? Math.max(113, ch.period - y) : Math.min(856, ch.period + y);
          write(c, ch.period);
        }
        // mt_volumeslide (A, and 5 and 6 after their glide or vibrato) and the
        // fine volume slides end in set_pervol, which writes the period back
        if ((cmd === 0xa || cmd === 5 || cmd === 6 || (cmd === 0xe && first && (x === 0xa || x === 0xb))) && ch.period)
          write(c, ch.period);
      });
      for (let t = 1; t < speed; t++) { later(t, false); endTick(); }
      for (let d = 0; d < delay; d++) for (let t = 0; t < speed; t++) { later(t, t === 0); endTick(); }
      ticks.forEach((ts, c) => { if (ts.every((v) => v === ts[0])) add(held, c, ts[0]); });   // the same period all row
    }
    const key = JSON.stringify([speed, chans]);
    if (seen.has(key)) break;
    seen.add(key);
  }
  return { all, held, refused: [...refused] };
}

// In-place radix-2 FFT, and Bluestein's algorithm for any length.
function fft2(re, im, inv = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (inv ? 2 : -2) * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ur = re[i + k], ui = im[i + k], vr = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci;
        const vi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ur + vr; im[i + k] = ui + vi; re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
        [cr, ci] = [cr * wr - ci * wi, cr * wi + ci * wr];
      }
    }
  }
}

/** |DFT|^2 of a real signal, all L bins. */
export function power(y) {
  const L = y.length;
  let m = 1;
  while (m < 2 * L - 1) m <<= 1;
  const wr = new Float64Array(L), wi = new Float64Array(L);
  for (let k = 0; k < L; k++) { const a = -Math.PI * ((k * k) % (2 * L)) / L; wr[k] = Math.cos(a); wi[k] = Math.sin(a); }
  const ar = new Float64Array(m), ai = new Float64Array(m), br = new Float64Array(m), bi = new Float64Array(m);
  for (let k = 0; k < L; k++) { ar[k] = y[k] * wr[k]; ai[k] = y[k] * wi[k]; }
  br[0] = wr[0]; bi[0] = -wi[0];
  for (let k = 1; k < L; k++) { br[k] = br[m - k] = wr[k]; bi[k] = bi[m - k] = -wi[k]; }
  fft2(ar, ai); fft2(br, bi);
  for (let k = 0; k < m; k++) { const r = ar[k] * br[k] - ai[k] * bi[k]; ai[k] = ar[k] * bi[k] + ai[k] * br[k]; ar[k] = r; }
  fft2(ar, ai, true);
  const p = new Float64Array(L);
  for (let k = 0; k < L; k++) {
    const r = (ar[k] * wr[k] - ai[k] * wi[k]) / m, i = (ar[k] * wi[k] + ai[k] * wr[k]) / m;
    p[k] = r * r + i * i;
  }
  return p;
}

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
/**
 * Cycles in a loop: the gcd of the DFT bins within 20 dB of the strongest. A
 * weaker line off that grid (a stray component, the images themselves) can't
 * pull the count down to 1 and hide the images: imageDb counts every line off
 * the grid as inharmonic.
 */
export function cycles(y, p = power(y)) {
  let max = 0;
  for (let k = 1; k <= y.length >> 1; k++) max = Math.max(max, p[k]);
  if (max <= 0) return 0;
  let c = 0;
  for (let k = 1; k <= y.length >> 1; k++) if (p[k] >= max * 1e-2) c = gcd(c, k);
  return c;
}

/**
 * Whether a loop of c cycles is a single waveform whose pitch the replay can
 * read: at most SINGLE_CYCLE_BYTES, its strongest line among its first
 * WAVE_HARMONICS harmonics. A multi-cycle loop (a pwm sweep, a pad, noise)
 * reads as one cycle of the whole loop, its strongest line far above.
 */
export function singleWave(y, c, p = power(y)) {
  if (y.length > SINGLE_CYCLE_BYTES || c < 1) return false;
  let at = 1;
  for (let k = 1; k <= y.length >> 1; k++) if (p[k] > p[at]) at = k;
  return at <= WAVE_HARMONICS * c;
}

/** Inharmonic over harmonic energy (dB) of loop `y` (c cycles) held by Paula at fs, below BAND_HZ. */
export function imageDb(y, c, fs, p = power(y)) {
  const L = y.length, M = Math.floor(BAND_HZ * L / fs);
  let harm = 0, inh = 0;
  for (let m = 1; m <= M; m++) {
    const x = Math.PI * m / L, hold = Math.sin(x) / x, w = p[m % L] * hold * hold;
    if (m % c === 0) harm += w; else inh += w;
  }
  return harm > 0 ? 10 * Math.log10(inh / harm + 1e-20) : -Infinity;
}

/** Cents of frequency f from the nearest equal-tempered note (A-4 = 440 Hz). */
export const etCents = (f) => (((1200 * Math.log2(f / 440)) % 100) + 150) % 100 - 50;

/**
 * The gate: a message for each failure (empty when the MOD passes), and per
 * sample the worst image and tuning found, for reports.
 */
export function checkMod(mod, { limit = LIMIT_DB } = {}) {
  const fails = [], worst = new Map(), { all, held, refused } = soundingPeriods(mod);
  for (const r of refused) fails.push(`not modelled by the replay: ${r}`);
  for (const [n, periods] of [...all].sort((a, b) => a[0] - b[0])) {
    const s = mod.samples[n - 1];
    if (!s || s.rep || s.replen < 4 || s.replen !== s.len) continue;   // one-shots and partial loops
    const y = Float64Array.from(s.data, (v) => v / 128), p = power(y), c = cycles(y, p);
    if (c < 1) continue;
    const w = { tune: null, image: null };
    if (singleWave(y, c, p)) {                      // a single waveform: every held note in tune
      for (const per of [...(held.get(n) ?? [])].sort((a, b) => a - b)) {
        const cents = etCents(PAL_CLOCK / per * c / y.length);
        if (!w.tune || Math.abs(cents) > Math.abs(w.tune.cents)) w.tune = { cents, period: per };
        if (Math.abs(cents) > TUNE_CENTS)
          fails.push(`sample ${n} (${s.name}): held at period ${per} it is ${cents >= 0 ? '+' : ''}${cents.toFixed(1)} cents off equal temperament, over ${TUNE_CENTS}`);
      }
    }
    if (c >= 2) {                                   // a whole number of samples a cycle has no images between the harmonics
      for (const per of periods) {
        const db = imageDb(y, c, PAL_CLOCK / per, p);
        if (!w.image || db > w.image.db) w.image = { db, period: per };
      }
      if (w.image.db > limit)
        fails.push(`sample ${n} (${s.name}): at period ${w.image.period} (${Math.round(PAL_CLOCK / w.image.period)} Hz) its images are ${w.image.db.toFixed(1)} dB under the harmonics, over ${limit} dB`);
    }
    worst.set(n, w);
  }
  return { fails, worst };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = process.argv.slice(2);
  if (!files.length) { console.error('Usage: node tools/mod-check.js <song.mod> [...]'); process.exit(1); }
  let bad = 0;
  for (const f of files) {
    const { fails } = checkMod(parseMod(fs.readFileSync(f)));
    console.log(`${f}: ${fails.length ? `${fails.length} failures` : 'ok'}`);
    for (const m of fails) console.log(`  ${m}`);
    bad += fails.length > 0;
  }
  process.exit(bad ? 1 : 0);
}
