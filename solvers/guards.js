'use strict';

/* Truth-teller/liar/random guard puzzles.  A program describes possible guard
 * identities and schedules, then filters them with statements made in context. */
window.GSSolvers = window.GSSolvers || {};

GSSolvers.runGuards = function runGuards(L, out, thr, lm) {
  const E = window.GSRuntime?.Error || window.GSError;
  const esc = window.GSRuntime?.esc || (s => String(s).replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x])));
  const fail = (message, line) => { throw new E(message, line); };
  const guards = [], days = [], rules = [], statements = [];
  let section = '', currentDay = null;
  const known = (xs, value) => xs.findIndex(x => x.toLowerCase() === value.toLowerCase());
  const addUnique = (xs, value, label, line) => {
    if (!value || known(xs, value) >= 0) fail(`Duplicate ${label} "${value}"`, line);
    xs.push(value);
  };
  const stateOf = text => {
    const m = text.trim().toLowerCase().match(/^(lies?|lying|lie|truth|truthful|tells?\s+(?:the\s+)?truth|random|normal)$/);
    if (!m) return null;
    return /^(lies?|lying|lie)$/.test(m[1]) ? 'lie' : /random|normal/.test(m[1]) ? 'random' : 'truth';
  };
  const ruleRe = /^(.+?)\s+(lies?|lying|lie|truth|truthful|tells?\s+(?:the\s+)?truth|random|normal)\s+(?:on|when|if)\s+(.+)$/i;
  for (const x of L) {
    const u = x.t.toUpperCase();
    if (u === 'GUARDS') { section = 'guards'; continue; }
    if (u === 'RULES') { section = 'rules'; continue; }
    if (u === 'START' || u === 'STATEMENTS') { section = 'start'; continue; }
    if (u === 'SOLVE') break;
    if (/^(THRESHOLD|LISTMAX)\s*=/.test(u)) continue;
    if (section === 'guards') {
      let m = x.t.match(/^guards?\s*:\s*(.+)$/i);
      if (m) m[1].split(/\s*,\s*|\s+/).forEach(v => addUnique(guards, v, 'guard', x.n));
      else if ((m = x.t.match(/^days?\s*:\s*(.+)$/i))) m[1].split(/\s*,\s*|\s+/).forEach(v => addUnique(days, v, 'day', x.n));
      else if ((m = x.t.match(/^guards?\s+(.+)$/i))) m[1].split(/\s*,\s*|\s+/).forEach(v => addUnique(guards, v, 'guard', x.n));
      else if ((m = x.t.match(/^days?\s+(.+)$/i))) m[1].split(/\s*,\s*|\s+/).forEach(v => addUnique(days, v, 'day', x.n));
      else fail('GUARDS expects "guards A B" or "days Monday Tuesday ..."', x.n);
      continue;
    }
    if (section === 'rules') {
      const m = x.t.match(ruleRe);
      if (!m) fail('RULES expects "Guard lies|truth|random on condition"', x.n);
      const guard = m[1].trim(), state = stateOf(m[2]), condition = m[3].trim();
      if (known(guards, guard) < 0) fail(`Unknown guard "${guard}"`, x.n);
      const cond = /,|\band\b/i.test(condition)
        ? condition.split(/\s*(?:,|\band\b)\s*/i).map(v => v.trim()).filter(Boolean)
        : condition.trim().split(/\s+/).filter(Boolean);
      if (!cond.length) fail('A rule needs a condition', x.n);
      rules.push({ guard, state, cond, n: x.n });
      continue;
    }
    if (section === 'start') {
      const day = x.t.match(/^(?:DAY|WHEN)\s+(.+)$/i);
      if (day) { currentDay = day[1].trim(); if (known(days, currentDay) < 0) fail(`Unknown day "${currentDay}"`, x.n); continue; }
      const shortDay = days.find(d => new RegExp(`^${d}\\s*:` , 'i').test(x.t));
      if (shortDay) { currentDay = shortDay; x.t = x.t.slice(x.t.indexOf(':') + 1).trim(); }
      const m = x.t.match(/^(.*?)\s+says?\s*[:：]?\s*(.+)$/i);
      if (!m) fail('START expects "DAY Monday" followed by "Guard says statement"', x.n);
      if (!currentDay) fail('Choose a day before making statements', x.n);
      statements.push({ speaker: m[1].trim(), text: m[2].trim(), day: currentDay, n: x.n });
      continue;
    }
    if (section) fail(`Unexpected line in ${section.toUpperCase()}`, x.n);
    fail('Begin with GUARDS', x.n);
  }
  if (guards.length < 1) fail('Declare at least one guard', 1);
  if (!days.length) fail('Declare at least one day', 1);
  if (!rules.length) fail('Add at least one rule in RULES', 1);
  if (!statements.length) fail('Add at least one statement in START', 1);

  const guardIndex = name => known(guards, name);
  const dayIndex = name => known(days, name);
  const position = i => i === 0 ? 'left' : i === guards.length - 1 ? 'right' : String(i + 1);
  const state = (guard, day, identity) => {
    let result = 'truth';
    for (const rule of rules) if (guard.toLowerCase() === rule.guard.toLowerCase()) {
      const matches = rule.cond.some(c => c.toLowerCase() === day.toLowerCase() || c.toLowerCase() === 'any day');
      const pos = position(identity);
      const posMatch = rule.cond.some(c => /^(left|right|\d+)$/.test(c.toLowerCase()) && c.toLowerCase() === pos);
      if (matches || posMatch) result = rule.state;
    }
    return result;
  };
  const splitTop = (text, word) => {
    let depth = 0, quote = false;
    for (let i = 0; i <= text.length - word.length; i++) {
      if (text[i] === '(') depth++; else if (text[i] === ')') depth--;
      if (!depth && text.slice(i, i + word.length).toLowerCase() === word && (i === 0 || /\s/.test(text[i - 1])) && (i + word.length === text.length || /\s/.test(text[i + word.length]))) return [text.slice(0, i), text.slice(i + word.length)];
    }
    return null;
  };
  const proposition = (text, speaker, identity, day) => {
    text = text.trim().replace(/^\((.*)\)$/, '$1').trim();
    if (/^not\b/i.test(text)) return !proposition(text.replace(/^not\s+/i, ''), speaker, identity, day);
    for (const word of ['xor', 'or', 'and']) {
      const parts = splitTop(text, word);
      if (parts) { const a = proposition(parts[0], speaker, identity, day), b = proposition(parts[1], speaker, identity, day); return word === 'and' ? a && b : word === 'or' ? a || b : a !== b; }
    }
    if (/^(true|yes)$/i.test(text)) return true;
    if (/^(false|no)$/i.test(text)) return false;
    if (/^i\s+(?:am\s+)?(?:lying|lie)(?:\s+today)?$/i.test(text)) return state(speaker, day, identity) === 'lie';
    if (/^i\s+(?:am\s+)?(?:truthful|telling\s+the\s+truth|tell\s+the\s+truth)(?:\s+today)?$/i.test(text)) return state(speaker, day, identity) === 'truth';
    if (/^i\s+am\s+(?:random|normal)(?:\s+today)?$/i.test(text)) return state(speaker, day, identity) === 'random';
    let m = text.match(/^i\s+am\s+(?:the\s+)?(.+)$/i); if (m) return guardIndex(m[1].trim()) === identity;
    m = text.match(/^i\s+am\s+(left|right)$/i); if (m) return position(identity) === m[1].toLowerCase();
    m = text.match(/^today\s+is\s+(.+)$/i); if (m) return dayIndex(m[1].trim()) === dayIndex(day);
    m = text.match(/^(.+?)\s+is\s+(lying|truthful|random)(?:\s+today)?$/i);
    if (m) { const i = guardIndex(m[1].trim()); if (i < 0) fail(`Unknown guard "${m[1].trim()}"`); return state(m[1].trim(), day, identity) === (m[2].toLowerCase() === 'lying' ? 'lie' : m[2].toLowerCase()); }
    fail(`Unsupported statement "${text}"`);
  };
  const applicable = (stmt, identity) => {
    const speaker = /^unknown$/i.test(stmt.speaker) ? guards[identity] : stmt.speaker;
    const i = guardIndex(speaker); if (i < 0) fail(`Unknown speaker "${stmt.speaker}"`, stmt.n);
    const truth = proposition(stmt.text, speaker, identity, stmt.day), mode = state(speaker, stmt.day, identity);
    return mode === 'random' || (mode === 'truth' ? truth : !truth);
  };
  const candidates = [];
  for (let identity = 0; identity < guards.length; identity++) {
    if (statements.every(s => applicable(s, identity))) candidates.push(identity);
  }
  const rows = [`<div class="stats-bar"><div class="stat-chip"><span class="stat-val">${guards.length}</span><span class="stat-lbl">Identities</span></div><div class="stat-chip green"><span class="stat-val">${candidates.length}</span><span class="stat-lbl">Remaining</span></div></div>`];
  statements.forEach((s, i) => rows.push(`<div class="step animate-in" data-line="${s.n}"><div class="step-head"><span class="step-n">${i + 1}</span><code class="step-clue">${esc(`${s.speaker} says ${s.text}`)}</code><span class="step-count">${candidates.length} left</span></div><div class="chips"><span class="chip">${esc(`${s.day}: ${s.text}`)}</span></div></div>`));
  if (candidates.length) {
    const cells = candidates.map(i => `<tr><th scope="row">${esc(guards[i])}</th><td>${esc(state(guards[i], statements[0].day, i))}</td><td>${esc(position(i))}</td></tr>`).join('');
    rows.push(`<div class="answer"><div class="answer-head"><span class="answer-title${candidates.length === 1 ? '' : ' part'}">${candidates.length === 1 ? 'Identity found' : 'Possible identities'}</span><span class="answer-hint">${candidates.length} candidate(s)</span></div><div class="answer-scroll"><table class="grid slot-grid"><thead><tr><th>Guard</th><th>Mode</th><th>Position</th></tr></thead><tbody>${cells}</tbody></table></div></div>`);
  }
  rows.push(`<div class="${candidates.length ? 'solved-banner' : 'warn-banner'}">${candidates.length ? (candidates.length <= thr ? 'Guard puzzle solved' : `${candidates.length} possibilities remain`) : 'Contradiction: no guard identity satisfies the statements'}</div>`);
  out.innerHTML = rows.join('');
  $('badge').textContent = `${candidates.length} left`;
  return true;
};