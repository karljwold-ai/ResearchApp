/*
 * Demo staff, participants and conversations for the ICEHALL v08 protocol (Mauritius site).
 * Everything here is invented. Dates are relative to today so the schedule always has
 * visits that are missed, due and coming up.
 *
 * Two data collectors, two clusters each (one intervention, one standard care). The demo builds in
 * differences for the review screens to find: Ravi's clusters miss more follow-up visits; intervention
 * clusters improve more on BP, HbA1c, PHQ-9 and adherence. These are invented patterns, not results.
 */
(function () {
  'use strict';
  const RS = (typeof window !== 'undefined' ? window : global).RS;
  const D = RS.date;

  RS.STAFF = {
    collectors: [
      { id: 'c1', name: 'Ravi Ramdin', role: 'Data collector (CHO)', clusters: ['esperance', 'escalier'] },
      { id: 'c2', name: 'Anisha Bholah', role: 'Data collector (CHO)', clusters: ['pretres', 'rodrigues'] },
    ],
    supervisor: { id: 's1', name: 'Shabnam Peerbux', role: 'Site supervisor' },
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

  // Typical answers; anything not listed gets a neutral value for its type.
  const TYPICAL = {
    education: 'secondary', occupation: 'employed', household: 4, income_band: '3', move_2y: 'no',
    dm_hypo_hx: 'no', dm_dka_hx: 'no', cvd_hx: 'no', ckd_hx: 'no', smoking: 'never', alcohol: 'none', pregnant: 'no', pregnant_now: 'no', snoring: 'no', joint_pain: 'no',
    admitted: 'no', ed_visits: 0, chest_pain: 'no', dm_red_flags: 'no', severe_hypo: 'no',
    on_statin: 'no', med_access: 'no', med_cost: 0,
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
  /** Small deterministic random numbers (same demo every time). */
  function rng(seed) {
    let a = 0;
    String(seed).split('').forEach((c) => { a = (a * 31 + c.charCodeAt(0)) | 0; });
    return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  /** Spread a score total over items (each 0..max), e.g. a PHQ-9 total over items 1–8. */
  function spread(prefix, items, total, max, start) {
    const out = {};
    start = start || 0;
    let left = Math.max(0, Math.min(items.length * max, Math.round(total))); // max = most each item can add
    items.forEach((i) => { out[prefix + i] = String(start); });
    for (let k = 0; left > 0; k = (k + 1) % items.length) { const id = prefix + items[k]; if (Number(out[id]) < start + max) { out[id] = String(Number(out[id]) + 1); left--; } }
    return out;
  }

  /**
   * Values for a completed visit. b: the person's starting values; months: time since baseline;
   * arm: 'i' (intervention) or 's' (standard care), which sets how much things improve.
   */
  function visitValues(proto, visitId, b, months, arm, rand, ctx) {
    const iv = arm === 'i';
    const noise = (n) => (rand() * 2 - 1) * n;
    const sys = Math.round(b.sys - months * (iv ? 0.9 : 0.25) + noise(5));
    const dia = Math.round(b.dia - months * (iv ? 0.45 : 0.1) + noise(3));
    const phq = Math.max(0, b.phq - months * (iv ? 0.35 : 0.05) + noise(1.5));
    const gad = Math.max(0, b.gad - months * (iv ? 0.25 : 0.05) + noise(1.5));
    const mars = Math.min(25, b.mars + months * (iv ? 0.25 : 0.05) + noise(1));
    const v = Object.assign({}, TYPICAL, {
      bp_1: `${sys + 6}/${dia + 3}`, bp_2: `${sys + 2}/${dia + 1}`, bp_3: `${sys}/${dia}`, pulse: Math.round(74 + noise(10)),
      weight: Math.round((b.weight - months * (iv ? 0.12 : 0.02) + noise(0.8)) * 10) / 10, height: b.height, waist: Math.round(b.waist - months * (iv ? 0.2 : 0.03) + noise(1.5)),
      on_htn_meds: b.htnMeds ? 'yes' : 'no', on_dm_meds: b.dmMeds ? 'yes' : 'no', on_insulin: 'no', med_list: [b.htnMeds, b.dmMeds].filter(Boolean).join('; '),
      med_access: rand() < (iv ? 0.08 : 0.2) ? 'yes' : 'no',
      hba1c: b.hba1c != null ? Math.round((b.hba1c - months * (iv ? 0.06 : 0.015) + noise(0.25)) * 10) / 10 : null, dm_dx_age: b.dmAge,
      walk_days: Math.max(0, Math.min(7, Math.round(b.walk + months * (iv ? 0.15 : 0) + noise(1)))),
      eq_pain: '2',
    }, spread('phq_', [1, 2, 3, 4, 5, 6, 7, 8], phq, 3), { phq_9: '0' }, spread('gad_', [1, 2, 3, 4, 5, 6, 7], gad, 3),
    spread('mars_', [1, 2, 3, 4, 5], mars - 5, 4, 1));
    const out = {};
    const vd = proto.visits.find((x) => x.id === visitId);
    for (let pass = 0; pass < 3; pass++) { // repeat so answers that reveal more questions are filled too
      RS.visitSections(proto, vd, out, ctx).forEach(({ fields }) => fields.forEach((f) => {
        if (out[f.id] != null) return;
        const x = v[f.id] !== undefined ? v[f.id] : neutral(f);
        if (x !== '' && x != null) out[f.id] = x;
      }));
    }
    return out;
  }

  const F_NAMES = ['Priya', 'Sandra', 'Kavita', 'Marie-Josée', 'Reshma', 'Sabrina', 'Vanessa', 'Shalini', 'Aisha', 'Sunita', 'Nathalie', 'Rekha'];
  const M_NAMES = ['Jean-Claude', 'Vinod', 'Rajiv', 'Yousouf', 'Patrick', 'Deepak', 'Kamal', 'Gilbert', 'Anand', 'Imran', 'Ludovic', 'Sanjay'];
  const SURNAMES = ['Ramsamy', 'Beeharry', 'Jhurry', 'Mungur', 'Ramtohul', 'Labonne', 'Hossenbux', 'Gokhool', 'Appadoo', 'Lebon', 'Sookun', 'Dookhit', 'Seetaram', 'Ah-Kee', 'Mootoosamy', 'Bundhoo', 'Nunkoo', 'Lafrance', 'Toorabally', 'Emrith'];

  RS.seed = function () {
    const proto = RS.protocols['icehall-v08'];
    const db = RS.emptyDb();
    const today = D.today();
    const ago = (n) => D.addDays(today, -n);
    const STAFF = RS.STAFF;
    const SUP = STAFF.supervisor.name;
    const collectorOf = (cluster) => RS.collectorFor(STAFF.collectors, cluster);
    const armOf = (cluster) => (/^Intervention/.test(proto.clusters.find((c) => c.id === cluster).arm) ? 'i' : 's');
    // How often each collector's participants miss a follow-up visit, and do one late.
    const MISS = { c1: 0.22, c2: 0.06 }, LATE = { c1: 0.12, c2: 0.03 };
    const allOpts = (over) => Object.assign({ contact: true, records: true, cmh: true, qual: false, pgd: false, future: true, audio: false }, over);
    let n = 0;

    /** Enrol one person and create their visits up to today. done: visit ids to force (else chosen by the miss rate). */
    function enrol(o) {
      n++;
      const rand = rng(o.name + n);
      const enrolledAt = ago(o.enrolledAgo);
      const col = collectorOf(o.cluster);
      const p = {
        id: 'p' + n, screeningNo: 'S-' + String(n).padStart(3, '0'), studyId: proto.idPrefix + '-' + String(n).padStart(4, '0'),
        name: o.name, sex: o.sex, dob: D.dobFromAge(o.age, enrolledAt), dobEstimated: true, cluster: o.cluster, household: o.household || null, phone: o.phone == null ? `5 7${String(10 + n).padStart(2, '0')} ${String(2000 + n * 37).slice(-4)}` : o.phone,
        language: o.language || 'Kreol Morisien', status: 'enrolled', screenedAt: enrolledAt, enrolledAt, enrolledBy: col.name,
        screening: {
          answers: { resident: 'yes', stay_12m: 'yes', willing_baseline: 'yes', can_consent: 'yes', other_trial: 'no', dm_known: o.b.dm ? 'yes' : 'no', type1_or_gdm: o.b.dm ? 'no' : '', htn_known: o.b.htnMeds ? 'yes' : 'no', screen_bp: `${o.b.sys + 4}/${o.b.dia + 2}`, cv_risk_high: 'no', emergency_now: 'no' },
          eligible: true, by: col.name,
        },
        consent: { version: proto.consent.version, date: enrolledAt, method: o.how || 'signature', witness: o.how === 'thumbprint' ? 'Marie Lafleur (neighbour, impartial witness)' : '', copyGiven: true, checksPassed: true, language: 'Kreol Morisien', options: allOpts(o.opts), by: col.name },
      };
      db.participants.push(p);
      const b = Object.assign({ phq: 4, gad: 3, mars: 21, walk: 3 }, o.b);
      proto.visits.forEach((v) => {
        const w = RS.visitWindow(p, v);
        if (w.start > today) return;
        const open = w.end >= today;
        let done;
        if (o.done) done = o.done.includes(v.id);
        else if (v.id === 'baseline') done = true;
        else if (open) done = rand() < 0.35 && w.ideal <= today;
        else done = rand() >= MISS[col.id];
        if (!done) return;
        let date = v.id === 'baseline' ? enrolledAt : D.addDays(w.ideal, Math.round((rand() * 2 - 1) * 9));
        let deviation = null;
        if (v.id !== 'baseline' && !o.done && !open && rand() < LATE[col.id]) {
          date = D.addDays(w.end, 2 + Math.round(rand() * 8));
          deviation = { category: proto.deviationCategories[0], note: 'Participant away during the window' };
        }
        if (date > today) date = today;
        const months = D.between(enrolledAt, date) / 30.4;
        const rec = { id: `v${n}-${v.id}`, participantId: p.id, visit: v.id, date, collector: col.name, status: 'complete', values: {}, missing: {}, checks: {}, safety: [], deviation, completedAt: date + 'T11:00:00', protocolVersion: proto.version, listening: 'off', reviewed: D.between(date, today) > 21 ? { by: SUP, at: D.addDays(date, 3) + 'T16:00:00' } : null };
        const ctx = RS.ctxForVisit(db, p, rec);
        rec.values = visitValues(proto, v.id, b, months, armOf(o.cluster), rand, ctx);
        db.visits.push(rec);
        // Safety rules and referrals as the collector would have recorded them.
        const fired = RS.safety(proto, rec.values, RS.ctxForVisit(db, p, rec));
        const refs = RS.referralsFor(proto, fired);
        rec.safety = fired.map((s) => ({ id: s.rule.id, level: s.rule.level, text: s.text, action: s.rule.referTo ? 'Referred (handoff given)' : s.rule.level === 'report' ? 'Supervisor told' : '' }));
        refs.forEach((g) => {
          const age = D.between(date, today);
          const seen = age > 14 ? rand() < (armOf(o.cluster) === 'i' ? 0.85 : 0.6) : false;
          db.referrals.push({
            id: `ref-${rec.id}-${g.to}`, participantId: p.id, visitRecId: rec.id, to: g.to, urgency: g.urgency, reasons: g.rules.map((s) => ({ id: s.rule.id, level: s.rule.level, text: s.text })),
            createdAt: rec.completedAt, by: col.name,
            status: age <= 14 ? 'open' : seen ? 'seen' : 'not_attended',
            outcome: age <= 14 ? null : { date: D.addDays(date, 5), text: seen ? 'Seen. Medicines reviewed and adjusted.' : 'Did not attend (transport cost).', by: col.name },
          });
        });
        fired.filter((s) => s.rule.level === 'urgent' || s.rule.level === 'report').forEach((s) => db.events.push({
          id: `ev-${rec.id}-${s.rule.id}`, kind: s.rule.level === 'report' ? 'Possible SAE' : 'Urgent referral', participantId: p.id, visitRecId: rec.id, reportedAt: rec.completedAt, text: s.text,
          status: D.between(date, today) > 7 ? 'assessed' : 'new', assessment: D.between(date, today) > 7 ? 'Referred the same day; seen at the health centre. Not related to study procedures.' : undefined, by: D.between(date, today) > 7 ? SUP : undefined,
        }));
      });
      return p;
    }

    // Named people used in the walkthrough.
    const named = [
      { name: 'Anjali Doorgakant', sex: 'F', age: 56, cluster: 'esperance', phone: '5 701 2201', enrolledAgo: 372, done: ['baseline', 'm3', 'm6', 'm9'], household: 'H-0001', b: { sys: 148, dia: 90, weight: 74, height: 156, waist: 98, dm: true, hba1c: 7.6, dmAge: 48, htnMeds: 'Amlodipine 5 mg', dmMeds: 'Metformin 500 mg twice daily', phq: 6 }, opts: { audio: true } },
      { name: 'Jean-Marc Laval', sex: 'M', age: 63, cluster: 'escalier', phone: '5 701 2202', enrolledAgo: 190, done: ['baseline', 'm3'], b: { sys: 162, dia: 96, weight: 82, height: 172, waist: 104, htnMeds: 'Losartan 50 mg' }, opts: { audio: true }, how: 'thumbprint' },
      { name: 'Fatima Joomun', sex: 'F', age: 47, cluster: 'pretres', phone: '5 701 2203', enrolledAgo: 118, done: ['baseline'], household: 'H-0002', b: { sys: 128, dia: 82, weight: 69, height: 158, waist: 92, dm: true, hba1c: 8.1, dmAge: 44, dmMeds: 'Metformin 850 mg twice daily' }, opts: { cmh: false } },
      { name: 'Rajesh Seebaluck', sex: 'M', age: 59, cluster: 'esperance', phone: '', enrolledAgo: 80, done: ['baseline'], b: { sys: 158, dia: 98, weight: 88, height: 170, waist: 108, dm: true, hba1c: 8.8, dmAge: 50, htnMeds: 'Amlodipine 10 mg', dmMeds: 'Metformin 1 g twice daily; gliclazide 80 mg' }, opts: { audio: true, contact: false } },
      { name: 'Marie-Claire Perrine', sex: 'F', age: 41, cluster: 'rodrigues', phone: '5 701 2205', enrolledAgo: 72, done: ['baseline'], b: { sys: 146, dia: 94, weight: 112, height: 141, waist: 118, htnMeds: '' } },
      { name: 'Vikash Gopee', sex: 'M', age: 68, cluster: 'escalier', phone: '5 701 2206', enrolledAgo: 220, done: ['baseline', 'm3'], b: { sys: 150, dia: 88, weight: 64, height: 166, waist: 90, htnMeds: 'Amlodipine 5 mg' } },
      { name: 'Nadia Bhunjun', sex: 'F', age: 52, cluster: 'pretres', phone: '5 701 2208', enrolledAgo: 268, done: ['baseline', 'm3', 'm6'], b: { sys: 138, dia: 86, weight: 77, height: 160, waist: 101, dm: true, hba1c: 8.6, dmAge: 45, dmMeds: 'Metformin 1 g twice daily' }, opts: { audio: true } },
      { name: 'Louis Bégué', sex: 'M', age: 71, cluster: 'rodrigues', phone: '5 701 2209', enrolledAgo: 545, done: ['baseline', 'm3', 'm6', 'm9', 'm12'], b: { sys: 154, dia: 84, weight: 70, height: 168, waist: 97, htnMeds: 'Amlodipine 10 mg; hydrochlorothiazide 25 mg' } },
    ];
    named.forEach(enrol);

    // Everyone else: 10 per cluster, enrolled over the last ~15 months; some share a household.
    const rand = rng('icehall-demo');
    proto.clusters.forEach((c, ci) => {
      let lastHouse = null;
      for (let k = 0; k < 10; k++) {
        const sex = rand() < 0.55 ? 'F' : 'M';
        const pairWithLast = lastHouse && rand() < 0.3;
        const surname = pairWithLast ? lastHouse.surname : SURNAMES[(ci * 5 + k * 3 + Math.floor(rand() * 4)) % SURNAMES.length];
        const first = (sex === 'F' ? F_NAMES : M_NAMES)[(ci * 3 + k + Math.floor(rand() * 5)) % 12];
        const dm = rand() < 0.45, htn = !dm || rand() < 0.6;
        const household = pairWithLast ? lastHouse.id : 'H-' + String(100 + ci * 20 + k).padStart(4, '0');
        const p = enrol({
          name: `${first} ${surname}`, sex, age: 38 + Math.floor(rand() * 34), cluster: c.id, enrolledAgo: pairWithLast ? lastHouse.enrolledAgo : 25 + Math.floor(rand() * 420), household,
          b: {
            sys: Math.round(htn ? 146 + rand() * 22 : 126 + rand() * 12), dia: Math.round(htn ? 88 + rand() * 10 : 78 + rand() * 8), weight: Math.round(58 + rand() * 34), height: Math.round(sex === 'F' ? 152 + rand() * 14 : 163 + rand() * 14), waist: Math.round(84 + rand() * 24),
            dm, hba1c: dm ? Math.round((7.2 + rand() * 2.2) * 10) / 10 : null, dmAge: dm ? 40 : null, htnMeds: htn ? (rand() < 0.5 ? 'Amlodipine 5 mg' : 'Losartan 50 mg') : '', dmMeds: dm ? 'Metformin 850 mg twice daily' : '',
            phq: rand() < 0.2 ? 10 + rand() * 4 : rand() * 7, gad: rand() * 7, mars: 18 + rand() * 5, walk: Math.floor(rand() * 5),
          },
          opts: { contact: rand() < 0.9, audio: rand() < 0.4 },
        });
        lastHouse = { id: household, surname, enrolledAgo: D.between(p.enrolledAt, today) };
      }
    });
    // Anjali's husband is in the study too.
    enrol({ name: 'Dev Doorgakant', sex: 'M', age: 60, cluster: 'esperance', phone: '5 701 2211', enrolledAgo: 372, done: ['baseline', 'm3', 'm9'], household: 'H-0001', b: { sys: 156, dia: 94, weight: 81, height: 169, waist: 99, htnMeds: 'Amlodipine 10 mg' } });

    // Lipid results not back yet for a recent baseline, and a supervisor query on it.
    const mc = db.visits.find((r) => r.id === 'v5-baseline');
    ['chol_total', 'hdl', 'creat'].forEach((k) => { delete mc.values[k]; mc.missing[k] = 'Result not back yet'; });
    delete mc.values.trig; delete mc.values.egfr;
    RS.raiseQuery(db, { participantId: 'p5', visitRecId: mc.id, field: 'height', text: 'Height 141 cm with weight 112 kg (BMI 56). Please confirm both were measured (stadiometer and scale), not reported.', by: SUP, auto: false, raisedAt: ago(70) + 'T09:00:00' });
    // An automatic query on an unusual value, answered by the collector.
    const fv = db.visits.find((r) => r.id === 'v1-m6');
    fv.values.pulse = 124;
    const q = RS.raiseQuery(db, { participantId: 'p1', visitRecId: fv.id, field: 'pulse', text: 'Unusual value (expected 45–120 /min). Check and confirm.', by: 'Automatic check', auto: true, raisedAt: fv.completedAt });
    q.thread.push({ by: 'Ravi Ramdin', at: fv.completedAt, text: 'Re-measured after 10 minutes rest: still 124. She had walked up the hill from the bus stop. Advised clinic check.' });
    q.status = 'answered';

    // Nadia: admitted before the 6-month visit (reportable event, assessed); HbA1c above target twice → CHDr referral.
    const nv = db.visits.find((r) => r.id === 'v7-m6');
    const nb = db.visits.find((r) => r.id === 'v7-baseline');
    Object.assign(nv.values, { admitted: 'yes', admit_reason: 'Pneumonia, 4 nights at Victoria Hospital', ed_visits: 1, hba1c: 8.4 });
    nb.values.hba1c = 8.6;
    nv.safety = [
      { id: 'hba1c_high_twice', level: 'soon', text: 'HbA1c 8.4% and 8.6% last time: 1% or more above target at two visits. CHDr review for medicine change or referral.', action: 'Referred (handoff given)' },
      { id: 'sae', level: 'report', text: 'Hospital admission: possible serious adverse event. Tell the supervisor within 24 hours.', action: 'Supervisor told' },
    ];
    db.referrals = db.referrals.filter((x) => x.visitRecId !== nv.id);
    db.events = db.events.filter((x) => x.visitRecId !== nv.id);
    db.referrals.push({ id: 'ref-nadia', participantId: 'p7', visitRecId: nv.id, to: 'chdr', urgency: 'soon', reasons: [{ id: 'hba1c_high_twice', level: 'soon', text: nv.safety[0].text }], createdAt: nv.completedAt, by: 'Anisha Bholah', status: 'seen', outcome: { date: D.addDays(nv.date, 6), text: 'Seen by CHDr: gliclazide 40 mg added; HbA1c again at 6 months.', by: 'Anisha Bholah' } });
    db.events.push({ id: 'ev-1', kind: 'Possible SAE', participantId: 'p7', visitRecId: nv.id, reportedAt: nv.completedAt, text: nv.values.admit_reason, status: 'assessed', assessment: 'Serious (hospitalisation). Not related to study procedures. Included in the DSMB safety summary.', by: SUP });

    // Withdrawals.
    const vk = db.participants.find((p) => p.id === 'p6');
    vk.status = 'withdrawn';
    vk.withdrawal = { date: ago(40), reason: 'Moved out of the cluster', by: 'Ravi Ramdin', dataUse: 'Keep data already collected (de-identified)' };
    const lost = db.participants.find((p) => p.cluster === 'escalier' && p.id !== 'p6' && p.id !== 'p2' && D.between(p.enrolledAt, today) > 200);
    if (lost) { lost.status = 'withdrawn'; lost.withdrawal = { date: ago(30), reason: 'Lost to follow-up', by: 'Ravi Ramdin', dataUse: 'Keep data already collected (de-identified)' }; }

    // Screen failures.
    n++;
    db.participants.push({
      id: 'p' + n, screeningNo: 'S-' + String(n).padStart(3, '0'), studyId: '', name: 'Kevin Ah-Sing', sex: 'M', dob: D.dobFromAge(24, ago(12)), dobEstimated: true, cluster: 'escalier', phone: '5 701 2210', language: 'English',
      status: 'screen_fail', screenedAt: ago(12),
      screening: { answers: { resident: 'yes', stay_12m: 'yes', willing_baseline: 'yes', can_consent: 'yes', other_trial: 'no', dm_known: 'no', screen_hba1c: 5.4, htn_known: 'no', screen_bp: '124/78', cv_risk_high: 'no', emergency_now: 'no' }, eligible: false, by: 'Ravi Ramdin' },
      screenFail: ['In a clinical cohort: type 2 diabetes, hypertension, or high cardiovascular risk (known or found at screening)'],
    });
    db.screeningCount = n;

    // Messages: a group message (written by a collector, approved by the supervisor), a reminder, and one waiting for approval.
    const p1 = db.participants[0];
    const m12 = proto.visits.find((v) => v.id === 'm12');
    const clusterName = (id) => proto.clusters.find((c) => c.id === id).name;
    db.messages.push({ id: 'm-1', kind: 'group', audience: 'Cluster: ' + clusterName('esperance'), status: 'sent', createdBy: 'Ravi Ramdin', createdAt: ago(21) + 'T15:00:00', approvedBy: SUP, sentAt: ago(20) + 'T08:30:00', sentBy: 'Ravi Ramdin',
      recipients: db.participants.filter((p) => RS.canText(p) && p.cluster === 'esperance').map((p) => ({ participantId: p.id, phone: p.phone, text: `Hello ${RS.firstName(p)}, the ICEHALL study team will hold a community health meeting at the village hall on Saturday at 10am. All are welcome. Questions: 5 700 0000.` })) });
    const remindAt = D.addDays(RS.visitWindow(p1, m12).start, -5);
    db.messages.push({ id: 'm-2', kind: 'reminder', key: `${p1.id}:m12`, audience: p1.studyId, status: 'sent', createdBy: 'Suggested', createdAt: remindAt + 'T08:00:00', sentAt: remindAt + 'T08:10:00', sentBy: 'Ravi Ramdin',
      recipients: [{ participantId: p1.id, phone: p1.phone, text: RS.fillMessage(proto.messages.templates.reminder.text, RS.messageVars(proto, p1, m12, 'Ravi Ramdin')) }] });
    db.messages.push({ id: 'm-3', kind: 'group', audience: 'Cluster: ' + clusterName('pretres'), status: 'pending', createdBy: 'Anisha Bholah', createdAt: ago(1) + 'T15:00:00',
      recipients: db.participants.filter((p) => RS.canText(p) && p.cluster === 'pretres').map((p) => ({ participantId: p.id, phone: p.phone, text: `Hello ${RS.firstName(p)}, the ICEHALL team will be in Vallée des Prêtres on Thursday morning for study visits. Please call 5 700 0000 if you will be away.` })) });

    // A past correction in the audit trail.
    const rv = db.visits.find((r) => r.id === 'v1-m3');
    RS.audit(db, { by: SUP, participantId: 'p1', visitRecId: rv.id, field: 'weight', from: 47, to: rv.values.weight, reason: 'Transcription error: digits swapped (checked against the paper source form)', at: ago(270) + 'T10:00:00' });
    return db;
  };
})();
