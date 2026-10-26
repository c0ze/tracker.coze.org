#!/usr/bin/env node
/**
 * HELIOBANE stage 12 "The Vein", arranged for 4 Paula channels (Amiga port,
 * exported with tools/json2mod.js). It reads the PC song's JSON
 * (heliobane_stage12.json, from heliobane_stage12.gen.js), so every note,
 * chord, groove, the form, tempo and loop (orders 1-8, B01 on the tag's
 * last row) are the PC's; this file only says which PC channels share each
 * Paula channel (heliobane_amiga.kit.js, heliobane_amiga_w23.kit.js).
 *
 * Tempo: 160 BPM at speed 6, exactly the PC's. The PC's pulse walls run on
 * this beat (beat_pulse.gd counts it in ticks, not from the audio).
 *
 * Channels (Paula 0 and 3 play left, 1 and 2 right). In play, effects take
 * channel 3 and voice lines channel 0 (docs/AUDIO.md "The channel plan"):
 *   0 drums  snare, kick, the heartbeat, hats and rattle (a hat never cuts a
 *            hit after one row)
 *   1 riff   the flesh bass
 *   2 lead   the lead (pwm; the choir in the break); the choir's chord where
 *            the lead rests (intro)
 *   3 colour the lead's echo or the written harmony; the choir arps (A2,
 *            A up, tag) where those rest; the choir's chord (its three
 *            voices as one note with an arpeggio) where both rest; the noise
 *            riser (build)
 * Dropped: the chord's volume swells (an arpeggio on every row), the
 * crashes (the colour channel is never free for 3 rows), the pans.
 * Changed: the build's snare roll (16ths rising over its first half, then
 * retrigs at that level); the riser alternates volume rows with slide rows.
 * One-shots are cut to what the arrangement plays of them.
 * MOD retune (2026-10-23; json2mod's ranged copies, heliobane-amiga
 * docs/MEASURED.md "The MODs retuned"): the arp pulse's chords voiced within
 * 7 semitones (narrowSongArps); loops within 0.0007 of their rate or 1,024
 * bytes (modLoopTol, modLoopMax), for stock chip RAM.
 */
import { loadSong, arrange, writeSong } from './heliobane_amiga.kit.js';
import { chordChannel, roll, alternate, narrowSongArps } from './heliobane_amiga_w23.kit.js';

const dir = new URL('.', import.meta.url).pathname;
const PC = { kick: 0, snare: 1, hat: 2, perc: 3, bass: 4, gtr: 5, lead: 6, echo: 7, c1: 8, c2: 9, c3: 10, stab: 11, fx: 12 };
const song = loadSong(`${dir}heliobane_stage12.json`);

const name = (e) => song.samples[e._inst ?? e.instrument]?.name ?? '';
const drums = [{ ch: PC.snare, hold: 2 }, { ch: PC.kick, hold: 2 }, { ch: PC.perc, hold: 2 }, { ch: PC.hat, hold: 1 }];
const riser = { ch: PC.fx, only: (r, e) => name(e) === 'noise loop' };

function plan(p) {
  const chord = { ch: chordChannel(p, [PC.c1, PC.c2, PC.c3]), prefer: 'fx' };
  const stab = { ch: PC.stab, prefer: 'fx' };
  if (/^intro/.test(p.name)) return [drums, [{ ch: PC.bass }], [chord], []];
  if (/^build/.test(p.name)) return [drums, [{ ch: PC.bass }], [{ ch: PC.lead }], [riser, chord]];
  return [drums, [{ ch: PC.bass }], [{ ch: PC.lead }], [{ ch: PC.echo }, stab, chord]];
}

function post(p, lanes) {
  if (/^build/.test(p.name)) {
    roll(lanes[0], 48, 64);
    alternate(lanes[3], p.channels[PC.fx]);
  }
}

writeSong(`${dir}heliobane_stage12_amiga.json`, narrowSongArps(arrange(song, {
  // chip RAM: shorter loops (json2mod modLoopTol, modLoopMax; heliobane-amiga docs/MEASURED.md "The MODs retuned")
  modLoopTol: 0.0007, modLoopMax: 1024,
  plan, post, trim: {},
  title: 'Heliobane - The Vein 4ch', mixvol: 48,
  message: 'HELIOBANE stage 12 "The Vein", 4-channel Amiga arrangement.\n160 BPM (the pulse walls\' beat). Orders 1-8 loop.\n'
    + 'All samples synthesized. Source: songs/heliobane_stage12_amiga.gen.js; MOD via tools/json2mod.js',
}), /^arp pulse/));
