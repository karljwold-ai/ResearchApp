/*
 * Exports for the data centre and for other systems. De-identified by default: study IDs and
 * household IDs only. Every export comes with a codebook (data dictionary) so the columns can be read.
 *
 *   exportLong        one row per answer (long format)
 *   codebook          every variable: section, question, type, unit, answer codes, limits, status
 *   redcapDictionary  the design as a REDCap data dictionary (to build the same forms in REDCap)
 *   archive           everything as JSON, including the audit trail and the design versions
 * (RS.exportVisits and RS.exportParticipants, in core.js, give one row per visit and per participant.)
 */
(function () {
  'use strict';
  const G = typeof window !== 'undefined' ? window : global;
  const RS = G.RS;
  const blank = (x) => x == null || x === '';
  const TYPE_TEXT = { yesno: 'yes/no', choice: 'choose one', number: 'number', bp: 'blood pressure (systolic/diastolic)', date: 'date (YYYY-MM-DD)', text: 'free text' };
  const armName = (p) => (RS.armName ? RS.armName(RS.armOf(p)) : '');

  /** Every variable with its section, in design order: screening, then each section, then calculated, then retired. */
  function variables(proto) {
    const out = [];
    (proto.screening.fields || []).forEach((f) => out.push({ f, section: 'screening', sectionTitle: proto.screening.title || 'Screening', status: 'active' }));
    Object.entries(proto.forms).forEach(([id, form]) => form.fields.forEach((f) => out.push({ f, section: id, sectionTitle: form.title, status: 'active', arms: form.arms })));
    (proto.derived || []).forEach((d) => out.push({ f: { id: d.id, label: d.label, type: 'calculated', unit: d.unit, expr: d.expr }, section: 'calculated', sectionTitle: 'Calculated values', status: 'active' }));
    (proto.retired || []).forEach((f) => out.push({ f, section: f.retiredFrom || '', sectionTitle: ((proto.forms[f.retiredFrom] || {}).title) || f.retiredFrom || '', status: 'retired' }));
    return out;
  }

  function codebook(proto) {
    const armsText = (ids) => (!ids || !ids.length ? 'all' : ids.map((id) => (RS.armName ? RS.armName(id) : id)).join('; '));
    const rows = [['variable', 'section', 'section_title', 'question', 'type', 'unit', 'answer_codes', 'min', 'max', 'whole_numbers', 'required', 'ask_only_if', 'calculation', 'arms', 'status']];
    variables(proto).forEach(({ f, section, sectionTitle, status, arms }) => {
      const type = f.type === 'number' && f.integer ? 'whole number' : TYPE_TEXT[f.type] || f.type;
      const codes = f.type === 'yesno' ? 'yes=Yes; no=No' : (f.options || []).map(([k, l]) => `${k}=${l}`).join('; ');
      rows.push([f.id, section, sectionTitle, f.label, type, f.unit || '', codes, f.min != null ? f.min : '', f.max != null ? f.max : '', f.integer ? 'yes' : '', f.required ? 'yes' : '', f.show || '', f.expr || '', section === 'screening' || section === 'calculated' ? '' : armsText(arms), status]);
      if (f.required && section !== 'calculated') rows.push([f.id + '_missing_reason', section, sectionTitle, `Why ${f.label} is missing`, 'choose one', '', (proto.missingReasons || []).join('; '), '', '', '', '', '', '', '', status]);
    });
    return RS.toCSV(rows);
  }

  /** One row per answer: easy to filter and pivot, and new questions never change the columns. */
  function exportLong(db, proto) {
    const sectionOf = {};
    variables(proto).forEach(({ f, section }) => { sectionOf[f.id] = section; });
    const rows = [['study_id', 'household_id', 'cluster', 'arm', 'visit', 'visit_date', 'design_version', 'section', 'variable', 'value', 'missing_reason']];
    db.visits.filter((r) => r.status === 'complete').sort((a, b) => a.date.localeCompare(b.date)).forEach((r) => {
      const p = db.participants.find((x) => x.id === r.participantId);
      const ids = new Set([...Object.keys(r.values || {}), ...Object.keys(r.missing || {})]);
      ids.forEach((id) => {
        const v = (r.values || {})[id];
        const miss = (r.missing || {})[id];
        if (blank(v) && !miss) return;
        rows.push([p.studyId, p.household || '', p.cluster, armName(p), r.visit, r.date, r.designVersion || '', sectionOf[id] || '', id, blank(v) ? '' : v, miss || '']);
      });
    });
    return RS.toCSV(rows);
  }

  /**
   * REDCap data dictionary. Conditions use a different syntax in REDCap, so "ask only if" goes in the
   * annotation column for someone to translate; calculated values are left as notes for the same reason.
   */
  function redcapDictionary(proto) {
    const head = ['Variable / Field Name', 'Form Name', 'Section Header', 'Field Type', 'Field Label', 'Choices, Calculations, OR Slider Labels', 'Field Note', 'Text Validation Type OR Show Slider Number', 'Text Validation Min', 'Text Validation Max', 'Identifier?', 'Branching Logic (Show field only if...)', 'Required Field?', 'Custom Alignment', 'Question Number (surveys only)', 'Matrix Group Name', 'Matrix Ranking?', 'Field Annotation'];
    const rows = [head, ['record_id', 'screening', '', 'text', 'Study ID', '', '', '', '', '', '', '', '', '', '', '', '', '']];
    const form = (s) => s.replace(/[^a-z0-9_]/g, '_');
    variables(proto).filter((x) => x.status === 'active').forEach(({ f, section, sectionTitle }, i, all) => {
      const first = i === 0 || all[i - 1].section !== section;
      let type = 'text', choices = '', valid = '';
      if (f.type === 'yesno') type = 'yesno';
      else if (f.type === 'choice') { type = 'radio'; choices = (f.options || []).map(([k, l]) => `${k}, ${l}`).join(' | '); }
      else if (f.type === 'number') valid = f.integer ? 'integer' : 'number';
      else if (f.type === 'date') valid = 'date_ymd';
      else if (f.type === 'calculated') type = 'descriptive';
      const note = [f.unit, f.help].filter(Boolean).join(' · ');
      const ann = [f.show ? `@JAMII-SHOW-IF: ${f.show}` : '', f.expr ? `@JAMII-CALC: ${f.expr}` : '', f.type === 'bp' ? '@JAMII-TYPE: blood pressure as systolic/diastolic' : ''].filter(Boolean).join(' ');
      rows.push([f.id, form(section), first ? sectionTitle : '', type, f.label, choices, note, valid, f.min != null ? f.min : '', f.max != null ? f.max : '', '', '', f.required ? 'y' : '', '', '', '', '', ann]);
    });
    return RS.toCSV(rows);
  }

  /** Everything, for archiving. Names and phone numbers only when `identified`. */
  function archive(db, proto, o) {
    o = o || {};
    const st = RS.study ? RS.study.state() : null;
    const strip = (p) => {
      const x = JSON.parse(JSON.stringify(p));
      if (!o.identified) { delete x.name; delete x.phone; delete x.dob; delete x.consentDraft; if (x.screening) delete x.screening.identity; }
      return x;
    };
    return JSON.stringify({
      exportedAt: new Date().toISOString(), identified: !!o.identified,
      study: { title: proto.title, short: proto.short, protocolVersion: proto.version, designVersion: proto.designVersion || '' },
      designVersions: st ? st.published.map((v) => ({ version: v.version, at: v.at, by: v.by, reason: v.reason, design: v.design })) : [],
      participants: db.participants.map(strip), visits: db.visits.filter((r) => r.status === 'complete'),
      queries: db.queries, referrals: db.referrals, safetyEvents: db.events, messages: db.messages.map((m) => Object.assign({}, m, o.identified ? {} : { recipients: undefined })), audit: db.audit,
    }, null, 2);
  }

  function exportAudit(db) {
    const rows = [['time', 'by', 'participant', 'visit_record', 'field', 'from', 'to', 'what', 'reason']];
    db.audit.forEach((a) => {
      const p = a.participantId ? db.participants.find((x) => x.id === a.participantId) : null;
      rows.push([a.at, a.by, p ? p.studyId || p.screeningNo : '', a.visitRecId || '', a.field || '', a.from == null ? '' : a.from, a.to == null ? '' : a.to, (a.what || '') + (a.armId && RS.armName ? ': ' + RS.armName(a.armId) : ''), a.reason || '']);
    });
    return RS.toCSV(rows);
  }

  RS.exportLong = exportLong;
  RS.codebook = codebook;
  RS.redcapDictionary = redcapDictionary;
  RS.archive = archive;
  RS.exportAudit = exportAudit;
  RS.exportVariables = variables;
}());
