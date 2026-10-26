#!/usr/bin/env node
/**
 * HELIOBANE ending_final — "Sun-Killer, Resolved" (after the First Mouth; the true ending). MUSIC-D, 2026-09-25.
 * D minor → D major, 105 BPM, speed 6: 4 rows/beat, 16 rows/bar, one bar = 2.29 s. Non-looping, ~88 s.
 * 105 BPM is exact at 44.1 kHz (1050 samples per tick).
 *
 * Idea: the title hook "D D A——" finally resolves. It is heard as it was (D minor, the title's
 * own chords), then the First Mouth's minor bridge is played with its Bb minor turned to Bb major,
 * then the hook comes back in D MAJOR (B natural, F#, C#) over a gentle half-time beat with a
 * written harmony. The coda is bittersweet: bVI and bVII (Bb, C) lift into D, the hook's first
 * notes are sung over G minor (the borrowed iv) and settle on a held D major chord with a bell.
 *
 * Phrase map
 *   Ember       Dm Bb Gm A          choir swell, the bell tolls "D D A" slowly
 *   Memory      Dm Bb C A / Dm Bb C-A Dm   the title hook, soft PWM, choir, bass half notes, brushes
 *   Turning     Bb F Gm Dm Eb Bb Gm A      the stage 15 bridge with Bb minor turned major, brass
 *   Resolution  D Bm A7 A / D Bm G-A D     the hook in D major + harmony, kick/snare half time, crash
 *   Coda        Bb C D D Gm Gm D D         "D D A" over Bb, "D D Bb" over Gm, F# held over D
 *   End         D D                        D major chord and bell ring out; choir fades
 */
import { kick, snare, cymbal, wave, pwm, BASS_AMPS, BRASS_AMPS, writeSongCompact,
  bell, choir, organ, sectionMaker, toll } from './heliobane_stage11.kit.js';

const I = { kick: 0, snare: 1, hat: 2, crash: 3, bass: 4, lead: 5, choir: 6, bell: 7, organ: 8, brass: 9 };
const LAYOUT = ['kick', 'snare', 'hat', 'perc', 'bass', 'gtr', 'lead', 'echo', 'c1', 'c2', 'c3', 'stab', 'fx'];
const PANS = [0x80, 0x78, 0xa8, 0x80, 0x80, 0x80, 0x88, 0x60, 0x50, 0x80, 0xb0, 0xa0, 0x90];
const maps = {
  kick: { X: [I.kick, 50], x: [I.kick, 36] },
  snare: { X: [I.snare, 40], x: [I.snare, 26], g: [I.snare, 12] },
  hat: { x: [I.hat, 14], g: [I.hat, 8] },
  perc: {},
};
const make = sectionMaker({ I, LAYOUT, PANS, maps, fill: {} });
const section = (name, bars, chords, o = {}) => make(name, bars, chords, { choirLo: 'D-4', span: 14, ...o });

const BRUSH = { kick: 'X...............', hat: '..g...g...g...g.' };
const HALF = { kick: 'X.......x.......', snare: '........X.......', hat: 'x.g.x.g.x.g.x.g.' };
const CH = {
  ember: 'Dm Bb Gm A', memory: 'Dm Bb C A Dm Bb C/8 A/8 Dm/16', turning: 'Bb F Gm Dm Eb Bb Gm A',
  resolution: 'D Bm A7 A D Bm G/8 A/8 D/16', coda: 'Bb C D D Gm Gm D D', end: 'D D',
};

// ---------------------------------------------------------------- melodies
const TITLE = 'd5/2 d5 a5/6 g5/2 a5 c6 | bb5/6 a5/2 f5/4 d5 | e5/2 f5 g5/6 f5/2 e5 c5 | e5/4 d5/2 c#5 e5/8'
  + ' | d5/2 d5 a5/6 g5/2 a5 d6 | f6/6 e6/2 d6/4 bb5 | c6/2 bb5 a5 g5 e5/4 c#5 | d5/12 r/4';
const TURNING = 'd6/6 bb5/2 f5/4 bb5 | a5/10 f5/2 a5 c6 | d6/6 bb5/2 g5/4 d6 | f6/8 e6/4 d6'
  + ' | g6/6 f6/2 eb6/4 bb5 | f6/6 d6/2 bb5/4 f6 | bb6/6 a6/2 g6/4 d6 | c#6/4 e6 a6/8';
const MAJOR = 'd5/2 d5 a5/6 g5/2 a5 c#6 | b5/6 a5/2 f#5/4 d5 | e5/2 f#5 g5/6 f#5/2 e5 c#5 | e5/4 d5/2 c#5 e5/8'
  + ' | d5/2 d5 a5/6 g5/2 a5 d6 | f#6/6 e6/2 d6/4 b5 | a5/2 b5 a5 g5 e5/4 c#5 | d5/16';
const CODA = 'd6/2 d6 a6/12~ | g6/8 e6/8 | f#6/16~ | r/16 | d5/2 d5 bb5/12~ | a5/8 g5/8 | f#5/16~ | r/16';

const bells = (list, rows, len = 24) => toll(list, I.bell, { rows, len });
// ---------------------------------------------------------------- sections
const end = (() => {
  const p = section('end: D major rings out', 2, CH.end, { riff: ['R---------------'], choirVol: 18, crash: false,
    extra: { stab: bells([[0, 'D-5', 44]], 32, 32), gtr: { 0: { note: 'D-4', instrument: I.organ, vol: 'v20' } } } });
  // choir, organ and bass fade to silence over the two bars
  for (const i of [4, 5, 8, 9, 10]) {
    const ch = p.channels[i], note = Object.values(ch).find((e) => e.note && e.note !== '^^');
    const f = {};
    for (let r = 0; r < 32; r++) f[r] = r === 0 ? { ...ch[0] } : { vol: `v${Math.round((note ? Number((ch[0].vol ?? 'v20').slice(1)) : 0) * (1 - r / 32))}` };
    f[31] = { note: '^^' };
    p.channels[i] = f;
  }
  return p;
})();

const patterns = [
  section('ember', 4, CH.ember, { choirVol: 21, crash: false, extra: { lead: bells([[0, 'D-5', 54], [8, 'D-5', 48], [16, 'A-5', 52], [48, 'A-4', 44]], 64) } }),
  section('memory: the title hook', 8, CH.memory, { riff: ['R-------R-------'], melody: TITLE, leadInst: I.lead, leadVol: 38, echo: 6,
    groove: BRUSH, choirVol: 15, crash: false }),
  section('turning: the bridge in major', 8, CH.turning, { riff: ['R-------r---r---'], melody: TURNING, leadInst: I.brass, leadVol: 42,
    groove: BRUSH, choirVol: 17, gtr: ['R---------------'], gtrInst: I.organ, gtrLo: 'C-4', gtrVol: 16, crash: false }),
  section('resolution: the hook in D major', 8, CH.resolution, { riff: ['R.......R...r...'], melody: MAJOR, leadInst: I.lead, leadVol: 44, harm: true,
    groove: HALF, choirVol: 19, gtr: ['R---------------'], gtrInst: I.organ, gtrLo: 'C-4', gtrVol: 16 }),
  section('coda: bittersweet', 8, CH.coda, { riff: ['R---------------'], melody: CODA, leadInst: I.lead, leadVol: 40, echo: 6,
    groove: BRUSH, choirVol: 18, crash: false, extra: { stab: bells([[0, 'D-5', 36], [64, 'D-5', 36], [96, 'A-4', 32]], 128) } }),
  end,
];

writeSongCompact(import.meta.url, {
  title: 'Heliobane - Sun-Killer, Resolved', bpm: 105, ticks: 6, mixvol: 42,
  message: 'HELIOBANE final ending "Sun-Killer, Resolved" (MUSIC-D).\nD minor -> D major, 105 BPM. Non-looping.\nAll samples synthesized. Source: songs/heliobane_ending_final.gen.js',
  samples: [
    kick({ f0: 160, f1: 50, decay: 10, drive: 1.6, click: 0.2 }), snare({ tone: 180, decay: 22, seed: 171, drive: 1.2 }),
    cymbal('hat closed', { seed: 173 }), cymbal('crash', { sec: 1.8, decay: 1.8, seed: 178, metalMix: 0.3 }),
    wave('saw bass', BASS_AMPS), pwm('pwm lead'), choir('choir aah'), bell(), organ(), wave('brass', BRASS_AMPS),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
