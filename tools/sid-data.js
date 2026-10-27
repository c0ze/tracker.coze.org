// SID song tables for the driver (sid/FORMAT.md): note frequencies, instruments with their
// wavetable steps, filter programs and sound effects. Browser-safe (no Node imports).
import { waveBits, filterBits, isNoteName } from './validate-sid.js';

export const PAL_CLOCK = 985248; // Hz: the frequency cRSID and sidplayfp use for PAL
const NAMES = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];

/** cozy-tracker note name -> number (C-5 = 60 = middle C). */
export const noteNumber = (s) => NAMES.indexOf(s.slice(0, 2)) + 12 * Number(s[2]);
export const noteName = (n) => NAMES[n % 12] + Math.floor(n / 12);
/** Driver notes 0..95 are cozy-tracker C-1..B-8. */
export const DRIVER_NOTE_OFFSET = 12;

/** $D400/$D401 values for driver notes 0..95 (c64prg.txt: Fout = Fn * Fclk / 16777216). */
export function frequencyTable() {
  const lo = [], hi = [];
  for (let n = 0; n < 96; n++) {
    const hz = 440 * 2 ** ((n + DRIVER_NOTE_OFFSET - 69) / 12);
    const v = Math.min(0xffff, Math.round((hz * 16777216) / PAL_CLOCK));
    lo.push(v & 0xff);
    hi.push(v >> 8);
  }
  return { lo, hi };
}

/** Relative semitones or an absolute note name -> the wt_note byte. */
function stepNote(note, transpose) {
  if (isNoteName(note)) {
    const n = noteNumber(note) - DRIVER_NOTE_OFFSET + transpose;
    if (n < 0 || n > 95) throw new Error(`wavetable note ${note} is outside C-1..B-8`);
    return 0x80 | n;
  }
  return note & 0x7f;
}

/**
 * Instruments -> driver tables. Returns { ins: {ad, sr, wave, pwLo, pwHi, pwSpd, pwMin, pwMax,
 * flt}, wt: {wave, note}, flt: {cut, spd, min, max, res, mode}, transpose[], warnings[] }.
 */
export function instrumentTables(samples) {
  const ins = { ad: [], sr: [], wave: [], pwLo: [], pwHi: [], pwSpd: [], pwMin: [], pwMax: [], flt: [] };
  const wt = { wave: [], note: [] }, flt = { cut: [], spd: [], min: [], max: [], res: [], mode: [] };
  const warnings = [], transpose = [];
  samples.forEach((sample, i) => {
    const s = sample.sid, name = sample.name ?? `instrument ${i}`;
    const [a, d, sus, r] = s.adsr;
    ins.ad.push((a << 4) | d);
    ins.sr.push((sus << 4) | r);
    transpose.push(s.transpose ?? 0);
    const start = wt.wave.length;
    ins.wave.push(start);
    let pulseWave = false;
    for (const step of s.wave) {
      const [w, note = 0] = Array.isArray(step) ? step : [step];
      const bits = waveBits(w);
      pulseWave ||= (bits & 0x40) !== 0;
      wt.wave.push(bits);
      wt.note.push(stepNote(note, 0));
    }
    wt.wave.push(0xff);                                   // jump back, or hold the last step
    wt.note.push(s.loop === undefined ? 0xff : start + s.loop);
    if (s.pulse && s.pulse !== 'carry') {
      const p = s.pulse;
      ins.pwLo.push(p.width & 0xff);
      ins.pwHi.push(p.width >> 8);
      ins.pwSpd.push((p.speed ?? 0) & 0xff);
      ins.pwMin.push((p.min ?? 0x100) >> 8);
      ins.pwMax.push((p.max ?? 0xf00) >> 8);
    } else {
      // "carry": the voice's running width and sweep go on, as asked; left out, say so.
      if (pulseWave && s.pulse !== 'carry') warnings.push(`${name}: pulse waveform without pulse settings keeps the previous note's width`);
      ins.pwLo.push(0); ins.pwHi.push(0xff); ins.pwSpd.push(0); ins.pwMin.push(0); ins.pwMax.push(0);
    }
    if (s.filter === 'carry') ins.flt.push(0xff);             // take the running filter as it is
    else if (s.filter) {
      const f = s.filter;
      flt.cut.push(f.cutoff >> 3);                        // the driver writes only $D416
      flt.spd.push((f.speed ?? 0) & 0xff);
      flt.min.push((f.min ?? 0) >> 3);
      flt.max.push((f.max ?? 2047) >> 3);
      flt.res.push((f.resonance ?? 0) << 4);
      flt.mode.push(filterBits(f.mode));
      ins.flt.push(flt.cut.length);                       // program + 1
    } else ins.flt.push(0);
  });
  if (wt.wave.length > 255) throw new Error(`wavetable has ${wt.wave.length} steps; the driver holds 255`);
  return { ins, wt, flt, transpose, warnings };
}

/** song.sid.sfx -> { ins, note, len, tail } tables (one silent entry when there are none). */
export function sfxTables(sfx = [], transpose) {
  const t = { ins: [], note: [], len: [], tail: [] };
  for (const e of sfx) {
    const n = noteNumber(e.note) - DRIVER_NOTE_OFFSET + transpose[e.instrument];
    if (n < 0 || n > 95) throw new Error(`sfx ${e.name}: note ${e.note} is outside C-1..B-8`);
    t.ins.push(e.instrument);
    t.note.push(n);
    t.len.push(e.frames);
    t.tail.push(e.tail ?? 10);
  }
  if (!t.ins.length) { t.ins.push(0); t.note.push(0); t.len.push(0); t.tail.push(0); }
  return t;
}
