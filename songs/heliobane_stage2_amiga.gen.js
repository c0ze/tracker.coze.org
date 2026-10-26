#!/usr/bin/env node
/**
 * HELIOBANE stage 2 "Verdigris Tide", arranged for 4 Paula channels (Amiga
 * port, exported with tools/json2mod.js). It reads the PC song's JSON
 * (heliobane_stage2.json, from heliobane_stage2.gen.js), so every note,
 * chord, groove, the form, tempo (165 BPM, speed 6) and the loop (orders
 * 1-9, B01 on the turn's last row) are the PC's; this file only says which
 * PC channels share each Paula channel (heliobane_amiga.kit.js).
 *
 * Channels (Paula 0 and 3 play left, 1 and 2 right). In play, effects take
 * channel 3 and voice lines channel 0 (docs/AUDIO.md "The channel plan"),
 * so the bass shares channel 1 with the tide:
 *   0 drums  kick, snare and hats: the snare wins a shared row, and a hat
 *            never cuts a kick or snare after one row
 *   1 riff   the bell tide (16th arpeggios of each chord), with the bass
 *            interleaved: each bass note sounds for its first row, in place
 *            of that row's tide note (in the intro and the abyss, where the
 *            bass holds a whole bar, for 4 rows)
 *   2 lead   glass lead; the bell melody in the abyss
 *   3 colour the lead's echo (A2, B, A3) or the written harmony (A up, B up);
 *            the tide canon (intro, abyss) and the bell octave (A3) where the
 *            echo rests; the noise riser (build); a crash on a section's
 *            first row when the channel is free for 3 rows
 * One-shots are cut to what the arrangement plays of them; the crash to
 * 0.8 s (faded from 0.6 s).
 * Dropped: the pad, the per-channel pans; tide notes under bass notes.
 */
import { loadSong, arrange, oneShot, retrigRoll, writeSong } from './heliobane_amiga.kit.js';

const dir = new URL('.', import.meta.url).pathname;
const PC = { kick: 0, snare: 1, hat: 2, bass: 3, tide: 4, canon: 5, lead: 6, echo: 7, pad: 8, fx: 9 };
const song = loadSong(`${dir}heliobane_stage2.json`);

const drums = [{ ch: PC.snare, hold: 2 }, { ch: PC.kick, hold: 2 }, { ch: PC.hat, hold: 1 }];
// The bell octave (A3) goes up to C#8: with the tide from F#4, more than
// one MOD sample spans (33 semitones), so it plays a second copy of the bell.
const BELL = song.samples.findIndex((x) => x.name === 'bell');
const BELL_HI = song.samples.push({ ...song.samples[BELL], name: 'bell hi' }) - 1;

const name = (e) => song.samples[e._inst ?? e.instrument]?.name ?? '';

function plan(p) {
  const long = /^(intro|abyss)/.test(p.name);
  const riff = [{ ch: PC.bass, hold: long ? 4 : 1 }, { ch: PC.tide }];
  const canon = { ch: PC.canon, ...(/^A3/.test(p.name) ? { inst: BELL_HI } : {}) };
  const colour = [{ ch: PC.echo }, canon, { ch: PC.fx, need: 3, only: (r, e) => name(e) === 'crash' },
    { ch: PC.fx, only: (r, e) => name(e) === 'noise loop' }];
  return [drums, riff, [{ ch: PC.lead }], colour];
}

// The build's snare roll: 16ths rising for half a bar, then 32nd retrigs at
// the snare's full level (v54), as in stage 1.
const post = (p, lanes) => { if (p.name.startsWith('build')) retrigRoll(lanes[0], 48, 64, 54); };

// The crash rings on the colour channel when nothing cuts it: cut to 0.8 s,
// faded over its last 0.2 s, as the title's (chip RAM; at 0.6 s it is 12 dB
// below its loudest 50 ms, measured).
const shortCrash = (d) => oneShot(d, { seconds: 0.8, fade: 0.2 });

writeSong(`${dir}heliobane_stage2_amiga.json`, arrange(song, {
  plan, post, trim: {}, samples: { crash: shortCrash },
  title: 'Heliobane - Verdigris Tide 4ch', mixvol: 48,
  message: 'HELIOBANE stage 2 "Verdigris Tide", 4-channel Amiga arrangement.\nB minor -> C# minor, 165 BPM. Orders 1-9 loop.\n'
    + 'All samples synthesized. Source: songs/heliobane_stage2_amiga.gen.js; MOD via tools/json2mod.js',
}));
