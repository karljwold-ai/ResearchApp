/*
 * Listening: reads protocol answers out of a visit conversation, so the data collector can
 * confirm them ("Suggest" mode) or be warned when what was entered differs from what was said
 * ("Check only" mode). Keyword rules only, from each field's `words` (see js/rules.js).
 * The helpers below are the same as in the ICEHALL clinical app.
 */
(function () {
  'use strict';
  const RS = (typeof window !== 'undefined' ? window : global).RS;

  const NUM_WORDS = { zero: 0, a: 1, one: 1, two: 2, couple: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fourteen: 14, few: 3 };
  const NEG = /\b(no|not|never|none|denies|deny|without|don'?t|doesn'?t|didn'?t|isn'?t|hasn'?t|haven'?t|can'?t|cannot|unable)\b/i;

  // True when the sentence containing `index` ends in "?" (a question, not an answer).
  function inQuestion(t, index) {
    const m = t.slice(index).match(/[.?!\n]/);
    return !!m && m[0] === '?';
  }
  // Text from the start of the clause up to `index`.
  function clauseBefore(t, index) {
    return t.slice(Math.max(0, index - 60), index).split(/[.?!\n,;:]|\bbut\b/i).pop();
  }
  // A bare "Yes" / "No" answering the question that contains `index`
  // ("CHW: Any fever?" / "Patient: Yes."). Only clear yes/no words count.
  const YES_WORDS = /^(yes|yeah|yep|yup|uh-?huh|sure)\b/i;
  const NO_WORDS = /^(no|nope|not really|never|none)\b/i;
  function answerAfter(t, index) {
    const q = t.indexOf('?', index);
    if (q < 0) return null;
    const m = t.slice(q + 1).match(/^\s*(?:[A-Za-z ]{2,20}:\s*)?(yes|yeah|yep|yup|uh-?huh|sure|no|nope|not really|never|none)\b/i);
    if (!m) return null;
    const start = q + 1 + m.index + m[0].length - m[1].length;
    return { value: NO_WORDS.test(m[1]) ? 'no' : YES_WORDS.test(m[1]) ? 'yes' : null, span: [start, start + m[1].length] };
  }
  // Hedging right after a statement ("No chest pain, well maybe a little").
  const HEDGE = /\b(maybe|perhaps|a little|a bit|sometimes|not sure|i think|kind of|sort of|i guess|on and off)\b/i;
  function hedgedAfter(t, end) {
    const rest = t.slice(end, end + 70);
    const stop = rest.search(/\n|[.?!](?=\s+[A-Z][a-z]*:)/);
    return HEDGE.test(stop >= 0 ? rest.slice(0, stop) : rest);
  }

  RS.x = {
    /**
     * Yes/no. Considers every match of `yes` (negated by "no/not/denies..." earlier in the
     * same clause) and of the optional explicit `no` regex. A match inside a question
     * counts only if the next reply is a bare "yes"/"no". The latest statement wins, so
     * later corrections take effect. Hedged answers are marked `uncertain`.
     */
    yesno(t, yes, no) {
      let best = null;
      const take = (value, start, end) => {
        if (!best || start >= best.span[0]) best = { value, span: [start, end], uncertain: hedgedAfter(t, end) || undefined };
      };
      const fromQuestion = (m) => { const a = answerAfter(t, m.index); if (a && a.value) take(a.value, a.span[0], a.span[1]); };
      if (no) execAll(no, t).forEach((m) => { if (inQuestion(t, m.index)) return; take('no', m.index, m.index + m[0].length); });
      execAll(yes, t).forEach((m) => {
        if (inQuestion(t, m.index)) { fromQuestion(m); return; }
        const clause = clauseBefore(t, m.index);
        if (NEG.test(clause)) take('no', m.index - clause.length, m.index + m[0].length);
        else take('yes', m.index, m.index + m[0].length);
      });
      return best;
    },
    /** Number: capture group 1 of regex (number words allowed). */
    number(t, re, opts) {
      opts = opts || {};
      let best = null; // latest valid reading wins (re-measurements)
      for (const m of execAll(re, t)) {
        const v = toNumber(m[1]);
        if (v == null) continue;
        if (opts.min != null && v < opts.min) continue;
        if (opts.max != null && v > opts.max) continue;
        best = { value: v, span: [m.index, m.index + m[0].length] };
      }
      return best;
    },
    /** Choice: first entry of [[value, regex], ...] that matches. */
    choice(t, pairs) {
      let best = null;
      pairs.forEach(([value, re]) => {
        const m = execAll(re, t)[0];
        if (m && (!best || m.index < best.span[0])) best = { value, span: [m.index, m.index + m[0].length] };
      });
      return best;
    },
    toNumber,
  };

  function execAll(re, t) {
    const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
    const g = new RegExp(re.source, flags);
    const out = [];
    let m;
    while ((m = g.exec(t))) { out.push(m); if (m[0] === '') g.lastIndex++; }
    return out;
  }
  function toNumber(s) {
    if (s == null) return null;
    s = String(s).toLowerCase().trim();
    if (NUM_WORDS[s] != null) return NUM_WORDS[s];
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  }


  function quoteAround(t, span) {
    if (!span) return '';
    let s = span[0], e = span[1];
    // Sentence boundaries, ignoring decimal points such as "38.6".
    const isEnd = (i) => /[?!\n]/.test(t[i]) || (t[i] === '.' && !(/\d/.test(t[i - 1] || '') && /\d/.test(t[i + 1] || '')));
    while (s > 0 && !isEnd(s - 1)) s--;
    while (e < t.length && !isEnd(e)) e++;
    return t.slice(s, Math.min(t.length, e + 1)).trim().replace(/^[A-Za-z ]{2,20}:\s*/, '');
  }

  /** {fieldId: {value, quote, uncertain?}} for the fields given (each needs `extract`). */
  function listen(transcript, fields) {
    const out = {};
    if (!transcript || !transcript.trim()) return out;
    fields.forEach((f) => {
      if (typeof f.extract !== 'function') return;
      try {
        const r = f.extract(transcript, RS.x);
        if (r && r.value != null && r.value !== '') out[f.id] = { value: r.value, quote: quoteAround(transcript, r.span), uncertain: r.uncertain || undefined };
      } catch (e) { console.warn('listen failed', f.id, e); }
    });
    return out;
  }

  /** Do an entered value and a heard value agree? (numbers within the field's tolerance) */
  function agrees(f, entered, heard) {
    if (entered == null || entered === '' || heard == null) return true;
    if (f.type === 'number') return Math.abs(Number(entered) - Number(heard)) <= (f.tolerance != null ? f.tolerance : 0);
    if (f.type === 'bp') return String(entered).replace(/\s/g, '') === String(heard).replace(/\s/g, '');
    return String(entered).toLowerCase() === String(heard).toLowerCase();
  }

  RS.quoteAround = quoteAround;
  RS.listen = listen;
  RS.agrees = agrees;
  if (typeof module !== 'undefined') module.exports = { listen, agrees, quoteAround };
})();
