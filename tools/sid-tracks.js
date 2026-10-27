// cozy-tracker patterns (IT semantics) -> driver tracks, one per voice per pattern chunk
// (sid/FORMAT.md). Walks the order list row by row so effect memory, speed and tempo follow
// playback order; a pattern reached with different state gets its own tracks.
import { noteNumber, DRIVER_NOTE_OFFSET, frequencyTable } from './sid-data.js';

const FX = { arp: 1, up: 2, down: 3, porta: 4, vib: 5, speed: 6, jump: 7 };
// Vibrato quarter period in frames for IT speed 0..15 (a 64/speed-frame period).
const QUARTER = [1, 16, 8, 5, 4, 3, 3, 2, 2, 2, 2, 1, 1, 1, 1, 1];
const FREQ = (() => { const t = frequencyTable(); return t.lo.map((lo, i) => lo | (t.hi[i] << 8)); })();
// The SID frequency step of one semitone above driver note n: slides and vibrato scale with it
// so they keep the same musical size at every pitch (music.html, 1.2).
const semitone = (n) => FREQ[Math.min(94, n) + 1] - FREQ[Math.min(94, n)];
const word = (v) => [v & 0xff, (v >> 8) & 0xff];
// The driver's row counter is a byte. Even, so every chunk starts on an even pattern row and
// funktempo's row parity holds across a split.
export const CHUNK_ROWS = 254;
const REST = 0x62, REST_MAX = 30; // $62+n: this row and n more

/** Song order index -> driver order index (patterns longer than CHUNK_ROWS are split). */
export function orderMap(song) {
  const map = [];
  song.order.reduce((at, p, i) => (map[i] = at) + Math.ceil(song.patterns[p].rows / CHUNK_ROWS), 0);
  return map;
}

/**
 * Returns { tracks: [bytes[]], chunks: [{rows, tracks: [i, i, i]}], order: [chunk], loop, speed: [even, odd] }.
 * ctx: { transpose[], warn(message) }.
 *
 * Effect memory, the instrument a bare note plays, the note a slide is measured from, and speed
 * are resolved here, so each order is compiled with the state playback brings to it: the walk
 * follows the order list, its jumps and the loop from order 0, then from each section (which
 * restart reaches with the driver's initial state). An order reached in two states that would
 * compile differently gets a warning; the first one wins. Orders playback never reaches compile
 * from the initial state, as when a host starts there.
 */
export function convertSong(song, { transpose, warn }) {
  const map = orderMap(song), len = song.order.length;
  const loop = song.sid.loop ?? 0;
  // Frames per row as [even rows, odd rows]. A fractional speed rounds, or with sid.funktempo
  // alternates so that two rows take round(2 x exact) frames, the longer one first.
  const frames = (ticks, bpm, say) => {
    const exact = (ticks * 125) / bpm, frame = (f) => Math.min(255, Math.max(2, f));
    const pair = song.sid.funktempo
      ? ((n) => [Math.ceil(n / 2), Math.floor(n / 2)])(Math.round(2 * exact)).map(frame)
      : [frame(Math.round(exact)), frame(Math.round(exact))];
    const avg = (pair[0] + pair[1]) / 2;
    if (Math.abs(avg - exact) > 0.01 || pair[0] !== pair[1]) {
      const bpmText = `${Math.round((ticks * 125) / avg)} BPM`;
      say(`${ticks} ticks at ${bpm} BPM is ${exact.toFixed(2)} frames per row; ` +
        (pair[0] === pair[1] ? `plays at ${pair[0]} (${bpmText})` : `plays as ${pair[0]}+${pair[1]} (${bpmText})`));
    }
    return pair;
  };
  const initial = () => ({
    ticks: song.ticks ?? 6, bpm: song.bpm ?? 125,
    ch: [0, 1, 2].map(() => ({ inst: null, note: null, vib: null, mem: { J: 0, EF: 0, G: 0, Hx: 0, Hy: 0 } })),
  });
  const speed = song.sid.speed ? [song.sid.speed, song.sid.speed] : frames(song.ticks ?? 6, song.bpm ?? 125, warn);
  const quiet = () => {};
  const entrySpeed = (st) => (song.sid.speed ? speed : frames(st.ticks, st.bpm, quiet)).join('+');

  // One order position from `entry` -> { chunks: [{rows, tracks: [bytes x3]}], exit, next, speed }:
  // exit is the state playback carries on with, next the order it goes to.
  function compileOrder(oi, entry, say) {
    const st = structuredClone(entry), pat = song.patterns[song.order[oi]];
    const following = oi + 1 < len ? oi + 1 : loop;
    const chunks = [];
    let exit = null, next = null, reach = null; // reach: where the rows playback reaches end
    for (let start = 0; start < pat.rows; start += CHUNK_ROWS) {
      const rows = Math.min(CHUNK_ROWS, pat.rows - start);
      const out = [[], [], []], rest = [0, 0, 0];
      for (const c of st.ch) c.sent = null; // a chunk may be reached by a jump: name its instruments
      const flush = (c) => {
        for (let n = rest[c]; n > 0; n -= REST_MAX) out[c].push(REST + Math.min(n, REST_MAX) - 1);
        rest[c] = 0;
      };
      for (let r = start; r < start + rows; r++) {
        const fxOf = (c) => pat.channels[c]?.[r]?.fx;
        // A and T on one row act together, so every speed change on the row gets the result.
        let rowSpeed = null, speedCh = -1; // the driver gets one speed command, on the first such channel
        for (let c = 0; c < 3; c++) {
          const fx = fxOf(c), v = fx ? parseInt(fx.slice(1), 16) : 0;
          if (fx?.[0] === 'A' && v) st.ticks = v;
          else if (fx?.[0] === 'T' && v >= 0x20) st.bpm = v;
          if (fx?.[0] === 'A' || (fx?.[0] === 'T' && v >= 0x20)) { rowSpeed = true; if (speedCh < 0) speedCh = c; }
        }
        if (rowSpeed) rowSpeed = frames(st.ticks, st.bpm, say);
        // Flow, as IT resolves it: the rightmost B picks the order, a C alone the next one.
        // The driver gets one jump, on the first channel with a B or C.
        let target = null, flowCh = -1, breaks = false;
        for (let c = 0; c < 3; c++) {
          const fx = fxOf(c), v = fx ? parseInt(fx.slice(1), 16) : 0;
          if (fx?.[0] === 'B') {
            if (v < len) target = v; else say(`B${fx.slice(1)}: no such order`);
          } else if (fx?.[0] === 'C') {
            if (v) say(`C${fx.slice(1)}: breaks continue at row 0`);
            breaks = true;
          } else continue;
          if (flowCh < 0) flowCh = c;
        }
        if (target === null && breaks) target = following;
        if (target === null) flowCh = -1;
        for (let c = 0; c < 3; c++) {
          const e = pat.channels[c]?.[r];
          const cell = e ? convertCell(e, st.ch[c], c === speedCh ? rowSpeed : null, c === flowCh ? map[target] : null, say) : [];
          if (!e?.fx || e.fx[0] !== 'H') st.ch[c].vib = null; // the driver's vibrato stops here
          if (!cell.length) { rest[c]++; continue; }
          flush(c);
          out[c].push(...cell);
          if (!e.note) rest[c] = 1; // prefixes only: a rest ends the row
        }
        if (target !== null && exit === null) {
          exit = structuredClone(st);
          next = target;
          reach = { chunk: chunks.length, lengths: out.map((t) => t.length) };
        }
      }
      for (let c = 0; c < 3; c++) flush(c);
      chunks.push({ rows, tracks: out });
    }
    if (exit === null) { exit = st; next = following; }
    return { chunks, exit, next, reach, speed: entrySpeed(entry) };
  }

  // One row of one channel -> track bytes: effect, instrument, volume, then the note.
  // rowSpeed: the row's frames per row for this channel's A or T, or null to drop it (another
  // channel carries it). jumpTo: the driver order this channel's flow effect jumps to, or null.
  function convertCell(e, st, rowSpeed, jumpTo, say) {
    const bytes = [];
    if (e.instrument != null) st.inst = e.instrument;
    const note = e.note && e.note !== '==' && e.note !== '^^';
    let n = null;
    if (note) {
      if (st.inst === null) { say('a note before any instrument plays instrument 0'); st.inst = 0; }
      n = noteNumber(e.note) - DRIVER_NOTE_OFFSET + transpose[st.inst];
      if (n < 0 || n > 95) { say(`note ${e.note} is outside the driver's C-1..B-8`); n = Math.max(0, Math.min(95, n)); }
    }
    if (e.fx) {
      const L = e.fx[0], v = parseInt(e.fx.slice(1), 16), m = st.mem;
      // A slide or vibrato starts from the row's new note; a portamento from the old one.
      const from = (L === 'G' ? st.note ?? n : n ?? st.note) ?? 48;
      const step = (x) => Math.min(0x7fff, Math.round(x)); // the driver's slides are signed
      let fx = null;
      if (L === 'J') fx = [FX.arp, (m.J = v || m.J)];
      else if (L === 'E' || L === 'F') {
        if (v >= 0xe0) say(`${L}${e.fx.slice(1)}: fine slides are not supported`);
        else fx = [L === 'F' ? FX.up : FX.down, ...word(step((semitone(from) * (m.EF = v || m.EF)) / 16))];
      } else if (L === 'G') {
        fx = [FX.porta, ...word(Math.max(1, step((semitone(from) * (m.G = v || m.G)) / 16)))];
        if (note && e.vol) say('a volume on a G portamento note is ignored (legato notes keep their sustain)');
      } else if (L === 'H') {
        const x = (m.Hx = v >> 4 || m.Hx), y = (m.Hy = v & 15 || m.Hy);
        const vib = [...word(step((semitone(from) * x * y) / 256)), QUARTER[x]];
        // Bit 7 of the period: the vibrato changed under a running one, so it starts over.
        const changed = st.vib !== null && st.vib !== vib.join(',');
        st.vib = vib.join(',');
        fx = [FX.vib, vib[0], vib[1], vib[2] | (changed ? 0x80 : 0)];
      } else if (L === 'A') { if (rowSpeed) fx = [FX.speed, ...rowSpeed]; }
      else if (L === 'T') {
        if (v < 0x20) say('T0x/T1x tempo slides are not supported');
        else if (rowSpeed) fx = [FX.speed, ...rowSpeed];
      } else if (L === 'B' || L === 'C') {
        if (jumpTo !== null) fx = [FX.jump, jumpTo];
      } else say(`effect ${L} is not supported`);
      if (fx) bytes.push(0xb0 | fx[0], ...fx.slice(1));
    }
    if (note && st.inst !== st.sent) { bytes.push(0x80 | st.inst); st.sent = st.inst; }
    if (e.vol) {
      const m = /^v(\d+)$/.exec(e.vol);
      if (!m) say(`volume column ${e.vol[0]}xx is not supported`);
      else if (!note) say('volume changes without a note are not supported');
      else bytes.push(0xa0 | Math.min(15, Math.round((Number(m[1]) * 15) / 64)));
    }
    if (e.note === '==') bytes.push(0x60);
    else if (e.note === '^^') bytes.push(0x61);
    else if (note) {
      bytes.push(n);
      st.note = n;
    }
    return bytes;
  }

  // The speed playback arrives with matters unless the first row sets its own, or nothing plays.
  const arrivalSpeedMatters = (oi) => {
    const pat = song.patterns[song.order[oi]];
    const setsSpeed = [0, 1, 2].some((c) => {
      const fx = pat.channels[c]?.[0]?.fx;
      return fx?.[0] === 'A' || (fx?.[0] === 'T' && parseInt(fx.slice(1), 16) >= 0x20);
    });
    const plays = pat.channels.some((ch) => Object.values(ch || {}).some((e) => e?.note && e.note !== '==' && e.note !== '^^'));
    return plays && !setsSpeed;
  };
  const compiled = new Array(len).fill(null);
  // Two compiles of one order play the same: the same arrival speed (when it matters) and the
  // same bytes up to the row whose jump leaves the order (the rest never plays).
  const played = (c, i, v) => {
    const bytes = c.chunks[i].tracks[v];
    return !c.reach || i < c.reach.chunk ? bytes : bytes.slice(0, c.reach.lengths[v]);
  };
  const same = (oi, a, b) => (a.speed === b.speed || !arrivalSpeedMatters(oi)) && a.chunks.length === b.chunks.length &&
    a.chunks.every((c, i) => (a.reach && i > a.reach.chunk) || c.tracks.every((_, v) => played(a, i, v).join(',') === played(b, i, v).join(',')));
  // The state that can change what an order compiles to.
  const stateKey = (st) => JSON.stringify([st.ticks, st.bpm, st.ch.map(({ sent, ...c }) => c)]);
  // A walk goes on through orders compiled already while it brings a state not seen there before
  // (an order that plays the same can pass a difference on), and ends at a state seen before.
  const seen = new Set();
  const walk = (from, state, how) => {
    for (let oi = from, st = state, steps = 0; steps < 64 * len; steps++) {
      const key = `${oi}|${stateKey(st)}`;
      if (seen.has(key)) return;
      seen.add(key);
      let c = compiled[oi];
      if (!c) c = compiled[oi] = compileOrder(oi, st, warn);
      else {
        c = compileOrder(oi, st, quiet);
        if (!same(oi, compiled[oi], c)) {
          warn(`order ${oi} plays differently ${how} (effect memory, instrument or speed); it is compiled for its first arrival`);
          return;
        }
      }
      how = `after order ${oi}`;
      ({ exit: st, next: oi } = c);
    }
  };
  walk(0, initial(), 'in playback');
  for (const [name, oi] of Object.entries(song.sid.sections ?? {})) walk(oi, initial(), `when section ${name} starts it`);
  for (let oi = 0; oi < len; oi++) if (!compiled[oi]) compiled[oi] = compileOrder(oi, initial(), warn);

  const tracks = [], trackIndex = new Map(), chunks = [], chunkIndex = new Map(), order = [];
  const intern = (list, index, key, value) => {
    if (!index.has(key)) { index.set(key, list.length); list.push(value); }
    return index.get(key);
  };
  for (const c of compiled) for (const chunk of c.chunks) {
    const ids = chunk.tracks.map((bytes) => intern(tracks, trackIndex, bytes.join(','), bytes));
    order.push(intern(chunks, chunkIndex, `${chunk.rows}:${ids}`, { rows: chunk.rows, tracks: ids }));
  }
  if (tracks.length > 256) throw new Error(`${tracks.length} tracks; the driver holds 256`);
  if (chunks.length > 256) throw new Error(`${chunks.length} patterns; the driver holds 256`);
  if (order.length > 255) throw new Error(`order list of ${order.length}; the driver holds 255`);
  return { tracks, chunks, order, loop: map[loop], speed };
}
