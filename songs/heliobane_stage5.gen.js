#!/usr/bin/env node
/**
 * HELIOBANE - Stage 5 "Aurel's Corona". Inside the star: the final run.
 * B minor (harmonic-minor F# major dominant), 180 BPM, speed 6: 4 rows/beat,
 * 16 rows/bar, 64 rows = 4 bars = 5.33 s.
 *
 * Palette: detuned-square "hero" lead (the game's big tune) with dotted-8th echo
 * and, in the last choruses, a harmony a chord-tone below; 12.5% pulse 16th
 * arpeggios (Tyrian-style broken chords, explicit notes); 25% pulse counter /
 * canon shimmer; growl bass octave bounce; heartbeat kick ("ba-dum") for the
 * star's pulse; soft detuned pad for Oda's log.
 *
 * Phrase map
 *   Intro  heartbeat on a B pedal, pad, arps fade in.                  (plays once)
 *   V1/V2  Bm Bm G A        low, restless verse: B (held) C# D, F# ... D.
 *   Pre    G A F# F#        dominant pedal, rising arps, snare roll, lead climbs to A#6.
 *   C1/C2  Bm G D A | Bm G Em F#   THE hook: a rising B-minor arpeggio to a held B6,
 *                                  answered A G F# G D; sequenced on D major up to
 *                                  C#7; second half peaks on D7 and hangs on F#.
 *   R      Bm G D A        breath: arps + bass + drums, no lead.
 *   V1'/V2' verse + counter-line.
 *   Pre, C1/C2 with harmony.
 *   Log1/2 Bm G D A        Oda's log: pad, 3-voice canon shimmer, the hook at half
 *                          speed with a long echo; heartbeat only, then drums return.
 *   Build  G A F# F#       roll.
 *   K1/K2  chorus in C# minor (+2) with harmony + echo, ends on G#.
 *   Turn   A A F# F# (B minor)  A = VI of C# minor = VII of B minor; F# resolves home.
 */
import { writeSong } from './lib.js';
import {
  up, bars, tr, vs, line, drums, pattern, ROWS, pcOf,
  kick, snare, hat, openHat, crash, tom, growlBass, fatLoop, pulse, echoHeld,
} from './heliobane_shop.kit.js';

const I = { lead: 0, arp: 1, pls: 2, bass: 3, kick: 4, snare: 5, hat: 6, ohat: 7, crash: 8, tom: 9, pad: 10 };
const TRIAD = { Bm: [11, 2, 6], G: [7, 11, 2], D: [2, 6, 9], A: [9, 1, 4], Em: [4, 7, 11], F: [6, 10, 1] }; // F = F# major
const BASS = { Bm: 'B-2', G: 'G-3', D: 'D-3', A: 'A-2', Em: 'E-3', F: 'F#3' };
const PAD = { Bm: ['D-4', 'J49'], G: ['D-4', 'J59'], D: ['D-4', 'J47'], A: ['C#4', 'J38'], Em: ['E-4', 'J37'], F: ['C#4', 'J59'] };
const nn = (n) => pcOf(n) + 12 * +n[2];
const NAMES = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];
const ns = (v) => NAMES[v % 12] + Math.floor(v / 12);

// ------------------------------------------------------------------ melodies
const V1 = [
  [[0, 'B-5', 6, 40], [6, 'C#6', 2, 36], [8, 'D-6', 4, 40], [12, 'C#6', 2, 36], [14, 'B-5', 2, 36]],
  [[0, 'F#5', 8, 40], [8, 'A-5', 2, 36], [10, 'B-5', 2, 38], [12, 'D-6', 4, 40]],
  [[0, 'D-6', 6, 42], [6, 'E-6', 2, 38], [8, 'F#6', 4, 42], [12, 'E-6', 2, 38], [14, 'D-6', 2, 38]],
  [[0, 'C#6', 8, 42], [8, 'E-6', 4, 40], [12, 'A-5', 4, 38]]];
const V2 = [V1[0], V1[1],
  [[0, 'D-6', 6, 42], [6, 'E-6', 2, 38], [8, 'G-6', 4, 44], [12, 'F#6', 2, 40], [14, 'E-6', 2, 40]],
  [[0, 'F#6', 6, 44], [6, 'E-6', 2, 40], [8, 'C#6', 7, 42]]];
const PRE = [
  [[0, 'B-5', 4, 40], [4, 'D-6', 4, 42], [8, 'G-6', 8, 46]],
  [[0, 'A-6', 4, 46], [4, 'E-6', 4, 42], [8, 'C#6', 8, 44]],
  [[0, 'A#5', 4, 42], [4, 'C#6', 4, 44], [8, 'F#6', 8, 48]],
  [[0, 'E-6', 4, 46], [4, 'F#6', 4, 48], [8, 'A#6', 6, 52]]];
const CH1 = [
  [[0, 'F#5', 2, 42], [2, 'B-5', 2, 44], [4, 'D-6', 2, 46], [6, 'F#6', 2, 48], [8, 'B-6', 8, 54]],
  [[0, 'A-6', 2, 48], [2, 'G-6', 2, 46], [4, 'F#6', 2, 44], [6, 'G-6', 2, 46], [8, 'D-6', 8, 48]],
  [[0, 'F#5', 2, 42], [2, 'A-5', 2, 44], [4, 'D-6', 2, 46], [6, 'F#6', 2, 48], [8, 'A-6', 6, 52], [14, 'B-6', 2, 50]],
  [[0, 'C#7', 6, 56], [6, 'B-6', 2, 48], [8, 'A-6', 7, 52]]];
const CH2 = [
  [[0, 'F#5', 2, 42], [2, 'B-5', 2, 44], [4, 'D-6', 2, 46], [6, 'F#6', 2, 48], [8, 'B-6', 6, 54], [14, 'C#7', 2, 52]],
  [[0, 'D-7', 8, 58], [8, 'B-6', 4, 50], [12, 'G-6', 4, 48]],
  [[0, 'E-6', 2, 46], [2, 'G-6', 2, 48], [4, 'B-6', 4, 52], [8, 'A-6', 2, 48], [10, 'G-6', 2, 46], [12, 'F#6', 2, 46], [14, 'E-6', 2, 46]],
  [[0, 'F#6', 4, 50], [4, 'A#6', 4, 52], [8, 'C#7', 7, 56]]];
// key-change second half: the D7 peak comes down to B6 (+2 = C#7) so the lead
// stays under ~1.25 kHz; the last note is the leading tone B#6 into the A pivot.
const CH2K = [CH2[0],
  [[0, 'B-6', 8, 58], [8, 'A-6', 4, 50], [12, 'G-6', 4, 48]],
  CH2[2],
  [[0, 'F#6', 4, 50], [4, 'A#6', 4, 52], [8, 'A#6', 7, 54]]];
// Oda's log: the hook at half speed (one note per beat), long echo
const LOG = [
  [[0, 'F#5', 4, 34], [4, 'B-5', 4, 36], [8, 'D-6', 8, 38]],
  [[0, 'B-5', 16, 36]],
  [[0, 'F#5', 4, 34], [4, 'A-5', 4, 36], [8, 'D-6', 8, 38]],
  [[0, 'C#6', 12, 38]]];
const SOLO_TURN = [
  [[0, 'C#7', 4, 52], [4, 'B-6', 2, 46], [6, 'A-6', 2, 46], [8, 'E-6', 8, 48]],
  [[0, 'A-6', 4, 50], [4, 'G#6', 2, 44], [6, 'E-6', 2, 44], [8, 'C#6', 8, 46]],
  [[0, 'A#5', 2, 44], [2, 'C#6', 2, 46], [4, 'F#6', 2, 48], [6, 'A#6', 2, 50], [8, 'C#7', 8, 54]],
  [[0, 'A#6', 2, 50], [2, 'F#6', 2, 46], [4, 'C#6', 2, 44], [6, 'A#5', 2, 44], [8, 'F#5', 4, 44]]];

const LEAD_GAIN = 1.1;
const leadLine = (b, semi = 0, k = 1) => line(vs(bars(b.map((x) => tr(x, semi))), LEAD_GAIN * k), I.lead, { vib: 'H54', vibDelay: 3, sustain: 0.8 });

function harmony(b, prog, semi = 0, scale = 0.62) {
  const ev = [];
  bars(b.map((x) => tr(x, semi))).forEach(([r, n, l, v]) => {
    const tri = TRIAD[prog[Math.min(3, Math.floor(r / 16))]].map((p) => (p + semi) % 12);
    let h = null;
    for (let d = 3; d <= 9 && h === null; d++) if (tri.includes(((nn(n) - d) % 12 + 12) % 12)) h = nn(n) - d;
    if (h !== null && l >= 2) ev.push([r, ns(h), l, Math.round(v * scale * LEAD_GAIN)]);
  });
  return line(ev, I.lead, { vib: 'H54', vibDelay: 3, sustain: 0.8 });
}

// ------------------------------------------------------------------ parts
/** Tyrian-style broken chords: 16ths up/down through five chord tones from ~D4 (under the lead). */
function arps(prog, semi, { vol = 26, rise = false, from = 0, lowFrom = 'D-4' } = {}) {
  const ev = [];
  prog.forEach((c, b) => {
    if (b < from) return;
    const tri = TRIAD[c].map((p) => (p + semi) % 12);
    const tones = [];
    for (let v = nn(lowFrom) + semi; tones.length < 5; v++) if (tri.includes(v % 12)) tones.push(v);
    const fig = [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1];
    fig.forEach((i, k) => {
      const g = rise ? 0.4 + 0.6 * ((b - from) * 16 + k) / ((4 - from) * 16) : 1;
      ev.push([b * 16 + k, ns(tones[i]), 1, Math.round((k % 4 === 0 ? vol : vol * 0.72) * g)]);
    });
  });
  return line(ev, I.arp, {});
}

function bass(prog, semi, mode = 'bounce') {
  const ev = [];
  prog.forEach((c, b) => {
    const root = up(BASS[c], semi), o = b * 16;
    if (mode === 'bounce') for (let r = 0; r < 16; r += 2) ev.push([o + r, r % 4 ? up(root, 12) : root, 2, r % 4 ? 30 : 46]);
    else if (mode === 'drive') [[0, 0, 46], [1, 0, 24], [2, 12, 34], [3, 0, 26]].forEach(([r0, s, v]) => { for (let k = 0; k < 4; k++) ev.push([o + k * 4 + r0, up(root, s), 1, v]); });
    else if (mode === 'pedal') ev.push([o, root, 6, 44], [o + 6, root, 2, 30], [o + 8, root, 6, 40], [o + 14, up(root, 12), 2, 30]);
    else if (mode === 'heart') ev.push([o, root, 3, 46], [o + 3, root, 3, 34], [o + 8, root, 3, 44], [o + 11, root, 3, 32]);
  });
  return line(ev, I.bass, { sustain: 0.85, release: 0.6 });
}

function pad(prog, semi, vol = 20) {
  return line(prog.map((c, b) => [b * 16, up(PAD[c][0], semi), 15, vol, PAD[c][1]]), I.pad, { sustain: 0.9, release: 0.75 });
}

/** Canon shimmer: one broken-chord line, copies 1 and 2 rows late (quieter). */
function shimmer(prog, semi, delay, scale) {
  const src = arps(prog, semi, { vol: 26, lowFrom: 'B-5' });
  const out = {};
  for (const [r, e] of Object.entries(src)) {
    const t = +r + delay;
    if (t >= ROWS || Math.floor(t / 16) !== Math.floor(+r / 16)) continue;
    out[t] = { ...e, instrument: e.instrument === undefined ? undefined : I.pls, vol: e.vol ? `v${Math.round(+e.vol.slice(1) * scale)}` : e.vol };
    if (out[t].instrument === undefined) delete out[t].instrument;
  }
  for (let b = 0; b < ROWS; b += 16) if (!out[b]) out[b] = { note: '^^' };
  return out;
}

function kit(mode, { crashEvery = 0, fill = false } = {}) {
  const k = [], s = [], h = [], p = [];
  for (let b = 0; b < 4; b++) {
    const o = b * 16;
    if (mode === 'drive') {
      for (const r of [0, 6, 8, 10]) k.push([o + r, I.kick, r % 8 === 0 ? 60 : 46]);
      s.push([o + 4, I.snare, 54], [o + 12, I.snare, 54]);
      for (let r = 0; r < 16; r++) h.push([o + r, I.hat, [30, 12, 20, 12][r % 4]]);
    } else if (mode === 'chorus') {
      for (let r = 0; r < 16; r += 2) k.push([o + r, I.kick, r % 4 ? 46 : 60]);
      s.push([o + 4, I.snare, 58], [o + 12, I.snare, 58]);
      for (let r = 2; r < 16; r += 4) h.push([o + r, I.ohat, 22]);
      for (const r of [0, 8]) h.push([o + r, I.hat, 26]);
    } else if (mode === 'heart') {
      k.push([o, I.kick, 56], [o + 3, I.kick, 40], [o + 8, I.kick, 52], [o + 11, I.kick, 38]);
    } else if (mode === 'return') {
      k.push([o, I.kick, 56], [o + 3, I.kick, 40], [o + 8, I.kick, 52], [o + 11, I.kick, 38]);
      if (b >= 2) { s.push([o + 4, I.snare, 44], [o + 12, I.snare, 48]); for (let r = 0; r < 16; r += 2) h.push([o + r, I.hat, 18]); }
    } else if (mode === 'build') {
      for (let r = 0; r < 16; r += 4) k.push([o + r, I.kick, 56]);
      if (b < 2) s.push([o + 4, I.snare, 44], [o + 12, I.snare, 48]);
      else for (let r = (b === 2 ? 0 : 0); r < 16; r += (b === 2 ? 2 : 1)) s.push([o + r, I.snare, Math.round(24 + 32 * ((b - 2) * 16 + r) / 31)]);
      for (let r = 0; r < 16; r += 2) h.push([o + r, I.hat, 18]);
    }
    if (crashEvery && b % crashEvery === 0) p.push([o, I.crash, 30, 'C-5']);
  }
  if (fill) { // tom fill over the last beat
    for (const [r, n] of [[60, 'A-4'], [61, 'F#4'], [62, 'D-4'], [63, 'B-3']]) p.push([r, I.tom, 44, n]);
    for (let i = s.length - 1; i >= 0; i--) if (s[i][0] >= 60) s.splice(i, 1);
  }
  const pitched = (list) => { const ch = drums(list.map(([r, i, v]) => [r, i, v])); for (const [r, , , n] of list) if (n) ch[r].note = n; return ch; };
  const dedupe = (list) => Object.values(Object.fromEntries(list.map((e) => [e[0], e])));
  return [drums(dedupe(k)), drums(dedupe(s)), drums(dedupe(h)), pitched(dedupe(p))];
}

// ------------------------------------------------------------------ patterns
// channels: 0 lead, 1 echo/harmony, 2 arp, 3 counter/shimmer A, 4 shimmer B, 5 bass, 6 kick, 7 snare, 8 hats, 9 perc, 10 pad
const PANS = [0x78, 0xa8, 0x5c, 0xa0, 0x48, 0x80, 0x80, 0x84, 0xac, 0x6c, 0x90];
const patterns = [];
function P(name, c) {
  const chans = [c.lead, c.echo, c.arp, c.shA, c.shB, c.bass, ...(c.kit || [{}, {}, {}, {}]), c.pad];
  const pat = pattern(name, chans, PANS);
  for (const i of [6, 7, 8, 9]) {
    const e = pat.channels[i][0];
    if (e?.note === '^^' && !chans[i]?.[0]) { const { note, ...rest } = e; if (Object.keys(rest).length) pat.channels[i][0] = rest; else delete pat.channels[i][0]; }
  }
  patterns.push(pat);
  return patterns.length - 1;
}
const echo = (mel, semi = 0, o = {}) => echoHeld(vs(bars(mel.map((x) => tr(x, semi))), LEAD_GAIN), I.lead, { delay: 3, scale: 0.36, ...o });

const INTRO = P('intro - the heart of the star', {
  arp: arps(['Bm', 'Bm', 'G', 'F'], 0, { vol: 24, rise: true, from: 1 }), bass: bass(['Bm', 'Bm', 'G', 'F'], 0, 'heart'),
  kit: kit('heart', { fill: true }), pad: pad(['Bm', 'Bm', 'G', 'F'], 0, 24),
});
const VP = ['Bm', 'Bm', 'G', 'A'];
const verse = (name, mel, counter) => P(name, {
  lead: leadLine(mel), echo: counter ? null : echo(mel), arp: arps(VP, 0, { vol: 30 }),
  shA: counter ? line(bars(counter), I.pls, { vib: 'H43', vibDelay: 3 }) : null,
  bass: bass(VP, 0, 'bounce'), kit: kit('drive', { crashEvery: 4 }),
});
// counter-line for the returning verse: a sixth/third under the held notes
const V_COUNTER = [
  [[0, 'D-5', 6, 26], [8, 'F#5', 4, 24]],
  [[0, 'D-5', 8, 26], [12, 'F#5', 4, 24]],
  [[0, 'B-5', 6, 28], [8, 'D-6', 4, 26]],
  [[0, 'A-5', 8, 28], [8, 'C#6', 4, 26]]];
const V_COUNTER2 = [V_COUNTER[0], V_COUNTER[1], [[0, 'B-5', 6, 28], [8, 'D-6', 4, 26]], [[0, 'A-5', 6, 28], [8, 'E-5', 7, 26]]];
const V1p = verse('V1 - restless verse', V1);
const V2p = verse('V2', V2);
const PP = ['G', 'A', 'F', 'F'];
const PREp = P('pre - dominant pedal', {
  lead: leadLine(PRE), echo: echo(PRE), arp: arps(PP, 0, { vol: 26, rise: true }), bass: bass(PP, 0, 'pedal'),
  kit: kit('build', { crashEvery: 4 }), pad: pad(PP, 0, 18),
});
const CP1 = ['Bm', 'G', 'D', 'A'], CP2 = ['Bm', 'G', 'Em', 'F'];
const chorus = (name, mel, prog, { semi = 0, harm = false, fill = false } = {}) => P(name, {
  lead: leadLine(mel, semi), echo: harm ? harmony(mel, prog, semi) : echo(mel, semi),
  shA: harm ? echoHeld(vs(bars(mel.map((x) => tr(x, semi))), LEAD_GAIN), I.pls, { delay: 3, scale: 0.4 }) : null,
  arp: arps(prog, semi, { vol: 30 }), bass: bass(prog, semi, 'drive'), kit: kit('chorus', { crashEvery: 2, fill }),
});
const C1p = chorus('C1 - THE hook', CH1, CP1);
const C2p = chorus('C2 - hook peak, hangs on F#', CH2, CP2, { fill: true });
const Rp = P('R - breath: arps, bass, drums', { arp: arps(CP1, 0, { vol: 36 }), bass: bass(CP1, 0, 'drive'), kit: kit('drive', { crashEvery: 4, fill: true }), pad: pad(CP1, 0, 16) });
const V1c = verse("V1' + counter", V1, V_COUNTER);
const V2c = verse("V2' + counter", V2, V_COUNTER2);
const C1h = chorus('C1 + harmony', CH1, CP1, { harm: true });
const C2h = chorus('C2 + harmony', CH2, CP2, { harm: true, fill: true });
const LOG1 = P("Oda's log - canon shimmer", {
  lead: leadLine(LOG), echo: echoHeld(vs(bars(LOG), LEAD_GAIN), I.lead, { delay: 6, scale: 0.4, barCut: false }),
  arp: arps(CP1, 0, { vol: 20, lowFrom: 'B-5' }), shA: shimmer(CP1, 0, 1, 0.55), shB: shimmer(CP1, 0, 2, 0.3),
  bass: bass(CP1, 0, 'heart'), kit: kit('heart'), pad: pad(CP1, 0, 26),
});
const LOG2 = P("Oda's log - drums return", {
  lead: leadLine(LOG.map((b) => tr(b, 0)).map((b, i) => (i === 3 ? [[0, 'E-6', 12, 40]] : b))),
  echo: echoHeld(vs(bars(LOG), LEAD_GAIN), I.lead, { delay: 6, scale: 0.4, barCut: false }),
  arp: arps(CP1, 0, { vol: 22, lowFrom: 'B-5' }), shA: shimmer(CP1, 0, 1, 0.55), shB: shimmer(CP1, 0, 2, 0.3),
  bass: bass(CP1, 0, 'heart'), kit: kit('return', { fill: true }), pad: pad(CP1, 0, 22),
});
const BUILDp = P('build - roll', { arp: arps(PP, 0, { vol: 28, rise: true }), bass: bass(PP, 0, 'pedal'), kit: kit('build'), pad: pad(PP, 0, 20),
  lead: leadLine([[], [], [], [[8, 'A#6', 7, 50]]]) });
const K1 = chorus('K1 - hook in C# minor', CH1, CP1, { semi: 2, harm: true });
const K2 = chorus('K2 - C# minor, ends on G#', CH2K, CP2, { semi: 2, harm: true });
const TP = ['A', 'A', 'F', 'F'];
const TURNp = P('turn - A pivot, F# home', {
  lead: leadLine(SOLO_TURN), echo: echo(SOLO_TURN), arp: arps(TP, 0, { vol: 30 }), bass: bass(TP, 0, 'drive'),
  kit: kit('chorus', { crashEvery: 2, fill: true }),
});

writeSong(import.meta.url, {
  title: "Heliobane - Aurel's Corona", bpm: 180, ticks: 6, mixvol: 42,
  message: "HELIOBANE - Stage 5: Aurel's Corona. B minor, 180 BPM, speed 6.\nRestless verse, dominant-pedal pre, the hero hook, Oda's log (canon shimmer), chorus up a whole step, A pivot home.\nAll samples synthesized. Source: songs/heliobane_stage5.gen.js (MUSIC-B)",
  samples: [
    fatLoop('hero lead square', { period: 32, k: 128, mix: 'square', H: 11, weights: [1, 0.7, 0.7] }),
    pulse('arp pulse 12', 0.125),
    pulse('pulse 25', 0.25),
    growlBass('star bass', { drive: 2, sq: 0.5, gain: 0.62 }),
    kick('kick', { f0: 200, f1: 48, decay: 12, drive: 2.6, click: 0.6, sec: 0.2, gain: 0.75 }),
    snare('snare', { tone: 190, ndecay: 14, drive: 2, metal: 0.2, gain: 0.85 }),
    hat('hat closed', 434), openHat('hat open', 435),
    crash('crash', 535),
    tom('tom perc', { gain: 0.8 }),
    fatLoop('corona pad', { period: 32, k: 128, mix: 'soft', gain: 0.9 }),
  ],
  channelnames: ['hero lead', 'echo / harmony', 'arp', 'counter / shimmer A', 'shimmer B', 'bass', 'kick', 'snare', 'hats', 'crash / toms', 'pad'],
  patterns,
  order: [INTRO, V1p, V2p, PREp, C1p, C2p, Rp, V1c, V2c, PREp, C1h, C2h, LOG1, LOG2, BUILDp, K1, K2, TURNp],
});
