#!/usr/bin/env node
/**
 * HELIOBANE boss_w2 "Herald of the Wake" (World 2's Herald fights,
 * worlds.json boss_music), arranged for 4 Paula channels (Amiga port,
 * exported with tools/json2mod.js). It reads the PC song's JSON
 * (heliobane_boss_w2.json, from heliobane_boss_w2.gen.js), so every note,
 * chord, groove, the form, tempo (176 BPM, speed 6) and loop (orders 1-8,
 * B01 on the break's last row) are the PC's; this file only says which PC
 * channels share each Paula channel (heliobane_amiga.kit.js,
 * heliobane_amiga_w23.kit.js).
 *
 * Channels (Paula 0 and 3 play left, 1 and 2 right). In play, effects take
 * channel 3 and voice lines channel 0 (docs/AUDIO.md "The channel plan"):
 *   0 drums  snare and tom, kick, hats (a hat never cuts a hit after one
 *            row)
 *   1 riff   the grit bass; where the power-chord stabs fall on the bass's
 *            pitch class, one merged loop (bass + chord in unison, or the
 *            chord an octave up), as the World 1 boss's riff
 *   2 lead   the glass saw lead and the siren; the orchestra hits (shatter)
 *   3 colour the lead's echo or the written harmony (A up, B up); the J
 *            arps (A2, B, alarm) and the glass shell line where those rest;
 *            a crash when the channel is free for 3 rows
 * The glass line spans A-5 to F-8: from F-7 up it plays a second copy of
 * the glass shell (a MOD sample spans 3 octaves, and json2mod fits its top
 * note).
 * Dropped: the second echo (echo2), the pad, the stabs off the bass's
 * pitch class, the pans.
 * One-shots are cut to what the arrangement plays of them.
 * MOD retune (2026-10-23; json2mod's ranged copies, heliobane-amiga
 * docs/MEASURED.md "The MODs retuned"): the arp pulse's chords voiced within
 * 7 semitones, their roots in F-4..E-5 (narrowSongArps); the crash cut to
 * 0.6 s of 1.4 (faded from 0.45 s; 12.3 dB below its loudest 50 ms at 0.6
 * s); loops within 0.0007 of their rate or 1,024 bytes (modLoopTol,
 * modLoopMax), for stock chip RAM.
 */
import { loadSong, arrange, writeSong } from './heliobane_amiga.kit.js';
import { octaveMix, splitLine, keepOnly, cut, narrowSongArps, splitGlides } from './heliobane_amiga_w23.kit.js';
import { nn } from './lib.js';

const dir = new URL('.', import.meta.url).pathname;
const PC = { kick: 0, snare: 1, hat: 2, bass: 3, gtr: 4, arp: 5, glass: 6, lead: 7, echo: 8, echo2: 9, pad: 10, fx: 11 };
const song = loadSong(`${dir}heliobane_boss_w2.json`);

const name = (e) => song.samples[e._inst ?? e.instrument]?.name ?? '';
const drums = [{ ch: PC.snare, hold: 2 }, { ch: PC.kick, hold: 2 }, { ch: PC.hat, hold: 1 }];
const riff = octaveMix(song, { bass: PC.bass, riff: PC.gtr, bassSample: 'grit bass', chordSample: 'power chord' });
const glass = splitLine(song, PC.glass, 'glass shell', 89);

function plan(p) {
  // The fx channel holds the crashes and (shatter) the orchestra hits: the
  // crash takes a copy with only the crashes (a hit after a crash would
  // otherwise come through as the crash's next row).
  const crash = { ch: keepOnly(p, PC.fx, (e) => name(e) === 'crash'), need: 3 };
  const lead = /^shatter/.test(p.name) ? [{ ch: keepOnly(p, PC.fx, (e) => name(e) === 'orchestra hit') }] : [{ ch: PC.lead }];
  return [drums, riff(p), lead, [{ ch: PC.echo }, { ch: PC.arp, prefer: 'fx' }, ...glass, crash]];
}

// the falling siren's chained glides, each from a restarted note (splitGlides)
const post = (p, lanes) => { if (/^alarm/.test(p.name)) splitGlides(lanes[2]); };

writeSong(`${dir}heliobane_boss_w2_amiga.json`, narrowSongArps(arrange(song, {
  // chip RAM: shorter loops (json2mod modLoopTol, modLoopMax; heliobane-amiga docs/MEASURED.md "The MODs retuned")
  modLoopTol: 0.0007, modLoopMax: 1024,
  plan, post, trim: {}, samples: { crash: cut(0.6, 0.15) },
  title: 'Heliobane - Herald of the Wake 4ch', mixvol: 48,
  message: 'HELIOBANE boss_w2 "Herald of the Wake", 4-channel Amiga arrangement.\n176 BPM. Orders 1-8 loop.\n'
    + 'All samples synthesized. Source: songs/heliobane_boss_w2_amiga.gen.js; MOD via tools/json2mod.js',
}), /^arp pulse/, { window: [nn('F-4'), nn('E-5')] }));
