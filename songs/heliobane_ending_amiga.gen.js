#!/usr/bin/env node
/**
 * HELIOBANE ending (World 1's relay ending: 12 voice lines play over it),
 * arranged for 4 Paula channels (Amiga port, exported with
 * tools/json2mod.js). It reads the PC song's JSON (heliobane_ending.json,
 * from heliobane_ending.gen.js), so every note, chord, the form, the tempo
 * (120 BPM, speed 6) and the loop (the whole piece, B00 on the beacon's
 * last row) are the PC's; this file only says which PC channels share each
 * Paula channel (heliobane_amiga.kit.js).
 *
 * Channels (Paula 0 and 3 play left, 1 and 2 right), as stage 1. The voice
 * takes channel 0 in the game, so it carries only the drums, and they rest
 * in dawn (but its closing snare pickup), Mott, home and the beacon:
 *   0 drums  a crash on a bar's first row (in place of the kick there),
 *            snare, kick, hats; the brushes (bittersweet)
 *   1 riff   the bass (anthem, triangle)
 *   2 lead   the lead (hero, then soft); the music box (dawn, Mott, home,
 *            "Kid-do?"); the beacon's pings
 *   3 colour the lead's echo (A1, A2, B) or the written harmony (A1 +
 *            harmony, A2 end), the 16th arps where those rest; the pad's
 *            chords (dawn, bittersweet, Mott, home, beacon)
 * Dropped: the pad in the anthem sections (A1 to A2 end); the echo and the
 * arps in the bittersweet sections; the music box's echo (home); the kicks
 * under a crash; the pans.
 * One-shots are cut to what the arrangement plays of them.
 */
import { loadSong, arrange, jump, writeSong } from './heliobane_amiga.kit.js';

const dir = new URL('.', import.meta.url).pathname;
const PC = { lead: 0, echo: 1, arp: 2, pluck: 3, bass: 4, kick: 5, snare: 6, hat: 7, pad: 8, beacon: 9 };
const song = loadSong(`${dir}heliobane_ending.json`);

const name = (e) => song.samples[e._inst ?? e.instrument]?.name ?? '';
const drums = [
  { ch: PC.hat, hold: 4, only: (r, e) => name(e) === 'crash' },
  { ch: PC.snare, hold: 2 },
  { ch: PC.kick, hold: 2 },
  { ch: PC.hat, hold: 1, only: (r, e) => name(e) !== 'crash' },
];
const pad = [{ ch: PC.pad, prefer: 'fx' }];

function plan(p) {
  const n = p.name;
  const bass = [{ ch: PC.bass }];
  if (/^(A|B )/.test(n)) return [drums, bass, [{ ch: PC.lead }], [{ ch: PC.echo }, { ch: PC.arp }]];
  if (/^bittersweet/.test(n)) return [drums, bass, [{ ch: PC.lead }], pad];
  if (/^beacon/.test(n)) return [drums, bass, [{ ch: PC.pluck }, { ch: PC.beacon }], pad];
  if (/^(dawn|Mott|home)/.test(n)) return [drums, bass, [{ ch: PC.pluck }], pad];
  throw new Error(`unplanned pattern ${n}`);
}

/**
 * The beacon's last pad chord fades out before the loop (v16 to v1 over a
 * bar). A MOD cell holds the arpeggio (Jxy) or the volume step, so that bar
 * plays the pad's root alone, fading.
 */
function fadeLastPad(ch, p) {
  const src = p.channels[PC.pad];
  ch[48] = { note: src[48].note, instrument: ch[48].instrument, vol: src[48].vol };
  for (let r = 49; r < p.rows; r++) ch[r] = { vol: src[r].vol };
}

const last = song.order.at(-1);
function post(p, lanes, i) {
  if (i !== last) return;
  fadeLastPad(lanes[3], p);
  jump(lanes, p.rows - 1, 0);
}

writeSong(`${dir}heliobane_ending_amiga.json`, arrange(song, {
  plan, post, trim: {},
  title: 'Heliobane - Ending 4ch', mixvol: 48,
  message: 'HELIOBANE ending (World 1, the relay), 4-channel Amiga arrangement.\nD major, 120 BPM. Loops from order 0.\n'
    + 'All samples synthesized. Source: songs/heliobane_ending_amiga.gen.js; MOD via tools/json2mod.js',
}));
