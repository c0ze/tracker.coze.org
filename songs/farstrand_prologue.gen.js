#!/usr/bin/env node
/**
 * FARSTRAND — "Prologue" (the seven stills before the first strand fall, GDD §15). Re-scored 2026-10-02 for the
 * prologue on Heliobane's intro engine; the first version (2026-09-25) was a 16-bar loop under five stills. The
 * opening scene `lance` (seven bars, before `aurel`) was added 2026-10-18: what the Heliobane did to Aurel's fire.
 * D minor, 100 BPM, speed 6: 4 rows/beat, 16 rows/bar; one row = a 16th (150 ms), one bar = 2.4 s.
 * Rendered at 48 kHz, where 100 BPM is exact (1200 samples/tick).
 *
 * A one-shot, not a loop: seven phrases, one per still, and it ends on the downbeat where the fall begins (the fall
 * plays `prologue_fall`, farstrand_prologue_fall.gen.js, which starts on that downbeat). Each pattern's name before
 * the colon is the still it scores; tools/audio/music.py writes the order starts to the manifest as `markers`.
 * `lance` gets seven bars (16.8 s) for its two narrated lines, the next three stills tell the world and get four
 * bars (9.6 s) for their captions; from the Plumbline on the story speeds up and each gets three (7.2 s).
 *
 * Identity: the title's family, lonely and then driven. The theme is the title's question ('A—F——E | D———', 5 up a
 * minor sixth to b3, 2, 1) and the Survey's call (`benchmark`'s bugle-like theme, the Concord's own music: 'A D A——
 * G F# | E D E——'). lance: the Umbrine in Aurel's fire, then the Heliobane, then the roads going cold: a warm pad
 * and a rising pluck arpeggio (the roads growing), the bass stepping up to Eb (the bII), the star on its bell and a
 * whisper of KELL (the warm thing's motif) in the flesh voice; the Concord's call in D major on the glass lead as
 * the Lance flies in, a riser and a reverse swell; the strike on bar 6's downbeat (kick, the star struck, a glass
 * crash, a low D), D major turning to D minor with every warm voice cut; five plucks falling down Dm, one by one,
 * their gaps widening, the cold pad thinning into aurel's wind and low D. aurel: Aurel going out: one glass bell
 * for the star, then the question on the title's ocarina, far off, and the star again, dimmer. strands: the dark
 * pluck arpeggio (the strands themselves) fades in with its dotted-8th canon; the ocarina reaches the seventh
 * ('A—G——F | E———') and glass shards fall and freeze over the bII (Eb, the Umbrine's colour). surveys: six glass
 * pings, one per survey, falling down the chords and fainter each time while the arp thins out and stops; the
 * seventh slot is silence. plumbline: the seventh ping, bright, the title's heartbeat, and the Survey's call on the
 * glass lead in D major, whose sixth sinks to Bb (it went anyway). ride: on the strand: kick on the beat, glass
 * ticks, the arp in 16ths and the question on the glass lead, climbing. warm: the beat drops away; a warm pad (even
 * harmonics: sunfed) and a slow heart; under the question (now in G minor) KELL, the warm thing's motif
 * (`boss_kell`: the Survey's call turned inside out), two octaves down in the flesh voice; then a snare roll, a
 * riser and a reverse swell into the fall's downbeat.
 *
 * Phrase map (markers: 0, 16.8, 26.4, 36.0, 45.6, 52.8, 60.0 s; the fall at 67.2 s, the end of the file)
 *   lance      Dm Ebmaj7 Gm D A Dm/32  the fire, the roads growing; the call, riser; strike at 12.0 s; the cold
 *   aurel      Dm Dm Bbmaj7 Bbmaj7    wind, low D; the star (A6 bell); the question; the star dimmer
 *   strands    Gm A Dm Eb             the arp fades in; 'A—G——F | E———'; shards falling down Dm and Eb, ringing
 *   surveys    Dm Bbmaj7 Gm Eb        six pings A6 F6 D6 A5 G5 D5, fainter; the arp fades out; bar 4 empty
 *   plumbline  D A Bb                 the seventh ping (D7); heartbeat; the call, 'A D A—— G F# | E D E—— | A D Bb——'
 *   ride       Dm Bbmaj7 C            kick, ticks, 8th bass, 16th arp; 'A—F——E | D F Bb—— | C—Bb G E'
 *   warm       Gm Cm Eb/8 A/8         warm pad, a heart; 'D—Bb——A | G———' over KELL ('G D G—— A Bb | C D C——');
 *                                     bar 3: roll, riser, swell, 'Bb—— C#——' into the fall
 * Everything synthesized. Source of truth: this file; the shared helpers come from farstrand_halm.gen.js.
 */
import { kick, snare, cymbal, noiseLoop, wave, glassBell, thinPad, swell, mel, line, chart, bass, beat, pattern,
  writeSongCompact, ladder, pingpong, notesOf, hits, triads, cutLanes, riser, roll, fall } from './heliobane_stage6.kit.js';
import { echoChannel } from './lib.js';
import { sawPluck, soften, delayLine, padLane, wind, fadeIn } from './farstrand_halm.gen.js';

const I = { kick: 0, hat: 1, snare: 2, bass: 3, pluck: 4, ocarina: 5, glass: 6, flesh: 7, pad: 8, warm: 9, harm: 10,
  bell: 11, noise: 12, swell: 13, crash: 14 };
const LAYOUT = ['kick', 'hat', 'snare', 'bass', 'arp', 'canon', 'lead', 'echo', 'echo2', 'hive', 'pad', 'harm', 'bells',
  'bellEcho', 'bellEcho2', 'wind', 'fx'];
const PANS = [0x80, 0xa8, 0x78, 0x80, 0x58, 0xa8, 0x86, 0x50, 0xb4, 0x7c, 0x70, 0x94, 0x6c, 0xa4, 0x54, 0x80, 0x90];
const KEYS = ['lead', 'echo', 'echo2', 'hive', 'arp', 'canon', 'pad', 'harm'];
const RING = ['bells', 'bellEcho', 'bellEcho2']; // a section without bells lets the last ones ring on

// ---------------------------------------------------------------- melodies
const QUESTION = 'a5/4 f6/10~ e6/2 | d6/12~ r/4';                    // farstrand_title.gen.js
const REACH = 'a5/4 g6/10~ f6/2 | e6/16~';                            // its second phrase, to the seventh
const CALL = 'a5/2 d6/2 a6/8 g6/2 f#6/2 | e6/4 d6/4 e6/8 | a5/2 d6/2 bb6/12~'; // the Survey's (benchmark), its 6th sunk
const RIDE = 'a5/4 f6/10~ e6/2 | d6/4 f6/4 bb6/8~ | c7/6 bb6/2 g6/4 e6/4';
const WARM = 'd6/4 bb6/8~ a6/4 | g6/16~ | bb6/8 c#7/8';               // the question in G minor, then up into the fall
const KELL = 'g4/2 d4/2 g3/8 a3/2 bb3/2 | c4/4 d4/4 c4/8 | r/16';     // boss_kell's motif, two octaves down
const SHAPE = [0, 2, 4, 3, 1, 3, 5, 4];                               // the title's 8ths
const ROLL = [0, 2, 3, 5, 4, 2, 3, 1, 0, 2, 3, 5, 6, 5, 3, 2];        // the strand's 16ths
const CH = { aurel: 'Dm Dm Bbmaj7 Bbmaj7', strands: 'Gm A Dm Eb', surveys: 'Dm Bbmaj7 Gm Eb', plumbline: 'D A Bb',
  ride: 'Dm Bbmaj7 C', warm: 'Gm Cm Eb/8 A/8' };

// ---------------------------------------------------------------- parts
/** The title's heartbeat (lub-dub) on the first beat of the bars listed in `on`. */
const heartbeat = (n, on, vol = 40) => beat(Array.from({ length: n }, (_, i) => (on.includes(i) ? 'X..x............'
  : '................')), { X: [I.kick, vol], x: [I.kick, Math.round(vol * 0.65)] });
/** Fade a lane out: volumes scaled from 1 at `from` down to `floor` at `to`, a cut at `to`, nothing after. */
function fadeOut(ch, from, to, floor = 0.15) {
  const out = {};
  for (const [r, e] of Object.entries(ch)) {
    if (+r >= to) continue;
    const k = +r < from ? 1 : 1 - (1 - floor) * (+r - from) / (to - from);
    out[r] = e.vol?.startsWith('v') ? { ...e, vol: `v${Math.round(Number(e.vol.slice(1)) * k)}` } : e;
  }
  out[to] = { note: '^^' };
  return out;
}
/** Glass bells from explicit [row, note, len, vol] (each ping its own level). */
const pings = (list) => list.map(([r, n, l, v]) => [r, n, l, v, '']);
const lane = (p, key) => p.channels[LAYOUT.indexOf(key)];
const setLane = (p, key, ch) => { p.channels[LAYOUT.indexOf(key)] = ch; };

/** One still's phrase: an optional lead (ocarina or glass) with a ping-pong echo, the warm thing's motif in the flesh
 *  voice, bells with their echoes, the arp and its canon, a pad (cold or warm) with an optional glass harmonica over
 *  it, a held bass (one rhythm, or one per bar) and wind. `extra` replaces any lane. */
function section(name, bars, chordStr, { lead = null, leadInst = I.ocarina, leadVol = 36, echo = [6, 12], vib = 'H23',
  hive = null, hiveVol = 40, bells = null, bellVol = 40, bellEcho = [6, 12], arp = true, shape = SHAPE, step = 2, arpVol = 22,
  pad = I.pad, padVol = 16, harmVol = 0, bassR = 'R---------------', bassVol = 26, windHi = 9, warmUntil = 0, extra = {} } = {}) {
  const rows = bars * 16, segs = chart(chordStr), tri = chart(triads(chordStr));
  const parts = { wind: wind(bars, { lo: 3, hi: windHi, inst: I.noise }),
    bass: bass(tri, [bassR].flat(), I.bass, { rows, lo: 'C-3', vol: bassVol, decay: 0.94 }) };
  const refs = [];
  if (lead) {
    const notes = mel(lead, { vol: leadVol }), ch = line(notes, leadInst, { rows, vib, vibDelay: 4 });
    parts.lead = ch; refs.push(notes);
    [parts.echo, parts.echo2] = pingpong(ch, notes, rows, { d1: echo[0], s1: 0.4, d2: echo[1], s2: 0.2, segs });
    refs.push(notesOf(parts.echo, rows), notesOf(parts.echo2, rows));
  }
  if (hive) {
    const notes = mel(hive, { vol: hiveVol });
    parts.hive = line(notes, I.flesh, { rows, sustain: 0.85, release: 0.6, vib: 'H43', vibDelay: 4 });
    refs.push(notes);
  }
  if (bells) {
    const notes = typeof bells === 'string' ? mel(bells, { vol: bellVol }) : pings(bells);
    const ch = soften(line(notes, I.bell, { rows, vib: null }), rows, refs);
    parts.bells = ch;
    [parts.bellEcho, parts.bellEcho2] = pingpong(ch, notes, rows, { d1: bellEcho[0], s1: 0.4, d2: bellEcho[1], s2: 0.2, segs });
    refs.push(notesOf(ch, rows), notesOf(parts.bellEcho, rows), notesOf(parts.bellEcho2, rows));
  } else for (const k of RING) parts[k] = {};
  if (arp) {
    const arpNotes = ladder(segs, rows, shape, { lo: 'D-4', span: 8, vol: arpVol, soft: 5, len: step });
    parts.arp = soften(line(arpNotes, I.pluck, { rows, vib: null }), rows, refs);
    parts.canon = soften(delayLine(parts.arp, rows, segs, { delay: 3, scale: 0.4 }), rows, [...refs, notesOf(parts.arp, rows)]);
  }
  parts.pad = padLane(segs, tri, rows, refs, { lo: 'F-4', vol: padVol, inst: pad });
  if (warmUntil) { // the warm pad up to that row, `pad` from it on (the Lance: the fire, then the cold)
    const warmCh = padLane(segs, tri, rows, refs, { lo: 'F-4', vol: Math.round(padVol * 1.15), inst: I.warm });
    const keep = (ch, from, to) => Object.fromEntries(Object.entries(ch).filter(([r]) => +r >= from && +r < to));
    parts.pad = { ...keep(warmCh, 0, warmUntil), ...keep(parts.pad, warmUntil, rows) };
  }
  if (harmVol) parts.harm = echoChannel(parts.pad, { delay: 0, semi: 12, scale: harmVol / padVol, inst: I.harm, rows });
  return pattern(name, bars, cutLanes({ ...parts, ...extra }, KEYS), LAYOUT, PANS);
}

// ---------------------------------------------------------------- the stills
// lance, the opening scene: 7 bars, 16.8 s, for the two narrated lines of `lance` (1.0 s, then 2.0 s after the
// first ends; 12.1-12.4 s of speech). Fire (bars 1-3): a warm pad, a low D, embers (glass ticks), the star on its
// bell, and the strands growing as a rising pluck arpeggio, the bass stepping up to Eb, the Umbrine's colour
// (Ebmaj7, the bII as in `strands`). The Lance (bars 4-5): the Concord's call in D major on the glass lead, the arp
// in 16ths, kicks and sparks quickening, a riser and a reverse swell. The strike (bar 6, row 80 = 12.0 s): the
// kick, the star struck on its bell, a glass crash and a low D; every warm voice cuts, the cold pad takes the chord
// and D major turns to D minor. The cold (bars 6-7): the roads go cold one by one, five plucks falling down Dm with
// their gaps widening, the pad thinning; aurel's wind, low D and cold pad follow.
const STRIKE = 80;
const LANCE_CH = 'Dm Ebmaj7 Gm D A Dm/32';
const LANCE_CALL = 'r/48 | a5/2 d6/2 a6/8 g6/2 f#6/2 | e6/4 d6/4 e6/8 | r/32'; // the Survey's call, its first two bars
const RISE = [0, 1, 2, 3, 4, 5, 6, 7];
/** One event per [row, vol] on an instrument. */
const evs = (inst, list, note = 'C-5') => Object.fromEntries(list.map(([r, v]) => [r, { note, instrument: inst, vol: `v${v}` }]));
/** A held note whose level steps down every 2 rows by `k`. */
function heldNote(row, note, v0, len, k) {
  const ch = { [row]: { note, instrument: I.bass, vol: `v${v0}` } };
  let v = v0;
  for (let r = row + 2; r < row + len; r += 2) { v *= k; ch[r] = { vol: `v${Math.round(v)}` }; }
  return ch;
}
const lanceSegs = chart(LANCE_CH), lanceRefs = [mel(LANCE_CALL, { vol: 42 })];
const embers = [5, 11, 15, 21, 26, 29, 35, 38, 41, 45, 49, 52, 55, 58, 61];
const lanceHat = { ...evs(I.hat, embers.map((r, i) => [r, 9 + Math.round(i * 0.4)])),
  ...evs(I.hat, Array.from({ length: 14 }, (_, i) => [64 + i, 12 + Math.floor(i * 0.6)])), ...evs(I.crash, [[STRIKE, 34]]) };
const lanceKick = beat(['................', '................', '................', '........x...x...',
  'x...m...m...m.x.', 'X...............', '................'], { X: [I.kick, 62], m: [I.kick, 40], x: [I.kick, 26] });
const lanceSnare = { ...roll(I.snare, 72, 8, { v0: 8, dv: 3 }), [STRIKE]: { note: '^^' } };
const lanceFx = { ...riser(I.noise, 62, 73, { note: 'C-4', v0: 4, slope: 1.6, fx: 'F04' }), ...hits(I.swell, [73], { vol: 30 }),
  ...fall(I.noise, STRIKE, 98, { note: 'C-6', v0: 26, fx: 'E06' }) };
const lanceBass = { ...bass(chart(triads('Dm Ebmaj7 Gm D A')), ['R---------------', 'R---------------', 'R---------------', 'R-------r-------',
  'R-r-R-r-R-r-R-r.'], I.bass, { rows: STRIKE, lo: 'C-3', vol: 30, decay: 0.94 }),
  ...heldNote(STRIKE, 'D-2', 46, 16, 0.88), ...heldNote(STRIKE + 16, 'D-3', 20, 16, 0.93) };
// The roads: a plucked arpeggio rising through the chord tones (8ths, then 16ths in bar 5), then the five that go cold.
const roadNotes = [...ladder(lanceSegs, 64, RISE, { lo: 'D-4', span: 8, vol: 26, soft: 6, len: 2 }),
  ...ladder(lanceSegs, STRIKE, ROLL, { lo: 'D-4', span: 8, vol: 28, soft: 6, len: 1, off: 64 })];
const coldNotes = [[83, 'A-5', 5, 30, ''], [88, 'F-5', 6, 26, ''], [94, 'D-5', 7, 22, ''], [101, 'A-4', 7, 17, ''],
  [108, 'F-4', 4, 12, '']];
const lanceArp = { ...fadeIn(soften(line(roadNotes, I.pluck, { rows: 112, vib: null }), 112, lanceRefs), 12, 44),
  ...line(coldNotes, I.pluck, { rows: 112, vib: null }) };
const lanceCanon = soften(delayLine(lanceArp, 112, lanceSegs, { delay: 3, scale: 0.4 }), 112, [...lanceRefs, notesOf(lanceArp, 112)]);
const lance = section('lance: Aurel burns, the Lance flies in, the roads go cold', 7, LANCE_CH, { lead: LANCE_CALL,
  leadInst: I.glass, leadVol: 42, echo: [3, 6], vib: 'H33', hive: 'd4/2 a3/2 d3/8 e3/2 f3/2 | r/96', hiveVol: 24,
  arp: false, warmUntil: STRIKE, padVol: 22, bassVol: 30, windHi: 12,
  bells: [[0, 'A-6', 8, 62], [34, 'D-6', 4, 36], [38, 'A-6', 4, 40], [42, 'D-7', 8, 44], [STRIKE, 'A-6', 10, 50]], bellVol: 50,
  extra: { bass: lanceBass, arp: lanceArp, canon: lanceCanon, kick: lanceKick, hat: lanceHat, snare: lanceSnare, fx: lanceFx } });
setLane(lance, 'pad', fadeIn(lane(lance, 'pad'), 0, 24));

const aurel = section('aurel: Aurel going out', 4, CH.aurel, { lead: `r/16 | ${QUESTION} | r/16`, arp: false,
  bells: 'r/4 a6/12 | r/16 | r/16 | r/8 a6/8?', bellVol: 56, padVol: 13, bassVol: 22, windHi: 11 });
setLane(aurel, 'pad', fadeIn(lane(aurel, 'pad'), 0, 24));

const strands = section('strands: the strands, frozen to glass', 4, CH.strands, { lead: `${REACH} | r/16 | r/16`,
  bells: 'r/16 | r/16 | r/2 a6/1 f6/1 d6/12 | r/2 g6/1 eb6/1 bb5/12', bellVol: 44, bellEcho: [3, 9], padVol: 16 });
setLane(strands, 'arp', fadeIn(lane(strands, 'arp'), 0, 20));
setLane(strands, 'canon', fadeIn(lane(strands, 'canon'), 3, 23));

const surveys = section('surveys: six surveys, none came back', 4, CH.surveys, { padVol: 17, windHi: 12, bellEcho: [3, 9],
  bassVol: 22,
  bells: [[0, 'A-6', 6, 62], [8, 'F-6', 6, 57], [16, 'D-6', 6, 52], [24, 'A-5', 6, 46], [32, 'G-5', 6, 40], [40, 'D-5', 8, 34]],
  extra: { fx: hits(I.swell, [56], { vol: 24 }) } });
setLane(surveys, 'arp', fadeOut(lane(surveys, 'arp'), 16, 44));
setLane(surveys, 'canon', fadeOut(lane(surveys, 'canon'), 19, 47));

const plumbline = section('plumbline: Survey Seven went anyway', 3, CH.plumbline, { lead: CALL, leadInst: I.glass,
  leadVol: 40, echo: [3, 6], vib: 'H33', bells: 'd7/16 | r/16 | r/16', bellVol: 62, padVol: 18, harmVol: 6,
  bassR: 'R-------r-------', bassVol: 28, extra: { kick: heartbeat(3, [0, 1], 40) } });

const ride = section('ride: on the strand', 3, CH.ride, { lead: RIDE, leadInst: I.glass, leadVol: 42, echo: [3, 6],
  vib: 'H33', shape: ROLL, step: 1, arpVol: 24, padVol: 18, harmVol: 5, bassR: 'R-r-R-r-R-r-R-o-', bassVol: 30, windHi: 13,
  extra: { kick: beat(['X...x...X...x...', 'X...x...X...x...', 'X...x...X.x.x.x.'], { X: [I.kick, 46], x: [I.kick, 30] }),
    hat: beat(['x.g.x.g.x.g.x.g.', 'x.g.x.g.x.g.x.g.', 'xgxgxgxgxgxgxgxg'], { x: [I.hat, 14], g: [I.hat, 8] }) } });

const warm = section('warm: something warm on the line', 3, CH.warm, { lead: WARM, leadInst: I.glass, leadVol: 38,
  echo: [6, 12], vib: 'H33', hive: KELL, shape: ROLL, step: 1, arpVol: 18, pad: I.warm, padVol: 20, windHi: 14,
  bassR: ['R---------------', 'R---------------', 'R-r-R-r-R-r-R-r-'], bassVol: 28,
  extra: {
    kick: beat(['X..x............', 'X..x............', 'X...X...X...X.X.'], { X: [I.kick, 44], x: [I.kick, 28] }),
    hat: beat(['................', '................', 'xgxgxgxgxgxgxgxg'], { x: [I.hat, 13], g: [I.hat, 7] }),
    snare: { ...roll(I.snare, 32, 15, { v0: 8, dv: 2 }), 47: { note: '^^' } }, // a 16th's breath before the fall
    fx: { ...riser(I.noise, 32, 48, { note: 'C-4', v0: 4, slope: 1.6, fx: 'F04' }), ...hits(I.swell, [41], { vol: 30 }) },
  } });
// The riser hands over to the swell at row 41, which rises unbent into the fall's downbeat.
for (let r = 42; r < 48; r++) delete lane(warm, 'fx')[r];

const patterns = [lance, aurel, strands, surveys, plumbline, ride, warm];

writeSongCompact(import.meta.url, {
  title: 'Farstrand - Prologue', bpm: 100, ticks: 6, mixvol: 48,
  message: 'FARSTRAND "Prologue": six stills, then the fall.\nD minor, 100 BPM. A one-shot; each pattern is a still.\nAll samples synthesized. Source: songs/farstrand_prologue.gen.js',
  samples: [
    kick({ f0: 120, f1: 42, sweep: 24, decay: 7, click: 0.05, drive: 1.3, sec: 0.5 }),
    cymbal('glass tick', { sec: 0.05, decay: 90, seed: 17, metalMix: 0.7 }),
    snare({ tone: 170, decay: 22, sec: 0.2, seed: 43, drive: 1.4 }),
    wave('round bass', [1, 0.3, 0.1, 0.04]),
    sawPluck('dark pluck', { open: 3600, closed: 320, close: 4, decay: 2.2, sec: 1.2 }),
    wave('soft lead', [1, 0, 0.16, 0, 0.05, 0, 0.02]),
    wave('glass lead', [1, 0.03, 0.45, 0.02, 0.22, 0.02, 0.1, 0, 0.05]),
    wave('flesh', [1, 0.7, 0.45, 0.32, 0.22, 0.15, 0.1, 0.06]),
    thinPad('cold pad', { amps: [1, 0, 0.3, 0, 0.12, 0, 0.05], spread: 1 }),
    thinPad('warm pad', { amps: [1, 0.5, 0.32, 0.2, 0.12, 0.07], spread: 1 }),
    thinPad('glass harmonica', { amps: [1, 0, 0.18, 0, 0.06], spread: 2 }),
    glassBell('glass bell', { sec: 2.2, partials: [[1, 1, 1.1], [2.76, 0.45, 3], [5.4, 0.2, 6], [8.93, 0.08, 10]] }),
    noiseLoop(), swell('swell', { sec: 1.0, seed: 23 }), // 1.0 s from row 41 of `warm`: it ends 0.05 s before the fall
    cymbal('glass crash', { sec: 2.4, decay: 2.2, seed: 5, metalMix: 0.45 }), // the Lance's strike (as prologue_halm's crash)
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
