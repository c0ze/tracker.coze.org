#!/usr/bin/env node
/**
 * Glass Harbor — Created by Gpt-6 Astra, 2026-09-23.
 * F major, 90 BPM, 4/4, speed 6: 4 rows/beat, 16/bar, 64/phrase (10.667s).
 * Sleepy Snow p0/p3: staggered entrances and releases make the harmony.
 * Here every tail has an explicit endpoint; no XM-envelope assumptions.
 * Five voices, no drum grid. Lead/bass + quiet dyad + selected cadence echo.
 * Arrival / A+A' / B+B' / exposed water / A return / F landing into arrival.
 */
import { bars, line, pattern, writeSong, CREDIT } from './astra.js';
const R=64;
const chords={F:['F-3','A-4','C-5'],Dm:['D-3','A-4','D-5'],Bb:['A#2','A#4','D-5'],C:['C-3','G-4','C-5'],Gm:['G-3','A#4','D-5']};
const A=[
 [[2,'C-6',3,35],[8,'A-5',6,39]],
 [[0,'F-5',6,35],[10,'A-5',4,34]],
 [[2,'D-6',3,37],[8,'F-6',6,40]],
 [[0,'E-6',5,35],[8,'G-5',6,33]],
];
const answer=[A[0],A[1],[[2,'D-6',4,36],[10,'A#5',4,33]],[[0,'A-5',5,36],[8,'F-5',6,37]]];
const B=[
 [[0,'D-6',9,35],[12,'A-5',2,28]],
 [[2,'A#5',5,33],[10,'F-5',4,30]],
 [[0,'G-5',9,34],[12,'A#5',2,28]],
 [[2,'C-6',5,34],[10,'G-5',4,30]],
];
function section(name,melody,progression,{thin=false,echo=false,arrival=false}={}){
 const bass=[],low=[],high=[],answering=[];
 progression.forEach((key,b)=>{
  const [root,third,fifth]=chords[key],r=b*16;
  bass.push([r,root,14,thin?28:36]);
  // Separate entrances, common tones, and decays: the chord is a slow gesture.
  low.push([r+1,third,12,thin?10:16]);
  // On the return, the echo takes this voice's place rather than adding density.
  if((!thin || b%2===0) && !(echo && (b===0||b===2))) high.push([r+4,fifth,9,thin?9:14]);
  // Echo only the stable second note in bars 0/2, not the whole moving melody.
  if(echo && (b===0||b===2)) {
   const e=melody[b].find(([t])=>t===8);
   if(e) answering.push([r+11,e[1],4,14]);
  }
 });
 // The water interlude gives the motif's rhythm to a lower triangle.
 const inst=arrival?2:0;
 return pattern(name,R,[line(bars(melody),inst,R,{sustain:0.54,release:0.15}),line(bass,1,R,{sustain:0.6,release:0.1}),line(low,2,R,{sustain:0.55,release:0.12}),line(high,2,R,{sustain:0.5,release:0.12}),line(answering,0,R,{sustain:0.45})],[112,128,88,164,184]);
}
const P=[
 section('00 arrival / reflected lights',[[[8,'C-6',6,25]],[],[[8,'F-6',6,27]],[]],['F','Dm','Bb','C'],{thin:true,arrival:true}),
 section('01 A / tide question',A,['F','Dm','Bb','C']),
 section('02 A / shore answer',answer,['F','Dm','Bb','F']),
 section('03 B / open water',B,['Dm','Bb','Gm','C'],{thin:true}),
 section('04 B / far lights',B,['Dm','Bb','Gm','C']),
 section('05 water / low reflection',[[[2,'C-5',3,24],[8,'A-4',6,27]],[[0,'F-5',6,26]],[[2,'D-5',3,25],[8,'F-5',6,28]],[[0,'E-5',5,25],[8,'G-5',6,26]]],['F','Dm','Bb','C'],{thin:true,arrival:true}),
 section('06 A / reflected cadence',A,['F','Dm','Bb','C'],{echo:true}),
 section('07 A / harbor landing',answer,['F','Dm','Bb','F']),
];
writeSong(import.meta.url,{
 title:'Glass Harbor',bpm:90,ticks:6,mixvol:82,
 message:`${CREDIT}\nOriginal F-major nocturne; 4/4, five voices, no percussion. All samples synthesized.\nSource: songs/glass_harbor.gen.js. Study and verification: docs/astra-batch.md.`,
 samples:[{name:'glass pluck',synth:{wave:'pluck',seconds:2.4,decay:3.7}},{name:'harbor triangle bass',synth:{wave:'triangle'}},{name:'soft reflected triangle',synth:{wave:'triangle'}}],
 channelnames:{0:'tide melody',1:'harbor bass',2:'lower reflection',3:'upper reflection',4:'cadence echo'},patterns:P,order:P.map((_,i)=>i),
});
