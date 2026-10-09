/* Repeating and unique column execution engine. */
window.GSSolvers = window.GSSolvers || {};
GSSolvers.runRepeating = function runRepeating(L, out) {
  const decl = /^(\w+)\s+(repeat|unique)\s+(.+)$/i;
  let mode = 0, row = null, columns = [], clues = [];
  for (const x of L) {
    const u = x.t.toUpperCase();
    if (u === 'SETUP') { mode = 1; continue; }
    if (u === 'START') { mode = 2; continue; }
    if (u === 'SOLVE') break;
    if (mode === 1) {
      const m = x.t.match(decl), values = x.t.match(/"[^"]*"|\S+/g) || [];
      if (m) columns.push({ name: m[1], unique: m[2].toLowerCase() === 'unique', values: m[3].split(/\s+/) });
      else if (values.length > 1) row = { name: values.shift(), values };
    } else if (mode === 2) clues.push(x);
  }
  if (!columns.length) return false;
  if (!row) throw new GSError('Repeating/unique mode needs a plain row category', 1);
  const R = row.values.length, states = [];
  const build = (columnIndex, state) => {
    if (columnIndex === columns.length) { states.push(state.map(values => values.slice())); return; }
    const column = columns[columnIndex], values = [];
    const fill = () => {
      if (values.length === R) { build(columnIndex + 1, state.concat([values])); return; }
      for (let i = 0; i < column.values.length; i++) {
        if (!column.unique || !values.includes(i)) { values.push(i); fill(); values.pop(); }
      }
    };
    fill();
  };
  build(0, []);
  const valueIndex = (column, value) => column.values.findIndex(v => v.toLowerCase() === value.toLowerCase());
  const filter = predicate => states.splice(0, states.length, ...states.filter(predicate));
  const columnAt = name => columns.findIndex(c => c.name.toLowerCase() === name.toLowerCase());
  const rowIndex = token => {
    const m = token.match(/^(\d+)[a-z]+$/i);
    return m ? +m[1] - 1 : -1;
  };
  const cell = (state, column, index) => state[column][index];
  for (const x of clues) {
    let m = x.t.match(/^(\w+)\[(\d+)\]\s*(!?=)\s*(.+)$/);
    if (m) {
      const c = columnAt(m[1]), index = +m[2] - 1, value = valueIndex(columns[c], m[4].trim());
      if (c < 0 || index < 0 || index >= R || value < 0) throw new GSError('Unknown indexed value', x.n);
      filter(s => m[3] === '=' ? cell(s, c, index) === value : cell(s, c, index) !== value);
      continue;
    }
    m = x.t.match(/^(\d+[a-z]+)\s*=\s*(\w+)$/);
    if (m) {
      const index = rowIndex(m[1]), value = m[2];
      if (index < 0 || index >= R) throw new GSError('Row reference is out of range', x.n);
      const matches = columns.map((column, c) => [c, valueIndex(column, value)]).filter(([, i]) => i >= 0);
      if (matches.length !== 1) throw new GSError('Value must resolve to exactly one repeating column', x.n);
      filter(s => cell(s, matches[0][0], index) === matches[0][1]);
      continue;
    }
    m = x.t.match(/^(\w+)\s+has\s+(\w+)(?:\s+x(\d+))?$/i);
    if (m) {
      const c = columnAt(m[1]), value = valueIndex(columns[c], m[2]), count = +(m[3] || 1);
      if (c < 0 || value < 0) throw new GSError('Unknown column or value', x.n);
      filter(s => s[c].filter(v => v === value).length >= count);
      continue;
    }
    m = x.t.match(/^(\w+)\s+lacks\s+(\w+)$/i);
    if (m) {
      const c = columnAt(m[1]), value = valueIndex(columns[c], m[2]);
      if (c < 0 || value < 0) throw new GSError('Unknown column or value', x.n);
      filter(s => !s[c].includes(value));
      continue;
    }
    m = x.t.match(/^(\w+)\s+first$/i);
    if (m) {
      const matches = columns.map((column, c) => [c, valueIndex(column, m[1])]).filter(([, i]) => i >= 0);
      if (matches.length !== 1) throw new GSError('Unknown value', x.n);
      filter(s => s[matches[0][0]][0] === matches[0][1]);
      continue;
    }
    m = x.t.match(/^(not\s+)?(\w+)\s+before\s+(\w+)$/i);
    if (m) {
      const left = columns.map((column, c) => [c, valueIndex(column, m[2])]).filter(([, i]) => i >= 0);
      const right = columns.map((column, c) => [c, valueIndex(column, m[3])]).filter(([, i]) => i >= 0);
      if (left.length !== 1 || right.length !== 1) throw new GSError('Unknown value', x.n);
      filter(s => {
        const found = s[left[0][0]].some((v, i) => v === left[0][1] && s[right[0][0]].some((w, j) => w === right[0][1] && i < j));
        return m[1] ? !found : found;
      });
      continue;
    }
    if (/^distinct\s+/i.test(x.t)) {
      const names = x.t.replace(/^distinct\s+/i, '').split(/\s+/).map(columnAt);
      if (names.some(i => i < 0)) throw new GSError('Unknown column in distinct clause', x.n);
      filter(s => {
        const seen = new Set();
        for (let r = 0; r < R; r++) {
          const key = names.map(c => s[c][r]).join(',');
          if (seen.has(key)) return false;
          seen.add(key);
        }
        return true;
      });
      continue;
    }
    throw new GSError('Unsupported repeating-mode clue', x.n);
  }
  const rows = states.map((state, n) => `<tr><th scope="row">${n + 1}</th>${state.map((column, c) => `<td><span class="slot-cell">${GSEsc(column.map(i => columns[c].values[i]).join(', '))}</span></td>`).join('')}</tr>`).join('');
  out.innerHTML = `<div class="answer slot-answer"><div class="answer-head"><span class="answer-title">Remaining candidates</span></div><div class="answer-scroll"><table class="grid slot-grid"><thead><tr><th>#</th>${columns.map(c => `<th>${GSEsc(c.name)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div></div>`;
  $('badge').textContent = states.length + ' left';
  return true;
}

