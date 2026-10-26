#!/usr/bin/env node
/**
 * HELIOBANE stage 6 "Ashfall Drift", arranged for 4 Paula channels (Amiga
 * port, exported with tools/json2mod.js). It reads the PC song's JSON
 * (heliobane_stage6.json, from heliobane_stage6.gen.js), so every note,
 * chord, groove, the form, tempo (175 BPM, speed 6) and loop (orders 1-8,
 * B01 on the turn's last row) are the PC's; this file only says which PC
 * channels share each Paula channel (heliobane_amiga.kit.js,
 * heliobane_amiga_w23.kit.js).
 *
 * Channels (Paula 0 and 3 play left, 1 and 2 right). In play, effects take
 * channel 3 and voice lines channel 0 (docs/AUDIO.md "The channel plan"):
 *   0 drums  the crash on a section's first row (in place of the kick
 *            there; the next hit after 4 rows cuts it), then snare and
 *            tom, kick, hats (a hat never cuts a hit after one row)
 *   1 riff   the saw bass
 *   2 lead   the thin pwm lead; the falling bells (intro, which has no
 *            lead)
 *   3 colour the klaxon (intro); the lead's echo (A2, B) or the written
 *            harmony (A down, B down), the falling bells where those rest;
 *            the noise riser (build)
 * The bells span 32 semitones, more than one MOD sample plays well: from
 * G#6 up they play a second copy of the bell.
 * Dropped: the klaxon after the intro, the second echo (echo2), the second
 * bell line (collapse), the pad, the thunder and the noise falls (intro,
 * collapse), the pans.
 * Changed: the snare rolls (intro, build) rise in 16ths over their first
 * half, then retrig at that level; the riser alternates volume rows with
 * slide rows. One-shots are cut to what the arrangement plays of them.
 */
import { loadSong, arrange, writeSong } from './heliobane_amiga.kit.js';
import { roll, alternate, splitLine, keepOnly } from './heliobane_amiga_w23.kit.js';

const dir = new URL('.', import.meta.url).pathname;
const PC = { kick: 0, snare: 1, hat: 2, bass: 3, alarm: 4, bells: 5, lead: 6, echo: 7, echo2: 8, pad: 9, fx: 10 };
const song = loadSong(`${dir}heliobane_stage6.json`);

const name = (e) => song.samples[e._inst ?? e.instrument]?.name ?? '';
const drums = [{ ch: PC.snare, hold: 2 }, { ch: PC.kick, hold: 2 }, { ch: PC.hat, hold: 1 }];
const riser = { ch: PC.fx, only: (r, e) => name(e) === 'noise loop' };
// The bells span F-5 to C-8: from G#6 up they play a second copy of the bell.
const bells = splitLine(song, PC.bells, 'glass bell', 80);

function plan(p) {
  const crash = { ch: keepOnly(p, PC.fx, (e) => name(e) === 'crash'), hold: 4 };
  const s = p.name.split(':')[0], bass = [{ ch: PC.bass }], lead = [{ ch: PC.lead }];
  switch (s) {
    case 'intro': return [[crash, ...drums], bass, [...bells], [{ ch: PC.alarm, prefer: 'fx' }]];
    case 'A': case 'turn': return [[crash, ...drums], bass, lead, [...bells]];
    case 'collapse': return [[crash, ...drums], bass, lead, [...bells]];
    case 'build': return [[crash, ...drums], bass, lead, [riser, ...bells]];
    default: return [[crash, ...drums], bass, lead, [{ ch: PC.echo }, ...bells]];
  }
}

function post(p, lanes) {
  if (/^intro/.test(p.name)) roll(lanes[0], 56, 64);
  if (/^build/.test(p.name)) { roll(lanes[0], 48, 64); alternate(lanes[3], p.channels[PC.fx]); }
}

writeSong(`${dir}heliobane_stage6_amiga.json`, arrange(song, {
  plan, post, trim: {},
  title: 'Heliobane - Ashfall Drift 4ch', mixvol: 48,
  message: 'HELIOBANE stage 6 "Ashfall Drift", 4-channel Amiga arrangement.\n175 BPM. Orders 1-8 loop.\n'
    + 'All samples synthesized. Source: songs/heliobane_stage6_amiga.gen.js; MOD via tools/json2mod.js',
}));
