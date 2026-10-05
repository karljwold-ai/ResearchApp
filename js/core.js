/*
 * ICEHALL Research: core (no screen code here, so the tests can run it in Node).
 *   - dates and visit windows
 *   - the protocol registry: a protocol is data (see docs/PROTOCOL_FORMAT.md), checked when it loads
 *   - eligibility, visible fields, derived values, validation, safety rules
 *   - schedule, data queries, audit trail, messages, CSV export
 *   - storage (localStorage, this device only)
 */
(function () {
  'use strict';
  const G = typeof window !== 'undefined' ? window : global;
  const RS = (G.RS = G.RS || {});

  /* ------------------------------------------------------------------ */
  /* Dates (ISO yyyy-mm-dd strings, local time)                          */
  /* ------------------------------------------------------------------ */
  const DAY = 86400000;
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return ymd(d); };
  const between = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / DAY);
  const today = () => ymd(new Date());
  const fmt = (iso) => (iso ? new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '');
  const fmtLong = (iso) => (iso ? new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  function ageYears(dob, on) {
    if (!dob) return null;
    const a = new Date(dob + 'T00:00:00'), b = new Date((on || today()) + 'T00:00:00');
    let y = b.getFullYear() - a.getFullYear();
    if (b.getMonth() < a.getMonth() || (b.getMonth() === a.getMonth() && b.getDate() < a.getDate())) y--;
    return y;
  }
  /** Approximate date of birth from a stated age (1 July of the year), marked as estimated by the caller. */
  const dobFromAge = (years, on) => `${Number((on || today()).slice(0, 4)) - years - (Number((on || today()).slice(5, 7)) < 7 ? 1 : 0)}-07-01`;
  RS.date = { ymd, addDays, between, today, fmt, fmtLong, ageYears, dobFromAge };

  /* ------------------------------------------------------------------ */
  /* Protocols                                                           */
  /* ------------------------------------------------------------------ */
  RS.protocols = {};
  const TYPES = new Set(['number', 'yesno', 'choice', 'text', 'bp', 'date']);
  const LEVELS = ['urgent', 'soon', 'report', 'note'];

  /**
   * Check a protocol and prepare it (parsed conditions, field index, listening patterns).
   * Throws one error listing every problem, so a broken protocol never half-loads.
   */
  RS.registerProtocol = function (p) {
    const errs = [];
    const err = (where, msg) => errs.push(`${where}: ${msg}`);
    p.fields = {};
    p.formOf = {};
    const addField = (f, form) => {
      if (!f.id || !/^[a-z][a-z0-9_]*$/.test(f.id)) return err(form, `field id “${f.id}” must be lower case letters, digits and _`);
      if (p.fields[f.id]) return err(form, `field id “${f.id}” is used twice`);
      if (RS.rules.isBuiltin(f.id)) return err(form, `“${f.id}” is a built-in name`);
      if (!TYPES.has(f.type)) err(f.id, `unknown type “${f.type}”`);
      if (f.type === 'choice' && !(f.options || []).length) err(f.id, 'a choice needs options');
      if (f.type === 'yesno') f.options = f.options || [['yes', 'Yes'], ['no', 'No']];
      if (f.type === 'number' && f.min != null && f.max != null && f.min > f.max) err(f.id, 'min is above max');
      p.fields[f.id] = f;
      p.formOf[f.id] = form;
    };
    (p.screening.fields || []).forEach((f) => addField(f, 'screening'));
    Object.entries(p.forms).forEach(([id, form]) => { form.id = id; form.fields.forEach((f) => addField(f, id)); });
    p.derivedById = {};
    (p.derived || []).forEach((d) => { if (p.fields[d.id] || p.derivedById[d.id]) err(d.id, 'derived id is already used'); p.derivedById[d.id] = d; });
    const isField = (id) => !!(p.fields[id] || p.derivedById[id]);
    p.isField = isField;

    const cond = (where, src) => {
      try {
        const tree = RS.rules.parse(src);
        const lits = new Set(RS.rules.comparedLiterals(tree, (id) => isField(id) || RS.rules.isBuiltin(id)).map(([, lit]) => lit));
        RS.rules.names(tree).forEach((n) => {
          if (!isField(n) && !RS.rules.isBuiltin(n) && !lits.has(n)) err(where, `unknown name “${n}” in “${src}”`);
          if (/^consent_/.test(n) && !(p.consent.options || []).some((o) => o.id === n.slice(8))) err(where, `“${n}”: there is no consent option “${n.slice(8)}”`);
          if (/^prev_/.test(n) && !isField(n.slice(5))) err(where, `“${n}”: there is no field “${n.slice(5)}”`);
        });
        lits.forEach((lit) => { if (/^(m\d+|baseline)$/.test(lit) && !p.visits.some((v) => v.id === lit)) err(where, `unknown visit “${lit}”`); });
        RS.rules.comparedLiterals(tree, isField).forEach(([fid, lit]) => {
          const f = p.fields[fid];
          if (f && f.options && !f.options.some(([v]) => v.toLowerCase() === lit.toLowerCase())) err(where, `“${lit}” is not an answer of ${fid}`);
        });
        return tree;
      } catch (e) { err(where, e.message); return null; }
    };
    Object.values(p.forms).forEach((form) => { if (form.show) form.showTree = cond(form.id + ' (form show)', form.show); });
    Object.values(p.fields).forEach((f) => {
      if (f.show) f.showTree = cond(f.id + ' (show)', f.show);
      if (f.words) { try { f.extract = RS.rules.buildExtractor(f); } catch (e) { err(f.id + ' (words)', e.message); } }
    });
    (p.derived || []).forEach((d) => { d.tree = cond(d.id, d.expr); });
    (p.eligibility || []).forEach((c) => {
      if (!['include', 'exclude'].includes(c.kind)) err(c.id, 'kind must be include or exclude');
      c.tree = cond(c.id, c.when);
    });
    (p.safety || []).forEach((r) => {
      if (!LEVELS.includes(r.level)) err(r.id, `level must be one of ${LEVELS.join(', ')}`);
      r.tree = cond(r.id, r.when);
    });
    const seen = new Set();
    p.visits.forEach((v, i) => {
      if (seen.has(v.id)) err(v.id, 'visit id is used twice');
      seen.add(v.id);
      v.before = v.before || 0; v.after = v.after || 0;
      if (i === 0 && v.day !== 0) err(v.id, 'the first visit must be day 0 (the initial visit)');
      (v.forms || []).forEach((fid) => { if (!p.forms[fid]) err(v.id, `unknown form “${fid}”`); });
    });
    const enc = (p.messages && p.messages.encouragement) || [];
    enc.forEach((e) => { e.tree = e.when ? cond('message ' + e.id, e.when) : null; if (!p.messages.templates[e.template]) err('message ' + e.id, `unknown template “${e.template}”`); });
    if (!p.consent || !p.consent.version) err('consent', 'a consent version is required');
    (p.safety || []).forEach((r) => { if (r.referTo && !(p.referralSites || []).some((s) => s.id === r.referTo)) err(r.id, `referTo “${r.referTo}” is not a referral site`); });
    ((p.analysis && p.analysis.measures) || []).forEach((m) => {
      if (!isField(m.id)) err('analysis', `measure “${m.id}” is not a field or calculated value`);
      if (m.cohort && !p.derivedById[m.cohort]) err('analysis', `cohort “${m.cohort}” is not a calculated value`);
    });
    if (p.messages) ['reminder', 'missed'].forEach((t) => { if (!p.messages.templates[t]) err('messages', `a “${t}” template is required`); });
    if (p.messages && !(p.consent.options || []).some((o) => o.id === p.messages.consentOption)) err('messages', `consentOption “${p.messages.consentOption}” is not a consent option`);
    if (errs.length) throw new Error(`Protocol ${p.id} has problems:\n- ` + errs.join('\n- '));
    RS.protocols[p.id] = p;
    if (!RS.activeProtocol) RS.activeProtocol = p.id;
    return p;
  };

  /* ------------------------------------------------------------------ */
  /* Values, eligibility, validation, safety                             */
  /* ------------------------------------------------------------------ */
  const blank = (x) => x == null || x === '';
  /** Built-in names for conditions (age_years, sex, visit), plus the screening answers as a fallback for later forms. */
  RS.ctxFor = (part, on, visitId, prev) => ({
    age_years: ageYears(part && part.dob, on),
    sex: part && part.sex === 'F' ? 'female' : part && part.sex === 'M' ? 'male' : null,
    visit: visitId || null,
    base: (part && part.screening && part.screening.answers) || {},
    consent: part && part.consent ? part.consent.options : null,
    prev: prev || {},
  });
  /** ctxFor with prev_ values taken from the participant's completed visits before `rec` (or all, without rec). */
  RS.ctxForVisit = (db, part, rec, on) => {
    const prior = db.visits.filter((r) => r.participantId === part.id && r.status === 'complete' && r.id !== (rec && rec.id) && (!rec || !rec.date || r.date <= rec.date));
    const prev = prior.sort((a, b) => a.date.localeCompare(b.date)).reduce((acc, r) => { Object.entries(r.values).forEach(([k, v]) => { if (!blank(v)) acc[k] = v; }); return acc; }, {});
    return RS.ctxFor(part, on || (rec && rec.date), rec && rec.visit, prev);
  };

  /** Environment for conditions over a set of answers (derived values included). */
  function envFor(proto, values, ctx) {
    const derived = {};
    const env = {
      ctx,
      isField: proto.isField,
      v: (id) => {
        if (proto.derivedById[id]) return derived[id];
        if (!blank(values[id])) return values[id];
        const b = ctx && ctx.base && ctx.base[id];
        return blank(b) ? null : b;
      },
    };
    (proto.derived || []).forEach((d) => {
      // Unknown if any value it uses is missing (unless `partial`); yes/no for conditions, a rounded number otherwise.
      if (!d.partial && [...RS.rules.names(d.tree)].some((n) => proto.isField(n) && env.v(n) == null)) { derived[d.id] = null; return; }
      if ((d.needs || []).some((n) => env.v(n) == null)) { derived[d.id] = null; return; }
      const x = RS.rules.value(d.tree, env);
      if (typeof x === 'boolean') derived[d.id] = x ? 'yes' : 'no';
      else derived[d.id] = typeof x === 'number' && isFinite(x) ? Math.round(x * 10 ** (d.decimals || 0)) / 10 ** (d.decimals || 0) : null;
    });
    env.derived = derived;
    return env;
  }
  RS.envFor = envFor;
  RS.derive = (proto, values, ctx) => envFor(proto, values, ctx).derived;

  const shown = (f, env) => !f.showTree || RS.rules.truthy(f.showTree, env);
  /** Sections to show for a visit: [{form, fields}] (fields hidden by "show" rules left out). */
  RS.visitSections = function (proto, visitDef, values, ctx) {
    ctx = Object.assign({}, ctx, { visit: visitDef.id });
    const env = envFor(proto, values, ctx);
    return visitDef.forms.map((fid) => proto.forms[fid]).filter((form) => !form.showTree || RS.rules.truthy(form.showTree, env))
      .map((form) => ({ form, fields: form.fields.filter((f) => shown(f, env)) })).filter((x) => x.fields.length);
  };
  RS.screeningFields = (proto, answers, ctx) => { const env = envFor(proto, answers, ctx); return proto.screening.fields.filter((f) => shown(f, env)); };

  /**
   * Eligibility from screening answers. Each criterion is met, not met, or unknown (missing answers).
   * eligible: true / false / null (not decided yet).
   */
  RS.eligibility = function (proto, answers, ctx) {
    const env = envFor(proto, answers, ctx);
    const rows = proto.eligibility.map((c) => {
      const names = [...RS.rules.names(c.tree)].filter((n) => proto.fields[n] && shown(proto.fields[n], env));
      const builtinMissing = [...RS.rules.names(c.tree)].some((n) => RS.rules.BUILTIN.has(n) && ctx[n] == null);
      const hit = RS.rules.truthy(c.tree, env);
      const missing = names.filter((n) => blank(answers[n]));
      // Unknown only if the result could still change: nothing true yet and answers missing.
      const unknown = !hit && (missing.length > 0 || builtinMissing);
      const ok = c.kind === 'include' ? hit : !hit;
      return { c, state: unknown && c.kind === 'include' ? 'unknown' : unknown && c.kind === 'exclude' ? 'unknown' : ok ? 'met' : 'failed' };
    });
    const failed = rows.filter((r) => r.state === 'failed');
    const unknown = rows.filter((r) => r.state === 'unknown');
    return { rows, failed, unknown, eligible: failed.length ? false : unknown.length ? null : true };
  };

  /** Problems with one value: {hard} blocks saving; {soft} raises a data query. */
  RS.checkValue = function (f, v) {
    if (blank(v)) return {};
    if (f.type === 'number') {
      const n = Number(v);
      if (isNaN(n)) return { hard: 'Enter a number' };
      if (f.integer && !Number.isInteger(n)) return { hard: 'Enter a whole number' };
      if (f.min != null && n < f.min) return { hard: `Must be at least ${f.min}${f.unit ? ' ' + f.unit : ''}` };
      if (f.max != null && n > f.max) return { hard: `Must be at most ${f.max}${f.unit ? ' ' + f.unit : ''}` };
      if (f.soft && (n < f.soft[0] || n > f.soft[1])) return { soft: `Unusual value (expected ${f.soft[0]}–${f.soft[1]}${f.unit ? ' ' + f.unit : ''}). Check and confirm.` };
    }
    if (f.type === 'bp') {
      const m = /^\s*(\d{2,3})\s*\/\s*(\d{2,3})\s*$/.exec(String(v));
      if (!m) return { hard: 'Enter as systolic/diastolic, e.g. 132/84' };
      const s = Number(m[1]), d = Number(m[2]);
      const L = f.limits || { sys: [60, 280], dia: [30, 180] };
      if (s <= d) return { hard: 'Systolic must be higher than diastolic' };
      if (s < L.sys[0] || s > L.sys[1] || d < L.dia[0] || d > L.dia[1]) return { hard: `Outside possible range (${L.sys.join('–')} / ${L.dia.join('–')})` };
      const S = f.soft;
      if (S && (s < S.sys[0] || s > S.sys[1] || d < S.dia[0] || d > S.dia[1])) return { soft: `Unusual reading (expected ${S.sys.join('–')} / ${S.dia.join('–')}). Re-measure and confirm.` };
    }
    if (f.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(String(v))) return { hard: 'Enter a date' };
    if ((f.type === 'choice' || f.type === 'yesno') && !f.options.some(([o]) => o === v)) return { hard: 'Choose one of the answers' };
    return {};
  };

  /**
   * Is a visit ready to complete?
   * errors: hard range errors and required fields with no value and no missing-data reason.
   * softs: unusual values (become data queries unless corrected).
   * disagreements: values that differ from what was heard and haven't been resolved.
   */
  RS.validateVisit = function (proto, visitDef, rec, ctx) {
    const errors = [], softs = [], disagreements = [];
    RS.visitSections(proto, visitDef, rec.values, ctx).forEach(({ fields }) => fields.forEach((f) => {
      const v = rec.values[f.id];
      const c = RS.checkValue(f, v);
      if (c.hard) errors.push({ field: f.id, text: c.hard });
      else if (c.soft) softs.push({ field: f.id, text: c.soft });
      if (blank(v) && f.required && !(rec.missing || {})[f.id]) errors.push({ field: f.id, text: 'Required: enter a value or give a reason it is missing' });
      const h = (rec.heard || {})[f.id];
      if (h && !blank(v) && !RS.agrees(f, v, h.value) && !(rec.checks || {})[f.id]) disagreements.push({ field: f.id, heard: h.value, entered: v });
    }));
    return { errors, softs, disagreements, ok: !errors.length && !disagreements.length };
  };

  /** Safety rules that fire for these values: [{rule, text}] most serious first. */
  RS.safety = function (proto, values, ctx) {
    const env = envFor(proto, values, ctx);
    return (proto.safety || []).filter((r) => RS.rules.truthy(r.tree, env)).map((r) => ({ rule: r, text: RS.rules.fill(r.text, env) }))
      .sort((a, b) => LEVELS.indexOf(a.rule.level) - LEVELS.indexOf(b.rule.level));
  };

  /* ------------------------------------------------------------------ */
  /* Schedule                                                            */
  /* ------------------------------------------------------------------ */
  /** {start, ideal, end} for a protocol visit, anchored on the enrolment date (missed visits don't shift later ones). */
  RS.visitWindow = (part, v) => {
    const ideal = addDays(part.enrolledAt, v.day);
    return { start: addDays(ideal, -v.before), ideal, end: addDays(ideal, v.after) };
  };
  const doneRec = (db, pid, vid) => db.visits.find((r) => r.participantId === pid && r.visit === vid && r.status === 'complete');
  RS.doneRec = doneRec;
  RS.draftRec = (db, pid, vid) => db.visits.find((r) => r.participantId === pid && r.visit === vid && r.status === 'draft');

  /**
   * 'done' | 'due' (window open) | 'upcoming' | 'missed' (window closed, not done) | 'stopped' (withdrawn first)
   */
  RS.visitStatus = function (db, part, v, on) {
    on = on || today();
    if (doneRec(db, part.id, v.id)) return 'done';
    const w = RS.visitWindow(part, v);
    if (part.status === 'withdrawn' && (!part.withdrawal || part.withdrawal.date <= w.end)) return 'stopped';
    if (on > w.end) return 'missed';
    if (on >= w.start) return 'due';
    return 'upcoming';
  };

  /** The most recent recorded value of every field across a participant's completed visits. */
  RS.latestValues = (db, pid) => db.visits.filter((r) => r.participantId === pid && r.status === 'complete').sort((a, b) => a.date.localeCompare(b.date))
    .reduce((acc, r) => { Object.entries(r.values).forEach(([k, v]) => { if (!blank(v)) acc[k] = v; }); return acc; }, {});

  /** Can a visit be started today? Open window: yes. Closed window: yes, recorded as out of window (protocol deviation). */
  RS.canStart = (db, part, v, on) => part.status === 'enrolled' && ['due', 'missed'].includes(RS.visitStatus(db, part, v, on));

  /** Rows for the Schedule screen: every enrolled participant's visits that are missed, due, or open within `horizon` days. */
  RS.scheduleRows = function (db, proto, on, horizon) {
    on = on || today();
    horizon = horizon == null ? 30 : horizon;
    const rows = [];
    db.participants.filter((p) => p.status === 'enrolled').forEach((p) => {
      proto.visits.slice(1).forEach((v) => {
        const status = RS.visitStatus(db, p, v, on);
        const w = RS.visitWindow(p, v);
        if (status === 'done' || status === 'stopped') return;
        if (status === 'upcoming' && between(on, w.start) > horizon) return;
        // A missed visit stays on the list until the next visit's window opens.
        if (status === 'missed') {
          const next = proto.visits[proto.visits.indexOf(v) + 1];
          if (next && on >= RS.visitWindow(p, next).start) return;
        }
        rows.push({ participant: p, visit: v, window: w, status, draft: !!RS.draftRec(db, p.id, v.id) });
      });
    });
    const ORDER = { missed: 0, due: 1, upcoming: 2 };
    return rows.sort((a, b) => ORDER[a.status] - ORDER[b.status] || (a.status === 'upcoming' ? a.window.start.localeCompare(b.window.start) : a.window.end.localeCompare(b.window.end)));
  };

  /** The participant's next visit that isn't done (or null when finished). */
  RS.nextVisit = function (db, proto, part, on) {
    for (const v of proto.visits) {
      const s = RS.visitStatus(db, part, v, on);
      if (s === 'due' || s === 'upcoming') return { visit: v, status: s, window: RS.visitWindow(part, v) };
    }
    return null;
  };

  /** "Due now · until 14 Oct", "Opens in 5 days", "Window closed 3 days ago". */
  RS.windowText = function (status, w, on) {
    on = on || today();
    const pl = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
    if (status === 'done') return 'Done';
    if (status === 'stopped') return 'Not done (withdrawn)';
    if (status === 'missed') return `Window closed ${pl(between(w.end, on), 'day')} ago`;
    if (status === 'due') { const left = between(on, w.end); return left === 0 ? 'Due now · last day' : `Due now · until ${fmt(w.end)}`; }
    const n = between(on, w.start);
    return n === 1 ? 'Opens tomorrow' : `Opens in ${pl(n, 'day')}`;
  };
  RS.rangeText = (w) => (w.start === w.end ? fmt(w.ideal) : `${fmt(w.start)} – ${fmt(w.end)} (ideal ${fmt(w.ideal)})`);

  /* ------------------------------------------------------------------ */
  /* Data queries and audit                                              */
  /* ------------------------------------------------------------------ */
  let n = 0;
  const uid = (p) => p + '-' + Date.now().toString(36) + (n++).toString(36) + Math.random().toString(36).slice(2, 4);
  RS.uid = uid;

  RS.audit = (db, e) => { db.audit.push(Object.assign({ id: uid('a'), at: new Date().toISOString() }, e)); };

  RS.raiseQuery = (db, q) => {
    const x = Object.assign({ id: uid('q'), status: 'open', raisedAt: new Date().toISOString(), thread: [] }, q);
    db.queries.push(x);
    return x;
  };

  /* ------------------------------------------------------------------ */
  /* Messages                                                            */
  /* ------------------------------------------------------------------ */
  RS.firstName = (p) => (p.name || '').trim().split(/\s+/)[0] || 'there';
  /** Can this participant be sent SMS? Needs an enrolled status, SMS consent and a phone number. */
  RS.protocol = () => RS.protocols[RS.activeProtocol];
  RS.canText = (p) => p.status === 'enrolled' && !!(p.consent && p.consent.options && p.consent.options[RS.protocol().messages.consentOption]) && !!(p.phone || '').trim();

  RS.fillMessage = (text, vars) => String(text || '').replace(/\{([a-z_]+)\}/g, (m, k) => (vars[k] != null && vars[k] !== '' ? String(vars[k]) : m));
  RS.messageVars = function (proto, p, visit, staff) {
    const w = visit && p.enrolledAt ? RS.visitWindow(p, visit) : null;
    return {
      first_name: RS.firstName(p), study: proto.short, study_phone: proto.studyPhone, collector: staff || '',
      visit: visit ? visit.label.toLowerCase() : '', from: w ? fmt(w.start) : '', to: w ? fmt(w.end) : '', ideal: w ? fmt(w.ideal) : '',
    };
  };
  /** SMS length: 160 characters per part (153 when split); other characters use 70/67. */
  RS.smsParts = (text) => {
    const gsm = /^[\x20-\x7E\n\r£¥èéùìòÇØøÅå]*$/.test(text);
    const one = gsm ? 160 : 70, multi = gsm ? 153 : 67;
    return { chars: text.length, parts: text.length <= one ? 1 : Math.ceil(text.length / multi), limit: one };
  };

  const lastSent = (db, pid, kind, key) => db.messages.filter((m) => m.status === 'sent' && m.kind === kind && (key == null || m.key === key) && m.recipients.some((r) => r.participantId === pid)).map((m) => m.sentAt).sort().pop();

  /**
   * Messages the algorithm suggests today (drafts for staff to check and send):
   *   reminder        a visit window opens within `reminderDaysBefore` days, or is open, and no reminder was sent for it
   *   missed          a window closed in the last `missedWithinDays` days and the visit wasn't done
   *   encouragement   protocol rules (e.g. on medicines at the latest visit), at most every `everyDays`
   * Only participants who agreed to SMS and have a phone. Returns [{kind, key, participant, visit?, text, why}].
   */
  RS.suggestMessages = function (db, proto, on, staff) {
    on = on || today();
    const M = proto.messages;
    const out = [];
    db.participants.filter(RS.canText).forEach((p) => {
      proto.visits.slice(1).forEach((v) => {
        const s = RS.visitStatus(db, p, v, on);
        const w = RS.visitWindow(p, v);
        const key = `${p.id}:${v.id}`;
        if ((s === 'due' || (s === 'upcoming' && between(on, w.start) <= M.reminderDaysBefore)) && !lastSent(db, p.id, 'reminder', key)) {
          out.push({ kind: 'reminder', key, participant: p, visit: v, text: RS.fillMessage(M.templates.reminder.text, RS.messageVars(proto, p, v, staff)), why: `${v.label}: ${RS.windowText(s, w, on).toLowerCase()}` });
        }
        if (s === 'missed' && between(w.end, on) <= M.missedWithinDays && !lastSent(db, p.id, 'missed', key)) {
          out.push({ kind: 'missed', key, participant: p, visit: v, text: RS.fillMessage(M.templates.missed.text, RS.messageVars(proto, p, v, staff)), why: `${v.label}: window closed ${fmt(w.end)}` });
        }
      });
      const latest = RS.latestValues(db, p.id);
      (M.encouragement || []).forEach((e) => {
        if (e.tree && !RS.rules.truthy(e.tree, envFor(proto, latest, RS.ctxFor(p, on, null, latest)))) return;
        const last = lastSent(db, p.id, 'encouragement', e.id);
        if (last && between(last.slice(0, 10), on) < e.everyDays) return;
        out.push({ kind: 'encouragement', key: e.id, participant: p, text: RS.fillMessage(M.templates[e.template].text, RS.messageVars(proto, p, null, staff)), why: e.why });
      });
    });
    return out;
  };

  /* ------------------------------------------------------------------ */
  /* Referrals                                                           */
  /* ------------------------------------------------------------------ */
  /**
   * Group fired safety rules into referrals, one per destination: [{to, urgency, rules: [fired]}].
   * Only rules with a `referTo` refer; the most urgent rule sets the urgency.
   */
  RS.referralsFor = function (proto, fired) {
    const by = new Map();
    fired.filter((s) => s.rule.referTo).forEach((s) => {
      const k = s.rule.referTo;
      if (!by.has(k)) by.set(k, { to: k, rules: [] });
      by.get(k).rules.push(s);
    });
    return [...by.values()].map((g) => Object.assign(g, { urgency: g.rules.some((s) => s.rule.level === 'urgent') ? 'urgent' : 'soon' }));
  };
  RS.referralSite = (proto, id) => (proto.referralSites || []).find((s) => s.id === id) || { id, name: id };

  /* ------------------------------------------------------------------ */
  /* Households                                                          */
  /* ------------------------------------------------------------------ */
  RS.householdMembers = (db, p) => (p.household ? db.participants.filter((x) => x.household === p.household && x.id !== p.id) : []);
  RS.newHouseholdId = (db) => {
    const nums = db.participants.map((p) => Number(String(p.household || '').replace(/\D/g, ''))).filter((x) => x);
    return 'H-' + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0');
  };

  /* ------------------------------------------------------------------ */
  /* Who did what: collector of a cluster                                */
  /* ------------------------------------------------------------------ */
  RS.collectorFor = (users, clusterId) => (users || []).find((u) => (u.clusters || []).includes(clusterId)) || null;

  /**
   * Follow-up and data-quality figures for a set of participants (e.g. one cluster or one collector).
   * Counts only follow-up visits whose window has opened.
   */
  RS.performance = function (db, proto, parts, on) {
    on = on || today();
    const ids = new Set(parts.map((p) => p.id));
    let due = 0, done = 0, inWin = 0, missed = 0, openNow = 0;
    parts.filter((p) => p.enrolledAt).forEach((p) => proto.visits.slice(1).forEach((v) => {
      const s = RS.visitStatus(db, p, v, on);
      const w = RS.visitWindow(p, v);
      if (s === 'upcoming' || s === 'stopped') return;
      if (s === 'due') { openNow++; return; }
      due++;
      if (s === 'done') {
        done++;
        const r = doneRec(db, p.id, v.id);
        if (r.date >= w.start && r.date <= w.end) inWin++;
      } else missed++;
    }));
    const recs = db.visits.filter((r) => ids.has(r.participantId) && r.status === 'complete');
    let need = 0, have = 0;
    recs.forEach((r) => {
      const p = db.participants.find((x) => x.id === r.participantId);
      RS.visitSections(proto, proto.visits.find((v) => v.id === r.visit), r.values, RS.ctxForVisit(db, p, r)).forEach((s) => s.fields.forEach((f) => {
        if (!f.required) return;
        need++;
        if (!blank(r.values[f.id])) have++;
      }));
    });
    const refs = (db.referrals || []).filter((x) => ids.has(x.participantId));
    const refsClosed = refs.filter((x) => x.status !== 'open');
    return {
      enrolled: parts.filter((p) => p.enrolledAt).length,
      withdrawn: parts.filter((p) => p.status === 'withdrawn').length,
      visitsDue: due, visitsDone: done, visitsInWindow: inWin, visitsMissed: missed, openNow,
      followUpRate: due ? done / due : null, inWindowRate: due ? inWin / due : null,
      completeness: need ? have / need : null,
      queriesOpen: db.queries.filter((q) => ids.has(q.participantId) && q.status !== 'closed').length,
      queriesRaised: db.queries.filter((q) => ids.has(q.participantId)).length,
      flagged: recs.filter((r) => (r.safety || []).some((s) => s.level === 'urgent' || s.level === 'soon')).length,
      referrals: refs.length,
      referralsCompleted: refs.filter((x) => x.status === 'seen').length,
      referralCompletion: refsClosed.length ? refs.filter((x) => x.status === 'seen').length / refsClosed.length : null,
      lastVisit: recs.map((r) => r.date).sort().pop() || null,
    };
  };

  /* ------------------------------------------------------------------ */
  /* Analysis (descriptive, for study management)                        */
  /* ------------------------------------------------------------------ */
  const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

  /** One participant's value of a measure at a completed visit (number, or 1/0 for a percent measure). */
  function measureValue(proto, m, r, ctx) {
    const d = proto.derivedById[m.id] ? RS.derive(proto, r.values, ctx)[m.id] : r.values[m.id];
    if (d == null || d === '') return null;
    if (m.kind === 'percent') return String(d) === String(m.yes) ? 1 : 0;
    const x = Number(d);
    return isNaN(x) ? null : x;
  }

  /**
   * Mean of a measure at each visit, per group. groups: [{key, label, parts}].
   * Returns {visits: [visitId with any data], series: [{key, label, points: {visitId: {mean, n}}, change: {mean, n, from, to}}]}.
   * change = mean within-person change from baseline to each person's latest value (paired).
   */
  RS.outcomeSeries = function (db, proto, m, groups) {
    const series = groups.map((g) => {
      const byVisit = {};
      const perPerson = {};
      g.parts.forEach((p) => {
        db.visits.filter((r) => r.participantId === p.id && r.status === 'complete').forEach((r) => {
          const x = measureValue(proto, m, r, RS.ctxForVisit(db, p, r));
          if (x == null) return;
          (byVisit[r.visit] = byVisit[r.visit] || []).push(x);
          (perPerson[p.id] = perPerson[p.id] || []).push({ visit: r.visit, date: r.date, x });
        });
      });
      const points = {};
      Object.entries(byVisit).forEach(([v, xs]) => { points[v] = { mean: mean(xs), n: xs.length }; });
      const deltas = Object.values(perPerson).map((list) => {
        const base = list.find((e) => e.visit === 'baseline');
        const last = list.filter((e) => e.visit !== 'baseline').sort((a, b) => a.date.localeCompare(b.date)).pop();
        return base && last ? last.x - base.x : null;
      }).filter((x) => x != null);
      return { key: g.key, label: g.label, points, change: { mean: mean(deltas), n: deltas.length } };
    });
    const visits = proto.visits.map((v) => v.id).filter((v) => series.some((s) => s.points[v]));
    return { visits, series };
  };

  /** Is a participant in a cohort (a yes/no calculated value from their screening answers)? */
  RS.inCohort = (proto, p, cohort) => !cohort || RS.derive(proto, (p.screening && p.screening.answers) || {}, RS.ctxFor(p))[cohort] === 'yes';

  /** Cumulative enrolment by month: {months: ['2025-10', …], series: [{key, label, counts: [...]}]}. */
  RS.enrolmentSeries = function (groups, on) {
    const dates = groups.flatMap((g) => g.parts.map((p) => p.enrolledAt)).filter(Boolean).sort();
    if (!dates.length) return { months: [], series: groups.map((g) => ({ key: g.key, label: g.label, counts: [] })) };
    const months = [];
    let y = Number(dates[0].slice(0, 4)), mo = Number(dates[0].slice(5, 7));
    const end = (on || today()).slice(0, 7);
    for (;;) { const k = `${y}-${String(mo).padStart(2, '0')}`; months.push(k); if (k >= end) break; mo++; if (mo > 12) { mo = 1; y++; } }
    return { months, series: groups.map((g) => ({ key: g.key, label: g.label, counts: months.map((k) => g.parts.filter((p) => p.enrolledAt && p.enrolledAt.slice(0, 7) <= k).length) })) };
  };

  /* ------------------------------------------------------------------ */
  /* CSV export                                                          */
  /* ------------------------------------------------------------------ */
  const cell = (x) => { const s = x == null ? '' : String(x); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  RS.toCSV = (rows) => rows.map((r) => r.map(cell).join(',')).join('\n');

  /** One row per completed visit; every protocol field and derived value as a column. Names are left out (study ID only). */
  RS.exportVisits = function (db, proto) {
    const fields = Object.values(proto.fields).filter((f) => proto.formOf[f.id] !== 'screening');
    const head = ['study_id', 'household_id', 'cluster', 'visit', 'visit_date', 'in_window', 'collector', 'protocol_version', 'consent_version', ...fields.flatMap((f) => [f.id, f.id + '_missing_reason']), ...proto.derived.map((d) => d.id), 'safety_flags', 'open_queries'];
    const rows = [head];
    db.visits.filter((r) => r.status === 'complete').sort((a, b) => a.date.localeCompare(b.date)).forEach((r) => {
      const p = db.participants.find((x) => x.id === r.participantId);
      const vd = proto.visits.find((v) => v.id === r.visit);
      const w = RS.visitWindow(p, vd);
      const d = RS.derive(proto, r.values, RS.ctxForVisit(db, p, r));
      rows.push([p.studyId, p.household || '', p.cluster, r.visit, r.date, r.date >= w.start && r.date <= w.end ? 'yes' : 'no', r.collector, r.protocolVersion, p.consent && p.consent.version,
        ...fields.flatMap((f) => [r.values[f.id], (r.missing || {})[f.id]]), ...proto.derived.map((x) => d[x.id]),
        (r.safety || []).map((s) => s.id).join(' '), db.queries.filter((q) => q.visitRecId === r.id && q.status !== 'closed').length]);
    });
    return RS.toCSV(rows);
  };
  RS.exportParticipants = function (db) {
    const opts = (RS.protocol().consent.options || []).map((o) => o.id);
    const clusterOf = (p) => (RS.protocol().clusters || []).find((c) => c.id === p.cluster) || {};
    const rows = [['study_id', 'screening_no', 'household_id', 'status', 'sex', 'age_at_screening', 'cluster', 'arm', 'screened', 'enrolled', 'consent_version', ...opts.map((o) => 'consent_' + o), 'withdrawn', 'withdrawal_reason', 'data_use_after_withdrawal', 'screen_fail_reasons']];
    db.participants.forEach((p) => rows.push([p.studyId || '', p.screeningNo, p.household || '', p.status, p.sex, ageYears(p.dob, p.screenedAt), clusterOf(p).name, clusterOf(p).arm, p.screenedAt, p.enrolledAt || '', p.consent ? p.consent.version : '',
      ...opts.map((o) => (p.consent ? (p.consent.options[o] ? 'yes' : 'no') : '')), p.withdrawal ? p.withdrawal.date : '', p.withdrawal ? p.withdrawal.reason : '', p.withdrawal ? p.withdrawal.dataUse : '', (p.screenFail || []).join('; ')]));
    return RS.toCSV(rows);
  };

  /* ------------------------------------------------------------------ */
  /* Storage                                                             */
  /* ------------------------------------------------------------------ */
  RS.STORE_KEY = 'icehall.research.v1';
  RS.SEED_VERSION = 2;
  RS.emptyDb = () => ({ version: RS.SEED_VERSION, participants: [], visits: [], queries: [], audit: [], messages: [], events: [], referrals: [], dismissed: {}, screeningCount: 0 });
  RS.load = function () {
    try {
      const raw = G.localStorage && G.localStorage.getItem(RS.STORE_KEY);
      const db = raw && JSON.parse(raw);
      if (db && db.version === RS.SEED_VERSION) return db;
    } catch (e) { /* fall through to the demo data */ }
    return RS.seed ? RS.seed() : RS.emptyDb();
  };
  RS.save = (db) => { try { G.localStorage.setItem(RS.STORE_KEY, JSON.stringify(db)); } catch (e) { console.warn('save failed', e); } };

  if (typeof module !== 'undefined') module.exports = RS;
})();
