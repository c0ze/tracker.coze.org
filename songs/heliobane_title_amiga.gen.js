#!/usr/bin/env node
/**
 * HELIOBANE title "Sun-Killer", arranged for 4 Paula channels (Amiga port,
 * exported with tools/json2mod.js). It reads the PC song's JSON
 * (heliobane_title.json, from heliobane_title.gen.js), so every note, chord,
 * groove, the form, tempo (156 BPM, speed 6) and the loop (orders 1-8, B01
 * on the tag's last row) are the PC's; this file only says which PC
 * channels share each Paula channel (heliobane_amiga.kit.js).
 *
 * Channels (Paula 0 and 3 play left, 1 and 2 right), as stage 1:
 *   0 drums  kick and snare (the snare wins a shared row); the orchestra hits
 *            (intro, build, tag) in place of the kicks under them; hats too
 *            where the colour channel is busy (a hat never cuts a hit after
 *            one row)
 *   1 riff   the bass
 *   2 lead   the lead; the brass fanfare (intro)
 *   3 colour hats (intro, A, tag), the lead's echo (A2, B), the broken-chord
 *            shimmer (breakdown), the noise riser (build), the written
 *            harmony (A up, B up); a crash on a section's first row when the
 *            channel is free for 3 rows
 * The crash is cut to 0.8 s (faded from 0.6 s) to save chip RAM.
 * Dropped: the J-arpeggio chords (all but the breakdown's shimmer), the pad,
 * the shimmer's 3-row canon, the pans. The build's snare roll: 16ths rising
 * for half a bar, then 32nd retrigs at full level (as stage 1). One-shots
 * are cut to what the arrangement plays of them.
 */
import { loadSong, arrange, oneShot, retrigRoll, writeSong } from './heliobane_amiga.kit.js';

const dir = new URL('.', import.meta.url).pathname;
const PC = { kick: 0, snare: 1, hat: 2, bass: 3, arp: 4, lead: 5, echo: 6, pad: 7, orch: 8, crash: 9 };
const song = loadSong(`${dir}heliobane_title.json`);

const name = (e) => song.samples[e._inst ?? e.instrument]?.name ?? '';
const crash = { ch: PC.crash, need: 3, only: (r, e) => name(e) === 'crash' };
const hats = [{ ch: PC.hat }, crash];

function plan(p) {
  let colour = hats;
  if (/^(A2|B:)/.test(p.name) || /up/.test(p.name)) colour = [{ ch: PC.echo }, crash];
  if (/^breakdown/.test(p.name)) colour = [{ ch: PC.arp }];
  if (/^build/.test(p.name)) colour = [{ ch: PC.crash }];
  const drums = [{ ch: PC.orch, hold: 2 }, { ch: PC.snare, hold: 2 }, { ch: PC.kick, hold: 2 }];
  if (colour !== hats) drums.push({ ch: PC.hat, hold: 1 });
  return [drums, [{ ch: PC.bass }], [{ ch: PC.lead }], colour];
}
const post = (p, lanes) => { if (p.name.startsWith('build')) retrigRoll(lanes[0], 48, 64, 58); };

// The crash is the biggest sample (27 KB at 1.3 s): cut to 0.8 s, faded over
// its last 0.2 s (at 0.6 s it is 13 dB below its loudest 50 ms, measured).
const shortCrash = (d) => oneShot(d, { seconds: 0.8, fade: 0.2 });

writeSong(`${dir}heliobane_title_amiga.json`, arrange(song, {
  plan, post, trim: {}, samples: { crash: shortCrash },
  title: 'Heliobane - Sun-Killer 4ch', mixvol: 48,
  message: 'HELIOBANE title "Sun-Killer", 4-channel Amiga arrangement.\nD minor -> E minor, 156 BPM. Orders 1-8 loop.\n'
    + 'All samples synthesized. Source: songs/heliobane_title_amiga.gen.js; MOD via tools/json2mod.js',
}));
