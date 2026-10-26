/**
 * Heliobane Amiga kit, Worlds 2 and 3: helpers the World 2-3 arrangements
 * (heliobane_<name>_amiga.gen.js for stage6-15, boss_w2, boss_w3,
 * ending_final) use on top of heliobane_amiga.kit.js, which stays as it is.
 * Like that kit it needs nothing outside songs/.
 *
 * - chordChannel: World 3's songs hold their choir chords on three PC
 *   channels (c1 c2 c3). A MOD channel plays one note, so the chord becomes
 *   one note with an arpeggio (Jxy: root, +x, +y), as the PC's own stab
 *   channel plays its chords. It is added to the pattern as an extra
 *   channel, which a lane can then take like any other.
 * - octaveMix: a bass line whose riff part (a power chord) plays with it on
 *   the same pitch class, sometimes in unison and sometimes an octave up,
 *   gets one merged loop per octave (kit mixLoops), and a lane source per
 *   octave that takes only those notes.
 * - silenceEnd: the one-row silent pattern that jumps to itself (a jingle's
 *   or the final ending's end), as clear and intro.
 * - roll, alternate: the snare roll and the riser as the intro's (one
 *   effect per MOD cell).
 * - cut, halfNoise: shorter samples for chip RAM (a one-shot cut and faded;
 *   the white-noise loop's first half, as the intro's).
 * - splitLine: a line wider than one MOD sample plays well, its upper notes
 *   on a second copy of the sample.
 * - keepOnly: a copy of a channel with only some of its notes (a source's
 *   `only` does not keep its channel's other notes out once it holds the
 *   lane).
 * - narrowArps, narrowSongArps: an arpeggio wider than 7 semitones
 *   revoiced within 7 (the same chord tones), so a single-cycle sample
 *   plays it without images; optionally every arpeggio's root moved into
 *   one octave, so the sample needs fewer ranged copies.
 * - splitGlides: a glide that follows a glide starts from a restarted note,
 *   so each glide's notes need only share one copy.
 */
import { mixLoops, oneShot } from './heliobane_amiga.kit.js';
import { nn, ns } from './lib.js';

const isNote = (n) => typeof n === 'string' && n !== '^^' && n !== '==';
const hex = (n) => n.toString(16).toUpperCase();

/**
 * Merge `chs` (PC channel indexes) of pattern `p` into one new channel and
 * return its index. Each row where the sounding chord changes: a new root
 * (the lowest voice) is a note, with Jxy for the two voices above it (each
 * folded down by octaves until it is within 15 semitones); a change of the
 * upper voices only is a new Jxy on the held note. Every row the chord
 * sounds carries its Jxy (a MOD arpeggio lasts one row). The note's volume
 * is the root voice's, times `gain` (three voices sounding together), at
 * most 64. When every voice is cut, the channel is cut.
 */
export function chordChannel(p, chs, { gain = 1.7 } = {}) {
  const out = {}, cur = chs.map(() => null);
  let root = null, fx = null;
  for (let r = 0; r < p.rows; r++) {
    let onset = false;
    chs.forEach((c, k) => {
      const e = p.channels[c]?.[r];
      if (!e?.note) return;
      if (isNote(e.note)) { cur[k] = { note: nn(e.note), inst: e.instrument ?? e._inst ?? cur[k]?.inst, vol: e.vol }; onset = true; }
      else if (e.note === '^^') { cur[k] = null; onset = true; }
    });
    const on = cur.filter(Boolean).sort((a, b) => a.note - b.note);
    if (!on.length) {
      if (root !== null) out[r] = { note: '^^' };
      root = fx = null;
      continue;
    }
    const lo = on[0], up = on.slice(1).map((v) => { let d = v.note - lo.note; while (d > 15) d -= 12; return d; })
      .filter((d) => d > 0).sort((a, b) => a - b);
    const x = up[0] ?? 0, y = up[1] ?? x, j = `J${hex(x)}${hex(y)}`;
    if (onset && lo.note !== root) {
      const v = Number((lo.vol ?? 'v64').slice(1));
      out[r] = { note: ns(lo.note), instrument: lo.inst, vol: `v${Math.min(64, Math.round(v * gain))}`, fx: j };
      root = lo.note;
    } else out[r] = { fx: j };
    fx = j;
  }
  p.channels.push(out);
  return p.channels.length - 1;
}

/**
 * Lane sources for a bass channel whose riff channel plays a power chord on
 * the bass's pitch class: one merged loop (bass + chord `oct` octaves up,
 * kit mixLoops) for each octave the song uses, pushed onto song.samples.
 * Returns (p) => sources, highest first: the merged notes, then the bass
 * alone, then the riff alone (where the bass rests).
 */
export function octaveMix(song, { bass, riff, bassSample, chordSample, chordGain = 0.75, octaves = [0, 1] }) {
  const byName = (n) => song.samples.find((s) => s.name === n);
  const inst = {};
  for (const o of octaves) {
    inst[o] = song.samples.push(mixLoops(`${bassSample} + ${chordSample} ${o ? '+' + o * 12 : 'unison'}`,
      [[byName(bassSample), 0, 1], [byName(chordSample), o, chordGain]])) - 1;
  }
  return (p) => {
    const diff = (r, e) => {
      const g = p.channels[riff][r]?.note;
      if (!isNote(g) || !isNote(e.note)) return null;
      const d = nn(g) - nn(e.note);
      return d % 12 === 0 ? d / 12 : null;
    };
    return [
      ...octaves.map((o) => ({ ch: bass, inst: inst[o], only: (r, e) => diff(r, e) === o })),
      { ch: bass },
      { ch: riff },
    ];
  };
}

/** A silent one-row pattern whose B jumps to itself (order `at`). */
export const silenceEnd = (at) => ({ name: 'end: silence', rows: 1, channels: [{ 0: { fx: `B${hex(at).padStart(2, '0')}` } }, {}, {}, {}] });

/**
 * A snare roll whose notes carry a rising volume and a retrig (Qxy): a MOD
 * cell holds one, so (as the intro's scene 7) the first half plays the
 * whole rise in 16ths and the second half retrigs at the level the rise
 * reached. Those notes carry no sample number, so the channel keeps that
 * level and the cell is free for E9x. Rows of the lane that are not the
 * roll's (no Qxy) are left alone.
 */
export function roll(ch, from, to) {
  const half = from + Math.floor((to - from) / 2), src = { ...ch };
  const isRoll = (r) => /^Q/.test(src[r]?.fx ?? '');
  let vol;
  for (let r = from; r < half; r++) {
    if (!isRoll(r)) continue;
    const { fx, ...e } = src[r];
    vol = src[from + 2 * (r - from)]?.vol ?? e.vol;
    ch[r] = { ...e, vol };
  }
  for (let r = half; r < to; r++) if (isRoll(r)) ch[r] = { note: src[r].note, vol: vol ?? src[r].vol, fx: src[r].fx };
}

/**
 * A riser or a fall (a note whose following rows each carry a volume step
 * and an E/F slide): a MOD cell holds one, so (as the intro's riser) the
 * rows alternate, volume on odd rows, the slide twice as steep on even rows
 * (the same total slide). Only rows the lane took from `src` are changed.
 */
export function alternate(ch, src) {
  const rows = Object.keys(src).map(Number).sort((a, b) => a - b);
  let k = 0, prev = -2;
  for (const r of rows) {
    const e = src[r];
    const mine = e.vol && /^[EF]/.test(e.fx ?? '') && !e.note && ch[r]?.fx === e.fx && !ch[r]?.note;
    if (!mine) { prev = -2; continue; }
    k = r === prev + 1 ? k + 1 : 0;
    prev = r;
    if (k % 2) ch[r] = { vol: e.vol };
    else ch[r] = { fx: e.fx[0] + Math.min(255, 2 * parseInt(e.fx.slice(1), 16)).toString(16).toUpperCase().padStart(2, '0') };
  }
}

/** A one-shot cut to `seconds`, faded over its last `fade` (kit oneShot). */
export const cut = (seconds, fade) => (d) => oneShot(d, { seconds, fade });

/** The white-noise loop's first half (noise: any seam is noise), as the intro's. */
export function halfNoise(d) {
  const n = Math.round(d.channels[0].length / 2);
  return { ...d, channels: d.channels.map((c) => c.slice(0, n)), loop: { start: 0, end: n } };
}

/**
 * A line wider than one MOD sample plays well (a MOD sample spans 3
 * octaves, and json2mod resamples it so its highest note fits: a bell from
 * F-5 to C-8 would play its low notes from a few kHz): the notes from
 * `at` up play a second copy of the sample. Returns the lane sources for
 * channel `ch`, the high notes first; they never hold the lane against the
 * low ones (hold 0), so the line stays one line.
 */
export function splitLine(song, ch, sample, at, extra = {}) {
  const i = song.samples.findIndex((x) => x.name === sample);
  const hi = song.samples.push({ ...song.samples[i], name: `${sample} hi` }) - 1;
  return [
    { ch, inst: hi, hold: 0, only: (r, e) => nn(e.note) >= at, ...extra },
    { ch, ...extra },
  ];
}

/**
 * A copy of channel `ch` of pattern `p` with only the notes `keep(e)`
 * accepts (and their later rows), added as an extra channel; returns its
 * index. A lane source's `only` skips a note, but once that source holds
 * the lane, its channel's next note comes through as one of its later
 * rows: a copy without the other notes keeps them out.
 */
export function keepOnly(p, ch, keep) {
  const out = {};
  let on = false;
  for (const [r, e] of Object.entries(p.channels[ch]).sort((a, b) => a[0] - b[0])) {
    if (isNote(e.note)) on = keep(e);
    if (on) out[r] = e;
  }
  p.channels.push(out);
  return p.channels.length - 1;
}

/**
 * Revoice each arpeggio (Jxy) wider than `span` semitones on lane `ch` (a
 * post() lane, or a channel of arrange's output) within `span`, for the
 * notes `keep(e, instrument)` accepts: the note moves to the nearest chord
 * tone (the lower one on a tie) that puts the other two within `span` above
 * it, and the arpeggios on the rows it sounds on follow it. A MOD arpeggio
 * plays from one sample, so its root sits as far under its top as the chord
 * is wide; json2mod maps a copy's top to A-3 or up to a semitone under it for
 * tuning, so on a single-cycle sample a root 8 or more semitones down can
 * play at 16.6 kHz or less, and its images fall under 16 kHz (mod-check;
 * cozy-tracker docs/handoff-2026-10-22-mod-tuning.md). With `window` ([lo,
 * hi] note numbers), every arpeggio's root goes into it the same way (the
 * nearest voicing, octaves included), so the notes span less and json2mod
 * needs fewer ranged copies (a song at MOD's 31 samples). The chord keeps its
 * tones; the arpeggio's order and register change. A note-off (==) leaves
 * the note sounding (sample mode, json2mod); a cut (^^) ends it. J00 is left
 * as it is (narrowSongArps refuses a channel where it could recall a
 * revoiced arpeggio).
 * Returns the notes revoiced and the rows left: an arpeggio wider than
 * `span` over a note that didn't move (one with no arpeggio of its own), or
 * whose instrument the lane doesn't say; a later arpeggio the moved note
 * isn't a tone of or that doesn't fit `span` over it; a chord with no voicing
 * that fits (all its tones one pitch class: J0C). A moved note that sounds
 * on with no arpeggio (a volume fade, an empty row) is restarted there at
 * its own pitch (`restarted`), so it doesn't play the moved note plain.
 * `rows`: the lane's length (empty rows count too). `open` says a moved note
 * still sounds at the lane's end.
 */
export function narrowArps(ch, keep = () => true, { span = 7, window = null, rows = null } = {}) {
  // effects are read in upper case (the validator takes lower-case hex too)
  const isJ = (fx) => /^J[0-9A-F]{2}$/.test(fx ?? '') && fx !== 'J00';
  const tones = (fx) => [0, parseInt(fx[1], 16), parseInt(fx[2], 16)];
  const wide = (fx) => isJ(fx) && Math.max(...tones(fx)) > span;
  const outside = (n) => window && (n < window[0] || n > window[1]);
  const pcs = (fx, d) => [...new Set(tones(fx).map((t) => (((t - d) % 12) + 12) % 12))];
  // fx's tones over the note moved by d, as Jxy; null when the moved note
  // isn't one of them, or the chord is one pitch class (J00 would recall)
  const jOf = (fx, d) => {
    const set = pcs(fx, d);
    if (!set.includes(0)) return null;
    const up = set.filter((t) => t).sort((a, b) => a - b);
    return up.length && Math.max(...up) <= span ? 'J' + hex(up[0]) + hex(up[1] ?? up[0]) : null;
  };
  const out = { moved: 0, restarted: 0, left: 0, open: false };
  let base = null, d = 0, mine = false, inst = null;
  const n = rows ?? Math.max(-1, ...Object.keys(ch).map(Number)) + 1;
  for (let r = 0; r < n; r++) {
    const e0 = ch[r] ?? {}, e = e0.fx ? { ...e0, fx: e0.fx.toUpperCase() } : e0;
    if (e.instrument != null) inst = e.instrument;
    if (e.note === '^^') { base = null; d = 0; mine = false; continue; }
    if (isNote(e.note) && e.note !== '==') {
      if (base !== null && mine && d && /^G/.test(e.fx ?? '')) out.left++;   // it would glide from the moved pitch
      base = nn(e.note); d = 0; mine = inst !== null && keep(e, inst);
      if (inst === null && (wide(e.fx) || (window && isJ(e.fx)))) { out.left++; continue; }
      if (!mine || !isJ(e.fx) || (!wide(e.fx) && !outside(base))) continue;
      const opts = [];
      for (const k of tones(e.fx)) for (let o = -36; o <= 36; o += 12) {
        const dd = k + o;
        if (jOf(e.fx, dd) && !outside(base + dd) && base + dd >= 0 && base + dd <= 119 && (window || o === 0 || o === -12)) opts.push(dd);
      }
      if (!opts.length) { out.left++; continue; }
      d = [...new Set(opts)].sort((a, b) => Math.abs(a) - Math.abs(b) || a - b)[0];
      ch[r] = { ...e, note: ns(base + d), fx: jOf(e.fx, d) };
      out.moved++;
    } else if (base !== null && mine && d) {          // the moved note sounds on
      if (isJ(e.fx)) {
        const j = jOf(e.fx, d);
        if (j) ch[r] = { ...e, fx: j };
        else out.left++;
      } else if (e.fx === 'J00' || /^G/.test(e.fx ?? '')) out.left++;   // a recall; a restart that would glide
      else { ch[r] = { ...e, note: ns(base) }; d = 0; out.restarted++; }   // plain from here: the note's own pitch
    } else if (base !== null && mine && wide(e.fx)) out.left++;   // a wide arpeggio over a note that didn't move
  }
  out.open = base !== null && d !== 0;
  return out;
}

/**
 * narrowArps on every channel of an arranged song (arrange's output), for the
 * notes whose sample's name matches `re`; returns the song. Each pattern is
 * voiced on its own, so a channel that revoices a note refuses what another
 * pattern or the effect memory could carry into it: an arpeggio on a
 * pattern's rows before its first note or cut (a note carried over from
 * whatever played before), J00 (it recalls the last arpeggio, which may be a
 * revoiced one), and a pattern that ends with a revoiced note sounding
 * into the next pattern played (the next order, a Bxx's on the last row, the
 * wrap to order 0 after the last) when that pattern doesn't start with a
 * note or cut (a note that glides or waits, Gxx or SDx, doesn't count). It
 * refuses any jump or break before a pattern's last row, a break into a
 * later row (Cxx, xx > 0), a pattern loop (SBx), a note delay (SDx) in the
 * channel, and a speed under 3 ticks (the song's or an Axx: an arpeggio then
 * plays only some of its tones, and a revoiced one other tones). Those and
 * every row narrowArps leaves throw: the generator must voice them.
 */
export function narrowSongArps(song, re, opts = {}) {
  const keep = (e, inst) => re.test(song.samples[inst]?.name ?? '');
  const left = [], moved = new Set(), carried = [], open = new Map();
  // a pattern that starts with a cut, or a note that neither glides nor waits
  const starts = (ch) => ch[0]?.note === '^^' ||
    (isNote(ch[0]?.note) && ch[0].note !== '==' && !/^(G|SD)/i.test(ch[0].fx ?? ''));
  song.patterns.forEach((p, pi) => p.channels.forEach((ch, c) => {
    let first = true;
    for (const r of Object.keys(ch).map(Number).sort((a, b) => a - b)) {
      const e = { ...ch[r], fx: ch[r].fx?.toUpperCase() };
      if (e.fx === 'J00') carried.push([c, `${p.name} row ${r}: J00`]);
      if (/^SD/.test(e.fx ?? '')) carried.push([c, `${p.name} row ${r}: ${e.fx}, a note delay`]);
      if (/^SB/.test(e.fx ?? '')) carried.push([-1, `${p.name} row ${r}: ${e.fx}, a pattern loop`]);
      if (first && /^J/.test(e.fx ?? '') && !(isNote(e.note) && e.note !== '==')) carried.push([c, `${p.name} row ${r}: an arpeggio before the pattern's first note`]);
      if (e.note === '^^' || (isNote(e.note) && e.note !== '==')) first = false;
    }
    const n = narrowArps(ch, keep, { ...opts, rows: p.rows });
    if (n.left) left.push(`${p.name} channel ${c}: ${n.left} row(s) left`);
    if (n.moved) moved.add(c);
    if (n.open) open.set(`${pi},${c}`, true);
  }));
  if ((song.ticks ?? 6) < 3) carried.push([-1, `speed ${song.ticks}: an arpeggio plays only some of its tones`]);
  // a revoiced note sounding at a pattern's end plays on, plain, into the
  // next pattern played (the next order, a Bxx's on the last row, order 0
  // after the last: json2mod's playback wraps) unless it starts with a note
  // or a cut; a jump or break before the last row, or into a later row, is refused
  song.order.forEach((pi, o) => {
    const p = song.patterns[pi];
    let next = song.order[(o + 1) % song.order.length];
    p.channels.forEach((ch) => Object.entries(ch).forEach(([r, e]) => {
      const fx = (e.fx ?? '').toUpperCase();
      if (/^A0[0-2]$/.test(fx) && fx !== 'A00') carried.push([-1, `${p.name} row ${r}: ${fx}, a speed under 3 ticks`]);
      if (!/^[BC]/.test(fx)) return;
      if (Number(r) !== p.rows - 1) carried.push([-1, `${p.name} row ${r}: a jump or break before the pattern's end`]);
      if (fx[0] === 'C' && fx !== 'C00') carried.push([-1, `${p.name} row ${r}: ${fx}, a break into a later row`]);
      if (fx[0] === 'B') next = song.order[parseInt(fx.slice(1), 16)] ?? next;
    }));
    p.channels.forEach((_, c) => {
      if (open.has(`${pi},${c}`) && !starts(song.patterns[next].channels[c] ?? {}))
        carried.push([c, `${p.name} ends with a revoiced note sounding into ${song.patterns[next].name}`]);
    });
  });
  for (const [c, why] of carried) if (c < 0 ? moved.size : moved.has(c)) left.push(c < 0 ? why : `channel ${c} revoices notes, and ${why}`);
  if (left.length) throw new Error(`arpeggios left unvoiced: ${left.join('; ')}`);
  return song;
}

/**
 * A glide (Gxx) that follows another glide with no note between them: the
 * row before it restarts the note the first glide reached, with the lane's
 * instrument and volume (the row's effect, such as a vibrato, gives way to
 * the volume in the MOD). json2mod plays a glide's notes from one ranged
 * copy, so a chain of glides puts all its notes in one copy, which
 * ProTracker's periods may not tune within 3 cents (the shop's wolf whistle
 * G-5 D-6 G#5: 6.4 cents apart at best); restarted, each glide is a copy of
 * its own. Lane `ch` is a post() lane; `speed` (ticks a row, or a function
 * of the row: the shop's swing) says how far a glide gets: IT's Gxx moves
 * xx/16 semitone on each tick but a row's first, and json2mod's MOD glide a
 * step of period units worked out at each row's period (a lower bound of it
 * here); both must get there. When the first glide
 * can't be shown to have reached its note by the restart (the restart would
 * jump), it throws, or with `keepShort` leaves the rest of that chain as it
 * is (where it sounds is no longer known). It
 * throws when the row the restart goes on still glides.
 */
export function splitGlides(ch, { speed = 6, keepShort = false } = {}) {
  const ticks = typeof speed === 'function' ? speed : () => speed;
  // at: the note the lane's last glide went to (or its last note); from: where that glide
  // started; gone: the semitones it moved (IT's units: json2mod's MOD glide is checked by
  // tests/heliobane-amiga-kit.test.js on the songs that use this); lost: where the lane
  // sounds isn't known (a kept short glide, another pitch effect) until a fresh note; vol:
  // the volume in effect: null when it is the sample's (an instrument resets it), '?' when a
  // relative step (not vNN) left it unknown
  // entry: no note or cut yet in this lane: whatever played before may still sound (a glide
  // carried in from the last pattern), so a glide here starts from an unknown pitch
  let inst = null, at = null, from = null, vol = null, glided = false, gone = 0, rate = 0, lost = false, entry = true;
  // json2mod's MOD glide (mod-patterns.js `slide`, effect G): each row, a step of
  // round(|p - p 2^(-+units/192)|) period units from the row's period p, at most 255, on each
  // tick but the first. In periods relative to the glide's start (P from 1 toward T), less half
  // a unit at the smallest period (113) for the rounding, and at most 255 units of the largest
  // start period (856): a lower bound of how far the MOD gets.
  let P = 1, T = 1;
  const modStep = (r) => {
    const up = T < P, k = Math.abs(1 - 2 ** ((up ? -rate : rate) / 192));
    const d = Math.min(255 / 856, Math.max(0, P * (k - 0.5 / 113))) * (ticks(r) - 1);
    P = up ? Math.max(T, P - d) : Math.min(T, P + d);
  };
  // effects that move the pitch other than by the glide (slides, glide + volume slide, the S
  // effects: a note cut or delay among them), and effects that move the channel's volume
  const pitchFx = (fx) => /^[EFLS]/i.test(fx ?? ''), volFx = (fx) => /^[DKLMNR]/i.test(fx ?? '');
  const level = (e, v) => (volFx(e.fx) ? '?' : e.vol ? (/^v\d+$/.test(e.vol) ? e.vol : '?') : v);
  for (const r of Object.keys(ch).map(Number).sort((a, b) => a - b)) {
    const e = ch[r];
    const g = /^G([0-9A-F]{2})$/i.exec(e.fx ?? '');
    const other = e.instrument != null && inst != null && e.instrument !== inst;
    // a cut ends the note; a note-off (==) doesn't (sample mode, json2mod): its row is a row without a note
    if (e.note === '^^' || !isNote(e.note) || e.note === '==') {
      if (g && parseInt(g[1], 16)) rate = parseInt(g[1], 16);      // IT's Gxx memory
      if (e.instrument != null) { inst = e.instrument; vol = level(e, null); } else vol = level(e, vol);
      if (e.note === '^^') { glided = false; lost = false; entry = false; at = from = null; continue; }
      if (glided && g) { gone += rate / 16 * (ticks(r) - 1); modStep(r); }
      else if (at !== null && pitchFx(e.fx)) lost = true;          // a pitch effect this doesn't follow
      continue;
    }
    // a glide after a glide, on the same sample: did the first get there? (the restart goes on
    // row r - 1 with the instrument and volume in effect there, before this row's)
    if (g && !other && at !== null && glided) {
      const short = lost || vol === '?' || gone < Math.abs(nn(at) - nn(from)) || Math.abs(P - T) > 1e-12;
      if (short && !keepShort) throw new Error(`splitGlides: the glide to ${at} can't be shown to get there by row ${r - 1}`);
      if (short) lost = true;
      else if (r > 0 && !ch[r - 1]?.note) {
        if (/^G/i.test(ch[r - 1]?.fx ?? '')) throw new Error(`splitGlides: row ${r - 1} still glides; a restart there would glide on`);
        ch[r - 1] = { ...(ch[r - 1] ?? {}), note: at, instrument: inst, ...(vol ? { vol } : {}) };
      }
    }
    if (g && parseInt(g[1], 16)) rate = parseInt(g[1], 16);
    if (e.instrument != null) { inst = e.instrument; vol = level(e, null); } else vol = level(e, vol);
    // a fresh note: no glide, a glide onto another sample (json2mod plays it outright), or nothing before it
    if (g && !other && at === null && entry) {     // a glide from whatever the pattern was entered with
      glided = true; lost = true; entry = false; from = null; at = e.note; gone = 0;
      continue;
    }
    entry = false;
    if (!g || other || at === null) { glided = false; lost = pitchFx(e.fx); from = at = e.note; continue; }
    from = at;
    at = e.note;
    glided = true;
    gone = rate / 16 * (ticks(r) - 1);
    P = 1;
    T = 2 ** ((nn(from) - nn(at)) / 12);
    modStep(r);
  }
}
