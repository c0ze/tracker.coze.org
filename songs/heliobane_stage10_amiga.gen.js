#!/usr/bin/env node
/**
 * HELIOBANE stage 10 "The Heliopause", arranged for 4 Paula channels (Amiga
 * port, exported with tools/json2mod.js). It reads the PC song's JSON
 * (heliobane_stage10.json, from heliobane_stage10.gen.js), so every note,
 * chord, groove, the form, tempo (188 BPM, speed 6) and loop (orders 1-7,
 * B01 on the turn's last row) are the PC's; this file only says which PC
 * channels share each Paula channel (heliobane_amiga.kit.js,
 * heliobane_amiga_w23.kit.js).
 *
 * Channels (Paula 0 and 3 play left, 1 and 2 right). In play, effects take
 * channel 3 and voice lines channel 0 (docs/AUDIO.md "The channel plan"):
 *   0 drums  a crash on a section's first row (in place of the kick
 *            there; the next hit after 4 rows cuts it), snare and tom,
 *            kick, hats (a hat never cuts a hit after one row)
 *   1 riff   the saw bass
 *   2 lead   the hero pwm lead; the J arps (intro, drive: no lead)
 *   3 colour the lead's echo or the written harmony (A up); the chase bells
 *            (16th arpeggios) where those rest
 * The bells span C#5 to G#7: from C-7 up they play a second copy of the
 * bell (a MOD sample spans 3 octaves, and json2mod fits its top note).
 * Dropped: the J arps where the lead plays, the second echo (echo2), the
 * pad, the noise risers and swells (intro, turn), the pans.
 * Changed: the snare rolls (intro, turn) rise in 16ths over their first
 * half, then retrig at that level. One-shots are cut to what the
 * arrangement plays of them.
 * MOD retune (2026-10-23; json2mod's ranged copies, heliobane-amiga
 * docs/MEASURED.md "The MODs retuned"): the arp pulse's chords voiced within
 * 7 semitones (narrowSongArps: a copy of a single-cycle loop images when a
 * chord's root sits 8 or more under its top).
 */
import { loadSong, arrange, writeSong } from './heliobane_amiga.kit.js';
import { roll, splitLine, keepOnly, narrowSongArps } from './heliobane_amiga_w23.kit.js';

const dir = new URL('.', import.meta.url).pathname;
const PC = { kick: 0, snare: 1, hat: 2, bass: 3, arp: 4, bells: 5, lead: 6, echo: 7, echo2: 8, pad: 9, fx: 10 };
const song = loadSong(`${dir}heliobane_stage10.json`);

const name = (e) => song.samples[e._inst ?? e.instrument]?.name ?? '';
const notes = (p, ch) => Object.values(p.channels[ch]).some((e) => e.note && e.note !== '^^');
const bells = splitLine(song, PC.bells, 'chase bell', 84);

function plan(p) {
  const drums = [{ ch: keepOnly(p, PC.fx, (e) => name(e) === 'crash'), hold: 4 }, { ch: PC.snare, hold: 2 }, { ch: PC.kick, hold: 2 }, { ch: PC.hat, hold: 1 }];
  const lead = notes(p, PC.lead) ? [{ ch: PC.lead }] : [{ ch: PC.arp, prefer: 'fx' }];
  return [drums, [{ ch: PC.bass }], lead, [{ ch: PC.echo }, ...bells]];
}

function post(p, lanes) {
  if (/^intro/.test(p.name)) roll(lanes[0], 56, 64);
  if (/^turn/.test(p.name)) roll(lanes[0], 48, 64);
}

writeSong(`${dir}heliobane_stage10_amiga.json`, narrowSongArps(arrange(song, {
  plan, post, trim: {},
  title: 'Heliobane - The Heliopause 4ch', mixvol: 48,
  message: 'HELIOBANE stage 10 "The Heliopause", 4-channel Amiga arrangement.\n188 BPM. Orders 1-7 loop.\n'
    + 'All samples synthesized. Source: songs/heliobane_stage10_amiga.gen.js; MOD via tools/json2mod.js',
}), /^arp pulse/));
