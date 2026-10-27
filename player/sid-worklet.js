// AudioWorklet processor for SID tunes: cRSID (vendor/crsid, WebAssembly) renders a PSID file.
// Messages in: load {psid, org}, order {order}, mute {mask}, model {model}, sfx {n}, pause,
// unpause, stop. Out: loaded (answers a load), pos {frame, order, row, vu} when the driver's
// row changes, err {val, load} (load: true when it answers a load, which then failed).
// `org` is the cozy-tracker driver's load address, or null for other PSID files (no position).

class SidProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.w = new WebAssembly.Instance(new WebAssembly.Module(options.processorOptions.wasm), {}).exports;
    this.ready = this.w.crsid_init(sampleRate);  // sampleRate: the AudioWorkletGlobalScope's
    this.playing = false;
    this.org = null;
    this.mask = 0;
    this.last = -1;
    this.samples = 0;
    this.port.onmessage = (e) => this.command(e.data);
  }

  command({ cmd, val }) {
    const w = this.w;
    if (!this.ready) return this.port.postMessage({ cmd: 'err', val: 'init', load: cmd === 'load' });
    if (cmd === 'load') {
      // The tune being replaced stops first: a rejected file leaves silence, not the old tune.
      this.playing = false;
      this.org = null;
      const fail = (why) => this.port.postMessage({ cmd: 'err', val: why, load: true });
      if (val.psid.length > w.crsid_file_max()) return fail('too large');
      new Uint8Array(w.memory.buffer).set(val.psid, w.crsid_file());
      if (w.crsid_load(val.psid.length, 1)) return fail('not a PSID file');
      this.org = val.org;
      this.samples = 0;
      this.last = -1;
      if (this.org !== null) w.crsid_poke(this.org + 10, this.mask);
      this.playing = true;
      this.port.postMessage({ cmd: 'loaded' });
    } else if (cmd === 'order' && this.org !== null) {
      w.crsid_poke(this.org + 9, val.order);        // start_order, then init again
      w.crsid_restart();
      w.crsid_poke(this.org + 10, this.mask);
      this.playing = true;
    } else if (cmd === 'mute') {
      this.mask = val.mask;
      if (this.org !== null) w.crsid_poke(this.org + 10, this.mask);
    } else if (cmd === 'model') w.crsid_set_model(val.model);
    else if (cmd === 'sfx' && this.org !== null) w.crsid_call(this.org + 6, val.n, 1000);
    else if (cmd === 'pause' || cmd === 'stop') this.playing = false;
    else if (cmd === 'unpause') this.playing = true;
  }

  process(_inputs, outputs) {
    const out = outputs[0], n = out[0].length;
    if (!this.playing) { for (const ch of out) ch.fill(0); return true; }
    const w = this.w;
    const pcm = new Int16Array(w.memory.buffer, w.crsid_render(n), n);
    for (let i = 0; i < n; i++) out[0][i] = pcm[i] / 32768;
    for (let c = 1; c < out.length; c++) out[c].set(out[0]);
    this.samples += n;
    if (this.org !== null) {
      const order = w.crsid_peek(this.org + 11), row = w.crsid_peek(this.org + 12);
      if (order * 256 + row !== this.last) {
        this.last = order * 256 + row;
        const vu = [0, 1, 2].map((v) => w.crsid_env(v) / 255);
        this.port.postMessage({ cmd: 'pos', pos: this.samples / sampleRate, order, row, vu });
      }
    }
    return true;
  }
}

registerProcessor('sid-processor', SidProcessor);
