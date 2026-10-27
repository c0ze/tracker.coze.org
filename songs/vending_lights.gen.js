#!/usr/bin/env node
/**
 * Vending Lights — the last drinks machine glowing beside an elevated road.
 * Synthwave study: F# minor, 108 BPM, speed 6, 4 rows/beat, 16 rows/bar,
 * 64-row patterns = 4 bars (8.89 s). Form Intro4 / A8 / B8 / A'8 / Turn4 = 32 bars,
 * about 71 s, looping to the intro. All sounds are library presets (docs/sound-library.md).
 *
 * Teaches (skills/synthwave/SKILL.md): bass / pad / lead separation by register and rhythm,
 * pads ducked by authored volume stamps on every kick (the sidechain feel), a pulse hook
 * built on repeated attacks, brass answers that only speak in the hook's rests, and
 * modulation that lives inside samples (pluck filter, PWM sweep, riser) versus modulation
 * we author (volume, vibrato H, glide G).
 *
 * Phrase map (A, one chord per bar):
 *   F#m        Dmaj7            A                 E
 *   C# C# C# A~ B  | C#~~~~~~ (rest) | C# C# C# E~~~ C# | B~~~~ (brass: E F# G#)
 * The hook is the three repeated C#6 attacks (3+3+2 rows) and the drop to A-5; B-5
 * glides back to C#6, which becomes the major seventh over D. A' keeps the hook and
 * adds brass answers; its ending glides G#5 -> F#5 into the turnaround.
 * Listening is the human's job: this file was verified by lint and renders only.
 */
import { writeSong } from './lib.js';

const ROWS = 64, BAR = 16;
const S = {
  kick: 0, snare: 1, clap: 2, hatC: 3, hatO: 4, bass: 5, pad: 6, lead: 7, brass: 8,
  crash: 9, riser: 10, downwash: 11,
};

// Refuse collisions: a lost cut or overwritten note is a silent bug.
function place(ch, row, ev, what) {
  if (!Number.isInteger(row) || row < 0 || row >= ROWS) throw new Error(`${what}: row ${row} outside pattern`);
  if (ch[row]) throw new Error(`${what}: collision at row ${row}`);
  ch[row] = ev;
}

/**
 * A looping melodic voice (lead.pwm / lead.brass): every note writes attack, held level,
 * release and a ^^ cut, because a loop never ends by itself.
 * [row, note, len, vol, opts] with opts.vib = rows after the attack where vibrato starts,
 * opts.glide = slide from the previous note (no retrigger, no cut before it),
 * opts.carry = no cut (the next pattern continues the note), opts.swell = brass-style attack.
 */
function voice(events, sample, what, gain = 1) {
  const ch = {};
  events.forEach(([row, note, len, vol, o = {}], i) => {
    const next = events[i + 1];
    const v = (f) => `v${Math.min(64, Math.max(1, Math.round(vol * gain * f)))}`;
    const head = o.glide ? { note, vol: v(1), fx: o.glide } : { note, instrument: sample, vol: o.swell ? v(0.72) : v(1) };
    place(ch, row, head, what);
    for (let k = 1; k < len; k++) {
      const left = len - k; // rows remaining including this one
      let f = o.swell ? (k === 1 ? 1 : 0.9) : (k === 1 ? 0.84 : 0.76);
      if (!o.carry && len > 3 && left === 2) f *= 0.72; // release: written, since the loop has none
      if (!o.carry && len > 2 && left === 1) f *= 0.5;
      const ev = { vol: v(f) };
      if (o.glide && k === 1) ev.fx = 'G00'; // continue the slide on the next row
      else if (o.vib !== undefined && k >= o.vib) ev.fx = k === o.vib ? 'H83' : 'H00';
      place(ch, row + k, ev, what);
    }
    const end = row + len;
    const nextGlides = next && next[0] === end && next[4]?.glide;
    if (!o.carry && !nextGlides && end < ROWS && !(next && next[0] === end)) place(ch, end, { note: '^^' }, what);
    if (next && next[0] < end) throw new Error(`${what}: note at ${next[0]} starts before ${note} ends`);
  });
  return ch;
}

// ---------------------------------------------------------------- harmony
// Pads: three voices, one chord tone each, moving by step or holding common tones.
// Over D the A-section pad keeps F# A C#: the bass alone turns F#m into Dmaj7.
const PAD = {
  'F#m': ['F#4', 'A-4', 'C#5'], 'Dmaj7': ['F#4', 'A-4', 'C#5'], 'A': ['E-4', 'A-4', 'C#5'],
  'E': ['E-4', 'G#4', 'B-4'], 'Esus4': ['E-4', 'A-4', 'B-4'], 'Bm': ['F#4', 'A-4', 'D-5'],
  // B section: wider, rootless colours (the "opened" harmony).
  'Dmaj9': ['F#4', 'C#5', 'E-5'], 'A/C#': ['A-4', 'C#5', 'E-5'], 'Bm7': ['A-4', 'D-5', 'F#5'],
  'Esus4hi': ['A-4', 'B-4', 'E-5'], 'Ehi': ['G#4', 'B-4', 'E-5'],
};
const ROOT = {
  'F#m': 'F#3', 'Dmaj7': 'D-3', 'A': 'A-2', 'E': 'E-3', 'Esus4': 'E-3', 'Bm': 'B-2',
  'Dmaj9': 'D-3', 'A/C#': 'C#3', 'Bm7': 'B-2', 'Esus4hi': 'E-3', 'Ehi': 'E-3',
};
const up12 = (n) => n.slice(0, 2) + (Number(n[2]) + 1);

// ---------------------------------------------------------------- drums
function kickRows(feel, bar) {
  if (feel === 'four') return [0, 4, 8, 12];
  if (feel === 'half') return [0, 8];
  if (feel === 'introKick') return bar >= 2 ? [0, 4, 8, 12] : [];
  if (feel === 'turn') return bar < 3 ? [0, 8] : [];
  return [];
}
function drums(feel, { fill = false, hats = 'closed8', backbeat = 'snare' } = {}) {
  const kick = {}, snare = {}, hat = {};
  for (let bar = 0; bar < 4; bar++) {
    const b = bar * BAR;
    for (const r of kickRows(feel, bar)) place(kick, b + r, { note: 'C-5', instrument: S.kick, vol: r % 8 ? 'v50' : 'v56' }, 'kick');
    // Backbeat: gated snare in A, lighter clap in B; the intro only claps into the hook.
    const back = feel === 'introKick' ? (bar === 3 ? [12] : [])
      : feel === 'turn' ? [[4, 12], [4, 12], [12], []][bar] : [4, 12]; // the turnaround thins out
    for (const r of back) {
      const inst = backbeat === 'clap' || feel === 'introKick' ? S.clap : S.snare;
      place(snare, b + r, { note: 'C-5', instrument: inst, vol: inst === S.clap ? 'v42' : 'v50' }, 'snare');
    }
    // Hats: offbeat eighths are the timekeeper; only the bass runs straight eighths.
    for (let r = 0; r < BAR; r += 2) {
      const off = r % 4 === 2;
      if (hats === 'off' && off && !(feel === 'turn' && bar === 3)) place(hat, b + r, { note: 'C-5', instrument: S.hatC, vol: 'v16' }, 'hat');
      if (hats === 'closed8' && off) place(hat, b + r, { note: 'C-5', instrument: S.hatC, vol: 'v20' }, 'hat');
      if (hats === 'open8') place(hat, b + r, off ? { note: 'C-5', instrument: S.hatO, vol: 'v15' } : { note: 'C-5', instrument: S.hatC, vol: 'v09' }, 'hat');
      if (hats === 'light8') place(hat, b + r, { note: 'C-5', instrument: S.hatC, vol: off ? 'v15' : 'v08' }, 'hat');
    }
  }
  if (fill) { // restrained: two claps after the last backbeat, nothing more
    place(snare, 62, { note: 'C-5', instrument: S.clap, vol: 'v30' }, 'fill');
    place(snare, 63, { note: 'C-5', instrument: S.clap, vol: 'v38' }, 'fill');
  }
  if (hats === 'open8') place(hat, 63, { note: '^^' }, 'hat'); // the last open hat must not ring into a quieter entry
  return { kick, snare, hat };
}

// ---------------------------------------------------------------- bass
// bass.pluck is a shot: its filter closes inside the sample, so each eighth re-strikes the
// "sweep". Roots sit between A-2 and F#3 (55-92 Hz) with octave pops above.
function bass(chords, style) {
  const ch = {};
  chords.forEach((name, bar) => {
    const b = bar * BAR, root = ROOT[name], next = chords[bar + 1];
    const hit = (r, note, vol) => place(ch, b + r, { note, instrument: S.bass, vol: `v${vol}` }, 'bass');
    if (style === 'eighths') {
      for (let r = 0; r < BAR; r += 2) {
        if (r === 12) hit(r, up12(root), 36);               // octave pop on beat 4
        else if (r === 14 && name === 'Dmaj7' && next === 'A') hit(r, 'B-2', 32); // step down into A
        else hit(r, root, r % 4 === 0 ? 44 : 32);
      }
    } else if (style === 'open') {  // B and turnaround: dotted-quarter, eighth, then let it ring
      if (name === 'Esus4' && bar === 3) { hit(0, root, 40); return; }
      hit(0, root, 44); hit(6, root, 32); hit(8, root, 36);
    } else if (style === 'introBass') {
      if (bar < 2) hit(0, root, 34);
      else for (let r = 0; r < BAR; r += 2) hit(r, r === 12 ? up12(root) : root, r % 4 === 0 ? 36 : 26);
    }
  });
  return ch;
}

// ---------------------------------------------------------------- pads + ducking
// Sidechain feel in tracker terms: on every kick row the pad dips, then recovers over the
// beat. Stamps are written only when the level changes; a new chord tone enters at the
// ducked level, so chord changes swell in under the kick instead of hitting with it.
const DUCK = [0.45, 0.65, 0.85]; // rows k, k+1, k+2 after a kick; full level from k+3
function pads(chords, feel, levelAt, split = {}, carry = [null, null, null]) {
  const voices = [{}, {}, {}];
  const kicks = new Set();
  for (let bar = 0; bar < 4; bar++) for (const r of kickRows(feel, bar)) kicks.add(bar * BAR + r);
  let lastKick = -99;
  const held = [...carry], lastVol = [null, null, null];
  for (let row = 0; row < ROWS; row++) {
    if (kicks.has(row)) lastKick = row;
    const since = row - lastKick, base = levelAt(row);
    const vol = Math.round(base * (since < DUCK.length ? DUCK[since] : 1));
    let name = chords[Math.floor(row / BAR)];
    for (const [r, n] of Object.entries(split)) if (row >= Number(r) && Math.floor(row / BAR) === Math.floor(r / BAR)) name = n;
    const chord = PAD[name];
    voices.forEach((ch, i) => {
      const note = chord[i];
      if (note !== held[i]) {   // common tones (also across patterns) keep sounding, no retrigger
        ch[row] = { note, instrument: S.pad, vol: `v${vol}` };
        held[i] = note; lastVol[i] = vol;
      } else if (vol !== lastVol[i]) {
        ch[row] = { vol: `v${vol}` };
        lastVol[i] = vol;
      }
    });
  }
  voices.held = held;
  return voices;
}
const flat = (v) => () => v;
const ramp = (from, to, r0, r1) => (row) => row <= r0 ? from : row >= r1 ? to : Math.round(from + (to - from) * (row - r0) / (r1 - r0));

// ---------------------------------------------------------------- melody
const HOOK = [[0, 'C#6', 2, 40], [3, 'C#6', 2, 34], [6, 'C#6', 2, 37], [8, 'A-5', 5, 38], [14, 'B-5', 2, 32]];
const shift = (evs, by) => evs.map(([r, ...rest]) => [r + by, ...rest]);
// Revision 1: the first render put the lead only 2.6 dB over the pads in A and level with
// them in B (stem RMS while the lead sounds). The hook must lead, so it gets +2 dB here and
// the opened B pads drop from v22 to v17.
const LEAD_GAIN = 1.25;
const G = 'G08'; // a whole tone in four ticks (render-probed): a quick scoop, not a smear

const LEAD = {
  intro: [[62, 'B-5', 2, 30]],                                   // pickup into the hook
  A1: [
    ...HOOK,
    [16, 'C#6', 10, 40, { glide: G, vib: 4 }],                   // maj7 over D, held with vibrato
    ...shift(HOOK.slice(0, 3), 32), [40, 'E-6', 6, 40], [46, 'C#6', 2, 33],  // high point, then fall to B
    [48, 'B-5', 8, 38, { vib: 3 }],                              // open question on the fifth of E
  ],
  A2: [
    ...HOOK,
    [16, 'C#6', 4, 40, { glide: G }], [20, 'B-5', 2, 34], [22, 'A-5', 2, 33], [24, 'F#5', 6, 36, { vib: 2 }],
    [32, 'C#6', 2, 38], [35, 'C#6', 2, 33], [38, 'B-5', 2, 35], [40, 'A-5', 6, 37, { vib: 3 }], [46, 'G#5', 2, 31],
    [48, 'A-5', 4, 36], [52, 'G#5', 8, 35, { vib: 3 }],          // sus4 resolving over E
  ],
  B1: [ // enters after the downwash has fallen away
    [18, 'A-5', 2, 34], [20, 'B-5', 2, 35], [22, 'C#6', 8, 39, { vib: 3 }],  // the hook's B-C# step, now a maj7 over D
    [32, 'E-6', 2, 38], [35, 'E-6', 2, 33], [38, 'E-6', 2, 36], [40, 'C#6', 6, 37, { vib: 3 }], // hook rhythm on E
  ],
  B2: [
    [0, 'D-6', 2, 40], [3, 'D-6', 2, 34], [6, 'D-6', 2, 37], [8, 'F#6', 6, 42, { vib: 3 }], [14, 'E-6', 2, 34],
    [16, 'D-6', 8, 38, { vib: 3 }],
    [32, 'B-5', 4, 36], [36, 'A-5', 10, 36, { vib: 4 }],
    [48, 'G#5', 8, 34, { vib: 3 }],
  ],
};
LEAD["A'1"] = LEAD.A1;
LEAD["A'2"] = [
  ...LEAD.A2.filter(([r]) => r < 48),
  [48, 'B-5', 2, 34], [50, 'A-5', 2, 34], [52, 'G#5', 12, 36, { vib: 3, carry: true }], // held into the turnaround
];
LEAD.turn = [[0, 'F#5', 12, 36, { glide: 'G04', vib: 4 }]];      // G#5 slides down to the tonic

// Brass answers live in the lead's rests (checked below), low and short.
const BRASS = {
  A1: [[56, 'E-5', 2, 30, { swell: true }], [58, 'F#5', 2, 32, { swell: true }], [60, 'G#5', 3, 34, { swell: true }]],
  A2: [],
  B1: [[50, 'C#5', 2, 28, { swell: true }], [52, 'E-5', 2, 30, { swell: true }], [54, 'A-5', 6, 34, { swell: true, vib: 3 }]],
  B2: [[26, 'A-5', 2, 30, { swell: true }], [28, 'F#5', 3, 32, { swell: true }]],
  "A'1": [
    [27, 'F#5', 2, 30, { swell: true }], [29, 'E-5', 2, 30, { swell: true }],
    [56, 'E-5', 2, 30, { swell: true }], [58, 'F#5', 2, 32, { swell: true }], [60, 'G#5', 3, 34, { swell: true }],
  ],
  "A'2": [
    [30, 'E-5', 2, 28, { swell: true }],
    // The one deliberate doubling: brass joins the lead's final held G#5 in unison, quietly.
    // (An octave below sat inside the pad's A-4/B-4 and only added seconds.)
    [52, 'G#5', 8, 20, { swell: true }],
  ],
  turn: [[20, 'C#5', 2, 24, { swell: true }], [23, 'C#5', 2, 20, { swell: true }], [26, 'C#5', 2, 22, { swell: true }], [28, 'A-4', 6, 24, { swell: true }]],
  intro: [],
};
const DOUBLING_OK = new Set(["A'2:52"]);
function assertAnswersInRests(name) {
  const sounding = new Set();
  for (const [r, , len] of LEAD[name]) for (let k = 0; k < len; k++) sounding.add(r + k);
  for (const [r, note, len] of BRASS[name]) {
    if (DOUBLING_OK.has(`${name}:${r}`)) continue;
    for (let k = 0; k < len; k++) if (sounding.has(r + k)) throw new Error(`${name}: brass ${note}@${r} overlaps the lead`);
  }
}

// ---------------------------------------------------------------- FX
// One channel, time-shared: crash on hook downbeats, downwash into B, risers before A'
// and at the end of the turnaround. Risers are shots: their sweep is baked in (2 s at C-5).
function fx(name) {
  const ch = {};
  const hit = (r, inst, vol) => place(ch, r, { note: 'C-5', instrument: inst, vol: `v${vol}` }, 'fx');
  if (name === 'A1' || name === "A'1") hit(0, S.crash, name === 'A1' ? 36 : 42);
  if (name === 'B1') hit(0, S.downwash, 34);
  if (name === 'B2') hit(50, S.riser, 30);       // 14.4 rows: peaks into A', where the crash cuts it
  if (name === 'turn') { hit(45, S.riser, 26); place(ch, 60, { note: '^^' }, 'fx'); } // ends a beat before the loop
  if (name === 'intro') place(ch, 0, { note: '^^' }, 'fx');  // entering from anywhere: silence the fx lane
  return ch;
}

// ---------------------------------------------------------------- patterns
const PAN = { 0: 'X80', 1: 'X80', 2: 'XA8', 3: 'X80', 4: 'X50', 5: 'X80', 6: 'XB0', 7: 'X74', 8: 'X9C', 9: 'X80' };
function withPan(channels) {
  channels.forEach((ch, i) => {
    let r = 0;
    while (ch[r]?.fx) r++;
    ch[r] = { ...(ch[r] ?? {}), fx: PAN[i] };
  });
  return channels;
}

let padCarry = [null, null, null];
function pattern(name, label, chords, { feel, bassStyle, level, drumOpts, split }) {
  assertAnswersInRests(name);
  const d = drums(feel, drumOpts);
  // Linear order: each pattern inherits the previous pads, so a held common tone is not
  // re-attacked. The turnaround cuts them, so the loop (and a fresh start) re-attack in the intro.
  const padVoices = pads(chords, feel, level, split, padCarry);
  const [p1, p2, p3] = padVoices;
  padCarry = padVoices.held;
  // lastVol restarts per pattern, so row 0 always restamps the level even on a held tone.
  if (name === 'turn') {
    for (const p of [p1, p2, p3]) place(p, 63, { note: '^^' }, 'pad seam'); // faded to v4: the intro re-attacks
    padCarry = [null, null, null];
  }
  return {
    name: label, rows: ROWS,
    channels: withPan([d.kick, d.snare, d.hat, bass(chords, bassStyle), p1, p2, p3,
      voice(LEAD[name], S.lead, `${name} lead`, LEAD_GAIN), voice(BRASS[name], S.brass, `${name} brass`), fx(name)]),
  };
}

const A = ['F#m', 'Dmaj7', 'A', 'E'];
const A_ANS = ['F#m', 'Dmaj7', 'A', 'Esus4'];
const patterns = [
  pattern('intro', 'Intro - the machine hums', ['F#m', 'Dmaj7', 'A', 'Esus4'],
    { feel: 'introKick', bassStyle: 'introBass', level: ramp(4, 20, 0, 24), drumOpts: { hats: 'off' } }),
  pattern('A1', 'A - hook, question', A, { feel: 'four', bassStyle: 'eighths', level: flat(20), drumOpts: { hats: 'closed8' } }),
  // Bar 4 of each answer: the pad holds Esus4 under the lead's A-5 and resolves with it on row 52.
  pattern('A2', 'A - hook, answer', A_ANS, { feel: 'four', bassStyle: 'eighths', level: flat(20), split: { 52: 'E' }, drumOpts: { hats: 'closed8', fill: true } }),
  pattern('B1', 'B - harmony opens', ['Dmaj9', 'Dmaj9', 'A/C#', 'A/C#'],
    { feel: 'half', bassStyle: 'open', level: flat(17), drumOpts: { hats: 'light8', backbeat: 'clap' } }),
  pattern('B2', 'B - peak and riser', ['Bm7', 'Bm7', 'Esus4hi', 'Ehi'],
    { feel: 'half', bassStyle: 'open', level: flat(17), drumOpts: { hats: 'light8', backbeat: 'clap' } }),
  pattern("A'1", "A' - hook with brass answers", A, { feel: 'four', bassStyle: 'eighths', level: flat(20), drumOpts: { hats: 'open8' } }),
  pattern("A'2", "A' - settled cadence", A_ANS, { feel: 'four', bassStyle: 'eighths', level: flat(20), split: { 52: 'E' }, drumOpts: { hats: 'open8' } }),
  pattern('turn', 'Turnaround - headlights pass', ['F#m', 'Dmaj7', 'Bm', 'Esus4'],
    { feel: 'turn', bassStyle: 'open', level: (r) => r < 48 ? 20 : ramp(20, 4, 48, 62)(r), drumOpts: { hats: 'off' } }),
];

writeSong(import.meta.url, {
  title: 'Vending Lights', bpm: 108, ticks: 6, mixvol: 56,
  message: 'Synthwave study: F# minor, 108 BPM, Intro / A / B / A\' / turnaround, looping.\nPads ducked by authored volume stamps on each kick; all sounds are library presets.\nSource: songs/vending_lights.gen.js. Verified by lint and renders; listen before calling it finished.',
  samples: [
    { name: 'kick', synth: { preset: 'kick.punch' } },
    { name: 'gated snare', synth: { preset: 'snare.gated' } },
    { name: 'clap', synth: { preset: 'clap' } },
    { name: 'closed hat', synth: { preset: 'hat.closed' } },
    { name: 'open hat', synth: { preset: 'hat.open' } },
    { name: 'pluck bass', synth: { preset: 'bass.pluck' } },
    { name: 'warm pad', synth: { preset: 'pad.warm' } },
    { name: 'pwm lead', synth: { preset: 'lead.pwm' } },
    { name: 'brass', synth: { preset: 'lead.brass' } },
    { name: 'crash', synth: { preset: 'cymbal.crash' } },
    { name: 'riser', synth: { preset: 'fx.riser' } },
    { name: 'downwash', synth: { preset: 'fx.downwash' } },
  ],
  channelnames: { 0: 'kick', 1: 'snare/clap', 2: 'hats', 3: 'bass', 4: 'pad 1', 5: 'pad 2', 6: 'pad 3', 7: 'pwm lead', 8: 'brass', 9: 'fx' },
  patterns,
  order: [0, 1, 2, 3, 4, 5, 6, 7],
});
