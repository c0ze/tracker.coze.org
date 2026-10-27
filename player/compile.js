// Preview compilation for the tracker: song JSON to an IT module or a PSID, and sample defs to
// itwriter samples. Browser-safe (the page, the preview worker and Node tests load it).
//
// Two modes:
//   public  the site's own songs, as the player has always built them: synth specs, same-site
//           `file` samples fetched from options.fetchBase, raw samples; the SID driver is
//           fetched from <fetchBase>sid/<file>. Mirrors tools/json2it.js and tools/json2sid.js.
//   hosted  untrusted songs: admitSong first, then synth specs and verified assets only
//           (tools/hosted/resolve.js); the SID driver comes from options.sidDriver.
import itwriter from '../vendor/itwriter/index.js';
import { synthesize, describeAllocation } from '../tools/synth.js';
import { readWav } from '../tools/wav.js';
import { applySampleDef } from '../tools/sample-overrides.js';
import { assertSong, validateSong } from '../tools/validate-song.js';
import { compileSid, DRIVER_FILES } from '../tools/sid-compile.js';
import { admitSong } from '../tools/hosted/admit.js';
import { resolveHostedSample } from '../tools/hosted/resolve.js';
import { POLICY } from '../tools/hosted/policy.js';

const message = (e) => e?.message ?? String(e);
const isSidSong = (json) => json !== null && typeof json === 'object' && json.sid !== undefined;
const defaultBase = () => (globalThis.location ? globalThis.location.origin + '/' : undefined);
const fetcher = (options) => options.fetch ?? globalThis.fetch;

/**
 * Resolve one song sample definition to an itwriter sample.
 * options: { mode: 'public'|'hosted', assets, fetchBase, policy, cache, fetch }.
 * public: synth, a same-site `file` (relative to fetchBase, default the page's origin) or a raw
 * sample; `cache` (a Map keyed by the def's JSON) reuses earlier results.
 * hosted: synth and verified assets only; a synth def whose PCM would exceed
 * policy.maxSampleBytes16 on its own is refused before anything is synthesized.
 */
export async function resolvePreviewSample(def, options = {}) {
  const { mode = 'public' } = options;
  if (mode === 'hosted') return resolveHosted(def, options);
  if (mode !== 'public') throw new Error(`unknown preview mode: ${mode}`);
  const key = options.cache && JSON.stringify(def);
  if (options.cache?.has(key)) return options.cache.get(key);
  let s;
  if (def.synth) {
    s = applySampleDef({ name: def.name, ...synthesize(def.synth) }, def);
  } else if (def.file) {
    // Sample paths are site-relative; never let a song JSON point at another host.
    const base = new URL(options.fetchBase ?? defaultBase());
    const url = new URL(def.file.replace(/^\/+/, ''), base);
    if (url.origin !== base.origin) throw new Error(`sample outside this site: ${def.file}`);
    const resp = await fetcher(options)(url.href);
    if (!resp.ok) throw new Error(`fetch failed: ${def.file}`);
    const wav = readWav(new Uint8Array(await resp.arrayBuffer()));
    s = applySampleDef({ name: def.file.split('/').pop(), ...wav }, def);
  } else {
    s = applySampleDef({ ...def }, def); // raw itwriter sample
  }
  options.cache?.set(key, s);
  return s;
}

async function resolveHosted(def, { assets = {}, policy = POLICY }) {
  if (def !== null && typeof def === 'object' && def.synth !== undefined) {
    const { bytes16 } = describeAllocation(def.synth);
    if (!(bytes16 <= policy.maxSampleBytes16))
      throw new Error(`sample data is ${bytes16} bytes as 16-bit PCM (limit ${policy.maxSampleBytes16})`);
  }
  return resolveHostedSample(def, assets);
}

// The SID driver source, fetched once per site (public mode).
const drivers = new Map();
function publicDriver(options) {
  const base = new URL('sid/', options.fetchBase ?? defaultBase()).href;
  if (!drivers.has(base)) {
    const text = Promise.all(DRIVER_FILES.map(async (f) => {
      const url = new URL(f, base).href;
      const res = await fetcher(options)(url);
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
      return res.text();
    })).then((parts) => parts.join('\n'));
    drivers.set(base, text);
    text.catch(() => drivers.delete(base)); // a failed fetch is retried next time
  }
  return drivers.get(base);
}

/**
 * Compile a song for preview. options: { mode: 'public'|'hosted', assets, policy, rate,
 * fetchBase, cache, fetch, sidDriver }. Hosted mode runs admitSong first.
 * Returns { ok, errors, it: Uint8Array|null, sid: { psid, org, orderMap, stats, warnings }|null };
 * failures are reported in `errors`, never thrown.
 */
export async function compileSong(json, options = {}) {
  const { mode = 'public', policy = POLICY } = options;
  const errors = [];
  const out = { ok: false, errors, it: null, sid: null };
  const fail = (...list) => { errors.push(...list); return out; };
  if (mode !== 'public' && mode !== 'hosted') return fail(`unknown preview mode: ${mode}`);
  const hosted = mode === 'hosted';
  if (hosted) {
    const admission = admitSong(json, { assets: options.assets ?? {}, policy, rate: options.rate ?? 48000 });
    if (!admission.ok) return fail(...admission.errors);
  }
  try {
    if (isSidSong(json)) {
      const driver = hosted ? options.sidDriver : await publicDriver(options);
      if (typeof driver !== 'string') return fail('SID songs need the driver source (options.sidDriver)');
      const r = compileSid(json, { driver }); // compileSid validates
      if (hosted && !(r.psid.length <= policy.maxSidBytes)) return fail(`SID data is ${r.psid.length} bytes (limit ${policy.maxSidBytes})`);
      out.sid = { psid: r.psid, org: r.org, orderMap: r.orderMap, stats: r.stats, warnings: r.warnings };
    } else {
      // Validates like tools/json2it.js (before and after sample resolution): itwriter would
      // silently drop or coerce what the CLI rejects, such as an event below the last row.
      assertSong(json);
      const samples = await Promise.all((json.samples || []).map((def) => resolvePreviewSample(def, options)));
      const resolved = { ...json, samples };
      if (hosted) { const e = validateSong(resolved); if (e.length) return fail(...e); }
      else assertSong(resolved);
      out.it = new Uint8Array(itwriter(resolved));
    }
  } catch (e) {
    return fail(message(e));
  }
  out.ok = true;
  return out;
}

/** The PRG (load address + code) inside a PSID: everything from the header's data offset. */
export function prgFromPsid(psid) {
  const dataOffset = (psid[6] << 8) | psid[7];
  return psid.slice(dataOffset);
}

/**
 * The worker protocol: { id, op: 'compile'|'sample', json?, def?, options } →
 * { id, ok, errors, it?, sid?, sample? }. ctx.cache is the worker's public-mode sample cache.
 */
export async function handlePreviewMessage({ id, op, json, def, options = {} }, ctx = {}) {
  try {
    if (op === 'compile') {
      const r = await compileSong(json, { ...options, cache: options.mode === 'hosted' ? undefined : ctx.cache });
      const reply = { id, ok: r.ok, errors: r.errors };
      if (r.it) reply.it = r.it;
      if (r.sid) reply.sid = r.sid;
      return reply;
    }
    if (op === 'sample') {
      const s = await resolvePreviewSample(def, { ...options, cache: options.mode === 'hosted' ? undefined : ctx.cache });
      // Fresh typed arrays, so transferring them never detaches a cached sample.
      return { id, ok: true, errors: [], sample: { ...s, channels: s.channels.map((c) => Float32Array.from(c)) } };
    }
    return { id, ok: false, errors: [`unknown preview op: ${op}`] };
  } catch (e) {
    return { id, ok: false, errors: [message(e)] };
  }
}

/** The buffers a reply transfers instead of copying. */
export function previewTransfer(reply) {
  const list = [];
  if (reply.it) list.push(reply.it.buffer);
  if (reply.sid) list.push(reply.sid.psid.buffer);
  if (reply.sample) for (const c of reply.sample.channels) if (ArrayBuffer.isView(c)) list.push(c.buffer);
  return list;
}
