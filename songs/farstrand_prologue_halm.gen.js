#!/usr/bin/env node
/**
 * FARSTRAND — "Prologue: Halm" (after the crash: the last two stills and the FARSTRAND logo, then the cocoon;
 * GDD §15). 2026-10-02.
 * E minor (Halm's key), 100 BPM, speed 6: 4 rows/beat, 16 rows/bar; one row = a 16th (150 ms), one bar = 2.4 s.
 * Rendered at 48 kHz, where 100 BPM is exact (1200 samples/tick).
 *
 * A one-shot like `prologue` (farstrand_prologue.gen.js): each pattern's name before the colon is a marker
 * (tools/audio/music.py writes them to the manifest): `halm` (0 s), `glass` (7.2 s) and `hit` (12.0 s), the
 * logo slam; it ends at 16.8 s on a held E, Halm's tonic, fading, so the cocoon's music (`halm`, which opens on
 * wind and a low E) comes in under it.
 *
 * Identity: out of the white into Halm. halm: the white-out still ringing (a high glass E and B, the crash sfx's
 * ring is the same E), wind, a low E; Halm's own cell on its hollow glass lead, far off ('E F# G——', then 'D—B G——'
 * over Cmaj7, the theme of `halm`), the pluck arpeggio fading in. glass: the title's heartbeat (she is alive), the
 * cell's answer ('E F# G C | B——'), a glass glint climbing B7, a soft tom roll, a riser and a reverse swell into
 * the hit. hit: the logo slam (kick, a low tom, a glass crash, E2 in the bass, E6 on a glass bell), then the
 * title's question in E on the glass bell ('B G—— F# | E———', 5 up a minor sixth to b3, 2, 1) while the E rings and
 * fades. Everything synthesized. Source of truth: this file; the shared helpers come from farstrand_halm.gen.js.
 *
 * Phrase map (markers: halm 0, glass 7.2, hit 12.0 s; end 16.8 s)
 *   halm    Emadd9 Emadd9 Cmaj7   the white ringing out; wind, low E; 'E F# G—— | D—B G——' on the glass lead
 *   glass   Am7 B7                heartbeat; 'E F# G C | B——'; a glint D# F# A B; tom roll, riser, swell
 *   hit     Em Em                 the slam; 'B G—— F# | E———' on the bell; the held E fading to nothing
 */
import { kick, cymbal, noiseLoop, wave, glassBell, thinPad, swell, mel, line, chart, bass, beat, pattern,
  writeSongCompact, ladder, pingpong, notesOf, hits, triads, cutLanes, riser, roll } from './heliobane_stage6.kit.js';
import { echoChannel } from './lib.js';
import { sawPluck, soften, delayLine, padLane, wind, fadeIn } from './farstrand_halm.gen.js';

const I = { kick: 0, tom: 1, bass: 2, pluck: 3, glass: 4, pad: 5, harm: 6, bell: 7, crash: 8, noise: 9, swell: 10 };
const LAYOUT = ['kick', 'tom', 'bass', 'arp', 'canon', 'lead', 'echo', 'echo2', 'pad', 'harm', 'bells', 'bells2',
  'bellEcho', 'bellEcho2', 'crash', 'wind', 'fx'];
const PANS = [0x80, 0x84, 0x80, 0x58, 0xa8, 0x86, 0x50, 0xb4, 0x70, 0x94, 0x6c, 0x98, 0xa4, 0x54, 0x8c, 0x80, 0x90];
const KEYS = ['lead', 'echo', 'echo2', 'arp', 'canon', 'pad', 'harm'];

// ---------------------------------------------------------------- melodies
const CELL = 'r/16 | r/4 e5/2 f#5/2 g5/8~ | d6/6 b5/2 g5/8';           // farstrand_halm.gen.js CELL and its answer
const ANSWER = 'r/4 e5/2 f#5/2 g5/4 c6/4 | b5/8~ r/8';
const QUESTION = 'r/4 b5/2 g6/8~ f#6/2 | e6/16';                      // the title's, in E, after the slam
const SHAPE = [0, 2, 4, 3, 1, 3, 5, 4];
const CH = { halm: 'Emadd9 Emadd9 Cmaj7', glass: 'Am7 B7', hit: 'Em Em' };

// ---------------------------------------------------------------- parts
const lane = (p, key) => p.channels[LAYOUT.indexOf(key)];
const setLane = (p, key, ch) => { p.channels[LAYOUT.indexOf(key)] = ch; };
/** A held note fading: `note` at row 0 at `vol`, then a volume stamp every 2 rows falling to silence at `rows`. */
function fading(inst, note, vol, rows, curve = 1.6) {
  const ch = { 0: { note, instrument: inst, vol: `v${vol}` } };
  for (let r = 2; r < rows; r += 2) ch[r] = { vol: `v${Math.round(vol * (1 - r / rows) ** curve)}` };
  ch[rows - 1] = { note: '^^' };
  return ch;
}

function section(name, bars, chordStr, { lead = null, leadVol = 32, bells = null, bellVol = 40, arp = true, arpVol = 20,
  padVol = 15, harmVol = 6, bassVol = 24, windHi = 10, extra = {} } = {}) {
  const rows = bars * 16, segs = chart(chordStr), tri = chart(triads(chordStr));
  const parts = { wind: wind(bars, { lo: 3, hi: windHi, inst: I.noise }),
    bass: bass(tri, ['R---------------'], I.bass, { rows, lo: 'C-3', vol: bassVol, decay: 0.94 }) };
  const refs = [];
  if (lead) {
    const notes = mel(lead, { vol: leadVol }), ch = line(notes, I.glass, { rows, vib: 'H23', vibDelay: 4 });
    parts.lead = ch; refs.push(notes);
    [parts.echo, parts.echo2] = pingpong(ch, notes, rows, { d1: 3, s1: 0.4, d2: 6, s2: 0.22, segs });
    refs.push(notesOf(parts.echo, rows), notesOf(parts.echo2, rows));
  }
  if (bells) {
    const notes = mel(bells, { vol: bellVol }), ch = soften(line(notes, I.bell, { rows, vib: null }), rows, refs);
    parts.bells = ch;
    [parts.bellEcho, parts.bellEcho2] = pingpong(ch, notes, rows, { d1: 3, s1: 0.4, d2: 8, s2: 0.22, segs });
    refs.push(notesOf(ch, rows), notesOf(parts.bellEcho, rows), notesOf(parts.bellEcho2, rows));
  }
  if (arp) {
    const arpNotes = ladder(segs, rows, SHAPE, { lo: 'E-4', span: 8, vol: arpVol, soft: 5, len: 2 });
    parts.arp = soften(line(arpNotes, I.pluck, { rows, vib: null }), rows, refs);
    parts.canon = soften(delayLine(parts.arp, rows, segs, { delay: 3, scale: 0.4 }), rows, [...refs, notesOf(parts.arp, rows)]);
  }
  parts.pad = padLane(segs, tri, rows, refs, { lo: 'E-4', vol: padVol, inst: I.pad });
  if (harmVol) parts.harm = echoChannel(parts.pad, { delay: 0, semi: 12, scale: harmVol / padVol, inst: I.harm, rows });
  return pattern(name, bars, cutLanes({ ...parts, ...extra }, KEYS), LAYOUT, PANS);
}

// ---------------------------------------------------------------- the stills and the logo
const halm = section('halm: down on Halm, under a red sun', 3, CH.halm, { lead: CELL, padVol: 13, bassVol: 22, windHi: 12,
  extra: { bells: { 0: { note: 'E-7', instrument: I.bell, vol: 'v40' } }, bells2: { 0: { note: 'B-6', instrument: I.bell, vol: 'v30' } },
    harm: fading(I.harm, 'E-6', 14, 24) } });
setLane(halm, 'arp', fadeIn(lane(halm, 'arp'), 16, 40));
setLane(halm, 'canon', fadeIn(lane(halm, 'canon'), 19, 43));

const glass = section('glass: the cartographer woke in glass', 2, CH.glass, { lead: ANSWER, bells: 'r/16 | r/8 d#6/2 f#6/2 a6/2 b6/2',
  bellVol: 34, padVol: 16, windHi: 13, extra: {
    kick: beat(['X..x............', 'X..x............'], { X: [I.kick, 40], x: [I.kick, 26] }),
    tom: roll(I.tom, 24, 8, { v0: 8, dv: 3, fx: null, note: 'E-4' }),
    fx: { ...riser(I.noise, 16, 25, { note: 'C-4', v0: 4, slope: 1.4, fx: 'F03' }), ...hits(I.swell, [25], { vol: 30 }) },
  } });

const hit = section('hit: FARSTRAND', 2, CH.hit, { bells: QUESTION, bellVol: 36, arp: false, harmVol: 0, windHi: 6, extra: {
  kick: hits(I.kick, [0], { vol: 60 }), tom: hits(I.tom, [0], { note: 'B-4', vol: 56 }), crash: hits(I.crash, [0], { vol: 44 }),
  bass: fading(I.bass, 'E-2', 44, 32, 1.2), bells2: { 0: { note: 'E-6', instrument: I.bell, vol: 'v52' } },
  pad: fading(I.pad, 'B-4', 18, 32, 1.4), harm: fading(I.harm, 'E-6', 10, 32, 1.4),
  wind: fading(I.noise, 'C-5', 7, 32, 1.0),
} });

const patterns = [halm, glass, hit];

writeSongCompact(import.meta.url, {
  title: 'Farstrand - Prologue: Halm', bpm: 100, ticks: 6, mixvol: 48,
  message: 'FARSTRAND "Prologue: Halm": after the crash, the logo.\nE minor, 100 BPM. A one-shot; each pattern is a marker.\nAll samples synthesized. Source: songs/farstrand_prologue_halm.gen.js',
  samples: [
    kick({ f0: 120, f1: 40, sweep: 22, decay: 5, click: 0.08, drive: 1.5, sec: 0.8 }),
    { ...kick({ f0: 180, f1: 70, sweep: 20, decay: 6, click: 0.1, drive: 1.6, sec: 0.8 }), name: 'tom' },
    wave('round bass', [1, 0.3, 0.1, 0.04]),
    sawPluck('dark pluck', { open: 3600, closed: 320, close: 4, decay: 2.2, sec: 1.2 }),
    wave('glass lead', [1, 0.03, 0.45, 0.02, 0.22, 0.02, 0.1, 0, 0.05]),
    thinPad('cold pad', { amps: [1, 0, 0.3, 0, 0.12, 0, 0.05], spread: 1 }),
    thinPad('glass harmonica', { amps: [1, 0, 0.18, 0, 0.06], spread: 2 }),
    glassBell('glass bell', { sec: 2.6, partials: [[1, 1, 0.9], [2.76, 0.45, 2.6], [5.4, 0.2, 5], [8.93, 0.08, 9]] }),
    cymbal('glass crash', { sec: 2.4, decay: 2.2, seed: 5, metalMix: 0.45 }),
    noiseLoop(), swell('swell', { sec: 1.0, seed: 29 }), // 1.0 s from row 25 of `glass`: it ends 0.05 s before the hit
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
