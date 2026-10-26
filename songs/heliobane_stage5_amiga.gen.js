#!/usr/bin/env node
/**
 * HELIOBANE stage 5 "Aurel's Corona", arranged for 4 Paula channels (Amiga
 * port, exported with tools/json2mod.js). It reads the PC song's JSON
 * (heliobane_stage5.json, from heliobane_stage5.gen.js), so every note,
 * chord, groove, the form and tempo (180 BPM, speed 6) are the PC's; this
 * file only says which PC channels share each Paula channel
 * (heliobane_amiga.kit.js). The PC game loops the song from the end of the
 * intro (manifest loop_offset 5.33 s): here B01 on the turn's last row.
 *
 * Channels (Paula 0 and 3 play left, 1 and 2 right). In play, effects take
 * channel 3 and voice lines channel 0 (docs/AUDIO.md "The channel plan"),
 * so the bass shares channel 1 with the arps:
 *   0 drums  snare, kick (the heartbeat), toms, hats (a hat never cuts a hit
 *            after one row); the choruses' open hats win over the soft 8th
 *            kicks they fall on
 *   1 riff   the 16th broken-chord arps with the bass interleaved: each bass
 *            note sounds for its first row, in place of that row's arp note.
 *            Where the bass plays 16ths (the drive: root, root, octave, root)
 *            only its even rows (root and octave) are kept
 *   2 lead   the hero lead; the pad where it rests (intro, R)
 *   3 colour the counter-line (V1', V2') and the canon shimmer's first voice
 *            (Oda's log); the lead's echo or the harmony (second C1/C2,
 *            K1/K2) where those rest; a crash when the channel is free for
 *            3 rows
 * Dropped: the shimmer's second voice, the pad under the lead, the
 * per-channel pans; arp notes under bass notes, the drive's odd bass rows.
 * One-shots are cut to what the arrangement plays of them; the crash to
 * 0.8 s.
 */
import { loadSong, arrange, oneShot, jump, writeSong } from './heliobane_amiga.kit.js';

const dir = new URL('.', import.meta.url).pathname;
const PC = { lead: 0, echo: 1, arp: 2, shA: 3, shB: 4, bass: 5, kick: 6, snare: 7, hat: 8, perc: 9, pad: 10 };
const song = loadSong(`${dir}heliobane_stage5.json`);

// The log's arps start at B-5, not D-4: 40 semitones in all, more than one
// MOD sample spans (33), so they play a second copy of the arp sample.
const ARP = song.samples.findIndex((x) => x.name === 'arp pulse 12');
const ARP_HI = song.samples.push({ ...song.samples[ARP], name: 'arp pulse 12 hi' }) - 1;

const name = (e) => song.samples[e._inst ?? e.instrument]?.name ?? '';
const level = (e) => Number(e.vol?.slice(1) ?? 64);
// The choruses' open hats fall on the soft 8th kicks: the hat wins there.
const drums = [
  { ch: PC.snare, hold: 2 },
  { ch: PC.kick, hold: 2, only: (r, e) => level(e) >= 50 },
  { ch: PC.hat, hold: 1, only: (r, e) => name(e) === 'hat open' },
  { ch: PC.kick, hold: 2 },
  { ch: PC.perc, hold: 2, only: (r, e) => name(e) !== 'crash' },
  { ch: PC.hat, hold: 1 },
];
const crash = { ch: PC.perc, need: 3, only: (r, e) => name(e) === 'crash' };
const isNote = (n) => n && n !== '^^';

function plan(p) {
  // A bass note on an odd row right after another (the drive's 16ths) is left out.
  const bassRow = (r) => !(r % 2 && isNote(p.channels[PC.bass][r - 1]?.note));
  const arp = { ch: PC.arp, ...(/^Oda/.test(p.name) ? { inst: ARP_HI } : {}) };
  const riff = [{ ch: PC.bass, hold: 1, only: bassRow }, arp];
  const lead = /^(intro|R )/.test(p.name) ? [{ ch: PC.pad, prefer: 'fx' }] : [{ ch: PC.lead }];
  return [drums, riff, lead, [{ ch: PC.shA }, { ch: PC.echo }, crash]];
}

const last = song.order.at(-1);
const post = (p, lanes, i) => { if (i === last) jump(lanes, p.rows - 1, 1); };

// The crash rings on the colour channel when nothing cuts it: cut to 0.8 s
// (chip RAM). It is a synth sample, so the cut is exact, not faded; its last
// 50 ms there are 21 dB below its loudest (measured).
const shortCrash = (d) => oneShot(d, { seconds: 0.8 });

writeSong(`${dir}heliobane_stage5_amiga.json`, arrange(song, {
  plan, post, trim: {}, samples: { crash: shortCrash },
  title: "Heliobane - Aurel's Corona 4ch", mixvol: 48,
  message: 'HELIOBANE stage 5 "Aurel\'s Corona", 4-channel Amiga arrangement.\nB minor -> C# minor, 180 BPM. Orders 1-17 loop.\n'
    + 'All samples synthesized. Source: songs/heliobane_stage5_amiga.gen.js; MOD via tools/json2mod.js',
}));
