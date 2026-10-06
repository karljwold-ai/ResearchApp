/*
 * Supervisor screens: Study design (build, lock and version the study's questions) and Export data.
 * app.js calls RS.designUI(ui) with its shared helpers and merges the screens, actions and modals.
 */
(function () {
  'use strict';
  const RS = window.RS;

  RS.designUI = function (ui) {
    const { S, esc, icon } = ui;
    const St = RS.study;
    S.dz = S.dz || { tab: 'sections', arm: 'all', open: {}, field: null, pv: {} };
    S.xpIdent = false;

    const d = () => St.current();
    const editing = () => !!St.draft();
    const dis = () => (editing() ? '' : 'disabled');
    const changed = () => { St.save(); ui.render(); };
    const armLabel = (D, id) => St.armLabel(D, id);
    const usesArm = (D, f, arm) => !f.arms || !f.arms.length || f.arms.includes(arm);
    const typeOf = (f) => (f.type === 'number' && f.integer ? 'integer' : f.type);
    const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

    /** Problems with an "ask only if" condition: unreadable, or names that aren't questions. */
    function conditionProblem(D, src) {
      if (!src || !src.trim()) return '';
      try {
        const tree = RS.rules.parse(src);
        const ids = St.usedIds(D);
        const lits = new Set(RS.rules.comparedLiterals(tree, () => true).map(([, lit]) => lit)); // answers compared against (e.g. yes)
        const bad = [...RS.rules.names(tree)].filter((n) => !ids.has(n) && !RS.rules.isBuiltin(n) && !lits.has(n) && !/^(consent|prev)_/.test(n));
        return bad.length ? `Unknown name${bad.length === 1 ? '' : 's'}: ${bad.join(', ')}` : '';
      } catch (e) { return e.message; }
    }

    /* ---------------------------------------------------------------- */
    /* Study design screen                                               */
    /* ---------------------------------------------------------------- */
    function screenDesign() {
      const D = d();
      if (!D) return '<div class="page"><p class="empty">No study design.</p></div>';
      const tabs = [['sections', 'Sections and questions'], ['arms', 'Arms and assignment'], ['schedule', 'Visit schedule'], ['other', 'Other protocol parts'], ['versions', 'Versions']];
      const body = { sections: sectionsTab, arms: armsTab, schedule: scheduleTab, other: otherTab, versions: versionsTab }[S.dz.tab] || sectionsTab;
      return `<div class="page design">${header(D)}
        <div class="tabs">${tabs.map(([k, l]) => `<button class="tab ${S.dz.tab === k ? 'on' : ''}" data-action="dz-tab" data-v="${k}">${l}</button>`).join('')}</div>
        ${RS.studyError ? `<div class="alert urgent">${icon('alert')}<div><b>The published design could not be loaded</b>, so the protocol file is running instead.<div class="small mono">${esc(RS.studyError)}</div></div></div>` : ''}
        ${body(D)}
        ${bottomBar()}
      </div>`;
    }

    function header(D) {
      const l = St.latest();
      const dr = St.draft();
      const state = dr ? (l ? `Editing a draft of version ${St.nextVersion()}. Data collectors keep using version ${l.version} until you publish.` : 'Not yet published: data collectors see “No active study” until you lock and publish version 1.0.')
        : `Locked. Data collectors are using version ${l.version}, published ${new Date(l.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} by ${l.by}.`;
      return `<div class="card dz-head">
        <div class="dz-head-top"><div><h2>Study design</h2><p class="small muted">${esc(state)}</p></div>
          <button class="lock-btn ${dr ? 'open' : ''}" data-action="dz-lock" title="${dr ? 'Unlocked: publish or discard the draft to lock it' : 'Locked: tap to unlock for editing'}" aria-label="${dr ? 'Unlocked' : 'Locked'}">${icon(dr ? 'unlock' : 'lock')}<span>${dr ? 'Unlocked' : 'Locked'}</span></button></div>
        <div class="grid-2">
          <label><span class="lbl">Study name</span><input class="input wide" id="dz-title" data-input="dz" data-k="title" value="${esc(D.title)}" placeholder="e.g. ICEHALL: Interventions in Communities…" ${dis()}></label>
          <label><span class="lbl">Short name (shown at the top of every screen)</span><input class="input wide" id="dz-short" data-input="dz" data-k="short" value="${esc(D.short)}" placeholder="e.g. ICEHALL" ${dis()}></label>
        </div>
      </div>`;
    }

    function bottomBar() {
      const l = St.latest();
      if (!editing()) return `<div class="dz-bar locked">${icon('lock')}<span>Version ${esc(l.version)} is locked. Unlock it to make changes.</span><button class="btn" data-action="dz-lock">${icon('unlock')} Unlock to edit</button></div>`;
      const n = St.changes(ui.getDb()).length;
      return `<div class="dz-bar"><span>${l ? `<b>${plural(n, 'change')}</b> not yet published` : 'Build the study, then lock it to start data collection'}</span>
        ${l ? '<button class="btn" data-action="dz-discard">Discard changes</button>' : ''}
        <button class="btn primary" data-action="dz-publish" ${l && !n ? 'disabled' : ''}>${icon('lock')} ${l ? `Review and publish version ${St.nextVersion()}` : 'Lock and publish version 1.0'}</button></div>`;
    }

    /* ---- Sections and questions ---- */
    function sectionsTab(D) {
      const multi = D.arms.length > 1;
      if (S.dz.arm !== 'all' && !D.arms.some((a) => a.id === S.dz.arm)) S.dz.arm = 'all';
      const arm = S.dz.arm;
      const list = Object.entries(D.forms).filter(([, f]) => arm === 'all' || usesArm(D, f, arm));
      const others = D.arms.filter((a) => a.id !== arm && Object.values(D.forms).some((f) => usesArm(D, f, a.id)));
      return `${multi ? `<div class="arm-switch"><span class="lbl">Showing</span>${[['all', 'All sections'], ...D.arms.map((a) => [a.id, armLabel(D, a.id)])].map(([k, l]) => `<button class="chip ${arm === k ? 'on' : ''}" data-action="dz-arm-view" data-v="${k}">${esc(l)}</button>`).join('')}</div>` : ''}
        <p class="small muted">Sections are shared: each arm and each visit ticks the sections it asks, so editing a section changes it in every arm that uses it. ${multi ? 'Untick an arm on a section to leave it out of that arm.' : ''}</p>
        ${arm !== 'all' && !list.length && editing() && others.length ? `<div class="card copy-arm"><h3>${esc(armLabel(D, arm))} has no sections yet</h3><p>Copy from another arm?</p>
          <div class="btn-row"><select class="input" id="dzCopyFrom">${others.map((a) => `<option value="${a.id}">${esc(armLabel(D, a.id))}</option>`).join('')}</select>
          <button class="btn primary" data-action="dz-copy-arm" data-sep="0">Use the same sections</button><button class="btn" data-action="dz-copy-arm" data-sep="1">Make separate copies</button></div>
          <p class="small muted"><b>Same sections</b>: one copy, shared, so later edits reach both arms. <b>Separate copies</b>: this arm gets its own version to change independently (new variable names).</p></div>` : ''}
        ${list.map(([id, f]) => formCard(D, id, f)).join('') || (!editing() || (arm !== 'all' && others.length) ? '' : '<p class="empty">No sections yet. Add one for each group of questions, for example Demographics, Measurements or PHQ-9.</p>')}
        ${editing() ? `<button class="btn" data-action="dz-add-form">${icon('plus')} Add a section${arm !== 'all' && multi ? ` to ${esc(armLabel(D, arm))}` : ''}</button>` : ''}`;
    }

    function formCard(D, id, f) {
      const open = !!S.dz.open[id];
      const allArms = !f.arms || !f.arms.length;
      const visits = D.visits.filter((v) => v.forms.includes(id));
      const pub = St.publishedIds();
      return `<div class="card dz-form ${open ? 'open' : ''}">
        <div class="dz-form-head">
          <button class="icon-btn" data-action="dz-form-open" data-form="${id}" aria-label="${open ? 'Close' : 'Open'}">${icon(open ? 'down' : 'right')}</button>
          <div class="dz-form-title">${editing() && open ? `<input class="input wide" id="dz-ft-${id}" data-input="dz" data-k="form-title" data-form="${id}" value="${esc(f.title)}" placeholder="Section name">` : `<button class="link-strong" data-action="dz-form-open" data-form="${id}">${esc(f.title || 'Untitled section')}</button>`}
            <div class="small muted">${plural(f.fields.length, 'question')} · ${D.arms.length > 1 ? (allArms ? 'All arms' : esc(f.arms.map((a) => armLabel(D, a)).join(', '))) + ' · ' : ''}${visits.length ? 'Asked at ' + esc(visits.map((v) => v.label).join(', ')) : '<span class="amber-text">Not asked at any visit yet</span>'}${f.show ? ` · only if <span class="mono">${esc(f.show)}</span>` : ''}${pub.forms.has(id) ? '' : editing() ? ' · <span class="tag">new</span>' : ''}</div></div>
          <button class="btn sm ghost" data-action="dz-preview" data-form="${id}">${icon('eye')} Preview</button>
        </div>
        ${open ? `<div class="dz-form-body">
          ${f.intro ? `<p class="small muted">${esc(f.intro)}</p>` : ''}
          ${editing() ? `<div class="dz-ticks">
            ${D.arms.length > 1 ? `<div><span class="lbl">Arms that ask it</span>${D.arms.map((a) => `<label class="check inline"><input type="checkbox" data-action="dz-form-arm" data-form="${id}" data-arm="${a.id}" ${allArms || f.arms.includes(a.id) ? 'checked' : ''}><span>${esc(armLabel(D, a.id))}</span></label>`).join('')}</div>` : ''}
            <div><span class="lbl">Visits that ask it</span>${D.visits.map((v) => `<label class="check inline"><input type="checkbox" data-action="dz-form-visit" data-form="${id}" data-visit="${v.id}" ${v.forms.includes(id) ? 'checked' : ''}><span>${esc(v.label)}</span></label>`).join('')}</div>
          </div>` : ''}
          <div class="dz-fields">${f.fields.map((fl, i) => fieldRow(D, id, fl, i, f.fields.length)).join('') || '<p class="muted small">No questions yet.</p>'}</div>
          ${editing() ? `<div class="btn-row"><button class="btn" data-action="dz-add-field" data-form="${id}">${icon('plus')} Add a question</button><span class="grow"></span><button class="btn ghost danger-text" data-action="dz-form-del" data-form="${id}">Remove section</button></div>` : ''}
        </div>` : ''}
      </div>`;
    }

    function fieldRow(D, formId, fl, i, n) {
      const key = formId + ':' + i;
      const open = S.dz.field === key;
      const pub = St.publishedIds().fields.has(fl.id);
      const summary = `<button class="dz-field-sum" data-action="dz-field-open" data-key="${key}">
          <span class="dz-q">${esc(fl.label || 'Untitled question')}${fl.required ? '<span class="req">*</span>' : ''}</span>
          <span class="small muted">${esc(St.TYPES[typeOf(fl)] || fl.type)}${fl.unit ? ' (' + esc(fl.unit) + ')' : ''} · <span class="mono">${esc(fl.id)}</span>${fl.show ? ` · only if <span class="mono">${esc(fl.show)}</span>` : ''}</span>
          ${pub || !editing() ? '' : '<span class="tag">new</span>'}</button>`;
      if (!open) return `<div class="dz-field">${summary}</div>`;
      if (!editing()) {
        return `<div class="dz-field open">${summary}<div class="dz-field-body small">
          ${fl.help ? `<div>Note: ${esc(fl.help)}</div>` : ''}
          ${fl.options && fl.type === 'choice' ? `<div>Answers: ${fl.options.map(([k, l]) => `<span class="mono">${esc(k)}</span> = ${esc(l)}`).join(' · ')}</div>` : ''}
          ${fl.min != null || fl.max != null ? `<div>Allowed: ${fl.min != null ? fl.min : '…'} to ${fl.max != null ? fl.max : '…'}${fl.soft ? ` · check if outside ${fl.soft[0]}–${fl.soft[1]}` : ''}</div>` : ''}
        </div></div>`;
      }
      const t = typeOf(fl);
      const pubOpts = St.publishedIds().options[fl.id] || [];
      const cp = conditionProblem(D, fl.show);
      const fid = (k) => `dz-f-${formId}-${i}-${k}`;
      const inp = (k, prop, val, ph, attrs) => `<input class="input wide" id="${fid(k)}" data-input="dz" data-k="field" data-form="${formId}" data-i="${i}" data-prop="${prop}" value="${esc(val == null ? '' : val)}" placeholder="${esc(ph || '')}" ${attrs || ''}>`;
      return `<div class="dz-field open">${summary}<div class="dz-field-body">
        <label><span class="lbl">Question (as the data collector reads it)</span>${inp('label', 'label', fl.label, 'e.g. How many days in the past week…')}</label>
        <div class="grid-2">
          <label><span class="lbl">Variable name (for the export)</span>${inp('id', 'id', fl.id, '', pub ? 'disabled' : '')}<span class="small muted">${pub ? 'Fixed: this question is in a published version.' : 'Lower case, digits and _. Fixed once published.'}</span></label>
          <label><span class="lbl">Type of answer</span><select class="input wide" id="${fid('type')}" data-change="dz" data-k="field-type" data-form="${formId}" data-i="${i}" ${pub ? 'disabled' : ''}>${Object.entries(St.TYPES).map(([k, l]) => `<option value="${k}" ${t === k ? 'selected' : ''}>${l}</option>`).join('')}</select>${pub ? '<span class="small muted">Fixed: collected answers would no longer fit.</span>' : ''}</label>
        </div>
        ${t === 'choice' ? `<div class="dz-opts"><span class="lbl">Answers (code, then the words shown)</span>${(fl.options || []).map(([k, l], j) => {
          const fixed = pubOpts.includes(k);
          return `<div class="dz-opt"><input class="input code" id="${fid('oc' + j)}" data-input="dz" data-k="opt" data-form="${formId}" data-i="${i}" data-j="${j}" data-part="0" value="${esc(k)}" placeholder="code" ${fixed ? 'disabled' : ''}><input class="input wide" id="${fid('ol' + j)}" data-input="dz" data-k="opt" data-form="${formId}" data-i="${i}" data-j="${j}" data-part="1" value="${esc(l)}" placeholder="Answer as shown">${fixed ? '<span class="small muted" title="In use: codes of published answers are fixed">fixed</span>' : `<button class="icon-btn" data-action="dz-opt-del" data-form="${formId}" data-i="${i}" data-j="${j}" aria-label="Remove answer">${icon('x')}</button>`}</div>`;
        }).join('')}<button class="btn sm" data-action="dz-opt-add" data-form="${formId}" data-i="${i}">${icon('plus')} Add an answer</button></div>` : ''}
        ${t === 'number' || t === 'integer' ? `<div class="grid-4">
          <label><span class="lbl">Unit</span>${inp('unit', 'unit', fl.unit, 'e.g. kg')}</label>
          <label><span class="lbl">Lowest allowed</span>${inp('min', 'min', fl.min, '', 'inputmode="decimal"')}</label>
          <label><span class="lbl">Highest allowed</span>${inp('max', 'max', fl.max, '', 'inputmode="decimal"')}</label>
          <label><span class="lbl">Query if outside</span><span class="pair">${inp('slo', 'soft-lo', fl.soft ? fl.soft[0] : '', 'low', 'inputmode="decimal"')}${inp('shi', 'soft-hi', fl.soft ? fl.soft[1] : '', 'high', 'inputmode="decimal"')}</span></label>
        </div><p class="small muted">Values outside the allowed range can't be saved. Values outside the query range are saved and sent to the supervisor as a data query.</p>` : ''}
        <label><span class="lbl">Note under the question (optional)</span>${inp('help', 'help', fl.help, 'e.g. Seated, after 5 minutes rest')}</label>
        <label><span class="lbl">Ask only if (optional)</span>${inp('show', 'show', fl.show, 'e.g. smoker = yes', 'class="input wide mono"')}${cp ? `<span class="fld-msg err">${esc(cp)}</span>` : '<span class="small muted">Uses the same rule language as the protocol: question names, = != &lt; &gt;, AND, OR, NOT.</span>'}</label>
        <label class="check"><input type="checkbox" data-change="dz" data-k="field-required" data-form="${formId}" data-i="${i}" ${fl.required ? 'checked' : ''}><span>Required: the data collector enters a value or says why it is missing</span></label>
        <div class="btn-row"><button class="btn sm" data-action="dz-field-move" data-form="${formId}" data-i="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''}>${icon('up')} Up</button><button class="btn sm" data-action="dz-field-move" data-form="${formId}" data-i="${i}" data-dir="1" ${i === n - 1 ? 'disabled' : ''}>${icon('down')} Down</button>
          <span class="grow"></span><button class="btn sm ghost danger-text" data-action="dz-field-del" data-form="${formId}" data-i="${i}">${pub ? 'Retire question (keeps its data)' : 'Delete question'}</button></div>
      </div></div>`;
    }

    /* ---- Arms and assignment ---- */
    function armsTab(D) {
      const a = D.assignment;
      const db = ui.getDb();
      const armSel = (k, attrs, val) => `<select class="input" data-change="dz" data-k="${k}" ${attrs} ${dis()}>${D.arms.map((x) => `<option value="${x.id}" ${val === x.id ? 'selected' : ''}>${esc(armLabel(D, x.id))}</option>`).join('')}</select>`;
      const counts = Object.fromEntries(D.arms.map((x) => [x.id, db.participants.filter((p) => p.enrolledAt && RS.armOf(p) === x.id).length]));
      let how = '';
      if (a.method === 'cluster') how = `<table class="tbl"><thead><tr><th>Cluster</th><th>Arm</th></tr></thead><tbody>${(D.clusters || []).map((c) => `<tr><td><input class="input" id="dz-cl-${c.id}" data-input="dz" data-k="cluster-name" data-cluster="${c.id}" value="${esc(c.name)}" ${dis()}></td><td>${armSel('cluster-arm', `data-cluster="${c.id}"`, c.armId)}</td></tr>`).join('')}</tbody></table>`;
      if (a.method === 'collector') how = `<table class="tbl"><thead><tr><th>Data collector</th><th>Arm</th></tr></thead><tbody>${RS.STAFF.collectors.map((c) => `<tr><td>${esc(c.name)}</td><td>${armSel('collector-arm', `data-collector="${c.id}"`, (a.collectorArms || {})[c.id] || D.arms[0].id)}</td></tr>`).join('')}</tbody></table>`;
      if (a.method === 'random') how = `<label><span class="lbl">Block sizes</span><input class="input" id="dz-blocks" data-input="dz" data-k="blocks" value="${esc((a.blockSizes || []).join(', '))}" ${dis()}></label>
        <p class="small muted">Blocks of these sizes, in a random order, keep the arms balanced without making the next allocation predictable. In a real study the statistician provides the allocation list and loads it on each tablet; this demo makes one on the tablet. ${db.allocation ? `${db.allocation.next} of ${db.allocation.list.length} slots used on this tablet.` : ''}</p>`;
      if (a.method === 'chosen') how = '<div class="alert warn">' + icon('alert') + '<div>Choosing the arm by hand can bias the results. Use it only for designs that are not randomised. The data collector records a reason, which goes in the audit trail.</div></div>';
      if (a.method === 'single' && D.arms.length > 1) how = `<div class="alert warn">${icon('alert')}<div>With “One arm”, everyone is in ${esc(armLabel(D, D.arms[0].id))}. Choose another method to use the other arms.</div></div>`;
      return `<div class="card"><h3>Arms</h3><p class="small muted">Arms are the groups that get different care or answer different questions. With one arm, everyone is the same.</p>
          ${D.arms.map((x, i) => `<div class="arm-row"><span class="arm-num">Arm ${i + 1}:</span><input class="input wide" id="dz-arm-${x.id}" data-input="dz" data-k="arm-name" data-arm="${x.id}" value="${esc(x.name)}" placeholder="Name, e.g. Intervention or Control" ${dis()}><span class="small muted">${plural(counts[x.id], 'participant')}</span></div>`).join('')}
          ${editing() ? `<div class="btn-row"><span class="lbl">Number of arms</span><button class="btn sm" data-action="dz-arms-n" data-n="-1" ${D.arms.length <= 1 ? 'disabled' : ''}>−</button><b>${D.arms.length}</b><button class="btn sm" data-action="dz-arms-n" data-n="1" ${D.arms.length >= 6 ? 'disabled' : ''}>+</button></div>` : ''}</div>
        <div class="card"><h3>How participants are assigned to an arm</h3><p class="small muted">The arm is set when the participant consents, before the baseline visit, and is recorded with how it was decided.</p>
          <div class="method-grid">${Object.entries(St.METHODS).map(([k, m]) => methodCard('dz-method', k, m, a.method === k)).join('')}</div>
          ${how}</div>
        <div class="card"><h3>Who can see the arm</h3>
          <div class="method-grid three">${Object.entries(St.VISIBILITY).map(([k, m]) => methodCard('dz-visible', k, m, a.visible === k)).join('')}</div></div>`;
    }
    /** An option card: a button while editing; when locked, plain text (readable) with the chosen one marked. */
    function methodCard(action, k, m, on) {
      if (!editing()) return `<div class="method ${on ? 'on' : 'off'}"><b>${on ? icon('check') + ' ' : ''}${m.label}</b><span>${m.text}</span></div>`;
      return `<button class="method ${on ? 'on' : ''}" data-action="${action}" data-v="${k}"><b>${m.label}</b><span>${m.text}</span></button>`;
    }

    /* ---- Visit schedule ---- */
    function scheduleTab(D) {
      const forms = Object.entries(D.forms);
      const vin = (v, i, prop, ph, w) => `<input class="input ${w || ''}" id="dz-v-${i}-${prop}" data-input="dz" data-k="visit" data-i="${i}" data-prop="${prop}" value="${esc(v[prop] == null ? '' : v[prop])}" placeholder="${ph}" ${dis()} ${prop === 'label' ? '' : 'inputmode="numeric"'}>`;
      return `<div class="card tbl-wrap"><h3>Visits</h3><p class="small muted">Days are counted from enrolment. The window is how many days before and after the ideal day the visit can be done.</p>
        <table class="tbl dz-visits"><thead><tr><th>Visit</th><th>Day</th><th>Days before</th><th>Days after</th><th></th></tr></thead><tbody>
          ${D.visits.map((v, i) => `<tr><td>${vin(v, i, 'label', 'Name', 'wide')}</td><td>${i === 0 ? '0 (enrolment)' : vin(v, i, 'day', 'day', 'num')}</td><td>${i === 0 ? '—' : vin(v, i, 'before', '0', 'num')}</td><td>${i === 0 ? '—' : vin(v, i, 'after', '0', 'num')}</td>
            <td>${editing() && i > 0 ? `<button class="icon-btn" data-action="dz-del-visit" data-i="${i}" aria-label="Remove visit">${icon('x')}</button>` : ''}</td></tr>`).join('')}
        </tbody></table>
        ${editing() ? `<button class="btn" data-action="dz-add-visit">${icon('plus')} Add a visit</button>` : ''}</div>
        <div class="card tbl-wrap"><h3>Which sections each visit asks</h3>
        ${forms.length ? `<table class="tbl dz-matrix"><thead><tr><th>Section</th>${D.visits.map((v) => `<th>${esc(v.label)}</th>`).join('')}</tr></thead><tbody>
          ${forms.map(([id, f]) => `<tr><td><b>${esc(f.title)}</b>${D.arms.length > 1 && f.arms && f.arms.length ? `<div class="small muted">${esc(f.arms.map((a) => armLabel(D, a)).join(', '))}</div>` : ''}</td>${D.visits.map((v) => `<td class="c">${editing() ? `<input type="checkbox" aria-label="${esc(f.title)} at ${esc(v.label)}" data-action="dz-form-visit" data-form="${id}" data-visit="${v.id}" ${v.forms.includes(id) ? 'checked' : ''}>` : v.forms.includes(id) ? '●' : ''}</td>`).join('')}</tr>`).join('')}
        </tbody></table>` : '<p class="muted small">Add sections first.</p>'}</div>`;
    }

    /* ---- Parts still in the protocol file ---- */
    function otherTab(D) {
      const li = (arr, fn) => (arr && arr.length ? `<ul class="small">${arr.map((x) => `<li>${fn(x)}</li>`).join('')}</ul>` : '<p class="small muted">None.</p>');
      return `<div class="alert info">${icon('info')}<div>These parts are shown here but still edited in the protocol file. The builder covers them next: screening and eligibility, consent, calculated scores and safety rules.</div></div>
        <div class="grid-2">
          <div class="card"><h3>Screening questions (${(D.screening.fields || []).length})</h3>${li(D.screening.fields, (f) => esc(f.label))}</div>
          <div class="card"><h3>Eligibility</h3>${li(D.eligibility, (c) => `<b>${c.kind === 'include' ? 'Include' : 'Exclude'}:</b> ${esc(c.text)}`)}</div>
          <div class="card"><h3>Consent</h3><p class="small">${esc(D.consent.version)} · ${esc(D.consent.language)}</p>${li(D.consent.options, (o) => esc(o.text))}</div>
          <div class="card"><h3>Calculated values (${(D.derived || []).length})</h3>${li(D.derived, (x) => `${esc(x.label)} <span class="mono small muted">${esc(x.expr)}</span>`)}</div>
          <div class="card"><h3>Safety rules (${(D.safety || []).length})</h3>${li(D.safety, (r) => `<span class="tag ${r.level}">${esc(r.level)}</span> ${esc(r.text)}`)}</div>
          <div class="card"><h3>Retired questions (${(D.retired || []).length})</h3>${li(D.retired, (f) => `${esc(f.label)} <span class="mono small muted">${esc(f.id)}</span>`)}<p class="small muted">Removed after data was collected. Their data stays in every export.</p></div>
        </div>`;
    }

    /* ---- Versions ---- */
    function versionsTab() {
      const st = St.state();
      return `<div class="card"><h3>Published versions</h3>
        ${st.published.length ? `<table class="tbl"><thead><tr><th>Version</th><th>Published</th><th>By</th><th>Reason</th></tr></thead><tbody>${st.published.slice().reverse().map((v) => `<tr><td><b>${esc(v.version)}</b></td><td>${esc(new Date(v.at).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }))}</td><td>${esc(v.by)}</td><td>${esc(v.reason)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted small">None yet.</p>'}
        <p class="small muted">Each visit record keeps the version it was collected under. Every unlock and publish is in the audit trail.</p></div>
        <div class="card demo-only"><h3>Demo</h3><p class="small muted">Try building a study from nothing, then come back to the ICEHALL demo. Both clear the demo data on this tablet.</p>
          <div class="btn-row"><button class="btn" data-action="dz-blank">Start a new, empty study</button><button class="btn" data-action="dz-restore">Restore the ICEHALL demo</button></div></div>`;
    }

    /* ---------------------------------------------------------------- */
    /* Export screen                                                     */
    /* ---------------------------------------------------------------- */
    function screenExport() {
      const db = ui.getDb();
      const P = RS.protocol();
      const done = db.visits.filter((r) => r.status === 'complete').length;
      const recent = db.audit.filter((a) => /^Export/.test(a.what || '')).slice(-6).reverse();
      const b = (k, label, note) => `<div class="xp-item"><button class="btn" data-action="xp" data-k="${k}">${icon('download')} ${label}</button><span class="small muted">${note}</span></div>`;
      return `<div class="page">
        <div class="card"><h2>Export data</h2><p>${esc(P.short || P.title)} · design version ${esc(P.designVersion || '—')} · ${plural(db.participants.filter((p) => p.enrolledAt).length, 'participant')} enrolled · ${plural(done, 'completed visit')}</p>
          <div class="alert info">${icon('info')}<div>This exports what is on <b>this tablet</b>. Until sync is connected, each tablet exports its own data and the files are combined at the data centre.</div></div>
          <label class="check"><input type="checkbox" data-change="xp-ident" ${S.xpIdent ? 'checked' : ''}><span><b>Include names, phone numbers and dates of birth.</b> Off by default: exports carry study IDs and household IDs only. Identifiable exports are recorded in the audit trail.</span></label></div>
        <div class="card"><h3>For analysis</h3>
          ${b('visits', 'Visits (CSV)', 'One row per completed visit, every question as a column, with missing-data reasons and calculated values.')}
          ${b('long', 'Answers (CSV, long format)', 'One row per answer. New questions in later versions never change the columns.')}
          ${b('participants', 'Participants and consent (CSV)', 'Status, arm and how it was assigned, consent version and options, withdrawals.')}
          ${b('codebook', 'Codebook (CSV)', 'Every variable: question wording, type, unit, answer codes, limits, arms, and whether it is retired. Send it with every data export.')}</div>
        <div class="card"><h3>For other systems and archiving</h3>
          ${b('redcap', 'REDCap data dictionary (CSV)', 'Builds the same forms in REDCap. “Ask only if” conditions are written in the annotation column for translation to REDCap branching logic.')}
          ${b('archive', 'Full archive (JSON)', 'Everything, including the design versions, queries, referrals, safety events and the audit trail.')}
          ${b('audit', 'Audit trail (CSV)', 'Every correction, unlock, publication and export.')}</div>
        <div class="card"><h3>Recent exports</h3>${recent.length ? `<table class="tbl"><tbody>${recent.map((a) => `<tr><td>${esc(new Date(a.at).toLocaleString())}</td><td>${esc(a.by)}</td><td>${esc(a.what)}</td></tr>`).join('')}</tbody></table>` : '<p class="small muted">None yet.</p>'}</div>
        <p class="small muted">Coming next: Excel with one sheet per section, label scripts for Stata, SPSS and R, and the study design as an XLSForm (ODK, KoBoToolbox, SurveyCTO).</p>
      </div>`;
    }

    function doExport(k) {
      const db = ui.getDb();
      const P = RS.protocol();
      const name = (P.short || 'study').toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const day = RS.date.today();
      const ident = S.xpIdent && (k === 'participants' || k === 'archive');
      const files = {
        visits: [`${name}-visits-${day}.csv`, () => RS.exportVisits(db, P), 'Visits'],
        long: [`${name}-answers-long-${day}.csv`, () => RS.exportLong(db, P), 'Answers (long)'],
        participants: [`${name}-participants${ident ? '-IDENTIFIED' : ''}-${day}.csv`, () => RS.exportParticipants(db, { identified: ident }), 'Participants'],
        codebook: [`${name}-codebook-v${P.designVersion || ''}-${day}.csv`, () => RS.codebook(P), 'Codebook'],
        redcap: [`${name}-redcap-dictionary-${day}.csv`, () => RS.redcapDictionary(P), 'REDCap dictionary'],
        archive: [`${name}-archive${ident ? '-IDENTIFIED' : ''}-${day}.json`, () => RS.archive(db, P, { identified: ident }), 'Full archive'],
        audit: [`${name}-audit-${day}.csv`, () => RS.exportAudit(db), 'Audit trail'],
      };
      const [file, make, label] = files[k];
      ui.download(file, make(), k === 'archive' ? 'application/json' : 'text/csv');
      RS.audit(db, { by: ui.me().name, what: `Export: ${label}${ident ? ' (IDENTIFIED: names and phone numbers)' : ' (de-identified)'}` });
      ui.save();
      ui.render();
    }

    /* ---------------------------------------------------------------- */
    /* Modals                                                            */
    /* ---------------------------------------------------------------- */
    function modal(m, head) {
      const l = St.latest();
      if (m.type === 'dz-unlock') {
        return `<div class="modal-card">${head('Unlock the study design?')}
          <p>You'll edit a <b>draft</b>. Data collectors keep using version ${esc(l ? l.version : '—')} until you publish the draft as version ${St.nextVersion()}.</p>
          <ul class="small"><li>Published questions keep their variable name and type, and published answer codes stay.</li><li>Removing a question that has data retires it: it is no longer asked, and its data stays in every export.</li><li>Publishing asks for a reason (for example the protocol amendment and its approval), which is kept with the version.</li></ul>
          <div class="btn-row end"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="dz-unlock-yes">Continue</button></div></div>`;
      }
      if (m.type === 'dz-password') {
        return `<div class="modal-card">${head('Supervisor password')}
          <label><span class="lbl">Password</span><input class="input wide" type="password" id="dzPw" data-input="modal" data-k="pw" value="${esc(m.pw || '')}" autocomplete="off" inputmode="numeric"></label>
          ${m.err ? '<div class="fld-msg err">That password is not right.</div>' : ''}
          <p class="small demo-note">Demo password: <b class="mono">${St.DEMO_PASSWORD}</b></p>
          <div class="btn-row end"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="dz-unlock-submit">${icon('unlock')} Unlock</button></div></div>`;
      }
      if (m.type === 'dz-publish') {
        const db = ui.getDb();
        const ch = St.changes(db);
        const problems = St.check(St.draft());
        const empty = !Object.values(St.draft().forms).some((f) => f.fields.length);
        const groups = [['add', 'Added', 'ok'], ['change', 'Changed', ''], ['remove', 'Removed', 'warn']];
        const ok = !problems.length && !empty && (m.reason || '').trim();
        return `<div class="modal-card wide">${head(l ? `Publish version ${St.nextVersion()}?` : 'Lock and publish version 1.0?')}
          ${problems.length ? `<div class="alert urgent">${icon('alert')}<div><b>Fix these first</b>${problems.map((p) => `<div class="small">${esc(p)}</div>`).join('')}</div></div>` : ''}
          ${empty ? `<div class="alert urgent">${icon('alert')}<div>Add at least one question before publishing.</div></div>` : ''}
          ${l ? (ch.length ? groups.map(([k, t, tone]) => { const xs = ch.filter((c) => c.kind === k); return xs.length ? `<h4 class="ch-${tone}">${t} (${xs.length})</h4><ul class="small">${xs.map((c) => `<li>${esc(c.text)}</li>`).join('')}</ul>` : ''; }).join('') : '<p class="muted">No changes.</p>') : `<p>${plural(Object.keys(St.draft().forms).length, 'section')}, ${plural(Object.values(St.draft().forms).reduce((n, f) => n + f.fields.length, 0), 'question')}, ${plural(St.draft().visits.length, 'visit')}, ${plural(St.draft().arms.length, 'arm')}.</p>`}
          <label><span class="lbl">Reason for this version (required)</span><textarea class="input wide" id="dzReason" data-input="modal" data-k="reason" rows="2" placeholder="${l ? 'e.g. Amendment 2, approved by the IRB on 14 March' : 'e.g. First version, approved protocol v1.0'}">${esc(m.reason || '')}</textarea></label>
          <p class="small muted">After publishing, the design locks again and the app restarts with version ${St.nextVersion()}. Visits already started keep their answers.</p>
          <div class="btn-row end"><button class="btn" data-action="close-modal">Keep editing</button><button class="btn primary" data-action="dz-publish-confirm" ${ok ? '' : 'disabled'}>${icon('lock')} Publish and lock</button></div></div>`;
      }
      if (m.type === 'dz-discard') {
        return `<div class="modal-card">${head('Discard the draft?')}<p>All ${plural(St.changes(ui.getDb()).length, 'change')} since version ${esc(l.version)} will be lost. The design locks again.</p>
          <div class="btn-row end"><button class="btn" data-action="close-modal">Keep editing</button><button class="btn danger" data-action="dz-discard-yes">Discard changes</button></div></div>`;
      }
      if (m.type === 'dz-preview') {
        const D = d();
        const f = D.forms[m.form];
        const fields = f.fields.map((x) => Object.assign({}, x, { options: x.type === 'yesno' ? [['yes', 'Yes'], ['no', 'No']] : x.options || [] }));
        return `<div class="modal-card wide">${head('Preview: ' + (f.title || 'Untitled section'))}
          <p class="small muted">As data collectors will see it. Nothing is saved, and “ask only if” conditions are not applied here.</p>
          <div class="section preview">${f.intro ? `<p class="small muted">${esc(f.intro)}</p>` : ''}${fields.map((x) => ui.fieldHtml(x, S.dz.pv, { mode: 'preview' })).join('') || '<p class="muted">No questions yet.</p>'}</div>
          <div class="btn-row end"><button class="btn primary" data-action="close-modal">Close</button></div></div>`;
      }
      if (m.type === 'dz-blank') {
        return `<div class="modal-card">${head('Start a new, empty study?')}<p>Demo only: this clears the ICEHALL demo study and its data from this tablet. Data collectors see “No active study” until you publish the new design.</p><p class="small muted">Restore the ICEHALL demo at any time from Versions, or with Reset demo data.</p>
          <div class="btn-row end"><button class="btn" data-action="close-modal">Cancel</button><button class="btn danger" data-action="dz-blank-yes">Start a new study</button></div></div>`;
      }
      return null;
    }

    /* ---------------------------------------------------------------- */
    /* Actions and inputs                                                */
    /* ---------------------------------------------------------------- */
    const field = (el) => d().forms[el.dataset.form].fields[Number(el.dataset.i)];
    const nextArmId = (D) => { let n = D.arms.length + 1; while (D.arms.some((a) => a.id === 'arm' + n)) n++; return 'arm' + n; };
    const handlers = {
      'dz-tab': (el) => { S.dz.tab = el.dataset.v; ui.render(); },
      'dz-arm-view': (el) => { S.dz.arm = el.dataset.v; ui.render(); },
      'dz-form-open': (el) => { S.dz.open[el.dataset.form] = !S.dz.open[el.dataset.form]; ui.render(); },
      'dz-field-open': (el) => { S.dz.field = S.dz.field === el.dataset.key ? null : el.dataset.key; ui.render(); },
      'dz-preview': (el) => { S.dz.pv = {}; ui.openModal({ type: 'dz-preview', form: el.dataset.form }); },
      'dz-lock': () => { if (editing()) ui.openModal({ type: 'dz-publish', reason: '' }); else ui.openModal({ type: 'dz-unlock' }); },
      'dz-unlock-yes': () => { ui.openModal({ type: 'dz-password', pw: '' }); const n = document.getElementById('dzPw'); if (n) n.focus(); },
      'dz-unlock-submit': () => {
        if (!St.unlock(S.modal.pw || '')) { S.modal.err = true; S.modal.pw = ''; ui.renderModal(); return; }
        RS.audit(ui.getDb(), { by: ui.me().name, what: 'Study design unlocked for editing' });
        ui.save(); ui.closeModal(); ui.render(); ui.toast('Unlocked. You are editing a draft; data collectors keep the published version.');
      },
      'dz-publish': () => ui.openModal({ type: 'dz-publish', reason: '' }),
      'dz-publish-confirm': () => {
        const reason = (S.modal.reason || '').trim();
        if (!reason) return;
        Object.values(St.draft().forms).forEach((f) => f.fields.forEach((x) => { delete x.autoId; }));
        const v = St.publish(reason, ui.me().name);
        RS.audit(ui.getDb(), { by: ui.me().name, what: `Study design version ${v} published`, reason });
        ui.save();
        try { sessionStorage.setItem('jamii.research.return', 'design'); } catch (e) { /* private mode */ }
        location.reload();
      },
      'dz-discard': () => ui.openModal({ type: 'dz-discard' }),
      'dz-discard-yes': () => { St.discard(); RS.audit(ui.getDb(), { by: ui.me().name, what: 'Study design draft discarded' }); ui.save(); ui.closeModal(); ui.render(); ui.toast('Draft discarded. The design is locked.'); },
      'dz-blank': () => ui.openModal({ type: 'dz-blank' }),
      'dz-blank-yes': () => { St.startBlank(); ui.setDb(RS.emptyDb()); location.reload(); },
      'dz-restore': () => { if (!confirm('Restore the ICEHALL demo study and its demo data on this tablet?')) return; ui.resetAll(); },

      'dz-arms-n': (el) => {
        const D = d();
        if (Number(el.dataset.n) > 0) { D.arms.push({ id: nextArmId(D), name: '' }); changed(); return; }
        const last = D.arms[D.arms.length - 1];
        const n = ui.getDb().participants.filter((p) => p.enrolledAt && RS.armOf(p) === last.id).length;
        if (n) { ui.toast(`${armLabel(D, last.id)} has ${plural(n, 'participant')}: it can't be removed.`); return; }
        D.arms.pop();
        Object.values(D.forms).forEach((f) => { if (f.arms) { f.arms = f.arms.filter((a) => a !== last.id); if (!f.arms.length) delete f.arms; } });
        (D.clusters || []).forEach((c) => { if (c.armId === last.id) c.armId = D.arms[0].id; });
        Object.keys(D.assignment.collectorArms || {}).forEach((k) => { if (D.assignment.collectorArms[k] === last.id) D.assignment.collectorArms[k] = D.arms[0].id; });
        if (S.dz.arm === last.id) S.dz.arm = 'all';
        changed();
      },
      'dz-method': (el) => { if (!editing()) return; d().assignment.method = el.dataset.v; changed(); },
      'dz-visible': (el) => { if (!editing()) return; d().assignment.visible = el.dataset.v; changed(); },
      'dz-copy-arm': (el) => {
        const from = document.getElementById('dzCopyFrom').value;
        St.copyArm(d(), from, S.dz.arm, el.dataset.sep === '1');
        changed();
        ui.toast(el.dataset.sep === '1' ? 'Separate copies made for this arm' : 'This arm now uses the same sections');
      },
      'dz-add-form': () => {
        const D = d();
        const id = St.newFormId(D, 'section');
        D.forms[id] = { title: '', fields: [] };
        if (S.dz.arm !== 'all' && D.arms.length > 1) D.forms[id].arms = [S.dz.arm];
        D.visits[0].forms.push(id);
        S.dz.open[id] = true;
        changed();
        const n = document.getElementById('dz-ft-' + id); if (n) n.focus();
      },
      'dz-form-arm': (el) => {
        const D = d(), f = D.forms[el.dataset.form];
        let arms = f.arms && f.arms.length ? f.arms.slice() : D.arms.map((a) => a.id);
        arms = el.checked ? [...new Set([...arms, el.dataset.arm])] : arms.filter((a) => a !== el.dataset.arm);
        if (!arms.length) { ui.toast('A section needs at least one arm. Remove the section instead.'); ui.render(); return; }
        if (arms.length === D.arms.length) delete f.arms; else f.arms = arms;
        changed();
      },
      'dz-form-visit': (el) => {
        const v = d().visits.find((x) => x.id === el.dataset.visit);
        v.forms = el.checked ? [...new Set([...v.forms, el.dataset.form])] : v.forms.filter((x) => x !== el.dataset.form);
        changed();
      },
      'dz-form-del': (el) => {
        const D = d(), f = D.forms[el.dataset.form];
        const pub = St.publishedIds().forms.has(el.dataset.form);
        if (!confirm(`Remove the section “${f.title || 'Untitled'}” from every arm and visit?${pub ? ' Its questions are retired: collected data stays in the exports.' : ''}`)) return;
        St.removeForm(D, el.dataset.form);
        changed();
      },
      'dz-add-field': (el) => {
        const D = d(), f = D.forms[el.dataset.form];
        f.fields.push({ id: St.newId(D, 'question'), label: '', type: 'yesno', autoId: true });
        S.dz.field = el.dataset.form + ':' + (f.fields.length - 1);
        changed();
        const n = document.getElementById(`dz-f-${el.dataset.form}-${f.fields.length - 1}-label`); if (n) n.focus();
      },
      'dz-field-move': (el) => {
        const fs = d().forms[el.dataset.form].fields, i = Number(el.dataset.i), j = i + Number(el.dataset.dir);
        [fs[i], fs[j]] = [fs[j], fs[i]];
        S.dz.field = el.dataset.form + ':' + j;
        changed();
      },
      'dz-field-del': (el) => {
        const fl = field(el);
        const pub = St.publishedIds().fields.has(fl.id);
        St.removeField(d(), el.dataset.form, fl.id);
        S.dz.field = null;
        changed();
        ui.toast(pub ? `Retired: “${fl.label}” is no longer asked; its data stays in the exports.` : 'Question deleted');
      },
      'dz-opt-add': (el) => { const fl = field(el); fl.options = fl.options || []; fl.options.push([String(fl.options.length + 1), '']); changed(); },
      'dz-opt-del': (el) => { field(el).options.splice(Number(el.dataset.j), 1); changed(); },
      'dz-add-visit': () => {
        const D = d();
        const lastDay = Math.max(...D.visits.map((v) => v.day));
        const day = lastDay + 90;
        let id = 'm' + Math.round(day / 30.4), n = 2;
        while (D.visits.some((v) => v.id === id)) id = 'm' + Math.round(day / 30.4) + '_' + n++;
        D.visits.push({ id, label: `Month ${Math.round(day / 30.4)}`, day, before: 14, after: 14, forms: [] });
        changed();
      },
      'dz-del-visit': (el) => {
        const D = d(), v = D.visits[Number(el.dataset.i)];
        const n = ui.getDb().visits.filter((r) => r.visit === v.id).length;
        if (n) { ui.toast(`${v.label} has ${plural(n, 'visit record')}: it can't be removed.`); return; }
        D.visits.splice(Number(el.dataset.i), 1);
        changed();
      },
      xp: (el) => {
        const k = el.dataset.k;
        if (S.xpIdent && (k === 'participants' || k === 'archive') && !confirm('This file will contain names, phone numbers and dates of birth. Store it only where the protocol allows. Continue?')) return;
        doExport(k);
      },
    };

    /** Typing in a design box. Returns true when handled. */
    function onInput(el) {
      if (el.dataset.input !== 'dz') return false;
      if (!editing()) return true;
      const D = d(), k = el.dataset.k, v = el.value;
      const num = (x) => (x.trim() === '' || isNaN(Number(x)) ? undefined : Number(x));
      if (k === 'title' || k === 'short') D[k] = v;
      else if (k === 'arm-name') D.arms.find((a) => a.id === el.dataset.arm).name = v;
      else if (k === 'form-title') D.forms[el.dataset.form].title = v;
      else if (k === 'cluster-name') D.clusters.find((c) => c.id === el.dataset.cluster).name = v;
      else if (k === 'blocks') D.assignment.blockSizes = v.split(/[,\s]+/).map(Number).filter((x) => x > 0);
      else if (k === 'visit') {
        const vis = D.visits[Number(el.dataset.i)], p = el.dataset.prop;
        if (p === 'label') vis.label = v; else vis[p] = num(v) == null ? 0 : Math.max(0, Math.round(num(v)));
      } else if (k === 'opt') {
        const o = field(el).options[Number(el.dataset.j)];
        o[Number(el.dataset.part)] = el.dataset.part === '0' ? v.toLowerCase().replace(/[^a-z0-9_]/g, '') : v;
      } else if (k === 'field') {
        const fl = field(el), p = el.dataset.prop;
        if (p === 'label') {
          fl.label = v;
          // A new question's variable name follows its wording until it is edited by hand.
          if (fl.autoId && v.trim()) { const taken = St.usedIds(D); taken.delete(fl.id); fl.id = St.newId(D, v, taken); }
        } else if (p === 'id') { fl.id = v.toLowerCase().replace(/[^a-z0-9_]/g, ''); delete fl.autoId; }
        else if (p === 'min' || p === 'max') { if (num(v) == null) delete fl[p]; else fl[p] = num(v); }
        else if (p === 'soft-lo' || p === 'soft-hi') {
          const s = fl.soft ? fl.soft.slice() : [undefined, undefined];
          s[p === 'soft-lo' ? 0 : 1] = num(v);
          if (s[0] == null && s[1] == null) delete fl.soft; else fl.soft = [s[0] == null ? -1e9 : s[0], s[1] == null ? 1e9 : s[1]];
        } else if (v.trim()) fl[p] = v; else delete fl[p];
      }
      changed();
      return true;
    }

    /** Selects and checkboxes. Returns true when handled. */
    function onChange(el) {
      if (el.dataset.change === 'xp-ident') { S.xpIdent = el.checked; ui.render(); return true; }
      if (el.dataset.change !== 'dz') return false;
      if (!editing()) return true;
      const D = d(), k = el.dataset.k;
      if (k === 'field-type') {
        const fl = field(el), t = el.value;
        fl.type = t === 'integer' ? 'number' : t;
        if (t === 'integer') fl.integer = true; else delete fl.integer;
        if (t === 'choice') { if (!fl.options || !fl.options.length) fl.options = [['1', ''], ['2', '']]; } else delete fl.options;
        if (t !== 'number' && t !== 'integer') ['unit', 'min', 'max', 'soft'].forEach((x) => delete fl[x]);
      } else if (k === 'field-required') { const fl = field(el); if (el.checked) fl.required = true; else delete fl.required; }
      else if (k === 'cluster-arm') D.clusters.find((c) => c.id === el.dataset.cluster).armId = el.value;
      else if (k === 'collector-arm') { D.assignment.collectorArms = D.assignment.collectorArms || {}; D.assignment.collectorArms[el.dataset.collector] = el.value; }
      changed();
      return true;
    }

    /** Shown on other supervisor screens while a draft is open. */
    function draftBanner() {
      return St.draft() && St.latest() ? `<div class="alert warn dz-draft-banner">${icon('unlock')}<div>The study design has <b>unpublished changes</b>. Data collectors are still on version ${esc(St.latest().version)}.</div><button class="btn sm" data-action="go" data-screen="design">Back to study design</button></div>` : '';
    }

    return { screens: { design: screenDesign, export: screenExport }, handlers, onInput, onChange, modal, draftBanner };
  };
}());
