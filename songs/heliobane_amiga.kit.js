/**
 * Heliobane Amiga kit: fold a many-channel cozy-tracker song into the 4
 * channels a ProTracker MOD has, for tools/json2mod.js. Used by the Amiga
 * arrangements (heliobane_*_amiga.gen.js, all but stage 1's): they read the
 * PC song's JSON, so riffs, chords, melodies, form and tempo stay exactly
 * the PC's, and say per section which PC channels share each Paula channel.
 * It needs nothing outside songs/ (lib.js), like the other kits, so the
 * generators run where only songs/ is (tests/composition.test.js).
 *
 * A lane is a list of sources, highest priority first:
 *   { ch, hold = Infinity, need = 0, from = 0, to = rows, only(row, ev), inst, prefer }
 * - a source's note sounds when the lane is free, when the source is at
 *   least as important as the one sounding, or when the one sounding has
 *   held for `hold` rows (drums: a short hold lets hats fill between hits);
 * - `need`: the note is taken only if no higher source starts a note within
 *   that many rows (a crash that must not be cut at once);
 * - `inst` plays the source's notes with another sample (a merged one);
 * - the sounding source's later rows (volume steps, effects, its cut) follow
 *   it; rows of sources that lost the lane are dropped.
 * Panning (Xxx) goes (Paula is hard left/right). A MOD cell has one effect:
 * on rows without a note an effect beats a volume step, as in stage 1; on
 * note rows the volume wins (json2mod's rule) except for a glide (Gxx) and
 * for sources with `prefer: 'fx'` (an arpeggio whose chord matters more
 * than its accents).
 * Song-wide effects (B, C, A, T) are kept from whichever channel had them.
 */
import fs from 'fs';
import { nn } from './lib.js';

const isNote = (n) => typeof n === 'string' && n !== '^^' && n !== '==';
const GLOBAL = /^[ABCT]/;

export const loadSong = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

/** The instrument in effect at each note, walking the order list per channel. */
function tagInstruments(song) {
  const cur = [];
  const seen = new Set();
  const walk = (p) => song.patterns[p].channels.forEach((ch, c) => {
    for (let r = 0; r < song.patterns[p].rows; r++) {
      const e = ch[r];
      if (!e) continue;
      if (e.instrument != null) cur[c] = e.instrument;
      if (isNote(e.note) && e._inst === undefined) e._inst = e.instrument ?? cur[c];
    }
  });
  song.order.forEach((p) => { walk(p); seen.add(p); });
  song.patterns.forEach((_, p) => { if (!seen.has(p)) walk(p); });
}

function clean(e, prefer) {
  const out = {};
  if (e.note) out.note = e.note;
  if (e.instrument != null) out.instrument = e.instrument;
  if (e.vol && e.vol[0] !== 'p') out.vol = e.vol;
  if (e.fx && e.fx[0] !== 'X' && !GLOBAL.test(e.fx)) out.fx = e.fx;
  if (out.fx && out.vol && (!isNote(out.note) || out.fx[0] === 'G' || prefer === 'fx')) {
    if (isNote(out.note) && out.fx[0] !== 'G') out._vol = out.vol;     // see levelFromNotes
    delete out.vol;
  }
  return out;
}

/** One lane of `rows` rows from the pattern's channels. */
export function lane(p, sources, rows = p.rows) {
  const out = {};
  let owner = null, lastInst = null;
  const at = (s, r) => (r >= (s.from ?? 0) && r < (s.to ?? rows) ? p.channels[s.ch]?.[r] : undefined);
  const noteAt = (s, r) => { const e = at(s, r); return e && isNote(e.note) && (!s.only || s.only(r, e)) ? e : null; };
  for (let r = 0; r < rows; r++) {
    if (owner && at(sources[owner.i], r)?.note === '^^' && !noteAt(sources[owner.i], r)) {
      out[r] = { note: '^^' };
      owner = null;
    }
    let taken = false;
    for (let i = 0; i < sources.length && !taken; i++) {
      const s = sources[i], e = noteAt(s, r);
      if (!e) continue;
      const free = !owner || i <= owner.i || r - owner.start >= (sources[owner.i].hold ?? Infinity);
      let clear = true;
      for (let k = 0; k < i && clear; k++) for (let d = 1; d <= (s.need ?? 0); d++) if (noteAt(sources[k], r + d)) clear = false;
      if (!free || !clear) continue;
      const ev = clean(e, s.prefer), inst = s.inst ?? e._inst;
      if (s.inst != null || (ev.instrument == null && inst !== lastInst)) ev.instrument = inst;
      lastInst = inst;
      if (s.vol && ev.vol?.[0] === 'v') ev.vol = `v${Math.round(Number(ev.vol.slice(1)) * s.vol)}`;
      out[r] = ev;
      owner = { i, start: r };
      taken = true;
    }
    if (taken || !owner || out[r]) continue;
    const e = at(sources[owner.i], r);
    if (!e) continue;
    const s = sources[owner.i], ev = clean(e, s.prefer);
    if (s.vol && ev.vol?.[0] === 'v') ev.vol = `v${Math.round(Number(ev.vol.slice(1)) * s.vol)}`;
    if (Object.keys(ev).length) out[r] = ev;
  }
  return out;
}

/** Song-wide effects of a PC pattern, placed on a lane whose row has no
 * effect (and no volume, which a MOD cell may need the effect for). */
function placeGlobals(p, lanes) {
  for (let r = 0; r < p.rows; r++) {
    for (const ch of p.channels) {
      const fx = ch[r]?.fx;
      if (!fx || !GLOBAL.test(fx)) continue;
      const l = lanes.find((x) => !x[r]?.fx && !x[r]?.vol) ?? lanes.find((x) => !x[r]?.fx) ?? lanes[3];
      l[r] = { ...(l[r] ?? {}), fx };
    }
  }
}

/**
 * A snare roll whose notes carry both a rising volume and a retrig (Qxy):
 * a MOD cell holds one, so (as in stage 1) the rise is played in 16ths over
 * the first half, and the second half retrigs at `full`, the sample's
 * default MOD volume (so no Cxx is needed next to E9x).
 */
export function retrigRoll(ch, from, to, full) {
  const half = from + Math.floor((to - from) / 2), src = { ...ch };
  for (let r = from; r < to; r++) {
    const e = src[r];
    if (!e || !/^Q/.test(e.fx ?? '')) continue;
    if (r < half) ch[r] = { ...e, vol: src[from + 2 * (r - from)]?.vol ?? e.vol, fx: undefined };
    else ch[r] = { ...e, vol: `v${full}` };
    if (!ch[r].fx) delete ch[r].fx;
  }
}

/** Put Bxx (jump to order `to`) on row `r` of four lanes (a free effect slot). */
export function jump(lanes, r, to) {
  const fx = `B${to.toString(16).toUpperCase().padStart(2, '0')}`;
  const l = lanes.find((c) => !c[r]?.fx) ?? lanes[3];
  l[r] = { ...(l[r] ?? {}), fx };
}

/**
 * Arrange `song` (the PC JSON): plan(pattern, index) returns four lanes'
 * sources, or four ready channels ({ lanes }). Samples not used by any
 * lane are left out and the rest renumbered; `samples` maps a PC sample
 * name to a function returning its replacement definition.
 */
export function arrange(song, { plan, post, samples = {}, order = song.order, extra = [], trim = null, ...meta }) {
  tagInstruments(song);
  const patterns = song.patterns.map((p, i) => {
    const spec = plan(p, i);
    const channels = spec.lanes ?? spec.map((sources) => (Array.isArray(sources) ? lane(p, sources) : sources));
    placeGlobals(p, channels);
    post?.(p, channels, i);
    return { name: p.name, rows: p.rows, channels };
  });
  patterns.push(...extra);
  const used = new Map();
  for (const p of patterns) for (const ch of p.channels) for (const e of Object.values(ch)) {
    if (e.instrument != null && !used.has(e.instrument)) used.set(e.instrument, null);
  }
  const keep = [...used.keys()].sort((a, b) => a - b);
  keep.forEach((pc, i) => used.set(pc, i));
  for (const p of patterns) for (const ch of p.channels) for (const e of Object.values(ch)) {
    if (e.instrument != null) e.instrument = used.get(e.instrument);
  }
  let defs = keep.map((pc) => { const s = song.samples[pc]; return samples[s.name] ? samples[s.name](s) : s; });
  defs = levelFromNotes(patterns, defs);
  const out = { title: song.title, bpm: song.bpm, ticks: song.ticks, mixvol: song.mixvol, ...meta,
    samples: defs, channelnames: ['drums', 'riff', 'lead', 'colour'], patterns, order };
  if (trim) out.samples = trimOneShots(out, trim);
  return out;
}

/**
 * Notes that lost their volume to an effect (`prefer: 'fx'`) play at the
 * sample's default level: make that the level most of them had.
 */
function levelFromNotes(patterns, defs) {
  const tally = defs.map(() => new Map());
  for (const p of patterns) for (const ch of p.channels) for (const e of Object.values(ch)) {
    if (e._vol && e.instrument != null) tally[e.instrument].set(e._vol, (tally[e.instrument].get(e._vol) || 0) + 1);
    delete e._vol;
  }
  return defs.map((d, i) => {
    const best = [...tally[i]].sort((a, b) => b[1] - a[1] || Number(b[0].slice(1)) - Number(a[0].slice(1)))[0];
    return best ? { ...d, volume: Number(best[0].slice(1)) } : d;
  });
}

/**
 * How much of each sample the arrangement plays, in source frames: from a
 * note to the lane's next note or cut, at the note's pitch, walking the
 * order list and, for a song that jumps back, the loop once more. A note
 * nothing cuts plays to the sample's end. Speed changes (Axx) are
 * followed; slides are not.
 */
export function framesPlayed(song) {
  const src = song.samples.map(shape), most = src.map(() => 0), open = [null, null, null, null];
  let ticks = song.ticks || 6, t = 0;
  const close = (o) => { if (o) most[o.inst] = Math.max(most[o.inst], (t - o.t) * o.rate); };
  // A song that jumps back (Bxx on its last pattern) is walked on through
  // the loop once more, so its last notes end where the loop's first begin.
  const last = song.patterns[song.order.at(-1)];
  const back = last.channels.map((ch) => ch[last.rows - 1]?.fx).find((fx) => fx?.[0] === 'B');
  const walk = back ? [...song.order, ...song.order.slice(parseInt(back.slice(1), 16))] : song.order;
  let passEnd = Infinity;
  walk.forEach((pi, k) => { if (k === song.order.length) passEnd = t; const p = song.patterns[pi];
    for (let r = 0; r < p.rows; r++) {
      for (const ch of p.channels) { const fx = ch[r]?.fx; if (fx?.[0] === 'A') ticks = parseInt(fx.slice(1), 16); }
      p.channels.forEach((ch, c) => {
        const e = ch[r];
        if (!e?.note) return;
        close(open[c]);
        const inst = e.instrument ?? open[c]?.inst;
        open[c] = isNote(e.note) && inst != null
          ? { inst, t, rate: (src[inst].c5 ?? 0) * 2 ** ((nn(e.note) - 60) / 12) } : null;
      });
      t += ticks * 2.5 / (song.bpm || 125);
    }
  });
  // Still sounding at the end: a note of the first pass that nothing cut
  // (not even the loop) plays to its end; one the loop's pass opened again
  // was measured the first time round.
  for (const o of open) if (o && o.t < passEnd) most[o.inst] = Infinity;
  return most;
}

/** Cut one-shots to what the arrangement plays of them, plus a faded tail. */
function trimOneShots(song, { tail = 0.03 } = {}) {
  const need = framesPlayed(song);
  return song.samples.map((def, i) => {
    const s = shape(def);
    if (s.loop || !(need[i] < Infinity)) return def;
    const frames = need[i] + tail * s.sr;
    return frames < s.n ? oneShot(def, { seconds: frames / s.sr, fade: tail }) : def;
  });
}

// ---------------------------------------------------------------- samples
const round = (x) => Math.round(x * 10000) / 10000;

// A sample definition's length, rates and loop, without synthesizing it:
// raw PCM (the PC songs' own samples), or a synth spec as tools/synth.js
// makes it (its one-shots are noise, kick and pluck, at synth.samplerate or
// 22050 Hz, synth.seconds or 0.15 / 0.25 / 2 s long; the rest are loops).
const SYNTH_SHOT = { noise: 0.15, kick: 0.25, pluck: 2 };
function shape(def) {
  let n, sr;
  if (def.channels) [n, sr] = [def.channels[0].length, def.samplerate];
  else if (def.synth && def.synth.wave in SYNTH_SHOT) {
    sr = def.synth.samplerate || 22050;
    n = Math.round((def.synth.seconds || SYNTH_SHOT[def.synth.wave]) * sr);
  } else return { loop: true };
  const c5 = (def.c5speed || sr) * 2 ** ((def.detune || 0) / 1200);
  return { n, sr, c5, loop: Boolean(def.loop) };
}

/** A one-shot cut to `seconds`, faded over `fade`. A synth one-shot is made
 * shorter instead (its samples do not depend on its length: an exact cut,
 * with no fade). */
export function oneShot(def, { seconds, fade = 0.05 } = {}) {
  if (def.synth) return { ...def, synth: { ...def.synth, seconds: Math.round(seconds * 10000) / 10000 } };
  let x = Array.from(def.channels[0]);
  if (def.channels.length > 1) x = x.map((v, i) => (v + def.channels[1][i]) / 2);
  const sr = def.samplerate;
  if (x.length > seconds * sr) {
    x = x.slice(0, Math.round(seconds * sr));
    const n = Math.round(fade * sr);
    for (let i = 0; i < n; i++) x[x.length - 1 - i] *= i / n;
  }
  const { channels, loop, ...rest } = def;
  return { ...rest, channels: [x.map(round)] };
}

/**
 * One loop mixing whole-loop samples: parts are [def, octave, gain], and a
 * note N plays each part at N + 12 * octave (stage 1's "riff chord": the
 * power chord over its bass an octave down, for two parts in unison).
 * Each loop is resynthesized from its harmonics, so the mix stays seamless.
 */
export function mixLoops(name, parts, { n = 512, peak = 0.9 } = {}) {
  const MID_C = 261.6256, lo = Math.min(...parts.map((p) => p[1])), out = new Float64Array(n);
  for (const [def, oct, gain] of parts) {
    if (!def.channels) throw new Error(`${def.name}: mixLoops takes raw PCM loops`);
    const x = Array.from(def.channels[0]), L = x.length;
    const k = Math.round(L * MID_C / (def.c5speed || def.samplerate)), m = 2 ** (oct - lo);
    for (let h = 1; h < L / 2; h++) {
      const f = h * m / k;
      if (!Number.isInteger(f) || f >= n / 2) continue;
      let re = 0, im = 0;
      for (let j = 0; j < L; j++) { const a = 2 * Math.PI * h * j / L; re += x[j] * Math.cos(a); im -= x[j] * Math.sin(a); }
      for (let i = 0; i < n; i++) { const a = 2 * Math.PI * f * i / n; out[i] += gain * (2 / L) * (re * Math.cos(a) - im * Math.sin(a)); }
    }
  }
  const top = Math.max(...out.map(Math.abs));
  return { name, samplerate: 44100, c5speed: Math.round(n * MID_C * 2 ** lo),
    channels: [Array.from(out, (v) => round(v / top * peak))], loop: { start: 0, end: n } };
}

/** Like the kit's writeSongCompact: each sample's PCM on one line. */
export function writeSong(file, song) {
  const body = JSON.stringify({ ...song, samples: '@S' }, null, 1)
    .replace('"@S"', `[\n${song.samples.map((s) => JSON.stringify(s)).join(',\n')}\n]`);
  fs.writeFileSync(file, body);
  console.log(`${file.split('/').pop()}: ${song.patterns.length} patterns, order [${song.order}]`);
}
