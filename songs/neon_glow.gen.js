#!/usr/bin/env node
/**
 * Neon Glow — Created by Gemini 3.1 Pro, 2026-09-23.
 * A minor, 125 BPM, 4/4, speed 6: 4 rows/beat, 16/bar, 64/phrase (12.288s).
 * Classic chiptune idioms: octave-bounce bass, J-chord stabs, and gated hats.
 */
import { bars, line, drums, pattern, kit, writeSong, CREDIT, up } from './gemini.js';

const R = 64;
// J-chords: Am = A-3 J37, G = G-3 J47, F = F-3 J47, C = C-4 J47
const chords = { Am: ['A-3', 'J37'], G: ['G-3', 'J47'], F: ['F-3', 'J47'], C: ['C-4', 'J47'] };

const A = [
  [[0, 'A-5', 4, 38], [4, 'C-6', 4, 38], [8, 'G-5', 8, 40]],
  [[0, 'F-5', 4, 36], [4, 'E-5', 4, 34], [8, 'D-5', 4, 34], [12, 'E-5', 4, 35]],
  [[0, 'A-5', 6, 38], [6, 'C-6', 6, 40], [12, 'G-5', 4, 38]],
  [[0, 'F-5', 8, 36], [8, 'G-5', 7, 38]],
];

const B = [
  [[0, 'C-6', 4, 38], [4, 'E-6', 4, 40], [8, 'D-6', 4, 38], [12, 'C-6', 4, 36]],
  [[0, 'A-5', 8, 38], [8, 'G-5', 8, 36]],
  [[0, 'F-5', 8, 36], [8, 'A-5', 8, 38]],
  [[0, 'B-5', 12, 40], [12, 'G-5', 3, 34]], // G chord here
];

function section(name, melody, progression, { quiet = false } = {}) {
  const bass = [], chord = [], kickSnare = [], hats = [];
  
  progression.forEach((key, b) => {
    const [root, j] = chords[key];
    const r = b * 16;
    
    // Octave bounce bass
    if (!quiet) {
      for (let i = 0; i < 4; i++) {
        bass.push([r + i * 4, root, 2, 40], [r + i * 4 + 2, up(root, 12), (i === 3 && b === 3) ? 1 : 2, 22]);
      }
    } else {
      bass.push([r, root, 8, 32], [r + 8, root, (b === 3) ? 7 : 8, 32]);
    }
    
    // J-chord stabs on off-beats (beats 2 and 4, i.e., rows 4 and 12)
    chord.push([r + 4, root, 4, quiet ? 18 : 28, j], [r + 12, root, (b === 3) ? 3 : 4, quiet ? 18 : 28, j]);

    // Drums
    if (!quiet) {
      kickSnare.push([r, 3, 35], [r + 8, 3, 35]); // Kick
      kickSnare.push([r + 4, 4, 28], [r + 12, 4, 28]); // Snare
      for (let i = 0; i < 8; i++) {
        // Gated hats: SC2 on closed hats, SC5 on open hat at end of bar
        const isOp = (i === 7);
        hats.push([r + i * 2, 5, 20, isOp ? 'SC5' : 'SC2']);
      }
    } else {
      kickSnare.push([r, 3, 25], [r + 8, 3, 25]);
    }
  });

  return pattern(name, R, [
    line(bars(melody), 0, R, { sustain: 0.6 }), 
    line(bass, 1, R), 
    line(chord, 2, R, { sustain: 0.4 }), 
    drums(kickSnare, R),
    drums(hats, R)
  ], [128, 128, 112, 128, 152]);
}

const P = [
  section('00 intro', [[], [], [], []], ['Am', 'G', 'F', 'G'], { quiet: true }),
  section('01 A / neon drive', A, ['Am', 'G', 'F', 'G']),
  section('02 A / neon drive 2', A, ['Am', 'G', 'F', 'G']),
  section('03 B / high lights', B, ['C', 'G', 'F', 'G']),
  section('04 B / high lights 2', B, ['C', 'G', 'F', 'G']),
  section('05 A / return', A, ['Am', 'G', 'F', 'G']),
  section('06 outro', [[], [], [], []], ['Am', 'Am', 'Am', 'Am'], { quiet: true }),
];

writeSong(import.meta.url, {
  title: 'Neon Glow', bpm: 125, ticks: 6, mixvol: 80,
  message: `${CREDIT}\nA minor chiptune track demonstrating octave bass and J-chords.\nSource: songs/neon_glow.gen.js.`,
  samples: [
    { name: 'square lead', synth: { wave: 'square', pulse: 0.5, seconds: 1.0, decay: 10 } },
    { name: 'triangle bass', synth: { wave: 'triangle' } },
    { name: 'pulse chord', synth: { wave: 'square', pulse: 0.25 } },
    ...kit(701)
  ],
  channelnames: { 0: 'lead', 1: 'octave bass', 2: 'j-chords', 3: 'kick/snare', 4: 'hats' },
  patterns: P, order: P.map((_, i) => i),
});
