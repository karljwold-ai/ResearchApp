/*
 * Rule language and "words in conversation" phrases.
 * Shared with the ICEHALL clinical app (same syntax), so protocol writers and clinicians learn one thing.
 *
 * Protocols are DATA. Eligibility, "show this question when…", derived values and safety rules are
 * written as conditions and parsed here; no protocol can run arbitrary code.
 *
 * Condition language
 *   comparisons   =  !=  <  <=  >  >=      e.g. pregnant = yes, sys_mean >= 180
 *   logic         AND  OR  NOT  ( … )
 *   missing       x = blank / x != blank
 *   arithmetic    +  -  *  /               e.g. weight / (height * height / 10000)
 *   functions     COUNT(a; b; c)  number of true conditions
 *                 ABS(x)  SYS(bp)  DIA(bp)  MEAN(a; b; …)  SUM(…)  MIN(…)  MAX(…)  ROUND(x)  ROUND(x; 1)
 *                 IF(condition; a; b)
 *   names         a field id (its answer), a derived value id, age_years, sex (male/female) or
 *                 visit (the visit id, e.g. visit = baseline), consent_<option> (e.g. consent_cmh = yes),
 *                 prev_<field> (the value at the participant's last completed visit, e.g. prev_hba1c >= 8).
 *                 Any other word is a literal value.
 *   A bare field id used as a condition means "answer is yes".
 *   Unknown answers: x = a and x != a are both false while x is unknown. Use NOT x = a for
 *   "anything except a, including unknown".
 */
(function () {
  'use strict';
  const RS = (typeof window !== 'undefined' ? window : global).RS;

  /* ------------------------------------------------------------------ */
  /* Conditions                                                          */
  /* ------------------------------------------------------------------ */
  const KW = new Set(['AND', 'OR', 'NOT']);
  const BUILTIN = new Set(['age_years', 'sex', 'visit']);
  const FUNCS = new Set(['COUNT', 'ABS', 'SYS', 'DIA', 'MEAN', 'MIN', 'MAX', 'ROUND', 'IF', 'SUM']);
  /** consent_<option> (yes/no from the consent form) and prev_<field> (value at the last completed visit). */
  const isBuiltin = (n) => BUILTIN.has(n) || /^(consent|prev)_[a-z0-9_]+$/.test(n);

  function tokenize(src) {
    const out = [];
    const re = /\s*(?:(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_]*)|(>=|<=|!=|=|<|>|\+|-|\*|\/|\(|\)|;|,))/y;
    let i = 0;
    src = String(src || '');
    while (i < src.length) {
      re.lastIndex = i;
      const m = re.exec(src);
      if (!m || m[0] === '') {
        if (/^\s+$/.test(src.slice(i))) break;
        throw new Error(`Cannot read “${src.slice(i, i + 12)}”`);
      }
      i = re.lastIndex;
      if (m[1] != null) out.push({ t: 'num', v: Number(m[1]) });
      else if (m[2] != null) {
        const up = m[2].toUpperCase();
        if (KW.has(up)) out.push({ t: up });
        else if (up === 'BLANK') out.push({ t: 'blank' });
        else out.push({ t: 'id', v: m[2] });
      } else out.push({ t: m[3] });
    }
    return out;
  }

  /** Parse a condition into a tree. Throws with a readable message on errors. */
  function parse(src) {
    const toks = tokenize(src);
    let p = 0;
    const peek = () => toks[p] || { t: 'end' };
    const eat = (t) => { if (peek().t !== t) throw new Error(`Expected “${t}” but found “${peek().v ?? peek().t}”`); return toks[p++]; };
    function or() { let a = and(); while (peek().t === 'OR') { p++; a = { op: 'or', a, b: and() }; } return a; }
    function and() { let a = not(); while (peek().t === 'AND') { p++; a = { op: 'and', a, b: not() }; } return a; }
    function not() { if (peek().t === 'NOT') { p++; return { op: 'not', a: not() }; } return cmp(); }
    function cmp() {
      const a = sum();
      const t = peek().t;
      if (['=', '!=', '<', '<=', '>', '>='].includes(t)) { p++; return { op: t, a, b: sum() }; }
      return a;
    }
    function sum() { let a = term(); while (peek().t === '+' || peek().t === '-') { const o = toks[p++].t; a = { op: o, a, b: term() }; } return a; }
    function term() { let a = atom(); while (peek().t === '*' || peek().t === '/') { const o = toks[p++].t; a = { op: o, a, b: atom() }; } return a; }
    function atom() {
      const k = peek();
      if (k.t === 'num') { p++; return { op: 'num', v: k.v }; }
      if (k.t === 'blank') { p++; return { op: 'blank' }; }
      if (k.t === '(') { p++; const e = or(); eat(')'); return e; }
      if (k.t === '-') { p++; return { op: '-', a: { op: 'num', v: 0 }, b: atom() }; }
      if (k.t === 'id') {
        p++;
        const up = k.v.toUpperCase();
        if (FUNCS.has(up) && peek().t === '(') {
          p++;
          const args = [];
          if (peek().t !== ')') { args.push(or()); while (peek().t === ';' || peek().t === ',') { p++; args.push(or()); } }
          eat(')');
          return { op: 'fn', name: up, args };
        }
        return { op: 'id', v: k.v };
      }
      throw new Error(`Unexpected “${k.v ?? k.t}”`);
    }
    if (!toks.length) throw new Error('Empty condition');
    const tree = or();
    if (p < toks.length) throw new Error(`Unexpected “${peek().v ?? peek().t}” after the end of the condition`);
    return tree;
  }

  /** All names used in a condition (to check them against the protocol's fields). */
  function names(tree, out) {
    out = out || new Set();
    if (!tree) return out;
    if (tree.op === 'id') out.add(tree.v);
    ['a', 'b'].forEach((k) => tree[k] && names(tree[k], out));
    (tree.args || []).forEach((x) => names(x, out));
    return out;
  }
  /** Literal words compared against a field, e.g. [['side_effects', 'severe']], for checking allowed answers. */
  function comparedLiterals(tree, isField, out) {
    out = out || [];
    if (!tree) return out;
    if ((tree.op === '=' || tree.op === '!=') && tree.a.op === 'id' && tree.b.op === 'id' && isField(tree.a.v) && !isField(tree.b.v)) out.push([tree.a.v, tree.b.v]);
    ['a', 'b'].forEach((k) => tree[k] && comparedLiterals(tree[k], isField, out));
    (tree.args || []).forEach((x) => comparedLiterals(x, isField, out));
    return out;
  }

  const BLANK = { blank: true };
  const num = (x) => (x == null || x === BLANK || x === '' || typeof x === 'boolean' || isNaN(Number(x)) ? null : Number(x));
  /** env: { v(id), ctx: {age_years, sex}, isField(id) } */
  function value(n, env) {
    switch (n.op) {
      case 'num': return n.v;
      case 'blank': return BLANK;
      case 'id': {
        if (BUILTIN.has(n.v)) return env.ctx && env.ctx[n.v] != null ? env.ctx[n.v] : null;
        if (/^consent_/.test(n.v)) { const c = env.ctx && env.ctx.consent; return c ? (c[n.v.slice(8)] ? 'yes' : 'no') : null; }
        if (/^prev_/.test(n.v)) { const x = env.ctx && env.ctx.prev && env.ctx.prev[n.v.slice(5)]; return x == null || x === '' ? null : x; }
        if (env.isField(n.v)) return env.v(n.v);
        return n.v; // literal word
      }
      case '+': case '-': case '*': case '/': {
        const a = num(value(n.a, env)), b = num(value(n.b, env));
        if (a == null || b == null) return null;
        if (n.op === '/') return b === 0 ? null : a / b;
        return n.op === '+' ? a + b : n.op === '-' ? a - b : a * b;
      }
      case 'fn': {
        if (n.name === 'COUNT') return n.args.filter((x) => truthy(x, env)).length;
        if (n.name === 'IF') return truthy(n.args[0], env) ? value(n.args[1], env) : n.args[2] ? value(n.args[2], env) : null;
        if (['MEAN', 'MIN', 'MAX', 'SUM'].includes(n.name)) {
          const xs = n.args.map((x) => num(value(x, env)));
          if (n.name === 'SUM') return xs.some((x) => x == null) ? null : xs.reduce((s, x) => s + x, 0); // SUM needs every item
          const ok = xs.filter((x) => x != null);
          if (!ok.length) return null;
          return n.name === 'MEAN' ? ok.reduce((s, x) => s + x, 0) / ok.length : Math[n.name.toLowerCase()](...ok);
        }
        const x = value(n.args[0], env);
        if (n.name === 'ABS') { const k = num(x); return k == null ? null : Math.abs(k); }
        if (n.name === 'ROUND') {
          const k = num(x), d = n.args[1] ? num(value(n.args[1], env)) || 0 : 0;
          return k == null ? null : Math.round(k * 10 ** d) / 10 ** d;
        }
        const bp = x == null ? null : String(x).split('/').map(Number);
        if (!bp || bp.length !== 2 || bp.some(isNaN)) return null;
        return n.name === 'SYS' ? bp[0] : bp[1];
      }
      default: return truthy(n, env);
    }
  }
  function truthy(n, env) {
    switch (n.op) {
      case 'and': return truthy(n.a, env) && truthy(n.b, env);
      case 'or': return truthy(n.a, env) || truthy(n.b, env);
      case 'not': return !truthy(n.a, env);
      case '=': case '!=': {
        const a = value(n.a, env), b = value(n.b, env);
        let eq;
        if (a === BLANK || b === BLANK) eq = (a === BLANK ? b : a) == null || (a === BLANK ? b : a) === '';
        else if (a == null || b == null) return false; // unknown answers never match
        else if (num(a) != null && num(b) != null) eq = num(a) === num(b);
        else eq = String(a).toLowerCase() === String(b).toLowerCase();
        return n.op === '=' ? eq : !eq;
      }
      case '<': case '<=': case '>': case '>=': {
        const a = num(value(n.a, env)), b = num(value(n.b, env));
        if (a == null || b == null) return false;
        return n.op === '<' ? a < b : n.op === '<=' ? a <= b : n.op === '>' ? a > b : a >= b;
      }
      case 'id': {
        const x = value(n, env);
        return x === true || String(x).toLowerCase() === 'yes';
      }
      default: { const x = value(n, env); return x === true || (typeof x === 'number' && x !== 0); }
    }
  }

  /** "Your BP today: {sys_mean}/{dia_mean}" -> filled-in text. */
  function fill(template, env) {
    if (!template) return template;
    return String(template).replace(/\{([a-z_][a-z0-9_]*)\}/gi, (m, id) => {
      const x = value({ op: 'id', v: id }, env);
      if (x == null || x === id) return '?';
      return typeof x === 'number' ? String(Math.round(x * 10) / 10) : String(x);
    });
  }

  /* ------------------------------------------------------------------ */
  /* "Words in conversation" -> keyword patterns                         */
  /* ------------------------------------------------------------------ */
  /*
   * Phrase syntax (one or more phrases separated by |):
   *   words           matched in order, any spacing          side effect*
   *   word*           any ending                              dizz*
   *   a/b/c           any one of these words                  tablet/tablets/pills
   *   (word)          optional word                           (blood) pressure
   *   ...             up to ~40 characters in between         first ... BP
   *   N               a number within a few words             pulse N   ("pulse is about 84")
   *   #               a number straight after                 pulse #   ("pulse 84")
   *   DUR             a duration ("3 days", "two weeks"), converted to days
   *   BP              a blood pressure ("120/80", "120 over 80")
   *   [x10]           at the end: multiply the number          muac N cm [x10]
   *   re:…            a raw regular expression (developer pattern)
   * For yes/no fields:  yes: … | … ; no: …     For choice fields:  value: … ; value: …
   */
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function compilePhrase(raw) {
    let phrase = String(raw).trim();
    if (!phrase) return null;
    if (/^re:/i.test(phrase)) return { re: new RegExp(phrase.slice(3).trim(), 'i'), dev: true, mult: 1 };
    let mult = 1;
    const mm = /\s*\[x(\d+(?:\.\d+)?)\]\s*$/i.exec(phrase);
    if (mm) { mult = Number(mm[1]); phrase = phrase.slice(0, mm.index); }
    const toks = phrase.split(/\s+/).filter(Boolean);
    let src = '';
    let prev = null;
    toks.forEach((tok, i) => {
      let piece, kind;
      const edge = prev !== 'num'; // "12cm": no word boundary needed straight after a number
      if (tok === '...') { piece = '[^.?!\\n]{0,40}?'; kind = 'gap'; }
      else if (tok === 'N') { piece = '\\D{0,15}?(\\d+(?:\\.\\d+)?)'; kind = 'num'; }
      else if (tok === '#') { piece = '[\\s:=]*(\\d+(?:\\.\\d+)?)\\b'; kind = 'num'; }
      else if (tok === 'DUR') { piece = '(?:about\\s+|around\\s+|almost\\s+|over\\s+)?(\\w+)\\s+(day|week|month|year)s?\\b'; kind = 'dur'; }
      else if (tok === 'BP') { piece = '\\D{0,15}?(\\d{2,3})\\s*(?:\\/|over)\\s*(\\d{2,3})'; kind = 'num'; }
      else if (/^\(.+\)$/.test(tok)) { piece = '(?:' + alt(tok.slice(1, -1), edge) + '\\s+)?'; kind = 'opt'; }
      else { piece = alt(tok, edge); kind = 'word'; }
      let sep = '';
      if (i > 0 && kind !== 'num' && kind !== 'gap' && prev !== 'opt' && prev !== 'gap') sep = prev === 'num' ? '\\s*' : '\\s+';
      src += sep + piece;
      prev = kind;
    });
    return { re: new RegExp(src, 'i'), dev: false, mult };
  }
  /** a/b/c -> one of these whole words; word* -> any ending. */
  function alt(word, edge) {
    return '(?:' + word.split('/').map((w) => {
      const star = w.endsWith('*');
      const core = star ? w.slice(0, -1) : w;
      return (edge && /^\w/.test(core) ? '\\b' : '') + esc(core) + (star ? '\\w*' : /\w$/.test(core) ? '\\b' : '');
    }).join('|') + ')';
  }
  /** "yes: a | b ; no: c" -> {yes:[…], no:[…]}; plain "a | b" -> {'': […]} */
  function phraseGroups(text) {
    const out = {};
    String(text || '').split(/;(?![^(]*\))/).forEach((part) => {
      const m = /^\s*([a-z0-9_]+)\s*:\s*([\s\S]*)$/i.exec(part);
      const key = m && !/^re$/i.test(m[1]) ? m[1].toLowerCase() : '';
      const body = m && !/^re$/i.test(m[1]) ? m[2] : part;
      body.split(/\|(?![^(]*\))/).map((x) => x.trim()).filter(Boolean).forEach((x) => (out[key] = out[key] || []).push(x));
    });
    return out;
  }
  const union = (list) => new RegExp(list.map((p) => '(?:' + p.re.source + ')').join('|'), 'i');

  /** Build the keyword extractor for a field from its phrases. Returns null if there are none. */
  function buildExtractor(f) {
    if (!f.words) return null;
    const g = phraseGroups(f.words);
    const comp = (list) => (list || []).map(compilePhrase).filter(Boolean);
    const latest = (list, conv) => (t, x) => {
      let best = null;
      list.forEach((p) => {
        const g2 = new RegExp(p.re.source, 'gi');
        let m;
        while ((m = g2.exec(t))) {
          const val = conv(m, x, p);
          if (val != null && (!best || m.index >= best.span[0])) best = { value: val, span: [m.index, m.index + m[0].length] };
          if (m[0] === '') g2.lastIndex++;
        }
      });
      return best;
    };
    if (f.type === 'yesno') {
      const yes = comp(g.yes || g['']), no = comp(g.no);
      if (!yes.length && !no.length) return null;
      const yr = yes.length ? union(yes) : /(?!)/, nr = no.length ? union(no) : null;
      return (t, x) => x.yesno(t, yr, nr);
    }
    if (f.type === 'choice') {
      // When two answers match at the same place, the first listed wins.
      const opts = new Map((f.options || []).map(([v]) => [v.toLowerCase(), v]));
      const pairs = Object.keys(g).filter((k) => opts.has(k)).map((k) => [opts.get(k), union(comp(g[k]))]);
      return pairs.length ? (t, x) => x.choice(t, pairs) : null;
    }
    const list = comp(g['']);
    if (f.type === 'bp') {
      return latest(list, (m) => {
        if (!m[1] || !m[2]) return null;
        const s = Number(m[1]), d = Number(m[2]);
        return s > d ? s + '/' + d : null;
      });
    }
    if (f.type === 'number') {
      return latest(list, (m, x, p) => {
        const n = x.toNumber(m[1]);
        if (n == null) return null;
        const v = Math.round(n * p.mult * 100) / 100;
        return (f.min != null && v < f.min) || (f.max != null && v > f.max) ? null : v;
      });
    }
    return null;
  }

  RS.rules = { BUILTIN, isBuiltin, parse, tokenize, names, comparedLiterals, truthy, value, fill, compilePhrase, phraseGroups, buildExtractor };
  if (typeof module !== 'undefined') module.exports = RS.rules;
})();
