/*
 * Demo staff, participants and conversations for the ICEHALL v08 protocol (Mauritius site).
 * Everything here is invented. Dates are relative to today so the schedule always has
 * visits that are missed, due and coming up.
 */
(function () {
  'use strict';
  const RS = (typeof window !== 'undefined' ? window : global).RS;
  const D = RS.date;

  RS.USERS = {
    COLLECTOR: { id: 'u1', name: 'Ravi Ramdin', role: 'Data collector (CHO)', short: 'Collector' },
    SUPERVISOR: { id: 'u2', name: 'Shabnam Peerbux', role: 'Site supervisor', short: 'Supervisor' },
  };

  // Conversations to paste into the listening panel (test tools).
  RS.DEMO_TALK = [
    { label: 'Follow-up: matches what was said', text: `Collector: I will take your blood pressure three times. First reading is 152 over 94.
Collector: Second reading 148 over 92. Third reading 146 over 90.
Collector: Pulse is 84. On the scale you weigh 71 kilos. Your waist is 96 centimetres.
Collector: Have you been admitted to hospital since my last visit?
Participant: No, not been to the hospital.
Collector: Any chest pain?
Participant: No chest pain.
Collector: Which medicines are you taking?
Participant: Amlodipine for the pressure, and metformin. No insulin.
Collector: And a cholesterol tablet?
Participant: Yes, atorvastatin.` },
    { label: 'Follow-up: very high BP', text: `Collector: First reading is 188 over 114. Second reading 184 over 112. Third reading 182 over 110.
Collector: Pulse 96. You weigh 64 kilos.
Participant: I stopped the blood pressure tablets two weeks ago, they ran out.
Collector: Have you been in hospital?
Participant: No hospital.
Collector: Any chest pain?
Participant: No chest pain, but a bad headache.` },
  ];

  // Typical answers for the demo; anything not listed gets a neutral value for its type.
  const TYPICAL = {
    education: 'secondary', occupation: 'employed', household: 4, income_band: '3', move_2y: 'no',
    dm_hypo_hx: 'no', dm_dka_hx: 'no', cvd_hx: 'no', ckd_hx: 'no', smoking: 'never', alcohol: 'none', pregnant: 'no', pregnant_now: 'no', snoring: 'no', joint_pain: 'no',
    admitted: 'no', ed_visits: 0, chest_pain: 'no', dm_red_flags: 'no', severe_hypo: 'no',
    on_statin: 'no', med_access: 'no', med_cost: 0, pulse: 76,
    blood_taken: 'yes', chol_total: 5.1, hdl: 1.2, trig: 1.6, creat: 82, egfr: 84,
    predimed: 7, food_security: 'secure', cook: 'self', vig_days: 0, mod_days: 2, mod_min: 30, walk_days: 4, walk_min: 20, sit_min: 300,
    eq_vas: 75, exp_trust: '4', exp_benefit: '4', exp_burden: '2', opd_visits: 1, hosp_nights: 0, oop_cost: 400, work_days_lost: 0, catastrophic: 'no',
  };
  function neutral(f) {
    if (f.type === 'yesno') return 'no';
    if (f.type === 'choice') return /^(phq|gad)_/.test(f.id) ? '0' : /^mars_/.test(f.id) ? '5' : /^eq_/.test(f.id) ? '1' : f.options[0][0];
    if (f.type === 'number') return f.soft ? Math.round((f.soft[0] + f.soft[1]) / 2) : f.min || 0;
    return '';
  }

  /** Plausible completed-visit values (deterministic per participant and visit). */
  function visitValues(proto, part, visitId, b, ctx) {
    const seed = (part.screeningNo + visitId).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const r = (k, spread) => ((seed * (k + 7)) % (2 * spread + 1)) - spread;
    const s = b.sys + r(1, 6), d = b.dia + r(2, 4);
    const v = Object.assign({}, TYPICAL, {
      bp_1: `${s + 6}/${d + 3}`, bp_2: `${s + 2}/${d + 1}`, bp_3: `${s}/${d}`, pulse: 72 + r(3, 10),
      weight: Math.round((b.weight + r(4, 2) / 2) * 10) / 10, height: b.height, waist: b.waist + r(5, 2),
      on_htn_meds: b.htnMeds ? 'yes' : 'no', on_dm_meds: b.dmMeds ? 'yes' : 'no', on_insulin: 'no', med_list: [b.htnMeds, b.dmMeds].filter(Boolean).join('; '),
      hba1c: b.hba1c != null ? Math.round((b.hba1c + r(6, 3) / 10) * 10) / 10 : null, dm_dx_age: b.dmAge, mars_2: '4',
      phq_1: '1', phq_3: '1', phq_4: '1', gad_2: '1', eq_pain: '2',
    });
    const out = {};
    for (let pass = 0; pass < 3; pass++) { // repeat so answers that reveal more questions are filled too
      const vd = proto.visits.find((x) => x.id === visitId);
      RS.visitSections(proto, vd, out, ctx).forEach(({ fields }) => fields.forEach((f) => {
        if (out[f.id] != null) return;
        const x = v[f.id] !== undefined ? v[f.id] : neutral(f);
        if (x !== '' && x != null) out[f.id] = x;
      }));
    }
    return out;
  }

  RS.seed = function () {
    const proto = RS.protocols['icehall-v08'];
    const db = RS.emptyDb();
    const today = D.today();
    const ago = (n) => D.addDays(today, -n);
    const C = RS.USERS.COLLECTOR.name, SUP = RS.USERS.SUPERVISOR.name;
    const allOpts = (over) => Object.assign({ contact: true, records: true, cmh: true, qual: false, pgd: false, future: true, audio: false }, over);
    const consent = (date, over, how) => ({ version: proto.consent.version, date, method: how || 'signature', witness: how === 'thumbprint' ? 'Marie Lafleur (neighbour, impartial witness)' : '', copyGiven: true, checksPassed: true, language: 'Kreol Morisien', options: allOpts(over), by: C });

    // [name, sex, age, cluster, phone, enrolled days ago, visits done, base values, consent options, consent method]
    const people = [
      ['Anjali Doorgakant', 'F', 56, 'esperance', '5 701 2201', 372, ['baseline', 'm3', 'm6', 'm9'], { sys: 148, dia: 90, weight: 74, height: 156, waist: 98, dm: true, htn: true, hba1c: 7.6, dmAge: 48, htnMeds: 'Amlodipine 5 mg', dmMeds: 'Metformin 500 mg twice daily' }, { audio: true }],
      ['Jean-Marc Laval', 'M', 63, 'escalier', '5 701 2202', 190, ['baseline', 'm3'], { sys: 162, dia: 96, weight: 82, height: 172, waist: 104, htn: true, htnMeds: 'Losartan 50 mg' }, { audio: true }, 'thumbprint'],
      ['Fatima Joomun', 'F', 47, 'pretres', '5 701 2203', 118, ['baseline'], { sys: 128, dia: 82, weight: 69, height: 158, waist: 92, dm: true, hba1c: 8.1, dmAge: 44, dmMeds: 'Metformin 850 mg twice daily' }, { cmh: false }],
      ['Rajesh Seebaluck', 'M', 59, 'esperance', '', 80, ['baseline'], { sys: 158, dia: 98, weight: 88, height: 170, waist: 108, dm: true, htn: true, hba1c: 8.8, dmAge: 50, htnMeds: 'Amlodipine 10 mg', dmMeds: 'Metformin 1 g twice daily; gliclazide 80 mg' }, { audio: true, contact: false }],
      ['Marie-Claire Perrine', 'F', 41, 'rodrigues', '5 701 2205', 72, ['baseline'], { sys: 146, dia: 94, weight: 112, height: 141, waist: 118, htn: true, htnMeds: '' }, {}],
      ['Vikash Gopee', 'M', 68, 'escalier', '5 701 2206', 220, ['baseline', 'm3'], { sys: 150, dia: 88, weight: 64, height: 166, waist: 90, htn: true, htnMeds: 'Amlodipine 5 mg' }, {}],
      ['Nadia Bhunjun', 'F', 52, 'pretres', '5 701 2208', 268, ['baseline', 'm3', 'm6'], { sys: 138, dia: 86, weight: 77, height: 160, waist: 101, dm: true, hba1c: 8.6, dmAge: 45, dmMeds: 'Metformin 1 g twice daily' }, { audio: true }],
      ['Louis Bégué', 'M', 71, 'rodrigues', '5 701 2209', 545, ['baseline', 'm3', 'm6', 'm9', 'm12'], { sys: 154, dia: 84, weight: 70, height: 168, waist: 97, htn: true, htnMeds: 'Amlodipine 10 mg; hydrochlorothiazide 25 mg' }, {}],
    ];
    people.forEach(([name, sex, age, cluster, phone, enrolledAgo, done, b, opts, how], i) => {
      const enrolledAt = ago(enrolledAgo);
      const p = {
        id: 'p' + (i + 1), screeningNo: 'S-' + String(i + 1).padStart(3, '0'), studyId: proto.idPrefix + '-' + String(i + 1).padStart(4, '0'),
        name, sex, dob: D.dobFromAge(age, enrolledAt), dobEstimated: true, cluster, phone, language: 'Kreol Morisien',
        status: 'enrolled', screenedAt: enrolledAt, enrolledAt, enrolledBy: C,
        screening: {
          answers: { resident: 'yes', stay_12m: 'yes', willing_baseline: 'yes', can_consent: 'yes', other_trial: 'no', dm_known: b.dm ? 'yes' : 'no', type1_or_gdm: b.dm ? 'no' : '', screen_hba1c: '', htn_known: b.htnMeds ? 'yes' : 'no', screen_bp: `${b.sys + 4}/${b.dia + 2}`, cv_risk_high: 'no', emergency_now: 'no' },
          eligible: true, by: C,
        },
        consent: consent(enrolledAt, opts, how),
      };
      db.participants.push(p);
      done.forEach((vid) => {
        const vd = proto.visits.find((v) => v.id === vid);
        const w = RS.visitWindow(p, vd);
        let date = vid === 'baseline' ? enrolledAt : D.addDays(w.ideal, ((i % 3) - 1) * 3);
        if (date > today) date = today;
        const rec = { id: `v${i + 1}-${vid}`, participantId: p.id, visit: vid, date, collector: C, status: 'complete', values: {}, missing: {}, checks: {}, safety: [], completedAt: date + 'T11:00:00', protocolVersion: proto.version, listening: 'off', reviewed: vid === 'baseline' && i < 4 ? { by: SUP, at: date + 'T16:00:00' } : null };
        rec.values = visitValues(proto, p, vid, b, RS.ctxForVisit(db, p, rec));
        db.visits.push(rec);
      });
    });

    // Lipid results not back yet for the most recent baseline.
    const mc = db.visits.find((r) => r.id === 'v5-baseline');
    ['chol_total', 'hdl', 'creat'].forEach((k) => { delete mc.values[k]; mc.missing[k] = 'Result not back yet'; });
    delete mc.values.trig; delete mc.values.egfr;
    // A supervisor query: weight 112 kg with height 141 cm.
    RS.raiseQuery(db, { participantId: 'p5', visitRecId: mc.id, field: 'height', text: 'Height 141 cm with weight 112 kg (BMI 56). Please confirm both were measured (stadiometer and scale), not reported.', by: SUP, auto: false, raisedAt: ago(70) + 'T09:00:00' });
    // An automatic query on an unusual value, answered by the collector.
    const fv = db.visits.find((r) => r.id === 'v1-m6');
    fv.values.pulse = 124;
    const q = RS.raiseQuery(db, { participantId: 'p1', visitRecId: fv.id, field: 'pulse', text: 'Unusual value (expected 45–120 /min). Check and confirm.', by: 'Automatic check', auto: true, raisedAt: fv.completedAt });
    q.thread.push({ by: C, at: fv.completedAt, text: 'Re-measured after 10 minutes rest: still 124. She had walked up the hill from the bus stop. Advised clinic check.' });
    q.status = 'answered';

    // Nadia: admitted before the 6-month visit (reportable event, assessed). HbA1c stays high.
    const nv = db.visits.find((r) => r.id === 'v7-m6');
    Object.assign(nv.values, { admitted: 'yes', admit_reason: 'Pneumonia, 4 nights at Victoria Hospital', ed_visits: 1, hba1c: 8.4 });
    nv.safety = [
      { id: 'hba1c_high_twice', level: 'soon', text: 'HbA1c 8.4% and 8.6% last time: 1% or more above target at two visits. CHDr review for medicine change or referral.', action: 'CHDr review booked' },
      { id: 'sae', level: 'report', text: 'Hospital admission: possible serious adverse event. Tell the supervisor within 24 hours.', action: 'Supervisor told by phone the same day' },
    ];
    db.events.push({ id: 'ev-1', kind: 'SAE', participantId: 'p7', visitRecId: nv.id, reportedAt: nv.completedAt, text: nv.values.admit_reason, status: 'assessed', assessment: 'Serious (hospitalisation). Not related to study procedures. Included in the DSMB safety summary.', by: SUP });

    // Vikash withdrew (moved to live with his daughter).
    const vk = db.participants.find((p) => p.id === 'p6');
    vk.status = 'withdrawn';
    vk.withdrawal = { date: ago(40), reason: 'Moved out of the cluster', by: C, dataUse: 'Keep data already collected (de-identified)' };

    // Screen fail: no clinical cohort.
    db.participants.push({
      id: 'p9', screeningNo: 'S-009', studyId: '', name: 'Kevin Ah-Sing', sex: 'M', dob: D.dobFromAge(24, ago(12)), dobEstimated: true, cluster: 'escalier', phone: '5 701 2210', language: 'English',
      status: 'screen_fail', screenedAt: ago(12),
      screening: { answers: { resident: 'yes', stay_12m: 'yes', willing_baseline: 'yes', can_consent: 'yes', other_trial: 'no', dm_known: 'no', screen_hba1c: 5.4, htn_known: 'no', screen_bp: '124/78', cv_risk_high: 'no', emergency_now: 'no' }, eligible: false, by: C },
      screenFail: ['In a clinical cohort: type 2 diabetes, hypertension, or high cardiovascular risk (known or found at screening)'],
    });
    db.screeningCount = 9;

    // Messages already sent, and one group message waiting for approval.
    const p1 = db.participants[0];
    const m12 = proto.visits.find((v) => v.id === 'm12');
    const clusterName = (id) => proto.clusters.find((c) => c.id === id).name;
    db.messages.push({ id: 'm-1', kind: 'group', audience: 'All participants', status: 'sent', createdBy: SUP, createdAt: ago(20) + 'T08:00:00', sentAt: ago(20) + 'T08:30:00', sentBy: SUP,
      recipients: db.participants.filter(RS.canText).map((p) => ({ participantId: p.id, phone: p.phone, text: `Hello ${RS.firstName(p)}, the ICEHALL study team will hold a community health meeting at the village hall on Saturday at 10am. All are welcome. Questions: 5 700 0000.` })) });
    const remindAt = D.addDays(RS.visitWindow(p1, m12).start, -5);
    db.messages.push({ id: 'm-2', kind: 'reminder', key: `${p1.id}:m12`, audience: p1.studyId, status: 'sent', createdBy: 'Suggested', createdAt: remindAt + 'T08:00:00', sentAt: remindAt + 'T08:10:00', sentBy: C,
      recipients: [{ participantId: p1.id, phone: p1.phone, text: RS.fillMessage(proto.messages.templates.reminder.text, RS.messageVars(proto, p1, m12, C)) }] });
    db.messages.push({ id: 'm-3', kind: 'group', audience: 'Cluster: ' + clusterName('pretres'), status: 'pending', createdBy: C, createdAt: ago(1) + 'T15:00:00',
      recipients: db.participants.filter((p) => RS.canText(p) && p.cluster === 'pretres').map((p) => ({ participantId: p.id, phone: p.phone, text: `Hello ${RS.firstName(p)}, the ICEHALL team will be in Vallée des Prêtres on Thursday morning for study visits. Please call 5 700 0000 if you will be away.` })) });

    // A past correction in the audit trail.
    const rv = db.visits.find((r) => r.id === 'v1-m3');
    RS.audit(db, { by: SUP, participantId: 'p1', visitRecId: rv.id, field: 'weight', from: 47, to: rv.values.weight, reason: 'Transcription error: digits swapped (checked against the paper source form)', at: ago(270) + 'T10:00:00' });
    return db;
  };
})();
