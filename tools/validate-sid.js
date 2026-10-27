// Validation of SID songs: `song.sid` and `samples[i].sid` (see sid/FORMAT.md and
// tools/sid-compile.js). Returns error strings like validate-song.js.
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const integer = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
export const isNoteName = (v) => typeof v === 'string' && /^(?:[A-G]-|[ACDFG]#)[0-9]$/.test(v);

export const WAVE_BITS = { noise: 0x80, pulse: 0x40, saw: 0x20, tri: 0x10, test: 0x08, ring: 0x04, sync: 0x02 };
export const FILTER_BITS = { low: 0x10, band: 0x20, high: 0x40 };

/** Waveform spec ("pulse", "saw+tri", 0x41) -> $D404 bits without the gate, or null. */
export function waveBits(w) {
  if (integer(w, 0, 0xfe)) return w & 0xfe;
  if (typeof w !== 'string') return null;
  let bits = 0;
  for (const part of w.split('+')) {
    if (!(part in WAVE_BITS)) return null;
    bits |= WAVE_BITS[part];
  }
  return bits;
}

export function filterBits(mode) {
  if (typeof mode !== 'string') return null;
  let bits = 0;
  for (const part of mode.split('+')) {
    if (!(part in FILTER_BITS)) return null;
    bits |= FILTER_BITS[part];
  }
  return bits;
}

export function validateSidInstrument(s, at) {
  const errors = [];
  const check = (ok, message) => { if (!ok) errors.push(`${at}: sid.${message}`); };
  if (!object(s)) return [`${at}: sid must be an object`];
  check(Array.isArray(s.adsr) && s.adsr.length === 4 && s.adsr.every((v) => integer(v, 0, 15)), 'adsr must be [attack, decay, sustain, release], each 0..15');
  check(Array.isArray(s.wave) && s.wave.length > 0, 'wave must be a nonempty list of steps');
  if (Array.isArray(s.wave)) s.wave.forEach((step, i) => {
    const [w, note = 0] = Array.isArray(step) ? step : [step];
    check(waveBits(w) !== null, `wave[${i}]: unknown waveform ${JSON.stringify(w)} (noise, pulse, saw, tri, test, ring, sync joined by +, or a number)`);
    check(integer(note, -64, 63) || isNoteName(note), `wave[${i}]: note must be -64..63 semitones or a note name`);
  });
  if (s.loop !== undefined) check(Array.isArray(s.wave) && integer(s.loop, 0, s.wave.length - 1), 'loop must be a step index');
  if (s.transpose !== undefined) check(integer(s.transpose, -48, 48), 'transpose must be -48..48');
  if (s.pulse !== undefined && s.pulse !== 'carry') {
    const p = s.pulse;
    check(object(p) && integer(p.width, 0, 4095), 'pulse.width must be 0..4095');
    if (object(p)) {
      // -128 has no opposite in a byte, so the sweep could not turn round.
      if (p.speed !== undefined) check(integer(p.speed, -127, 127), 'pulse.speed must be -127..127');
      for (const k of ['min', 'max']) if (p[k] !== undefined) check(integer(p[k], 0, 4095), `pulse.${k} must be 0..4095`);
    }
  }
  if (s.filter !== undefined && s.filter !== 'carry') {
    const f = s.filter;
    check(object(f) && filterBits(f.mode) !== null, 'filter.mode must be low, band, high or a + combination');
    if (object(f)) {
      check(integer(f.cutoff, 0, 2047), 'filter.cutoff must be 0..2047');
      if (f.resonance !== undefined) check(integer(f.resonance, 0, 15), 'filter.resonance must be 0..15');
      if (f.speed !== undefined) check(integer(f.speed, -128, 127), 'filter.speed must be -128..127');
      for (const k of ['min', 'max']) if (f[k] !== undefined) check(integer(f[k], 0, 2047), `filter.${k} must be 0..2047`);
    }
  }
  return errors;
}

export function validateSidSong(song) {
  const errors = [];
  const sid = song.sid;
  const check = (ok, message) => { if (!ok) errors.push(`sid: ${message}`); };
  if (!object(sid)) return ['sid must be an object'];
  if (sid.model !== undefined) check(['6581', '8580'].includes(sid.model), 'model must be "6581" or "8580"');
  if (sid.speed !== undefined) check(integer(sid.speed, 2, 255), 'speed must be 2..255 frames per row');
  if (sid.funktempo !== undefined) check(typeof sid.funktempo === 'boolean', 'funktempo must be true or false');
  if (sid.hardRestart !== undefined) check(integer(sid.hardRestart, 0, 3), 'hardRestart must be 0..3 frames');
  if (sid.hardRestartAdsr !== undefined)
    check(sid.hardRestartAdsr === 'keep' ||
      (Array.isArray(sid.hardRestartAdsr) && sid.hardRestartAdsr.length === 2 && sid.hardRestartAdsr.every((v) => integer(v, 0, 255))),
    'hardRestartAdsr must be [attack/decay, sustain/release], each a byte, or "keep"');
  if (sid.volume !== undefined) check(integer(sid.volume, 0, 15), 'volume must be 0..15');
  if (sid.loop !== undefined) check(integer(sid.loop, 0, (song.order?.length ?? 1) - 1), 'loop must be an order index');
  for (const k of ['author', 'released']) if (sid[k] !== undefined) check(typeof sid[k] === 'string', `${k} must be a string`);
  if (sid.sections !== undefined)
    check(object(sid.sections) && Object.entries(sid.sections).every(([k, v]) => /^[a-z_][a-z0-9_]*$/i.test(k) && integer(v, 0, (song.order?.length ?? 1) - 1)),
      'sections must map names to order indices');
  const n = song.samples?.length ?? 0;
  if (sid.sfx !== undefined) {
    check(Array.isArray(sid.sfx) && sid.sfx.length <= 64, 'sfx must be a list of at most 64 effects');
    if (Array.isArray(sid.sfx)) sid.sfx.forEach((e, i) => {
      const ok = object(e) && typeof e.name === 'string' && integer(e.instrument, 0, n - 1) && isNoteName(e.note) &&
        integer(e.frames, 1, 255) && (e.tail === undefined || integer(e.tail, 0, 255));
      check(ok, `sfx[${i}] needs name, instrument, note (C-5), frames 1..255 and optional tail 0..255`);
    });
  }
  (song.samples || []).forEach((s, i) => {
    if (object(s) && s.sid === undefined) errors.push(`samples[${i}]: a SID song needs sid instruments only`);
  });
  const width = Math.max(0, ...(song.patterns || []).map((p) => p?.channels?.length || 0));
  check(width <= 3, `the SID has 3 voices; this song has ${width} channels`);
  check(n <= 32, `at most 32 instruments (this song has ${n})`);
  return errors;
}
