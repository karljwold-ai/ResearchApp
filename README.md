# ICEHALL Research

A lightweight, offline-first tablet app for running a research protocol in the community:
screening, informed consent, protocol visits, a visit schedule with windows, participant
messaging, and supervisor data review. It is the research counterpart of the ICEHALL clinical app
and uses the same rule and listening engine.

The demo protocol is built from **ICEHALL Protocol v08 (21 June 2026, IRB draft)**, for the
Mauritius site. v08 is not yet IRB-approved, so this is for demonstration and training only.

## Run it

Open `index.html` in Chrome or Edge. No install or internet is needed, and data stays on the device
(`localStorage`).

To use the microphone, serve it locally instead:

```
node tools/serve.mjs        # then open http://localhost:8080
```

Run the tests with `node tests/run.test.js`.

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
js/app.js                   screens and actions
tests/run.test.js           engine tests (node)
tools/serve.mjs             local server
```

## Not built yet

- Sync to a server or EDC (v08 names REDCap as provisional), with sign-in and role-based access.
- An SMS gateway.
- Paper-form fallback and double entry for critical fields.
- Re-consent when the protocol is amended.
- Intervention-arm records (CHO contacts, CUMED sessions). This app covers the research assessments only.
