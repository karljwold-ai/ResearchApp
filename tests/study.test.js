/*
 * Tests for the study design (versions, arms, assignment, retiring) and the exports:  node tests/study.test.js
 */
'use strict';
const assert = require('assert');
const path = require('path');
global.RS = {};
// No localStorage in node: the study starts from the ICEHALL protocol file, as on a new tablet.
['js/core.js', 'js/rules.js', 'js/listen.js', 'protocols/icehall-v08.js', 'js/demo.js', 'js/study.js', 'js/export.js'].forEach((f) => require(path.join(__dirname, '..', f)));
const RS = global.RS;
const St = RS.study;

let n = 0, failed = 0;
function test(name, fn) {
  n++;
  try { fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + e.stack.split('\n').slice(0, 3).join('\n     ')); }
}

test('the ICEHALL protocol becomes design version 1.0 with two arms assigned by cluster', () => {
  const P = RS.protocol();
  assert.strictEqual(P.designVersion, '1.0');
  assert.deepStrictEqual(P.arms.map((a) => a.name), ['Intervention (5-2035)', 'Standard care']);
  assert.strictEqual(P.assignment.method, 'cluster');
  assert.strictEqual(St.armLabel(P, 'arm1'), 'Arm 1: Intervention (5-2035)');
  assert.strictEqual(RS.armOf({ cluster: 'escalier' }), 'arm2');
  assert.strictEqual(P.clusters.find((c) => c.id === 'escalier').arm, 'Standard care', 'existing screens still get the arm name');
  assert.ok(!St.draft());
});

test('who sees the arm follows the visibility setting', () => {
  const d = St.clone(St.latest().design);
  assert.strictEqual(St.armShown(d, 'arm2', 'COLLECTOR'), 'Arm 2: Standard care');
  d.assignment.visible = 'supervisor';
  assert.strictEqual(St.armShown(d, 'arm2', 'COLLECTOR'), 'Arm hidden');
  assert.strictEqual(St.armShown(d, 'arm2', 'SUPERVISOR'), 'Arm 2: Standard care');
  d.assignment.visible = 'none';
  assert.strictEqual(St.armShown(d, 'arm2', 'SUPERVISOR'), 'Arm B');
});

test('unlocking needs the password and opens a draft; the running version does not change', () => {
  assert.strictEqual(St.unlock('123456'), false);
  assert.ok(!St.draft());
  assert.strictEqual(St.unlock(St.DEMO_PASSWORD), true);
  assert.ok(St.draft());
  St.draft().title = 'Changed';
  assert.notStrictEqual(RS.protocol().title, 'Changed');
  assert.deepStrictEqual(St.changes(null).map((c) => c.kind), ['change']);
  St.discard();
  assert.ok(!St.draft());
});

test('sections are per arm: a section limited to one arm is skipped for the other', () => {
  const d = St.clone(St.latest().design);
  d.forms.diet.arms = ['arm1'];
  const keepP = RS.protocols[d.id];
  try {
    RS.registerProtocol(St.toRuntime(d, 'test'));
    const P = RS.protocol();
    const base = P.visits[0];
    const titles = (cluster) => RS.visitSections(P, base, {}, RS.ctxFor({ cluster, dob: '1970-01-01', sex: 'F', consent: { options: { cmh: true } }, screening: { answers: { dm_known: 'yes', htn_known: 'yes' } } }, '2026-10-01', 'baseline')).map((s) => s.form.id);
    assert.ok(titles('esperance').includes('diet'), 'arm 1 asks it');
    assert.ok(!titles('escalier').includes('diet'), 'arm 2 does not');
  } finally { RS.protocols[d.id] = keepP; }
});

test('copying an arm: shared sections, or separate copies with new variable names', () => {
  const d = St.clone(St.latest().design);
  d.arms.push({ id: 'arm3', name: 'SMS' });
  Object.values(d.forms).forEach((f) => { f.arms = ['arm1']; });
  St.copyArm(d, 'arm1', 'arm3', false);
  assert.ok(Object.values(d.forms).every((f) => f.arms.includes('arm3')), 'shared: same sections, one copy');
  const before = Object.keys(d.forms).length;
  const d2 = St.clone(St.latest().design);
  d2.arms.push({ id: 'arm3', name: 'SMS' });
  Object.values(d2.forms).forEach((f) => { f.arms = ['arm1']; });
  St.copyArm(d2, 'arm1', 'arm3', true);
  assert.strictEqual(Object.keys(d2.forms).length, before * 2, 'separate: a copy of each section');
  const copy = Object.values(d2.forms).find((f) => f.arms.length === 1 && f.arms[0] === 'arm3' && f.title === d2.forms.phq9.title);
  assert.ok(copy && copy.fields.every((f) => /arm3/.test(f.id)), 'copies get their own variable names');
  assert.deepStrictEqual(St.check(d2), [], 'the copied design is valid');
});

test('removing a published question retires it, and exports keep its column', () => {
  assert.ok(St.unlock(St.DEMO_PASSWORD));
  const d = St.draft();
  St.removeField(d, 'demographics', 'occupation');
  assert.ok(!d.forms.demographics.fields.some((f) => f.id === 'occupation'));
  assert.ok(d.retired.some((f) => f.id === 'occupation' && f.retiredFrom === 'demographics'));
  const db = RS.seed();
  const ch = St.changes(db);
  const line = ch.find((c) => /Main occupation/.test(c.text));
  assert.strictEqual(line.kind, 'remove');
  assert.ok(/visit records? ha(s|ve) data/.test(line.text), line.text);
  // A new question (not published) is simply deleted.
  d.forms.demographics.fields.push({ id: 'new_q', label: 'New', type: 'yesno' });
  St.removeField(d, 'demographics', 'new_q');
  assert.ok(!d.retired.some((f) => f.id === 'new_q'));
  const v = St.publish('Test amendment', 'Tester');
  assert.strictEqual(v, '1.1');
  assert.strictEqual(St.latest().reason, 'Test amendment');
  const runtime = St.toRuntime(St.latest().design, v);
  const keepP = RS.protocols[runtime.id];
  try {
    RS.registerProtocol(runtime);
    const head = RS.exportVisits(db, RS.protocol()).split('\n')[0].split(',');
    assert.ok(head.includes('occupation'), 'retired column kept');
    assert.ok(head.includes('arm') && head.includes('design_version'));
    assert.ok(/occupation,demographics,.*retired/.test(RS.codebook(RS.protocol())), 'codebook marks it retired');
  } finally { RS.protocols[runtime.id] = keepP; }
});

test('the checker refuses a broken design without touching the running one', () => {
  const d = St.clone(St.latest().design);
  d.forms.demographics.fields.push({ id: 'bad', label: 'Bad', type: 'yesno', show: 'nope = yes' });
  const running = RS.protocol();
  const problems = St.check(d);
  assert.ok(problems.some((p) => /unknown name “nope”/.test(p)), problems.join('; '));
  assert.strictEqual(RS.protocol(), running);
});

test('randomisation: permuted blocks keep arms balanced; slots are used in order and never redrawn', () => {
  const d = St.clone(St.latest().design);
  d.assignment.method = 'random';
  d.assignment.blockSizes = [4];
  let seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const list = St.allocationList(d, 40, rand);
  for (let i = 0; i < 40; i += 4) {
    const block = list.slice(i, i + 4);
    assert.strictEqual(block.filter((a) => a === 'arm1').length, 2, 'each block of 4 has 2 of each');
  }
  const db = { allocation: null };
  const a1 = St.assignArm(db, d, {}, {});
  const a2 = St.assignArm(db, d, {}, {});
  assert.deepStrictEqual([a1.slot, a2.slot], [1, 2]);
  assert.strictEqual(a1.how, 'random');
  assert.strictEqual(db.allocation.next, 2);
});

test('other assignment methods: cluster, collector, chosen, single', () => {
  const d = St.clone(St.latest().design);
  assert.strictEqual(St.assignArm({}, d, { cluster: 'escalier' }, {}).arm, 'arm2');
  d.assignment.method = 'collector';
  d.assignment.collectorArms = { c2: 'arm2' };
  assert.strictEqual(St.assignArm({}, d, {}, { collectorId: 'c2' }).arm, 'arm2');
  assert.strictEqual(St.assignArm({}, d, {}, { collectorId: 'c1' }).arm, 'arm1', 'unset collector: arm 1');
  d.assignment.method = 'chosen';
  const c = St.assignArm({}, d, {}, { chosen: 'arm2', reason: 'Pilot' });
  assert.deepStrictEqual([c.arm, c.how, c.reason], ['arm2', 'chosen', 'Pilot']);
  d.assignment.method = 'single';
  assert.strictEqual(St.assignArm({}, d, { cluster: 'escalier' }, {}).arm, 'arm1');
});

test('new question ids come from the wording and never clash', () => {
  const d = St.clone(St.latest().design);
  assert.strictEqual(St.newId(d, 'Weight'), 'weight_2', 'weight is taken');
  assert.strictEqual(St.newId(d, 'Number of meals with vegetables in the past seven days'), 'number_of_meals_with');
  assert.ok(!/^\d/.test(St.newId(d, '7 day recall')));
});

test('exports: long format, codebook, REDCap dictionary and archive', () => {
  const db = RS.seed();
  const P = RS.protocol();
  const long = RS.exportLong(db, P).split('\n');
  assert.deepStrictEqual(long[0].split(',').slice(0, 4), ['study_id', 'household_id', 'cluster', 'arm']);
  assert.ok(long.length > 100);
  assert.ok(!/Ramdin|Bholah/.test(long.join('\n')), 'no staff or participant names');
  const cb = RS.codebook(P);
  assert.ok(/^variable,section,section_title,question,type/.test(cb));
  assert.ok(/phq9_total|phq_1/.test(cb));
  const rc = RS.redcapDictionary(P).split('\n');
  assert.ok(rc[0].startsWith('Variable / Field Name,Form Name'));
  assert.ok(rc[1].startsWith('record_id,'));
  const names = db.participants.filter((p) => p.name).map((p) => p.name);
  const plain = RS.archive(db, P, {});
  assert.ok(!names.some((nm) => plain.includes(nm)), 'de-identified archive has no names');
  const ident = RS.exportParticipants(db, { identified: true });
  assert.ok(ident.split('\n')[0].includes('name') && names.some((nm) => ident.includes(nm)));
  assert.ok(!RS.exportParticipants(db).split('\n')[0].split(',').includes('name'));
});

console.log(`\n${n - failed}/${n} passed`);
process.exit(failed ? 1 : 0);
