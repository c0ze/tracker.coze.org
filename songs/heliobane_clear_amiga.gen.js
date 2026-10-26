#!/usr/bin/env node
/**
 * HELIOBANE stage-clear jingle "Herald Down", arranged for 4 Paula channels
 * (Amiga port, exported with tools/json2mod.js). It reads the PC song's JSON
 * (heliobane_clear.json, from heliobane_clear.gen.js): every note, the
 * tempo (150 BPM, speed 6) and the 48 rows are the PC's; this file only says
 * which PC channels share each Paula channel (heliobane_amiga.kit.js).
 *
 * The PC plays it once. A MOD loops, so a silent one-row pattern follows
 * that jumps to itself (order 1): the jingle ends there, and a player can
 * stop the music once it reaches order 1.
 *
 * Channels (Paula 0 and 3 play left, 1 and 2 right):
 *   0 drums  kick, snare, hats; the orchestra hits of bar 2 (rows 16, 24)
 *            in place of the kicks under them; the crash on the last chord
 *            (row 32) in place of the kick and the orchestra hit there
 *   1 riff   the bass
 *   2 lead   the lead
 *   3 colour the brass a third below (bars 2-3); the arp pulses (bar 1)
 * The crash is cut to 0.8 s (faded from 0.6 s) to save chip RAM.
 * Dropped: the pad, the last orchestra hit and kick (row 32), the pans.
 * MOD retune (2026-10-23; json2mod's ranged copies, heliobane-amiga
 * docs/MEASURED.md "The MODs retuned"): the arp pulse's chords voiced within
 * 7 semitones (narrowSongArps: a copy of a single-cycle loop images when a
 * chord's root sits 8 or more under its top); loops of at most 512 bytes
 * (modLoopMax), so the resident jingle stays under its old size.
 */
import { loadSong, arrange, oneShot, writeSong } from './heliobane_amiga.kit.js';
import { narrowSongArps } from './heliobane_amiga_w23.kit.js';

const dir = new URL('.', import.meta.url).pathname;
const PC = { kick: 0, snare: 1, hat: 2, bass: 3, arp: 4, lead: 5, brass: 6, pad: 7, orch: 8, crash: 9 };
const song = loadSong(`${dir}heliobane_clear.json`);

const plan = () => [
  [{ ch: PC.crash }, { ch: PC.orch, hold: 2, to: 32 }, { ch: PC.snare, hold: 2 }, { ch: PC.kick, hold: 2 }, { ch: PC.hat, hold: 1 }],
  [{ ch: PC.bass }], [{ ch: PC.lead }], [{ ch: PC.brass }, { ch: PC.arp, prefer: 'fx' }],
];
const silence = { name: 'end: silence', rows: 1, channels: [{ 0: { fx: 'B01' } }, {}, {}, {}] };

// The crash is the biggest sample (27 KB at 1.3 s): cut to 0.8 s, faded over
// its last 0.2 s (at 0.6 s it is 11 dB below its loudest 50 ms, measured).
const shortCrash = (d) => oneShot(d, { seconds: 0.8, fade: 0.2 });

writeSong(`${dir}heliobane_clear_amiga.json`, narrowSongArps(arrange(song, {
  // chip RAM: shorter loops (json2mod modLoopTol, modLoopMax; heliobane-amiga docs/MEASURED.md "The MODs retuned")
  modLoopMax: 512,
  plan, trim: {}, samples: { crash: shortCrash }, extra: [silence], order: [0, 1],
  title: 'Heliobane - Herald Down 4ch', mixvol: 48,
  message: 'HELIOBANE stage-clear jingle "Herald Down", 4-channel Amiga arrangement.\nD major, 150 BPM, plays once, then holds on a silent order 1.\n'
    + 'All samples synthesized. Source: songs/heliobane_clear_amiga.gen.js; MOD via tools/json2mod.js',
}), /^arp pulse/));
