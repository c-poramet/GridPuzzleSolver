'use strict';
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const KW = new Set('setup start solve threshold listmax proceed of and or xor not nand nor xnor then'.split(' '));
const GATES = ['and', 'or', 'xor', 'nand', 'nor', 'xnor'];
const CMP = ['=', '!=', '<', '>'];
class E extends Error { constructor(m, l) { super(m); this.line = l; } }

const fold = (g, b) => {
  const n = b.filter(Boolean).length;
  return g === 'and' ? n === b.length : g === 'or' ? n > 0 : g === 'xor' ? n === 1 :
    g === 'nand' ? n !== b.length : g === 'nor' ? n === 0 : n !== 1;
};

/* ───────── SETUP ───────── */
function parseSetup(L) {
  const C = [], tags = new Set();
  for (const { t, n } of L) {
    const m = t.match(/^(\S+)\s*\[([^\]]*)\]\s*(.*)$/);
    if (!m) throw new E('Expected: name [tag] items…', n);
    const [, name, tag, rest] = m;
    if (!/^[a-z]$/.test(tag)) throw new E(`Tag [${tag}] must be exactly one lowercase letter`, n);
    if (tags.has(tag)) throw new E(`Tag [${tag}] is already used`, n);
    if (KW.has(name.toLowerCase())) throw new E(`"${name}" is a reserved word`, n);
    tags.add(tag);
    const tok = rest.split(/\s+/).filter(Boolean);
    if (!tok.length) throw new E(`Category "${name}" has no items`, n);
    C.push({ name, tag, tok, n });
  }
  const full = C.filter(c => !c.tok.includes('...'));
  if (!full.length) throw new E('At least one category needs a full item list to set the size', C[0].n);
  const N = full[0].tok.length;
  const bad = full.find(c => c.tok.length !== N);
  if (bad) throw new E(`"${bad.name}" has ${bad.tok.length} items but "${full[0].name}" has ${N}; all categories need the same size`, bad.n);
  for (const c of C) {
    const t = c.tok, i = t.indexOf('...');
    if (i < 0) {
      c.items = t.every(x => !isNaN(x)) ? t.map(Number) : t;
    } else {
      const v = t.filter(x => x !== '...').map(Number);
      if (v.some(isNaN) || t.indexOf('...') !== t.lastIndexOf('...')) throw new E(`"${c.name}": "..." only works with numbers, once`, c.n);
      let a;
      if (i === 0 && v.length >= 2) { const s = v[v.length - 1] - v[v.length - 2]; a = v.slice(); while (a.length < N) a.unshift(a[0] - s); }
      else if (i === t.length - 1 && v.length >= 2) { const s = v[1] - v[0]; a = v.slice(); while (a.length < N) a.push(a[a.length - 1] + s); }
      else if (t.length === 3 && i === 1) { const s = (v[1] - v[0]) / (N - 1); a = Array.from({ length: N }, (_, k) => v[0] + s * k); }
      else throw new E(`"${c.name}": use "a b ...", "... y z" or "a ... z"`, c.n);
      if (a.length !== N) throw new E(`"${c.name}" expands to ${a.length} items, expected ${N}`, c.n);
      c.items = a.map(x => Math.round(x * 1e6) / 1e6);
    }
    c.num = c.items.every(x => typeof x === 'number');
    if (new Set(c.items).size !== N) throw new E(`"${c.name}" has duplicate items`, c.n);
    if (!c.num) for (const x of c.items) {
      if (!/^[A-Za-z0-9_]+$/.test(x) || /^[a-z]$/.test(x)) throw new E(`Bad item name "${x}" (letters/digits only, not a single lowercase letter)`, c.n);
      if (KW.has(x.toLowerCase())) throw new E(`"${x}" is a reserved word`, c.n);
    }
  }
  return C;
}

/* ───────── CLUES ───────── */
function tokenize(s, ln) {
  const T = [], re = /\s*(<=>|=>|!=|[=<>+\-()]|[tT][hH][eE][nN]\+|\d*\?|[A-Za-z0-9_.]+)/y;
  let m, last = 0;
  while ((m = re.exec(s))) { T.push(m[1]); last = re.lastIndex; }
  if (s.slice(last).trim()) throw new E(`Unexpected character "${s.slice(last).trim()[0]}"`, ln);
  return T;
}

function compileClue(text, C, ln) {
  const T = tokenize(text, ln); let p = 0;
  const peek = () => T[p], nx = () => T[p++], lw = () => (T[p] || '').toLowerCase();
  const fail = m => { throw new E(m, ln); };
  const expect = x => { if (nx() !== x) fail(`Expected "${x}"`); };
  const nums = C.map((c, i) => c.num ? i : -1).filter(i => i >= 0);
  const defNC = h => {
    if (h != null) return h;
    if (nums.length === 1) return nums[0];
    if (!nums.length) fail('No numeric category to do arithmetic on');
    fail(`Which unit? Options: ${nums.map(i => `${C[i].name} [${C[i].tag}]`).join(', ')}. Write e.g. 500${C[nums[0]].tag}`);
  };
  const val = (t, nc) => t.num || (S => C[nc].items[S.inv[nc][t.row(S)]]);

  function entity(w) {
    const tag = w.slice(-1), name = w.slice(0, -1), c = C.findIndex(x => x.tag === tag);
    if (c >= 0 && !C[c].num) { const i = C[c].items.indexOf(name); if (i >= 0) return { row: S => S.pos[c][i] }; }
    const hit = C.find(x => !x.num && x.items.includes(w));
    if (hit) fail(`"${w}" is missing its tag. Did you mean "${w}${hit.tag}"?`);
    if (c < 0) fail(`Unknown word "${w}" (tag "${tag}" is not declared)`);
    fail(`"${name}" is not an item of ${C[c].name} [${tag}]. Options: ${C[c].items.join(', ')}`);
  }
  function prim() {
    const t = nx();
    if (t == null) fail('Clue ended early');
    if (t === '(') { const a = arith(); expect(')'); return a; }
    if (/^\d/.test(t)) {
      const m = t.match(/^(\d+(?:\.\d+)?)([a-z])?$/); if (!m) fail(`Bad number "${t}"`);
      const v = +m[1];
      if (!m[2]) return { num: () => v, nc: null };
      const c = C.findIndex(x => x.tag === m[2]);
      if (c < 0 || !C[c].num) fail(`"${m[2]}" is not a numeric tag`);
      const i = C[c].items.indexOf(v);
      if (i < 0) fail(`${v} is not a value of ${C[c].name} (${C[c].items.join(', ')})`);
      return { row: S => S.pos[c][i], num: () => v, nc: c };
    }
    if (KW.has(t.toLowerCase())) fail(`Unexpected "${t}" here. Statements joined by gates need parentheses`);
    if (/^[a-z]$/.test(t)) {
      if (!C.some(x => x.tag === t)) fail(`Unknown tag "${t}"`);
      if (lw() !== 'of') fail(`Tag "${t}" alone means a category; use "${t} of X"`);
      nx(); const q = prim();
      if (!q.row) fail(`"${t} of" needs an entity after it`);
      return q;
    }
    return entity(t);
  }
  function arith() {
    const terms = [prim()], ops = [];
    while (peek() === '+' || peek() === '-') { ops.push(nx()); terms.push(prim()); }
    if (!ops.length) return terms[0];
    const u = [...new Set(terms.map(t => t.nc).filter(x => x != null))];
    if (u.length > 1) fail('Mixed units in one expression');
    const nc = defNC(u[0]), g = terms.map(t => val(t, nc));
    return { nc, num: S => g.reduce((a, f, i) => i ? (ops[i - 1] === '+' ? a + f(S) : a - f(S)) : f(S), 0) };
  }
  function vals() {
    const terms = [arith()]; let j = null;
    const more = () => peek() != null && ![')', '=>', '<=>', ...CMP].includes(peek()) && lw() !== 'then' && lw() !== 'then+';
    while (more()) { // a space between values means "and"
      const g = GATES.includes(lw()) ? nx().toLowerCase() : 'and';
      if (j && g !== j) fail('Mixing different gates needs parentheses');
      j = g; terms.push(arith());
    }
    return { terms, j };
  }
  function cmp1(a, b, op) {
    const numeric = op === '<' || op === '>' || !a.row || !b.row;
    if (!numeric) return op === '=' ? S => a.row(S) === b.row(S) : S => a.row(S) !== b.row(S);
    const nc = defNC(a.nc ?? b.nc), x = val(a, nc), y = val(b, nc);
    return { '=': S => Math.abs(x(S) - y(S)) < 1e-9, '!=': S => Math.abs(x(S) - y(S)) >= 1e-9, '<': S => x(S) < y(S), '>': S => x(S) > y(S) }[op];
  }
  function comparison() {
    const L = vals(), op = nx();
    if (!CMP.includes(op)) fail('Expected one of = != < >');
    const R = vals();
    if (CMP.includes(peek())) fail('Two comparisons in a row: wrap each statement in parentheses');
    const [m, n] = [L.terms.length, R.terms.length];
    if (m === 1 && n === 1) return cmp1(L.terms[0], R.terms[0], op);
    if (m > 1 && n > 1) {
      if (op !== '=' || L.j !== 'and' || R.j !== 'and' || m !== n) fail('Two lists compare only as "A and B = C and D" of equal length');
      const f = L.terms.map(a => R.terms.map(b => cmp1(a, b, '=')));
      const pair = (S, i, used) => i === m || f[i].some((g, k) => !(used >> k & 1) && g(S) && pair(S, i + 1, used | 1 << k));
      return S => pair(S, 0, 0);
    }
    const j = m > 1 ? L.j : R.j;
    if (j === 'and') fail('One thing cannot equal two things. Did you mean "or" / "xor"?');
    const fs = m > 1 ? L.terms.map(a => cmp1(a, R.terms[0], op)) : R.terms.map(b => cmp1(L.terms[0], b, op));
    return S => fold(j, fs.map(f => f(S)));
  }
  const hasThen = () => { let d = 0; for (let i = p; i < T.length; i++) { const t = T[i].toLowerCase(); if (t === '(') d++; else if (t === ')') { if (--d < 0) return false; } else if (!d) { if (t === 'then' || t === 'then+') return true; if (GATES.includes(t) || t === '=>' || t === '<=>') return false; } } return false; };
  function seq() {
    const el = () => {
      if (/^\d*\?$/.test(peek())) { const t = nx(), k = t === '?' ? 1 : +t.slice(0, -1); if (k < 1) fail('Placeholder count must be at least 1'); return { k }; }
      const g = [arith()];
      while (peek() != null && lw() !== 'then' && lw() !== 'then+' && !GATES.includes(lw()) && ![')', '=>', '<=>', ...CMP].includes(peek())) g.push(arith());
      return { g };
    };
    const E_ = [el()], links = [];
    while (lw() === 'then' || lw() === 'then+') { links.push(nx().toLowerCase() === 'then+'); E_.push(el()); }
    if (E_.length < 2) fail('"then" needs something on both sides');
    const gs = E_.flatMap(e => e.g || []);
    if (gs.some(t => !t.row)) fail('"then" works on entities / number+tag values, not arithmetic');
    const nc = defNC(gs.map(t => t.nc).find(x => x != null)), N = C[0].items.length;
    const ord = C[nc].items.map(v => C[nc].items.filter(x => x < v).length);
    const rk = (t, S) => ord[S.inv[nc][t.row(S)]];
    const st = (e, S) => Math.min(...e.g.map(t => rk(t, S))), en = (e, S) => Math.max(...e.g.map(t => rk(t, S)));
    const cons = []; let pg = null, gap = 0, plus = false;
    E_.forEach((e, i) => {
      if (i) plus = plus || links[i - 1];
      if (e.k) { gap += e.k; return; }
      const a = pg, k = gap, pl = plus;
      if (a) cons.push(pl ? S => st(e, S) >= en(a, S) + 1 + k : S => st(e, S) === en(a, S) + 1 + k); else if (k) cons.push(S => st(e, S) >= k);
      pg = e; gap = 0; plus = false;
    });
    if (gap) { const a = pg, k = gap; cons.push(S => en(a, S) <= N - 1 - k); }
    return S => cons.every(f => f(S));
  }
  function stmt() {
    if (lw() === 'not') { nx(); const f = stmt(); return S => !f(S); }
    if (hasThen()) return seq();
    if (peek() === '(') {
      const save = p; let err;
      try { nx(); const f = top(); expect(')'); if (!CMP.includes(peek())) return f; } catch (e) { err = e; }
      p = save;
      try { return comparison(); } catch (e) { throw err || e; }
    }
    return comparison();
  }
  function chain() {
    const fs = [stmt()]; let g = null;
    while (GATES.includes(lw())) { const x = nx().toLowerCase(); if (g && x !== g) fail('Mixing different gates needs parentheses'); g = x; fs.push(stmt()); }
    return g ? S => fold(g, fs.map(f => f(S))) : fs[0];
  }
  function top() {
    const a = chain();
    if (peek() === '=>' || peek() === '<=>') { const o = nx(), b = chain(); return o === '=>' ? S => !a(S) || b(S) : S => a(S) === b(S); }
    return a;
  }
  const f = top();
  if (p < T.length) fail(`Unexpected "${T[p]}"`);
  return f;
}

/* ───────── SOLVER ───────── */
const permute = n => { const o = [], r = (a, u) => { if (a.length === n) return o.push(a); for (let i = 0; i < n; i++) if (!u[i]) { u[i] = 1; r([...a, i], u); u[i] = 0; } }; r([], []); return o; };
const invert = p => { const q = []; p.forEach((r, i) => q[r] = i); return q; };

function solve(C, clues, lm) {
  const N = C[0].items.length, k = C.length, m = clues.length, perms = permute(N), invs = perms.map(invert);
  const total = Math.pow(perms.length, k - 1);
  if (total > 4e6) throw new E(`Too large: ${total.toLocaleString()} combinations (limit 4,000,000)`);
  const id = [...Array(N).keys()], S = { pos: [id], inv: [id] };
  const walk = leaf => { const r = c => { if (c === k) return leaf(); for (let q = 0; q < perms.length; q++) { S.pos[c] = perms[q]; S.inv[c] = invs[q]; r(c + 1); } }; r(1); };
  const prefix = () => { let p = 0; while (p < m && clues[p](S)) p++; return p; };
  const cnt = Array(m + 1).fill(0), hit = Array.from({ length: m + 1 }, () => C.map(() => Array.from({ length: N }, () => Array(N).fill(0))));
  walk(() => { const p = prefix(); cnt[p]++; for (let c = 1; c < k; c++) for (let i = 0; i < N; i++) hit[p][c][i][S.pos[c][i]]++; });
  const left = Array(m + 2).fill(0), certain = [], acc = C.map(() => Array.from({ length: N }, () => Array(N).fill(0)));
  for (let j = m; j >= 0; j--) {
    left[j] = left[j + 1] + cnt[j];
    const cm = new Map();
    for (let c = 1; c < k; c++) for (let i = 0; i < N; i++) for (let r = 0; r < N; r++) {
      acc[c][i][r] += hit[j][c][i][r];
      if (left[j] > 0 && acc[c][i][r] === left[j]) cm.set(c + '.' + i, r);
    }
    certain[j] = cm;
  }
  const jmin = [...Array(m).keys()].map(x => x + 1).find(j => left[j] <= lm), leaves = [];
  if (jmin) walk(() => { const p = prefix(); if (p >= jmin) leaves.push({ p, pos: S.pos.map(x => x.slice()), inv: S.inv.map(x => x.slice()) }); });
  return { left, certain, leaves, jmin, total };
}

/* ───────── UI ───────── */
const EX = `SETUP
genes [g] 250 500 ...
bacteria [b] B D E L
doctor [d] I O L W

START
1000g and 500g = Lb and Wd
Bb - 500 = Db
b of Id - 250g = b of Od
Wd = 1000g or Eb

THRESHOLD = 1
SOLVE`;

const DEF_THR = 1, DEF_LM = 10;
const setTags = (t, l) => { $('tagThr').textContent = 'THRESHOLD ' + t; $('tagList').textContent = 'LISTMAX ' + l; };

/* ───────── answer table ───────── */
// ord.o = category indexes; o[0] is the row category, the rest are columns in display order.
const ORD_KEY = 'gridsolver.order';
const FALLBACK_COLORS = ['#6ca965', '#6fa3d0', '#a58bc4', '#d27d8f', '#4fb3b3', '#b8a78a'];
const catColor = i => { const p = window.GSEditor?.PALETTE || FALLBACK_COLORS; return p[i % p.length]; };
let ans = null, ord = null;

const sigOf = C => C.map(c => c.name + '[' + c.tag + ']').join('|');
const saveOrd = () => { try { localStorage.setItem(ORD_KEY, JSON.stringify(ord)); } catch (e) {} };
function initOrder(C) {
  const sig = sigOf(C), idx = C.map((_, i) => i);
  if (ord && ord.sig === sig) return;
  let o = idx;
  try {
    const s = JSON.parse(localStorage.getItem(ORD_KEY));
    if (s && s.sig === sig && Array.isArray(s.o) && s.o.length === idx.length && [...s.o].sort((a, b) => a - b).join() === idx.join()) o = s.o;
  } catch (e) {}
  ord = { sig, o: o.slice() };
}

// cand(a, x, b): which items of category b can share a row with item x of category a
function makeCand(C, certain, leaves) {
  const N = C[0].items.length;
  if (leaves) return (a, x, b) => { const s = new Set(); for (const L of leaves) s.add(L.inv[b][L.pos[a][x]]); return [...s].sort((p, q) => p - q); };
  return (a, x, b) => {
    const r = a === 0 ? x : certain.get(a + '.' + x);
    if (r === undefined) return [];
    if (b === 0) return [r];
    for (let i = 0; i < N; i++) if (certain.get(b + '.' + i) === r) return [i];
    return [];
  };
}

function renderAnswer(focusK) {
  const box = $('answer');
  if (!box || !ans || !ord) return;
  const { C, cand, count } = ans, N = C[0].items.length, rc = ord.o[0], cols = ord.o.slice(1);
  const sty = c => `--c:${catColor(c)}`;
  const rowIdx = [...Array(N).keys()];
  if (C[rc].num) rowIdx.sort((a, b) => C[rc].items[a] - C[rc].items[b]);
  let unsure = false;
  const cell = (x, k) => {
    const v = cand(rc, x, k);
    if (!v.length) { unsure = true; return '<td class="cell-unk">?</td>'; }
    if (v.length === 1) return `<td style="${sty(k)}"><span class="cell-v">${esc(C[k].items[v[0]])}</span></td>`;
    unsure = true;
    const more = v.length > 3 ? `<span class="cell-more">+${v.length - 3}</span>` : '';
    return `<td class="cell-amb" style="${sty(k)}">${v.slice(0, 3).map(i => `<span class="cell-v">${esc(C[k].items[i])}</span>`).join('')}${more}</td>`;
  };
  const body = rowIdx.map(x => `<tr><th scope="row" style="${sty(rc)}"><span class="cell-v">${esc(C[rc].items[x])}</span></th>${cols.map(k => cell(x, k)).join('')}</tr>`).join('');
  const head = `<th class="rowhead" style="${sty(rc)}" title="${esc(C[rc].name)} is the row category"><span class="ch-in"><span class="ch-name">${esc(C[rc].name)}</span><span class="ch-tag">[${C[rc].tag}]</span></span></th>` +
    cols.map((k, p) => `<th class="colhead" draggable="true" tabindex="0" role="button" data-k="${k}" style="${sty(k)}" title="Click: use ${esc(C[k].name)} as the rows · drag to reorder (Alt+←/→)"><span class="ch-in">` +
      `<button type="button" class="ch-mv" data-d="-1" aria-label="Move ${esc(C[k].name)} left"${p === 0 ? ' disabled' : ''}>‹</button>` +
      `<span class="ch-name">${esc(C[k].name)}</span><span class="ch-tag">[${C[k].tag}]</span>` +
      `<button type="button" class="ch-mv" data-d="1" aria-label="Move ${esc(C[k].name)} right"${p === cols.length - 1 ? ' disabled' : ''}>›</button></span></th>`).join('');
  box.hidden = false;
  box.innerHTML = `<div class="answer-head"><span class="answer-title${count === 1 ? '' : ' part'}">${count === 1 ? 'Solution' : `${count.toLocaleString()} possibilities left`}</span>` +
    `<span class="answer-hint">Click a header to use it as rows · drag or ‹ › to reorder</span></div>` +
    `<div class="answer-scroll"><table class="grid"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>` +
    (unsure ? '<div class="answer-note"><b>?</b> not determined yet · several names = still possible</div>' : '');
  if (focusK != null) box.querySelector(`.colhead[data-k="${focusK}"]`)?.focus();
}

const useAsRows = (k, focus) => {
  const i = ord.o.indexOf(k); if (i < 1) return;
  const old = ord.o[0]; ord.o[0] = k; ord.o[i] = old;
  saveOrd(); renderAnswer(focus ? old : null);
};
const moveCol = (k, d, focus) => {
  const cols = ord.o.slice(1), i = cols.indexOf(k), j = i + d;
  if (i < 0 || j < 0 || j >= cols.length) return;
  [cols[i], cols[j]] = [cols[j], cols[i]];
  ord.o = [ord.o[0], ...cols]; saveOrd(); renderAnswer(focus ? k : null);
};
const placeCol = (k, target, after) => {
  const cols = ord.o.slice(1).filter(c => c !== k);
  cols.splice(cols.indexOf(target) + (after ? 1 : 0), 0, k);
  ord.o = [ord.o[0], ...cols]; saveOrd(); renderAnswer();
};

/* ───────── run ───────── */
function run(force) {
  const out = $('out');
  let thr = DEF_THR, lm = DEF_LM;
  ans = null;
  window.GSEditor?.setError(null);
  try {
    const L = [];
    const txt = $('src').value, raw = txt.split('\n');
    if (!txt.trim()) { out.innerHTML = PH; $('badge').textContent = '— left'; setTags(DEF_THR, DEF_LM); return; }
    if (!force && !txt.endsWith('\n')) raw.pop(); // live mode waits for Enter
    raw.forEach((l, i) => { l = l.replace(/\/\/.*$/, '').trim(); if (l) L.push({ t: l, n: i + 1 }); });
    let mode = 0, setup = [], clues = [], done = false;
    for (const x of L) {
      const u = x.t.toUpperCase();
      if (u === 'SETUP') { mode = 1; continue; }
      if (u === 'START') { mode = 2; continue; }
      if (u === 'SOLVE') { done = true; break; }
      const m = x.t.match(/^(THRESHOLD|LISTMAX)\s*=\s*(\d+)$/i);
      if (m) { if (m[1].toUpperCase() === 'THRESHOLD') thr = Math.max(1, +m[2]); else lm = +m[2]; continue; }
      if (mode === 1) setup.push(x); else if (mode === 2) clues.push(x); else throw new E('Begin with SETUP', x.n);
    }
    setTags(thr, lm);
    if (mode < 2) { if (force) throw new E('Missing START'); return; }
    if (!setup.length) throw new E('Missing SETUP section');
    const C = parseSetup(setup);
    let nf = 1; for (let i = 2; i <= C[0].items.length; i++) nf *= i;
    if (!force && clues.length && Math.pow(nf, C.length - 1) > 4e5) { out.innerHTML = '<div class="warn-banner">Large grid: auto-update paused. Press Update now (Ctrl+Enter).</div>'; return; }
    const fns = clues.map(c => compileClue(c.t, C, c.n));
    const R = solve(C, fns, lm);
    const nm = (c, i) => C[c].items[i] + C[c].tag, N = C[0].items.length;
    const line = s => Array.from({ length: N }, (_, r) => C.map((_, c) => nm(c, c ? s.inv[c][r] : r)).join(' ')).join('  |  ');
    const facts = j => [...R.certain[j]].filter(([k]) => !R.certain[j - 1].has(k)).map(([k, r]) => { const [c, i] = k.split('.'); return `${nm(0, r)} = ${nm(+c, +i)}`; });
    let h = `<div class="stats-bar"><div class="stat-chip"><span class="stat-val">${R.total.toLocaleString()}</span><span class="stat-lbl">Start</span></div>`;
    let last = R.total, stop = 0, html = '';
    for (let j = 1; j <= clues.length; j++) {
      const c = R.left[j], prev = R.left[j - 1], f = facts(j);
      html += `<div class="step animate-in" data-line="${clues[j - 1].n}"><div class="step-head"><span class="step-n">${j}</span><code class="step-clue">${esc(clues[j - 1].t)}</code><span class="step-count">${c.toLocaleString()} <small>−${(prev - c).toLocaleString()}</small></span></div>`;
      if (f.length) html += `<div class="chips">${f.map(x => `<span class="chip">${esc(x)}</span>`).join('')}</div>`;
      if (c > 0 && c <= lm && R.jmin <= j) html += `<div class="sols">${R.leaves.filter(s => s.p >= j).map(s => `<div class="sol">${esc(line(s))}</div>`).join('')}</div>`;
      html += '</div>'; last = c;
      if (c === 0) { html += `<div class="warn-banner">Contradiction at clue ${j}: no arrangement satisfies clues 1–${j}. Check that clue.</div>`; window.GSEditor?.setError(clues[j - 1].n, `Contradiction: no arrangement satisfies clues 1–${j}`); stop = j; break; }
      if (c <= thr) { html += `<div class="solved-banner">${c === 1 ? 'Single solution found' : `Threshold reached: ${c} possibilities`} after clue ${j}${j < clues.length ? ` (${clues.length - j} clue(s) not needed)` : ''}.</div>`; stop = j; break; }
    }
    if (!stop) html += `<div class="warn-banner">${last.toLocaleString()} possibilities remain after all clues (threshold ${thr}).</div>`;
    h += `<div class="stat-chip green"><span class="stat-val">${last.toLocaleString()}</span><span class="stat-lbl">Remaining</span></div><div class="stat-chip accent"><span class="stat-val">${clues.length}</span><span class="stat-lbl">Clues</span></div></div>`;
    out.innerHTML = h + html + '<div class="answer" id="answer" hidden></div>';
    $('badge').textContent = last.toLocaleString() + ' left';

    // answer table: shown once the clues give a result (unique solution, or the best picture so far)
    if (clues.length && last > 0) {
      const endJ = stop || clues.length, certain = R.certain[endJ];
      const lv = R.jmin !== undefined && R.jmin <= endJ && last <= lm ? R.leaves.filter(s => s.p >= endJ) : null;
      if (lv || certain.size) { ans = { C, count: last, cand: makeCand(C, certain, lv) }; initOrder(C); renderAnswer(); }
    }
  } catch (e) {
    if (!(e instanceof E)) throw e;
    window.GSEditor?.setError(e.line, e.message);
    out.innerHTML = `<div class="warn-banner">${e.line ? `Line ${e.line}: ` : ''}${esc(e.message)}</div>`;
    $('badge').textContent = 'error';
  }
}

/* ───────── wiring ───────── */
const PH = $('out').innerHTML;
const store = {
  get() { try { return localStorage.getItem('gridsolver.src'); } catch (e) { return null; } },
  set(v) { try { localStorage.setItem('gridsolver.src', v); } catch (e) {} }
};
const ED = window.GSEditor;
const setText = (v, top) => { if (ED) ED.setText(v, top); else $('src').value = v; store.set($('src').value); };
$('src').value = store.get() ?? EX; // last input is restored; first visit gets the example
ED?.refresh();
$('run').onclick = () => run(true);
let tm; $('src').addEventListener('input', () => { store.set($('src').value); clearTimeout(tm); tm = setTimeout(() => run(false), 250); });
addEventListener('pagehide', () => store.set($('src').value));
$('ex').onclick = () => { setText(EX, true); run(true); };
$('clr').onclick = () => { setText('', true); run(true); };
$('src').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) run(true); });

// steps <-> editor: hover previews the clue line, click jumps to it
const outEl = $('out');
outEl.addEventListener('mouseover', e => { const st = e.target.closest('.step'); ED?.peek(st ? +st.dataset.line : null); });
outEl.addEventListener('mouseleave', () => ED?.peek(null));
outEl.addEventListener('click', e => { const st = e.target.closest('.step'); if (st && ED) ED.goto(+st.dataset.line); });

// answer table: click header = use as rows, ‹ › or drag = reorder
outEl.addEventListener('click', e => {
  if (!ans || !e.target.closest) return;
  const mv = e.target.closest('.ch-mv');
  if (mv) { if (!mv.disabled) moveCol(+mv.closest('.colhead').dataset.k, +mv.dataset.d, true); return; }
  const th = e.target.closest('.colhead');
  if (th) useAsRows(+th.dataset.k, e.detail === 0);
});
outEl.addEventListener('keydown', e => {
  const th = ans && e.target.classList?.contains('colhead') ? e.target : null; if (!th) return;
  const k = +th.dataset.k;
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); useAsRows(k, true); }
  else if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); moveCol(k, e.key === 'ArrowLeft' ? -1 : 1, true); }
});
let dragK = null;
const clearMarks = () => outEl.querySelectorAll('.drop-before,.drop-after,.dragging').forEach(el => el.classList.remove('drop-before', 'drop-after', 'dragging'));
const endDrag = () => { dragK = null; clearMarks(); };
outEl.addEventListener('dragstart', e => {
  const th = e.target.closest?.('.colhead'); if (!th) return;
  dragK = +th.dataset.k; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(dragK));
  th.classList.add('dragging');
});
outEl.addEventListener('dragover', e => {
  if (dragK == null) return;
  outEl.querySelectorAll('.drop-before,.drop-after').forEach(el => el.classList.remove('drop-before', 'drop-after'));
  const th = e.target.closest?.('.colhead'); if (!th || +th.dataset.k === dragK) return;
  e.preventDefault(); e.dataTransfer.dropEffect = 'move';
  const r = th.getBoundingClientRect(); th.classList.add(e.clientX < r.left + r.width / 2 ? 'drop-before' : 'drop-after');
});
outEl.addEventListener('drop', e => {
  if (dragK == null) return;
  const th = e.target.closest?.('.colhead');
  if (th && +th.dataset.k !== dragK) { e.preventDefault(); const r = th.getBoundingClientRect(); placeCol(dragK, +th.dataset.k, e.clientX >= r.left + r.width / 2); }
  endDrag();
});
outEl.addEventListener('dragend', endDrag);
outEl.addEventListener('dragleave', e => { if (!outEl.contains(e.relatedTarget)) outEl.querySelectorAll('.drop-before,.drop-after').forEach(el => el.classList.remove('drop-before', 'drop-after')); });

/* ───────── resizable panels (left : right = 2 : 1 by default, remembered) ───────── */
const layout = $('layout'), split = $('split');
const SPLIT_KEY = 'gridsolver.split', SPLIT_DEF = 2 / 3, SPLIT_MIN = 240; // min width in px of each panel
let pref = SPLIT_DEF;
try { const v = parseFloat(localStorage.getItem(SPLIT_KEY)); if (v > 0 && v < 1) pref = v; } catch (e) {}
const clampSplit = r => {
  const w = layout.clientWidth - split.offsetWidth;
  if (w <= SPLIT_MIN * 2) return 0.5;
  return Math.min(1 - SPLIT_MIN / w, Math.max(SPLIT_MIN / w, r));
};
const applySplit = save => {
  const r = clampSplit(pref);
  layout.style.setProperty('--split', r);
  split.setAttribute('aria-valuenow', Math.round(r * 100));
  if (save) { try { localStorage.setItem(SPLIT_KEY, String(pref)); } catch (e) {} }
};
let grab = null;
split.addEventListener('pointerdown', e => {
  if (e.button) return;
  e.preventDefault();
  const sr = split.getBoundingClientRect();
  grab = e.clientX - (sr.left + sr.width / 2);
  split.setPointerCapture(e.pointerId);
  document.body.classList.add('resizing');
});
split.addEventListener('pointermove', e => {
  if (grab == null) return;
  const lr = layout.getBoundingClientRect(), sw = split.offsetWidth;
  pref = clampSplit((e.clientX - grab - lr.left - sw / 2) / (lr.width - sw));
  applySplit(false);
});
const endResize = () => { if (grab == null) return; grab = null; document.body.classList.remove('resizing'); applySplit(true); };
['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => split.addEventListener(ev, endResize));
split.addEventListener('dblclick', () => { pref = SPLIT_DEF; applySplit(true); });
split.addEventListener('keydown', e => {
  const step = e.shiftKey ? 0.1 : 0.02;
  if (e.key === 'ArrowLeft') pref = clampSplit(pref) - step;
  else if (e.key === 'ArrowRight') pref = clampSplit(pref) + step;
  else if (e.key === 'Home' || e.key === 'Enter') pref = SPLIT_DEF;
  else return;
  e.preventDefault(); pref = clampSplit(pref); applySplit(true);
});
addEventListener('resize', () => applySplit(false));
applySplit(false);

run(true);
