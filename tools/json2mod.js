#!/usr/bin/env node
/**
 * json2mod — export a song JSON to a 4-channel ProTracker module (M.K.).
 *
 * Usage: node tools/json2mod.js songs/<song>.json [build/<song>.mod]
 *
 * The song must already be arranged for 4 channels (at most 31 samples).
 * Samples are synthesized exactly as json2it does, then resampled to signed
 * 8-bit for Paula periods (tools/mod-samples.js); patterns and effects are
 * converted by tools/mod-patterns.js. IT patterns longer than 64 rows are
 * split and jump/break targets renumbered. A single-cycle loop playing a wide
 * range gets ranged copies, each tuned for its notes (tools/mod-copies.js).
 * The report lists every sample's mapping and everything that could not be
 * carried over; tools/mod-check.js judges the result as ptplayer plays it.
 */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { resolveSample, ROOT } from './resolve-sample.js';
import { assertSong } from './validate-song.js';
import { planSample, renderSample, forwardLoops, singleCycle, PERIODS, PAL_CLOCK, TOP_NOTE, LOOP_TOL, LOOP_MAX } from './mod-samples.js';
import { noteUsage, convertPattern, splitPattern, playbackPath, mergeStates } from './mod-patterns.js';
import { splitLoops, worstImage, LIMIT_DB, SPAN, KEPT, TOL_CENTS, MAX_TOL } from './mod-copies.js';

const text = (s, n) => Buffer.from(String(s ?? '').replace(/[^\x20-\x7e]/g, '?').slice(0, n), 'latin1');
const NOTE = (n) => ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'][n % 12] + Math.floor(n / 12);

/** Convert a validated song (samples still as JSON definitions). */
export function songToMod(json) {
  assertSong(json);
  const warnings = new Map();
  const warn = (m) => warnings.set(m, (warnings.get(m) || 0) + 1);
  const resolved = { ...json, samples: json.samples.map((d) => forwardLoops(resolveSample(d), warn)) };
  const width = Math.max(...resolved.patterns.map((p) => p.channels.length));
  if (width > 4) throw new Error(`song has ${width} channels; arrange it for 4 first`);
  if (resolved.samples.length > 31) throw new Error(`song has ${resolved.samples.length} samples; MOD holds 31`);
  const ticks = resolved.ticks || 6, bpm = resolved.bpm || 120;          // itwriter's defaults
  if (ticks > 31) throw new Error(`initial speed ${ticks}: MOD speeds stop at 31 (higher Fxx values set the tempo)`);

  // A whole-sample loop stops at the first length within `modLoopTol` of its
  // rate (a share of it: 0.0003 is half a cent) or at `modLoopMax` bytes: a
  // song short of chip RAM takes shorter loops, which mod-check then judges.
  // A loop whose one period is longer than modLoopMax keeps that one period.
  const loopTol = json.modLoopTol ?? LOOP_TOL, loopMax = json.modLoopMax ?? LOOP_MAX;
  // (only shorter: mod-check judges a single waveform's tuning in loops of at most LOOP_MAX bytes)
  if (!(Number.isFinite(loopTol) && loopTol > 0 && loopTol < 0.01)) throw new Error(`modLoopTol ${loopTol}: a number between 0 and 0.01`);
  if (!(Number.isInteger(loopMax) && loopMax >= 64 && loopMax <= LOOP_MAX)) throw new Error(`modLoopMax ${loopMax}: an integer from 64 to ${LOOP_MAX}`);
  if (loopTol !== LOOP_TOL || loopMax !== LOOP_MAX) warn(`loops stop within ${loopTol} of their rate or at ${loopMax} bytes (one period, where that is longer)`);

  // Ranged copies (tools/mod-copies.js), within MOD's 31 samples: if the
  // copies don't fit, the spread allowed inside a copy grows to MAX_TOL, then
  // the sample with the most copies reaches two semitones further, until they
  // fit. Then, while a single-cycle loop's copy still images over LIMIT_DB, or
  // its harmonic cap takes more than 1% of the waveform's energy beyond what
  // its top note alone loses, its copies reach two semitones less, as long as
  // the song stays within 31 samples.
  const usage = noteUsage(resolved), spans = new Map();
  let tol = TOL_CENTS;
  const count = () => splitLoops(resolved, spans, tol, usage, loopTol);
  for (let n = count(); n.song.samples.length > 31; n = count()) {
    if (tol < MAX_TOL) { tol = Math.min(MAX_TOL, tol + 0.5); continue; }
    const most = n.splits.filter(({ sample }) => (spans.get(sample) ?? SPAN) < TOP_NOTE)
      .sort((a, b) => b.copies.length - a.copies.length)[0];
    if (!most) throw new Error(`ranged copies make ${n.song.samples.length} samples; MOD holds 31 (arrange fewer notes on the wide leads)`);
    spans.set(most.sample, Math.min(TOP_NOTE, (spans.get(most.sample) ?? SPAN) + 2));
  }
  if (tol > TOL_CENTS || spans.size)
    warn(`ranged copies kept within 31 samples: spread up to ${tol} cents` +
      `${[...spans].map(([i, sp]) => `, ${resolved.samples[i].name} reaching ${sp} semitones`).join('')}`);
  let song, splits, sel, use, samples;
  for (;;) {
    ({ song, splits, sel } = splitLoops(resolved, spans, tol, usage, loopTol));
    const origin = sel?.origin ?? song.samples.map((_, i) => i);
    use = noteUsage(song, sel);
    samples = song.samples.map((s, i) => {
      const used = use.lo[i] <= use.hi[i];
      // upward slides need headroom above the highest note (Paula's period floor)
      const top = used ? Math.max(use.hi[i], Math.min(use.slideHi[i], use.lo[i] + TOP_NOTE)) : 60;
      const plan = planSample(top > use.hi[i] ? { ...s, topNote: undefined } : s, used ? use.lo[i] : 60, top,
        used ? [...use.notes[i]] : null, use.vib[i]);
      const common = [...use.vols[i]].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0];
      plan.loopTol = loopTol;
      plan.loopMax = loopMax;
      plan.itVolume = s.volume ?? 64;
      plan.volume = common ? common[0] : plan.itVolume;
      const out = { name: s.name, used, lo: use.lo[i], hi: use.hi[i], top, plan, ...renderSample(s, plan) };
      if (singleCycle(s)) out.image = worstImage(out, [...use.notes[i]]);
      return out;
    });
    const bad = [...new Set(samples.flatMap((s, i) =>
      (s.image?.db > LIMIT_DB || s.plan.kept < KEPT * s.plan.keptTop) && s.used ? [origin[i]] : []))];
    const before = new Map(spans);
    for (const i of bad) if ((spans.get(i) ?? SPAN) > 0) spans.set(i, Math.max(0, (spans.get(i) ?? SPAN) - 2));
    // narrowing stops at the 31 samples: then it keeps the copies it has
    if (splitLoops(resolved, spans, tol, usage, loopTol).song.samples.length > 31) {
      spans.clear();
      before.forEach((v, k) => spans.set(k, v));
    }
    if (before.size === spans.size && [...spans].every(([k, v]) => before.get(k) === v)) {
      for (const i of bad) warn(`${resolved.samples[i].name}: images over ${LIMIT_DB} dB or harmonics cut, with as many copies as fit`);
      break;
    }
  }
  // notes that must share a copy (an arpeggio, a glide) and that ProTracker's
  // periods can't bring within the spread allowed
  samples.forEach((s, i) => singleCycle(song.samples[i]) && s.used && s.plan.spread > tol &&
    warn(`${s.name}: notes sharing one copy are ${s.plan.spread.toFixed(1)} cents apart on ProTracker's periods (over ${tol})`));

  const chunks = song.patterns.map((p) => Math.ceil(p.rows / 64));
  const orderMap = [];
  orderMap.push(song.order.reduce((at, p, i) => (orderMap[i] = at) + chunks[p], 0));
  // libopenmpt reads a MOD with neither a tempo nor an Exx command as
  // NoiseTracker, which ignores the Dxx row; an explicit tempo keeps a break
  // to a later row working there (ptplayer honours it either way)
  const breaksToRow = song.patterns.some((p) => p.channels.some((ch) =>
    Object.values(ch).some((e) => e?.fx?.[0] === 'C' && parseInt(e.fx.slice(1), 16) > 0)));
  const { path, loopTo } = playbackPath(song);

  // Convert the orders in the sequence they play, so each starts from the
  // state it is really reached with. The entry the song loops back to is
  // reached twice; a first pass finds the state it loops back with, and the
  // fields the two visits disagree on are unknown. Orders that never play
  // are converted last, quietly.
  const quiet = () => {};
  const run = (loopState, say) => {
    const ctx = {
      samples: samples.map((s) => s.plan), ticks, orderMap, orderLength: song.order.length, warn: say, at: 0, row0: null,
      copies: sel ? use.copies : null, give: sel ? use.give : null, sel,
      patternRows: (i) => song.patterns[song.order[i]].rows,
    };
    const state = [], parts = new Map();
    const convert = (i, entryRow) => {
      ctx.at = i;
      ctx.entryRow = entryRow;
      ctx.row0 = i === 0 ? { speed: ticks !== 6 ? ticks : null, tempo: bpm !== 125 || breaksToRow ? bpm : null } : null;
      return { rows: convertPattern(song.patterns[song.order[i]], state, ctx), played: [ctx.played] };
    };
    path.forEach(({ order: i, entryRow }, k) => {
      if (k === loopTo && loopState) {
        const merged = mergeStates([{ state: structuredClone(state), ticks: ctx.ticks }, loopState]);
        state.splice(0, state.length, ...merged.state);
        if (merged.ticks) ctx.ticks = merged.ticks;
      }
      if (!parts.has(i)) { parts.set(i, convert(i, entryRow)); return; }
      // Entered again at another row: this visit writes the rows it plays,
      // unless an earlier visit plays them too and needs them different.
      const first = parts.get(i), again = convert(i, entryRow), [a, b] = again.played[0];
      let clash = false;
      for (let r = a; r <= b; r++) {
        const shared = first.played.some(([x, y]) => r >= x && r <= y);
        if (!shared) first.rows[r] = again.rows[r];
        else clash ||= JSON.stringify(first.rows[r]) !== JSON.stringify(again.rows[r]);
      }
      first.played.push(again.played[0]);
      if (clash) ctx.warn(`order ${i} plays some rows twice with different channel state; the first visit's cells are kept`);
    });
    const exit = { state: structuredClone(state), ticks: ctx.ticks };
    ctx.warn = quiet;
    song.order.forEach((_, i) => { if (!parts.has(i)) parts.set(i, convert(i, 0)); });
    return { parts, exit };
  };
  const { parts } = run(run(null, quiet).exit, warn);

  const bodies = [], index = new Map(), order = [], converted = new Map();
  const add = (body) => {
    const key = Buffer.from(body).toString('hex');
    if (!index.has(key)) { index.set(key, bodies.length); bodies.push(body); }
    return index.get(key);
  };
  song.order.forEach((p, i) => {
    const ids = splitPattern(parts.get(i).rows).map(add);
    if (converted.has(p) && converted.get(p).join() !== ids.join())
      warn(`pattern ${p} converts differently when reached again; each visit keeps its own copy`);
    converted.set(p, ids);
    order.push(...ids);
  });
  if (order.length > 128) throw new Error(`order list has ${order.length} MOD patterns; MOD holds 128`);
  if (bodies.length > 64) throw new Error(`${bodies.length} MOD patterns; M.K. holds 64`);

  const head = Buffer.alloc(1084);
  text(song.title, 20).copy(head, 0);
  for (let i = 0; i < 31; i++) {
    const o = 20 + i * 30, s = samples[i];
    head.writeUInt16BE(1, o + 28);                       // no loop: repeat length 1 word
    if (!s) continue;
    text(s.name, 22).copy(head, o);
    head.writeUInt16BE(s.data.length / 2, o + 22);
    head[o + 25] = s.plan.volume;
    if (s.loopLength) { head.writeUInt16BE(s.loopStart / 2, o + 26); head.writeUInt16BE(s.loopLength / 2, o + 28); }
  }
  head[950] = order.length;
  head[951] = 127;
  order.forEach((p, i) => { head[952 + i] = p; });
  head.write('M.K.', 1080, 'latin1');
  const buffer = Buffer.concat([head, ...bodies.map((b) => Buffer.from(b)), ...samples.map((s) => Buffer.from(s.data.buffer))]);
  return { buffer, samples, order, patterns: bodies.length, warnings, splits };
}

export function report({ buffer, samples, order, patterns, warnings, splits = [] }) {
  const lines = [`${buffer.length} bytes: ${patterns} patterns, order length ${order.length}`];
  for (const { sample, copies } of splits)
    lines.push(`  sample ${sample + 1} in ${copies.length} ranged copies: ${copies.map((c) => `${c.index + 1} ${c.notes.map((n) => NOTE(n)).join(' ')}`).join(', ')}`);
  for (const [i, s] of samples.entries()) {
    const top = s.top - s.plan.off, rate = Math.round(PAL_CLOCK / PERIODS[Math.max(0, top)]);
    const slides = s.used && s.top > s.hi ? ` (slides to ${NOTE(top + 12)})` : '';
    lines.push(`  ${String(i + 1).padStart(2)} ${String(s.name).padEnd(14)} ${s.used ? `${NOTE(s.lo)}..${NOTE(s.hi)} -> MOD ${NOTE(s.lo - s.plan.off + 12)}..${NOTE(s.hi - s.plan.off + 12)}${slides}` : 'unused'.padEnd(28)}` +
      `  ${rate} Hz at top, ${s.data.length} bytes${s.loopLength ? `, loop ${s.loopLength}` : ''}, vol ${s.plan.volume}` +
      `${s.plan.cents ? `, tuning ${s.plan.cents.toFixed(2)} cents` : ''}${s.gain < 1 ? `, scaled ${(20 * Math.log10(s.gain)).toFixed(1)} dB` : ''}` +
      `${s.plan.clipped ? `, ${s.plan.clipped} peaks clipped` : ''}` +
      `${s.plan.shift ? `, retuned ${s.plan.shift >= 0 ? '+' : ''}${s.plan.shift.toFixed(1)} cents` : ''}` +
      `${s.plan.harmonics ? `, ${s.plan.harmonics} harmonics (${(100 * s.plan.kept).toFixed(1)}%)` : ''}` +
      `${s.image ? `, images ${s.image.db.toFixed(1)} dB at ${NOTE(s.image.note)}` : ''}`);
  }
  if (warnings.size) lines.push('not carried over / approximated:', ...[...warnings].map(([m, n]) => `  ${n} x ${m}`));
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [inFile, outArg] = process.argv.slice(2);
  if (!inFile) {
    console.error('Usage: node tools/json2mod.js <song.json> [out.mod]');
    process.exit(1);
  }
  const outFile = outArg || path.join(ROOT, 'build', path.basename(inFile, path.extname(inFile)) + '.mod');
  if (path.resolve(outFile) === path.resolve(inFile)) {
    console.error(`refusing to overwrite the input: ${inFile}`);
    process.exit(1);
  }
  try {
    const mod = songToMod(JSON.parse(fs.readFileSync(inFile, 'utf8')));
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, mod.buffer);
    console.log(`${outFile}\n${report(mod)}`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
