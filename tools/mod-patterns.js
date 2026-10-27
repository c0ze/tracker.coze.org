/**
 * Convert cozy-tracker (IT-semantics) patterns to 4-channel ProTracker cells.
 *
 * A MOD cell holds a period, a sample number and ONE effect, so the volume
 * column and the effect column compete:
 * - note rows: the volume wins (a note at the wrong level is worse than one
 *   row without its effect), except over a note cut (SCx), which wins so a
 *   short note does not ring on; a note whose volume equals the sample's MOD
 *   default needs no Cxx, and defaults are chosen per sample as its most
 *   common note volume;
 * - other rows: the effect wins, so arpeggio and vibrato stay continuous;
 * - song-wide effects (jumps, breaks, speed, tempo) are placed together in
 *   free cells, or replace the effects whose loss matters least. Bxx always
 *   sits left of Dxx: ProTracker reads channels left to right, and a later
 *   Bxx would reset the break row.
 * Everything dropped or approximated is counted in `warn`.
 *
 * State: each channel tracks the IT channel volume (`itVol`) and the volume
 * the MOD actually has (`vol`) separately; either is undefined when unknown,
 * and an unknown volume is always written out again. A cut (^^ or SCx) stops
 * an IT voice, but a MOD cut only sets volume 0 while the loop keeps running,
 * so volume commands on a cut channel are suppressed until the next note.
 * IT effect memory (E/F shared, G, H, O, S, D, volume-column slides) is
 * resolved here, because MOD memory works differently (1xx/2xx/Axy have none).
 *
 * Slides: itwriter sets IT linear slides (1/16 semitone per unit), MOD slides
 * are in period units, so E/F/G amounts are converted at the channel's
 * playing period, which is advanced as the slide runs. Vibrato depth: IT Hxy
 * swings y/16 semitone each way, ptplayer's 4xy (255 x depth) >> 7 periods,
 * so the depth is the one closest at the playing period (vibratoDepth in
 * mod-samples.js; libopenmpt plays MOD vibrato deeper than ptplayer, so
 * judge depths with mod-check, not a render). Slides and vibrato are limited so
 * Paula never goes below period 123 (see mod-samples.js); noteUsage gives
 * upward slides headroom in the sample mapping first, so the limit rarely bites.
 */
import { PERIODS, TOP_NOTE, MIN_PERIOD, vibratoDepth } from './mod-samples.js';

const MAX_PERIOD = 856;
const UNKNOWN = 'unknown';
const NAMES = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];
export const noteNumber = (s) => NAMES.indexOf(s.slice(0, 2)) + 12 * Number(s[2]);
const isNote = (s) => typeof s === 'string' && s !== '==' && s !== '^^';
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const bcd = (row) => Math.floor(row / 10) * 16 + row % 10;
const hex = (n) => n.toString(16);

/**
 * Notes each sample must play (arpeggio tones included), how far upward
 * slides and arpeggios on a slid pitch take it (`slideHi`, in IT note
 * numbers) and the volumes its notes start at. Follows the rows as they play
 * (playRows: orders that never play do not count), then the loop again with
 * the channels' state carried over until the samples they hold repeat, since
 * a note with no instrument plays the sample its channel holds. `sel`
 * (mod-copies.js) chooses the copy a cell plays. Returns { lo[], hi[],
 * slideHi[], vols[] (Map volume -> count), notes[] (Set), vib[] (the
 * deepest IT vibrato depth on the sample's notes), events (Map
 * "order:row:channel" of a note's cell -> { inst, notes: Set }: the note, its
 * arpeggio tones and the notes it glides to, which must play on one copy),
 * copies (Map "order:row:channel" -> the sample the channel holds after that
 * cell, for cells with a note or an instrument), give (the keys of notes with
 * no instrument that some visit reaches holding another copy) }; slideHi and vols count the
 * first time through. A cell reached again holding another copy is refused:
 * a MOD cell is one sample however it is reached.
 */
export function noteUsage(song, sel = null) {
  const n = song.samples.length;
  const use = {
    lo: Array(n).fill(Infinity), hi: Array(n).fill(-Infinity), slideHi: Array(n).fill(-Infinity),
    vols: Array.from({ length: n }, () => new Map()),
    notes: Array.from({ length: n }, () => new Set()), events: new Map(), copies: new Map(), vib: Array(n).fill(0),
    give: new Set(),
  };
  const mark = (inst, note) => {
    use.lo[inst] = Math.min(use.lo[inst], note); use.hi[inst] = Math.max(use.hi[inst], note); use.notes[inst].add(note);
  };
  const state = [];
  let ticks = song.ticks || 6;
  const visit = (order, r, turn) => {
    const pat = song.patterns[song.order[order]];
    let repeat = 1;
    pat.channels.forEach((ch, c) => {
      const st = state[c] ??= { inst: null, note: null, arp: 0, pitch: null, target: null, ef: 0, g: 0, s: 0 };
      const fx = ch[r]?.fx;
      if (!fx) return;
      const P = parseInt(fx.slice(1), 16);
      if (fx[0] === 'A' && P) ticks = Math.min(P, 31);
      if (fx[0] === 'S') {                          // pattern delay replays the row's slides; S00 recalls Sxy
        if (P) st.s = P;
        if (st.s >> 4 === 0xe) repeat = 1 + (st.s & 15);
        if (sel && st.s >> 4 === 0xb)
          throw new Error(`order ${order} row ${r}: a pattern loop (SBx) is not followed; ranged copies need the song's real path`);
      }
    });
    pat.channels.forEach((ch, c) => {
      const st = state[c], e = ch[r];
      if (!e) return;
      const key = `${order}:${r}:${c}`, L = e.fx?.[0], P = e.fx ? parseInt(e.fx.slice(1), 16) : 0;
      const was = st.inst, glide = L === 'G';
      if (e.instrument != null || (isNote(e.note) && !glide && st.inst != null))
        st.inst = sel ? sel.select(st, e, key) : e.instrument ?? st.inst;
      // a note with no instrument reached (on any visit) holding another copy:
      // its MOD cell gives the sample, so it plays right however it is reached
      if (sel && e.instrument == null && isNote(e.note) && was !== st.inst) use.give.add(key);
      // A note event: what plays on one copy, from a note to the next. A glide
      // and an arpeggio stay in their note's event; a note with no instrument
      // starts one (the converter gives it its copy's sample), and so does an
      // instrument with no note that changes the channel's sample.
      const event = (k, note) => {
        const ev = use.events.get(k) ?? use.events.set(k, { inst: st.inst, notes: new Set() }).get(k);
        ev.notes.add(note);
        st.event = k;
      };
      if (isNote(e.note) && st.inst != null) {
        const note = noteNumber(e.note);
        if (glide && st.note != null && use.events.get(st.event)?.inst === st.inst) event(st.event, note);
        else event(key, note);
        st.note = st.target = note;
        mark(st.inst, st.note);
        if (L !== 'G' || st.pitch == null) st.pitch = st.note;
        if (e.instrument != null && !turn) {
          const v = e.vol?.[0] === 'v' ? Number(e.vol.slice(1)) : song.samples[st.inst].volume ?? 64;
          use.vols[st.inst].set(v, (use.vols[st.inst].get(v) || 0) + 1);
        }
      } else if (e.instrument != null && st.note != null && (sel ? sel.origin[was] !== sel.origin[st.inst] : was !== st.inst))
        event(key, st.note);
      if (sel && st.inst != null && (e.instrument != null || isNote(e.note))) {
        const held = use.copies.get(key);
        if (held != null && held !== st.inst)
          throw new Error(`order ${order} row ${r} channel ${c + 1}: plays sample ${held + 1} once and, reached again ` +
            `(the loop or a jump), sample ${st.inst + 1}; a MOD cell is one sample however it is reached: give the note its instrument`);
        use.copies.set(key, st.inst);
      }
      if (st.inst == null || st.note == null) return;
      const lift = (semis) => {
        if (!turn) use.slideHi[st.inst] = Math.max(use.slideHi[st.inst], Math.ceil(st.pitch + semis - 1e-9));
      };
      if (L === 'J') {
        const a = P || st.arp;
        st.arp = a;
        for (const d of [a >> 4, a & 15]) {
          mark(st.inst, st.note + d);
          if (st.event) use.events.get(st.event).notes.add(st.note + d);   // an arpeggio's tones play on its note's copy
        }
        lift(Math.max(a >> 4, a & 15));          // the tones ride on the sounding (maybe slid) pitch
      } else if (L === 'H') {
        if (P & 15) st.hy = P & 15;
        use.vib[st.inst] = Math.max(use.vib[st.inst], st.hy || 0);   // vibrato takes a note under its period
      } else if (L === 'G') {
        if (P) st.g = P;
        const step = st.g * (ticks - 1) * repeat / 16;
        st.pitch = st.pitch < st.target ? Math.min(st.target, st.pitch + step) : Math.max(st.target, st.pitch - step);
      } else if (L === 'E' || L === 'F') {
        const a = P || st.ef;
        st.ef = a;
        const d = (a >= 0xe0 ? (a & 15) / (a >= 0xf0 ? 16 : 64) : a * (ticks - 1) / 16) * repeat;
        st.pitch += L === 'F' ? d : -d;
        if (L === 'F') lift(0);
      }
    });
  };
  const { rows, loop } = playRows(song), seen = new Set();
  for (let turn = 0; turn < 64; turn++) {
    for (const [o, r] of turn ? rows.slice(loop) : rows) visit(o, r, turn);
    const key = JSON.stringify(state.map((st) => st && [st.inst, st.note, st.arp]));
    if (seen.has(key)) break;
    seen.add(key);
  }
  return use;
}

/** The rows in play order along playbackPath: { rows: [[order, row]], loop: the index the song repeats from }. */
export function playRows(song) {
  const { path, loopTo } = playbackPath(song), rows = [];
  let loop = 0;
  path.forEach(({ order, entryRow, exitRow }, k) => {
    if (k === loopTo) loop = rows.length;
    for (let r = entryRow; r <= exitRow; r++) rows.push([order, r]);
  });
  return { rows, loop };
}

/**
 * The order entries in the sequence they play. Each order leaves by its first
 * jump or break at or after the row it was entered at (on a row with several,
 * the rightmost channel's wins, as in IT; Bxx past the order list is ignored,
 * as the converter drops it), or falls through to the next; the last order
 * wraps to 0. An order can appear again with another entry row. Returns
 * { path: [{ order, entryRow, exitRow }], loopTo }, where exitRow is the last
 * row that plays and loopTo is the index in `path` the song repeats from.
 */
export function playbackPath(song) {
  const n = song.order.length, path = [], seen = new Map();
  let at = 0, row = 0;
  while (!seen.has(`${at}:${row}`)) {
    seen.set(`${at}:${row}`, path.length);
    const pat = song.patterns[song.order[at]], entry = { order: at, entryRow: row, exitRow: pat.rows - 1 };
    path.push(entry);
    let next = at + 1, nextRow = 0;
    for (let r = row; r < pat.rows; r++) {
      const fx = pat.channels.map((ch) => ch[r]?.fx).filter(Boolean);
      const b = fx.filter((f) => f[0] === 'B' && parseInt(f.slice(1), 16) < n).at(-1), c = fx.findLast((f) => f[0] === 'C');
      const jump = b ? parseInt(b.slice(1), 16) : null;
      if (jump == null && !c) continue;
      next = jump ?? at + 1;
      nextRow = c ? parseInt(c.slice(1), 16) : 0;
      entry.exitRow = r;
      break;
    }
    at = next % n;
    row = nextRow < song.patterns[song.order[at]].rows ? nextRow : 0;
  }
  return { path, loopTo: seen.get(`${at}:${row}`) };
}

/**
 * Merge the channel states an order entry can be reached with ({ state,
 * ticks } each): a field all of them agree on is kept, any other is unknown.
 */
export function mergeStates(list) {
  const width = Math.max(...list.map((x) => x.state.length));
  const state = Array.from({ length: width }, (_, c) => {
    const sts = list.map((x) => x.state[c] || {}), st = {};
    for (const k of new Set(sts.flatMap(Object.keys))) {
      // a vibrato's last period may still sound if either visit left one
      if (k === 'vibOff') { st[k] = sts.some((o) => o[k]); continue; }
      const v = JSON.stringify(sts[0][k]);
      if (sts.every((o) => JSON.stringify(o[k]) === v)) st[k] = structuredClone(sts[0][k]);
    }
    return st;
  });
  return { state, ticks: list.every((x) => x.ticks === list[0].ticks) ? list[0].ticks : null };
}

/**
 * Convert one IT pattern with per-channel `state` (mutated). `ctx` has
 * samples (MOD plans: off, ratio, volume, itVolume), copies and sel (the
 * copy each cell plays: noteUsage, mod-copies.js), ticks (current speed,
 * mutated), orderMap (IT order -> MOD order, one extra entry for the end),
 * orderLength, patternRows(order), at (this IT order), row0 ({speed, tempo}
 * to set on row 0, or null), entryRow (the row playback enters at) and
 * warn(message). Returns rows of 4 cells { period, sample, cmd, param } with
 * song-wide effects placed, and sets ctx.played to the [first, last] rows this
 * visit plays; `state` ends as playback leaves the pattern.
 */
export function convertPattern(p, state, ctx) {
  const rows = [];
  let saved = null;
  // Entered at a later row (a break to row R): rows before it are converted
  // with a throwaway state, and the incoming state applies from row R.
  const entryRow = ctx.entryRow || 0, entry = entryRow ? { state: structuredClone(state), ticks: ctx.ticks } : null;
  for (let r = 0; r < p.rows; r++) {
    if (entry && r === entryRow) { state.splice(0, state.length, ...entry.state); ctx.ticks = entry.ticks; }
    ctx.repeat = 1;
    for (let c = 0; c < 4; c++) {
      const fx = p.channels[c]?.[r]?.fx;
      if (!fx) continue;
      const P = parseInt(fx.slice(1), 16);
      if (fx[0] === 'A' && P) ctx.ticks = Math.min(P, 31);
      const a = fx[0] === 'S' ? P || state[c]?.S || 0 : 0;          // S00 recalls the last Sxy
      if (a >> 4 === 0xe) ctx.repeat = 1 + (a & 15);                  // SEx plays the row x more times
    }
    const row = { speed: null, tempo: null, jump: null, brk: null, delay: null };
    const cells = [];
    for (let c = 0; c < 4; c++) cells.push(convertCell(p.channels[c]?.[r], state[c] ??= {}, ctx, row, r, c));
    placeGlobals(cells, rowGlobals(row, p, r, ctx), state, ctx.warn);
    // pitch moves only for the effects that made it into the final cells
    cells.forEach((c, i) => { if (c.next) Object.assign(state[i], c.next); delete c.next; });
    // after a vibrato the channel sounds its last vibrato period until a note
    // or an effect that sets the period again (mt_pernop: 0-8, A, E1x, E2x)
    cells.forEach((c, i) => {
      if (c.cmd === 0x4 || c.cmd === 0x6) state[i].vibOff = true;
      else if ((c.period && c.cmd !== 0x3 && c.cmd !== 0x5) || c.cmd <= 0x8 || c.cmd === 0xa ||
        (c.cmd === 0xe && [1, 2, 0xa, 0xb].includes(c.param >> 4))) state[i].vibOff = false;
    });
    rows.push(cells);
    // Rows after a jump or break never play from here: convert them, but do
    // not let them change the state the next order starts with.
    if ((row.jump != null || row.brk != null) && !saved && r >= entryRow) {
      saved = { state: structuredClone(state), ticks: ctx.ticks, row: r };
    }
  }
  ctx.played = [entryRow, saved ? saved.row : p.rows - 1];
  if (saved) { state.splice(0, state.length, ...saved.state); ctx.ticks = saved.ticks; }
  return rows;
}

// The row's song-wide effects in placement order: jump, speed, tempo, pattern delay, break.
function rowGlobals(row, p, r, ctx) {
  const g = [];
  if (r === 0 && ctx.row0) {
    if (row.speed == null) row.speed = ctx.row0.speed;
    if (row.tempo == null) row.tempo = ctx.row0.tempo;
  }
  let jump = null, brk = null;
  if (row.jump != null || row.brk != null) {
    const to = (row.jump ?? ctx.at + 1) % ctx.orderLength;    // a break on the last order restarts the song
    let at = row.brk ?? 0;
    if (at >= ctx.patternRows(to)) { ctx.warn(`pattern break to row ${at}, past the end of its pattern: row 0`); at = 0; }
    const dest = ctx.orderMap[to] + Math.floor(at / 64), here = ctx.orderMap[ctx.at] + Math.floor(r / 64);
    if (dest === here + 1) brk = bcd(at % 64);
    else { jump = dest; if (at % 64) brk = bcd(at % 64); }
  } else if (r === p.rows - 1 && p.rows % 64) brk = 0;          // a short last chunk ends early
  if (jump != null) g.push(['jump', 0xb, jump]);
  if (row.speed != null) g.push(['speed', 0xf, row.speed]);
  if (row.tempo != null) g.push(['tempo', 0xf, row.tempo]);
  if (row.delay != null) g.push(['delay', 0xe, 0xe0 | row.delay]);
  if (brk != null) g.push(['break', 0xd, brk]);
  if (g.length > 4) {
    ctx.warn('five song-wide effects on one row: pattern delay dropped');
    g.splice(g.findIndex((x) => x[0] === 'delay'), 1);
  }
  return g;
}

// Which effect a song-wide one replaces when a row has no free slot: the one
// whose loss matters least (a later channel on a tie).
const VICTIM = ['volume step', 'effect continuing a note', 'note volume', 'effect', 'note cut'];
const isCutCmd = (c) => (c.cmd === 0xc && c.param === 0) || (c.cmd === 0xe && c.param >> 4 === 0xc);
function cost(c) {
  if (isCutCmd(c)) return 4;
  if (c.cmd === 0xc) return c.period ? 2 : 0;
  if (!c.period && [0x0, 0x4, 0xa].includes(c.cmd)) return 1;
  return 3;
}
const isVolumeCmd = ([cmd, param]) => cmd === 0xc || cmd === 0xa || (cmd === 0xe && [0xa, 0xb].includes(param >> 4));

function placeGlobals(cells, g, state, warn) {
  if (!g.length) return;
  const idx = [0, 1, 2, 3];
  // a free cell right after a vibrato, with no note, is what sets the period
  // back (mt_pernop): use the others first
  const strands = (i) => !!state[i]?.vibOff && !cells[i].period;
  const taken = idx.filter((i) => !cells[i].cmd && !cells[i].param)
    .sort((a, b) => strands(a) - strands(b) || a - b).slice(0, g.length);
  const rest = idx.filter((i) => !taken.includes(i)).sort((a, b) => cost(cells[a]) - cost(cells[b]) || b - a);
  while (taken.length < g.length) {
    const i = rest.shift(), c = cells[i];
    warn(`no free effect slot for a song-wide effect; replaced a ${hex(c.cmd)}xx (${VICTIM[cost(c)]})`);
    if (isVolumeCmd([c.cmd, c.param]) || isCutCmd(c)) state[i].vol = undefined;
    if (isCutCmd(c)) state[i].cut = false;
    c.next = null;                                  // its pitch change never happens
    if (c.cmd === 0x3 && c.period) state[i].period = c.period;   // without 3xx the note triggers outright
    taken.push(i);
  }
  taken.sort((a, b) => a - b).forEach((i, k) => { cells[i].cmd = g[k][1]; cells[i].param = g[k][2]; });
}

// Volume after a MOD command (or the MOD equivalent of an IT one). A row
// replayed by a pattern delay leaves slides unknown.
function applyVol(v, op, ticks, repeat = 1) {
  if (!op) return v;
  if (op === UNKNOWN) return undefined;
  const [cmd, p] = op;
  if (cmd === 0xc) return Math.min(64, p);
  if (v == null || (repeat > 1 && isVolumeCmd(op))) return undefined;
  if (cmd === 0xa) return clamp(p >> 4 ? v + (p >> 4) * (ticks - 1) : v - (p & 15) * (ticks - 1), 0, 64);
  if (cmd === 0xe && p >> 4 === 0xa) return Math.min(64, v + (p & 15));
  if (cmd === 0xe && p >> 4 === 0xb) return Math.max(0, v - (p & 15));
  if (cmd === 0xe && p >> 4 === 0xc) return (p & 15) < ticks ? 0 : v;
  return v;
}

function convertCell(e, st, ctx, row, r, c) {
  const cell = { period: 0, sample: 0, cmd: 0, param: 0 };
  if (!e) return cell;
  const { warn, ticks } = ctx, repeat = ctx.repeat || 1;
  const noteRow = isNote(e.note), wasCut = st.cut;
  if (e.note === '==') warn('note-off (==) has no MOD equivalent; ignored as in IT sample mode');
  // the copy this cell plays (mod-copies.js), as noteUsage found it along the
  // song's path; a row that never plays chooses from the state it is given
  const copy = ctx.copies?.get(`${ctx.at}:${r}:${c}`), before = st.inst;
  let given = false;
  if (copy != null && e.instrument == null && noteRow && (copy !== st.inst || ctx.give?.has(`${ctx.at}:${r}:${c}`))) {
    given = true;
    // a note with no instrument whose event plays another copy: the MOD cell
    // gives that copy (and its default volume, set back below if IT's differs)
    st.inst = copy;
    cell.sample = copy + 1;
    st.vol = ctx.samples[copy].volume;
  }
  if (e.instrument != null) {
    st.inst = copy ?? (ctx.sel ? ctx.sel.select(st, e) : e.instrument);
    st.itVol = ctx.samples[st.inst].itVolume;        // IT: a sample number resets the channel volume
    if (noteRow || !st.cut) {                         // MOD too, but that would revive a cut voice
      cell.sample = st.inst + 1;
      st.vol = ctx.samples[st.inst].volume;
    }
  }
  let restart = false;
  if (noteRow) {
    if (st.inst == null) warn('note without any sample yet: dropped');
    else {
      const plan = ctx.samples[st.inst];
      if (st.cut !== false && !cell.sample) {         // after a (possible) cut a MOD note needs its sample again
        cell.sample = st.inst + 1;
        st.vol = plan.volume;
        restart = true;
      }
      st.note = noteNumber(e.note);
      const m = st.note - plan.off;
      if (m < 0 || m > TOP_NOTE) warn(`note ${e.note} outside the MOD range for sample ${st.inst + 1}: clamped`);
      cell.period = PERIODS[clamp(m, 0, TOP_NOTE)];
      st.target = cell.period;
      // a glide onto another sample would glide in the old sample's periods
      const switched = e.fx?.[0] === 'G' && before != null && st.inst !== before;
      if (switched) warn('glide onto another sample: the note is played outright');
      if (e.fx?.[0] !== 'G' || st.cut || !st.period || switched) st.period = cell.period;
      if (switched) st.switched = true;
      st.cut = false;
    }
  }
  const volOp = e.vol ? volumeColumn(e.vol, st, warn) : null;
  let fx = e.fx ? effect(e.fx, st, ctx, row, r) : { out: null, itVol: null };
  // IT starts a cut voice's note outright; a MOD 3xx would glide from the old pitch
  if (noteRow && (wasCut || st.switched) && e.fx?.[0] === 'G') fx = { out: null, itVol: null };
  delete st.switched;
  if (e.note === '^^') {
    if (fx.out) warn(`effect ${e.fx[0]} on a note-cut row: dropped`);
    [cell.cmd, cell.param] = [0xc, 0];
    st.cut = true;
    st.vol = 0;
    st.itVol = applyVol(applyVol(st.itVol, volOp, ticks, repeat), fx.itVol, ticks, repeat);
    return cell;
  }
  let vol = null;
  // a copy given for a note with no instrument resets the MOD volume, so a
  // relative volume-column step must become the volume IT reaches
  let relOp = volOp;
  if (given && volOp && volOp[0] !== 0xc) {
    const fine = volOp[0] === 0xe && (volOp[1] >> 4 === 0xa || volOp[1] >> 4 === 0xb);
    const to = fine && st.itVol != null ? applyVol(st.itVol, volOp, ticks, repeat) : null;
    if (to != null) relOp = [0xc, to];
    else { warn('volume-column slide on a note given its copy: written as the volume before it'); relOp = st.itVol != null ? [0xc, st.itVol] : null; }
  }
  if (relOp && !st.cut && !(relOp[0] === 0xc && relOp[1] === st.vol)) vol = relOp;
  if (!volOp && cell.sample) {                        // the MOD reset to its default; IT has its own volume
    if (st.itVol == null) { if (restart) warn('note after a cut restarts at the sample default (its IT volume is unknown here)'); }
    else if (st.itVol !== st.vol) vol = [0xc, st.itVol];
  }
  const cut = fx.out && fx.out[0] === 0xe && fx.out[1] >> 4 === 0xc;
  let pick = vol || fx.out;
  if (vol && fx.out) {
    const volWins = noteRow && !cut;
    pick = volWins ? vol : fx.out;
    warn(volWins ? `effect ${e.fx[0]} dropped for the note volume` : noteRow ? 'note volume dropped for a note cut (SCx)' : `volume dropped for effect ${e.fx[0]}`);
  }
  if (pick && st.cut && isVolumeCmd(pick)) pick = null;  // would bring a cut loop back
  // ptplayer keeps a vibrato's last period through a Cxx row (mt_volchange on
  // tick 0, mt_nop after), so after a vibrato a volume is reached by a fine
  // volume slide or a volume slide, which write the period back (set_pervol)
  if (pick && pick[0] === 0xc && pick[1] && !cell.period && st.vibOff) {
    // a pattern delay runs the slide on every tick of each repeat
    const d = st.vol == null ? null : pick[1] - st.vol, moves = ticks * repeat - 1;
    if (d != null && Math.abs(d) <= 15 && repeat === 1) pick = d >= 0 ? [0xe, 0xa0 | d] : [0xe, 0xb0 | -d];
    else if (d != null && moves > 0) {
      const step = clamp(Math.round(d / moves), -15, 15);
      if (step * moves !== d) warn('volume after a vibrato reached by a slide, not exactly (ptplayer keeps the vibrato\'s last period through Cxx)');
      pick = step > 0 ? [0xa, step << 4] : step < 0 ? [0xa, -step] : [0x0, 0x0];
    } else warn('Cxx after a vibrato keeps its last period for a row (the volume before it is unknown here)');
  }
  if (pick) [cell.cmd, cell.param] = pick;
  if (pick && pick === fx.out && fx.period !== undefined) cell.next = { period: fx.period };
  if (noteRow && e.fx?.[0] === 'G' && pick !== fx.out) st.period = cell.period;   // no 3xx: the note triggers outright
  st.itVol = applyVol(applyVol(st.itVol, volOp, ticks, repeat), fx.itVol, ticks, repeat);
  st.vol = applyVol(st.vol, pick, ticks, repeat);
  if (cut && pick === fx.out && (pick[1] & 15) < ticks) st.cut = true;
  return cell;
}

// The volume column as the equivalent MOD command (IT meaning, memory resolved).
function volumeColumn(v, st, warn) {
  const k = v[0], x = Number(v.slice(1));
  if (k === 'v') return [0xc, x];
  if (k === 'p') { warn('panning (pNN) dropped: Paula channels are hard left/right'); return null; }
  if ('abcd'.includes(k)) {                           // the four slides share one memory in IT
    if (x) st.vcol = x;
    const a = x || st.vcol;
    if (!a) return null;
    return k === 'a' ? [0xe, 0xa0 | a] : k === 'b' ? [0xe, 0xb0 | a] : [0xa, k === 'c' ? a << 4 : a];
  }
  warn(`volume-column ${k} dropped`);
  return null;
}

// Period change for a slide of `units` sixteenths of a semitone at period p.
const slide = (p, units, up) => Math.max(1, Math.round(Math.abs(p - p * 2 ** ((up ? -units : units) / 192))));

/**
 * One IT effect -> { out: MOD [cmd, param] or null, itVol: its effect on the
 * IT channel volume (a MOD-equivalent command, UNKNOWN or null), period: the
 * playing period after the row if `out` survives }. Song-wide effects are
 * recorded in `row` instead.
 */
function effect(fx, st, ctx, row, r) {
  const L = fx[0], P = parseInt(fx.slice(1), 16), x = P >> 4, y = P & 15, { warn, ticks } = ctx;
  const repeat = ctx.repeat || 1, moves = (ticks - 1) * repeat;   // slide steps this row
  // The pitch is unknown when a loop is entered at different pitches (a slide
  // on a held note climbs a little more on every pass): it may already sit at
  // Paula's floor, so upward slides and vibrato are dropped there.
  const period = st.period ?? PERIODS[TOP_NOTE];
  const unknown = (what) => { warn(`${what} dropped: the pitch is unknown here (a loop enters at different pitches)`); return out(null); };
  const mem = (key) => (P ? (st[key] = P) : st[key] || 0);
  const out = (cmd) => ({ out: cmd, itVol: null });
  switch (L) {
    case 'J': { const a = mem('J'); return out(a ? [0x0, a] : null); }
    case 'H': {
      if (x) st.Hx = x;
      if (y) st.Hy = y;
      const speed = st.Hx || 0, depthIT = st.Hy || 0;
      if (!depthIT) return out(null);
      if (st.period == null) return unknown('vibrato');
      let depth = vibratoDepth(depthIT, period);
      const room = Math.floor((period - MIN_PERIOD) * 128 / 255);  // ptplayer: period - depth * 255 / 128 at the peak
      if (depth > room) {
        if (room < 1) { warn(`vibrato dropped: it would take Paula below period ${MIN_PERIOD}`); return out(null); }
        warn(`vibrato depth reduced to keep Paula at or above period ${MIN_PERIOD}`);
        depth = room;
      }
      return out([0x4, (speed << 4) | depth]);
    }
    case 'G': {
      const a = mem('G');
      if (!a) return out(null);
      const target = st.target ?? period, d = clamp(slide(period, a, target < period), 1, 255);
      if (!st.period) return out([0x3, d]);
      const step = d * moves;
      return { out: [0x3, d], itVol: null, period: st.period > target ? Math.max(target, st.period - step) : Math.min(target, st.period + step) };
    }
    case 'E': case 'F': {
      const a = mem('EF'), up = L === 'F';                // IT shares one memory for E and F
      if (!a) return out(null);
      if (up && st.period == null) return unknown('upward slide');
      if (a >= 0xe0) {
        const units = (a & 15) / (a >= 0xf0 ? 1 : 4);
        if (!units) return out(null);
        let fine = clamp(slide(period, units, up), 1, 15);
        if (up && period - fine * repeat < MIN_PERIOD) {   // a pattern delay may replay it
          fine = Math.floor((period - MIN_PERIOD) / repeat);
          if (fine < 1) { warn(`slide dropped at period ${MIN_PERIOD} (PAL minimum)`); return out(null); }
          warn(`slide limited at period ${MIN_PERIOD} (PAL minimum)`);
        }
        const cmd = [0xe, (up ? 0x10 : 0x20) | fine];
        return st.period ? { out: cmd, itVol: null, period: clamp(st.period + (up ? -fine : fine) * repeat, MIN_PERIOD, MAX_PERIOD) } : out(cmd);
      }
      let d = clamp(slide(period, a, up), 1, 255);
      if (up && moves > 0) {
        const room = Math.floor((period - MIN_PERIOD) / moves);
        if (d > room) {
          if (room < 1) { warn(`slide dropped at period ${MIN_PERIOD} (PAL minimum)`); return out(null); }
          warn(`slide limited at period ${MIN_PERIOD} (PAL minimum)`);
          d = room;
        }
      }
      const cmd = [up ? 0x1 : 0x2, d];
      return st.period ? { out: cmd, itVol: null, period: clamp(st.period + (up ? -d : d) * moves, MIN_PERIOD, MAX_PERIOD) } : out(cmd);
    }
    case 'D': {
      const a = mem('D'), dx = a >> 4, dy = a & 15;
      let cmd = null;
      if ((a === 0xf0 || a === 0x0f) && ticks === 1) cmd = [0xe, (a === 0xf0 ? 0xa0 : 0xb0) | 15];  // IT slides DF0/D0F on tick 0 too
      else if (a === 0xf0 || a === 0x0f) {
        warn(`D${fx.slice(1)}: IT also slides on the row's first tick, MOD does not`);
        return { out: [0xa, a], itVol: UNKNOWN };
      } else if (dy === 15 && dx) cmd = [0xe, 0xa0 | dx];
      else if (dx === 15 && dy) cmd = [0xe, 0xb0 | dy];
      else if (!dx || !dy) cmd = a ? [0xa, a] : null;
      else warn(`D${fx.slice(1)} (both nibbles set) dropped`);
      return { out: cmd, itVol: cmd || (a ? UNKNOWN : null) };
    }
    case 'Q': {
      const a = mem('Q'), change = (a >> 4) % 8;
      if (change) warn('Qxy volume change dropped (E9x has none)');
      return { out: [0xe, 0x90 | (a & 15)], itVol: change ? UNKNOWN : null };
    }
    case 'O': {
      const a = mem('O'), scaled = Math.round(a * ctx.samples[st.inst ?? 0].ratio);
      if (!scaled) return out(null);                     // 900 would recall an older offset
      if (scaled > 255) warn('sample offset past 255 x 256 bytes: clamped');
      return out([0x9, Math.min(255, scaled)]);
    }
    case 'S': {
      const a = mem('S'), sx = a >> 4, sy = a & 15, chunk = Math.floor(r / 64);
      if (sx === 0xb) {
        if (!sy) { st.loop = { at: ctx.at, chunk }; return out([0xe, 0x60]); }
        const from = st.loop?.at === ctx.at ? st.loop.chunk : 0;
        if (from !== chunk) { warn('pattern loop (SBx) crosses a 64-row split: dropped'); return out(null); }
        return out([0xe, 0x60 | sy]);
      }
      if (sx === 0xc) return out([0xe, 0xc0 | (sy || 1)]);   // IT runs SC0/SD0 on tick 1
      if (sx === 0xd) return out([0xe, 0xd0 | (sy || 1)]);
      if (sx === 0xe) { row.delay = sy; return out(null); }   // song-wide: placed with the jumps and breaks
      warn(sx === 8 ? 'panning (S8x) dropped' : `S${hex(a)} dropped`);
      return out(null);
    }
    case 'X': case 'Y': case 'P': warn(`panning (${L}xx) dropped: Paula channels are hard left/right`); return out(null);
    case 'A':
      if (P > 31) warn('speed above 31 clamped');
      if (P) row.speed = Math.min(P, 31);
      return out(null);
    case 'T': if (P >= 32) row.tempo = P; else warn('tempo slide (T0x/T1x) dropped'); return out(null);
    case 'B': if (P >= ctx.orderLength) warn(`B${fx.slice(1)} jumps past the order list: dropped`); else row.jump = P; return out(null);
    case 'C': row.brk = P; return out(null);
    default: warn(`effect ${L} has no MOD mapping: dropped`); return out(null);
  }
}

/** Serialize converted rows into 64-row MOD pattern bodies (Uint8Array(1024) each). */
export function splitPattern(rows) {
  const out = [];
  for (let start = 0; start < rows.length; start += 64) {
    const body = new Uint8Array(1024), n = Math.min(64, rows.length - start);
    for (let r = 0; r < n; r++) {
      rows[start + r].forEach((c, i) => {
        const o = r * 16 + i * 4;
        body[o] = (c.sample & 0xf0) | (c.period >> 8);
        body[o + 1] = c.period & 0xff;
        body[o + 2] = ((c.sample & 15) << 4) | c.cmd;
        body[o + 3] = c.param;
      });
    }
    out.push(body);
  }
  return out;
}
