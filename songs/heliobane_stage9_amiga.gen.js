#!/usr/bin/env node
/**
 * HELIOBANE stage 9 "Cold Harbour", arranged for 4 Paula channels (Amiga
 * port, exported with tools/json2mod.js). It reads the PC song's JSON
 * (heliobane_stage9.json, from heliobane_stage9.gen.js), so every note,
 * chord, groove, the form, tempo (160 BPM, speed 6) and loop (orders 1-8,
 * B01 on the turn's last row) are the PC's; this file only says which PC
 * channels share each Paula channel (heliobane_amiga.kit.js,
 * heliobane_amiga_w23.kit.js).
 *
 * Channels (Paula 0 and 3 play left, 1 and 2 right). In play, effects take
 * channel 3 and voice lines channel 0 (docs/AUDIO.md "The channel plan"):
 *   0 drums  snare and tom, kick, the dock's metal (hull clank, anvil,
 *            steam), hats (a hat never cuts a hit after one row)
 *   1 riff   the grit bass and the drop power chord as one loop: they play
 *            every note together, in unison or the chord an octave up (one
 *            merged loop for each), as stage 1's riff chord
 *   2 lead   the cold horn; the siren (intro, press)
 *   3 colour the metal's echo (intro); the lead's echo or the written
 *            harmony (A up, B up); the machine-pulse arps (A2, A up) and
 *            the beacon (press) where those rest; the noise riser (build);
 *            a crash when the channel is free for 3 rows
 * Dropped: the second echo (echo2), the pad, the pans.
 * Changed: the build's snare roll rises in 16ths over its first half, then
 * retrigs at that level; the riser alternates volume rows with slide rows.
 * One-shots are cut to what the arrangement plays of them; for chip RAM (the
 * first export was 95.3 KB) the crash to 0.6 s of 1.4 (faded from 0.45 s,
 * where it is 13 dB below its loudest 50 ms at 0.6 s), the steam to 0.3 s of
 * 0.4 (faded from 0.22 s; 22.9 dB down at 0.3 s), the hull clank to 0.35 s
 * of 0.6 (faded from 0.27 s; 14.9 dB down at 0.35 s), the noise loop to its
 * first half (measured on the PC's PCM).
 * MOD retune (2026-10-23; json2mod's ranged copies, heliobane-amiga
 * docs/MEASURED.md "The MODs retuned"): loops within 0.0007 of their rate
 * (modLoopTol) and the shorter crash, steam and hull clank above, for stock
 * chip RAM (the retuned export was 85.1 KB).
 */
import { loadSong, arrange, writeSong } from './heliobane_amiga.kit.js';
import { octaveMix, roll, alternate, cut, halfNoise } from './heliobane_amiga_w23.kit.js';

const dir = new URL('.', import.meta.url).pathname;
const PC = { kick: 0, snare: 1, hat: 2, metal: 3, bass: 4, gtr: 5, arp: 6, lead: 7, echo: 8, echo2: 9, pad: 10, fx: 11 };
const song = loadSong(`${dir}heliobane_stage9.json`);

const name = (e) => song.samples[e._inst ?? e.instrument]?.name ?? '';
const drums = [{ ch: PC.snare, hold: 2 }, { ch: PC.kick, hold: 2 }, { ch: PC.metal, hold: 2 }, { ch: PC.hat, hold: 1 }];
const crash = { ch: PC.fx, need: 3, only: (r, e) => name(e) === 'crash' };
const riser = { ch: PC.fx, only: (r, e) => name(e) === 'noise loop' };
const riff = octaveMix(song, { bass: PC.bass, riff: PC.gtr, bassSample: 'grit bass', chordSample: 'drop power chord' });

function plan(p) {
  const colour = [{ ch: PC.echo }, { ch: PC.arp, prefer: 'fx' }, crash];
  if (/^build/.test(p.name)) colour.unshift(riser);
  return [drums, riff(p), [{ ch: PC.lead }], colour];
}

function post(p, lanes) {
  if (/^build/.test(p.name)) { roll(lanes[0], 48, 64); alternate(lanes[3], p.channels[PC.fx]); }
}

writeSong(`${dir}heliobane_stage9_amiga.json`, arrange(song, {
  // chip RAM: shorter loops (json2mod modLoopTol, modLoopMax; heliobane-amiga docs/MEASURED.md "The MODs retuned")
  modLoopTol: 0.0007,
  plan, post, trim: {}, samples: { crash: cut(0.6, 0.15), steam: cut(0.3, 0.08), 'hull clank': cut(0.35, 0.08), 'noise loop': halfNoise },
  title: 'Heliobane - Cold Harbour 4ch', mixvol: 48,
  message: 'HELIOBANE stage 9 "Cold Harbour", 4-channel Amiga arrangement.\n160 BPM. Orders 1-8 loop.\n'
    + 'All samples synthesized. Source: songs/heliobane_stage9_amiga.gen.js; MOD via tools/json2mod.js',
}));
