// Admission of an untrusted song before anything is synthesized or rendered. Every check reads
// the JSON and asset metadata only: sizes, structure, a work bound, then the source-level
// analysis (bounded by that work bound) for the duration. Limits are written as !(value <= limit)
// so NaN refuses. The container caps real process memory (milestone 2); the estimate here keeps
// admitted work under it.
import { validateSong } from '../validate-song.js';
import { describeAllocation } from '../synth.js';
import { analyzeSongCore } from '../analysis-core.js';
import { POLICY } from './policy.js';

const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const over = (value, limit) => !(value <= limit);
const validAsset = (a) => object(a) && Number.isInteger(a.frames) && a.frames > 0 &&
  (a.channels === 1 || a.channels === 2) && Number.isInteger(a.samplerate) && a.samplerate > 0;

/**
 * Judge a song against the hosted policy. assets maps asset ids to AssetEntry metadata
 * (tools/hosted/assets.js); rate is the render rate the memory estimate assumes.
 * Returns { ok, errors, allocation: { bytes16 }, seconds, report, policyVersion }; report is the
 * analysis report (warnings, limitations, metrics) once the song gets that far, else null.
 */
export function admitSong(song, { assets = {}, policy = POLICY, rate = 48000 } = {}) {
  const errors = [];
  let bytes16 = 0, seconds = null, report = null;
  const done = () => ({ ok: errors.length === 0, errors, allocation: { bytes16 }, seconds, report, policyVersion: policy.version });

  let json;
  try { json = JSON.stringify(song) ?? ''; } catch (e) { errors.push(`song is not JSON: ${e.message}`); return done(); }
  const size = new TextEncoder().encode(json).length;
  if (over(size, policy.maxJsonBytes)) { errors.push(`song JSON is ${size} bytes (limit ${policy.maxJsonBytes})`); return done(); }

  // A SID song plays sid instruments only; an IT song plays synth specs and stored assets.
  const sid = object(song) && song.sid !== undefined;
  errors.push(...validateSong(song, { sid }));
  if (object(song) && Array.isArray(song.samples)) song.samples.forEach((s, i) => {
    const at = `samples[${i}]`;
    if (!object(s)) return;
    if (sid) { if (s.sid === undefined) errors.push(`${at}: SID songs use sid instruments`); }
    else if (s.file !== undefined || s.channels !== undefined || s.buffer !== undefined)
      errors.push(`${at}: hosted songs use synth or asset samples`);
    else if (typeof s.asset === 'string') {
      if (!Object.hasOwn(assets, s.asset)) errors.push(`${at}: unknown asset ${JSON.stringify(s.asset)}`);
      else if (!validAsset(assets[s.asset])) errors.push(`${at}: asset ${JSON.stringify(s.asset)} has invalid metadata`);
    }
  });
  if (errors.length) return done();

  const width = Math.max(...song.patterns.map((p) => p.channels.length));
  const maxChannels = sid ? Math.min(3, policy.maxChannels) : policy.maxChannels;
  if (over(song.patterns.length, policy.maxPatterns)) errors.push(`patterns: ${song.patterns.length} patterns (limit ${policy.maxPatterns})`);
  if (over(width, maxChannels)) errors.push(`channels: ${width} channels (limit ${maxChannels})`);
  song.patterns.forEach((p, i) => { if (over(p.rows, policy.maxRows)) errors.push(`patterns[${i}]: ${p.rows} rows (limit ${policy.maxRows})`); });
  if (over(song.samples.length, policy.maxSamples)) errors.push(`samples: ${song.samples.length} samples (limit ${policy.maxSamples})`);
  if (errors.length) return done();

  // Work bound before any simulation: the analysis runs at most rows x the largest speed ticks,
  // each over every channel (and every pair of sounding channels).
  const timelineRows = song.order.reduce((n, i) => n + song.patterns[i].rows, 0);
  let maxSpeed = song.ticks ?? 6;
  for (const p of song.patterns) for (const ch of p.channels) for (const ev of Object.values(ch))
    if (ev.fx?.[0] === 'A') maxSpeed = Math.max(maxSpeed, parseInt(ev.fx.slice(1), 16) || 0);
  if (over(timelineRows, policy.maxTimelineRows))
    errors.push(`song is too long to analyze: the order list plays ${timelineRows} rows (limit ${policy.maxTimelineRows})`);
  else if (over(timelineRows * maxSpeed, policy.maxAnalysisTicks))
    errors.push(`song is too long to analyze: ${timelineRows} rows at speed up to ${maxSpeed} make ${timelineRows * maxSpeed} ticks (limit ${policy.maxAnalysisTicks})`);
  else if (over(timelineRows * maxSpeed * width, policy.maxAnalysisWork))
    errors.push(`song is too long to analyze: ${timelineRows * maxSpeed} ticks on ${width} channels make ${timelineRows * maxSpeed * width} channel ticks (limit ${policy.maxAnalysisWork})`);
  if (errors.length) return done();

  // Sample data as 16-bit PCM, from specs and metadata: nothing is synthesized or decoded.
  song.samples.forEach((s, i) => {
    let b = 0;
    if (s.synth !== undefined) {
      try { b = describeAllocation(s.synth).bytes16; } catch (e) { errors.push(`samples[${i}]: ${e.message}`); return; }
    } else if (s.asset !== undefined) {
      const a = assets[s.asset];
      b = a.frames * a.channels * 2;
    }
    if (!(Number.isFinite(b) && b >= 0)) errors.push(`samples[${i}]: sample data size is not a finite number of bytes`);
    else bytes16 += b;
  });
  if (!errors.length && over(bytes16, policy.maxSampleBytes16))
    errors.push(`sample data is ${bytes16} bytes as 16-bit PCM (limit ${policy.maxSampleBytes16})`);
  if (errors.length) return done();

  // An asset is a one-shot of its own length unless its def loops.
  const sampleMeta = (s) => {
    if (s.asset === undefined) return null;
    const { frames, samplerate } = assets[s.asset];
    return { frames, samplerate };
  };
  report = analyzeSongCore(song, { sampleMeta, maxTicks: policy.maxAnalysisTicks,
    maxSeconds: policy.maxAudioSeconds, maxWarnings: policy.maxAnalysisWarnings });
  if (report.errors.length) { errors.push(...report.errors); return done(); }
  seconds = report.metrics.seconds;
  if (over(seconds, policy.maxAudioSeconds)) errors.push(`song plays ${seconds} seconds (limit ${policy.maxAudioSeconds})`);
  const memory = bytes16 * 2 + (policy.maxAudioSeconds + 2) * rate * 8;
  if (over(memory, policy.maxMemoryBytes)) errors.push(`estimated memory ${memory} bytes is over the limit (${policy.maxMemoryBytes})`);
  return done();
}
