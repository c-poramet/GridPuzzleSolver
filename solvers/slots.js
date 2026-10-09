/* Slots/Mastermind execution engine. */
window.GSSolvers = window.GSSolvers || {};
GSSolvers.runSlots = function runSlots(L, out, thr, lm) {
  const fail = (m, n) => { throw new GSError(m, n); };
  const decls = L.map((x, i) => {
    const m = x.t.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:\[([a-z]+)\]\s*)?(\d+)\s+slots?\s+from\s+(.+?)\s*(?:(unique|repeat)\s*)?$/i);
    return m ? { x, i, name: m[1], tag: m[2] || '', n: +m[3], source: m[4].trim(), mode: (m[5] || 'repeat').toLowerCase() } : null;
  }).filter(Boolean);
  if (!decls.length) return false;
  if (decls.length > 1) fail('Only one slots declaration is supported per program', decls[1].x.n);
  const d = decls[0];
  if (d.n < 1 || d.n > 12) fail('Slot count must be between 1 and 12', d.x.n);
  let alpha = [], r = d.source.match(/^(-?\d+(?:\.\d+)?)\s*\.\.\.?\s*(-?\d+(?:\.\d+)?)$/);
  if (r) {
    const a = +r[1], b = +r[2];
    if (a > b || !Number.isInteger(a) || !Number.isInteger(b)) fail('Slot alphabet range must ascend through integer values', d.x.n);
    if (b - a > 32) fail('Slot alphabet is too large (maximum 33 values)', d.x.n);
    alpha = Array.from({ length: b - a + 1 }, (_, i) => a + i);
  } else {
    const builtin = d.source.toLowerCase();
    if (builtin === 'digits') alpha = Array.from({ length: 10 }, (_, i) => i);
    else if (builtin === 'binary') alpha = [0, 1];
    else if (builtin === 'alphabet' || builtin === 'letters') alpha = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
    const raw = d.source.replace(/^[\[{]\s*|\s*[\]}]$/g, '').split(/[\s,]+/).filter(Boolean);
    if (alpha.length) { /* named built-in alphabet */ }
    else {
    if (!raw.length) fail('Slots need a non-empty alphabet', d.x.n);
    alpha = raw.map(v => /^-?\d+(?:\.\d+)?$/.test(v) ? +v : v.replace(/^"|"$/g, ''));
    if (new Set(alpha.map(String)).size !== alpha.length) fail('Slot alphabet contains duplicates', d.x.n);
    }
  }
  if (d.mode === 'unique' && d.n > alpha.length) fail('Unique slots need at least as many alphabet values as slots', d.x.n);
  const key = v => typeof v === 'number' ? String(v) : String(v).toLowerCase();
  const same = (a, b) => key(a) === key(b);
  const candidates = [];
  const make = a => {
    if (a.length === d.n) { candidates.push(a.slice()); return; }
    for (const v of alpha) if (d.mode !== 'unique' || !a.some(x => same(x, v))) make(a.concat([v]));
  };
  make([]);
  const fmtCode = a => a.map(v => String(v)).join(' ');
  const parseCode = (s, n) => {
    let raw = s.replace(/^[=:]\s*/, '').trim().replace(/^[\[(]|[\])]$/g, '').split(/[\s,]+/).filter(Boolean);
    if (raw.length === 1 && n > 1 && raw[0].length === n && alpha.every(v => String(v).length === 1)) raw = raw[0].split('');
    if (raw.length !== n) fail(`Expected ${n} slot values, got ${raw.length}`, currentLine);
    return raw.map(v => {
      const q = alpha.find(x => same(x, /^-?\d+(?:\.\d+)?$/.test(v) ? +v : v.replace(/^"|"$/g, '')));
      if (q === undefined) fail(`"${v}" is not in the slot alphabet`, currentLine);
      return q;
    });
  };
  const score = (guess, secret) => {
    let exact = 0; const leftG = [], leftS = [];
    for (let i = 0; i < d.n; i++) if (same(guess[i], secret[i])) exact++; else { leftG.push(guess[i]); leftS.push(secret[i]); }
    let misplaced = 0;
    for (const v of leftG) { const j = leftS.findIndex(x => same(x, v)); if (j >= 0) { misplaced++; leftS.splice(j, 1); } }
    return { exact, misplaced };
  };
  let pool = candidates, lastGuess = null, currentLine = d.x.n;
  const rows = [`<div class="stats-bar"><div class="stat-chip"><span class="stat-val">${candidates.length.toLocaleString()}</span><span class="stat-lbl">Start</span></div></div>`];
  const addStep = (x, text) => rows.push(`<div class="step animate-in" data-line="${x.n}"><div class="step-head"><span class="step-n">${rows.length}</span><code class="step-clue">${GSEsc(x.t)}</code><span class="step-count">${pool.length.toLocaleString()} left</span></div><div class="chips"><span class="chip">${GSEsc(text)}</span></div></div>`);
  const filter = (pred, x, text) => { pool = pool.filter(pred); addStep(x, text); if (!pool.length) fail(`Contradiction: no slot arrangement satisfies this line`, x.n); };
  const parseFeedback = text => {
    const clean = text.replace(/,/g, ' ').trim();
    if (/^none$/i.test(clean)) return { exact: 0, misplaced: 0 };
    const compact = clean.match(/^(?:(\d+)(?:\s*)e)?(?:(\d+)(?:\s*)n)?(?:(\d+)(?:\s*)x)?$/i);
    if (compact && compact[0]) {
      const exact = compact[1] == null ? 0 : +compact[1];
      const misplaced = compact[2] == null ? 0 : +compact[2];
      const none = compact[3] == null ? d.n - exact - misplaced : +compact[3];
      if (exact + misplaced + none > d.n) fail('Feedback counts exceed slot count', currentLine);
      return { exact, misplaced };
    }
    const parts = [...clean.matchAll(/(\d+)\s*(exact|correct|e|misplaced|present|near|n|yellow)/ig)];
    if (!parts.length) fail('Feedback needs counts such as "1 exact, 2 near" or "1e2n"', currentLine);
    let exact = 0, misplaced = 0;
    for (const part of parts) {
      const value = +part[1], word = part[2].toLowerCase();
      if (/^(exact|correct|e)$/.test(word)) exact = value;
      else misplaced = value;
    }
    if (exact + misplaced > d.n) fail('Feedback counts exceed slot count', currentLine);
    return { exact, misplaced };
  };
  for (const x of L) {
    currentLine = x.n;
    if (x === d.x || /^(SETUP|START|SOLVE|THRESHOLD|LISTMAX)\b/i.test(x.t)) continue;
    let m;
    if ((m = x.t.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+(.+?)\s*:=\s*(.+)$/i))) {
      const lhs = m[1].trim(), guessText = m[2].trim();
      if (lhs.toLowerCase() !== d.name.toLowerCase()) fail(`Unknown slots category "${lhs}"`, x.n);
      if (/^slot(?:\d+|\(\d+\)|\[\d+\])$/i.test(guessText)) {
        fail('A guess must contain slot values, not a slot reference', x.n);
      } else {
        const feedback = m[3].trim();
        lastGuess = parseCode(guessText, d.n);
        const scoreTarget = parseFeedback(feedback);
        filter(s => {
          const scoreValue = score(lastGuess, s);
          return scoreValue.exact === scoreTarget.exact && scoreValue.misplaced === scoreTarget.misplaced;
        }, x, `Guess ${fmtCode(lastGuess)}: ${scoreTarget.exact} exact, ${scoreTarget.misplaced} near`);
      }
      continue;
    }
    if ((m = x.t.match(/^(?:GUESS\s+)?(.+?)\s*:=\s*(.+)$/i))) {
      const lhs = m[1].trim(), rhs = m[2].trim();
      if (/^slot(?:\d+|\(\d+\)|\[\d+\])$/i.test(lhs)) {
        const q = lhs.match(/\d+/)[0] - 1; if (q < 0 || q >= d.n) fail(`Slot reference "${lhs}" is out of range`, x.n);
        const v = parseCode(rhs, 1)[0]; filter(s => same(s[q], v), x, `${lhs} = ${v}`);
      } else { lastGuess = parseCode(lhs, d.n); addStep(x, `Guess ${fmtCode(lastGuess)} recorded`); }
      continue;
    }
    if ((m = x.t.match(/^GUESS\s+(.+)$/i))) { lastGuess = parseCode(m[1], d.n); addStep(x, `Guess ${fmtCode(lastGuess)} recorded`); continue; }
    if ((m = x.t.match(/^FEEDBACK\s+(.+)$/i))) {
      if (!lastGuess) fail('FEEDBACK needs a preceding GUESS or := line', x.n);
      const nums = [...m[1].matchAll(/(\d+)\s*(exact|correct|green|misplaced|present|yellow)|\b(exact|correct|green|misplaced|present|yellow)\s*(\d+)/ig)];
      if (!nums.length) fail('Feedback needs counts such as "1 exact, 2 misplaced"', x.n);
      let ex, mis; for (const z of nums) { const word = z[2] || z[3], val = +(z[1] || z[4]); if (/exact|correct|green/i.test(word)) ex = val; else mis = val; }
      if (ex == null) ex = 0; if (mis == null) mis = 0;
      if (ex < 0 || mis < 0 || ex + mis > d.n) fail('Feedback counts exceed slot count', x.n);
      filter(s => { const z = score(lastGuess, s); return z.exact === ex && z.misplaced === mis; }, x, `Feedback: ${ex} exact, ${mis} misplaced`);
      continue;
    }
    if ((m = x.t.match(/^has\s+(.+)$/i))) { const v = parseCode(m[1], 1)[0]; filter(s => s.some(q => same(q, v)), x, `Has ${v}`); continue; }
    if ((m = x.t.match(/^lacks?\s+(.+)$/i))) { const v = parseCode(m[1], 1)[0]; filter(s => !s.some(q => same(q, v)), x, `Lacks ${v}`); continue; }
    if ((m = x.t.match(/^(even|odd)\s+(slot(?:\d+|\(\d+\)|\[\d+\]))$/i))) {
      const q = +m[2].match(/\d+/)[0] - 1; if (q < 0 || q >= d.n) fail(`Slot reference "${m[2]}" is out of range`, x.n);
      filter(s => typeof s[q] === 'number' && (Math.abs(s[q]) % 2 === (m[1].toLowerCase() === 'odd' ? 1 : 0)), x, `${m[1]} ${m[2]}`); continue;
    }
    if ((m = x.t.match(/^(?:formula\s+)?(slot(?:\d+|\(\d+\)|\[\d+\]))\s*([+\-*\/])\s*(slot(?:\d+|\(\d+\)|\[\d+\])|-?\d+(?:\.\d+)?)\s*(=|!=|<|>|<=|>=)\s*(-?\d+(?:\.\d+)?)$/i))) {
      const q = +m[1].match(/\d+/)[0] - 1, q2 = /^slot/i.test(m[3]) ? +m[3].match(/\d+/)[0] - 1 : -1;
      if (q < 0 || q >= d.n || q2 >= d.n) fail(`Slot reference is out of range`, x.n);
      const op = m[4], rhs = +m[5], ok = (v => op === '=' ? Math.abs(v - rhs) < 1e-9 : op === '!=' ? Math.abs(v - rhs) >= 1e-9 : op === '<' ? v < rhs : op === '>' ? v > rhs : op === '<=' ? v <= rhs + 1e-9 : v >= rhs - 1e-9);
      const apply = (a, b) => m[2] === '+' ? a + b : m[2] === '-' ? a - b : m[2] === '*' ? a * b : b === 0 ? NaN : a / b;
      filter(s => typeof s[q] === 'number' && (q2 < 0 ? ok(apply(s[q], +m[3])) : typeof s[q2] === 'number' && ok(apply(s[q], s[q2]))), x, `Formula ${m[1]} ${m[2]} ${m[3]} ${op} ${rhs}`); continue;
    }
    fail('Unsupported slots line; use :=, GUESS, FEEDBACK, has, lacks, even, odd, or formula', x.n);
  }
  rows.push(`<div class="stats-bar stats-final"><div class="stat-chip green"><span class="stat-val">${pool.length.toLocaleString()}</span><span class="stat-lbl">Remaining</span></div></div>`);
  if (pool.length && pool.length <= lm) {
    const head = Array.from({ length: d.n }, (_, i) => `<th scope="col"><span class="ch-in"><span class="ch-name">Slot ${i + 1}</span></span></th>`).join('');
    const body = pool.map((code, row) => `<tr><th scope="row">${row + 1}</th>${code.map(value => `<td><span class="slot-cell">${GSEsc(value)}</span></td>`).join('')}</tr>`).join('');
    rows.push(`<div class="answer slot-answer"><div class="answer-head"><span class="answer-title${pool.length === 1 ? '' : ' part'}">${pool.length === 1 ? 'Solution' : 'Remaining candidates'}</span><span class="answer-hint">${pool.length === 1 ? 'Each column is one slot' : `${pool.length} possible codes`}</span></div><div class="answer-scroll"><table class="grid slot-grid"><thead><tr><th scope="col">#</th>${head}</tr></thead><tbody>${body}</tbody></table></div></div>`);
  }
  if (!pool.length) return true;
  rows.push(`<div class="solved-banner">${pool.length <= thr ? 'Slot solution found' : `${pool.length.toLocaleString()} slot arrangements remain`}</div>`);
  out.innerHTML = rows.join('');
  $('badge').textContent = pool.length.toLocaleString() + ' left';
  return true;
}

// kind: 0 exact · 1 beyond exact precision · 2 lower bound (search budget ran out) · 3 estimate
const fmt = (n, kind = 0) => {
  const big = n >= 1e15, s = kind === 0 && !big ? n.toLocaleString() : n < 1e9 ? Math.round(+n.toPrecision(3)).toLocaleString() : n.toExponential(2).replace('e+', '×10^');
  return (kind === 2 ? '≥ ' : kind ? '≈ ' : big ? '≈ ' : '') + s;
};

/* ───────── plain-language tooltip: only while hovering a clue AND holding Shift ───────── */
let TIPS = [];
let hoverStep = null, shiftDown = false, lastPt = { clientX: 0, clientY: 0 }, curTip = -1;
const tipEl = document.createElement('div');
tipEl.className = 'tip';
tipEl.setAttribute('role', 'tooltip');
tipEl.hidden = true;
document.body.appendChild(tipEl);
const placeTip = pt => {
  const pad = 16, w = tipEl.offsetWidth, h = tipEl.offsetHeight;
  let x = pt.clientX + pad, y = pt.clientY + pad;
  if (x + w > innerWidth - 8) x = Math.max(8, pt.clientX - w - pad);
  if (y + h > innerHeight - 8) y = Math.max(8, pt.clientY - h - pad);
  tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
};
const hideTip = () => { tipEl.hidden = true; curTip = -1; };
const syncTip = () => {
  const i = hoverStep && shiftDown ? +hoverStep.dataset.tip : -1;
  if (!(i >= 0) || !TIPS[i]) return hideTip();
  if (curTip !== i) {
    tipEl.innerHTML = `<div class="tip-h"><span class="tip-n">Clue ${i + 1}</span><span class="tip-k">in plain words</span></div><div class="tip-b">${GSEsc(TIPS[i])}</div>`;
    curTip = i;
  }
  tipEl.hidden = false; placeTip(lastPt);
};
const setTags = (t, l) => { $('tagThr').textContent = 'THRESHOLD ' + t; $('tagList').textContent = 'LISTMAX ' + l; };

