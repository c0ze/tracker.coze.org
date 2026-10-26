/**
 * mergeSongs — combine two cozy song JSONs (+ an authored bridge) into ONE
 * adaptive module, so a game's whole score can live in a single .it and
 * CozyAdaptive can transition between songs seamlessly:
 *
 *   music.transitionTo('nb:groove', { via: 'bridge' });
 *
 * How it works:
 * - B's channels are appended after A's (layers stay independent), B's
 *   instrument indices are remapped into the merged sample list (deduped).
 * - Three control channels are added; row 0 of EVERY pattern is stamped with
 *   that song's tempo (Txx), speed (Axx) and loudness (Vxx global volume,
 *   compensating for differing authored mixvols) — so a jump to any section
 *   lands with the right clock within one row.
 * - The bridge is authored music (composed per pair — this is where the LLM
 *   earns its keep): a factory receiving channel/instrument mapping helpers,
 *   returning patterns in the merged space. It stamps its own tempo ramp.
 * - Section names get prefixed ("siege:explore", "nb:groove"); "bridge"
 *   spans the bridge patterns. Manifest layers are merged with B's channels
 *   offset.
 */

import { assertSong } from './validate-song.js';

const hex2 = (n) => Math.round(n).toString(16).toUpperCase().padStart(2, "0");

export function mergeSongs(a, b, opts = {}) {
  assertSong(a);
  assertSong(b);
  // Match the writer defaults before generating explicit clock/volume effects.
  a = { ...a, bpm: a.bpm ?? 120, ticks: a.ticks ?? 6, mixvol: a.mixvol ?? 48 };
  b = { ...b, bpm: b.bpm ?? 120, ticks: b.ticks ?? 6, mixvol: b.mixvol ?? 48 };
  const nameA = opts.nameA || "a";
  const nameB = opts.nameB || "b";
  const chCount = (s) => Math.max(...s.patterns.map((p) => p.channels.length));
  const chA = chCount(a);
  const chB = chCount(b);
  const ctrl = [chA + chB, chA + chB + 1, chA + chB + 2]; // tempo, speed, gvol
  const totalCh = chA + chB + 3;
  if (totalCh > 64) throw new Error(`merge needs ${totalCh} channels; maximum is 64 channels including controls`);

  // samples: A's, then B's (deduped by identical definition)
  const samples = a.samples.map((s) => ({ ...s }));
  const key = (d) => JSON.stringify(d);
  const bInst = b.samples.map((def) => {
    const i = samples.findIndex((s) => key(s) === key(def));
    if (i >= 0) return i;
    samples.push({ ...def });
    return samples.length - 1;
  });
  if (samples.length > 255) throw new Error('merge exceeds 255 samples');

  const remapChn = (chn, label, orderLength, orderOffset = 0, instMap = null) => {
    const out = {};
    for (const [r, ev] of Object.entries(chn)) {
      const mapped = { ...ev };
      if (instMap && ev.instrument !== undefined) mapped.instrument = instMap[ev.instrument];
      if (/^B[0-9A-Fa-f]{2}$/.test(ev.fx)) {
        const target = parseInt(ev.fx.slice(1), 16);
        if (target >= orderLength) throw new Error(`${label} jump ${ev.fx} at row ${r} is outside its order list (${orderLength} entries)`);
        if (target + orderOffset > 255) throw new Error(`${label} relocated jump target ${target + orderOffset} exceeds Bxx maximum 255`);
        mapped.fx = 'B' + hex2(target + orderOffset);
      }
      out[r] = mapped;
    }
    return out;
  };
  const padTo = (channels, n) => {
    const c = channels.map((x) => ({ ...x }));
    while (c.length < n) c.push({});
    return c;
  };

  // loudness: header mixvol = the louder song's; quieter song compensated via Vxx
  const mixvol = Math.max(a.mixvol, b.mixvol);
  const gvFor = (s) => mixvol === 0 ? 0 : Math.min(128, Math.round(128 * s.mixvol / mixvol));

  const stamp = (pat, { bpm, ticks, gv }) => {
    const channels = padTo(pat.channels, totalCh);
    channels[ctrl[0]] = { ...channels[ctrl[0]], 0: { fx: "T" + hex2(bpm) } };
    channels[ctrl[1]] = { ...channels[ctrl[1]], 0: { fx: "A" + hex2(ticks) } };
    channels[ctrl[2]] = { ...channels[ctrl[2]], 0: { fx: "V" + hex2(gv) } };
    return { ...pat, channels };
  };

  // bridge factory: authored against the merged space via these helpers
  const localIndex = (index, count, label) => {
    if (!Number.isInteger(index) || index < 0 || index >= count) throw new Error(`bridge ${label} index ${index} outside 0..${count - 1}`);
    return index;
  };
  const ctx = {
    chA: (i) => localIndex(i, chA, 'A channel'),
    chB: (i) => chA + localIndex(i, chB, 'B channel'),
    iA: (i) => localIndex(i, a.samples.length, 'A sample'),
    iB: (i) => bInst[localIndex(i, b.samples.length, 'B sample')],
    ctrl,
    totalCh,
    hex2,
    aBpm: a.bpm, bBpm: b.bpm, aTicks: a.ticks, bTicks: b.ticks,
    gvA: gvFor(a), gvB: gvFor(b),
  };
  const bridge = opts.bridge ? opts.bridge(ctx) : { patterns: [] };
  if (!bridge || !Array.isArray(bridge.patterns)) throw new Error('bridge must return a patterns array');
  const aOrdLen = a.order.length;
  const brOrdLen = bridge.patterns.length;
  const bOrdBase = aOrdLen + brOrdLen;
  const orderLength = bOrdBase + b.order.length;
  if (a.patterns.length + brOrdLen + b.patterns.length > 254) throw new Error('merge exceeds 254 patterns (254 and 255 are reserved order markers)');
  if (orderLength > 65534) throw new Error('merge exceeds 65534 order entries');
  if (brOrdLen) {
    assertSong({ samples, patterns: bridge.patterns, order: bridge.patterns.map((_, i) => i) });
  }
  const bridgePats = bridge.patterns.map((p) => {
    if (p.channels.length > totalCh) throw new Error(`bridge has ${p.channels.length} channels; merged layout allows ${totalCh}`);
    // Bridge factories already author absolute merged channel/sample/order space.
    return { ...p, channels: padTo(p.channels.map(ch => remapChn(ch, 'bridge', orderLength)), totalCh) };
  });

  const aPats = a.patterns.map(p => stamp({ ...p, channels: p.channels.map(ch => remapChn(ch, 'A', aOrdLen)) },
    { bpm: a.bpm, ticks: a.ticks, gv: gvFor(a) }));
  const bPats = b.patterns.map(p => stamp({ ...p, channels: [
    ...Array.from({ length: chA }, () => ({})),
    ...p.channels.map(ch => remapChn(ch, 'B', b.order.length, bOrdBase, bInst)),
  ] }, { bpm: b.bpm, ticks: b.ticks, gv: gvFor(b) }));

  const bridgePatBase = a.patterns.length;
  const bPatBase = bridgePatBase + bridgePats.length;
  const order = [
    ...a.order,
    ...bridgePats.map((_, i) => bridgePatBase + i),
    ...b.order.map((p) => p + bPatBase),
  ];

  const sections = {};
  for (const [n, [s, e]] of Object.entries(a.adaptive?.sections || {})) sections[`${nameA}:${n}`] = [s, e];
  if (brOrdLen) sections.bridge = [aOrdLen, aOrdLen + brOrdLen - 1];
  for (const [n, [s, e]] of Object.entries(b.adaptive?.sections || {})) sections[`${nameB}:${n}`] = [s + aOrdLen + brOrdLen, e + aOrdLen + brOrdLen];
  const layers = [
    ...(a.adaptive?.layers || []).map((l) => ({ ...l, name: `${nameA}:${l.name}` })),
    ...(b.adaptive?.layers || []).map((l) => ({ ...l, name: `${nameB}:${l.name}`, channels: l.channels.map((c) => c + chA) })),
  ];

  const merged = {
    title: opts.title || `${a.title} -> ${b.title}`,
    message: opts.message || `${a.title} + bridge + ${b.title}\nOne adaptive module, two songs, generated transition.`,
    bpm: a.bpm,
    ticks: a.ticks,
    mixvol,
    samples,
    channelnames: {
      ...Object.fromEntries(Object.entries(a.channelnames || {}).map(([k, v]) => [k, `${nameA[0]}:${v}`])),
      ...Object.fromEntries(Object.entries(b.channelnames || {}).map(([k, v]) => [+k + chA, `${nameB[0]}:${v}`])),
      [ctrl[0]]: "tempo", [ctrl[1]]: "speed", [ctrl[2]]: "gvol",
    },
    order,
    patterns: [...aPats, ...bridgePats, ...bPats],
    adaptive: {
      layers,
      sections,
      loop: opts.loop || (a.adaptive?.loop ? `${nameA}:${a.adaptive.loop}` : undefined),
    },
  };
  assertSong(merged);
  return merged;
}
