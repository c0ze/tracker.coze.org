#!/usr/bin/env node
/**
 * Zork — "Underworld". An adaptive score for the Zork trilogy web port
 * (zork.coze.org), by Claude Opus 5.5, 2026-09-24. Dark and foreboding by brief:
 * minor/phrygian keys, low registers, slow tempos, tolling bells, no major-key lift.
 *
 * One module, five region sections that loop themselves (Bxx on their last row)
 * and five approach bridges, `to_<region>`, that jump into their destination.
 * Grid everywhere: speed 6, 4 rows/beat, 16 rows/bar, 32-row patterns (2 bars),
 * so a region change waits at most one short pattern.
 *
 *   above_ground  D minor, 80 BPM (6.0 s/pattern). "West of House": a lonely folk
 *                 lament on a pulse over Dm Bb | Gm A | Dm C | Bb A; half-cadence
 *                 C# under an F appoggiatura. Echo only on held cadence notes.
 *   underground   A phrygian, 66 BPM (7.3 s). Organ pedal A, upper drone sinks
 *                 E F | Bb(!) G | F E; a pitched heartbeat, cave drips + 5-row echo,
 *                 thin-pulse sighs A C Bb A.
 *   peril         E phrygian, 140 BPM (3.4 s). Chromatic 8th ostinato (root, b2, b7),
 *                 Em F | Em Bb | C B, syncopated J stabs, a breakdown wail on b6-5.
 *   wonder        B minor, 88 BPM (5.5 s). Canon shimmer over Bm G | C(bII) F# | Em F#;
 *                 hollow triangle lead; the Neapolitan C keeps awe from turning bright.
 *   dread         C minor, 56 BPM (8.6 s). Tolling bells with a minor tierce, C/G organ
 *                 that grinds to Db then F#; the Dies irae (public-domain chant) and a
 *                 chromatic lament; a slow heartbeat off the bell.
 *   to_<region>   One pattern. Whatever was playing dissolves over four rows, a bell
 *                 tolls the destination's dominant, a drone swells on it and a thin
 *                 pulse sighs 5-b6-5; tempo steps (ramps into peril, slows into dread).
 */
import { writeSong, up } from './lib.js';
import { phrase, slice, join, echoChannel } from './opus55.js';
import { I, SAMPLES, ROLES, pattern, dissolve, hold, strikes, hex2 } from './zork.kit.js';

const R = 32;
const P = (events, inst, o = {}) => phrase(events, inst, { rows: R, ...o });
const drone = (events) => P(events, I.drone, { sustain: 1, release: 1, name: 'drone' });
const stabs = (list) => P(list.map(([r, n, j, v]) => [r, n, 2, v, j]), I.stab, { sustain: 0.5, name: 'stab' });
const cadenceEcho = (lead, from, to = R) => echoChannel(slice(lead, from, to), { delay: 3, scale: 0.4, rows: R, inst: I.thin });
const each = (bars, fn) => bars.flatMap((c, b) => fn(c, b * 16));

// ---- above_ground: D minor lament --------------------------------------------
const AG = { Dm: ['D-3', 'A-3', 'A-4', 'J58'], Bb: ['A#2', 'F-3', 'A#4', 'J47'], Gm: ['G-2', 'D-3', 'A#4', 'J49'],
  A: ['A-2', 'E-3', 'A-4', 'J47'], C: ['C-3', 'G-3', 'G-4', 'J59'] };
function agBass(bars, approaches) {
  return P(each(bars, (c, s) => {
    const a = approaches[s / 16];
    const ev = [[s, AG[c][0], 8, 34], [s + 8, AG[c][1], a ? 6 : 8, 26]];
    if (a) ev.push([s + 14, a, 2, 22]);
    return ev;
  }), I.bass, { sustain: 0.8, name: 'ag bass' });
}
const agStabs = (bars) => stabs(each(bars, (c, s) => [[s + 4, AG[c][2], AG[c][3], 14], [s + 12, AG[c][2], AG[c][3], 12]]));
const agLead = (ev) => P(ev, I.lead, { vib: 'H32', vibDelay: 3, name: 'ag lead' });
const heartbeat = (list) => strikes(list, I.kick);
const hats = (rows, vol) => Object.fromEntries(rows.map((r) => [r, { note: 'C-5', instrument: I.hat, vol: `v${vol}`, fx: 'SC2' }]));
const offbeats = [2, 6, 10, 14, 18, 22, 26, 30];

const AG_LEAD = [
  [[2, 'A-4', 2, 34], [4, 'D-5', 4, 38], [8, 'E-5', 2, 32], [10, 'F-5', 6, 38], [16, 'G-5', 2, 34], [18, 'E-5', 2, 32], [20, 'F-5', 4, 34], [24, 'D-5', 8, 36]],
  [[2, 'A-4', 2, 32], [4, 'D-5', 4, 36], [8, 'E-5', 2, 32], [10, 'F-5', 2, 34], [12, 'G-5', 4, 38], [16, 'F-5', 2, 34], [18, 'E-5', 2, 32], [20, 'C#5', 8, 36]],
  [[2, 'A-4', 2, 34], [4, 'D-5', 4, 38], [8, 'E-5', 2, 32], [10, 'F-5', 6, 38], [16, 'A-5', 4, 40], [20, 'G-5', 2, 34], [22, 'F-5', 2, 32], [24, 'E-5', 8, 36]],
  [[0, 'D-5', 4, 36], [4, 'F-5', 2, 34], [6, 'E-5', 2, 32], [8, 'D-5', 4, 34], [12, 'A#4', 4, 30], [16, 'E-5', 4, 36], [20, 'C#5', 4, 32], [24, 'A-4', 6, 34]],
].map(agLead);
const agPattern = (name, bars, approaches, extra = {}) => pattern(name, R, {
  bass: agBass(bars, approaches), padA: agStabs(bars), padB: name === 'above: intro' ? drone([[0, 'D-4', 32, 9]]) : hold(9), kit: heartbeat([[0, 'C-5', 22], [16, 'C-5', 20]]), ...extra,
}, { tempo: 80 });
const aboveGround = [
  agPattern('above: intro', ['Dm', 'Bb'], [null, 'C-3']),
  agPattern('above: lament', ['Dm', 'Bb'], ['C-3', 'A-2'], { lead: AG_LEAD[0], echo: cadenceEcho(AG_LEAD[0], 24) }),
  agPattern('above: half cadence', ['Gm', 'A'], ['G#2', 'C#3'], { lead: AG_LEAD[1], echo: cadenceEcho(AG_LEAD[1], 20, 28),
    kit: heartbeat([[0, 'C-5', 22], [16, 'C-5', 20], [28, 'C-5', 16], [30, 'C-5', 24]]) }),
  agPattern('above: reach', ['Dm', 'C'], [null, 'B-2'], { lead: AG_LEAD[2], echo: cadenceEcho(AG_LEAD[2], 24), metal: hats(offbeats, 5) }),
  agPattern('above: fall', ['Bb', 'A'], [null, 'C#3'], { lead: AG_LEAD[3], echo: cadenceEcho(AG_LEAD[3], 24, 30), metal: hats(offbeats, 5),
    kit: heartbeat([[0, 'C-5', 22], [16, 'C-5', 20], [28, 'C-5', 16], [30, 'C-5', 24]]) }),
];

// ---- underground: A phrygian cave --------------------------------------------
const ugBass = (roots) => P(each(roots, (n, s) => [[s, n, 2, 36], [s + 3, n, 2, 24]]), I.bass, { sustain: 0.6, name: 'ug heart' });
const drips = (list) => strikes(list, I.drip);
const cave = (list) => ({ metal: drips(list), echo: echoChannel(drips(list), { delay: 5, scale: 0.4, rows: R }) });
const ugLead = (ev) => P(ev, I.thin, { vib: 'H32', vibDelay: 3, name: 'ug lead' });
const underground = [
  pattern('under: pedal', R, { padA: drone([[0, 'A-3', 32, 18]]), padB: drone([[0, 'E-4', 32, 12]]), bass: ugBass(['A-2', 'A-2']),
    kit: strikes([[0, 'A-4', 22]], I.tom), ...cave([[5, 'E-6', 18], [19, 'A-6', 14], [27, 'C-7', 10]]) }, { tempo: 66 }),
  pattern('under: sigh', R, { padA: hold(18), padB: join(hold(12), drone([[16, 'F-4', 16, 12]])), bass: ugBass(['A-2', 'A-2']),
    lead: ugLead([[4, 'A-4', 8, 30], [14, 'C-5', 2, 28], [16, 'A#4', 6, 30], [24, 'A-4', 6, 26]]),
    ...cave([[3, 'C-7', 12], [14, 'E-6', 16], [25, 'B-5', 14]]) }, { tempo: 66 }),
  pattern('under: the flat second', R, { padA: hold(18), padB: drone([[0, 'A#3', 16, 11], [16, 'G-4', 16, 11]]), bass: ugBass(['A#2', 'A-2']),
    lead: ugLead([[0, 'E-5', 4, 32], [4, 'F-5', 4, 34], [8, 'E-5', 2, 30], [10, 'D-5', 2, 28], [12, 'C-5', 4, 30], [16, 'D-5', 4, 30], [20, 'C-5', 4, 28], [24, 'A#4', 6, 30]]),
    kit: strikes([[0, 'G-4', 26]], I.tom), ...cave([[9, 'A#5', 14], [22, 'E-6', 12]]) }, { tempo: 66 }),
  pattern('under: settle', R, { padA: hold(18), padB: drone([[0, 'F-4', 16, 12], [16, 'E-4', 16, 12]]), bass: ugBass(['A-2', 'A-2']),
    lead: ugLead([[0, 'A-4', 4, 28], [4, 'C-5', 2, 28], [6, 'A#4', 2, 26], [8, 'A-4', 10, 30], [22, 'E-4', 8, 24]]),
    ...cave([[6, 'A-6', 14], [17, 'G-6', 12], [29, 'E-6', 10]]) }, { tempo: 66 }),
];

// ---- peril: E phrygian chase ---------------------------------------------------
const PR = { Em: ['E-3', 'B-4', 'J58'], F: ['F-3', 'A-4', 'J38'], Bb: ['A#2', 'A#4', 'J47'], C: ['C-3', 'G-4', 'J59'], B: ['B-2', 'B-4', 'J47'] };
const OST = [[0, 40], [0, 26], [1, 34], [0, 26], [0, 36], [12, 28], [-2, 30], [0, 24]]; // root, root, b2, root, root, 8ve, b7, root

const prBass = (bars) => P(each(bars, (c, s) => OST.map(([k, v], i) => [s + 2 * i, up(PR[c][0], k), 2, v])), I.bass, { sustain: 0.6, name: 'pr bass' });
const prStabs = (bars) => stabs(each(bars, (c, s) => [[s + 3, PR[c][1], PR[c][2], 18], [s + 10, PR[c][1], PR[c][2], 16]]));
function prKit(fill = false) {
  const ev = [];
  for (const s of [0, 16]) ev.push([s, 'C-5', 36, I.kick], [s + 4, 'C-5', 28, I.snare], [s + 6, 'C-5', 24, I.kick], [s + 8, 'C-5', 34, I.kick], [s + 12, 'C-5', 30, I.snare]);
  const out = {};
  for (const [r, n, v, inst] of ev) if (!(fill && r >= 28)) out[r] = { note: n, instrument: inst, vol: `v${v}` };
  if (fill) [[28, 18], [29, 22], [30, 26], [31, 30]].forEach(([r, v]) => { out[r] = { note: 'C-5', instrument: I.snare, vol: `v${v}` }; });
  return out;
}
const prLead = (ev, vib = 'H44') => P(ev, I.lead, { vib, vibDelay: 4, name: 'pr lead' });
const PR_LEAD = {
  one: prLead([[0, 'B-4', 2, 36], [2, 'C-5', 2, 34], [4, 'B-4', 4, 38], [10, 'G-4', 2, 32], [12, 'A#4', 2, 32], [14, 'B-4', 2, 34], [16, 'C-5', 4, 38], [20, 'A-4', 2, 32], [22, 'C-5', 2, 34], [24, 'A-4', 8, 36]]),
  two: prLead([[0, 'E-5', 3, 40], [3, 'F-5', 1, 36], [4, 'E-5', 2, 36], [6, 'D-5', 2, 32], [8, 'C-5', 2, 32], [10, 'B-4', 6, 36], [16, 'D-5', 4, 38], [20, 'F-5', 4, 40], [24, 'D-5', 8, 36]]),
  three: prLead([[0, 'E-5', 4, 38], [4, 'G-5', 4, 40], [8, 'E-5', 4, 36], [12, 'C-5', 4, 32], [16, 'D#5', 4, 38], [20, 'F#5', 4, 40], [24, 'B-4', 6, 36]]),
  wail: prLead([[0, 'B-4', 14, 34], [16, 'C-5', 6, 32], [22, 'B-4', 8, 30]]),
};
const prPattern = (name, bars, extra = {}) => pattern(name, R, {
  bass: prBass(bars), padA: prStabs(bars), kit: prKit(), metal: hats(offbeats, 10), ...extra }, { tempo: 140 });
const PR1 = prPattern('peril: the blade', ['Em', 'F'], { lead: PR_LEAD.one, echo: cadenceEcho(PR_LEAD.one, 24) });
const PR2 = prPattern('peril: tritone', ['Em', 'Bb'], { lead: PR_LEAD.two });
const PR3 = prPattern('peril: to the dominant', ['C', 'B'], { lead: PR_LEAD.three, kit: prKit(true),
  echo: echoChannel(PR_LEAD.three, { delay: 0, scale: 0.55, semi: -12, inst: I.thin, rows: R }) }); // octave below, final phrase only
const peril = [
  prPattern('peril: ostinato', ['Em', 'Em']),
  PR1, PR2, PR3,
  pattern('peril: breakdown', R, { bass: P([[0, 'E-3', 15, 34], [16, 'E-3', 15, 30]], I.bass, { sustain: 0.8 }), padB: drone([[0, 'B-3', 32, 14]]),
    lead: PR_LEAD.wail, kit: strikes([[0, 'C-5', 30], [8, 'A-4', 26], [16, 'G-4', 28], [24, 'E-4', 30]], I.tom) }, { tempo: 140 }),
  PR1, PR2, PR3,
];

// ---- wonder: B minor canon shimmer ---------------------------------------------
const WO = {
  Bm: ['B-2', ['B-4', 'D-5', 'F#5', 'B-5', 'C#6', 'B-5', 'F#5', 'D-5']],
  G: ['G-2', ['G-4', 'B-4', 'D-5', 'F#5', 'G-5', 'F#5', 'D-5', 'B-4']],
  C: ['C-3', ['C-5', 'E-5', 'G-5', 'B-5', 'C-6', 'B-5', 'G-5', 'E-5']],
  F: ['F#3', ['F#4', 'A#4', 'C#5', 'E-5', 'F#5', 'E-5', 'C#5', 'A#4']],
  Em: ['E-3', ['E-5', 'G-5', 'B-5', 'D-6', 'E-6', 'D-6', 'B-5', 'G-5']],
};
const UNDER = { // plain triads an octave below, played while the lead sings
  Bm: ['B-3', 'D-4', 'F#4', 'B-4', 'F#4', 'D-4', 'B-3', 'F#4'], G: ['G-3', 'B-3', 'D-4', 'G-4', 'D-4', 'B-3', 'G-3', 'D-4'],
  C: ['C-4', 'E-4', 'G-4', 'C-5', 'G-4', 'E-4', 'C-4', 'G-4'], F: ['F#3', 'A#3', 'C#4', 'F#4', 'C#4', 'A#3', 'F#3', 'C#4'],
  Em: ['E-4', 'G-4', 'B-4', 'E-5', 'B-4', 'G-4', 'E-4', 'B-4'],
};
const shimmerLine = (bars, under) => P(each(bars, (c, s) => Array.from({ length: 16 }, (_, i) =>
  [s + i, (under ? UNDER[c] : WO[c][1])[i % 8], 1, Math.round((i % 8 === 0 ? 14 : 10) * (under ? 0.8 : 1))])), I.thin, { name: 'shimmer' });
function canon(line) { // 2-row delayed copy per bar; never carries a chord across a downbeat
  const out = {};
  for (const s of [0, 16]) {
    Object.assign(out, echoChannel(slice(line, s, s + 13), { delay: 2, scale: 0.45, rows: R, boundary: 'carry' }));
    out[s] = { note: '^^' };
  }
  out[R - 1] = { note: '^^' };
  return out;
}
const woBass = (bars) => P(each(bars, (c, s) => [[s, WO[c][0], 16, 26]]), I.bass, { sustain: 0.85, release: 0.5, name: 'wo bass' });
const woLead = (ev) => P(ev, I.hollow, { vib: 'H32', vibDelay: 4, name: 'wo lead' });
const woPattern = (name, bars, extra = {}, lead) => {
  const line = shimmerLine(bars, !!lead);
  return pattern(name, R, { padA: line, padB: lead ? undefined : canon(line), bass: woBass(bars), lead, ...extra }, { tempo: 88 });
};
const wonder = [
  woPattern('wonder: shimmer', ['Bm', 'G'], { metal: strikes([[0, 'B-4', 20]], I.bell) }),
  woPattern('wonder: rising', ['Bm', 'G'], {}, woLead([[0, 'F#5', 6, 36], [6, 'B-5', 4, 38], [10, 'A-5', 2, 32], [12, 'F#5', 4, 34], [16, 'G-5', 10, 36], [26, 'F#5', 6, 32]])),
  woPattern('wonder: neapolitan', ['C', 'F'], { metal: strikes([[0, 'E-5', 18]], I.bell) },
    woLead([[0, 'E-5', 4, 34], [4, 'G-5', 4, 36], [8, 'C-6', 8, 40], [16, 'A#5', 8, 38], [24, 'C#6', 4, 34], [28, 'A#5', 4, 30]])),
  woPattern('wonder: leading tone', ['Em', 'F'], {}, woLead([[0, 'B-5', 6, 36], [6, 'G-5', 2, 32], [8, 'E-5', 8, 34], [16, 'F#5', 4, 34], [20, 'E-5', 2, 30], [22, 'C#5', 2, 30], [24, 'A#4', 8, 32]])),
];

// ---- dread: C minor, bells and the Dies irae ------------------------------------
const toll = (list) => strikes(list, I.bell);
const slowBeat = (rows) => heartbeat(rows.flatMap((s) => [[s + 8, 'C-5', 26], [s + 10, 'C-5', 18]]));
const drLead = (ev, inst = I.lead) => P(ev, inst, { vib: 'H21', vibDelay: 2, name: 'dr lead' });
const DIES = drLead([[0, 'D#5', 4, 32], [4, 'D-5', 4, 30], [8, 'D#5', 4, 32], [12, 'C-5', 4, 30], [16, 'D-5', 4, 30], [20, 'A#4', 4, 28], [24, 'C-5', 8, 32]]);
const dread = [
  pattern('dread: toll', R, { padA: drone([[0, 'C-3', 32, 22]]), padB: drone([[0, 'G-3', 32, 14]]), metal: toll([[0, 'C-4', 30], [16, 'C-4', 24]]), kit: slowBeat([0, 16]) }, { tempo: 56 }),
  pattern('dread: dies irae', R, { padA: hold(22), padB: hold(14), metal: toll([[0, 'C-4', 28], [16, 'C-4', 22]]), kit: slowBeat([0, 16]),
    lead: DIES, echo: cadenceEcho(DIES, 24) }, { tempo: 56 }),
  pattern('dread: the grinding second', R, { padA: hold(22), padB: drone([[0, 'C#3', 16, 12], [16, 'F#3', 16, 12]]),
    metal: toll([[0, 'C-4', 28], [16, 'F#3', 26]]), kit: slowBeat([0, 16]),
    lead: drLead([[0, 'G-4', 4, 30], [4, 'G#4', 4, 32], [8, 'G-4', 4, 30], [12, 'F#4', 4, 28], [16, 'F-4', 4, 30], [20, 'D#4', 4, 28], [24, 'D-4', 8, 30]]) }, { tempo: 56 }),
  pattern('dread: the chant below', R, { padA: hold(22), padB: drone([[0, 'G-3', 32, 14]]), metal: toll([[0, 'C-4', 30], [16, 'G-3', 24]]),
    kit: heartbeat([[0, 'C-5', 20], [2, 'C-5', 14], [8, 'C-5', 26], [10, 'C-5', 18], [16, 'C-5', 20], [18, 'C-5', 14], [24, 'C-5', 26], [26, 'C-5', 18]]),
    lead: drLead([[0, 'D#4', 8, 30], [8, 'D-4', 8, 28], [16, 'D#4', 8, 30], [24, 'C-4', 8, 30]], I.thin) }, { tempo: 56 }),
];

// ---- bridges: to_<region> ----------------------------------------------------------
// [pedal drone, bass, sigh start, bell, tempo stamps by row]
const THRESHOLD = {
  above_ground: ['A-3', 'A-2', 'A-4', 'A-4', { 0: 80 }],
  underground: ['E-3', 'E-3', 'E-5', 'E-4', { 0: 66 }],
  peril: ['B-2', 'B-2', 'B-4', 'B-3', { 0: 100, 8: 112, 16: 124, 24: 136 }],
  wonder: ['F#3', 'F#3', 'F#5', 'F#4', { 0: 88 }],
  dread: ['G-3', 'G-3', 'G-4', 'G-3', { 0: 70, 8: 64, 16: 60, 24: 56 }],
};
function bridge(dest) {
  const [ped, bass, sigh, bellNote, tempi] = THRESHOLD[dest];
  const swell = { 0: { note: ped, instrument: I.drone, vol: 'v4' } };
  [[4, 8], [8, 12], [12, 16], [16, 18], [24, 20], [30, 14], [31, 8]].forEach(([r, v]) => { swell[r] = { vol: `v${v}` }; });
  const pickup = dest === 'peril'
    ? strikes([[20, 'C-5', 8], [22, 'C-5', 12], [24, 'C-5', 16], [26, 'C-5', 20], [28, 'C-5', 24], [29, 'C-5', 26], [30, 'C-5', 28], [31, 'C-5', 30]], I.snare)
    : strikes([[28, 'A-4', 12], [30, 'E-4', 16]], I.tom);
  const ctrl = Object.fromEntries(Object.entries(tempi).map(([r, t]) => [r, { fx: `T${hex2(t)}` }]));
  return pattern(`to ${dest}`, R, {
    lead: join(dissolve(), P([[16, sigh, 4, 24], [20, up(sigh, 1), 4, 26], [24, sigh, 6, 22]], I.thin, { name: 'sigh' })),
    echo: dissolve(), padA: dissolve(), padB: swell, kit: { 0: { note: '^^' }, ...pickup },
    bass: join(dissolve(), P([[16, bass, 14, 24]], I.bass, { sustain: 0.9 })),
    metal: toll([[0, bellNote, 20]]),
  }, { ctrl });
}

// ---- order, native loops and jumps ---------------------------------------------------
const SECTIONS = { above_ground: aboveGround, underground, peril, wonder, dread };
const patterns = [], order = [], sections = {};
const indexOf = (p) => { let i = patterns.indexOf(p); if (i < 0) { i = patterns.push(p) - 1; } return i; };
const lastRowJump = (p, target) => {
  const q = { ...p, channels: p.channels.map((c) => ({ ...c })) };
  const ctrl = q.channels[ROLES.indexOf('ctrl')];
  if (ctrl[R - 1]) throw new Error(`${p.name}: ctrl row ${R - 1} is taken`);
  ctrl[R - 1] = { fx: `B${hex2(target)}` };
  return q;
};
for (const [name, list] of Object.entries(SECTIONS)) {
  const start = order.length;
  sections[name] = [start, start + list.length - 1];
  // the last pattern jumps back to the section start; stamped on a copy so a
  // pattern reused mid-section does not jump early
  list.forEach((p, i) => order.push(indexOf(i === list.length - 1 ? lastRowJump(p, start) : p)));
}
for (const dest of Object.keys(SECTIONS)) {
  sections[`to_${dest}`] = [order.length, order.length];
  order.push(indexOf(lastRowJump(bridge(dest), sections[dest][0])));
}

writeSong(import.meta.url, {
  title: 'Zork - Underworld', bpm: 80, ticks: 6, mixvol: 96,
  message: 'Zork - Underworld. Claude Opus 5.5, 2026-09-24.\nAdaptive score for the Zork trilogy web port: five region sections\n(Bxx self-loops) and to_<region> bridges. All samples synthesized.\nSource: songs/zork_underworld.gen.js',
  samples: SAMPLES,
  channelnames: ROLES,
  patterns,
  order,
  adaptive: { layers: [], sections, loop: 'above_ground' },
});
