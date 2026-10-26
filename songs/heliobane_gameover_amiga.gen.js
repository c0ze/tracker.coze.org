#!/usr/bin/env node
/**
 * HELIOBANE game-over jingle "Lance Unspent", arranged for 4 Paula channels
 * (Amiga port, exported with tools/json2mod.js). It reads the PC song's JSON
 * (heliobane_gameover.json, from heliobane_gameover.gen.js): every note, the
 * tempo (150 BPM, speed 6) and the 44 rows are the PC's; this file only says
 * which PC channels share each Paula channel (heliobane_amiga.kit.js).
 *
 * The PC plays it once. A MOD loops, so a silent one-row pattern follows
 * that jumps to itself (order 1): the jingle ends there, and a player can
 * stop the music once it reaches order 1.
 *
 * Channels (Paula 0 and 3 play left, 1 and 2 right):
 *   0 drums  the orchestra hit on the last chord (row 32)
 *   1 riff   the bass
 *   2 lead   the brass lead
 *   3 colour the arp chords (they sound all through, so the pad never would)
 * Dropped: the kick and the crash under the orchestra hit (row 32), the pad,
 * the pans.
 * MOD retune (2026-10-23; json2mod's ranged copies, heliobane-amiga
 * docs/MEASURED.md "The MODs retuned"): the arp pulse's chords voiced within
 * 7 semitones (narrowSongArps: a copy of a single-cycle loop images when a
 * chord's root sits 8 or more under its top); loops of at most 512 bytes
 * (modLoopMax): the stock game reads gameover.pak at each game over into
 * the overlay's spare chip RAM, 31,288 bytes (heliobane-amiga ovlgo.c), and
 * the retuned export (31,670 bytes) made the pack 35.5 KB.
 */
import { loadSong, arrange, writeSong } from './heliobane_amiga.kit.js';
import { narrowSongArps } from './heliobane_amiga_w23.kit.js';

const dir = new URL('.', import.meta.url).pathname;
const PC = { kick: 0, bass: 1, arp: 2, lead: 3, pad: 4, orch: 5, crash: 6 };
const song = loadSong(`${dir}heliobane_gameover.json`);

const plan = () => [[{ ch: PC.orch }], [{ ch: PC.bass }], [{ ch: PC.lead }], [{ ch: PC.arp, prefer: 'fx' }]];
const silence = { name: 'end: silence', rows: 1, channels: [{ 0: { fx: 'B01' } }, {}, {}, {}] };

writeSong(`${dir}heliobane_gameover_amiga.json`, narrowSongArps(arrange(song, {
  // chip RAM: shorter loops (json2mod modLoopTol, modLoopMax; heliobane-amiga docs/MEASURED.md "The MODs retuned")
  modLoopMax: 512,
  plan, trim: {}, extra: [silence], order: [0, 1],
  title: 'Heliobane - Lance Unspent 4ch', mixvol: 48,
  message: 'HELIOBANE game-over jingle "Lance Unspent", 4-channel Amiga arrangement.\nD minor, 150 BPM, plays once, then holds on a silent order 1.\n'
    + 'All samples synthesized. Source: songs/heliobane_gameover_amiga.gen.js; MOD via tools/json2mod.js',
}), /^arp pulse/));
