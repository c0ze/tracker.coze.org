// SID instrument recipes for the cozy-tracker SID driver (sid/FORMAT.md), taken from what
// tools/sid-study.js measured in the legendary tunes of the SID corpus
// (docs/sid-corpus-studies.md). Each recipe returns an instrument ({ name, sid }); the comment
// says where its numbers come from. They shape sounds; no recipe carries a tune's notes.
//
//   import { kit, vibrato, RESTART } from './sid-kit.js';
//   samples: [kit.sweepBass(), kit.kickBass(), kit.snare(), kit.chiffLead(), kit.chord([0, 4, 7])]

const ins = (name, sid) => ({ name, sid });

/** IT `Hxy` for a vibrato of about `period` frames and `cents` up and down (the driver's
 *  vibrato, measured: period = 4 x quarter[x] frames, depth = 100 x y x quarter[x] / 256 cents). */
const QUARTER = [1, 16, 8, 5, 4, 3, 3, 2, 2, 2, 2, 1, 1, 1, 1, 1];
export function vibrato(period, cents) {
  let best = null;
  for (let x = 1; x < 16; x++) {
    const y = Math.max(1, Math.min(15, Math.round((cents * 256) / (100 * x * QUARTER[x]))));
    const miss = [Math.abs(4 * QUARTER[x] - period), Math.abs((100 * x * y * QUARTER[x]) / 256 - cents)];
    if (!best || miss[0] < best.miss[0] || (miss[0] === best.miss[0] && miss[1] < best.miss[1])) best = { x, y, miss };
  }
  return `H${best.x.toString(16).toUpperCase()}${best.y.toString(16).toUpperCase()}`;
}

/** Vibratos as measured (median depth and period per composer). Hubbard's and Daglish's start
 *  with the note; Tel's, Matt Gray's and Cadaver's after about 12 frames (put the H two rows in
 *  at speed 6), Hülsbeck's after about 9. The driver's periods are 4, 8, 12, 16, 20, 32 or 64
 *  frames, and a vibrato starts on a row, so a delay comes in whole rows. */
export const VIBRATO = {
  hubbard: vibrato(8, 30),    // ±30 cents, 8 frames: H85
  daglish: vibrato(8, 22),    // ±22 cents, 8 frames, on 12% of his notes: H74
  galway: vibrato(12, 33),    // ±33 cents, 12 frames, after about 5: H56
  tel: vibrato(10, 32),       // ±32 cents, 10 frames, after about 12: H85 (8 frames)
  huelsbeck: vibrato(9, 14),  // ±14 cents, 9 frames, after about 9: H92 (8 frames)
};

/** song.sid settings for the hard restarts measured: frames before the note with the gate off,
 *  and the ADSR meanwhile ("keep": the instrument's own, only the gate drops). */
export const RESTART = {
  hubbard: { hardRestart: 2, hardRestartAdsr: [0x00, 0x00] },     // gate off 2-3, $0000 for 2
  goattracker: { hardRestart: 2, hardRestartAdsr: [0x0f, 0x00] }, // Cadaver: $0F00 for 2
  tel: { hardRestart: 3, hardRestartAdsr: [0x00, 0x01] },         // gate off 3, $0001 (his for the last 2)
  soft: { hardRestart: 1, hardRestartAdsr: 'keep' },              // Daglish, Follin: gate off 1, no ADSR change
  galway: { hardRestart: 2, hardRestartAdsr: 'keep' },            // no ADSR change; his gate goes off 4-8 frames early: key offs
  huelsbeck: { hardRestart: 1, hardRestartAdsr: 'keep' },         // gate off 1 (R-Type also sets the test bit: not in this driver)
};

export const kit = {
  /** Pulse bass, thin at the start and sweeping (Hubbard's bass: width $180-$2A0, 22-64 a
   *  frame, ADSR $099F/$0980). With carry: true the width runs on from the voice's last note. */
  sweepBass: ({ name = 'sweep bass', adsr = [0, 9, 9, 15], width = 0x180, speed = 24, min = 0x100, max = 0xa00, carry = false } = {}) =>
    ins(name, { adsr, wave: ['pulse'], pulse: carry ? 'carry' : { width, speed, min, max } }),

  /** The corpus's most common arpeggio: the note and its octave, 2 frames each (Hubbard, on
   *  bass and lead), or 1 frame (Monty on the Run's slow bass). */
  octave: ({ name = 'octave', adsr = [0, 9, 8, 0], frames = 2, wave = 'pulse', width = 0x300, speed = 16 } = {}) =>
    ins(name, { adsr, wave: [...Array(frames).fill([wave, 0]), ...Array(frames).fill([wave, 12])], loop: 0,
      pulse: { width, speed, min: 0x100, max: 0xc00 } }),

  /** A chord as a wavetable arpeggio, one step a frame: [0, 4, 7] (Daglish, Laxity), or with
   *  the octave on top [0, 3, 7, 12] (Galway). One instrument per chord shape. */
  chord: (intervals, { name = `chord ${intervals.join('-')}`, adsr = [0, 8, 10, 6], frames = 1, wave = 'pulse', width = 0x800, speed = 0 } = {}) =>
    ins(name, { adsr, wave: intervals.flatMap((i) => Array(frames).fill([wave, i])), loop: 0,
      pulse: { width, speed, min: 0x200, max: 0xe00 } }),

  /** Bass note with a kick in front, in one note: a noise click, then pulse falling from 19
   *  semitones above into the note within four frames (close to Tel's; kit.kick is his own). */
  kickBass: ({ name = 'kick bass', adsr = [0, 8, 13, 8], drop = [19, 17, 12, 5], width = 0x320, speed = 0 } = {}) =>
    ins(name, { adsr, wave: [['noise', 'A#6'], ...drop.map((d) => ['pulse', d]), ['pulse', 0]],
      pulse: { width, speed, min: 0x100, max: 0xe00 } }),

  /** Tel's kick as its own note before the bass note (Cybernoid voice 1, tick 769): a triangle
   *  frame at D-1, noise at A#6, then pulse falling C#4, B-3, F#3, B-2; ADSR $08D8. Give it a row. */
  kick: ({ name = 'kick', adsr = [0, 8, 13, 8] } = {}) =>
    ins(name, { adsr, wave: [['tri', 'D-1'], ['noise', 'A#6'], ['pulse', 'C#4'], ['pulse', 'B-3'], ['pulse', 'F#3'], ['pulse', 'B-2']],
      pulse: { width: 0x800 } }),

  /** Snare (Cadaver's GoatTracker drums): a test-bit frame, a noise burst, two frames of pulse
   *  falling E-4 to C-4, then noise tailing off. Gate it for about 5 frames. */
  snare: ({ name = 'snare', adsr = [0, 0, 14, 9] } = {}) =>
    ins(name, { adsr, wave: [['test', 'C-7'], ['noise', 'C-7'], ['pulse', 'E-4'], ['pulse', 'C-4'], ['noise', 'E-7'], ['noise', 'G#6']],
      pulse: { width: 0x800 } }),

  /** Noise hat or snare on any voice, at the row's pitch (Hubbard's noise drums, ADSR $0A09;
   *  he alternates two pitches an octave apart). */
  noise: ({ name = 'noise hat', adsr = [0, 10, 0, 9] } = {}) => ins(name, { adsr, wave: ['noise'] }),

  /** Pulse lead whose attack is two frames of noise (43% of Hubbard's notes start like this). */
  chiffLead: ({ name = 'chiff lead', adsr = [0, 6, 4, 11], width = 0x180, speed = 48 } = {}) =>
    ins(name, { adsr, wave: [['pulse', 0], ['noise', 0], ['noise', 12], ['pulse', 0]],
      pulse: { width, speed, min: 0x100, max: 0xe00 } }),

  /** Lead that starts with a noise click and an octave-up blip (Hülsbeck, R-Type, starting width
   *  $240 sweeping 32 a frame). R-Type's ADSR $090F suits staccato lines; the default here
   *  sustains, so held notes hold and rests stay rests. */
  blipLead: ({ name = 'blip lead', adsr = [0, 9, 9, 8], width = 0x240, speed = 32 } = {}) =>
    ins(name, { adsr, wave: [['noise', 'A#6'], ['pulse', 12], ['pulse', 0]],
      pulse: { width, speed, min: 0x100, max: 0xe00 } }),

  /** A note that starts off its pitch for a frame or three and lands on it: Daglish scoops up
   *  from a major third below ([-4] or [-4, -3, -1], Krakout), Cadaver flicks a tone or a minor
   *  third either side ([-2], [3], Dojo). */
  flick: (offsets = [-4], { name = `flick ${offsets.join(' ')}`, adsr = [1, 11, 5, 5], wave = 'pulse', width = 0x400, speed = 32 } = {}) =>
    ins(name, { adsr, wave: [...offsets.map((o) => [wave, o]), [wave, 0]], pulse: { width, speed, min: 0x100, max: 0xe00 } }),

  /** Resonant low-pass bass (the corpus's filters: low-pass, resonance 15, cutoff moving about
   *  16 a frame between 128 and 1792 on the one voice routed through it). `speed` counts in
   *  steps of 8: 2 is 16 a frame. The filter starts again with each note of this instrument:
   *  for one sweep over a phrase, start it with this and play the rest with kit.carryFilter(). */
  /** The same sound with the running filter carried on (filter: "carry"): no new sweep. */
  carryFilter: (instrument, { name = `${instrument.name} (carry)` } = {}) =>
    ins(name, { ...instrument.sid, filter: 'carry' }),

  filterBass: ({ name = 'filter bass', adsr = [0, 9, 10, 4], wave = 'saw', cutoff = 256, speed = 2, max = 1536, resonance = 15 } = {}) =>
    ins(name, { adsr, wave: [wave], filter: { mode: 'low', cutoff, resonance, speed, max } }),
};
