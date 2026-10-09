'use strict';

window.GSRender = window.GSRender || {};
GSRender.answerTable = function answerTable({ ans, ord, focusK, saveOrd, renderAgain, fmt }) {
  const box = document.getElementById('answer');
  if (!box || !ans || !ord) return;
  const { C, cand, count, kind } = ans;
  const N = C[0].items.length, rc = ord.o[0], cols = ord.o.slice(1);
  const color = i => {
    const palette = window.GSEditor?.PALETTE || ['#6ca965', '#6fa3d0', '#a58bc4', '#d27d8f', '#4fb3b3', '#b8a78a'];
    return palette[i % palette.length];
  };
  const style = c => `--c:${color(c)}`;
  const rowIdx = [...Array(N).keys()];
  if (C[rc].num) rowIdx.sort((a, b) => C[rc].items[a] - C[rc].items[b]);
  let unsure = false;
  const cell = (x, k) => {
    const values = cand(rc, x, k);
    if (!values.length) { unsure = true; return '<td class="cell-unk">?</td>'; }
    if (values.length === 1) return `<td style="${style(k)}"><span class="cell-v">${GSEsc(C[k].items[values[0]])}</span></td>`;
    unsure = true;
    const more = values.length > 3 ? `<span class="cell-more">+${values.length - 3}</span>` : '';
    return `<td class="cell-amb" style="${style(k)}">${values.slice(0, 3).map(i => `<span class="cell-v">${GSEsc(C[k].items[i])}</span>`).join('')}${more}</td>`;
  };
  const body = rowIdx.map(x => `<tr><th scope="row" style="${style(rc)}"><span class="cell-v">${GSEsc(C[rc].items[x])}</span></th>${cols.map(k => cell(x, k)).join('')}</tr>`).join('');
  const head = `<th class="rowhead" style="${style(rc)}" title="${GSEsc(C[rc].name)} is the row category"><span class="ch-in"><span class="ch-name">${GSEsc(C[rc].name)}</span><span class="ch-tag">[${C[rc].tag}]</span></span></th>` +
    cols.map((k, p) => `<th class="colhead" draggable="true" tabindex="0" role="button" data-k="${k}" style="${style(k)}" title="Click: use ${GSEsc(C[k].name)} as the rows · drag to reorder (Alt+←/→)"><span class="ch-in">` +
      `<button type="button" class="ch-mv" data-d="-1" aria-label="Move ${GSEsc(C[k].name)} left"${p === 0 ? ' disabled' : ''}>‹</button>` +
      `<span class="ch-name">${GSEsc(C[k].name)}</span><span class="ch-tag">[${C[k].tag}]</span>` +
      `<button type="button" class="ch-mv" data-d="1" aria-label="Move ${GSEsc(C[k].name)} right"${p === cols.length - 1 ? ' disabled' : ''}>›</button></span></th>`).join('');
  box.hidden = false;
  box.innerHTML = `<div class="answer-head"><span class="answer-title${count === 1 && kind === 0 ? '' : ' part'}">${count === 1 && kind === 0 ? 'Solution' : `${fmt(count, kind)} possibilities left`}</span>` +
    '<span class="answer-hint">Click a header to use it as rows · drag or ‹ › to reorder</span></div>' +
    `<div class="answer-scroll"><table class="grid"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>` +
    (unsure ? '<div class="answer-note"><b>?</b> not determined yet · several names = still possible</div>' : '');
  if (focusK != null) box.querySelector(`.colhead[data-k="${focusK}"]`)?.focus();
};
