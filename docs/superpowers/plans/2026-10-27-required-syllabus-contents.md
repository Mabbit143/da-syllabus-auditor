# Required syllabus contents implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Give UO students separate evidence-backed results for required syllabus components.

**Architecture:** Add an optional required-contents result alongside existing policy comparisons. A server module loads verified snapshot requirements, asks Meta for candidate passages in bounded page batches, and validates evidence and applicability in code. A separate client component collects context and displays results.

**Tech Stack:** Existing Next.js 16, React 19, TypeScript, Meta Responses API and Playwright; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-27-required-syllabus-contents-design.md` (owner approved).

## Global constraints

- Free tiers only; low reasoning, store:false; no live API spend for verification.
- No push to main without explicit approval.
- Original source text and exact quotes; no fuzzy matching or absence inferred from model omissions.
- Eight groups, component-level results, no new overall grade.
- Historical and unknown applicability explicit; Fall 2026 statement never required for Fall 2025.
- New component results never enter automatic policy_gaps insertion.
- Old reports and the existing five policy topics remain compatible.

## Review focus

- Truncated or missing PDF pages: no complete-coverage claim.
- Old policy check responses arriving after context edits: prevent context/result mismatch.
- Full standard statement exceeds the existing 500-character quote limit: verify complete normalized statement separately without relaxing existing quote gates.
- References to external rubrics: presence of a link is not evidence of external contents.
- Historical and unknown terms: no current-policy violation claims.

### Task 1: Requirement definitions and deterministic evidence validation

**Files:** Create `lib/policy/contents-types.ts`, `lib/policy/contents-definitions.ts`, `lib/policy/contents.ts`, `lib/policy/contents.test.mts`.

**Interfaces:** Export `CourseContext` (term, year, level, coreEducation; unknown supported), `RequiredContents` (context, snapshotDate, groups, coverage and optional error). Export `checkRequiredContents(pages: Page[], coverage: Coverage, context: CourseContext, ask: Ask): Promise<RequiredContents>`. Groups contain stable component IDs, applicability, status, policy quote/URL, syllabus passages with offsets, and fixed next-step questions.

- [x] Write failing tests for invented, ambiguous and wrong-page quotes; no evidence yields not assessed; one found component cannot satisfy a group; references yield needs review.
- [x] Write failing tests for Fall 2025, unknown term/level, conditional Core Education, and exact full-statement matching versus fragments.
- [x] Run the focused test and confirm missing behavior fails.
- [x] Implement eight group definitions with explicit component IDs; extract policy passages from the two approved corpus files and validate exact source matches and UO URLs.
- [x] Implement context validation and conservative applicability: current snapshot comparison for supported context; historical applicability unverified unless an applicable version exists; known pre-Fall-2026 standard statement not applicable.
- [x] Implement bounded page batches without truncation; split large page text with original offsets preserved. Model proposes IDs, reference markers and passages, never statuses. Use existing verifier for ordinary passages, a separate exact full-statement check for the long statement. Unknown IDs and invalid quotes are discarded.
- [x] Test full submitted text, partial extraction and a failed batch; failed/partial coverage cannot imply absence. Include readable safe logs and structured partial/error results.
- [x] Run focused tests: every assertion passes without live model calls.

### Task 2: API and saved report integration

**Files:** Modify `app/api/policy-check/route.ts`, `lib/policy/types.ts`, `app/page.tsx`; add mocked integration tests in `e2e/required-contents.spec.ts`.

**Interfaces:** Optional request fields `requiredContentsContext: CourseContext`, `coverage: Coverage`; optional response and `PolicyCheck.requiredContents: RequiredContents`. Existing `items`, `policies`, `newPolicies` retain their contracts. Context omitted means the existing five-topic check only.

- [x] Add failing integration assertions for malformed context, non-UO requests, old request compatibility and contents-only failure preserving regular comparisons.
- [x] Validate context/coverage server-side; enable the extra check only for UO with explicit context. Catch contents failures separately and return a retryable contents error alongside existing results.
- [x] Persist optional result and its actual context with the policy check; pass coverage from the selected audit. Ensure recordGaps still receives only existing comparison items.
- [x] Guard stale responses by course ID and request generation; a late response cannot overwrite newer context/results. Preserve old optional results when doing an unrelated five-topic rerun only if their source document and context remain the same.
- [x] Run mocked integration assertions, including API failure/retry and unchanged gap payload.

### Task 3: Context controls and evidence display

**Files:** Create `components/RequiredContents.tsx`; modify `components/Report.tsx`, `app/page.tsx`; extend `e2e/required-contents.spec.ts`.

**Interfaces:** Component receives optional result, busy/error, school, and `onRun(context: CourseContext)`. Keep context controls local to the selected course using a course-specific key. Use native fieldsets, labels and details/summary for eight expandable groups.

- [x] Write failing browser checks for unknown defaults, editable term/year/level/Core Education, eight group labels, component statuses and both source/observed quotes.
- [x] Implement controls and UO-only section with a separate explicit run/retry button. Capture submitted context; edits do not relabel already-generated results.
- [x] Display fixed next-step questions, snapshot date, applicability, page locators and original passages. Old reports display controls without crashing; other schools do not show UO requirements.
- [x] Verify keyboard operation, processing/error announcements and printed evidence. Print CSS must expose evidence inside collapsed groups.
- [x] Run mocked E2E tests for complete/partial syllabi, historical statement, failed check/retry and changing course/context while a response is pending.

### Task 4: Verification and project record

**Files:** Update `docs/handoff-muse-code.md` item 3 and add the approved behavior to `docs/spec-da-syllabus-auditor-v1.md`.

- [x] Run all new Node tests and the existing corpus tests.
- [x] Run `npm.cmd run test:e2e`, `npx.cmd tsc --noEmit`, changed-file ESLint, `npm.cmd run build`, and `git diff --check`; report any failures by name. Full-repo lint already has unrelated failures; recheck only if changes affect them.
- [x] Review diff for accidental credentials, public gap exposure, unapproved provider calls and unrelated edits. Review implementation against the approved design.
- [x] Record verified outcomes. Mark only the required-contents portion of item 3 complete; later topics stay open. Do not claim deployed/browser-live verification from mocked tests.
- [x] Leave changes reviewable locally. No commit or push unless requested.

