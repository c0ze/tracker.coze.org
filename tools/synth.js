/**
 * Sample synthesis for tracker instruments.
 * Generates float arrays (-1..1) usable as itwriter sample channels.
 *
 * Two families:
 * - Single-cycle waveforms (loop forever, pitched by the tracker):
 *   sine, square, saw, triangle. Returns { channels, loop, c5speed }.
 * - One-shot drums/noise: noise (hats/snare body), kick (pitch-swept sine).
 *
 * C5Speed convention: single-cycle samples are tuned so note C-5 plays
 * middle C (261.6256 Hz). c5speed = cycleLength * 261.6256.
 */

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
export function synthesize(spec) {
  const wave = spec.wave || "sine";

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
