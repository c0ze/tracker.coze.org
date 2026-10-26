#!/usr/bin/env node
/**
 * HELIOBANE stage 3 "The Hollow Fleet", arranged for 4 Paula channels (Amiga
 * port, exported with tools/json2mod.js). It reads the PC song's JSON
 * (heliobane_stage3.json, from heliobane_stage3.gen.js), so every note,
 * chord, groove, the form and tempo (170 BPM, speed 6) are the PC's; this
 * file only says which PC channels share each Paula channel
 * (heliobane_amiga.kit.js). The PC game loops the song from the end of the
 * intro (manifest loop_offset 5.64 s): here B01 on the turn's last row.
 *
 * Channels (Paula 0 and 3 play left, 1 and 2 right):
 *   0 drums  kick and snare accents, then toms, hull clanks, ghost snares,
 *            hats (a hat or ghost never cuts a hit after one row)
 *   1 riff   the growl bass pumping 16ths
 *   2 lead   the war horn; where it rests: the pedal riff (R1, R2), the
 *            broadcast phrase (breakdown), the pad (intro), the arps (build)
 *   3 colour the pulse arps (each note keeps its chord: the quieter arps
 *            under a counter-line play at the others' level, as a MOD cell
 *            holds a volume or an arpeggio); the counter-line wins over them
 *            where there is one (A1', A2', C, CB); the riff's echo (R1, R2);
 *            the broadcast's echo, then the pad (breakdown); the pad (build);
 *            a crash on a section's first row where the PC has one (not over
 *            a counter-line note)
 * Dropped: the horn's echo, the pad under the requiem (D1, D2), the
 * per-channel pans. One-shots are cut to what the arrangement plays of them.
 * MOD retune (2026-10-23; json2mod's ranged copies, heliobane-amiga
 * docs/MEASURED.md "The MODs retuned"): loops within 0.0005 of their rate
 * (modLoopTol), for stock chip RAM.
 */
import { loadSong, arrange, jump, writeSong } from './heliobane_amiga.kit.js';

const dir = new URL('.', import.meta.url).pathname;
const PC = { lead: 0, echo: 1, counter: 2, arp: 3, bass: 4, ks: 5, hat: 6, clank: 7, tom: 8, pad: 9 };
const song = loadSong(`${dir}heliobane_stage3.json`);

const name = (e) => song.samples[e._inst ?? e.instrument]?.name ?? '';
const level = (e) => Number(e.vol?.slice(1) ?? 64);
const drums = [
  { ch: PC.ks, hold: 2, only: (r, e) => level(e) >= 30 },
  { ch: PC.tom, hold: 2, only: (r, e) => name(e) !== 'crash' },
  { ch: PC.clank, hold: 2 },
  { ch: PC.ks, hold: 1 },
  { ch: PC.hat, hold: 1 },
];
const crash = { ch: PC.tom, hold: 3, only: (r, e) => name(e) === 'crash' };

function plan(p) {
  const n = p.name;
  const arp = { ch: PC.arp, prefer: 'fx' };
  let lead = [{ ch: PC.lead }], colour = [crash, arp];
  if (/counter|^C/.test(n)) colour = [{ ch: PC.counter }, crash, arp];
  if (/^R[12]/.test(n)) [lead, colour] = [[{ ch: PC.counter }], [crash, { ch: PC.echo }]];
  if (/^breakdown/.test(n)) [lead, colour] = [[{ ch: PC.counter }], [{ ch: PC.echo }, { ch: PC.pad, prefer: 'fx' }]];
  if (/^intro/.test(n)) [lead, colour] = [[{ ch: PC.pad, prefer: 'fx' }], [{ ch: PC.arp }]];
  if (/^build/.test(n)) [lead, colour] = [[{ ch: PC.arp }], [{ ch: PC.pad, prefer: 'fx' }]];
  return [drums, [{ ch: PC.bass }], lead, colour];
}

const last = song.order.at(-1);
const post = (p, lanes, i) => { if (i === last) jump(lanes, p.rows - 1, 1); };

writeSong(`${dir}heliobane_stage3_amiga.json`, arrange(song, {
  // chip RAM: shorter loops (json2mod modLoopTol, modLoopMax; heliobane-amiga docs/MEASURED.md "The MODs retuned")
  modLoopTol: 0.0005,
  plan, post, trim: {},
  title: 'Heliobane - The Hollow Fleet 4ch', mixvol: 48,
  message: 'HELIOBANE stage 3 "The Hollow Fleet", 4-channel Amiga arrangement.\nD minor -> Eb minor, 170 BPM. Orders 1-17 loop.\n'
    + 'All samples synthesized. Source: songs/heliobane_stage3_amiga.gen.js; MOD via tools/json2mod.js',
}));
