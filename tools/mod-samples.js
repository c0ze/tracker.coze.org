/**
 * ProTracker (4-channel MOD) samples from resolved cozy-tracker samples.
 *
 * A MOD note is a Paula period from ProTracker's table (C-1..B-3), and the
 * sample plays at PAL_CLOCK / period bytes per second. Each sample is
 * resampled so the notes the song gives it land in that range:
 *
 * - the song's highest note for the sample (arpeggio offsets included) maps
 *   to the highest period that neither upsamples the source nor goes above
 *   A-3 (period 127); a single-cycle loop (a whole-sample loop of at most
 *   SINGLE_CYCLE source samples: a lead's or a bass's waveform) is rebuilt
 *   from its harmonics, so it may go higher than its source, and its top may
 *   sit under A-3 (`topNote`, chosen by mod-copies.js);
 * - one-shots are resampled with a windowed sinc; a loop covering the whole
 *   sample is resynthesized from its Fourier series with an exact whole
 *   number of periods (up to 128 within 4,096 bytes, or a song's
 *   `modLoopMax`), so it stays seamless and in tune;
 * - a single-cycle loop is retuned so the ProTracker period errors of the
 *   notes it plays centre on zero, and keeps only the harmonics whose Paula
 *   images stay above BAND_HZ at its lowest note (mod-copies.js gives a wide
 *   lead copies by note range, so that cap stays small);
 * - output is signed 8-bit, at most 65535 words (AUDxLEN is 16 bits).
 *
 * Hardware facts (Amiga Hardware Reference Manual, chapter 5 "Audio"):
 * PAL clock constant 3,546,895 ticks/s ("Clock values"); the period must be
 * at least 123 on PAL (124 NTSC), or DMA reuses samples ("Limitations on
 * selection of sampling period"). ProTracker's A#3 (120) and B-3 (113) break
 * that rule, so they are never used.
 */

export const PAL_CLOCK = 3546895;
// ProTracker 2.3 period table, finetune 0, C-1..B-3 (ptplayer.asm mt_Tuning0).
export const PERIODS = [
  856, 808, 762, 720, 678, 640, 604, 570, 538, 508, 480, 453,
  428, 404, 381, 360, 339, 320, 302, 285, 269, 254, 240, 226,
  214, 202, 190, 180, 170, 160, 151, 143, 135, 127, 120, 113,
];
export const TOP_NOTE = 33;              // A-3, period 127
export const MIN_PERIOD = 123;           // PAL minimum; slides and vibrato stay at or above it
export const MAX_BYTES = 65535 * 2;
// Paula holds each sample (HRM 05 "Aliasing distortion"), so harmonic k of a loop
// at fs images at fs - k x f0; ptplayer switches the LED filter off, so images up
// to 16 kHz are heard (tools/mod-check.js).
export const BAND_HZ = 16000;
const IT_C5 = 60;                         // cozy-tracker note number of C-5
const modRate = (m) => PAL_CLOCK / PERIODS[m];

/** Playback rate an IT note asks of a sample (c5speed at C-5). */
export const itRate = (s, n) => (s.c5speed || s.samplerate) * 2 ** ((n - IT_C5) / 12);

const mono = (s) => s.channels.length === 1 ? Array.from(s.channels[0])
  : s.channels[0].map((v, i) => (v + s.channels[1][i]) / 2);
/**
 * MOD loops run forwards only and have no sustain phase: unfold a ping-pong
 * loop into forward PCM (it plays exactly as before) and play a sustain loop
 * as the loop when the sample has no other, reporting it through `warn`.
 */
export function forwardLoops(s, warn) {
  let out = s;
  if (s.susloop && !s.loop) {
    warn(`${s.name}: sustain loop played as a normal loop (MOD has no note-off)`);
    out = { ...s, loop: s.susloop };
  } else if (s.susloop) warn(`${s.name}: sustain loop dropped (MOD has one loop)`);
  if (out.loop?.pingpong) {
    const n = out.channels[0].length, a = out.loop.start || 0, b = Math.min(out.loop.end ?? n, n);
    const channels = out.channels.map((ch) => {
      const fwd = Array.from(ch).slice(0, b);
      for (let i = b - 1; i > a; i--) fwd.push(ch[i]);   // IT plays the end frame twice
      return fwd;
    });
    out = { ...out, channels, loop: { start: a, end: channels[0].length } };
  }
  return out;
}

export const wholeLoop = (s, n = s.channels[0].length) => !!s.loop && (s.loop.start || 0) === 0 && (s.loop.end ?? n) === n;
export const SINGLE_CYCLE = 1024;        // a whole-sample loop this short is a waveform (leads, basses), not a pad
export const singleCycle = (s) => wholeLoop(s) && s.channels[0].length <= SINGLE_CYCLE;

/** Cents ProTracker's period for MOD note m is off equal temperament, against MOD note `ref`'s. */
export const periodCents = (m, ref) => 1200 * Math.log2((PERIODS[ref] / PERIODS[m]) / 2 ** ((m - ref) / 12));

/**
 * Choose the mapping for a sample played at IT notes lo..hi: MOD note =
 * IT note - off, and the resampling ratio. Throws if the span cannot fit.
 * For a single-cycle loop, `notes` (the IT notes it plays) retune it: the
 * ratio moves by `shift` cents so their period errors centre on zero
 * (`spread` is what is left between them), and `lowRate` is the rate of the
 * lowest one at the bottom of its vibrato (`vib`, the IT depth, converted as
 * mod-patterns.js does), for the harmonic cap in renderSample.
 */
export function planSample(s, lo, hi, notes = null, vib = 0) {
  const span = hi - lo;
  if (span > TOP_NOTE) throw new Error(`${s.name}: notes span ${span} semitones; a MOD sample has ${TOP_NOTE}`);
  const n = s.channels[0].length, single = singleCycle(s);
  let top = single ? Math.max(span, s.topNote ?? TOP_NOTE) : TOP_NOTE;
  while (!single && top > span && modRate(top) > itRate(s, hi) * 1.000001) top--;   // never upsample a recording
  while (top > span && n * modRate(top) / itRate(s, hi) + 4 > MAX_BYTES) top--;
  let ratio = modRate(top) / itRate(s, hi);
  const plan = { off: hi - top, ratio };
  if (single && notes?.length) {
    const errs = notes.map((x) => periodCents(x - hi + top, top));
    plan.shift = -(Math.max(...errs) + Math.min(...errs)) / 2;
    plan.spread = Math.max(...errs) - Math.min(...errs);
    plan.ratio = ratio / 2 ** (plan.shift / 1200);   // fewer samples a cycle: the sample plays `shift` cents higher
    const low = PERIODS[Math.min(...notes) - plan.off];
    const depth = vib ? Math.max(1, Math.min(15, Math.round(vib * low / 520))) : 0;   // ptplayer: depth x 255 / 128 at the peak
    plan.lowRate = PAL_CLOCK / (low + ((255 * depth) >> 7));
    plan.topRate = modRate(top);
  }
  return plan;
}

// Blackman-windowed sinc low-pass resampler (ratio = output/input rate).
function resample(x, ratio) {
  const cut = Math.min(1, ratio), half = Math.ceil(16 / cut);
  const out = new Float64Array(Math.max(1, Math.round(x.length * ratio)));
  for (let i = 0; i < out.length; i++) {
    const t = i / ratio, c = Math.floor(t);
    let acc = 0;
    for (let j = c - half + 1; j <= c + half; j++) {
      if (j < 0 || j >= x.length) continue;
      const d = t - j, a = Math.PI * d * cut;
      const w = 0.42 + 0.5 * Math.cos(Math.PI * d / half) + 0.08 * Math.cos(2 * Math.PI * d / half);
      acc += x[j] * cut * (d === 0 ? 1 : Math.sin(a) / a) * w;
    }
    out[i] = acc;
  }
  return out;
}

// Loop length L (even) holding c whole periods, closest to `per` samples per
// period: up to 128 periods, never past 4,096 bytes unless one period is, so a
// loop is within half a cent of its rate (at 16 a high lead's best was 4.65 off).
// A song may trade that for chip RAM (`modLoopTol`, `modLoopMax`: json2mod);
// one period longer than the cap is still one loop of that length.
export const LOOP_TOL = 0.0003, LOOP_MAX = 4096;
function loopShape(per, tol = LOOP_TOL, max = LOOP_MAX) {
  let best = null;
  for (let c = 1; c <= 128; c++) {
    const L = Math.max(4, 2 * Math.round(c * per / 2)), err = Math.abs(L / c - per) / per; // 1 word = no loop
    if (L > max && best) break;
    if (!best || err < best.err - 1e-12) best = { c, L, err };
    if (err < tol) break;
  }
  return best;
}

// Band-limited resynthesis of one period x into L samples holding c periods,
// at most `cap` harmonics. `energy`, if given, receives the share of x's AC
// energy the kept harmonics carry (kept), how many there are (harmonics) and
// share(h), the share the first h harmonics carry.
function resynth(x, L, c, cap = Infinity, energy = null) {
  const N = x.length, K = Math.max(1, Math.min(Math.floor(N / 2), Math.ceil(L / (2 * c)) - 1, cap));
  const cosN = Float64Array.from({ length: N }, (_, i) => Math.cos(2 * Math.PI * i / N));
  const sinN = Float64Array.from({ length: N }, (_, i) => Math.sin(2 * Math.PI * i / N));
  const cosL = Float64Array.from({ length: L }, (_, i) => Math.cos(2 * Math.PI * i / L));
  const sinL = Float64Array.from({ length: L }, (_, i) => Math.sin(2 * Math.PI * i / L));
  const out = new Float64Array(L);
  let dc = 0;
  for (const v of x) dc += v;
  out.fill(dc / N);
  for (let k = 1; k <= K; k++) {
    let re = 0, im = 0;
    for (let j = 0; j < N; j++) { const p = (k * j) % N; re += x[j] * cosN[p]; im += x[j] * sinN[p]; }
    const scale = k * 2 === N ? 1 / N : 2 / N;
    for (let i = 0; i < L; i++) { const p = (k * c * i) % L; out[i] += scale * (re * cosL[p] + im * sinL[p]); }
  }
  if (energy) {
    const pw = [0];
    for (let k = 1; k <= Math.floor(N / 2); k++) {
      let re = 0, im = 0;
      for (let j = 0; j < N; j++) { const p = (k * j) % N; re += x[j] * cosN[p]; im += x[j] * sinN[p]; }
      pw.push(re * re + im * im);
    }
    const all = pw.reduce((a, b) => a + b, 0);
    energy.share = (h) => (all > 0 ? pw.slice(0, Math.max(1, h) + 1).reduce((a, b) => a + b, 0) / all : 1);
    energy.kept = energy.share(K);
    energy.harmonics = K;
  }
  return out;
}

/**
 * Render a planned sample to MOD form: { data: Int8Array, loopStart,
 * loopLength } in bytes (even), one-shots starting with the zero word
 * players idle on (ptplayer.readme). `gain` reports any scaling applied to
 * stay within 8 bits.
 */
export function renderSample(s, plan) {
  const x = mono(s), n = x.length;
  let y, loop = null;
  if (wholeLoop(s, n)) {
    const shape = loopShape(n * plan.ratio, plan.loopTol, plan.loopMax);
    // Harmonic k at the lowest note's rate images at f0 x (S - k), S samples a
    // cycle: a single-cycle loop keeps those whose images land above BAND_HZ
    const S = shape.L / shape.c, single = n <= SINGLE_CYCLE;
    const cap = single && plan.lowRate ? Math.floor(S * (1 - BAND_HZ / plan.lowRate) - 1e-9) : Infinity;
    const energy = {};
    y = resynth(x, shape.L, shape.c, cap, single ? energy : null);
    if (single) {
      // what the cap takes beyond what the top note alone loses: a high lead
      // loses its upper harmonics at any rate Paula allows
      const top = plan.topRate ? Math.floor(S * (1 - BAND_HZ / plan.topRate) - 1e-9) : Infinity;
      plan.harmonics = energy.harmonics;
      plan.kept = energy.kept;
      plan.keptTop = energy.share(Math.min(top, Math.floor(n / 2), Math.ceil(shape.L / (2 * shape.c)) - 1));
    }
    loop = { start: 0, length: shape.L };
    plan.cycles = shape.c;
    plan.cents = 1200 * Math.log2((shape.L / shape.c) / (n * plan.ratio));
  } else {
    y = resample(x, plan.ratio);
    if (s.loop) {
      const a = 2 * Math.round((s.loop.start || 0) * plan.ratio / 2);
      const b = 2 * Math.round((s.loop.end ?? n) * plan.ratio / 2);
      loop = { start: a + 2, length: b - a };
    }
  }
  // Resampling a full-scale one-shot creates inter-sample peaks above 1.0
  // (driven noise such as a snare reaches +5 dB). One-shots are clipped
  // there, which keeps their level against the other samples; loops are
  // scaled instead, so their wave shape stays intact.
  let peak = 0, over = 0;
  for (const v of y) { peak = Math.max(peak, Math.abs(v)); over += Math.abs(v) > 1; }
  const gain = peak > 1 && loop ? 1 / peak : 1;
  plan.clipped = gain === 1 ? over : 0;
  const head = loop && loop.start === 0 ? 0 : 2;
  if (head + y.length > MAX_BYTES)
    throw new Error(`${s.name}: ${head + y.length} bytes after resampling; a MOD sample holds ${MAX_BYTES} (shorten it or narrow its note range)`);
  const len = (head + y.length + 1) & ~1;
  const data = new Int8Array(len);
  for (let i = 0; i < y.length; i++) data[i + head] = Math.max(-128, Math.min(127, Math.round(y[i] * gain * 127)));
  if (loop) {
    loop.length = (Math.min(loop.start + loop.length, len) - loop.start) & ~1;
    if (loop.length < 2) throw new Error(`${s.name}: loop too short to keep in MOD`);
    if (loop.length < 4) {                        // a 1-word loop is the no-loop marker: play it twice
      const out = new Int8Array(loop.start + 2 * loop.length);
      out.set(data.subarray(0, loop.start + loop.length));
      out.set(data.subarray(loop.start, loop.start + loop.length), loop.start + loop.length);
      loop.length *= 2;
      return { data: out, loopStart: loop.start, loopLength: loop.length, gain };
    }
  }
  return { data, loopStart: loop ? loop.start : 0, loopLength: loop ? loop.length : 0, gain };
}
