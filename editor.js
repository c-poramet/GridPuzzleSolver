'use strict';
/* Grid Solver: GSL code editor
   A transparent <textarea id="src"> sits on top of a highlighted mirror, so
   solver.js keeps reading $('src').value exactly as before. */
(() => {
const $ = id => document.getElementById(id);
const ta = $('src'), root = $('editor'), hl = $('edHl'), bars = $('edBars'), gut = $('edGut'),
  gutter = root.querySelector('.ed-gutter'), pop = $('ac'), legend = $('legend'),
  stMode = $('stMode'), stPos = $('stPos'), stMsg = $('stMsg');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const injectedStyle = document.createElement('style');
injectedStyle.textContent = '.ed-fixes{position:fixed;z-index:100;background:#252525;border:1px solid rgba(201,127,80,.55);border-radius:8px;padding:4px;box-shadow:0 8px 24px #000;display:flex;flex-direction:column;gap:2px}.ed-fixes button{background:none;border:0;color:#f0f0f0;padding:7px 10px;text-align:left;font:12px "Space Mono",monospace;cursor:pointer}.ed-fixes button:hover,.ed-fixes button:focus{background:rgba(201,127,80,.2);outline:0}';
document.head.appendChild(injectedStyle);

const SETTINGS_KEY = 'gridsolver.settings';
const DEFAULT_SETTINGS = {
  theme: 'dark', contrast: 100, font: 100, lines: true, motion: false,
  keys: { solve: 'mod+enter', autocomplete: 'mod+space', fixes: 'mod+.', normalize: 'mod+alt+n', comment: 'mod+/', wrap: 'alt+z' }
};
const KEY_OPTIONS = [
  ['mod+enter', 'Ctrl/⌘ Enter'], ['mod+space', 'Ctrl/⌘ Space'], ['mod+.', 'Ctrl/⌘ .'],
  ['mod+alt+n', 'Ctrl/⌘ Alt N'], ['mod+/', 'Ctrl/⌘ /'], ['alt+z', 'Alt Z'], ['off', 'Disabled']
];
function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return { ...DEFAULT_SETTINGS, ...saved, keys: { ...DEFAULT_SETTINGS.keys, ...(saved.keys || {}) } };
  } catch (e) { return { ...DEFAULT_SETTINGS, keys: { ...DEFAULT_SETTINGS.keys } }; }
}
const settings = loadSettings();
const saveSettings = () => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {} };
const keyMatches = (name, e) => {
  const spec = settings.keys[name]; if (!spec || spec === 'off') return false;
  const pieces = spec.split('+');
  const [mods, key] = pieces.length > 1 ? [pieces.slice(0, -1), pieces[pieces.length - 1]] : [[], spec];
  return (mods.includes('mod') ? (e.ctrlKey || e.metaKey) : !e.ctrlKey && !e.metaKey)
    && (mods.includes('alt') ? e.altKey : !e.altKey)
    && (mods.includes('shift') ? e.shiftKey : !e.shiftKey)
    && (key === 'enter' ? e.key === 'Enter' : key === 'space' ? (e.code === 'Space' || e.key === ' ') : key === e.key.toLowerCase());
};
window.GSSettings = { keyMatches, label(name) { return KEY_OPTIONS.find(x => x[0] === settings.keys[name])?.[1] || 'Disabled'; } };
function applySettings() {
  const paper = settings.theme === 'paper' || (settings.theme === 'system' && matchMedia('(prefers-color-scheme: light)').matches);
  document.body.classList.toggle('theme-midnight', settings.theme === 'midnight');
  document.body.classList.toggle('theme-paper', paper);
  document.body.classList.toggle('high-contrast', Number(settings.contrast) >= 120);
  document.body.classList.toggle('no-lines', !settings.lines);
  document.body.classList.toggle('reduce-motion', settings.motion);
  document.documentElement.style.setProperty('--ui-scale', `${Number(settings.font) / 100}`);
  document.documentElement.style.filter = `contrast(${Number(settings.contrast) / 100})`;
}
function initSettings() {
  const popover = $('settingsPop'), button = $('settingsBtn');
  if (!popover || !button) return;
  popover.querySelectorAll('select[data-setting-key]').forEach(select => {
    const key = select.dataset.settingKey;
    KEY_OPTIONS.forEach(([value, label]) => select.add(new Option(label, value)));
    select.value = settings.keys[key] || 'off';
    select.addEventListener('change', () => { settings.keys[key] = select.value; saveSettings(); });
  });
  const theme = $('settingTheme'), contrast = $('settingContrast'), font = $('settingFont');
  const lines = $('settingLines'), motion = $('settingMotion');
  theme.value = settings.theme; contrast.value = settings.contrast; font.value = settings.font;
  lines.checked = settings.lines; motion.checked = settings.motion;
  const sync = () => {
    $('settingContrastValue').value = `${contrast.value}%`; $('settingFontValue').value = `${font.value}%`;
    settings.theme = theme.value; settings.contrast = +contrast.value; settings.font = +font.value;
    settings.lines = lines.checked; settings.motion = motion.checked; saveSettings(); applySettings(); measure(); paint();
  };
  [theme, contrast, font, lines, motion].forEach(x => x.addEventListener('input', sync));
  [theme, lines, motion].forEach(x => x.addEventListener('change', sync));
  $('settingsReset').addEventListener('click', () => {
    Object.assign(settings, { ...DEFAULT_SETTINGS, keys: { ...DEFAULT_SETTINGS.keys } }); saveSettings();
    popover.querySelectorAll('select[data-setting-key]').forEach(x => { x.value = settings.keys[x.dataset.settingKey]; });
    theme.value = settings.theme; contrast.value = settings.contrast; font.value = settings.font; lines.checked = settings.lines; motion.checked = settings.motion; sync();
  });
  const toggle = on => { popover.hidden = !on; button.setAttribute('aria-expanded', String(on)); };
  button.addEventListener('click', e => { e.stopPropagation(); toggle(popover.hidden); });
  document.addEventListener('click', e => { if (!popover.hidden && !popover.contains(e.target) && e.target !== button) toggle(false); });
  applySettings(); sync();
}

/* ───────── language data ───────── */
const SECTION = ['SETUP', 'START', 'SOLVE'];
const SETTINGS = ['THRESHOLD', 'LISTMAX', 'DEFAULT UNIT', 'UNIT'];
const GATES = ['and', 'or', 'xor', 'nand', 'nor', 'xnor'];
const GATES2 = ['before', 'right', 'beside', 'adj', 'between', 'apart', 'within', 'first', 'last', 'at', 'opposite', 'in'];
const PREFIX = ['each', 'exactly', 'atleast', 'atmost', 'alldiff', 'allsame', 'total', 'sum', 'avg', 'max', 'min'];
const MODIFIERS = ['ordered', 'circular', 'unordered'];
const SETS = ['DAYS', 'WEEKDAYS', 'MONTHS', 'SEASONS', 'ZODIAC'];
const RESERVED = new Set('setup start solve threshold listmax proceed of and or xor not nand nor xnor then after before right beside adj between apart within first last at opposite in each exactly atleast atmost alldiff allsame total sum avg max min'.split(' '));
const PALETTE = ['#6ca965', '#6fa3d0', '#a58bc4', '#d27d8f', '#4fb3b3', '#b8a78a'];
const KW_COLOR = '#8fb7d4', GATE_COLOR = 'var(--clr-yellow)', SEC_COLOR = 'var(--accent)';
const MODE_NAME = ['—', 'SETUP', 'START', 'SOLVE'];

const stripC = l => { const i = l.indexOf('//'); return i < 0 ? l : l.slice(0, i); };
const fmtNum = x => String(Math.round(x * 1e6) / 1e6);
const fact = n => { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; };

/* ───────── analysis (mirrors solver.js rules, but never throws) ───────── */
function numericVals(tokens, N) {
  const nums = tokens.filter(x => x !== '...');
  if (!nums.length || nums.some(x => isNaN(x))) return null;
  const v = nums.map(Number), t = tokens, i = t.indexOf('...');
  if (i < 0) return { vals: v, labels: tokens.slice() };
  let a = null;
  if (N > 1) {
    if (i === 0 && v.length >= 2) { const s = v[v.length - 1] - v[v.length - 2]; a = v.slice(); while (a.length < N) a.unshift(a[0] - s); }
    else if (i === t.length - 1 && v.length >= 2) { const s = v[1] - v[0]; a = v.slice(); while (a.length < N) a.push(a[a.length - 1] + s); }
    else if (t.length === 3 && i === 1) { const s = (v[1] - v[0]) / (N - 1); a = Array.from({ length: N }, (_, k) => v[0] + s * k); }
  }
  a = a ? a.map(x => Math.round(x * 1e6) / 1e6) : v;
  return { vals: a, labels: a.map(fmtNum) };
}

const LEX = /(\s+)|(<=>|=>|!=|<=|>=|[=<>+\-*\/~])|([(){}\[\],:])|([tT][hH][eE][nN]\+)|(\.\.\.?|\.\.)|(\d*\?)|("(?:\\"|[^"])*"|'s\b|\.?[A-Za-z_][A-Za-z0-9_.']*|\.?\d+(?:\.\d+)?[A-Za-z]+|\.?\d+(?:\.\d+)?)|(.)/g;
function lex(code) {
  const out = []; let m; LEX.lastIndex = 0;
  while ((m = LEX.exec(code))) {
    const k = m[1] ? 'ws' : m[2] ? 'op' : m[3] ? 'br' : m[4] ? 'then' : m[5] ? 'dots' : m[6] ? 'ph' : m[7] ? 'word' : 'other';
    out.push({ k, t: m[0], s: m.index });
  }
  return out;
}

function analyze(text) {
  const raw = text.split('\n');
  const lines = raw.map(() => ({ kind: 'blank', mode: 0, toks: [], issues: [] }));
  const cats = [];
  let mode = 0;

  // pass 1: sections + categories
  raw.forEach((l, i) => {
    const code = stripC(l).trim(), u = code.toUpperCase(), L = lines[i];
    if (!code) { L.mode = mode; return; }
    if (mode === 3) { L.kind = 'ignored'; L.mode = 3; return; }
    if (u === 'SETUP') { mode = 1; L.kind = 'sec'; L.mode = 1; return; }
    if (u === 'START') { mode = 2; L.kind = 'sec'; L.mode = 2; return; }
    if (u === 'SOLVE') { mode = 3; L.kind = 'sec'; L.mode = 3; return; }
    L.mode = mode;
    if (/^(THRESHOLD|LISTMAX)\s*=\s*\d+$/i.test(code) || /^(?:DEFAULT\s+UNIT|UNIT)\s*=\s*[A-Za-z][A-Za-z0-9_]*$/i.test(code)) { L.kind = 'set'; return; }
    if (mode === 0) { L.kind = 'stray'; return; }
    if (mode === 1) {
      const m = code.match(/^(\S+)\s*(?:\[([^\]]*)\])?\s*(.*)$/);
      if (!m) { L.kind = 'catbad'; return; }
      const cat = { name: m[1], tag: m[2], tokens: m[3].split(/\s+/).filter(Boolean), line: i, color: PALETTE[cats.length % PALETTE.length] };
      cats.push(cat); L.kind = 'cat'; L.cat = cat; return;
    }
    L.kind = 'clue';
  });

  const full = cats.find(c => !c.tokens.includes('...'));
  const N = full ? full.tokens.length : null;
  cats.forEach(c => {
    const nv = numericVals(c.tokens, N);
    if (nv) { c.num = true; c.vals = nv.vals; c.valSet = new Set(nv.vals); c.items = nv.labels; }
    else { c.num = false; c.items = c.tokens.filter(x => x !== '...'); }
    c.validTag = /^[a-z]+$/.test(c.tag);
  });
  const tagMap = new Map();
  const reserved = new Set(cats.filter(c => c.validTag).map(c => c.tag));
  cats.forEach(c => {
    if (!c.tag) {
      const base = c.name.toLowerCase().replace(/[^a-z]/g, '') || 'a';
      for (let n = 1; n <= base.length; n++) {
        const candidate = base.slice(0, n);
        if (!reserved.has(candidate) && !cats.some(x => x !== c && x.name.toLowerCase() === candidate)) { c.tag = candidate; c.autoTag = true; reserved.add(candidate); break; }
      }
    }
    c.validTag = /^[a-z]+$/.test(c.tag);
    if (c.validTag && !tagMap.has(c.tag)) tagMap.set(c.tag, c);
  });

  // pass 2: tokens + lint
  const tk = (L, s, t, cls, extra) => { if (t !== '') L.toks.push(Object.assign({ s, t, cls: cls || '' }, extra)); };
  const bad = (L, s, t, msg, cls, extra) => {
    const meta = Object.assign({ bad: true }, extra);
    tk(L, s, t, cls, meta);
    L.issues.push({ s, e: s + t.length, msg, fixes: meta.fixes || [] });
  };

  raw.forEach((l, i) => {
    const L = lines[i], ci = l.indexOf('//'), code = ci < 0 ? l : l.slice(0, ci);
    const lead = code.match(/^\s*/)[0], core = code.trim(), trail = code.slice(lead.length + core.length);
    switch (L.kind) {
      case 'blank': tk(L, 0, code, ''); break;
      case 'ignored': tk(L, 0, code, 't-dim'); break;
      case 'sec': tk(L, 0, lead, ''); tk(L, lead.length, core, 't-sec'); tk(L, lead.length + core.length, trail, ''); break;
      case 'stray': tk(L, 0, lead, ''); bad(L, lead.length, core, 'Begin with SETUP', 't-id'); tk(L, lead.length + core.length, trail, ''); break;
      case 'catbad': tk(L, 0, lead, ''); bad(L, lead.length, core, 'Expected: name [tag] items…', 't-id'); tk(L, lead.length + core.length, trail, ''); break;
      case 'set': {
        const m = code.match(/^(\s*)(DEFAULT\s+UNIT|UNIT|THRESHOLD|LISTMAX)(\s*)(=)(\s*)(\d+|[A-Za-z][A-Za-z0-9_]*)(\s*)$/i);
        let p = 0;
        [[m[1], ''], [m[2], 't-set'], [m[3], ''], [m[4], 't-op'], [m[5], ''], [m[6], 't-num'], [m[7], '']].forEach(([t, c]) => { tk(L, p, t, c); p += t.length; });
        break;
      }
      case 'cat': {
        const c = L.cat, m = code.match(/^(\s*)(\S+)(?:\s*\[([^\]]*)\])?(\s*)(.*)$/);
        if (!m) { bad(L, 0, code, 'Expected: name [tag] items…', 't-id'); break; }
        const style = '--c:' + c.color;
        let p = 0;
        tk(L, p, m[1], ''); p += m[1].length;
        const nameProblems = [];
        if (RESERVED.has(c.name.toLowerCase())) nameProblems.push(`"${c.name}" is a reserved word`);
        if (!c.tokens.length) nameProblems.push(`Category "${c.name}" has no items`);
        else if (N && !c.tokens.includes('...') && c.tokens.length !== N) nameProblems.push(`"${c.name}" has ${c.tokens.length} items but the grid size is ${N}`);
        if (nameProblems.length) bad(L, p, m[2], nameProblems[0], 't-cname', { style }); else tk(L, p, m[2], 't-cname', { style });
        p += m[2].length;
        tk(L, p, m[4] || '', ''); p += (m[4] || '').length;
        if (m[3] != null) {
          tk(L, p, '[', 't-br', { br: true }); p++;
          const tagBad = !c.validTag ? `Tag [${c.tag}] must be one or more lowercase letters` : tagMap.get(c.tag) !== c ? `Tag [${c.tag}] is already used` : '';
          if (tagBad) bad(L, p, m[3], tagBad, 't-tagdef', { style }); else tk(L, p, m[3], 't-tagdef', { style });
          p += m[3].length; tk(L, p, ']', 't-br', { br: true }); p++;
        }
        const rest = m[5], seen = new Set();
        let last = 0, r; const re = /\S+/g;
        while ((r = re.exec(rest))) {
          tk(L, p + last, rest.slice(last, r.index), ''); last = r.index + r[0].length;
          const w = r[0], at = p + r.index;
          if (w === '...' || w === '..' || SETS.includes(w.toUpperCase()) || /^(ordered|circular|unordered|step)$/i.test(w)) { tk(L, at, w, w === '...' || w === '..' ? 't-dots' : 't-kw'); continue; }
          let msg = '';
          if (!c.num) {
            if (!/^(?:"(?:\\"|[^"])*"|[A-Za-z][A-Za-z0-9_]*|[-+]?\d+(?:\.\d+)?)$/.test(w)) msg = `Bad item name "${w}"`;
            else if (RESERVED.has(w.toLowerCase())) msg = `"${w}" is a reserved word`;
            else if (seen.has(w)) msg = `Duplicate item "${w}"`;
            seen.add(w);
          }
          if (msg) bad(L, at, w, msg, 't-item', { style }); else tk(L, at, w, 't-item', { style });
        }
        tk(L, p + last, rest.slice(last), '');
        break;
      }
      case 'clue': {
        const toks = lex(code), sig = toks.filter(t => t.k !== 'ws');
        sig.forEach((t, j) => { t.prev = sig[j - 1]; t.next = sig[j + 1]; });
        const have = cats.length > 0;
        toks.forEach(t => {
          switch (t.k) {
            case 'ws': tk(L, t.s, t.t, ''); return;
            case 'op': tk(L, t.s, t.t, 't-op'); return;
            case 'br': tk(L, t.s, t.t, 't-br', { br: true }); return;
            case 'then': tk(L, t.s, t.t, 't-kw'); return;
            case 'ph': tk(L, t.s, t.t, 't-ph'); return;
            case 'dots': bad(L, t.s, t.t, 'Unknown word "..." (only valid in SETUP)', 't-id'); return;
            case 'other': bad(L, t.s, t.t, `Unexpected character "${t.t}"`, 't-id'); return;
          }
          const w = t.t, lw = w.toLowerCase();
          if (GATES.includes(lw) || lw === 'not') { tk(L, t.s, w, 't-gate'); return; }
          if (GATES2.includes(lw) || PREFIX.includes(lw) || MODIFIERS.includes(lw) || SETS.includes(w.toUpperCase()) || ['step', 'default', 'unit'].includes(lw)) { tk(L, t.s, w, 't-kw'); return; }
          if (lw === 'then') { tk(L, t.s, w, 't-kw'); return; }
          if (lw === 'of') {
            const p = t.prev;
            if (!p || p.k !== 'word' || !/^[a-z]$/.test(p.t)) bad(L, t.s, w, '"of" needs a tag before it, like "b of Id"', 't-kw');
            else tk(L, t.s, w, 't-kw');
            return;
          }
          if (RESERVED.has(lw)) { bad(L, t.s, w, `Unexpected "${w}" here. Statements joined by gates need parentheses`, 't-id'); return; }
          if (/^\d/.test(w)) {
            const m = w.match(/^(\d+(?:\.\d+)?)([a-z]+)?$/);
            if (!m) { bad(L, t.s, w, `Bad number "${w}"`, 't-num'); return; }
            if (!m[2]) { tk(L, t.s, w, 't-num'); return; }
            if (!have) { tk(L, t.s, w, 't-num'); return; }
            const c = tagMap.get(m[2]);
            if (!c || (!c.num && !c.ordered)) { bad(L, t.s, w, `"${m[2]}" is not an order-capable tag`, 't-num'); return; }
            const valid = c.num ? c.valSet.has(+m[1]) : Number.isInteger(+m[1]) && +m[1] >= 1 && +m[1] <= c.items.length;
            if (!valid) { bad(L, t.s, w, `${m[1]} is not a value of ${c.name} (${c.items.join(', ')})`, 't-num'); return; }
            tk(L, t.s, w, 't-ent', { style: '--c:' + c.color, parts: [m[1], m[2]] });
            return;
          }
          if (!have) { tk(L, t.s, w, 't-id'); return; }
          if (/^[a-z]+$/.test(w)) {
            const c = tagMap.get(w) || cats.find(x => x.name.toLowerCase() === lw);
            if (!c) bad(L, t.s, w, `Unknown tag "${w}"`, 't-id');
            else if (!t.next || t.next.t.toLowerCase() !== 'of') bad(L, t.s, w, `Tag "${w}" alone means a category; use "${w} of X"`, 't-tag', { style: '--c:' + c.color });
            else tk(L, t.s, w, 't-tag', { style: '--c:' + c.color });
            return;
          }
          const bare = cats.filter(x => x.items.some(it => String(it).toLowerCase() === lw || String(it).split('/').some(a => a.toLowerCase() === lw)));
          const suffix = cats.filter(x => x.validTag && x.items.some(it => String(it).toLowerCase() === w.slice(0, -x.tag.length).toLowerCase()) && w.toLowerCase().endsWith(x.tag));
          const matches = [...new Map([...bare, ...suffix].map(x => [x.name.toLowerCase(), x])).values()];
          if (matches.length === 1) tk(L, t.s, w, 't-ent', { style: '--c:' + matches[0].color });
          else if (matches.length > 1) bad(L, t.s, w, `Ambiguous "${w}": ${matches.map(x => `${x.name} [${x.tag || 'untagged'}]`).join(', ')}`, 't-id');
          else {
            const suggestions = cats.flatMap(x => x.items.filter(it => String(it).toLowerCase().startsWith(lw.slice(0, 2))).slice(0, 3)
              .map(it => ({ label: `Use ${it}${x.tag}`, edits: [{ line: i + 1, start: t.s + 1, end: t.s + w.length, text: String(it) + x.tag }] })));
            bad(L, t.s, w, `Unknown word "${w}"`, 't-id', { fixes: suggestions });
          }
        });
        break;
      }
    }
    if (ci >= 0) tk(L, ci, l.slice(ci), 't-cmt');
  });

  return { lines, cats, tagMap, N };
}

/* ───────── state + metrics ───────── */
let A = analyze(ta.value);
let lh = 21, padX = 14, padY = 12, cw = 8;
let wrap = false, tops = [], hts = []; // per-line top/height (px, relative to the text area padding)
let err = null, peekLine = null, flashLine = null, internal = false;

function measure() {
  const cs = getComputedStyle(ta);
  lh = parseFloat(cs.lineHeight) || 21; padX = parseFloat(cs.paddingLeft) || 14; padY = parseFloat(cs.paddingTop) || 12;
  const s = document.createElement('span');
  s.textContent = 'M'.repeat(64);
  s.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:inherit;letter-spacing:normal';
  root.appendChild(s);
  cw = s.getBoundingClientRect().width / 64 || 8;
  s.remove();
}

function caret() {
  const v = ta.value, p = ta.selectionStart;
  let line = 0, ls = 0;
  for (let i = v.indexOf('\n'); i >= 0 && i < p; i = v.indexOf('\n', i + 1)) { line++; ls = i + 1; }
  return { p, line, col: p - ls, ls };
}
function lineBounds(idx) {
  const parts = ta.value.split('\n'); let s = 0;
  for (let i = 0; i < idx && i < parts.length; i++) s += parts[i].length + 1;
  return [s, s + (parts[idx] || '').length];
}

/* ───────── painting ───────── */
function bracketMatch() {
  if (ta.selectionStart !== ta.selectionEnd) return null;
  const c = caret(), v = ta.value;
  let le = v.indexOf('\n', c.p); if (le < 0) le = v.length;
  const line = v.slice(c.ls, le), ci = line.indexOf('//'), code = ci < 0 ? line : line.slice(0, ci);
  const at = i => (i >= 0 && i < code.length && '()[]'.includes(code[i])) ? i : -1;
  let idx = at(c.col - 1); if (idx < 0) idx = at(c.col); if (idx < 0) return null;
  const ch = code[idx], open = '(['.includes(ch), pair = { '(': ')', ')': '(', '[': ']', ']': '[' }[ch], step = open ? 1 : -1;
  let depth = 0;
  for (let j = idx; j >= 0 && j < code.length; j += step) {
    if (code[j] === ch) depth++;
    else if (code[j] === pair && --depth === 0) return { line: c.line, a: idx, b: j };
  }
  return { line: c.line, a: idx, b: -1, bad: true };
}

function tokHtml(t, i, bm) {
  let cls = t.cls || '';
  if (t.bad) cls += ' t-bad';
  if (t.br && bm && bm.line === i && (t.s === bm.a || t.s === bm.b)) cls += bm.bad ? ' bm-bad' : ' bm';
  const inner = t.parts ? `${esc(t.parts[0])}<span class="t-etag">${esc(t.parts[1])}</span>` : esc(t.t);
  cls = cls.trim();
  return cls ? `<span class="${cls}"${t.style ? ` style="${t.style}"` : ''}>${inner}</span>` : inner;
}

function paint() {
  const bm = bracketMatch(), c = caret();
  hl.innerHTML = A.lines.map((L, i) => `<div class="ln">${L.toks.map(t => tokHtml(t, i, bm)).join('')}</div>`).join('');
  root.style.setProperty('--gd', Math.max(2, String(A.lines.length).length));
  layoutLines();
  gut.innerHTML = A.lines.map((L, i) =>
    `<div class="gn${i === c.line ? ' cur' : ''}${L.issues.length ? ' warn' : ''}${err && err.line === i ? ' err' : ''}"${wrap ? ` style="height:${hts[i]}px"` : ''}>${i + 1}</div>`).join('');
  sync();
}

// measure where every source line starts; with word wrap a line can span several rows
function layoutLines() {
  const n = A.lines.length;
  tops = new Array(n); hts = new Array(n);
  const w0 = ta.clientWidth;
  if (!wrap || !w0) {
    hl.style.width = '';
    for (let i = 0; i < n; i++) { tops[i] = i * lh; hts[i] = lh; }
    return;
  }
  for (let pass = 0; pass < 2; pass++) { // 2nd pass: a scrollbar appearing narrows the text area
    const w = ta.clientWidth;
    hl.style.width = w + 'px';
    const rows = hl.children; let y = 0;
    for (let i = 0; i < n; i++) { const h = Math.max(lh, rows[i].offsetHeight); tops[i] = y; hts[i] = h; y += h; }
    if (ta.clientWidth === w) break;
  }
}

// caret position (px, inside the text area padding box) under word wrap
let meas = null;
function wrapXY(pos) {
  if (!meas) {
    meas = document.createElement('div');
    meas.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;white-space:pre-wrap;overflow-wrap:break-word;font:inherit;letter-spacing:normal;tab-size:2;padding:0;border:0;margin:0';
    root.appendChild(meas);
  }
  meas.style.width = Math.max(0, ta.clientWidth - 2 * padX) + 'px';
  meas.textContent = ta.value.slice(0, pos);
  const m = document.createElement('span'); m.textContent = '\u200b'; meas.appendChild(m);
  return { x: m.offsetLeft, y: m.offsetTop };
}

let bPeek, bErr, bFlash, bCur;
(() => {
  const mk = c => { const d = document.createElement('div'); d.className = 'bar ' + c; d.hidden = true; bars.appendChild(d); return d; };
  bPeek = mk('peek'); bErr = mk('err'); bFlash = mk('flash'); bCur = mk('cur');
})();
const place = (el, line) => {
  if (line == null || line >= tops.length) { el.hidden = true; return; }
  el.hidden = false; el.style.top = (padY + tops[line] - ta.scrollTop) + 'px'; el.style.height = hts[line] + 'px';
};
function updateBars() {
  place(bPeek, peekLine); place(bErr, err ? err.line : null); place(bFlash, flashLine);
  place(bCur, ta.selectionStart === ta.selectionEnd && document.activeElement === ta ? caret().line : null);
}
function sync() {
  const x = -ta.scrollLeft, y = -ta.scrollTop;
  hl.style.transform = `translate(${x}px,${y}px)`;
  gut.style.transform = `translateY(${y}px)`;
  updateBars();
  if (ac.open) position();
}

let legendSig = '';
function paintLegend() {
  const sig = A.cats.map(c => c.name + c.tag + c.color).join('|');
  if (sig === legendSig) return;
  legendSig = sig;
  legend.hidden = !A.cats.length;
  legend.innerHTML = A.cats.map((c, i) => `<button type="button" class="legend-chip" data-i="${i}" style="--c:${c.color}" title="Insert an item from ${esc(c.name)}"><i></i>${esc(c.name)} <b>${esc(c.tag)}</b></button>`).join('');
}

function status() {
  const c = caret(), L = A.lines[c.line] || { mode: 0, kind: 'blank', issues: [] };
  const sel = ta.selectionEnd - ta.selectionStart;
  stMode.textContent = L.kind === 'ignored' ? 'IGNORED' : MODE_NAME[L.mode];
  stPos.textContent = `Ln ${c.line + 1}, Col ${c.col + 1}` + (sel ? ` (${sel} selected)` : '');
  let msg = '', warn = false;
  const hit = L.issues.find(x => c.col >= x.s && c.col <= x.e) || L.issues[0];
  if (hit) { msg = hit.msg; warn = true; }
  else if (err && err.line === c.line && err.msg) { msg = err.msg; warn = true; }
  else {
    const k = A.cats.length;
    if (k && A.N && k > 1) {
      const total = Math.pow(fact(A.N), k - 1);
      if (total > 4e6) { msg = `Grid too large: ${total.toLocaleString()} combinations (limit 4,000,000)`; warn = true; }
      else msg = `${k} categories · N = ${A.N} · ${total.toLocaleString()} combos`;
    } else if (k) msg = `${k} categor${k === 1 ? 'y' : 'ies'}${A.N ? ` · N = ${A.N}` : ''}`;
    else msg = 'Ctrl+Space for suggestions';
  }
  stMsg.textContent = msg; stMsg.title = msg; stMsg.classList.toggle('warn', warn);
}

function refresh() { A = analyze(ta.value); paint(); paintLegend(); status(); }
let raf = 0;
const later = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; paint(); status(); }); };

/* ───────── editing helpers ───────── */
function replace(from, to, text, selA, selB) {
  const was = internal; internal = true;
  ta.focus();
  ta.setSelectionRange(from, to);
  let ok = false;
  try { ok = text === '' ? (from === to || document.execCommand('delete')) : document.execCommand('insertText', false, text); } catch (e) { ok = false; }
  if (!ok) { ta.setRangeText(text, from, to, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); }
  if (selA != null) ta.setSelectionRange(selA, selB == null ? selA : selB);
  internal = was;
  later();
}
function lineRange() {
  const v = ta.value, a = ta.selectionStart; let b = ta.selectionEnd;
  if (b > a && v[b - 1] === '\n') b--;
  const s = v.lastIndexOf('\n', a - 1) + 1; let e = v.indexOf('\n', b); if (e < 0) e = v.length;
  return { s, e };
}
function toggleComment() {
  const v = ta.value, { s, e } = lineRange(), block = v.slice(s, e), ls = block.split('\n');
  const ne = ls.filter(l => l.trim()), all = ne.length && ne.every(l => /^\s*\/\//.test(l));
  const out = ls.map(l => !l.trim() ? l : all ? l.replace(/^(\s*)\/\/ ?/, '$1') : '// ' + l).join('\n');
  const a = ta.selectionStart, b = ta.selectionEnd, d = out.length - block.length;
  replace(s, e, out);
  if (a === b) ta.setSelectionRange(Math.max(s, a + d), Math.max(s, a + d)); else ta.setSelectionRange(s, s + out.length);
}
function moveLines(dir) {
  const v = ta.value, { s, e } = lineRange(), a = ta.selectionStart, b = ta.selectionEnd, block = v.slice(s, e);
  if (dir < 0) {
    if (s === 0) return;
    const ps = v.lastIndexOf('\n', s - 2) + 1, prev = v.slice(ps, s - 1);
    replace(ps, e, block + '\n' + prev);
    ta.setSelectionRange(a - prev.length - 1, b - prev.length - 1);
  } else {
    if (e >= v.length) return;
    let ne = v.indexOf('\n', e + 1); if (ne < 0) ne = v.length;
    const next = v.slice(e + 1, ne);
    replace(s, ne, next + '\n' + block);
    ta.setSelectionRange(a + next.length + 1, b + next.length + 1);
  }
}
function dupLines(dir) {
  const v = ta.value, { e, s } = lineRange(), a = ta.selectionStart, b = ta.selectionEnd, block = v.slice(s, e);
  replace(e, e, '\n' + block);
  if (dir > 0) ta.setSelectionRange(a + block.length + 1, b + block.length + 1); else ta.setSelectionRange(a, b);
}

/* Conservative text-only normalizer. It deliberately leaves constructs that
   the installed solver cannot parse untouched. */
function normalizeLines() {
  const { s, e } = lineRange(), source = ta.value.slice(s, e);
  const out = source.split('\n').map(line => line
    .replace(/(?<!\.)\.\.(?!\.)/g, '...')
    .replace(/\badj\b/gi, 'beside')
    .replace(/\bUNIT\s*=/gi, 'DEFAULT UNIT =')
    .replace(/\s+~/g, ' apart')
  ).join('\n');
  if (out === source) { stMsg.textContent = 'Already in canonical form'; return; }
  replace(s, e, out);
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  stMsg.textContent = 'Normalized selected lines · edited';
}

const fixPop = document.createElement('div');
fixPop.className = 'ed-fixes';
fixPop.hidden = true;
document.body.appendChild(fixPop);
function closeFixes() { fixPop.hidden = true; }
function showFixes() {
  const c = caret(), L = A.lines[c.line], issue = L && (L.issues.find(x => c.col >= x.s && c.col <= x.e) || L.issues[0]);
  if (!issue || !issue.fixes || !issue.fixes.length) return;
  fixPop.innerHTML = issue.fixes.map((f, i) => `<button type="button" data-fix="${i}">💡 ${esc(f.label)}</button>`).join('');
  const r = ta.getBoundingClientRect(); fixPop.style.left = `${r.left + 24}px`; fixPop.style.top = `${r.top + (c.line + 1) * lh}px`; fixPop.hidden = false;
  fixPop.querySelector('button')?.focus();
}
fixPop.addEventListener('click', e => {
  const b = e.target.closest('[data-fix]'), c = caret(), L = A.lines[c.line], issue = L && (L.issues.find(x => c.col >= x.s && c.col <= x.e) || L.issues[0]);
  const f = issue?.fixes?.[+b?.dataset.fix]; if (!f) return;
  const edits = (f.edits || []).slice().sort((a, b) => b.line - a.line || b.start - a.start);
  const lines = ta.value.split('\n');
  edits.forEach(x => { const i = x.line - 1, line = lines[i] || ''; lines[i] = line.slice(0, x.start - 1) + x.text + line.slice(x.end); });
  replace(0, ta.value.length, lines.join('\n')); closeFixes(); refresh(); stMsg.textContent = 'Quick fix applied · edited';
});

/* ───────── autocomplete ───────── */
const ac = { open: false, items: [], sel: 0, from: 0, to: 0, prefix: '', kind: '', numeric: false, navigated: false };

function matchRank(txt, pl) {
  if (!pl) return 1;
  const t = txt.toLowerCase();
  if (t.startsWith(pl)) return 0;
  if (pl.length >= 2 && t.includes(pl)) return 2;
  return -1;
}
function entityItems() {
  const out = [];
  A.cats.forEach(c => {
    if (!c.validTag || A.tagMap.get(c.tag) !== c) return;
    c.items.forEach(it => {
      const name = String(it), display = /[^A-Za-z0-9_]/.test(name) ? `"${name.replace(/"/g, '\\"')}"` : name;
      out.push({ label: display, insert: display, color: c.color, detail: `${c.name} [${c.tag}]` });
      out.push({ label: name + c.tag, tagged: true, color: c.color, detail: `${c.name} [${c.tag}] · tagged` });
    });
  });
  return out;
}

function completion(manual) {
  const p = ta.selectionStart; if (p !== ta.selectionEnd) return null;
  const v = ta.value, c = caret(), L = A.lines[c.line]; if (!L) return null;
  let le = v.indexOf('\n', p); if (le < 0) le = v.length;
  const full = v.slice(c.ls, le), beforeC = full.slice(0, c.col), after = full.slice(c.col);
  if (beforeC.includes('//')) return null;
  const mode = L.mode;

  // tag letters inside [ ] on a SETUP line
  if (mode === 1) {
    const m = beforeC.match(/^\s*([^\s\[]+)\s*\[([a-z]*)$/);
    if (m) {
      const cur = m[2], tr = after.match(/^[a-z]*/)[0];
      const used = new Set(A.cats.filter(x => x.line !== c.line && x.validTag).map(x => x.tag));
      const nameL = m[1].toLowerCase().replace(/[^a-z]/g, '');
      const order = [...new Set([...nameL, ...'abcdefghijklmnopqrstuvwxyz'])].filter(ch => !used.has(ch) && ch.startsWith(cur));
      const items = order.slice(0, 8).map(ch => ({ label: ch, detail: nameL.includes(ch) ? 'from name' : 'free tag', color: 'var(--text-sec)' }));
      return items.length ? { kind: 'tag', from: p - cur.length, to: p + tr.length, prefix: cur, items } : null;
    }
  }
  if (mode === 3 || L.kind === 'ignored') return null;

  const prefix = beforeC.match(/[A-Za-z0-9_.]*$/)[0];
  if (!prefix && !manual) return null;
  const tr = after.match(/^[A-Za-z0-9_.]*/)[0];
  const lt = beforeC.slice(0, beforeC.length - prefix.length).trimEnd();
  const atStart = lt === '';
  const pm = lt.match(/(<=>|=>|!=|[A-Za-z0-9_.]+|[=<>+\-()])$/);
  const prevTok = pm ? pm[1] : '', ptl = prevTok.toLowerCase(), pl = prefix.toLowerCase();
  const isOp = /^(<=>|=>|!=|[=<>+\-(])$/.test(prevTok);

  const list = [];
  const sec = [];
  if (atStart) {
    SECTION.forEach(s => sec.push({ label: s, insert: s === 'SOLVE' ? s : s + '\n', detail: 'section', color: SEC_COLOR }));
    SETTINGS.forEach(s => sec.push({ label: s, insert: s + ' = ', detail: 'setting', color: SEC_COLOR }));
  }
  const addSec = base => {
    if (mode === 1 && !manual && prefix.length < 2) return;
    sec.forEach(it => { const r = matchRank(it.label, pl); if (r >= 0 && r < 2) list.push({ it, r: r + base }); });
  };

  if (mode === 0) addSec(0);
  else if (mode === 1) {
    addSec(0);
    if (!atStart && (prefix.startsWith('.') || (manual && !prefix))) list.push({ it: { label: '...', insert: '... ', detail: 'continue the number step', color: SEC_COLOR }, r: 0 });
  } else {
    const valueStart = atStart || isOp || GATES.includes(ptl) || ptl === 'not' || ptl === 'of' || ptl === 'then';
    const afterValue = !valueStart && prevTok !== '';
    if (A.tagMap.has(prevTok)) {
      if (matchRank('of', pl) >= 0 && 'of'.startsWith(pl)) list.push({ it: { label: 'of', insert: 'of ', detail: `${prevTok} of <entity>`, color: KW_COLOR }, r: 0 });
    } else {
      entityItems().forEach(it => { const r = matchRank(it.label, pl); if (r >= 0) list.push({ it, r: r + (afterValue ? 0.3 : 0) }); });
      A.cats.forEach(cat => {
        if (!cat.validTag || A.tagMap.get(cat.tag) !== cat) return;
        if (pl && pl !== cat.tag) return;
        list.push({ it: { label: cat.tag + ' of', insert: cat.tag + ' of ', detail: cat.name, color: cat.color }, r: pl ? -0.2 : 1 });
      });
      if (atStart || ['(', '=>', '<=>'].includes(prevTok) || GATES.includes(ptl) || ptl === 'not') {
        const r = matchRank('not', pl); if (r >= 0 && r < 2) list.push({ it: { label: 'not', insert: 'not ', detail: 'negate', color: GATE_COLOR }, r: r - 0.1 });
      }
      if (afterValue) {
        GATES.forEach(g => { const r = matchRank(g, pl); if (r >= 0 && r < 2) list.push({ it: { label: g, insert: g + ' ', detail: 'gate', color: GATE_COLOR }, r: r - 0.5 }); });
        [['then', 'then '], ['then+', 'then+ ']].forEach(([l, ins]) => { const r = matchRank(l, pl); if (r >= 0 && r < 2) list.push({ it: { label: l, insert: ins, detail: 'order', color: KW_COLOR }, r: r - 0.5 }); });
      }
      if (atStart) addSec(0.4);
    }
  }
  list.forEach((x, i) => { x.i = i; });
  list.sort((a, b) => a.r - b.r || a.i - b.i);
  const seen = new Set(), items = [];
  for (const x of list) if (!seen.has(x.it.label)) { seen.add(x.it.label); items.push(x.it); }
  if (!items.length) return null;
  if (!manual && items[0].label === prefix) return null; // already typed in full
  return { kind: 'gen', from: p - prefix.length, to: p + tr.length, prefix, items: items.slice(0, 60) };
}

function renderPop() {
  const n = ac.prefix.length, pl = ac.prefix.toLowerCase();
  pop.innerHTML = '<div class="ac-list">' + ac.items.map((it, i) => {
    const L = it.label, main = it.tagged ? L.slice(0, -1) : L, tg = it.tagged ? L.slice(-1) : '';
    const h = n && L.toLowerCase().startsWith(pl) ? Math.min(n, main.length) : 0;
    const lab = (h ? `<b>${esc(main.slice(0, h))}</b>` : '') + esc(main.slice(h)) + (tg ? `<span class="ac-tag">${esc(tg)}</span>` : '');
    return `<div class="ac-row${i === ac.sel ? ' sel' : ''}" data-i="${i}"><i class="ac-dot" style="--c:${it.color || 'var(--text-dim)'}"></i><span class="ac-label">${lab}</span><span class="ac-detail">${esc(it.detail || '')}</span></div>`;
  }).join('') + '</div><div class="ac-hint">↑↓ navigate · Tab accept · Esc close</div>';
  pop.hidden = false;
  position();
  scrollSel();
}
function scrollSel() { const r = pop.querySelector('.ac-row.sel'); if (r && r.scrollIntoView) r.scrollIntoView({ block: 'nearest' }); }
function position() {
  if (!ac.open) return;
  const r = ta.getBoundingClientRect(), v = ta.value;
  let x0, yTop;
  if (wrap) { const q = wrapXY(ac.from); x0 = r.left + padX + q.x; yTop = r.top + padY + q.y - ta.scrollTop; }
  else {
    const ls = v.lastIndexOf('\n', ac.from - 1) + 1;
    let li = 0; for (let i = v.indexOf('\n'); i >= 0 && i < ac.from; i = v.indexOf('\n', i + 1)) li++;
    let col = 0; for (const ch of v.slice(ls, ac.from)) col += ch === '\t' ? 2 - col % 2 : 1;
    x0 = r.left + padX + col * cw - ta.scrollLeft; yTop = r.top + padY + li * lh - ta.scrollTop;
  }
  pop.style.left = '0px'; pop.style.top = '0px';
  const w = pop.offsetWidth, h = pop.offsetHeight;
  let y = yTop + lh + 2; if (y + h > innerHeight - 8) y = yTop - h - 2;
  const x = Math.max(8, Math.min(x0 - 27, innerWidth - w - 8));
  pop.style.left = x + 'px'; pop.style.top = Math.max(8, y) + 'px';
}
function showPop(c) {
  const keep = ac.open && c.kind === ac.kind && ac.items[ac.sel] ? ac.items[ac.sel].label : null;
  Object.assign(ac, { open: true, items: c.items, from: c.from, to: c.to, prefix: c.prefix, kind: c.kind, numeric: /^\d/.test(c.prefix), navigated: false });
  ac.sel = Math.max(0, c.items.findIndex(i => i.label === keep));
  renderPop();
}
function closePop() { ac.open = false; pop.hidden = true; }
function updatePop(manual) { const c = completion(manual); if (c) showPop(c); else closePop(); }
function move(d) {
  const n = ac.items.length; ac.sel = (ac.sel + d + n) % n; ac.navigated = true;
  pop.querySelectorAll('.ac-row').forEach((r, i) => r.classList.toggle('sel', i === ac.sel));
  scrollSel();
}
function accept(i) {
  const it = ac.items[i]; if (!it) return;
  const { from, to, kind } = ac, v = ta.value;
  closePop();
  if (kind === 'tag') {
    const closed = v[to] === ']', end = to + (closed ? 1 : 0), eat = v[end] === ' ' ? 1 : 0;
    replace(from, end + eat, it.label + '] ', from + 3);
  } else {
    const ins = it.insert || it.label;
    replace(from, to, ins, from + ins.length);
  }
  ta.focus();
}
function openCategory(cat) {
  ta.focus();
  const p = ta.selectionStart;
  const items = cat.items.map(it => ({ label: it + cat.tag, tagged: true, color: cat.color, detail: `${cat.name} [${cat.tag}]` }));
  if (!items.length || !cat.validTag) return;
  showPop({ kind: 'cat', from: p, to: p, prefix: '', items });
}

pop.addEventListener('mousedown', e => {
  e.preventDefault();
  const row = e.target.closest('.ac-row'); if (row) accept(+row.dataset.i);
});
pop.addEventListener('mousemove', e => {
  const row = e.target.closest('.ac-row'); if (!row) return;
  const i = +row.dataset.i; if (i === ac.sel) return;
  ac.sel = i; pop.querySelectorAll('.ac-row').forEach((r, k) => r.classList.toggle('sel', k === i));
});

/* ───────── events ───────── */
const PAIRS = { '(': ')', '[': ']' };
ta.addEventListener('keydown', e => {
  if (e.isComposing) return;
  const mod = e.ctrlKey || e.metaKey;
  if (window.GSSettings.keyMatches('normalize', e)) { e.preventDefault(); normalizeLines(); return; }
  if (window.GSSettings.keyMatches('fixes', e)) { e.preventDefault(); showFixes(); return; }
  if (ac.open) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); move(e.key === 'ArrowDown' ? 1 : -1); return; }
    if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); accept(ac.sel); return; }
    if (e.key === 'Enter' && !mod && !e.shiftKey && !e.altKey) {
      if (!ac.numeric || ac.navigated) { e.preventDefault(); accept(ac.sel); return; }
      closePop();
    }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePop(); return; }
  }
  if (window.GSSettings.keyMatches('autocomplete', e)) { e.preventDefault(); updatePop(true); return; }
  if (window.GSSettings.keyMatches('comment', e)) { e.preventDefault(); toggleComment(); return; }
  if (window.GSSettings.keyMatches('wrap', e)) { e.preventDefault(); setWrap(!wrap, true); return; }
  if (e.altKey && !mod && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    e.preventDefault();
    const d = e.key === 'ArrowDown' ? 1 : -1;
    if (e.shiftKey) dupLines(d); else moveLines(d);
    return;
  }
  if (mod || e.altKey) return;
  const v = ta.value, a = ta.selectionStart, b = ta.selectionEnd;
  const inComment = v.slice(v.lastIndexOf('\n', a - 1) + 1, a).includes('//');
  if (PAIRS[e.key] && !inComment) {
    e.preventDefault();
    if (a !== b) { replace(a, b, e.key + v.slice(a, b) + PAIRS[e.key], a + 1, b + 1); return; }
    if (v[a] && /[A-Za-z0-9_]/.test(v[a])) { replace(a, a, e.key, a + 1); return; }
    replace(a, a, e.key + PAIRS[e.key], a + 1);
    if (e.key === '[') updatePop(false);
    return;
  }
  if ((e.key === ')' || e.key === ']') && a === b && v[a] === e.key) { e.preventDefault(); ta.setSelectionRange(a + 1, a + 1); closePop(); return; }
  if (e.key === 'Backspace' && a === b && a > 0 && PAIRS[v[a - 1]] && PAIRS[v[a - 1]] === v[a]) {
    e.preventDefault(); replace(a - 1, a + 1, '', a - 1); closePop(); return;
  }
});
ta.addEventListener('input', e => {
  refresh();
  if (internal) return;
  const t = e.inputType || '';
  if (t === 'insertText' || t.startsWith('delete')) {
    if (ac.open || (t === 'insertText' && e.data && e.data !== ' ')) updatePop(false);
  } else closePop();
});
['keyup', 'mouseup'].forEach(ev => ta.addEventListener(ev, () => {
  if (ac.open) { const p = ta.selectionStart; if (p < ac.from || p > ac.to || ta.selectionEnd !== p) closePop(); }
  later();
}));
ta.addEventListener('scroll', sync);
ta.addEventListener('focus', () => { updateBars(); later(); });
ta.addEventListener('blur', () => { closePop(); updateBars(); });
document.addEventListener('selectionchange', () => { if (document.activeElement === ta) later(); });
if (window.ResizeObserver) new ResizeObserver(() => { measure(); paint(); if (ac.open) position(); }).observe(root);
else addEventListener('resize', () => { measure(); paint(); });
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); paint(); });

legend.addEventListener('mousedown', e => e.preventDefault());
legend.addEventListener('click', e => { const b = e.target.closest('.legend-chip'); if (b) openCategory(A.cats[+b.dataset.i]); });

gutter.addEventListener('mousedown', e => {
  e.preventDefault();
  const r = gutter.getBoundingClientRect();
  const yy = e.clientY - r.top - padY + ta.scrollTop;
  let idx = 0; for (let i = 0; i < tops.length && tops[i] <= yy; i++) idx = i;
  const [s, en] = lineBounds(idx);
  ta.focus(); ta.setSelectionRange(s, en);
});
gutter.addEventListener('wheel', e => { ta.scrollTop += e.deltaY; e.preventDefault(); }, { passive: false });

// shortcuts popover + copy
const kbBtn = $('kbBtn'), kbPop = $('kbPop');
const normBtn = document.createElement('button');
normBtn.type = 'button'; normBtn.className = 'title-link'; normBtn.textContent = 'Normalize';
normBtn.title = 'Normalize selected lines (Ctrl/⌘ Alt N)';
document.querySelector('.panel-tools')?.prepend(normBtn);
normBtn.addEventListener('click', normalizeLines);
const kbSet = on => { kbPop.hidden = !on; kbBtn.setAttribute('aria-expanded', String(on)); };
kbBtn.addEventListener('click', e => { e.stopPropagation(); kbSet(kbPop.hidden); });
document.addEventListener('click', e => { if (!kbPop.hidden && !kbPop.contains(e.target)) kbSet(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') kbSet(false); });
document.addEventListener('mousedown', e => { if (!fixPop.contains(e.target) && e.target !== ta) closeFixes(); });
const cp = $('cp');
if (cp) cp.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(ta.value); } catch (e) { ta.select(); document.execCommand('copy'); }
  const t = cp.textContent; cp.textContent = 'Copied'; setTimeout(() => { cp.textContent = t; }, 1100);
});

/* ───────── word wrap ───────── */
const WRAP_KEY = 'gridsolver.wrap', wrapBtn = $('wrapBtn');
function setWrap(on, save) {
  wrap = !!on;
  root.classList.toggle('wrap', wrap);
  ta.wrap = wrap ? 'soft' : 'off';
  if (wrapBtn) wrapBtn.setAttribute('aria-pressed', String(wrap));
  if (wrap) ta.scrollLeft = 0;
  if (save) { try { localStorage.setItem(WRAP_KEY, wrap ? '1' : '0'); } catch (e) {} }
  paint(); status(); if (ac.open) position();
}
if (wrapBtn) wrapBtn.addEventListener('click', () => { setWrap(!wrap, true); ta.focus(); });

/* ───────── public API for solver.js ───────── */
window.GSEditor = {
  PALETTE,
  setWrap,
  refresh() { measure(); refresh(); },
  setText(s, toStart) {
    replace(0, ta.value.length, s);
    if (toStart) { ta.setSelectionRange(0, 0); ta.scrollTop = 0; ta.scrollLeft = 0; }
    closePop(); refresh();
  },
  setError(line, msg) { err = line ? { line: line - 1, msg: msg || '' } : null; paint(); status(); },
  peek(line) { peekLine = line ? line - 1 : null; updateBars(); },
  goto(line) {
    const idx = line - 1; if (!(idx >= 0)) return;
    const [, en] = lineBounds(idx);
    ta.focus({ preventScroll: true }); ta.setSelectionRange(en, en);
    const y = padY + (tops[idx] ?? idx * lh), h = hts[idx] ?? lh;
    if (y < ta.scrollTop || y + h > ta.scrollTop + ta.clientHeight) ta.scrollTop = Math.max(0, y - ta.clientHeight / 2);
    ta.scrollLeft = 0; flashLine = idx; sync();
    if (bFlash.animate) bFlash.animate([{ background: 'rgba(201,127,80,.38)' }, { background: 'rgba(201,127,80,0)' }], { duration: 900, easing: 'ease-out' });
  }
};

measure();
let wrapSaved = null; try { wrapSaved = localStorage.getItem(WRAP_KEY); } catch (e) {}
wrap = wrapSaved === '1';
setWrap(wrap, false);
refresh();
initSettings();
})();
