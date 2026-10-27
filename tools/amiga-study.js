#!/usr/bin/env node
/**
 * amiga-study — what an Amiga tune does, measured from its Paula trace (tools/paula-trace.js,
 * through UADE): notes and their lengths, samples (looped or one-shot), drums, arpeggios,
 * vibrato, slides, attack flicks, software volume envelopes, echo channels, channel roles
 * and the replay rate. The agent's tool for studying Amiga music in any format UADE plays
 * (ProTracker, TFMX, David Whittaker, Rob Hubbard, Art And Magic, Jochen Hippel, ...).
 *
 * Usage:
 *   node tools/amiga-study.js <file> [--subsong N] [--seconds S]     # summary
 *   node tools/amiga-study.js <file> --notes 0 [--from T] [--count N] # channel 0's notes
 *   node tools/amiga-study.js <file> --json out.json                  # full summary
 *   node tools/amiga-study.js --corpus <dir> --out build/analysis/amiga-corpus.json [--seconds S]
 *   node tools/amiga-study.js --summarize build/analysis/amiga-corpus.json    # per-composer medians
 *   node tools/amiga-study.js --check-mods <dir>   # MODs: traced onsets matched to the played note cells
 *
 * A "tick" is one call of the replay routine (50 Hz VBlank, or a CIA tempo). Pitches are
 * Paula periods named so that ProTracker's 428 is C-2: a sample sets its own root, so the
 * names give registers and intervals, not concert pitch. Measurements are register state,
 * not sound: nobody listens through this tool.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';
import { traceAmiga, periodToSemitone, semitoneName, PAULA_CLOCK } from './paula-trace.js';

const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : 0);
const round = (x, d = 1) => (x === null || x === undefined ? null : Math.round(x * 10 ** d) / 10 ** d);
function tally(map, k) { map.set(k, (map.get(k) || 0) + 1); }
const top = (map, n = 5) => [...map].sort((a, b) => b[1] - a[1]).slice(0, n).map(([value, count]) => ({ value, count }));
const WINDOW = 64; // ticks of a note that are analysed

/**
 * Split each channel's calls into notes. A note starts with
 *  (a) a DMA start the routine caused (a tracker note),
 *  (b) a re-pointed sample (new start address or length) more than 2 calls after the last
 *      onset: players that never stop the DMA start a new sound at the next reload, and
 *      ProTracker's own loop set-up comes right after its note start, or
 *  (c) on a channel that changes pitch far more often than it does (a) or (b), and does those
 *      under once per 250 calls (a synth-style player keeping one waveform running; a tracker
 *      that also starts the notes it glides to stays whole): a new pitch held for 2+ calls, a whole semitone
 *      or more from the last, or a volume re-attack (up by 8+ from a fading or silent level).
 *      Pitch changes decide it, so a tracker's held pad gated by volume stays one note.
 */
export function notesFromCalls(calls) {
  const notes = [];
  for (let c = 0; c < 4; c++) {
    const ch = calls.map((call) => call.ch[c]);
    const semi = ch.map((s) => periodToSemitone(s.per));
    // (c) candidates: stable pitch changes and volume re-attacks
    const pitchOn = new Set(), volOn = new Set();
    for (let i = 1; i < ch.length; i++) {
      if (ch[i].vol === 0 || semi[i] === null) continue;
      const prev = semi[i - 1], held = i + 1 < ch.length && semi[i + 1] !== null && Math.abs(semi[i + 1] - semi[i]) < 0.05;
      if (held && (prev === null || Math.abs(semi[i] - prev) >= 0.95) && !(i >= 2 && semi[i - 2] !== null && Math.abs(semi[i - 2] - semi[i]) < 0.05)) pitchOn.add(i);
      if (ch[i].vol - ch[i - 1].vol >= 8 && (ch[i - 1].vol === 0 || (i >= 2 && ch[i - 1].vol < ch[i - 2].vol) || ch[i - 1].vol <= ch[i].vol / 2)) volOn.add(i);
    }
    const onsets = new Set();
    let last = -Infinity, ab = 0;
    ch.forEach((s, i) => {
      const repointed = s.pointed && i > 0 && (s.lc !== ch[i - 1].lc || s.lenReg !== ch[i - 1].lenReg) && s.lenReg > 2;
      // a re-point the routine then starts with the DMA (within two calls) is that start's
      const startsSoon = [1, 2].some((k) => ch[i + k]?.start);
      if (s.start || (repointed && !startsSoon && i - last > 2)) { onsets.add(i); last = i; ab++; }
    });
    // synth-style: pitch changes far outnumber starts, and starts are rare (under one per 250
    // calls, 5 s at 50 Hz). A tracker channel that glides between notes it also starts stays
    // whole; one that starts once and plays a phrase by tone portamento is split like a synth.
    const synthStyle = ab < 0.25 * pitchOn.size && ab < Math.max(2, ch.length / 250);
    if (synthStyle) for (const i of [...pitchOn, ...volOn]) if (![i - 1, i, i + 1].some((k) => onsets.has(k))) onsets.add(i);
    let cur = null;
    const close = (end) => { if (cur) { cur.ticks = end - cur.start; notes.push(cur); } cur = null; };
    ch.forEach((s, i) => {
      if (onsets.has(i)) {
        close(i);
        cur = { ch: c, start: i, sample: `${(s.start ? s.addr : s.lc).toString(16)}:${s.start ? s.len : s.lenReg}`, len: s.start ? s.len : s.lenReg, oneShot: null, pers: [], vols: [], synthStyle, silent: 0,
          prevPer: i > 0 ? ch[i - 1].per : 0 };
      }
      if (!cur) return;
      if (cur.oneShot === null && s.loopLen !== null) cur.oneShot = s.loopLen <= 2;
      if (cur.pers.length < WINDOW) { cur.pers.push(s.per); cur.vols.push(s.vol); }
      // a note ends when it falls silent for good (four silent ticks), inside the window or not
      cur.silent = s.vol === 0 ? cur.silent + 1 : 0;
      if (cur.silent >= 4) close(i - 3);
    });
    close(calls.length);
  }
  for (const n of notes) {
    n.semis = n.pers.map(periodToSemitone);
    n.semi = n.semis.find((s) => s !== null) ?? null;
    n.peak = Math.max(...n.vols);
  }
  return notes.filter((n) => n.peak > 0).sort((a, b) => a.start - b.start || a.ch - b.ch);
}

/**
 * Pitch motion inside a note, found as stretches anywhere in it (a tracker effect often
 * starts rows after the note and lasts a row or two): arpeggio (whole semitones cycling
 * every 2-4 ticks, two cycles at least), vibrato (an oscillation of 5-150 cents with two
 * reversals), slide (a monotonic move of half a semitone or more over 3+ ticks) and an
 * attack flick (the first 1-3 ticks off the pitch the note settles on).
 */
export function pitchMotion(n) {
  const s = n.semis.map((x) => (x === null ? null : x));
  const out = { arp: null, vibrato: null, slide: null, flick: null };
  const ok = (i, len) => i + len <= s.length && s.slice(i, i + len).every((x) => x !== null);
  // arpeggio
  // A note exactly one cycle long (re-struck every row, as fast chip tunes do) counts too.
  const single = s.length >= 2 && s.length <= 4 && n.ticks === s.length;
  for (let i = 0; i < s.length && !out.arp; i++) for (let p = 2; p <= 4 && !out.arp; p++) {
    const len = single && i === 0 && p === s.length ? p : 2 * p;
    if (!ok(i, len)) continue;
    const seg = s.slice(i, i + len), rel = seg.map((x) => x - seg[0]), st = rel.map((x) => Math.round(x));
    if (!rel.every((x, k) => Math.abs(x - st[k]) < 0.15)) continue;
    const cyc = st.slice(0, p);
    if (new Set(cyc).size < 2 || !st.every((x, k) => x === cyc[k % p])) continue;
    if (p === 4 && cyc[0] === cyc[2] && cyc[1] === cyc[3]) continue; // a 2-cycle seen twice
    if (len === p && Math.max(...cyc) - Math.min(...cyc) > 24) continue; // one cycle: chord-sized only
    const lo = Math.min(...cyc);
    out.arp = { period: p, shape: [...new Set(cyc.map((x) => x - lo))].sort((a, b) => a - b).join('-'), fromTick: i };
  }
  const base = s.find((x) => x !== null);
  if (base === undefined) return out;
  const cents = s.map((x) => (x === null ? null : (x - base) * 100));
  // attack flick: first 1-3 ticks off a pitch the note then holds for 3+ ticks
  for (let k = 1; k <= 3 && !out.flick && !out.carry; k++) {
    const held = s.slice(k, k + 3);
    if (held.length === 3 && held.every((x) => x !== null && Math.abs(x - held[0]) < 0.05) && s.slice(0, k).some((x) => x !== null && Math.abs(x - held[0]) >= 0.5)) {
      out.flick = s.slice(0, k).map((x) => Math.round(x - held[0]));
      // A first tick on exactly the period the channel already had is a carry: a player that
      // sets the period a call after the start (Art & Magic's, some sections), or a slur. The
      // trace cannot tell which, so it is not counted as an attack flick.
      if (k === 1 && n.prevPer > 0 && n.pers[0] === n.prevPer) { out.carry = true; out.flick = null; }
    }
  }
  if (out.arp) return out;
  // vibrato: a stretch with 2+ reversals, 5-150 cents peak to peak, not whole-semitone steps
  for (let i = 0; i < cents.length - 5 && !out.vibrato; i++) {
    let j = i, rev = 0, dir = 0;
    const turns = [];
    while (j + 1 < cents.length && cents[j + 1] !== null && Math.abs(cents[j + 1] - cents[i]) <= 150) {
      const d = Math.sign(cents[j + 1] - cents[j]);
      if (d && dir && d !== dir) { rev++; turns.push(j); }
      if (d) dir = d;
      j++;
    }
    const seg = cents.slice(i, j + 1), span = Math.max(...seg) - Math.min(...seg);
    const stepped = seg.every((x) => Math.abs(x / 100 - Math.round(x / 100)) < 0.1);
    if (rev >= 2 && span >= 5 && !stepped) {
      const gaps = turns.slice(1).map((t, k) => t - turns[k]);
      const moves = seg.findIndex((x) => Math.abs(x - seg[0]) > 2);
      out.vibrato = { depthCents: Math.round(span / 2), periodTicks: gaps.length ? 2 * median(gaps) : null, delayTicks: i + Math.max(0, moves - 1) };
    }
  }
  // slide: monotonic, at least half a semitone, over 3+ ticks
  for (let i = 0; i < cents.length - 3 && !out.slide && !out.vibrato; i++) {
    if (cents[i] === null) continue;
    let j = i;
    const dir = Math.sign((cents[i + 1] ?? cents[i]) - cents[i]);
    if (!dir) continue;
    // a tracker slide pauses on each row's first tick: allow flat ticks (up to 2 in a row)
    let k = i, flat = 0;
    while (k + 1 < cents.length && cents[k + 1] !== null) {
      const d = Math.sign(cents[k + 1] - cents[k]);
      if (d === dir) { flat = 0; j = k + 1; } else if (d === 0 && ++flat <= 2) { /* plateau */ } else break;
      k++;
    }
    const move = cents[j] - cents[i];
    if (j - i >= 3 && Math.abs(move) >= 50) out.slide = { cents: Math.round(move), ticks: j - i, centsPerTick: Math.round(move / (j - i)), fromTick: i };
  }
  return out;
}

/** Volume shape inside a note (0-64): flat, decay, swell, tremolo; attack and decay rates. */
export function volumeShape(n) {
  const v = n.vols.slice(0, Math.max(1, Math.min(n.vols.length, n.ticks)));
  const peakAt = v.indexOf(Math.max(...v));
  const changes = v.slice(1).filter((x, i) => x !== v[i]).length;
  let kind = 'flat';
  if (changes) {
    const down = v.slice(1).filter((x, i) => x < v[i]).length, up = v.slice(1).filter((x, i) => x > v[i]).length;
    kind = up && down && Math.min(up, down) >= 2 ? 'tremolo' : up > down ? 'swell' : 'decay';
  }
  const after = v.slice(peakAt);
  const fall = after.length > 1 ? (after[0] - after.at(-1)) / (after.length - 1) : 0;
  return { kind, start: v[0], peak: v[peakAt], attackTicks: peakAt, decayPerTick: round(fall, 2), changesPerTick: round(changes / Math.max(1, v.length - 1), 2) };
}

/** Which samples are drums: one-shots played at one fixed period at least 80% of the time. */
function drumSamples(notes) {
  const bySample = new Map();
  for (const n of notes) {
    const e = bySample.get(n.sample) ?? { notes: 0, oneShot: 0, pers: new Map(), ticks: [] };
    e.notes++; if (n.oneShot) e.oneShot++; tally(e.pers, n.pers[0]); e.ticks.push(n.ticks);
    bySample.set(n.sample, e);
  }
  const drums = new Set();
  for (const [k, e] of bySample) {
    const fixed = Math.max(...e.pers.values()) / e.notes;
    // a one-shot at one pitch, or (players that loop every sample, as TFMX) a sound at one
    // pitch that is always cut within 4 ticks: a drum hit between the notes of a line
    if (e.notes >= 3 && fixed >= 0.8 && (e.oneShot / e.notes >= 0.8 || (e.notes >= 8 && median(e.ticks) <= 4))) drums.add(k);
  }
  return { bySample, drums };
}

/** Echo: channel B repeats channel A's notes `d` ticks later, more quietly. */
function echoes(notes) {
  const byCh = [0, 1, 2, 3].map((c) => notes.filter((n) => n.ch === c && !n.drum));
  const found = [];
  for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
    if (a === b || byCh[a].length < 8) continue;
    const delays = new Map();
    const bIndex = new Map(byCh[b].map((n) => [`${n.start}|${Math.round(n.semi)}`, n]));
    for (const n of byCh[a]) for (let d = 1; d <= 24; d++) {
      const m = bIndex.get(`${n.start + d}|${Math.round(n.semi)}`);
      if (m && m.peak <= n.peak) tally(delays, d);
    }
    const [best] = top(delays, 1);
    if (best && best.count >= Math.max(6, 0.4 * byCh[a].length)) found.push({ from: a, to: b, delayTicks: best.value, share: pct(best.count, byCh[a].length) });
  }
  return found;
}

export function studyTrace(trace) {
  let notes = notesFromCalls(trace.calls);
  // A channel carrying a software mix of several voices (TFMX's 7-voice mode) plays one or two
  // looped buffers (by address: a mixer refills them to different lengths) at one fixed period,
  // restarted or re-pointed like clockwork: either each buffer plays through once before the
  // next (its length in time is the note's), or they restart at one unchanging interval of a
  // few ticks. A drum channel also repeats few sounds at one pitch, but its hits are one-shots
  // or come in a rhythm; a melodic channel uses more than two samples or moves its pitch.
  const mixers = [0, 1, 2, 3].filter((c) => {
    const ns = notes.filter((n) => n.ch === c), pers = new Map(), gaps = new Map();
    if (ns.length < 50 || ns.filter((n) => n.oneShot === false).length < 0.9 * ns.length) return false;
    for (const n of ns) tally(pers, n.pers[0]);
    if (Math.max(...pers.values()) / ns.length < 0.95) return false;
    if (new Set(ns.map((n) => n.sample.split(':')[0])).size > 2) return false;
    const playsThrough = ns.filter((n) => n.pers[0] > 0 && Math.abs(n.ticks - (n.len * 2 * n.pers[0] * (trace.callHz || 50)) / PAULA_CLOCK) <= 1.5);
    ns.slice(1).forEach((n, i) => tally(gaps, n.start - ns[i].start));
    // a mixer's interrupt need not divide the call rate: its restarts come 3, 4, 3, 4... calls apart
    const [a, b = { value: a.value, count: 0 }] = top(gaps, 2);
    const steady = Math.abs(a.value - b.value) <= 1 && Math.max(a.value, b.value) <= 6 && a.count + b.count >= 0.9 * (ns.length - 1);
    return playsThrough.length >= 0.8 * ns.length || steady;
  });
  notes = notes.filter((n) => !mixers.includes(n.ch));
  const { bySample, drums } = drumSamples(notes);
  for (const n of notes) {
    n.drum = drums.has(n.sample);
    n.motion = n.drum ? {} : pitchMotion(n);
    n.vol = volumeShape(n);
  }
  const pitched = notes.filter((n) => !n.drum);
  // tempo: the commonest gap between onsets anywhere, and ticks per row as their GCD-like base
  const onsets = [...new Set(notes.map((n) => n.start))].sort((a, b) => a - b);
  const gaps = new Map();
  onsets.slice(1).forEach((t, i) => tally(gaps, t - onsets[i]));
  const commonGaps = top(gaps, 4).map((g) => g.value);
  const row = commonGaps.length ? Math.min(...commonGaps.filter((g) => g >= 2).concat(commonGaps[0])) : null;
  const channels = [0, 1, 2, 3].map((c) => {
    const ns = notes.filter((n) => n.ch === c), ps = ns.filter((n) => !n.drum);
    return { ch: c, notes: ns.length, drumShare: pct(ns.length - ps.length, ns.length), medianPitch: semitoneName(median(ps.map((n) => n.semi))), medianSemi: median(ps.map((n) => n.semi)), samples: new Set(ns.map((n) => n.sample)).size };
  });
  const melodic = channels.filter((c) => c.notes && c.drumShare < 60 && c.medianSemi !== null).sort((a, b) => a.medianSemi - b.medianSemi);
  for (const c of channels) c.role = mixers.includes(c.ch) ? 'mixer' : !c.notes ? 'silent' : c.drumShare >= 60 ? 'drums' : c === melodic[0] && melodic.length > 1 ? 'bass' : c === melodic.at(-1) ? 'lead' : c.drumShare >= 20 ? 'mixed' : 'support';
  const arps = new Map(), arpPeriods = new Map(), flicks = new Map(), volKinds = new Map();
  for (const n of pitched) {
    if (n.motion.arp) { tally(arps, n.motion.arp.shape); tally(arpPeriods, n.motion.arp.period); }
    if (n.motion.flick) tally(flicks, n.motion.flick.join(','));
  }
  for (const n of notes) tally(volKinds, n.vol.kind);
  const vib = pitched.filter((n) => n.motion.vibrato).map((n) => n.motion.vibrato);
  const slides = pitched.filter((n) => n.motion.slide).map((n) => n.motion.slide);
  const samples = [...bySample.entries()];
  // the trace's own length when known (the calls stop at the last register write)
  const seconds = trace.seconds ?? trace.calls.length / (trace.callHz || 50);
  return {
    file: trace.file, seconds: round(seconds), callHz: round(trace.callHz, 2),
    ticksPerRow: row, rowGaps: commonGaps,
    bpmIfFourRowsPerBeat: row && trace.callHz ? round((trace.callHz * 60) / (row * 4), 0) : null,
    mixerChannels: mixers,
    notes: notes.length, notesPerSecond: round(notes.length / Math.max(1, seconds)),
    samples: { distinct: samples.length, looped: samples.filter(([, e]) => e.oneShot < e.notes / 2).length, drums: drums.size },
    channels,
    drumsOnOwnChannel: channels.some((c) => c.role === 'drums'),
    drumsSharedWith: channels.filter((c) => c.drumShare >= 10 && c.drumShare < 60).map((c) => c.ch),
    pitched: {
      notes: pitched.length,
      arpShare: pct(pitched.filter((n) => n.motion.arp).length, pitched.length), arpShapes: top(arps, Infinity), arpPeriodTicks: top(arpPeriods, Infinity),
      vibratoShare: pct(vib.length, pitched.length),
      vibrato: vib.length ? { depthCents: median(vib.map((v) => v.depthCents)), periodTicks: median(vib.map((v) => v.periodTicks).filter(Boolean)), delayTicks: median(vib.map((v) => v.delayTicks)) } : null,
      slideShare: pct(slides.length, pitched.length),
      slide: slides.length ? { cents: median(slides.map((s) => Math.abs(s.cents))), centsPerTick: median(slides.map((s) => Math.abs(s.centsPerTick))), upShare: pct(slides.filter((s) => s.cents > 0).length, slides.length) } : null,
      flickShare: pct(pitched.filter((n) => n.motion.flick).length, pitched.length), flicks: top(flicks, Infinity),
      carryShare: pct(pitched.filter((n) => n.motion.carry).length, pitched.length),
      range: pitched.length ? `${semitoneName(Math.min(...pitched.map((n) => n.semi)))}..${semitoneName(Math.max(...pitched.map((n) => n.semi)))}` : null,
    },
    volume: {
      kinds: Object.fromEntries([...volKinds].map(([k, v]) => [k, pct(v, notes.length)])),
      softwareEnvelopeShare: pct(notes.filter((n) => n.vol.changesPerTick >= 0.25).length, notes.length),
      attackTicks: median(notes.map((n) => n.vol.attackTicks)),
      decayPerTick: median(notes.filter((n) => n.vol.kind === 'decay').map((n) => n.vol.decayPerTick)),
      peak: median(notes.map((n) => n.vol.peak)),
    },
    noteTicks: median(pitched.map((n) => n.ticks)),
    echoes: echoes(notes),
    _notes: notes,
  };
}

export async function studyFile(file, opts = {}) {
  const r = studyTrace(await traceAmiga(file, opts));
  // a 15-sample Soundtracker file has no ID to recognise it by: trust the name
  const patterns = modPatterns(fs.readFileSync(file), { untagged: /\.mod$|(^|\/)mod\.[^/]*$/i.test(file) });
  if (patterns) r.patterns = patterns;
  return r;
}

const MOD_IDS = new Set(['M.K.', 'M!K!', 'M&K!', 'FLT4', '4CHN', 'N.T.']);

/**
 * What a 4-channel MOD's own patterns write, in play order (from position 0, following Bxx
 * jumps and Dxx breaks to their rows, each position once): the exact effect counts a Paula
 * trace can only infer. Effects are per 100 note cells, in ProTracker's meanings; `vibrato`
 * lists 4xy as `x/y` (x: 64/x ticks a cycle; y: about 8·y cents either way around C-2, 16·y an
 * octave up), `arp` lists 0xy as chord shapes, `speeds` the Fxx < 32 used and `tempos` the
 * Fxx >= 32 (CIA BPM). A 15-sample file that uses no command but 1 and 2 is Ultimate
 * Soundtracker's (`dialect: 'ust'`), where 1xy is the arpeggio and 2xy a pitch bend: those count
 * as arpeggio (0) and portamento (1). E6x loops and EEx delays are not followed. Returns null
 * for anything but a 15- or 31-sample MOD.
 */
export function modPatterns(buf, { untagged = true } = {}) {
  const id = buf.length >= 1084 ? buf.toString('latin1', 1080, 1084) : '';
  const big = MOD_IDS.has(id);
  if (!big && !untagged) return null;
  const [lenAt, orderAt, patAt] = big ? [950, 952, 1084] : [470, 472, 600];
  if (buf.length < patAt + 1024) return null;
  const len = buf[lenAt], order = [...buf.subarray(orderAt, orderAt + 128)];
  if (!len || len > 128) return null;
  const maxPat = Math.max(...order) + 1;
  // a 15-sample file has no ID: trust it only if its patterns fit the file's length
  if (!big && (id.match(/^[\x20-\x7e]{4}$/) && /[A-Z!.&]{4}/.test(id) || patAt + maxPat * 1024 > buf.length)) return null;
  const cell = (o, r, c) => {
    const at = patAt + o * 1024 + r * 16 + c * 4;
    return at + 4 > buf.length ? null : { period: ((buf[at] & 15) << 8) | buf[at + 1], smp: (buf[at] & 0xf0) | (buf[at + 2] >> 4), cmd: buf[at + 2] & 15, arg: buf[at + 3] };
  };
  // Ultimate Soundtracker: commands 1 and 2 only, and no 0xy arpeggio
  let ust = !big;
  for (const o of new Set(order.slice(0, len))) for (let r = 0; r < 64 && ust; r++) for (let c = 0; c < 4; c++) {
    const x = cell(o, r, c);
    if (x && (x.cmd > 2 || (x.cmd === 0 && x.arg))) { ust = false; break; }
  }
  const fx = new Map(), vib = new Map(), arp = new Map(), speeds = new Map(), tempos = new Map(), samples = new Set();
  let notes = 0, cells = 0, pos = 0, row = 0;
  const visited = new Set();
  while (pos < len && !visited.has(pos)) {
    visited.add(pos);
    const o = order[pos];
    let next = pos + 1, nextRow = 0;
    for (let r = row; r < 64; r++) {
      let leave = false;
      for (let c = 0; c < 4; c++) {
        const x = cell(o, r, c);
        if (!x) continue;
        cells++;
        let { cmd, arg } = x;
        if (x.period) notes++;
        if (x.smp) samples.add(x.smp);
        if (ust) cmd = cmd === 1 ? 0 : cmd === 2 ? 1 : cmd;
        if (cmd === 0 && !arg) continue;
        const key = cmd === 0xe ? `E${(arg >> 4).toString(16).toUpperCase()}` : cmd === 0xf ? (arg < 32 ? 'Fspeed' : 'Ftempo') : cmd.toString(16).toUpperCase();
        tally(fx, key);
        if (cmd === 0) tally(arp, `0-${arg >> 4}-${arg & 15}`.replace(/-0$/, ''));
        if (cmd === 4 && arg) tally(vib, `${arg >> 4}/${arg & 15}`);
        if (cmd === 0xf && arg) tally(arg < 32 ? speeds : tempos, arg);
        if (cmd === 0xb) { next = arg; leave = true; }
        if (cmd === 0xd) { nextRow = (arg >> 4) * 10 + (arg & 15); leave = true; } // BCD row
      }
      if (leave) break;
    }
    pos = next;
    row = nextRow < 64 ? nextRow : 0;
  }
  const per100 = (k) => round((100 * (fx.get(k) || 0)) / Math.max(1, notes));
  return {
    dialect: ust ? 'ust' : 'protracker', notes, cells, samplesUsed: samples.size,
    per100Notes: Object.fromEntries([...fx.keys()].sort().map((k) => [k, per100(k)])),
    arp: top(arp, Infinity), vibrato: top(vib, Infinity), speeds: top(speeds, Infinity), tempos: top(tempos, Infinity),
  };
}

function printSummary(r) {
  const p = r.pitched;
  console.log(`${r.file}: ${r.seconds}s, replay ${r.callHz} Hz, rows every ${r.ticksPerRow} ticks (gaps ${r.rowGaps.join(', ')}), ~${r.bpmIfFourRowsPerBeat} BPM at 4 rows a beat`);
  console.log(`  ${r.notes} notes (${r.notesPerSecond}/s); samples ${r.samples.distinct} (${r.samples.looped} looped, ${r.samples.drums} drums)`);
  for (const c of r.channels) console.log(`  ch${c.ch}: ${c.role.padEnd(7)} ${String(c.notes).padStart(4)} notes, drums ${c.drumShare}%, median ${c.medianPitch}, ${c.samples} samples`);
  console.log(`  pitched ${p.notes}, range ${p.range}: arp ${p.arpShare}% ${p.arpShapes.slice(0, 5).map((a) => `${a.value}(${a.count})`).join(' ')} at ${p.arpPeriodTicks.slice(0, 3).map((a) => a.value).join('/')} ticks a cycle`);
  console.log(`  vibrato ${p.vibratoShare}% ${p.vibrato ? `±${p.vibrato.depthCents} cents, ${p.vibrato.periodTicks} ticks, from tick ${p.vibrato.delayTicks}` : ''}; slides ${p.slideShare}% ${p.slide ? `${p.slide.cents} cents at ${p.slide.centsPerTick}/tick, ${p.slide.upShare}% up` : ''}; flicks ${p.flickShare}% ${p.flicks.slice(0, 4).map((f) => `[${f.value}]`).join(' ')}`);
  console.log(`  volume: ${Object.entries(r.volume.kinds).map(([k, v]) => `${k} ${v}%`).join(', ')}; software envelopes on ${r.volume.softwareEnvelopeShare}% of notes; attack ${r.volume.attackTicks} ticks, decay ${r.volume.decayPerTick}/tick, peak ${r.volume.peak}`);
  if (r.patterns) {
    const q = r.patterns, list = (a) => a.slice(0, 5).map((x) => `${x.value}(${x.count})`).join(' ');
    console.log(`  patterns: ${q.notes} note cells, ${q.samplesUsed} samples; per 100 notes ${Object.entries(q.per100Notes).map(([k, v]) => `${k} ${v}`).join(', ')}`);
    console.log(`    arp ${list(q.arp) || '-'}; vibrato 4xy ${list(q.vibrato) || '-'}; speeds ${list(q.speeds) || '-'}; tempos ${list(q.tempos) || '-'}`);
  }
  console.log(`  pitched notes last ${r.noteTicks} ticks (median)${r.echoes.length ? `; echoes: ${r.echoes.map((e) => `ch${e.from}->ch${e.to} +${e.delayTicks} (${e.share}%)`).join(', ')}` : ''}`);
}

function printNotes(r, ch, from, count) {
  for (const n of r._notes.filter((x) => x.ch === ch && x.start >= from).slice(0, count)) {
    const m = n.motion ?? {};
    const motion = m.arp ? `arp ${m.arp.shape}/${m.arp.period}` : m.vibrato ? `vib ±${m.vibrato.depthCents}c/${m.vibrato.periodTicks}t@${m.vibrato.delayTicks}` : m.slide ? `slide ${m.slide.cents}c/${m.slide.ticks}t` : m.flick ? `flick [${m.flick}]` : '';
    console.log(`${String(n.start).padStart(6)} ${semitoneName(n.semi)} ${String(n.ticks).padStart(3)}t ${n.drum ? 'DRUM' : '    '} ${n.oneShot ? '1shot' : 'loop '} s${n.sample} vol ${n.vol.kind}:${n.vols.slice(0, 8).join(',')} ${motion}`);
  }
}

// Companion files hold samples for another file: UADE loads them itself.
const COMPANION = /^(smpl\.|smp\.)|\.ins$|\.smp$/i;

async function corpus(dir, { out, seconds }) {
  const files = [];
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (!COMPANION.test(e.name) && e.name !== 'wanted.txt') files.push(p); } })(dir);
  const results = [];
  for (const f of files.sort()) {
    const rel = path.relative(dir, f).split(path.sep);
    try {
      let r = await studyFile(f, { seconds }).catch((e) => ({ error: e }));
      // Some files' default subsong crashes in UADE or is a short jingle: try the next ones.
      for (let sub = 0; sub <= 3 && (r.error || r.seconds < 10 || r.notes < 20); sub++) {
        const alt = await studyFile(f, { seconds, subsong: sub }).catch((e) => ({ error: e }));
        if (!alt.error && (r.error || alt.seconds * alt.notes > r.seconds * r.notes)) r = { ...alt, subsong: sub };
      }
      if (r.error) throw r.error;
      delete r._notes;
      results.push({ format: rel[0], composer: rel[1], ...r });
      process.stderr.write(`ok   ${rel.join('/')}\n`);
    } catch (e) { process.stderr.write(`FAIL ${rel.join('/')}: ${e.message}\n`); results.push({ format: rel[0], composer: rel[1], file: f, error: e.message }); }
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(results, null, 1));
  console.log(`${out}: ${results.filter((r) => !r.error).length} tunes, ${results.filter((r) => r.error).length} failed`);
}

/**
 * Accuracy check for MODs, where the truth is known: the rows libopenmpt plays in the first
 * `seconds`, and the time each starts; their note cells per channel (not those with tone
 * portamento, which start nothing) against the onsets the trace finds, matched in time
 * (within 30 ms of the running offset between the two, which starts from the first notes, or
 * the best pairing of a channel's first six, and follows each match, as the players' clocks
 * drift slowly apart). Returns per channel the truth, the found
 * notes and the matched ones. A row repeated in place by E6x or EEx is counted once.
 */
export async function checkMod(file, { seconds = 60, tolerance = 0.03 } = {}) {
  const { default: factory } = await import('../player/vendor/chiptune3/libopenmpt.worklet.js');
  const lib = (checkMod.lib ??= await factory());
  const buf = fs.readFileSync(file), p = lib._malloc(buf.length);
  lib.HEAPU8.set(buf, p);
  const mod = lib._openmpt_module_create_from_memory2(p, buf.length, 0, 0, 0, 0, 0, 0, 0);
  lib._free(p);
  if (!mod) throw new Error(`libopenmpt could not load ${file}`);
  lib._openmpt_module_set_repeat_count(mod, 0);
  const L = lib._malloc(4 * 128), R = lib._malloc(4 * 128), rows = [];
  let key = '';
  for (let t = 0; t < seconds * 48000;) {
    // the order position too: a pattern played at two positions in a row is two visits
    const k = `${lib._openmpt_module_get_current_order(mod)}:${lib._openmpt_module_get_current_pattern(mod)}:${lib._openmpt_module_get_current_row(mod)}`;
    if (k !== key) { const [, pat, row] = k.split(':').map(Number); rows.push({ pat, row, time: t / 48000 }); key = k; }
    const n = lib._openmpt_module_read_float_stereo(mod, 48000, 120, L, R);
    if (!n) break;
    t += n;
  }
  lib._openmpt_module_destroy(mod); lib._free(L); lib._free(R);
  const patAt = MOD_IDS.has(buf.toString('latin1', 1080, 1084)) ? 1084 : 600, want = [[], [], [], []];
  for (const { pat, row, time } of rows) for (let c = 0; c < 4; c++) {
    const at = patAt + pat * 1024 + row * 16 + c * 4;
    // a note cell with tone portamento (3xx, 5xy) slides there without starting the sample
    if (at + 3 <= buf.length && (((buf[at] & 15) << 8) | buf[at + 1]) > 0 && ![3, 5].includes(buf[at + 2] & 15)) want[c].push(time);
  }
  const trace = await traceAmiga(file, { seconds });
  const r = studyTrace(trace), t0 = trace.calls[0]?.t ?? 0;
  const got = [0, 1, 2, 3].map((c) => r._notes.filter((n) => n.ch === c).map((n) => (trace.calls[n.start].t - t0) / PAULA_CLOCK));
  // UADE's and libopenmpt's clocks drift apart slowly (CIA tempos round differently): the
  // offset starts from the first notes and follows each match
  // offset starts from the first notes (or, if that lines up badly, the best pairing of a
  // channel's first few notes) and follows each match
  const match = (a, b, start) => {
    let i = 0, j = 0, m = 0, shift = start;
    while (i < a.length && j < b.length) {
      const d = a[i] - (b[j] + shift);
      if (Math.abs(d) <= tolerance) { m++; shift += d; i++; j++; } else if (d < 0) i++; else j++;
    }
    return m;
  };
  const first = Math.min(...want.flat()) - Math.min(...got.flat());
  const matched = [0, 1, 2, 3].map((c) => {
    const a = want[c], b = [...got[c]].sort((x, y) => x - y);
    const starts = [first, ...a.slice(0, 6).flatMap((x) => b.slice(0, 6).map((y) => x - y))];
    return Math.max(...starts.map((st) => match(a, b, st)));
  });
  return { file, truth: want.map((x) => x.length), found: got.map((x) => x.length), matched };
}

// Pattern effects over a composer's MODs: median uses per 100 notes, pooled parameters.
function modColumns(ps) {
  if (!ps.length) return {};
  // per 100 notes over all the composer's MODs, and how many MODs use it 2 times per 100 notes or more
  const notes = ps.reduce((t, p) => t + p.notes, 0);
  const m = (k) => round(ps.reduce((t, p) => t + ((p.per100Notes[k] || 0) * p.notes) / 100, 0) * 100 / Math.max(1, notes));
  const using = (...ks) => `${ps.filter((p) => ks.reduce((t, k) => t + (p.per100Notes[k] || 0), 0) >= 2).length}/${ps.length}`;
  const pool = (f) => { const t = new Map(); for (const p of ps) for (const x of p[f]) t.set(x.value, (t.get(x.value) || 0) + x.count); return top(t, 4).map((x) => x.value).join(' '); };
  return {
    mods: ps.length, modArpTunes: using('0'), modVibTunes: using('4', '6'), modSlideTunes: using('1', '2', '3', '5'), modVolSlideTunes: using('A', '5', '6'),
    modArp: m('0'), modPorta: round(m('1') + m('2')), modTonePorta: round(m('3') + m('5')), modVib: round(m('4') + m('6')),
    modVolSlide: round(m('A') + m('5') + m('6')), modSetVol: m('C'), modRetrig: m('E9'), modCut: m('EC'), modDelay: m('ED'), modFine: round(m('E1') + m('E2') + m('EA') + m('EB')),
    modArps: pool('arp'), modVibs: pool('vibrato'), modSpeeds: pool('speeds'), modTempos: pool('tempos'), modSamples: median(ps.map((p) => p.samplesUsed)),
  };
}

/** Per-composer medians over a corpus JSON (from --corpus): the numbers style sheets quote. */
export function summarize(results) {
  // a trace that ended within 10 s or found under 20 notes is a jingle or a player the
  // note rules miss: it would skew a composer's medians
  const ok = results.filter((r) => !r.error && r.seconds >= 10 && r.notes >= 20);
  const by = new Map();
  // Modland files unattributed conversions under `<format>/_unknown` (Hubbard's Skate or Die, Sanxion)
  for (const r of ok) { const k = r.composer.startsWith('_') ? r.format : r.composer; if (!by.has(k)) by.set(k, []); by.get(k).push(r); }
  const rows = [];
  for (const [composer, rs] of [...by].sort((a, b) => b[1].length - a[1].length)) {
    const m = (f) => median(rs.map(f).filter((x) => x !== null && x !== undefined && !Number.isNaN(x)));
    const shapes = new Map(), flicks = new Map();
    for (const r of rs) { for (const a of r.pitched.arpShapes) shapes.set(a.value, (shapes.get(a.value) || 0) + a.count); for (const f of r.pitched.flicks) flicks.set(f.value, (flicks.get(f.value) || 0) + f.count); }
    const hz = new Map(); rs.forEach((r) => tally(hz, Math.round(r.callHz ?? 0)));
    // pooled over all the composer's notes, and how many tunes use it on 2% of their notes or more
    const pool = (share) => { const n = rs.reduce((t, r) => t + r.pitched.notes, 0); return pct(rs.reduce((t, r) => t + (share(r) * r.pitched.notes) / 100, 0), n); };
    const using = (share) => `${rs.filter((r) => share(r) >= 2).length}/${rs.length}`;
    rows.push({
      composer, tunes: rs.length,
      arpAll: pool((r) => r.pitched.arpShare), arpTunes: using((r) => r.pitched.arpShare),
      vibAll: pool((r) => r.pitched.vibratoShare), vibTunes: using((r) => r.pitched.vibratoShare),
      slideAll: pool((r) => r.pitched.slideShare), slideTunes: using((r) => r.pitched.slideShare),
      flickAll: pool((r) => r.pitched.flickShare), envTunes: using((r) => r.volume.softwareEnvelopeShare),
      // decays and envelopes pooled over all notes (drums included), as the sheets quote them
      decayAll: pct(rs.reduce((t, r) => t + ((r.volume.kinds.decay ?? 0) * r.notes) / 100, 0), rs.reduce((t, r) => t + r.notes, 0)),
      envAll: pct(rs.reduce((t, r) => t + (r.volume.softwareEnvelopeShare * r.notes) / 100, 0), rs.reduce((t, r) => t + r.notes, 0)), formats: [...new Set(rs.map((r) => r.format))].join(', '),
      callHz: top(hz, 3).map((h) => `${h.value}(${h.count})`).join(' '), ticksPerRow: m((r) => r.ticksPerRow), bpm: m((r) => r.bpmIfFourRowsPerBeat),
      notesPerSecond: m((r) => r.notesPerSecond), samples: m((r) => r.samples.distinct), loopedSamples: m((r) => pct(r.samples.looped, r.samples.distinct)),
      drumChannel: pct(rs.filter((r) => r.drumsOnOwnChannel).length, rs.length), drumsShared: pct(rs.filter((r) => r.drumsSharedWith.length).length, rs.length),
      arp: m((r) => r.pitched.arpShare), arpShapes: top(shapes, 5).map((a) => a.value).join(' '), arpTicks: m((r) => r.pitched.arpPeriodTicks[0]?.value),
      vibrato: m((r) => r.pitched.vibratoShare), vibCents: m((r) => r.pitched.vibrato?.depthCents), vibTicks: m((r) => r.pitched.vibrato?.periodTicks), vibDelay: m((r) => r.pitched.vibrato?.delayTicks),
      slide: m((r) => r.pitched.slideShare), slideCentsPerTick: m((r) => r.pitched.slide?.centsPerTick), flick: m((r) => r.pitched.flickShare), flicks: top(flicks, 3).map((f) => `[${f.value}]`).join(' '),
      softEnv: m((r) => r.volume.softwareEnvelopeShare), decayShare: m((r) => r.volume.kinds.decay ?? 0), decayPerTick: m((r) => r.volume.decayPerTick), attack: m((r) => r.volume.attackTicks),
      noteTicks: m((r) => r.noteTicks), echo: pct(rs.filter((r) => r.echoes.length).length, rs.length),
      ...modColumns(rs.filter((r) => r.patterns).map((r) => r.patterns)),
    });
  }
  return rows;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values: o, positionals } = parseArgs({ allowPositionals: true, options: {
    subsong: { type: 'string' }, seconds: { type: 'string', default: '120' }, notes: { type: 'string' },
    from: { type: 'string', default: '0' }, count: { type: 'string', default: '60' }, json: { type: 'string' },
    corpus: { type: 'string' }, 'check-mods': { type: 'string' }, out: { type: 'string', default: 'build/analysis/amiga-corpus.json' }, summarize: { type: 'string' } } });
  const seconds = Number(o.seconds);
  if (o.summarize) {
    const results = JSON.parse(fs.readFileSync(o.summarize, 'utf8'));
    // one row per composer, then the whole corpus as one
    for (const r of [...summarize(results), ...summarize(results.map((r) => ({ ...r, composer: 'ALL' })))]) console.log(Object.entries(r).map(([k, v]) => `${k}=${v}`).join(' | '));
  } else if (o.corpus) await corpus(o.corpus, { out: o.out, seconds });
  else if (o['check-mods']) {
    const files = [];
    (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.mod$/i.test(e.name)) files.push(p); } })(o['check-mods']);
    const recall = [], precision = [];
    for (const f of files.sort()) {
      try {
        const { truth, found, matched } = await checkMod(f, { seconds: Math.min(seconds, 60) });
        const sum = (a) => a.reduce((x, y) => x + y, 0), [t, n, m] = [sum(truth), sum(found), sum(matched)];
        if (t) recall.push(m / t);
        if (n) precision.push(m / n);
        const low = [0, 1, 2, 3].filter((c) => truth[c] >= 20 && matched[c] < truth[c] / 2);
        console.log(`${low.length ? 'LOW' : 'ok '} ${path.relative(o['check-mods'], f)}: cells ${truth.join('/')}, found ${found.join('/')}, matched ${matched.join('/')} (recall ${pct(m, t)}%, precision ${pct(m, n)}%)${low.length ? `, channel ${low} under half` : ''}`);
      } catch (e) { console.log(`ERR ${f}: ${e.message}`); }
    }
    const q = (a, f) => pct([...a].sort((x, y) => x - y)[Math.floor(f * (a.length - 1))], 1);
    console.log(`${recall.length} MODs: onsets matched in time, recall median ${q(recall, 0.5)}% (quartiles ${q(recall, 0.25)}-${q(recall, 0.75)}%), precision median ${q(precision, 0.5)}% (quartiles ${q(precision, 0.25)}-${q(precision, 0.75)}%)`);
  }
  else if (!positionals[0]) { console.error('Usage: node tools/amiga-study.js <file> [--notes CH] [--json out] | --corpus <dir> [--out file]'); process.exit(1); }
  else {
    const r = await studyFile(positionals[0], { seconds, subsong: o.subsong ?? null });
    if (o.notes !== undefined) printNotes(r, Number(o.notes), Number(o.from), Number(o.count));
    else printSummary(r);
    if (o.json) { delete r._notes; fs.writeFileSync(o.json, JSON.stringify(r, null, 1)); }
  }
}
