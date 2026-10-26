/**
 * STUDS UP (Amiga port) kit: notation, articulation and assembly helpers for
 * the studsup_*_amiga generators. Original music for 4-channel ProTracker
 * MODs (tools/json2mod.js), one effect per cell. Samples: studsup_amiga.samples.js.
 * After heliobane_title.kit.js (T, mel, line, chart, bass, the J stabs, beat,
 * writeSongCompact). Changed: a held row carries either its volume step or
 * its vibrato/arpeggio, never both (a MOD cell has one effect), and the
 * pattern helper checks the channels a MOD must leave empty.
 *
 * Paula plays channels 0 and 3 on the left, 1 and 2 on the right. Two layouts
 * (studs-up-amiga docs/AUDIO.md "The channel plan"):
 *   menus (title, hub): 0 drums, 1 lead, 2 colour (the UI clicks take it), 3 bass;
 *   stings (match):     2 lead, 3 drums and bass; 0 and 1 stay empty (the crowd's).
 */
import fs from 'fs';
import { nn, ns } from './lib.js';
import { kick, snare, clap, wave, BASS_AMPS, BRASS_AMPS } from './studsup_amiga.samples.js';
export * from './studsup_amiga.samples.js';

// ---------------------------------------------------------------- notation
const PC = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
/** 'c#5' / 'bb4' / 'e5' -> tracker note ('C#5', 'A#4', 'E-5'). C-5 = middle C. */
export function T(tok) {
  const m = /^([a-g])([#b]?)(\d)$/.exec(tok);
  if (!m) throw new Error(`bad pitch ${tok}`);
  return ns(PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12 * Number(m[3]));
}
/**
 * Melody "c5/2 c5 f5/6~ r/2 | ..." -> notes [row, note, len, vol, mods]. A
 * length persists until changed; '|' asserts a bar line (16 rows). Mods:
 * ! accent, ? soft, ~ vibrato on the held rows, > glide from the last note.
 */
export function mel(str, { vol = 40, semi = 0, bar = 16 } = {}) {
  const out = []; let row = 0, len = 4;
  for (const tok of str.trim().split(/\s+/)) {
    if (tok === '|') { if (row % bar) throw new Error(`bar line at row ${row}: ${str.slice(0, 40)}`); continue; }
    const m = /^([a-g][#b]?\d|r)(?:\/(\d+))?([!?~>]*)$/.exec(tok);
    if (!m) throw new Error(`bad token ${tok}`);
    if (m[2]) len = Number(m[2]);
    if (m[1] !== 'r') out.push([row, ns(nn(T(m[1])) + semi), len, vol + (m[3].includes('!') ? 6 : 0) - (m[3].includes('?') ? 10 : 0), m[3]]);
    row += len;
  }
  out.rows = row;
  return out;
}
export const v = (x) => `v${Math.max(0, Math.min(64, Math.round(x)))}`;
function set(ch, r, ev, what) { if (ch[r]) throw new Error(`${what}: collision at row ${r}`); ch[r] = ev; }

/** Articulated line: attack, a held level decaying to the release, then a cut. */
export function line(notes, inst, { rows, sustain = 0.8, release = 0.5, vib = 'H42', vibDelay = 3, glide = 'G14', from = 0 } = {}) {
  const ch = {}, starts = new Set(notes.map((n) => n[0] + from));
  for (const [r0, note, len, vol, mods = ''] of notes) {
    const row = r0 + from;
    if (row >= rows) continue;
    const gl = mods.includes('>'), wob = vib && (mods.includes('~') || len >= 8);
    set(ch, row, gl ? { note, vol: v(vol), fx: glide } : { note, instrument: inst, vol: v(vol) }, 'line');
    const hold = vol * sustain, rel = vol * release;
    for (let r = row + 1; r < row + len && r < rows; r++) {
      const k = r - row;
      if (gl && k < 3) set(ch, r, { fx: 'G00' }, 'line');
      else if (wob && k >= vibDelay) set(ch, r, { fx: vib }, 'line');
      else if (k === 1) set(ch, r, { vol: v(hold) }, 'line');
      else if (len >= 4 && (k % 2 === 0 || k === len - 1)) set(ch, r, { vol: v(hold + (rel - hold) * (k - 1) / (len - 2)) }, 'line');
    }
    if (row + len < rows && !starts.has(row + len)) set(ch, row + len, { note: '^^' }, 'line');
  }
  return ch;
}

// ---------------------------------------------------------------- harmony
const QUAL = { '': [0, 4, 7], m: [0, 3, 7], dim: [0, 3, 6], sus4: [0, 5, 7], 5: [0, 7, 12], 7: [0, 4, 10], m7: [0, 3, 10] };
/** Chord chart "F Eb/8 Bb/8 | C" (default 16 rows a chord) -> segments. */
export function chart(str) {
  const segs = []; let row = 0, len = 16;
  for (const tok of str.trim().split(/\s+/)) {
    if (tok === '|') continue;
    const m = /^([A-G])([#b]?)([a-z0-9]*)(?:\/(\d+))?$/.exec(tok);
    if (!m || !(m[3] in QUAL)) throw new Error(`bad chord ${tok}`);
    if (m[4]) len = Number(m[4]);
    const root = (PC[m[1].toLowerCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
    segs.push({ row, len, root, iv: QUAL[m[3]], minor: QUAL[m[3]][1] === 3 });
    row += len;
  }
  segs.rows = row;
  return segs;
}
export const at = (segs, r) => segs.find((s) => r >= s.row && r < s.row + s.len) ?? segs[segs.length - 1];
const place = (pc, lo) => lo + ((pc - lo) % 12 + 12) % 12; // pitch class into [lo, lo+11]

/**
 * Bass from rhythm chars per bar (16 rows): r root, o octave, f fifth, t third,
 * s flat 7th below, l fifth below, n the next chord's root, h a half step below
 * it; uppercase accents; - hold (decaying); . cut. Rhythms repeat per bar.
 */
export function bass(segs, rhythm, inst, { rows, lo = 'D-3', vol = 44, soft = 0.72, decay = 0.88 } = {}) {
  const ch = {}; let on = false, level = 0;
  for (let r = 0; r < rows; r++) {
    const c = rhythm[Math.floor(r / 16) % rhythm.length][r % 16], seg = at(segs, r);
    const root = place(seg.root, nn(lo)), next = at(segs, seg.row + seg.len);
    const off = { r: 0, o: 12, f: 7, t: seg.minor ? 3 : 4, s: -2, l: -5 }[c.toLowerCase()];
    if (off !== undefined || 'nhNH'.includes(c)) {
      const n = off !== undefined ? root + off : place(next.root, nn(lo)) - (c.toLowerCase() === 'h' ? 1 : 0);
      level = c === c.toUpperCase() ? vol : vol * soft; on = true;
      ch[r] = { note: ns(n), instrument: inst, vol: v(level) };
    } else if (c === '-' && on) { level *= decay; ch[r] = { vol: v(level) }; }
    else if (c === '.' && on) { ch[r] = { note: '^^' }; on = false; }
  }
  return ch;
}
/**
 * J-arpeggio chord stabs per bar: X accent, x soft, - held (the arpeggio
 * repeated, no volume step), . cut. Each chord takes the inversion nearest
 * the last one, so the stabs voice-lead within one octave above `lo`.
 * vol null: the note rows carry no volume, so the sample's own volume is the
 * level and the MOD cell keeps the J (a note volume would take the cell).
 */
export function stabs(segs, rhythm, inst, { rows, lo = 'G-4', vol = 28 } = {}) {
  const ch = {}; let prev = nn(lo) + 5, cur = null;
  for (let r = 0; r < rows; r++) {
    const c = rhythm[Math.floor(r / 16) % rhythm.length][r % 16], seg = at(segs, r);
    if (c === 'X' || c === 'x') {
      let best = null;
      for (let inv = 0; inv < 3; inv++) {
        const pcs = [0, 1, 2].map((i) => seg.root + seg.iv[(inv + i) % 3] + (inv + i >= 3 ? 12 : 0));
        const base = place(pcs[0], nn(lo)), x = pcs[1] - pcs[0], y = pcs[2] - pcs[0];
        if (x < 0 || y < 0 || x > 15 || y > 15) continue;
        if (!best || Math.abs(base - prev) < Math.abs(best.base - prev)) best = { base, fx: `J${x.toString(16)}${y.toString(16)}`.toUpperCase() };
      }
      prev = best.base; cur = best;
      ch[r] = { note: ns(best.base), instrument: inst, ...(vol == null ? {} : { vol: v(c === 'x' ? vol * 0.7 : vol) }), fx: best.fx };
    } else if (c === '-' && cur) ch[r] = { fx: cur.fx };
    else if (c === '.' && cur) { ch[r] = { note: '^^' }; cur = null; }
  }
  return ch;
}

// ---------------------------------------------------------------- drums & assembly
/** Drum lane from 16-row bar strings; map char -> [instrument, volume, fx?]. */
export function beat(bars, map) {
  const ch = {};
  bars.forEach((s, b) => {
    if (s.length !== 16) throw new Error(`drum bar ${b} has ${s.length} rows: ${s}`);
    [...s].forEach((c, i) => {
      if (c === '.') return;
      const d = map[c]; if (!d) throw new Error(`no drum for ${c}`);
      ch[b * 16 + i] = { note: 'C-5', instrument: d[0], vol: v(d[1]), ...(d[2] ? { fx: d[2] } : {}) };
    });
  });
  return ch;
}
/** n bars of `main`, the last one `last` if given (a fill). */
export const rep = (n, main, last) => Array.from({ length: n }, (_, i) => (last && i === n - 1 ? last : main));
/** Lanes sharing one channel: a later lane's event only where no earlier lane has one. */
export const under = (...lanes) => lanes.reduceRight((acc, l) => ({ ...acc, ...l }), {});

/** A pattern of `rows` rows from 4 channels; `empty` lists channels that must hold nothing. */
export function pattern(name, rows, channels, { empty = [] } = {}) {
  channels.forEach((ch, i) => {
    for (const r of Object.keys(ch)) if (Number(r) >= rows) throw new Error(`${name}/${i}: row ${r} >= ${rows}`);
    if (empty.includes(i) && Object.keys(ch).length) throw new Error(`${name}: channel ${i} must stay empty`);
  });
  return { name, rows, channels };
}
/** Bxx (to order `to`) on the last row, in the first of `chans` with a free effect. */
export function jump(p, to, chans = [0, 1, 2, 3]) {
  const r = p.rows - 1, fx = `B${to.toString(16).toUpperCase().padStart(2, '0')}`;
  const c = chans.find((i) => !p.channels[i][r]?.fx && p.channels[i][r]?.note !== '^^');
  if (c === undefined) throw new Error(`${p.name}: no free effect on row ${r}`);
  p.channels[c][r] = { ...(p.channels[c][r] ?? {}), fx };
  return p;
}
/** The silent one-row pattern a jingle ends on: it jumps to itself (order `at`). */
export function silence(at, ch = 3) {
  const channels = [{}, {}, {}, {}];
  channels[ch] = { 0: { fx: `B${at.toString(16).toUpperCase().padStart(2, '0')}` } };
  return { name: 'end: silence', rows: 1, channels };
}
/** Write <generator>.json next to the generator, each sample's PCM on one line. */
export function writeSong(metaUrl, song) {
  const out = new URL(metaUrl.replace(/\.gen\.js$/, '.json'));
  const body = JSON.stringify({ ...song, samples: '@S' }, null, 1)
    .replace('"@S"', `[\n${song.samples.map((s) => JSON.stringify(s)).join(',\n')}\n]`);
  fs.writeFileSync(out, body);
  console.log(`${out.pathname.split('/').pop()}: ${song.patterns.length} patterns, order [${song.order}]`);
}

// ---------------------------------------------------------------- stings
/** The stings' samples, one recipe for all five; the brass plays at its own volume 44. */
export function stingSamples() {
  return [kick(), snare(), clap(), wave('bass', BASS_AMPS), { ...wave('brass', BRASS_AMPS), volume: 44 }];
}
export const SI = { kick: 0, snare: 1, clap: 2, bass: 3, brass: 4 };
/** Channel events from [row, sample, note, vol?, fx?] (note '^^': a cut; sample null: no sample). */
export function hits(list) {
  const ch = {};
  for (const [r, inst, note, vol, fx] of list) {
    const e = note === '^^' ? { note } : { ...(note ? { note: /^[A-G][-#]\d$/.test(note) ? note : T(note) } : {}),
      ...(inst == null ? {} : { instrument: inst }), ...(vol == null ? {} : { vol: v(vol) }), ...(fx ? { fx } : {}) };
    set(ch, r, e, 'hits');
  }
  return ch;
}
/**
 * A sting (stings layout): one pattern, lead on channel 2 and drums and bass
 * on channel 3, then the silent order 1 the player stops at (music.c). The
 * last sounding note must be cut before the end: the replay halts there.
 */
export function sting(metaUrl, { title, bpm, rows, lead, low, message }) {
  const main = pattern(title, rows, [{}, {}, lead, low], { empty: [0, 1] });
  writeSong(metaUrl, { title: `Studs Up - ${title}`, bpm, ticks: 6, mixvol: 48, samples: stingSamples(),
    patterns: [main, silence(1, 3)], order: [0, 1], channelnames: { 2: 'brass', 3: 'drums+bass' },
    message: `STUDS UP sting "${title}", original, for the Amiga port: Paula channels 2 and 3 only `
      + `(0 and 1 are the crowd's). Plays once, then holds the silent order 1.\n${message}` });
}
