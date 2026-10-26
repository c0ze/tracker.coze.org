#!/usr/bin/env node
/**
 * STUDS UP title theme "Studs Up!" for 4 Paula channels (Amiga port,
 * tools/json2mod.js). Original material, not an arrangement of the PC score:
 * a football-highlights theme in the PC's palette (GDD 33.2: fast retro sports
 * synths, cheap brass fanfare, distorted organ; ska stabs and a glam stomp).
 * F mixolydian, 144 BPM, speed 6: 4 rows a beat, 16 a bar, 64 rows = 4 bars = 6.67 s.
 *
 * Phrase map (A: F Eb Bb C, A': F Eb Bb C/F, B: Dm Bb Gm C, stomp: F5 F5 Ab C):
 *   hook   "da da DAAA" (c c f, 2+2+6 rows) answered by a step down, asked again
 *          a step up (d d bb), ending open on E over C;
 *   A'     the same cell, then a climb to the one high point (C6) and home to F;
 *   B      the relative minor, long notes with vibrato, organ chords underneath;
 *   stomp  glam: kick and clap on the beats, power-chord organ 8ths, the brass
 *          shouting the cell over Ab, leading back to the hook through E.
 * Form: intro A A' B stomp A A'', loop orders 1-6 (B01 on the last row): 40 s.
 * Loop seam: the last F and the bass ring into order 1, whose first row
 * retriggers both (lint's "rings past song end").
 *
 * Channels (menus layout, studsup_amiga.kit.js): 0 drums (left), 1 brass lead
 * (right), 2 organ colour (right: the menu's UI clicks take this one, so it
 * only carries what the tune can lose), 3 bass (left).
 */
import { kick, snare, hat, clap, wave, BASS_AMPS, BRASS_AMPS, ORGAN_AMPS, mel, line, chart, bass, stabs,
  beat, rep, pattern, jump, writeSong } from './studsup_amiga.kit.js';

const I = { kick: 0, snare: 1, hat: 2, clap: 3, bass: 4, brass: 5, organ: 6, soft: 7 };
const samples = [kick(), snare(), hat(), clap(), wave('bass', BASS_AMPS), wave('brass', BRASS_AMPS),
  { ...wave('organ', ORGAN_AMPS, { drive: 1.6 }), volume: 24 }, { ...wave('organ soft', ORGAN_AMPS, { drive: 1.6 }), volume: 15 }];
const D = { K: [I.kick, 60], k: [I.kick, 44], S: [I.snare, 52], s: [I.snare, 30], g: [I.snare, 14],
  h: [I.hat, 18], H: [I.hat, 28], C: [I.clap, 54] };

const DR = {
  hits: 'K.....K.....K...', roll: 'S...S.s.SsSsSSSS',
  brk: 'K.h.S.hKh.K.S.h.', fill: 'K.h.S.hKh.K.SsSS', stomp: 'K.h.C.h.K.K.C.hH', half: 'K.h.h.h.S.h.h.hs',
};
const CH = { intro: 'F Eb F C', A: 'F Eb Bb C', A2: 'F Eb Bb C/8 F/8', B: 'Dm Bb Gm C', stomp: 'F5 F5 Ab5 C' };
const HOOK = 'c5/2 c5 f5/6 r/2 a5/2 g5 | f5/4 eb5/2 c5/6 r/4 | d5/2 d5 bb5/6 r/2 a5/2 g5 | a5/4 g5 e5/8~';
const HOOK2 = 'c5/2 c5 f5/6 r/2 a5/2 g5 | f5/2 g5 bb5/6 r/2 g5/4 | c6/6! bb5/2 a5/4 g5 | a5/2 g5 e5/4 f5/8~';
const BMEL = 'a5/6 f5/2 d5/8~ | d5/2 f5 bb5/4 a5/8~ | g5/6 bb5/2 d6/8~ | c6/4 bb5 g5 e5';
const STOMP = 'f5/3! f5/3 c5/2 f5/8~ | r/16 | ab5/3! ab5/3 bb5/2 c6/8~ | bb5/4 a5 g5 e5';

const B_A = ['R-r-o-r-R-r-o-f-'], B_B = ['R---r.f.R---r.o.'], B_ST = ['R...R...R.R.R...'];
const SKA = ['..X...X...X...X.'], PADS = ['X---------------'], PUMP = ['X.X.X.X.X.X.X.X.'];

// The organ's stabs carry no note volume (the J keeps its cell): 'organ' plays at
// its sample volume 24, 'organ soft' (B's held chords) at 15.
function section(name, { chords, melody, drums, bassR, colour, colourLo = 'A-3', organ = I.organ, lead }) {
  const segs = chart(chords), rows = 64;
  return pattern(name, rows, [
    beat(drums, D),
    lead ?? (melody ? line(mel(melody, { vol: 44 }), I.brass, { rows }) : { 0: { note: '^^' } }),
    colour ? stabs(segs, colour, organ, { rows, lo: colourLo, vol: null }) : {},
    bass(segs, bassR, I.bass, { rows, lo: 'C-3', vol: 46 }),
  ]);
}

const intro = section('intro', { chords: CH.intro, drums: [DR.hits, DR.hits, DR.hits, DR.roll],
  bassR: ['R.....R.....R...', 'R.....R.....R...', 'R.....R.....R...', 'R---------------'],
  lead: stabs(chart(CH.intro), ['X.....X.....X...', 'X.....X.....X...', 'X.....X.....X...', 'X---------------'],
    I.brass, { rows: 64, lo: 'A-4', vol: 44 }) });
const A = section('A', { chords: CH.A, melody: HOOK, drums: rep(4, DR.brk, DR.fill), bassR: B_A, colour: SKA });
const A2 = section("A'", { chords: CH.A2, melody: HOOK2, drums: rep(4, DR.brk, DR.fill), bassR: B_A, colour: SKA });
const B = section('B', { chords: CH.B, melody: BMEL, drums: rep(4, DR.half, DR.fill), bassR: B_B, colour: PADS,
  colourLo: 'C-4', organ: I.soft });
const stomp = section('stomp', { chords: CH.stomp, melody: STOMP, drums: rep(4, DR.stomp), bassR: B_ST, colour: PUMP,
  colourLo: 'C-4' });
const A3 = jump(section("A''", { chords: CH.A2, melody: HOOK2, drums: rep(4, DR.brk, DR.fill), bassR: B_A, colour: SKA }), 1);

writeSong(import.meta.url, {
  title: 'Studs Up - title 4ch', bpm: 144, ticks: 6, mixvol: 48, samples,
  patterns: [intro, A, A2, B, stomp, A3], order: [0, 1, 2, 3, 4, 1, 5],
  channelnames: { 0: 'drums', 1: 'brass', 2: 'organ', 3: 'bass' },
  message: 'STUDS UP title theme, original, for the Amiga port (4-channel MOD via tools/json2mod.js).\n'
    + 'F mixolydian, 144 BPM; loops orders 1-6. All samples synthesized. Source: songs/studsup_title_amiga.gen.js',
});
