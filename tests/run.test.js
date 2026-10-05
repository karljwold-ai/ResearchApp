/*
 * Tests for the protocol engine (no browser needed):  node tests/run.test.js
 */
'use strict';
const assert = require('assert');
const path = require('path');
global.RS = {};
['js/core.js', 'js/rules.js', 'js/listen.js', 'protocols/icehall-v08.js', 'js/demo.js'].forEach((f) => require(path.join(__dirname, '..', f)));
const RS = global.RS;
const P = RS.protocol();
const D = RS.date;

let n = 0, failed = 0;
function test(name, fn) {
  n++;
  try { fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + e.message); }
}
const person = (over) => Object.assign({ id: 't1', dob: '1970-03-01', sex: 'F', screening: { answers: {} }, consent: { options: { contact: true, cmh: true } } }, over);

test('protocol loads and every visit uses known forms', () => {
  assert.strictEqual(P.id, 'icehall-v08');
  assert.deepStrictEqual(P.visits.map((v) => v.id), ['baseline', 'm3', 'm6', 'm9', 'm12', 'm18', 'm24']);
  P.visits.forEach((v) => v.forms.forEach((f) => assert.ok(P.forms[f], f)));
});

test('schedule of activities matches protocol Table 11.1', () => {
  const at = (form) => P.visits.filter((v) => v.forms.includes(form)).map((v) => v.id).join(' ');
  assert.strictEqual(at('measures'), 'baseline m3 m6 m9 m12 m18 m24');
  assert.strictEqual(at('adherence'), 'baseline m3 m6 m9 m12 m18 m24');
  assert.strictEqual(at('poc_lab'), 'baseline m6 m12 m18 m24'); // HbA1c
  assert.strictEqual(at('venous_lab'), 'baseline m12 m24'); // lipids, renal
  assert.strictEqual(at('diet'), 'baseline m3 m6 m12 m18 m24');
  assert.strictEqual(at('phq9'), 'baseline m6 m12 m18 m24');
  assert.strictEqual(at('eq5d'), 'baseline m6 m12 m24');
  assert.strictEqual(at('experience'), 'baseline m6 m12 m24');
  assert.strictEqual(at('resource'), 'baseline m6 m12 m18 m24');
  assert.strictEqual(at('demographics'), 'baseline m12 m24');
});

test('a broken protocol is refused with every problem listed', () => {
  const bad = {
    id: 'bad', title: 'x', short: 'x', consent: { version: '1', options: [{ id: 'contact' }] }, messages: { consentOption: 'contact', templates: {} },
    screening: { fields: [{ id: 'a', label: 'A', type: 'yesno' }] }, eligibility: [{ id: 'e', kind: 'include', when: 'a = maybe' }],
    forms: { f: { title: 'F', fields: [{ id: 'b', label: 'B', type: 'number', show: 'nope > 3' }, { id: 'a', label: 'dup', type: 'text' }] } },
    derived: [], safety: [{ id: 's', level: 'loud', when: 'b >' }], visits: [{ id: 'v0', day: 3, forms: ['f', 'g'] }],
  };
  assert.throws(() => RS.registerProtocol(bad), (e) => /maybe/.test(e.message) && /nope/.test(e.message) && /used twice/.test(e.message) && /level/.test(e.message) && /unknown form/.test(e.message) && /day 0/.test(e.message));
});

test('eligibility: adult with known diabetes is eligible; no cohort is not', () => {
  const base = { resident: 'yes', stay_12m: 'yes', willing_baseline: 'yes', can_consent: 'yes', other_trial: 'no', htn_known: 'no', screen_bp: '124/78', cv_risk_high: 'no', emergency_now: 'no' };
  const p = person();
  assert.strictEqual(RS.eligibility(P, Object.assign({}, base, { dm_known: 'yes', type1_or_gdm: 'no' }), RS.ctxFor(p)).eligible, true);
  const none = RS.eligibility(P, Object.assign({}, base, { dm_known: 'no', screen_hba1c: 5.4 }), RS.ctxFor(p));
  assert.strictEqual(none.eligible, false);
  assert.deepStrictEqual(none.failed.map((r) => r.c.id), ['cohort']);
  // likely type 1 diabetes leaves the diabetes cohort, but high BP at screening keeps them eligible
  const t1 = RS.eligibility(P, Object.assign({}, base, { dm_known: 'yes', type1_or_gdm: 'yes', screen_bp: '150/92' }), RS.ctxFor(p));
  assert.strictEqual(t1.eligible, true);
  assert.strictEqual(RS.derive(P, Object.assign({}, base, { dm_known: 'yes', type1_or_gdm: 'yes' }), RS.ctxFor(p)).cohort_dm, 'no');
});

test('eligibility: under 18, emergency, and unanswered', () => {
  const kid = person({ dob: D.dobFromAge(16) });
  const a = { resident: 'yes', stay_12m: 'yes', willing_baseline: 'yes', can_consent: 'yes', other_trial: 'no', dm_known: 'yes', type1_or_gdm: 'no', htn_known: 'no', screen_bp: '120/80', cv_risk_high: 'no', emergency_now: 'no' };
  assert.deepStrictEqual(RS.eligibility(P, a, RS.ctxFor(kid)).failed.map((r) => r.c.id), ['age']);
  assert.deepStrictEqual(RS.eligibility(P, Object.assign({}, a, { emergency_now: 'yes' }), RS.ctxFor(person())).failed.map((r) => r.c.id), ['emergency']);
  assert.strictEqual(RS.eligibility(P, { resident: 'yes' }, RS.ctxFor(person())).eligible, null);
});

test('forms appear by cohort, consent and visit', () => {
  const dm = person({ screening: { answers: { dm_known: 'yes' } } });
  const ids = (p, v, vals) => RS.visitSections(P, P.visits.find((x) => x.id === v), vals || {}, RS.ctxFor(p, null, v)).flatMap((s) => s.fields.map((f) => f.id));
  assert.ok(ids(dm, 'm6').includes('hba1c'));
  assert.ok(!ids(person({ screening: { answers: { htn_known: 'yes' } } }), 'm6').includes('hba1c'));
  assert.ok(ids(dm, 'baseline').includes('height'));
  assert.ok(!ids(dm, 'm3').includes('height'));
  assert.ok(ids(dm, 'm6').includes('phq_9'));
  assert.ok(!ids(person({ consent: { options: { cmh: false } } }), 'm6').includes('phq_9'), 'no mental health screening without consent');
  assert.ok(!ids(dm, 'm3', { on_htn_meds: 'no', on_dm_meds: 'no', on_insulin: 'no', on_statin: 'no' }).includes('mars_1'), 'MARS-5 only when on medicine');
  assert.ok(ids(dm, 'm3', { on_htn_meds: 'yes' }).includes('mars_1'));
});

test('calculated values: BP mean, BMI from baseline height, scores', () => {
  const p = person();
  const v = { bp_1: '170/100', bp_2: '150/94', bp_3: '146/90', weight: 80 };
  const d = RS.derive(P, v, RS.ctxFor(p, null, 'm3', { height: 160 }));
  assert.strictEqual(d.sys_mean, 148);
  assert.strictEqual(d.dia_mean, 92);
  assert.strictEqual(d.bp_controlled, 'no');
  assert.strictEqual(d.bmi, 31.3);
  const phq = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => ['phq_' + i, '1']));
  assert.strictEqual(RS.derive(P, phq, RS.ctxFor(p)).phq9_total, 9);
  assert.strictEqual(RS.derive(P, { phq_1: '3' }, RS.ctxFor(p)).phq9_total, null, 'total only when every item is answered');
  assert.strictEqual(RS.derive(P, { vig_days: 0, mod_days: 2, mod_min: 30, walk_days: 5, walk_min: 20 }, RS.ctxFor(p)).ipaq_met, 570);
});

test('safety rules follow Table 15.1 and 8.4', () => {
  const p = person({ screening: { answers: { dm_known: 'yes' } } });
  const ids = (v, prev) => RS.safety(P, v, RS.ctxFor(p, null, 'm6', prev || {})).map((s) => s.rule.id);
  assert.deepStrictEqual(ids({ phq_9: '1' }), ['self_harm'], 'PHQ-9 item 9 escalates whatever the total');
  assert.ok(ids({ bp_2: '184/112', bp_3: '182/110' }).includes('bp_very_high'));
  assert.ok(!ids({ bp_2: '178/104', bp_3: '176/100' }).includes('bp_very_high'));
  const nine = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((i) => ['phq_' + i, i < 4 ? '2' : '1'])); nine.phq_9 = '0';
  assert.ok(ids(nine).includes('mh_referral'), 'PHQ-9 >= 10 referral');
  assert.ok(ids({ hba1c: 8.3 }, { hba1c: 8.6 }).includes('hba1c_high_twice'));
  assert.ok(!ids({ hba1c: 8.3 }, { hba1c: 7.4 }).includes('hba1c_high_twice'), 'needs two visits above target');
  assert.ok(ids({ admitted: 'yes' }).includes('sae'));
  const order = RS.safety(P, { admitted: 'yes', phq_9: '2' }, RS.ctxFor(p)).map((s) => s.rule.level);
  assert.deepStrictEqual(order, ['urgent', 'report'], 'most serious first');
});

test('value checks: hard limits block, soft limits query', () => {
  const f = P.fields;
  assert.ok(RS.checkValue(f.weight, 300).hard);
  assert.ok(RS.checkValue(f.weight, 170).soft);
  assert.deepStrictEqual(RS.checkValue(f.weight, 70), {});
  assert.ok(RS.checkValue(f.bp_1, '80/120').hard, 'systolic must be higher');
  assert.ok(RS.checkValue(f.bp_1, '1200/80').hard);
  assert.ok(RS.checkValue(f.bp_1, '220/100').soft);
  assert.ok(RS.checkValue(f.household, 2.5).hard, 'whole numbers');
});

test('visit validation: required, missing reasons, heard disagreements', () => {
  const p = person({ screening: { answers: { htn_known: 'yes' } } });
  const vd = P.visits.find((v) => v.id === 'm9');
  const ctx = RS.ctxFor(p, null, 'm9');
  const r = { values: {}, missing: {}, heard: {}, checks: {} };
  assert.ok(RS.validateVisit(P, vd, r, ctx).errors.some((e) => e.field === 'bp_1'));
  r.missing.bp_1 = 'Refused';
  assert.ok(!RS.validateVisit(P, vd, r, ctx).errors.some((e) => e.field === 'bp_1'));
  r.values.pulse = 80;
  r.heard.pulse = { value: 88 };
  assert.deepStrictEqual(RS.validateVisit(P, vd, r, ctx).disagreements.map((d) => d.field), ['pulse']);
  r.checks.pulse = { decision: 'kept entered' };
  assert.deepStrictEqual(RS.validateVisit(P, vd, r, ctx).disagreements, []);
  r.values.weight = 70.1; r.heard.weight = { value: 70 };
  assert.ok(!RS.validateVisit(P, vd, r, ctx).disagreements.some((d) => d.field === 'weight'), 'within tolerance');
});

test('listening reads the demo conversation', () => {
  const fields = ['bp_1', 'bp_2', 'bp_3', 'pulse', 'weight', 'waist', 'admitted', 'chest_pain', 'on_htn_meds', 'on_dm_meds', 'on_insulin', 'on_statin'].map((id) => P.fields[id]);
  const h = RS.listen(RS.DEMO_TALK[0].text, fields);
  const v = Object.fromEntries(Object.entries(h).map(([k, x]) => [k, x.value]));
  assert.deepStrictEqual(v, { bp_1: '152/94', bp_2: '148/92', bp_3: '146/90', pulse: 84, weight: 71, waist: 96, admitted: 'no', chest_pain: 'no', on_htn_meds: 'yes', on_dm_meds: 'yes', on_insulin: 'no', on_statin: 'yes' });
});

test('schedule: windows from enrolment; missed, due, upcoming', () => {
  const db = RS.emptyDb();
  const today = D.today();
  const p = { id: 'x', status: 'enrolled', enrolledAt: D.addDays(today, -120), consent: { options: { contact: true } }, phone: '1' };
  db.participants.push(p);
  const m3 = P.visits[1];
  assert.strictEqual(RS.visitStatus(db, p, m3), 'missed'); // 91 ± 14 closed at day 105
  assert.ok(RS.canStart(db, p, m3), 'late visits can still be done (as a deviation)');
  assert.strictEqual(RS.visitStatus(db, p, P.visits[2]), 'upcoming');
  db.visits.push({ id: 'r', participantId: 'x', visit: 'm3', status: 'complete', date: today, values: {} });
  assert.strictEqual(RS.visitStatus(db, p, m3), 'done');
  p.enrolledAt = D.addDays(today, -95);
  db.visits = [];
  assert.strictEqual(RS.visitStatus(db, p, m3), 'due');
  assert.strictEqual(RS.scheduleRows(db, P)[0].status, 'due');
  p.status = 'withdrawn'; p.withdrawal = { date: today };
  assert.strictEqual(RS.visitStatus(db, p, m3), 'stopped');
});

test('messages: only with contact consent and a phone; reminders not repeated', () => {
  const db = RS.seed();
  const sug = RS.suggestMessages(db, P, null, 'Ravi');
  assert.ok(sug.length > 0);
  sug.forEach((s) => assert.ok(RS.canText(s.participant)));
  assert.ok(!sug.some((s) => s.participant.id === 'p4'), 'no contact consent');
  assert.ok(!sug.some((s) => s.kind === 'reminder' && s.key === 'p1:m12'), 'already reminded');
  assert.ok(sug.every((s) => !/\{[a-z_]+\}/.test(s.text)), 'placeholders filled');
  assert.deepStrictEqual(RS.smsParts('x'.repeat(160)).parts, 1);
  assert.deepStrictEqual(RS.smsParts('x'.repeat(161)).parts, 2);
});

test('demo data is valid against the protocol', () => {
  const db = RS.seed();
  db.visits.filter((r) => r.status === 'complete').forEach((r) => {
    const p = db.participants.find((x) => x.id === r.participantId);
    const v = RS.validateVisit(P, P.visits.find((x) => x.id === r.visit), r, RS.ctxForVisit(db, p, r));
    assert.deepStrictEqual(v.errors, [], r.id + ' ' + JSON.stringify(v.errors));
  });
});

test('export: no names or phone numbers', () => {
  const db = RS.seed();
  const csv = RS.exportVisits(db, P) + RS.exportParticipants(db);
  db.participants.forEach((p) => { assert.ok(!csv.includes(p.name), p.name); if (p.phone) assert.ok(!csv.includes(p.phone), p.phone); });
  assert.strictEqual(RS.exportVisits(db, P).split('\n').length, 1 + db.visits.filter((r) => r.status === 'complete').length);
});

test('referrals: one per destination, most urgent rule sets the urgency', () => {
  const p = person({ screening: { answers: { dm_known: 'yes' } } });
  const fired = RS.safety(P, { bp_2: '186/114', bp_3: '184/112', hba1c: 8.2, admitted: 'yes', phq_1: '3', phq_2: '3', phq_3: '3', phq_4: '1', phq_5: '0', phq_6: '0', phq_7: '0', phq_8: '0', phq_9: '0' }, RS.ctxFor(p, null, 'm6', { hba1c: 8.5 }));
  const refs = RS.referralsFor(P, fired);
  const by = Object.fromEntries(refs.map((r) => [r.to, r]));
  assert.deepStrictEqual(Object.keys(by).sort(), ['chdr', 'mental_health']);
  assert.strictEqual(by.chdr.urgency, 'urgent', 'very high BP makes the CHDr referral urgent');
  assert.deepStrictEqual(by.chdr.rules.map((s) => s.rule.id).sort(), ['bp_very_high', 'hba1c_high_twice']);
  assert.strictEqual(by.mental_health.urgency, 'soon');
  assert.ok(!refs.some((r) => r.rules.some((s) => s.rule.id === 'sae')), 'a reportable event is not a referral');
});

test('performance by collector: follow-up, in window, missed, referrals', () => {
  const db = RS.seed();
  const of = (id) => db.participants.filter((p) => RS.STAFF.collectors.find((c) => c.id === id).clusters.includes(p.cluster));
  const ravi = RS.performance(db, P, of('c1')), anisha = RS.performance(db, P, of('c2'));
  [ravi, anisha].forEach((m) => {
    assert.strictEqual(m.visitsDue, m.visitsDone + m.visitsMissed);
    assert.ok(m.visitsInWindow <= m.visitsDone);
    assert.ok(m.completeness > 0.9 && m.completeness <= 1);
  });
  assert.ok(ravi.followUpRate < anisha.followUpRate, 'the demo builds in a follow-up gap between collectors');
  // A tiny hand-made case: one enrolled 120 days ago, month 3 done late, nothing else.
  const db2 = RS.emptyDb();
  const p = { id: 'x', status: 'enrolled', enrolledAt: D.addDays(D.today(), -120) };
  db2.participants.push(p);
  db2.visits.push({ id: 'r', participantId: 'x', visit: 'm3', status: 'complete', date: D.addDays(D.today(), -10), values: {}, safety: [] });
  const m = RS.performance(db2, P, [p]);
  assert.deepStrictEqual([m.visitsDue, m.visitsDone, m.visitsInWindow, m.visitsMissed], [1, 1, 0, 0]);
});

test('analysis: means by visit and within-person change', () => {
  const db = RS.emptyDb();
  const mk = (id, base, m6) => {
    const p = { id, status: 'enrolled', enrolledAt: '2025-01-01', cluster: 'esperance', dob: '1970-01-01', sex: 'F', screening: { answers: { htn_known: 'yes' } } };
    db.participants.push(p);
    db.visits.push({ id: id + 'b', participantId: id, visit: 'baseline', status: 'complete', date: '2025-01-01', values: { bp_2: `${base}/90`, bp_3: `${base}/90` } });
    if (m6) db.visits.push({ id: id + '6', participantId: id, visit: 'm6', status: 'complete', date: '2025-07-01', values: { bp_2: `${m6}/85`, bp_3: `${m6}/85` } });
    return p;
  };
  const a = mk('a', 160, 150), b = mk('b', 140, null);
  const sys = P.analysis.measures.find((x) => x.id === 'sys_mean');
  const out = RS.outcomeSeries(db, P, sys, [{ key: 'g', label: 'G', parts: [a, b] }]);
  assert.deepStrictEqual(out.visits, ['baseline', 'm6']);
  assert.strictEqual(out.series[0].points.baseline.mean, 150);
  assert.strictEqual(out.series[0].points.m6.n, 1);
  assert.deepStrictEqual(out.series[0].change, { mean: -10, n: 1 }, 'only people with both visits count towards change');
  const ctl = P.analysis.measures.find((x) => x.id === 'bp_controlled');
  assert.strictEqual(RS.outcomeSeries(db, P, ctl, [{ key: 'g', label: 'G', parts: [a, b] }]).series[0].points.baseline.mean, 0);
  const en = RS.enrolmentSeries([{ key: 'g', label: 'G', parts: [a, b] }], '2025-03-15');
  assert.deepStrictEqual(en.months, ['2025-01', '2025-02', '2025-03']);
  assert.deepStrictEqual(en.series[0].counts, [2, 2, 2]);
});

test('households link people; protocol checks referral sites and analysis measures', () => {
  const db = RS.seed();
  const anjali = db.participants.find((p) => p.name === 'Anjali Doorgakant');
  assert.deepStrictEqual(RS.householdMembers(db, anjali).map((p) => p.name), ['Dev Doorgakant']);
  assert.ok(/^H-\d{4}$/.test(RS.newHouseholdId(db)));
  assert.ok(!db.participants.some((p) => p.household === RS.newHouseholdId(db)));
  assert.ok(RS.exportParticipants(db).split('\n')[0].includes('household_id'));
  P.safety.filter((r) => r.referTo).forEach((r) => assert.ok(P.referralSites.some((s) => s.id === r.referTo), r.id));
  P.analysis.measures.forEach((m) => assert.ok(P.isField(m.id), m.id));
});

console.log(`\n${n - failed}/${n} passed`);
process.exit(failed ? 1 : 0);
