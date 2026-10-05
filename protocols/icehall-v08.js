/*
 * ICEHALL Protocol v08 (21 June 2026, draft for IRB and leadership review): research visit modules.
 *
 * Built from the protocol's
 *   Table 6.1  eligibility           Table 7.1 + Appendix B  consent modules
 *   Table 11.1 schedule of activities (which forms at which visit)
 *   Table 10.3 instruments           Table 8.3a  diabetes CMA decision points
 *   Table 8.4  mental health screening thresholds
 *   Table 15.1 clinical escalation   Appendix C  protocol deviation categories
 *
 * Where v08 still says NEED INFO, this file uses a clearly marked placeholder (search for "ASSUMPTION").
 * Licensed instruments (MARS-5, EQ-5D-5L) are captured as item scores only: the licensed wording stays on
 * the approved paper or tablet form. PHQ-9 and GAD-7 wording is free to use.
 * Clusters and arms below are DEMO placeholders, not the real randomisation list.
 */
(function () {
  'use strict';
  const RS = (typeof window !== 'undefined' ? window : global).RS;

  const BP_LIMITS = { sys: [60, 280], dia: [30, 180] };
  const BP_SOFT = { sys: [85, 210], dia: [45, 130] };
  const yn = (id, label, extra) => Object.assign({ id, label, type: 'yesno' }, extra || {});
  const PHQ_OPTS = [['0', 'Not at all'], ['1', 'Several days'], ['2', 'More than half the days'], ['3', 'Nearly every day']];
  const LEVELS_5 = [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']];

  RS.registerProtocol({
    id: 'icehall-v08',
    version: 'v08 (21 Jun 2026, IRB draft)',
    title: 'ICEHALL: Interventions in Communities to Encourage Health for ALL Impact Study',
    short: 'ICEHALL study',
    idPrefix: 'ICE-MU',
    target: 300, // ASSUMPTION: demo enrolment target for one site; v08 sizes clusters, not a site total
    studyPhone: '5 700 0000', // DEMO number: the real study line is NEED INFO
    // Open items from v08 that the app needs (shown on the Protocol screen with the marked assumptions).
    needInfo: [
      'Study phone number for messages (a demo number is used)',
      'Visit windows (v08 gives timepoints only; ±14 days for months 3–12 and ±28 days for 18–24 are assumed)',
      'Country BP and glucose thresholds for urgent referral (CMA; 180/110 and 400 mg/dL are placeholders)',
      'Final consent form wording and translations (English, French, Kreol Morisien)',
      'Participant reimbursement amount',
      'Cluster list and randomisation (demo clusters and arms are invented)',
      'Licensed instrument versions (MARS-5, EQ-5D-5L) and country adaptations (PREDIMED, IPAQ, HFIAS, CSRI)',
    ],
    sponsor: 'Global Foundation for Community Health / GCHF Mauritius, with MGH Center for Global Health',
    summary: 'Pragmatic cluster-randomised trial of the 5-2035 CHO-led community health model versus community standard of care. Research assessments at baseline and months 3, 6, 9, 12, 18 and 24 for adults with type 2 diabetes, hypertension or high cardiovascular risk. Co-primary outcomes: change in HbA1c (diabetes cohort) and systolic BP (hypertension cohort) over 24 months.',
    site: 'Mauritius (organizing center; submitted first)',
    languages: ['English', 'French', 'Kreol Morisien'],
    status: 'Draft protocol: not yet IRB-approved. Use for demonstration and training only.',
    // DEMO clusters: names from v08 Table 5.2; the arm assignments are invented for the demo.
    clusters: [
      { id: 'esperance', name: 'Esperance Trebuchet', arm: 'Intervention (5-2035)' },
      { id: 'escalier', name: "L'Escalier", arm: 'Standard care' },
      { id: 'pretres', name: 'Vallée des Prêtres', arm: 'Intervention (5-2035)' },
      { id: 'rodrigues', name: 'Rodrigues', arm: 'Standard care' },
    ],
    missingReasons: ['Refused', 'Result not back yet', 'Not done: equipment unavailable', 'Not done: participant unwell', "Doesn't know", 'Not done: consent not given for this module', 'Other'],
    // Appendix C
    deviationCategories: ['Outcome measurement: wrong timing window', 'Outcome measurement: uncalibrated device', 'Outcome measurement: missed lab', 'Consent', 'Eligibility', 'Data', 'Safety', 'AI/digital', 'Intervention fidelity'],

    /* ---------------- Screening and eligibility (Table 6.1, 8.3a) ---------------- */
    screening: {
      title: 'Screening',
      fields: [
        yn('resident', 'Resident of a selected cluster'),
        yn('stay_12m', 'Expects to live here for at least 12 more months (no plan to move soon)'),
        yn('willing_baseline', 'Willing to have the baseline assessment'),
        yn('can_consent', 'Able to give informed consent (or an approved surrogate pathway applies)'),
        yn('other_trial', 'Taking part in another interventional trial that could conflict'),
        yn('dm_known', 'Told by a health worker they have diabetes'),
        yn('type1_or_gdm', 'Likely type 1 diabetes, or diabetes only in pregnancy (gestational)', { show: 'dm_known = yes', help: 'Excludes from the diabetes cohort only.' }),
        { id: 'screen_hba1c', label: 'Point-of-care HbA1c', type: 'number', unit: '%', min: 3, max: 20, soft: [4, 15], show: 'dm_known != yes', help: 'CMA 8.3a: age 30+ or risk factors. HbA1c 6.5% or more = screen positive.' },
        { id: 'screen_rbg', label: 'Random blood glucose (if no HbA1c)', type: 'number', unit: 'mg/dL', min: 20, max: 900, soft: [60, 400], show: 'dm_known != yes AND screen_hba1c = blank', help: '200 mg/dL or more = screen positive.' },
        yn('htn_known', 'Told by a health worker they have high blood pressure'),
        { id: 'screen_bp', label: 'Screening blood pressure (seated, after 5 minutes rest)', type: 'bp', unit: 'mmHg', limits: BP_LIMITS, soft: BP_SOFT },
        yn('cv_risk_high', 'High cardiovascular risk by the CMA risk chart', { help: 'ASSUMPTION: the country CMA defines the chart and cut-off (v08 NEED INFO).' }),
        yn('emergency_now', 'Needs urgent care today (hypertensive or metabolic emergency, chest pain, stroke signs)', { help: 'If yes: refer now. They can be screened again once stable.' }),
      ],
    },
    eligibility: [
      { id: 'age', kind: 'include', text: 'Aged 18 or older (15–17 only under an IRB-approved adolescent protocol, not enabled here)', when: 'age_years >= 18' },
      { id: 'resident', kind: 'include', text: 'Resident of a selected cluster', when: 'resident = yes' },
      { id: 'stay', kind: 'include', text: 'Expected residence of at least 12 months', when: 'stay_12m = yes' },
      { id: 'baseline', kind: 'include', text: 'Willing to undergo baseline assessment', when: 'willing_baseline = yes' },
      { id: 'cohort', kind: 'include', text: 'In a clinical cohort: type 2 diabetes, hypertension, or high cardiovascular risk (known or found at screening)', when: 'cohort_dm = yes OR cohort_htn = yes OR cv_risk_high = yes' },
      { id: 'consent', kind: 'exclude', text: 'Unable to consent and no approved surrogate pathway', when: 'can_consent = no' },
      { id: 'trial', kind: 'exclude', text: 'Enrolled in a conflicting interventional trial', when: 'other_trial = yes' },
      { id: 'emergency', kind: 'exclude', text: 'Emergency needing urgent referral at screening (refer; rescreen when stable)', when: 'emergency_now = yes' },
    ],

    /* ---------------- Consent (Table 7.1, Appendix B) ---------------- */
    consent: {
      version: 'ICEHALL ICF draft for v08 (not yet approved)',
      language: 'English, French or Kreol Morisien (Table 7.1)',
      method: 'Written consent; witnessed oral consent or thumbprint where literacy is limited (if approved by the IRB)',
      sections: [
        { title: 'What this study is', text: 'ICEHALL tests whether a community health model, built around trained Community Health Officers, improves diabetes, blood pressure and heart risk compared with the usual care in similar communities. Whole communities are assigned to one or the other by chance (randomisation). Usual care stays available everywhere.' },
        { title: 'What happens if you join', text: 'A study worker will see you now and at 3, 6, 9, 12, 18 and 24 months. Each visit takes 45–90 minutes. We measure blood pressure, weight and waist, ask about your health, medicines, food, mood and costs, and test HbA1c (people with diabetes) and other blood tests at some visits: about 5 blood samples over 2 years.' },
        { title: 'Research is not the same as your care', text: 'The study assessments are research. Your care continues at your usual health centre. If we find a dangerous result, we will refer you.' },
        { title: 'Risks', text: 'Some discomfort from blood tests and the blood pressure cuff. Some questions, about mood for example, are personal: you can skip any question. Your information could be seen by someone who should not see it; we protect it to make this unlikely.' },
        { title: 'Your information', text: 'Your name, address and phone are kept in this country with the strictest protection. Research data use a study number. Results are reported only as groups. Data leave the country only without names and only with approval.' },
        { title: 'Your choice', text: 'Taking part is your choice. You can stop at any time without giving a reason and your care will not change. You can also say no to any optional part below and still take part.' },
        { title: 'Payment', text: 'You will be paid back for travel and time as approved by the ethics committee. [Amount: NEED INFO]' },
        { title: 'Questions', text: 'Study team: 5 700 0000 (demo number). Ethics committee: [contact to be added].' },
      ],
      checks: [
        { id: 'voluntary', q: 'Can you stop being in the study at any time?', options: ['Yes', 'No', 'Not sure'], answer: 'Yes' },
        { id: 'care', q: 'If you stop, will your usual care change?', options: ['Yes', 'No', 'Not sure'], answer: 'No' },
        { id: 'visits', q: 'How long will the study visits go on for?', options: ['1 month', '2 years', 'Only today'], answer: '2 years' },
        { id: 'research', q: 'Are the study visits the same as your treatment at the health centre?', options: ['Yes', 'No', 'Not sure'], answer: 'No' },
      ],
      // Appendix B optional modules. GLP-1 sub-study is not activated in v08 and is left out.
      options: [
        { id: 'contact', text: 'You may contact me between visits (phone or text message)', default: true },
        { id: 'records', text: 'You may look at my health centre records', default: true },
        { id: 'cmh', text: 'I agree to mental health screening questions (PHQ-9 and GAD-7) and referral if needed', default: true },
        { id: 'qual', text: 'I may be asked to take part in an interview or group discussion', default: false },
        { id: 'pgd', text: 'I agree to keep a home blood pressure or glucose log for the study', default: false },
        { id: 'future', text: 'My data without my name may be used for future approved research', default: true },
        { id: 'audio', text: 'Audio listening for documentation feasibility (AI scribe sub-study). Only if that amendment is approved.', default: false, requiresApproval: true },
      ],
    },
    // Layer 5 (v08 §1, §14): AI scribe and audio capture need a separate IRB amendment before participant-facing use.
    listeningApproved: false,

    /* ---------------- Visits (Table 11.1) ---------------- */
    // ASSUMPTION: v08 doesn't define visit windows. ±14 days for 3-monthly visits, ±28 days for months 18 and 24.
    visits: [
      { id: 'baseline', label: 'Baseline', day: 0, forms: ['demographics', 'history', 'medicines', 'adherence', 'measures', 'poc_lab', 'venous_lab', 'diet', 'activity', 'phq9', 'gad7', 'eq5d', 'experience', 'resource'] },
      { id: 'm3', label: 'Month 3', day: 91, before: 14, after: 14, forms: ['events', 'medicines', 'adherence', 'measures', 'diet', 'activity'] },
      { id: 'm6', label: 'Month 6', day: 182, before: 14, after: 14, forms: ['events', 'medicines', 'adherence', 'measures', 'poc_lab', 'diet', 'activity', 'phq9', 'gad7', 'eq5d', 'experience', 'resource'] },
      { id: 'm9', label: 'Month 9', day: 273, before: 14, after: 14, forms: ['events', 'medicines', 'adherence', 'measures'] },
      { id: 'm12', label: 'Month 12', day: 365, before: 14, after: 14, forms: ['events', 'demographics', 'medicines', 'adherence', 'measures', 'poc_lab', 'venous_lab', 'diet', 'activity', 'phq9', 'gad7', 'eq5d', 'experience', 'resource'] },
      { id: 'm18', label: 'Month 18', day: 547, before: 28, after: 28, forms: ['events', 'medicines', 'adherence', 'measures', 'poc_lab', 'diet', 'activity', 'phq9', 'gad7', 'resource'] },
      { id: 'm24', label: 'Month 24 (final)', day: 730, before: 28, after: 28, forms: ['events', 'demographics', 'medicines', 'adherence', 'measures', 'poc_lab', 'venous_lab', 'diet', 'activity', 'phq9', 'gad7', 'eq5d', 'experience', 'resource'] },
    ],

    /* ---------------- Forms (Table 10.3 instruments; Appendix E CRF domains) ---------------- */
    forms: {
      demographics: {
        title: 'Demographics and household', source: 'Table 10.3 (DHS-style household survey; final instrument NEED INFO)',
        fields: [
          { id: 'education', label: 'Highest education completed', type: 'choice', required: true, options: [['none', 'None'], ['primary', 'Primary'], ['secondary', 'Secondary'], ['tertiary', 'Tertiary']] },
          { id: 'occupation', label: 'Main occupation', type: 'choice', required: true, options: [['employed', 'Employed'], ['self', 'Self-employed'], ['home', 'Home duties'], ['retired', 'Retired'], ['unemployed', 'Unemployed'], ['other', 'Other']] },
          { id: 'household', label: 'People living in the household', type: 'number', integer: true, min: 1, max: 40, soft: [1, 15], required: true },
          { id: 'income_band', label: 'Household income band (income proxy)', type: 'choice', options: [['1', 'Lowest'], ['2', 'Low'], ['3', 'Middle'], ['4', 'High'], ['5', 'Highest'], ['na', 'Prefers not to say']], help: 'ASSUMPTION: bands to be set by the country team.' },
          yn('move_2y', 'Plans to move away in the next 2 years (migration risk)', { required: true }),
        ],
      },
      history: {
        title: 'Medical history', source: 'Table 10.3, Table 8.3a, Table 8.3c',
        fields: [
          { id: 'dm_dx_age', label: 'Age when diabetes was diagnosed', type: 'number', integer: true, unit: 'years', min: 1, max: 100, show: 'cohort_dm = yes' },
          yn('dm_hypo_hx', 'Ever had a severe low sugar episode (needed help from someone)', { show: 'cohort_dm = yes', required: true }),
          yn('dm_dka_hx', 'Ever had ketoacidosis (DKA)', { show: 'cohort_dm = yes' }),
          yn('cvd_hx', 'Ever had a heart attack, stroke or heart failure', { required: true, words: 'yes: heart attack | stroke | heart failure ; no: re:\\bno (?:heart attack|stroke)\\b' }),
          yn('ckd_hx', 'Told they have kidney disease', { required: true }),
          { id: 'smoking', label: 'Tobacco smoking', type: 'choice', required: true, options: [['never', 'Never'], ['former', 'Former'], ['current', 'Current']], words: 'never: never smoke* | (do/does) not smoke ; former: stopped smoking | used to smoke | quit* ; current: (still) smoke* | smokes' },
          { id: 'alcohol', label: 'Alcohol in the last 30 days', type: 'choice', required: true, options: [['none', 'None'], ['some', 'Some days'], ['most', 'Most days']] },
          yn('pregnant', 'Currently pregnant', { show: 'sex = female AND age_years < 55', required: true }),
          yn('snoring', 'Loud snoring or stops breathing in sleep (sleep apnoea symptoms)'),
          yn('joint_pain', 'Knee or joint pain that limits walking'),
        ],
      },
      events: {
        title: 'Adverse events and referrals since the last visit', source: 'Table 11.1 (adverse event and referral review), Table 15.1',
        fields: [
          yn('admitted', 'Admitted to hospital since the last visit', { required: true, words: 'yes: admitted | stayed in (the) hospital ; no: not admitted | not been ... hospital | no hospital' }),
          { id: 'admit_reason', label: 'Reason for admission (as reported)', type: 'text', show: 'admitted = yes', required: true },
          { id: 'ed_visits', label: 'Emergency department visits since the last visit', type: 'number', integer: true, min: 0, max: 30, required: true },
          yn('pregnant_now', 'Pregnant now', { show: 'sex = female AND age_years < 55', required: true }),
          yn('chest_pain', 'Chest pain, stroke symptoms (one-sided weakness, face drop, speech trouble) or severe breathlessness now', { required: true, words: 'yes: chest pain | pain in (my/the) chest | weak* ... one side | trouble speaking ; no: re:\\bno chest pain\\b' }),
          yn('dm_red_flags', 'Diabetes red flags now: very thirsty and passing a lot of urine with vomiting or drowsiness, a foot ulcer, or new vision change', { show: 'cohort_dm = yes', required: true }),
          yn('severe_hypo', 'Severe low sugar episode since the last visit', { show: 'cohort_dm = yes', required: true }),
          yn('referral_done', 'Was referred by the study since the last visit and went', { help: 'Referral completion (Table 10.2).' }),
        ],
      },
      medicines: {
        title: 'Medication inventory', source: 'Table 10.3 (structured medication inventory; coding dictionary NEED INFO)',
        fields: [
          yn('on_htn_meds', 'Taking medicine for blood pressure', { required: true, words: 'yes: (blood) pressure medicine*/tablet*/pills | amlodipine | losartan | enalapril | hydrochlorothiazide ; no: no (blood) pressure medicine*/tablet*/pills | not taking ... pressure medicine*/tablet*/pills' }),
          yn('on_dm_meds', 'Taking tablets for diabetes', { show: 'cohort_dm = yes', required: true, words: 'yes: metformin | gliclazide | diabetes tablet*/medicine* | sugar tablet* ; no: no diabetes tablet*/medicine*' }),
          yn('on_insulin', 'Using insulin', { show: 'cohort_dm = yes', required: true, words: 'yes: insulin ; no: no insulin | not on insulin' }),
          yn('on_statin', 'Taking a cholesterol medicine (statin)', { required: true, words: 'yes: statin | atorvastatin | simvastatin | cholesterol tablet* ; no: no cholesterol tablet*' }),
          { id: 'med_list', label: 'Medicines (names and doses, from the packets)', type: 'text' },
          yn('med_access', 'Could not get a prescribed medicine in the last month', { required: true }),
          { id: 'med_cost', label: 'Spent on medicines last month', type: 'number', unit: 'MUR', min: 0, max: 100000 },
          { id: 'side_effects', label: 'Side effects from any of these medicines', type: 'text' },
        ],
      },
      adherence: {
        title: 'Medication adherence (MARS-5)', source: 'Table 10.3: MARS-5. Licensed instrument: read the items from the approved form; enter each item score.',
        intro: 'Read each MARS-5 item from the licensed form. Score each 1–5 as on the form (5 = never).',
        show: 'on_htn_meds = yes OR on_dm_meds = yes OR on_insulin = yes OR on_statin = yes',
        fields: [1, 2, 3, 4, 5].map((i) => ({ id: 'mars_' + i, label: `MARS-5 item ${i}`, type: 'choice', options: LEVELS_5, required: true, show: 'on_htn_meds = yes OR on_dm_meds = yes OR on_insulin = yes OR on_statin = yes' })),
      },
      measures: {
        title: 'Clinical measurements', source: 'Table 10.3: WHO STEPS-adapted SOP (equipment and calibration SOP NEED INFO)',
        intro: 'Seated, after 5 minutes rest, arm supported at heart level. Three readings, 1–2 minutes apart. The mean of readings 2 and 3 is used.',
        fields: [
          { id: 'bp_1', label: 'BP reading 1', type: 'bp', unit: 'mmHg', required: true, limits: BP_LIMITS, soft: BP_SOFT, words: 'first ... BP | reading one ... BP' },
          { id: 'bp_2', label: 'BP reading 2', type: 'bp', unit: 'mmHg', required: true, limits: BP_LIMITS, soft: BP_SOFT, words: 'second ... BP | reading two ... BP' },
          { id: 'bp_3', label: 'BP reading 3', type: 'bp', unit: 'mmHg', required: true, limits: BP_LIMITS, soft: BP_SOFT, words: 'third ... BP | reading three ... BP | last reading ... BP' },
          { id: 'pulse', label: 'Pulse', type: 'number', unit: '/min', integer: true, min: 25, max: 220, soft: [45, 120], required: true, words: 'pulse N | heart rate N' },
          { id: 'weight', label: 'Weight', type: 'number', unit: 'kg', min: 20, max: 250, soft: [35, 160], required: true, tolerance: 0.2, words: 'weigh* N | N kg/kilo/kilos/kilograms' },
          { id: 'height', label: 'Height', type: 'number', unit: 'cm', min: 100, max: 220, soft: [135, 200], required: true, show: 'visit = baseline', words: 'height N | N cm/centimetres/centimeters tall' },
          { id: 'waist', label: 'Waist circumference', type: 'number', unit: 'cm', min: 40, max: 200, soft: [55, 150], required: true, tolerance: 0.5, words: 'waist N' },
        ],
      },
      poc_lab: {
        title: 'Point-of-care HbA1c', source: 'Table 10.3 (DCA Vantage or equivalent); Table 11.1 HbA1c at baseline, 6, 12, 18, 24 months',
        fields: [
          { id: 'hba1c', label: 'HbA1c', type: 'number', unit: '%', min: 3, max: 20, soft: [4, 15], required: true, show: 'cohort_dm = yes', words: 'a1c N | hba1c N' },
          { id: 'rbg', label: 'Random blood glucose (only if checked today)', type: 'number', unit: 'mg/dL', min: 20, max: 900, soft: [60, 400], show: 'cohort_dm = yes' },
        ],
      },
      venous_lab: {
        title: 'Venous blood and urine', source: 'Table 10.3; Table 11.1 lipids and renal function at baseline, 12, 24 months',
        intro: 'Results usually come back later: mark them "Result not back yet" and add them when they arrive (the supervisor records late results with a reason). Units: ASSUMPTION mmol/L, µmol/L and mg/mmol (country lab NEED INFO).',
        fields: [
          yn('blood_taken', 'Venous sample taken today', { required: true }),
          { id: 'chol_total', label: 'Total cholesterol', type: 'number', unit: 'mmol/L', min: 1, max: 20, soft: [2.5, 9], required: true, show: 'blood_taken = yes' },
          { id: 'hdl', label: 'HDL cholesterol', type: 'number', unit: 'mmol/L', min: 0.2, max: 5, soft: [0.6, 3], required: true, show: 'blood_taken = yes' },
          { id: 'trig', label: 'Triglycerides', type: 'number', unit: 'mmol/L', min: 0.1, max: 50, soft: [0.3, 8], show: 'blood_taken = yes' },
          { id: 'creat', label: 'Creatinine', type: 'number', unit: 'µmol/L', min: 20, max: 2000, soft: [40, 200], required: true, show: 'blood_taken = yes' },
          { id: 'egfr', label: 'eGFR (from the lab)', type: 'number', unit: 'mL/min/1.73m²', min: 2, max: 200, soft: [30, 140], show: 'blood_taken = yes' },
          { id: 'uacr', label: 'Urine albumin/creatinine ratio (if available)', type: 'number', unit: 'mg/mmol', min: 0, max: 1000 },
        ],
      },
      diet: {
        title: 'Diet quality and food security', source: 'Table 10.3: PREDIMED-adapted 14-item screener (provisional; country adaptation NEED INFO); Table 8.3d HFIAS',
        fields: [
          { id: 'predimed', label: 'Diet screener total (PREDIMED-adapted, 0–14)', type: 'number', integer: true, min: 0, max: 14, required: true, help: 'Score from the adapted paper screener until the country version is final.' },
          { id: 'food_security', label: 'Household food insecurity (HFIAS category)', type: 'choice', required: true, options: [['secure', 'Food secure'], ['mild', 'Mild'], ['moderate', 'Moderate'], ['severe', 'Severe']] },
          { id: 'cook', label: 'Who mostly decides and cooks the meals', type: 'choice', options: [['self', 'Participant'], ['spouse', 'Spouse or partner'], ['other', 'Someone else'], ['shared', 'Shared']] },
        ],
      },
      activity: {
        title: 'Physical activity (IPAQ-Short)', source: 'Table 10.3: IPAQ-Short Form (provisional)',
        intro: 'About the last 7 days. Only count activity done for at least 10 minutes at a time.',
        fields: [
          { id: 'vig_days', label: 'Days of vigorous activity (heavy lifting, digging, fast cycling)', type: 'number', integer: true, min: 0, max: 7, required: true },
          { id: 'vig_min', label: 'Minutes of vigorous activity on one of those days', type: 'number', integer: true, min: 10, max: 960, required: true, show: 'vig_days > 0' },
          { id: 'mod_days', label: 'Days of moderate activity (carrying light loads, normal cycling)', type: 'number', integer: true, min: 0, max: 7, required: true },
          { id: 'mod_min', label: 'Minutes of moderate activity on one of those days', type: 'number', integer: true, min: 10, max: 960, required: true, show: 'mod_days > 0' },
          { id: 'walk_days', label: 'Days walking for at least 10 minutes', type: 'number', integer: true, min: 0, max: 7, required: true, words: 'walk* ... N days' },
          { id: 'walk_min', label: 'Minutes walking on one of those days', type: 'number', integer: true, min: 10, max: 960, required: true, show: 'walk_days > 0' },
          { id: 'sit_min', label: 'Minutes sitting on a weekday', type: 'number', integer: true, min: 0, max: 1200, soft: [60, 960] },
        ],
      },
      phq9: {
        title: 'Mood (PHQ-9)', source: 'Table 8.4: PHQ-9 (free to use)', sensitive: true, noListening: true,
        show: 'consent_cmh = yes',
        intro: 'Over the last 2 weeks, how often have you been bothered by any of the following problems?',
        fields: [
          'Little interest or pleasure in doing things', 'Feeling down, depressed, or hopeless', 'Trouble falling or staying asleep, or sleeping too much', 'Feeling tired or having little energy', 'Poor appetite or overeating',
          'Feeling bad about yourself, or that you are a failure or have let yourself or your family down', 'Trouble concentrating on things, such as reading the newspaper or watching television',
          'Moving or speaking so slowly that other people could have noticed, or the opposite: being so fidgety or restless that you have been moving around a lot more than usual',
          'Thoughts that you would be better off dead, or of hurting yourself in some way',
        ].map((q, i) => ({ id: 'phq_' + (i + 1), label: `${i + 1}. ${q}`, type: 'choice', options: PHQ_OPTS, required: true, show: 'consent_cmh = yes' })),
      },
      gad7: {
        title: 'Anxiety (GAD-7)', source: 'Table 8.4: GAD-7 (free to use)', sensitive: true, noListening: true,
        show: 'consent_cmh = yes',
        intro: 'Over the last 2 weeks, how often have you been bothered by the following problems?',
        fields: [
          'Feeling nervous, anxious, or on edge', 'Not being able to stop or control worrying', 'Worrying too much about different things', 'Trouble relaxing',
          "Being so restless that it's hard to sit still", 'Becoming easily annoyed or irritable', 'Feeling afraid as if something awful might happen',
        ].map((q, i) => ({ id: 'gad_' + (i + 1), label: `${i + 1}. ${q}`, type: 'choice', options: PHQ_OPTS, required: true, show: 'consent_cmh = yes' })),
      },
      eq5d: {
        title: 'Quality of life (EQ-5D-5L)', source: 'Table 10.3: EQ-5D-5L. Licensed instrument: the participant completes the approved form; enter the levels here.',
        intro: 'Enter the level the participant chose for each dimension (1 = no problems … 5 = extreme problems / unable), and the EQ VAS.',
        fields: [
          ['eq_mobility', 'Mobility'], ['eq_selfcare', 'Self-care'], ['eq_usual', 'Usual activities'], ['eq_pain', 'Pain / discomfort'], ['eq_anxiety', 'Anxiety / depression'],
        ].map(([id, label]) => ({ id, label, type: 'choice', options: LEVELS_5, required: true })).concat([
          { id: 'eq_vas', label: 'EQ VAS (0 = worst, 100 = best health imaginable)', type: 'number', integer: true, min: 0, max: 100, required: true },
        ]),
      },
      experience: {
        title: 'Participant experience', source: 'Table 10.3: instrument NEED INFO. ASSUMPTION: three placeholder items.',
        fields: [
          { id: 'exp_trust', label: 'I trust the study team', type: 'choice', options: [['1', 'Strongly disagree'], ['2', 'Disagree'], ['3', 'Neutral'], ['4', 'Agree'], ['5', 'Strongly agree']] },
          { id: 'exp_benefit', label: 'Taking part helps my health', type: 'choice', options: [['1', 'Strongly disagree'], ['2', 'Disagree'], ['3', 'Neutral'], ['4', 'Agree'], ['5', 'Strongly agree']] },
          { id: 'exp_burden', label: 'The visits are too much trouble', type: 'choice', options: [['1', 'Strongly disagree'], ['2', 'Disagree'], ['3', 'Neutral'], ['4', 'Agree'], ['5', 'Strongly agree']] },
        ],
      },
      resource: {
        title: 'Health care use and costs (last 3 months)', source: 'Table 10.3: CSRI-adapted resource use questionnaire (country cost module NEED INFO)',
        fields: [
          { id: 'opd_visits', label: 'Clinic or doctor visits', type: 'number', integer: true, min: 0, max: 100, required: true },
          { id: 'hosp_nights', label: 'Nights in hospital', type: 'number', integer: true, min: 0, max: 92, required: true },
          { id: 'oop_cost', label: 'Own money spent on health care (visits, tests, transport, medicines)', type: 'number', unit: 'MUR', min: 0, max: 1000000, required: true },
          { id: 'work_days_lost', label: 'Days of work or usual activity lost because of health', type: 'number', integer: true, min: 0, max: 92, required: true },
          yn('catastrophic', 'Had to borrow money or sell something to pay for health care', { required: true }),
        ],
      },
    },

    /* ---------------- Calculated values ---------------- */
    derived: [
      { id: 'cohort_dm', label: 'Diabetes cohort', partial: true, expr: '(dm_known = yes AND NOT type1_or_gdm = yes) OR screen_hba1c >= 6.5 OR screen_rbg >= 200' },
      { id: 'cohort_htn', label: 'Hypertension cohort', partial: true, expr: 'htn_known = yes OR SYS(screen_bp) >= 140 OR DIA(screen_bp) >= 90' },
      { id: 'sys_mean', label: 'Systolic BP (mean of readings 2 and 3)', unit: 'mmHg', expr: 'MEAN(SYS(bp_2); SYS(bp_3))' },
      { id: 'dia_mean', label: 'Diastolic BP (mean of readings 2 and 3)', unit: 'mmHg', expr: 'MEAN(DIA(bp_2); DIA(bp_3))' },
      { id: 'bp_controlled', label: 'BP below 140/90', expr: 'sys_mean < 140 AND dia_mean < 90' },
      { id: 'bmi', label: 'BMI', unit: 'kg/m²', decimals: 1, partial: true, needs: ['weight'], expr: 'weight / (IF(height != blank; height; prev_height) * IF(height != blank; height; prev_height) / 10000)' },
      { id: 'hba1c_at_target', label: 'HbA1c below 7.0%', expr: 'hba1c < 7' },
      { id: 'phq9_total', label: 'PHQ-9 total', expr: 'SUM(phq_1; phq_2; phq_3; phq_4; phq_5; phq_6; phq_7; phq_8; phq_9)' },
      { id: 'gad7_total', label: 'GAD-7 total', expr: 'SUM(gad_1; gad_2; gad_3; gad_4; gad_5; gad_6; gad_7)' },
      { id: 'mars5_total', label: 'MARS-5 total (5–25, higher = better adherence)', expr: 'SUM(mars_1; mars_2; mars_3; mars_4; mars_5)' },
      { id: 'ipaq_met', label: 'Physical activity (MET-minutes/week)', partial: true, needs: ['vig_days', 'mod_days', 'walk_days'], expr: 'IF(vig_days > 0; 8 * vig_days * vig_min; 0) + IF(mod_days > 0; 4 * mod_days * mod_min; 0) + IF(walk_days > 0; 3.3 * walk_days * walk_min; 0)' },
    ],

    /* ---------------- Safety and escalation (Table 15.1, 8.3a, 8.4) ---------------- */
    // urgent: act now · soon: refer or CHDr review · report: tell the supervisor (reportable event) · note: for information
    // Where a referral goes (Table 15.1). ASSUMPTION: the country referral map is NEED INFO; these are generic.
    referralSites: [
      { id: 'emergency', name: 'Hospital emergency department', note: 'Emergency pathway. Arrange transport if needed.' },
      { id: 'chdr', name: 'Area health centre: Community Health Doctor (CHDr)' },
      { id: 'mental_health', name: 'Mental health service (bench-grandma or mental health professional)' },
      { id: 'antenatal', name: 'Antenatal clinic' },
    ],
    // What a referral handoff shows (besides the reasons and the participant's details).
    handoff: {
      findings: ['bp_1', 'bp_2', 'bp_3', 'sys_mean', 'dia_mean', 'pulse', 'weight', 'bmi', 'waist', 'hba1c', 'rbg', 'egfr'],
      symptoms: ['chest_pain', 'dm_red_flags', 'severe_hypo', 'admitted', 'admit_reason', 'pregnant', 'pregnant_now'],
      history: ['cohort_dm', 'cohort_htn', 'cvd_hx', 'ckd_hx', 'smoking'],
      medicines: ['on_htn_meds', 'on_dm_meds', 'on_insulin', 'on_statin', 'med_list', 'side_effects'],
      sensitive: { mental_health: ['phq9_total', 'phq_9', 'gad7_total'] }, // only on a mental health referral
      compare: ['sys_mean', 'dia_mean', 'hba1c'], // shown against the last visit
    },
    safety: [
      { id: 'self_harm', level: 'urgent', referTo: 'mental_health', when: 'phq_9 >= 1', source: 'Table 8.4', text: 'PHQ-9 item 9 positive (thoughts of death or self-harm): immediate mental health escalation and safety plan per country SOP, whatever the total score. Do not leave the person alone if at immediate risk.' },
      { id: 'emergency', level: 'urgent', referTo: 'emergency', when: 'chest_pain = yes', source: 'Table 15.1', text: 'Chest pain, stroke symptoms or severe breathlessness: emergency pathway now.' },
      { id: 'bp_very_high', level: 'urgent', referTo: 'chdr', when: 'sys_mean >= 180 OR dia_mean >= 110', source: 'Table 15.1 (threshold: ASSUMPTION pending country CMA)', text: 'BP {sys_mean}/{dia_mean}: very high. Repeat per SOP; if still this high, urgent CHDr or emergency referral.' },
      { id: 'dm_red_flags', level: 'urgent', referTo: 'chdr', when: 'dm_red_flags = yes OR rbg >= 400', source: 'Table 8.3a, Table 15.1 (glucose threshold: ASSUMPTION)', text: 'Diabetes red flag (possible DKA/HHS, foot ulcer, vision change, or very high glucose): notify the CHDr now; emergency transport if needed.' },
      { id: 'severe_hypo', level: 'urgent', referTo: 'chdr', when: 'severe_hypo = yes', source: 'Table 15.1', text: 'Severe low sugar since the last visit: urgent referral and CHDr notification.' },
      { id: 'mh_referral', level: 'soon', referTo: 'mental_health', when: 'phq9_total >= 10 OR gad7_total >= 10', source: 'Table 8.4', text: 'PHQ-9 {phq9_total}, GAD-7 {gad7_total}: structured referral (bench-grandma or equivalent, or a mental health professional).' },
      { id: 'screen_positive', level: 'soon', referTo: 'chdr', when: 'visit = baseline AND dm_known != yes AND (screen_hba1c >= 6.5 OR screen_rbg >= 200)', source: 'Table 8.3a', text: 'New screen-positive for diabetes: refer for a confirmatory fasting glucose or repeat HbA1c at the health centre; CHDr confirms the diagnosis.' },
      { id: 'hba1c_high_twice', level: 'soon', referTo: 'chdr', when: 'hba1c >= 8 AND prev_hba1c >= 8', source: 'Table 8.3a (default target < 7.0%)', text: 'HbA1c {hba1c}% and {prev_hba1c}% last time: 1% or more above target at two visits. CHDr review for medicine change or referral.' },
      { id: 'pregnancy', level: 'soon', referTo: 'antenatal', when: 'pregnant = yes OR pregnant_now = yes', source: 'Table 8.3a, Table 7.1', text: 'Pregnant: refer to antenatal care. CHDr reviews medicines (stop those not safe in pregnancy) and coordinates with the obstetric team.' },
      { id: 'kidney', level: 'soon', referTo: 'chdr', when: 'egfr < 30', source: 'Table 15.1 (concerning lab; threshold ASSUMPTION)', text: 'eGFR {egfr}: concerning result. CHDr review and referral per CMA.' },
      { id: 'sae', level: 'report', when: 'admitted = yes', source: '§15 Adverse event definitions', text: 'Hospital admission: possible serious adverse event. Tell the supervisor within 24 hours.' },
      { id: 'catastrophic', level: 'note', when: 'catastrophic = yes', source: 'Table 10.2 (catastrophic spending)', text: 'Borrowed or sold something to pay for care: record for the economic analysis; mention support options if the site has them.' },
    ],

    /* ---------------- Analysis (descriptive, for study management) ---------------- */
    // Measures offered on the Analysis screen. kind 'percent': share of people with the value `yes`.
    // cohort limits the people counted (derived yes/no value).
    analysis: {
      note: 'Descriptive, unadjusted summaries for running the study. Not the SAP analysis (§12: mixed models with cluster effects, prespecified covariates, analysts blinded where feasible). v08 interim analyses cover safety, data quality, recruitment, retention and implementation; check the DSMB charter before sharing outcome comparisons between arms.',
      measures: [
        { id: 'sys_mean', label: 'Systolic BP', unit: 'mmHg', cohort: 'cohort_htn', better: 'lower' },
        { id: 'dia_mean', label: 'Diastolic BP', unit: 'mmHg', cohort: 'cohort_htn', better: 'lower' },
        { id: 'bp_controlled', label: 'BP below 140/90', kind: 'percent', yes: 'yes', cohort: 'cohort_htn', better: 'higher' },
        { id: 'hba1c', label: 'HbA1c', unit: '%', cohort: 'cohort_dm', better: 'lower', decimals: 1 },
        { id: 'hba1c_at_target', label: 'HbA1c below 7%', kind: 'percent', yes: 'yes', cohort: 'cohort_dm', better: 'higher' },
        { id: 'phq9_total', label: 'PHQ-9 (depression)', unit: 'points', better: 'lower', decimals: 1 },
        { id: 'gad7_total', label: 'GAD-7 (anxiety)', unit: 'points', better: 'lower', decimals: 1 },
        { id: 'mars5_total', label: 'MARS-5 (adherence)', unit: 'points', better: 'higher', decimals: 1 },
        { id: 'med_access', label: "Couldn't get a medicine", kind: 'percent', yes: 'yes', better: 'lower' },
        { id: 'bmi', label: 'BMI', unit: 'kg/m²', better: 'lower', decimals: 1 },
        { id: 'waist', label: 'Waist', unit: 'cm', better: 'lower' },
        { id: 'ipaq_met', label: 'Physical activity', unit: 'MET-min/week', better: 'higher' },
      ],
    },

    /* ---------------- Messages ---------------- */
    messages: {
      consentOption: 'contact', // "Permission to contact participant between visits" (Appendix B)
      reminderDaysBefore: 7,
      missedWithinDays: 14,
      templates: {
        reminder: { label: 'Visit reminder', text: 'Hello {first_name}, this is the {study} team. Your {visit} visit is due between {from} and {to}. {collector} will contact you to arrange a time. Questions: {study_phone}.' },
        missed: { label: 'Missed visit', text: 'Hello {first_name}, we could not see you for your {visit} visit. Please call the {study} team on {study_phone} so we can find a good day.' },
        meds: { label: 'Medicine encouragement', text: 'Hello {first_name}, a message from the {study} team: taking your medicines every day protects your heart, kidneys and eyes. Keep it up!' },
        activity: { label: 'Activity encouragement', text: 'Hello {first_name}, a tip from the {study} team: a 30-minute walk on most days helps blood pressure and sugar. Could you add one walk this week?' },
        event: { label: 'Group: community event', text: 'Hello {first_name}, the {study} team will hold a community health meeting at [place] on [day] at [time]. All are welcome. Questions: {study_phone}.' },
        general: { label: 'Blank message', text: 'Hello {first_name}, ' },
      },
      // Suggested encouragement (on the participant's latest recorded values).
      encouragement: [
        { id: 'meds', template: 'meds', when: 'on_htn_meds = yes OR on_dm_meds = yes OR on_insulin = yes', everyDays: 14, why: 'On BP or diabetes medicine (last recorded)' },
        { id: 'activity', template: 'activity', when: 'walk_days < 3', everyDays: 30, why: 'Walks on fewer than 3 days a week (last recorded)' },
      ],
    },
  });
})();
