#!/usr/bin/env node
/**
 * HELIOBANE ending_final "Sun-Killer, Resolved" (the final ending, after
 * stage 15), arranged for 4 Paula channels (Amiga port, exported with
 * tools/json2mod.js). It reads the PC song's JSON
 * (heliobane_ending_final.json, from heliobane_ending_final.gen.js), so
 * every note, chord, the form and the tempo (105 BPM, speed 6) are the
 * PC's; this file only says which PC channels share each Paula channel
 * (heliobane_amiga.kit.js, heliobane_amiga_w23.kit.js).
 *
 * The PC plays it once (manifest loop false). A MOD loops, so a silent
 * one-row pattern follows the end that jumps to itself (order 6, MOD order
 * 10: the 128-row patterns are two MOD patterns each): the piece ends
 * there, and a player can stop the music once it reaches it.
 *
 * Channels (Paula 0 and 3 play left, 1 and 2 right). Voice lines take
 * channel 0 in the game, so it carries only the drums, which are sparse:
 *   0 drums  the crash (resolution: in place of the kick there; the next
 *            hit after 4 rows cuts it), snare, kick, hats (a hat never cuts
 *            a hit after one row)
 *   1 riff   the saw bass
 *   2 lead   the pwm lead, the brass (turning), the gold bell (ember); the
 *            choir's chord (its three voices as one note with an
 *            arpeggio) where a section has no lead (end)
 *   3 colour the lead's echo or the written harmony; the bell (coda, end)
 *            where those rest; the choir's chord where both rest
 * Dropped: the chord's volume swells, the organ (its long notes under the
 * bass), the pans.
 * One-shots are cut to what the arrangement plays of them.
 */
import { loadSong, arrange, writeSong } from './heliobane_amiga.kit.js';
import { chordChannel, silenceEnd, keepOnly } from './heliobane_amiga_w23.kit.js';

const dir = new URL('.', import.meta.url).pathname;
const PC = { kick: 0, snare: 1, hat: 2, perc: 3, bass: 4, gtr: 5, lead: 6, echo: 7, c1: 8, c2: 9, c3: 10, stab: 11, fx: 12 };
const song = loadSong(`${dir}heliobane_ending_final.json`);

const name = (e) => song.samples[e._inst ?? e.instrument]?.name ?? '';
const notes = (p, ch) => Object.values(p.channels[ch]).some((e) => e.note && e.note !== '^^');
const drums = [{ ch: PC.snare, hold: 2 }, { ch: PC.kick, hold: 2 }, { ch: PC.hat, hold: 1 }];

function plan(p) {
  const crash = { ch: keepOnly(p, PC.fx, (e) => name(e) === 'crash'), hold: 4 };
  const chord = { ch: chordChannel(p, [PC.c1, PC.c2, PC.c3]), prefer: 'fx' };
  const colour = [{ ch: PC.echo }, { ch: PC.stab }];
  const lead = notes(p, PC.lead) ? [{ ch: PC.lead }] : [chord];
  if (notes(p, PC.lead)) colour.push(chord);
  return [[crash, ...drums], [{ ch: PC.bass }], lead, colour];
}

writeSong(`${dir}heliobane_ending_final_amiga.json`, arrange(song, {
  plan, trim: {}, extra: [silenceEnd(song.order.length)], order: [...song.order, song.patterns.length],
  title: 'Heliobane - Sun-Killer, Resolved 4ch', mixvol: 48,
  message: 'HELIOBANE final ending "Sun-Killer, Resolved", 4-channel Amiga arrangement.\nD major, 105 BPM, plays once, then holds on a silent order 6.\n'
    + 'All samples synthesized. Source: songs/heliobane_ending_final_amiga.gen.js; MOD via tools/json2mod.js',
}));
