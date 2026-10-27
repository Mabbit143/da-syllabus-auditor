# DA Syllabus Auditor

DA Syllabus Auditor is a planned student-facing web app that audits a single university syllabus PDF for bias, transparency, and policy risks.
It must explain five dimension grades and an overall old-guard versus inclusive read using verified verbatim passages from that syllabus.

## Source of truth and current state

- Read `docs/prd-da-syllabus-auditor.md` before changing scope. It is transcribed from the user-attached PRD PDF.
- Actual repository: `Mabbit143/da-syllabus-auditor`; default branch: `main`.
- Inspected on 2026-10-26: the checkout contained only `README.md`, `.gitattributes`, and Git metadata before this documentation update. Nothing is built yet.
- Blindspot is shelved. Do not apply its architecture, five-source evidence rules, or implementation plan to this project.
- Follow the user-provided plan-first and spec-first workflows. The v1 specification is `docs/spec-da-syllabus-auditor-v1.md`; it is a draft awaiting approval.

## Verified stack and versions

| Area | Verified status |
| --- | --- |
| Product | Planned web app; no application code yet |
| Frontend, language, runtime | Decided 2026-10-26: Next.js on Vercel free tier; no manifest or version pin yet |
| Analysis | PRD requires Meta Model API, Muse Spark series; exact model ID, endpoint, SDK, and version are unverified |
| Backend, hosting, storage | Open decisions; free tier only, total budget $0 |
| Database, authentication, state management | No implementation or dependencies present |
| Package manager and tooling | No lockfile, build configuration, test runner, or lint configuration present |

Do not present PRD intentions as installed dependencies. Verify chosen services, access, exact model identifiers, versions, and free-tier feasibility before implementation. Do not silently substitute another AI provider.

## Commands

Run commands from the repository root. There are currently no application commands to run.

| Task | Actual command |
| --- | --- |
| Install dependencies | Not configured; no dependency manifest |
| Development server | Not configured |
| Build / production start | Not configured |
| Tests | Not configured |
| Lint / formatting | Not configured |

Repository inspection commands: `git status --short`, `git ls-files`, `git diff --check`.
After scaffolding, replace this table with commands verified against the actual scripts/configuration and record whether they were executed successfully. Do not invent `npm` scripts.

## Architecture

Current files:

```text
README.md                         Repository title only
.gitattributes                    * text=auto (Git text normalization)
CLAUDE.md                         Contributor and assistant guidance
docs/prd-da-syllabus-auditor.md    Product requirements
```

The PRD defines this intended flow; no modules implement it yet:

`Single PDF upload -> text extraction with page/section locators -> Meta Model API analysis -> verbatim-citation verification -> audit report`

- Upload: validate PDF, display file name and page count, require no manual transcription.
- Analysis: grade Transparency, Punitive vs. flexible, Accessibility in practice, Whose perspectives are in the room, and Hidden curriculum. Show 1-3 supporting passages per dimension where evidence exists, rationale, and missing evidence.
- Risks: attendance penalties, grade-weight concentration, and late-work rules, including weights/percentages only where stated.
- Report: overall `old-guard leaning`, `mixed`, or `inclusive leaning`, derived transparently from the dimension breakdown; readable in under two minutes, printable/shareable as a page. Every grade and flag links to its passage in context.
- Planned entities: `Syllabus`, `Passage`, `Flag`, `DimensionScore`, `AuditReport`. Their PRD fields are requirements, not an existing database schema. No migration exists.
- Target: a typical PDF audit completes end to end in under 60 seconds. This is not a measured result.

## Observed conventions and working style

- The only pre-existing code-related convention is Git automatic text normalization (`* text=auto`). No naming, component, API, styling, or testing conventions can yet be inferred.
- User-directed conventions: prioritize the smallest functional implementation; use isolated reusable components and split complex files.
- Explain major changes and their effects in plain language before implementing them. Review dependencies and existing behavior before edits; flag concrete regression risks.
- Provide complete files or contextual diffs without omitted-code placeholders.
- Every API route, server action, and data fetch needs explicit try/catch handling, readable error logs, and user-facing error states. Keep automated logs clean and development messages descriptive.
- At a genuine technical fork, present exactly two paths with brief pros and cons. Summarize package installations or migrations in 1-2 sentences.
- Update this document as implementation establishes actual conventions; do not fill gaps with assumptions.

## Confirmed non-negotiables

- **$0 total, free-tier services only:** no paid hosting or paid services. Do not incur charges or silently upgrade plans. Verify free access for the required analysis API as well.
- **Meta Model API is the analysis layer.** Muse Spark series is specified by the PRD; exact integration details still need verification.
- **Citation verification is a display gate:** 100% of displayed findings, flags, and grades must cite verbatim text verified against the uploaded syllabus, with a page/section locator. Model-supplied quotes alone do not establish verification. Drop unsupported model findings before display; say `not found in this syllabus` for absent evidence.
- Intent is never inferred. Author background is judged only from the author's own public bio (verified quote and link), never from names or photos; see the spec's "Source authorship check" (user decision 2026-10-26). Describe what the document shows; do not label a course discriminatory or give legal/academic advice.
- Unreadable or image-only PDFs fail plainly (`could not read text from this file`); never fabricate an audit from the file name.
- Contradictory policies retain both passages and a mixed/unclear assessment. Long documents are processed by section; disclose any skipped sections.
- Uploaded syllabi are not shared, published, or used to train anything. Implement a printable/shareable report without automatically publishing the source document. One exception (user decision 2026-10-27, disclosed in the upload text and a required sign-up checkbox): where a syllabus differs from its school's written policy, the verified quotes, instructor name and school go to a private master list (`policy_gaps`, no user id, readable only by `app_owners` through `gap_report()`); 5 distinct syllabi on one school and topic flag it. Never make this list public without the user's say-so.
- Scope (user decision 2026-10-26): term view, crunch-week map, the agentic consistency auditor and the opportunity dashboard (funding, research, grad programs; Supabase free tier with accounts) are IN scope; see the spec sections "Scope expansion" and "Opportunity dashboard". Still out: LMS/Canvas sync, calendar integration, grade simulation, institutional dashboards, paid services. Saved syllabus text is private to the student's own account (row-level security), saved only by their choice, and never shown to others or used to train anything.

## Onboarding gotchas and unresolved decisions

- The local checkout is nested: `C:/Users/mabbi/dev/da-syllabus-auditor/da-syllabus-auditor`. Its parent is not the Git root; confirm with `git rev-parse --show-toplevel`.
- There is no app to start, no `.env` template, no verified credential-variable names, no tests, and no deployment configuration. Do not claim setup/build/test success until these exist and have been checked.
- Decide frontend/hosting/storage and verify the $0 path before scaffolding. Aggregation is decided as equal weights (plain count of dimensions per lean); rubric, thresholds and incomplete-evidence rules still need approved worked examples, so do not invent them.
- Hackathon facts verified 2026-10-26 from the Cerebral Valley guide: event started Oct 26 12 PM ET; submissions due Nov 4 9 PM ET (7 PM MT); public repo, new work only, three-minute demo video, Meta models required. $150 Meta credits claimed and a card is on file, so set a Billing Spend Limit and stay on the Standard model ID (`muse-spark-1.3`), never `-contributor`.
- The PRD names `GamesSyllabus2025_clean.pdf` (9 pages) as the demo input and `GamesSyllabus2025_highlight_notes.md` (19 notes) as a separate evaluation checklist. Both now exist outside the repo in `C:/Users/mabbi/dev/da-syllabus-auditor/private-demo/` (created 2026-10-26 from the annotated PDF: 9 pages, 19 notes, 0 annotations left in the clean copy, about 21k characters of extractable text); never commit that folder or copy it into the repo. Do not feed evaluation notes into the audit as syllabus evidence. Preserve the original annotated PDF.
- The PRD lists a November 4 target of 3 PM PT and hard stop of 6 PM PT for the hackathon submission. These are planning dates from the PRD, not independently verified event rules.
- Keep secrets out of Git. When integration exists, document required variable names and setup without secret values.
- This documentation task does not authorize building the application or choosing an unresolved stack.

## Mandatory implementation gate

No application code, scaffolding or installs before kickoff on 2026-10-26 at 9:00 AM PT (12:00 PM ET). After kickoff, building is allowed, and the user permits spending API credits to build and test as long as it is not wasteful. Remaining pre-build items: parser/versions/size limits and unconfirmed Meta details, settled during scaffolding. Planning and documentation are permitted; approved plans or specs do not override this gate. After the start, obtain approval of the spec and resolve its blocking decisions before implementation. If a deviation is required, stop affected work, update the spec, and get approval before continuing.
