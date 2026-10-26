#!/usr/bin/env node
/**
 * Pixel Rain — Created by Gemini 3.1 Pro, 2026-09-23.
 * D minor, 120 BPM, 4/4, speed 6: 4 rows/beat, 16/bar, 64/phrase (12.8s).
 * Demonstrates Canon shimmer and Vibrato/Glide (H/G effects).
 */
import { echoChannel } from './lib.js';
import { bars, line, drums, pattern, kit, writeSong, CREDIT, up } from './gemini.js';

const R = 64;

// Melody with vibrato (H32) and glides (G10).
// G10 has no instrument. H32 is applied to held notes.
const A = [
  [[0, 'D-5', 6, 38, 'H32'], [6, 'F-5', 6, 38, 'H32'], [12, 'E-5', 4, 34]],
  [[0, 'D-5', 12, 38, 'H32'], [12, 'A-4', 4, 30]],
  [[0, 'F-5', 6, 38, 'H32'], [6, 'A-5', 6, 40, 'H32'], [12, 'G-5', 4, 36]],
  [[0, 'F-5', 12, 38, 'H32'], [12, 'E-5', 3, 30]], 
];

// Arp for the breakdown/rest bars. It spells out the chords.
// Dm: D F A C. Bb: Bb D F A. F: F A C E. C: C E G B.
// We play 1 note per row.
function makeArp(root, offset) {
  const steps = [0, 3, 7, 10]; // minor 7th chord shape (works for Dm). 
  // Wait, let's just use exact notes for each chord.
  const chordNotes = {
    Dm: ['D-5', 'F-5', 'A-5', 'C-6'],
    Bb: ['A#4', 'D-5', 'F-5', 'A-5'],
    F:  ['F-5', 'A-5', 'C-6', 'E-6'],
    C:  ['C-5', 'E-5', 'G-5', 'B-5']
  };
  const arp = [];
  const notes = chordNotes[root];
  for (let i = 0; i < 16; i++) {
    // skip every 4th note to make it rhythmic
    if (i % 4 !== 3) {
      arp.push([offset + i, notes[i % 4], 1, 30]);
    }
  }
  return arp;
}

function section(name, melody, progression, { shimmer = false, quiet = false } = {}) {
  const bass = [], kickSnare = [];
  let arpSource = [];
  
  progression.forEach((key, b) => {
    const r = b * 16;
    let bassRoot = key === 'Dm' ? 'D-3' : key === 'Bb' ? 'A#2' : key === 'F' ? 'F-3' : 'C-3';
    
    // Simple bass
    bass.push([r, bassRoot, 6, 35], [r + 6, bassRoot, 6, 35], [r + 12, bassRoot, (b === 3) ? 3 : 4, 35]);

    // Drums
    if (!quiet) {
      kickSnare.push([r, 3, 35], [r + 8, 4, 30]); // Kick on 1, Snare on 3
    } else {
      kickSnare.push([r, 3, 20]); 
    }

    if (shimmer) {
      arpSource.push(...makeArp(key, r));
    }
  });

  const arpChannel = line(arpSource, 2, R, { sustain: 0.8, release: 0.8 });
  
  // Canon shimmer: voice 2 and 3 delayed by 1 and 2 rows.
  // We must set row 0 to '^^' to prevent carryover.
  const shimmer1 = shimmer ? echoChannel(arpChannel, { delay: 1, scale: 0.6, rows: R }) : {};
  const shimmer2 = shimmer ? echoChannel(arpChannel, { delay: 2, scale: 0.35, rows: R }) : {};
  if (shimmer) {
    if (!shimmer1[0]?.note) shimmer1[0] = { ...shimmer1[0], note: '^^' };
    if (!shimmer2[0]?.note) shimmer2[0] = { ...shimmer2[0], note: '^^' };
  }

  return pattern(name, R, [
    line(bars(melody), 0, R, { sustain: 0.6 }), 
    line(bass, 1, R), 
    arpChannel,
    shimmer1,
    shimmer2,
    drums(kickSnare, R)
  ], [128, 128, 80, 176, 128, 128]); // pans
}

const P = [
  section('00 intro shimmer', [[], [], [], []], ['Dm', 'Bb', 'F', 'C'], { shimmer: true, quiet: true }),
  section('01 A / melody enters', A, ['Dm', 'Bb', 'F', 'C'], { shimmer: false }),
  section('02 A / melody with beat', A, ['Dm', 'Bb', 'F', 'C'], { shimmer: false }),
  section('03 breakdown / shimmer returns', [[], [], [], []], ['Dm', 'Bb', 'F', 'C'], { shimmer: true, quiet: true }),
  section('04 outro', [[], [], [], []], ['Dm', 'Dm', 'Dm', 'Dm'], { shimmer: false, quiet: true }),
];

writeSong(import.meta.url, {
  title: 'Pixel Rain', bpm: 120, ticks: 6, mixvol: 80,
  message: `${CREDIT}\nD minor track demonstrating canon shimmer and vibrato.\nSource: songs/pixel_rain.gen.js.`,
  samples: [
    { name: 'square lead', synth: { wave: 'square', pulse: 0.5, seconds: 1.5, decay: 15 } },
    { name: 'triangle bass', synth: { wave: 'triangle' } },
    { name: 'arp pluck', synth: { wave: 'square', pulse: 0.125, seconds: 0.5, decay: 30 } },
    ...kit(702)
  ],
  channelnames: { 0: 'lead', 1: 'bass', 2: 'shimmer main', 3: 'shimmer echo 1', 4: 'shimmer echo 2', 5: 'kick/snare' },
  patterns: P, order: P.map((_, i) => i),
});
