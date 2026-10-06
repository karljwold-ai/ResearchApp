# Protocol format

A protocol is one JavaScript file in `protocols/` that calls `RS.registerProtocol({...})`. It
contains only data. Conditions are written in the rule language below, never as code, so a reviewer
can read every rule.

When the app loads, it checks the protocol. If anything is wrong, it refuses to load and lists every
problem, for example:
- an unknown field in a condition;
- an answer that isn't one of a field's options;
- a duplicate id;
- an unknown form in a visit;
- a first visit that isn't day 0.

To add a protocol, add its file to `index.html` before `js/demo.js`.

## Top level

| Key | Meaning |
|---|---|
| `id`, `version`, `title`, `short` | `short` is used in messages ("the ICEHALL study team") |
| `idPrefix` | Study IDs are `<prefix>-0001`, … |
| `target` | Enrolment target (Data review) |
| `studyPhone` | Used in message templates as `{study_phone}` |
| `clusters` | `[{id, name, arm}]` |
| `languages` | Consent languages |
| `missingReasons` | Reasons a required value can be missing |
| `deviationCategories` | Used when a visit is started after its window closed |
| `needInfo` | Open items, listed on the Protocol screen |
| `listeningApproved` | `false` keeps listening off, except with Test tools |

## Arms, assignment and versions (study design)

The supervisor's **Study design** screen edits this same format and saves published versions on the
device. A protocol file is the starting point (version 1.0); arms are made from the clusters' arm names.

```js
arms: [{ id: 'arm1', name: 'Intervention' }, { id: 'arm2', name: 'Standard care' }],   // shown as "Arm 1: Intervention"
assignment: {
  method: 'cluster',          // single | cluster | collector | chosen | random
  visible: 'all',             // all | supervisor | none (blinded: "Arm A")
  collectorArms: { c1: 'arm1' },   // for method "collector"
  blockSizes: [4, 6],              // for method "random" (permuted blocks)
},
clusters: [{ id: 'esperance', name: 'Esperance Trebuchet', armId: 'arm1' }],
visits: [
  { id: 'baseline', label: 'Baseline', day: 0, forms: ['history', 'diet'] },          // every arm
  { id: 'm3', label: 'Month 3', day: 91, before: 14, after: 14, arms: ['arm2'],       // only arm 2 has it
    forms: ['diet', 'phq9'], armForms: { arm2: ['diet', 'phq9'] } },                  // sections per arm
],
retired: [{ id: 'occupation', label: '…', type: 'choice', retiredFrom: 'demographics' }],
```

- The participant's arm is fixed at consent (`participant.arm`, with `participant.allocation`:
  how, slot, reason, design version). Before that, or in older records, it comes from the cluster.
- A visit with `arms` is only for those arms (none: every arm; the first visit is always for every
  arm). `armForms` gives each arm its own sections at that visit; without it, every arm asks `forms`.
  The design keeps `forms` as every section asked by any arm. Conditions can't use the arm.
- `retired` lists questions removed after they were published: they are no longer asked, and stay in
  the exports and the codebook.
- Each published version records who, when and why; visit records keep `designVersion`.

## Screening and eligibility

```js
screening: { title: 'Screening', fields: [ /* fields, as below */ ] },
eligibility: [
  { id: 'age', kind: 'include', text: 'Aged 18 or older', when: 'age_years >= 18' },
  { id: 'trial', kind: 'exclude', text: 'In a conflicting trial', when: 'other_trial = yes' },
],
```

Each criterion has one of three states: met, not met, or unknown (still waiting for answers). A
person is eligible when every criterion is met.

## Consent

```js
consent: {
  version, language, method,
  sections: [{ title, text }],                    // the information sheet
  checks: [{ id, q, options: [...], answer }],    // comprehension questions
  options: [{ id, text, default, requiresApproval }],  // optional parts
},
```

Conditions can use an optional part as `consent_<id>`. For example, a form with
`show: 'consent_cmh = yes'` appears only for people who agreed to mental health screening.
`messages.consentOption` names the option that allows contact between visits.

## Visits

```js
visits: [
  { id: 'baseline', label: 'Baseline', day: 0, forms: ['history', 'measures'] },
  { id: 'm3', label: 'Month 3', day: 91, before: 14, after: 14, forms: ['measures'] },
],
```

Windows are counted from the enrolment date, so a late visit doesn't move the later ones. A visit
can be started while its window is open. After the window closes, it can still be started, but it
is recorded as a protocol deviation.

## Forms and fields

```js
forms: {
  measures: {
    title: 'Clinical measurements', source: 'Table 10.3', intro: 'Seated, after 5 minutes rest…',
    sensitive: false,     // true: hidden by default in the record
    noListening: false,   // true: never listened to
    show: 'condition',    // the whole form only when true
    fields: [
      { id: 'weight', label: 'Weight', type: 'number', unit: 'kg', min: 20, max: 250, soft: [35, 160], required: true, tolerance: 0.2, words: 'weigh* N | N kg/kilos' },
      { id: 'bp_1', label: 'BP reading 1', type: 'bp', limits: { sys: [60, 280], dia: [30, 180] }, soft: { sys: [85, 210], dia: [45, 130] }, words: 'first ... BP' },
      { id: 'smoking', label: 'Tobacco', type: 'choice', options: [['never', 'Never'], ['current', 'Current']] },
      { id: 'height', label: 'Height', type: 'number', show: 'visit = baseline' },
    ],
  },
},
```

| Field key | Meaning |
|---|---|
| `type` | `number`, `bp`, `yesno`, `choice`, `text` or `date` |
| `min`/`max` (or `limits` for BP) | Hard limits: a value outside them can't be saved |
| `soft` | Expected range: an unusual value becomes a data query for the supervisor |
| `required` | Needs a value or a missing-data reason |
| `integer` | Whole numbers only |
| `show` | Show the field only when the condition is true. Answers to hidden fields are dropped when the visit is completed |
| `words` | Phrases for listening (see below) |
| `tolerance` | How far a heard number may differ before the collector is asked to check |
| `help` | A short note shown under the question |

Field ids must be unique across the whole protocol.

## Calculated values

```js
derived: [
  { id: 'sys_mean', label: 'Systolic (mean of readings 2 and 3)', unit: 'mmHg', expr: 'MEAN(SYS(bp_2); SYS(bp_3))' },
  { id: 'bmi', label: 'BMI', decimals: 1, partial: true, needs: ['weight'], expr: 'weight / (IF(height != blank; height; prev_height) * IF(height != blank; height; prev_height) / 10000)' },
],
```

A calculated value is unknown if any value it uses is missing. With `partial: true`, missing values
are allowed and `needs` lists the values that must still be present. A condition (for example
`sys_mean < 140`) gives yes or no.

## Safety rules

```js
safety: [
  { id: 'self_harm', level: 'urgent', when: 'phq_9 >= 1', source: 'Table 8.4', text: 'PHQ-9 item 9 positive: …' },
  { id: 'sae', level: 'report', when: 'admitted = yes', text: 'Possible serious adverse event: …' },
],
```

| Level | Meaning |
|---|---|
| `urgent` | Act now |
| `soon` | Refer or review |
| `report` | Tell the supervisor |
| `note` | For information |

Rules show live while the form is filled in. Before an `urgent`, `soon` or `report` rule's visit can
be completed, the collector records what was done. `urgent` and `report` rules also create a safety
event for the supervisor to assess. `{field}` in the text is filled in, e.g. `BP {sys_mean}/{dia_mean}`.

## Referrals

```js
referralSites: [{ id: 'chdr', name: 'Area health centre: Community Health Doctor (CHDr)' }, { id: 'emergency', name: '…', note: '…' }],
handoff: {
  findings: ['bp_1', 'sys_mean', 'pulse', 'hba1c'],    // measurements on the sheet
  symptoms: ['chest_pain', 'admitted', 'admit_reason'], // shown when yes (or when text)
  history: ['cohort_dm', 'cvd_hx'],
  medicines: ['on_htn_meds', 'med_list'],
  sensitive: { mental_health: ['phq9_total'] },        // only on a referral to that site
  compare: ['sys_mean', 'hba1c'],                      // against the last visit
},
```

A safety rule with `referTo: '<site id>'` offers **Referred: handoff given**. Rules for the same site at
one visit share one referral and one sheet; an `urgent` rule makes it urgent.

## Analysis

```js
analysis: {
  note: 'Shown at the top of the Analysis screen',
  measures: [
    { id: 'sys_mean', label: 'Systolic BP', unit: 'mmHg', cohort: 'cohort_htn', better: 'lower' },
    { id: 'bp_controlled', label: 'BP below 140/90', kind: 'percent', yes: 'yes', cohort: 'cohort_htn', better: 'higher' },
  ],
},
```

`id` is a field or a calculated value. `cohort` is a yes/no calculated value from the screening answers,
and it limits who is counted. `better` sets which direction of change shows as an improvement.

## Messages

```js
messages: {
  consentOption: 'contact', reminderDaysBefore: 7, missedWithinDays: 14,
  templates: { reminder: { label, text }, missed: {…}, meds: {…} },
  encouragement: [{ id: 'meds', template: 'meds', when: 'on_htn_meds = yes', everyDays: 14, why: '…' }],
},
```

The `reminder` and `missed` templates are required. Placeholders: `{first_name}` `{study}`
`{study_phone}` `{collector}` `{visit}` `{from}` `{to}` `{ideal}`. Text in `[brackets]` must be
filled in before a message can be sent.

## Rule language

The same rule language as the ICEHALL clinical app.

| Part | Examples |
|---|---|
| Comparisons | `= != < <= > >=`, e.g. `pregnant = yes`, `hba1c >= 8` |
| Logic | `AND OR NOT ( … )` |
| Missing values | `x = blank`, `x != blank` |
| Arithmetic | `+ - * /` |
| Functions | `COUNT(a; b)` `SUM(…)` (needs every item) `MEAN(…)` `MIN(…)` `MAX(…)` `ABS(x)` `ROUND(x; 1)` `SYS(bp)` `DIA(bp)` `IF(cond; a; b)` |
| Built-in names | `age_years`, `sex` (`male`/`female`), `visit` (visit id), `consent_<option>`, `prev_<field>` (value at the last completed visit) |

Screening answers can be used in any later form, e.g. `htn_known = yes`.

Unknown answers never match: while `x` is unanswered, both `x = a` and `x != a` are false.

## Listening phrases (`words`)

These are the same phrases as the clinical app (see `js/rules.js`):

| Part | Meaning |
|---|---|
| `word*` | Any ending |
| `a/b` | Either word |
| `(word)` | Optional word |
| `...` | A short gap |
| `N` | A number |
| `BP` | A blood pressure, "120/80" or "120 over 80" |
| `re:…` | A raw regular expression |

For yes/no and choice fields, give the phrases for each answer: `yes: … | … ; no: …`.
