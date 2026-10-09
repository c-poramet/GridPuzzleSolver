'use strict';
window.GSSolvers = window.GSSolvers || {};
const $ = id => document.getElementById(id);
const esc = GSRuntime.esc;
const E = GSRuntime.Error;
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

/* ───────── slots / Mastermind mode ─────────
   This is intentionally separate from the grid solver: a slots program has no
   row permutations, but it can still use the same line-numbered diagnostics. */
/* ───────── answer table ───────── */
// ord.o = category indexes; o[0] is the row category, the rest are columns in display order.
const ORD_KEY = 'gridsolver.order';
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
function makeCand(C, certain, leaves, pairs) {
  const N = C[0].items.length;
  if (pairs) return pairs;
  if (leaves) return (a, x, b) => { const s = new Set(); for (const L of leaves) s.add(L.inv[b][L.pos[a][x]]); return [...s].sort((p, q) => p - q); };
  return (a, x, b) => {
    const r = a === 0 ? x : certain.get(a + '.' + x);
    if (r === undefined) return [];
    if (b === 0) return [r];
    for (let i = 0; i < N; i++) if (certain.get(b + '.' + i) === r) return [i];
    return [];
  };
}

const renderAnswer = focusK => GSRender.answerTable({ ans, ord, focusK, saveOrd, renderAgain: renderAnswer, fmt });

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
function run() { // only ever called by the Update button, Ctrl+Enter, Example and Clear
  const out = $('out');
  let thr = DEF_THR, lm = DEF_LM;
  ans = null; TIPS = []; hoverStep = null; hideTip();
  window.GSEditor?.setError(null);
  try {
    const L = [];
    const txt = $('src').value, raw = txt.split('\n');
    if (!txt.trim()) { out.innerHTML = PH; $('badge').textContent = '— left'; setTags(DEF_THR, DEF_LM); return; }
    raw.forEach((l, i) => { l = l.replace(/\/\/.*$/, '').trim(); if (l) L.push({ t: l, n: i + 1 }); });
    const setupLines = L.slice(0, L.findIndex(x => /^START$/i.test(x.t)) < 0 ? L.length : L.findIndex(x => /^START$/i.test(x.t)))
      .filter(x => !/^(?:SETUP|ROWS|THRESHOLD|LISTMAX)\b/i.test(x.t));
    const unequalSetup = setupLines.length > 1 && !setupLines.some(x => /\.\.+/.test(x.t))
      && new Set(setupLines.map(x => x.t.split(/\s+/).length)).size > 1;
    if ((unequalSetup || L.some(x=>/^\w+(?:\s+\[[a-z]+\])?\s+(?:(?:repeat|unique)\s+|slots\s+on\s+|(?:domain|pool|values)\b)/i.test(x.t)) || L.some(x => /^ROWS\b/i.test(x.t)))
      && GSSolvers.runRepeating(L,out)) return;
    // A slots declaration switches to the additive Mastermind/slots engine.
    // Detect it before the SETUP/START parser so ordinary grid programs remain
    // byte-for-byte compatible with their previous path.
    const slotProgram = L.some(x => /^\s*[A-Za-z_][A-Za-z0-9_]*\s*(?:\[[a-z]+\]\s*)?\d+\s+slots?\s+from\s+/i.test(x.t));
    if (slotProgram) {
      for (const x of L) {
        const q = x.t.match(/^(THRESHOLD|LISTMAX)\s*=\s*(\d+)$/i);
        if (q) { if (q[1].toUpperCase() === 'THRESHOLD') thr = Math.max(1, +q[2]); else lm = +q[2]; }
      }
      setTags(thr, lm);
      GSSolvers.runSlots(L, out, thr, lm);
      return;
    }
    let mode = 0, setup = [], clues = [], done = false, defaultUnit = null;
    for (const x of L) {
      const u = x.t.toUpperCase();
      if (u === 'SETUP') { mode = 1; continue; }
      if (u === 'START') { mode = 2; continue; }
      if (u === 'SOLVE') { done = true; break; }
      const m = x.t.match(/^(THRESHOLD|LISTMAX)\s*=\s*(\d+)$/i);
      if (m) { if (m[1].toUpperCase() === 'THRESHOLD') thr = Math.max(1, +m[2]); else lm = +m[2]; continue; }
      const du = x.t.match(/^(?:DEFAULT\s+)?UNIT\s*=\s*([A-Za-z][A-Za-z0-9_]*)$/i);
      if (du) { defaultUnit = du[1].toLowerCase(); continue; }
      if (mode === 1) setup.push(x); else if (mode === 2) clues.push(x); else throw new E('Begin with SETUP', x.n);
    }
    setTags(thr, lm);
    if (mode < 2) throw new E('Missing START');
    if (!setup.length) throw new E('Missing SETUP section');
    const C = GSGrid.parseSetup(setup);
    if (defaultUnit != null) {
      const ix = C.findIndex(c => c.tag.toLowerCase() === defaultUnit || c.name.toLowerCase() === defaultUnit);
      if (ix < 0) throw new E(`Unknown default unit "${defaultUnit}"`, 1);
      defaultUnit = ix;
    }
    const fns = clues.map(c => GSGrid.compileClue(c.t, C, c.n, defaultUnit));
    TIPS = fns.map(f => f.say);
    const R = GSGrid.makeSolver(C, fns, lm);
    const nm = (c, i) => C[c].items[i] + C[c].tag, N = C[0].items.length;
    const line = s => Array.from({ length: N }, (_, r) => C.map((_, c) => nm(c, c ? s.inv[c][r] : r)).join(' ')).join('  |  ');
    const sts = [{ count: R.total, kind: R.total > 2 ** 53 ? 1 : 0, certain: new Map(), sols: null }];
    const facts = j => [...sts[j].certain].filter(([k]) => !sts[j - 1].certain.has(k)).map(([k, r]) => { const [c, i] = k.split('.'); return `${nm(0, r)} = ${nm(+c, +i)}`; });
    let h = `<div class="stats-bar"><div class="stat-chip"><span class="stat-val">${fmt(sts[0].count, sts[0].kind)}</span><span class="stat-lbl">Start</span></div>`;
    let last = sts[0], stop = 0, html = '';
    for (let j = 1; j <= clues.length; j++) {
      const st = R.step(j), prev = sts[j - 1], exact = st.kind === 0;
      sts[j] = st;
      const f = facts(j), delta = exact && prev.kind === 0 ? ` <small>−${fmt(prev.count - st.count)}</small>` : '';
      html += `<div class="step animate-in" data-line="${clues[j - 1].n}" data-tip="${j - 1}"><div class="step-head"><span class="step-n">${j}</span><code class="step-clue">${esc(clues[j - 1].t)}</code><span class="step-count">${fmt(st.count, st.kind)}${delta}</span></div>`;
      if (f.length) html += `<div class="chips">${f.map(x => `<span class="chip">${esc(x)}</span>`).join('')}</div>`;
      if (st.sols) html += `<div class="sols">${st.sols.map(s => `<div class="sol">${esc(line(s))}</div>`).join('')}</div>`;
      html += '</div>'; last = st;
      if (exact && st.count === 0) { html += `<div class="warn-banner">Contradiction at clue ${j}: no arrangement satisfies clues 1–${j}. Check that clue.</div>`; window.GSEditor?.setError(clues[j - 1].n, `Contradiction: no arrangement satisfies clues 1–${j}`); stop = j; break; }
      if (exact && st.count <= thr) { html += `<div class="solved-banner">${st.count === 1 ? 'Single solution found' : `Threshold reached: ${st.count} possibilities`} after clue ${j}${j < clues.length ? ` (${clues.length - j} clue(s) not needed)` : ''}.</div>`; stop = j; break; }
    }
    if (!stop) html += `<div class="warn-banner">${fmt(last.count, last.kind)} possibilities remain after all clues (threshold ${thr}).</div>`;
    h += `<div class="stat-chip green"><span class="stat-val">${fmt(last.count, last.kind)}</span><span class="stat-lbl">Remaining</span></div><div class="stat-chip accent"><span class="stat-val">${clues.length}</span><span class="stat-lbl">Clues</span></div></div>`;
    out.innerHTML = h + html + '<div class="answer" id="answer" hidden></div>';
    $('badge').textContent = fmt(last.count, last.kind) + ' left';

    // answer table: shown once the clues give a result (unique solution, or the best picture so far)
    if (clues.length && !(last.kind === 0 && last.count === 0)) {
      const st = sts[stop || clues.length];
      if (st.sols || st.certain.size) {
        const pairs = st.sols ? null : R.pairs(stop || clues.length);
        ans = { C, count: st.count, kind: st.kind, cand: makeCand(C, st.certain, st.sols, pairs) };
        initOrder(C); renderAnswer();
      }
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
$('run').onclick = () => run();
// no auto-update: typing only saves the text and marks the result as out of date
$('src').addEventListener('input', () => { store.set($('src').value); if ($('src').value.trim()) $('badge').textContent = 'edited'; });
addEventListener('pagehide', () => store.set($('src').value));
$('ex').onclick = () => { setText(EX, true); run(); };
$('clr').onclick = () => { setText('', true); run(); };
$('src').addEventListener('keydown', e => { if (window.GSSettings?.keyMatches('solve', e)) { e.preventDefault(); run(); } });

// steps <-> editor: hover previews the clue line, click jumps to it; Shift + hover explains the clue
const outEl = $('out');
outEl.addEventListener('mouseover', e => {
  const st = e.target.closest('.step');
  ED?.peek(st ? +st.dataset.line : null);
  hoverStep = st; lastPt = e; shiftDown = e.shiftKey; syncTip();
});
outEl.addEventListener('mousemove', e => { lastPt = e; shiftDown = e.shiftKey; if (hoverStep) syncTip(); });
outEl.addEventListener('mouseleave', () => { ED?.peek(null); hoverStep = null; syncTip(); });
outEl.addEventListener('click', e => { const st = e.target.closest('.step'); if (st && ED) ED.goto(+st.dataset.line); });
addEventListener('keydown', e => { if (e.key === 'Shift' && !shiftDown) { shiftDown = true; syncTip(); } });
addEventListener('keyup', e => { if (e.key === 'Shift') { shiftDown = false; syncTip(); } });
addEventListener('blur', () => { shiftDown = false; syncTip(); });

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

if ($('src').value.trim()) $('badge').textContent = 'not updated'; // nothing runs until you press Update now