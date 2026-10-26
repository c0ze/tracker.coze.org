#!/usr/bin/env node
/**
 * HELIOBANE stage 4 "Cinder Crown", arranged for 4 Paula channels (Amiga
 * port, exported with tools/json2mod.js). It reads the PC song's JSON
 * (heliobane_stage4.json, from heliobane_stage4.gen.js), so every note,
 * chord, groove, the form and tempo (175 BPM, speed 6) are the PC's; this
 * file only says which PC channels share each Paula channel
 * (heliobane_amiga.kit.js). The PC game loops the song from the end of the
 * intro (manifest loop_offset 5.49 s): here B01 on the turn's last row.
 *
 * Channels (Paula 0 and 3 play left, 1 and 2 right):
 *   0 drums  snare, anvil, kick, hats (a hat never cuts a hit after one row)
 *   1 riff   power chords and bass merged, as in stage 1: they play the same
 *            riff an octave apart, so one loop (the PC's power chord over the
 *            PC's forge bass an octave down) carries both. The low-E
 *            breakdowns, where both chug on E-3: the two in unison, one loop.
 *            The intro before the bass enters: the power chord alone
 *   2 lead   the lead; the shred sweeps where it rests (R1, breakdown 2,
 *            solo 1, R2)
 *   3 colour the twin lead (choruses, V1/V2 with twin) or the lead's echo;
 *            a crash where the PC has one and the channel is free for 3 rows
 * Dropped: the bass notes that are not the power chord's octave (4 in the
 * pre-chorus), the per-channel pans. One-shots are cut to what the
 * arrangement plays of them.
 */
import { loadSong, arrange, jump, mixLoops, writeSong } from './heliobane_amiga.kit.js';

const dir = new URL('.', import.meta.url).pathname;
const PC = { lead: 0, twin: 1, pc: 2, bass: 3, kick: 4, snare: 5, hat: 6, anvil: 7, shred: 8 };
const song = loadSong(`${dir}heliobane_stage4.json`);
const byName = (n) => song.samples.findIndex((s) => s.name === n);
const [chord, fbass] = [song.samples[byName('power chord')], song.samples[byName('forge bass')]];
const RIFF = song.samples.push(mixLoops('riff chord', [[chord, 0, 0.7], [fbass, -1, 0.62]])) - 1;
const CHUG = song.samples.push(mixLoops('chug chord', [[chord, 0, 0.7], [fbass, 0, 0.62]])) - 1;

const name = (e) => song.samples[e._inst ?? e.instrument]?.name ?? '';
const drums = [
  { ch: PC.snare, hold: 2 },
  { ch: PC.anvil, hold: 2, only: (r, e) => name(e) !== 'crash china' },
  { ch: PC.kick, hold: 2 },
  { ch: PC.hat, hold: 1 },
];
const colour = [{ ch: PC.twin }, { ch: PC.anvil, need: 3, only: (r, e) => name(e) === 'crash china' }];

function plan(p) {
  let riff = [{ ch: PC.pc, inst: RIFF }];
  if (/^breakdown/.test(p.name)) riff = [{ ch: PC.pc, inst: CHUG }];
  if (/^intro/.test(p.name)) riff = [{ ch: PC.pc, to: 32 }, { ch: PC.pc, from: 32, inst: RIFF }];
  return [drums, riff, [{ ch: PC.lead }, { ch: PC.shred }], colour];
}

const last = song.order.at(-1);
const post = (p, lanes, i) => { if (i === last) jump(lanes, p.rows - 1, 1); };

writeSong(`${dir}heliobane_stage4_amiga.json`, arrange(song, {
  plan, post, trim: {},
  title: 'Heliobane - Cinder Crown 4ch', mixvol: 48,
  message: 'HELIOBANE stage 4 "Cinder Crown", 4-channel Amiga arrangement.\nE minor -> F# minor, 175 BPM. Orders 1-17 loop.\n'
    + 'All samples synthesized. Source: songs/heliobane_stage4_amiga.gen.js; MOD via tools/json2mod.js',
}));
