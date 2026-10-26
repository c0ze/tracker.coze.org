#!/usr/bin/env node
/**
 * HELIOBANE story intro — "Solmarch" (plays under the narrated lore intro). MUSIC-A, 2026-09-24.
 * D minor, 156 BPM (same key/tempo as the title), speed 6: 16 rows/bar = 1.537 s. Non-looping, ~71 s.
 *
 * Written for a narrator: until the hit, the voice band (roughly 150 Hz-3 kHz) holds only
 * slow sustained notes. Motion lives below it (sub, rumble, drums) or above it (sparse bells).
 *
 *   scene_1   0.0 s  Dm Bb Dm     Aurel: sub drone, dark strings, a heartbeat kick, bell glints
 *   scene_2   9.2 s  Dm Eb Dm     the SOLACE drill: low noise rumble pulsing on the beat, timpani
 *   scene_3  18.4 s  Dm Db Db Gm A A   the Umbrine wakes: low brass hints the title hook, turned
 *                                 sinister: "D D Ab——" (the title's fifth becomes a tritone)
 *   scene_4  27.7 s  Dm Bb Gm A Dm     the worlds fall: a snare march creeps in, 8th bass
 *   scene_5  35.3 s  Dm Eb Dm Eb Bb A  the fleet is worn: full march, "D D Bb" hint
 *   build    44.6 s  Bb C Dm Dm   (= scene_6) Solmarch, the tarp: timpani 8ths, J-arps warm up
 *   scene_7  50.7 s  Gm Bb C A    the launch: kick/snare accelerate to 32nd retrigs, noise riser, tom fill
 *   hit      56.9 s  orchestra hit + crash + full band: the title's A section, hook "D D A——" verbatim
 *   outro    69.2 s  Dm orchestra hit, everything rings out
 * Pattern names carry the marker names; render_a.py turns them into seconds.
 */
import { kick, snare, cymbal, tom, orchHit, noiseLoop, wave, pwm, superSaw, BASS_AMPS, BRASS_AMPS,
  mel, line, chart, arp, bass, pad, beat, rep, pattern, writeSongCompact } from './heliobane_title.kit.js';

const I = { kick: 0, snare: 1, hat: 2, crash: 3, tom: 4, bass: 5, sub: 6, pad: 7, brass: 8, lead: 9, arp: 10, bell: 11, orch: 12, noise: 13 };
const LAYOUT = ['kick', 'snare', 'hat', 'tom', 'bass', 'pad', 'brass', 'lead', 'arp', 'bell', 'fx', 'riser'];
const PANS = [0x80, 0x74, 0xac, 0x70, 0x80, 0x5a, 0xa0, 0x8a, 0x50, 0xb8, 0x80, 0x90];
const K = { X: [I.kick, 64], x: [I.kick, 48], h: [I.kick, 40], b: [I.kick, 26] };
const S = { X: [I.snare, 50], x: [I.snare, 34], g: [I.snare, 14] };
const H = { X: [I.hat, 28], x: [I.hat, 18], g: [I.hat, 10] };
const TIMP = { T: [I.tom, 42, null, 'D-4'], t: [I.tom, 24, null, 'D-4'], A: [I.tom, 38, null, 'A-3'], f: [I.tom, 46, null, 'F-4'], c: [I.tom, 46, null, 'C-4'] };

// The title's A-section hook (copied from heliobane_title.gen.js, A_MEL) so the hit lands in the theme.
const TITLE_A = 'd5/2 d5 a5/6 g5/2 a5 c6 | bb5/6 a5/2 f5/4 d5 | e5/2 f5 g5/6 f5/2 e5 c5 | e5/4 d5/2 c#5 e5/8'
  + ' | d5/2 d5 a5/6 g5/2 a5 d6 | f6/6 e6/2 d6/4 bb5 | c6/2 bb5 a5 g5 e5/4 c#5 | d5/12 r/4';

// ---------------------------------------------------------------- helpers
const sub = (segs, rows, vol = 40) => bass(segs, ['R---------------'], I.sub, { rows, lo: 'D-3', vol, decay: 0.97 });
const strings = (segs, rows, vol = 14) => pad(segs, I.pad, { rows, lo: 'D-4', vol });
const brass = (str, rows, vol = 30) => line(mel(str, { vol }), I.brass, { rows, sustain: 0.85, release: 0.55, vib: 'H32', vibDelay: 6 });
function bells(list, rows) { // [row, pitch] glints above the voice band
  return line(list.map(([r, n]) => [r, n, 12, 18, '']), I.bell, { rows, vib: null });
}
function rumble(rows, from = 0, peak = 26) { // pitched-down noise loop, a pulse on every beat (the drill)
  const ch = { [from]: { note: 'C-2', instrument: I.noise, vol: `v${peak}` } };
  for (let r = from + 1; r < rows; r++) ch[r] = { vol: `v${Math.round(peak * [1, 0.62, 0.42, 0.3][r % 4])}` };
  return ch;
}
const cut = (r = 0) => ({ [r]: { note: '^^' } });
/** Scale every vNN stamp in the given channels (keeps the build below the hit). */
function soften(p, keys, k) {
  for (const key of keys) {
    const ch = p.channels[LAYOUT.indexOf(key)];
    for (const ev of Object.values(ch)) if (ev.vol?.startsWith('v')) ev.vol = `v${Math.round(Number(ev.vol.slice(1)) * k)}`;
  }
  return p;
}
const P = (name, bars, parts) => pattern(name, bars, parts, LAYOUT, PANS);

// ---------------------------------------------------------------- scenes
const s1 = chart('Dm/32 Bb/32 Dm/32'), s2 = chart('Dm/32 Eb/32 Dm/32'), s3 = chart('Dm Db Db Gm A A');
const s4 = chart('Dm Bb Gm A Dm'), s5 = chart('Dm Eb Dm Eb Bb A'), s6 = chart('Bb C Dm Dm'), s7 = chart('Gm Bb C A');
const s8 = chart('Dm Bb C A | Dm Bb C/8 A/8 Dm/16');

const scene1 = P('scene_1: Aurel', 6, {
  kick: beat(rep(6, 'h..b............'), K), bass: sub(s1, 96), pad: strings(s1, 96, 12),
  bell: bells([[8, 'A-6'], [40, 'D-7'], [72, 'F-6']], 96),
});
const scene2 = P('scene_2: the drill', 6, {
  kick: beat(rep(6, 'h..b............'), K), tom: beat(rep(6, 'T.......t.......'), TIMP),
  bass: sub(s2, 96), pad: strings(s2, 96), riser: rumble(96), bell: bells([[24, 'D-7'], [72, 'A#6']], 96),
});
const scene3 = P('scene_3: the Umbrine wakes', 6, {
  kick: beat(rep(6, 'h..b....h..b....'), K), tom: beat(rep(6, 'T...............'), TIMP),
  bass: sub(s3, 96), pad: strings(s3, 96), riser: rumble(96, 0, 18),
  brass: brass('d4/8 d4 | ab4/16~ | ab4/8 f4/8 | g4/12 bb4/4 | a4/16~ | a4/8 e4/8', 96),
});
const scene4 = P('scene_4: the worlds fall', 5, {
  kick: beat(rep(5, 'X.......x.......'), K),
  snare: beat(['....g.......g...', '....x.......x.gg', 'x.g.x.g.x.g.x.gg', 'x.ggx.ggx.ggx.gg', 'X.ggX.ggX.ggXggg'], S),
  tom: beat(rep(5, 'T.......A.......'), TIMP),
  bass: bass(s4, ['R.r.R.r.R.r.R.r.'], I.bass, { rows: 80, lo: 'D-3', vol: 30 }), pad: strings(s4, 80),
  brass: brass('a4/16~ | f4/16~ | d4/16~ | c#4/16~ | d4/16~', 80, 28),
});
const scene5 = P('scene_5: the fleet is worn', 6, {
  kick: beat(rep(6, 'X..x....X..x....'), K), snare: beat(rep(6, 'X.ggX.gxX.ggX.gg', 'X.ggX.gxXgXgXXXX'), S),
  hat: beat(rep(6, 'g.x.g.x.g.x.g.x.'), H), tom: beat(rep(6, 'T.......A.......'), TIMP),
  bass: bass(s5, ['R.r.R.r.R.r.R.r.'], I.bass, { rows: 96, lo: 'D-3', vol: 34 }), pad: strings(s5, 96, 16),
  brass: brass('d4/8 d4 | bb4/16~ | a4/16~ | g4/16~ | f4/16~ | e4/8 c#4/8', 96, 30),
});
const scene6 = P('scene_6|build: Solmarch, the ship under the tarp', 4, {
  kick: beat(rep(4, 'X...X...X...X...'), K), snare: beat(rep(4, 'X.ggX.gxX.ggX.gg'), S),
  hat: beat(rep(4, 'x.x.x.x.x.x.x.x.'), H), tom: beat(['T.t.T.t.T.t.T.t.', 'T.t.T.t.T.t.T.t.', 'T.t.T.t.TttTTttt', 'TtttTtttTtttTttt'], TIMP),
  bass: bass(s6, ['R.r.R.r.R.r.R.r.'], I.bass, { rows: 64, lo: 'D-3', vol: 32 }), pad: strings(s6, 64, 16),
  arp: arp(s6, ['X-x-X-x-X-x-X-x-'], I.arp, { rows: 64, lo: 'F-4', vol: 14 }),
  brass: brass('d4/16~ | e4/16~ | f4/16~ | a4/16~', 64, 32), riser: cut(),
});
soften(scene5, ['kick', 'snare', 'hat', 'tom'], 0.75);
soften(scene6, ['kick', 'snare', 'hat', 'tom', 'bass'], 0.7);
const buildSnare = beat(['x.x.x.x.x.x.x.x.', 'xxxxxxxxxxxxxxxx', '................', '................'], S);
for (let i = 0; i < 30; i++) buildSnare[32 + i] = { note: 'C-5', instrument: I.snare, vol: `v${16 + Math.round(i * 0.9)}`, fx: i < 16 ? 'Q03' : 'Q02' };
buildSnare[62] = { note: '^^' }; // an 8th of silence before the hit
const riser = { 32: { note: 'C-4', instrument: I.noise, vol: 'v4' } };
for (let r = 33; r < 62; r++) riser[r] = { vol: `v${4 + Math.round((r - 32) * 0.9)}`, fx: 'F04' };
riser[62] = { note: '^^' };
const scene7 = P('scene_7: the launch', 4, {
  kick: beat(['X...X...X...X...', 'X.x.X.x.X.x.X.x.', 'X.x.X.x.X.x.X.x.', 'X.x.X.x.X.x.....'], K), snare: buildSnare,
  hat: beat(rep(4, 'xgxgxgxgxgxgxgxg', 'xgxgxgxgxgxg....'), H), tom: beat(['T.t.T.t.T.t.T.t.', 'TtttTtttTtttTttt', 'TtTtTtTtTtTtTtTt', 'TtTtTtTtfcAt....'], TIMP),
  bass: bass(s7, ['R.r.R.r.R.r.R.r.', 'R.r.R.r.R.r.R.r.', 'RrRrRrRrRrRrRrRr', 'RrRrRrRrRrRr....'], I.bass, { rows: 64, lo: 'D-3', vol: 32 }),
  pad: strings(s7, 64, 18), arp: arp(s7, ['X-x-X-x-X-x-X-x-'], I.arp, { rows: 64, lo: 'F-4', vol: 20 }),
  brass: brass('g4/16~ | bb4/16~ | c5/16~ | c#5/8 e5/8', 64, 34), riser,
});
soften(scene7, ['kick', 'snare', 'hat', 'tom', 'bass', 'riser'], 0.68);
for (const c of [4, 5, 6, 8]) scene7.channels[c][62] = { note: '^^' }; // bass/strings/brass/arp breathe before the hit
const hitFx = { 0: { note: 'D-5', instrument: I.orch, vol: 'v64' }, 16: { note: '^^' } };
const hit = P('hit: HELIOBANE (title A section)', 8, {
  kick: beat(rep(8, 'X.....X.X.......', 'X.....X.X.X.....'), K), snare: beat(rep(8, '....X.......X...', '....X.......XxXX'), { ...S, X: [I.snare, 58], x: [I.snare, 44] }),
  hat: beat(rep(8, 'X.x.X.x.X.x.X.x.', 'X.x.X.x.X.x.....'), H),
  bass: bass(s8, ['R.RoR.RoR.RoR.oh'], I.bass, { rows: 128, lo: 'C-3', vol: 40 }),
  arp: arp(s8, ['X-x-X-x-X-x-X-x-'], I.arp, { rows: 128, lo: 'F-4', vol: 24 }), pad: strings(s8, 128, 16),
  lead: line(mel(TITLE_A, { vol: 44 }), I.lead, { rows: 128 }),
  brass: { 0: { note: 'D-4', instrument: I.orch, vol: 'v56' }, 16: { note: '^^' } }, fx: hitFx,
  riser: { 0: { note: 'C-5', instrument: I.crash, vol: 'v48' } },
});
const fade = (ch) => { for (let r = 1; r < 16; r++) ch[r] = { ...(ch[r] ?? {}), vol: `v${Math.round(40 * 0.8 ** r)}` }; return ch; };
const outro = P('outro: Dm rings out', 1, {
  kick: { 0: { note: 'C-5', instrument: I.kick, vol: 'v64' } }, snare: { 0: { note: 'C-5', instrument: I.snare, vol: 'v50' } },
  bass: fade({ 0: { note: 'D-3', instrument: I.bass, vol: 'v40' } }), pad: fade({ 0: { note: 'D-5', instrument: I.pad, vol: 'v24' } }),
  arp: fade({ 0: { note: 'A-4', instrument: I.arp, vol: 'v24', fx: 'J58' } }),
  brass: { 0: { note: 'D-4', instrument: I.orch, vol: 'v56' } }, fx: { 0: { note: 'D-5', instrument: I.orch, vol: 'v60' } },
  riser: { 0: { note: 'C-5', instrument: I.crash, vol: 'v44' } },
});
for (let r = 1; r < 16; r++) outro.channels[8][r] = { ...outro.channels[8][r], fx: 'J58' }; // keep the D minor arp spinning while it fades
for (const c of [4, 5, 8]) outro.channels[c][15] = { ...outro.channels[c][15], note: '^^' }; // faded to ~v1: end cleanly

const patterns = [scene1, scene2, scene3, scene4, scene5, scene6, scene7, hit, outro];
writeSongCompact(import.meta.url, {
  title: 'Heliobane - Solmarch (intro)', bpm: 156, ticks: 6, mixvol: 44,
  message: 'HELIOBANE story intro "Solmarch" (MUSIC-A).\nD minor, 156 BPM, plays once; lands on the title hook.\nAll samples synthesized. Source: songs/heliobane_intro.gen.js',
  samples: [
    kick(), snare(), cymbal('hat closed'), cymbal('crash', { sec: 1.4, decay: 2.2, seed: 8, metalMix: 0.35 }), tom(),
    wave('saw bass', BASS_AMPS), wave('sub', [1, 0.12, 0.05]), superSaw('dark strings', { base: 80, cyc: 96 }),
    wave('brass', BRASS_AMPS), pwm('pwm lead'), { name: 'arp pulse', synth: { wave: 'square', pulse: 0.25 } },
    { name: 'bell', synth: { wave: 'pluck', seconds: 1.6, decay: 2.5 } }, orchHit(), noiseLoop(),
  ],
  channelnames: LAYOUT,
  patterns,
  order: patterns.map((_, i) => i),
});
