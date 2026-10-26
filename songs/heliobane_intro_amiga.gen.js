#!/usr/bin/env node
/**
 * HELIOBANE story intro "Solmarch", arranged for 4 Paula channels (Amiga
 * port, exported with tools/json2mod.js). It reads the PC song's JSON
 * (heliobane_intro.json, from heliobane_intro.gen.js), so every note, chord,
 * the form, the tempo (156 BPM, speed 6) and the scene lengths are the PC's
 * (the intro screen times its scenes from them); this file only says which
 * PC channels share each Paula channel (heliobane_amiga.kit.js).
 *
 * The PC plays it once. A MOD loops, so a silent one-row pattern follows
 * the outro that jumps to itself (order 9, MOD order 10: the hit is two MOD
 * patterns): the intro ends there, and a player can stop the music once it
 * reaches it.
 *
 * Channels (Paula 0 and 3 play left, 1 and 2 right), as stage 1:
 *   0 drums  scene 1: the heartbeat kick; scenes 2-3: the timpani, the kick
 *            where they rest; scenes 4-5: timpani, snare accents, kick, snare
 *            ghosts, hats in that order; scene 6 (timpani 8ths): snare
 *            accents first, then timpani, kick, ghosts, hats; scene 7: kick
 *            and snare interleaved (8ths, then 16ths), the roll, the tom
 *            fill (F C A) over it; the orchestra hit (hit, outro) in place of
 *            the kick under it, then kick, snare, hats
 *   1 riff   the sub, then the saw bass
 *   2 lead   the strings (scenes 1-2), the brass (scenes 3-7), the title's
 *            lead (hit), the D minor arp ringing out (outro)
 *   3 colour the bells (scene 1), the drill's rumble (scene 2), the strings
 *            (scenes 3-5, outro), the J-arps (scene 6, hit), the arps then
 *            the noise riser (scene 7)
 * Dropped: the bells of scene 2 (the rumble holds that channel), the rumble
 * of scene 3, the strings in scenes 6, 7 and the hit, the crashes (hit,
 * outro), the lower orchestra hit (D-4), the kicks under the timpani, the
 * snare or the orchestra hit, the toms and hats under scene 7's kick and
 * snare, the pans.
 * Changed: scene 7's roll rises in 16ths for its first half, then retrigs
 * (E9x) at the level it reached; its last two notes after the tom fill are
 * plain 16ths; the riser alternates volume rows with slide rows (the same
 * total slide); the outro's arp keeps its chord for half a bar, then fades
 * as one note. One-shots are cut to what the arrangement plays of them, and
 * four samples shorter still for chip RAM (below).
 * MOD retune (2026-10-23; json2mod's ranged copies, heliobane-amiga
 * docs/MEASURED.md "The MODs retuned"): the arp pulse's chords voiced within
 * 7 semitones (narrowSongArps: a copy of a single-cycle loop images when a
 * chord's root sits 8 or more under its top).
 */
import { loadSong, arrange, oneShot, writeSong } from './heliobane_amiga.kit.js';
import { narrowSongArps } from './heliobane_amiga_w23.kit.js';

const dir = new URL('.', import.meta.url).pathname;
const PC = { kick: 0, snare: 1, hat: 2, tom: 3, bass: 4, pad: 5, brass: 6, lead: 7, arp: 8, bell: 9, fx: 10, riser: 11 };
const song = loadSong(`${dir}heliobane_intro.json`);

const level = (e) => Number(e.vol?.slice(1) ?? 64);
const kick = { ch: PC.kick, hold: 2 }, hat = { ch: PC.hat, hold: 1 };
const tom = (hold) => ({ ch: PC.tom, hold });
const accent = { ch: PC.snare, hold: 2, only: (r, e) => level(e) >= 16 };
const ghost = { ch: PC.snare, hold: 1, only: (r, e) => level(e) < 16 };
const arp = { ch: PC.arp, prefer: 'fx' };

function plan(p) {
  const s = p.name.split(/[:|]/)[0];
  const bass = [{ ch: PC.bass }], pad = [{ ch: PC.pad }], brass = [{ ch: PC.brass }];
  switch (s) {
    case 'scene_1': return [[kick], bass, pad, [{ ch: PC.bell }]];
    case 'scene_2': return [[tom(3), kick], bass, pad, [{ ch: PC.riser }]];
    case 'scene_3': return [[tom(3), kick], bass, brass, pad];
    case 'scene_4':
    case 'scene_5': return [[tom(2), accent, kick, ghost, hat], bass, brass, pad];
    case 'scene_6': return [[accent, tom(2), kick, ghost, hat], bass, brass, [arp]];
    case 'scene_7': return [[{ ch: PC.tom, hold: 1, from: 56, to: 60 }, { ch: PC.kick, hold: 1, to: 32 }, { ch: PC.snare, hold: 2 }, tom(2)],
      bass, brass, [{ ch: PC.riser }, arp]];
    case 'hit': return [[{ ch: PC.fx, hold: 6 }, { ch: PC.snare, hold: 2 }, kick, hat], bass, [{ ch: PC.lead }], [arp]];
    case 'outro': return [[{ ch: PC.fx }], bass, [arp], pad];
    default: throw new Error(`unplanned pattern ${p.name}`);
  }
}

/**
 * Scene 7's snare roll (Qxy with a rising volume; a MOD cell holds one):
 * its first half plays the whole rise in 16ths, its second half retrigs at
 * the level the rise reached. Those notes carry no sample number, so the
 * channel keeps that level and the cell is free for E9x.
 */
function roll(ch, from, to) {
  const half = from + Math.floor((to - from) / 2), src = { ...ch };
  for (let r = from; r < half; r++) {
    const { fx, ...e } = src[r];
    ch[r] = { ...e, vol: src[from + 2 * (r - from)].vol };
  }
  const { vol } = ch[half - 1];
  for (let r = half; r < to; r++) ch[r] = { note: src[r].note, vol, fx: src[r].fx };
}

/** The riser's rows each carry a volume step and a slide: alternate them,
 * the slide rows twice as steep (the last one makes up the total). */
function riser(ch, p, from, to) {
  const src = p.channels[PC.riser];
  let left = 0;
  for (let r = from; r < to; r++) left += parseInt(src[r].fx.slice(1), 16);
  for (let r = from; r < to; r++) {
    if ((r - from) % 2) { ch[r] = { vol: src[r].vol }; continue; }
    const step = Math.min(left, 2 * parseInt(src[r].fx.slice(1), 16));
    left -= step;
    ch[r] = { fx: `F${step.toString(16).toUpperCase().padStart(2, '0')}` };
  }
}

function post(p, lanes) {
  if (p.name.startsWith('scene_7')) {
    roll(lanes[0], 32, 56);
    riser(lanes[3], p, 33, 62);
  }
  // The outro's arp keeps its chord (Jxy) for half a bar, then fades as one
  // note: a MOD cell holds the arpeggio or the volume step.
  if (p.name.startsWith('outro')) for (let r = 8; r < 15; r++) lanes[2][r] = { vol: p.channels[PC.arp][r].vol };
}

const silence = { name: 'end: silence', rows: 1, channels: [{ 0: { fx: 'B09' } }, {}, {}, {}] };

// Chip RAM (the first export was 114 KB): the orchestra hit is cut to 0.6 s,
// faded over its last 0.15 s (the hit's kick cuts it at 0.58 s anyway); the
// timpani to 0.3 s, faded over 0.05 s (its sine is 23 dB down there); the
// bell to 1.2 s of 1.6 (an exact cut where its decay, e^-2.5t, is 26 dB
// down); the white-noise loop keeps its first 0.2 s of 0.4 (noise: any seam
// is noise).
const shortHit = (d) => oneShot(d, { seconds: 0.6, fade: 0.15 });
const shortTom = (d) => oneShot(d, { seconds: 0.3, fade: 0.05 });
const shortBell = (d) => oneShot(d, { seconds: 1.2 });
function shortNoise(d) {
  const n = Math.round(d.channels[0].length / 2);
  return { ...d, channels: d.channels.map((c) => c.slice(0, n)), loop: { start: 0, end: n } };
}

writeSong(`${dir}heliobane_intro_amiga.json`, narrowSongArps(arrange(song, {
  plan, post, trim: {}, samples: { 'orchestra hit': shortHit, tom: shortTom, bell: shortBell, 'noise loop': shortNoise }, extra: [silence], order: [...song.order, song.patterns.length],
  title: 'Heliobane - Solmarch 4ch', mixvol: 48,
  message: 'HELIOBANE story intro "Solmarch", 4-channel Amiga arrangement.\nD minor, 156 BPM, plays once, then holds on a silent order 9.\n'
    + 'All samples synthesized. Source: songs/heliobane_intro_amiga.gen.js; MOD via tools/json2mod.js',
}), /^arp pulse/));
