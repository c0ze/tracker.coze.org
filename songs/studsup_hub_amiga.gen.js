#!/usr/bin/env node
/**
 * STUDS UP hub loop "Back Office" for 4 Paula channels (Amiga port,
 * tools/json2mod.js). Original material: the manager's office behind the pub,
 * where the hub's tables live. Rocksteady rather than ska: half-time drums
 * (kick on 1, snare on 3), an organ skank on every offbeat, a dub bass with
 * approach notes, and a muted brass tune with long rests, so it can sit under
 * menus for minutes (GDD 33.2: "menu music like a football highlights show
 * recorded in a basement"; the PC's brass and distorted organ).
 * G minor, 104 BPM, speed 6: 16 rows a bar, 64 rows = 4 bars = 9.23 s.
 *
 * Phrase map:
 *   groove  bass, drums and skank alone (Gm Cm Gm D7): the bed the tune leaves to;
 *   A       a pickup and a rising cell (d g bb), held G over Cm, a climb to D6,
 *           left open on F# over D7 (the question);
 *   A'      the same cell, answered down through C minor to G, held (home);
 *   B       Eb Bb F D7: the one change of colour, the tune's high point (Eb6),
 *           then down to the dominant;
 *   break   no tune: a busier skank and a bass fill, back to the groove.
 * Form: groove A A' B break, the whole loop (B00 on the last row): 46 s.
 * Loop seam: the bass rings into order 0, whose first row retriggers it.
 * B's bar 2 ends on a one-row chromatic approach (E under the held F).
 *
 * Channels (menus layout, studsup_amiga.kit.js): 0 drums (left), 1 brass
 * (right), 2 organ skank (right: the UI clicks take it), 3 bass (left).
 */
import { kick, snare, hat, wave, BASS_AMPS, ORGAN_AMPS, mel, line, chart, bass, stabs,
  beat, rep, pattern, jump, writeSong } from './studsup_amiga.kit.js';

const I = { kick: 0, rim: 1, hat: 2, bass: 3, brass: 4, organ: 5 };
const MUTED = [1, 0.7, 0.45, 0.3, 0.18, 0.1, 0.06, 0.04];   // a muted horn: few upper harmonics
const samples = [kick({ f0: 150, decay: 10 }), { ...snare({ tone: 330, decay: 30, sec: 0.12, seed: 19 }), name: 'rim' }, hat(),
  wave('bass', BASS_AMPS.slice(0, 6)), wave('muted brass', MUTED), { ...wave('organ', ORGAN_AMPS, { drive: 1.6 }), volume: 20 }];
const D = { K: [I.kick, 58], S: [I.rim, 46], g: [I.rim, 14], h: [I.hat, 14], H: [I.hat, 24] };

const DR = { drop: 'K.h.h.h.S.h.h.hg', drop2: 'K.h.h.h.S.h.hKh.', fill: 'K.h.h.h.S.h.SgSS', open: 'K.H.h.H.S.H.h.Hg' };
const CH = { A: 'Gm Cm Gm D7', A2: 'Gm Cm D7 Gm', B: 'Eb Bb F D7' };
const AMEL = 'r/4 d5/2 g5 bb5/6 a5/2 | g5/8~ r/4 eb5/2 f5 | g5/2 bb5 d6/4 c6/2 bb5 a5/4 | f#5/8~ r/8';
const A2MEL = 'r/4 d5/2 g5 bb5/6 a5/2 | c6/6 bb5/2 g5/4 eb5 | d5/2 f#5 a5/4 c6 a5 | g5/12~ r/4';
const BMEL = 'bb5/6 g5/2 eb5/8~ | d6/6 bb5/2 f5/8~ | c6/2 a5 f5/4 a5/2 c6 eb6/4 | d6/8~ c6/4 a5';
const DUB = ['R---.r.fR---.f.h'], WALK = ['R---.r.fR-.o.f.h', 'R---.r.fR.r.f.nh'];
const SKANK = ['..X...X...X...X.'], DOUBLE = ['..X...X...X.X.X.'];

function section(name, { chords, melody, drums, bassR = DUB, skank = SKANK, last = false }) {
  const segs = chart(chords), rows = 64;
  const p = pattern(name, rows, [
    beat(drums, D),
    melody ? line(mel(melody, { vol: 38 }), I.brass, { rows, vib: 'H32', vibDelay: 4 }) : { 0: { note: '^^' } },
    stabs(segs, skank, I.organ, { rows, lo: 'A-3', vol: null }),
    bass(segs, bassR, I.bass, { rows, lo: 'D-3', vol: 48, decay: 0.9 }),
  ]);
  return last ? jump(p, 0) : p;
}

const patterns = [
  section('groove', { chords: CH.A, drums: rep(4, DR.drop, DR.drop2) }),
  section('A', { chords: CH.A, melody: AMEL, drums: rep(4, DR.drop, DR.drop2) }),
  section("A'", { chords: CH.A2, melody: A2MEL, drums: rep(4, DR.drop, DR.fill) }),
  section('B', { chords: CH.B, melody: BMEL, drums: rep(4, DR.open, DR.fill) }),
  section('break', { chords: CH.A, drums: rep(4, DR.drop, DR.fill), bassR: WALK, skank: DOUBLE, last: true }),
];

writeSong(import.meta.url, {
  title: 'Studs Up - back office 4ch', bpm: 104, ticks: 6, mixvol: 48, samples, patterns, order: [0, 1, 2, 3, 4],
  channelnames: { 0: 'drums', 1: 'brass', 2: 'organ', 3: 'bass' },
  message: 'STUDS UP hub loop "Back Office", original, for the Amiga port (4-channel MOD via tools/json2mod.js).\n'
    + 'G minor, 104 BPM; loops the whole song. All samples synthesized. Source: songs/studsup_hub_amiga.gen.js',
});
