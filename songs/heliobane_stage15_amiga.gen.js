#!/usr/bin/env node
/**
 * HELIOBANE stage 15 "The First Mouth", arranged for 4 Paula channels
 * (Amiga port, exported with tools/json2mod.js). It reads the PC song's
 * JSON (heliobane_stage15.json, from heliobane_stage15.gen.js), so every
 * note, chord, groove, the form, tempo (176 BPM, speed 6) and loop (orders
 * 1-8, B01 on the tag's last row) are the PC's; this file only says which
 * PC channels share each Paula channel (heliobane_amiga.kit.js,
 * heliobane_amiga_w23.kit.js).
 *
 * Channels (Paula 0 and 3 play left, 1 and 2 right). In play, effects take
 * channel 3 and voice lines channel 0 (docs/AUDIO.md "The channel plan"):
 *   0 drums  the orchestra hits (grand, build, tag) in place of the hits
 *            under them, then snare, kick, the ritual drum, hats (a hat
 *            never cuts a hit after one row)
 *   1 riff   the saw bass
 *   2 lead   the pwm lead; the brass (grand); the gold bell (intro)
 *   3 colour the lead's echo or the written harmony; the arps (A2, B,
 *            A up) where those rest; the choir's chord (its three voices as
 *            one note with an arpeggio) where both rest; the noise riser
 *            (build)
 * Dropped: the chord's volume swells, the organ (its bar-long notes under
 * the bass), the crashes (the colour channel is never free for 3 rows),
 * the pans.
 * Changed: the snare rolls (intro, build) rise in 16ths over their first
 * half, then retrig at that level; the riser alternates volume rows with
 * slide rows. One-shots are cut to what the arrangement plays of them; for
 * chip RAM (the first export was 95.4 KB), the gold bell to 0.7 s of 1.8
 * (faded from 0.5 s; 10.6 dB below its loudest 50 ms at 0.7 s), the ritual
 * drum to 0.35 s of 0.7 (faded from 0.27 s; 15.5 dB down at 0.35 s), the
 * noise loop to its first half (measured on the PC's PCM).
 * MOD retune (2026-10-23; json2mod's ranged copies, heliobane-amiga
 * docs/MEASURED.md "The MODs retuned"): the arp pulse's chords voiced within
 * 7 semitones (narrowSongArps); the orchestra hit cut to 0.4 s of 0.95
 * (faded from 0.3 s; 11.6 dB down at 0.4 s); loops within 0.0005 of their
 * rate (modLoopTol) and the shorter bell and drum above, for stock chip RAM
 * (the retuned export was 93.6 KB).
 */
import { loadSong, arrange, writeSong } from './heliobane_amiga.kit.js';
import { chordChannel, roll, alternate, cut, halfNoise, narrowSongArps } from './heliobane_amiga_w23.kit.js';

const dir = new URL('.', import.meta.url).pathname;
const PC = { kick: 0, snare: 1, hat: 2, perc: 3, bass: 4, gtr: 5, lead: 6, echo: 7, c1: 8, c2: 9, c3: 10, stab: 11, fx: 12 };
const song = loadSong(`${dir}heliobane_stage15.json`);

const name = (e) => song.samples[e._inst ?? e.instrument]?.name ?? '';
const notes = (p, ch) => Object.values(p.channels[ch]).some((e) => e.note && e.note !== '^^');
const hit = { ch: PC.stab, hold: 4, only: (r, e) => name(e) === 'orchestra hit' };
const drums = [hit, { ch: PC.snare, hold: 2 }, { ch: PC.kick, hold: 2 }, { ch: PC.perc, hold: 2 }, { ch: PC.hat, hold: 1 }];
const riser = { ch: PC.fx, only: (r, e) => name(e) === 'noise loop' };

function plan(p) {
  const chord = { ch: chordChannel(p, [PC.c1, PC.c2, PC.c3]), prefer: 'fx' };
  const colour = [{ ch: PC.echo }, { ch: PC.stab, prefer: 'fx', only: (r, e) => name(e) !== 'orchestra hit' }];
  if (/^build/.test(p.name)) colour.unshift(riser);
  const lead = notes(p, PC.lead) ? [{ ch: PC.lead }] : [chord];
  if (notes(p, PC.lead)) colour.push(chord);
  return [drums, [{ ch: PC.bass }], lead, colour];
}

function post(p, lanes) {
  if (/^(intro|build)/.test(p.name)) roll(lanes[0], 48, 64);
  if (/^build/.test(p.name)) alternate(lanes[3], p.channels[PC.fx]);
}

writeSong(`${dir}heliobane_stage15_amiga.json`, narrowSongArps(arrange(song, {
  // chip RAM: shorter loops (json2mod modLoopTol, modLoopMax; heliobane-amiga docs/MEASURED.md "The MODs retuned")
  modLoopTol: 0.0005,
  plan, post, trim: {}, samples: { 'gold bell': cut(0.7, 0.2), 'ritual drum': cut(0.35, 0.08), 'orchestra hit': cut(0.4, 0.1), 'noise loop': halfNoise },
  title: 'Heliobane - The First Mouth 4ch', mixvol: 48,
  message: 'HELIOBANE stage 15 "The First Mouth", 4-channel Amiga arrangement.\n176 BPM. Orders 1-8 loop.\n'
    + 'All samples synthesized. Source: songs/heliobane_stage15_amiga.gen.js; MOD via tools/json2mod.js',
}), /^arp pulse/));
