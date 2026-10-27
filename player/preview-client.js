// The page side of the preview worker (player/preview-worker.js): compile songs and resolve
// samples off the main thread. A request that runs past timeoutMs terminates the worker (a
// runaway synth spec or compile cannot hang the tab) and rejects; the next call starts a fresh
// worker. Browser-safe.

const moduleWorker = (url, options) => new Worker(url, options);

/**
 * createPreviewCompiler({ timeoutMs, workerUrl, createWorker }) -> { compile, sample, dispose }.
 * compile(json, options) resolves to { ok, errors, it, sid } (player/compile.js compileSong);
 * sample(def, options) resolves to the itwriter sample or rejects with the resolver's error.
 * createWorker(url, { type: 'module' }) is injectable for tests.
 */
export function createPreviewCompiler({ timeoutMs = 10_000, workerUrl, createWorker = moduleWorker } = {}) {
  const url = workerUrl ?? new URL('./preview-worker.js', import.meta.url);
  let worker = null, nextId = 1;
  const pending = new Map(); // id -> { resolve, reject, timer }

  // Drop the worker and fail everything it holds.
  function stop(reason) {
    if (!worker) return;
    const w = worker;
    worker = null;
    w.onmessage = w.onerror = w.onmessageerror = null;
    w.terminate();
    for (const [id, p] of pending) { clearTimeout(p.timer); pending.delete(id); p.reject(new Error(reason)); }
  }

  function start() {
    const w = createWorker(url, { type: 'module' });
    w.onmessage = ({ data }) => {
      const p = pending.get(data?.id);
      if (!p) return;
      clearTimeout(p.timer);
      pending.delete(data.id);
      p.resolve(data);
    };
    w.onerror = (e) => {
      e?.preventDefault?.();
      stop(`preview worker failed: ${e?.message ?? 'error'}`);
    };
    w.onmessageerror = () => stop('preview worker sent an unreadable reply');
    return w;
  }

  function request(msg) {
    worker ??= start();
    const id = nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`preview ${msg.op} timed out after ${timeoutMs} ms`));
        stop(`preview worker stopped: another request timed out after ${timeoutMs} ms`);
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      try {
        worker.postMessage({ id, ...msg });
      } catch (e) { // e.g. a DataCloneError: nothing reached the worker, which stays healthy
        clearTimeout(timer);
        pending.delete(id);
        reject(e);
      }
    });
  }

  return {
    async compile(json, options = {}) {
      const r = await request({ op: 'compile', json, options });
      return { ok: r.ok, errors: r.errors, it: r.it ?? null, sid: r.sid ?? null };
    },
    async sample(def, options = {}) {
      const r = await request({ op: 'sample', def, options });
      if (!r.ok) throw new Error(r.errors.join('\n'));
      return r.sample;
    },
    dispose() { stop('preview compiler disposed'); },
  };
}
