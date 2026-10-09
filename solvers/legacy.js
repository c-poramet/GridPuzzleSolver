'use strict';
(function () {
  const esc = GSRuntime.esc;
  const E = GSRuntime.Error;
  const KW = new Set('setup start solve threshold listmax proceed of and or xor not nand nor xnor then after before right beside adj between apart within first last at opposite in exactly atleast atmost alldiff allsame total sum avg max min default unit ordered circular unordered each'.split(' '));
  const GATES = ['and', 'or', 'xor', 'nand', 'nor', 'xnor'];
  const CMP = ['=', '!=', '<', '>', '<=', '>='];
  const SEQ = ['then', 'then+', 'after', 'after+'];
  const MAXN = 12;

/* ───────── SETUP ───────── */
function parseSetup(L) {
  const C = [], tags = new Set(), explicit = new Set();
  const sets = {
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    seasons: ['Spring', 'Summer', 'Autumn', 'Winter'],
    zodiac: ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces']
  };
  const words = s => { const a = [], r = /"((?:\\.|[^"])*)"|(\S+)/g; let m; while ((m = r.exec(s))) a.push(m[1] != null ? m[1].replace(/\\"/g, '"') : m[2]); return a; };
  for (const { t, n } of L) {
    const m = t.match(/^(?:"((?:\\.|[^"])*)"|(\S+))\s*(?:\[([^\]]*)\])?\s*(.*)$/);
    if (!m) throw new E('Expected: name [tag] items…', n);
    const name = m[1] != null ? m[1].replace(/\\"/g, '"') : m[2], tag0 = m[3] || '', rest = m[4];
    if (tag0 && !/^[a-z]+$/.test(tag0)) throw new E(`Tag [${tag0}] must be one or more lowercase letters`, n);
    if (tag0 && tags.has(tag0)) throw new E(`Tag [${tag0}] is already used`, n);
    if (C.some(c => c.name.toLowerCase() === name.toLowerCase())) throw new E(`Category "${name}" is already used`, n);
    const tok0 = words(rest), mods = [];
    while (tok0.length && /^(ordered|circular|unordered)$/i.test(tok0[0])) mods.push(tok0.shift().toLowerCase());
    const tok = tok0;
    if (!tok.length) throw new E(`Category "${name}" has no items`, n);
    if (tag0) { tags.add(tag0); explicit.add(tag0); }
    C.push({ name, tag: tag0, tok, n, ordered: mods.includes('ordered') || mods.includes('circular'), circular: mods.includes('circular'), unordered: mods.includes('unordered'), explicit: !!tag0 });
  }
  // Reserve every explicit tag before assigning automatic prefixes.
  for (const c of C) if (!c.tag) {
    const base = c.name.toLowerCase().replace(/[^a-z]/g, '') || 'c';
    let tag = '';
    for (let z = 1; z <= base.length && !tag; z++) {
      const q = base.slice(0, z);
      if (!tags.has(q) && !C.some(x => x !== c && x.name.toLowerCase() === q)) tag = q;
    }
    if (!tag) { let z = 1; while (tags.has(base + z)) z++; tag = base + z; }
    c.tag = tag; tags.add(tag);
  }
  const predefined = x => sets[String(x).toLowerCase()];
  for (const c of C) if (c.tok.length === 1 && predefined(c.tok[0])) { c.tok = predefined(c.tok[0]).slice(); c.predefined = true; c.ordered = !c.unordered; }
  const full = C.filter(c => !c.tok.includes('...') && !c.tok.includes('..'));
  if (!full.length) throw new E('At least one category needs a full item list to set the size', C[0].n);
  const N = full[0].tok.length;
  const bad = full.find(c => c.tok.length !== N);
  if (bad) throw new E(`"${bad.name}" has ${bad.tok.length} items but "${full[0].name}" has ${N}; all categories need the same size`, bad.n);
  if (N > MAXN) throw new E(`Too many items: ${N} per category (maximum ${MAXN})`, full[0].n);
  for (const c of C) {
    const t = c.tok.map(x => x === '..' ? '...' : x), i = t.indexOf('...');
    if (i < 0) {
      c.items = t.every(x => !isNaN(x)) ? t.map(Number) : t;
    } else {
      const vraw = t.filter(x => x !== '...');
      const named = vraw.every(x => /^[A-Za-z]+$/.test(x)) && vraw.length >= 2
        && Object.values(sets).some(a => vraw.every(x => a.some(y => y.toLowerCase() === x.toLowerCase())));
      const letterRange = vraw.length === 2 && /^[A-Za-z]$/.test(vraw[0]) && /^[A-Za-z]$/.test(vraw[1])
        && (vraw[0] === vraw[0].toUpperCase()) === (vraw[1] === vraw[1].toUpperCase());
      const v = vraw.map(Number);
      let a;
      if (named) {
        const set = Object.values(sets).find(a => vraw.every(x => a.some(y => y.toLowerCase() === x.toLowerCase())));
        if (!set) throw new E(`"${c.name}": range endpoints must come from one predefined set`, c.n);
        const ix = x => set.findIndex(y => y.toLowerCase() === x.toLowerCase() || y.slice(0, 3).toLowerCase() === x.toLowerCase());
        let a = [], q = ix(vraw[0]), z = ix(vraw[vraw.length - 1]);
        for (let j = 0; ; j++) { a.push(set[q]); if (q === z || j > MAXN) break; q = (q + 1) % set.length; }
        c.items = a; c.ordered = !c.unordered;
      } else if (letterRange) {
        const start = vraw[0].charCodeAt(0), end = vraw[1].charCodeAt(0), step = start <= end ? 1 : -1;
        c.items = Array.from({ length: Math.abs(end - start) + 1 }, (_, k) => String.fromCharCode(start + k * step));
        if (c.items.length > MAXN) throw new E(`"${c.name}" range expands to ${c.items.length} items (maximum ${MAXN}); choose a narrower end`, c.n);
        a = c.items;
      } else if (v.some(isNaN) || t.indexOf('...') !== t.lastIndexOf('...')) throw new E(`"${c.name}": "..." only works with numbers or named sets, once`, c.n);
      if (named) a = c.items;
      else if (!letterRange && i === 0 && v.length >= 2) { const s = v[v.length - 1] - v[v.length - 2]; a = v.slice(); while (a.length < N) a.unshift(a[0] - s); }
      else if (!letterRange && i === t.length - 1 && v.length >= 2) { const s = v[1] - v[0]; a = v.slice(); while (a.length < N) a.push(a[a.length - 1] + s); }
      else if (!letterRange && t.length === 3 && i === 1) { const s = (v[1] - v[0]) / (N - 1); a = Array.from({ length: N }, (_, k) => v[0] + s * k); }
      else if (!letterRange) throw new E(`"${c.name}": use "a b ...", "... y z" or "a ... z"`, c.n);
      if (a.length !== N) throw new E(`"${c.name}" expands to ${a.length} items, expected ${N}`, c.n);
      c.items = a.map(x => typeof x === 'number' ? Math.round(x * 1e6) / 1e6 : x);
    }
    c.num = c.items.every(x => typeof x === 'number');
    if (!c.num && c.items.some(x => String(x).split('/').some(y => /^-?\d+(?:\.\d+)?$/.test(y)))) throw new E(`Numeric items in "${c.name}" cannot have aliases`, c.n);
    if (new Set(c.items).size !== N) throw new E(`"${c.name}" has duplicate items`, c.n);
    if (!c.num) for (const x of c.items) {
      if (!/^([A-Za-z][A-Za-z0-9_ ]*(?:\/[A-Za-z][A-Za-z0-9_ ]*)*|[a-z])$/.test(x)) throw new E(`Bad item name "${x}" (quote names containing spaces or punctuation)`, c.n);
      if (new Set(c.items.map(y => String(y).toLowerCase())).size !== c.items.length) throw new E(`"${c.name}" has duplicate items`, c.n);
    }
    c.aliases = new Map();
    c.items = c.items.map(x => {
      const parts = String(x).split('/');
      const display = parts.shift(); for (const a of parts) c.aliases.set(a.toLowerCase(), display);
      return c.num ? x : display;
    });
    if (c.predefined) for (const x of c.items) c.aliases.set(x.slice(0, 3).toLowerCase(), x);
  }
  return C;
}

/* ───────── three-valued logic: true / false / null (= not decided yet) ───────── */
const not3 = x => x === null ? null : !x;
const GP = { and: (n, l) => n === l, or: n => n > 0, xor: n => n === 1, nand: (n, l) => n !== l, nor: n => n === 0, xnor: n => n !== 1 };
function fold3(g, v) {
  let t = 0, u = 0;
  for (const x of v) { if (x === true) t++; else if (x === null) u++; }
  const p = GP[g], len = v.length; let any = false, all = true;
  for (let n = t; n <= t + u; n++) { if (p(n, len)) any = true; else all = false; }
  return all ? true : any ? null : false;
}
const imp3 = (a, b) => (a === false || b === true) ? true : (a === true && b === false) ? false : null;
const iff3 = (a, b) => (a === null || b === null) ? null : a === b;
const lone = m => (m & (m - 1)) === 0;                                   // at most one bit set
const pop = m => { let c = 0; while (m) { m &= m - 1; c++; } return c; };
const lowBit = m => 31 - Math.clz32(m & -m);                             // index of the lowest set bit
const highBit = m => 31 - Math.clz32(m);                                 // index of the highest set bit
const rowEq = (ra, rb) => (ra & rb) === 0 ? false : (ra === rb && lone(ra) ? true : null);
const cmpNum = (A, B, op) => {
  let t = false, f = false;
  for (const a of A) for (const b of B) {
    const r = op === '=' ? Math.abs(a - b) < 1e-9 : op === '!=' ? Math.abs(a - b) >= 1e-9 : op === '<' ? a < b : op === '>' ? a > b : op === '<=' ? a <= b + 1e-9 : a >= b - 1e-9;
    if (r) t = true; else f = true;
    if (t && f) return null;
  }
  return t;
};
const comb = (A, B, plus) => { const s = new Set(); for (const a of A) for (const b of B) s.add(Math.round((plus ? a + b : a - b) * 1e6) / 1e6); return [...s]; };

/* ───────── plain-language helpers (used for the tooltips) ───────── */
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const places = n => n === 1 ? 'position' : 'positions';
const REL = { '=': ['goes with', 'equals'], '!=': ['does not go with', 'does not equal'], '<': ['is less than', 'is less than'], '>': ['is more than', 'is more than'] };
const listAnd = xs => xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];
const quant = (g, xs) => {
  const two = xs.length === 2, [a, b] = xs;
  switch (g) {
    case 'and': return two ? `both ${a} and ${b}` : `each of ${xs.join(', ')}`;
    case 'or': return two ? `${a} or ${b} (or both)` : `at least one of ${xs.join(', ')}`;
    case 'xor': return two ? `${a} or ${b}, but not both` : `exactly one of ${xs.join(', ')}`;
    default: return two ? `neither ${a} nor ${b}` : `none of ${xs.join(', ')}`; // nor
  }
};
const GT = { and: 'all of these are true', or: 'at least one of these is true', xor: 'exactly one of these is true', nand: 'not all of these are true', nor: 'none of these is true', xnor: 'either none, or at least two, of these are true' };
const gateText = (g, ss) => `${GT[g]}: ${ss.map((s, i) => `(${i + 1}) ${s}`).join('; ')}`;

/* ───────── CLUES ───────── */
function tokenize(s, ln) {
  const T = [], re = /\s*(<=>|=>|!=|<=|>=|[=<>+\-*\/~(),:{}.]|(?:then|after)\+|\d*\?|"(?:\\.|[^"])*"|[A-Za-z0-9_.'"]+)/yi;
  let m, last = 0;
  while ((m = re.exec(s))) { T.push(m[1].replace(/^"|"$/g, '').replace(/\\"/g, '"')); last = re.lastIndex; }
  if (s.slice(last).trim()) throw new E(`Unexpected character "${s.slice(last).trim()[0]}"`, ln);
  return T;
}

// A compiled clue is { f(D) → true | false | null, say, scope }.
// D holds one bitmask per variable (v = category*N + item): the rows that item may still be in.
// f answers "true"/"false" only when that is certain for every row still allowed, otherwise null.
function compileClue(text, C, ln, defaultUnit = null) {
  const distance = text.match(/^\s*(.+?)\s+(?:apart|~)\s+(.+?)\s*=\s*(\d+(?:\.\d+)?)\s*$/i);
  if (distance) {
    const [, left, right, amount] = distance;
    text = `(${left} = ${right} + ${amount}) or (${left} = ${right} - ${amount})`;
  }
  const within = text.match(/^\s*(.+?)\s+within\s+(\d+(?:\.\d+)?)\s+of\s+(.+?)\s*$/i);
  if (within) {
    const [, left, amount, right] = within;
    text = `(${left} = ${right} + ${amount}) or (${left} = ${right} - ${amount}) or (${left} = ${right})`;
  }
  const countMatch = text.match(/^(exactly|atleast|atmost|(\d+)([+-])?)\s+(\d+)?\s*of\s*\((.*)\)\s*$/i);
  if (countMatch) {
    const mode = countMatch[1].toLowerCase(), n = +(countMatch[2] || countMatch[4] || 0), body = countMatch[5];
    const parts = body.split(/\s*,\s*/).filter(Boolean);
    if (n < 0 || n > parts.length) throw new E(`Count ${n} is outside 0..${parts.length}`, ln);
    const fs = parts.map(x => compileClue(x, C, ln, defaultUnit));
    return { f: D => {
      const vals = fs.map(x => x.f(D)); let t = vals.filter(x => x === true).length, u = vals.filter(x => x === null).length;
      const lo = t, hi = t + u;
      return mode === 'exactly' || /^\d+$/.test(countMatch[1]) ? (n < lo || n > hi ? false : lo === hi ? true : null)
        : mode === 'atleast' || countMatch[3] === '+' ? (hi < n ? false : lo >= n ? true : null)
          : (lo > n ? false : hi <= n ? true : null);
    }, say: `${mode} ${n} of ${parts.length} statements`, scope: [...new Set(fs.flatMap(x => x.scope))] };
  }
  // Long order words are deliberately lowered to the legacy chain evaluator.
  text = text.replace(/\bthen\+/gi, '__THENPLUS__').replace(/\bafter\+/gi, '__AFTERPLUS__')
    .replace(/\bright\s+before\b/gi, 'then').replace(/\bright\s+after\b/gi, '__AFTER__')
    .replace(/\bbefore\b/gi, 'then+').replace(/\bafter\b/gi, 'after+')
    .replace(/__AFTER__/g, 'after').replace(/__THENPLUS__/g, 'then+').replace(/__AFTERPLUS__/g, 'after+');
  const N = C[0].items.length;
  const T = tokenize(text, ln); let p = 0;
  const peek = () => T[p], nx = () => T[p++], lw = () => (T[p] || '').toLowerCase();
  const fail = m => { throw new E(m, ln); };
  const expect = x => { if (nx() !== x) fail(`Expected "${x}"`); };
  const scope = [];
  const addVar = (c, i) => { if (c > 0) scope.push(c * N + i); };
  const addCat = c => { if (c > 0) for (let i = 0; i < N; i++) scope.push(c * N + i); };
  const nums = C.map((c, i) => c.num || c.ordered ? i : -1).filter(i => i >= 0);
  const defNC = h => {
    if (h != null) return h;
    if (defaultUnit != null) return defaultUnit;
    if (nums.length === 1) return nums[0];
    if (!nums.length) fail('No numeric category to do arithmetic on');
    fail(`Which unit? Options: ${nums.map(i => `${C[i].name} [${C[i].tag}]`).join(', ')}. Write e.g. 500${C[nums[0]].tag} or ${C[nums[0]].tag} of X`);
  };

  // numeric value(s) an operand can take, in unit category nc
  const valsFn = (t, nc) => {
    if (t.k !== undefined) { const v = [t.k]; return () => v; }
    if (t.vs) return t.vs;
    addCat(nc);
    const items = C[nc].items, r = t.row;
    return D => { const m = r(D), o = []; for (let x = 0; x < N; x++) if (D[nc * N + x] & m) o.push(C[nc].ordered && !C[nc].num ? x + 1 : items[x]); return o; };
  };
  const vsay = (t, nc) => t.k !== undefined ? t.sv : t.vs ? t.say : `${C[nc].name} of ${t.base || t.say}`;

  const findCat = w => C.findIndex(x => x.tag.toLowerCase() === String(w).toLowerCase() || x.name.toLowerCase() === String(w).toLowerCase());
  const findItem = (c, w) => {
    const q = String(w).toLowerCase();
    let i = C[c].items.findIndex(x => String(x).toLowerCase() === q);
    if (i < 0 && C[c].aliases) {
      const a = C[c].aliases.get(q);
      if (a != null) i = C[c].items.findIndex(x => String(x).toLowerCase() === String(a).toLowerCase());
    }
    return i;
  };
  const itemAny = w => C.some((cc, ci) => !cc.num && findItem(ci, w) >= 0);
  function entity(w) {
    const parts = String(w).split('.');
    if (parts.length > 1) {
      const base = entity(parts.shift()), cat = findCat(parts.join('.'));
      if (cat < 0) fail(`Unknown category "${parts.join('.')}"`);
      return { ...base, nc: C[cat].num || C[cat].ordered ? cat : base.nc, say: `the ${C[cat].name} of ${base.say}` };
    }
    const exact = [], suffix = [];
    C.forEach((cc, ci) => {
      if (cc.num) return;
      const i = findItem(ci, w); if (i >= 0) exact.push([ci, i]);
      if (w.length > cc.tag.length && w.slice(-cc.tag.length) === cc.tag) {
        const j = findItem(ci, w.slice(0, -cc.tag.length)); if (j >= 0) suffix.push([ci, j]);
      }
    });
    const hits = exact.length ? exact : suffix;
    if (hits.length > 1) fail(`Ambiguous "${w}": ${hits.map(([ci, i]) => `${C[ci].items[i]}${C[ci].tag}`).join(', ')}. Use a category suffix (for example ${C[hits[0][0]].items[hits[0][1]]}.${C[hits[0][0]].tag})`);
    if (hits.length === 1) {
        const [c, i] = hits[0]; addVar(c, i);
        return { row: D => D[c * N + i], cat: c, idx: i, nc: C[c].num || C[c].ordered ? c : null, say: `${C[c].name} ${C[c].items[i]}` };
    }
    const cat = findCat(w);
    if (cat >= 0) fail(`"${w}" is a category; use "${C[cat].tag} of X"`);
    fail(`Unknown word "${w}"`);
  }
  function prim() {
    const t = nx();
    if (t == null) fail('Clue ended early');
    if (t === '-') {
      const a = prim();
      if (a.k !== undefined) return { ...a, k: -a.k, say: String(-a.k), sv: String(-a.k) };
      if (a.vs) return { ...a, vs: D => a.vs(D).map(x => -x), say: `minus ${a.say}` };
      fail('Unary minus needs a numeric value');
    }
    if (t === '(') { const a = arith(); expect(')'); return a.vs ? { ...a, say: `(${a.say})` } : a; }
    if (/^-?\d/.test(t)) {
      const m = t.match(/^(-?\d+(?:\.\d+)?)([a-z]+)?$/); if (!m) fail(`Bad number "${t}"`);
      const v = +m[1];
      if (!m[2]) return { k: v, nc: null, say: String(v), sv: String(v) };
      const c = findCat(m[2]);
      if (c < 0 || (!C[c].num && !C[c].ordered)) fail(`"${m[2]}" is not an order-capable tag`);
      const i = C[c].num ? C[c].items.indexOf(v) : v - 1;
      if (i < 0) fail(`${v} is not a value of ${C[c].name} (${C[c].items.join(', ')})`);
      addVar(c, i);
      return { k: v, row: D => D[c * N + i], cat: c, idx: i, nc: c, say: `${C[c].name} ${v}`, sv: String(v) };
    }
    if ((KW.has(t.toLowerCase()) && !itemAny(t)) || SEQ.includes(t.toLowerCase())) fail(`Unexpected "${t}" here. Statements joined by gates need parentheses`);
    if (/^[a-z]$/.test(t)) {
      const c = findCat(t);
      if (c < 0) fail(`Unknown tag "${t}"`);
      if (lw() !== 'of') fail(`Tag "${t}" alone means a category; use "${t} of X"`);
      nx(); const q = prim();
      if (!q.row) fail(`"${t} of" needs an entity after it`);
      const w = { ...q, base: q.base || q.say, say: `the ${C[c].name} of ${q.base || q.say}` };
      if (C[c].num) { // "g of X" = the value of X in category g, so it also fixes the unit
        if (q.nc != null && q.nc !== c) fail(`Mixed units: "${t} of" applied to a ${C[q.nc].name} value`);
        w.nc = c;
      }
      return w;
    }
    return entity(t);
  }
  function arith() {
    const parseMul = () => {
      const ts = [prim()], os = [];
      while (peek() === '*' || peek() === '/') { os.push(nx()); ts.push(prim()); }
      if (!os.length) return ts[0];
      os.forEach((op, i) => { if (op === '/' && ts[i + 1].k !== undefined && ts[i + 1].k === 0) fail('Division by zero'); });
      const u = [...new Set(ts.map(t => t.nc).filter(x => x != null))], nc = defNC(u[0]), fs = ts.map(t => valsFn(t, nc));
      return { nc, vs: D => { let a = fs[0](D); for (let i = 1; i < fs.length; i++) a = [...new Set(a.flatMap(x => fs[i](D).map(y => os[i - 1] === '/' ? (y === 0 ? NaN : x / y) : x * y)).filter(Number.isFinite))]; return a; }, say: ts.map((t, i) => (i ? ` ${os[i - 1]} ` : '') + vsay(t, nc)).join('') };
    };
    const terms = [parseMul()], ops = [];
    while (peek() === '+' || peek() === '-') { ops.push(nx()); terms.push(parseMul()); }
    if (!ops.length) return terms[0];
    const u = [...new Set(terms.map(t => t.nc).filter(x => x != null))];
    if (u.length > 1) fail(`Mixed units in one expression (${u.map(i => C[i].name).join(' and ')})`);
    const nc = defNC(u[0]), g = terms.map(t => valsFn(t, nc));
    const vs = D => { let a = g[0](D); for (let i = 1; i < g.length; i++) a = comb(a, g[i](D), ops[i - 1] === '+'); return a; };
    return { nc, vs, say: terms.map((t, i) => (i ? (ops[i - 1] === '+' ? ' plus ' : ' minus ') : '') + vsay(t, nc)).join('') };
  }
  function vals() {
    const terms = [arith()]; let j = null;
    const more = () => peek() != null && ![')', '=>', '<=>', ...CMP].includes(peek()) && !SEQ.includes(lw());
    while (more()) { // a space between values means "and"
      const g = GATES.includes(lw()) ? nx().toLowerCase() : 'and';
      if (j && g !== j) fail('Mixing different gates needs parentheses');
      j = g; terms.push(arith());
    }
    return { terms, j };
  }
  function cmp1(a, b, op) {
    const numeric = op === '<' || op === '>' || !a.row || !b.row;
    if (!numeric) return { f: op === '=' ? D => rowEq(a.row(D), b.row(D)) : D => not3(rowEq(a.row(D), b.row(D))), sa: a.say, sb: b.say, numeric };
    if (a.nc != null && b.nc != null && a.nc !== b.nc) fail(`Mixed units: ${C[a.nc].name} and ${C[b.nc].name}`);
    const nc = defNC(a.nc ?? b.nc), x = valsFn(a, nc), y = valsFn(b, nc);
    return { f: D => cmpNum(x(D), y(D), op), sa: vsay(a, nc), sb: vsay(b, nc), numeric };
  }
  function comparison() {
    const L = vals(), op = nx();
    if (!CMP.includes(op)) {
      if (SEQ.includes(String(op).toLowerCase())) fail('Gates (and/or/…) cannot be used inside a then/after chain. Put items side by side ("A B then C") or wrap separate chains in parentheses');
      fail('Expected one of = != < >');
    }
    const R = vals();
    if (CMP.includes(peek())) fail('Two comparisons in a row: wrap each statement in parentheses');
    const m = L.terms.length, n = R.terms.length;
    if (m === 1 && n === 1) {
      const c = cmp1(L.terms[0], R.terms[0], op);
      return { f: c.f, say: `${c.sa} ${REL[op][c.numeric ? 1 : 0]} ${c.sb}` };
    }
    if (m > 1 && n > 1) {
      if (op !== '=' || L.j !== 'and' || R.j !== 'and' || m !== n) fail('Two lists compare only as "A and B = C and D" of equal length');
      const fn = L.terms.map(a => R.terms.map(b => cmp1(a, b, '=').f));
      const exists = (v, ok) => { const rec = (i, used) => i === m || v[i].some((x, k) => !(used >> k & 1) && ok(x) && rec(i + 1, used | 1 << k)); return rec(0, 0); };
      return {
        f: D => { const v = fn.map(r => r.map(g => g(D))); return !exists(v, x => x !== false) ? false : exists(v, x => x === true) ? true : null; },
        say: `${listAnd(L.terms.map(t => t.say))} are paired up with ${listAnd(R.terms.map(t => t.say))}, one each, in either order`
      };
    }
    const lst = m > 1, j = lst ? L.j : R.j, one = lst ? R.terms[0] : L.terms[0];
    if (op === '=' && j === 'and') fail('One thing cannot equal two things. Did you mean "or" / "xor"?');
    if (op === '!=' && j !== 'and' && j !== 'or') fail(`"!=" with a list means "none of them", so join with "or" / "and" (e.g. A != B or C); "${j}" is not allowed here`);
    const infos = lst ? L.terms.map(a => cmp1(a, one, op)) : R.terms.map(b => cmp1(one, b, op));
    const g = op === '!=' ? 'and' : j;   // "A != B or C" = A is neither B nor C
    const f = D => fold3(g, infos.map(i => i.f(D)));
    const flip = { '<': '>', '>': '<' }, num = infos.some(i => i.numeric);
    const gq = op === '!=' ? 'nor' : j, rop = op === '!=' ? '=' : lst ? (flip[op] || op) : op;
    const subj = lst ? infos[0].sb : infos[0].sa, its = infos.map(i => lst ? i.sa : i.sb);
    const say = (gq === 'nand' || gq === 'xnor')
      ? cap(gateText(gq, infos.map(i => `${i.sa} ${REL[op][i.numeric ? 1 : 0]} ${i.sb}`)))
      : `${subj} ${REL[rop][num ? 1 : 0]} ${quant(gq, its)}`;
    return { f, say };
  }

  const hasThen = () => { let d = 0; for (let i = p; i < T.length; i++) { const t = T[i].toLowerCase(); if (t === '(') d++; else if (t === ')') { if (--d < 0) return false; } else if (!d) { if (SEQ.includes(t)) return true; if (GATES.includes(t) || t === '=>' || t === '<=>') return false; } } return false; };

  // then / after chains. "A after B" is "B then A"; every chain is turned into then-form.
  // Items written side by side form a group. A group is NOT required to sit in consecutive
  // positions: only its earliest and latest member matter for the "then" links (as in the
  // original solver). "A B then C"  =  C comes right after whichever of A, B is later.
  //
  // Evaluation works on bitmasks of ranks (rank = place in the sorted order of the unit), so
  // no arrays are allocated in the hot path. For every group we keep two masks:
  //   lo = ranks the group's earliest member may have, hi = ranks its latest member may have.
  function seq() {
    const isPh = t => /^\d*\?$/.test(t || '');
    const el = () => {
      if (isPh(peek())) { const t = nx(), k = t === '?' ? 1 : +t.slice(0, -1); if (k < 1) fail('Placeholder count must be at least 1'); return { k }; }
      if (peek() == null) fail('"then" / "after" needs something on both sides');
      const g = [arith()];
      while (peek() != null && !SEQ.includes(lw()) && !GATES.includes(lw()) && ![')', '=>', '<=>', ...CMP].includes(peek())) {
        if (isPh(peek())) fail('Put "then" (or "after") between items and "?" placeholders');
        g.push(arith());
      }
      if (g.length > 4) fail('At most 4 items can sit side by side in one group');
      return { g };
    };
    const els = [el()], lk = [];
    while (SEQ.includes(lw())) { lk.push(nx().toLowerCase()); els.push(el()); }
    if (CMP.includes(peek())) fail('A then/after chain cannot also be compared with = != < >. Put the chain in its own clue or in parentheses');
    if (els.length < 2) fail('"then" / "after" needs something on both sides');
    const dirs = new Set(lk.map(x => x.replace('+', '')));
    if (dirs.size > 1) fail('Do not mix "then" and "after" in one chain. Use one direction, or write separate clues');
    const rev = dirs.has('after');
    const E_ = rev ? els.slice().reverse() : els, L_ = (rev ? lk.slice().reverse() : lk).map(x => x.endsWith('+'));
    const gs = E_.flatMap(e => e.g || []);
    if (!gs.length) fail('A chain needs at least one entity, not only "?" placeholders');
    if (gs.some(t => !t.row)) fail('"then" / "after" works on entities / number+tag values, not arithmetic');
    const us = [...new Set(gs.map(t => t.nc).filter(x => x != null))];
    if (us.length > 1) fail(`Mixed units in one chain (${us.map(i => C[i].name).join(' and ')})`);
    const nc = defNC(us[0]), items = C[nc].items, unit = C[nc].name;
    addCat(nc);
    const base = nc * N;
    const obit = items.map((v, i) => 1 << (C[nc].ordered && !C[nc].num ? i : items.filter(x => x < v).length));   // item index → rank
    const rkFn = t => {
      if (t.k !== undefined) { const r = obit[items.indexOf(t.k)]; return () => r; }
      const rf = t.row;
      return D => { const m = rf(D); let o = 0; for (let x = 0; x < N; x++) if (D[base + x] & m) o |= obit[x]; return o; };
    };
    // fills e.lo / e.hi (see above). Distinctness inside a group is ignored here (sound, and exact once everything is fixed).
    const extent = (e, D) => {
      const f = e.fns, n = f.length;
      if (n === 1) { e.lo = e.hi = f[0](D); return; }
      let u = 0, top = 31, bot = 0;
      for (let i = 0; i < n; i++) {
        const m = f[i](D);
        if (!m) { e.lo = e.hi = 0; return; }
        u |= m;
        const h = highBit(m), l = lowBit(m);
        if (h < top) top = h;
        if (l > bot) bot = l;
      }
      e.lo = u & ((2 << top) - 1);      // earliest member can be v only if every member can still reach v or later
      e.hi = u & ~((1 << bot) - 1);     // latest member can be v only if every member can still be at v or earlier
    };
    const ph = e => e.g.length === 1 ? e.g[0].say : `${listAnd(e.g.map(t => t.say))} (as a group)`;
    const names = e => listAnd(e.g.map(t => t.say));
    const first = e => e.g.length === 1 ? e.g[0].say : `the earliest of ${names(e)}`;
    const last = e => e.g.length === 1 ? e.g[0].say : `the latest of ${names(e)}`;
    const every = e => e.g.length === 1 ? e.g[0].say : `all of ${names(e)}`;
    const R_ = [], cons = [], parts = []; let pg = -1, gap = 0, plus = false, plain = true;
    E_.forEach((e, i) => {
      if (i) plus = plus || L_[i - 1];
      if (e.k) { gap += e.k; plain = false; return; }
      const ei = R_.length, ent = { g: e.g, fns: e.g.map(rkFn), lo: 0, hi: 0 }; R_.push(ent);
      if (e.g.length > 1) plain = false;
      if (pg >= 0) {
        cons.push({ a: pg, e: ei, k: gap, pl: plus });
        const a = R_[pg];
        if (plus) plain = false;
        parts.push(!plus && !gap ? `${first(ent)} comes right after ${last(a)}`
          : !plus ? `${first(ent)} comes after ${last(a)}, with exactly ${gap} other ${places(gap)} in between`
          : !gap ? `${every(ent)} ${ent.g.length === 1 ? 'comes' : 'come'} after ${every(a)}, with any gap allowed`
          : `${first(ent)} comes later than ${last(a)}, with at least ${gap} other ${places(gap)} in between`);
      } else if (gap) { cons.push({ e: ei, lead: gap }); parts.push(`${first(ent)} is not at the start: at least ${gap} ${places(gap)} come before it`); }
      pg = ei; gap = 0; plus = false;
    });
    if (gap) { cons.push({ a: pg, trail: gap }); parts.push(`${last(R_[pg])} is not at the end: at least ${gap} ${places(gap)} come after it`); }
    const say = (plain && R_.length > 1
      ? `Sorted by ${unit} (smallest first), these sit directly one after another: ${R_.map(e => ph(e)).join(', then ')}.`
      : `Sorted by ${unit} (smallest first): ${parts.join('; ')}.`);
    const f = D => {
      for (let i = 0; i < R_.length; i++) extent(R_[i], D);
      let unk = false;
      for (let i = 0; i < cons.length; i++) {
        const c = cons[i]; let r;
        if (c.lead) {
          const L = R_[c.e].lo;
          r = !L ? false : lowBit(L) >= c.lead ? true : highBit(L) >= c.lead ? null : false;
        } else if (c.trail) {
          const H = R_[c.a].hi, lim = N - 1 - c.trail;
          r = !H ? false : highBit(H) <= lim ? true : lowBit(H) <= lim ? null : false;
        } else {
          const A = R_[c.a].hi, B = R_[c.e].lo, s = 1 + c.k;
          if (!A || !B) r = false;
          else if (c.pl) r = lowBit(B) >= highBit(A) + s ? true : highBit(B) >= lowBit(A) + s ? null : false;
          else if (s >= N) r = false;
          else { const sh = A << s; r = (sh & B) === 0 ? false : (sh === B && lone(B)) ? true : null; }
        }
        if (r === false) return false;
        if (r === null) unk = true;
      }
      return unk ? null : true;
    };
    return { f, say: say.replace(/\.$/, '') };
  }
  function stmt() {
    if (lw() === 'not') { nx(); const s = stmt(); return { f: D => not3(s.f(D)), say: `it is not the case that ${s.say}` }; }
    if (hasThen()) return seq();
    if (peek() === '(') {
      const save = p, sl = scope.length; let err;
      try { nx(); const s = top(); expect(')'); if (!CMP.includes(peek())) return s; } catch (e) { err = e; }
      p = save; scope.length = sl;
      try { return comparison(); } catch (e) { throw err || e; }
    }
    return comparison();
  }
  function chain() {
    const fs = [stmt()]; let g = null;
    while (GATES.includes(lw())) { const x = nx().toLowerCase(); if (g && x !== g) fail('Mixing different gates needs parentheses'); g = x; fs.push(stmt()); }
    return g ? { f: D => fold3(g, fs.map(s => s.f(D))), say: gateText(g, fs.map(s => s.say)) } : fs[0];
  }
  function top() {
    const a = chain();
    if (peek() === '=>' || peek() === '<=>') {
      const o = nx(), b = chain();
      return o === '=>' ? { f: D => imp3(a.f(D), b.f(D)), say: `if ${a.say}, then ${b.say}` }
        : { f: D => iff3(a.f(D), b.f(D)), say: `${a.say} holds exactly when ${b.say} holds` };
    }
    return a;
  }
  const s = top();
  if (p < T.length) fail(`Unexpected "${T[p]}"`);
  return { f: s.f, say: cap(s.say) + '.', scope: [...new Set(scope)] };
}

/* ───────── SOLVER ─────────
   No enumeration of all grids. Every item has a set of rows it may still be in ("domain").
   Each clue is re-checked whenever a domain it depends on changes; a row is removed when
   putting the item there would break the clue. Counting then searches only the items that
   unresolved clues still depend on, and multiplies in the free remainder as a permanent. */
const CFG = { cnt: 20000, first: 3000, ms: 700, est: 200, sup: 500, pair: 1200, guard: 8000 };
const OVER = { over: true };

function makeSolver(C, cl, lm) {
  const N = C[0].items.length, k = C.length, V = k * N, FULL = (1 << N) - 1, m = cl.length;
  const byVar = Array.from({ length: V }, () => []);
  cl.forEach((c, i) => c.scope.forEach(v => byVar[v].push(i)));
  const fact = [1]; for (let i = 1; i <= N; i++) fact[i] = fact[i - 1] * i;
  const total = Math.pow(fact[N], k - 1);
  let J = 0;                                                  // clues 0..J-1 are active
  const qc = [], inq = new Uint8Array(m), dc = new Uint8Array(k);
  const touch = v => { dc[(v / N) | 0] = 1; for (const i of byVar[v]) if (i < J && !inq[i]) { inq[i] = 1; qc.push(i); } };
  const clearQ = () => { for (const i of qc) inq[i] = 0; qc.length = 0; dc.fill(0); };
  const setD = (D, v, nm) => { if (nm === D[v]) return true; if (!nm) return false; D[v] = nm; touch(v); return true; };

  function alldiff(D, c) {
    const b = c * N;
    for (let ch = 1; ch;) {
      ch = 0;
      for (let i = 0; i < N; i++) {
        const d = D[b + i];
        if (!d) return false;
        if (lone(d)) for (let q = 0; q < N; q++) if (q !== i && (D[b + q] & d)) { if (!setD(D, b + q, D[b + q] & ~d)) return false; ch = 1; }
      }
      for (let r = 0; r < N; r++) {
        let cnt = 0, who = -1;
        for (let i = 0; i < N; i++) if (D[b + i] >> r & 1) { cnt++; who = i; }
        if (!cnt) return false;
        if (cnt === 1 && D[b + who] !== 1 << r) { D[b + who] = 1 << r; touch(b + who); ch = 1; }
      }
    }
    return true;
  }
  function revise(D, i) {
    const c = cl[i], r = c.f(D);
    if (r === false) return false;
    if (r === true) return true;
    const sc = c.scope;
    for (let s = 0; s < sc.length; s++) {
      const v = sc[s], d = D[v]; if (lone(d)) continue;
      let keep = d;
      for (let rest = d; rest; rest &= rest - 1) {
        const bit = rest & -rest;
        D[v] = bit;
        if (c.f(D) === false) keep &= ~bit;
      }
      D[v] = d;
      if (keep !== d) { if (!keep) return false; D[v] = keep; touch(v); }
    }
    return true;
  }
  function propagate(D) {
    for (;;) {
      const c = dc.indexOf(1);
      if (c >= 0) { dc[c] = 0; if (!alldiff(D, c)) { clearQ(); return false; } continue; }
      if (!qc.length) return true;
      const i = qc.pop(); inq[i] = 0;
      if (!revise(D, i)) { clearQ(); return false; }
    }
  }

  // number of ways to fill category c within its domains (permanent of the domain matrix)
  const dp = new Float64Array(1 << N);
  function perm(D, c) {
    const b = c * N; let used = 0;
    for (let i = 0; i < N; i++) if (lone(D[b + i])) used |= D[b + i];
    const rest = FULL & ~used; let n = 0, uni = true;
    for (let i = 0; i < N; i++) { const d = D[b + i]; if (!lone(d)) { n++; if (d !== rest) uni = false; } }
    if (uni && n === pop(rest)) return fact[n];
    dp.fill(0); dp[0] = 1;
    for (let mask = 0; mask < 1 << N; mask++) {
      const v = dp[mask]; if (!v) continue;
      const i = pop(mask); if (i >= N) continue;
      let cand = D[b + i] & ~mask;
      while (cand) { const bit = cand & -cand; dp[mask | bit] += v; cand ^= bit; }
    }
    return dp[FULL];
  }
  function matchAll(D, c, lim) {
    const b = c * N, out = [], cur = new Array(N);
    const go = (i, used) => {
      if (i === N) { out.push(cur.slice()); return out.length >= lim; }
      let cand = D[b + i] & ~used;
      while (cand) { const bit = cand & -cand; cand ^= bit; cur[i] = 31 - Math.clz32(bit); if (go(i + 1, used | bit)) return true; }
      return false;
    };
    go(0, 0); return out;
  }
  const flat = pick => { const r = new Int32Array(V); for (let i = 0; i < N; i++) r[i] = i; pick.forEach((rows, c) => rows.forEach((x, i) => { r[(c + 1) * N + i] = x; })); return r; };
  const toSol = rows => {
    const pos = [], inv = [];
    for (let c = 0; c < k; c++) { const p = [], q = []; for (let i = 0; i < N; i++) { p[i] = rows[c * N + i]; q[p[i]] = i; } pos.push(p); inv.push(q); }
    return { pos, inv };
  };

  // branching variable: the smallest open domain among clues that are not yet certainly true.
  // -1 = every clue is already true, -2 = open clues but nothing left to branch on
  function choose(D) {
    let best = -1, bs = 99, open = false;
    for (let i = 0; i < J; i++) {
      const c = cl[i];
      if (c.f(D) === true) continue;
      open = true;
      const sc = c.scope;
      for (let s = 0; s < sc.length; s++) { const v = sc[s], d = D[v]; if (!lone(d)) { const z = pop(d); if (z < bs) { bs = z; best = v; } } }
    }
    if (!open) return -1;
    if (best < 0) { for (let v = N; v < V; v++) if (!lone(D[v])) return v; return -2; }
    return best;
  }

  // search (mode 0 = count, 1 = first solution, 2 = list all)
  let nodes = 0, nodeMax = 0, deadline = 0, acc = 0, found = null, out = null, outMax = 0, mode = 0;
  const tick = () => { if (++nodes > nodeMax || ((nodes & 255) === 0 && Date.now() > deadline)) throw OVER; };
  function leaf(D) {
    if (mode === 0) { let f = 1; for (let c = 1; c < k && f; c++) f *= perm(D, c); acc += f; return false; }
    const per = [];
    for (let c = 1; c < k; c++) { const ml = matchAll(D, c, mode === 1 ? 1 : Infinity); if (!ml.length) return false; per.push(ml); }
    if (mode === 1) { found = flat(per.map(x => x[0])); return true; }
    const pick = [], cross = c => {
      if (c === per.length) { if (out.length >= outMax) throw OVER; out.push(toSol(flat(pick))); return; }
      for (const r of per[c]) { pick[c] = r; cross(c + 1); }
    };
    cross(0); return false;
  }
  function rec(D) {
    tick();
    const best = choose(D);
    if (best === -1) return leaf(D);
    if (best === -2) return false;
    const d = D[best];
    for (let rest = d; rest; rest &= rest - 1) {
      const bit = rest & -rest;
      const ch = D.slice(); ch[best] = bit; touch(best);
      if (propagate(ch) && rec(ch)) return true;
    }
    return false;
  }
  const first = D => {
    mode = 1; found = null; nodes = 0; nodeMax = CFG.first; deadline = Date.now() + 400;
    try { rec(D); } catch (e) { if (e !== OVER) throw e; clearQ(); return undefined; }
    return found;                                              // rows | null (none) | undefined (gave up)
  };

  // which items can share a row with which: M[a][b][x] = bitmask of items y of b that can be with item x of a.
  // base = only against category 0 (enough for "certain" facts)
  function supports(D, base, ms) {
    const M = Array.from({ length: k }, () => Array.from({ length: k }, () => new Array(N).fill(0)));
    const dl = Date.now() + ms, rowOf = (rows, c, i) => c ? rows[c * N + i] : i;
    const set = (a, x, b, y) => { M[a][b][x] |= 1 << y; M[b][a][y] |= 1 << x; };
    const mark = rows => {
      for (let a = 0; a < (base ? 1 : k); a++) for (let x = 0; x < N; x++) {
        const ra = rowOf(rows, a, x);
        for (let b = a + 1; b < k; b++) for (let y = 0; y < N; y++) if (rows[b * N + y] === ra) set(a, x, b, y);
      }
    };
    const s0 = first(D);
    if (s0) mark(s0);
    else if (s0 === null) return M;                           // no solution at all
    for (let a = 0; a < (base ? 1 : k - 1); a++) for (let x = 0; x < N; x++) for (let b = a + 1; b < k; b++) for (let y = 0; y < N; y++) {
      if (M[a][b][x] >> y & 1) continue;
      const inter = (a ? D[a * N + x] : 1 << x) & D[b * N + y];
      for (let r = 0; r < N && !(M[a][b][x] >> y & 1); r++) {
        const bit = 1 << r; if (!(inter & bit)) continue;
        if (Date.now() > dl) { set(a, x, b, y); break; }        // out of time: keep it as "possible"
        const ch = D.slice(); if (a) { ch[a * N + x] = bit; touch(a * N + x); } ch[b * N + y] = bit; touch(b * N + y);
        if (!propagate(ch)) continue;
        const s = first(ch);
        if (s) mark(s); else if (s === undefined) set(a, x, b, y);
      }
    }
    return M;
  }

  // Knuth-style random probes through the search tree: an unbiased estimate of the count when exact counting is too big
  const ri_ = n => Math.floor(Math.random() * n);
  function estimate(D0, ms) {
    const end = Date.now() + ms; let sum = 0, n = 0;
    while (n < 20 || (n < 4000 && Date.now() < end)) {
      let D = D0, w = 1; n++;
      for (;;) {
        const best = choose(D);
        if (best === -1) { let f = 1; for (let c = 1; c < k && f; c++) f *= perm(D, c); sum += w * f; break; }
        if (best === -2) break;
        const kids = [];
        for (let rest = D[best]; rest; rest &= rest - 1) {
          const bit = rest & -rest;
          const ch = D.slice(); ch[best] = bit; touch(best);
          if (propagate(ch)) kids.push(ch);
        }
        if (!kids.length) break;
        w *= kids.length; D = kids[ri_(kids.length)];
      }
    }
    return sum / n;
  }

  // root domains after clues 1..j (each step builds on the previous one)
  const roots = [];
  { const D = new Int32Array(V); for (let c = 0; c < k; c++) for (let i = 0; i < N; i++) D[c * N + i] = c ? FULL : 1 << i; roots[0] = D; }
  function rootFor(j) {
    if (j in roots) return roots[j];
    const prev = rootFor(j - 1);
    if (prev === null) return roots[j] = null;
    const D = prev.slice(); J = j; clearQ();
    inq[j - 1] = 1; qc.push(j - 1);
    return roots[j] = propagate(D) ? D : null;
  }

  const steps = [], t0 = Date.now();
  return {
    total,
    estimate(j, ms) { const D = rootFor(j); J = j; return estimate(D, ms); },
    step(j) {
      if (steps[j]) return steps[j];
      const D = rootFor(j); J = j;
      if (!D) return steps[j] = { count: 0, kind: 0, certain: new Map(), sols: null };
      const late = Date.now() - t0 > CFG.guard, sc = late ? 0.2 : 1;   // after the guard time, steps get a fifth of the budget
      mode = 0; acc = 0; nodes = 0; nodeMax = CFG.cnt * sc; deadline = Date.now() + CFG.ms * sc;
      let kind = 0;
      try { rec(D.slice()); } catch (e) { if (e !== OVER) throw e; kind = 2; clearQ(); }
      if (kind === 2) { J = j; const e = estimate(D, CFG.est * sc); if (e > acc) acc = e; kind = 3; }   // too big to count exactly → estimate
      if (kind === 0 && acc > 2 ** 53) kind = 1;                // beyond exact double precision
      let sols = null, certain = new Map();
      if (kind === 0 && acc > 0 && acc <= lm) {
        mode = 2; out = []; outMax = lm; nodes = 0; nodeMax = 1e6; deadline = Date.now() + CFG.ms;
        try { rec(D.slice()); sols = out; } catch (e) { if (e !== OVER) throw e; clearQ(); }
      }
      if (sols) {
        for (let c = 1; c < k; c++) for (let i = 0; i < N; i++) { const r = sols[0].pos[c][i]; if (sols.every(s => s.pos[c][i] === r)) certain.set(c + '.' + i, r); }
      } else if (kind !== 0 || acc > 0) {
        const M = supports(D, true, CFG.sup * sc);
        for (let b = 1; b < k; b++) for (let y = 0; y < N; y++) {
          let mk = 0; for (let x = 0; x < N; x++) if (M[0][b][x] >> y & 1) mk |= 1 << x;
          if (mk && lone(mk)) certain.set(b + '.' + y, 31 - Math.clz32(mk));
        }
      }
      return steps[j] = { count: acc, kind, certain, sols };
    },
    // cand(a, x, b): items of category b that can still share a row with item x of category a
    pairs(j) {
      const D = rootFor(j); if (!D) return null; J = j;
      const M = supports(D, false, CFG.pair);
      return (a, x, b) => { const o = []; for (let y = 0; y < N; y++) if (M[a][b][x] >> y & 1) o.push(y); return o; };
    }
  };
}


  window.GSGrid = { parseSetup, compileClue, makeSolver };
})();
