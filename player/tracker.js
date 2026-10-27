// The tracker component: pattern view, editor, transport and the SID bar, mounted into any
// container. The public player (player/index.html) is a thin page over it; the hosted studio
// mounts the same component in hosted mode. Browser-safe.
//
//   mountTracker(container, { mode, assets, sidDriver, onDirtyChange, onSaveRequest, muted, loadForPlay })
//     -> { load(json, { name }), loadModule(buf, name), doc, play(fromOrder), stop(),
//          setVolume(v), destroy(), toolbar, state }
//
// Loading never makes a sound: load() compiles the song in the preview worker (so a missing
// sample or an invalid song reports at once), builds the pattern grid from the JSON and stops
// what was playing. ▶ pressed while a load is in flight waits for it and then plays; ▶ with
// nothing loaded or loading calls loadForPlay() (the public page loads its song box). No audio engine or AudioContext exists until play() (▶, Space) or a note
// audition asks for one. Three separate flags describe a song:
//   dirty         TrackerDoc: unsaved against the last markSaved(); onSaveRequest(json, { markSaved })
//                 gets a markSaved bound to the saved snapshot's version
//   compiledNode  the document version the cached module was compiled from (stale when the
//                 document has changed since); compiling never clears `dirty`
//   playing       an engine is playing (started and not paused)
import { ChiptuneJsPlayer } from './vendor/chiptune3/chiptune3.js';
import { SidPlayer } from './sid-player.js';
import { TrackerDoc } from './tracker-doc.js';
import { gridFromSong, updateGridCell } from './pattern-grid.js';
import { createPreviewCompiler } from './preview-client.js';
import { prgFromPsid } from './compile.js';
import { readWav } from '../tools/wav.js';
import { report as sidReport } from '../tools/sid-compile.js';

const MIDDLE_C = 261.6256;
const NOTE_NAMES = ['C-', 'C#', 'D-', 'D#', 'E-', 'F-', 'F#', 'G-', 'G#', 'A-', 'A#', 'B-'];
const NOTE_STOPS = ['==', '^^']; // note off (loops keep sounding), note cut (silence)
// keyboard piano: two and a half octaves, FT2/IT layout
const PIANO = {
  z: 0, s: 1, x: 2, d: 3, c: 4, v: 5, g: 6, b: 7, h: 8, n: 9, j: 10, m: 11, ',': 12,
  q: 12, 2: 13, w: 14, 3: 15, e: 16, r: 17, 5: 18, t: 19, 6: 20, y: 21, 7: 22, u: 23,
  i: 24, 9: 25, o: 26, 0: 27, p: 28,
};
const SEG = [[0, 3], [4, 6], [6, 9], [10, 13]];
const LAYOUT = { rowH: 17, headH: 34, rowNumW: 34 };
const NO_POS = '--:-- · ord -/- · row --';

const hue = (i) => (i * 47 + 190) % 360;
const chColor = (i, l = 65, a = 1) => `hsla(${hue(i)}, 75%, ${l}%, ${a})`;
const SEGCOLOR = (i, chIdx) => [chColor(chIdx), '#8b93a7', '#7ec699', '#e0a458'][i];
const fmt = (s) => (s === undefined || isNaN(s)) ? '--:--' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const fileName = (title) => (title || 'song').replace(/\W+/g, '_');
const isSidSong = (json) => json !== null && typeof json === 'object' && json.sid !== undefined;
const latin1 = (bytes) => new TextDecoder('latin1').decode(bytes);

// The pattern grid of a JSON song. SID channels are voices: unnamed ones read "voice N".
function displayGrid(json) {
  const grid = gridFromSong(json);
  nameVoices(grid, json);
  return grid;
}
function nameVoices(grid, json) {
  if (isSidSong(json)) grid.channels.forEach((n, c) => { if (!n) grid.channels[c] = `voice ${c + 1}`; });
}

// What the info line says about a JSON song; SID songs know their duration from the compile.
function songInfo(json, sidResult) {
  const rows = (json.order || []).reduce((n, p) => n + (json.patterns[p]?.rows || 0), 0);
  const speed = sidResult ? (sidResult.stats.speed[0] + sidResult.stats.speed[1]) / 2 : 6;
  return {
    title: json.title, message: json.message,
    tracker: isSidSong(json) ? `SID ${json.sid.model || '6581'}` : 'IT (json)',
    totalPatterns: (json.patterns || []).length, totalOrders: (json.order || []).length,
    dur: sidResult ? rows * speed / 50 : undefined,
  };
}

// A PSID file that is not one of ours: no patterns to show, so no position either.
function sidFile(buf) {
  const psid = new Uint8Array(buf.slice(0));
  const text = (at) => latin1(psid.slice(at, at + 32)).replace(/\0.*$/s, '');
  const tracker = ['PSID', text(0x36), text(0x56)].filter(Boolean).join(' · ');
  return { psid, org: null, meta: { title: text(0x16), tracker, totalPatterns: 0, totalOrders: 0, song: { channels: [], patterns: [], orders: [] } } };
}

const CSS = `
.ct { --panel: #151821; --panel2: #1b1f2b; --text: #d7dae0; --dim: #6b7280; --accent: #4fc1ff; --edit: #e0a458;
  display: flex; flex-direction: column; gap: .6rem; min-height: 0; height: 100%; color: var(--text);
  font: 13px/1.45 ui-monospace, "SF Mono", Menlo, monospace; }
.ct h1 { font-size: .95rem; letter-spacing: .12em; color: var(--accent); margin: 0; }
.ct .panel { background: var(--panel); border-radius: 8px; padding: .5rem .75rem; }
.ct .row { display: flex; gap: .6rem; align-items: center; flex-wrap: wrap; }
.ct button { background: #232838; color: var(--text); border: 1px solid #333a4d;
  border-radius: 6px; padding: .3rem .8rem; font: inherit; cursor: pointer; }
.ct button:hover { border-color: var(--accent); }
.ct button.on { border-color: var(--edit); color: var(--edit); }
.ct button:disabled { opacity: .4; cursor: default; }
.ct input[type=text], .ct select { background: #0a0c10; color: var(--text); border: 1px solid #333a4d;
  border-radius: 6px; padding: .3rem .5rem; font: inherit; }
.ct input[type=range] { accent-color: var(--accent); }
.ct label { color: var(--dim); font-size: 11px; }
.ct [hidden] { display: none !important; }
.ct [data-ct=pos] { color: var(--accent); min-width: 15ch; }
.ct [data-ct=editState] { color: var(--edit); font-size: 11px; }
.ct [data-ct=order] { display: flex; gap: 3px; flex-wrap: wrap; }
.ct .ord { min-width: 26px; text-align: center; padding: 2px 4px; border-radius: 4px;
  background: var(--panel2); color: var(--dim); font-size: 11px; cursor: pointer; border: 1px solid transparent; }
.ct .ord.cur { color: #fff; border-color: var(--accent); background: #1e3a52; }
.ct .ord.sel { border-color: var(--edit); }
.ct [data-ct=scope] { width: 100%; height: 48px; display: block; border-radius: 8px; background: var(--panel); }
.ct [data-ct=patwrap] { flex: 1; min-height: 0; position: relative; }
.ct [data-ct=pat] { width: 100%; height: 100%; display: block; border-radius: 8px; background: var(--panel); }
.ct [data-ct=meta] { color: var(--dim); font-size: 11px; white-space: pre-wrap; max-height: 44px; overflow-y: auto; }
.ct [data-ct=instBar], .ct [data-ct=sidBar], .ct [data-ct=keyHelp] { display: none; }
.ct [data-ct=instBar].show, .ct [data-ct=sidBar].show { display: flex; }
.ct [data-ct=keyHelp].show { display: block; color: var(--dim); font-size: 11px; }
.ct [data-ct=sidStats] { color: var(--dim); font-size: 11px; }
.ct [data-ct=toolbar] { display: contents; }
`;

const TEMPLATE = `<style>${CSS}</style>
<div class="ct" data-ct="root">
<div class="row" style="justify-content: space-between">
  <h1>COZY_TRACKER <span data-ct="title"></span></h1>
  <span data-ct="editState"></span>
  <span data-ct="pos">${NO_POS}</span>
</div>
<div class="panel row">
  <button data-ct="play" title="play / resume">▶</button>
  <button data-ct="pause" title="pause (space)">⏸</button>
  <button data-ct="stop" title="stop">■</button>
  <button data-ct="edit" title="toggle edit mode (json songs only)">✎ edit</button>
  <input type="range" data-ct="seek" aria-label="seek" min="0" max="100" step="0.1" value="0" style="flex:2; min-width:100px">
  <label>vol <input type="range" data-ct="vol" aria-label="volume" min="0" max="1.5" step="0.01" value="1" style="width:60px"></label>
  <label>tempo <input type="range" data-ct="tempo" aria-label="tempo" min="0.5" max="2" step="0.05" value="1" style="width:60px"></label>
  <label>pitch <input type="range" data-ct="pitch" aria-label="pitch" min="0.5" max="2" step="0.05" value="1" style="width:60px"></label>
  <span data-ct="toolbar"></span>
</div>
<div class="panel row" data-ct="instBar">
  <label>instrument <select data-ct="instSel" aria-label="instrument" style="min-width:180px"></select></label>
  <input type="text" data-ct="instPath" aria-label="sample path" placeholder="library/samples/….wav" style="flex:1; min-width:160px">
  <label data-ct="instLoopLabel"><input type="checkbox" data-ct="instLoop" checked> single-cycle loop</label>
  <button data-ct="instAdd">+ add</button>
  <input type="file" data-ct="instFile" aria-label="add wav instrument" accept=".wav" style="font-size:11px; max-width:160px">
  <button data-ct="instDel">✕ remove</button>
  <span style="flex:1"></span>
  <button data-ct="dlJson">⬇ json</button>
  <button data-ct="dlIt">⬇ .it</button>
</div>
<div class="panel" data-ct="keyHelp">keys: z s x d c v g b h n j m = C..B · q 2 w 3 e … = octave up · i 9 o 0 p = two up ·
  a = note off (===; a sample loop keeps sounding) · 1 = note cut (^^^; silence) · Delete = remove ·
  arrows/PgUp/PgDn = cursor · [ ] = octave · click = place cursor · Space = play edits from the selected order ·
  Ctrl/Cmd+Z = undo · Shift+Ctrl/Cmd+Z = redo · Ctrl/Cmd+S = save</div>
<div class="panel row" data-ct="sidBar">
  <label>SID <select data-ct="sidModel" aria-label="SID model"><option value="6581">6581</option><option value="8580">8580</option></select></label>
  <span data-ct="sidSfx" class="row"></span>
  <span style="flex:1"></span>
  <span data-ct="sidStats"></span>
  <button data-ct="dlSid">⬇ .sid</button>
  <button data-ct="dlPrg" title="load address + driver + song, for a game">⬇ .prg</button>
</div>
<div class="panel"><div data-ct="order"></div></div>
<canvas data-ct="scope"></canvas>
<div data-ct="patwrap">
  <canvas data-ct="pat" aria-label="pattern view; scroll sideways or drag to see more channels"></canvas>
</div>
<div class="panel" data-ct="meta" aria-live="polite"></div>
</div>`;

export function mountTracker(container, { mode = 'public', assets, sidDriver, onDirtyChange, onSaveRequest, muted = false, loadForPlay } = {}) {
  if (mode !== 'public' && mode !== 'hosted') throw new Error(`unknown tracker mode: ${mode}`);
  const hosted = mode === 'hosted';
  container.innerHTML = TEMPLATE;
  const parts = new Map();
  const $ = (name) => {
    if (!parts.has(name)) parts.set(name, container.querySelector(`[data-ct="${name}"]`));
    return parts.get(name);
  };
  const previewer = createPreviewCompiler();
  const previewOptions = () => hosted ? { mode: 'hosted', assets, sidDriver } : { mode: 'public', fetchBase: location.origin + '/' };
  $('meta').textContent = hosted ? 'no song loaded' : 'no module loaded — Load a URL (.it to view, .json to edit) or drop a file';
  if (hosted) for (const name of ['instPath', 'instLoopLabel', 'instAdd', 'instFile']) $(name).hidden = true; // file and raw samples are not hosted

  // ---------- player state ----------
  let player = null, started = false, paused = false, seeking = false;
  const players = { it: null, sid: null }; // created on first play or audition; `player` is the active one
  let volume = 1;
  const effVol = () => muted ? 0 : volume;
  if (muted) { $('vol').value = 0; $('vol').disabled = true; $('vol').title = 'muted'; }
  let chScroll = 0;         // first visible channel when the pattern is wider than the view
  let grid = null;          // channels[], patterns[{rows:[[cell,…]]}], orders[]: from the JSON, or the worklet's meta.song
  let orders = [];
  let info = null;          // the info line: title, tracker, totalPatterns, totalOrders, dur, message
  let cur = { order: 0, pattern: 0, row: 0, pos: 0 };
  let dispRow = 0;
  let vu = [], vuDisp = [];
  let scopeData = null;
  let chMute = [], chSolo = null; // per-channel mute + solo state

  // ---------- document state ----------
  let doc = null, docName = null, unsubscribe = null;
  let version = 0;          // bumps on every document change (undo and redo included)
  let compiledNode = -1, compiledModule = null; // the cached module and the version it was built from
  let playingNode = null;   // the version the engine is playing (null when stopped)
  let binary = null;        // { buf, sid, name }: a module file, no JSON
  let loadId = 0;           // bumps on every load; engine events of an earlier load are stale
  let lastDirty = false;
  let editMode = false;
  let cursor = { row: 0, ch: 0 };
  let selOrder = 0;         // selected order slot (which pattern we edit/play)
  let octave = 5;
  let curInst = 0;
  let destroyed = false;

  const playing = () => started && !paused;
  // Edits the playing module lacks (or, when stopped, the cached module lacks).
  const stale = () => !!doc && (started ? playingNode : compiledNode) !== version;
  const effMuted = (c) => chSolo !== null ? c !== chSolo : !!chMute[c];
  function applyMutes() {
    if (!player || !grid) return;
    grid.channels.forEach((_, c) => player.setChannelMute(c, effMuted(c)));
  }
  function toggleMute(c) { chMute[c] = !chMute[c]; applyMutes(); }
  function toggleSolo(c) { chSolo = chSolo === c ? null : c; applyMutes(); }
  function resetChannels(n) { vu = []; vuDisp = new Array(n).fill(0); chMute = new Array(n).fill(false); chSolo = null; }

  function showInfo() {
    if (!info) return;
    $('meta').textContent =
      `${info.tracker || '?'} · ${grid ? grid.channels.length : 0}ch · ${info.totalPatterns} patterns · ${info.totalOrders} orders · ${fmt(info.dur)}` +
      (info.message ? `\n${info.message.replace(/\n+/g, ' — ')}` : '');
    $('seek').max = info.dur || 100;
  }

  function initPlayer(kind) {
    const created = player = players[kind] = kind === 'sid' ? new SidPlayer() : new ChiptuneJsPlayer({ repeatCount: -1 });
    created.setVol(effVol()); // before anything can play
    bufCache.clear(); // audition buffers belong to a context
    created.ready = new Promise((resolve, reject) => {
      created.onInitialized(resolve);
      created.onError((e) => { if (e?.type === 'Init') reject(new Error('audio engine failed to start')); });
    });
    created.ready.catch(() => {
      if (players[kind] === created) players[kind] = null;
      if (player === created) player = null;
      created.context.close().catch(() => {});
    });
    // Each play() counts until its metadata (or load error) arrives (pagePlays, not a name an
    // engine uses for itself: SidPlayer has its own loads): progress meanwhile is from the
    // module being replaced, and metadata of a superseded play() is stale. loadId marks which
    // load the last play() was for.
    created.pagePlays = 0;
    const play = created.play.bind(created);
    created.play = (module) => { created.pagePlays++; created.loadId = loadId; play(module); };
    const loaded = () => { created.pagePlays = Math.max(0, created.pagePlays - 1); };
    const current = () => player === created && !created.pagePlays && created.loadId === loadId;
    created.onInitialized(() => {
      if (created.processNode) created.processNode.onprocessorerror = (e) => console.error('worklet processor died', e);
      created.analyser = created.context.createAnalyser();
      created.analyser.fftSize = 2048;
      scopeData = new Float32Array(created.analyser.fftSize);
      created.gain.connect(created.analyser);
    });
    // Only the active engine (`player`) may update the view: a late event from an engine
    // that was switched away from must not overwrite the other engine's song.
    created.onError((e) => {
      if (e?.type === 'ptr' || e?.load) loaded(); // the module was rejected: no metadata follows
      if (player !== created) return;
      $('meta').textContent = 'error: ' + (e?.type === 'ptr' ? 'not a playable module' : e?.type ?? 'unknown');
    });
    created.onMetadata((meta) => {
      loaded();
      if (!current()) return;
      if (doc) { // a JSON song keeps its own grid; libopenmpt adds the duration
        if (!isSidSong(doc.json)) info = { ...info, tracker: meta?.tracker || info.tracker, dur: meta?.dur };
      } else {
        grid = meta?.song?.patterns ? meta.song : { channels: meta?.song?.channels || [], patterns: [], orders: [] };
        grid.channels ??= [];
        grid.orders ??= [];
        orders = grid.orders.map((o) => o.pat);
        info = meta || {};
        $('title').textContent = '· ' + (meta?.title || '(untitled)');
        resetChannels(grid.channels.length);
        patCache.clear();
        buildOrderStrip();
      }
      showInfo();
      applyMutes(); // the worklet resets mutes on every new module
    });
    created.onProgress((d) => {
      if (!started || !current()) return;
      cur = d;
      vu = d.vu || [];
      $('pos').textContent = `${fmt(d.pos)} · ord ${d.order}/${orders.length - 1} · row ${String(d.row).padStart(2, '0')}`;
      if (!seeking) $('seek').value = d.pos;
      if (editMode) selOrder = d.order;
      markOrder(d.order);
    });
  }

  // ---------- order strip ----------
  function buildOrderStrip() {
    const el = $('order');
    el.innerHTML = '';
    orders.forEach((pat, i) => {
      const d = document.createElement('div');
      d.className = 'ord';
      d.textContent = pat;
      d.title = `order ${i} → pattern ${pat}`;
      d.onclick = () => {
        selOrder = i;
        cursor.row = 0;
        if (player && started) player.setOrderRow(i, 0);
        markOrder(cur.order);
      };
      el.appendChild(d);
    });
    markOrder(cur.order);
  }
  function markOrder(o) {
    [...$('order').children].forEach((d, i) => {
      d.classList.toggle('cur', i === o && started);
      d.classList.toggle('sel', editMode && i === selOrder);
    });
  }

  // ---------- canvases ----------
  const patC = $('pat'), scopeC = $('scope');
  function fitCanvas(c) {
    const r = c.getBoundingClientRect();
    const dpr = devicePixelRatio || 1;
    if (c.width !== Math.round(r.width * dpr) || c.height !== Math.round(r.height * dpr)) {
      c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
    }
    return { w: r.width, h: r.height, dpr };
  }

  const patCache = new Map();
  function invalidatePattern(patIdx) {
    for (const k of [...patCache.keys()]) if (k.startsWith(patIdx + ':')) patCache.delete(k);
  }
  function patternCanvas(patIdx, chW, nCh, dpr) {
    const { rowH, rowNumW } = LAYOUT;
    const key = `${patIdx}:${Math.round(chW)}:${nCh}:${dpr}`;
    if (patCache.has(key)) return patCache.get(key);
    const pat = grid.patterns[patIdx];
    const c = document.createElement('canvas');
    c.width = Math.round((rowNumW + nCh * chW) * dpr);
    c.height = Math.round(pat.rows.length * rowH * dpr);
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = `${Math.min(13, chW / 9.2)}px ui-monospace, Menlo, monospace`;
    ctx.textBaseline = 'middle';
    for (let r = 0; r < pat.rows.length; r++) {
      const y = r * rowH + rowH / 2;
      if (r % 16 === 0) { ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(0, r * rowH, rowNumW + nCh * chW, rowH); }
      else if (r % 4 === 0) { ctx.fillStyle = 'rgba(255,255,255,.02)'; ctx.fillRect(0, r * rowH, rowNumW + nCh * chW, rowH); }
      ctx.fillStyle = r % 4 === 0 ? '#9aa3b5' : '#525a6b';
      ctx.textAlign = 'right';
      ctx.fillText(String(r).padStart(2, '0'), rowNumW - 6, y);
      ctx.textAlign = 'left';
      const row = pat.rows[r];
      for (let ch = 0; ch < nCh; ch++) {
        const x = rowNumW + ch * chW + 6;
        const cell = row[ch] || '';
        const empty = !cell.trim() || /^[.\s]+$/.test(cell);
        if (empty) { ctx.fillStyle = 'rgba(120,130,150,.18)'; ctx.fillText('···', x, y); continue; }
        let dx = 0;
        for (let s = 0; s < SEG.length; s++) {
          const part = cell.slice(SEG[s][0], SEG[s][1]);
          if (part.trim() && !/^[.]+$/.test(part.trim())) {
            ctx.fillStyle = SEGCOLOR(s, ch);
            ctx.fillText(part, x + dx, y);
          }
          dx += ctx.measureText(part + ' ').width;
        }
      }
    }
    patCache.set(key, c);
    return c;
  }

  function viewPattern() {
    if (!grid || !grid.patterns?.length) return 0;
    const p = editMode ? (orders[selOrder] ?? 0) : cur.pattern;
    return Math.min(p, grid.patterns.length - 1);
  }

  // Channels keep a readable minimum width; wider songs scroll sideways.
  function channelView(w, nCh) {
    const { rowNumW } = LAYOUT;
    const chW = Math.max(112, (w - rowNumW - 8) / nCh);
    const visible = Math.max(1, Math.floor((w - rowNumW) / chW));
    const maxFirst = Math.max(0, nCh - visible);
    if (editMode) { // keep the edit cursor on screen
      if (cursor.ch < chScroll) chScroll = cursor.ch;
      if (cursor.ch >= chScroll + visible) chScroll = cursor.ch - visible + 1;
    }
    chScroll = Math.max(0, Math.min(maxFirst, Math.round(chScroll)));
    return { chW, first: chScroll, visible, maxFirst };
  }

  function drawPattern() {
    const { w, h, dpr } = fitCanvas(patC);
    const ctx = patC.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!grid || !grid.patterns || !grid.patterns.length) return;
    if (editMode) clampCursor(); // the viewed pattern follows playback and the order strip

    const patIdx = viewPattern();
    const nCh = grid.channels.length;
    const { rowH, headH, rowNumW } = LAYOUT;
    const { chW, first, visible, maxFirst } = channelView(w, nCh);

    const target = (editMode && !playing()) ? cursor.row : cur.row;
    dispRow += (target - dispRow) * 0.35;
    if (Math.abs(target - dispRow) > 12) dispRow = target;

    const centerY = headH + (h - headH) / 2;

    const img = patternCanvas(patIdx, chW, nCh, dpr);
    const srcY = (dispRow * rowH + rowH / 2) * dpr - (centerY - headH) * dpr;
    const bodyH = (h - headH) * dpr;
    const numW = Math.round(rowNumW * dpr);
    const srcX = Math.round((rowNumW + first * chW) * dpr);
    const srcW = Math.min(img.width - srcX, Math.round((w - rowNumW) * dpr));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(img, 0, srcY, numW, bodyH, 0, headH * dpr, numW, bodyH);
    if (srcW > 0) ctx.drawImage(img, srcX, srcY, srcW, bodyH, numW, headH * dpr, srcW, bodyH);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // playhead band
    const phY = centerY;
    const grad = ctx.createLinearGradient(0, phY - rowH, 0, phY + rowH);
    const col = editMode && !playing() ? '224,164,88' : '79,193,255';
    grad.addColorStop(0, `rgba(${col},0)`);
    grad.addColorStop(0.5, `rgba(${col},.14)`);
    grad.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, phY - rowH, w, rowH * 2);
    ctx.fillStyle = `rgba(${col},.9)`;
    ctx.fillRect(0, phY - rowH / 2, 3, rowH);
    ctx.fillRect(w - 3, phY - rowH / 2, 3, rowH);

    // edit cursor cell
    if (editMode) {
      const cy = centerY + (cursor.row - dispRow) * rowH;
      const cx = rowNumW + (cursor.ch - first) * chW;
      ctx.strokeStyle = 'rgba(224,164,88,.95)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(cx + 2, cy - rowH / 2 + 1, chW - 6, rowH - 2);
    }

    // header
    ctx.fillStyle = '#11141c';
    ctx.fillRect(0, 0, w, headH);
    ctx.strokeStyle = 'rgba(255,255,255,.08)';
    ctx.beginPath(); ctx.moveTo(0, headH - .5); ctx.lineTo(w, headH - .5); ctx.stroke();
    for (let c = first; c < Math.min(nCh, first + visible + 1); c++) {
      const x = rowNumW + (c - first) * chW + 6;
      const chMuted = effMuted(c);
      const level = vu[c] ? Math.min(1, (vu[c].left + vu[c].right) / 1.6) : 0;
      vuDisp[c] = Math.max(level, (vuDisp[c] || 0) * 0.88);
      ctx.fillStyle = 'rgba(255,255,255,.07)';
      ctx.fillRect(x, headH - 10, chW - 14, 5);
      ctx.fillStyle = chColor(c, 60, chMuted ? 0.25 : 0.95);
      ctx.shadowColor = chColor(c, 60, .9); ctx.shadowBlur = chMuted ? 0 : vuDisp[c] * 10;
      ctx.fillRect(x, headH - 10, (chW - 14) * vuDisp[c], 5);
      ctx.shadowBlur = 0;
      ctx.fillStyle = editMode && c === cursor.ch ? '#e0a458' : chColor(c, 72, chMuted ? 0.35 : 1);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.font = `bold 11px ui-monospace, Menlo, monospace`;
      ctx.fillText((grid.channels[c] || `ch ${c}`).slice(0, Math.floor((chW - 40) / 7)), x, headH - 16);
      // M / S buttons
      for (const [i, [label, on, color]] of [['M', chMute[c], '#e05a5a'], ['S', chSolo === c, '#e0c058']].entries()) {
        const bx = x + chW - 44 + i * 16;
        ctx.fillStyle = on ? color : 'rgba(255,255,255,.08)';
        ctx.fillRect(bx, 5, 13, 13);
        ctx.fillStyle = on ? '#0d0f14' : 'rgba(255,255,255,.45)';
        ctx.font = `bold 9px ui-monospace, Menlo, monospace`;
        ctx.fillText(label, bx + 3.5, 15);
      }
    }
    ctx.fillStyle = '#11141c'; // mask a partly visible channel under the row numbers
    ctx.fillRect(0, 0, rowNumW, headH);
    if (maxFirst > 0) { // horizontal scroll indicator
      const trackW = w - rowNumW;
      ctx.fillStyle = 'rgba(255,255,255,.06)';
      ctx.fillRect(rowNumW, h - 4, trackW, 4);
      ctx.fillStyle = 'rgba(79,193,255,.7)';
      ctx.fillRect(rowNumW + trackW * first / nCh, h - 4, trackW * visible / nCh, 4);
    }
  }

  function drawScope() {
    const { w, h, dpr } = fitCanvas(scopeC);
    const ctx = scopeC.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const analyser = player?.analyser;
    if (!analyser) return;
    analyser.getFloatTimeDomainData(scopeData);
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#4fc1ff'); grad.addColorStop(0.5, '#7ee787'); grad.addColorStop(1, '#e0a458');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    const step = scopeData.length / w;
    for (let x = 0; x < w; x++) {
      const v = scopeData[Math.floor(x * step)] || 0;
      const y = h / 2 - v * h * 0.46;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  let frame = 0;
  (function loop() { if (destroyed) return; drawPattern(); drawScope(); frame = requestAnimationFrame(loop); })();

  // ---------- compile (preview worker) ----------
  // IT songs compile to the module's bytes, SID songs to what SidPlayer plays; failures throw.
  // The JSON is copied when the request is posted, so later edits are not part of it.
  async function compileJson(json) {
    const r = await previewer.compile(json, previewOptions());
    if (!r.ok) throw new Error(r.errors.join('\n'));
    if (r.sid) {
      const result = { ...r.sid, prg: prgFromPsid(r.sid.psid) };
      const meta = { ...songInfo(json, result), song: { orders: (json.order || []).map((pat) => ({ pat })) } };
      return { psid: r.sid.psid, org: r.sid.org, orderMap: r.sid.orderMap, meta, result };
    }
    const it = r.it;
    return it.byteOffset === 0 && it.byteLength === it.buffer.byteLength ? it.buffer : it.slice().buffer;
  }
  // The module of the current document version, compiled once.
  async function compiled() {
    if (compiledNode === version) return { module: compiledModule, node: version };
    const d = doc, node = version;
    const module = await compileJson(d.json);
    if (doc === d && version === node) { compiledModule = module; compiledNode = node; }
    return { module, node };
  }

  // ---------- SID songs ----------
  // The SID bar describes the module that is playing (or was just compiled).
  function showSidStats(module) {
    const result = module?.result;
    if (!result) return;
    $('sidStats').textContent = sidReport(result).split('\n')[0] + (result.warnings.size ? ` · ${result.warnings.size} warnings` : '');
    $('sidStats').title = sidReport(result);
  }
  function updateSidBar() {
    const sid = !!doc && isSidSong(doc.json);
    $('sidBar').classList.toggle('show', sid || !!binary?.sid);
    $('dlSid').disabled = $('dlPrg').disabled = !sid;
    $('dlIt').disabled = sid;
    $('sidSfx').innerHTML = '';
    if (!sid) return;
    $('sidModel').value = doc.json.sid.model || '6581';
    (doc.json.sid.sfx || []).forEach((e, i) => {
      const b = document.createElement('button');
      b.textContent = `♪ ${e.name}`;
      b.title = `sound effect ${i} on voice 3`;
      b.onclick = () => player?.playSfx?.(i);
      $('sidSfx').appendChild(b);
    });
  }
  async function exportSid(field, ext) {
    if (!doc || !isSidSong(doc.json)) return;
    const title = doc.json.title;
    const { module } = await compiled();
    showSidStats(module);
    download(new Blob([field === 'prg' ? module.result.prg : module.psid]), fileName(title) + ext);
  }
  $('sidModel').onchange = () => player?.setModel?.(+$('sidModel').value);
  $('dlSid').onclick = () => guard(exportSid('psid', '.sid'));
  $('dlPrg').onclick = () => guard(exportSid('prg', '.prg'));

  // ---------- document changes (edits, undo, redo, save) ----------
  function notifyDirty() {
    const dirty = !!doc?.dirty;
    if (dirty === lastDirty) return;
    lastDirty = dirty;
    try { onDirtyChange?.(dirty); } catch (e) { console.error('onDirtyChange failed', e); }
  }
  // A listener that throws would make the edit call throw after the edit was committed.
  function onDocChange(change) {
    try {
      if (change.kind !== 'saved') version++;
      if (change.kind === 'cell') {
        const nCh = grid.channels.length;
        updateGridCell(grid, doc.json, change.pattern, change.row, change.channel);
        if (grid.channels.length !== nCh) { // a new channel widens every pattern
          nameVoices(grid, doc.json);
          resetChannels(grid.channels.length);
          patCache.clear();
        } else invalidatePattern(change.pattern);
      } else if (change.kind === 'addSample' || change.kind === 'removeSample') {
        if (change.kind === 'removeSample') { grid = displayGrid(doc.json); patCache.clear(); } // events moved or went
        curInst = Math.max(0, Math.min(curInst, doc.json.samples.length - 1));
        refreshInstruments();
      }
      updateEditState();
      notifyDirty();
    } catch (e) {
      console.error('tracker view update failed', e);
    }
  }

  // ---------- note audition (WebAudio preview of the entered note) ----------
  const bufCache = new Map(); // def JSON -> { buf, s }
  let auditionStop = null;
  async function auditionNote(noteName, instIdx, volStr) {
    try {
      const d = doc;
      if (!d || isSidSong(d.json)) return; // SID instruments are driver programs, not samples
      const def = d.json.samples?.[instIdx];
      if (!def) return;
      const p = await ensurePlayer('it'); // a key press is a user gesture
      if (doc !== d || player !== p) return;
      const key = JSON.stringify(def);
      let entry = bufCache.get(key);
      if (!entry) {
        const s = await previewer.sample(def, previewOptions());
        if (player !== p) return;
        const buf = p.context.createBuffer(s.channels.length, s.channels[0].length, s.samplerate);
        s.channels.forEach((chData, i) => buf.copyToChannel(Float32Array.from(chData), i));
        entry = { buf, s: { c5speed: s.c5speed, samplerate: s.samplerate, volume: s.volume, loop: s.loop } };
        bufCache.set(key, entry);
      }
      const { buf, s } = entry;
      // pitch: C-5 plays at c5speed; each semitone is a factor of 2^(1/12)
      const semi = NOTE_NAMES.indexOf(noteName.slice(0, 2)) + 12 * parseInt(noteName[2]) - 60;
      const rate = ((s.c5speed || s.samplerate) * Math.pow(2, semi / 12)) / s.samplerate;

      if (auditionStop) auditionStop(); // cut previous preview
      const src = p.context.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = rate;
      const g = p.context.createGain();
      const vol = (s.volume ?? 64) / 64 * (volStr ? parseInt(volStr.slice(1)) / 64 : 0.75) * 0.6;
      g.gain.value = vol;
      src.connect(g); g.connect(p.gain); // through the engine's gain: muted stays silent
      const t = p.context.currentTime;
      if (s.loop) {
        src.loop = true;
        src.loopStart = (s.loop.start || 0) / s.samplerate;
        src.loopEnd = (s.loop.end ?? buf.length) / s.samplerate;
        g.gain.setValueAtTime(vol, t + 0.3);
        g.gain.linearRampToValueAtTime(0, t + 0.4); // short release, no clicks
        src.start(t); src.stop(t + 0.45);
      } else {
        src.start(t); src.stop(t + Math.min(buf.duration / rate, 2));
      }
      auditionStop = () => { try { g.gain.cancelScheduledValues(0); g.gain.value = 0; src.stop(); } catch {} };
      src.onended = () => { if (g) g.disconnect(); };
    } catch { /* audition is best-effort */ }
  }

  // ---------- edit operations ----------
  const jsonPattern = () => doc.json.patterns[viewPattern()];
  // The cursor may come from a longer pattern or a wider song: keep it inside the viewed
  // pattern. False when there is no cell to edit.
  function clampCursor() {
    const pat = grid?.patterns?.[viewPattern()], jpat = doc && jsonPattern();
    const nCh = grid ? grid.channels.length : 0;
    if (!pat || !jpat || !pat.rows.length || !nCh) return false;
    cursor.row = Math.max(0, Math.min(pat.rows.length - 1, jpat.rows - 1, cursor.row));
    cursor.ch = Math.max(0, Math.min(nCh - 1, cursor.ch));
    return true;
  }
  function setNote(noteName) {
    if (!clampCursor()) return;
    const p = viewPattern(), { row, ch } = cursor;
    const old = doc.json.patterns[p].channels?.[ch]?.[row] || {};
    const ev = NOTE_STOPS.includes(noteName) ? { note: noteName }
      : { ...old, note: noteName, instrument: curInst, ...(isSidSong(doc.json) ? {} : { vol: old.vol || 'v48' }) };
    doc.setCell(p, row, ch, ev);
    if (!NOTE_STOPS.includes(noteName)) auditionNote(noteName, curInst, ev.vol);
    cursor.row = Math.min(doc.json.patterns[p].rows - 1, row + 1);
    updateEditState();
  }
  function delNote() {
    if (!clampCursor()) return;
    const p = viewPattern();
    if (doc.json.patterns[p].channels?.[cursor.ch]?.[cursor.row]) doc.setCell(p, cursor.row, cursor.ch, null);
    updateEditState();
  }

  // entering a channel selects the instrument that channel plays
  // (nearest event with an instrument in the current pattern, else any pattern)
  function instForChannel(ch) {
    const scan = (pat) => {
      const chn = pat.channels?.[ch];
      if (!chn) return undefined;
      let best, bestDist = Infinity;
      for (const [r, ev] of Object.entries(chn)) {
        if (ev.instrument === undefined) continue;
        const d = Math.abs(+r - cursor.row);
        if (d < bestDist) { bestDist = d; best = ev.instrument; }
      }
      return best;
    };
    let inst = scan(jsonPattern());
    if (inst === undefined) for (const p of doc.json.patterns) { inst = scan(p); if (inst !== undefined) break; }
    return inst;
  }
  function syncInstToChannel() {
    if (!doc) return;
    const inst = instForChannel(cursor.ch);
    if (inst !== undefined && inst < doc.json.samples.length) {
      curInst = inst;
      $('instSel').value = curInst;
      updateEditState();
    }
  }

  function updateEditState() {
    $('editState').textContent = editMode
      ? `EDIT · oct ${octave} · inst ${String(curInst + 1).padStart(2, '0')} ${doc?.json.samples?.[curInst]?.name || ''}${doc?.dirty ? ' · unsaved' : ''}`
      : '';
    $('edit').classList.toggle('on', editMode);
    $('instBar').classList.toggle('show', editMode);
    $('keyHelp').classList.toggle('show', editMode);
    markOrder(cur.order);
  }

  // ---------- instruments ----------
  function refreshInstruments() {
    const sel = $('instSel');
    sel.innerHTML = '';
    (doc?.json.samples || []).forEach((s, i) => {
      const o = document.createElement('option');
      o.value = i;
      o.textContent = `${String(i + 1).padStart(2, '0')} ${s.name || s.file?.split('/').pop() || 'sample'}`;
      sel.appendChild(o);
    });
    sel.value = curInst;
  }
  async function addInstrumentDef(def) {
    const d = doc;
    if (!d) return;
    try {
      await previewer.sample(def, previewOptions()); // validate now (fetch/parse/synthesize)
      if (doc !== d) return;
      curInst = d.addSample(def);
      refreshInstruments();
      updateEditState();
    } catch (e) {
      $('meta').textContent = 'instrument error: ' + e.message;
    }
  }

  $('instSel').onchange = (e) => { curInst = +e.target.value; updateEditState(); };
  $('instAdd').onclick = () => {
    const p = $('instPath').value.trim();
    if (!p) return;
    addInstrumentDef($('instLoop').checked ? { name: p.split('/').pop(), file: p, loop: 'cycle', volume: 32 } : { name: p.split('/').pop(), file: p, volume: 48 });
    $('instPath').value = '';
  };
  $('instFile').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f || !doc) return;
    let wav;
    try { wav = readWav(new Uint8Array(await f.arrayBuffer())); }
    catch (err) { $('meta').textContent = `instrument error: ${f.name}: ${err.message}`; e.target.value = ''; return; }
    const def = { name: f.name.replace(/\.wav$/i, ''), samplerate: wav.samplerate, channels: wav.channels, volume: $('instLoop').checked ? 32 : 48 };
    if ($('instLoop').checked) {
      const n = wav.channels[0].length;
      def.loop = { start: 0, end: n };
      def.c5speed = Math.round(n * MIDDLE_C);
    }
    addInstrumentDef(def);
    e.target.value = '';
  };
  $('instDel').onclick = () => { if (doc && doc.json.samples.length > 1) doc.removeSample(curInst); };

  // ---------- exports and save ----------
  // ⬇ json: in public mode the download is the save; hosted saves through onSaveRequest.
  function downloadJson() {
    if (!doc) return;
    download(new Blob([JSON.stringify(doc.json, null, 1)], { type: 'application/json' }), docName || 'song.json');
    if (!hosted) doc.markSaved(); // saved; playback may still be stale
  }
  function save() {
    if (!doc) return;
    if (!onSaveRequest) { if (!hosted) downloadJson(); return; }
    // markSaved marks this snapshot's version of this document, whatever is edited meanwhile.
    const saving = doc, version = doc.version, json = doc.snapshot();
    const markSaved = () => saving.markSaved(version);
    guard(Promise.resolve().then(() => onSaveRequest(json, { markSaved })));
  }
  $('dlJson').onclick = downloadJson;
  $('dlIt').onclick = () => guard((async () => {
    if (!doc || isSidSong(doc.json)) return;
    const title = doc.json.title;
    const { module } = await compiled();
    download(new Blob([module]), fileName(title) + '.it');
  })());
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000); // some browsers cancel an immediately revoked download
  }

  // ---------- engines ----------
  async function ensurePlayer(kind) {
    if (!window.isSecureContext || !('audioWorklet' in (window.AudioContext?.prototype ?? {}))) {
      $('meta').innerHTML = `⚠ audio needs HTTPS — try <a href="https://${location.host}${location.pathname}">https://${location.host}</a>`;
      throw Object.assign(new Error('secure context required for AudioWorklet'), { shown: true });
    }
    if (player && player !== players[kind]) { player.stop(); started = false; playingNode = null; }
    if (players[kind]) player = players[kind];
    else initPlayer(kind);
    const p = player;
    p.setVol(effVol());
    if (p.suspending) await p.suspending; // a load suspended it; resume after that settled
    if (p.context.state === 'suspended') await p.context.resume();
    await p.ready;
    return p;
  }
  // Loading stops playback and lets the engines' contexts sleep: nothing runs after a load.
  function halt() {
    if (player) player.stop();
    started = paused = false;
    playingNode = null;
    $('pos').textContent = NO_POS;
    markOrder(0);
  }
  function quiet() {
    halt();
    for (const p of Object.values(players)) {
      if (p && p.context.state === 'running') {
        const s = p.suspending = p.context.suspend().catch(() => {}).then(() => { if (p.suspending === s) p.suspending = null; });
      }
    }
  }

  // Report failures in the info line instead of leaving the UI silently stuck.
  const guard = (promise, current = () => true) => Promise.resolve(promise).catch((e) => {
    if (!e?.shown && current() && !destroyed) $('meta').textContent = 'error: ' + (e?.message ?? e);
    return false;
  });
  // Loads and plays get generations. A newer load supersedes older loads and a ▶ waiting for
  // one; a newer ▶ supersedes an older ▶ but never a load; ■ supersedes both. Obsolete requests
  // check current() after each await and then neither start audio, change the loaded song nor
  // report errors.
  let loadGen = 0, playGen = 0;
  let pendingLoad = null; // the newest load while it is in flight: resolves true when it loaded
  function loadRequest(task) {
    const id = ++loadGen;
    playGen++;
    const current = () => id === loadGen && !destroyed;
    const p = guard(task(current), current);
    pendingLoad = p;
    p.then(() => { if (pendingLoad === p) pendingLoad = null; });
    return p;
  }
  function playRequest(task) {
    const id = ++playGen;
    const current = () => id === playGen && !destroyed;
    return guard(task(current), current);
  }

  // ---------- loading ----------
  // load(json | Promise<json>, { name }): compile (no audio), then show the song for editing.
  // Resolves true when the song was loaded; false when it failed (the error is shown and the
  // previous song stays) or a newer request superseded it.
  function load(input, { name } = {}) {
    return loadRequest(async (current) => {
      const json = await input;
      if (!current()) return false;
      const module = await compileJson(json);
      if (!current()) return false;
      quiet();
      loadId++;
      unsubscribe?.();
      binary = null;
      doc = new TrackerDoc(json);
      docName = name ?? null;
      unsubscribe = doc.onChange(onDocChange);
      version = 0; compiledNode = 0; compiledModule = module;
      grid = displayGrid(doc.json);
      orders = grid.orders.map((o) => o.pat);
      info = songInfo(doc.json, module.result);
      curInst = 0;
      cursor = { row: 0, ch: 0 };
      selOrder = 0;
      chScroll = 0;
      cur = { order: 0, pattern: 0, row: 0, pos: 0 };
      resetChannels(grid.channels.length);
      patCache.clear();
      $('title').textContent = '· ' + (doc.json.title || '(untitled)');
      $('seek').value = 0;
      showInfo();
      showSidStats(module);
      buildOrderStrip();
      refreshInstruments();
      updateEditState();
      updateSidBar();
      notifyDirty();
      return true;
    });
  }
  // loadModule(buf | Promise<buf>, name): a module file (.it/.mod/.xm/.s3m/.sid). Its pattern
  // view comes from the worklet, so it appears once ▶ plays it.
  function loadModule(input, name = 'module') {
    return loadRequest(async (current) => {
      const buf = await input;
      if (!current()) return false;
      const head = new Uint8Array(buf, 0, Math.min(4, buf.byteLength));
      const sid = /\.sid$/i.test(name) || /^[PR]SID/.test(latin1(head));
      quiet();
      loadId++;
      unsubscribe?.();
      unsubscribe = null;
      doc = null; docName = null;
      editMode = false; chScroll = 0;
      binary = { buf, sid, name };
      grid = null; orders = []; info = null;
      cur = { order: 0, pattern: 0, row: 0, pos: 0 };
      resetChannels(0);
      patCache.clear();
      const file = name.split('/').pop();
      $('title').textContent = '· ' + ((sid && sidFile(buf).meta.title) || file);
      $('seek').value = 0;
      $('meta').textContent = `${file} loaded — press ▶ to play`;
      buildOrderStrip();
      refreshInstruments();
      updateEditState();
      updateSidBar();
      notifyDirty();
      return true;
    });
  }

  // ---------- transport ----------
  // ▶ plays what is loaded (including unsaved edits) from the selected order, compiling first
  // when the document changed since the last compile.
  async function startPlayback(current, fromOrder) {
    if (doc) {
      const d = doc;
      await ensurePlayer(isSidSong(d.json) ? 'sid' : 'it');
      if (!current()) return false;
      if (!started || playingNode !== version) {
        const { module, node } = await compiled();
        if (!current()) return false;
        showSidStats(module);
        player.play(module);
        playingNode = node;
      }
      started = true; paused = false;
      player.setOrderRow(fromOrder ?? selOrder, 0);
      updateEditState();
      return true;
    }
    if (binary) {
      const b = binary;
      await ensurePlayer(b.sid ? 'sid' : 'it');
      if (!current()) return false;
      player.play(b.sid ? sidFile(b.buf) : b.buf);
      started = true; paused = false;
      return true;
    }
    $('meta').textContent = hosted ? 'no song loaded' : 'nothing loaded — Load a URL or drop a file first';
    return false;
  }
  function play(fromOrder) {
    // Nothing loaded or loading: the host starts a load first (synchronously sets pendingLoad).
    if (!pendingLoad && !doc && !binary && loadForPlay) loadForPlay();
    const waiting = pendingLoad;
    return playRequest(async (current) => {
      if (waiting && !(await waiting)) return false; // it failed (shown) or a newer load replaced it
      if (!current()) return false;
      return startPlayback(current, fromOrder);
    });
  }
  function doPause() { if (started && !paused) { player.pause(); paused = true; } }
  function doResume() { if (started && paused) { player.unpause(); paused = false; } }
  function stop() {
    loadGen++; playGen++; // a pending load, compile or ▶ no longer goes ahead
    pendingLoad = null;
    if (!player) return;
    halt();
  }
  function setVolume(v) {
    volume = v;
    if (!muted) $('vol').value = v;
    player?.setVol(effVol());
  }

  $('play').onclick = () => {
    if (!started) return play();
    if (paused) doResume();
  };
  $('pause').onclick = () => { paused ? doResume() : doPause(); };
  $('stop').onclick = stop;
  $('edit').onclick = () => {
    if (!doc) { $('meta').textContent = 'edit mode needs a .json song (e.g. ../songs/first_light.json)'; return; }
    editMode = !editMode;
    if (editMode) selOrder = started ? cur.order : selOrder;
    updateEditState();
  };
  $('seek').oninput = () => { seeking = true; };
  $('seek').onchange = () => { if (player) player.setPos(parseFloat($('seek').value)); seeking = false; };
  $('vol').oninput = () => setVolume(parseFloat($('vol').value));
  $('tempo').oninput = () => player && player.setTempo(parseFloat($('tempo').value));
  $('pitch').oninput = () => player && player.setPitch(parseFloat($('pitch').value));

  // click grid: header = mute/solo buttons, body = place edit cursor
  let dragX = null, wheelX = 0, touchX = null;
  patC.addEventListener('mousedown', (e) => {
    if (!grid) return;
    const r = patC.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const { rowH, headH, rowNumW } = LAYOUT;
    const nCh = grid.channels.length;
    const { chW, first } = channelView(r.width, nCh);
    const colAt = (px) => px < rowNumW ? -1 : first + Math.floor((px - rowNumW) / chW);
    if (y < headH) {
      const c = colAt(x);
      if (c < 0 || c >= nCh) return;
      const relX = x - (rowNumW + (c - first) * chW + 6);
      if (y >= 4 && y <= 18) {
        if (relX >= chW - 44 && relX < chW - 31) return toggleMute(c);
        if (relX >= chW - 28 && relX < chW - 15) return toggleSolo(c);
      }
      return;
    }
    if (!editMode) { dragX = { x: e.clientX, first, chW }; return; }
    const centerY = headH + (r.height - headH) / 2;
    const row = Math.round(dispRow + (y - centerY) / rowH);
    const ch = colAt(x);
    const pat = grid.patterns[viewPattern()];
    if (pat && row >= 0 && row < pat.rows.length && ch >= 0 && ch < nCh) {
      const chChanged = ch !== cursor.ch;
      cursor = { row, ch };
      if (chChanged) syncInstToChannel();
    }
  });

  // sideways channel scrolling: wheel/trackpad, or drag outside edit mode
  const onMouseMove = (e) => { if (dragX) chScroll = dragX.first - (e.clientX - dragX.x) / dragX.chW; };
  const onMouseUp = () => { dragX = null; };
  addEventListener('mousemove', onMouseMove);
  addEventListener('mouseup', onMouseUp);
  patC.addEventListener('wheel', (e) => {
    const dx = e.shiftKey ? e.deltaY : e.deltaX;
    if (!dx || editMode) return;
    e.preventDefault();
    wheelX += dx; // trackpads send many small deltas; step one channel per ~60px
    if (Math.abs(wheelX) >= 60) { chScroll += Math.trunc(wheelX / 60); wheelX %= 60; }
  }, { passive: false });
  patC.addEventListener('touchstart', (e) => { if (!editMode) touchX = { x: e.touches[0].clientX, first: chScroll }; }, { passive: true });
  patC.addEventListener('touchmove', (e) => {
    if (!touchX || !grid) return;
    chScroll = touchX.first - (e.touches[0].clientX - touchX.x) / channelView(patC.getBoundingClientRect().width, grid.channels.length).chW;
  }, { passive: true });
  patC.addEventListener('touchend', () => { touchX = null; });

  // ---------- keyboard ----------
  async function onKeyDown(e) {
    const tag = (e.target?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea' || e.target?.isContentEditable) {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    if (e.altKey) return;
    if (e.metaKey || e.ctrlKey) {
      const k = (e.key || '').toLowerCase();
      if (k === 'z' && doc) { e.preventDefault(); if (e.shiftKey) doc.redo(); else doc.undo(); }
      else if (k === 's' && doc) { e.preventDefault(); save(); }
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      if (!started) { await play(); return; }
      if (paused) { stale() ? await play() : doResume(); }
      else if (stale() && editMode) { await play(); }
      else { doPause(); }
      return;
    }
    if (!editMode || !grid || !clampCursor()) return;

    const pat = grid.patterns[viewPattern()];
    const nCh = grid.channels.length;
    switch (e.key) {
      case 'ArrowUp': e.preventDefault(); cursor.row = (cursor.row - 1 + pat.rows.length) % pat.rows.length; return;
      case 'ArrowDown': e.preventDefault(); cursor.row = (cursor.row + 1) % pat.rows.length; return;
      case 'ArrowLeft': e.preventDefault(); cursor.ch = (cursor.ch - 1 + nCh) % nCh; syncInstToChannel(); return;
      case 'ArrowRight': e.preventDefault(); cursor.ch = (cursor.ch + 1) % nCh; syncInstToChannel(); return;
      case 'PageUp': e.preventDefault(); cursor.row = Math.max(0, cursor.row - 16); return;
      case 'PageDown': e.preventDefault(); cursor.row = Math.min(pat.rows.length - 1, cursor.row + 16); return;
      case 'Home': e.preventDefault(); cursor.row = 0; return;
      case 'End': e.preventDefault(); cursor.row = pat.rows.length - 1; return;
      case 'Delete': case 'Backspace': e.preventDefault(); delNote(); return;
      case '[': octave = Math.max(1, octave - 1); updateEditState(); return;
      case ']': octave = Math.min(8, octave + 1); updateEditState(); return;
      case 'a': setNote('=='); return; // note off: an ordinary sample loop keeps sounding
      case '1': setNote('^^'); return; // note cut: silence
    }
    const k = e.key.toLowerCase();
    if (k in PIANO) {
      e.preventDefault();
      const semi = octave * 12 + PIANO[k];
      if (semi < 120) setNote(NOTE_NAMES[semi % 12] + Math.floor(semi / 12));
    }
  }
  addEventListener('keydown', onKeyDown);

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    loadGen++; playGen++;
    cancelAnimationFrame(frame);
    removeEventListener('keydown', onKeyDown);
    removeEventListener('mousemove', onMouseMove);
    removeEventListener('mouseup', onMouseUp);
    unsubscribe?.();
    previewer.dispose();
    for (const p of Object.values(players)) {
      if (!p) continue;
      try { p.stop(); } catch {}
      p.context.close().catch(() => {});
    }
    players.it = players.sid = player = null;
    container.innerHTML = '';
  }

  return {
    load, loadModule, play, stop, setVolume, destroy,
    get doc() { return doc; },
    toolbar: $('toolbar'), // the host page's own controls go here (the public page's song box)
    // Read-only view of the transport and editor, for the host page and tests.
    get state() {
      return { playing: playing(), started, stale: stale(), compiledNode, version, editMode, cursor: { ...cursor }, grid, player };
    },
  };
}
