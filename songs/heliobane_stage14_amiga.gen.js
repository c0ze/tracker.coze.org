#!/usr/bin/env node
/**
 * HELIOBANE stage 14 "Choirnest", arranged for 4 Paula channels (Amiga
 * port, exported with tools/json2mod.js). It reads the PC song's JSON
 * (heliobane_stage14.json, from heliobane_stage14.gen.js), so every note,
 * chord, groove, the form, tempo (172 BPM, speed 6) and loop (orders 1-8,
 * B01 on the tag's last row) are the PC's; this file only says which PC
 * channels share each Paula channel (heliobane_amiga.kit.js,
 * heliobane_amiga_w23.kit.js).
 *
 * Channels (Paula 0 and 3 play left, 1 and 2 right). In play, effects take
 * channel 3 and voice lines channel 0 (docs/AUDIO.md "The channel plan"):
 *   0 drums  the crash on a section's first row (in place of the kick
 *            there; the next hit after 4 rows cuts it), then snare, the
 *            ritual drums (the drum circle: they win over the kick), kick,
 *            hats and rattle (a hat never cuts a hit after one row)
 *   1 riff   the flesh bass
 *   2 lead   the chant (choir aah), the saw lead (B, build, tag); the
 *            choir's chord (its three voices as one note with an arpeggio)
 *            where a section has no lead (intro, break)
 *   3 colour the chant's lower voice (choir ooh, an octave down); the
 *            choir stabs where it rests; the choir's chord where both rest;
 *            the noise riser (build)
 * The stabs and the chord play a copy of the choir sample (their own
 * default volume; the arpeggio takes the cell).
 * Dropped: the chord's volume swells, the pans.
 * Changed: the snare rolls (intro, build) rise in 16ths over their first
 * half, then retrig at that level; the riser alternates volume rows with
 * slide rows. One-shots are cut to what the arrangement plays of them.
 */
import { loadSong, arrange, writeSong } from './heliobane_amiga.kit.js';
import { chordChannel, roll, alternate, keepOnly } from './heliobane_amiga_w23.kit.js';

const dir = new URL('.', import.meta.url).pathname;
const PC = { kick: 0, snare: 1, hat: 2, perc: 3, bass: 4, gtr: 5, lead: 6, echo: 7, c1: 8, c2: 9, c3: 10, stab: 11, fx: 12 };
const song = loadSong(`${dir}heliobane_stage14.json`);

const name = (e) => song.samples[e._inst ?? e.instrument]?.name ?? '';
const notes = (p, ch) => Object.values(p.channels[ch]).some((e) => e.note && e.note !== '^^');
const drums = [{ ch: PC.snare, hold: 2 }, { ch: PC.perc, hold: 2 }, { ch: PC.kick, hold: 2 }, { ch: PC.hat, hold: 1 }];
const riser = { ch: PC.fx, only: (r, e) => name(e) === 'noise loop' };
// The stabs and the chord (Jxy on every note) play a copy of the chant's
// choir: a MOD sample has one default volume, and a note that needs another
// level would carry Cxx in the cell the arpeggio needs.
const AAH = song.samples.findIndex((x) => x.name === 'choir aah');
const AAH_J = song.samples.push({ ...song.samples[AAH], name: 'choir aah chord' }) - 1;

function plan(p) {
  const crash = { ch: keepOnly(p, PC.fx, (e) => name(e) === 'crash'), hold: 4 };
  const chord = { ch: chordChannel(p, [PC.c1, PC.c2, PC.c3]), prefer: 'fx', inst: AAH_J };
  const colour = [{ ch: PC.echo }, { ch: PC.stab, prefer: 'fx', inst: AAH_J }];
  if (/^build/.test(p.name)) colour.unshift(riser);
  const lead = notes(p, PC.lead) ? [{ ch: PC.lead }] : [chord];
  if (notes(p, PC.lead)) colour.push(chord);
  return [[crash, ...drums], [{ ch: PC.bass }], lead, colour];
}

function post(p, lanes) {
  if (/^(intro|build)/.test(p.name)) roll(lanes[0], 48, 64);
  if (/^build/.test(p.name)) alternate(lanes[3], p.channels[PC.fx]);
}

writeSong(`${dir}heliobane_stage14_amiga.json`, arrange(song, {
  plan, post, trim: {},
  title: 'Heliobane - Choirnest 4ch', mixvol: 48,
  message: 'HELIOBANE stage 14 "Choirnest", 4-channel Amiga arrangement.\n172 BPM. Orders 1-8 loop.\n'
    + 'All samples synthesized. Source: songs/heliobane_stage14_amiga.gen.js; MOD via tools/json2mod.js',
}));
