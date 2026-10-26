#!/usr/bin/env node
/**
 * HELIOBANE boss "Herald" (every World 1 Herald fight: worlds.json has no
 * boss_music for World 1, so Worlds.boss_music gives "boss"), arranged for 4
 * Paula channels (Amiga port, exported with tools/json2mod.js). It reads the
 * PC song's JSON (heliobane_boss.json, from heliobane_boss.gen.js), so every
 * note, chord, groove, the form, tempo (176 BPM, speed 6) and loop (orders
 * 1-8, B01 on the break's last row) are the PC's; this file only says which
 * PC channels share each Paula channel (heliobane_amiga.kit.js).
 *
 * Channels (Paula 0 and 3 play left, 1 and 2 right), as stage 1:
 *   0 drums  kick and snare (the snare wins a shared row); hats too where the
 *            colour channel is busy (a hat never cuts a hit after one row)
 *   1 riff   the 16th saw-bass ostinato. The power-chord stabs fall on its
 *            accents on the same root, so those notes play one loop: the
 *            PC's grit bass under the PC's power chord an octave up (a stab
 *            the PC plays in the bass's own octave, G to B, sounds an octave
 *            higher). Where a stab is not on the bass's pitch (the ostinato's
 *            b2 and b6 turns) the bass plays alone
 *   2 lead   the saw lead and siren; the orchestra hits in the hammer
 *   3 colour hats (intro, A, hammer, break), the lead's echo (A2, B), the
 *            written harmony (A up, B up), the 16th arp alarm (alarm: every
 *            note keeps its chord, so the soft ones play at the accents'
 *            level; a MOD cell holds one of the two); a crash
 *            on a section's first row when the channel is free for 3 rows
 * Dropped: the J-arp pulses (A2, B, A up, B up), the pad, the stabs that are
 * not on the bass's pitch, the per-channel pans. One-shots are cut to what
 * the arrangement plays of them.
 * MOD retune (2026-10-23; json2mod's ranged copies, heliobane-amiga
 * docs/MEASURED.md "The MODs retuned"): the arp pulse's chords voiced within
 * 7 semitones, their roots in G#4..G-5 (narrowSongArps: a copy of a single-
 * cycle loop images when a chord's root sits 8 or more under its top); loops
 * of at most 1,024 bytes (modLoopMax), for stock chip RAM.
 */
import { loadSong, arrange, mixLoops, writeSong } from './heliobane_amiga.kit.js';
import { narrowSongArps } from './heliobane_amiga_w23.kit.js';
import { nn } from './lib.js';

const dir = new URL('.', import.meta.url).pathname;
const PC = { kick: 0, snare: 1, hat: 2, bass: 3, gtr: 4, arp: 5, lead: 6, echo: 7, pad: 8, fx: 9 };
const song = loadSong(`${dir}heliobane_boss.json`);
const byName = (n) => song.samples[song.samples.findIndex((s) => s.name === n)];
const STAB = song.samples.push(mixLoops('bass + stab', [[byName('grit bass'), 0, 1], [byName('power chord'), 1, 0.75]])) - 1;

const name = (e) => song.samples[e._inst ?? e.instrument]?.name ?? '';
const pcl = (n) => ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'].indexOf(n.slice(0, 2));
const crash = { ch: PC.fx, need: 3, only: (r, e) => name(e) === 'crash' };
const hats = [{ ch: PC.hat }, crash];

function plan(p) {
  const stabAt = (r, e) => { const s = p.channels[PC.gtr][r]?.note; return s && s !== '^^' && pcl(s) === pcl(e.note); };
  const riff = [{ ch: PC.bass, inst: STAB, only: stabAt }, { ch: PC.bass }];
  let lead = [{ ch: PC.lead }], colour = hats;
  if (/^(A2|B)/.test(p.name) || /up/.test(p.name)) colour = [{ ch: PC.echo }, crash];
  if (/^alarm/.test(p.name)) colour = [{ ch: PC.arp, prefer: 'fx' }, crash];
  if (/^hammer/.test(p.name)) lead = [{ ch: PC.fx, only: (r, e) => name(e) === 'orchestra hit' }];
  const drums = [{ ch: PC.snare, hold: 2 }, { ch: PC.kick, hold: 2 }];
  if (colour !== hats) drums.push({ ch: PC.hat, hold: 1 });
  return [drums, riff, lead, colour];
}

writeSong(`${dir}heliobane_boss_amiga.json`, narrowSongArps(arrange(song, {
  // chip RAM: shorter loops (json2mod modLoopTol, modLoopMax; heliobane-amiga docs/MEASURED.md "The MODs retuned")
  modLoopMax: 1024,
  plan, trim: {},
  title: 'Heliobane - Herald 4ch', mixvol: 48,
  message: 'HELIOBANE boss theme "Herald", 4-channel Amiga arrangement.\nC minor -> C# minor, 176 BPM. Orders 1-8 loop.\n'
    + 'All samples synthesized. Source: songs/heliobane_boss_amiga.gen.js; MOD via tools/json2mod.js',
}), /^arp pulse/, { window: [nn('G#4'), nn('G-5')] }));
