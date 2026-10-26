/**
 * Ranged copies of single-cycle loops, so an exported lead is in tune and
 * free of Paula's images (Farstrand, 2026-10-21: "the lead sounds off key").
 *
 * Two things put a MOD lead off key:
 * - ProTracker's periods are whole numbers. Against A-3, G-3 and G#3 are 5.4
 *   and 5.8 cents flat, E-3 4.8, D#3 3.8 and D-3 2.6 sharp (periodCents): a
 *   held note beats against an in-tune bass and chords.
 * - Paula's images. A sample's lower notes play at lower rates, Paula holds
 *   each byte (HRM 05 "Aliasing distortion"), and a loop's images fall
 *   between its harmonics as a shimmer (tools/mod-check.js imageDb).
 * So a single-cycle loop (mod-samples.js singleCycle) is given copies: its
 * note events are grouped so that no note sits more than SPAN semitones under
 * its copy's top, and the period errors of a copy's notes are within
 * TOL_CENTS of each other; planSample then retunes each copy so its notes' errors centre on
 * zero, and renderSample keeps only the harmonics whose images stay above
 * 16 kHz at its lowest note. json2mod narrows a sample's span while a copy
 * still images or that cap takes more than 1% of its energy (KEPT).
 *
 * Which copy a cell plays depends on what its channel played before, so
 * noteUsage walks the song in play order with `selector` and records the copy
 * of every cell; convertCell writes that copy.
 */
import { noteNumber, noteUsage } from './mod-patterns.js';
import { PAL_CLOCK, PERIODS, TOP_NOTE, LOOP_TOL, singleCycle, periodCents } from './mod-samples.js';
import { imageDb, TUNE_CENTS } from './mod-check.js';

export const SPAN = 8;          // semitones a copy reaches under its top: C#3..A-3, every note at 17.6 kHz or more
export const TOL_CENTS = 3;     // spread of the period errors inside one copy (each note within 1.5 cents once centred)
export const MAX_TOL = 4.5;     // the widest spread json2mod allows to stay within 31 samples (each note within 2.25)
export const LOWER = SPAN;      // a copy's top may map this far under A-3 when that tunes its notes better
export const KEPT = 0.99;       // a copy keeps at least this share of its waveform's energy under the harmonic cap
export { LIMIT_DB } from './mod-check.js';

const isNote = (s) => typeof s === 'string' && s !== '==' && s !== '^^';

/**
 * Group note events into copies: [{ top, notes, t }], each copy's top mapped
 * to MOD note TOP_NOTE - t. `units` are the events' note sets (noteUsage
 * events: a note, its arpeggio tones and the notes it glides to), each of
 * which plays on one copy; copies may share notes. A unit wider than `span`
 * can't be split, so its top is chosen for the tuning alone; when `span`
 * was narrowed under SPAN, such a unit keeps its bottom within SPAN if its
 * notes tune there within `near` cents of each other. Returns the groups
 * and, per unit, its group's index.
 */
export function groupNotes(units, span = SPAN, tol = TOL_CENTS, near = MAX_TOL) {
  units = units.map((u) => [...new Set(u)].sort((a, b) => b - a));
  const spread = (top, ns, t) => {
    const errs = ns.map((x) => periodCents(TOP_NOTE - t - (top - x), TOP_NOTE - t));
    return Math.max(...errs) - Math.min(...errs);
  };
  // the offset t under A-3 with the smallest error spread, the highest rate that is good enough
  const best = (top, ns, alone = false) => {
    const width = top - Math.min(...ns), fits = width <= span;
    const search = (limit) => {
      let pick = null;
      for (let t = 0; t <= Math.min(LOWER, TOP_NOTE - width); t++) {
        if (width + t > limit) break;
        const sp = spread(top, ns, t);
        if (!pick || sp < pick.sp - 1e-9) pick = { t, sp };
        if (sp <= tol) break;
      }
      return pick;
    };
    if (fits || !alone) return search(span);
    // a unit wider than a narrowed span (its images, or its cap, are why the
    // span was narrowed) keeps its bottom within SPAN under A-3 when its
    // notes can be tuned there within `near`; else it is placed for its
    // tuning alone
    const within = width <= SPAN ? search(SPAN) : null;
    return within && within.sp <= near ? within : search(Infinity);
  };
  const order = units.map((_, i) => i).sort((a, b) => units[b][0] - units[a][0] || units[b].length - units[a].length);
  const groups = [], of = [];
  for (const i of order) {
    const u = units[i];
    let fit = null;
    for (const [k, g] of groups.entries()) {
      if (u.every((n) => g.notes.includes(n))) { fit = { k, b: { t: g.t } }; break; }
      const top = Math.max(g.top, u[0]), b = best(top, [...new Set([...g.notes, ...u])]);
      if (b && b.sp <= tol && top === g.top) { fit = { k, b }; break; }
    }
    if (fit) {
      const g = groups[fit.k];
      g.notes = [...new Set([...g.notes, ...u])];
      g.t = fit.b.t;
      of[i] = fit.k;
      continue;
    }
    const b = best(u[0], u, true) ?? { t: 0 };
    of[i] = groups.push({ top: u[0], notes: [...u], t: b.t }) - 1;
  }
  return { groups, of };
}

/**
 * The sample a cell plays, given its channel's state { inst: the sample
 * (copy) it holds, note: its IT note } and its cell key:
 * - a note event's cell plays its event's copy (`eventCopy`);
 * - a glide (Gxx), or an instrument with no note (a retrigger, a volume
 *   reset), keeps the copy the channel holds when it is the same
 *   instrument's, so a glide has somewhere to glide from;
 * - otherwise (a row that never plays) the first copy holding the note.
 */
export function selector(eventCopy, noteCopy, origin) {
  return {
    origin,
    select(st, e, key) {
      const orig = e.instrument ?? origin[st.inst];
      if (!noteCopy.has(orig)) return orig;
      if (eventCopy.has(key) && origin[eventCopy.get(key)] === orig) return eventCopy.get(key);
      const note = isNote(e.note) ? noteNumber(e.note) : null;
      if ((note == null || e.fx?.[0] === 'G') && st.inst != null && origin[st.inst] === orig) return st.inst;
      return noteCopy.get(orig).get(note ?? st.note) ?? orig;
    },
  };
}

/**
 * Give each single-cycle loop playing more than one note its copies (`spans`:
 * another span for a sample, by index; `tol`: the spread allowed inside a
 * copy; `usage`: noteUsage(song)). Copy 0 keeps the sample's index, the
 * others are appended. Returns { song, splits: [{ sample, copies: [{ index,
 * notes }] }], sel } (sel null when nothing is split); json2mod keeps the
 * total within 31 samples. `loopTol` is the song's loop tolerance (json2mod
 * modLoopTol): a loop rendered within it adds up to 1200 log2(1 + loopTol)
 * cents to every note, so a placement groupNotes keeps within SPAN must
 * leave that much of mod-check's TUNE_CENTS (a loop cut short by modLoopMax
 * may add more: mod-check judges it).
 */
export function splitLoops(song, spans = new Map(), tol = TOL_CENTS, usage = noteUsage(song), loopTol = LOOP_TOL) {
  const near = Math.min(MAX_TOL, 2 * (TUNE_CENTS - 1200 * Math.log2(1 + loopTol)));
  const { notes, events } = usage, samples = [...song.samples], splits = [];
  const origin = song.samples.map((_, i) => i), eventCopy = new Map(), noteCopy = new Map();
  song.samples.forEach((s, i) => {
    if (!singleCycle(s) || notes[i].size < 2) return;
    const evs = [...events].filter(([, ev]) => ev.inst === i);
    const ids = new Map(), units = [];
    for (const [, ev] of evs) {
      const k = [...ev.notes].sort((a, b) => a - b).join();
      if (!ids.has(k)) ids.set(k, units.push([...ev.notes]) - 1);
    }
    if (!units.length) return;
    const { groups, of } = groupNotes(units, spans.get(i) ?? SPAN, tol, near);
    samples[i] = { ...s, topNote: TOP_NOTE - groups[0].t };
    if (groups.length < 2) return;
    const index = groups.map((g, k) => k ? samples.push({ ...s, name: `${s.name} ${k + 1}`, topNote: TOP_NOTE - g.t }) - 1 : i);
    for (const x of index) origin[x] = i;
    for (const [key, ev] of evs) eventCopy.set(key, index[of[ids.get([...ev.notes].sort((a, b) => a - b).join())]]);
    const first = new Map();
    groups.forEach((g, k) => g.notes.forEach((n) => { if (!first.has(n)) first.set(n, index[k]); }));
    noteCopy.set(i, first);
    splits.push({ sample: i, copies: groups.map((g, k) => ({ index: index[k], notes: [...g.notes].sort((a, b) => a - b) })) });
  });
  return { song: { ...song, samples }, splits, sel: splits.length ? selector(eventCopy, noteCopy, origin) : null };
}

/** The worst image (dB, MOD note) of a rendered resynthesized loop over the IT notes it plays, or null. */
export function worstImage(s, notes) {
  if (!s.used || !s.loopLength || !s.plan.cycles || s.loopStart) return null;
  const y = Array.from(s.data.subarray(0, s.loopLength), (v) => v / 128);
  let worst = null;
  for (const n of notes) {
    const db = imageDb(y, s.plan.cycles, PAL_CLOCK / PERIODS[n - s.plan.off]);
    if (!worst || db > worst.db) worst = { db, note: n };
  }
  return worst;
}
