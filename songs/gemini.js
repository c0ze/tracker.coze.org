export { writeSong, up } from './lib.js';
export const CREDIT = 'Created by Gemini 3.1 Pro · 2026-09-23';

/** Flatten handwritten bars: [row within bar, pitch, duration, volume, J?]. */
export const bars = (list, rowsPerBar = 16) => list.flatMap((events, bar) =>
  events.map(([r, ...event]) => [bar * rowsPerBar + r, ...event]));

/** Score the entire amplitude envelope, including an actual sample-mode cut. */
export function line(events, instrument, rows, { sustain = 0.65, release = 0.22 } = {}) {
  const out = {};
  const sorted = [...events].sort((a, b) => a[0] - b[0]);
  for (let i = 0; i < sorted.length; i++) {
    const [r, note, length, volume = 36, fx] = sorted[i];
    const end = r + length;
    if (!Number.isInteger(r) || !Number.isInteger(length) || r < 0 || length < 1 || end >= rows)
      throw new Error(`Unclosed/out-of-range note ${note} at ${r}+${length}/${rows}`);
    if (i && r < sorted[i - 1][0] + sorted[i - 1][2])
      throw new Error(`Overlapping phrase at ${r}`);
    if (out[r]?.note && out[r].note !== '^^') throw new Error(`Duplicate onset at ${r}`);
    out[r] = { note, instrument, vol: `v${volume}`, ...(fx ? { fx } : {}) };
    for (let t = 1; t < length; t++) {
      const ev = {};
      if (t === 1) ev.vol = `v${Math.round(volume * sustain)}`;
      if (length >= 3 && t === length - 1) ev.vol = `v${Math.round(volume * release)}`;
      if (fx?.startsWith('J') || fx?.startsWith('H') || fx?.startsWith('G')) ev.fx = fx;
      if (Object.keys(ev).length) out[r + t] = ev;
    }
    out[end] = { note: '^^' };
  }
  return out;
}

export function drums(events, rows) {
  const out = {};
  for (const [r, instrument, volume, fx] of events) {
    if (out[r] || r < 0 || r >= rows - 1) throw new Error(`Drum collision/range at ${r}`);
    out[r] = { note: 'C-5', instrument, vol: `v${volume}`, ...(fx ? { fx } : {}) };
  }
  out[rows - 1] = { note: '^^' };
  return out;
}

export function pattern(name, rows, channels, pans = [112, 128, 152, 128, 176, 140]) {
  channels.forEach((ch, c) => {
    if (!ch[0]?.note) ch[0] = { ...ch[0], note: '^^' };
    const fx = `X${(pans[c] || 128).toString(16).toUpperCase().padStart(2, '0')}`;
    let r = 0;
    while (ch[r]?.fx) r++;
    if (r >= rows) throw new Error('No free pan slot');
    ch[r] = { ...ch[r], fx };
  });
  return { name, rows, channels };
}

export const kit = (seed = 601) => [
  { name: 'chip kick', synth: { wave: 'kick', seconds: 0.13, decay: 29, freqStart: 185, freqEnd: 52, sweep: 34 } },
  { name: 'noise snare', synth: { wave: 'noise', seconds: 0.095, decay: 34, seed } },
  { name: 'noise hat', synth: { wave: 'noise', seconds: 0.08, decay: 42, seed: seed + 1 } },
];
