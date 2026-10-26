#!/usr/bin/env node
/**
 * Pocket Tram — Created by Gpt-6 Astra, 2026-09-23.
 * Bb major, 132 BPM, 4/4, speed 6: 4 rows/beat, 16/bar, 64/phrase (7.273s).
 * Four voices. A dotted pickup hops to the third; the answer steps home.
 * Intro / A question+answer / A changed / B lower / turnaround / A return.
 * Studied Silicon Dancer p4 (voice sharing and accents) and Her Kiss p0
 * (held-row arps). Original notes; no imported samples or reference melodies.
 */
import { bars, line, drums, pattern, kit, writeSong, CREDIT } from './astra.js';
const R = 64;
const chords = {
  Bb: ['A#3', 'F-4', 'D-5', 'J38'], Gm: ['G-3', 'D-4', 'D-5', 'J58'],
  Eb: ['D#3', 'A#3', 'D#5', 'J47'], F: ['F-3', 'C-4', 'C-5', 'J59'],
  Cm: ['C-3', 'G-3', 'D#5', 'J49'],
};
// Each handwritten bar is a rhythmic sentence, not a scale-generated line.
const A = [
  [[1,'F-5',2,35],[4,'A#5',2,40],[7,'D-6',5,43],[14,'F-6',1,30]],
  [[0,'D-6',4,39],[6,'A#5',2,34],[10,'G-5',4,36]],
  [[1,'G-5',2,34],[4,'A#5',2,39],[7,'D#6',5,42],[14,'D-6',1,29]],
  [[0,'C-6',4,38],[6,'A-5',2,34],[10,'F-5',4,36]],
];
const answer = [A[0], A[1],
  [[0,'G-5',3,35],[5,'A#5',2,38],[8,'D#6',3,40],[12,'C-6',2,33]],
  [[0,'D-6',3,39],[5,'C-6',2,33],[8,'A#5',6,40]],
];
const B = [
  [[0,'D#5',5,32],[8,'G-5',3,35],[12,'C-6',2,37]],
  [[2,'A#5',4,35],[8,'G-5',5,33]],
  [[0,'D-6',5,36],[8,'A#5',3,33],[12,'G-5',2,30]],
  [[0,'A-5',3,33],[6,'G-5',2,29],[10,'F-5',4,34]],
];
const changed = [
  [[1,'F-5',2,35],[4,'A#5',2,40],[7,'D-6',3,42],[11,'F-6',3,39]],
  A[1], A[2], A[3],
];
function section(name, melody, progression, mode = 'full') {
  const quiet = mode === 'quiet', intro = mode === 'intro';
  const lead = line(bars(melody), 0, R);
  const bass = [], stabs = [], hits = [];
  progression.forEach((key, b) => {
    const [root, fifth, chord, arp] = chords[key], r = b * 16;
    bass.push([r,root,3,quiet?33:43], [r+6,fifth,2,quiet?24:29], [r+10,root,4,quiet?29:37]);
    // Chord punctuation occupies the lead's breaths; intro shows the full gesture.
    // Revision: the earlier row-13 stab collided with the answer's C over Bb.
    // Wait for that note's cut; the single-row flicker becomes an upbeat.
    const positions = intro ? [0,6,12] : [14];
    for (const p of positions) stabs.push([r+p,chord,intro?2:1,intro?25:quiet?13:18,arp]);
    for (let t=0;t<16;t+=2) {
      if (quiet && ![0,8,12].includes(t)) continue;
      const inst = t===0 || t===10 ? 3 : t===4 || t===12 ? 4 : 5;
      hits.push([r+t,inst,inst===3?(quiet?24:36):inst===4?(quiet?14:24):(t%4?8:12),...(inst===5?['SC2']:[])]);
    }
  });
  return pattern(name,R,[lead,line(bass,1,R),line(stabs,2,R,{sustain:0.45}),drums(hits,R)]);
}
const P = [
  section('00 tickets / chord pickup',[[],[],[],[[10,'F-5',3,29]]],['Bb','Gm','Eb','F'],'intro'),
  section('01 A / hop and question',A,['Bb','Gm','Eb','F']),
  section('02 A / homeward answer',answer,['Bb','Gm','Eb','Bb']),
  section('03 A / higher window',changed,['Bb','Gm','Eb','F']),
  section('04 A / softer answer',answer,['Bb','Gm','Eb','Bb'],'quiet'),
  section('05 B / side street',B,['Cm','Eb','Gm','F'],'quiet'),
  section('06 B / wheels return',B,['Cm','Eb','Gm','F']),
  section('07 crossing / breath',[[],[],B[2],A[3]],['Eb','Cm','Gm','F'],'intro'),
  section('08 A / last tram',changed,['Bb','Gm','Eb','F']),
  section('09 A / tonic and loop',answer,['Bb','Gm','Eb','Bb']),
];
writeSong(import.meta.url,{
  title:'Pocket Tram',bpm:132,ticks:6,mixvol:78,
  message:`${CREDIT}\nOriginal Bb-major chip-pop; 4/4, four voices. All samples synthesized.\nSource: songs/pocket_tram.gen.js. Study and verification: docs/astra-batch.md.`,
  samples:[{name:'ticket pulse',synth:{wave:'square',pulse:0.25}},{name:'tram bass',synth:{wave:'triangle'}},{name:'soft chord pulse',synth:{wave:'square',pulse:0.125}},...kit(611)],
  channelnames:{0:'lead / pickup',1:'bass / wheels',2:'chord punctuation',3:'shared chip drums'},
  patterns:P,order:P.map((_,i)=>i),
});
