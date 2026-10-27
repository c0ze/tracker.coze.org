/**
 * Sample synthesis for tracker instruments.
 * Generates float arrays (-1..1) usable as itwriter sample channels.
 *
 * Two families:
 * - Single-cycle waveforms (loop forever, pitched by the tracker):
 *   sine, square, saw, triangle. Returns { channels, loop, c5speed }.
 * - One-shot drums/noise: noise (hats/snare body), kick (pitch-swept sine).
 *
 * The sound library adds voice algorithms (see VOICES below) and named presets
 * (synth-presets.js, `{ preset: "kick.punch" }`). Those seven legacy waves keep
 * their exact output: frozen songs compile through them.
 *
 * C5Speed convention: single-cycle samples are tuned so note C-5 plays
 * middle C (261.6256 Hz). c5speed = cycleLength * 261.6256.
 */
import { PRESETS } from "./synth-presets.js";

const MIDDLE_C = 261.6256;
const DEFAULT_NOISE_SEED = 0xc0ffee;

// Mulberry32: a repeatable noise source, local to each sample build.
function noiseRandom(seed) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error("Noise seed must be an unsigned 32-bit integer");
  }
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function singleCycle(fn, cycle = 256) {
  if (!Number.isInteger(cycle) || cycle < 4) throw new Error("Cycle length must be an integer of at least 4 samples");
  const out = new Array(cycle);
  for (let i = 0; i < cycle; i++) {
    out[i] = fn(i / cycle); // phase 0..1
  }
  // Narrow pulses otherwise contain a large DC offset (−0.75 at 12.5%
  // duty), wasting mixer headroom and making note starts/stops click.
  const mean = out.reduce((sum, v) => sum + v, 0) / cycle;
  let peak = 0;
  for (let i = 0; i < cycle; i++) {
    out[i] -= mean;
    peak = Math.max(peak, Math.abs(out[i]));
  }
  if (peak < 1e-12) throw new Error("Waveform has no alternating signal; adjust pulse width or cycle length");
  return out.map((v) => v / peak);
}

const WAVES = {
  sine: (p) => Math.sin(p * 2 * Math.PI),
  saw: (p) => 1 - 2 * p,
  triangle: (p) => (p < 0.5 ? 4 * p - 1 : 3 - 4 * p),
  // square takes pulse width via closure, see below
};

/**
 * Build a sample definition from a synth spec.
 * spec: {
 *   wave: "sine"|"square"|"saw"|"triangle"|"noise"|"kick"|"pluck",
 *   cycle: 256,            // single-cycle length, integer >= 4
 *   pulse: 0.5,            // square only: pulse width strictly between 0 and 1
 *   seed: 12648430,        // noise only: unsigned 32-bit seed (stable default)
 *   seconds: 0.15,         // one-shots: duration
 *   samplerate: 22050,     // one-shots: rate
 *   decay: 20,             // one-shots: exponential decay rate (per second)
 *   freqStart: 160, freqEnd: 45, // kick pitch sweep in Hz
 *   volume: 64             // default sample volume 0-64
 * }
 * Returns an itwriter-ready sample object (name added by caller).
 * Single cycles have zero DC offset and unity peak; rebuilds are deterministic.
 */
export function synthesize(input) {
  const spec = resolveSynthSpec(input);
  const wave = spec.wave || "sine";
  if (VOICES[wave]) return VOICES[wave](checkParams(wave, spec));

  // one-shot percussion
  if (wave === "noise") {
    const samplerate = spec.samplerate || 22050;
    const n = Math.round((spec.seconds || 0.15) * samplerate);
    const decay = spec.decay === undefined ? 25 : spec.decay;
    const random = noiseRandom(spec.seed === undefined ? DEFAULT_NOISE_SEED : spec.seed);
    const data = new Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / samplerate;
      data[i] = (random() * 2 - 1) * Math.exp(-decay * t);
    }
    return { samplerate, channels: [data], volume: spec.volume };
  }

  if (wave === "pluck") {
    // music-box / bell: sine + decaying upper harmonics, natural release.
    // Tuned so C-5 = middle C (generated at 261.6 Hz, c5speed = samplerate).
    const samplerate = spec.samplerate || 22050;
    const n = Math.round((spec.seconds || 2) * samplerate);
    const decay = spec.decay === undefined ? 2.5 : spec.decay;
    const f = MIDDLE_C;
    const data = new Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / samplerate;
      const w = 2 * Math.PI * f * t;
      data[i] = (Math.sin(w)
        + 0.5 * Math.sin(2 * w) * Math.exp(-6 * t)
        + 0.25 * Math.sin(3 * w) * Math.exp(-10 * t)
        + 0.1 * Math.sin(5.4 * w) * Math.exp(-14 * t)) // slightly inharmonic partial = bell
        * Math.exp(-decay * t) * 0.55;
    }
    return { samplerate, c5speed: samplerate, channels: [data], volume: spec.volume };
  }

  if (wave === "kick") {
    const samplerate = spec.samplerate || 22050;
    const n = Math.round((spec.seconds || 0.25) * samplerate);
    const decay = spec.decay === undefined ? 14 : spec.decay;
    const f0 = spec.freqStart || 160;
    const f1 = spec.freqEnd || 45;
    const sweep = spec.sweep === undefined ? 18 : spec.sweep; // pitch decay rate
    const data = new Array(n);
    let phase = 0;
    for (let i = 0; i < n; i++) {
      const t = i / samplerate;
      const f = f1 + (f0 - f1) * Math.exp(-sweep * t);
      phase += (f / samplerate) * 2 * Math.PI;
      data[i] = Math.sin(phase) * Math.exp(-decay * t);
    }
    return { samplerate, channels: [data], volume: spec.volume };
  }

  // single-cycle looping waveform
  const cycle = spec.cycle === undefined ? 256 : spec.cycle;
  let fn;
  if (wave === "square") {
    const pulse = spec.pulse === undefined ? 0.5 : spec.pulse;
    if (!Number.isFinite(pulse) || pulse <= 0 || pulse >= 1) {
      throw new Error("Square pulse width must be a number strictly between 0 and 1");
    }
    fn = (p) => (p < pulse ? 1 : -1);
  } else {
    fn = WAVES[wave];
    if (!fn) throw new Error(`Unknown wave type: ${wave}`);
  }
  const data = singleCycle(fn, cycle);
  return {
    samplerate: 44100, // ignored when c5speed present, but keep sane
    c5speed: Math.round(cycle * MIDDLE_C),
    channels: [data],
    loop: { start: 0, end: cycle },
    volume: spec.volume,
  };
}

// ------------------------------------------------------------ sound library
// Voice algorithms reachable from JSON as `wave`. Shots bake their amplitude
// shape; "cycle" voices are one static period; "loop" voices hold many periods
// so their timbre moves (detuned beating, pulse-width sweep) while they loop.
// Recipes generalize the game kits (named per voice) without importing them.

const TAU = 2 * Math.PI;
const LEGACY_WAVES = ["sine", "square", "triangle", "saw", "noise", "kick", "pluck"];
const LEGACY_SHOTS = { noise: 0.15, kick: 0.25, pluck: 2 };

/** Replace `{ preset, ...overrides }` with the preset's spec plus the overrides. */
export function resolveSynthSpec(spec) {
  if (spec === null || typeof spec !== "object" || Array.isArray(spec)) throw new Error("synth must be an object");
  if (spec.preset === undefined) return spec;
  if (typeof spec.preset !== "string" || !Object.hasOwn(PRESETS, spec.preset)) throw new Error(`Unknown synth preset: ${spec.preset}`);
  const preset = PRESETS[spec.preset];
  if (spec.wave !== undefined) throw new Error("synth: give either preset or wave, not both");
  const { preset: _, ...overrides } = spec;
  return { ...preset.synth, ...overrides };
}

/**
 * What a synth spec produces, without rendering it: mode ("cycle" | "loop" | "shot"),
 * a shot's buffer length in seconds at its own samplerate (at C-5 it plays for
 * seconds * samplerate / c5speed), samplerate and c5speed (undefined where the IT
 * file uses the samplerate), and whether it is unpitched percussion. Validation and
 * lint use this so they agree with synthesize(); it also validates the spec.
 */
export function describeSynth(input) {
  const spec = resolveSynthSpec(input);
  const wave = spec.wave ?? "sine";
  const preset = input.preset === undefined ? null : PRESETS[input.preset]; // resolveSynthSpec checked it
  if (LEGACY_WAVES.includes(wave)) {
    const shot = wave in LEGACY_SHOTS;
    const samplerate = spec.samplerate || 22050;
    return {
      wave, mode: shot ? "shot" : "cycle", percussion: wave === "noise" || wave === "kick",
      seconds: shot ? spec.seconds || LEGACY_SHOTS[wave] : Infinity,
      samplerate: shot ? samplerate : 44100,
      c5speed: wave === "pluck" ? samplerate : shot ? undefined : Math.round((spec.cycle === undefined ? 256 : spec.cycle) * MIDDLE_C),
    };
  }
  const voice = VOICE_INFO[wave];
  if (!voice) throw new Error(`Unknown wave type: ${wave}`);
  const p = checkParams(wave, spec);
  const shot = voice.mode === "shot";
  return {
    wave, mode: voice.mode, percussion: voice.percussion || preset?.role === "percussion",
    seconds: shot ? p.seconds : Infinity,
    samplerate: shot ? p.samplerate : 44100,
    c5speed: shot ? Math.round(p.samplerate * 2 ** -(p.octave ?? 0)) : Math.round(p.cycle * MIDDLE_C),
  };
}

/**
 * The PCM a synth spec will produce, without synthesizing it: frames per channel,
 * channels (always 1) and bytes16 (frames * channels * 2), the size admission counts.
 * Accepts presets and every wave, and validates the spec the way describeSynth does.
 */
export function describeAllocation(input) {
  const spec = resolveSynthSpec(input);
  const wave = spec.wave ?? "sine";
  let frames;
  if (LEGACY_WAVES.includes(wave)) {
    frames = wave in LEGACY_SHOTS
      ? Math.round((spec.seconds || LEGACY_SHOTS[wave]) * (spec.samplerate || 22050))
      : spec.cycle === undefined ? 256 : spec.cycle;
  } else {
    const voice = VOICE_INFO[wave];
    if (!voice) throw new Error(`Unknown wave type: ${wave}`);
    const p = checkParams(wave, spec);
    frames = voice.mode === "shot" ? shotFrames(p) : voice.mode === "loop" ? p.cycle * p.periods : p.cycle;
  }
  return { frames, channels: 1, bytes16: frames * 2 };
}

export const WAVES_ALL = [...LEGACY_WAVES];

// Parameter tables: [default, min, max] for numbers; lists and names are checked by checkLists.
const SHOT = { seconds: [null, 0.005, 20], samplerate: [22050, 4000, 96000], release: [0.003, 0, 1], volume: [undefined, 0, 64] };
const PARAMS = {
  membrane: { ...SHOT, seconds: [0.25, 0.005, 20], freqStart: [180, 20, 4000], freqEnd: [50, 10, 2000], sweep: [30, 0, 400],
    decay: [10, 0, 200], overtone: [0, 0, 2], click: [0.4, 0, 2], drive: [2, 0, 8], seed: [11, 0, 0xffffffff] },
  snare: { ...SHOT, seconds: [0.2, 0.005, 20], tone: [185, 40, 2000], toneDecay: [28, 0, 400], noise: [0.9, 0, 2],
    noiseDecay: [16, 0, 400], snap: [0.4, 0, 2], room: [0, 0, 2], roomDecay: [6, 0.1, 100], drive: [1.6, 0, 8], seed: [21, 0, 0xffffffff] },
  hat: { ...SHOT, seconds: [0.05, 0.005, 20], samplerate: [32000, 4000, 96000], decay: [70, 0, 1000], metal: [0.5, 0, 1],
    tune: [1.7, 0.25, 4], seed: [3, 0, 0xffffffff] },
  clap: { ...SHOT, seconds: [0.18, 0.02, 5], bursts: [3, 1, 8], spacing: [0.009, 0.002, 0.05], tail: [24, 1, 400], seed: [31, 0, 0xffffffff] },
  shaker: { ...SHOT, seconds: [0.12, 0.02, 5], grains: [7, 1, 64], spread: [0.011, 0.001, 0.2], grainDecay: [420, 10, 5000], seed: [51, 0, 0xffffffff] },
  fm: { ...SHOT, seconds: [2.5, 0.05, 20], octave: [0, -4, 3], ratio: [1, 0.25, 16], index: [2.5, 0, 20], indexDecay: [6, 0, 200],
    decay: [1.2, 0, 200], tine: [0.2, 0, 2], tineDecay: [40, 0, 1000] },
  modal: { ...SHOT, seconds: [1.5, 0.02, 20], octave: [0, -4, 3], freq: [MIDDLE_C, 20, 8000], strike: [0, 0, 2], strikeDecay: [300, 1, 5000],
    attack: [0.001, 0, 0.5], drive: [0, 0, 8], seed: [61, 0, 0xffffffff] },
  filterpluck: { ...SHOT, seconds: [1.2, 0.05, 20], octave: [-2, -4, 3], cutoff: [180, 20, 8000], envAmount: [2400, 0, 12000],
    envDecay: [18, 0, 400], resonance: [0.3, 0, 0.95], decay: [4, 0, 200], drive: [1.2, 0, 8] },
  swell: { ...SHOT, seconds: [2, 0.05, 20], from: [200, 20, 10000], to: [6000, 20, 10000], resonance: [0.5, 0, 0.95], seed: [71, 0, 0xffffffff] },
  additive: { cycle: [128, 8, 4096], drive: [0, 0, 8], volume: [undefined, 0, 64] },
  ensemble: { cycle: [64, 8, 1024], periods: [120, 8, 2048], rolloff: [0, 0, 4], drive: [0, 0, 8], volume: [undefined, 0, 64] },
  pwm: { cycle: [128, 16, 1024], periods: [96, 4, 2048], center: [0.5, 0.05, 0.95], depth: [0.3, 0, 0.45], harmonics: [24, 1, 200], volume: [undefined, 0, 64] },
};
const LISTS = {
  additive: ["harmonics"], ensemble: ["harmonics", "voices", "source", "formant"], modal: ["partials"], filterpluck: ["source"], swell: ["shape"],
};
const VOICE_INFO = {
  membrane: { mode: "shot", percussion: true }, snare: { mode: "shot", percussion: true }, hat: { mode: "shot", percussion: true },
  clap: { mode: "shot", percussion: true }, shaker: { mode: "shot", percussion: true }, swell: { mode: "shot", percussion: true },
  fm: { mode: "shot", percussion: false }, modal: { mode: "shot", percussion: false }, filterpluck: { mode: "shot", percussion: false },
  additive: { mode: "cycle", percussion: false }, ensemble: { mode: "loop", percussion: false }, pwm: { mode: "loop", percussion: false },
};
WAVES_ALL.push(...Object.keys(VOICE_INFO));

/** Fill defaults and reject unknown or out-of-range parameters of a library voice. */
function checkParams(wave, spec) {
  const table = PARAMS[wave], lists = LISTS[wave] ?? [], out = { wave };
  for (const key of Object.keys(spec)) {
    if (key !== "wave" && !(key in table) && !lists.includes(key)) throw new Error(`synth.${key} is not a parameter of wave "${wave}"`);
  }
  for (const [key, [def, min, max]] of Object.entries(table)) {
    const v = spec[key] ?? def;
    if (v === undefined) continue;
    if (!Number.isFinite(v) || v < min || v > max) throw new Error(`synth.${key} must be a number from ${min} to ${max}`);
    if ((key === "seed" || key === "cycle" || key === "periods" || key === "volume" || key === "bursts" || key === "grains" ||
      key === "harmonics" && wave === "pwm") && !Number.isInteger(v)) throw new Error(`synth.${key} must be an integer`);
    out[key] = v;
  }
  for (const key of lists) if (spec[key] !== undefined) out[key] = spec[key];
  checkLists(wave, out);
  return out;
}

const SOURCES = ["saw", "square", "triangle"];
const DEFAULT_VOICES = [[0, 1], [-1, 0.8], [1, 0.8]];

/** Defaults and checks for list, name and cross-parameter settings, so validation catches what synthesis would reject. */
function checkLists(wave, p) {
  const fail = (message) => { throw new Error(message); };
  const levels = (a) => Array.isArray(a) && a.length >= 1 && a.length <= 64 && a.every((x) => Number.isFinite(x) && x >= 0) && a.some((x) => x > 0);
  const LEVELS = "must be 1..64 non-negative levels, at least one above zero";
  if (wave === "additive") {
    if (!levels(p.harmonics)) fail(`synth.harmonics ${LEVELS}`);
    if (p.cycle < 2 * p.harmonics.length + 2) fail("synth.cycle must be at least twice the harmonic count plus two");
  }
  if (wave === "ensemble") {
    p.voices ??= DEFAULT_VOICES;
    if (!Array.isArray(p.voices) || p.voices.length < 1 || p.voices.length > 8 || !p.voices.every((v) => Array.isArray(v) && v.length === 2 &&
      Number.isInteger(v[0]) && Math.abs(v[0]) < p.periods / 4 && Number.isFinite(v[1]) && v[1] >= 0) || !p.voices.some((v) => v[1] > 0)) {
      fail("synth.voices must be 1..8 [integer period offset under periods/4, level] pairs");
    }
    if (p.harmonics !== undefined && !levels(p.harmonics)) fail(`synth.harmonics ${LEVELS}`);
    if (p.harmonics !== undefined && p.source !== undefined) fail("synth: give either harmonics or source, not both");
    if (p.formant !== undefined && !Object.hasOwn(FORMANTS, p.formant)) fail(`synth.formant must be one of ${Object.keys(FORMANTS).join(", ")}`);
  }
  if (wave === "ensemble" || wave === "filterpluck") {
    p.source ??= p.harmonics === undefined ? "saw" : undefined;
    if (p.source !== undefined && !SOURCES.includes(p.source)) fail(`synth.source must be ${SOURCES.join(", ")}`);
  }
  if (wave === "swell") {
    p.shape ??= "rise";
    if (p.shape !== "rise" && p.shape !== "fall") fail('synth.shape must be "rise" or "fall"');
  }
  if (wave === "modal" && (!Array.isArray(p.partials) || p.partials.length < 1 || p.partials.length > 32 ||
    !p.partials.every((m) => Array.isArray(m) && m.length === 3 && m.every(Number.isFinite) && m[0] > 0 && m[1] >= 0 && m[2] >= 0) ||
    !p.partials.some((m) => m[1] > 0 && p.freq * 2 ** p.octave * m[0] < p.samplerate * 0.45))) {
    fail("synth.partials must be 1..32 [ratio, level, decay] triples, one of them audible below 0.45 x samplerate");
  }
  const root = MIDDLE_C * 2 ** (p.octave ?? 0);
  // FM's upper sidebands reach about (index + 1) modulator frequencies above the carrier (Carson's rule).
  if (wave === "fm" && root * (p.index > 0 ? 1 + p.ratio * (p.index + 1) : 1) >= p.samplerate * 0.45) {
    fail("synth: this fm octave, ratio and index exceed 0.45 x samplerate; raise samplerate or lower them");
  }
  if (wave === "filterpluck" && root >= p.samplerate * 0.45) fail("synth.octave puts the root above 0.45 x samplerate");
  if (wave === "ensemble") {
    // the voice keeps harmonics under 0.45 x its buffer and above a 1e-4 level: one must survive
    const amp = ensembleAmp(p), L = p.cycle * p.periods;
    const audible = p.voices.some(([offset, level]) => {
      const m = p.periods + offset;
      for (let k = 1; k * m < L * 0.45; k++) if (level * amp(k, (k * MIDDLE_C * m) / p.periods) >= 1e-4) return true;
      return false;
    });
    if (!audible) fail("synth: no ensemble harmonic is both audible and below 0.45 x the sample rate; raise cycle or change the levels");
  }
}

function shotFrames(p) { return Math.max(1, Math.round(p.seconds * p.samplerate)); }

/** Peak-normalize a one-shot to 0.95 and fade its last `release` seconds (at least 32 frames). */
function finishShot(p, data, extra = {}) {
  let peak = 0;
  for (const v of data) peak = Math.max(peak, Math.abs(v));
  if (!(peak > 1e-9)) throw new Error(`synth wave "${p.wave}" produced silence; check its parameters`);
  const fade = Math.min(data.length, Math.max(32, Math.round(p.release * p.samplerate)));
  for (let i = 0; i < data.length; i++) {
    const tail = data.length - 1 - i;
    data[i] = (data[i] / peak) * 0.95 * (tail < fade ? tail / fade : 1);
  }
  return { samplerate: p.samplerate, channels: [data], volume: p.volume, ...extra };
}

/** Pitched shots generate their root at C-5 + `octave` and set c5speed so C-5 stays middle C. */
const pitchedShot = (p, data) => finishShot(p, data, { c5speed: Math.round(p.samplerate * 2 ** -(p.octave ?? 0)) });

/** Normalize a periodic buffer of `cycle`-frame periods: zero mean, 0.95 peak, loop over the whole buffer. */
function finishLoop(p, data) {
  const mean = data.reduce((s, v) => s + v, 0) / data.length;
  let peak = 0;
  for (let i = 0; i < data.length; i++) { data[i] -= mean; peak = Math.max(peak, Math.abs(data[i])); }
  if (!(peak > 1e-9)) throw new Error(`synth wave "${p.wave}" produced silence; check its parameters`);
  return {
    samplerate: 44100, c5speed: Math.round(p.cycle * MIDDLE_C),
    channels: [data.map((v) => (v / peak) * 0.95)], loop: { start: 0, end: data.length }, volume: p.volume,
  };
}

const drive = (x, k) => (k > 0 ? Math.tanh(k * x) / Math.tanh(k) : x);

// Trapezoidal (zero-delay) state-variable filter, stable for any cutoff below Nyquist;
// resonance 0..0.95 maps to damping 2..0.1.
function svf(samplerate) {
  let ic1 = 0, ic2 = 0;
  return (x, fc, resonance) => {
    const g = Math.tan((Math.PI * Math.min(fc, samplerate * 0.45)) / samplerate), k = 2 * (1 - resonance);
    const a1 = 1 / (1 + g * (g + k)), a2 = g * a1, a3 = g * a2;
    const v3 = x - ic2, band = a1 * ic1 + a2 * v3, low = ic2 + a2 * ic1 + a3 * v3;
    ic1 = 2 * band - ic1; ic2 = 2 * low - ic2;
    return { low, band };
  };
}

// Saturate a periodic buffer without audible aliasing: build it oversampled until each
// period has about 1024 frames (at least 4x, at most 64x), apply tanh, then low-pass
// (Blackman-windowed sinc, circular so the loop stays seamless) and keep every f-th frame.
function drivenPeriodic(build, frames, cycle, amount) {
  if (!(amount > 0)) return build(frames);
  const f = Math.min(64, Math.max(4, 2 ** Math.ceil(Math.log2(1024 / cycle))));
  const x = build(f * frames).map((v) => Math.tanh(amount * v)), n = x.length, half = 55 * f, fc = 0.472 / f;
  const taps = [];
  for (let t = -half; t <= half; t++) {
    const sinc = t === 0 ? 2 * fc : Math.sin(TAU * fc * t) / (Math.PI * t);
    const w = 0.42 + 0.5 * Math.cos((Math.PI * t) / (half + 1)) + 0.08 * Math.cos((TAU * t) / (half + 1));
    taps.push(sinc * w);
  }
  const out = new Array(frames);
  for (let i = 0; i < frames; i++) {
    let s = 0;
    for (let t = -half; t <= half; t++) s += taps[t + half] * x[(((f * i - t) % n) + n) % n];
    out[i] = s;
  }
  return out;
}

const harmonicAmp = (source, k) => {
  if (source === "saw") return 1 / k;
  if (source === "square") return k % 2 ? 1 / k : 0;
  if (source === "triangle") return k % 2 ? 1 / (k * k) : 0;
  throw new Error(`synth.source must be "saw", "square" or "triangle"`);
};

// Vowel formants [center Hz, level, bandwidth Hz] at the C-5 reference (heliobane_stage11.kit.js choir, extended).
const FORMANTS = {
  a: [[800, 1, 110], [1150, 0.55, 120], [2900, 0.2, 200], [3900, 0.1, 260]],
  o: [[450, 1, 80], [800, 0.5, 90], [2830, 0.1, 180]],
  u: [[325, 1, 70], [700, 0.25, 80], [2530, 0.05, 170]],
  e: [[400, 1, 70], [2000, 0.5, 110], [2550, 0.35, 140]],
};

/** Level of harmonic k (at hz, its frequency when played at C-5) in an ensemble voice. */
function ensembleAmp(p) {
  const vowel = p.formant === undefined ? null : FORMANTS[p.formant];
  return (k, hz) => {
    let a = p.harmonics ? p.harmonics[k - 1] ?? 0 : harmonicAmp(p.source, k) * k ** -p.rolloff;
    if (vowel) a *= 0.06 / Math.sqrt(hz / 260) + vowel.reduce((s, [c, l, b]) => s + l / (1 + ((hz - c) / b) ** 2), 0);
    return a;
  };
}

const VOICES = {
  /** Drum skin: swept sine plus an optional inharmonic second mode, seeded click, soft clip (heliobane_shop/studsup kicks, toms). */
  membrane(p) {
    const n = shotFrames(p), r = noiseRandom(p.seed), d = new Array(n);
    let ph = 0, ph2 = 0;
    for (let i = 0; i < n; i++) {
      const t = i / p.samplerate, f = p.freqEnd + (p.freqStart - p.freqEnd) * Math.exp(-p.sweep * t);
      ph += (TAU * f) / p.samplerate; ph2 += (TAU * f * 1.593) / p.samplerate;
      const body = Math.sin(ph) * Math.exp(-p.decay * t) + p.overtone * Math.sin(ph2) * Math.exp(-p.decay * 1.8 * t);
      d[i] = drive(body + p.click * (r() * 2 - 1) * Math.exp(-t * 450), p.drive);
    }
    return finishShot(p, d);
  },
  /** Two body modes under high-passed noise and a crack; `room` adds a diffuse tail (heliobane_shop snare). */
  snare(p) {
    const n = shotFrames(p), r = noiseRandom(p.seed), d = new Array(n);
    let prev = 0, lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / p.samplerate, w = r() * 2 - 1, hp = w - 0.5 * prev; prev = w;
      lp += 0.35 * (w - lp);
      const body = 0.55 * Math.sin(TAU * p.tone * t) * Math.exp(-p.toneDecay * t)
        + 0.25 * Math.sin(TAU * p.tone * 1.78 * t) * Math.exp(-p.toneDecay * 1.3 * t);
      const noise = p.noise * hp * Math.exp(-p.noiseDecay * t) + p.snap * w * Math.exp(-200 * t);
      const room = p.room * lp * Math.exp(-p.roomDecay * t) * (1 - Math.exp(-t * 40));
      d[i] = drive(body + noise + room, p.drive);
    }
    return finishShot(p, d);
  },
  /** Six detuned square partials and noise, differentiated twice (studsup hat, heliobane_title cymbal). */
  hat(p) {
    const n = shotFrames(p), r = noiseRandom(p.seed), d = new Array(n);
    const freqs = [205.3, 304.4, 369.6, 522.7, 540, 800].map((f) => f * p.tune);
    let x1 = 0, x2 = 0;
    for (let i = 0; i < n; i++) {
      const t = i / p.samplerate;
      const metal = freqs.reduce((s, f) => s + (Math.sin(TAU * f * t) >= 0 ? 1 : -1), 0) / 6;
      const x = p.metal * metal + (1 - p.metal) * (r() * 2 - 1), y = x - 2 * x1 + x2; x2 = x1; x1 = x;
      d[i] = y * Math.exp(-p.decay * t);
    }
    return finishShot(p, d);
  },
  /** Quick noise bursts, then a diffuse tail, band-limited (studsup clap). */
  clap(p) {
    const n = shotFrames(p), r = noiseRandom(p.seed), d = new Array(n), end = p.bursts * p.spacing;
    let prev = 0, lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / p.samplerate, w = r() * 2 - 1, hp = w - prev; prev = w;
      lp += 0.5 * (hp - lp);
      const k = t < end ? Math.exp(-(t % p.spacing) * 350) : 0.8 * Math.exp(-(t - end) * p.tail);
      d[i] = lp * k;
    }
    return finishShot(p, d);
  },
  /** Seeded cluster of short band-passed noise grains (heliobane_stage11 rattle). */
  shaker(p) {
    const n = shotFrames(p), r = noiseRandom(p.seed);
    const at = Array.from({ length: p.grains }, (_, i) => 0.002 + i * p.spread + r() * p.spread * 0.5);
    const d = new Array(n);
    let x1 = 0, x2 = 0;
    for (let i = 0; i < n; i++) {
      const t = i / p.samplerate;
      let env = 0;
      for (const a of at) if (t >= a) env += Math.exp(-(t - a) * p.grainDecay) * (1 - a / (p.seconds + p.spread * p.grains));
      const x = r() * 2 - 1, y = x - 1.2 * x1 + 0.5 * x2; x2 = x1; x1 = x;
      d[i] = y * env;
    }
    return finishShot(p, d);
  },
  /** Noise through a resonant filter sweeping `from` -> `to` Hz; `shape` "rise" swells in, "fall" decays (a downwash). */
  swell(p) {
    const n = shotFrames(p), r = noiseRandom(p.seed), filter = svf(p.samplerate), d = new Array(n);
    for (let i = 0; i < n; i++) {
      const x = i / n, t = i / p.samplerate, fc = p.from * (p.to / p.from) ** x; // cutoff moves from -> to
      const amp = p.shape === "rise" ? x * x : Math.exp(-3 * x) * (1 - Math.exp(-t * 80));
      const { low, band } = filter(r() * 2 - 1, fc, p.resonance);
      d[i] = (0.6 * low + 0.4 * band) * amp;
    }
    return finishShot(p, d);
  },
  /** Two-operator FM with a falling index plus a high tine ping: electric piano tines. */
  fm(p) {
    const n = shotFrames(p), d = new Array(n), f = MIDDLE_C * 2 ** p.octave;
    for (let i = 0; i < n; i++) {
      const t = i / p.samplerate;
      const mod = p.index * Math.exp(-p.indexDecay * t) * Math.sin(TAU * f * p.ratio * t);
      const tine = f * 14 < p.samplerate * 0.45 ? p.tine * Math.sin(TAU * f * 14 * t) * Math.exp(-p.tineDecay * t) : 0;
      d[i] = (Math.sin(TAU * f * t + mod) * Math.exp(-p.decay * t) + tine) * Math.min(1, t * 2000);
    }
    return pitchedShot(p, d);
  },
  /** Struck resonator: partials [[ratio, level, decay/s], ...] above `freq`, plus an optional noise strike. */
  modal(p) {
    const n = shotFrames(p), r = noiseRandom(p.seed), d = new Array(n), f = p.freq * 2 ** p.octave;
    const live = p.partials.filter(([ratio]) => f * ratio < p.samplerate * 0.45);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / p.samplerate;
      let v = 0;
      for (const [ratio, level, decay] of live) v += level * Math.sin(TAU * f * ratio * t) * Math.exp(-decay * t);
      lp += 0.3 * (r() * 2 - 1 - lp);
      v += p.strike * lp * Math.exp(-p.strikeDecay * t);
      d[i] = drive(v, p.drive) * (p.attack > 0 ? Math.min(1, t / p.attack) : 1);
    }
    return pitchedShot(p, d);
  },
  /** Band-limited saw or square through a resonant low-pass whose cutoff falls: a plucked synth bass. */
  filterpluck(p) {
    const source = p.source, n = shotFrames(p), d = new Array(n), f = MIDDLE_C * 2 ** p.octave;
    const top = Math.floor((p.samplerate * 0.45) / f), filter = svf(p.samplerate);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      const t = i / p.samplerate;
      ph += (TAU * f) / p.samplerate;
      let x = 0;
      for (let k = 1; k <= top; k++) { const a = harmonicAmp(source, k); if (a) x += a * Math.sin(k * ph); }
      const { low } = filter(x * 0.6, p.cutoff + p.envAmount * Math.exp(-p.envDecay * t), p.resonance);
      d[i] = drive(low, p.drive) * Math.exp(-p.decay * t) * Math.min(1, t * 500);
    }
    return pitchedShot(p, d);
  },
  /** One period from harmonic levels (studsup `wave`): basses, brass, drawbar organs. */
  additive(p) {
    const h = p.harmonics;
    return finishLoop(p, drivenPeriodic((frames) => Array.from({ length: frames },
      (_, i) => h.reduce((a, amp, k) => a + amp * Math.sin((TAU * (k + 1) * i) / frames), 0)), p.cycle, p.cycle, p.drive));
  },
  /**
   * Detuned voices that each complete a whole number of periods across the buffer, so the
   * loop is seamless and its beating moves (heliobane_stage11 ensemble/choir/flesh bass).
   * voices: [[periodOffset, level], ...]; timbre from `harmonics`, or `source` with `rolloff`,
   * optionally shaped by a vowel `formant` fixed at the C-5 reference.
   */
  ensemble(p) {
    const amp = ensembleAmp(p);
    const L = p.cycle * p.periods;
    const build = (frames) => {
      const d = new Array(frames).fill(0);
      p.voices.forEach(([offset, level], vi) => {
        const m = p.periods + offset;
        for (let k = 1; k * m < L * 0.45; k++) {
          const a = level * amp(k, (k * MIDDLE_C * m) / p.periods);
          if (a < 1e-4) continue;
          const phase = (k * 0.618 + vi * 0.371) % 1;
          for (let i = 0; i < frames; i++) d[i] += a * Math.sin(TAU * ((k * m * i) / frames + phase));
        }
      });
      return d;
    };
    return finishLoop(p, drivenPeriodic(build, L, p.cycle, p.drive));
  },
  /** Band-limited pulse whose width sweeps once per buffer of `periods` periods (heliobane_title pwm). */
  pwm(p) {
    const L = p.cycle * p.periods, d = new Array(L);
    const top = Math.min(p.harmonics, Math.floor(p.cycle / 2) - 1);
    for (let i = 0; i < L; i++) {
      const phi = (i % p.cycle) / p.cycle, duty = p.center + p.depth * Math.sin((TAU * i) / L);
      let x = 0;
      for (let k = 1; k <= top; k++) x += (Math.sin(TAU * k * phi) - Math.sin(TAU * k * (phi - duty))) / k;
      d[i] = x;
    }
    return finishLoop(p, d);
  },
};
