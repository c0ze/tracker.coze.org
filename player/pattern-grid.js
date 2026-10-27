// The tracker's pattern grid, derived from song JSON. It has the shape libopenmpt's
// worklet reports as meta.song (channels[], patterns[{name, rows: string[][]}],
// orders[{name, pat}]), so the pattern view can draw a song without playing it.
// Browser-safe (no Node imports).

// libopenmpt's 13-wide empty cell.
export const EMPTY_CELL = '... .. .. ...';

// One event formatted like libopenmpt's pattern cell ("D-6 01v24 ..."). An absent event is ''.
export function cellString(ev) {
  if (!ev) return '';
  let note = '...';
  if (ev.note === '==') note = '===';
  else if (ev.note === '^^') note = '^^^';
  else if (ev.note) note = ev.note;
  const inst = ev.instrument !== undefined ? String(ev.instrument + 1).padStart(2, '0') : '..';
  let vol = ' ..';
  if (ev.vol) {
    const v = parseInt(ev.vol.slice(1));
    vol = ev.vol[0] + v.toString(16).toUpperCase().padStart(2, '0');
  }
  const fx = ev.fx ? ev.fx.toUpperCase() : '...';
  return `${note} ${inst}${vol} ${fx}`;
}

const cell = (json, pattern, row, channel) => {
  const ev = json.patterns?.[pattern]?.channels?.[channel]?.[row];
  return ev ? cellString(ev) : EMPTY_CELL;
};

function channelCount(json) {
  let n = 0;
  for (const p of json.patterns || []) n = Math.max(n, p.channels?.length || 0);
  for (const k of Object.keys(json.channelnames || {})) if (Number.isInteger(+k)) n = Math.max(n, +k + 1);
  return n;
}

export function gridFromSong(json) {
  const nCh = channelCount(json);
  const names = json.channelnames || {};
  const patterns = (json.patterns || []).map((p, pi) => ({
    name: p.name ?? '',
    rows: Array.from({ length: p.rows }, (_, r) => Array.from({ length: nCh }, (_, c) => cell(json, pi, r, c))),
  }));
  return {
    channels: Array.from({ length: nCh }, (_, c) => names[c] ?? ''),
    patterns,
    orders: (json.order || []).map((pat) => ({ name: json.patterns?.[pat]?.name ?? '', pat })),
  };
}

// Re-renders one cell after an edit (the JSON is already changed). A channel the grid does
// not have yet widens every row of every pattern.
export function updateGridCell(grid, json, pattern, row, channel) {
  while (grid.channels.length <= channel) {
    grid.channels.push(json.channelnames?.[grid.channels.length] ?? '');
    for (const p of grid.patterns) for (const r of p.rows) r.push(EMPTY_CELL);
  }
  const cells = grid.patterns[pattern]?.rows[row];
  if (cells) cells[channel] = cell(json, pattern, row, channel);
}
