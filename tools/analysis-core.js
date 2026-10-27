// Conservative source-level analysis. libopenmpt remains the playback authority.
// Browser-safe: sample lengths that need files or decoded audio come from opts.sampleMeta
// (tools/song-analysis.js supplies WAV files and raw channels in Node).
import { validateSong, isNote } from './validate-song.js';
import { describeSynth } from './synth.js';
import { isNoteName } from './validate-sid.js';

const names = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];
const pitch = n => names.indexOf(n.slice(0, 2)) + 12 * Number(n[2]);
const clamp = n => Math.max(0, Math.min(64, n));

// SID envelope: decay and release from 15 to 0, in seconds, for 0..15 (attack is a third of
// this; c64prg.txt, "Envelope rates"). Pitch does not change it.
const SID_DECAY = [0.006, 0.024, 0.048, 0.072, 0.114, 0.168, 0.204, 0.24, 0.3, 0.75, 1.5, 2.4, 3, 9, 15, 24];

// Percussion by name, whole words only ("Phat Lead" is not a hat); role overrides either way.
const DRUM_NAME = /\b(?:kick|snare|hi-?hat|hat|clap|crash|ride|tom|drum|perc|noise)s?\b/i;
const percussive = (s, inferred) => s.role === 'percussion' || (s.role !== 'pitched' && inferred);

// A SID note's length: held to the key off when it sustains, else attack and decay.
const sidSeconds = ({ attack, decay }, sustain) => (sustain > 0 ? Infinity : SID_DECAY[attack] / 3 + SID_DECAY[decay]);

// A SID row lasts whole PAL frames (sid/FORMAT.md, Speed and funktempo): sid.speed, or the IT
// speed and tempo rounded, or with funktempo alternating so two rows take round(2 x exact).
const PAL_FPS = 985248 / 19656;
function sidRowSeconds(sid, speed, bpm, row) {
  const exact = (speed * 125) / bpm, frame = (f) => Math.min(255, Math.max(2, f));
  const pair = Math.round(2 * exact);
  const frames = sid.speed ?? (sid.funktempo ? frame(row % 2 ? Math.floor(pair / 2) : Math.ceil(pair / 2)) : frame(Math.round(exact)));
  return frames / PAL_FPS;
}

function sidInfo(s) {
  const [a, d, sustain] = s.sid.adsr;
  const steps = s.sid.wave.map((step) => (Array.isArray(step) ? step[0] : step));
  const noisy = steps.slice(0, 4).filter((w) => typeof w === 'string' ? w.includes('noise') : w & 0x80).length;
  // Every step at a fixed note (a drum): the row's note does not set the pitch.
  const fixed = s.sid.wave.every((step) => Array.isArray(step) && isNoteName(step[1]));
  // By its wavetable, not its name: a "kick bass" is a bass.
  const percussion = percussive(s, fixed || noisy * 2 > Math.min(4, steps.length));
  return { sid: true, attack: a, decay: d, looped: sustain > 0, seconds: sidSeconds({ attack: a, decay: d }, sustain),
    rateRatio: 1, pitched: !percussion, volume: 64, transpose: s.sid.transpose ?? 0,
    // The pitch a held note sounds, as semitones from the row's note, frame by frame
    // (sid/FORMAT.md, Wavetable). A table that does not loop holds its last step: the steps
    // before it are an attack (a click, a kick's drop, an octave blip) and count as that pitch.
    // A looping table cycles its tonal steps (an arpeggio); its noise steps and the steps
    // before the loop count as the cycle's first pitch.
    cycle: (() => {
      const rel = (step) => (Array.isArray(step) && Number.isInteger(step[1]) ? step[1] : 0);
      const noisy = (step) => { const w = Array.isArray(step) ? step[0] : step; return typeof w === 'string' ? w.includes('noise') : (w & 0x80) !== 0; };
      if (s.sid.loop === undefined) return [rel(s.sid.wave.at(-1))];
      const looped = s.sid.wave.slice(s.sid.loop), first = looped.find((x) => !noisy(x));
      return looped.map((x) => rel(noisy(x) ? first ?? x : x));
    })(), loop: s.sid.loop ?? 0 };
}

/** A SID instrument's pitch offset `frame` frames into its note. */
function wavetableOffset(meta, frame) {
  return meta.cycle[Math.max(0, frame - meta.loop) % meta.cycle.length];
}

// sampleMeta(def, index) -> { frames, samplerate } | null gives a non-synth sample's length;
// without it the sample counts as unbounded at its c5speed.
function sampleInfo(s, index, sampleMeta) {
  if (s.sid) return sidInfo(s);
  const synth = s.synth ? describeSynth(s.synth) : null;
  let seconds = Infinity, rateRatio = 1;
  const looped = Boolean(s.loop || s.susloop || synth && synth.mode !== 'shot');
  const meta = synth ? null : sampleMeta(s, index);
  if (synth && !looped) {
    seconds = synth.seconds;
    rateRatio = (s.c5speed ?? synth.c5speed ?? synth.samplerate) / synth.samplerate;
  } else if (meta) {
    if (!looped) seconds = meta.frames / meta.samplerate;
    rateRatio = (s.c5speed ?? meta.samplerate) / meta.samplerate;
  }
  rateRatio *= 2 ** ((s.detune ?? 0) / 1200);
  const percussion = percussive(s, synth?.percussion ||
    DRUM_NAME.test(`${s.name ?? ''} ${(s.file ?? '').replace(/[/\\._-]+/g, ' ')}`));
  return { looped, seconds, rateRatio, pitched: !percussion, volume: s.volume ?? s.synth?.volume ?? 64 };
}

/**
 * Analyze a song without touching files. Same report as analyzeSong (tools/song-analysis.js);
 * past maxTicks simulated ticks or maxSeconds of simulated time it stops with an `analysis exceeded`
 * error, and past maxWarnings warnings it stops recording them (a limitation says so).
 */
export function analyzeSongCore(song, { sampleMeta = () => null, maxRing = 16, maxVoices = 4, trace = false,
  maxTicks = Infinity, maxSeconds = Infinity, maxWarnings = Infinity } = {}) {
  const errors = validateSong(song, { sid: song?.sid !== undefined });
  const warnings = [], limitations = new Set();
  const result = { title: song?.title ?? '', errors, warnings, limitations: [], metrics: {}, ...(trace ? { timeline: [] } : {}) };
  if (errors.length) return result;
  let samples;
  try { samples = song.samples.map((s, i) => sampleInfo(s, i, sampleMeta)); }
  catch (e) { errors.push(`sample analysis: ${e.message}`); return result; }
  const nCh = Math.max(...song.patterns.map(p => p.channels.length));
  const state = Array.from({ length: nCh }, () => ({ sample: null, voice: null, volume: 64, arp: 0, slide: 0, volSlide: 0 }));
  let bpm = song.bpm ?? 120, speed = song.ticks ?? 6, seconds = 0, totalRows = 0, totalTicks = 0, maxPitched = 0;
  // A loop is unattended after maxRing rows and also maxRing rows' worth of speed-6 ticks:
  // fast speeds (3, 4) get the same musical time as speed 6, slow ones keep the row count.
  const ringTicks = maxRing * 6;
  let previousClashes = new Set();
  const used = new Set(song.order);
  const warn = (order, pattern, row, code, message) => {
    if (warnings.length < maxWarnings) warnings.push({ order, pattern, row, code, message });
    else limitations.add(`warnings truncated after ${maxWarnings}`);
  };
  for (let order = 0; order < song.order.length; order++) {
    const pattern = song.order[order], p = song.patterns[pattern];
    let crowded = false;
    for (let row = 0; row < p.rows; row++, totalRows++, totalTicks += speed) {
      const events = state.map((_, c) => p.channels[c]?.[row] ?? {});
      for (const ev of events) {
        if (ev.fx?.[0] === 'A') { const n = parseInt(ev.fx.slice(1), 16); if (n) speed = n; }
        if (ev.fx?.[0] === 'T') {
          const n = parseInt(ev.fx.slice(1), 16);
          if (n >= 32) bpm = n;
          else limitations.add('Tempo slides are not simulated; timing after T00..T1F is approximate.');
        }
      }
      if (totalTicks + speed > maxTicks) {
        errors.push(`analysis exceeded ${maxTicks} ticks`);
        return result;
      }
      const rowClashes = new Set();
      let rowMax = 0;
      for (let tick = 0; tick < speed; tick++) {
        events.forEach((ev, c) => {
          const s = state[c];
          const fx = ev.fx ?? '', param = parseInt(fx.slice(1), 16) || 0;
          const delayed = fx.startsWith('SD');
          const eventTick = delayed ? (param & 15) || 1 : 0;
          if (tick === 0) {
            if (delayed && eventTick >= speed) warn(order, pattern, row, 'delay', `ch${c}: ${fx} delays the note beyond this row's ${speed} ticks`);
            if (fx.startsWith('SC') && (param & 15) >= speed) warn(order, pattern, row, 'cut', `ch${c}: ${fx} does not cut within this row's ${speed} ticks`);
            if (fx.startsWith('J') && param) s.arp = param;
            if (fx.startsWith('D') && param) s.slide = param;
            if (fx && !/^(?:A|D|J|T|X)/.test(fx) && !/^S[CD]/.test(fx))
              limitations.add(`Effect ${fx[0]} is not simulated (pitch, volume or flow may differ).`);
            if (ev.vol && /^[efgh]/.test(ev.vol)) limitations.add(`Volume effect ${ev.vol[0]} is not simulated.`);
          }
          if (tick === eventTick) {
            if (ev.instrument !== undefined) {
              s.sample = ev.instrument;
              s.volume = samples[s.sample].volume;
            }
            if (ev.vol?.startsWith('v')) s.volume = Number(ev.vol.slice(1));
            // IT key-off does not cut a normal loop in sample mode (no envelope); a SID key off
            // starts the release, counted here as the end of the note.
            if (ev.note === '^^') s.voice = null;
            else if (ev.note === '==' && s.voice && samples[s.voice.sample].sid) s.voice = null;
            else if (ev.note === '==' && s.voice && samples[s.voice.sample].looped && !song.samples[s.voice.sample].susloop)
              warn(order, pattern, row, 'keyoff', `ch${c}: == does not stop this ordinary sample loop; use ^^ for an intended rest`);
            else if (isNote(ev.note)) {
              if (s.sample === null) warn(order, pattern, row, 'sample', `ch${c}: note has no current sample`);
              else {
                const meta = samples[s.sample], semi = pitch(ev.note) + (meta.transpose ?? 0);
                const porta = fx.startsWith('G') || ev.vol?.startsWith('g');
                s.voice = { semi, sample: s.sample,
                  remaining: porta && s.voice ? s.voice.remaining
                    : meta.sid ? (ev.vol?.startsWith('v') ? sidSeconds(meta, Math.round(Number(ev.vol.slice(1)) * 15 / 64)) : meta.seconds)
                    : meta.seconds / (meta.rateRatio * 2 ** ((semi - 60) / 12)),
                  volume: s.volume,
                  lastControl: totalTicks + tick, lastRow: totalRows, warned: false, frame: 0 };
              }
            }
            if (s.voice && (ev.note || ev.vol || fx)) { s.voice.lastControl = totalTicks + tick; s.voice.lastRow = totalRows; } // SDx acts late
          }
          const v = s.voice;
          if (fx.startsWith('SC') && tick === ((param & 15) || 1)) { s.voice = null; return; }
          if (fx.startsWith('D')) {
            const amount = param || s.slide, hi = amount >> 4, lo = amount & 15;
            if (amount === 0x0f) s.volume = clamp(s.volume - 15);
            else if (amount === 0xf0) s.volume = clamp(s.volume + 15);
            else if (amount === 0xff) { if (tick === 0) s.volume = clamp(s.volume + 15); }
            else if (hi === 15 && lo > 0) { if (tick === 0) s.volume = clamp(s.volume - lo); }
            else if (lo === 15 && hi > 0) { if (tick === 0) s.volume = clamp(s.volume + hi); }
            else if (tick > 0) s.volume = clamp(s.volume + (lo === 0 ? hi : hi === 0 ? -lo : 0));
          }
          if (ev.vol && /^[abcd]/.test(ev.vol)) {
            const type = ev.vol[0], n = Number(ev.vol.slice(1));
            if (n) s.volSlide = n;
            if ((type === 'a' || type === 'b') ? tick === 0 : tick > 0)
              s.volume = clamp(s.volume + (type === 'a' || type === 'c' ? 1 : -1) * (n || s.volSlide));
          }
          if (v) v.volume = s.volume;
        });
        const active = state.flatMap((s, c) => {
          const v = s.voice;
          if (!v || v.remaining <= 1e-9 || v.volume <= 0 || !samples[v.sample].pitched) return [];
          const arp = events[c].fx?.startsWith('J') ? s.arp : 0;
          const offset = tick % 3 === 1 ? arp >> 4 : tick % 3 === 2 ? arp & 15 : 0;
          const meta = samples[v.sample];
          return [{ channel: c, semi: v.semi + offset + (meta.sid ? wavetableOffset(meta, Math.floor(v.frame)) : 0) }];
        });
        rowMax = Math.max(rowMax, active.length);
        for (let a = 0; a < active.length; a++) for (let b = a + 1; b < active.length; b++) {
          const x = active[a], y = active[b], d = Math.abs(x.semi - y.semi);
          if (d > 0 && (d <= 2 || d % 12 === 1 && d <= 25)) {
            const key = `${x.channel}:${y.channel}:${d}`;
            if (!rowClashes.has(key) && !previousClashes.has(key))
              warn(order, pattern, row, 'clash', `clash: ch${x.channel} and ch${y.channel}, ${d} semitones at tick ${tick}; check duration and harmonic intent`);
            rowClashes.add(key);
          }
        }
        const dt = song.sid ? sidRowSeconds(song.sid, speed, bpm, row) / speed : 2.5 / bpm;
        seconds += dt;
        for (const [c, s] of state.entries()) if (s.voice) {
          const arp = events[c].fx?.startsWith('J') ? s.arp : 0;
          const offset = tick % 3 === 1 ? arp >> 4 : tick % 3 === 2 ? arp & 15 : 0;
          s.voice.remaining -= samples[s.voice.sample].sid ? dt : dt * 2 ** (offset / 12);
          s.voice.frame += song.sid ? dt * PAL_FPS : 0;
          if (s.voice.remaining <= 1e-9) s.voice = null;
        }
      }
      if (seconds > maxSeconds) {
        errors.push(`analysis exceeded ${maxSeconds} seconds`);
        return result;
      }
      previousClashes = rowClashes;
      maxPitched = Math.max(maxPitched, rowMax);
      if (rowMax > maxVoices && !crowded) {
        warn(order, pattern, row, 'density', `${rowMax} pitched voices (budget ${maxVoices}); review hierarchy, not just channel count`);
        crowded = true;
      }
      state.forEach((s, c) => {
        const v = s.voice;
        if (v && samples[v.sample].looped && v.volume > 0 && !v.warned && totalRows - v.lastRow > maxRing && totalTicks - v.lastControl > ringTicks) {
          warn(order, pattern, row, 'sustain', `ch${c}: ${samples[v.sample].sid ? 'held SID note' : 'looped sample'} unattended for more than ${maxRing} rows${speed < 6 ? ` (${maxRing / 4} beats at speed 6)` : ''}`);
          v.warned = true;
        }
      });
      if (trace) result.timeline.push({ order, pattern, row, seconds, bpm, speed, pitched: rowMax,
        voices: state.map(s => s.voice ? { semi: s.voice.semi, volume: s.voice.volume, remaining: s.voice.remaining } : null) });
    }
  }
  state.forEach((s, c) => {
    if (s.voice && samples[s.voice.sample].looped && s.voice.volume > 0)
      warn(song.order.length - 1, song.order.at(-1), song.patterns[song.order.at(-1)].rows - 1, 'end', `ch${c}: ${samples[s.voice.sample].sid ? 'held SID note' : 'looped sample'} rings past song end; write a cut or document the intended loop seam`);
  });
  if (song.samples.some(s => s.susloop)) limitations.add('Sustain-loop release tails are not simulated.');
  if (samples.some(s => s.sid)) limitations.add('SID notes end at a key off (release tails are not counted); filter and pulse are not simulated.');
  result.limitations = [...limitations];
  result.metrics = { seconds: +seconds.toFixed(3), rows: totalRows, orders: song.order.length,
    uniquePatterns: used.size, unusedPatterns: song.patterns.length - used.size,
    maxPitchedVoices: maxPitched, rowsPerBeat: 24 / (song.ticks ?? 6),
    rowsPerBar4_4: 96 / (song.ticks ?? 6) };
  return result;
}
