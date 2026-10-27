#!/usr/bin/env node
/**
 * sid-study — what a SID tune does, measured from its register trace (tools/sid-trace.js):
 * notes and their lengths, instruments (waveform steps, ADSR, hard restart), arpeggios,
 * vibrato, slides, drums, pulse and filter sweeps. The agent's tool for studying SID music.
 *
 * Usage:
 *   node tools/sid-study.js <file.sid> [--song N] [--seconds S]     # summary
 *   node tools/sid-study.js <file.sid> --notes 0 [--from T] [--count N] # voice 0's notes
 *   node tools/sid-study.js <file.sid> --json out.json                # full summary
 *   node tools/sid-study.js --corpus <dir> --out build/analysis/sid-corpus.json
 *       [--songlengths <dir>/Songlengths.md5] [--seconds S]
 *
 * A "tick" is one play call: a frame for most tunes, less for multispeed ones. Notes are
 * cozy-tracker names (C-5 = middle C). What is measured is register state after each call;
 * it is evidence about technique, not about how the tune sounds.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { parseArgs } from 'node:util';
import { loadCrsid, traceSid, parseSonglengths, md5 } from './sid-trace.js';
import { noteName } from './sid-data.js';

const WAVES = [[0x80, 'noise'], [0x40, 'pulse'], [0x20, 'saw'], [0x10, 'tri']];
export const waveName = (ctrl) => {
  const parts = WAVES.filter(([b]) => ctrl & b).map(([, n]) => n);
  if (ctrl & 0x04) parts.push('ring');
  if (ctrl & 0x02) parts.push('sync');
  if (ctrl & 0x08) parts.push('test');
  return parts.join('+') || 'none';
};
const hex = (v, n = 2) => v.toString(16).toUpperCase().padStart(n, '0');
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
function top(counts, n = 5) {
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, c]) => ({ value: k, count: c }));
}
function tally(map, k) { map.set(k, (map.get(k) || 0) + 1); }
function tallyOf(keys) { const m = new Map(); keys.forEach((k) => tally(m, k)); return m; }

/** Register trace -> per-tick voice and filter state. */
export function decode(trace) {
  const { regs, calls, clock } = trace;
  const voices = [0, 1, 2].map((v) => {
    const freq = new Uint16Array(calls), pw = new Uint16Array(calls), ctrl = new Uint8Array(calls);
    const ad = new Uint8Array(calls), sr = new Uint8Array(calls), pitch = new Float64Array(calls);
    for (let t = 0; t < calls; t++) {
      const b = t * 25 + v * 7;
      freq[t] = regs[b] | (regs[b + 1] << 8);
      pw[t] = regs[b + 2] | ((regs[b + 3] & 15) << 8);
      ctrl[t] = regs[b + 4]; ad[t] = regs[b + 5]; sr[t] = regs[b + 6];
      // cozy-tracker note number (C-5 = 60): MIDI numbering, one octave lower in name.
      pitch[t] = freq[t] ? 69 + 12 * Math.log2((freq[t] * clock) / 16777216 / 440) : NaN;
    }
    return { freq, pw, ctrl, ad, sr, pitch };
  });
  const filter = { cutoff: new Uint16Array(calls), res: new Uint8Array(calls), route: new Uint8Array(calls),
    mode: new Uint8Array(calls), volume: new Uint8Array(calls) };
  for (let t = 0; t < calls; t++) {
    const b = t * 25;
    filter.cutoff[t] = (regs[b + 21] & 7) | (regs[b + 22] << 3);
    filter.res[t] = regs[b + 23] >> 4;
    filter.route[t] = regs[b + 23] & 15;
    filter.mode[t] = regs[b + 24] & 0x70;
    filter.volume[t] = regs[b + 24] & 15;
  }
  return { voices, filter, calls };
}

// The smallest period p (2..16 ticks) that repeats a rounded-pitch sequence of in-tune steps
// at most two octaves apart, or null. (A wide vibrato also flips between two semitones; its
// pitches sit between them, so it fails the in-tune test.)
function arpPeriod(r, pitch) {
  const inTune = pitch.filter((x, i) => Math.abs(x - r[i]) <= 0.25).length;
  if (inTune < 0.8 * pitch.length) return null;
  // The pitch must keep moving: a one-shot attack then a held note repeats only its tail.
  const moves = r.slice(1).filter((x, i) => x !== r[i]).length;
  for (let p = 2; p <= 16 && p * 2 <= r.length; p++) {
    let ok = 0, n = 0;
    for (let i = 0; i + p < r.length; i++) { n++; if (r[i] === r[i + p]) ok++; }
    const cyc = r.slice(0, p);
    const perCycle = cyc.filter((x, i) => x !== cyc[(i + 1) % p]).length;
    if (n && ok / n >= 0.8 && new Set(cyc).size >= 2 && Math.max(...cyc) - Math.min(...cyc) <= 24 &&
        moves >= 3 && moves >= 0.7 * perCycle * ((r.length - 1) / p)) return p;
  }
  return null;
}

/** One note (from tick t0, `len` ticks to the next onset) -> its measured features. */
function describeNote(V, t0, len, gateLen) {
  const win = Math.min(len, 64);
  const ticks = [...Array(win).keys()].map((i) => t0 + i);
  const waves = ticks.slice(0, 8).map((t) => V.ctrl[t] & 0xfe);
  const rounded = ticks.map((t) => Math.round(V.pitch[t]));
  const note = { tick: t0, len, gate: gateLen, ad: V.ad[t0], sr: V.sr[t0], waves };
  // A drum is mostly noise in its first ticks; a pitched note may start with a noise click.
  const head = ticks.slice(0, Math.min(win, 6));
  const noisy = head.filter((t) => V.ctrl[t] & 0x80).length;
  note.drum = noisy * 2 >= head.length;
  note.noiseAttack = !note.drum && ticks.slice(0, 3).some((t) => V.ctrl[t] & 0x80);
  if (note.drum || note.noiseAttack) note.drumPitches = head.map((t) => Math.round(V.pitch[t]));
  // The base pitch: the most common rounded pitch after the attack (steps 2..16).
  const counts = new Map();
  for (const r of rounded.slice(Math.min(2, win - 1), 16)) if (Number.isFinite(r)) tally(counts, r);
  const base = top(counts, 1)[0]?.value ?? rounded[0];
  note.base = base;
  // Noise frames (a click on the attack) are not part of an arpeggio.
  const tonal = ticks.filter((t) => !(V.ctrl[t] & 0x80) && Number.isFinite(V.pitch[t])).slice(0, 32);
  const tonalRounded = tonal.map((t) => Math.round(V.pitch[t]));
  const p = !note.drum && arpPeriod(tonalRounded, tonal.map((t) => V.pitch[t]));
  // A flick: the first tonal ticks off the note (one to three), then the note held.
  if (!p && !note.drum && tonalRounded.length >= 6) {
    const k = tonalRounded.findIndex((x, i) => i > 0 && tonalRounded.slice(i, 16).every((y) => y === x));
    const held = tonalRounded[k], off = tonalRounded.slice(0, k).map((x) => x - held);
    if (k >= 1 && k <= 3 && off.some((x) => x) && off.every((x) => Math.abs(x) <= 24)) {
      note.flick = off;
      note.base = held;
    }
  }
  if (p) {
    const cyc = tonalRounded.slice(0, p), lo = Math.min(...cyc);
    note.arp = { intervals: [...new Set(cyc.map((x) => x - lo))].sort((a, b) => a - b), period: p,
      step: +(p / new Set(cyc).size).toFixed(2) };
    note.base = lo;
  } else if (!note.drum && win >= 12) {
    // After the attack, and leaving out noise frames (a noise click is not part of the pitch).
    const settled = ticks.slice(2).filter((t) => !(V.ctrl[t] & 0x80)).map((t) => 100 * (V.pitch[t] - base)).filter(Number.isFinite);
    const lo = Math.min(...settled), hi = Math.max(...settled);
    const mean = settled.reduce((a, b) => a + b, 0) / settled.length;
    const cross = [];
    let start = null;
    for (let i = 1; i < settled.length; i++) {
      if ((settled[i - 1] - mean) * (settled[i] - mean) < 0) cross.push(i);
      if (start === null && Math.abs(settled[i] - settled[0]) > 4) start = i + 2;
    }
    // In tune on two or more semitones: a trill (Tel's legato F/F#), not a vibrato.
    const tuned = ticks.slice(2).filter((t) => !(V.ctrl[t] & 0x80) && Number.isFinite(V.pitch[t]));
    const steps = new Set(tuned.map((t) => Math.round(V.pitch[t])));
    const inTune = tuned.filter((t) => Math.abs(V.pitch[t] - Math.round(V.pitch[t])) <= 0.2).length;
    if (steps.size >= 2 && steps.size <= 3 && inTune >= 0.9 * tuned.length && cross.length >= 3) {
      const low = Math.min(...steps);
      note.trill = { intervals: [...steps].map((x) => x - low).sort((a, b) => a - b), period: +((2 * (cross.at(-1) - cross[0])) / (cross.length - 1)).toFixed(1) };
    // Two crossings a period, timed from the first to the last (a held tail adds none).
    } else if (hi - lo >= 10 && hi - lo <= 250 && cross.length >= 3) {
      const period = (2 * (cross.at(-1) - cross[0])) / (cross.length - 1);
      note.vibrato = { depth: Math.round((hi - lo) / 2), period: +period.toFixed(1), delay: start ?? 0 };
    } else {
      const total = V.pitch[ticks[win - 1]] - V.pitch[t0];
      if (Math.abs(total) >= 1) {
        let mono = 0;
        for (let i = 1; i < win; i++) if (Math.sign(V.pitch[ticks[i]] - V.pitch[ticks[i - 1]]) === Math.sign(total)) mono++;
        if (mono / (win - 1) >= 0.6) note.slide = { semitones: +total.toFixed(1), ticks: win };
      }
    }
  }
  if (waves.some((x) => x & 0x40)) {
    const pws = ticks.map((t) => V.pw[t]);
    const steps = pws.slice(1).map((x, i) => Math.abs(x - pws[i])).filter((d) => d);
    note.pulse = { start: pws[0], min: Math.min(...pws), max: Math.max(...pws), step: median(steps) ?? 0 };
  }
  return note;
}

const bucket = (n) => (n <= 3 ? String(n) : n <= 8 ? '4-8' : '9+');
/** How a note was prepared: gate-off ticks, and the ADSR in the tick before when it differs. */
function restartKey(n) {
  const adsr = `${hex(n.hr.ad)}${hex(n.hr.sr)}`, own = `${hex(n.ad)}${hex(n.sr)}`;
  return `gate off ${bucket(n.hr.off)}` + (adsr !== own ? `, ADSR $${adsr} for ${bucket(n.hr.same)}` : '') + (n.hr.test ? ', test bit' : '');
}

/** Onsets for one voice: gate rising edges, plus legato note changes under a held gate. */
function notesOf(V, calls) {
  const onsets = [];
  for (let t = 0; t < calls; t++) {
    const gate = V.ctrl[t] & 1, was = t ? V.ctrl[t - 1] & 1 : 0;
    if (gate && !was) onsets.push({ t, legato: false });
  }
  // A held gate that moves to a new pitch and holds it 3+ ticks is a legato note, unless the
  // old pitch comes back within 8 ticks, or the new one was held in the 8 ticks before (an arp
  // or a trill: one note with an ornament). Noise frames (a click on the attack) do not count.
  const legato = [];
  for (let i = 0; i < onsets.length; i++) {
    const end = i + 1 < onsets.length ? onsets[i + 1].t : calls;
    const at = (t) => Math.round(V.pitch[t]);
    let held = null, prev = null, run = 0;
    const heldAt = new Map(); // pitch -> last tick it was held
    for (let t = onsets[i].t; t < end; t++) {
      if (!(V.ctrl[t] & 1)) break;
      if (V.ctrl[t] & 0x80) continue;
      const r = at(t);
      run = r === prev ? run + 1 : 1;
      prev = r;
      if (run >= 3 && r === held) heldAt.set(r, t);
      if (run !== 3) continue;
      let back = false;
      for (let k = t + 1; k < Math.min(end, t + 9); k++) if (at(k) === held) back = true;
      const again = heldAt.has(r) && t - 2 - heldAt.get(r) <= 8;
      if (held !== null && r !== held && !back && !again) legato.push({ t: t - 2, legato: true });
      held = r;
      heldAt.set(r, t);
    }
  }
  const all = [...onsets, ...legato].sort((a, b) => a.t - b.t);
  return all.map((o, i) => {
    const next = i + 1 < all.length ? all[i + 1].t : calls;
    let g = o.t;
    while (g < next && V.ctrl[g] & 1) g++;
    // Hard restart: how the voice looked in the ticks before a gated onset.
    // off: ticks with the gate off; same: ticks the ADSR before the onset was already set.
    let hr = null;
    if (!o.legato && o.t >= 1) {
      const b = o.t - 1;
      let off = 0, same = 0;
      while (off < 64 && b - off >= 0 && !(V.ctrl[b - off] & 1)) off++;
      while (same < 64 && b - same >= 0 && V.ad[b - same] === V.ad[b] && V.sr[b - same] === V.sr[b]) same++;
      hr = { off, same, ad: V.ad[b], sr: V.sr[b], test: Boolean(V.ctrl[b] & 8) };
    }
    return { ...describeNote(V, o.t, next - o.t, g - o.t), legato: o.legato, hr };
  });
}

/** Trace -> study summary (plain data, JSON-safe). */
export function studyTrace(trace, { keepNotes = false } = {}) {
  const d = decode(trace), calls = d.calls;
  const summary = {
    title: trace.header.title, author: trace.header.author, released: trace.header.released,
    format: `${trace.header.magic} v${trace.header.version}`, model: trace.header.model, video: trace.video,
    song: trace.song, songs: trace.header.songs, seconds: +(calls / trace.callsPerSecond).toFixed(1),
    callsPerFrame: trace.callsPerFrame, gridFit: trace.fit, calls: trace.method, timer: trace.cia === null ? 'own IRQ (RSID)' : trace.cia ? 'CIA' : 'vblank',
    voices: [],
  };
  const allIoi = new Map(), allNotes = [];
  d.voices.forEach((V, v) => {
    const notes = notesOf(V, calls);
    let gated = 0;
    const waveTicks = new Map(), adsr = new Map(), hr = new Map(), drums = new Map(), arps = new Map();
    for (let t = 0; t < calls; t++) if (V.ctrl[t] & 1) { gated++; tally(waveTicks, waveName(V.ctrl[t] & 0xfe)); }
    for (const n of notes) {
      tally(adsr, `${hex(n.ad)}${hex(n.sr)}`);
      if (n.hr) tally(hr, restartKey(n));
      if (n.drum) tally(drums, n.waves.slice(0, 6).map((x) => hex(x)).join(' '));
      if (n.arp) tally(arps, `${n.arp.intervals.join('-')} (${n.arp.step} tick${n.arp.step === 1 ? '' : 's'}/step)`);
      if (!n.legato) tally(allIoi, n.len);
    }
    const pitched = notes.filter((n) => !n.drum && Number.isFinite(n.base));
    const bases = pitched.map((n) => n.base);
    const vib = notes.filter((n) => n.vibrato).map((n) => n.vibrato);
    const pulse = notes.filter((n) => n.pulse);
    const routed = d.filter.route.reduce((a, r) => a + ((r >> v) & 1), 0);
    summary.voices.push({
      voice: v, notes: notes.length, noiseAttack: notes.filter((n) => n.noiseAttack).length, legato: notes.filter((n) => n.legato).length, gatedPct: pct(gated, calls),
      waves: top(waveTicks, 6).map(({ value, count }) => ({ value, pct: pct(count, gated) })),
      range: bases.length ? { low: noteName(Math.min(...bases)), median: noteName(median(bases)), high: noteName(Math.max(...bases)) } : null,
      adsr: top(adsr, 4), hardRestart: top(hr, 3),
      drums: { count: notes.filter((n) => n.drum).length, waves: top(drums, 4) },
      arps: { count: notes.filter((n) => n.arp).length, kinds: top(arps, 4) },
      vibrato: vib.length ? { count: vib.length, depthCents: median(vib.map((x) => x.depth)), periodTicks: median(vib.map((x) => x.period)), delayTicks: median(vib.map((x) => x.delay)) } : null,
      slides: notes.filter((n) => n.slide).length, trills: notes.filter((n) => n.trill).length,
      flicks: { count: notes.filter((n) => n.flick).length, kinds: top(tallyOf(notes.filter((n) => n.flick).map((n) => n.flick.join(' '))), 4) },
      pulse: pulse.length ? { notes: pulse.length, swept: pulse.filter((n) => n.pulse.step).length, stepMedian: median(pulse.filter((n) => n.pulse.step).map((n) => n.pulse.step)), startMedian: median(pulse.map((n) => n.pulse.start)) } : null,
      filteredPct: pct(routed, calls),
    });
    if (keepNotes) allNotes.push(notes);
  });
  summary.ioi = top(allIoi, 8);
  // Filter: only while some voice is routed through it.
  const f = d.filter, on = [];
  for (let t = 0; t < calls; t++) if (f.route[t] & 7) on.push(t);
  if (on.length) {
    const cut = on.map((t) => f.cutoff[t]);
    const moves = on.slice(1).map((t, i) => (t === on[i] + 1 ? Math.abs(f.cutoff[t] - f.cutoff[on[i]]) : 0)).filter((x) => x);
    const modes = new Map(), res = new Map();
    for (const t of on) { tally(modes, ['', 'low', 'band', 'low+band', 'high', 'low+high', 'band+high', 'low+band+high'][f.mode[t] >> 4] || 'off'); tally(res, f.res[t]); }
    summary.filter = { pct: pct(on.length, calls), cutoff: { min: Math.min(...cut), median: median(cut), max: Math.max(...cut) },
      movingPct: pct(moves.length, on.length), stepMedian: median(moves), modes: top(modes, 3), resonance: top(res, 3) };
  } else summary.filter = null;
  let volChanges = 0;
  for (let t = 1; t < calls; t++) if (f.volume[t] !== f.volume[t - 1]) volChanges++;
  summary.volumeChanges = volChanges;
  if (keepNotes) summary.notes = allNotes;
  return summary;
}

// ---- text output

function printSummary(s) {
  const o = [];
  o.push(`${s.title} — ${s.author} (${s.released}) ${s.format}, ${s.model}, ${s.video}; song ${s.song}/${s.songs}, ${s.seconds} s, ` +
    `${s.timer}, ${s.callsPerFrame} call${s.callsPerFrame === 1 ? '' : 's'}/frame (${s.calls === 'hooked' ? 'every call seen' : 'calls guessed from the writes'})`);
  if (s.calls !== 'hooked' && s.gridFit < 0.8) o.push(`warning: only ${Math.round(100 * s.gridFit)}% of the calls write in one burst; the measured call period may be wrong`);
  o.push(`note lengths (ticks: count): ${s.ioi.map((x) => `${x.value}:${x.count}`).join('  ')}`);
  for (const v of s.voices) {
    o.push(`voice ${v.voice}: ${v.notes} notes (${v.legato} legato, ${v.noiseAttack} with a noise attack), gate on ${v.gatedPct}%` +
      (v.range ? `, ${v.range.low}..${v.range.high} (median ${v.range.median})` : '') + `, filtered ${v.filteredPct}%`);
    o.push(`  waves: ${v.waves.map((w) => `${w.value} ${w.pct}%`).join(', ')}`);
    o.push(`  ADSR: ${v.adsr.map((a) => `$${a.value}×${a.count}`).join(' ')}; restart: ${v.hardRestart.map((h) => `${h.value} ×${h.count}`).join('; ') || '-'}`);
    if (v.drums.count) o.push(`  drums ${v.drums.count}: ${v.drums.waves.map((d) => `[${d.value}]×${d.count}`).join(' ')}`);
    if (v.arps.count) o.push(`  arps ${v.arps.count}: ${v.arps.kinds.map((a) => `${a.value}×${a.count}`).join(', ')}`);
    if (v.vibrato) o.push(`  vibrato ${v.vibrato.count}: ±${v.vibrato.depthCents} cents, period ${v.vibrato.periodTicks}, delay ${v.vibrato.delayTicks} ticks`);
    if (v.slides) o.push(`  slides ${v.slides}`);
    if (v.trills) o.push(`  trills ${v.trills}`);
    if (v.flicks.count) o.push(`  attack flicks ${v.flicks.count}: ${v.flicks.kinds.map((f) => `${f.value}×${f.count}`).join(', ')} (semitones from the held note)`);
    if (v.pulse) o.push(`  pulse: ${v.pulse.notes} notes, ${v.pulse.swept} swept (median step ${v.pulse.stepMedian}/tick), start width ${v.pulse.startMedian}`);
  }
  if (s.filter) o.push(`filter on ${s.filter.pct}%: cutoff ${s.filter.cutoff.min}..${s.filter.cutoff.max} (median ${s.filter.cutoff.median}), ` +
    `moving ${s.filter.movingPct}% of ticks (median step ${s.filter.stepMedian}), ${s.filter.modes.map((m) => m.value).join('/')}, ` +
    `resonance ${s.filter.resonance.map((r) => r.value).join('/')}`);
  else o.push('filter: unused');
  if (s.volumeChanges > s.seconds * 25) o.push(`volume register changes ${s.volumeChanges} times: likely samples (digi) through $D418`);
  return o.join('\n');
}

function printNotes(notes, from, count) {
  const o = ['tick  len gate note  ADSR  waves (first ticks)        what'];
  for (const n of notes.filter((x) => x.tick >= from).slice(0, count)) {
    const what = [n.legato && 'legato', n.drum && `drum ${n.drumPitches.map((x) => (Number.isFinite(x) ? noteName(x) : '---')).join(' ')}`, n.arp && `arp ${n.arp.intervals.join('-')}/${n.arp.step}`,
      n.vibrato && `vib ±${n.vibrato.depth}c/${n.vibrato.period}`, n.flick && `flick ${n.flick.join(' ')}`, n.trill && `trill ${n.trill.intervals.join('-')}/${n.trill.period}`, n.slide && `slide ${n.slide.semitones}`,
      n.pulse && `pw ${hex(n.pulse.start, 3)}${n.pulse.step ? ` ±${n.pulse.step}` : ''}`,
      n.noiseAttack && `noise attack ${n.drumPitches.map((x) => (Number.isFinite(x) ? noteName(x) : '---')).join(' ')}`, n.hr && restartKey(n)].filter(Boolean).join(', ');
    o.push(`${String(n.tick).padStart(5)} ${String(n.len).padStart(4)} ${String(n.gate).padStart(4)} ` +
      `${Number.isFinite(n.base) ? noteName(n.base) : '---'}  ${hex(n.ad)}${hex(n.sr)}  ${n.waves.map((x) => hex(x)).join(' ').padEnd(26)} ${what}`);
  }
  return o.join('\n');
}

// ---- CLI

function findSids(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? findSids(p) : /\.sid$/i.test(e.name) ? [p] : [];
  }).sort();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: {
    song: { type: 'string' }, seconds: { type: 'string' }, notes: { type: 'string' }, from: { type: 'string' },
    count: { type: 'string' }, json: { type: 'string' }, corpus: { type: 'string' }, out: { type: 'string' },
    songlengths: { type: 'string' },
  } });
  const w = await loadCrsid();
  const lengthsFile = values.songlengths ?? (values.corpus && path.join(values.corpus, 'Songlengths.md5'));
  const lengths = lengthsFile && fs.existsSync(lengthsFile) ? parseSonglengths(fs.readFileSync(lengthsFile, 'utf8')) : null;
  const cap = Number(values.seconds ?? 120);
  const secondsFor = (bytes, song, header) => {
    const known = lengths?.get(md5(bytes))?.[(song ?? header?.startSong ?? 1) - 1];
    return Math.max(5, Math.min(cap, known ?? cap));
  };
  if (values.corpus) {
    const rows = [];
    for (const file of findSids(values.corpus)) {
      const bytes = new Uint8Array(fs.readFileSync(file));
      try {
        const t = traceSid(w, bytes, { seconds: secondsFor(bytes, null, null) });
        rows.push({ file: path.relative(values.corpus, file), ...studyTrace(t) });
        process.stderr.write('.');
      } catch (e) {
        rows.push({ file: path.relative(values.corpus, file), error: e.message });
        process.stderr.write('x');
      }
    }
    process.stderr.write('\n');
    const out = values.out ?? 'build/analysis/sid-corpus.json';
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(rows, null, 1));
    console.log(`${rows.length} tunes -> ${out} (${rows.filter((r) => r.error).length} errors)`);
  } else {
    const file = positionals[0];
    if (!file) { console.error('Usage: node tools/sid-study.js <file.sid> [--song N] [--seconds S] [--notes V] [--json out]'); process.exit(1); }
    const bytes = new Uint8Array(fs.readFileSync(file));
    const song = values.song ? Number(values.song) : undefined;
    const t = traceSid(w, bytes, { song, seconds: values.seconds ? Number(values.seconds) : secondsFor(bytes, song, null) });
    const s = studyTrace(t, { keepNotes: values.notes !== undefined || Boolean(values.json) });
    if (values.json) {
      fs.mkdirSync(path.dirname(values.json), { recursive: true });
      fs.writeFileSync(values.json, JSON.stringify(s, null, 1));
    }
    if (values.notes !== undefined) console.log(printNotes(s.notes[Number(values.notes)], Number(values.from ?? 0), Number(values.count ?? 64)));
    else console.log(printSummary(s));
  }
}

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
