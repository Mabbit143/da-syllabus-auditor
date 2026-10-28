# UO required syllabus contents

Status: proposed for owner approval. No product implementation yet.

## Intent and scope

Implement the first part of handoff item 3: show which required syllabus
elements are supported by the uploaded document, with a separate result
for each element. This helps students identify a specific question to ask.
The owner selected separate requirement checks over one general comparison.
Other new policy topics remain subsequent checklist work.

## Approaches

1. Separate requirement checks (selected): explicit component-level evidence
   and individual results; requires a small new result structure and UI.
2. One general policy comparison: reuses the current topic structure but
   obscures partial fulfillment and cannot explain individual omissions.

Use a separate required-contents section within the existing policy check.
Do not overload the current one-comparison-per-topic structure.

## Sources and applicability

Use committed UO snapshots, with exact source passages and original URLs:

- `data/uo-policies/002-provost-syllabus-requirement-undergraduate-and-graduate-policy.md`
  supplies the requirements and undergraduate/graduate distinctions.
- `data/uo-policies/006-teaching-syllabus.md` supplies supporting guidance
  and explicitly dates the new standard statement to Fall 2026.

Label the source snapshot date (2026-10-27). A snapshot is evidence of the
saved wording, not verification that the live page is unchanged.

Before running these checks, offer editable course term/year and course
level (undergraduate, graduate, unknown), plus Core Education applicability
(yes, no, unknown) for undergraduate courses. Defaults are unknown; do not
infer these from the filename. Store the selected context with the result.
The existing five-topic check remains available without these inputs.

For historical terms, do not claim a current requirement applied then without
a verified applicable policy version. For the Fall 2025 demo, show what
content was found and mark historical policy applicability unverified.
The new Fall 2026 statement is not assessed as a Fall 2025 requirement.
For unknown terms, show content evidence and unknown policy applicability.
Core Education checks stay not assessed unless the student confirms that
designation. Do not infer exemptions for generic graduate courses.

## Requirements and component evidence

Eight visible groups, with individual component results inside each:

| Group | Components |
| --- | --- |
| Instructor information | Name, office/room, UO email |
| Office hours | Set hours, how to arrange an appointment outside them |
| Course objectives | Objectives, learning outcomes; applicable Core Education statements/outcomes |
| Grading | Standards for grades, criteria/expectations |
| Absences | Attendance/engagement expectations and relevant policy wording |
| Materials and activities | Required readings/materials and assignments/exams/activities, as applicable |
| Classroom behavior | Expectations for classroom behavior |
| University policies and accommodations | Required standard statement when applicable |

Do not invent required books or exams if a course does not use them. A
verified explicit statement such as "No textbook required" is evidence.
Retain the policy's wording about expectations; do not strengthen "should"
into a categorical violation. Show references to external rubrics/materials
as references, not proof of their contents.

## Evidence and result contract

Add an optional `requiredContents` field to the policy-check result so old
saved reports still render. Include context, source snapshot date and an
array of group/component results. Each component has a stable ID, source
policy passage/URL, applicability, result, verified syllabus passages
(page and offsets), and a fixed next-step sentence.

Student-facing results:

- **Found:** the model supplied relevant candidate evidence and exact-source
  verification succeeded. This reports content presence, not certification
  that the requirement is fully satisfied.
- **Needs review:** evidence is partial, wording differs from a required
  statement, or a reference requires opening another document.
- **Not assessed:** no verified evidence was obtained, applicability is
  unresolved, extraction coverage is partial, or processing failed.
- **Not applicable:** an explicit applicability rule excludes this component.

No model omission or failed quote match becomes proof that content is absent.
Do not use the existing keyword-based `silent` logic for these components.
There is no overall pass/fail or new grade.

The model proposes component IDs and source passages; code validates IDs,
quote locations, applicability and displayed results. Reject invented,
ambiguous, wrong-page and cross-document quotes. Preserve canonical source
text, permitting only existing line-wrap whitespace normalization.

For an applicable required standard statement, code checks its full text
using the same normalization. A verified fragment does not satisfy the whole
statement. If it cannot be verified in full, show needs review when fragments
exist, otherwise not assessed. Do not use fuzzy matching.

## Flow and student actions

Use the existing policy-check endpoint and one additional bounded extraction
call for required contents, only for UO. Keep current comparisons intact.
Pass coverage and course context explicitly. Process all submitted page text
in bounded batches if needed; disclose failed batches, never silently truncate.
Use existing Meta configuration, low reasoning, store:false and no web search.

Display the eight groups below the existing policy comparisons, expandable
to component evidence, policy quote, source date and source link. Every result
offers a fixed, factual question, e.g. "Where can I find the grading criteria?"
Questions must not assert a violation. Support keyboard use and printed quotes.
Show a readable error and retry if this check fails; retain the existing report.

Keep these new component results out of automatic `policy_gaps` insertion:
content presence and review status do not establish a verified discrepancy.
This feature needs no migration, package install, new provider or paid service.

## Acceptance and rollback

- Complete and partial synthetic syllabi produce distinct component results.
- Verified fragments never imply a whole group is satisfied.
- Invented, wrong-page and ambiguous quotes fail; no evidence gives not assessed.
- Fall 2025 is not flagged for the Fall 2026 standard statement.
- Unknown term, level or Core Education applicability remains explicit.
- Full required statement passes only exact normalized matching.
- Partial coverage and failed batches cannot produce absence claims.
- Old saved reports and existing five-topic comparisons continue to render.
- New results never enter the private gap list automatically.
- Test API failure, retry, keyboard controls and print evidence with mocks.
- Run focused tests, typecheck, changed-file lint and production build; report
  existing unrelated lint failures separately. No live API spend is needed.

Rollback by removing the new optional check and UI; existing audit and policy
comparison behavior continues. Do not alter stored historical reports.

## Implementation choices proposed by the agent

The optional result structure, conservative evidence statuses, student-entered
course context, and exclusion from gap insertion are proposed implementation
choices. Approval of this document authorizes those choices and implementation.
No push to main is authorized by design approval.
