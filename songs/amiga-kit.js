/**
 * amiga-kit — tracker recipes for writing in the manner of classic Amiga composers.
 * Numbers come from skills/amiga-masters/references/styles.md, measured with
 * tools/amiga-study.js from Paula traces of their music (docs/amiga-corpus-studies.md).
 * The kit turns those numbers into IT effects and volume stamps; the sounds come from the
 * sound library (docs/sound-library.md), never from the studied modules.
 *
 *   import { vibrato, arp, envelope, fade, held, echo, place, patternize, STYLE } from './amiga-kit.js';
 */

/**
 * IT vibrato `Hxy` for a measured vibrato: one cycle every `periodTicks` ticks, `cents`
 * either way. IT plays ±y/16 semitone (6.25 cents a step, H52 = ±12.5) with a period of
 * 64/x ticks (tools: skills/mod-music/references/tracker-format.md, "Rendered probes").
 */
export function vibrato(periodTicks, cents) {
  const x = Math.max(1, Math.min(15, Math.round(64 / periodTicks)));
  const y = Math.max(1, Math.min(15, Math.round(cents / 6.25)));
  return `H${x.toString(16).toUpperCase()}${y.toString(16).toUpperCase()}`;
}

/** IT arpeggio `Jxy` for a chord shape like '0-4-7' or '0-12' (offsets above the played note). */
export function arp(shape) {
  const [, x = 0, y = 0] = shape.split('-').map(Number);
  if (x > 15 || y > 15) throw new Error(`arp ${shape}: Jxy reaches 15 semitones at most`);
  return `J${x.toString(16).toUpperCase()}${y.toString(16).toUpperCase()}`;
}

/**
 * Volume stamps for a software envelope, one level per row: `envelope(row, [48, 40, 34, 28])`
 * gives { row: {vol:'v48'}, row+1: {vol:'v40'}, ... }. Many Amiga players (TFMX, Whittaker,
 * Hippel) change volume every tick; at speed 6 a row-per-step envelope is the tracker's
 * coarser copy. Merge the note into the first row yourself.
 */
export function envelope(row, levels) {
  return Object.fromEntries(levels.map((v, i) => [row + i, { vol: `v${String(Math.max(0, Math.min(64, Math.round(v)))).padStart(2, '0')}` }]));
}

/**
 * A per-tick fade, as the players that change volume every tick (Whittaker, TFMX, Hippel) make:
 * `fade(row, rows, 0.9)` stamps `D0y` on `rows` rows from `row` so the volume falls about 0.9 a
 * tick. IT applies D on every tick of a row but the first, so y = perTick·ticks/(ticks-1).
 * D takes the effect column: rows that need a vibrato too take `envelope()` stamps instead.
 * `swell` is the same upwards (`Dx0`).
 */
export function fade(row, rows, perTick, { ticks = 6 } = {}) {
  return slide(row, rows, perTick, ticks, (y) => `D0${y}`);
}
export function swell(row, rows, perTick, { ticks = 6 } = {}) {
  return slide(row, rows, perTick, ticks, (y) => `D${y}0`);
}
function slide(row, rows, perTick, ticks, fx) {
  if (!(perTick > 0)) return {}; // no fade asked for (STYLE.wright.fade is 0)
  const y = Math.max(1, Math.min(14, Math.round((perTick * ticks) / Math.max(1, ticks - 1))));
  const out = {};
  for (let r = 0; r < rows; r++) out[row + r] = { fx: fx(y.toString(16).toUpperCase()) };
  return out;
}

/**
 * A held note with an effect continued on every row (IT effects last one row):
 * `held(row, rows, 'H48', { from: 2 })` stamps H48 from row+2 and H00 after it.
 */
export function held(row, rows, fx, { from = 0 } = {}) {
  const out = {};
  // H and G recall their memory with 00; an arpeggio is stamped in full on every row
  const again = 'HG'.includes(fx[0]) ? `${fx[0]}00` : fx;
  for (let r = from; r < rows; r++) out[row + r] = { fx: r === from ? fx : again };
  return out;
}

/**
 * An echo channel: another channel's notes again, `delay` rows later and quieter, as many
 * Amiga tunes spend a spare channel (tools/amiga-study.js reports `echoes`). Unlike
 * songs/lib.js `echoChannel`, every echoed note states its level, so a note that resets to its
 * sample's default volume is scaled too, and nothing is cut at the pattern's end.
 * `trim: true` stops each echoed note where the source's next note starts, and drops the echo
 * of a note no longer than the delay.
 * `echo(lead, { delay: 3, scale: 0.5 })` copies notes, volumes and `^^` cuts; effects are
 * left out unless `{ fx: true }`. Rows past `rows` (a pattern's length) are dropped: carry
 * them into the next pattern yourself.
 */
export function echo(channel, { delay = 3, scale = 0.5, rows = 64, fx = false, instrument, defaultVol = 64, trim = false, ticks = 6 } = {}) {
  const out = {};
  // the source's volume as it plays: a note with an instrument starts at the sample's default
  // (`volume`, 64 unless set), a bare note keeps the channel's level, `vNN` sets it and the
  // volume-column slides move it (a/b fine, once; c/d on every tick but the first)
  let level = defaultVol;
  const clamp = (x) => Math.max(0, Math.min(64, x));
  const scaled = (v) => `v${String(Math.min(64, Math.round(v * scale))).padStart(2, '0')}`;
  for (const r of Object.keys(channel).map(Number).sort((a, b) => a - b)) {
    const ev = channel[r], row = r + delay, note = ev.note && ev.note !== '^^' && ev.note !== '==';
    if (note && ev.instrument !== undefined) level = defaultVol;
    const [cmd, amount] = ev.vol ? [ev.vol[0], Number(ev.vol.slice(1))] : [null, 0];
    if (cmd === 'v') level = amount;
    else if (cmd === 'a' || cmd === 'b') level = clamp(level + (cmd === 'a' ? amount : -amount));
    else if (cmd === 'c' || cmd === 'd') level = clamp(level + (cmd === 'c' ? 1 : -1) * amount * (ticks - 1));
    if (row >= rows) continue;
    const e = {};
    if (ev.note) e.note = ev.note;
    if (note && (instrument ?? ev.instrument) !== undefined) e.instrument = instrument ?? ev.instrument;
    // Every echoed note states its level, so a bare note or another instrument cannot reset it.
    // A pan (pNN) on a note row moves to the effect column (Xxx); slides are scaled with the
    // echo; pitch commands in the volume column (e-h) are kept, and their note keeps its level.
    if (cmd === 'p') {
      if (note) { e.vol = scaled(level); if (!(fx && ev.fx)) e.fx = `X${Math.min(255, Math.round((amount * 255) / 64)).toString(16).toUpperCase().padStart(2, '0')}`; } else e.vol = ev.vol;
    } else if ('abcd'.includes(cmd ?? '-')) {
      const n = Math.round(amount * scale);
      if (n) e.vol = `${cmd}${n}`;
      if (note && !n) e.vol = scaled(level);
    } else if (cmd && cmd !== 'v') e.vol = ev.vol;
    else if (note || cmd === 'v') e.vol = scaled(level);
    if (fx && ev.fx) e.fx = ev.fx;
    if (Object.keys(e).length) out[row] = e;
  }
  // trim: each echoed note stops where the source's next note starts, so the echo re-strikes
  // the source's pitch without holding it against the next one
  if (trim) {
    const starts = Object.keys(channel).map(Number).filter((r) => channel[r].note && channel[r].note !== '^^' && channel[r].note !== '==').sort((a, b) => a - b);
    starts.forEach((r, k) => {
      const next = starts[k + 1];
      if (next === undefined || next >= rows) return;
      // a note no longer than the delay would only sound against the next one: no echo for it
      if (r + delay >= next) { for (let x = r + delay; x < next + delay && x < rows; x++) if (out[x] && x !== next + delay) delete out[x]; return; }
      for (let x = next; x < next + delay && x < rows; x++) if (out[x] && !out[x].note) delete out[x];
      out[next] = { ...(out[next] ?? {}), note: '^^' };
      delete out[next].vol;
    });
  }
  return out;
}

/**
 * Starting numbers per composer, from references/styles.md (measured; see that sheet for where
 * each number comes from). `vibrato` is the IT effect, `vibratoFrom` the row it starts on (0: on
 * the note), `vibratoShare` the share of notes that have it; `fade` volume steps a tick for the
 * notes that decay; `drums`: 'none', 'own' (a channel of their own), 'bass' (between the bass
 * notes on the bass channel) or 'shared' (on melodic channels); `echo` in rows at `speed`.
 * Starting points, not rules: the sheet says which tunes differ. A MOD's `4xy` becomes `Hx·` with
 * y about 1.3 times its depth (a ProTracker depth step swings about 8 cents around C-2, IT's 6.25).
 */
export const STYLE = {
  whittaker: { speed: 5, bpm: 125, vibrato: 'H83', vibratoFrom: 0, vibratoShare: 0.16, arps: [], fade: 0.8, drums: 'none', echo: null,
    palette: ['pad.warm', 'pad.vowel', 'bell.clear', 'bass.round', 'lead.brass'] },
  wright: { speed: 5, bpm: 125, vibrato: 'H71', vibratoFrom: 0, vibratoShare: 0.05, arps: [], fade: 0, drums: 'own', echo: { delay: 4, scale: 0.5 },
    palette: ['keys.mallet', 'bell.clear', 'keys.tine', 'pad.warm', 'tom.round', 'kick.soft'] },
  tel: { speed: 6, bpm: 125, vibrato: 'H56', vibratoFrom: 2, vibratoShare: 0.06, arps: [], fade: 0, drums: 'none', echo: null,
    palette: ['keys.tine', 'keys.mallet', 'pad.warm', 'bass.round'] },
  huelsbeck: { speed: 4, bpm: 125, vibrato: 'H64', vibratoFrom: 2, vibratoShare: 0.04, arps: ['0-12', '0-2', '0-3-8', '0-5-9'], fade: 0.9, drums: 'bass', echo: { delay: 3, scale: 0.6 },
    palette: ['lead.pwm', 'lead.brass', 'bass.pluck', 'pad.warm', 'kick.punch', 'snare.tight', 'hat.closed'] },
  hubbard: { speed: 2, bpm: 125, vibrato: 'HB2', vibratoFrom: 0, vibratoShare: 0.25, arps: ['0-12'], fade: 4, drums: 'none', echo: null,
    palette: ['lead.pwm', 'bass.round'] },
  hippel: { speed: 3, bpm: 125, vibrato: 'H86', vibratoFrom: 2, vibratoShare: 0.03, arps: ['0-3-7', '0-4-7', '0-12', '0-4-9'], fade: 3.8, drums: 'own', echo: null,
    palette: ['lead.pwm', 'bass.pluck', 'kick.punch', 'snare.tight', 'hat.closed'] },
  brimble: { speed: 6, bpm: 125, vibrato: 'H83', vibratoFrom: 1, vibratoShare: 0.02, arps: ['0-12'], fade: 2.5, drums: 'shared', echo: null,
    palette: ['kick.punch', 'snare.tight', 'hat.closed', 'bass.pluck', 'lead.brass', 'pad.warm'] },
  leitch: { speed: 6, bpm: 125, vibrato: 'H83', vibratoFrom: 1, vibratoShare: 0.01, arps: ['0-4-7', '0-4-9', '0-3-8', '0-3-7'], fade: 0, drums: 'shared', echo: null,
    palette: ['organ.drawbar', 'lead.brass', 'bass.round', 'kick.punch', 'snare.tight'] },
  obarski: { speed: 6, bpm: 125, vibrato: null, arps: ['0-4-7', '0-3-7', '0-3-8', '0-5-8'], fade: 0, drums: 'shared', echo: null,
    palette: ['organ.drawbar', 'bass.round', 'kick.punch', 'snare.tight'] },
  mantronix: { speed: 6, bpm: 125, vibrato: 'HA3', vibratoFrom: 1, vibratoShare: 0.06, arps: [], fade: 2, drums: 'own', echo: null,
    palette: ['kick.punch', 'snare.tight', 'hat.closed', 'bass.round', 'lead.brass', 'pad.warm'] },
  fourmat: { speed: 6, bpm: 125, vibrato: 'H83', vibratoFrom: 2, vibratoShare: 0.03, arps: ['0-12', '0-3-7', '0-4-7'], fade: 1.5, drums: 'shared', echo: { delay: 2, scale: 0.25 },
    palette: ['lead.pwm', 'pad.warm', 'bell.clear', 'bass.round', 'kick.punch', 'snare.tight'] },
  jester: { speed: 4, bpm: 125, vibrato: 'H81', vibratoFrom: 1, vibratoShare: 0.01, arps: [], fade: 4.5, drums: 'shared', echo: { delay: 1, scale: 0.5 },
    palette: ['kick.punch', 'snare.tight', 'hat.closed', 'bass.pluck', 'lead.pwm', 'pad.warm'] },
  jogeir: { speed: 6, bpm: 125, vibrato: 'H76', vibratoFrom: 1, vibratoShare: 0.06, arps: [], fade: 1, drums: 'shared', echo: { delay: 2, scale: 0.5 },
    palette: ['lead.brass', 'pad.warm', 'bass.round', 'kick.punch', 'snare.tight', 'cymbal.crash'] },
  lizardking: { speed: 4, bpm: 125, vibrato: 'H91', vibratoFrom: 1, vibratoShare: 0.04, arps: [], fade: 8, drums: 'shared', echo: null,
    palette: ['kick.punch', 'snare.tight', 'hat.closed', 'bass.pluck', 'lead.pwm'] },
  moby: { speed: 6, bpm: 125, vibrato: 'H84', vibratoFrom: 1, vibratoShare: 0.15, arps: [], fade: 8, drums: 'own', echo: null,
    palette: ['kick.punch', 'snare.tight', 'hat.closed', 'bass.pluck', 'lead.brass', 'pad.warm'] },
};

/**
 * Put an event on a channel row, merging with what is there: `place(ch, 4, { fx: 'H83' })` adds
 * a vibrato to the note on row 4. Writing a field that is already set throws, so two ideas
 * cannot silently overwrite each other.
 */
export function place(ch, row, ev) {
  if (!Number.isInteger(row) || row < 0) throw new Error(`place: row ${row} is not a row`);
  const cur = ch[row] ?? {};
  for (const k of Object.keys(ev)) if (cur[k] !== undefined && cur[k] !== ev[k]) throw new Error(`row ${row}: ${k} is ${cur[k]}, not ${ev[k]}`);
  ch[row] = { ...cur, ...ev };
  return ch;
}

/**
 * Cut whole-song channels (rows counted from the start of the song) into patterns of `rows`,
 * keeping one copy of identical patterns (a reused pattern costs no memory in the module).
 * `names[i]` labels the i-th chunk. Returns { patterns, order }.
 */
export function patternize(channels, { rows = 64, names = [] } = {}) {
  const length = Math.max(...channels.flatMap((ch) => Object.keys(ch).map(Number))) + 1;
  const patterns = [], order = [];
  for (let i = 0; i * rows < length; i++) {
    const p = {
      name: names[i] ?? `part ${i + 1}`, rows,
      channels: channels.map((ch) => Object.fromEntries(Object.entries(ch).filter(([r]) => r >= i * rows && r < (i + 1) * rows).map(([r, e]) => [r - i * rows, e]))),
    };
    // compare cells by content, not by the order their fields were written in
    const key = (q) => JSON.stringify(q.channels, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([x], [y]) => (x < y ? -1 : 1))) : v));
    const same = patterns.findIndex((q) => key(q) === key(p));
    if (same >= 0) { order.push(same); patterns[same].name += ` / ${p.name}`; continue; }
    order.push(patterns.length);
    patterns.push(p);
  }
  return { patterns, order };
}
