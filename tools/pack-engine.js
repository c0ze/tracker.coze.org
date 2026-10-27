#!/usr/bin/env node
/**
 * pack-engine — pack the engine into one reproducible archive from git objects at a commit.
 *
 * Usage: node tools/pack-engine.js [--commit <rev>] [--out build]
 *
 * Writes <out>/engine-<sha12>.tar and <out>/engine-<sha12>.json, where <sha12> is the first 12
 * hex digits of the resolved commit and the manifest is
 *   { commit, digest: "sha256:<hex of the tar>", files: [{ path, sha256, size }] }.
 * Files are listed with `git ls-tree` and read with `git cat-file blob <commit>:<path>`, so the
 * working tree, untracked files and uncommitted edits never reach the archive. The tar is POSIX
 * ustar written here: entries sorted, mode 0644 (0755 directories), mtime 0, uid/gid 0, empty
 * user and group names, so the same commit always gives the same bytes.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** The engine: files and directory prefixes at the repository root (tools/serve.py is left out). */
const ENGINE_FILES = ['package.json', 'package-lock.json', 'songs/lib.js', 'songs/sid-kit.js', 'songs/amiga-kit.js'];
const ENGINE_DIRS = ['tools/', 'vendor/', 'player/vendor/chiptune3/', 'player/vendor/crsid/', 'sid/'];
const EXCLUDED = new Set(['tools/serve.py']);

const git = (args, encoding) => execFileSync('git', args, { cwd: ROOT, encoding, maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'pipe'] });

/** Resolves a revision to a full commit sha. */
export function resolveCommit(rev = 'HEAD') {
  return git(['rev-parse', '--verify', `${rev}^{commit}`], 'utf8').trim();
}

/** Every file path in the tree of a commit (git order). */
export function treeFiles(commit = 'HEAD') {
  return git(['ls-tree', '-r', '-z', '--full-tree', '--name-only', commit], 'utf8').split('\0').filter(Boolean);
}

/** The bytes of one file in the tree of a commit. */
export function readBlob(commit, file) {
  return new Uint8Array(git(['cat-file', 'blob', `${commit}:${file}`]));
}

/** Engine paths in the tree of a commit, sorted. */
export function engineFiles(commit = 'HEAD') {
  return treeFiles(commit)
    .filter((f) => !EXCLUDED.has(f) && (ENGINE_FILES.includes(f) || ENGINE_DIRS.some((d) => f.startsWith(d))))
    .sort(compare);
}

const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const encoder = new TextEncoder();

/** Writes an ASCII field into a header block at an offset, NUL padded. */
function put(block, at, len, value) {
  const bytes = encoder.encode(value);
  if (bytes.length > len) throw new Error(`ustar: ${JSON.stringify(value)} does not fit in ${len} bytes`);
  block.set(bytes, at);
}
const octal = (n, width) => n.toString(8).padStart(width - 1, '0');

/** Splits a path into the ustar prefix (up to 155 bytes) and name (up to 100 bytes). */
function splitPath(p) {
  if (encoder.encode(p).length <= 100) return ['', p];
  for (let i = p.indexOf('/'); i !== -1; i = p.indexOf('/', i + 1)) {
    const prefix = p.slice(0, i), name = p.slice(i + 1);
    if (name && encoder.encode(prefix).length <= 155 && encoder.encode(name).length <= 100) return [prefix, name];
  }
  throw new Error(`ustar: path too long: ${p}`);
}

function header(entryPath, size, isDir) {
  const block = new Uint8Array(512);
  const [prefix, name] = splitPath(entryPath);
  put(block, 0, 100, name);
  put(block, 100, 8, octal(isDir ? 0o755 : 0o644, 8));
  put(block, 108, 8, octal(0, 8));
  put(block, 116, 8, octal(0, 8));
  put(block, 124, 12, octal(size, 12));
  put(block, 136, 12, octal(0, 12));
  block.fill(32, 148, 156); // the checksum field counts as spaces while summing
  block[156] = (isDir ? '5' : '0').charCodeAt(0);
  put(block, 257, 6, 'ustar');
  put(block, 263, 2, '00');
  put(block, 329, 8, octal(0, 8));
  put(block, 337, 8, octal(0, 8));
  put(block, 345, 155, prefix);
  const sum = block.reduce((n, x) => n + x, 0);
  put(block, 148, 8, `${octal(sum, 7)}\0`);
  block[155] = 32;
  return block;
}

/**
 * Builds a deterministic POSIX ustar archive. Parent directories are added as 0755 entries; all
 * entries are sorted by path; the archive ends with two zero blocks.
 */
export function ustar(entries) {
  const files = new Map();
  const dirs = new Set();
  for (const { path: p, bytes } of entries) {
    if (!p || p.startsWith('/') || p.endsWith('/') || p.split('/').some((s) => s === '' || s === '.' || s === '..')) throw new Error(`ustar: bad path ${JSON.stringify(p)}`);
    if (files.has(p)) throw new Error(`ustar: duplicate path ${p}`);
    files.set(p, bytes);
    const parts = p.split('/');
    for (let i = 1; i < parts.length; i++) dirs.add(`${parts.slice(0, i).join('/')}/`);
  }
  for (const d of dirs) if (files.has(d.slice(0, -1))) throw new Error(`ustar: ${d.slice(0, -1)} is both a file and a directory`);
  const names = [...dirs, ...files.keys()].sort(compare);
  const parts = [];
  let total = 0;
  for (const name of names) {
    const isDir = name.endsWith('/');
    const bytes = isDir ? new Uint8Array(0) : files.get(name);
    parts.push(header(name, bytes.length, isDir));
    total += 512;
    if (bytes.length) {
      const padded = new Uint8Array(Math.ceil(bytes.length / 512) * 512);
      padded.set(bytes);
      parts.push(padded);
      total += padded.length;
    }
  }
  const out = new Uint8Array(total + 1024);
  let at = 0;
  for (const part of parts) { out.set(part, at); at += part.length; }
  return out;
}

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

/** Packs the engine at a commit into <out>/engine-<sha12>.tar and .json; returns the manifest. */
export function packEngine({ commit = 'HEAD', out = path.join(ROOT, 'build') } = {}) {
  const sha = resolveCommit(commit);
  const entries = engineFiles(sha).map((p) => ({ path: p, bytes: readBlob(sha, p) }));
  const tar = ustar(entries);
  const manifest = {
    commit: sha,
    digest: `sha256:${sha256(tar)}`,
    files: entries.map(({ path: p, bytes }) => ({ path: p, sha256: sha256(bytes), size: bytes.length })),
  };
  fs.mkdirSync(out, { recursive: true });
  const base = path.join(out, `engine-${sha.slice(0, 12)}`);
  fs.writeFileSync(`${base}.tar`, tar);
  fs.writeFileSync(`${base}.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const USAGE = 'Usage: node tools/pack-engine.js [--commit <rev>] [--out build]';
  try {
    const { values, positionals } = parseArgs({ allowPositionals: true, options: { commit: { type: 'string', default: 'HEAD' }, out: { type: 'string', default: 'build' } } });
    if (positionals.length) throw new Error(USAGE);
    const manifest = packEngine({ commit: values.commit, out: path.resolve(values.out) });
    console.log(`engine-${manifest.commit.slice(0, 12)}: ${manifest.files.length} files, ${manifest.digest}`);
  } catch (e) {
    console.error(`${e.message}\n${USAGE}`);
    process.exit(1);
  }
}
