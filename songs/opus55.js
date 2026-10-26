/**
 * Shared articulation helpers for the Opus 5.5 batch (songs/*.gen.js).
 *
 * Every sounding note is written with its whole life: attack volume, a lower
 * held level, optional delayed vibrato or arpeggio on held rows, a release
 * stamp, and a ^^ cut — unless the next note of the same line starts on that
 * row (legato). Collisions throw instead of silently overwriting a cut.
 */
export { echoChannel } from './lib.js';

function place(ch, row, ev, rows, what) {
  if (!Number.isInteger(row) || row < 0 || row >= rows) throw new Error(`${what}: row ${row} outside 0..${rows - 1}`);
  if (ch[row]) throw new Error(`${what}: collision at row ${row}`);
  ch[row] = ev;
}

/**
 * A monophonic line from [row, note, length, volume, fx?] tuples.
 * opts.sustain: held level relative to the attack; opts.release: last-row level
 * for notes of 4+ rows; opts.vib: vibrato command stamped on held rows from
 * opts.vibDelay rows after the attack (notes long enough only). A J fx repeats
 * on every held row, because IT arpeggio only runs on rows that carry it.
 */
export function phrase(events, instrument, { rows, sustain = 0.72, release = 0.4, vib = null, vibDelay = 3, name = 'phrase' } = {}) {
  const ch = {};
  const sorted = [...events].sort((a, b) => a[0] - b[0]);
  const starts = new Set(sorted.map((e) => e[0]));
  for (const [row, note, len, vol, fx] of sorted) {
    if (!Number.isInteger(len) || len < 1) throw new Error(`${name}: bad length at row ${row}`);
    place(ch, row, { note, instrument, vol: `v${vol}`, ...(fx ? { fx } : {}) }, rows, name);
    for (let r = row + 1; r < row + len && r < rows; r++) {
      if (starts.has(r)) throw new Error(`${name}: note at row ${row} overlaps row ${r}`);
      const ev = {};
      if (r === row + 1) ev.vol = `v${Math.round(vol * sustain)}`;
      if (len >= 4 && r === row + len - 1) ev.vol = `v${Math.round(vol * release)}`;
      if (fx?.[0] === 'J') ev.fx = fx;
      else if (vib && len >= vibDelay + 2 && r >= row + vibDelay) ev.fx = vib;
      if (Object.keys(ev).length) place(ch, r, ev, rows, name);
    }
    const end = row + len;
    if (end < rows && !starts.has(end)) place(ch, end, { note: '^^' }, rows, name);
  }
  return ch;
}

/** One-shot hits: [row, instrument, volume]. Samples decay on their own. */
export function hits(list, { rows, name = 'hits' } = {}) {
  const ch = {};
  for (const [row, instrument, vol, fx] of list) {
    place(ch, row, { note: 'C-5', instrument, vol: `v${vol}`, ...(fx ? { fx } : {}) }, rows, name);
  }
  return ch;
}

/** Stamp a pan (Xxx) on the first row whose effect column is free. */
export function pan(ch, x) {
  const fx = `X${x.toString(16).toUpperCase().padStart(2, '0')}`;
  for (let r = 0; ; r++) {
    if (!ch[r]) { ch[r] = { fx }; return ch; }
    if (!ch[r].fx) { ch[r] = { ...ch[r], fx }; return ch; }
  }
}

/** Keep only events in [from, to) — for echoing selected phrase endings. */
export function slice(ch, from, to) {
  return Object.fromEntries(Object.entries(ch).filter(([r]) => +r >= from && +r < to));
}

/** Combine event maps that must not share rows. */
export function join(...chs) {
  const out = {};
  for (const ch of chs) for (const [r, ev] of Object.entries(ch)) {
    if (out[r]) throw new Error(`join: collision at row ${r}`);
    out[r] = ev;
  }
  return out;
}

/** Silence a channel for a pattern that should not inherit a ringing loop. */
export const rest = () => ({ 0: { note: '^^' } });
