/*
 * Study design: the questions a study collects, kept as data so a supervisor can edit them in the
 * app, with published versions.
 *
 *   design    The protocol as plain data (the format in docs/PROTOCOL_FORMAT.md), plus:
 *               arms:       [{ id, name }]  (shown as "Arm 1: <name>")
 *               assignment: { method, visible, collectorArms, blockSizes }
 *               clusters:   [{ id, name, armId }]
 *               forms.<id>.arms: arm ids that ask this section (none: every arm)
 *               retired:    fields removed after data was collected (kept for exports)
 *   versions  Each lock publishes a version (1.0, 1.1, …) with who, when and why. Records keep the
 *             version they were collected under.
 *   draft     Unlocking (password) opens a copy to edit. Data collectors keep using the published
 *             version until the draft is published.
 *
 * Sections are shared: each arm and each visit ticks the sections it asks, so a change to a section
 * reaches every arm that uses it. "Make separate copies" gives an arm its own copy.
 */
(function () {
  'use strict';
  const G = typeof window !== 'undefined' ? window : global;
  const RS = G.RS;
  const KEY = 'jamii.research.study.v1';
  const DEMO_PASSWORD = '000000';
  const clone = (x) => JSON.parse(JSON.stringify(x));

  const METHODS = {
    single: { label: 'One arm', text: 'Everyone gets the same visits and questions.' },
    cluster: { label: 'By cluster or site', text: 'Each cluster is set to an arm, and participants take the arm of their cluster. For cluster-randomised trials.' },
    collector: { label: 'By data collector', text: 'Each data collector works in one arm; participants take the arm of the collector who enrols them.' },
    chosen: { label: 'Chosen at enrolment', text: 'The data collector picks the arm when the participant consents, and gives a reason. Only for designs that are not randomised: it can bias results.' },
    random: { label: 'Randomised on the tablet', text: 'After consent, the tablet takes the next arm from an allocation list of shuffled blocks. The allocation is recorded and can never be redrawn.' },
  };
  const VISIBILITY = {
    all: { label: 'Everyone', text: 'Data collectors and supervisors see the arm.' },
    supervisor: { label: 'Supervisors only', text: 'Data collectors see “Arm hidden”.' },
    none: { label: 'No one (blinded)', text: 'Everyone sees a code (Arm A, Arm B) instead of the name. If arms ask different questions, data collectors can still tell them apart.' },
  };
  const TYPES = {
    yesno: 'Yes / no', choice: 'Choose one', number: 'Number', integer: 'Whole number', bp: 'Blood pressure (two numbers)', date: 'Date', text: 'Free text',
  };

  /* ------------------------------------------------------------------ */
  /* State                                                               */
  /* ------------------------------------------------------------------ */
  function load() {
    try { const raw = G.localStorage && G.localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function save(st) { try { G.localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* private mode */ } }

  /** A design from a protocol file: arms come from the clusters' arm names. */
  function fromProtocol(raw) {
    const d = clone(raw);
    if (!d.arms) {
      const names = [...new Set((d.clusters || []).map((c) => c.arm).filter(Boolean))];
      d.arms = (names.length ? names : ['']).map((name, i) => ({ id: 'arm' + (i + 1), name }));
      (d.clusters || []).forEach((c) => { c.armId = (d.arms.find((a) => a.name === c.arm) || d.arms[0]).id; delete c.arm; });
      d.assignment = { method: names.length > 1 ? 'cluster' : 'single', visible: 'all', collectorArms: {}, blockSizes: [4, 6] };
    }
    d.retired = d.retired || [];
    return d;
  }

  const defaultState = () => {
    const raw = RS.raw['icehall-v08'];
    if (!raw) return { published: [], draft: null };
    return {
      published: [{ version: '1.0', at: '2026-06-21T09:00:00Z', by: 'Protocol file', reason: 'First version, built from ICEHALL protocol v08', design: fromProtocol(raw) }],
      draft: null,
    };
  };

  let state = load() || defaultState();
  const latest = () => state.published[state.published.length - 1] || null;

  /* ------------------------------------------------------------------ */
  /* Arms                                                                */
  /* ------------------------------------------------------------------ */
  const armIndex = (d, id) => (d.arms || []).findIndex((a) => a.id === id);
  /** "Arm 1: Intervention" (or "Arm 1" with no name). */
  function armLabel(d, id) {
    const i = armIndex(d, id);
    if (i < 0) return '';
    const n = d.arms[i].name;
    return `Arm ${i + 1}${n ? ': ' + n : ''}`;
  }
  /** The arm as a given viewer may see it (visibility setting). */
  function armShown(d, id, role) {
    if (!id) return '';
    const vis = (d.assignment || {}).visible || 'all';
    if (vis === 'none') return 'Arm ' + String.fromCharCode(65 + Math.max(0, armIndex(d, id)));
    if (vis === 'supervisor' && role !== 'SUPERVISOR') return 'Arm hidden';
    return armLabel(d, id);
  }

  /** Permuted blocks (sizes from blockSizes, each a multiple of the number of arms), shuffled. */
  function allocationList(d, n, rand) {
    rand = rand || Math.random;
    const arms = d.arms.map((a) => a.id);
    const sizes = ((d.assignment || {}).blockSizes || [4, 6]).map((s) => Math.max(arms.length, Math.round(s / arms.length) * arms.length));
    const out = [];
    while (out.length < n) {
      const size = sizes[Math.floor(rand() * sizes.length)];
      const block = [];
      for (let i = 0; i < size; i++) block.push(arms[i % arms.length]);
      for (let i = block.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [block[i], block[j]] = [block[j], block[i]]; }
      out.push(...block);
    }
    return out;
  }

  /**
   * The arm for a participant at consent. o: { collectorId, chosen, reason }.
   * Randomisation takes the next slot of the device's allocation list (kept in db.allocation).
   */
  function assignArm(db, d, p, o) {
    const a = d.assignment || { method: 'single' };
    const first = (d.arms[0] || {}).id || null;
    if (a.method === 'cluster') return { arm: ((d.clusters || []).find((c) => c.id === p.cluster) || {}).armId || first, how: 'cluster' };
    if (a.method === 'collector') return { arm: (a.collectorArms || {})[o.collectorId] || first, how: 'collector' };
    if (a.method === 'chosen') return { arm: o.chosen || first, how: 'chosen', reason: o.reason || '' };
    if (a.method === 'random') {
      db.allocation = db.allocation || { list: [], next: 0 };
      if (db.allocation.next >= db.allocation.list.length) db.allocation.list = db.allocation.list.concat(allocationList(d, 60));
      const slot = db.allocation.next++;
      return { arm: db.allocation.list[slot], how: 'random', slot: slot + 1 };
    }
    return { arm: first, how: 'single' };
  }

  /* ------------------------------------------------------------------ */
  /* Running a design                                                    */
  /* ------------------------------------------------------------------ */
  /** The design as the app runs it: clusters get their arm name back (c.arm) for existing screens. */
  function toRuntime(d, version) {
    const r = clone(d);
    r.designVersion = version || '';
    (r.clusters || []).forEach((c) => { c.arm = (r.arms.find((a) => a.id === c.armId) || {}).name || ''; });
    return r;
  }

  /** Check a design with the protocol checker, without changing what is running. Returns the problems. */
  function check(d) {
    const keepP = RS.protocols[d.id], keepA = RS.activeProtocol, keepRaw = RS.raw[d.id];
    try { RS.registerProtocol(toRuntime(d)); return []; } catch (e) { return String(e.message).split('\n- ').slice(1); } finally {
      if (keepP) RS.protocols[d.id] = keepP; else delete RS.protocols[d.id];
      RS.activeProtocol = keepA;
      if (keepRaw) RS.raw[d.id] = keepRaw;
    }
  }

  /** A blank study: one baseline visit, no sections. Areas are the ones data collectors already work in. */
  function blankDesign(name) {
    const areas = [...new Set(((RS.STAFF && RS.STAFF.collectors) || []).flatMap((c) => c.clusters || []))];
    return {
      id: 'study', title: name || '', short: name || '', version: 'Protocol version (enter it)', idPrefix: 'STUDY', target: 0, studyPhone: '', summary: '', site: '', sponsor: '',
      status: 'Study design in progress', languages: ['English'], listeningApproved: false, needInfo: [],
      missingReasons: ['Refused', 'Result not back yet', 'Not done: equipment unavailable', 'Not done: participant unwell', "Doesn't know", 'Other'],
      deviationCategories: ['Outcome measurement: wrong timing window', 'Consent', 'Eligibility', 'Data', 'Safety', 'Other'],
      arms: [{ id: 'arm1', name: '' }],
      assignment: { method: 'single', visible: 'all', collectorArms: {}, blockSizes: [4, 6] },
      clusters: areas.map((id, i) => ({ id, name: 'Area ' + (i + 1), armId: 'arm1' })),
      screening: { title: 'Screening', fields: [] }, eligibility: [],
      consent: { version: 'Consent v1', language: 'English', method: 'Written consent', sections: [], checks: [], options: [{ id: 'contact', text: 'You may contact me between visits', default: true }] },
      visits: [{ id: 'baseline', label: 'Baseline', day: 0, forms: [] }],
      forms: {}, derived: [], safety: [], referralSites: [],
      handoff: { findings: [], symptoms: [], history: [], medicines: [], sensitive: {}, compare: [] },
      analysis: { note: '', measures: [] },
      messages: {
        consentOption: 'contact', reminderDaysBefore: 7, missedWithinDays: 14, encouragement: [],
        templates: {
          reminder: { label: 'Visit reminder', text: 'Hello {first_name}, your {study} visit is due between {from} and {to}. Call {study_phone} with questions. {collector}' },
          missed: { label: 'Missed visit', text: 'Hello {first_name}, we missed you for your {study} visit. Please call {study_phone} to arrange it. {collector}' },
          general: { label: 'Message', text: 'Hello {first_name}, ' },
        },
      },
      retired: [],
    };
  }

  /* ------------------------------------------------------------------ */
  /* Editing helpers (used on the draft)                                 */
  /* ------------------------------------------------------------------ */
  const slug = (s) => {
    let x = String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s]/g, '').trim().replace(/\s+/g, '_').replace(/^(\d)/, 'f_$1');
    if (x.length > 30) x = x.slice(0, 30).replace(/_[^_]*$/, ''); // whole words
    return x || 'field';
  };
  function usedIds(d) {
    const ids = new Set();
    (d.screening.fields || []).forEach((f) => ids.add(f.id));
    Object.values(d.forms).forEach((fm) => fm.fields.forEach((f) => ids.add(f.id)));
    (d.derived || []).forEach((x) => ids.add(x.id));
    (d.retired || []).forEach((f) => ids.add(f.id));
    return ids;
  }
  /** A new, unused id from a label (field and section ids are permanent once published). */
  function newId(d, label, taken) {
    taken = taken || usedIds(d);
    let base = slug(label);
    if (RS.rules && RS.rules.isBuiltin && RS.rules.isBuiltin(base)) base += '_q';
    let id = base, n = 2;
    while (taken.has(id) || (RS.rules && RS.rules.isBuiltin && RS.rules.isBuiltin(id))) id = `${base}_${n++}`;
    return id;
  }
  function newFormId(d, title) {
    let base = slug(title) || 'section', id = base, n = 2;
    while (d.forms[id]) id = `${base}_${n++}`;
    return id;
  }

  /** Ids published in the latest version: their variable name and type are fixed. */
  function publishedIds() {
    const l = latest();
    if (!l) return { fields: new Set(), forms: new Set(), visits: new Set(), options: {} };
    const d = l.design;
    const fields = new Set(), options = {};
    Object.values(d.forms).forEach((fm) => fm.fields.forEach((f) => { fields.add(f.id); if (f.options) options[f.id] = f.options.map((o) => o[0]); }));
    return { fields, forms: new Set(Object.keys(d.forms)), visits: new Set(d.visits.map((v) => v.id)), options };
  }

  /* ---- Schedule by arm ---- */
  const visitArms = (d, v) => d.arms.filter((a) => !v.arms || !v.arms.length || v.arms.includes(a.id)).map((a) => a.id);
  /** With more than one arm, keep each arm's sections at a visit separately. */
  function ensureArmForms(d, v) {
    if (d.arms.length < 2) return;
    v.armForms = v.armForms || {};
    d.arms.forEach((a) => { if (!v.armForms[a.id]) v.armForms[a.id] = (v.forms || []).slice(); });
  }
  /** Keep `forms` as every section asked at the visit (any arm); drop armForms when every arm asks the same. */
  function tidyVisit(d, v) {
    if (v.arms && (!v.arms.length || v.arms.length >= d.arms.length)) delete v.arms;
    if (!v.armForms) return;
    Object.keys(v.armForms).forEach((k) => { if (!d.arms.some((a) => a.id === k)) delete v.armForms[k]; });
    const arms = visitArms(d, v);
    const lists = arms.map((a) => (v.armForms[a] || []));
    const order = Object.keys(d.forms);
    v.forms = order.filter((f) => lists.some((l) => l.includes(f)));
    if (lists.every((l) => l.length === lists[0].length && l.every((x) => lists[0].includes(x)))) { v.forms = lists[0] ? order.filter((f) => lists[0].includes(f)) : []; delete v.armForms; }
  }
  /** Tick or untick a section at a visit, for one arm or (arm 'all') every arm that has the visit. */
  function setVisitForm(d, visitId, formId, arm, on) {
    const v = d.visits.find((x) => x.id === visitId);
    const set = (list) => { const i = list.indexOf(formId); if (on && i < 0) list.push(formId); if (!on && i >= 0) list.splice(i, 1); };
    if (d.arms.length < 2) { set(v.forms); return; }
    ensureArmForms(d, v);
    (arm === 'all' ? visitArms(d, v) : [arm]).forEach((a) => set(v.armForms[a]));
    tidyVisit(d, v);
  }
  /** Whether an arm has a visit; the first visit (enrolment) is for every arm. */
  function setVisitArm(d, visitId, arm, on) {
    const v = d.visits.find((x) => x.id === visitId);
    if (d.visits[0] === v) return false;
    let arms = visitArms(d, v);
    arms = on ? [...new Set([...arms, arm])] : arms.filter((a) => a !== arm);
    if (!arms.length) return false;
    if (on && v.armForms && !v.armForms[arm]) v.armForms[arm] = [];
    v.arms = arms;
    tidyVisit(d, v);
    return true;
  }
  /** Give one arm the same schedule as another: the same visits, asking the same sections. */
  function copySchedule(d, fromArm, toArm) {
    d.visits.forEach((v, i) => {
      const inFrom = visitArms(d, v).includes(fromArm);
      if (i > 0) {
        const arms = visitArms(d, v).filter((a) => a !== toArm);
        v.arms = inFrom ? [...arms, toArm] : arms;
        if (!v.arms.length) v.arms = [fromArm];
      }
      if (inFrom) { ensureArmForms(d, v); if (v.armForms) v.armForms[toArm] = (v.armForms[fromArm] || v.forms).slice(); }
      tidyVisit(d, v);
    });
    // Visits now in no arm at all are dropped (only possible for visits that were just for the target arm).
    d.visits = d.visits.filter((v, i) => i === 0 || visitArms(d, v).length);
  }
  /** Sections asked by an arm at each visit: [{ arm, visits: [visit] }] (arm null with one arm). */
  function scheduleOfForm(d, formId) {
    const arms = d.arms.length > 1 ? d.arms.map((a) => a.id) : [null];
    return arms.map((arm) => ({ arm, visits: d.visits.filter((v) => (arm == null || visitArms(d, v).includes(arm)) && (RS.formsAt ? RS.formsAt(v, arm) : v.forms).includes(formId)) }));
  }
  /** A copy of a section with new variable names, not yet asked at any visit (for an arm-specific version). */
  function duplicateForm(d, formId) {
    const fm = d.forms[formId];
    const copy = clone(fm);
    delete copy.id;
    delete copy.arms;
    copy.title = `${fm.title} (copy)`;
    const taken = usedIds(d);
    copy.fields.forEach((f) => { const nid = newId(d, f.id + '_b', taken); taken.add(nid); f.id = nid; });
    const id = newFormId(d, formId + '_b');
    d.forms[id] = copy;
    return id;
  }
  /** Remove an arm: its visits and sections go; clusters and collectors move to arm 1. */
  function removeArm(d, arm) {
    d.arms = d.arms.filter((a) => a.id !== arm);
    d.visits.forEach((v) => { if (v.arms) v.arms = v.arms.filter((a) => a !== arm); if (v.armForms) delete v.armForms[arm]; });
    d.visits = d.visits.filter((v, i) => i === 0 || !v.arms || v.arms.length);
    d.visits.forEach((v) => tidyVisit(d, v));
    Object.values(d.forms).forEach((f) => { if (f.arms) { f.arms = f.arms.filter((a) => a !== arm); if (!f.arms.length) delete f.arms; } });
    (d.clusters || []).forEach((c) => { if (c.armId === arm) c.armId = d.arms[0].id; });
    Object.keys(d.assignment.collectorArms || {}).forEach((k) => { if (d.assignment.collectorArms[k] === arm) d.assignment.collectorArms[k] = d.arms[0].id; });
  }
  /** A new arm has the shared visits, asking no sections where arms differ (copy a schedule to fill it). */
  function addArm(d) {
    let n = d.arms.length + 1;
    while (d.arms.some((a) => a.id === 'arm' + n)) n++;
    const id = 'arm' + n;
    d.arms.push({ id, name: '' });
    d.visits.forEach((v) => { if (v.armForms) v.armForms[id] = []; });
    return id;
  }

  /** Remove a field: retired (kept for exports) if it was published, otherwise just deleted. */
  function removeField(d, formId, fieldId) {
    const fm = d.forms[formId];
    const i = fm.fields.findIndex((f) => f.id === fieldId);
    if (i < 0) return;
    const [f] = fm.fields.splice(i, 1);
    if (publishedIds().fields.has(fieldId)) d.retired.push(Object.assign({ retiredFrom: formId }, f));
  }
  function removeForm(d, formId) {
    [...d.forms[formId].fields].forEach((f) => removeField(d, formId, f.id));
    delete d.forms[formId];
    d.visits.forEach((v) => {
      v.forms = v.forms.filter((x) => x !== formId);
      Object.keys(v.armForms || {}).forEach((k) => { v.armForms[k] = v.armForms[k].filter((x) => x !== formId); });
    });
  }

  /* ------------------------------------------------------------------ */
  /* What a draft changes                                                */
  /* ------------------------------------------------------------------ */
  /**
   * Plain-language list of changes from the published version to the draft, with how much
   * collected data each touches. Items: { kind: 'add' | 'change' | 'remove', text }.
   */
  function changes(db) {
    const l = latest();
    const a = l ? l.design : { forms: {}, visits: [], arms: [], assignment: {}, title: '' };
    const b = state.draft;
    if (!b) return [];
    const out = [];
    const add = (kind, text) => out.push({ kind, text });
    const armNames = (d, ids) => (ids && ids.length ? ids : d.arms.map((x) => x.id)).map((id) => armLabel(d, id)).join(', ');
    const recsWith = (fieldIds) => (db ? db.visits.filter((r) => fieldIds.some((id) => r.values && r.values[id] != null && r.values[id] !== '')).length : 0);
    const dataNote = (n) => (n ? ` ${n} visit record${n === 1 ? ' has' : 's have'} data for it; it stays in the exports.` : '');

    if (a.title !== b.title) add('change', `Study name: “${a.title || '(none)'}” → “${b.title}”`);
    if (a.short !== b.short) add('change', `Name in the banner: “${a.short || '(none)'}” → “${b.short}”`);
    const newArms = b.arms.filter((x) => !(a.arms || []).some((y) => y.id === x.id)).map((x) => x.id);
    b.arms.forEach((arm, i) => {
      const old = (a.arms || []).find((x) => x.id === arm.id);
      if (!old) {
        const asked = new Set(b.visits.filter((v) => visitArms(b, v).includes(arm.id)).flatMap((v) => (RS.formsAt ? RS.formsAt(v, arm.id) : v.forms)));
        add('add', `New arm: ${armLabel(b, arm.id)}, asking ${asked.size} section(s)`);
      }
      else if (old.name !== arm.name) add('change', `Arm ${i + 1} renamed: “${old.name}” → “${arm.name}”`);
    });
    (a.arms || []).forEach((arm) => { if (!b.arms.some((x) => x.id === arm.id)) add('remove', `Arm removed: ${armLabel(a, arm.id)}`); });
    const am = a.assignment || {}, bm = b.assignment || {};
    if (am.method !== bm.method) add('change', `Assignment: ${(METHODS[am.method] || {}).label || '—'} → ${METHODS[bm.method].label}`);
    if (am.visible !== bm.visible) add('change', `Who sees the arm: ${(VISIBILITY[am.visible] || {}).label || '—'} → ${VISIBILITY[bm.visible].label}`);
    (b.clusters || []).forEach((c) => { const o = (a.clusters || []).find((x) => x.id === c.id); if (o && o.armId !== c.armId) add('change', `${c.name} moves to ${armLabel(b, c.armId)}`); if (o && o.name !== c.name) add('change', `Cluster renamed: ${o.name} → ${c.name}`); });

    Object.entries(b.forms).forEach(([fid, fm]) => {
      const o = a.forms[fid];
      if (!o) { add('add', `New section “${fm.title}” (${fm.fields.length} question${fm.fields.length === 1 ? '' : 's'})`); return; }
      if (o.title !== fm.title) add('change', `Section renamed: “${o.title}” → “${fm.title}”`);
      const oa = (o.arms && o.arms.length ? o.arms : a.arms.map((x) => x.id)).slice().sort().join();
      const na = (fm.arms && fm.arms.length ? fm.arms : b.arms.map((x) => x.id)).slice().sort().join();
      if (oa !== na) {
        const was = oa.split(','), now = na.split(',');
        now.filter((x) => !was.includes(x) && !newArms.includes(x)).forEach((x) => add('add', `“${fm.title}” added to ${armLabel(b, x)}`));
        was.filter((x) => !now.includes(x)).forEach((x) => add('remove', `“${fm.title}” removed from ${armLabel(a, x) || x}: new visits in that arm won't ask it.${dataNote(recsWith(o.fields.map((f) => f.id)))}`));
      }
      fm.fields.forEach((f) => {
        const of = o.fields.find((x) => x.id === f.id);
        if (!of) { add('add', `New question in “${fm.title}”: ${f.label} (${f.id})`); return; }
        const what = [];
        if (of.label !== f.label) what.push(`wording “${of.label}” → “${f.label}”`);
        if ((of.options || []).length !== (f.options || []).length) what.push('answer options added');
        else if (JSON.stringify(of.options || []) !== JSON.stringify(f.options || [])) what.push('answer wording');
        ['unit', 'min', 'max', 'required', 'show', 'help', 'integer'].forEach((k) => { if (JSON.stringify(of[k]) !== JSON.stringify(f[k])) what.push(k === 'show' ? 'when it is asked' : k); });
        if (what.length) add('change', `${f.label} (${f.id}): ${what.join(', ')}`);
      });
      o.fields.forEach((of) => { if (!fm.fields.some((x) => x.id === of.id)) add('remove', `Question removed from “${fm.title}”: ${of.label} (${of.id}).${dataNote(recsWith([of.id]))}`); });
    });
    Object.entries(a.forms).forEach(([fid, o]) => { if (!b.forms[fid]) add('remove', `Section removed: “${o.title}”, from ${armNames(a, o.arms)}.${dataNote(recsWith(o.fields.map((f) => f.id)))}`); });

    const title = (id) => (b.forms[id] || a.forms[id] || { title: id }).title;
    const vArms = (d, v) => (d.arms && d.arms.length ? visitArms(d, v) : [null]);
    const atArm = (v, arm) => (RS.formsAt ? RS.formsAt(v, arm) : v.forms);
    const who = (arms, all) => (b.arms.length < 2 || arms.length === all.length ? '' : arms.map((x) => armLabel(b, x)).join(', ') + ': ');
    b.visits.forEach((v) => {
      const o = a.visits.find((x) => x.id === v.id);
      const armsNow = vArms(b, v);
      if (!o) { add('add', `${who(armsNow, b.arms)}New visit: ${v.label} (day ${v.day})`); return; }
      if (o.label !== v.label) add('change', `Visit renamed: ${o.label} → ${v.label}`);
      if (o.day !== v.day || (o.before || 0) !== (v.before || 0) || (o.after || 0) !== (v.after || 0)) add('change', `${v.label}: day ${o.day} (−${o.before || 0}/+${o.after || 0}) → day ${v.day} (−${v.before || 0}/+${v.after || 0})`);
      const armsWas = vArms(a, o);
      if (b.arms.length > 1) {
        armsNow.filter((x) => !armsWas.includes(x) && !newArms.includes(x)).forEach((x) => add('add', `${armLabel(b, x)} now has the ${v.label} visit`));
        armsWas.filter((x) => !armsNow.includes(x) && b.arms.some((y) => y.id === x)).forEach((x) => add('remove', `${armLabel(b, x)} no longer has the ${v.label} visit`));
      }
      // Sections asked, arm by arm; the same change in every arm reads as one line.
      const both = armsNow.filter((x) => armsWas.includes(x));
      const diff = {};
      both.forEach((arm) => {
        const now = atArm(v, arm), was = atArm(o, arm);
        now.filter((f) => !was.includes(f)).forEach((f) => { (diff['add|' + f] = diff['add|' + f] || []).push(arm); });
        was.filter((f) => !now.includes(f) && b.forms[f]).forEach((f) => { (diff['remove|' + f] = diff['remove|' + f] || []).push(arm); });
      });
      Object.entries(diff).forEach(([k, arms]) => {
        const [kind, f] = k.split('|');
        add(kind, `${who(arms, both)}${v.label} ${kind === 'add' ? 'now asks' : 'no longer asks'} “${title(f)}”`);
      });
    });
    a.visits.forEach((v) => { if (!b.visits.some((x) => x.id === v.id)) add('remove', `Visit removed: ${v.label}`); });
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Lock, unlock, publish                                               */
  /* ------------------------------------------------------------------ */
  const nextVersion = () => { const l = latest(); if (!l) return '1.0'; const [maj, min] = l.version.split('.').map(Number); return `${maj}.${(min || 0) + 1}`; };
  function unlock(password) {
    if (password !== DEMO_PASSWORD) return false;
    if (!state.draft) state.draft = clone(latest() ? latest().design : blankDesign(''));
    save(state);
    return true;
  }
  function publish(reason, by) {
    const v = nextVersion();
    state.published.push({ version: v, at: new Date().toISOString(), by, reason, design: state.draft });
    state.draft = null;
    save(state);
    return v;
  }
  function discard() { state.draft = null; save(state); }
  /** Demo: start an empty study (no published version yet; the study is a draft). */
  function startBlank() { state = { published: [], draft: blankDesign('') }; save(state); }
  function resetDemo() { state = defaultState(); save(state); }

  /* ------------------------------------------------------------------ */
  /* Start-up: run the latest published version                          */
  /* ------------------------------------------------------------------ */
  RS.noStudy = false;
  RS.studyError = null;
  (function startup() {
    const l = latest();
    if (!l) {
      // No study published yet: a placeholder keeps the app running; screens say "No active study".
      RS.noStudy = true;
      const ph = blankDesign('No active study');
      ph.id = 'none';
      RS.registerProtocol(toRuntime(ph));
      RS.activeProtocol = 'none';
      return;
    }
    try {
      RS.registerProtocol(toRuntime(l.design, l.version));
      RS.activeProtocol = l.design.id;
    } catch (e) {
      RS.studyError = e.message; // the protocol file version keeps running
    }
  }());

  RS.armName = (id) => armLabel(RS.protocol(), id);
  RS.study = {
    METHODS, VISIBILITY, TYPES, DEMO_PASSWORD,
    state: () => state, latest, current: () => state.draft || (latest() && latest().design), draft: () => state.draft,
    save: () => save(state), clone, fromProtocol, blankDesign, toRuntime, check, armLabel, armShown, assignArm, allocationList,
    newId, newFormId, usedIds, publishedIds, removeField, visitArms, setVisitForm, setVisitArm, copySchedule, scheduleOfForm, duplicateForm, removeArm, addArm, tidyVisit, removeForm, changes, nextVersion, unlock, publish, discard, startBlank, resetDemo,
  };
  if (typeof module !== 'undefined') module.exports = RS.study;
}());
