# Jamii Research

A lightweight, offline-first tablet app for running a research study in the community:
screening, informed consent, study visits, a visit schedule with windows, participant
messaging, supervisor data review, a **study design** the supervisor can edit and version, and
**data export**. It is the research counterpart of the Jamii clinical app and uses the same rule
and listening engine.

The active study's short name shows at the top of every screen (“No active study” until a study
design is published). The demo study is **ICEHALL**, built from **ICEHALL Protocol v08 (21 June
2026, IRB draft)** for the Mauritius site. v08 is not yet IRB-approved, so this is for
demonstration and training only.

## Run it

Open `index.html` in Chrome or Edge. No install or internet is needed, and data stays on the device
(`localStorage`).

To use the microphone, serve it locally instead:

```
node tools/serve.mjs        # then open http://localhost:8080
```

Run the tests with `node tests/run.test.js` and `node tests/study.test.js`.

## Two views

Use the **View** switch at the top to change between them. In a real deployment, sign-in decides
the view. The demo has two data collectors, each covering two clusters (one intervention, one
standard care); pick which one with the menu next to **Data collector**.

| Data collector (CHO) | Supervisor (review only) |
|---|---|
| **Initial visit**: identify (including household) → eligibility → consent → baseline data → enrol | **Data quality**: follow-up, missed visits, data completeness, queries, safety events and referrals, filterable by cluster and data collector, plus CSV export and the audit trail |
| **Participant records**: visits and windows, BP trend, referrals, queries, household, messages | **Analysis**: enrolment over time, and outcomes by visit (BP, HbA1c, PHQ-9, GAD-7, adherence and more), split by cluster or by arm |
| **Schedule**: their own clusters, by status or by cluster, with household members due together | **Participant records** and **Schedule**: read only |
| **Messaging**: suggested reminders and encouragement, writing a message, sent log | **Messaging**: approves or sends back group messages; never writes to participants |
| **Protocol**: the schedule of activities, rules and open items | **Protocol** |

The supervisor doesn't run visits or message participants. On completed visits they can **Query**,
**Correct** (with a reason, kept in the audit trail) and **Mark reviewed**.

## Study design (supervisor)

**Study design** sits in a separate *Study* card at the bottom of the supervisor's menu, with
**Export data**. The design is the study's questions as data, so a study can be changed without
programming.

- **Name**: the study name and the short name shown at the top of every screen.
- **Sections and questions**: a section is a group of questions (Demographics, Measurements,
  PHQ-9…). Each question has its wording, a variable name for the export, a type (yes/no, choose
  one, number, whole number, blood pressure, date, free text), and optionally a unit, allowed range,
  query range, note, *ask only if* condition, and whether it is required. **Preview** shows a section
  as data collectors will see it. Each section shows **when it is asked**, arm by arm (for example
  “Arm 1: Baseline, Month 12, Month 24 · Arm 2: Baseline, Month 24”), or “Visit schedule pending”.
  A section is shared: editing it changes it wherever it is asked. **Duplicate section** makes a
  separate version (new variable names) for an arm that needs different questions.
- **Arms**: set the number of arms and name them (“Arm 1: Intervention”).
- **Visit schedule**: where *when* and *for which arm* are set. Switch between **All arms** and each
  arm. In *All arms*, visits and ticks apply to every arm (a section asked in only some arms shows
  as “some arms”), and an Arms column says which arms have each visit. In an arm, you add visits just
  for that arm and tick the sections it asks at each visit; **Copy the schedule of** another arm
  fills it in. A visit has the same day and window in every arm that has it; a different timing in
  one arm is a separate visit. The first visit (enrolment) is for every arm. Participants only get
  their own arm's visits and sections.
- **Assignment**: one arm; by cluster or site (ICEHALL: cluster-randomised); by data collector;
  chosen at enrolment (with a reason; flagged as a risk of bias); or randomised on the tablet from
  an allocation list of shuffled blocks. The arm is fixed at consent, before the baseline visit, and
  recorded with how it was decided and the design version.
- **Who sees the arm**: everyone, supervisors only (“Arm hidden” for collectors), or no one (“Arm A”).
  This applies everywhere the arm appears, including the record's change history and the exports.
- **Clusters and data collectors** (on *Arms and assignment*): add, rename and remove clusters or
  sites (with their arm when assigning by cluster), and data collectors with the clusters they work
  in (and their arm when assigning by data collector). They are part of the design, so a new data
  collector or cluster goes live when the next version is published. A cluster with participants,
  or a data collector with recorded visits, can't be removed.
- **Lock and versions**: the design is locked. The lock at the top unlocks it after a confirmation
  and the supervisor password (**demo: 000000**). Changes are made in a **draft**; data collectors
  keep the published version until the draft is published. **Review and publish** lists every change
  (with how many visit records hold data for anything removed) and asks for a reason, for example the
  amendment and its approval. Publishing locks the design again as the next version (1.0, 1.1…), and
  each visit record keeps the version it was collected under. While a draft is open, other supervisor
  screens show a reminder.
- **Rules that protect collected data**: once published, a question's variable name and type are
  fixed, and answer codes can be added but not changed. Removing a published question **retires**
  it: it is no longer asked, and its data stays in every export and the codebook.
- **Not yet in the builder** (shown read-only under *Other protocol parts*, still edited in the
  protocol file): screening and eligibility, consent, calculated scores and safety rules.
- **Demo**: **Clear study**, under *Reset demo data* at the bottom of the menu, removes the study and
  its data so you can build a new one from the start (it opens Study design as the supervisor; data
  collectors see “No active study” until it is published). *Reset demo data* brings back ICEHALL.

## Export data (supervisor)

De-identified by default (study and household IDs only). Ticking *Include names, phone numbers and
dates of birth* adds them to the participants export and the archive, after a confirmation. Every
export is recorded in the audit trail.

| Export | What it is |
|---|---|
| Visits (CSV) | One row per completed visit, every question as a column, missing-data reasons, calculated values, arm and design version |
| Answers (CSV, long) | One row per answer: new questions never change the columns |
| Participants and consent (CSV) | Status, arm and how it was assigned, consent version and options, withdrawals |
| Codebook (CSV) | Every variable: wording, type, unit, answer codes, limits, arms, retired or not |
| REDCap data dictionary (CSV) | The design as REDCap forms; *ask only if* conditions go in the annotation column for translation |
| Full archive (JSON) | Everything, including the design versions, queries, referrals, safety events and the audit trail |
| Audit trail (CSV) | Corrections, unlocks, publications and exports |

Exports cover the data on this tablet: until sync is connected, each tablet exports its own.

## Referrals and the printable handoff

When a safety rule says to refer, the collector records what was done before completing the visit. If they choose **Referred: handoff given**, the app creates one referral per destination (for example the health centre doctor, or the mental health service) and opens a handoff sheet to print.

The sheet gives:
- who the person is and why they are referred, with urgency;
- today's measurements and symptoms, and the last visit's values for comparison;
- known conditions and medicines;
- the referring collector and the study phone;
- a return slip for the clinician to fill in and send back with the patient.

Mental health scores appear only on a mental health referral.

Later, the collector records the outcome (seen, or did not go and why). The supervisor sees open referrals and how many were completed, by collector and cluster.

## Two kinds of review

**Data quality** is for keeping the data clean and people safe:
- **By collector and cluster**: follow-ups done, done in window, missed visits, data completeness, open queries, visits flagged, referrals and how many were seen, withdrawals. Low values are highlighted in amber against suggested targets (not targets from the protocol).
- **Missed visits**: the list, and whether a reminder was sent.
- Queries, visits to review, safety events, referrals, export and audit trail.

**Analysis** is for running the study:
- **Enrolment over time**, cumulative by month, by cluster or arm.
- **Outcomes by visit**, as a mean or a %, limited to the relevant cohort (for example HbA1c for the diabetes cohort).
  - Change from baseline is calculated within each person.
  - Chart points from fewer than 3 people are hidden.
- **Medicines and adherence**: MARS-5, people who often miss doses, people who couldn't get a medicine, and food insecurity. This helps choose between reminders and fixing supply or cost.

These are descriptive and unadjusted. They are not the SAP analysis. v08 limits interim analyses to safety, data quality, recruitment, retention and implementation, so the screen says to check the DSMB charter before sharing outcome comparisons between arms.

## Households

People who live together share a household ID.
- **Set at screening:** choose "Same household as …" when screening.
- **Changed later:** use **Household** on the record.
- **On the record:** household members are listed and linked.
- **On the schedule:** household members due at the same time are flagged so they can be visited together.
- **In exports:** both CSV exports include `household_id`, for analysis that accounts for people in the same home having similar results.

## How the protocol drives the app

Everything study-specific lives in one data file, `protocols/icehall-v08.js`:

| From v08 | In the app |
|---|---|
| Table 6.1 eligibility | Screening questions and a live checklist of the inclusion and exclusion criteria. Screen failures are recorded with their reasons |
| Table 7.1 and Appendix B consent | Information sheet, comprehension checks (wrong answers prompt "explain again"), optional parts, signature, thumbprint with witness, or witnessed oral consent |
| Table 11.1 schedule of activities | Which forms appear at baseline and at months 3, 6, 9, 12, 18 and 24 |
| Table 10.3 instruments | Forms: demographics, history, medication inventory, MARS-5, STEPS measurements, HbA1c, lipids and renal function, diet and food security, IPAQ-Short, PHQ-9, GAD-7, EQ-5D-5L, experience, and resource use |
| Tables 8.3a, 8.4 and 15.1 | Safety, escalation and referral rules, each with a referral destination (`referTo`), e.g. PHQ-9 item 9, PHQ-9 or GAD-7 ≥ 10, very high BP, diabetes red flags, HbA1c above target at two visits, and hospital admission (possible SAE) |
| Appendix C | Protocol deviation categories, used when a visit is done after its window closes |
| §13 audit trail | Completed visits are read-only. Each correction records who made it, when, the old value, the new value and the reason |

Forms appear only when they apply:
- HbA1c only for the diabetes cohort.
- Height only at baseline.
- MARS-5 only for people on medicine.
- PHQ-9 and GAD-7 only with mental health screening consent. They are marked sensitive, hidden by default in the record, and never listened to.

Where v08 still says *NEED INFO*, the file uses a marked **ASSUMPTION**: visit windows, urgent
thresholds, a demo study phone number, and demo clusters and arms. The **Protocol** screen lists all
of these.

Licensed instruments (MARS-5, EQ-5D-5L) are entered as item scores only. The licensed wording stays
on the approved form.

See [docs/PROTOCOL_FORMAT.md](docs/PROTOCOL_FORMAT.md) to write or change a protocol.

## Listening during visits

The tablet can listen to the visit conversation and compare it with what the collector enters.
There are two modes:

- **Check only** (default): silent. The collector enters every answer. If an answer differs from what was said, they are asked to check it (keep or use what was heard) before completing the visit.
- **Suggest**: answers heard in the conversation are offered on empty questions, and the collector confirms each one.

Safeguards:
- Listening only runs if the participant agreed to it as an optional part of consent.
- Sound is not recorded. The words stay in memory until the visit is closed. Only a note of which answers were re-checked is kept.
- Sensitive sections are never listened to.

v08 puts audio capture and AI scribe tools in **Layer 5**, which needs its own IRB amendment
(`listeningApproved: false`). The audio consent option and listening are therefore disabled unless
**Test tools** is on. Test tools also shows the transcript box and demo conversations.

## Messaging

- **Suggested**: drafted from the schedule and the protocol's message rules:
  - visit reminders, 7 days before a window opens or while it is open, not repeated;
  - missed-visit messages;
  - encouragement, e.g. for people on BP or diabetes medicine, every 14 days.
- **Write a message**: send to all participants, one cluster, people due within 7 days, or one person, using templates with placeholders. Shows a preview, the character and SMS count, and who is left out and why.
- Only participants who agreed to be contacted between visits and have a phone are included.
- Group messages from a collector go to the supervisor for approval.
- No SMS gateway is connected yet: **Send** records the message as sent.

## Files

```
index.html                  app shell
css/app.css                 styles (same look as the clinical app; supervisor view in plum)
js/core.js                  dates, protocol checks, eligibility, validation, safety, schedule, queries, messages, CSV
js/rules.js                 condition language and phrase compiler (shared with the clinical app)
js/listen.js                reads answers from a conversation (shared helpers)
protocols/icehall-v08.js    the protocol, as data
js/demo.js                  demo staff, participants and conversations
js/study.js                 study design: published versions, draft, arms and assignment, change summary
js/design.js                Study design and Export data screens
js/export.js                long format, codebook, REDCap dictionary, archive, audit exports
js/app.js                   screens and actions
tests/run.test.js           engine tests (node)
tests/study.test.js         study design and export tests (node)
tools/serve.mjs             local server
```

## Not built yet

- Sync to a server or EDC (v08 names REDCap as provisional), with sign-in and role-based access.
- An SMS gateway.
- Paper-form fallback and double entry for critical fields.
- Re-consent when the protocol is amended.
- In the study design: screening and eligibility, consent, calculated scores and safety rules;
  more answer types (choose several, slider, time); XLSForm import and export; Excel and
  Stata/SPSS/R label scripts; ending a study and wiping tablets (needs sync).
- Real sign-in: the demo shows the supervisor password.
- Intervention-arm records (CHO contacts, CUMED sessions). This app covers the research assessments only.
