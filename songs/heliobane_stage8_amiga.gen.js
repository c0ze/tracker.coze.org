#!/usr/bin/env node
/**
 * HELIOBANE stage 8 "The Stormglass", arranged for 4 Paula channels (Amiga
 * port, exported with tools/json2mod.js). It reads the PC song's JSON
 * (heliobane_stage8.json, from heliobane_stage8.gen.js), so every note,
 * chord, groove, the form, tempo (168 BPM, speed 6) and loop (orders 1-6,
 * B01 on A3's last row) are the PC's; this file only says which PC channels
 * share each Paula channel (heliobane_amiga.kit.js,
 * heliobane_amiga_w23.kit.js).
 *
 * Channels (Paula 0 and 3 play left, 1 and 2 right). In play, effects take
 * channel 3 and voice lines channel 0 (docs/AUDIO.md "The channel plan"):
 *   0 drums  snare and tom, kick, hats (a hat never cuts a hit after one
 *            row)
 *   1 riff   the grit bass; where the power-chord stabs fall on the bass's
 *            pitch class, one merged loop (bass + chord in unison, or the
 *            chord an octave up), as the World 1 boss's riff
 *   2 lead   the storm pwm lead; the glass bell melody (eye); the wind
 *            (noise, intro, which has no lead)
 *   3 colour the lead's echo or the written harmony (A3); the arps (A2,
 *            squall) and the bells (eye) where those rest; a crash when
 *            the channel is free for 3 rows. The J arps play a copy of the
 *            arp sample (their own default volume; the arpeggio takes the
 *            cell)
 * Dropped: the second echo (echo2), the pad, the wind after the intro, the
 * thunder (2.6 s, 57 KB of PCM; cut to 0.9 s, 19 KB, it would still be
 * within 12 dB of its loudest), the stabs off the bass's pitch class or an
 * octave below it, the pans.
 * One-shots are cut to what the arrangement plays of them; for chip RAM
 * the crash to 0.8 s (faded from 0.6 s, where it is 12 dB below its
 * loudest 50 ms; the first export with it was 88.1 KB) and the noise loop
 * (the wind) to its first half.
 * MOD retune (2026-10-23; json2mod's ranged copies, heliobane-amiga
 * docs/MEASURED.md "The MODs retuned"): the arp pulse chord's chords voiced
 * within 7 semitones, their roots in A#4..A-5 (narrowSongArps: a copy of a
 * single-cycle loop images when a chord's root sits 8 or more under its
 * top).
 */
import { loadSong, arrange, writeSong } from './heliobane_amiga.kit.js';
import { octaveMix, halfNoise, cut, narrowSongArps } from './heliobane_amiga_w23.kit.js';
import { nn } from './lib.js';

const dir = new URL('.', import.meta.url).pathname;
const PC = { kick: 0, snare: 1, hat: 2, bass: 3, gtr: 4, arp: 5, lead: 6, echo: 7, echo2: 8, pad: 9, fx: 10, storm: 11 };
const song = loadSong(`${dir}heliobane_stage8.json`);

// The J arps (A2, A3) play a copy of the arp pulse: the squall's plain
// arps need other volumes, and a MOD sample has one default volume (a note
// at another level would carry Cxx in the cell its arpeggio needs).
const ARP = song.samples.findIndex((x) => x.name === 'arp pulse');
const ARP_J = song.samples.push({ ...song.samples[ARP], name: 'arp pulse chord' }) - 1;
const name = (e) => song.samples[e._inst ?? e.instrument]?.name ?? '';
const crash = { ch: PC.fx, need: 3, only: (r, e) => name(e) === 'crash' };
const drums = [{ ch: PC.snare, hold: 2 }, { ch: PC.kick, hold: 2 }, { ch: PC.hat, hold: 1 }];
const riff = octaveMix(song, { bass: PC.bass, riff: PC.gtr, bassSample: 'grit bass', chordSample: 'power chord' });

function plan(p) {
  if (/^intro/.test(p.name)) return [drums, riff(p), [{ ch: PC.fx }], []];
  const arp = /^squall/.test(p.name) ? { ch: PC.arp } : { ch: PC.arp, prefer: 'fx', inst: ARP_J };
  return [drums, riff(p), [{ ch: PC.lead }], [{ ch: PC.echo }, arp, crash]];
}

writeSong(`${dir}heliobane_stage8_amiga.json`, narrowSongArps(arrange(song, {
  plan, trim: {}, samples: { 'noise loop': halfNoise, crash: cut(0.8, 0.2) },
  title: 'Heliobane - The Stormglass 4ch', mixvol: 48,
  message: 'HELIOBANE stage 8 "The Stormglass", 4-channel Amiga arrangement.\n168 BPM. Orders 1-6 loop.\n'
    + 'All samples synthesized. Source: songs/heliobane_stage8_amiga.gen.js; MOD via tools/json2mod.js',
}), /^arp pulse chord/, { window: [nn('A#4'), nn('A-5')] }));
