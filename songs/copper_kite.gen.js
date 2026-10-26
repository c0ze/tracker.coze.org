#!/usr/bin/env node
/**
 * Copper Kite — Created by Gpt-6 Astra, 2026-09-23.
 * E Dorian, 150 BPM, 4/4, speed 3: 8 rows/beat, 32/bar, 128/phrase (6.4s).
 * A 3+3+2 eighth-note attack cell; C# supplies Dorian color in the A-major bar.
 * Launch / A+A' / sprint / B+B' / exposed bass / rebuild / A+A' / landing.
 * War Path p0 informed the gates and late pickup, not its pitches or meter.
 */
import { bars, line, drums, pattern, kit, writeSong, CREDIT } from './astra.js';
const R=128;
const chords={Em:['E-3','B-3','E-5','J37'],D:['D-3','A-3','D-5','J47'],A:['A-3','E-4','C#5','J38'],Bm:['B-2','F#3','D-5','J49'],G:['G-3','D-4','D-5','J59']};
// Score on a 16-row sketch, then double timing to the speed-3 grid.
const A=[
 [[0,'E-6',4,42],[6,'E-6',4,34],[12,'B-5',3,40]],
 [[0,'F#6',3,42],[6,'D-6',2,35],[10,'A-5',4,38]],
 [[0,'E-6',4,40],[6,'C#6',4,36],[12,'A-5',3,40]],
 [[0,'F#5',3,36],[6,'B-5',2,39],[10,'D-6',2,36],[13,'F#6',2,40]],
];
const answer=[A[0],A[1],A[2],[[0,'G-6',3,41],[6,'F#6',2,33],[10,'E-6',4,41]]];
const B=[
 [[0,'B-5',6,34],[8,'D-6',3,36],[12,'G-6',2,38]],
 [[2,'F#6',4,34],[8,'D-6',6,33]],
 [[0,'E-6',6,36],[8,'C#6',3,32],[12,'A-5',2,30]],
 [[0,'F#5',5,33],[8,'B-5',3,35],[12,'D-6',2,33]],
];
const scale = es => es.map(([r,n,l,v,fx])=>[r*2,n,l*2,v,fx]);
function section(name,melody,progression,{quiet=false,drive=false,empty=false}={}){
 const bass=[],arp=[],kick=[],hats=[];
 progression.forEach((key,b)=>{
  const [root,fifth,chord,j]=chords[key],r=b*32;
  const rhythm=quiet?[[0,9,40],[16,7,33],[26,3,28]]:[[0,4,45],[6,3,32],[12,4,40],[20,3,34],[24,5,42]];
  // A 50% pulse carries more energy than the narrow lead: reserve its headroom.
  for(const [t,l,v] of rhythm) bass.push([r+t,t===20?fifth:root,l,Math.round(v*0.72)]);
  // No competing moving arp under the riff. Chords speak in the final breath.
  for(const t of (empty?[0,12,24]:[30])) arp.push([r+t,chord,t===30?1:4,empty?23:20,j]);
  for(const t of (quiet?[0,16]:[0,8,12,16,24])) kick.push([r+t,t===8||t===24?4:3,t===8||t===24?26:40]);
  if(!quiet) for(let t=2;t<30;t+=4) hats.push([r+t,5,drive&&t===26?17:10,'SC1']);
 });
 const lead=line(scale(bars(melody)),0,R,{sustain:0.58});
 return pattern(name,R,[lead,line(bass,1,R,{sustain:0.7}),line(arp,2,R),drums(kick,R),drums(hats,R)],[112,128,160,128,168]);
}
const P=[
 section('00 launch / bass machinery',[[],[],[],A[3]],['Em','D','A','Bm'],{empty:true}),
 section('01 A / copper hook',A,['Em','D','A','Bm']),
 section('02 A / landing answer',answer,['Em','D','A','Em']),
 section('03 sprint / tight hats',A,['Em','D','A','Bm'],{drive:true}),
 section('04 sprint / answer',answer,['Em','D','A','Em'],{drive:true}),
 section('05 B / sky opens',B,['G','D','A','Bm'],{quiet:true}),
 section('06 B / wind returns',B,['G','D','A','Bm']),
 section('07 exposed machinery',[[],[],[],[]],['Em','D','A','Bm'],{quiet:true,empty:true}),
 section('08 rebuild / pickup',[[],[],A[2],A[3]],['Em','D','A','Bm'],{empty:true}),
 section('09 A / home stretch',A,['Em','D','A','Bm'],{drive:true}),
 section('10 A / clear answer',answer,['Em','D','A','Em']),
 section('11 landing / E pedal',[A[0],[],[[0,'B-5',6,32]],[[0,'E-6',8,36]]],['Em','Em','Em','Em'],{quiet:true}),
];
writeSong(import.meta.url,{
 title:'Copper Kite',bpm:150,ticks:3,mixvol:72,
 message:`${CREDIT}\nOriginal E-Dorian chase; 4/4, speed 3, five voices. All samples synthesized.\nSource: songs/copper_kite.gen.js. Study and verification: docs/astra-batch.md.`,
 samples:[{name:'copper pulse',synth:{wave:'square',pulse:0.125}},{name:'motor pulse bass',synth:{wave:'square',pulse:0.5}},{name:'triangle chord',synth:{wave:'triangle'}},...kit(631)],
 channelnames:{0:'lead / 3+3+2',1:'gated motor bass',2:'chord answers',3:'kick and snare',4:'gated hats'},patterns:P,order:P.map((_,i)=>i),
});
