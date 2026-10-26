#!/usr/bin/env node
/**
 * HELIOBANE stage 7 "Halvard's Rings", arranged for 4 Paula channels (Amiga
 * port, exported with tools/json2mod.js). It reads the PC song's JSON
 * (heliobane_stage7.json, from heliobane_stage7.gen.js), so every note,
 * chord, groove, the form, tempo (164 BPM, speed 6) and loop (orders 1-8,
 * B01 on the turn's last row) are the PC's; this file only says which PC
 * channels share each Paula channel (heliobane_amiga.kit.js,
 * heliobane_amiga_w23.kit.js).
 *
 * Channels (Paula 0 and 3 play left, 1 and 2 right). In play, effects take
 * channel 3 and voice lines channel 0 (docs/AUDIO.md "The channel plan"),
 * so the bass shares channel 1 with the bells, as stage 2's tide:
 *   0 drums  snare, kick, hats (a hat never cuts a hit after one row)
 *   1 riff   the ice bells (16th arpeggios), with the round bass
 *            interleaved: each bass note sounds for its first row, in place
 *            of that row's bell note
 *   2 lead   the glass lead; the bell melody (rings); the bells' canon
 *            (intro, which has no lead)
 *   3 colour the ice cracks (intro); the lead's echo or the written
 *            harmony (A up, B up), the bells' canon where those rest; the
 *            noise riser (build); a crash when the channel is free for 3
 *            rows
 * The canon runs an octave above the bells (to A-7): it plays a second copy
 * of the bell (a MOD sample spans 3 octaves).
 * Dropped: the second echo (echo2), the pad, the bell notes under bass
 * notes, the swell (intro: one note, 23 KB), the ice cracks and swells
 * after the intro, the pans.
 * Changed: the snare rolls (intro, build) rise in 16ths over their first
 * half, then retrig at that level; the riser alternates volume rows with
 * slide rows. One-shots are cut to what the arrangement plays of them.
 */
import { loadSong, arrange, writeSong } from './heliobane_amiga.kit.js';
import { roll, alternate, keepOnly } from './heliobane_amiga_w23.kit.js';

const dir = new URL('.', import.meta.url).pathname;
const PC = { kick: 0, snare: 1, hat: 2, bass: 3, bells: 4, canon: 5, lead: 6, echo: 7, echo2: 8, pad: 9, fx: 10 };
const song = loadSong(`${dir}heliobane_stage7.json`);

const BELL = song.samples.findIndex((x) => x.name === 'ice bell');
const BELL_HI = song.samples.push({ ...song.samples[BELL], name: 'ice bell hi' }) - 1;
const name = (e) => song.samples[e._inst ?? e.instrument]?.name ?? '';
const drums = [{ ch: PC.snare, hold: 2 }, { ch: PC.kick, hold: 2 }, { ch: PC.hat, hold: 1 }];
const riser = { ch: PC.fx, only: (r, e) => name(e) === 'noise loop' };
const canon = { ch: PC.canon, inst: BELL_HI };
const crash = { ch: PC.fx, need: 3, only: (r, e) => name(e) === 'crash' };
const riff = [{ ch: PC.bass, hold: 1 }, { ch: PC.bells }];

function plan(p) {
  const s = p.name.split(':')[0];
  if (s === 'intro') return [drums, riff, [canon], [{ ch: keepOnly(p, PC.fx, (e) => name(e) === 'ice crack') }]];
  if (s === 'build to G# minor') return [drums, riff, [{ ch: PC.lead }], [riser, canon]];
  return [drums, riff, [{ ch: PC.lead }], [{ ch: PC.echo }, canon, crash]];
}

function post(p, lanes) {
  if (/^intro/.test(p.name)) roll(lanes[0], 56, 64);
  if (/^build/.test(p.name)) { roll(lanes[0], 48, 64); alternate(lanes[3], p.channels[PC.fx]); }
}

writeSong(`${dir}heliobane_stage7_amiga.json`, arrange(song, {
  plan, post, trim: {},
  title: "Heliobane - Halvard's Rings 4ch", mixvol: 48,
  message: 'HELIOBANE stage 7 "Halvard\'s Rings", 4-channel Amiga arrangement.\n164 BPM. Orders 1-8 loop.\n'
    + 'All samples synthesized. Source: songs/heliobane_stage7_amiga.gen.js; MOD via tools/json2mod.js',
}));
