// Per-sample settings shared by the Node resolver (tools/resolve-sample.js) and the hosted
// resolver (tools/hosted/resolve.js). Browser-safe: no Node imports.
const MIDDLE_C = 261.6256;

/**
 * Apply a song sample definition's settings to a decoded or synthesized sample (mutates and
 * returns it): name, then `loop` ("cycle" for file and asset samples loops the whole sample as a
 * single-cycle waveform and tunes C-5 to middle C; {start,end} otherwise), then the explicit
 * volume, c5speed and susloop, then detune in cents applied to the final c5speed.
 */
export function applySampleDef(sample, def) {
  if (def.name) sample.name = def.name;
  if (def.loop === 'cycle' && (def.file || def.asset)) {
    const n = sample.channels[0].length;
    sample.loop = { start: 0, end: n };
    sample.c5speed = Math.round(n * MIDDLE_C);
  } else if (def.loop) {
    sample.loop = def.loop; // the validator allows only {start,end} here
  }
  for (const k of ['volume', 'c5speed', 'susloop']) { // explicit per-sample settings win over derived ones
    if (def[k] !== undefined) sample[k] = def[k];
  }
  if (def.detune) sample.c5speed = Math.round((sample.c5speed || sample.samplerate) * Math.pow(2, def.detune / 1200));
  return sample;
}
