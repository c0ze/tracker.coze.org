#!/usr/bin/env node
/**
 * Moth Clock — Created by Gpt-6 Astra, 2026-09-23.
 * D minor, 112 BPM, 3/4, speed 6: 4 rows/beat, 12/bar, 48/phrase (6.429s).
 * A two-short / one-long winding gesture; major VI middle, harmonic-minor V.
 * Four voices with a shared tick/kick channel. Her Kiss p0 informs explicit
 * held-row chord arps; Silicon Dancer p4 informs economical role sharing.
 * Twelve four-bar phrases, 48 bars. The final A dominant points back to D.
 */
import { bars, line, drums, pattern, kit, writeSong, CREDIT } from './astra.js';
const R=48;
const chords={Dm:['D-3','A-3','F-4','J49'],Gm:['G-3','D-4','G-4','J37'],A:['A-3','E-4','A-4','J47'],Bb:['A#2','F-3','F-4','J59'],F:['F-3','C-4','F-4','J47'],C:['C-3','G-3','G-4','J59']};
const A=[
 [[0,'A-5',2,36],[3,'D-6',2,40],[6,'F-6',4,42]],
 [[0,'D-6',3,37],[4,'A#5',2,33],[8,'G-5',2,35]],
 [[0,'A-5',2,35],[3,'D-6',2,39],[6,'E-6',2,34],[9,'F-6',1,32]],
 [[0,'E-6',3,37],[4,'C#6',2,34],[8,'A-5',2,36]],
];
const answer=[A[0],A[1],[[0,'F-6',3,39],[4,'E-6',2,33],[8,'C#6',2,35]],[[0,'D-6',7,40]]];
const B=[
 [[0,'F-5',4,33],[6,'A#5',4,36]],
 [[0,'A-5',3,34],[4,'C-6',2,36],[8,'F-6',2,38]],
 [[0,'E-6',4,35],[6,'G-5',4,31]],
 [[0,'A-5',3,34],[4,'C#6',2,36],[8,'E-6',2,38]],
];
const reprise=[[[0,'A-5',2,36],[3,'D-6',2,40],[6,'A-6',4,41]],A[1],A[2],A[3]];
function section(name,melody,progression,{quiet=false,solo=false}={}){
 const bass=[],chord=[],hits=[];
 progression.forEach((key,b)=>{
  const [root,fifth,base,j]=chords[key],r=b*12;
  bass.push([r,root,5,quiet?32:41],[r+8,fifth,2,quiet?24:30]);
  // Waltz accompaniment articulates beats 2 and 3, below the lead's register.
  for(const t of (quiet?[4]:[4,8])) chord.push([r+t,base,2,solo?26:quiet?13:19,j]);
  hits.push([r,3,quiet?18:29],[r+4,5,quiet?5:10,'SC1']);
  if(!quiet) hits.push([r+8,4,13],[r+10,5,7,'SC1']);
 });
 return pattern(name,R,[line(bars(melody,12),0,R,{sustain:0.6}),line(bass,1,R),line(chord,2,R,{sustain:0.4}),drums(hits,R)]);
}
const P=[
 section('00 winding / tiny gears',[[],[],[],[[8,'A-5',2,27]]],['Dm','Gm','Dm','A'],{solo:true}),
 section('01 A / moth rises',A,['Dm','Gm','Dm','A']),
 section('02 A / settles',answer,['Dm','Gm','A','Dm']),
 section('03 A / high lamplight',reprise,['Dm','Gm','Dm','A']),
 section('04 A / dim answer',answer,['Dm','Gm','A','Dm'],{quiet:true}),
 section('05 B / paper wings',B,['Bb','F','C','A'],{quiet:true}),
 section('06 B / circle the lamp',B,['Bb','F','C','A']),
 section('07 clockwork / no lead',[[],[],[],[]],['Bb','F','Gm','A'],{solo:true}),
 section('08 A / familiar winding',A,['Dm','Gm','Dm','A']),
 section('09 A / final high point',reprise,['Dm','Gm','Dm','A']),
 section('10 A / settled answer',answer,['Dm','Gm','A','Dm']),
 section('11 unwinding / dominant',[[[0,'F-6',5,32]],[[0,'D-6',5,30]],[[0,'A#5',5,29]],[[0,'C#6',3,29],[6,'A-5',4,27]]],['Dm','Dm','Gm','A'],{quiet:true}),
];
writeSong(import.meta.url,{
 title:'Moth Clock',bpm:112,ticks:6,mixvol:80,
 message:`${CREDIT}\nOriginal D-minor chip waltz; 3/4, four voices. All samples synthesized.\nSource: songs/moth_clock.gen.js. Study and verification: docs/astra-batch.md.`,
 samples:[{name:'clock pulse',synth:{wave:'square',pulse:0.25}},{name:'wooden bass',synth:{wave:'triangle'}},{name:'waltz triangle chords',synth:{wave:'triangle'}},...kit(653)],
 channelnames:{0:'moth melody',1:'waltz bass',2:'two chord steps',3:'clock percussion'},patterns:P,order:P.map((_,i)=>i),
});
