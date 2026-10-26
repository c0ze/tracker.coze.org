// Validate authoring mistakes that the binary writer would otherwise coerce or drop.
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const integer = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
export const isNote = (v) => typeof v === 'string' && /^(?:[A-G]-|[ACDFG]#)[0-9]$/.test(v);

export function validateSong(song) {
  const errors = [];
  const check = (ok, where, message) => { if (!ok) errors.push(`${where}: ${message}`); };
  if (!object(song)) return ['song must be an object'];
  for (const [key, min, max] of [['bpm', 32, 255], ['ticks', 1, 255], ['mixvol', 0, 128]]) {
    if (song[key] !== undefined) check(integer(song[key], min, max), key, `expected integer ${min}..${max}`);
  }
  for (const key of ['title', 'message']) {
    if (song[key] !== undefined) check(typeof song[key] === 'string', key, 'expected a string');
  }
  if (typeof song.message === 'string') check(song.message.length <= 8000, 'message', 'expected at most 8000 characters (IT limit)');
  if (song.channelnames !== undefined) {
    const names = song.channelnames;
    check((Array.isArray(names) || object(names)) && Object.keys(names).length > 0 &&
      Object.entries(names).every(([k, v]) => /^(0|[1-9][0-9]?)$/.test(k) && Number(k) < 64 && (v == null || typeof v === 'string')),
      'channelnames', 'expected strings for channels 0..63');
  }
  if (!Array.isArray(song.samples) || !Array.isArray(song.patterns) || !Array.isArray(song.order)) {
    return [...errors, 'samples, patterns and order must be arrays'];
  }
  check(song.samples.length > 0 && song.samples.length <= 255, 'samples', 'expected 1..255 samples');
  check(song.patterns.length > 0 && song.patterns.length <= 254, 'patterns', 'expected 1..254 patterns');
  check(song.order.length > 0 && song.order.length <= 65534, 'order', 'expected 1..65534 entries');
  song.order.forEach((p, i) => check(integer(p, 0, song.patterns.length - 1), `order[${i}]`, 'invalid pattern index'));
  song.samples.forEach((s, i) => {
    const at = `samples[${i}]`;
    if (!object(s)) { errors.push(`${at}: expected sample object`); return; }
    check([s.synth, s.file, s.channels, s.buffer].filter(v => v !== undefined).length === 1,
      at, 'choose exactly one of synth, file, channels or buffer');
    if (s.file !== undefined) check(typeof s.file === 'string' && s.file.length > 0, at, 'file must be a path');
    if (s.name !== undefined) check(typeof s.name === 'string', at, 'name must be a string');
    if (s.synth !== undefined) {
      check(object(s.synth), at, 'synth must be an object');
      if (object(s.synth)) {
        check(['sine', 'square', 'triangle', 'saw', 'noise', 'kick', 'pluck'].includes(s.synth.wave ?? 'sine'), at, 'unknown synth wave');
        for (const k of ['seconds', 'samplerate', 'cycle']) if (s.synth[k] !== undefined)
          check(Number.isFinite(s.synth[k]) && s.synth[k] > 0, at, `synth.${k} must be positive`);
        if (s.synth.volume !== undefined) check(integer(s.synth.volume, 0, 64), at, 'synth.volume must be 0..64');
        if (s.synth.pulse !== undefined) check(s.synth.pulse > 0 && s.synth.pulse < 1, at, 'pulse must be between 0 and 1');
      }
    }
    if (s.volume !== undefined) check(integer(s.volume, 0, 64), at, 'volume must be 0..64');
    if (s.c5speed !== undefined) check(integer(s.c5speed, 1, 9999999), at, 'c5speed must be 1..9999999');
    if (s.detune !== undefined) check(Number.isFinite(s.detune), at, 'detune must be finite');
    for (const k of ['loop', 'susloop']) if (s[k] !== undefined) {
      const l = s[k];
      check(k === 'loop' && l === 'cycle' && typeof s.file === 'string' ||
        object(l) && integer(l.start ?? 0, 0, 0xffffffff) &&
        (l.end === undefined || integer(l.end, (l.start ?? 0) + 1, 0xffffffff)), at, `invalid ${k}`);
    }
    if (s.channels !== undefined) {
      const valid = Array.isArray(s.channels) && [1, 2].includes(s.channels.length) &&
        s.channels.every(c => (Array.isArray(c) || ArrayBuffer.isView(c)) && c.length > 0 &&
          c.length === s.channels[0].length && Array.from(c).every(Number.isFinite));
      check(valid, at, 'channels must contain equal, nonempty mono/stereo finite PCM arrays');
      check(Number.isFinite(s.samplerate) && s.samplerate > 0, at, 'samplerate must be positive');
      if (valid) for (const k of ['loop', 'susloop']) if (object(s[k]))
        check((s[k].end ?? s.channels[0].length) <= s.channels[0].length &&
          (s[k].start ?? 0) < (s[k].end ?? s.channels[0].length), at, `${k} exceeds sample length`);
    }
  });
  song.patterns.forEach((p, i) => {
    const at = `patterns[${i}]`;
    if (!object(p) || !Array.isArray(p.channels)) { errors.push(`${at}: expected channels array`); return; }
    check(integer(p.rows, 1, 1024), at, 'rows must be 1..1024');
    if (p.name !== undefined) check(typeof p.name === 'string', at, 'name must be a string');
    check(p.channels.length > 0 && p.channels.length <= 64, at, 'expected 1..64 channels');
    let packedBytes = p.rows;
    p.channels.forEach((ch, c) => {
      if (!object(ch) && !Array.isArray(ch)) { errors.push(`${at} ch${c}: expected row map`); return; }
      for (const [r, ev] of Object.entries(ch)) {
        const where = `${at} ch${c} row ${r}`;
        check(/^(0|[1-9][0-9]*)$/.test(r) && integer(Number(r), 0, p.rows - 1), where, 'row outside pattern');
        if (!object(ev)) { errors.push(`${where}: expected event object`); continue; }
        packedBytes += 2 + Number(Boolean(ev.note)) + Number(ev.instrument != null) + Number(Boolean(ev.vol)) + 2 * Number(Boolean(ev.fx));
        if (ev.note !== undefined) check(isNote(ev.note) || ['==', '^^'].includes(ev.note), where, 'invalid note (use C-5 or C#5, == or ^^)');
        if (ev.instrument !== undefined) check(integer(ev.instrument, 0, song.samples.length - 1), where, 'invalid sample index');
        if (ev.vol !== undefined) check(typeof ev.vol === 'string' && /^(?:[vp](?:[0-5]?[0-9]|6[0-4])|[a-h]0?[0-9])$/.test(ev.vol), where, 'invalid volume column (decimal)');
        if (ev.fx !== undefined) check(typeof ev.fx === 'string' && /^[A-Z][0-9A-Fa-f]{2}$/.test(ev.fx), where, 'invalid effect (letter + two hex digits)');
      }
    });
    check(packedBytes <= 65535, at, 'packed pattern exceeds the 65535-byte IT limit; split the pattern');
  });
  if (song.adaptive !== undefined) {
    const a = song.adaptive;
    if (!object(a) || !object(a.sections) || !Array.isArray(a.layers)) errors.push('adaptive: expected sections object and layers array');
    else {
      const nCh = Math.max(0, ...song.patterns.map(p => p?.channels?.length || 0));
      const names = new Set();
      a.layers.forEach((l, i) => {
        check(object(l) && typeof l.name === 'string' && l.name.length > 0 && !names.has(l.name) &&
          Number.isFinite(l.above) && l.above >= 0 && l.above <= 1 && Array.isArray(l.channels) &&
          l.channels.every(c => integer(c, 0, nCh - 1)), `adaptive.layers[${i}]`, 'invalid layer name, threshold or channel');
        names.add(l?.name);
      });
      for (const [name, range] of Object.entries(a.sections))
        check(Array.isArray(range) && range.length === 2 && integer(range[0], 0, song.order.length - 1) &&
          integer(range[1], range[0], song.order.length - 1), `adaptive.sections.${name}`, 'invalid order range');
      if (a.loop !== undefined) check(Object.hasOwn(a.sections, a.loop), 'adaptive.loop', 'unknown section');
    }
  }
  return errors;
}

export function assertSong(song) {
  const errors = validateSong(song);
  if (errors.length) throw new Error(`Invalid song:\n${errors.join('\n')}`);
}
