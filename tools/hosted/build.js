// The hosted build: admit an untrusted song, build its module and render it within the policy's
// bounds. Browser-safe: SID songs get their driver source and their renderer from the host
// (options.sidDriver, options.renderSid); tools/hosted-build-cli.js passes Node ones.
import itwriter from '../../vendor/itwriter/index.js';
import { validateSong } from '../validate-song.js';
import { compileSid } from '../sid-compile.js';
import { renderModule } from '../render-core.js';
import { admitSong } from './admit.js';
import { resolveHostedSamples } from './resolve.js';
import { POLICY } from './policy.js';

const SILENT_DBFS = -60;
const MODELS = ['6581', '8580'];
const dbfs = (v) => (v > 0 ? 20 * Math.log10(v) : -Infinity);
const message = (e) => e?.message ?? String(e);

/**
 * Builds a song for the hosted studio. IT songs: admit → resolve samples → itwriter → render
 * with libopenmpt for at most policy.maxAudioSeconds + 2 seconds and policy.maxRenderWallMs.
 * SID songs (a `sid` object): admit → compileSid with options.sidDriver → render through
 * options.renderSid(psid, org, { seconds, model, rate, deadlineMs }).
 *
 * Returns { ok, errors, it | sid, render, admission, lint: { warnings, limitations } }.
 * `render` holds the stats (rate, frames, seconds, truncated, timedOut, peak, rms, peakDbfs,
 * rmsDbfs, clipped; railHits and model for SID) and the PCM (left, right), or null when the
 * build stopped before rendering or `render` is false. A render that is truncated, timed out,
 * silent (peak below -60 dBFS) or clipped makes ok false.
 */
export async function buildHosted(song, { assets = {}, policy = POLICY, render = true, rate = 48000, model, sidDriver, renderSid } = {}) {
  const sid = song !== null && typeof song === 'object' && !Array.isArray(song) && song.sid !== undefined;
  const errors = [];
  const out = { ok: false, errors, ...(sid ? { sid: null } : { it: null }), render: null, admission: null, lint: { warnings: [], limitations: [] } };
  const done = () => { out.ok = errors.length === 0; return out; };

  if (!policy.renderRates.includes(rate)) {
    errors.push(`render rate ${rate} is not one of ${policy.renderRates.join(', ')} Hz`);
    return done();
  }
  if (sid) {
    model ??= song.sid.model ?? '6581';
    if (!MODELS.includes(String(model))) { errors.push(`SID model ${model} is not 6581 or 8580`); return done(); }
  }

  const admission = admitSong(song, { assets, policy, rate });
  out.admission = admission;
  if (admission.report) out.lint = { warnings: admission.report.warnings, limitations: admission.report.limitations };
  if (!admission.ok) { errors.push(...admission.errors); return done(); }

  return sid ? buildSid(song, out, errors, done, { policy, render, rate, model: String(model), sidDriver, renderSid })
    : buildIt(song, out, errors, done, { assets, policy, render, rate });
}

async function buildIt(song, out, errors, done, { assets, policy, render, rate }) {
  let built;
  try {
    built = { ...song, samples: await resolveHostedSamples(song, assets) };
  } catch (e) {
    errors.push(`samples: ${message(e)}`);
    return done();
  }
  errors.push(...validateSong(built));
  if (errors.length) return done();
  try {
    out.it = new Uint8Array(itwriter(built));
  } catch (e) {
    errors.push(`module: ${message(e)}`);
    return done();
  }
  if (!render) return done();

  const maxFrames = (policy.maxAudioSeconds + 2) * rate;
  let r;
  try {
    r = await renderModule(out.it, { rate, maxFrames, deadlineMs: policy.maxRenderWallMs });
  } catch (e) {
    errors.push(`render: ${message(e)}`);
    return done();
  }
  out.render = { rate, frames: r.frames, seconds: r.frames / rate, truncated: r.truncated, timedOut: r.timedOut,
    peak: r.stats.peak, rms: r.stats.rms, peakDbfs: dbfs(r.stats.peak), rmsDbfs: dbfs(r.stats.rms), clipped: r.stats.clipped,
    left: r.left, right: r.right };
  if (r.truncated) errors.push(`the song plays longer than ${policy.maxAudioSeconds} seconds: libopenmpt was still playing after ${policy.maxAudioSeconds + 2} s`);
  judge(out.render, errors, policy);
  return done();
}

async function buildSid(song, out, errors, done, { policy, render, rate, model, sidDriver, renderSid }) {
  if (typeof sidDriver !== 'string') { errors.push('SID songs need the driver source (options.sidDriver)'); return done(); }
  let compiled;
  try {
    compiled = compileSid(song, { driver: sidDriver });
  } catch (e) {
    errors.push(`SID: ${message(e)}`);
    return done();
  }
  if (!(compiled.psid.length <= policy.maxSidBytes)) {
    errors.push(`SID data is ${compiled.psid.length} bytes (limit ${policy.maxSidBytes})`);
    return done();
  }
  out.sid = compiled.psid;
  if (!render) return done();
  if (typeof renderSid !== 'function') { errors.push('rendering a SID song needs a renderer (options.renderSid)'); return done(); }

  const seconds = Math.min(out.admission.seconds + 2, policy.maxAudioSeconds + 2);
  let r;
  try {
    r = await renderSid(compiled.psid, compiled.org, { seconds, model, rate, deadlineMs: policy.maxRenderWallMs });
  } catch (e) {
    errors.push(`render: ${message(e)}`);
    return done();
  }
  // cRSID's PCM is clamped already, so clipping is the samples at the rails.
  let peak = 0, sumSq = 0;
  for (let i = 0; i < r.frames; i++) {
    const v = r.left[i], a = Math.abs(v);
    if (a > peak) peak = a;
    sumSq += v * v;
  }
  const rms = r.frames ? Math.sqrt(sumSq / r.frames) : 0;
  out.render = { rate, frames: r.frames, seconds: r.frames / rate, truncated: false, timedOut: r.timedOut,
    peak, rms, peakDbfs: dbfs(peak), rmsDbfs: dbfs(rms), clipped: r.railHits, railHits: r.railHits, model,
    left: r.left, right: r.right };
  judge(out.render, errors, policy);
  return done();
}

// The checks every render gets. A timed-out render is partial, so its silence says nothing.
function judge(render, errors, policy) {
  if (render.timedOut) errors.push(`the render took longer than ${policy.maxRenderWallMs} ms`);
  else if (render.peakDbfs < SILENT_DBFS) errors.push(`the render is silent: peak ${render.peakDbfs.toFixed(1)} dBFS, below ${SILENT_DBFS} dBFS`);
  if (render.clipped > 0) errors.push(`the render clipped ${render.clipped} samples`);
}
