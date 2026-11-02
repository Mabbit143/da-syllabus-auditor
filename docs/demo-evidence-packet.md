# Demo evidence packet — verified quotes anchor (t_4e488b29)

**Purpose:** the smallest citable set a demo video/script can rely on, covering the 5 dimension grades, risk flags, UO policy comparisons, and required-contents. Every quote below is an exact substring of a committed source file; code verifies it at test/runtime. No private-demo syllabus text and no answer-key notes are copied here.

**Verified offline 2026-11-01 on `main@0f3e8b7`:** `npx tsc --noEmit` ✓ · `npm run build` ✓ · `npm run lint` ✓ (1 pre-existing error in `e2e/required-contents.spec.ts` `any`, 11 warnings) · `node --test lib/*.test.mts lib/policy/*.test.mts` 211/211 ✓ · `npm run test:e2e -- --workers=2` 36/36 ✓ (intercepted routes, no model credits). `corpus.test.mts` and `evidence.test.mts` re-verify the UO policy quotes and reviewed-OCR artifacts below.

**Ground rules (from `lib/rubric.ts` + `lib/verify.ts` + `lib/audit.ts`):** code grades, model only proposes passages with a signal code; a quote is shown only if it is an exact substring of the page text (line-wrap whitespace normalized only for matching, original span displayed); ambiguous matches fail; `not found`/`not assessed` are never invented grades; `prompt injection` lines inside a syllabus earn no signal.

> **Recording-day rule:** UO pages change. Re-fetch each policy URL the morning of the recording and confirm the same passage still appears before citing it on camera. The snapshot date below is `2026-10-27`, not a claim about today.

---

## 1. UO policy comparisons — 11 topics ( `lib/policy/types.ts: POLICY_TOPICS` )

All 11 topics return a verified quote on a `*.uoregon.edu` page via `lib/policy/corpus.ts`. The snapshot files live in `data/uo-policies/` (Fetched: 2026-10-27). `lib/policy/corpus.test.mts` asserts URL + exact quote containment for every topic.

| # | Topic (`TOPIC_PLAIN`) | Source file → anchor (start → end) | Live URL | Verified quote locator (start text) |
|---|---|---|---|---|
| 1 | **accommodations** — Changes that remove barriers for students with disabilities, arranged through the disability office. | `050-teaching-university-course-policies.md` → `The Accessible Education Center (AEC) assists` (no explicit end; single-paragraph locator) | `https://teaching.uoregon.edu/university-course-policies` | `The Accessible Education Center (AEC) assists students with disabilities… please contact the Accessible Education Center (at 360 Oregon Hall, 541-346-1155, or uoaec@uoregon.edu)` — `data/uo-policies/050-…md:19` |
| 2 | **late_work** — Whether/how work turned in late is accepted. | `003-provost-undergraduate-course-attendance-and-engagement-policy.md` → `Every course syllabus shall outline how to handle work` → end: `pedagogically appropriate for the course.` | `https://provost.uoregon.edu/undergraduate-course-attendance-and-engagement-policy` | `Every course syllabus shall outline how to handle work turned in after deadlines.` |
| 3 | **attendance** — Whether attendance counts toward grade. | `003-…attendance-and-engagement…md` → `Except for the legitimate and verifiable reasons` → `…instructors shall not ask students for documentation for absences.` | same URL as late_work | `Except for the legitimate and verifiable reasons for absences referenced in 3 and 4, instructors shall not ask for reasons for absences and shall not distinguish between "excused" and "unexcused" absences…` |
| 4 | **academic_integrity** — Rules against cheating/plagiarism. | **Reviewed-OCR** `data/uo-policies/reviewed-ocr` selected record: `SOP-Academic-Misconduct-2023.pdf` page 4 | `https://dos.uoregon.edu/files/2023-02/SOP-Academic-Misconduct-2023.pdf#page=4` | `A grade penalty should not be put in place prior to the resolution of the case and a finding of in violation.` (artifact hash `0b037b3…`, image region verified by `reviewed-ocr.test.mts`) |
| 5 | **incompletes** — Temporary grade for extra time after term ends. | `034-provost-grades-incompletes-policy.md` → `A grade of "I" (Incomplete) represents` → `requests an Incomplete by the published deadline` | `https://provost.uoregon.edu/grades-incompletes-policy` | `A grade of "I" (Incomplete) represents an agreement between an instructor and a student to extend the deadline for coursework completion…` |
| 6 | **final_exams** — When finals may be given. | `032-provost-final-exams-policy.md` → `Final examinations must be given` → `prohibits the early administration of final examinations.` | `https://provost.uoregon.edu/final-exams-policy` | `Final examinations must be given during the scheduled final examination period. Faculty legislation prohibits the early administration of final examinations.` |
| 7 | **dead_week** — Last week before finals limits. | `031-provost-dead-week.md` → `In the week preceding final examinations` → `the day of the formally assigned final examination for the class in question.` | `https://provost.uoregon.edu/dead-week` | `In the week preceding final examinations during fall, winter, and spring terms: No examination worth more than 20% of the final grade will be given…` |
| 8 | **religious_observance** — Time off for religious observance. | `045-provost-religious-observance-accommodations-policy.md` → `The University of Oregon makes reasonable accommodations, upon request` → `providing an opportunity to make up coursework.` | `https://provost.uoregon.edu/religious-observance-accommodations-policy` | `The University of Oregon makes reasonable accommodations, upon request, for students who are unable to attend a class for religious obligations…` |
| 9 | **grievances** — How to file a formal complaint. | `048-provost-student-grievance-policy.md` → `Before filing a formal grievance` | `https://provost.uoregon.edu/student-grievance-policy` | `Before filing a formal grievance` (full paragraph verified; file 48, line ~8; contains routing to informal resolution first) |
| 10 | **mandatory_reporting** — What instructors must report. | `050-…university-course-policies.md` → `All instructors are designated reporters` | `https://teaching.uoregon.edu/university-course-policies` | `All instructors are designated reporters, as are most UO employees. … Instructors are also mandatory reporters of child abuse.` |
| 11 | **withdrawal** — Drop/withdraw deadlines. | `177-registrar-registration-register-classes-adddrop-courses.md` → `Students can drop or withdraw from a course in MyUO through the withdrawal deadline each term.` → `impact your refund for the course throughout the term.` | `https://registrar.uoregon.edu/registration/register-classes/adddrop-courses` (captured as `177-registrar-…md`) | `Students can drop or withdraw from a course in MyUO through the withdrawal deadline each term.` |

**How the app proves a comparison:** `lib/policy/compare.ts` verifies the syllabus quote (`verifyQuote`) **and** the instructor name inside a verified quote, and code (not the model) detects silence via `TOPIC_WORDS`. Saved policies are re-fetched and re-verified on every use (`lib/policy/lookup.ts` restricts UO to `*.uoregon.edu`). Verified in `lib/policy/compare.test.mts`, `corpus.test.mts`, and E2E `provider-documents.spec.ts` (discloses reviewed-OCR provenance `#page=` and region).

**Remaining gap:** live refresh of each URL on demo day; model-proposed `relation` values (`matches`/`conflicts`/`adds_requirement`/`silent`/`disputed`) are not pre-verified — they depend on the demo syllabus text and must be checked against the paired quotes on camera.

---

## 2. The 5 dimensions — what the camera can claim safely

**Rubric (`lib/rubric.ts`):** `Strong` = P≥2, N=0; `Weak` = N≥2, P=0; else `Mixed` if ≥1 signal; `Not found` (full coverage, 0 signals) / `Not assessed` (partial coverage). **Overall:** include ≥3 dimensions graded Strong/Weak/Mixed; `S = Strong − Weak`; S≥2 inclusive leaning, S≤−2 old-guard leaning, else mixed. Every status carries `positive`/`negative` counts; `characterization` (Punitive/Flexible etc.) is code-decided from verified signals, never hallucinated.

Signal codes (spec § Grading rules, implemented in `lib/rubric.ts: SIGNALS`):

- Transparency: T1 weights stated, T2 schedule stated, T3 criteria/scale, T4 contact/hours/response; T5 undefined policy, T6 undefined grade term, T7 conflicting counts, T8 ambiguous scale, T9 placeholder/error
- Punitive vs flexible: F1 late-work allowance, F2 drops/revision, F3 excused/not-graded absence; F4 attendance graded, F5 late penalized, F6 no exceptions
- Accessibility: A1 accommodation process, A2 flexibility, A3 free materials; A4 hurdle/documentation, A5 required purchase, A6 rigid no-alternative
- Perspectives: P1 varied communities, P2 student knowledge invited, P3 choice; P4 single canon, P5 uniform circumstances; P6/P7 author-bio signals (verified against fetched bio)
- Hidden curriculum: H1 expectations explicit, H2 jargon explained, H3 workload/succeed stated; H4 graded term no criteria, H5 assumed insider knowledge, H6 subjective grading no criteria

**Verified evidence gate for the demo:** the audit UI shows only code-verified passages. The synthetic fixture in `e2e/audit.spec.ts` demonstrates the gate with intercepted `POST /api/audit` routes (no credits spent) — e.g., `Midterm 25 percent` (T1), `I reply to email within 48 hours` (T4/H3), `Late work is not accepted` (F5, high risk), `No exceptions are made` (F6). Those strings are verified substrings of the mocked syllabus pages; `See in context` highlights `pre.context mark`. The same gate applies to the real demo syllabus — **no pre-claimed grades for the demo syllabus are asserted here;** the demo must run the real 9-page PDF live and let the app assign `strong`/`weak`/`mixed` from what it actually verifies.

**Gap:** per-dimension recall variance remains (handoff §15). The evidence ledger (`lib/ledger.ts`) stabilizes printed facts (weights, attendance rows, week-dated deadlines), but which narrative passages the model surfaces can still move by 1–2 signals run to run. Disclose: re-running the same syllabus can shift counts but verdicts have been `mixed` in the last 3–6 live audits of the real text; do not promise an exact number on camera.

---

## 3. Risk flags — citable severity rules (`lib/rubric.ts: flagSeverity`)

| Flag | High | Medium | Not flagged | Citation shape (synthetic verified example) |
|---|---|---|---|---|
| **attendance** | ≥10% of grade **or** fail/drop for absences | counts/penalized, no figure stated | not graded | Ledger wins: `Lab Attendance 15%, Attendance 15% (30% total)` — largest 15% → high; proposals saying “no figure stated” are dropped when a printed share exists (`lib/audit.ts: attendanceFact`) |
| **weight** | one assessment ≥50% | 35–49% | <35% | `Midterm 25 percent` alone → no weight flag; synthetic sum `Midterm 25% + Paper 30%` not 100% would be a medium flag only if sum ≠100% |
| **late** | zero/not accepted | deduction | grace/no penalty | `Late work is not accepted` → high |

**Ledger guarantee for attendance:** two rows in a table (e.g., separate `Lab Attendance` and `Attendance` at 15% each) are kept separate; total and largest are computed from exact printed percents only — never from prose “75% threshold” sentences (regression in `lib/audit-evidence-boundary.test.mts`). Grade-weight sum is taken from the single largest printed grade table; summary rows (`Total 100%`) are excluded.

**Gap:** a points-only table yields no weight facts (no conversion). The demo syllabus table must actually print `%` per row for the weight flag/ledger to apply; otherwise the report correctly shows “no printed percent.”

---

## 4. Required-contents — 8 groups (`lib/policy/contents-definitions.ts: GROUPS`)

Snapshot source `data/uo-policies/002-provost-syllabus-requirement-undergraduate-and-graduate-policy.md` (Source: `https://provost.uoregon.edu/syllabus-requirement-undergraduate-and-graduate-policy`, Fetched: 2026-10-27) + `006-teaching-syllabus.md` applicability guard. Graduate vs undergraduate wording is slice-selected from the same file. Snapshot date is stored as `snapshotDate: "2026-10-27"` on every result.

| # | Group label | Anchor in source file | Components (id → label) | Question shown when needed |
|---|---|---|---|---|
| 1 | Instructor information | `INSTRUCTOR INFORMATION:` | `instructor_name` Instructor name; `office_room` Office or room; `uo_email` UO email address | `Where can I find…?` per component |
| 2 | Office hours | `OFFICE HOURS:` | `office_hours` Scheduled office hours; `office_appointment` Appointments outside office hours | — |
| 3 | Course objectives | `COURSE OBJECTIVES:` | `objectives` Course objectives; `learning_outcomes` Learning outcomes; `core_education` Core Education statements (undergrad only; `not_applicable` if level≠undergrad or coreEducation≠yes) | — |
| 4 | Grading | `GRADE POLICIES:` | `grade_standards` Standards for grades; `grade_criteria` Grading criteria and expectations | — |
| 5 | Absences | `ABSENCES:` | `absence_policy` Attendance/engagement expectations | — |
| 6 | Materials and activities | `MATERIALS AND ACTIVITIES:` | `materials` Required readings/materials; `activities` Assignments/exams/activities | — |
| 7 | Classroom behavior | `CLASSROOM BEHAVIOR:` | `behavior` Classroom behavior expectations | — |
| 8 | University policies and accommodations | `UNIVERSITY POLICIES AND COURSE ACCOMODATIONS:` | `university_statement` Required university statement (500+ char exact normalized check `fullStatement()`) | — |

**Status values:** `found` / `needs_review` (reference/external rubric, bare weight row `Midterm 100 50%`, or cue-only text fails `hasCriteriaDescription`) / `not_assessed` (quote failed verification or model omitted it) / `not_applicable` (historical: `year <2026` or 2026 before fall; or graduate vs core-education). Verified by `lib/policy/contents.test.mts` (12/12 cases: reviewed vs found, historical_unknown, batch deadline, empty-heading, points-only, external URL). Component-level evidence is never a group pass.

**Historical caveat shown to students:** `Compared with UO's current wording. Your term's wording may have been different.` (E2E `required-contents.spec.ts`). Do not claim 2025 compliance against Fall 2026 wording.

---

## 5. Open evidence / reviewed-OCR layer

`data/evidence-topics.json` (16 topics) + `data/uo-policies/reviewed-ocr/index.json` (10 records, all approved; 5 selected is live-syllabus source). `lib/policy/evidence.ts: loadAllEvidence` and `lib/policy/reviewed-ocr.ts: loadReviewedPolicies` both verify `artifactSha256`, `imageSha256`, `sourcePdfSha256`, `region` bounds, and exact quote containment.

Selected for live comparison (`selected:true`) — shown on `/evidence` and used by `/api/policy-check` for UO:

- `academic_integrity` p4 — `A grade penalty should not be put in place prior to …` — `dos.uoregon.edu/SOP-Academic-Misconduct-2023.pdf#page=4`
- `general_misconduct` p1 — `Prohibited Conduct … Student Organization` — `student-organization-misconduct-procedures-2020.pdf#page=1`
- `conduct_appeals` p1 — `appeals … University Appeals Board` — `university-appeals-board-procedures-2024.pdf#page=1`
- `registration_holds` p1 — `The UO utilizes administrative holds…` — `senate.uoregon.edu/Student Registration Holds…pdf#page=1`
- `admissions_policy` p1 — `The University sets standards for admissions.` — `policies.uoregon.edu/Admissions Policies…pdf#page=1`

Admitted but not live-selected (shown on `/evidence`; used only after explicit selection):

- `academic_integrity` p2 cover line, `registration_holds` already above, `mandatory_reporting` Title IX FAQ p1 `designated reporters`, `general_misconduct` prior SOPs, `dept_uo_anthropology` catalog description (non-comparable).

Verification: `lib/policy/evidence.test.mts` and `reviewed-ocr.test.mts` pass; `e2e/provider-documents.spec.ts` asserts provenance `Reviewed document, PDF page 3; image region …` renders and prints.

---

## 6. What this packet does **not** claim

- **No dimension grade or flag for the owner’s real 9-page syllabus is pre-assigned here.** Those are produced live by `POST /api/audit` (code grading from verified passages) and must be captured on camera with `See in context` and `coverage` visible. The packet supplies the rubrics and the synthetic gate demo only.
- **Not a substitute for re-fetch.** Every `provost.uoregon.edu`/`teaching.uoregon.edu` quote must be re-fetched demo morning; page moves break the locator (corp us file lines shift).
- **Model relation variance:** `matches` vs `conflicts` vs `adds_requirement` vs `silent` vs `disputed` (dual-model comparison) is model-proposed, code-verified only for quote containment/instructor/silence — not a proof the model’s semantic label is correct. The demo should show both quotes side by side and read them, not assert an institutional judgment.
- **Author bio (P6) weak by design:** rarely fires; do not anchor the Perspectives claim on it unless a bio was actually fetched and verified.
- **Term view:** W1–W10 map is `data` not a claim; assessments beyond week 10 retained outside the map (`e2e/audit.spec.ts:125`).

---

## 7. Minimal citing script (copy the locator, not the paragraph)

Demo script should say, pointing at the report:

> “Every box is a verified quote. Under **Against your school’s own policies** the UO quote comes from `data/uo-policies/0NN-…md` — snapshot `2026-10-27`, re-fetched live — and the syllabus quote is an exact substring of page N of the PDF, shown with **See in context** and its `Source:` URL. **Required contents** compares each component to UO’s list in `002-provost-syllabus-requirement…md` (snapshot `2026-10-27`); a component is `needs_review` not `found` when the passage is a bare reference like `Midterm   100   50%` or a rubric URL without described criteria. Grades are code-decided: `strong` needs ≥2 positive and 0 negative, `weak` ≥2 negative and 0 positive, else `mixed`; overall includes ≥3 areas, `S = strong − weak`.”

Then show one flagged comparison, one `mixed` dimension, and one `required_contents` `needs_review` — all with both quotes and URLs on screen.

---

## 8. Recording checklist

- [ ] `npm run build` green on the revision you deploy; `corpus.test.mts` still passes (UO pages unchanged or packet updated).
- [ ] Re-fetch the 11 UO URLs above; confirm each anchor sentence still appears.
- [ ] Run the real 9-page PDF through the deployed app (signed-in) once end-to-end (audit ~15–45 s); screenshot `Overall read`, `Biggest risk`, `Coverage`, and one `See in context` highlight for the cut.
- [ ] Exercise **Check required contents** with `fall 2026 / undergraduate / yes` and the complete UO accommodation statement; confirm `found` vs historic `not_applicable` vs external-reference `needs_review`.
- [ ] Exercise **Who do I go to?** for one situation; verify office name and quoted passage URL on `/navigator`.
- [ ] On `/evidence`, confirm the 5 selected records and the Anthropology department description render (optional cut if you show “UO against itself”).

---

*Generated 2026-11-01 without reading `../private-demo/` and without spending model credits. Update this packet, not the data files, if a source page moves; run the corpus tests to prove the new locator.*
