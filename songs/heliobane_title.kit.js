/**
 * Heliobane (MUSIC-A) shared kit: notation, articulation and assembly helpers.
 * Used by heliobane_{title,stage1,boss,stage2,clear,gameover}.gen.js. Named
 * heliobane_title.* only because this agent may create heliobane_<own id>.* files.
 * Samples live in heliobane_title.samples.js (re-exported here).
 */
import fs from 'fs';
import { nn, ns } from './lib.js';
export * from './heliobane_title.samples.js';

// ---------------------------------------------------------------- notation
const PC = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
/** 'c#5' / 'bb4' / 'e5' → tracker note ('C#5', 'A#4', 'E-5'). C-5 = middle C. */
export function T(tok) {
  const m = /^([a-g])([#b]?)(\d)$/.exec(tok);
  if (!m) throw new Error(`bad pitch ${tok}`);
  return ns(PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12 * Number(m[3]));
}
/**
 * Melody: "d5/2 d5 a5/6~ r/4 | ..." → [row, note, len, vol, mods]. Length
 * persists; '|' asserts a bar line. Mods: ! accent, ? soft, ~ vibrato, > glide in.
 */
export function mel(str, { vol = 40, semi = 0 } = {}) {
  const out = []; let row = 0, len = 4;
  for (const tok of str.trim().split(/\s+/)) {
    if (tok === '|') { if (row % 16) throw new Error(`bar line at row ${row}: ${str.slice(0, 40)}`); continue; }
    const m = /^([a-g][#b]?\d|r)(?:\/(\d+))?([!?~>]*)$/.exec(tok);
    if (!m) throw new Error(`bad token ${tok}`);
    if (m[2]) len = Number(m[2]);
    if (m[1] !== 'r') out.push([row, ns(nn(T(m[1])) + semi), len, vol + (m[3].includes('!') ? 6 : 0) - (m[3].includes('?') ? 10 : 0), m[3]]);
    row += len;
  }
  out.rows = row;
  return out;
}
const v = (x) => `v${Math.max(0, Math.min(64, Math.round(x)))}`;
function set(ch, r, ev, what) { if (ch[r]) throw new Error(`${what}: collision at row ${r}`); ch[r] = ev; }

/** Articulated monophonic line: attack, held level decaying to release, cut. */
export function line(notes, inst, { rows, sustain = 0.8, release = 0.5, vib = 'H42', vibDelay = 4, glide = 'G14' } = {}) {
  const ch = {}, starts = new Set(notes.map((n) => n[0]));
  for (const [row, note, len, vol, mods = ''] of notes) {
    if (row >= rows) continue;
    const gl = mods.includes('>');
    set(ch, row, gl ? { note, vol: v(vol), fx: glide } : { note, instrument: inst, vol: v(vol) }, 'line');
    const hold = vol * sustain, rel = vol * release;
    for (let r = row + 1; r < row + len && r < rows; r++) {
      const k = r - row, e = {};
      if (k === 1) e.vol = v(hold);
      else if (len >= 4 && (k % 2 === 0 || k === len - 1)) e.vol = v(hold + (rel - hold) * (k - 1) / (len - 2));
      if (gl && k < 3) e.fx = 'G00';
      else if (vib && (mods.includes('~') || len >= 8) && k >= vibDelay) e.fx = vib;
      if (Object.keys(e).length) set(ch, r, e, 'line');
    }
    if (row + len < rows && !starts.has(row + len)) set(ch, row + len, { note: '^^' }, 'line');
  }
  return ch;
}
/** Delayed lead copy, gated so it never sounds a 2nd/7th against the lead. */
export function echoOf(leadCh, notes, { delay = 3, scale = 0.4, rows } = {}) {
  const ch = {};
  for (const [r, ev] of Object.entries(leadCh)) {
    const t = Number(r) + delay; if (t >= rows) continue;
    ch[t] = { ...ev }; if (ev.vol?.startsWith('v')) ch[t].vol = v(Number(ev.vol.slice(1)) * scale);
  }
  const leadAt = (r) => notes.find(([s, , l]) => r >= s && r < s + l);
  const bad = (a, b) => [1, 2, 10, 11].includes((((nn(a) - nn(b)) % 12) + 12) % 12);
  let cur = null;
  for (let r = 0; r < rows; r++) {
    const e = ch[r], lead = leadAt(r);
    if (e?.note === '^^') cur = null;
    else if (e?.note) cur = e.note;
    if (cur && lead && bad(cur, lead[1]) && (e?.note || lead[0] === r)) { ch[r] = { note: '^^' }; cur = null; }
  }
  if (cur && !ch[rows - 1]?.note) ch[rows - 1] = { note: '^^' };
  return ch;
}

// ---------------------------------------------------------------- harmony
const QUAL = { '': [0, 4, 7], m: [0, 3, 7], dim: [0, 3, 6], aug: [0, 4, 8], sus4: [0, 5, 7], sus2: [0, 2, 7],
  5: [0, 7, 12], maj7: [4, 7, 11], m7: [3, 7, 10], 7: [4, 7, 10], add9: [4, 7, 14], madd9: [3, 7, 14], m6: [3, 7, 9] };
/** Chord chart "Dm Bb/8 C/8 | A" (default 16 rows) → segments. */
export function chart(str, { semi = 0 } = {}) {
  const segs = []; let row = 0, len = 16;
  for (const tok of str.trim().split(/\s+/)) {
    if (tok === '|') { if (row % 16) throw new Error(`chart bar line at ${row}`); continue; }
    const m = /^([A-G])([#b]?)([a-z0-9]*)(?:\/(\d+))?$/.exec(tok);
    if (!m || !(m[3] in QUAL)) throw new Error(`bad chord ${tok}`);
    if (m[4]) len = Number(m[4]);
    const root = (PC[m[1].toLowerCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + semi + 24) % 12;
    const iv = QUAL[m[3]], tones = new Set([root, ...iv.map((i) => (root + i) % 12)]);
    segs.push({ row, len, root, minor: iv.includes(3) && !iv.includes(4), iv, tones });
    row += len;
  }
  segs.rows = row;
  return segs;
}
export const at = (segs, r) => segs.find((s) => r >= s.row && r < s.row + s.len);
const place = (pc, lo) => lo + ((pc - lo) % 12 + 12) % 12; // pitch class into [lo, lo+11]

/** J-arpeggio chord pulses. Rhythm per bar: X accent, x soft, - held, . cut. */
export function arp(segs, rhythm, inst, { rows, lo = 'G-4', vol = 30, decay = 0.8, floor = 8 } = {}) {
  const ch = {}; let prev = nn(lo) + 5, cur = null, level = 0;
  for (let r = 0; r < rows; r++) {
    const c = rhythm[Math.floor(r / 16) % rhythm.length][r % 16], seg = at(segs, r);
    if (c === 'X' || c === 'x' || (c === '-' && cur && cur.seg !== seg)) {
      let best = null;
      for (let inv = 0; inv < 3; inv++) {
        const pcs = [0, 1, 2].map((i) => seg.root + seg.iv[(inv + i) % 3] + (inv + i >= 3 ? 12 : 0));
        const base = place(pcs[0], nn(lo)), x = pcs[1] - pcs[0], y = pcs[2] - pcs[0];
        if (x > 15 || y > 15) continue;
        if (!best || Math.abs(base - prev) < Math.abs(best.base - prev)) best = { base, fx: `J${x.toString(16)}${y.toString(16)}`.toUpperCase() };
      }
      prev = best.base; cur = { seg, ...best }; level = c === 'x' ? vol * 0.7 : vol;
      ch[r] = { note: ns(best.base), instrument: inst, vol: v(level), fx: best.fx };
    } else if (c === '-' && cur) {
      level = Math.max(floor, level * decay); ch[r] = { vol: v(level), fx: cur.fx };
    } else if (c === '.' && cur) { ch[r] = { note: '^^' }; cur = null; }
  }
  return ch;
}
/**
 * Bass/riff from rhythm chars (per bar): r root, o octave, f fifth, t third,
 * s b7 below, l fifth below, 0-9 / b semitones above the root (accented),
 * n next chord's root, h half step below it; uppercase accents; - hold; . cut.
 */
export function bass(segs, rhythm, inst, { rows, lo = 'D-3', vol = 46, soft = 0.72, decay = 0.9 } = {}) {
  const ch = {}; let on = false, level = 0;
  for (let r = 0; r < rows; r++) {
    const c = rhythm[Math.floor(r / 16) % rhythm.length][r % 16], seg = at(segs, r);
    const root = place(seg.root, nn(lo)), next = at(segs, seg.row + seg.len) ?? segs[0];
    const off = /[0-9]/.test(c) ? Number(c) : c === 'b' ? 10 : { r: 0, o: 12, f: 7, t: seg.minor ? 3 : 4, s: -2, l: -5 }[c.toLowerCase()];
    if (off !== undefined || 'nhNH'.includes(c)) {
      const n = off !== undefined ? root + off : place(next.root, nn(lo)) - (c.toLowerCase() === 'h' ? 1 : 0);
      level = c === c.toUpperCase() ? vol : vol * soft; on = true;
      ch[r] = { note: ns(n), instrument: inst, vol: v(level) };
    } else if (c === '-' && on) { level *= decay; ch[r] = { vol: v(level) }; }
    else if (c === '.' && on) { ch[r] = { note: '^^' }; on = false; }
  }
  return ch;
}
/** Voice-led sustained chord tone per segment, swelling in (strings). */
export function pad(segs, inst, { rows, lo = 'A-4', vol = 22, top = false } = {}) {
  const notes = []; let prev = nn(lo) + 6;
  for (const s of segs) {
    if (s.row >= rows) break;
    const cands = [...s.tones].map((pc) => place(pc, nn(lo)));
    const n = top ? Math.max(...cands) : cands.sort((a, b) => Math.abs(a - prev) - Math.abs(b - prev))[0];
    prev = n; notes.push([s.row, ns(n), Math.min(s.len, rows - s.row), vol, '']);
  }
  const ch = line(notes, inst, { rows, sustain: 0.7, release: 0.55, vib: null });
  for (const [row, , len] of notes) for (const k of [2, 4]) if (k < len - 1) ch[row + k] = { vol: v(vol * (k === 2 ? 0.85 : 1)) };
  return ch;
}
/** Auto harmony for held lead notes: nearest chord tone a 3rd-6th below. */
export function harmony(notes, segs, { minLen = 4, scale = 0.62 } = {}) {
  const out = [];
  for (const [row, note, len, vol] of notes) {
    const seg = at(segs, row); if (!seg || len < minLen) continue;
    const p = nn(note), cands = [];
    for (let d = 3; d <= 9; d++) if (seg.tones.has(((p - d) % 12 + 12) % 12)) cands.push(d);
    if (!cands.length) continue;
    const d = cands.sort((a, b) => Math.abs(a - 3.6) - Math.abs(b - 3.6))[0];
    out.push([row, ns(p - d), Math.min(len, seg.row + seg.len - row), Math.round(vol * scale), '']);
  }
  return out;
}

// ---------------------------------------------------------------- drums & assembly
/** Drum lane from per-bar strings; map char → [instrument, volume, fx?, note?]. */
export function beat(bars, map) {
  const ch = {};
  bars.forEach((s, b) => {
    if (s.length !== 16) throw new Error(`drum bar ${b} has ${s.length} rows: ${s}`);
    [...s].forEach((c, i) => {
      if (c === '.') return;
      const d = map[c]; if (!d) throw new Error(`no drum for ${c}`);
      ch[b * 16 + i] = { note: d[3] ?? 'C-5', instrument: d[0], vol: v(d[1]), ...(d[2] ? { fx: d[2] } : {}) };
    });
  });
  return ch;
}
/** n bars of `main`, optionally ending with `last` (fill). */
export const rep = (n, main, last) => Array.from({ length: n }, (_, i) => (last && i === n - 1 ? last : main));
export const shift = (ch, by) => Object.fromEntries(Object.entries(ch).map(([r, e]) => [Number(r) + by, e]));

/** Build a pattern from named parts in channel `layout`; absent parts are cut. */
export function pattern(name, bars, parts, layout, pans) {
  const rows = bars * 16;
  const channels = layout.map((key, i) => {
    const ch = { ...(parts[key] ?? { 0: { note: '^^' } }) };
    for (const r of Object.keys(ch)) if (Number(r) >= rows) throw new Error(`${name}/${key}: row ${r} >= ${rows}`);
    const fx = `X${pans[i].toString(16).toUpperCase().padStart(2, '0')}`;
    for (let r = 0; r < rows; r++) if (!ch[r]?.fx) { ch[r] = { ...(ch[r] ?? {}), fx }; break; }
    return ch;
  });
  return { name, rows, channels };
}
/** Put Bxx (jump to order `to`) on the last row of a pattern. */
export function jump(p, to) {
  const r = p.rows - 1, fx = `B${to.toString(16).toUpperCase().padStart(2, '0')}`;
  const ch = p.channels.find((c) => !c[r]?.fx);
  ch[r] = { ...(ch[r] ?? {}), fx };
  return p;
}
/** Like lib.writeSong, but each sample's PCM goes on one line. */
export function writeSongCompact(metaUrl, song) {
  const out = new URL(metaUrl.replace(/\.gen\.js$/, '.json'));
  const body = JSON.stringify({ ...song, samples: '@S' }, null, 1)
    .replace('"@S"', `[\n${song.samples.map((s) => JSON.stringify(s)).join(',\n')}\n]`);
  fs.writeFileSync(out, body);
  console.log(`${out.pathname.split('/').pop()}: ${song.patterns.length} patterns, order [${song.order}]`);
}
