// Tracker document model: a song JSON plus an undo history of inverse operations.
// Browser-safe (no Node imports); the player's editing runs on this model.
//
// History is a linear stack of nodes. Every edit pushes a node with a fresh, never reused
// id; the opening state is node 0. undo() and redo() move between nodes, and a new edit
// after an undo drops the redo branch. `version` is the current node id; markSaved(version)
// remembers a node id (by default the current one), so a host that saves a snapshot marks that
// snapshot's version and an edit made while the save was in flight stays dirty. `dirty` is an
// identity test: edit A, save, undo, edit B is dirty although the history
// is as deep as when it was saved. Nodes store only what an edit changed (never a
// snapshot of the whole JSON).

const clone = (x) => structuredClone(x);
const isIndex = (n) => Number.isInteger(n) && n >= 0;

export class TrackerDoc {
  #json;
  #done = [];   // applied nodes, oldest first
  #undone = []; // undone nodes, the next redo last
  #nextId = 1;
  #savedId = 0;
  #listeners = new Set();

  constructor(json) {
    if (json === null || typeof json !== 'object' || Array.isArray(json)) throw new TypeError('TrackerDoc needs a song object');
    this.#json = clone(json);
  }

  // The live document. Read it, do not write it: edits go through the methods below.
  get json() { return this.#json; }
  snapshot() { return clone(this.#json); }

  get #currentId() { return this.#done.length ? this.#done[this.#done.length - 1].id : 0; }
  get version() { return this.#currentId; }
  get dirty() { return this.#currentId !== this.#savedId; }
  get canUndo() { return this.#done.length > 0; }
  get canRedo() { return this.#undone.length > 0; }

  markSaved(version = this.#currentId) {
    if (!isIndex(version) || version >= this.#nextId) throw new RangeError(`no version ${version}`);
    this.#savedId = version;
    this.#emit({ kind: 'saved' });
  }

  onChange(listener) {
    this.#listeners.add(listener);
    return () => { this.#listeners.delete(listener); };
  }

  // Sets (or with null clears) one cell. Channels the pattern does not have yet are created.
  setCell(pattern, row, channel, event) {
    const pat = this.#json.patterns?.[pattern];
    if (!isIndex(pattern) || !pat) throw new RangeError(`no pattern ${pattern}`);
    if (!isIndex(row) || (Number.isInteger(pat.rows) && row >= pat.rows)) throw new RangeError(`row ${row} is outside pattern ${pattern}`);
    if (!isIndex(channel)) throw new RangeError(`bad channel ${channel}`);
    const key = String(row);
    const before = pat.channels?.[channel]?.[key];
    const after = event === null || event === undefined ? undefined : clone(event);
    if (before === undefined && after === undefined) return;
    if (before !== undefined && after !== undefined && sameValue(before, after)) return;
    const op = { type: 'cell', pattern, row: key, channel, before: before === undefined ? undefined : clone(before), after, channelsBefore: pat.channels ? pat.channels.length : null };
    this.#commit(op, { kind: 'cell', pattern, row, channel });
  }

  // Appends a sample definition and returns its index.
  addSample(def) {
    const samples = this.#samples();
    const op = { type: 'addSample', index: samples.length, def: clone(def) };
    this.#commit(op, { kind: 'addSample', index: op.index });
    return op.index;
  }

  // Removes a sample and remaps instruments the way the player's removeInstrument does:
  // events using it are deleted, events using a later sample move down by one, events
  // without an instrument stay.
  removeSample(index) {
    const samples = this.#samples();
    if (!isIndex(index) || index >= samples.length) throw new RangeError(`no sample ${index}`);
    const op = { type: 'removeSample', index, sample: clone(samples[index]), deleted: [], shifted: [] };
    this.#commit(op, { kind: 'removeSample', index });
  }

  undo() {
    const node = this.#done.pop();
    if (!node) return false;
    this.#revert(node.op);
    this.#undone.push(node);
    this.#emit(node.change);
    return true;
  }

  redo() {
    const node = this.#undone.pop();
    if (!node) return false;
    this.#apply(node.op);
    this.#done.push(node);
    this.#emit(node.change);
    return true;
  }

  #samples() {
    if (!Array.isArray(this.#json.samples)) throw new TypeError('this song has no samples array');
    return this.#json.samples;
  }

  #commit(op, change) {
    this.#apply(op); // may record what it touched in op
    this.#undone.length = 0;
    this.#done.push({ id: this.#nextId++, op, change });
    this.#emit(change);
  }

  #apply(op) {
    const j = this.#json;
    if (op.type === 'cell') {
      const pat = j.patterns[op.pattern];
      if (op.after === undefined) delete pat.channels[op.channel][op.row];
      else {
        pat.channels ??= [];
        while (pat.channels.length <= op.channel) pat.channels.push({});
        pat.channels[op.channel][op.row] = clone(op.after);
      }
    } else if (op.type === 'addSample') {
      j.samples.splice(op.index, 0, clone(op.def));
    } else {
      j.samples.splice(op.index, 1);
      op.deleted = [];
      op.shifted = [];
      j.patterns.forEach((pat, p) => {
        (pat.channels ?? []).forEach((chn, c) => {
          for (const row of Object.keys(chn)) {
            const ev = chn[row];
            if (ev === null || typeof ev !== 'object' || ev.instrument === undefined) continue;
            if (ev.instrument === op.index) {
              op.deleted.push({ p, c, row, event: clone(ev) });
              delete chn[row];
            } else if (ev.instrument > op.index) {
              op.shifted.push({ p, c, row, instrument: ev.instrument });
              ev.instrument--;
            }
          }
        });
      });
    }
  }

  #revert(op) {
    const j = this.#json;
    if (op.type === 'cell') {
      const pat = j.patterns[op.pattern];
      if (op.before === undefined) delete pat.channels[op.channel][op.row];
      else pat.channels[op.channel][op.row] = clone(op.before);
      if (op.channelsBefore === null) delete pat.channels;
      else if (pat.channels.length > op.channelsBefore) pat.channels.length = op.channelsBefore;
    } else if (op.type === 'addSample') {
      j.samples.splice(op.index, 1);
    } else {
      j.samples.splice(op.index, 0, clone(op.sample));
      for (const s of op.shifted) j.patterns[s.p].channels[s.c][s.row].instrument = s.instrument;
      for (const d of op.deleted) j.patterns[d.p].channels[d.c][d.row] = clone(d.event);
    }
  }

  // Every listener runs; the first error is rethrown afterwards (the document is already
  // consistent by then).
  #emit(change) {
    let failed = false, error;
    for (const fn of [...this.#listeners]) {
      try { fn({ ...change }); } catch (e) { if (!failed) { failed = true; error = e; } }
    }
    if (failed) throw error;
  }
}

function sameValue(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return Object.is(a, b);
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => Object.hasOwn(b, k) && sameValue(a[k], b[k]));
}
