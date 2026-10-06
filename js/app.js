/*
 * Jamii Research: screens and actions.
 * Two views: Data collector and Supervisor. One protocol (RS.protocol()) drives every form,
 * rule, schedule and message; this file only draws it.
 */
(function () {
  'use strict';
  const RS = window.RS;
  const D = RS.date;
  const P = RS.protocol();
  let db = RS.load();

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ICONS = {
    plus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    folder: '<path d="M3 6a1 1 0 0 1 1-1h5l2 2.5h9a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    message: '<path d="M4 5h16v11H9l-5 4z"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
    doc: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7M9 16h7"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/>',
    phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    ear: '<path d="M7 9a5 5 0 0 1 10 0c0 3-3 4-3 7a3 3 0 0 1-6 0"/><path d="M10 10a2 2 0 0 1 4 0"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
    left: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    send: '<path d="M21 3 10 14"/><path d="M21 3l-7 18-4-7-7-4z"/>',
    chart: '<path d="M4 19V5M4 19h16M8 15l3-4 3 2 5-6"/>',
    printer: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
    house: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
    transfer: '<path d="M4 8h14l-4-4"/><path d="M20 16H6l4 4"/>',
    unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.6-1.8"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    up: '<path d="m6 15 6-6 6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    right: '<path d="m9 6 6 6-6 6"/>',
    flask: '<path d="M9 3h6M10 3v6L4 19a1.5 1.5 0 0 0 1.3 2h13.4A1.5 1.5 0 0 0 20 19l-6-10V3"/><path d="M7 15h10"/>',
  };
  const icon = (n) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`;

  /* ------------------------------------------------------------------ */
  /* State                                                               */
  /* ------------------------------------------------------------------ */
  const UI_KEY = 'icehall.research.ui';
  const ui = (() => { try { return JSON.parse(localStorage.getItem(UI_KEY)) || {}; } catch (e) { return {}; } })();
  const S = {
    role: ui.role || 'COLLECTOR', collectorId: ui.collectorId || RS.STAFF.collectors[0].id, test: !!ui.test, screen: null, pid: null, recId: null,
    q: '', recFilter: 'enrolled', recCluster: 'mine', groupBy: 'status', msgTab: 'suggested', reviewTab: 'overview',
    f: { cluster: 'all', collector: 'all' }, an: { split: 'cluster', measure: 'sys_mean' },
    idDraft: null, compose: null, modal: null, tried: false, missingOpen: null, showSensitive: {},
    listen: { recId: null, text: '', recording: false, interim: '', mode: 'check' },
  };
  if (!RS.STAFF.collectors.some((c) => c.id === S.collectorId)) S.collectorId = RS.STAFF.collectors[0].id;
  const homeScreen = () => (RS.noStudy ? (S.role === 'SUPERVISOR' ? 'design' : 'nostudy') : S.role === 'SUPERVISOR' ? 'quality' : 'schedule');
  S.screen = homeScreen();
  // After publishing a design version the app restarts; return to the study design.
  try { if (sessionStorage.getItem('jamii.research.return') === 'design' && S.role === 'SUPERVISOR') S.screen = 'design'; sessionStorage.removeItem('jamii.research.return'); } catch (e) { /* private mode */ }
  const saveUi = () => { try { localStorage.setItem(UI_KEY, JSON.stringify({ role: S.role, collectorId: S.collectorId, test: S.test })); } catch (e) { /* private mode */ } };
  const save = () => RS.save(db);
  const isSup = () => S.role === 'SUPERVISOR';
  const me = () => (isSup() ? RS.STAFF.supervisor : RS.STAFF.collectors.find((c) => c.id === S.collectorId));
  /** Clusters this collector works in (all, for the supervisor). */
  const myClusters = () => (isSup() ? P.clusters.map((c) => c.id) : me().clusters);
  const isMine = (p) => myClusters().includes(p.cluster);
  const collectorName = (clusterId) => (RS.collectorFor(RS.STAFF.collectors, clusterId) || { name: '—' }).name;
  /** The supervisor's cluster / collector filter. */
  const inScope = (p) => (S.f.cluster === 'all' || p.cluster === S.f.cluster) && (S.f.collector === 'all' || (RS.STAFF.collectors.find((c) => c.id === S.f.collector) || { clusters: [] }).clusters.includes(p.cluster));
  const part = (id) => db.participants.find((p) => p.id === id);
  const rec = (id) => db.visits.find((r) => r.id === id);
  const visitDef = (id) => P.visits.find((v) => v.id === id);
  const clusterOf = (p) => (P.clusters || []).find((c) => c.id === p.cluster) || { name: p.cluster || '—', arm: '' };
  // The arm as this viewer may see it (the study's visibility setting), by participant or by arm id.
  const armShownId = (id) => (P.arms ? RS.study.armShown(P, id, S.role) : '');
  const armText = (p) => armShownId(RS.armOf(p));
  const clusterArm = (c) => (P.assignment && P.assignment.method === 'cluster' ? armShownId(c.armId) : '');
  const initials = (name) => (name || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const pLabel = (p) => p.studyId || p.screeningNo;
  const ageText = (p) => { const a = D.ageYears(p.dob); return a == null ? '' : `${a} y${p.dobEstimated ? ' (est.)' : ''}`; };
  const fmtDT = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
  const ctxOf = (r) => RS.ctxForVisit(db, part(r.participantId), r, r.status === 'complete' ? r.date : D.today());

  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => t.classList.add('hidden'), 2800);
  }
  /** Replace innerHTML but keep focus and caret on an element with the same id. */
  function patch(el, html) {
    const a = document.activeElement;
    const keep = a && a.id && el.contains(a) ? { id: a.id, s: a.selectionStart, e: a.selectionEnd } : null;
    const scroll = el.scrollTop;
    el.innerHTML = html;
    el.scrollTop = scroll;
    if (keep) {
      const n = document.getElementById(keep.id);
      if (n) { n.focus(); try { if (keep.s != null) n.setSelectionRange(keep.s, keep.e); } catch (e) { /* not text */ } }
    }
  }
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/csv' }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ------------------------------------------------------------------ */
  /* Navigation                                                          */
  /* ------------------------------------------------------------------ */
  const openQueries = () => db.queries.filter((q) => q.status === 'open' && isMine(part(q.participantId)));
  const myRows = () => RS.scheduleRows(db, P, null, 30).filter((r) => isMine(r.participant));
  function navItems() {
    if (RS.noStudy) return [];
    const pending = db.messages.filter((m) => m.status === 'pending').length;
    const items = [];
    if (isSup()) {
      // Review only: the supervisor doesn't run visits or message participants.
      const toReview = db.visits.filter((r) => r.status === 'complete' && !r.reviewed).length;
      const ev = db.events.filter((e) => e.status === 'new').length;
      items.push(['quality', 'Data quality', 'shield', db.queries.filter((q) => q.status === 'answered').length + toReview + ev, ev ? 'urgent' : '']);
      items.push(['analysis', 'Analysis', 'chart']);
      items.push(['sep']);
      items.push(['records', 'Participant records', 'folder']);
      items.push(['schedule', 'Schedule', 'calendar']);
      items.push(['messages', 'Messaging', 'message', pending]);
    } else {
      items.push(['initial', 'Initial visit', 'plus', db.participants.filter((p) => p.status === 'screening' && isMine(p)).length]);
      items.push(['records', 'Participant records', 'folder', openQueries().length]);
      items.push(['schedule', 'Schedule', 'calendar', myRows().filter((r) => r.status !== 'upcoming').length]);
      items.push(['messages', 'Messaging', 'message', suggestions().length]);
    }
    items.push(['sep']);
    items.push(['protocol', 'Protocol', 'doc']);
    return items;
  }
  function renderNav() {
    const u = me();
    const active = { participant: 'records', visit: S.pid && part(S.pid) && part(S.pid).status === 'screening' ? 'initial' : 'records', visitview: 'records' }[S.screen] || S.screen;
    // The study's own tools sit apart from the day-to-day screens (supervisors only).
    const studyCard = isSup() ? `<div class="nav-card"><div class="nav-card-label">Study</div>
        ${[['design', 'Study design', 'flask', RS.study.draft() ? '!' : '', 'urgent'], ...(RS.noStudy ? [] : [['export', 'Export data', 'download']])].map(([id, label, ic, badge, tone]) => `
          <button class="nav-item ${active === id ? 'active' : ''}" data-action="go" data-screen="${id}" title="${esc(label)}">${icon(ic)}<span class="nav-label">${esc(label)}</span>${badge ? `<span class="badge ${tone || ''}" title="Unpublished changes">${badge}</span>` : ''}</button>`).join('')}</div>` : '';
    $('appnav').innerHTML = `
      <div class="brand"><div class="brand-mark">JR</div><div class="brand-text"><strong>Jamii Research</strong><span>${esc(RS.noStudy ? 'No active study' : P.short || P.title)}</span></div></div>
      <div class="me"><div class="avatar">${esc(initials(u.name))}</div><div class="me-text"><strong>${esc(u.name)}</strong><span>${esc(u.role)}</span></div></div>
      <div class="nav-items">
        ${navItems().map(([id, label, ic, badge, tone]) => (id === 'sep' ? '<div class="nav-sep"></div>' : `
          <button class="nav-item ${active === id ? 'active' : ''}" data-action="go" data-screen="${id}" title="${esc(label)}">
            ${icon(ic)}<span class="nav-label">${esc(label)}</span>${badge ? `<span class="badge ${tone || ''}">${badge}</span>` : ''}
          </button>`)).join('')}
        ${studyCard}
      </div>
      <div class="nav-foot">
        ${RS.noStudy ? '' : `<p>${esc(P.title.split(':')[0])} protocol ${esc(P.version)} · design version ${esc(P.designVersion || '—')}. ${esc(P.status)}</p>`}
        <p>Prototype: SMS, sync and sign-in are not connected.</p>
        <button class="btn sm ghost" data-action="reset-demo">${icon('reset')}<span class="nav-label">Reset demo data</span></button>
        <button class="btn sm ghost" data-action="dz-blank" title="Remove the study and its data to build a new one (demo)">${icon('x')}<span class="nav-label">Clear study</span></button>
      </div>`;
    document.querySelectorAll('[data-role]').forEach((b) => b.classList.toggle('active', b.dataset.role === S.role));
    const sel = $('collectorSel');
    sel.innerHTML = RS.STAFF.collectors.map((c) => `<option value="${c.id}" ${c.id === S.collectorId ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
    sel.classList.toggle('hidden', isSup());
    $('testBtn').classList.toggle('on', S.test);
    $('testBtn').textContent = S.test ? 'Test tools: on' : 'Test tools';
    document.body.dataset.role = S.role;
  }

  const TITLES = { design: 'Study design', export: 'Export data', nostudy: 'No active study', initial: 'Initial visit', records: 'Participant records', participant: 'Participant', visit: 'Visit', visitview: 'Visit record', schedule: 'Schedule', messages: 'Messaging', quality: 'Data quality review', analysis: 'Analysis', protocol: 'Protocol' };
  // Screens each view may open (the supervisor reviews; collectors run visits and message participants).
  const ALLOWED = {
    SUPERVISOR: RS.noStudy ? ['design'] : ['quality', 'analysis', 'records', 'participant', 'visitview', 'schedule', 'messages', 'protocol', 'design', 'export'],
    COLLECTOR: RS.noStudy ? ['nostudy'] : ['initial', 'records', 'participant', 'visit', 'visitview', 'schedule', 'messages', 'protocol'],
  };
  function go(screen, opts) {
    if (S.listen.recording && screen !== 'visit') stopMic();
    if (!ALLOWED[S.role].includes(screen)) screen = homeScreen();
    S.screen = screen;
    S.tried = false; S.missingOpen = null;
    Object.assign(S, opts || {});
    render();
    $('view').scrollTop = 0;
  }
  function render() {
    renderNav();
    $('topTitle').textContent = TITLES[S.screen] || 'Jamii Research';
    // The study name on every screen: only once a version is published.
    const chip = $('studyChip');
    if (chip) { chip.textContent = RS.noStudy ? 'No active study' : P.short || P.title; chip.classList.toggle('none', RS.noStudy); }
    patch($('view'), (isSup() && S.screen !== 'design' ? DZ.draftBanner() : '') + (SCREENS[S.screen] || SCREENS.schedule)());
    renderModal();
  }

  /* ------------------------------------------------------------------ */
  /* Shared pieces                                                       */
  /* ------------------------------------------------------------------ */
  const STATUS_TEXT = { enrolled: 'Enrolled', screening: 'Screening', screen_fail: 'Screen fail', declined: 'Declined consent', withdrawn: 'Withdrawn', completed: 'Completed' };
  const statusTag = (p) => `<span class="tag ${p.status === 'declined' ? 'screen_fail' : p.status}">${esc(STATUS_TEXT[p.status] || p.status)}</span>`;
  const VSTATUS = { done: 'Done', due: 'Due now', upcoming: 'Upcoming', missed: 'Window closed', stopped: 'Not done' };
  const LEVEL = { urgent: 'Act now', soon: 'Refer / review', report: 'Report', note: 'Note' };

  function fmtValue(f, v) {
    if (v == null || v === '') return '';
    if (f && f.options) { const o = f.options.find(([k]) => String(k) === String(v)); if (o) return o[1] === o[0] ? o[0] : `${o[1]}${/^\d$/.test(o[0]) && o[1] !== o[0] ? ` (${o[0]})` : ''}`; }
    return `${v}${f && f.unit ? ' ' + f.unit : ''}`;
  }
  function alertsHtml(list, withAction) {
    if (!list.length) return '';
    return `<div class="alerts">${list.map((x) => {
      const r = x.rule || x;
      return `<div class="alert ${r.level}">${icon(r.level === 'note' ? 'info' : 'alert')}<div><strong>${esc(LEVEL[r.level])}</strong>${esc(x.text)}
        ${r.source ? `<div class="src">${esc(r.source)}</div>` : ''}${withAction && x.action ? `<div class="src">Action: ${esc(x.action)}</div>` : ''}</div></div>`;
    }).join('')}</div>`;
  }
  function crumbs(p) {
    return `<div class="btn-row" style="margin-bottom:12px"><button class="btn sm ghost" data-action="open-participant" data-pid="${p.id}">${icon('left')} ${esc(p.name)} · ${esc(pLabel(p))}</button></div>`;
  }

  /* ------------------------------------------------------------------ */
  /* Initial visit (screening → eligibility → consent → baseline → enrol) */
  /* ------------------------------------------------------------------ */
  const STEPS = [['identify', 'Identify'], ['eligibility', 'Eligibility'], ['consent', 'Consent'], ['baseline', 'Baseline data'], ['enrol', 'Enrol']];
  function stepsHtml(cur) {
    const i = STEPS.findIndex(([id]) => id === cur);
    return `<div class="steps">${STEPS.map(([id, label], k) => `<div class="step ${k === i ? 'on' : k < i ? 'done' : ''}"><span class="n">${k < i ? '✓' : k + 1}</span>${label}</div>`).join('')}</div>`;
  }
  const blankId = () => ({ name: '', sex: '', dobMode: 'dob', dob: '', age: '', cluster: myClusters().length === 1 ? myClusters()[0] : '', phone: '', language: P.languages[0], houseWith: '' });

  /** People in a cluster someone could share a household with (anyone already screened there). */
  const housemates = (cluster, exceptId) => db.participants.filter((x) => x.cluster === cluster && x.id !== exceptId && x.status !== 'screen_fail' && x.status !== 'declined').sort((a, b) => a.name.localeCompare(b.name));
  const houseLabel = (x) => `${x.name} (${pLabel(x)}${x.household ? ', ' + x.household : ''})`;

  function screenInitial() {
    const p = S.pid && part(S.pid);
    if (p && p.status === 'screening') {
      if (p.wiz === 'eligibility') return eligibilityStep(p);
      if (p.wiz === 'consent') return consentStep(p);
    }
    const d = S.idDraft || (S.idDraft = blankId());
    const inProgress = db.participants.filter((x) => x.status === 'screening' && isMine(x));
    const dup = d.name.trim().length > 3 ? db.participants.filter((x) => x.name.toLowerCase().includes(d.name.trim().toLowerCase().split(/\s+/).pop()) && (!d.cluster || x.cluster === d.cluster)) : [];
    const ok = d.name.trim() && d.sex && d.cluster && (d.dobMode === 'dob' ? d.dob : d.age);
    return `<div class="page narrow">
      ${stepsHtml('identify')}
      ${inProgress.length ? `<div class="card"><div class="card-head"><h3>Screenings in progress</h3></div><div class="rows">${inProgress.map((x) => `
        <div class="row click" data-action="resume-screening" data-pid="${x.id}"><div class="who"><strong>${esc(x.name)}</strong><span class="meta">${esc(x.screeningNo)} · ${esc(clusterOf(x).name)} · started ${esc(D.fmt(x.screenedAt))}</span></div><span class="tag screening">${esc((STEPS.find(([id]) => id === x.wiz) || [])[1] || '')}</span></div>`).join('')}</div></div>` : ''}
      <div class="card">
        <div class="card-head"><h3>New person</h3><span class="muted small">Screening number is given when you continue</span></div>
        <div class="form-grid">
          <label><span class="lbl">Full name</span><input class="input" id="id-name" data-input="id" data-k="name" value="${esc(d.name)}" autocomplete="off"></label>
          <div><span class="lbl">Sex</span><div class="chips">${[['F', 'Female'], ['M', 'Male']].map(([k, l]) => `<button class="chip ${d.sex === k ? 'on' : ''}" data-action="id-set" data-k="sex" data-v="${k}">${l}</button>`).join('')}</div></div>
          <div><span class="lbl">Age</span><div class="chips" style="margin-bottom:6px">${[['dob', 'Date of birth'], ['age', 'Age in years']].map(([k, l]) => `<button class="chip ${d.dobMode === k ? 'on' : ''}" data-action="id-set" data-k="dobMode" data-v="${k}">${l}</button>`).join('')}</div>
            ${d.dobMode === 'dob' ? `<input class="input" type="date" id="id-dob" data-input="id" data-k="dob" value="${esc(d.dob)}" max="${D.today()}">` : `<input class="input" id="id-age" inputmode="numeric" data-input="id" data-k="age" value="${esc(d.age)}" placeholder="Years">`}</div>
          <label><span class="lbl">Cluster</span><select class="input" id="id-cluster" data-change="id" data-k="cluster"><option value="">Choose…</option>${P.clusters.filter((c) => myClusters().includes(c.id)).map((c) => `<option value="${c.id}" ${d.cluster === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
          <label><span class="lbl">Phone (optional)</span><input class="input" id="id-phone" inputmode="tel" data-input="id" data-k="phone" value="${esc(d.phone)}"></label>
          <label><span class="lbl">Language for consent</span><select class="input" id="id-lang" data-change="id" data-k="language">${P.languages.map((l) => `<option ${d.language === l ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
          <label><span class="lbl">Household</span><select class="input" id="id-house" data-change="id" data-k="houseWith" ${d.cluster ? '' : 'disabled'}>
            <option value="">New household</option>${d.cluster ? housemates(d.cluster).map((x) => `<option value="${x.id}" ${d.houseWith === x.id ? 'selected' : ''}>Same household as ${esc(houseLabel(x))}</option>`).join('') : ''}</select></label>
        </div>
        ${dup.length ? `<div class="alert warn" style="margin-top:12px">${icon('alert')}<div><strong>Already screened?</strong>${dup.map((x) => `${esc(x.name)} (${esc(pLabel(x))}, ${esc(clusterOf(x).name)}, ${esc(STATUS_TEXT[x.status])})`).join('; ')}. Check before screening again.</div></div>` : ''}
        <div class="btn-row end" style="margin-top:14px"><button class="btn primary" data-action="start-screening" ${ok ? '' : 'disabled'}>Continue to eligibility</button></div>
      </div></div>`;
  }

  function eligibilityStep(p) {
    const a = p.screening.answers;
    const ctx = RS.ctxFor(p);
    const el = RS.eligibility(P, a, ctx);
    const fields = RS.screeningFields(P, a, ctx);
    const d = RS.derive(P, a, ctx);
    return `<div class="page narrow">${stepsHtml('eligibility')}
      <div class="card"><div class="card-head"><h3>${esc(p.name)} · ${esc(p.screeningNo)}</h3><span class="muted small">${esc(ageText(p))} · ${p.sex === 'F' ? 'Female' : 'Male'} · ${esc(clusterOf(p).name)}</span></div>
        ${fields.map((f) => fieldHtml(f, a, { mode: 'screen' })).join('')}
      </div>
      <div class="card"><div class="card-head"><h3>Eligibility (protocol Table 6.1)</h3>${el.eligible === true ? '<span class="tag ok">Eligible</span>' : el.eligible === false ? '<span class="tag failed">Not eligible</span>' : '<span class="tag unknown">Answer all questions</span>'}</div>
        ${el.rows.map((r) => `<div class="crit"><span class="tag ${r.state}">${r.state === 'met' ? 'Met' : r.state === 'failed' ? 'Not met' : '…'}</span><div>${r.c.kind === 'exclude' ? '<span class="muted small">Exclusion · </span>' : ''}${esc(r.c.text)}</div></div>`).join('')}
        <p class="small muted">Cohorts: diabetes ${d.cohort_dm === 'yes' ? '<b>yes</b>' : 'no'} · hypertension ${d.cohort_htn === 'yes' ? '<b>yes</b>' : 'no'}${a.cv_risk_high === 'yes' ? ' · high CV risk <b>yes</b>' : ''}</p>
        ${a.emergency_now === 'yes' ? `<div class="alert urgent">${icon('alert')}<div><strong>Refer now</strong>Emergency at screening: follow the emergency pathway (Table 15.1). The person can be screened again once stable.</div></div>` : ''}
        <div class="btn-row end" style="margin-top:12px">
          <button class="btn" data-action="screen-fail" ${el.eligible === false ? '' : 'disabled'}>Record screen failure</button>
          <button class="btn primary" data-action="to-consent" ${el.eligible === true ? '' : 'disabled'}>Eligible: continue to consent</button>
        </div></div></div>`;
  }

  function consentStep(p) {
    const C = P.consent;
    const c = p.consentDraft || (p.consentDraft = { read: false, checks: {}, options: Object.fromEntries(C.options.map((o) => [o.id, !!o.default && !o.requiresApproval])), method: '', witness: '', copyGiven: false, language: p.language });
    const checksOk = C.checks.every((q) => c.checks[q.id] === q.answer);
    // "Chosen at enrolment": the collector picks the arm (with a reason) before consent completes.
    const choose = P.assignment && P.assignment.method === 'chosen' && P.arms.length > 1;
    const ok = c.read && checksOk && c.method && (c.method !== 'thumbprint' || c.witness.trim()) && c.copyGiven && (!choose || (c.arm && (c.armReason || '').trim()));
    return `<div class="page narrow">${stepsHtml('consent')}
      <div class="card"><div class="card-head"><h3>Information sheet</h3><span class="tag">${esc(C.version)}</span></div>
        <p class="small muted">${esc(C.language)}. ${esc(C.method)}.</p>
        ${C.sections.map((s) => `<div class="consent-sec"><h4>${esc(s.title)}</h4><p>${esc(s.text)}</p></div>`).join('')}
        <label class="check"><input type="checkbox" data-action="consent-set" data-k="read" ${c.read ? 'checked' : ''}><span>I read or explained every section in <b>${esc(c.language)}</b> and answered the person's questions. They had time to decide and to talk privately if they wished.</span></label>
      </div>
      <div class="card"><div class="card-head"><h3>Check understanding</h3>${checksOk ? '<span class="tag ok">All understood</span>' : ''}</div>
        ${C.checks.map((q) => `<div class="qcheck"><div style="font-weight:700;margin-bottom:6px">${esc(q.q)}</div><div class="chips">${q.options.map((o) => `<button class="chip ${c.checks[q.id] === o ? 'on' : ''}" data-action="consent-check" data-q="${q.id}" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>
          ${c.checks[q.id] && c.checks[q.id] !== q.answer ? '<div class="wrong">Explain this part again, then ask again.</div>' : ''}</div>`).join('')}
      </div>
      <div class="card"><div class="card-head"><h3>Optional parts</h3><span class="muted small">The person can say no to any of these and still take part</span></div>
        ${C.options.map((o) => {
          const locked = o.requiresApproval && !P.listeningApproved && !S.test;
          return `<label class="check ${locked ? 'disabled' : ''}"><input type="checkbox" data-action="consent-opt" data-k="${o.id}" ${c.options[o.id] ? 'checked' : ''} ${locked ? 'disabled' : ''}><span>${esc(o.text)}${o.requiresApproval && !P.listeningApproved ? `<br><span class="small muted">${S.test ? 'Test tools: enabled for the demo only.' : 'Not approved under this protocol version (needs the Layer 5 amendment).'}</span>` : ''}</span></label>`;
        }).join('')}
      </div>
      ${choose ? `<div class="card"><div class="card-head"><h3>Study arm</h3></div>
        <div class="chips" style="margin-bottom:10px">${P.arms.map((a) => `<button class="chip ${c.arm === a.id ? 'on' : ''}" data-action="consent-set" data-k="arm" data-v="${a.id}">${esc(RS.study.armLabel(P, a.id))}</button>`).join('')}</div>
        <label><span class="lbl">Why this arm</span><input class="input wide" id="c-armReason" data-input="consent" data-k="armReason" value="${esc(c.armReason || '')}"></label></div>` : ''}
      <div class="card"><div class="card-head"><h3>Signature</h3></div>
        <div class="chips" style="margin-bottom:10px">${[['signature', 'Signed'], ['thumbprint', 'Thumbprint with witness'], ['oral', 'Witnessed oral consent']].map(([k, l]) => `<button class="chip ${c.method === k ? 'on' : ''}" data-action="consent-set" data-k="method" data-v="${k}">${l}</button>`).join('')}</div>
        ${c.method === 'thumbprint' || c.method === 'oral' ? `<label><span class="lbl">Impartial witness (name)</span><input class="input" id="c-witness" data-input="consent" data-k="witness" value="${esc(c.witness)}"></label>` : ''}
        <label class="check"><input type="checkbox" data-action="consent-set" data-k="copyGiven" ${c.copyGiven ? 'checked' : ''}><span>A copy of the signed form was given to the person</span></label>
        <div class="btn-row end" style="margin-top:12px">
          <button class="btn" data-action="consent-declined">Person declined</button>
          <button class="btn primary" data-action="consent-given" ${ok && (c.method !== 'oral' || c.witness.trim()) ? '' : 'disabled'}>Consent given: start baseline</button>
        </div>
      </div></div>`;
  }

  /* ------------------------------------------------------------------ */
  /* Fields                                                              */
  /* ------------------------------------------------------------------ */
  /**
   * One field. o.mode: 'screen' (screening answers) | 'visit'. o.rec for visits (missing, heard, checks).
   */
  function fieldHtml(f, values, o) {
    const v = values[f.id];
    const r = o.rec;
    const missing = r && (r.missing || {})[f.id];
    const c = RS.checkValue(f, v);
    const showReq = r && S.tried && f.required && (v == null || v === '') && !missing;
    const dataSet = `data-field="${f.id}" data-mode="${o.mode}"`;
    let input;
    if (f.type === 'yesno' || f.type === 'choice') {
      const sug = o.heard && o.heard.value != null && (v == null || v === '') && S.listen.mode === 'suggest' ? String(o.heard.value) : null;
      input = `<div class="chips">${f.options.map(([k, l]) => `<button class="chip ${String(v) === String(k) ? 'on' : ''} ${sug === String(k) ? 'heard-sug' : ''}" data-action="set-val" ${dataSet} data-v="${esc(k)}">${esc(l)}</button>`).join('')}</div>`;
    } else if (f.type === 'text') {
      input = `<input class="input wide" id="f-${f.id}" data-input="val" ${dataSet} value="${esc(v)}" autocomplete="off">`;
    } else if (f.type === 'date') {
      input = `<input class="input" type="date" id="f-${f.id}" data-input="val" ${dataSet} value="${esc(v)}">`;
    } else {
      input = `<input class="input ${c.hard ? 'err' : c.soft ? 'warn' : ''}" id="f-${f.id}" data-input="val" ${dataSet} value="${esc(v)}" inputmode="${f.type === 'bp' ? 'text' : 'decimal'}" placeholder="${f.type === 'bp' ? '120/80' : ''}" autocomplete="off">${f.unit ? `<span class="unit">${esc(f.unit)}</span>` : ''}`;
    }
    let heard = '';
    if (o.heard && o.heard.value != null) {
      const h = o.heard;
      const hv = esc(fmtValue(f, h.value));
      const q = S.test && h.quote ? `<div class="q">“${esc(h.quote)}”</div>` : '';
      if (v == null || v === '') {
        if (S.listen.mode === 'suggest') heard = `<div class="heard-box">${icon('ear')}<div>Heard: <b>${hv}</b>${h.uncertain ? ' <span class="tag warn">said with doubt</span>' : ''}</div>${q}<div class="btn-row"><button class="btn sm heard" data-action="use-heard" ${dataSet}>Use</button></div></div>`;
      } else if (!RS.agrees(f, v, h.value)) {
        const done = r && (r.checks || {})[f.id];
        heard = done ? `<div class="fld-msg muted">${icon('ear')} Re-checked: kept ${esc(fmtValue(f, v))} (heard ${hv})</div>`
          : `<div class="heard-box differs"><div><b>Check this answer.</b> Heard <b>${hv}</b>, entered <b>${esc(fmtValue(f, v))}</b>.</div>${q}<div class="btn-row"><button class="btn sm" data-action="keep-entered" ${dataSet}>Keep ${esc(fmtValue(f, v))}</button><button class="btn sm heard" data-action="use-heard" ${dataSet}>Use ${hv}</button></div></div>`;
      } else if (S.test) heard = `<div class="fld-msg" style="color:var(--heard)">${icon('ear')} Matches what was heard</div>`;
    }
    const missRow = r && f.required ? (missing
      ? `<div class="missing-row"><span class="tag warn">Missing: ${esc(missing)}</span><button class="btn link" data-action="unmiss" data-field="${f.id}">Undo</button></div>`
      : S.missingOpen === f.id ? `<div class="missing-row"><span class="muted">Why is it missing?</span>${P.missingReasons.map((m) => `<button class="chip" data-action="set-missing" data-field="${f.id}" data-v="${esc(m)}">${esc(m)}</button>`).join('')}<button class="btn link" data-action="missing-cancel">Cancel</button></div>`
      : (v == null || v === '') ? `<div class="missing-row"><button class="btn link" data-action="missing-open" data-field="${f.id}">Can't get this?</button></div>` : '') : '';
    return `<div class="fld" id="fld-${f.id}">
      <div class="fld-label">${esc(f.label)}${f.required && o.mode === 'visit' ? '<span class="req">*</span>' : ''}</div>
      ${f.help ? `<div class="fld-help">${esc(f.help)}</div>` : ''}
      <div class="fld-input">${input}</div>
      ${c.hard ? `<div class="fld-msg err">${esc(c.hard)}</div>` : c.soft ? `<div class="fld-msg warn">${esc(c.soft)} If it is correct, it goes to the supervisor as a data query.</div>` : ''}
      ${showReq ? '<div class="fld-msg err">Required: enter a value or say why it is missing.</div>' : ''}
      ${heard}${missRow}
    </div>`;
  }
  const parseVal = (f, raw) => {
    if (f.type === 'number') { const t = String(raw).trim().replace(',', '.'); return t === '' ? '' : /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : t; }
    if (f.type === 'bp') return String(raw).replace(/\s*(over|\\)\s*/i, '/').trim();
    return raw;
  };

  /* ------------------------------------------------------------------ */
  /* Visit form                                                          */
  /* ------------------------------------------------------------------ */
  const listeningAllowed = (p) => !!(p.consent && p.consent.options.audio) && (P.listeningApproved || S.test);
  function heardFor(r, sections) {
    if (S.listen.recId !== r.id || !S.listen.text.trim()) return {};
    const fields = sections.filter((s) => !s.form.noListening).flatMap((s) => s.fields);
    return RS.listen(S.listen.text, fields);
  }

  function screenVisit() {
    const r = rec(S.recId);
    if (!r || r.status !== 'draft') return screenVisitView();
    const p = part(r.participantId);
    const vd = visitDef(r.visit);
    const ctx = ctxOf(r);
    const sections = RS.visitSections(P, vd, r.values, ctx);
    const canListen = listeningAllowed(p);
    const heard = canListen ? heardFor(r, sections) : {};
    // keep what was heard on the record (values only) so completion can check it; quotes stay in memory
    r.heard = Object.fromEntries(Object.entries(heard).map(([k, h]) => [k, { value: h.value }]));
    const val = RS.validateVisit(P, vd, r, ctx);
    const probs = new Set(val.errors.concat(val.disagreements).map((e) => e.field));
    const safety = RS.safety(P, r.values, ctx);
    const derived = RS.derive(P, r.values, ctx);
    const inWizard = p.status === 'screening';
    const w = p.enrolledAt ? RS.visitWindow(p, vd) : null;
    const secDone = (s) => s.fields.every((f) => !f.required || (r.values[f.id] != null && r.values[f.id] !== '') || (r.missing || {})[f.id]);
    return `<div class="page">
      ${inWizard ? stepsHtml('baseline') : crumbs(p)}
      <div class="card"><div class="p-head"><div class="avatar">${esc(initials(p.name))}</div><div style="flex:1">
        <h2>${esc(vd.label)} <span class="tag due">In progress</span>${r.deviation ? '<span class="tag missed">Out of window</span>' : ''}</h2>
        <div class="facts"><span><b>${esc(p.name)}</b> · ${esc(pLabel(p))}</span><span>${esc(ageText(p))} · ${p.sex === 'F' ? 'Female' : 'Male'}</span><span>${esc(clusterOf(p).name)}</span>${w ? `<span>Window ${esc(RS.rangeText(w))}</span>` : ''}</div>
        ${r.deviation ? `<p class="small">Protocol deviation recorded: <b>${esc(r.deviation.category)}</b>${r.deviation.note ? ' · ' + esc(r.deviation.note) : ''}</p>` : ''}
        ${!canListen ? `<p class="small muted">${icon('lock')} Listening off: ${!(p.consent && p.consent.options.audio) ? 'the participant did not agree to it' : 'not approved under this protocol version'}.</p>` : ''}
      </div></div></div>
      ${alertsHtml(safety)}
      <div class="visit-layout ${canListen ? '' : 'solo'}">
        <div>
          <div class="form-nav">${sections.map((s) => `<button class="${probs.size && s.fields.some((f) => probs.has(f.id)) && S.tried ? 'problem' : secDone(s) ? 'complete' : ''}" data-action="goto" data-target="sec-${s.form.id}">${secDone(s) ? '✓ ' : ''}${esc(s.form.title)}</button>`).join('')}</div>
          ${sections.map((s) => `<div class="card fsec" id="sec-${s.form.id}">
            <h3>${esc(s.form.title)}${s.form.sensitive ? `<span class="tag report">${icon('lock')}Sensitive</span>` : ''}${s.form.noListening && canListen ? '<span class="tag">Not listened to</span>' : ''}</h3>
            ${s.form.source ? `<div class="src">${esc(s.form.source)}</div>` : ''}
            ${s.form.intro ? `<div class="intro">${esc(s.form.intro)}</div>` : ''}
            ${s.fields.map((f) => fieldHtml(f, r.values, { mode: 'visit', rec: r, heard: heard[f.id] })).join('')}
          </div>`).join('')}
          ${derivedCard(derived, r.values)}
          <div class="visit-foot">
            <button class="btn" data-action="save-draft">Save and close</button>
            <button class="btn primary" data-action="complete-visit">${inWizard ? 'Review and enrol' : 'Complete visit'}</button>
          </div>
        </div>
        ${canListen ? listenPanel(r, heard, val) : ''}
      </div></div>`;
  }
  function derivedCard(d, values) {
    const shown = P.derived.filter((x) => d[x.id] != null && !/^cohort_/.test(x.id));
    if (!shown.length) return '';
    return `<div class="card"><h3>Calculated</h3><div class="derived" style="margin-top:8px">${shown.map((x) => `<div><span>${esc(x.label)}</span><b>${esc(d[x.id])}${x.unit && typeof d[x.id] === 'number' ? ' ' + esc(x.unit) : ''}</b></div>`).join('')}</div></div>`;
  }
  function listenPanel(r, heard, val) {
    const L = S.listen;
    const n = Object.keys(heard).length;
    const on = L.recording && L.recId === r.id;
    return `<aside class="card listen">
      <div class="card-head"><h3>${icon('ear')} Listening</h3>${on ? '<span class="tag urgent">On</span>' : ''}</div>
      <div class="tabs" style="width:100%">${[['check', 'Check only'], ['suggest', 'Suggest']].map(([k, l]) => `<button class="${L.mode === k ? 'on' : ''}" data-action="listen-mode" data-v="${k}">${l}</button>`).join('')}</div>
      <p class="small muted">${L.mode === 'check' ? 'Silent. You enter every answer; if one differs from what was said, you are asked to check it.' : 'Answers heard in the conversation are offered on empty questions. You confirm each one.'}</p>
      <button class="btn mic ${on ? 'on' : ''}" data-action="toggle-mic">${icon('mic')} ${on ? 'Stop listening' : 'Start listening'}</button>
      <p class="stat">${n ? `${n} answer${n === 1 ? '' : 's'} heard` : 'Nothing heard yet'}${val.disagreements.length ? ` · <b style="color:var(--amber)">${val.disagreements.length} to check</b>` : ''}</p>
      <p class="small muted">Sound is not recorded. The words stay in memory until this visit is closed. Sensitive sections (mood, anxiety) are never listened to.</p>
      ${S.test ? `<div style="display:grid;gap:6px;margin-top:8px"><span class="lbl">Test tools: conversation</span>
        <textarea class="input" id="transcript" data-input="transcript" placeholder="Speech appears here. You can also type or paste.">${esc(L.recId === r.id ? L.text : '')}</textarea>
        ${L.interim ? `<div class="small muted">… ${esc(L.interim)}</div>` : ''}
        <select class="input sm" data-change="demo-talk"><option value="">Insert a demo conversation…</option>${RS.DEMO_TALK.map((t, i) => `<option value="${i}">${esc(t.label)}</option>`).join('')}</select></div>` : ''}
    </aside>`;
  }

  /* ---------- Speech (Web Speech API; works in Chrome/Edge) ---------- */
  let recog = null;
  function startMic(r) {
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    S.listen.recId = r.id;
    if (!R) { toast('Speech-to-text is not available in this browser. With Test tools on you can type or paste instead.'); return; }
    S.listen.recording = true;
    recog = new R();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = 'en-GB';
    recog.onresult = (ev) => {
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript.trim();
        if (!t) continue;
        if (ev.results[i].isFinal) S.listen.text += (S.listen.text && !/\s$/.test(S.listen.text) ? '\n' : '') + t.charAt(0).toUpperCase() + t.slice(1) + '.';
        else interim += t + ' ';
      }
      S.listen.interim = interim.trim();
      render();
    };
    recog.onend = () => { if (S.listen.recording) { try { recog.start(); } catch (e) { S.listen.recording = false; render(); } } };
    recog.onerror = (e) => { if (e.error === 'not-allowed') { S.listen.recording = false; toast('Microphone permission was refused.'); render(); } };
    try { recog.start(); } catch (e) { S.listen.recording = false; }
  }
  function stopMic() {
    S.listen.recording = false;
    S.listen.interim = '';
    if (recog) { try { recog.stop(); } catch (e) { /* already stopped */ } recog = null; }
  }

  /* ------------------------------------------------------------------ */
  /* Visit record (read-only)                                            */
  /* ------------------------------------------------------------------ */
  function screenVisitView() {
    const r = rec(S.recId);
    if (!r) return screenRecords();
    const p = part(r.participantId);
    const vd = visitDef(r.visit);
    const ctx = ctxOf(r);
    const sections = RS.visitSections(P, vd, r.values, ctx);
    const qs = db.queries.filter((q) => q.visitRecId === r.id);
    const w = RS.visitWindow(p, vd);
    const inWin = r.date >= w.start && r.date <= w.end;
    const audits = db.audit.filter((a) => a.visitRecId === r.id);
    const checked = Object.entries(r.checkLog || {});
    return `<div class="page">${crumbs(p)}
      <div class="card"><div class="p-head"><div style="flex:1">
        <h2>${esc(vd.label)} <span class="tag done">Completed</span>${inWin ? '' : '<span class="tag missed">Out of window</span>'}${r.reviewed ? `<span class="tag sup">Reviewed by ${esc(r.reviewed.by)}</span>` : ''}</h2>
        <div class="facts"><span>${esc(D.fmtLong(r.date))}</span><span>By <b>${esc(r.collector)}</b></span><span>Protocol ${esc(r.protocolVersion)}</span><span>Window ${esc(RS.rangeText(w))}</span>
          <span>Listening: ${r.listening && r.listening !== 'off' ? esc(r.listening === 'check' ? 'check only' : 'suggest') + (checked.length ? `, ${checked.length} answer${checked.length === 1 ? '' : 's'} re-checked` : '') : 'off'}</span></div>
        ${r.deviation ? `<p class="small">Protocol deviation: <b>${esc(r.deviation.category)}</b>${r.deviation.note ? ' · ' + esc(r.deviation.note) : ''}</p>` : ''}
        <p class="small muted">${icon('lock')} Completed visits can't be edited. ${isSup() ? 'Use Correct (with a reason) or raise a query.' : 'If something is wrong, tell the supervisor; they correct it with a reason.'}</p>
      </div>
      ${isSup() && !r.reviewed ? `<button class="btn primary" data-action="mark-reviewed" data-rec="${r.id}">${icon('check')} Mark reviewed</button>` : ''}
      </div></div>
      ${alertsHtml(r.safety.map((s) => ({ rule: { level: s.level, source: '' }, text: s.text, action: s.action })), true)}
      ${sections.map((s) => {
        const hide = s.form.sensitive && !S.showSensitive[r.id + s.form.id];
        return `<div class="card fsec"><h3>${esc(s.form.title)}${s.form.sensitive ? `<span class="tag report">${icon('lock')}Sensitive</span>` : ''}</h3>
          ${hide ? `<div class="sensitive-cover"><span>Mental health answers are hidden by default.</span><button class="btn sm" data-action="show-sensitive" data-k="${r.id + s.form.id}">Show</button></div>` : `
          <table class="tbl"><tbody>${s.fields.map((f) => {
            const fq = qs.filter((q) => q.field === f.id);
            const miss = (r.missing || {})[f.id];
            const chk = (r.checkLog || {})[f.id];
            return `<tr><td style="width:46%">${esc(f.label)}</td><td><b>${esc(fmtValue(f, r.values[f.id]))}</b>${miss ? `<span class="tag warn">Missing: ${esc(miss)}</span>` : ''}${chk ? ` <span class="tag heard" title="Heard ${esc(chk.heard)}">${icon('ear')} re-checked</span>` : ''}
              ${fq.map((q) => queryHtml(q)).join('')}</td>
              <td style="width:1%;white-space:nowrap">${isSup() ? `<button class="btn sm ghost" data-action="raise-query" data-rec="${r.id}" data-field="${f.id}">Query</button> <button class="btn sm ghost" data-action="correct" data-rec="${r.id}" data-field="${f.id}">Correct</button>` : ''}</td></tr>`;
          }).join('')}</tbody></table>`}</div>`;
      }).join('')}
      ${referralsCard(db.referrals.filter((x) => x.visitRecId === r.id), 'Referrals from this visit')}
      ${derivedCard(RS.derive(P, r.values, ctx), r.values)}
      ${audits.length ? `<div class="card"><h3>Changes after completion</h3><table class="tbl"><tbody>${audits.map(auditRow).join('')}</tbody></table></div>` : ''}
    </div>`;
  }
  const REF_STATUS = { open: ['Waiting for outcome', 'pending'], seen: ['Seen', 'ok'], not_attended: ['Did not go', 'missed'] };
  function referralsCard(refs, title) {
    if (!refs.length) return '';
    return `<div class="card"><h3>${esc(title)}</h3><div class="rows" style="margin-top:8px">${refs.map((x) => {
      const [st, tone] = REF_STATUS[x.status];
      const days = D.between(x.createdAt.slice(0, 10), D.today());
      return `<div class="msg"><div class="msg-head"><span><span class="tag ${x.urgency === 'urgent' ? 'urgent' : 'soon'}">${x.urgency === 'urgent' ? 'Urgent' : 'Within a week'}</span> <b>${esc(RS.referralSite(P, x.to).name)}</b></span>
          <span><span class="tag ${tone}">${st}</span> <span class="small muted">${esc(D.fmt(x.createdAt.slice(0, 10)))}${x.status === 'open' ? ` · ${days} day${days === 1 ? '' : 's'} ago` : ''}</span></span></div>
        <div class="small">${x.reasons.map((y) => esc(y.text)).join('<br>')}</div>
        ${x.outcome ? `<div class="small"><b>Outcome</b> (${esc(D.fmt(x.outcome.date))}): ${esc(x.outcome.text)}</div>` : ''}
        <div class="btn-row"><button class="btn sm" data-action="view-handoff" data-ref="${x.id}">${icon('printer')} Handoff</button>${!isSup() && x.status === 'open' ? `<button class="btn sm primary" data-action="referral-outcome" data-ref="${x.id}">Record outcome</button>` : ''}</div></div>`;
    }).join('')}</div></div>`;
  }
  const auditRow = (a) => { const f = P.fields[a.field]; return `<tr><td>${esc(fmtDT(a.at))}</td><td>${esc(a.by)}</td><td>${a.field ? `${esc(f ? f.label : a.field)}: <s>${esc(fmtValue(f, a.from))}</s> → <b>${esc(fmtValue(f, a.to))}</b>` : esc(a.what || '')}${a.armId ? `: <b>${esc(armShownId(a.armId))}</b>` : ''}</td><td class="muted">${esc(a.reason || '')}</td></tr>`; };
  function queryHtml(q) {
    return `<div class="thread" style="margin-top:6px"><div><span class="tag ${q.status}">Query · ${esc(q.status)}</span> <b>${esc(q.by)}</b> ${esc(fmtDT(q.raisedAt))}<br>${esc(q.text)}</div>
      ${q.thread.map((t) => `<div><b>${esc(t.by)}</b> ${esc(fmtDT(t.at))}<br>${esc(t.text)}</div>`).join('')}
      <div class="btn-row">${q.status === 'open' && !isSup() ? `<button class="btn sm" data-action="answer-query" data-q="${q.id}">Answer</button>` : ''}
        ${isSup() && q.status !== 'closed' ? `<button class="btn sm" data-action="close-query" data-q="${q.id}">Close</button>${q.status === 'answered' ? `<button class="btn sm ghost" data-action="reopen-query" data-q="${q.id}">Ask again</button>` : ''}` : ''}</div></div>`;
  }

  /* ------------------------------------------------------------------ */
  /* Participant records                                                 */
  /* ------------------------------------------------------------------ */
  function screenRecords() {
    const q = S.q.trim().toLowerCase();
    const counts = {};
    if (isSup() && S.recCluster === 'mine') S.recCluster = 'all';
    const inCluster = (p) => (S.recCluster === 'mine' ? isMine(p) : S.recCluster === 'all' || p.cluster === S.recCluster);
    const scoped = db.participants.filter(inCluster);
    scoped.forEach((p) => { counts[p.status] = (counts[p.status] || 0) + 1; });
    const list = scoped.filter((p) => (S.recFilter === 'all' || p.status === S.recFilter || (S.recFilter === 'screen_fail' && p.status === 'declined')) && (!q || [p.name, p.studyId, p.screeningNo, clusterOf(p).name, p.phone, p.household].some((x) => String(x || '').toLowerCase().includes(q))));
    const myQs = openQueries();
    return `<div class="page">
      <div class="btn-row" style="margin-bottom:10px"><select class="input sm" style="max-width:260px" data-change="rec-cluster" aria-label="Clusters">
        ${isSup() ? '' : `<option value="mine" ${S.recCluster === 'mine' ? 'selected' : ''}>My clusters</option>`}<option value="all" ${S.recCluster === 'all' || (isSup() && S.recCluster === 'mine') ? 'selected' : ''}>All clusters</option>
        ${P.clusters.map((c) => `<option value="${c.id}" ${S.recCluster === c.id ? 'selected' : ''}>${esc(c.name)} (${esc(collectorName(c.id))})</option>`).join('')}</select></div>
      ${!isSup() && myQs.length ? `<div class="alert warn">${icon('alert')}<div><strong>${myQs.length} data quer${myQs.length === 1 ? 'y' : 'ies'} to answer</strong>${myQs.map((x) => { const p = part(x.participantId); return `<button class="btn link" data-action="open-rec" data-rec="${x.visitRecId}">${esc(pLabel(p))} · ${esc((P.fields[x.field] || {}).label || x.field)}</button>`; }).join(' · ')}</div></div>` : ''}
      <div class="search">${icon('search')}<input class="input" id="rec-q" data-input="q" value="${esc(S.q)}" placeholder="Search by name, study ID, cluster or phone"></div>
      <div class="tabs">${[['enrolled', 'Enrolled'], ['screening', 'Screening'], ['screen_fail', 'Not enrolled'], ['withdrawn', 'Withdrawn'], ['all', 'All']].map(([k, l]) => `<button class="${S.recFilter === k ? 'on' : ''}" data-action="rec-filter" data-v="${k}">${l} ${k === 'all' ? scoped.length : k === 'screen_fail' ? (counts.screen_fail || 0) + (counts.declined || 0) : counts[k] || 0}</button>`).join('')}</div>
      <div class="card tbl-wrap"><table class="tbl"><thead><tr><th>ID</th><th>Name</th><th>Cluster</th><th>Status</th><th>Next visit</th><th></th></tr></thead><tbody>
        ${list.map((p) => {
          const nx = p.status === 'enrolled' ? RS.nextVisit(db, P, p) : null;
          const missed = p.status === 'enrolled' && RS.visitsFor(P, p).some((v) => RS.visitStatus(db, p, v) === 'missed');
          const nq = db.queries.filter((x) => x.participantId === p.id && x.status !== 'closed').length;
          return `<tr class="click" data-action="open-participant" data-pid="${p.id}"><td class="mono">${esc(pLabel(p))}</td><td><b>${esc(p.name)}</b><div class="small muted">${esc(ageText(p))} · ${p.sex === 'F' ? 'F' : 'M'}</div></td><td>${esc(clusterOf(p).name)}<div class="small muted">${esc(armText(p))}</div></td><td>${statusTag(p)}</td>
            <td>${nx ? `${esc(nx.visit.label)}<div class="small ${nx.status === 'due' ? '' : 'muted'}">${esc(RS.windowText(nx.status, nx.window))}</div>` : ''}${missed ? '<span class="tag missed">Missed visit</span>' : ''}</td>
            <td>${nq ? `<span class="tag warn">${nq} quer${nq === 1 ? 'y' : 'ies'}</span>` : ''}</td></tr>`;
        }).join('') || '<tr><td colspan="6" class="empty">No one matches.</td></tr>'}
      </tbody></table></div></div>`;
  }

  function trendSvg(points) {
    if (points.length < 1) return '';
    const W = 560, H = 150, pad = { l: 34, r: 10, t: 10, b: 22 };
    const ys = points.flatMap((x) => [x.s, x.d]);
    const lo = Math.min(60, ...ys) - 5, hi = Math.max(180, ...ys) + 5;
    const X = (i) => pad.l + (points.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (points.length - 1));
    const Y = (v) => pad.t + ((hi - v) * (H - pad.t - pad.b)) / (hi - lo);
    const line = (k, col) => `<polyline fill="none" stroke="${col}" stroke-width="2.5" points="${points.map((x, i) => `${X(i)},${Y(x[k])}`).join(' ')}"/>${points.map((x, i) => `<circle cx="${X(i)}" cy="${Y(x[k])}" r="4" fill="${col}"><title>${x.label}: ${x.s}/${x.d}</title></circle>`).join('')}`;
    return `<svg class="trend" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Blood pressure by visit">
      ${[140, 90].map((g) => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${Y(g)}" y2="${Y(g)}" stroke="#e0a3a3" stroke-dasharray="4 4"/><text x="2" y="${Y(g) + 4}">${g}</text>`).join('')}
      ${line('s', '#1d4f91')}${line('d', '#7b3f8f')}
      ${points.map((x, i) => `<text x="${X(i)}" y="${H - 6}" text-anchor="middle">${esc(x.short)}</text>`).join('')}
    </svg>`;
  }

  function screenParticipant() {
    const p = part(S.pid);
    if (!p) return screenRecords();
    const c = clusterOf(p);
    const recs = db.visits.filter((r) => r.participantId === p.id);
    const done = recs.filter((r) => r.status === 'complete').sort((a, b) => a.date.localeCompare(b.date));
    const pts = done.map((r) => ({ r, d: RS.derive(P, r.values, ctxOf(r)) })).filter((x) => x.d.sys_mean != null)
      .map((x) => ({ s: x.d.sys_mean, d: x.d.dia_mean, label: visitDef(x.r.visit).label, short: x.r.visit === 'baseline' ? 'BL' : x.r.visit.toUpperCase() }));
    const a1c = done.filter((r) => r.values.hba1c != null);
    const qs = db.queries.filter((q) => q.participantId === p.id);
    const evs = db.events.filter((e) => e.participantId === p.id);
    const msgs = db.messages.filter((m) => m.status === 'sent' && m.recipients.some((x) => x.participantId === p.id));
    const audits = db.audit.filter((a) => a.participantId === p.id && !a.visitRecId);
    const opts = p.consent ? P.consent.options.map((o) => `<span class="tag ${p.consent.options[o.id] ? 'ok' : ''}" title="${esc(o.text)}">${p.consent.options[o.id] ? '✓' : '✗'} ${esc({ contact: 'Contact', records: 'Records', cmh: 'Mental health', qual: 'Interview', pgd: 'Home log', future: 'Future use', audio: 'Listening' }[o.id] || o.id)}</span>`).join('') : '';
    return `<div class="page">
      <div class="card"><div class="p-head"><div class="avatar">${esc(initials(p.name))}</div><div style="flex:1;min-width:240px">
        <h2>${esc(p.name)} ${statusTag(p)}</h2>
        <div class="facts"><span class="mono">${esc(pLabel(p))}</span><span>${esc(ageText(p))} · ${p.sex === 'F' ? 'Female' : 'Male'}</span><span>${esc([c.name, armText(p)].filter(Boolean).join(' · '))}</span>${p.phone ? `<span>${icon('phone')} ${esc(p.phone)}</span>` : '<span>No phone</span>'}<span>${esc(p.language || '')}</span></div>
        ${p.enrolledAt ? `<div class="facts"><span>Enrolled <b>${esc(D.fmtLong(p.enrolledAt))}</b> by ${esc(p.enrolledBy)}</span><span>Consent: ${esc(p.consent.version)} (${esc(p.consent.method)}${p.consent.witness ? ', witness ' + esc(p.consent.witness) : ''})</span></div>` : ''}
        ${p.withdrawal ? `<div class="facts"><span>Withdrew <b>${esc(D.fmtLong(p.withdrawal.date))}</b>: ${esc(p.withdrawal.reason)} · ${esc(p.withdrawal.dataUse)}</span></div>` : ''}
        ${p.screenFail ? `<div class="facts"><span>Not enrolled: ${esc(p.screenFail.join('; '))}</span></div>` : ''}
        <div class="facts"><span>${icon('house')} Household <b>${esc(p.household || 'not recorded')}</b>${RS.householdMembers(db, p).length ? `: also ${RS.householdMembers(db, p).map((x) => `<button class="btn link" data-action="open-participant" data-pid="${x.id}">${esc(x.name)}</button> (${esc(STATUS_TEXT[x.status])})`).join(', ')}` : ''}</span><span>Data collector: ${esc(collectorName(p.cluster))}</span></div>
        ${opts ? `<div class="consent-icons">${opts}</div>` : ''}
      </div>
      ${isSup() ? '' : `<div class="btn-row">
        ${p.status === 'screening' ? `<button class="btn primary" data-action="resume-screening" data-pid="${p.id}">Continue screening</button>` : ''}
        ${RS.canText(p) ? `<button class="btn" data-action="compose-to" data-pid="${p.id}">${icon('message')} Message</button>` : ''}
        <button class="btn" data-action="household" data-pid="${p.id}">${icon('house')} Household</button>
        ${p.status === 'enrolled' ? `<button class="btn" data-action="consent-change" data-pid="${p.id}">Optional parts</button><button class="btn ghost" data-action="withdraw" data-pid="${p.id}">Withdraw</button>` : ''}
      </div>`}</div></div>
      ${p.status === 'enrolled' || p.status === 'withdrawn' ? `<div class="card"><div class="card-head"><h3>Visits</h3><span class="muted small">Windows are counted from enrolment, so a late visit doesn't move the next one</span></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Visit</th><th>Window</th><th>Status</th><th>Done</th><th>BP</th>${a1c.length ? '<th>HbA1c</th>' : ''}<th></th></tr></thead><tbody>
        ${RS.visitsFor(P, p).map((v) => {
          const st = RS.visitStatus(db, p, v);
          const w = RS.visitWindow(p, v);
          const r = RS.doneRec(db, p.id, v.id);
          const draft = RS.draftRec(db, p.id, v.id);
          const d = r ? RS.derive(P, r.values, ctxOf(r)) : {};
          const nq = r ? db.queries.filter((q) => q.visitRecId === r.id && q.status !== 'closed').length : 0;
          let act = '';
          if (r) act = `<button class="btn sm" data-action="open-rec" data-rec="${r.id}">View</button>`;
          else if (draft) act = isSup() ? '<span class="tag due">In progress</span>' : `<button class="btn sm primary" data-action="open-rec" data-rec="${draft.id}">Continue</button>`;
          else if (RS.canStart(db, p, v) && !isSup()) act = `<button class="btn sm ${st === 'due' ? 'primary' : ''}" data-action="start-visit" data-pid="${p.id}" data-visit="${v.id}">Start${st === 'missed' ? ' (late)' : ''}</button>`;
          return `<tr><td><b>${esc(v.label)}</b></td><td class="small">${esc(RS.rangeText(w))}</td><td><span class="tag ${st}">${VSTATUS[st]}</span>${st !== 'done' && st !== 'stopped' ? `<div class="small muted">${esc(RS.windowText(st, w))}</div>` : ''}</td>
            <td class="small">${r ? esc(D.fmt(r.date)) : ''}${nq ? ` <span class="tag warn">${nq} query</span>` : ''}${r && r.safety && r.safety.length ? ` <span class="tag ${r.safety[0].level}">${r.safety.length} flag${r.safety.length === 1 ? '' : 's'}</span>` : ''}</td>
            <td>${d.sys_mean != null ? `${d.sys_mean}/${d.dia_mean}` : ''}</td>${a1c.length ? `<td>${r && r.values.hba1c != null ? r.values.hba1c + '%' : ''}</td>` : ''}<td>${act}</td></tr>`;
        }).join('')}</tbody></table></div></div>` : ''}
      ${pts.length ? `<div class="card"><div class="card-head"><h3>Blood pressure by visit</h3><span class="small muted"><span style="color:#1d4f91">●</span> systolic <span style="color:#7b3f8f">●</span> diastolic (mean of readings 2–3) · dashed: 140/90</span></div>${trendSvg(pts)}</div>` : ''}
      ${referralsCard(db.referrals.filter((x) => x.participantId === p.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), 'Referrals')}
      ${qs.length || evs.length ? `<div class="grid-2">
        <div class="card"><h3>Data queries</h3>${qs.map((q) => `<div style="margin-top:8px"><button class="btn link" data-action="open-rec" data-rec="${q.visitRecId}">${esc(visitDef(rec(q.visitRecId).visit).label)} · ${esc((P.fields[q.field] || {}).label || q.field)}</button>${queryHtml(q)}</div>`).join('') || '<p class="empty">None</p>'}</div>
        <div class="card"><h3>Safety events</h3>${evs.map(eventHtml).join('') || '<p class="empty">None</p>'}</div></div>` : ''}
      ${msgs.length ? `<div class="card"><h3>Messages sent</h3><div class="rows" style="margin-top:8px">${msgs.map((m) => `<div class="msg"><div class="msg-head"><span class="tag">${esc(m.kind)}</span><span class="small muted">${esc(fmtDT(m.sentAt))} · ${esc(m.sentBy)}</span></div><div class="text">${esc(m.recipients.find((x) => x.participantId === p.id).text)}</div></div>`).join('')}</div></div>` : ''}
      ${audits.length ? `<div class="card"><h3>Record changes</h3><table class="tbl"><tbody>${audits.map(auditRow).join('')}</tbody></table></div>` : ''}
    </div>`;
  }
  function eventHtml(e) {
    const p = part(e.participantId);
    return `<div class="msg" style="margin-top:8px"><div class="msg-head"><span><span class="tag ${e.status === 'new' ? 'urgent' : 'sup'}">${esc(e.kind)} · ${esc(e.status)}</span> <b>${esc(pLabel(p))}</b> ${esc(p.name)}</span><span class="small muted">${esc(fmtDT(e.reportedAt))}</span></div>
      <div>${esc(e.text)}</div>${e.assessment ? `<div class="small"><b>Assessment:</b> ${esc(e.assessment)} (${esc(e.by)})</div>` : ''}
      <div class="btn-row"><button class="btn sm ghost" data-action="open-rec" data-rec="${e.visitRecId}">Open visit</button>${isSup() && e.status === 'new' ? `<button class="btn sm primary" data-action="assess-event" data-ev="${e.id}">Assess</button>` : ''}</div></div>`;
  }

  /* ------------------------------------------------------------------ */
  /* Schedule                                                            */
  /* ------------------------------------------------------------------ */
  function screenSchedule() {
    const rows = isSup() ? RS.scheduleRows(db, P, null, 30).filter((x) => inScope(x.participant)) : myRows();
    const row = (x) => {
      const p = x.participant;
      const reminded = db.messages.some((m) => m.status === 'sent' && m.kind === 'reminder' && m.key === `${p.id}:${x.visit.id}`);
      // Others in the same household with a visit open now: visit them together.
      const mates = RS.householdMembers(db, p).filter((m) => rows.some((y) => y.participant.id === m.id && y.status !== 'upcoming'));
      const actions = isSup() ? `<span class="small muted">${esc(collectorName(p.cluster))}</span>` : `${reminded ? '<span class="tag ok">Reminded</span>' : RS.canText(p) && x.status !== 'missed' ? `<button class="btn sm ghost" data-action="remind" data-pid="${p.id}" data-visit="${x.visit.id}">${icon('message')} Remind</button>` : ''}
          ${x.draft ? `<button class="btn sm primary" data-action="open-rec" data-rec="${RS.draftRec(db, p.id, x.visit.id).id}">Continue</button>` : x.status !== 'upcoming' ? `<button class="btn sm ${x.status === 'due' ? 'primary' : ''}" data-action="start-visit" data-pid="${p.id}" data-visit="${x.visit.id}">Start${x.status === 'missed' ? ' (late)' : ''}</button>` : ''}`;
      return `<div class="row ${x.status}"><div class="who click" data-action="open-participant" data-pid="${p.id}" style="cursor:pointer"><strong>${esc(p.name)}</strong><span class="meta">${esc(pLabel(p))} · ${esc(clusterOf(p).name)}${p.phone ? ' · ' + esc(p.phone) : ''}</span>
          ${mates.length ? `<span class="meta">${icon('house')} Same household, also due: ${mates.map((m) => esc(m.name)).join(', ')}</span>` : ''}</div>
        <div class="when"><strong>${esc(x.visit.label)}</strong>${esc(RS.windowText(x.status, x.window))}<div class="muted">${esc(RS.rangeText(x.window))}</div></div>
        <div class="btn-row">${actions}</div></div>`;
    };
    const groups = S.groupBy === 'cluster'
      ? P.clusters.filter((c) => rows.some((x) => x.participant.cluster === c.id)).map((c) => ({ title: c.name, sub: [clusterArm(c), collectorName(c.id)].filter(Boolean).join(' · '), items: rows.filter((x) => x.participant.cluster === c.id) }))
      : [['missed', 'Window closed', 'Not done in time: doing it now is recorded as a protocol deviation'], ['due', 'Due now', 'Window open today'], ['upcoming', 'Coming up', 'Window opens in the next 30 days']].map(([k, t, sub]) => ({ title: t, sub, tag: k, items: rows.filter((x) => x.status === k) }));
    return `<div class="page">
      ${isSup() ? filterBar() : ''}
      <div class="btn-row" style="justify-content:space-between;margin-bottom:6px"><div class="tabs" style="margin:0">${[['status', 'By status'], ['cluster', 'By cluster']].map(([k, l]) => `<button class="${S.groupBy === k ? 'on' : ''}" data-action="group-by" data-v="${k}">${l}</button>`).join('')}</div>
        <span class="muted small">${isSup() ? 'Read only · ' : `${esc(me().clusters.map((id) => P.clusters.find((c) => c.id === id).name).join(' and '))} · `}Today ${esc(D.fmtLong(D.today()))}</span></div>
      ${groups.map((g) => `<div class="group-head">${g.tag ? `<span class="tag ${g.tag}">${g.items.length}</span>` : `<span class="tag">${g.items.length}</span>`}${esc(g.title)}<span class="muted small" style="font-weight:600">${esc(g.sub)}</span></div>
        <div class="rows">${g.items.map(row).join('') || '<p class="empty">Nothing here.</p>'}</div>`).join('')}
      ${!rows.length ? '<p class="empty">No visits are due in the next 30 days.</p>' : ''}
    </div>`;
  }

  /* ------------------------------------------------------------------ */
  /* Messaging                                                           */
  /* ------------------------------------------------------------------ */
  const dismissKey = (s) => `${s.kind}:${s.key}:${s.participant.id}`;
  const suggestions = () => (isSup() ? [] : RS.suggestMessages(db, P, null, me().name).filter((s) => isMine(s.participant) && db.dismissed[dismissKey(s)] !== D.today() && !(db.dismissed[dismissKey(s)] && s.kind !== 'encouragement')));
  function audienceOf(a) {
    const can = db.participants.filter((p) => p.status === 'enrolled' && isMine(p));
    let all, label;
    if (a === 'all') { all = can; label = 'All my participants'; }
    else if (a.startsWith('cluster:')) { const c = P.clusters.find((x) => x.id === a.slice(8)); all = can.filter((p) => p.cluster === c.id); label = 'Cluster: ' + c.name; }
    else if (a === 'due7') { all = can.filter((p) => RS.visitsFor(P, p).some((v) => { const st = RS.visitStatus(db, p, v); return st === 'due' || (st === 'upcoming' && D.between(D.today(), RS.visitWindow(p, v).start) <= 7); })); label = 'Visit due within 7 days'; }
    else { const p = part(a.slice(7)); all = p ? [p] : []; label = p ? pLabel(p) : ''; }
    return { label, ok: all.filter(RS.canText), excluded: all.filter((p) => !RS.canText(p)), group: !a.startsWith('person:') };
  }
  function screenMessages() {
    const sug = suggestions();
    const mine = (m) => isSup() || m.createdBy === me().name || m.recipients.some((r) => isMine(part(r.participantId)));
    const pending = db.messages.filter((m) => (m.status === 'pending' || (m.status === 'returned' && !isSup())) && mine(m));
    const sent = db.messages.filter((m) => m.status === 'sent' && mine(m)).sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    const tabs = isSup()
      ? [['pending', `Waiting for approval (${pending.length})`], ['sent', 'Sent']]
      : [['suggested', `Suggested (${sug.length})`], ['compose', 'Write a message'], ['pending', `Waiting for approval (${pending.length})`], ['sent', 'Sent']];
    if (!tabs.some(([k]) => k === S.msgTab)) S.msgTab = tabs[0][0];
    let body = '';
    if (S.msgTab === 'suggested') {
      body = `<p class="muted small">Drafted from the schedule and the protocol's message rules. Only people who agreed to be contacted (consent: "${esc(P.consent.options.find((o) => o.id === P.messages.consentOption).text)}") and have a phone are included. Check each one before sending.</p>
        <div class="rows">${sug.map((s, i) => `<div class="msg"><div class="msg-head"><span><span class="tag ${s.kind === 'missed' ? 'missed' : s.kind === 'reminder' ? 'due' : 'ok'}">${esc({ reminder: 'Visit reminder', missed: 'Missed visit', encouragement: 'Encouragement' }[s.kind])}</span> <b>${esc(s.participant.name)}</b> <span class="muted small">${esc(pLabel(s.participant))} · ${esc(s.participant.phone)}</span></span><span class="small muted">${esc(s.why)}</span></div>
          <div class="text">${esc(s.text)}</div>
          <div class="btn-row end"><button class="btn sm ghost" data-action="sug-dismiss" data-i="${i}">Not now</button><button class="btn sm" data-action="sug-edit" data-i="${i}">${icon('edit')} Edit</button><button class="btn sm primary" data-action="sug-send" data-i="${i}">${icon('send')} Send</button></div></div>`).join('') || '<p class="empty">Nothing suggested today.</p>'}</div>`;
    } else if (S.msgTab === 'compose') {
      const c = S.compose || (S.compose = { audience: 'all', template: 'event', text: P.messages.templates.event.text });
      const aud = audienceOf(c.audience);
      const preview = aud.ok[0] ? RS.fillMessage(c.text, RS.messageVars(P, aud.ok[0], null, me().name)) : c.text;
      const n = RS.smsParts(preview);
      const needsApproval = aud.group;
      body = `<div class="card"><div class="form-grid">
          <label><span class="lbl">To</span><select class="input" data-change="compose" data-k="audience">
            <option value="all" ${c.audience === 'all' ? 'selected' : ''}>All my participants</option>
            ${P.clusters.filter((x) => myClusters().includes(x.id)).map((x) => `<option value="cluster:${x.id}" ${c.audience === 'cluster:' + x.id ? 'selected' : ''}>Cluster: ${esc(x.name)}</option>`).join('')}
            <option value="due7" ${c.audience === 'due7' ? 'selected' : ''}>Visit due within 7 days</option>
            <optgroup label="One person">${db.participants.filter((p) => p.status === 'enrolled' && isMine(p)).map((p) => `<option value="person:${p.id}" ${c.audience === 'person:' + p.id ? 'selected' : ''}>${esc(pLabel(p))} · ${esc(p.name)}</option>`).join('')}</optgroup></select></label>
          <label><span class="lbl">Start from</span><select class="input" data-change="compose" data-k="template">${Object.entries(P.messages.templates).map(([k, t]) => `<option value="${k}" ${c.template === k ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}</select></label>
        </div>
        <label style="display:block;margin-top:12px"><span class="lbl">Message</span><textarea class="input" id="compose-text" data-input="compose-text">${esc(c.text)}</textarea></label>
        <p class="small muted">Placeholders: {first_name} {study} {study_phone} {collector}${c.audience.startsWith('person:') ? ' {visit} {from} {to}' : ''}. Replace anything in [brackets] before sending.</p>
        <div class="msg" style="margin-top:6px"><div class="msg-head"><b>Preview${aud.ok[0] ? ' for ' + esc(aud.ok[0].name) : ''}</b><span class="sms-count ${n.parts > 1 ? 'over' : ''}">${n.chars} characters · ${n.parts} SMS${n.parts > 1 ? ' (sent as ' + n.parts + ' parts)' : ''}</span></div><div class="text">${esc(preview)}</div></div>
        <p class="small">${aud.ok.length} recipient${aud.ok.length === 1 ? '' : 's'}${aud.excluded.length ? ` · <span class="muted">${aud.excluded.length} left out (no contact consent or no phone): ${aud.excluded.map((p) => esc(pLabel(p))).join(', ')}</span>` : ''}</p>
        ${/\[[^\]]+\]/.test(c.text) ? `<div class="alert warn">${icon('alert')}<div>Fill in the parts in [brackets] first.</div></div>` : ''}
        <div class="btn-row end"><button class="btn primary" data-action="compose-send" ${aud.ok.length && !/\[[^\]]+\]/.test(c.text) && c.text.trim() ? '' : 'disabled'}>${icon('send')} ${needsApproval ? 'Send for approval' : 'Send'}</button></div>
        ${needsApproval ? '<p class="small muted">Group messages are checked by the supervisor before they go out.</p>' : ''}</div>`;
    } else if (S.msgTab === 'pending') {
      body = `${isSup() ? '<p class="small muted">Group messages written by data collectors. Approving releases them to be sent; it does not send anything from this view.</p>' : ''}<div class="rows">${pending.map((m) => `<div class="msg"><div class="msg-head"><span><span class="tag ${m.status === 'returned' ? 'missed' : 'pending'}">${m.status === 'returned' ? 'Sent back' : 'Waiting'}</span> <b>${esc(m.audience)}</b> · ${m.recipients.length} recipients</span><span class="small muted">Written by ${esc(m.createdBy)} ${esc(fmtDT(m.createdAt))}</span></div>
        <div class="text">${esc(m.recipients[0] ? m.recipients[0].text : '')}</div>
        ${isSup() ? `<div class="btn-row end"><button class="btn sm ghost" data-action="msg-reject" data-m="${m.id}">Send back</button><button class="btn sm primary" data-action="msg-approve" data-m="${m.id}">${icon('check')} Approve</button></div>` : m.status === 'returned' ? '<p class="small muted">The supervisor sent this back. Write a new message if it is still needed.</p>' : '<p class="small muted">The supervisor will approve or send it back.</p>'}</div>`).join('') || '<p class="empty">Nothing waiting.</p>'}</div>`;
    } else {
      body = `<div class="rows">${sent.map((m) => `<details class="msg"><summary class="msg-head" style="cursor:pointer"><span><span class="tag">${esc(m.kind)}</span> <b>${esc(m.audience)}</b> · ${m.recipients.length} recipient${m.recipients.length === 1 ? '' : 's'}</span><span class="small muted">${esc(fmtDT(m.sentAt))} · ${esc(m.sentBy)}</span></summary>
        ${m.recipients.map((r) => `<div class="small"><b>${esc(pLabel(part(r.participantId)))}</b> ${esc(r.phone)}<div class="text">${esc(r.text)}</div></div>`).join('')}</details>`).join('') || '<p class="empty">Nothing sent yet.</p>'}</div>`;
    }
    return `<div class="page narrow"><div class="alert info" style="margin-bottom:12px">${icon('info')}<div>No SMS gateway is connected yet. <b>Send</b> records the message as sent; on a real deployment it goes to the gateway or the study phone.</div></div>
      <div class="tabs">${tabs.map(([k, l]) => `<button class="${S.msgTab === k ? 'on' : ''}" data-action="msg-tab" data-v="${k}">${l}</button>`).join('')}</div>${body}</div>`;
  }
  function sendMessage(kind, key, audience, recipients, status) {
    const m = { id: RS.uid('m'), kind, key, audience, recipients, status, createdBy: me().name, createdAt: new Date().toISOString() };
    if (status === 'sent') { m.sentAt = m.createdAt; m.sentBy = me().name; }
    db.messages.push(m);
    save();
    return m;
  }

  /* ------------------------------------------------------------------ */
  /* Data review (supervisor)                                            */
  /* ------------------------------------------------------------------ */
  /* ------------------------------------------------------------------ */
  /* Supervisor: filter bar (cluster, data collector)                    */
  /* ------------------------------------------------------------------ */
  function filterBar(extra) {
    return `<div class="filters">
      <label><span class="lbl">Cluster</span><select class="input sm" data-change="filter" data-k="cluster"><option value="all">All clusters</option>${P.clusters.map((c) => `<option value="${c.id}" ${S.f.cluster === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      <label><span class="lbl">Data collector</span><select class="input sm" data-change="filter" data-k="collector"><option value="all">All data collectors</option>${RS.STAFF.collectors.map((c) => `<option value="${c.id}" ${S.f.collector === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
      ${extra || ''}
    </div>`;
  }
  const pct = (x) => (x == null ? '—' : Math.round(x * 100) + '%');

  /* ------------------------------------------------------------------ */
  /* Data quality review: missing data, safety, queries, follow-up        */
  /* ------------------------------------------------------------------ */
  function screenQuality() {
    const ps = db.participants.filter(inScope);
    const ids = new Set(ps.map((p) => p.id));
    const recs = db.visits.filter((r) => ids.has(r.participantId));
    const perf = RS.performance(db, P, ps);
    const toReview = recs.filter((r) => r.status === 'complete' && !r.reviewed);
    const qOpen = db.queries.filter((q) => ids.has(q.participantId) && q.status !== 'closed');
    const evs = db.events.filter((e) => ids.has(e.participantId));
    const evNew = evs.filter((e) => e.status === 'new');
    const refs = db.referrals.filter((x) => ids.has(x.participantId));
    const refsOpen = refs.filter((x) => x.status === 'open');
    const kpi = (n, l, cls, sub) => `<div class="kpi ${cls || ''}"><strong>${n}</strong><span>${l}</span>${sub ? `<em>${sub}</em>` : ''}</div>`;
    const tabs = [['overview', 'By collector and cluster'], ['queries', `Queries (${qOpen.length})`], ['visits', `Visits to review (${toReview.length})`], ['events', `Safety events (${evNew.length} new)`], ['referrals', `Referrals (${refsOpen.length} open)`], ['export', 'Export'], ['audit', 'Audit trail']];
    let body = '';
    if (S.reviewTab === 'overview') {
      const row = (label, sub, parts) => {
        const m = RS.performance(db, P, parts);
        const warn = (x, lo) => (x != null && x < lo ? 'warn-cell' : '');
        return `<tr><td><b>${esc(label)}</b>${sub ? `<div class="small muted">${esc(sub)}</div>` : ''}</td><td class="num">${m.enrolled}</td>
          <td class="num ${warn(m.followUpRate, 0.85)}">${pct(m.followUpRate)}<div class="small muted">${m.visitsDone}/${m.visitsDue}</div></td>
          <td class="num ${warn(m.inWindowRate, 0.8)}">${pct(m.inWindowRate)}</td><td class="num ${m.visitsMissed ? 'warn-cell' : ''}">${m.visitsMissed}</td><td class="num">${m.openNow}</td>
          <td class="num ${warn(m.completeness, 0.95)}">${pct(m.completeness)}</td><td class="num">${m.queriesOpen}</td>
          <td class="num">${m.flagged}</td><td class="num">${m.referrals}</td><td class="num ${warn(m.referralCompletion, 0.7)}">${pct(m.referralCompletion)}</td><td class="num">${m.withdrawn}</td>
          <td class="small">${m.lastVisit ? esc(D.fmt(m.lastVisit)) : '—'}</td></tr>`;
      };
      const head = '<thead><tr><th></th><th class="num">Enrolled</th><th class="num">Follow-ups done</th><th class="num">In window</th><th class="num">Missed</th><th class="num">Due now</th><th class="num">Data complete</th><th class="num">Open queries</th><th class="num">Visits flagged</th><th class="num">Referrals</th><th class="num">Referral seen</th><th class="num">Withdrawn</th><th>Last visit</th></tr></thead>';
      const cols = RS.STAFF.collectors.filter((c) => S.f.collector === 'all' || c.id === S.f.collector);
      body = `<p class="small muted">Follow-ups count visits whose window has closed. "Visits flagged" are visits where a safety rule asked for a referral or review. Amber: below the usual target (follow-up 85%, in window 80%, data complete 95%, referral seen 70%). These targets are suggestions, not from the protocol.</p>
        <div class="card tbl-wrap"><h3>By data collector</h3><table class="tbl perf">${head}<tbody>${cols.map((c) => row(c.name, c.clusters.map((id) => P.clusters.find((x) => x.id === id).name).join(', '), ps.filter((p) => c.clusters.includes(p.cluster)))).join('')}</tbody></table></div>
        <div class="card tbl-wrap"><h3>By cluster</h3><table class="tbl perf">${head}<tbody>${P.clusters.filter((c) => ps.some((p) => p.cluster === c.id)).map((c) => row(c.name, [clusterArm(c), collectorName(c.id)].filter(Boolean).join(' · '), ps.filter((p) => p.cluster === c.id))).join('')}</tbody></table></div>
        ${missedList(ps)}`;
    } else if (S.reviewTab === 'queries') {
      body = qOpen.map((q) => { const p = part(q.participantId), r = rec(q.visitRecId); return `<div class="card"><div class="card-head"><h3><button class="btn link" data-action="open-rec" data-rec="${r.id}">${esc(pLabel(p))} · ${esc(visitDef(r.visit).label)} · ${esc((P.fields[q.field] || {}).label || q.field)}</button></h3><span>Value: <b>${esc(fmtValue(P.fields[q.field], r.values[q.field]))}</b> · ${esc(r.collector)}</span></div>${queryHtml(q)}</div>`; }).join('') || '<p class="empty">No open queries.</p>';
    } else if (S.reviewTab === 'visits') {
      body = `<div class="card tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Participant</th><th>Visit</th><th>Collector</th><th>Flags</th><th></th></tr></thead><tbody>${toReview.sort((a, b) => b.date.localeCompare(a.date)).map((r) => { const p = part(r.participantId); const nq = db.queries.filter((q) => q.visitRecId === r.id && q.status !== 'closed').length; return `<tr class="click" data-action="open-rec" data-rec="${r.id}"><td>${esc(D.fmt(r.date))}</td><td><b>${esc(pLabel(p))}</b> ${esc(p.name)}</td><td>${esc(visitDef(r.visit).label)}${r.deviation ? ' <span class="tag missed">Deviation</span>' : ''}</td><td>${esc(r.collector)}</td><td>${(r.safety || []).map((s) => `<span class="tag ${s.level}">${esc(LEVEL[s.level])}</span>`).join(' ')}${nq ? ` <span class="tag warn">${nq} query</span>` : ''}</td><td><button class="btn sm">Review</button></td></tr>`; }).join('') || '<tr><td colspan="6" class="empty">All visits reviewed.</td></tr>'}</tbody></table></div>`;
    } else if (S.reviewTab === 'events') {
      body = `<p class="small muted">Reportable events (protocol §15): serious adverse events and urgent referrals triggered by study procedures. Assess each and include it in the DSMB safety summary.</p>${evs.slice().sort((a, b) => (a.status === 'new' ? -1 : 0) - (b.status === 'new' ? -1 : 0) || b.reportedAt.localeCompare(a.reportedAt)).map(eventHtml).join('') || '<p class="empty">No events.</p>'}`;
    } else if (S.reviewTab === 'referrals') {
      const closed = refs.filter((x) => x.status !== 'open');
      body = `<div class="kpis">${kpi(refs.length, 'Referrals made')}${kpi(refsOpen.length, 'Waiting for outcome', refsOpen.some((x) => D.between(x.createdAt.slice(0, 10), D.today()) > 14) ? 'warn' : '')}${kpi(pct(closed.length ? refs.filter((x) => x.status === 'seen').length / closed.length : null), 'Seen (of those with an outcome)')}${kpi(refs.filter((x) => x.status === 'not_attended').length, 'Did not go', '', 'reasons below')}</div>
        <div class="card tbl-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Participant</th><th>To</th><th>Why</th><th>Status</th><th>Collector</th><th></th></tr></thead><tbody>
        ${refs.slice().sort((a, b) => (a.status === 'open' ? -1 : 1) - (b.status === 'open' ? -1 : 1) || b.createdAt.localeCompare(a.createdAt)).map((x) => { const p = part(x.participantId); const [st, tone] = REF_STATUS[x.status]; const days = D.between(x.createdAt.slice(0, 10), D.today()); return `<tr><td>${esc(D.fmt(x.createdAt.slice(0, 10)))}</td><td><button class="btn link" data-action="open-participant" data-pid="${p.id}">${esc(pLabel(p))}</button> ${esc(p.name)}</td><td>${esc(RS.referralSite(P, x.to).name)}<div class="small"><span class="tag ${x.urgency === 'urgent' ? 'urgent' : 'soon'}">${x.urgency === 'urgent' ? 'Urgent' : 'Within a week'}</span></div></td><td class="small">${x.reasons.map((y) => esc(y.text.split(':')[0])).join('; ')}</td><td><span class="tag ${tone}">${st}</span>${x.status === 'open' && days > 7 ? `<div class="small muted">${days} days</div>` : ''}${x.outcome && x.outcome.text ? `<div class="small muted">${esc(x.outcome.text)}</div>` : ''}</td><td class="small">${esc(x.by)}</td><td><button class="btn sm ghost" data-action="view-handoff" data-ref="${x.id}">${icon('printer')}</button></td></tr>`; }).join('') || '<tr><td colspan="7" class="empty">No referrals.</td></tr>'}</tbody></table></div>`;
    } else if (S.reviewTab === 'export') {
      body = `<div class="card"><h3>Export for the data centre</h3><p>All exports, with the codebook, REDCap dictionary and full archive, are on <button class="btn link" data-action="go" data-screen="export">Export data</button>.</p><p class="small muted">Study IDs and household IDs only: no names, phone numbers or addresses. One row per completed visit; every protocol field, its missing-data reason, and the calculated values. Open queries are counted per row. Exports cover all clusters, whatever the filter.</p>
        <div class="btn-row"><button class="btn" data-action="export" data-k="visits">${icon('download')} Visits (CSV)</button><button class="btn" data-action="export" data-k="participants">${icon('download')} Participants and consent (CSV)</button><button class="btn" data-action="export" data-k="audit">${icon('download')} Audit trail (CSV)</button></div></div>`;
    } else {
      body = `<div class="card tbl-wrap"><table class="tbl"><thead><tr><th>When</th><th>Who</th><th>Change</th><th>Reason</th></tr></thead><tbody>${db.audit.filter((a) => !a.participantId || ids.has(a.participantId)).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 60).map(auditRow).join('') || '<tr><td colspan="4" class="empty">No changes yet.</td></tr>'}</tbody></table></div>`;
    }
    return `<div class="page wide">${filterBar()}
      <div class="kpis">
        ${kpi(`${perf.enrolled}<span class="muted" style="font-size:14px"> / ${P.target}</span>`, 'Enrolled (target)')}
        ${kpi(ps.length, 'Screened')}${kpi(ps.filter((p) => p.status === 'screen_fail' || p.status === 'declined').length, 'Not enrolled')}
        ${kpi(perf.withdrawn, 'Withdrawn')}
        ${kpi(pct(perf.followUpRate), 'Follow-ups done', perf.followUpRate != null && perf.followUpRate < 0.85 ? 'warn' : '', `${perf.visitsMissed} missed`)}
        ${kpi(pct(perf.inWindowRate), 'Done in window', perf.inWindowRate != null && perf.inWindowRate < 0.8 ? 'warn' : '')}
        ${kpi(pct(perf.completeness), 'Required data complete')}
        ${kpi(qOpen.length, 'Open queries', qOpen.length ? 'warn' : '')}
        ${kpi(evNew.length, 'Events to assess', evNew.length ? 'bad' : '')}
        ${kpi(refsOpen.length, 'Referrals open', '', `${refs.length} made`)}
      </div>
      <div class="tabs">${tabs.map(([k, l]) => `<button class="${S.reviewTab === k ? 'on' : ''}" data-action="review-tab" data-v="${k}">${l}</button>`).join('')}</div>${body}</div>`;
  }
  /** Missed follow-up visits (window closed, not done), most recent first. */
  function missedList(ps) {
    const rows = [];
    ps.filter((p) => p.status === 'enrolled').forEach((p) => RS.visitsFor(P, p).forEach((v) => { if (RS.visitStatus(db, p, v) === 'missed') rows.push({ p, v, w: RS.visitWindow(p, v) }); }));
    if (!rows.length) return '';
    rows.sort((a, b) => b.w.end.localeCompare(a.w.end));
    return `<div class="card tbl-wrap"><h3>Missed visits (${rows.length})</h3><table class="tbl"><thead><tr><th>Participant</th><th>Visit</th><th>Window closed</th><th>Cluster</th><th>Collector</th><th>Reminder sent</th></tr></thead><tbody>
      ${rows.slice(0, 25).map(({ p, v, w }) => `<tr><td><button class="btn link" data-action="open-participant" data-pid="${p.id}">${esc(pLabel(p))}</button> ${esc(p.name)}</td><td>${esc(v.label)}</td><td>${esc(D.fmt(w.end))}</td><td>${esc(clusterOf(p).name)}</td><td>${esc(collectorName(p.cluster))}</td><td>${db.messages.some((m) => m.status === 'sent' && m.kind === 'reminder' && m.key === `${p.id}:${v.id}`) ? 'Yes' : RS.canText(p) ? 'No' : 'No (no contact consent or phone)'}</td></tr>`).join('')}</tbody></table>
      ${rows.length > 25 ? `<p class="small muted">Showing the latest 25.</p>` : ''}</div>`;
  }

  /* ------------------------------------------------------------------ */
  /* Analysis: enrolment and outcomes over time, by arm or cluster        */
  /* ------------------------------------------------------------------ */
  // Categorical series colours, fixed order (validated palette: blue, orange, aqua, yellow). Colour follows the
  // entity (cluster order in the protocol; arms in order of first appearance), never its rank.
  const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100'];
  const ARMS = () => (P.arms || []).map((a) => a.id);
  function analysisGroups(cohort) {
    const enrolled = db.participants.filter((p) => p.enrolledAt && inScope(p) && RS.inCohort(P, p, cohort));
    if (S.an.split === 'arm') return ARMS().map((a, i) => ({ key: a, label: armShownId(a), color: SERIES[i], parts: enrolled.filter((p) => RS.armOf(p) === a) })).filter((g) => g.parts.length);
    return P.clusters.map((c, i) => ({ key: c.id, label: c.name, color: SERIES[i], parts: enrolled.filter((p) => p.cluster === c.id) })).filter((g) => (S.f.cluster === 'all' || g.key === S.f.cluster) && (S.f.collector === 'all' || (RS.STAFF.collectors.find((x) => x.id === S.f.collector) || { clusters: [] }).clusters.includes(g.key)));
  }
  const fmtNum = (x, dec) => (x == null ? '—' : (Math.round(x * 10 ** (dec || 0)) / 10 ** (dec || 0)).toLocaleString(undefined, { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 }));

  const MIN_N = 3; // chart points from fewer people are hidden (they swing too much to read)
  function screenAnalysis() {
    const A = P.analysis;
    const m = A.measures.find((x) => x.id === S.an.measure) || A.measures[0];
    const allGroups = analysisGroups(null);
    // Enrolment over time
    const en = RS.enrolmentSeries(allGroups);
    const monthLabel = (k) => new Date(k + '-01T00:00:00').toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
    const enChart = lineChart('enrol', { x: en.months.map(monthLabel), series: en.series.map((s, i) => ({ label: s.label, color: allGroups[i].color, values: s.counts })), unit: 'enrolled', dec: 0, zero: true });
    // Outcome by visit
    const groups = analysisGroups(m.cohort);
    const os = RS.outcomeSeries(db, P, m, groups);
    const isPct = m.kind === 'percent';
    const scale = isPct ? 100 : 1;
    const dec = isPct ? 0 : m.decimals || 0;
    const visitLabel = (id) => (id === 'baseline' ? 'Baseline' : visitDef(id).label.replace(' (final)', ''));
    const outChart = lineChart('outcome', {
      x: os.visits.map(visitLabel),
      series: os.series.map((s, i) => ({ label: s.label, color: groups[i].color, values: os.visits.map((v) => (s.points[v] && s.points[v].n >= MIN_N ? s.points[v].mean * scale : null)), ns: os.visits.map((v) => (s.points[v] ? s.points[v].n : 0)) })),
      unit: isPct ? '%' : m.unit, dec, zero: isPct,
    });
    const better = (d) => (d == null || Math.abs(d) < 1e-9 ? '' : (d < 0) === (m.better === 'lower') ? 'better' : 'worse');
    const cohortName = m.cohort ? (P.derivedById[m.cohort] || {}).label : 'All enrolled';
    const enTable = allGroups.map((g) => { const perf = RS.performance(db, P, g.parts); return `<tr><td><span class="key" style="background:${g.color}"></span>${esc(g.label)}</td><td class="num">${g.parts.length}</td><td class="num">${g.parts.filter((p) => p.status === 'withdrawn').length}</td><td class="num">${pct(perf.followUpRate)}</td><td class="num">${pct(perf.inWindowRate)}</td></tr>`; }).join('');
    return `<div class="page wide">
      ${filterBar(`<label><span class="lbl">Split by</span><select class="input sm" data-change="an" data-k="split"><option value="cluster" ${S.an.split === 'cluster' ? 'selected' : ''}>Cluster</option><option value="arm" ${S.an.split === 'arm' ? 'selected' : ''}>Arm (intervention / standard care)</option></select></label>`)}
      <div class="alert warn" style="margin-bottom:14px">${icon('alert')}<div><strong>For running the study, not for conclusions</strong>${esc(A.note)}</div></div>
      <div class="grid-2 an-grid">
        <div class="card"><div class="card-head"><h3>Enrolment over time</h3><span class="small muted">Cumulative, by month</span></div>${enChart}
          <table class="tbl compact"><thead><tr><th></th><th class="num">Enrolled</th><th class="num">Withdrawn</th><th class="num">Follow-ups done</th><th class="num">In window</th></tr></thead><tbody>${enTable}</tbody></table></div>
        <div class="card"><div class="card-head"><h3>${esc(m.label)} by visit</h3><span class="small muted">${isPct ? '% of people' : 'Mean' + (m.unit ? ', ' + esc(m.unit) : '')} · ${esc(cohortName)}</span></div>
          <div class="chips measure-chips">${A.measures.map((x) => `<button class="chip ${x.id === m.id ? 'on' : ''}" data-action="an-measure" data-v="${x.id}">${esc(x.label)}</button>`).join('')}</div>
          ${os.visits.length ? outChart : '<p class="empty">No data for this measure yet.</p>'}
          <table class="tbl compact"><thead><tr><th></th><th class="num">Baseline</th><th class="num">Latest visit</th><th class="num">Change from baseline</th></tr></thead><tbody>
          ${os.series.map((s, i) => {
            const vs = os.visits.filter((v) => s.points[v]);
            // latest visit with at least 3 people (a single person's value says little)
            const lastId = vs.slice(1).reverse().find((v) => s.points[v].n >= 3) || (vs.length > 1 ? vs[vs.length - 1] : null);
            const b = s.points.baseline, last = lastId ? s.points[lastId] : null;
            const ch = s.change.mean == null ? null : s.change.mean * scale;
            return `<tr><td><span class="key" style="background:${groups[i].color}"></span>${esc(s.label)}</td><td class="num">${b ? fmtNum(b.mean * scale, dec) + (isPct ? '%' : '') : '—'}<div class="small muted">n=${b ? b.n : 0}</div></td>
              <td class="num">${last ? fmtNum(last.mean * scale, dec) + (isPct ? '%' : '') : '—'}<div class="small muted">${last ? `${esc(visitLabel(lastId))}, n=${last.n}` : ''}</div></td>
              <td class="num"><span class="delta ${better(ch)}">${ch == null ? '—' : (ch > 0 ? '+' : ch < 0 ? '−' : '') + fmtNum(Math.abs(ch), isPct ? 0 : Math.max(dec, 1)) + (isPct ? ' points' : '')}</span><div class="small muted">n=${s.change.n} with both</div></td></tr>`;
          }).join('')}</tbody></table>
          <p class="small muted">Points with fewer than ${MIN_N} people are left off the chart. Change from baseline is within each person (their latest visit minus their baseline), so it isn't skewed by who has reached later visits. Small numbers move a lot: read with the n.</p>
        </div>
      </div>
      ${adherenceCard(groups.length ? analysisGroups(null) : [])}
    </div>`;
  }
  /** Medicines and adherence at each group's latest visits: who is struggling, where. */
  function adherenceCard(groups) {
    const latest = (p) => RS.latestValues(db, p.id);
    const rows = groups.map((g) => {
      const vals = g.parts.filter((p) => p.status === 'enrolled').map(latest);
      const onMeds = vals.filter((v) => v.on_htn_meds === 'yes' || v.on_dm_meds === 'yes' || v.on_insulin === 'yes');
      const share = (list, f) => (list.length ? list.filter(f).length / list.length : null);
      const mars = onMeds.map((v) => [1, 2, 3, 4, 5].reduce((s, i) => s + Number(v['mars_' + i] || 0), 0)).filter((x) => x >= 5);
      return `<tr><td><span class="key" style="background:${g.color}"></span>${esc(g.label)}</td><td class="num">${onMeds.length}</td><td class="num">${mars.length ? fmtNum(mars.reduce((s, x) => s + x, 0) / mars.length, 1) : '—'}</td>
        <td class="num">${pct(share(onMeds, (v) => [1, 2, 3, 4, 5].some((i) => Number(v['mars_' + i]) <= 3)))}</td><td class="num">${pct(share(vals, (v) => v.med_access === 'yes'))}</td>
        <td class="num">${pct(share(vals.filter((v) => v.food_security), (v) => v.food_security === 'moderate' || v.food_security === 'severe'))}</td></tr>`;
    }).join('');
    return `<div class="card tbl-wrap"><div class="card-head"><h3>Medicines and adherence (latest recorded)</h3><span class="small muted">Ideas for support: reminders, refill problems, cost</span></div>
      <table class="tbl compact"><thead><tr><th></th><th class="num">On BP or diabetes medicine</th><th class="num">MARS-5 mean (5–25)</th><th class="num">Any MARS-5 item ≤ 3 (often misses)</th><th class="num">Couldn't get a medicine</th><th class="num">Food insecure (moderate or severe)</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="small muted">Where many people couldn't get a medicine, the barrier is supply or cost rather than remembering; reminders help with the "often misses" group. Encouragement messages for people on medicine are drafted automatically in Messaging.</p></div>`;
  }

  /* ---------- Line chart (inline SVG with a hover crosshair) ---------- */
  const CHARTS = {};
  function niceTicks(lo, hi, n) {
    const span = hi - lo || 1;
    const step0 = span / n, mag = 10 ** Math.floor(Math.log10(step0));
    const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => span / s <= n) || 10 * mag;
    const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step;
    const out = [];
    for (let v = a; v <= b + step / 2; v += step) out.push(Math.round(v * 1000) / 1000);
    return out;
  }
  /**
   * opts: {x: [labels], series: [{label, color, values: [number|null], ns?: [n]}], unit, dec, zero}
   * Legend above (line keys), 2px lines, 8px markers with a surface ring, hairline grid, hover crosshair + tooltip.
   */
  function lineChart(id, o) {
    CHARTS[id] = o;
    const W = 560, H = 230, pad = { l: 44, r: 14, t: 12, b: 28 };
    const vals = o.series.flatMap((s) => s.values).filter((v) => v != null);
    if (!vals.length || !o.x.length) return '<p class="empty">No data yet.</p>';
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (o.zero) lo = Math.min(0, lo);
    if (hi - lo < 1e-9) { hi += 1; lo -= o.zero ? 0 : 1; }
    const ticks = niceTicks(lo, hi, 4);
    lo = ticks[0]; hi = ticks[ticks.length - 1];
    const X = (i) => pad.l + (o.x.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (o.x.length - 1));
    const Y = (v) => pad.t + ((hi - v) * (H - pad.t - pad.b)) / (hi - lo);
    const every = Math.ceil(o.x.length / 8);
    const path = (s) => {
      let d = '', pen = false;
      s.values.forEach((v, i) => { if (v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`; pen = true; });
      return d;
    };
    const dots = o.x.length <= 12;
    return `<div class="chart" data-chart="${id}">
      ${o.series.length > 1 ? `<div class="legend">${o.series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.label)}</span>`).join('')}</div>` : ''}
      <div class="chart-box"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.series.map((s) => s.label).join(', '))}">
        ${ticks.map((t) => `<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${Y(t)}" y2="${Y(t)}"/><text class="tick" x="${pad.l - 6}" y="${Y(t) + 4}" text-anchor="end">${esc(fmtNum(t, Number.isInteger(t) ? 0 : 1))}</text>`).join('')}
        ${o.x.map((l, i) => (i % every === 0 || i === o.x.length - 1 ? `<text class="tick" x="${X(i)}" y="${H - 8}" text-anchor="middle">${esc(l)}</text>` : '')).join('')}
        ${o.series.map((s) => `<path d="${path(s)}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`).join('')}
        ${dots ? o.series.map((s) => s.values.map((v, i) => (v == null ? '' : `<circle cx="${X(i)}" cy="${Y(v)}" r="4" fill="${s.color}" stroke="var(--surface)" stroke-width="2"/>`)).join('')).join('') : ''}
        <line class="crosshair hidden" x1="0" x2="0" y1="${pad.t}" y2="${H - pad.b}"/>
        <rect class="hit" x="${pad.l}" y="${pad.t}" width="${W - pad.l - pad.r}" height="${H - pad.t - pad.b}" fill="transparent" data-w="${W}" data-l="${pad.l}" data-r="${pad.r}"/>
      </svg><div class="tip hidden" role="tooltip"></div></div></div>`;
  }
  /** Hover: snap to the nearest x, show every series' value there. */
  function chartHover(e) {
    const box = e.target.closest('.chart');
    if (!box) return;
    const o = CHARTS[box.dataset.chart];
    const svg = box.querySelector('svg'), hit = svg.querySelector('.hit'), tip = box.querySelector('.tip'), cross = svg.querySelector('.crosshair');
    const r = svg.getBoundingClientRect();
    const W = Number(hit.dataset.w), l = Number(hit.dataset.l), rr = Number(hit.dataset.r);
    const sx = ((e.clientX - r.left) / r.width) * W;
    const n = o.x.length;
    const i = n === 1 ? 0 : Math.max(0, Math.min(n - 1, Math.round(((sx - l) / (W - l - rr)) * (n - 1))));
    const cx = l + (n === 1 ? (W - l - rr) / 2 : (i * (W - l - rr)) / (n - 1));
    cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.classList.remove('hidden');
    tip.textContent = '';
    const h = document.createElement('div'); h.className = 'tip-head'; h.textContent = o.x[i]; tip.appendChild(h);
    o.series.forEach((s) => {
      const row = document.createElement('div'); row.className = 'tip-row';
      const k = document.createElement('i'); k.style.background = s.color; row.appendChild(k);
      const v = document.createElement('b'); v.textContent = s.values[i] == null ? '—' : fmtNum(s.values[i], o.dec) + (o.unit === '%' ? '%' : ''); row.appendChild(v);
      const lab = document.createElement('span'); lab.textContent = ` ${s.label}${s.ns && s.values[i] != null ? ` (n=${s.ns[i]})` : ''}`; row.appendChild(lab);
      tip.appendChild(row);
    });
    tip.classList.remove('hidden');
    const px = ((cx / W) * r.width);
    tip.style.left = Math.min(Math.max(0, px + 12), r.width - tip.offsetWidth) + 'px';
  }
  function chartLeave(e) {
    const box = e.target.closest && e.target.closest('.chart');
    if (!box) return;
    box.querySelector('.tip').classList.add('hidden');
    box.querySelector('.crosshair').classList.add('hidden');
  }

  /* ------------------------------------------------------------------ */
  /* Protocol                                                            */
  /* ------------------------------------------------------------------ */
  function screenProtocol() {
    const forms = Object.values(P.forms);
    const notes = [];
    Object.values(P.fields).forEach((f) => { if (/ASSUMPTION|NEED INFO/.test(f.help || '')) notes.push(`${f.label}: ${f.help}`); });
    forms.forEach((f) => { if (/ASSUMPTION|NEED INFO/.test((f.source || '') + (f.intro || ''))) notes.push(`${f.title}: ${[f.source, f.intro].filter((x) => /ASSUMPTION|NEED INFO/.test(x || '')).join(' ')}`); });
    P.safety.forEach((r) => { if (/ASSUMPTION/.test(r.source || '')) notes.push(`Safety rule "${r.id}": ${r.source}`); });
    (P.needInfo || []).slice().reverse().forEach((x) => notes.unshift(x));
    return `<div class="page">
      <div class="card"><h2>${esc(P.title)}</h2><div class="facts"><span>Version <b>${esc(P.version)}</b></span><span>${esc(P.site)}</span><span>${esc(P.sponsor)}</span></div><p>${esc(P.summary)}</p>
        <div class="alert warn">${icon('alert')}<div>${esc(P.status)}</div></div></div>
      <div class="card tbl-wrap"><h3>Schedule of activities (from Table 11.1)</h3><table class="tbl" style="margin-top:8px"><thead><tr><th>Form</th>${P.visits.map((v) => `<th>${esc(v.label.replace(' (final)', ''))}</th>`).join('')}</tr></thead><tbody>
        <tr><td class="muted">Window</td>${P.visits.map((v) => `<td class="small muted">${v.day ? `day ${v.day}<br>−${v.before}/+${v.after}` : 'day 0'}</td>`).join('')}</tr>
        ${forms.map((f) => `<tr><td><b>${esc(f.title)}</b>${f.sensitive ? ' <span class="tag report">Sensitive</span>' : ''}${f.show ? `<div class="small muted">Only if: ${esc(f.show)}</div>` : ''}</td>${P.visits.map((v) => `<td>${v.forms.includes(f.id) ? '●' : ''}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div>
      <div class="grid-2">
        <div class="card"><h3>Eligibility (Table 6.1)</h3>${P.eligibility.map((c) => `<div class="crit"><span class="tag ${c.kind === 'include' ? 'ok' : 'failed'}">${c.kind === 'include' ? 'Include' : 'Exclude'}</span><div>${esc(c.text)}<div class="mono muted">${esc(c.when)}</div></div></div>`).join('')}</div>
        <div class="card"><h3>Consent (Table 7.1, Appendix B)</h3><p class="small">${esc(P.consent.version)} · ${esc(P.consent.language)}</p><p class="small muted">${esc(P.consent.method)}</p><ul>${P.consent.options.map((o) => `<li>${esc(o.text)}</li>`).join('')}</ul></div>
      </div>
      <div class="card tbl-wrap"><h3>Safety and escalation rules</h3><table class="tbl" style="margin-top:8px"><thead><tr><th>Level</th><th>When</th><th>What to do</th><th>Source</th></tr></thead><tbody>
        ${P.safety.map((r) => `<tr><td><span class="tag ${r.level}">${esc(LEVEL[r.level])}</span></td><td class="mono">${esc(r.when)}</td><td>${esc(r.text)}</td><td class="small muted">${esc(r.source || '')}</td></tr>`).join('')}</tbody></table></div>
      <div class="card tbl-wrap"><h3>Calculated values</h3><table class="tbl"><tbody>${P.derived.map((d) => `<tr><td><b>${esc(d.label)}</b></td><td class="mono">${esc(d.expr)}</td></tr>`).join('')}</tbody></table></div>
      <div class="card"><h3>Placeholders to resolve before use (${notes.length})</h3><p class="small muted">Where v08 says NEED INFO, the app uses a marked assumption. These should be settled with the protocol team.</p><ul>${notes.map((n) => `<li class="small">${esc(n)}</li>`).join('')}</ul></div>
    </div>`;
  }

  function screenNoStudy() {
    return `<div class="page narrow"><div class="card empty-state">${icon('flask')}<h2>No active study</h2><p>There is no study on this tablet yet. Your supervisor sets up the study; when they publish it, your participants and visits appear here.</p></div></div>`;
  }
  const DZ = RS.designUI({
    S, esc, icon, render, openModal, closeModal, renderModal, toast, download, fieldHtml, save,
    me: () => me(), getDb: () => db, setDb: (x) => { db = x; save(); },
    resetAll: () => { RS.study.resetDemo(); try { localStorage.removeItem(RS.STORE_KEY); } catch (e) { /* private mode */ } location.reload(); },
  });
  const SCREENS = { design: DZ.screens.design, export: DZ.screens.export, nostudy: screenNoStudy, initial: screenInitial, records: screenRecords, participant: screenParticipant, visit: screenVisit, visitview: screenVisitView, schedule: screenSchedule, messages: screenMessages, quality: screenQuality, analysis: screenAnalysis, protocol: screenProtocol };

  /* ------------------------------------------------------------------ */
  /* Modals                                                              */
  /* ------------------------------------------------------------------ */
  function openModal(m) { S.modal = m; renderModal(); }
  function closeModal() { S.modal = null; renderModal(); }
  function renderModal() {
    const m = S.modal;
    $('scrim').classList.toggle('hidden', !m);
    $('modal').classList.toggle('hidden', !m);
    if (!m) { $('modal').innerHTML = ''; return; }
    const head = (t) => `<div class="modal-head"><h2>${esc(t)}</h2><button class="btn sm ghost" data-action="close-modal" aria-label="Close">${icon('x')}</button></div>`;
    let html = '';
    if (m.type === 'complete') {
      const r = rec(m.recId), p = part(r.participantId), vd = visitDef(r.visit), ctx = ctxOf(r);
      const val = RS.validateVisit(P, vd, r, ctx);
      const safety = RS.safety(P, r.values, ctx);
      const label = (id) => (P.fields[id] || {}).label || id;
      const ACTIONS = actionsFor;
      const needAct = safety.filter((s) => ACTIONS(s.rule).length);
      const ready = val.ok && needAct.every((s) => m.actions[s.rule.id]);
      html = `<div class="modal-card wide">${head(p.status === 'screening' ? 'Review and enrol' : 'Complete visit')}
        ${val.errors.length ? `<div class="alert urgent">${icon('alert')}<div><strong>${val.errors.length} thing${val.errors.length === 1 ? '' : 's'} to fix</strong>${val.errors.slice(0, 12).map((e) => `<div><button class="btn link" data-action="goto-field" data-field="${e.field}">${esc(label(e.field))}</button>: ${esc(e.text)}</div>`).join('')}${val.errors.length > 12 ? `<div>…and ${val.errors.length - 12} more</div>` : ''}</div></div>` : ''}
        ${val.disagreements.length ? `<div class="alert warn">${icon('ear')}<div><strong>Check what was heard</strong>${val.disagreements.map((d) => `<div>${esc(label(d.field))}: entered <b>${esc(fmtValue(P.fields[d.field], d.entered))}</b>, heard <b>${esc(fmtValue(P.fields[d.field], d.heard))}</b> <button class="btn sm" data-action="keep-entered" data-field="${d.field}">Keep</button> <button class="btn sm heard" data-action="use-heard" data-field="${d.field}">Use heard</button></div>`).join('')}</div></div>` : ''}
        ${val.softs.length ? `<div class="alert info">${icon('info')}<div><strong>Unusual values</strong>These become data queries for the supervisor: ${val.softs.map((s) => esc(label(s.field)) + ' ' + esc(fmtValue(P.fields[s.field], r.values[s.field]))).join(', ')}.</div></div>` : ''}
        ${needAct.map((s) => `<div class="alert ${s.rule.level}">${icon('alert')}<div><strong>${esc(LEVEL[s.rule.level])}</strong>${esc(s.text)}${s.rule.referTo ? `<div class="small">Refer to: <b>${esc(RS.referralSite(P, s.rule.referTo).name)}</b></div>` : ''}<div class="chips" style="margin-top:6px">${ACTIONS(s.rule).map((a) => `<button class="chip ${m.actions[s.rule.id] === a ? 'on' : ''}" data-action="safety-act" data-rule="${s.rule.id}" data-v="${esc(a)}">${esc(a)}</button>`).join('')}</div></div></div>`).join('')}
        ${val.ok && !needAct.length ? '<p>Everything required is recorded.</p>' : ''}
        ${needAct.some((s) => s.rule.referTo && m.actions[s.rule.id] === REFERRED) ? `<p class="small">${icon('printer')} A referral handoff will be ready to print after you complete the visit.</p>` : ''}
        <p class="small muted">After this the visit is read-only.${p.status === 'screening' ? ' The participant is enrolled, given a study ID, and their visit schedule is created.' : ''}${listeningAllowed(p) ? ' The conversation text is discarded; only a note of re-checked answers is kept.' : ''}</p>
        <div class="btn-row end"><button class="btn" data-action="close-modal">Back to the form</button><button class="btn primary" data-action="confirm-complete" ${ready ? '' : 'disabled'}>${p.status === 'screening' ? 'Enrol' : 'Complete visit'}</button></div></div>`;
    } else if (m.type === 'late') {
      const p = part(m.pid), v = visitDef(m.visit), w = RS.visitWindow(p, v);
      html = `<div class="modal-card">${head('Visit outside its window')}
        <p>The ${esc(v.label)} window closed on <b>${esc(D.fmtLong(w.end))}</b> (${esc(RS.windowText('missed', w))}). You can still do it; it is recorded as a protocol deviation (Appendix C).</p>
        <label><span class="lbl">Category</span><select class="input" data-change="modal" data-k="category">${P.deviationCategories.map((c) => `<option ${m.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
        <label><span class="lbl">Note</span><input class="input" id="m-note" data-input="modal" data-k="note" value="${esc(m.note || '')}" placeholder="e.g. Participant was away until last week"></label>
        <div class="btn-row end"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="confirm-late">Start visit</button></div></div>`;
    } else if (m.type === 'query') {
      const r = rec(m.recId), f = P.fields[m.field];
      html = `<div class="modal-card">${head('Raise a data query')}<p><b>${esc(f.label)}</b>: ${esc(fmtValue(f, r.values[m.field])) || '<span class="muted">blank</span>'}</p>
        <label><span class="lbl">Question for the data collector</span><textarea class="input" id="m-text" data-input="modal" data-k="text">${esc(m.text || '')}</textarea></label>
        <div class="btn-row end"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="confirm-query" ${m.text && m.text.trim() ? '' : 'disabled'}>Raise query</button></div></div>`;
    } else if (m.type === 'answer') {
      const q = db.queries.find((x) => x.id === m.q);
      html = `<div class="modal-card">${head('Answer the query')}<p>${esc(q.text)}</p>
        <label><span class="lbl">Your answer (what you checked)</span><textarea class="input" id="m-text" data-input="modal" data-k="text">${esc(m.text || '')}</textarea></label>
        <p class="small muted">If the value is wrong, say what it should be; the supervisor corrects it.</p>
        <div class="btn-row end"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="confirm-answer" ${m.text && m.text.trim() ? '' : 'disabled'}>Send answer</button></div></div>`;
    } else if (m.type === 'correct') {
      const r = rec(m.recId), f = P.fields[m.field];
      const c = RS.checkValue(f, parseVal(f, m.value || ''));
      html = `<div class="modal-card">${head('Correct a value')}<p><b>${esc(f.label)}</b>: now ${esc(fmtValue(f, r.values[m.field])) || 'blank'}${(r.missing || {})[m.field] ? ` (missing: ${esc(r.missing[m.field])})` : ''}</p>
        ${f.options ? `<div class="chips">${f.options.map(([k, l]) => `<button class="chip ${String(m.value) === String(k) ? 'on' : ''}" data-action="modal-set" data-k="value" data-v="${esc(k)}">${esc(l)}</button>`).join('')}</div>`
          : `<label><span class="lbl">New value${f.unit ? ` (${esc(f.unit)})` : ''}</span><input class="input" id="m-value" data-input="modal" data-k="value" value="${esc(m.value || '')}"></label>${c.hard ? `<div class="fld-msg err">${esc(c.hard)}</div>` : ''}`}
        <label><span class="lbl">Reason (required, kept in the audit trail)</span><select class="input" data-change="modal" data-k="reason"><option value="">Choose…</option>${['Transcription error (checked against the source form)', 'Late lab result added', 'Clarified with the data collector (query)', 'Re-measured at the same visit', 'Other'].map((x) => `<option ${m.reason === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
        <div class="btn-row end"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="confirm-correct" ${m.reason && m.value !== undefined && m.value !== '' && !c.hard ? '' : 'disabled'}>Save correction</button></div></div>`;
    } else if (m.type === 'withdraw') {
      const p = part(m.pid);
      html = `<div class="modal-card">${head('Withdraw ' + p.name)}<p class="small muted">People can stop at any time without giving a reason. They can also stop only an optional part instead (Optional parts).</p>
        <label><span class="lbl">Reason</span><select class="input" data-change="modal" data-k="reason"><option value="">Choose…</option>${['No longer wishes to take part', 'Moved out of the cluster', 'Lost to follow-up', 'Died', 'Investigator decision (safety)', 'Other'].map((x) => `<option ${m.reason === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
        <label><span class="lbl">Data already collected</span><select class="input" data-change="modal" data-k="dataUse">${['Keep data already collected (de-identified)', 'Participant asks for data to be removed (supervisor to check what is allowed)'].map((x) => `<option ${m.dataUse === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
        <div class="btn-row end"><button class="btn" data-action="close-modal">Cancel</button><button class="btn danger" data-action="confirm-withdraw" ${m.reason ? '' : 'disabled'}>Withdraw</button></div></div>`;
    } else if (m.type === 'consent-change') {
      const p = part(m.pid);
      html = `<div class="modal-card">${head('Optional parts')}<p class="small muted">The participant can stop an optional part at any time. Adding one needs the consent form for that part to be signed.</p>
        ${P.consent.options.map((o) => `<label class="check"><input type="checkbox" data-action="modal-opt" data-k="${o.id}" ${m.options[o.id] ? 'checked' : ''} ${o.requiresApproval && !P.listeningApproved && !S.test ? 'disabled' : ''}><span>${esc(o.text)}</span></label>`).join('')}
        ${P.consent.options.some((o) => m.options[o.id] && !p.consent.options[o.id]) ? '<label class="check"><input type="checkbox" data-action="modal-flag" data-k="signed" ' + (m.signed ? 'checked' : '') + '><span>The consent form for the added part was signed today</span></label>' : ''}
        <div class="btn-row end"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="confirm-consent-change" ${P.consent.options.some((o) => m.options[o.id] && !p.consent.options[o.id]) && !m.signed ? 'disabled' : ''}>Save</button></div></div>`;
    } else if (m.type === 'assess') {
      html = `<div class="modal-card">${head('Assess safety event')}
        <label><span class="lbl">Assessment</span><textarea class="input" id="m-text" data-input="modal" data-k="text" placeholder="Serious? Related to study procedures? Reported to whom and when?">${esc(m.text || '')}</textarea></label>
        <div class="btn-row end"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="confirm-assess" ${m.text && m.text.trim() ? '' : 'disabled'}>Save</button></div></div>`;
    } else if (m.type === 'handoff') {
      const ref = db.referrals.find((x) => x.id === m.refId);
      const all = m.all || [m.refId];
      html = `<div class="modal-card wide">${head(m.enrolled ? 'Enrolled · referral handoff' : 'Referral handoff')}
        ${all.length > 1 ? `<div class="tabs">${all.map((id) => { const x = db.referrals.find((y) => y.id === id); return `<button class="${id === m.refId ? 'on' : ''}" data-action="handoff-tab" data-ref="${id}">${esc(RS.referralSite(P, x.to).name)}</button>`; }).join('')}</div>` : ''}
        <p class="small muted">Print this and give it to the participant to take with them. The bottom part is for the clinician to fill in and return.</p>
        <div class="handoff-preview">${handoffHtml(ref)}</div>
        <div class="btn-row end"><button class="btn" data-action="close-modal">Close</button><button class="btn primary" data-action="print-handoff" data-ref="${ref.id}">${icon('printer')} Print</button></div></div>`;
    } else if (m.type === 'outcome') {
      const ref = db.referrals.find((x) => x.id === m.refId);
      html = `<div class="modal-card">${head('Referral outcome')}<p>${esc(RS.referralSite(P, ref.to).name)} · referred ${esc(D.fmtLong(ref.createdAt.slice(0, 10)))}</p>
        <div class="chips">${[['seen', 'Seen'], ['not_attended', 'Did not go']].map(([k, l]) => `<button class="chip ${m.status === k ? 'on' : ''}" data-action="modal-set" data-k="status" data-v="${k}">${l}</button>`).join('')}</div>
        <label><span class="lbl">Date</span><input class="input" type="date" data-change="modal" data-k="date" value="${esc(m.date)}" max="${D.today()}"></label>
        <label><span class="lbl">${m.status === 'not_attended' ? 'Why not (helps the team remove barriers)' : 'What was done (from the return slip)'}</span><textarea class="input" id="m-text" data-input="modal" data-k="text">${esc(m.text || '')}</textarea></label>
        <div class="btn-row end"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="confirm-outcome" ${m.status ? '' : 'disabled'}>Save</button></div></div>`;
    } else if (m.type === 'household') {
      const p = part(m.pid);
      html = `<div class="modal-card">${head('Household')}<p>${esc(p.name)} is in household <b>${esc(p.household || 'none')}</b>${RS.householdMembers(db, p).length ? ` with ${RS.householdMembers(db, p).map((x) => esc(x.name)).join(', ')}` : ''}.</p>
        <p class="small muted">People who live in the same home. Used for planning visits together and in the analysis (their results may be alike).</p>
        <label><span class="lbl">Change to</span><select class="input" data-change="modal" data-k="with"><option value="">Choose…</option>
          ${housemates(p.cluster, p.id).filter((x) => !x.household || x.household !== p.household).map((x) => `<option value="${x.id}" ${m.with === x.id ? 'selected' : ''}>Same household as ${esc(houseLabel(x))}</option>`).join('')}
          <option value="new" ${m.with === 'new' ? 'selected' : ''}>A new household on their own</option></select></label>
        <div class="btn-row end"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="confirm-household" ${m.with ? '' : 'disabled'}>Save</button></div></div>`;
    } else if (/^dz-/.test(m.type)) {
      html = DZ.modal(m, head) || '';
    } else if (m.type === 'enrolled') {
      const p = part(m.pid);
      html = `<div class="modal-card">${head('Enrolled')}<p><b>${esc(p.name)}</b> is now <b class="mono">${esc(p.studyId)}</b> (${esc([clusterOf(p).name, armText(p)].filter(Boolean).join(', '))}).</p>
        <table class="tbl"><tbody>${RS.visitsFor(P, p).slice(1).map((v) => `<tr><td>${esc(v.label)}</td><td>${esc(RS.rangeText(RS.visitWindow(p, v)))}</td></tr>`).join('')}</tbody></table>
        <p class="small muted">Write the study ID and the next visit window on the participant's study card.</p>
        <div class="btn-row end"><button class="btn primary" data-action="close-modal">Done</button></div></div>`;
    }
    $('modal').innerHTML = html;
  }

  /* ------------------------------------------------------------------ */
  /* Actions                                                             */
  /* ------------------------------------------------------------------ */
  function startVisit(p, v, deviation) {
    const existing = RS.draftRec(db, p.id, v.id);
    if (existing) { go('visit', { recId: existing.id, pid: p.id }); return; }
    const r = { id: RS.uid('v'), participantId: p.id, visit: v.id, date: D.today(), collector: me().name, status: 'draft', values: {}, missing: {}, checks: {}, heard: {}, safety: [], protocolVersion: P.version, designVersion: P.designVersion || '', deviation: deviation || null, startedAt: new Date().toISOString() };
    db.visits.push(r);
    save();
    S.listen = { recId: r.id, text: '', recording: false, interim: '', mode: S.listen.mode };
    go('visit', { recId: r.id, pid: p.id });
  }
  function nextStudyId() {
    const nums = db.participants.map((p) => Number((p.studyId || '').split('-').pop())).filter((n) => !isNaN(n));
    return `${P.idPrefix}-${String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0')}`;
  }
  /* ------------------------------------------------------------------ */
  /* Referral handoff (printable)                                        */
  /* ------------------------------------------------------------------ */
  const REFERRED = 'Referred: handoff given';
  /** What the collector can record for a safety rule. */
  function actionsFor(rule) {
    if (rule.referTo) return rule.level === 'urgent' ? [REFERRED, 'CHDr called and advised', 'Participant declined referral'] : [REFERRED, 'Participant declined referral'];
    if (rule.level === 'urgent' || rule.level === 'soon') return ['Referred', 'CHDr called and advised', 'Participant declined referral'];
    if (rule.level === 'report') return ['Supervisor told'];
    return [];
  }
  /**
   * The sheet the participant takes to the health centre: who they are, why they are referred, what
   * was found today and before, their conditions and medicines, and a slip for the clinician to return.
   * Mental health scores appear only on a mental health referral.
   */
  function handoffHtml(ref) {
    const p = part(ref.participantId), r = rec(ref.visitRecId), site = RS.referralSite(P, ref.to), H = P.handoff;
    const ctx = ctxOf(r);
    const d = RS.derive(P, r.values, ctx);
    const val = (id) => (P.derivedById[id] ? d[id] : r.values[id] != null && r.values[id] !== '' ? r.values[id] : ctx.base[id]);
    const label = (id) => (P.fields[id] || P.derivedById[id] || {}).label || id;
    const unit = (id) => (P.fields[id] || P.derivedById[id] || {}).unit;
    const show = (id) => { const v = val(id); if (v == null || v === '') return ''; const f = P.fields[id]; return f ? fmtValue(f, v) : `${v}${unit(id) && typeof v === 'number' ? ' ' + unit(id) : ''}`; };
    const rows = (ids) => ids.filter((id) => show(id)).map((id) => `<tr><td>${esc(label(id))}</td><td><b>${esc(show(id))}</b></td></tr>`).join('');
    const prev = db.visits.filter((x) => x.participantId === p.id && x.status === 'complete' && x.id !== r.id && x.date <= r.date).sort((a, b) => b.date.localeCompare(a.date))[0];
    const pd = prev ? RS.derive(P, prev.values, ctxOf(prev)) : {};
    const prevVal = (id) => (prev ? (P.derivedById[id] ? pd[id] : prev.values[id]) : null);
    const compare = (H.compare || []).filter((id) => val(id) != null && prevVal(id) != null);
    const sensitive = (H.sensitive || {})[ref.to] || [];
    const c = clusterOf(p);
    return `<article class="handoff">
      <header class="ho-head"><div><div class="ho-kicker">${esc(P.short)} · referral handoff</div><h1>${esc(site.name)}</h1>
        <div class="ho-urg ${ref.urgency}">${ref.urgency === 'urgent' ? 'URGENT: please see today' : 'Please see within 1 week'}</div></div>
        <div class="ho-id"><b>${esc(p.studyId || p.screeningNo)}</b><br>${esc(D.fmtLong(r.date))}</div></header>
      <section><h2>Patient</h2><table><tbody>
        <tr><td>Name</td><td><b>${esc(p.name)}</b></td></tr>
        <tr><td>Age / sex</td><td>${esc(ageText(p))} · ${p.sex === 'F' ? 'Female' : 'Male'}</td></tr>
        <tr><td>Community</td><td>${esc(c.name)}</td></tr>
        <tr><td>Phone</td><td>${esc(p.phone || 'none')}</td></tr>
        <tr><td>Language</td><td>${esc(p.language || '')}</td></tr></tbody></table></section>
      <section><h2>Why they are referred</h2><ul>${ref.reasons.map((x) => `<li><b>${esc(LEVEL[x.level])}:</b> ${esc(x.text)}</li>`).join('')}</ul>${site.note ? `<p>${esc(site.note)}</p>` : ''}</section>
      <section><h2>Findings at this visit (${esc(visitDef(r.visit).label)})</h2><table><tbody>${rows(H.findings)}${rows(sensitive)}${rows(H.symptoms.filter((id) => val(id) === 'yes' || (P.fields[id] && P.fields[id].type === 'text')))}</tbody></table>
        ${compare.length ? `<p class="ho-note">Last study visit (${esc(D.fmtLong(prev.date))}): ${compare.map((id) => `${esc(label(id))} ${esc(prevVal(id))}${unit(id) ? ' ' + esc(unit(id)) : ''}`).join(' · ')}</p>` : ''}</section>
      <section><h2>Known conditions and medicines</h2><table><tbody>${rows(H.history.concat(H.medicines))}</tbody></table></section>
      <section class="ho-from"><p>Referred by <b>${esc(ref.by)}</b>, ${esc(P.short)} data collector (Community Health Officer). Study phone: <b>${esc(P.studyPhone)}</b>.</p>
        <p class="ho-note">These are research measurements taken in the community under the ${esc(P.title.split(':')[0])} protocol (${esc(P.version)}). The study team does not diagnose or prescribe; please assess and treat as usual.</p></section>
      <section class="ho-return"><h2>Return slip: please complete and give back to the patient</h2>
        <table><tbody><tr><td>Seen by</td><td class="line"></td></tr><tr><td>Date</td><td class="line"></td></tr><tr><td>Assessment</td><td class="line"></td></tr><tr><td>Treatment / medicines changed</td><td class="line"></td></tr><tr><td>Follow-up</td><td class="line"></td></tr></tbody></table>
        <p class="ho-note">Study ID ${esc(p.studyId || p.screeningNo)} · referral ${esc(ref.id.slice(-6).toUpperCase())}</p></section>
    </article>`;
  }

  function completeVisit(m) {
    const r = rec(m.recId), p = part(r.participantId), vd = visitDef(r.visit), ctx = ctxOf(r);
    const val = RS.validateVisit(P, vd, r, ctx);
    const safety = RS.safety(P, r.values, ctx);
    const now = new Date().toISOString();
    r.status = 'complete';
    r.date = D.today();
    r.completedAt = now;
    r.collector = me().name;
    r.safety = safety.map((s) => ({ id: s.rule.id, level: s.rule.level, text: s.text, action: m.actions[s.rule.id] || '' }));
    r.listening = listeningAllowed(p) && S.listen.recId === r.id && S.listen.text.trim() ? S.listen.mode : 'off';
    r.checkLog = Object.fromEntries(Object.entries(r.checks || {}).map(([k, d]) => [k, { heard: r.heard[k] ? r.heard[k].value : d.heard, final: r.values[k], decision: d.decision }]));
    delete r.heard;
    // keep only values for fields still shown (answers to questions that were later hidden are dropped)
    const shown = new Set(RS.visitSections(P, vd, r.values, ctx).flatMap((s) => s.fields.map((f) => f.id)));
    Object.keys(r.values).forEach((k) => { if (!shown.has(k)) delete r.values[k]; });
    val.softs.forEach((s) => RS.raiseQuery(db, { participantId: p.id, visitRecId: r.id, field: s.field, text: s.text, by: 'Automatic check', auto: true }));
    safety.filter((s) => s.rule.level === 'report' || s.rule.level === 'urgent').forEach((s) => db.events.push({ id: RS.uid('ev'), kind: s.rule.level === 'report' ? 'Possible SAE' : 'Urgent referral', participantId: p.id, visitRecId: r.id, reportedAt: now, text: s.text + (r.values.admit_reason && s.rule.id === 'sae' ? ` (${r.values.admit_reason})` : ''), status: 'new' }));
    // One referral (and one handoff sheet) per destination, for the rules the collector marked as referred.
    RS.referralsFor(P, safety.filter((s) => m.actions[s.rule.id] === REFERRED)).forEach((g) => db.referrals.push({
      id: RS.uid('ref'), participantId: p.id, visitRecId: r.id, to: g.to, urgency: g.urgency,
      reasons: g.rules.map((s) => ({ id: s.rule.id, level: s.rule.level, text: s.text })), createdAt: now, by: me().name, status: 'open', outcome: null,
    }));
    if (S.listen.recId === r.id) { stopMic(); S.listen = { recId: null, text: '', recording: false, interim: '', mode: S.listen.mode }; }
    if (p.status === 'screening') {
      p.status = 'enrolled';
      p.studyId = nextStudyId();
      p.enrolledAt = D.today();
      p.enrolledBy = me().name;
      delete p.wiz;
      RS.audit(db, { by: me().name, participantId: p.id, what: `Enrolled as ${p.studyId}` });
    }
    save();
    return p;
  }

  const DZ_RESET = () => { RS.study.resetDemo(); try { localStorage.removeItem(RS.STORE_KEY); } catch (e) { /* private mode */ } location.reload(); };
  const handlers = {
    go: (el) => { if (el.dataset.screen === 'initial') { S.pid = null; S.idDraft = null; } go(el.dataset.screen); },
    'set-role': (el) => { S.role = el.dataset.role; saveUi(); S.idDraft = null; S.compose = null; S.msgTab = isSup() ? 'pending' : 'suggested'; go(homeScreen()); },
    'toggle-test': () => { S.test = !S.test; saveUi(); render(); },
    'reset-demo': () => { if (!confirm('Reset all demo data on this device? This also restores the ICEHALL demo study design.')) return; stopMic(); DZ_RESET(); },
    'close-modal': () => closeModal(),
    goto: (el) => { const n = $(el.dataset.target); if (n) n.scrollIntoView({ behavior: 'smooth', block: 'start' }); },
    'goto-field': (el) => { closeModal(); S.tried = true; render(); const n = $('fld-' + el.dataset.field); if (n) n.scrollIntoView({ behavior: 'smooth', block: 'center' }); },

    // initial visit
    'id-set': (el) => { S.idDraft[el.dataset.k] = el.dataset.v; render(); },
    'start-screening': () => {
      const d = S.idDraft;
      const age = Number(d.age);
      const p = {
        id: RS.uid('p'), screeningNo: 'S-' + String(++db.screeningCount).padStart(3, '0'), studyId: '', name: d.name.trim(), sex: d.sex,
        dob: d.dobMode === 'dob' ? d.dob : D.dobFromAge(age), dobEstimated: d.dobMode !== 'dob', cluster: d.cluster, phone: d.phone.trim(), language: d.language,
        status: 'screening', wiz: 'eligibility', screenedAt: D.today(), screening: { answers: {}, by: me().name },
      };
      const mate = d.houseWith && part(d.houseWith);
      if (mate) { if (!mate.household) mate.household = RS.newHouseholdId(db); p.household = mate.household; }
      else p.household = RS.newHouseholdId(db);
      db.participants.push(p);
      save();
      S.idDraft = null;
      go('initial', { pid: p.id });
    },
    'resume-screening': (el) => {
      const p = part(el.dataset.pid);
      if (p.wiz === 'baseline') { const r = RS.draftRec(db, p.id, 'baseline'); go('visit', { recId: r.id, pid: p.id }); } else go('initial', { pid: p.id });
    },
    'screen-fail': () => {
      const p = part(S.pid);
      const el = RS.eligibility(P, p.screening.answers, RS.ctxFor(p));
      p.status = 'screen_fail';
      p.screening.eligible = false;
      p.screenFail = el.failed.map((r) => r.c.text);
      delete p.wiz;
      save();
      toast(`${p.name}: screen failure recorded (${p.screeningNo})`);
      go('participant', { pid: p.id });
    },
    'to-consent': () => { const p = part(S.pid); p.screening.eligible = true; p.wiz = 'consent'; save(); render(); $('view').scrollTop = 0; },
    'consent-set': (el) => { const c = part(S.pid).consentDraft; c[el.dataset.k] = el.dataset.v != null ? el.dataset.v : el.checked; save(); render(); },
    'consent-check': (el) => { part(S.pid).consentDraft.checks[el.dataset.q] = el.dataset.v; save(); render(); },
    'consent-opt': (el) => { part(S.pid).consentDraft.options[el.dataset.k] = el.checked; save(); render(); },
    'consent-declined': () => {
      const p = part(S.pid);
      p.status = 'declined'; p.screenFail = ['Declined consent']; delete p.wiz; delete p.consentDraft;
      save(); toast('Recorded: declined consent'); go('participant', { pid: p.id });
    },
    'consent-given': () => {
      const p = part(S.pid);
      const c = p.consentDraft;
      p.consent = { version: P.consent.version, date: D.today(), method: c.method, witness: c.witness.trim(), copyGiven: c.copyGiven, checksPassed: true, language: c.language, options: Object.assign({}, c.options), by: me().name };
      // The arm is fixed now, before the baseline visit (its sections depend on the arm), and recorded with how it was decided.
      if (P.arms) {
        const a = RS.study.assignArm(db, P, p, { collectorId: S.collectorId, chosen: c.arm, reason: c.armReason });
        p.arm = a.arm;
        p.allocation = { how: a.how, slot: a.slot || null, reason: a.reason || '', at: new Date().toISOString(), by: me().name, designVersion: P.designVersion || '' };
        // The arm is kept as an id and shown per the study's blinding setting, never written into the text.
        RS.audit(db, { by: me().name, participantId: p.id, what: `Assigned to an arm (${RS.study.METHODS[a.how] ? RS.study.METHODS[a.how].label : a.how}${a.slot ? ', allocation ' + a.slot : ''})`, armId: a.arm, reason: a.reason || '' });
      }
      delete p.consentDraft;
      p.wiz = 'baseline';
      RS.audit(db, { by: me().name, participantId: p.id, what: `Consent given (${P.consent.version})` });
      save();
      startVisit(p, P.visits[0]);
    },

    // visit form
    'set-val': (el) => {
      if (el.dataset.mode === 'preview') { S.dz.pv[el.dataset.field] = String(S.dz.pv[el.dataset.field]) === el.dataset.v ? '' : el.dataset.v; renderModal(); return; }
      const r = rec(S.recId);
      const values = el.dataset.mode === 'screen' ? part(S.pid).screening.answers : r.values;
      values[el.dataset.field] = String(values[el.dataset.field]) === el.dataset.v ? '' : el.dataset.v;
      if (r && el.dataset.mode !== 'screen') { delete r.missing[el.dataset.field]; delete r.checks[el.dataset.field]; }
      save(); render();
    },
    'missing-open': (el) => { S.missingOpen = el.dataset.field; render(); },
    'missing-cancel': () => { S.missingOpen = null; render(); },
    'set-missing': (el) => { const r = rec(S.recId); r.missing[el.dataset.field] = el.dataset.v; delete r.values[el.dataset.field]; S.missingOpen = null; save(); render(); },
    unmiss: (el) => { delete rec(S.recId).missing[el.dataset.field]; save(); render(); },
    'use-heard': (el) => {
      const r = rec(S.recId), id = el.dataset.field;
      const h = r.heard[id];
      if (!h) return;
      const before = r.values[id];
      r.values[id] = h.value;
      delete r.missing[id];
      if (before != null && before !== '') r.checks[id] = { decision: 'used heard', heard: h.value, entered: before };
      save(); render();
    },
    'keep-entered': (el) => { const r = rec(S.recId), id = el.dataset.field; r.checks[id] = { decision: 'kept entered', heard: r.heard[id] && r.heard[id].value, entered: r.values[id] }; save(); render(); },
    'listen-mode': (el) => { S.listen.mode = el.dataset.v; render(); },
    'toggle-mic': () => { const r = rec(S.recId); if (S.listen.recording) stopMic(); else { if (S.listen.recId !== r.id) S.listen.text = ''; startMic(r); } render(); },
    'save-draft': () => { const r = rec(S.recId); stopMic(); save(); toast('Saved. Continue it later from the participant record.'); go('participant', { pid: r.participantId }); },
    'complete-visit': () => { S.tried = true; openModal({ type: 'complete', recId: S.recId, actions: {} }); render(); },
    'safety-act': (el) => { S.modal.actions[el.dataset.rule] = el.dataset.v; renderModal(); },
    'confirm-complete': () => {
      const wasScreening = part(rec(S.modal.recId).participantId).status === 'screening';
      const r = rec(S.modal.recId);
      const p = completeVisit(S.modal);
      S.modal = null;
      const refs = db.referrals.filter((x) => x.visitRecId === r.id);
      go('participant', { pid: p.id });
      if (refs.length) openModal({ type: 'handoff', refId: refs[0].id, all: refs.map((x) => x.id), enrolled: wasScreening });
      else if (wasScreening) openModal({ type: 'enrolled', pid: p.id });
      else toast('Visit completed');
    },
    // referrals
    'handoff-tab': (el) => { S.modal.refId = el.dataset.ref; renderModal(); },
    'view-handoff': (el) => openModal({ type: 'handoff', refId: el.dataset.ref, all: [el.dataset.ref] }),
    'print-handoff': (el) => {
      const ref = db.referrals.find((x) => x.id === el.dataset.ref);
      $('print').innerHTML = handoffHtml(ref);
      ref.printedAt = ref.printedAt || new Date().toISOString();
      save();
      window.print();
    },
    'referral-outcome': (el) => openModal({ type: 'outcome', refId: el.dataset.ref, status: '', date: D.today(), text: '' }),
    'confirm-outcome': () => {
      const m = S.modal, ref = db.referrals.find((x) => x.id === m.refId);
      ref.status = m.status;
      ref.outcome = { date: m.date, text: (m.text || '').trim(), by: me().name };
      RS.audit(db, { by: me().name, participantId: ref.participantId, what: `Referral to ${RS.referralSite(P, ref.to).name}: ${m.status === 'seen' ? 'seen' : 'did not attend'}`, reason: ref.outcome.text });
      save(); closeModal(); render();
    },
    // households
    household: (el) => openModal({ type: 'household', pid: el.dataset.pid, with: '' }),
    'confirm-household': () => {
      const m = S.modal, p = part(m.pid);
      const before = p.household;
      if (m.with === 'new') p.household = RS.newHouseholdId(db);
      else { const mate = part(m.with); if (!mate.household) mate.household = RS.newHouseholdId(db); p.household = mate.household; }
      RS.audit(db, { by: me().name, participantId: p.id, what: `Household ${before || 'none'} → ${p.household}` });
      save(); closeModal(); render();
    },

    // records and participant
    'rec-filter': (el) => { S.recFilter = el.dataset.v; render(); },
    'open-participant': (el) => go('participant', { pid: el.dataset.pid }),
    'open-rec': (el) => { const r = rec(el.dataset.rec); go(r.status === 'draft' ? 'visit' : 'visitview', { recId: r.id, pid: r.participantId }); },
    'start-visit': (el) => {
      const p = part(el.dataset.pid), v = visitDef(el.dataset.visit);
      if (RS.visitStatus(db, p, v) === 'missed') openModal({ type: 'late', pid: p.id, visit: v.id, category: P.deviationCategories[0], note: '' });
      else startVisit(p, v);
    },
    'confirm-late': () => { const m = S.modal; S.modal = null; startVisit(part(m.pid), visitDef(m.visit), { category: m.category, note: (m.note || '').trim() }); },
    withdraw: (el) => openModal({ type: 'withdraw', pid: el.dataset.pid, reason: '', dataUse: 'Keep data already collected (de-identified)' }),
    'confirm-withdraw': () => {
      const m = S.modal, p = part(m.pid);
      p.status = 'withdrawn';
      p.withdrawal = { date: D.today(), reason: m.reason, dataUse: m.dataUse, by: me().name };
      RS.audit(db, { by: me().name, participantId: p.id, what: 'Withdrawn', reason: m.reason });
      save(); closeModal(); render(); toast(`${p.name} withdrawn`);
    },
    'consent-change': (el) => { const p = part(el.dataset.pid); openModal({ type: 'consent-change', pid: p.id, options: Object.assign({}, p.consent.options), signed: false }); },
    'modal-opt': (el) => { S.modal.options[el.dataset.k] = el.checked; renderModal(); },
    'modal-flag': (el) => { S.modal[el.dataset.k] = el.checked; renderModal(); },
    'confirm-consent-change': () => {
      const m = S.modal, p = part(m.pid);
      const changed = P.consent.options.filter((o) => !!m.options[o.id] !== !!p.consent.options[o.id]);
      changed.forEach((o) => RS.audit(db, { by: me().name, participantId: p.id, what: `Optional part ${m.options[o.id] ? 'added' : 'stopped'}: ${o.text}` }));
      p.consent.options = m.options;
      save(); closeModal(); render(); if (changed.length) toast('Optional parts updated');
    },
    'show-sensitive': (el) => { S.showSensitive[el.dataset.k] = true; RS.audit(db, { by: me().name, participantId: rec(S.recId).participantId, visitRecId: null, what: 'Viewed sensitive (mental health) answers' }); save(); render(); },

    // queries and corrections
    'raise-query': (el) => openModal({ type: 'query', recId: el.dataset.rec, field: el.dataset.field, text: '' }),
    'confirm-query': () => { const m = S.modal, r = rec(m.recId); RS.raiseQuery(db, { participantId: r.participantId, visitRecId: r.id, field: m.field, text: m.text.trim(), by: me().name, auto: false }); save(); closeModal(); render(); toast('Query sent to the data collector'); },
    'answer-query': (el) => openModal({ type: 'answer', q: el.dataset.q, text: '' }),
    'confirm-answer': () => { const q = db.queries.find((x) => x.id === S.modal.q); q.thread.push({ by: me().name, at: new Date().toISOString(), text: S.modal.text.trim() }); q.status = 'answered'; save(); closeModal(); render(); toast('Answer sent'); },
    'close-query': (el) => { const q = db.queries.find((x) => x.id === el.dataset.q); q.status = 'closed'; q.closedBy = me().name; q.closedAt = new Date().toISOString(); save(); render(); },
    'reopen-query': (el) => { const q = db.queries.find((x) => x.id === el.dataset.q); q.status = 'open'; save(); render(); },
    correct: (el) => { const r = rec(el.dataset.rec); const v = r.values[el.dataset.field]; openModal({ type: 'correct', recId: r.id, field: el.dataset.field, value: v == null ? '' : String(v), reason: '' }); },
    'modal-set': (el) => { S.modal[el.dataset.k] = el.dataset.v; renderModal(); },
    'confirm-correct': () => {
      const m = S.modal, r = rec(m.recId), f = P.fields[m.field];
      const to = parseVal(f, m.value);
      RS.audit(db, { by: me().name, participantId: r.participantId, visitRecId: r.id, field: m.field, from: r.values[m.field] != null ? r.values[m.field] : (r.missing[m.field] ? `[missing: ${r.missing[m.field]}]` : ''), to, reason: m.reason });
      r.values[m.field] = to;
      delete r.missing[m.field];
      save(); closeModal(); render(); toast('Corrected (kept in the audit trail)');
    },
    'mark-reviewed': (el) => { rec(el.dataset.rec).reviewed = { by: me().name, at: new Date().toISOString() }; save(); render(); toast('Marked reviewed'); },
    'assess-event': (el) => openModal({ type: 'assess', ev: el.dataset.ev, text: '' }),
    'confirm-assess': () => { const e = db.events.find((x) => x.id === S.modal.ev); e.status = 'assessed'; e.assessment = S.modal.text.trim(); e.by = me().name; save(); closeModal(); render(); },
    'review-tab': (el) => { S.reviewTab = el.dataset.v; render(); },
    'an-measure': (el) => { S.an.measure = el.dataset.v; render(); },
    export: (el) => {
      const k = el.dataset.k, day = D.today();
      if (k === 'visits') download(`icehall-visits-${day}.csv`, RS.exportVisits(db, P));
      else if (k === 'participants') download(`icehall-participants-${day}.csv`, RS.exportParticipants(db));
      else download(`icehall-audit-${day}.csv`, RS.toCSV([['when', 'by', 'study_id', 'field', 'from', 'to', 'what', 'reason'], ...db.audit.map((a) => [a.at, a.by, (part(a.participantId) || {}).studyId, a.field, a.from, a.to, a.what, a.reason])]));
    },

    // schedule
    'group-by': (el) => { S.groupBy = el.dataset.v; render(); },
    remind: (el) => {
      const p = part(el.dataset.pid), v = visitDef(el.dataset.visit);
      S.compose = { audience: 'person:' + p.id, template: 'reminder', text: RS.fillMessage(P.messages.templates.reminder.text, RS.messageVars(P, p, v, me().name)), kind: 'reminder', key: `${p.id}:${v.id}` };
      go('messages', { msgTab: 'compose' });
    },

    // messages
    'msg-tab': (el) => { S.msgTab = el.dataset.v; render(); },
    'compose-to': (el) => { S.compose = { audience: 'person:' + el.dataset.pid, template: 'general', text: P.messages.templates.general.text }; go('messages', { msgTab: 'compose' }); },
    'compose-send': () => {
      const c = S.compose, aud = audienceOf(c.audience);
      const recipients = aud.ok.map((p) => ({ participantId: p.id, phone: p.phone, text: RS.fillMessage(c.text, RS.messageVars(P, p, null, me().name)) }));
      const status = aud.group ? 'pending' : 'sent';
      sendMessage(c.kind || (aud.group ? 'group' : 'custom'), c.key, aud.label, recipients, status);
      S.compose = null;
      toast(status === 'pending' ? 'Sent to the supervisor for approval' : `Sent to ${recipients.length} ${recipients.length === 1 ? 'person' : 'people'}`);
      S.msgTab = status === 'pending' ? 'pending' : 'sent';
      render();
    },
    'sug-send': (el) => { const s = suggestions()[Number(el.dataset.i)]; sendMessage(s.kind, s.key, pLabel(s.participant), [{ participantId: s.participant.id, phone: s.participant.phone, text: s.text }], 'sent'); toast('Sent to ' + s.participant.name); render(); },
    'sug-edit': (el) => { const s = suggestions()[Number(el.dataset.i)]; S.compose = { audience: 'person:' + s.participant.id, template: s.kind === 'encouragement' ? 'general' : s.kind, text: s.text, kind: s.kind, key: s.key }; S.msgTab = 'compose'; render(); },
    'sug-dismiss': (el) => { const s = suggestions()[Number(el.dataset.i)]; db.dismissed[dismissKey(s)] = D.today(); save(); render(); },
    // Approving releases the collector's message; it goes out from the collector's tablet (or the gateway).
    'msg-approve': (el) => { const m = db.messages.find((x) => x.id === el.dataset.m); m.status = 'sent'; m.sentAt = new Date().toISOString(); m.sentBy = m.createdBy; m.approvedBy = me().name; save(); render(); toast('Approved: released to send'); },
    'msg-reject': (el) => { const m = db.messages.find((x) => x.id === el.dataset.m); m.status = 'returned'; save(); render(); toast('Sent back to ' + m.createdBy); },
  };

  /* ------------------------------------------------------------------ */
  /* Events                                                              */
  /* ------------------------------------------------------------------ */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const h = handlers[el.dataset.action];
    if (!h) return;
    if (el.tagName !== 'INPUT') e.preventDefault();
    const a = el.dataset.action;
    if (isSup() ? COLLECTOR_ONLY.has(a) : SUPERVISOR_ONLY.has(a) || (/^(dz-|xp$)/.test(a) && !/^dz-blank/.test(a))) { toast(isSup() ? 'The supervisor view is for review: data collectors run visits and message participants.' : 'Only the supervisor can do this.'); return; }
    h(el, e);
  });
  // Belt and braces: the buttons are hidden in the other view too.
  const COLLECTOR_ONLY = new Set(['start-screening', 'start-visit', 'confirm-late', 'complete-visit', 'confirm-complete', 'withdraw', 'confirm-withdraw', 'consent-change', 'confirm-consent-change', 'remind', 'compose-to', 'compose-send', 'sug-send', 'sug-edit', 'answer-query', 'referral-outcome', 'confirm-outcome', 'household', 'confirm-household', 'resume-screening']);
  const SUPERVISOR_ONLY = new Set(['raise-query', 'confirm-query', 'close-query', 'reopen-query', 'correct', 'confirm-correct', 'mark-reviewed', 'assess-event', 'confirm-assess', 'msg-approve', 'msg-reject', 'export']);
  Object.assign(handlers, DZ.handlers);
  document.addEventListener('input', (e) => {
    const el = e.target;
    const k = el.dataset.input;
    if (!k) return;
    if (DZ.onInput(el)) return;
    if (k === 'val' && el.dataset.mode === 'preview') { S.dz.pv[el.dataset.field] = el.value; return; }
    if (k === 'id') { S.idDraft[el.dataset.k] = el.value; render(); }
    else if (k === 'consent') { part(S.pid).consentDraft[el.dataset.k] = el.value; save(); render(); }
    else if (k === 'q') { S.q = el.value; render(); }
    else if (k === 'modal') { S.modal[el.dataset.k] = el.value; renderModal(); const n = $(el.id); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }
    else if (k === 'compose-text') { S.compose.text = el.value; render(); }
    else if (k === 'transcript') { S.listen.recId = S.recId; S.listen.text = el.value; render(); }
    else if (k === 'val') {
      const f = P.fields[el.dataset.field];
      const values = el.dataset.mode === 'screen' ? part(S.pid).screening.answers : rec(S.recId).values;
      values[f.id] = parseVal(f, el.value);
      if (el.dataset.mode !== 'screen') { const r = rec(S.recId); delete r.missing[f.id]; delete r.checks[f.id]; }
      save(); render();
    }
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    const k = el.dataset.change;
    if (!k) return;
    if (DZ.onChange(el)) return;
    if (k === 'id') { S.idDraft[el.dataset.k] = el.value; if (el.dataset.k === 'cluster') S.idDraft.houseWith = ''; render(); }
    else if (k === 'modal') { S.modal[el.dataset.k] = el.value; renderModal(); }
    else if (k === 'collector') { S.collectorId = el.value; S.role = 'COLLECTOR'; saveUi(); S.idDraft = null; S.compose = null; go(['participant', 'visitview', 'records', 'messages', 'protocol'].includes(S.screen) ? S.screen : 'schedule'); }
    else if (k === 'filter') { S.f[el.dataset.k] = el.value; render(); }
    else if (k === 'an') { S.an[el.dataset.k] = el.value; render(); }
    else if (k === 'rec-cluster') { S.recCluster = el.value; render(); }
    else if (k === 'compose') {
      S.compose[el.dataset.k] = el.value;
      if (el.dataset.k === 'template') S.compose.text = P.messages.templates[el.value].text;
      S.compose.kind = null; S.compose.key = null;
      render();
    } else if (k === 'demo-talk' && el.value !== '') {
      S.listen.recId = S.recId;
      S.listen.text = (S.listen.text ? S.listen.text + '\n' : '') + RS.DEMO_TALK[Number(el.value)].text;
      render();
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && S.modal) closeModal(); });
  document.addEventListener('pointermove', (e) => { if (e.target.closest && e.target.closest('.chart .hit')) chartHover(e); });
  document.addEventListener('pointerout', (e) => { if (e.target.classList && e.target.classList.contains('hit')) chartLeave(e); });

  render();
})();
