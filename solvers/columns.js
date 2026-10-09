'use strict';

/* Row-backed columns.  This deliberately lives beside, rather than inside, the
 * legacy compiler: old equal-sized programs continue to use the old solver. */
window.GSSolvers = window.GSSolvers || {};

GSSolvers.runRepeating = function runRepeating(L, out) {
  const E = window.GSRuntime?.Error || window.GSError;
  const fail = (message, line) => { throw new E(message, line); };
  const words = s => (s.match(/"[^"]*"|\([^)]*\)|\S+/g) || []).map(x => x.replace(/^"|"$/g, ''));
  const setup = [], clues = [];
  let mode = 0, rowsPin = null;
  for (const x of L) {
    const u = x.t.toUpperCase();
    if (u === 'SETUP') { mode = 1; continue; }
    if (u === 'START') { mode = 2; continue; }
    if (u === 'SOLVE') break;
    const rm = x.t.match(/^ROWS(?:\s+(.+))?$/i);
    if (rm) { rowsPin = rm[1] || null; continue; }
    if (mode === 1) setup.push(x); else if (mode === 2) clues.push(x);
  }
  if (!setup.length) return false;
  const featureSyntax = setup.some(x => /\b(?:repeat|unique|slots\s+on|domain|pool|values)\b/i.test(x.t));
  const setupSizes = setup.filter(x => !/^(?:SETUP|ROWS|THRESHOLD|LISTMAX)\b/i.test(x.t)).map(x => words(x.t).length);
  if (!featureSyntax && !setup.some(x => /\.\.+/.test(x.t)) && new Set(setupSizes).size < 2) return false;

  const pools = new Map(), declarations = [], plain = [];
  const aliases = new Map();
  const addItems = (name, vals) => {
    const outVals = vals.map(v => v.replace(/^"|"$/g, ''));
    aliases.set(name.toLowerCase(), outVals);
    return outVals;
  };
  for (const x of setup) {
    const toks = words(x.t), name = toks.shift();
    if (!name) fail('Expected a category or pool declaration', x.n);
    let tag = '';
    if (toks[0]?.match(/^\[[a-z]+\]$/i)) tag = toks.shift().slice(1, -1);
    const poolMatch = toks[0]?.match(/^(domain|pool|values)$/i);
    if (poolMatch) {
      toks.shift();
      if (!toks.length) fail(`Pool "${name}" has no values`, x.n);
      pools.set(name.toLowerCase(), addItems(name, toks));
      continue;
    }
    let modifier = null, slotCategory = null, alphabet = null;
    if (/^(repeat|unique)$/i.test(toks[0] || '')) modifier = toks.shift().toLowerCase();
    else if (/^slots$/i.test(toks[0] || '') && /^on$/i.test(toks[1] || '')) {
      toks.splice(0, 2); slotCategory = toks.shift(); if (!/^from$/i.test(toks.shift() || '')) fail('Expected "from" after slots on category', x.n);
      modifier = /^(unique|repeat)$/i.test(toks.at(-1) || '') ? toks.pop().toLowerCase() : 'repeat';
      alphabet = toks.join(' ').trim();
    }
    if (modifier) {
      if (slotCategory && !alphabet) fail(`Column "${name}" has no alphabet`, x.n);
      declarations.push({ name, tag, mode: modifier, source: alphabet || toks.join(' '), line: x.n, slotCategory });
    } else {
      if (!toks.length) fail(`Category "${name}" has no items`, x.n);
      plain.push({ name, tag, items: addItems(name, toks), line: x.n });
    }
  }
  const rowSize = rowsPin && /^\d+$/.test(rowsPin) ? +rowsPin
    : rowsPin ? (plain.find(c => c.name.toLowerCase() === rowsPin.toLowerCase()) || {}).items?.length
    : plain[0]?.items.length;
  if (!rowSize) fail('no rows; add ROWS n', setup[0]?.n);
  if (rowSize > 12) fail('Too many rows (maximum 12)', setup[0].n);
  const first = plain[0];
  if (!rowsPin && plain.some(c => c.items.length !== rowSize)) {
    const readings = [...new Set(plain.map(c => c.items.length))].map(n => `rows = ${n}`).join('; ');
    fail(`Plain categories disagree: ${readings}. Add ROWS or mark categories repeat/unique`, plain.find(c => c.items.length !== rowSize).line);
  }
  if (rowsPin && plain.some(c => c.items.length !== rowSize)) {
    const c = plain.find(x => x.items.length !== rowSize);
    fail(`"${c.name}" has ${c.items.length} items but there are ${rowSize} rows; mark it repeat or unique, or remove ROWS`, c.line);
  }
  const cols = plain.map(c => ({ ...c, mode: 'plain' }));
  for (const d of declarations) {
    let vals;
    let components = null;
    if (d.source.includes('*')) {
      const parts = d.source.split('*').map(s => s.trim().toLowerCase());
      components = parts;
      const lists = parts.map(p => pools.get(p) || aliases.get(p));
      if (lists.some(x => !x)) fail(`Unknown pool in product for "${d.name}"`, d.line);
      vals = lists.reduce((a, b) => a.flatMap(x => b.map(y => [x, y].flat())), [[]])
        .filter(x => x.length).map(x => ({ tuple: x, text: `(${x.join(', ')})` }));
    } else {
      const key = d.source.trim().toLowerCase();
      vals = pools.get(key) || aliases.get(key) || words(d.source);
      vals = vals.map(v => typeof v === 'string' ? v : v);
    }
    if (!vals.length) fail(`Column "${d.name}" has no values`, d.line);
    if (d.mode === 'unique' && vals.length < rowSize) fail(`Unique column "${d.name}" has ${vals.length} items but there are ${rowSize} rows; mark it repeat`, d.line);
    cols.push({ name: d.name, tag: d.tag || d.name[0].toLowerCase(), items: vals, mode: d.mode, product: vals[0]?.tuple, components, line: d.line });
  }
  const rowCat = plain[0] || { name: 'row', tag: 'o', items: Array.from({ length: rowSize }, (_, i) => i + 1), mode: 'plain' };
  const rowIndex = token => {
    const m = String(token).match(/^(\d+)([a-z]+)$/i);
    if (m && (m[2].toLowerCase() === (rowCat.tag || 'o').toLowerCase() || m[2].toLowerCase() === 'o')) return +m[1] - 1;
    const i = rowCat.items.findIndex(x => String(x).toLowerCase() === String(token).toLowerCase());
    return i;
  };
  const colIndex = name => cols.findIndex(c => c.name.toLowerCase() === name.toLowerCase() || c.tag.toLowerCase() === name.toLowerCase());
  const valueIndex = (c, value) => c.items.findIndex(v => {
    if (typeof v === 'object') return v.text.toLowerCase() === String(value).toLowerCase();
    return String(v).toLowerCase() === String(value).toLowerCase();
  });
  const makeColumnStates = c => {
    const out = [], a = [];
    const rec = () => {
      if (a.length === rowSize) { out.push(a.slice()); return; }
      for (let i = 0; i < c.items.length; i++) {
        if (c.mode === 'unique' && a.includes(i)) continue;
        a.push(i); rec(); a.pop();
      }
    };
    rec(); return out;
  };
  const states = [];
  const build = (i, state) => {
    if (i === cols.length) { states.push(state.map(x => x.slice())); return; }
    const c = cols[i];
    if (c.mode === 'plain') {
      const a = Array.from({ length: rowSize }, (_, n) => n);
      build(i + 1, state.concat([a])); return;
    }
    for (const a of makeColumnStates(c)) build(i + 1, state.concat([a]));
  };
  build(0, []);
  const getCell = (s, ci, ri) => s[ci][ri];
  const displayValue = (c, i) => typeof c.items[i] === 'object' ? c.items[i].text : String(c.items[i]);
  const resolveValue = (s, token, hinted) => {
    const component = token.match(/^(.+)\.([A-Za-z_]\w*)$/);
    if (component && /\[\d+\]$/.test(component[1])) {
      const im = component[1].match(/^(.+)\[(\d+)\]$/), c = colIndex(im[1]), part = component[2];
      if (c >= 0 && c < cols.length && cols[c].items[0]?.tuple) {
        const componentIndex = cols[c].components?.indexOf(part.toLowerCase()) ?? -1;
        if (componentIndex >= 0) return cols[c].items[getCell(s, c, +im[2] - 1)]?.tuple[componentIndex];
        return null;
      }
    }
    const dot = token.match(/^(.+)\.([A-Za-z_]\w*)$/);
    if (dot) {
      const r = resolveRow(s, dot[1]), c = colIndex(dot[2]);
      return c < 0 || r < 0 ? null : getCell(s, c, r);
    }
    const indexed = token.match(/^(.+)\[(\d+)\]$/);
    if (indexed) { const c = colIndex(indexed[1]); return c < 0 ? null : getCell(s, c, +indexed[2] - 1); }
    const r = rowIndex(token); if (r >= 0 && r < rowSize) return { row: r };
    const candidates = cols.map((c, i) => [i, valueIndex(c, token)]).filter(x => x[1] >= 0);
    for (const c of cols) if (c.components && c.items.some(v => v.tuple?.some(x => String(x).toLowerCase() === token.toLowerCase()))) {
      const v = c.items.find(x => x.tuple?.some(y => String(y).toLowerCase() === token.toLowerCase()));
      candidates.push([c.name, v.tuple.find(y => String(y).toLowerCase() === token.toLowerCase())]);
    }
    if (hinted != null) { const i = colIndex(hinted); if (i >= 0) return valueIndex(cols[i], token); }
    return candidates.length === 1 ? candidates[0][1] : candidates.length ? { choices: candidates } : null;
  };
  const resolveRow = (s, token) => {
    const r = rowIndex(token); if (r >= 0 && r < rowSize) return r;
    const c = cols.findIndex(x => x.mode === 'plain' && valueIndex(x, token) >= 0);
    if (c >= 0) return s[c].indexOf(valueIndex(cols[c], token));
    return -1;
  };
  const match = (s, token, expected) => {
    const ci = colIndex(expected || '');
    const r = resolveRow(s, token);
    if (r >= 0 && ci >= 0) return getCell(s, ci, r);
    return resolveValue(s, token, expected);
  };
  let activeLine = 0;
  const atom = (s, text) => {
    text = text.trim();
    if (/^some\s+\w+\s+in\s+/i.test(text)) {
      const m = text.match(/^some\s+(\w+)\s+in\s+([^:]+):\s*(.+)$/i);
      if (!m) return false;
      return Array.from({ length: rowSize }, (_, i) => i).some(i =>
        m[3].replace(/\b\w+\b/g, w => w === m[1] ? `${i + 1}${rowCat.tag}` : w)
          .split(/\s+and\s+/i).every(part => atom(s, part)));
    }
    if (/^not\s*\(/i.test(text)) return !atom(s, text.replace(/^not\s*\((.*)\)$/i, '$1'));
    const negated = text.match(/^(.+?)\s+not\s+(first|last|before|after|beside|right\s+before|right\s+after)\s*(.*)$/i);
    if (negated) return !atom(s, `${negated[1]} ${negated[2]}${negated[3] ? ` ${negated[3]}` : ''}`);
    const distinct = text.match(/^(distinct|alldiff)\s+(.+)$/i);
    if (distinct) {
      const names = distinct[2].split(/\s+/), ix = names.map(colIndex);
      if (distinct[1].toLowerCase() === 'alldiff' && ix.some(i => cols[i]?.mode === 'repeat')) fail('alldiff over repeating columns is invalid; rewrite it as distinct ...', 0);
      return new Set(Array.from({ length: rowSize }, (_, r) => ix.map(c => getCell(s, c, r)).join(','))).size === rowSize;
    }
    const count = text.match(/^(\w+)\s+(has|lacks)\s+(\S+)(?:\s+x(\d+))?$/i);
    if (count) {
      const c = colIndex(count[1]), v = valueIndex(cols[c], count[3].trim()), n = +(count[4] || 1);
      if (c < 0 || v < 0) return false;
      const got = s[c].filter(x => x === v).length;
      return count[2].toLowerCase() === 'has' ? got === n : got === 0;
    }
    const order = text.match(/^(.+?)\s+(right\s+before|right\s+after|before|after|beside|first|last)\s+(.+)$/i);
    const position = text.match(/^(.+?)\s+(first|last)$/i);
    if (position) {
      const token = position[1].trim(), want = position[2].toLowerCase() === 'first' ? 0 : rowSize - 1;
      return cols.some((c, ci) => c.items.some((v, vi) => String(v).toLowerCase() === token.toLowerCase() && s[ci][want] === vi));
    }
    if (order) {
      const op = order[2].toLowerCase(), left = [], right = [];
      cols.forEach((c, ci) => { c.items.forEach((v, vi) => { if (String(v).toLowerCase() === order[1].trim().toLowerCase()) left.push([ci, vi]); if (String(v).toLowerCase() === order[3].trim().toLowerCase()) right.push([ci, vi]); }); });
      const lp = left.flatMap(([c, v]) => s[c].flatMap((x, i) => x === v ? [i] : [])), rp = right.flatMap(([c, v]) => s[c].flatMap((x, i) => x === v ? [i] : []));
      if (op === 'first') return lp.includes(0);
      if (op === 'last') return lp.includes(rowSize - 1);
      return lp.some(i => rp.some(j => op === 'before' ? i < j : op === 'after' ? i > j : op === 'right before' ? i + 1 === j : op === 'right after' ? i === j + 1 : Math.abs(i - j) === 1));
    }
    const cmp = text.match(/^(.+?)\s*(!=|=)\s*(.+)$/);
    if (!cmp) return false;
    const indexedLeft = cmp[1].trim().match(/^(.+)\[(\d+)\]$/), indexedRight = cmp[3].trim().match(/^(.+)\[(\d+)\]$/);
    if (indexedLeft && indexedRight && colIndex(indexedLeft[1]) !== colIndex(indexedRight[1]))
      fail(`Cannot compare cells from different columns ("${indexedLeft[1]}" and "${indexedRight[1]}")`, activeLine);
    const leftBareHits = cols.map((c, ci) => [ci, valueIndex(c, cmp[1].trim())]).filter(x => x[1] >= 0);
    const rightBareHits = cols.map((c, ci) => [ci, valueIndex(c, cmp[3].trim())]).filter(x => x[1] >= 0);
    if (!indexedLeft && !indexedRight && leftBareHits.length === 1 && rightBareHits.length === 1
      && leftBareHits[0][0] !== rightBareHits[0][0])
      fail(`A value is not a row: "${cmp[1].trim()} ${cmp[2]} ${cmp[3].trim()}". Use has/lacks or an existential row clause`, activeLine);
    const rowRef = cmp[1].trim().match(/^(\d+)[a-z]+$/i);
    if (rowRef) {
      const r = +rowRef[1] - 1, matches = cols.map((c, ci) => [ci, valueIndex(c, cmp[3].trim())]).filter(x => x[1] >= 0);
      if (r < 0 || r >= rowSize) return false;
      if (matches.length !== 1) fail(`Value "${cmp[3].trim()}" is ambiguous; qualify it with a column`, 0);
      return cmp[2] === '=' ? getCell(s, matches[0][0], r) === matches[0][1] : getCell(s, matches[0][0], r) !== matches[0][1];
    }
    const a = match(s, cmp[1].trim()), b = match(s, cmp[3].trim());
    if (a?.choices && b?.choices) fail(`A value is not a row: "${cmp[1].trim()} ${cmp[2]} ${cmp[3].trim()}". Use has/lacks or an existential row clause`, activeLine);
    if (a?.row && b != null) {
      const matches = cols.map((c, ci) => [ci, valueIndex(c, cmp[3].trim())]).filter(x => x[1] >= 0);
      if (matches.length !== 1) fail(`Value "${cmp[3].trim()}" is ambiguous; qualify it with a column`, activeLine);
      return cmp[2] === '=' ? getCell(s, matches[0][0], a.row) === matches[0][1] : getCell(s, matches[0][0], a.row) !== matches[0][1];
    }
    if (b?.row && a != null) {
      const matches = cols.map((c, ci) => [ci, valueIndex(c, cmp[1].trim())]).filter(x => x[1] >= 0);
      if (matches.length !== 1) fail(`Value "${cmp[1].trim()}" is ambiguous; qualify it with a column`, activeLine);
      return cmp[2] === '=' ? getCell(s, matches[0][0], b.row) === matches[0][1] : getCell(s, matches[0][0], b.row) !== matches[0][1];
    }
    if (a == null || b == null) return false;
    return cmp[2] === '=' ? JSON.stringify(a) === JSON.stringify(b) : JSON.stringify(a) !== JSON.stringify(b);
  };
  const apply = (s, clue) => {
    const scoped = clue.trim().match(/^some\s+(\w+)\s+in\s+([^:]+):\s*(.+)$/i);
    if (scoped) return Array.from({ length: rowSize }, (_, i) => apply(s, scoped[3].replace(new RegExp(`\\b${scoped[1]}\\b`, 'g'), String(i + 1)))).some(Boolean);
    return clue.split(/\s+and\s+/i).every(x => {
    const t = x.trim(), direct = t.match(/^(\d+)[a-z]+\s*(!?=)\s*(.+)$/i);
    if (direct) {
      const r = +direct[1] - 1, hits = cols.map((c, ci) => [ci, valueIndex(c, direct[3].trim())]).filter(y => y[1] >= 0);
      if (hits.length !== 1) return false;
      return direct[2] === '=' ? s[hits[0][0]][r] === hits[0][1] : s[hits[0][0]][r] !== hits[0][1];
    }
    const first = t.match(/^(.+?)\s+not\s+(first|last)$/i);
    if (first) return !atom(s, `${first[1]} ${first[2]}`);
    return atom(s, t);
    });
  };
  const stages = [states];
  for (const clue of clues) { activeLine = clue.n; stages.push(stages.at(-1).filter(s => apply(s, clue.t))); }
  const last = stages.at(-1);
  const shown = last[0];
  const rows = shown ? Array.from({ length: rowSize }, (_, n) =>
    `<tr><th>${GSEsc(String(rowCat.items[n] ?? n + 1))}</th>${cols.map((c, i) =>
      `<td>${c.mode === 'plain' ? GSEsc(String(c.items[n] ?? '')) : GSEsc(displayValue(c, shown[i][n]))}</td>`).join('')}</tr>`).join('') : '';
  const certainUnused = [], undecidedUnused = [];
  cols.forEach((c, ci) => {
    if (c.mode !== 'unique') return;
    c.items.forEach((v, vi) => {
      if (!last.some(s => s[ci].includes(vi))) certainUnused.push(displayValue(c, vi));
      else if (last.some(s => !s[ci].includes(vi))) undecidedUnused.push(displayValue(c, vi));
    });
  });
  out.innerHTML = `<div class="stats-bar"><div class="stat-chip"><span class="stat-val">${states.length}</span><span class="stat-lbl">Start</span></div><div class="stat-chip green"><span class="stat-val">${last.length}</span><span class="stat-lbl">Remaining</span></div><div class="stat-chip accent"><span class="stat-val">${clues.length}</span><span class="stat-lbl">Clues</span></div></div>` +
    clues.map((c, i) => `<div class="step"><div class="step-head"><span class="step-n">${i + 1}</span><code class="step-clue">${GSEsc(c.t)}</code><span class="step-count">${stages[i + 1].length}</span></div></div>`).join('') +
    `<div class="answer slot-answer"><div class="answer-head"><span class="answer-title">${last.length === 1 ? 'Solution' : 'Remaining candidates'}</span></div><div class="answer-scroll"><table class="grid"><thead><tr><th>#</th>${cols.map(c => `<th>${GSEsc(c.name)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>${certainUnused.length ? `<div class="answer-note">Unused: ${certainUnused.map(GSEsc).join(', ')}</div>` : undecidedUnused.length ? `<div class="answer-note">Unused: not decided yet (${undecidedUnused.length} of ${undecidedUnused.map(GSEsc).join(', ')})</div>` : ''}</div>`;
  $('badge').textContent = `${last.length} left`;
  return true;
};
