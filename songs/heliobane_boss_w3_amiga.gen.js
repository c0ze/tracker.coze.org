#!/usr/bin/env node
/**
 * HELIOBANE boss_w3 "Herald of the Source" (World 3's Herald fights,
 * worlds.json boss_music), arranged for 4 Paula channels (Amiga port,
 * exported with tools/json2mod.js). It reads the PC song's JSON
 * (heliobane_boss_w3.json, from heliobane_boss_w3.gen.js), so every note,
 * chord, groove, the form, tempo and loop (orders 1-8, B01 on the break's
 * last row) are the PC's; this file only says which PC channels share each
 * Paula channel (heliobane_amiga.kit.js, heliobane_amiga_w23.kit.js).
 *
 * Tempo: 178 BPM at speed 6, exactly the PC's. The Valve (stage 12's
 * Herald) fights on this beat (the PC counts it in ticks, not from the
 * audio).
 *
 * Channels (Paula 0 and 3 play left, 1 and 2 right). In play, effects take
 * channel 3 and voice lines channel 0 (docs/AUDIO.md "The channel plan"):
 *   0 drums  the crash on a section's first row (in place of the kick
 *            there; the next hit after 4 rows cuts it), then snare, the
 *            taiko (ritual drum: it wins over the kick, but in the frenzy's
 *            double kick), kick, hats (a hat never cuts a hit after one row)
 *   1 riff   the organ toccata (16ths) with the grit bass interleaved:
 *            each bass note sounds for its first row, in place of that
 *            row's toccata note
 *   2 lead   the saw lead; the gold bell (intro), the choir (mass); the
 *            choir's chord (its three voices as one note with an arpeggio)
 *            where a section has no lead (frenzy, break)
 *   3 colour the lead's echo or the written harmony; the bell (mass) and
 *            the choir stabs (frenzy) where those rest; the chord (choir;
 *            organ in mass) where all of them rest
 * Dropped: the toccata notes under bass notes, the chord's volume swells,
 * the pans.
 * Changed: the intro's snare roll rises in 16ths over its first half, then
 * retrigs at that level. One-shots are cut to what the arrangement plays of
 * them; for chip RAM (the first export was 118 KB), the gold bell to 0.7 s
 * of 1.8 (faded from 0.5 s; 10.6 dB below its loudest 50 ms at 0.7 s), the
 * ritual drum to 0.35 s of 0.7 (faded from 0.27 s; 15.5 dB down at 0.35 s;
 * measured on the PC's PCM).
 * MOD retune (2026-10-23; json2mod's ranged copies, heliobane-amiga
 * docs/MEASURED.md "The MODs retuned"): loops within 0.001 of their rate or
 * 512 bytes (modLoopTol, modLoopMax) and the shorter bell and drum above,
 * for stock chip RAM (the retuned export was 90.2 KB).
 */
import { loadSong, arrange, writeSong } from './heliobane_amiga.kit.js';
import { chordChannel, roll, cut, keepOnly } from './heliobane_amiga_w23.kit.js';

const dir = new URL('.', import.meta.url).pathname;
const PC = { kick: 0, snare: 1, hat: 2, perc: 3, bass: 4, gtr: 5, lead: 6, echo: 7, c1: 8, c2: 9, c3: 10, stab: 11, fx: 12 };
const song = loadSong(`${dir}heliobane_boss_w3.json`);

const name = (e) => song.samples[e._inst ?? e.instrument]?.name ?? '';
const notes = (p, ch) => Object.values(p.channels[ch]).some((e) => e.note && e.note !== '^^');
const snare = { ch: PC.snare, hold: 2 }, taiko = { ch: PC.perc, hold: 2 }, kick = { ch: PC.kick, hold: 2 }, hat = { ch: PC.hat, hold: 1 };

function plan(p) {
  const crash = { ch: keepOnly(p, PC.fx, (e) => name(e) === 'crash'), hold: 4 };
  const chord = { ch: chordChannel(p, [PC.c1, PC.c2, PC.c3]), prefer: 'fx' };
  const colour = [{ ch: PC.echo }, { ch: PC.stab, prefer: 'fx' }];
  const lead = notes(p, PC.lead) ? [{ ch: PC.lead }] : [chord];
  if (notes(p, PC.lead)) colour.push(chord);
  const drums = /^frenzy/.test(p.name) ? [crash, snare, kick, taiko, hat] : [crash, snare, taiko, kick, hat];
  return [drums, [{ ch: PC.bass, hold: 1 }, { ch: PC.gtr }], lead, colour];
}

function post(p, lanes) {
  if (/^intro/.test(p.name)) roll(lanes[0], 48, 64);
}

writeSong(`${dir}heliobane_boss_w3_amiga.json`, arrange(song, {
  // chip RAM: shorter loops (json2mod modLoopTol, modLoopMax; heliobane-amiga docs/MEASURED.md "The MODs retuned")
  modLoopTol: 0.001, modLoopMax: 512,
  plan, post, trim: {}, samples: { 'gold bell': cut(0.7, 0.2), 'ritual drum': cut(0.35, 0.08) },
  title: 'Heliobane - Herald of the Source 4ch', mixvol: 48,
  message: 'HELIOBANE boss_w3 "Herald of the Source", 4-channel Amiga arrangement.\n178 BPM (the Valve\'s beat). Orders 1-8 loop.\n'
    + 'All samples synthesized. Source: songs/heliobane_boss_w3_amiga.gen.js; MOD via tools/json2mod.js',
}));
