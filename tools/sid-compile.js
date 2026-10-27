/**
 * Compile a SID song JSON into the driver (sid/*.s) plus its data: a PSID file for players
 * and a PRG (load address + bytes) for games. Browser-safe: the caller passes the driver
 * source (DRIVER_FILES, concatenated), read from disk or fetched.
 *
 *   const { psid, prg, org, symbols, warnings, stats } = compileSid(song, { driver });
 */
import { assemble } from './asm6502.js';
import { assertSong } from './validate-song.js';
import { frequencyTable, instrumentTables, sfxTables } from './sid-data.js';
import { convertSong, orderMap } from './sid-tracks.js';

export const DRIVER_FILES = ['driver.s', 'voice.s'];
export const DEFAULT_ORG = 0x1000;
// Hard restart ADSR (music.html, 2.6.1: "usually 0"); sid.hardRestartAdsr overrides it.
const HR_ADSR = [0x00, 0x00];

// label: .byte ... lines, 16 values per line.
function table(label, values) {
  const v = values.length ? values : [0];
  const lines = [];
  for (let i = 0; i < v.length; i += 16) lines.push(`        .byte ${v.slice(i, i + 16).join(', ')}`);
  return `${label}:\n${lines.join('\n')}`;
}

function dataSource({ ins, wt, flt }, sfx, freq, conv) {
  const t = conv.tracks.map((_, i) => `trk${i}`);
  return [
    '; ---- song data (tools/sid-compile.js)',
    table('order_pat', conv.order),
    table('pat_rows', conv.chunks.map((c) => c.rows)),
    table('pat_v0', conv.chunks.map((c) => c.tracks[0])),
    table('pat_v1', conv.chunks.map((c) => c.tracks[1])),
    table('pat_v2', conv.chunks.map((c) => c.tracks[2])),
    table('trk_lo', t.map((l) => `<${l}`)),
    table('trk_hi', t.map((l) => `>${l}`)),
    table('ins_ad', ins.ad), table('ins_sr', ins.sr), table('ins_wave', ins.wave),
    table('ins_pw_lo', ins.pwLo), table('ins_pw_hi', ins.pwHi), table('ins_pw_spd', ins.pwSpd),
    table('ins_pw_min', ins.pwMin), table('ins_pw_max', ins.pwMax), table('ins_flt', ins.flt),
    table('wt_wave', wt.wave), table('wt_note', wt.note),
    table('flt_cut', flt.cut), table('flt_spd', flt.spd), table('flt_min', flt.min),
    table('flt_max', flt.max), table('flt_res', flt.res), table('flt_mode', flt.mode),
    table('sfx_ins', sfx.ins), table('sfx_note', sfx.note), table('sfx_len', sfx.len), table('sfx_tail', sfx.tail),
    table('freq_lo', freq.lo), table('freq_hi', freq.hi),
    ...conv.tracks.map((bytes, i) => table(`trk${i}`, bytes)),
    'song_end:',
  ].join('\n');
}

/** PSID v2 header + data (big-endian header fields; load address in the first data bytes). */
export function psidFile(bytes, org, { title = '', author = '', released = '', model = '6581' }) {
  const h = new Uint8Array(0x7c);
  const view = new DataView(h.buffer);
  const text = (s, at) => { for (let i = 0; i < 31 && i < s.length; i++) h[at + i] = s.charCodeAt(i) < 256 ? s.charCodeAt(i) : 63; };
  h.set([0x50, 0x53, 0x49, 0x44]);          // "PSID"
  view.setUint16(4, 2);                      // version
  view.setUint16(6, 0x7c);                   // data offset
  view.setUint16(8, 0);                      // load address: first two data bytes
  view.setUint16(0x0a, org);                 // init
  view.setUint16(0x0c, org + 3);             // play, once per frame (speed bits 0: vertical blank)
  view.setUint16(0x0e, 1);                   // songs
  view.setUint16(0x10, 1);                   // start song
  text(title, 0x16); text(author, 0x36); text(released, 0x56);
  view.setUint16(0x76, (1 << 2) | ((model === '8580' ? 2 : 1) << 4)); // PAL, SID model
  const out = new Uint8Array(0x7c + 2 + bytes.length);
  out.set(h);
  out.set([org & 0xff, org >> 8], 0x7c);
  out.set(bytes, 0x7c + 2);
  return out;
}

export function compileSid(song, { driver, org = DEFAULT_ORG }) {
  assertSong(song, { sid: true });
  if (!song.sid) throw new Error('not a SID song: it needs a "sid" object (see sid/FORMAT.md)');
  const warnings = new Map();
  const warn = (m) => warnings.set(m, (warnings.get(m) || 0) + 1);
  const tables = instrumentTables(song.samples);
  tables.warnings.forEach(warn);
  // IT gains the SID has no place for: sid.volume is the master volume, sustain the note level.
  if (song.mixvol !== undefined && song.mixvol !== 128) warn(`mixvol ${song.mixvol} is not carried over (set sid.volume)`);
  song.samples.forEach((s, i) => {
    if (s.volume !== undefined && s.volume !== 64) warn(`${s.name ?? `instrument ${i}`}: volume ${s.volume} is not carried over (set its sustain)`);
  });
  const conv = convertSong(song, { transpose: tables.transpose, warn });
  const sfx = sfxTables(song.sid.sfx, tables.transpose);
  const defines = {
    ORG: org, SPEED: conv.speed[0], SPEED_ODD: conv.speed[1], NUM_ORDERS: conv.order.length, LOOP_ORDER: conv.loop,
    HR_FRAMES: song.sid.hardRestart ?? 2, HR_KEEP: song.sid.hardRestartAdsr === 'keep' ? 1 : 0,
    ...(([ad, sr]) => ({ HR_AD: ad, HR_SR: sr }))(Array.isArray(song.sid.hardRestartAdsr) ? song.sid.hardRestartAdsr : HR_ADSR),
    VOLUME: song.sid.volume ?? 15,
    FILTERS: tables.flt.cut.length ? 1 : 0,
  };
  const { bytes, symbols, end } = assemble(`${driver}\n${dataSource(tables, sfx, frequencyTable(), conv)}\n`, { defines });
  if (end > 0x10000) throw new Error(`the song runs past $FFFF (org $${org.toString(16)}, ${bytes.length} bytes)`);
  const psid = psidFile(bytes, org, {
    title: song.title ?? '', author: song.sid.author ?? '', released: song.sid.released ?? '', model: song.sid.model,
  });
  const prg = new Uint8Array(bytes.length + 2);
  prg.set([org & 0xff, org >> 8]);
  prg.set(bytes, 2);
  const driverEnd = symbols.get('vars_end');
  return {
    psid, prg, org, symbols, warnings, defines, orderMap: orderMap(song),
    sections: Object.fromEntries(Object.entries(song.sid.sections ?? {}).map(([k, v]) => [k, orderMap(song)[v]])),
    stats: { driver: driverEnd - org, data: end - driverEnd, total: bytes.length, tracks: conv.tracks.length,
      patterns: conv.chunks.length, orders: conv.order.length, speed: conv.speed },
  };
}

/** Human-readable summary for the CLI and the player. */
export function report({ stats, warnings, org }) {
  const lines = [`$${org.toString(16)}-$${(org + stats.total - 1).toString(16)}: driver ${stats.driver} bytes, data ${stats.data} ` +
    `(${stats.patterns} patterns, ${stats.tracks} tracks, order ${stats.orders}), ${[...new Set(stats.speed)].join('+')} frames per row`];
  if (warnings.size) lines.push('not carried over / approximated:', ...[...warnings].map(([m, n]) => `  ${n} x ${m}`));
  return lines.join('\n');
}
