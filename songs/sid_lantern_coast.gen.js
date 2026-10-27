#!/usr/bin/env node
/**
 * Lantern Coast (SID) — an original, lyrical loop for an evening sea coast, written with
 * skills/sid-music in the manner of Martin Galway (skills/sid-music/references/styles.md): a singing
 * pulse/saw lead with slow sweeps, wide late vibrato and legato, chords as 4-note wavetable
 * arpeggios with the octave, no drums (the rhythm is the bass's sway and the arpeggios), and the
 * gate closed a row (8 frames) before the next note so the phrases breathe. Borrowed: sounds and
 * numbers only; the melody is new.
 *
 * Grid: 8 frames a row (IT speed 8 at 125 BPM, 50 Hz), a row is a 16th note: 32 frames a beat,
 * 93.75 BPM; 16 rows a bar (2.56 s); one 16-row pattern a bar (an identical bar is shared).
 * 26 bars, 66.6 s; the loop (A B A') is 24 bars, 61.4 s. G minor, Dorian in the question (C major, the E natural), Aeolian in the answer (Eb, Cm).
 *
 *   intro 2 bars  Gm | D               bass sway and arpeggios only (played once, from order 0)
 *   A     8 bars  Gm C Gm D | Gm Eb Cm-D Gm
 *                 question: D, up a fourth to G, Bb, then a slur up to the A over C (Dorian sixth); the
 *                 run up to D-6 ends open on A over D. Answer: the same opening, the cell turned
 *                 down over Eb, home through F#, slurred into a long G.
 *   B     8 bars  Eb Bb Cm F | Gm Eb Cm D
 *                 saw lead, longer notes; the bass holds, the arpeggios take the sway. Climbs
 *                 Eb-6, then F-6 and a slurred glide to the one peak, G-6 over Eb (B's sixth bar),
 *                 and comes down to an open A over D. Slurs (G portamento) on about 9% of lead notes.
 *   A'    8 bars  the question again; the answer reaches up to Eb-6 (B's opening) before
 *                 settling; the arpeggios move to the off-beats. Loops to A.
 *
 * Voice 1: lead (pulse in A, saw in B). Voice 2: arpeggio chords, voiced round G-4 so the G stays
 * as a common tone (Gm, C, Cm, Eb). Voice 3: pulse bass, G-2..Eb-4, a 3+3+2 sway (A) or a
 * dotted long-short (B).
 *
 * Lint: the G-5 over D in B's last bar (F#, G, A) is a passing tone against the arpeggio's F#;
 * the arpeggio and bass notes on the last row run into the loop, where row 0 restarts every voice.
 */
import { writeSong, nn, ns } from './lib.js';
import { kit, vibrato, RESTART } from './sid-kit.js';

const BAR = 16;
const HALF = 8;
const FRAMES_PER_ROW = 8;

// ---------------------------------------------------------------- instruments
const I = {};
const samples = [];
const add = (key, inst) => { I[key] = samples.length; samples.push(inst); };
// Galway's leads: pulse from square ($800) sweeping about 25 a frame; ADSR close to his $11A9 / $04C8.
add('pulseLead', { name: 'pulse lead', sid: { adsr: [1, 6, 12, 9], wave: ['pulse'], pulse: { width: 0x800, speed: 25, min: 0x400, max: 0xc00 } } });
add('sawLead', { name: 'saw lead', sid: { adsr: [1, 6, 13, 9], wave: ['saw'], pulse: { width: 0x800 } } });
// Chords: one wavetable per shape, a frame a step, voiced round G-4.
const CHORD_ADSR = [0, 8, 5, 6]; // an accent, then under the lead
add('min', kit.chord([0, 3, 7, 12], { name: 'chord 0-3-7-12', adsr: CHORD_ADSR, width: 0x800, speed: 20 }));
add('maj64', kit.chord([0, 5, 9, 12], { name: 'chord 0-5-9-12', adsr: CHORD_ADSR, width: 0x800, speed: 20 }));
add('min64', kit.chord([0, 5, 8, 12], { name: 'chord 0-5-8-12', adsr: CHORD_ADSR, width: 0x800, speed: 20 }));
add('maj6', kit.chord([0, 3, 8, 12], { name: 'chord 0-3-8-12', adsr: CHORD_ADSR, width: 0x800, speed: 20 }));
add('maj', kit.chord([0, 4, 7, 12], { name: 'chord 0-4-7-12', adsr: CHORD_ADSR, width: 0x800, speed: 20 }));
add('bass', kit.sweepBass({ name: 'pulse bass', adsr: [1, 3, 9, 8], width: 0x600, speed: 30, min: 0x300, max: 0xb00 }));

// Arpeggio voicing per chord: [base note, instrument]. G-4 is common to Gm, C, Cm and Eb.
const VOICING = {
  Gm: ['G-4', I.min],    // G Bb D G
  C: ['G-4', I.maj64],   // G C E G
  Cm: ['G-4', I.min64],  // G C Eb G
  Eb: ['G-4', I.maj6],   // G Bb Eb G
  D: ['F#4', I.maj6],    // F# A D F#
  Bb: ['F-4', I.maj64],  // F Bb D F
  F: ['F-4', I.maj],     // F A C F
};
const ROOT = { Gm: 'G-2', C: 'C-3', Cm: 'C-3', D: 'D-3', Eb: 'D#3', Bb: 'A#2', F: 'F-2' };

// ---------------------------------------------------------------- form
// One entry per bar: the chord, or two chords a half bar each.
const INTRO = ['Gm', 'D'];
const A = ['Gm', 'C', 'Gm', 'D', 'Gm', 'Eb', 'Cm D', 'Gm'];
const B = ['Eb', 'Bb', 'Cm', 'F', 'Gm', 'Eb', 'Cm', 'D'];
const SECTIONS = [
  { name: 'intro', chords: INTRO, bass: 'sway', arp: 'quarters' },
  { name: 'A', chords: A, bass: 'sway', arp: 'quarters' },
  { name: 'B', chords: B, bass: 'long', arp: 'sway' },
  { name: "A'", chords: A, bass: 'sway', arp: 'offbeat' },
];
const LOOP_BAR = INTRO.length;
const BARS = SECTIONS.reduce((n, s) => n + s.chords.length, 0);
const ROWS = BARS * BAR;
const halves = SECTIONS.flatMap((s) => s.chords.flatMap((c) => {
  const [a, b = a] = c.split(' ');
  return [{ chord: a, ...s }, { chord: b, ...s }];
}));

// ---------------------------------------------------------------- the melody
// [row in bar, note, rows] per bar; `glide` slurs into the note from the one before (legato).
const QUESTION = [
  [[0, 'D-5', 6], [6, 'G-5', 2], [8, 'A#5', 4], [12, 'A-5', 2], [14, 'G-5', 2]],        // Gm
  [[0, 'A-5', 10, { glide: true }], [12, 'G-5', 2], [14, 'E-5', 2]],                   // C: slurs up to the Dorian sixth
  [[0, 'D-5', 2], [2, 'G-5', 2], [4, 'A#5', 2], [6, 'D-6', 6], [12, 'C-6', 2], [14, 'A#5', 2]], // Gm: the run up
  [[0, 'A-5', 12]],                                                                   // D: open, then breathe
];
const ANSWER = [
  QUESTION[0],                                                                         // Gm: the opening again
  [[0, 'G-5', 6], [6, 'F-5', 2], [8, 'D#5', 4], [12, 'F-5', 2], [14, 'G-5', 2]],         // Eb: the cell turned down
  [[0, 'C-6', 4], [4, 'A#5', 2], [6, 'G-5', 2], [8, 'A-5', 4], [12, 'F#5', 4]],          // Cm D
  [[0, 'G-5', 12, { glide: true }]],                                                  // Gm: slurs home from the F#
];
const BRIDGE = [
  [[0, 'G-5', 6], [6, 'A#5', 2], [8, 'D#6', 8, { glide: true }]],                      // Eb: slurred up a fourth
  [[0, 'D-6', 6], [6, 'C-6', 2], [8, 'A#5', 8, { glide: true }]],                      // Bb: slurred down
  [[0, 'C-6', 6], [6, 'D-6', 2], [8, 'D#6', 4], [12, 'D-6', 2], [14, 'C-6', 2]],         // Cm
  [[0, 'A-5', 10], [12, 'A#5', 2], [14, 'C-6', 2]],                                    // F: open, a pickup up
  [[0, 'D-6', 6], [6, 'C-6', 2], [8, 'D-6', 4], [12, 'F-6', 4]],                        // Gm: climbing
  [[0, 'G-6', 12, { glide: true }], [12, 'F-6', 4]],                                  // Eb: the peak, slurred in
  [[0, 'D#6', 6], [6, 'D-6', 2], [8, 'C-6', 4], [12, 'A#5', 2], [14, 'G-5', 2]],         // Cm: coming down
  [[0, 'F#5', 6], [6, 'G-5', 2], [8, 'A-5', 8, { glide: true }]],                      // D: open
];
const ANSWER2 = [
  ANSWER[0],
  [[0, 'G-5', 6], [6, 'A#5', 2], [8, 'D#6', 6], [14, 'D-6', 2]],                        // Eb: reaches for B's Eb-6
  ANSWER[2],
  ANSWER[3],
];
const MELODY = [[], [], ...QUESTION, ...ANSWER, ...BRIDGE, ...QUESTION, ...ANSWER2];
const LEAD_INSTRUMENT = (bar) => (bar >= 10 && bar < 18 ? I.sawLead : I.pulseLead);

// ---------------------------------------------------------------- helpers
const VIB = vibrato(12, 33); // Galway: ±33 cents over 12 frames (H56)
const hex2 = (n) => n.toString(16).toUpperCase().padStart(2, '0');
// A portamento fast enough to land inside its row (slides skip the row's first frame): about 5 frames.
const glideFx = (from, to) => `G${hex2(Math.min(255, Math.ceil((16 * Math.abs(nn(to) - nn(from))) / 5)))}`;

/** Events [row, note, rows, { instrument, glide }] -> one channel's cells over the whole song.
 *  Galway's gate: a note of `breath`+ rows that runs into the next one closes its gate on its last
 *  row (8 frames early; the release runs on until the hard restart) unless the next note slurs
 *  from it; shorter notes run to the hard restart. A note sounding 4+ rows gets the vibrato from
 *  its second row (8 frames in), held with H00. */
function line(events, instrument, { vib = null, minVib = 4, breath = 3 } = {}) {
  const ch = {};
  const sorted = [...events].sort((a, b) => a[0] - b[0]);
  sorted.forEach(([row, note, len, extra = {}], i) => {
    const nextEv = sorted[i + 1];
    const next = nextEv ? nextEv[0] : ROWS;
    const slurNext = nextEv?.[3]?.glide && nextEv[0] === row + len;
    let end = Math.min(row + len, next);
    if (!slurNext && len >= breath && end === next) end -= 1;
    if (extra.glide) ch[row] = { note, fx: glideFx(sorted[i - 1][1], note) };
    else ch[row] = { note, instrument: extra.instrument ?? instrument };
    if (vib && end - row >= minVib) for (let r = row + 1; r < end; r++) ch[r] = { fx: r === row + 1 ? vib : 'H00' };
    if (!slurNext && end < next) ch[end] = { note: '==' };
  });
  return ch;
}

const lead = line(MELODY.flatMap((bar, b) => bar.map(([r, note, len, extra = {}]) =>
  [b * BAR + r, note, len, { instrument: LEAD_INSTRUMENT(b), ...extra }])), I.pulseLead, { vib: VIB, breath: 2 });

// Arpeggios: quarters (on the beat), sway (3+3+2) or offbeat (the 8th after each beat).
const ARP_RHYTHM = { quarters: [[0, 3], [4, 3]], sway: [[0, 3], [3, 3], [6, 2]], offbeat: [[2, 2], [6, 2]] };
const arps = line(halves.flatMap((h, i) => ARP_RHYTHM[h.arp].map(([r, len]) => {
  const [note, instrument] = VOICING[h.chord];
  return [i * HALF + r, note, len, { instrument }];
})), I.min);

// Bass: sway is root, fifth, octave (3+3+2) per half bar; long is root (6) and its octave (2).
const bassEvents = halves.flatMap((h, i) => {
  const r = ROOT[h.chord], at = i * HALF;
  const fifth = ns(nn(r) + 7), octave = ns(nn(r) + 12);
  return h.bass === 'sway' ? [[at, r, 3], [at + 3, fifth, 3], [at + 6, octave, 2]] : [[at, r, 6], [at + 6, octave, 2]];
});
const bass = line(bassEvents, I.bass);

// ---------------------------------------------------------------- bars -> patterns
const patterns = [], patternIndex = new Map(), order = [];
for (let b = 0; b < BARS; b++) {
  const channels = [lead, arps, bass].map((ch) => {
    const out = {};
    for (let r = 0; r < BAR; r++) if (ch[b * BAR + r]) out[r] = ch[b * BAR + r];
    return out;
  });
  // The last bar jumps back to A, so IT playback and lint see the same loop as the SID driver.
  if (b === BARS - 1) channels[2][BAR - 1] = { ...channels[2][BAR - 1], fx: `B${hex2(LOOP_BAR)}` };
  const key = JSON.stringify(channels);
  if (!patternIndex.has(key)) {
    let at = 0, sec = SECTIONS[0];
    for (const s of SECTIONS) { if (b < at + s.chords.length) { sec = s; break; } at += s.chords.length; }
    patternIndex.set(key, patterns.length);
    patterns.push({ name: `${sec.name} ${b - at + 1}`, rows: BAR, channels });
  }
  order.push(patternIndex.get(key));
}

writeSong(import.meta.url, {
  title: 'Lantern Coast (SID)', bpm: 125, ticks: FRAMES_PER_ROW,
  message: 'An original lyrical SID loop for an evening sea coast, in the manner of Martin Galway.\n' +
    'G minor (Dorian question, Aeolian answer), 8 frames a row, a row a 16th (93.75 BPM).\n' +
    'Voice 1 lead (pulse, saw in the bridge), voice 2 four-note wavetable chords, voice 3 pulse bass. No drums.',
  sid: { model: '6581', author: 'Claude Opus 5.5', released: '2026 cozy-tracker', ...RESTART.galway, loop: LOOP_BAR },
  samples,
  channelnames: ['lead', 'arpeggio chords', 'bass'],
  patterns,
  order,
});
