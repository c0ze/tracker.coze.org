#!/usr/bin/env node
/**
 * HELIOBANE shop "The Magpie", arranged for 4 Paula channels (Amiga port,
 * exported with tools/json2mod.js). It reads the PC song's JSON
 * (heliobane_shop.json, from heliobane_shop.gen.js), so every note, chord,
 * groove, the form and tempo (120 BPM, swung: speed 7 and 5 on alternate
 * rows) are the PC's; this file only says which PC channels share each
 * Paula channel (heliobane_amiga.kit.js). The swing's speed commands (a
 * control channel on the PC) go to a free effect slot on each row. The PC
 * game loops the song from the end of the intro (manifest loop_offset
 * 7.99 s): here B01 on the last pattern's last row.
 *
 * Channels (Paula 0 and 3 play left, 1 and 2 right):
 *   0 drums  kick and snare, then cowbell, toms and crash, then hats (a hat
 *            never cuts a hit after one row)
 *   1 riff   the bass (walking, slap)
 *   2 lead   the lead and the whistle
 *   3 colour the clav chords (each note keeps its chord, at the level most of
 *            them have), and the lead's echo where the clav rests
 * Dropped: the pans. One-shots are cut to what the arrangement plays of them.
 * Changed for the MOD's tuning (cozy-tracker json2mod's ranged copies, which
 * mod-check judges): the clav's chords are voiced within 7 semitones; the
 * first wolf whistle (breakdown) restarts on its top note the row before it
 * falls, so its rise and its fall play from two copies (a glide plays from
 * one, and no copy holds G-5, D-6 and G#5 within 3 cents on ProTracker's
 * periods). The second one's rise stops half a semitone under F-6 (on the PC
 * too), so a restart would jump: it stays one glide.
 */
import { loadSong, arrange, jump, writeSong } from './heliobane_amiga.kit.js';
import { narrowSongArps, splitGlides } from './heliobane_amiga_w23.kit.js';
import { nn } from './lib.js';

const dir = new URL('.', import.meta.url).pathname;
const PC = { swing: 0, lead: 1, echo: 2, clav: 3, bass: 4, ks: 5, hat: 6, perc: 7 };
const song = loadSong(`${dir}heliobane_shop.json`);

const plan = () => [
  [{ ch: PC.ks, hold: 2 }, { ch: PC.perc, hold: 2 }, { ch: PC.hat, hold: 1 }],
  [{ ch: PC.bass }], [{ ch: PC.lead }], [{ ch: PC.clav, prefer: 'fx' }, { ch: PC.echo }],
];
const last = song.order.at(-1);
const post = (p, lanes, i) => {
  // the swing: speed 7 on even rows, 5 on odd; the second whistle's rise
  // (A-5 to F-6 at G0C) stops 7.5 semitones up on the PC too, so it stays one glide
  if (/^breakdown/.test(p.name)) splitGlides(lanes[2], { speed: (r) => (r % 2 ? 5 : 7), keepShort: true });
  if (i === last) jump(lanes, p.rows - 1, 1);
};

writeSong(`${dir}heliobane_shop_amiga.json`, narrowSongArps(arrange(song, {
  plan, post, trim: {},
  title: 'Heliobane - The Magpie 4ch', mixvol: 50,
  message: 'HELIOBANE shop "The Magpie", 4-channel Amiga arrangement.\nF blues shuffle, 120 BPM, swung 16ths (speed 7/5). Orders 1-9 loop.\n'
    + 'All samples synthesized. Source: songs/heliobane_shop_amiga.gen.js; MOD via tools/json2mod.js',
}), /^clav pulse/, { window: [nn('C-4'), nn('B-4')] }));
