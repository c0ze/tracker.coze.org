// Conservative source-level analysis. libopenmpt remains the playback authority.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readWav } from './wav.js';
import { validateSong, isNote } from './validate-song.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const names = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];
const pitch = n => names.indexOf(n.slice(0, 2)) + 12 * Number(n[2]);
const clamp = n => Math.max(0, Math.min(64, n));

function sampleInfo(s, root) {
  const wave = s.synth?.wave ?? 'sine';
  let seconds = Infinity, rateRatio = 1;
  const looped = Boolean(s.loop || s.susloop || s.synth && !['noise', 'kick', 'pluck'].includes(wave));
  if (s.synth && !looped) {
    const defaults = { noise: 0.15, kick: 0.25, pluck: 2 };
    seconds = s.synth.seconds ?? defaults[wave];
    rateRatio = (s.c5speed ?? s.synth.samplerate ?? 22050) / (s.synth.samplerate ?? 22050);
  } else if (s.file || s.channels) {
    const wav = s.file ? readWav(fs.readFileSync(path.resolve(root, s.file))) : s;
    if (!looped) seconds = wav.channels[0].length / wav.samplerate;
    rateRatio = (s.c5speed ?? wav.samplerate) / wav.samplerate;
  }
  rateRatio *= 2 ** ((s.detune ?? 0) / 1200);
  const percussion = s.role === 'percussion' || s.synth && ['kick', 'noise'].includes(wave) ||
    /kick|snare|hat|clap|crash|tom|drum|perc|nois/i.test(`${s.name ?? ''} ${s.file ?? ''}`);
  return { looped, seconds, rateRatio, pitched: !percussion, volume: s.volume ?? s.synth?.volume ?? 64 };
}

export function analyzeSong(song, { root = ROOT, maxRing = 16, maxVoices = 4, trace = false } = {}) {
  const errors = validateSong(song);
  const warnings = [], limitations = new Set();
  const result = { title: song?.title ?? '', errors, warnings, limitations: [], metrics: {}, ...(trace ? { timeline: [] } : {}) };
  if (errors.length) return result;
  let samples;
  try { samples = song.samples.map(s => sampleInfo(s, root)); }
  catch (e) { errors.push(`sample analysis: ${e.message}`); return result; }
  const nCh = Math.max(...song.patterns.map(p => p.channels.length));
  const state = Array.from({ length: nCh }, () => ({ sample: null, voice: null, volume: 64, arp: 0, slide: 0, volSlide: 0 }));
  let bpm = song.bpm ?? 120, speed = song.ticks ?? 6, seconds = 0, totalRows = 0, maxPitched = 0;
  let previousClashes = new Set();
  const used = new Set(song.order);
  const warn = (order, pattern, row, code, message) => warnings.push({ order, pattern, row, code, message });
  for (let order = 0; order < song.order.length; order++) {
    const pattern = song.order[order], p = song.patterns[pattern];
    let crowded = false;
    for (let row = 0; row < p.rows; row++, totalRows++) {
      const events = state.map((_, c) => p.channels[c]?.[row] ?? {});
      for (const ev of events) {
        if (ev.fx?.[0] === 'A') { const n = parseInt(ev.fx.slice(1), 16); if (n) speed = n; }
        if (ev.fx?.[0] === 'T') {
          const n = parseInt(ev.fx.slice(1), 16);
          if (n >= 32) bpm = n;
          else limitations.add('Tempo slides are not simulated; timing after T00..T1F is approximate.');
        }
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
            // IT key-off does not cut a normal loop in sample mode (no envelope).
            if (ev.note === '^^') s.voice = null;
            else if (ev.note === '==' && s.voice && samples[s.voice.sample].looped && !song.samples[s.voice.sample].susloop)
              warn(order, pattern, row, 'keyoff', `ch${c}: == does not stop this ordinary sample loop; use ^^ for an intended rest`);
            else if (isNote(ev.note)) {
              if (s.sample === null) warn(order, pattern, row, 'sample', `ch${c}: note has no current sample`);
              else {
                const meta = samples[s.sample], semi = pitch(ev.note);
                const porta = fx.startsWith('G') || ev.vol?.startsWith('g');
                s.voice = { semi, sample: s.sample,
                  remaining: porta && s.voice ? s.voice.remaining : meta.seconds / (meta.rateRatio * 2 ** ((semi - 60) / 12)),
                  volume: s.volume,
                  lastControl: totalRows, warned: false };
              }
            }
            if (s.voice && (ev.note || ev.vol || fx)) s.voice.lastControl = totalRows;
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
          return [{ channel: c, semi: v.semi + offset }];
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
        const dt = 2.5 / bpm;
        seconds += dt;
        for (const [c, s] of state.entries()) if (s.voice) {
          const arp = events[c].fx?.startsWith('J') ? s.arp : 0;
          const offset = tick % 3 === 1 ? arp >> 4 : tick % 3 === 2 ? arp & 15 : 0;
          s.voice.remaining -= dt * 2 ** (offset / 12);
          if (s.voice.remaining <= 1e-9) s.voice = null;
        }
      }
      previousClashes = rowClashes;
      maxPitched = Math.max(maxPitched, rowMax);
      if (rowMax > maxVoices && !crowded) {
        warn(order, pattern, row, 'density', `${rowMax} pitched voices (budget ${maxVoices}); review hierarchy, not just channel count`);
        crowded = true;
      }
      state.forEach((s, c) => {
        const v = s.voice;
        if (v && samples[v.sample].looped && v.volume > 0 && !v.warned && totalRows - v.lastControl > maxRing) {
          warn(order, pattern, row, 'sustain', `ch${c}: looped sample unattended for more than ${maxRing} rows`);
          v.warned = true;
        }
      });
      if (trace) result.timeline.push({ order, pattern, row, seconds, bpm, speed, pitched: rowMax,
        voices: state.map(s => s.voice ? { semi: s.voice.semi, volume: s.voice.volume, remaining: s.voice.remaining } : null) });
    }
  }
  state.forEach((s, c) => {
    if (s.voice && samples[s.voice.sample].looped && s.voice.volume > 0)
      warn(song.order.length - 1, song.order.at(-1), song.patterns[song.order.at(-1)].rows - 1, 'end', `ch${c}: looped sample rings past song end; write a cut or document the intended loop seam`);
  });
  if (song.samples.some(s => s.susloop)) limitations.add('Sustain-loop release tails are not simulated.');
  result.limitations = [...limitations];
  result.metrics = { seconds: +seconds.toFixed(3), rows: totalRows, orders: song.order.length,
    uniquePatterns: used.size, unusedPatterns: song.patterns.length - used.size,
    maxPitchedVoices: maxPitched, rowsPerBeat: 24 / (song.ticks ?? 6),
    rowsPerBar4_4: 96 / (song.ticks ?? 6) };
  return result;
}
