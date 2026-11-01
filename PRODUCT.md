# DA Syllabus Auditor

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Students are the primary audience, especially non-traditional, first-generation, returning, and low-income students evaluating a course before add/drop or navigating its requirements during the term. Students with disabilities, working parents, and students with substantial outside obligations are explicitly included.

The owner has a separate accountability workspace. Its needs must not displace the student audit workflow. This priority and the privacy boundaries below were confirmed by the owner during Impeccable initialization.

## Product Purpose

Help a student understand what a syllabus requires, identify documented risks and contradictions, compare it with their school's written policies, inspect the evidence, and take a useful next step.

The established acceptance targets are an end-to-end audit of a typical text syllabus in under 60 seconds and an understandable report within two minutes. These are targets, not performance claims. A student should be able to identify the biggest supported risk, understand the overall assessment, and inspect the passages behind it.

University of Oregon is the initial institutional focus. The broader accountability aim is to document discrepancies between institutional documents and the institution's own standards.

## Positioning

This is an evidence-backed audit, not just a deadline organizer or an opaque AI score. The model proposes passages; code verifies quotation locations and computes grades from approved rules. Printed grading and schedule facts also feed a deterministic evidence ledger. School-policy comparisons retain evidence from both documents. Every finding should lead to something the student can do.

## Operating Context

- The existing application uses Next.js App Router, TypeScript, React, browser PDF extraction, server analysis routes, Supabase accounts/private storage, and Vercel. See `package.json` for exact dependencies rather than treating this brief as a version registry.
- Student input includes a single syllabus PDF and the implemented combined-input workflow for labeled document pieces or pasted text. Preserve original piece/page provenance; combined input is not an LMS integration.
- Students inspect a report, open quotations in context, compare school policy, request next-step help, and print. Approved behavior: students deliberately press **Audit syllabus** after reviewing their material; completed reports autosave to their private account when signed in, with a clear notice. Existing term planning and opportunity workflows remain available.
- Public institutional evidence and policy-versus-policy exploration are separate from student submissions and the owner-only policy-gap list.

## Capabilities and Constraints

- Five dimensions: Transparency; Punitive vs. flexible; Accessibility in practice; Whose perspectives are in the room; Hidden curriculum. Overall labels and grading remain governed by the approved rubric, not UI design choices.
- A displayed substantive finding needs verified source evidence. Preserve original quotations, page/piece locators, both sides of contradictions, coverage limitations, and source links.
- Distinguish missing evidence after full coverage from material that was not assessed. Neither permits inventing a low grade or declaring a course risk-free.
- Exact quote matching does not itself prove that the interpretation is supported. Keep rationale review and verification limitations explicit.
- Identity is never inferred from names, photographs, or reputation. Public author-background statements require cited source evidence. Document stance can be characterized plainly where its verified wording supports it; this does not license unsupported personal claims.
- Preserve policy source snapshot dates and historical applicability. Required-content observations are not a compliance certification or a new overall grade.
- No fabricated progress, provisional unverified findings, silent truncation, or automatic unbounded retries. Errors must preserve recoverable work and offer an appropriate next action.
- Original PDF handling, OCR, provider disclosures, and persistence must follow the actual selected input path. Do not claim that every path keeps all PDF data in the browser; OCR implementation and production acceptance need their own explicit disclosure and verification.
- No LMS/calendar integration, paid services, silent provider changes, or rubric changes under a UI task. Free-tier infrastructure only; metered model runs require the applicable approval. Push/merge/deployment remain subject to repository approval gates.

## Privacy and Publication

Confirmed for this design work:

1. Saved student audits remain private to their account. The owner approved autosave for signed-in reports with a clear notice; a separate Save action is not required. Printing remains deliberate. Autosave is not public sharing and does not authorize importing another account’s reports.
2. The Schools/policy-gap list remains owner-only. Preserve the upload disclosure and required sign-up consent describing the separately recorded quotes, instructor name, school and discrepancies. Do not describe this exception as anonymous document content or silently hide it.
3. Public institutional evidence stays a separate collection and workflow. Public source documents do not make student uploads or private gap records public.
4. Publication, sending accountability messages, or contacting institutions is not authorized by initialization or UI planning. No new public report links or public accountability view are approved.
5. Sign-out/account switching must not expose the previous student's local report. Private demo files and answer-key notes remain outside the repository and are not design fixtures or model input.

## Brand Commitments

Deconstructing Academia (DA), existing Visual System V2, "Field Guide." The repository handoff identifies the owner's brand reference at `C:/Users/mabbi/Documents/Mabbitopia/RookeryBrain/06_Assets_And_Brand/Brand System/DA-Design-Quick-Reference.md`. Read that authority before styling. Preserve this identity rather than inventing a replacement during initialization. No new visual world, palette, or typography is selected by this file.

Student-facing language is direct, plain, and actionable. State what the source supports; do not soften documented discrepancies into vague reassurance or inflate an uncertain finding into a verdict.

## Evidence on Hand

- `docs/prd-da-syllabus-auditor.md`: original product purpose, audience, and acceptance targets.
- `docs/spec-da-syllabus-auditor-v1.md`: build/evidence contract and approved expansions.
- `AGENTS.md`, `docs/handoff-muse-code.md`, and `docs/november-2-readiness.md`: later owner decisions and implementation/verification notes. Dated status sections can lag the code; do not copy them as current acceptance results.
- `app/`, `components/`, and `lib/`: implemented workflows and evidence mechanisms.
- `data/uo-policies/`: institutional reference snapshots and reviewed evidence; not a guarantee of current live wording.
- `e2e/fixtures/`: test content, not real student proof, testimonials, or measured product outcomes.

No testimonials, adoption figures, accuracy benchmarks, or claims of complete production acceptance are established by this brief. Existing code and prior test notes are not a new live verification.

## Product Principles

1. Let students inspect and challenge the evidence behind a conclusion.
2. Put useful next steps beside documented problems.
3. Separate source facts, interpretation, missing evidence, and failed assessment.
4. Keep student work private and institutional/public evidence distinct.
5. Preserve recoverable work, provenance, and the approved grading rules through UI changes.

## Accessibility & Inclusion

The existing specification requires keyboard-operable input and citation controls, accessible labels, visible focus, announced processing/errors, and grades that do not rely on color alone. Printed reports must retain readable evidence and page locators without interactive controls. Responsive layouts must support students reading on small screens and long or fragmented source material. A formal conformance level or completed accessibility certification has not been established.

## Current Design Scope and Open Decisions

The owner approved the student audit/report UI direction in `docs/student-audit-ui-brief.md`, an explicit **Audit syllabus** action after review, and disclosed autosave for signed-in reports (approval: “approve audit syllabus and autosave”). The owner workspace remains separate and outside this refinement. This planning handoff records approval; it is not a claim that application changes have been implemented or verified.

Open: any formal accessibility target beyond the existing functional requirements; consent for importing pre-existing signed-out browser reports into an account is separate from approved autosave of signed-in reports. No framework selection is needed because the application already exists.

Observed implementation-versus-contract differences: `components/AuditorHome.tsx` starts the single-file audit on selection, caches results in the browser, and calls account saving automatically when signed in; it can also import browser audits into an empty account. The live upload disclosure describes automatic saving and a Meta-to-Baseten fallback. Older specifications describe deliberate Audit/save actions and no automatic provider substitution. The owner has now resolved initiation and signed-in saving: explicit Audit syllabus after review, then autosave with notice. This supersedes the older deliberate-save requirement for signed-in reports. Provider fallback and pre-existing browser-report import consent remain separate unresolved questions; preserve and disclose actual behavior without silently changing those policies. These documentation updates change neither application behavior nor provider configuration.
