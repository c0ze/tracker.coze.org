/**
 * asm6502 — a small two-pass 6502 assembler for the SID driver (sid/driver.s).
 * Plain ES module with no Node imports, so the browser player can use it too.
 *
 *   const { bytes, org, symbols } = assemble(source, { defines: { ORG: 0x1000 } });
 *
 * Syntax (a subset of ca65's):
 * - `label:`; `@local:` labels belong to the last global label; `name = expr` constants
 * - `; comments`
 * - `.org expr` (the first sets the origin; later ones may only move forward, padding with 0)
 * - `.byte expr|"text", ...`, `.word expr, ...`, `.res count[, fill]`, `.align n`
 * - `.if expr` / `.else` / `.endif`, `.error "text"`, `.assert expr, "text"`
 * - numbers `$ff`, `%1010`, `255`, `'a'`; `*` is the current address
 * - operators: unary `- ~ < >` (< low byte, > high byte), binary `* / % + - << >> & ^ |`
 *   and `== != <= >=` (1 or 0)
 * - all documented opcodes; `asl` or `asl a`; `(zp),y`, `(zp,x)`, `jmp (abs)`
 * Zero page addressing is used when the operand's value is known on the first pass and
 * below $100; forward references are always absolute.
 */

// Addressing modes: imp acc imm zp zpx zpy abs absx absy ind indx indy rel
const MODES = ['imp', 'acc', 'imm', 'zp', 'zpx', 'zpy', 'abs', 'absx', 'absy', 'ind', 'indx', 'indy', 'rel'];
const TABLE = `
adc .. .. 69 65 75 .. 6d 7d 79 .. 61 71 ..
and .. .. 29 25 35 .. 2d 3d 39 .. 21 31 ..
asl .. 0a .. 06 16 .. 0e 1e .. .. .. .. ..
bcc .. .. .. .. .. .. .. .. .. .. .. .. 90
bcs .. .. .. .. .. .. .. .. .. .. .. .. b0
beq .. .. .. .. .. .. .. .. .. .. .. .. f0
bit .. .. .. 24 .. .. 2c .. .. .. .. .. ..
bmi .. .. .. .. .. .. .. .. .. .. .. .. 30
bne .. .. .. .. .. .. .. .. .. .. .. .. d0
bpl .. .. .. .. .. .. .. .. .. .. .. .. 10
brk 00 .. .. .. .. .. .. .. .. .. .. .. ..
bvc .. .. .. .. .. .. .. .. .. .. .. .. 50
bvs .. .. .. .. .. .. .. .. .. .. .. .. 70
clc 18 .. .. .. .. .. .. .. .. .. .. .. ..
cld d8 .. .. .. .. .. .. .. .. .. .. .. ..
cli 58 .. .. .. .. .. .. .. .. .. .. .. ..
clv b8 .. .. .. .. .. .. .. .. .. .. .. ..
cmp .. .. c9 c5 d5 .. cd dd d9 .. c1 d1 ..
cpx .. .. e0 e4 .. .. ec .. .. .. .. .. ..
cpy .. .. c0 c4 .. .. cc .. .. .. .. .. ..
dec .. .. .. c6 d6 .. ce de .. .. .. .. ..
dex ca .. .. .. .. .. .. .. .. .. .. .. ..
dey 88 .. .. .. .. .. .. .. .. .. .. .. ..
eor .. .. 49 45 55 .. 4d 5d 59 .. 41 51 ..
inc .. .. .. e6 f6 .. ee fe .. .. .. .. ..
inx e8 .. .. .. .. .. .. .. .. .. .. .. ..
iny c8 .. .. .. .. .. .. .. .. .. .. .. ..
jmp .. .. .. .. .. .. 4c .. .. 6c .. .. ..
jsr .. .. .. .. .. .. 20 .. .. .. .. .. ..
lda .. .. a9 a5 b5 .. ad bd b9 .. a1 b1 ..
ldx .. .. a2 a6 .. b6 ae .. be .. .. .. ..
ldy .. .. a0 a4 b4 .. ac bc .. .. .. .. ..
lsr .. 4a .. 46 56 .. 4e 5e .. .. .. .. ..
nop ea .. .. .. .. .. .. .. .. .. .. .. ..
ora .. .. 09 05 15 .. 0d 1d 19 .. 01 11 ..
pha 48 .. .. .. .. .. .. .. .. .. .. .. ..
php 08 .. .. .. .. .. .. .. .. .. .. .. ..
pla 68 .. .. .. .. .. .. .. .. .. .. .. ..
plp 28 .. .. .. .. .. .. .. .. .. .. .. ..
rol .. 2a .. 26 36 .. 2e 3e .. .. .. .. ..
ror .. 6a .. 66 76 .. 6e 7e .. .. .. .. ..
rti 40 .. .. .. .. .. .. .. .. .. .. .. ..
rts 60 .. .. .. .. .. .. .. .. .. .. .. ..
sbc .. .. e9 e5 f5 .. ed fd f9 .. e1 f1 ..
sec 38 .. .. .. .. .. .. .. .. .. .. .. ..
sed f8 .. .. .. .. .. .. .. .. .. .. .. ..
sei 78 .. .. .. .. .. .. .. .. .. .. .. ..
sta .. .. .. 85 95 .. 8d 9d 99 .. 81 91 ..
stx .. .. .. 86 .. 96 8e .. .. .. .. .. ..
sty .. .. .. 84 94 .. 8c .. .. .. .. .. ..
tax aa .. .. .. .. .. .. .. .. .. .. .. ..
tay a8 .. .. .. .. .. .. .. .. .. .. .. ..
tsx ba .. .. .. .. .. .. .. .. .. .. .. ..
txa 8a .. .. .. .. .. .. .. .. .. .. .. ..
txs 9a .. .. .. .. .. .. .. .. .. .. .. ..
tya 98 .. .. .. .. .. .. .. .. .. .. .. ..`;

/** OPCODES[mnemonic][mode] = opcode byte. */
export const OPCODES = Object.fromEntries(TABLE.trim().split('\n').map((line) => {
  const [name, ...cols] = line.trim().split(/\s+/);
  return [name, Object.fromEntries(cols.flatMap((c, i) => (c === '..' ? [] : [[MODES[i], parseInt(c, 16)]])))];
}));
const SIZE = { imp: 1, acc: 1, imm: 2, zp: 2, zpx: 2, zpy: 2, abs: 3, absx: 3, absy: 3, ind: 3, indx: 2, indy: 2, rel: 2 };

class AsmError extends Error {}

// Expressions: a small Pratt parser. Returns a number, or undefined when a symbol is not yet
// known (first pass only).
const BINARY = { '|': 1, '^': 2, '&': 3, '==': 4, '!=': 4, '<=': 4, '>=': 4, '<<': 5, '>>': 5, '+': 6, '-': 6, '*': 7, '/': 7, '%': 7 };
const TOKEN = /\s*(\$[0-9a-f]+|%[01]+|\d+|'(?:[^'\\]|\\.)'|[@a-z_][\w.]*|<<|>>|==|!=|<=|>=|[-+*/%&|^~<>()])/iy;

function tokenize(text) {
  const out = [];
  TOKEN.lastIndex = 0;
  while (TOKEN.lastIndex < text.length) {
    if (/^\s*$/.test(text.slice(TOKEN.lastIndex))) break;
    const at = TOKEN.lastIndex;
    const m = TOKEN.exec(text);
    if (!m) throw new AsmError(`cannot parse expression: ${text}`);
    // %01 is a binary number only where an operand is expected; after one, % is modulo.
    const prev = out[out.length - 1];
    if (m[1][0] === '%' && m[1].length > 1 && prev !== undefined && (prev === ')' || /^[$\w'@]|^%./.test(prev))) {
      out.push('%');
      TOKEN.lastIndex = text.indexOf('%', at) + 1;
      continue;
    }
    out.push(m[1]);
  }
  return out;
}

function evaluate(text, lookup) {
  const t = tokenize(text);
  let i = 0;
  const atom = () => {
    const tok = t[i++];
    if (tok === undefined) throw new AsmError(`incomplete expression: ${text}`);
    if (tok === '(') { const v = expr(0); if (t[i++] !== ')') throw new AsmError(`missing ): ${text}`); return v; }
    if (tok === '-') { const v = atom(); return v === undefined ? v : -v; }
    if (tok === '~') { const v = atom(); return v === undefined ? v : ~v & 0xffff; }
    if (tok === '<') { const v = atom(); return v === undefined ? v : v & 0xff; }
    if (tok === '>') { const v = atom(); return v === undefined ? v : (v >> 8) & 0xff; }
    if (tok === '*') return lookup('*');
    if (tok[0] === '$') return parseInt(tok.slice(1), 16);
    if (tok[0] === '%') return parseInt(tok.slice(1), 2);
    if (tok[0] === "'") return tok.length === 3 ? tok.charCodeAt(1) : JSON.parse(`"${tok.slice(1, -1)}"`).charCodeAt(0);
    if (/^\d/.test(tok)) return parseInt(tok, 10);
    return lookup(tok);
  };
  const expr = (min) => {
    let left = atom();
    while (i < t.length && BINARY[t[i]] > min) {
      const op = t[i++], right = expr(BINARY[op]);
      if (left === undefined || right === undefined) { left = undefined; continue; }
      left = { '|': left | right, '^': left ^ right, '&': left & right, '==': +(left === right), '!=': +(left !== right),
        '<=': +(left <= right), '>=': +(left >= right), '<<': left << right, '>>': left >> right, '+': left + right,
        '-': left - right, '*': left * right, '/': Math.trunc(left / right), '%': left % right }[op];
    }
    return left;
  };
  const v = expr(0);
  if (i !== t.length) throw new AsmError(`unexpected "${t[i]}" in: ${text}`);
  return v;
}

// Splits on commas outside quotes and parentheses.
function splitArgs(text) {
  const out = []; let depth = 0, quote = null, cur = '';
  for (const ch of text) {
    if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// Strips a ; comment that is not inside quotes.
function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) { if (ch === '\\') i++; else if (ch === quote) quote = null; }
    else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === ';') return line.slice(0, i);
  }
  return line;
}

/** Operand text -> { mode candidates, expression text }. */
function parseOperand(op, text) {
  const s = text.trim();
  if (s === '' || /^a$/i.test(s)) return { modes: OPCODES[op].acc !== undefined ? ['acc'] : ['imp'], expr: null };
  if (s[0] === '#') return { modes: ['imm'], expr: s.slice(1) };
  if (OPCODES[op].rel !== undefined) return { modes: ['rel'], expr: s };
  let m;
  if ((m = /^\((.*),\s*x\s*\)$/i.exec(s))) return { modes: ['indx'], expr: m[1] };
  if ((m = /^\((.*)\)\s*,\s*y$/i.exec(s))) return { modes: ['indy'], expr: m[1] };
  if (op === 'jmp' && (m = /^\((.*)\)$/.exec(s))) return { modes: ['ind'], expr: m[1] };
  if ((m = /^(.*),\s*x$/i.exec(s))) return { modes: ['zpx', 'absx'], expr: m[1] };
  if ((m = /^(.*),\s*y$/i.exec(s))) return { modes: ['zpy', 'absy'], expr: m[1] };
  return { modes: ['zp', 'abs'], expr: s };
}

export function assemble(source, { defines = {} } = {}) {
  const lines = source.split('\n');
  const symbols = new Map(Object.entries(defines));
  const zpChoice = new Map(); // line index -> mode chosen on pass 1
  let out, org, pc, scope, final;

  const lookup = (line) => (name) => {
    if (name === '*') return pc;
    const key = name[0] === '@' ? scope + name : name;
    if (symbols.has(key)) return symbols.get(key);
    if (final) throw new AsmError(`line ${line + 1}: undefined symbol ${name}`);
    return undefined;
  };
  const known = (text, line, what) => {
    const v = evaluate(text, lookup(line));
    if (v === undefined) throw new AsmError(`line ${line + 1}: ${what} must be known on the first pass`);
    return v;
  };
  const emit = (b) => { if (final) out.push(b & 0xff); pc++; };
  const define = (name, value, line) => {
    const key = name[0] === '@' ? scope + name : name;
    if (!final && symbols.has(key) && !(key in defines)) throw new AsmError(`line ${line + 1}: ${name} defined twice`);
    if (!(key in defines)) symbols.set(key, value);
  };

  for (const pass of [1, 2]) {
    final = pass === 2;
    out = []; org = undefined; pc = 0; scope = '';
    const cond = []; // stack of { active, taken }
    lines.forEach((raw, n) => {
      try {
        let line = stripComment(raw).trim();
        const active = cond.every((c) => c.active);
        const dir = /^\.(if|else|endif)\b\s*(.*)$/i.exec(line);
        if (dir) {
          const d = dir[1].toLowerCase();
          if (d === 'if') {
            const v = active ? known(dir[2], n, '.if condition') : 0;
            cond.push({ active: active && v !== 0, taken: v !== 0 });
          } else if (!cond.length) throw new AsmError(`line ${n + 1}: .${d} without .if`);
          else if (d === 'else') { const c = cond[cond.length - 1]; c.active = !c.taken && cond.slice(0, -1).every((x) => x.active); }
          else cond.pop();
          return;
        }
        if (!active || !line) return;
        let m = /^([@a-z_][\w.]*)\s*:\s*(.*)$/i.exec(line);
        if (m) {
          if (m[1][0] !== '@') scope = m[1];
          define(m[1], pc, n);
          line = m[2].trim();
          if (!line) return;
        }
        if ((m = /^([@a-z_][\w.]*)\s*=\s*(.+)$/i.exec(line))) {
          const v = evaluate(m[2], lookup(n));
          if (v === undefined) throw new AsmError(`line ${n + 1}: ${m[1]} must be known on the first pass`);
          define(m[1], v, n);
          return;
        }
        if ((m = /^\.(\w+)\s*(.*)$/.exec(line))) return directive(m[1].toLowerCase(), m[2], n);
        instruction(line, n);
      } catch (e) {
        if (e instanceof AsmError && !/^line \d+/.test(e.message)) throw new AsmError(`line ${n + 1}: ${e.message}\n  ${raw.trim()}`);
        if (e instanceof AsmError) throw new AsmError(`${e.message}\n  ${raw.trim()}`);
        throw e;
      }
    });
    if (cond.length) throw new AsmError('missing .endif');
  }

  function directive(d, args, n) {
    const L = lookup(n);
    if (d === 'org') {
      const v = known(args, n, '.org');
      if (org === undefined) { org = pc = v; return; }
      if (v < pc) throw new AsmError(`.org $${v.toString(16)} is behind the current address $${pc.toString(16)}`);
      while (pc < v) emit(0);
    } else if (d === 'byte') {
      for (const a of splitArgs(args)) {
        if (a[0] === '"') { for (const ch of JSON.parse(a)) emit(ch.charCodeAt(0)); continue; }
        const v = evaluate(a, L);
        if (final && (v < -128 || v > 255)) throw new AsmError(`byte out of range: ${a} = ${v}`);
        emit(v ?? 0);
      }
    } else if (d === 'word') {
      for (const a of splitArgs(args)) {
        const v = evaluate(a, L);
        if (final && !(v >= -0x8000 && v <= 0xffff)) throw new AsmError(`word out of range: ${a} = ${v}`);
        emit(v ?? 0); emit((v ?? 0) >> 8);
      }
    } else if (d === 'res') {
      const [count, fill = '0'] = splitArgs(args);
      const c = known(count, n, '.res count'), f = final ? evaluate(fill, L) : 0;
      for (let i = 0; i < c; i++) emit(f);
    } else if (d === 'align') {
      const a = known(args, n, '.align');
      while (pc % a) emit(0);
    } else if (d === 'error') {
      throw new AsmError(JSON.parse(args));
    } else if (d === 'assert') {
      const [e, msg = '"assertion failed"'] = splitArgs(args);
      if (final && !evaluate(e, L)) throw new AsmError(JSON.parse(msg));
    } else throw new AsmError(`unknown directive .${d}`);
  }

  function instruction(line, n) {
    const m = /^([a-z]{3})\b\s*(.*)$/i.exec(line);
    const op = m && m[1].toLowerCase();
    if (!m || !OPCODES[op]) throw new AsmError(`unknown instruction: ${line}`);
    if (org === undefined) throw new AsmError('code before .org');
    const { modes, expr } = parseOperand(op, m[2]);
    const value = expr === null ? undefined : evaluate(expr, lookup(n));
    let mode;
    if (zpChoice.has(n)) mode = zpChoice.get(n);
    else {
      const ok = modes.filter((x) => OPCODES[op][x] !== undefined);
      if (!ok.length) throw new AsmError(`${op} has no ${modes.join('/')} mode`);
      mode = ok.length > 1 && (value === undefined || value > 0xff || value < 0) ? ok[1] : ok[0];
      zpChoice.set(n, mode);
    }
    const start = pc;
    emit(OPCODES[op][mode]);
    const size = SIZE[mode];
    if (size === 1) return;
    if (!final) { pc += size - 1; return; }
    if (mode === 'rel') {
      const d = value - (start + 2);
      if (d < -128 || d > 127) throw new AsmError(`branch out of range (${d})`);
      emit(d);
    } else if (size === 2) {
      if (value < -128 || value > 0xff) throw new AsmError(`operand out of range: ${value}`);
      emit(value);
    } else {
      if (!(value >= 0 && value <= 0xffff)) throw new AsmError(`address out of range: ${value}`);
      emit(value); emit(value >> 8);
    }
  }

  const symbolsOut = new Map([...symbols].filter(([k]) => !(k in defines)));
  return { bytes: Uint8Array.from(out), org, end: pc, symbols: symbolsOut };
}
