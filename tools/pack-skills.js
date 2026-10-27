#!/usr/bin/env node
/**
 * pack-skills — pack the hosted composer's skills from git objects at a commit.
 *
 * Usage: node tools/pack-skills.js [--commit <rev>] [--out build/skills]
 *
 * Writes one directory per skill under <out> and <out>/bundle.json =
 *   { commit, skills: [{ name, sha256 }] }
 * where a skill's sha256 is the sha256 of its "<file sha256>  <path in the skill>\n" lines, sorted
 * by path (sha256sum's format). The skills are those named in BUNDLED_SKILLS: `mod-music-hosted`
 * (skills/mod-music-hosted plus skills/mod-music/references) and the style skills. A new directory
 * under skills/ ships only once it is added there (tests/pack.test.js fails until it is listed in
 * BUNDLED_SKILLS or EXCLUDED_SKILLS), so an experimental skill never reaches the composer unreviewed.
 *
 * Markdown links are rewritten so every relative link resolves inside the bundle:
 * - links into skills/<name>/ point at that skill's directory; skills/mod-music/SKILL.md and
 *   skills/mod-music/references/ point at mod-music-hosted's SKILL.md and references/;
 * - the repository files in PLACED are copied to the place given there;
 * - other songs/*.js files become copies under the linking skill's examples/;
 * - anything else (library/, files outside the tree, other repository paths) loses its link and
 *   keeps the link text. Nothing under library/ is ever copied.
 * Files are read with `git cat-file`, so the working tree never reaches the bundle.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { resolveCommit, treeFiles, readBlob } from './pack-engine.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const posix = path.posix;

const HOSTED = 'mod-music-hosted';
/** The skills the hosted composer gets, by directory name under skills/. */
export const BUNDLED_SKILLS = Object.freeze(['ambient', 'amiga-demoscene', 'amiga-masters', 'chiptune', 'jazz-hop',
  'jungle', HOSTED, 'sid-music', 'synthwave']);
/** Directories under skills/ that are deliberately not bundled, and why. */
export const EXCLUDED_SKILLS = Object.freeze({
  'mod-music': `written for the repository workflow; ${HOSTED} replaces it (its references are bundled there)`,
});
/** The names among `dirs` (directories under skills/) that are neither bundled nor excluded. */
export const unlistedSkills = (dirs) => dirs.filter((n) => !BUNDLED_SKILLS.includes(n) && !Object.hasOwn(EXCLUDED_SKILLS, n));
/** Repository files with a fixed place in the bundle. */
const PLACED = {
  'docs/sound-library.md': `${HOSTED}/docs/sound-library.md`,
  'docs/corpus-studies.md': `${HOSTED}/docs/corpus-studies.md`,
  'tools/synth-presets.js': `${HOSTED}/docs/synth-presets.js`,
  'docs/amiga-corpus-studies.md': 'amiga-masters/docs/amiga-corpus-studies.md',
  'songs/amiga-kit.js': 'amiga-masters/examples/amiga-kit.js',
  'sid/FORMAT.md': 'sid-music/docs/FORMAT.md',
  'docs/sid-corpus-studies.md': 'sid-music/docs/sid-corpus-studies.md',
  'songs/sid-kit.js': 'sid-music/examples/sid-kit.js',
};
/** Copied whether or not a link names them: the kits and studies their skills talk about. */
const ALWAYS = ['docs/sound-library.md', 'docs/amiga-corpus-studies.md', 'songs/amiga-kit.js', 'sid/FORMAT.md',
  'docs/sid-corpus-studies.md', 'songs/sid-kit.js'];

/** A link to mod-music's SKILL.md means the hosted variant's. */
const alias = (file) => (file === 'skills/mod-music/SKILL.md' ? `skills/${HOSTED}/SKILL.md` : file);
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const LINK = /(!?)\[([^\]]*)\]\(([^)\s]+)(\s+"[^"]*")?\)/g;
const decoder = new TextDecoder(), encoder = new TextEncoder();

/**
 * Builds the bundle in memory: { commit, files: Map<bundle path, bytes>, skills: [name],
 * unlinked: [{ file, target }] }.
 */
export function buildSkills(commit = 'HEAD') {
  const sha = resolveCommit(commit);
  const tree = treeFiles(sha);
  const inTree = new Set(tree);
  const names = [...BUNDLED_SKILLS].sort(compare);
  for (const n of names) if (!inTree.has(`skills/${n}/SKILL.md`)) throw new Error(`skills/${n}/SKILL.md is not in ${sha}`);
  const bundled = new Set(names);

  /** Where a repository file lives in the bundle, seen from a skill; null when it is not bundled. */
  const place = (file, skill) => {
    if (!inTree.has(file) || file.startsWith('library/')) return null;
    const m = /^skills\/([^/]+)\/(.+)$/.exec(file);
    if (m) {
      if (m[1] === 'mod-music') return m[2].startsWith('references/') ? `${HOSTED}/${m[2]}` : null;
      if (m[1] === HOSTED && m[2].startsWith('references/')) return null; // the references come from mod-music
      return bundled.has(m[1]) ? `${m[1]}/${m[2]}` : null;
    }
    if (PLACED[file]) return PLACED[file];
    if (/^songs\/[^/]+\.js$/.test(file)) return `${skill}/examples/${posix.basename(file)}`;
    return null;
  };

  const files = new Map(), from = new Map(), unlinked = [], queue = [];
  const add = (src, dest) => {
    if (from.has(dest)) {
      if (from.get(dest) !== src) throw new Error(`${dest} would hold both ${from.get(dest)} and ${src}`);
      return;
    }
    from.set(dest, src);
    queue.push({ src, dest });
  };
  for (const f of tree) {
    const dest = place(f, null);
    const m = /^skills\/([^/]+)\//.exec(f);
    if (dest && m && (m[1] === 'mod-music' || bundled.has(m[1]))) add(f, dest);
  }
  for (const f of ALWAYS) {
    if (!inTree.has(f)) throw new Error(`${f} is not in ${sha}`);
    add(f, PLACED[f]);
  }

  while (queue.length) {
    const { src, dest } = queue.shift();
    let bytes = readBlob(sha, src);
    if (src.endsWith('.md')) {
      const skill = dest.split('/')[0];
      const text = decoder.decode(bytes).replace(LINK, (whole, bang, label, target, title = '') => {
        if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#') || target.startsWith('/')) return whole;
        const hash = target.indexOf('#');
        const [file, frag] = hash < 0 ? [target, ''] : [target.slice(0, hash), target.slice(hash)];
        const resolved = alias(posix.normalize(posix.join(posix.dirname(src), file)));
        const to = resolved.startsWith('../') ? null : place(resolved, skill);
        if (!to) {
          unlinked.push({ file: dest, target });
          return label;
        }
        add(resolved, to);
        return `${bang}[${label}](${posix.relative(posix.dirname(dest), to)}${frag}${title})`;
      });
      bytes = encoder.encode(text);
    }
    files.set(dest, bytes);
  }
  return { commit: sha, files, skills: names, unlinked };
}

/** The digest of one skill directory (see the header). */
export function skillDigest(files, name) {
  const own = [...files.keys()].filter((f) => f.startsWith(`${name}/`)).sort(compare);
  return sha256(own.map((f) => `${sha256(files.get(f))}  ${f.slice(name.length + 1)}\n`).join(''));
}

/** Packs the skills at a commit into <out>; returns bundle.json's content and the unlinked links. */
export function packSkills({ commit = 'HEAD', out = path.join(ROOT, 'build', 'skills') } = {}) {
  const { commit: sha, files, skills, unlinked } = buildSkills(commit);
  const bundle = { commit: sha, skills: skills.map((name) => ({ name, sha256: skillDigest(files, name) })) };
  fs.mkdirSync(out, { recursive: true });
  for (const name of skills) fs.rmSync(path.join(out, name), { recursive: true, force: true });
  for (const [p, bytes] of files) {
    const file = path.join(out, ...p.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, bytes);
  }
  fs.writeFileSync(path.join(out, 'bundle.json'), `${JSON.stringify(bundle, null, 2)}\n`);
  return { bundle, unlinked };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const USAGE = 'Usage: node tools/pack-skills.js [--commit <rev>] [--out build/skills]';
  try {
    const { values, positionals } = parseArgs({ allowPositionals: true, options: { commit: { type: 'string', default: 'HEAD' }, out: { type: 'string', default: 'build/skills' } } });
    if (positionals.length) throw new Error(USAGE);
    const { bundle, unlinked } = packSkills({ commit: values.commit, out: path.resolve(values.out) });
    for (const { file, target } of unlinked) console.log(`  unlinked in ${file}: ${target}`);
    console.log(`skills-${bundle.commit.slice(0, 12)}: ${bundle.skills.map((s) => s.name).join(', ')}`);
  } catch (e) {
    console.error(`${e.message}\n${USAGE}`);
    process.exit(1);
  }
}
