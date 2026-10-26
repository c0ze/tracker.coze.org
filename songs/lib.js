/**
 * Shared helpers for song generator scripts (songs/*.gen.js).
 */
import fs from "fs";

export const NAMES = ["C-", "C#", "D-", "D#", "E-", "F-", "F#", "G-", "G#", "A-", "A#", "B-"];
export const nn = (s) => NAMES.indexOf(s.slice(0, 2)) + 12 * parseInt(s[2]); // "A-2"/"F#4" -> semitones
export const ns = (n) => NAMES[n % 12] + Math.floor(n / 12);
export const up = (s, semi) => ns(nn(s) + semi);
export const rn = (root, oct) => root.length === 2 ? root + oct : root + "-" + oct; // "F#",4 -> "F#4"

export const put = (ch, row, ev) => { ch[row] = ev; };

/** melody from [row, note, vol?, fx?] tuples; transposable & volume-scalable */
export function mel(events, { semi = 0, inst = 0, scale = 1, rows = 64 } = {}) {
  const ch = {};
  for (const [r, note, vol, fx] of events) {
    if (r >= rows) continue;
    if (note === "==" || note === "^^") { put(ch, r, { note }); continue; }
    const ev = { note: up(note, semi), instrument: inst };
    if (vol !== undefined) ev.vol = `v${Math.round(vol * scale)}`;
    if (fx) ev.fx = fx;
    put(ch, r, ev);
  }
  return ch;
}

/** Delayed phrase; clip its tail with a real cut, or explicitly author carry. */
export function echo(events, { delay = 3, scale = 0.5, semi = 0, inst = 0, rows = 64, boundary = 'cut' } = {}) {
  return echoChannel(mel(events, { semi, inst, rows }), { delay, scale, rows, boundary });
}

/** Copy a complete channel, including volume-only envelopes and effect rows. */
export function echoChannel(channel, { delay = 3, scale = 0.5, semi = 0, inst, rows = 64, boundary = 'cut' } = {}) {
  if (!Number.isInteger(delay) || delay < 0 || !Number.isInteger(rows) || rows < 1)
    throw new Error('Echo delay and rows must be nonnegative/positive integers');
  if (!Number.isFinite(scale) || scale < 0 || !Number.isInteger(semi))
    throw new Error('Echo scale must be finite/nonnegative and transpose must be an integer');
  if (!['cut', 'carry'].includes(boundary)) throw new Error('Echo boundary must be cut or carry');
  const ch = {};
  for (const [sourceRow, event] of Object.entries(channel)) {
    const r = Number(sourceRow) + delay;
    if (!Number.isInteger(r) || r < 0) throw new Error(`Invalid echo source row: ${sourceRow}`);
    if (r >= rows) continue;
    const ev = { ...event };
    if (ev.note && !['==', '^^'].includes(ev.note)) ev.note = up(ev.note, semi);
    if (inst !== undefined && ev.instrument !== undefined) ev.instrument = inst;
    if (ev.vol?.startsWith('v')) ev.vol = `v${Math.min(64, Math.round(Number(ev.vol.slice(1)) * scale))}`;
    ch[r] = ev;
  }
  if (boundary === 'cut') {
    let active = false;
    for (const r of Object.keys(ch).map(Number).sort((a, b) => a - b)) {
      if (ch[r].note === '^^') active = false;
      else if (ch[r].note && ch[r].note !== '==') active = true;
    }
    // Never replace an echo event already on the final row: a volume/effect
    // row gains the cut; an onset there is kept (and may ring into the next pattern).
    const last = ch[rows - 1];
    if (active && !last) ch[rows - 1] = { note: '^^' };
    else if (active && !last.note) ch[rows - 1] = { ...last, note: '^^' };
  }
  return ch;
}

/** merge event maps for one channel (later wins per row) */
export const merge = (...chs) => Object.assign({}, ...chs);

export function writeSong(metaUrl, song) {
  if (!/\.gen\.js$/.test(metaUrl)) throw new Error(`writeSong expects a *.gen.js generator, got ${metaUrl}`);
  const out = new URL(metaUrl.replace(/\.gen\.js$/, ".json"));
  fs.writeFileSync(out, JSON.stringify(song, null, 1));
  console.log(`${out.pathname.split("/").pop()}: ${song.patterns.length} patterns, order [${song.order}] (${song.order.length} entries)`);
}
