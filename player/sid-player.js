// A SID player with the ChiptuneJsPlayer interface the tracker page uses (play, stop, pause,
// setOrderRow, setChannelMute, setVol, events), playing PSID files through cRSID in an
// AudioWorklet (sid-worklet.js).
//
// play({ psid, org, meta, orderMap }): psid bytes; org = the cozy-tracker driver's address
// (null for other PSID files); meta = what onMetadata reports; orderMap[i] = the driver order
// where song order i starts (long patterns are split), for positions and seeking.
// onMetadata fires once the worklet has accepted the file; a rejected file fires
// onError({ type, load: true }) instead. Progress reports {left, right} VU levels per voice.

import { CHUNK_ROWS } from '/tools/sid-tracks.js';

const WASM = new URL('./vendor/crsid/crsid.wasm', import.meta.url);

export class SidPlayer {
  constructor() {
    this.context = new AudioContext({ sampleRate: 48000 }); // cRSID takes rates up to 65535
    this.gain = this.context.createGain();
    this.gain.connect(this.context.destination);
    this.handlers = [];
    this.orderMap = null;  // of the last play(), for commands posted after it
    this.shown = null;     // { meta, orderMap } of the tune the worklet is playing, for positions
    this.loads = [];       // play() calls the worklet has not answered yet, oldest first
    this.mutes = [false, false, false];
    this.init();
  }

  async init() {
    try {
      const wasm = await (await fetch(WASM)).arrayBuffer();
      await this.context.audioWorklet.addModule(new URL('./sid-worklet.js', import.meta.url));
      this.processNode = new AudioWorkletNode(this.context, 'sid-processor', {
        numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: { wasm },
      });
      this.processNode.port.onmessage = (e) => this.message(e.data);
      this.processNode.connect(this.gain);
      this.fire('onInitialized');
    } catch (e) {
      console.error(e);
      this.fire('onError', { type: 'Init', error: e });
    }
  }

  // Driver order -> song order and row.
  songPosition(order, row) {
    const map = this.shown?.orderMap;
    if (!map) return { order, row };
    let i = 0;
    while (i + 1 < map.length && map[i + 1] <= order) i++;
    return { order: i, row: (order - map[i]) * CHUNK_ROWS + row };
  }

  message(d) {
    if (d.cmd === 'loaded') {
      this.shown = this.loads.shift();
      return this.fire('onMetadata', this.shown?.meta);
    }
    if (d.cmd === 'err') {
      if (d.load) { this.loads.shift(); this.shown = null; } // the worklet stopped the old tune
      return this.fire('onError', { type: d.val, load: !!d.load });
    }
    if (d.cmd !== 'pos' || this.loads.length) return; // a newer tune is on its way
    const { order, row } = this.songPosition(d.order, d.row);
    const vu = d.vu.map((v) => ({ left: v, right: v })); // the stereo shape chiptune3 reports
    this.fire('onProgress', { pos: d.pos, order, row, pattern: this.shown?.meta?.song?.orders?.[order]?.pat ?? 0, vu });
  }

  fire(name, value) { for (const h of this.handlers) if (h.name === name) h.fn(value); }
  on(name, fn) { this.handlers.push({ name, fn }); }
  onInitialized(fn) { this.on('onInitialized', fn); }
  onError(fn) { this.on('onError', fn); }
  onMetadata(fn) { this.on('onMetadata', fn); }
  onProgress(fn) { this.on('onProgress', fn); }
  onEnded(fn) { this.on('onEnded', fn); }

  post(cmd, val) { this.processNode?.port.postMessage({ cmd, val }); }
  play({ psid, org = null, meta = {}, orderMap = null }) {
    this.orderMap = orderMap;
    if (!this.processNode) return; // not initialized: post() would drop the load unanswered
    this.loads.push({ meta, orderMap });
    this.post('load', { psid, org });
  }
  stop() { this.post('stop'); }
  pause() { this.post('pause'); }
  unpause() { this.post('unpause'); }
  setOrderRow(o) { this.post('order', { order: this.orderMap ? this.orderMap[o] ?? 0 : o }); } // rows: from 0
  setChannelMute(ch, mute) {
    this.mutes[ch] = mute;
    this.post('mute', { mask: this.mutes.reduce((m, on, i) => m | (on ? 1 << i : 0), 0) });
  }
  setModel(model) { this.post('model', { model }); }
  playSfx(n) { this.post('sfx', { n }); }
  setVol(v) { this.gain.gain.value = v; }
  setPos() {}    // SID tunes seek by order (setOrderRow)
  setTempo() {}  // the driver runs at the PAL frame rate
  setPitch() {}
}
