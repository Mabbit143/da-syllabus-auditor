# Student audit and report UI — approved refinement

Status: design approved; implementation and deployment authorized by the owner’s subsequent “write it and deploy it” instruction. Verification and release results must be recorded before claiming completion.
Owner approval: “approve audit syllabus and autosave” — confirms the UI direction, explicit Audit syllabus action, and disclosed autosave for signed-in reports.
Product context: [`../PRODUCT.md`](../PRODUCT.md).
Primary target: `/`, `components/AuditorHome.tsx`, `components/Report.tsx`.
Related components: `Nav`, `FixKit`, `RequiredContents`, `TermView`, and existing citation/provenance helpers.
Visitor mode: **Operate**. Reading evidence serves the student's task; this is not a marketing landing page.

## 1. Job and outcome

A student arrives with a syllabus or scattered Canvas material and needs to understand what the course asks of them, identify supported risks, inspect the source, and decide what to do next. Keep the student competent and in control; do not present them as needing rescue.

Success: the student can find the biggest supported risk, its exact source, and a useful next step without reading the entire audit. The existing two-minute comprehension and under-60-second typical audit goals remain targets, not measured promises.

Confirmed scope: students first; private owner workspace separate; student audits private; policy-gap list owner-only; public institutional evidence separate. The owner subsequently authorized implementing and deploying this approved UI. Paid model runs, source publication, provider changes and other scope expansions remain excluded.

## 2. Evidence checked and current friction

- Inspected the deployed signed-out upload screen at desktop and a 390px mobile emulation. The mobile capture shows navigation extending beyond the right edge. The desktop screen uses a coherent black, paper, cyan and lime Field Guide identity.
- The first screen puts a long combined provider/privacy/storage explanation before the file control. On mobile this occupies most of the viewport. The content is necessary; its current paragraph structure makes it harder to understand and act on.
- Source inspection: selecting a single file immediately begins extraction and audit. Combined pieces have an explicit audit action. This is inconsistent initiation behavior.
- Source inspection: `Report.tsx` already has Start here, overall read, dimensions, risk evidence, policy comparison, required contents, and FixKit. Start here sends students to next steps at the end rather than beside the relevant finding.
- Source inspection: repeated Verified stamps and Mixed / unclear remain even though the handoff records the owner's preference for less repeated verification chrome and the shorter Mixed label.
- Source inspection: browser caching and signed-in account saving are automatic. Older specs describe deliberate saving. The live disclosure also names provider fallback while older specs prohibit automatic substitution. The owner subsequently approved explicit Audit syllabus initiation and disclosed signed-in autosave. Provider fallback and importing pre-existing browser reports remain separate unresolved questions.
- No real syllabus was uploaded, no paid analysis was run, and no authenticated state or generated report was visually exercised during planning. Report proposals are grounded in code and specifications, not a claim of completed usability testing.

## 3. Direction and boundaries

**Refine the existing flow and identity; do not replace the visual world or invent a dashboard shell.** Keep a readable, primarily single-column report with progressive evidence disclosure and familiar web controls. Preserve existing routes and capabilities.

The organizing idea is **finding → evidence → next action**. Its distinctive interaction is opening the exact source context from a finding without losing that finding or the question the student wants to ask. Policy comparisons keep both documents together; they must not become a detached verdict badge.

Brand authority: DA Brand and Style Authority and DA Visual System V2 in Mabbitopia, reached via DA Design Quick Reference. Preserve the locked palette, contrast registers and type roles. Cyan continues to identify structure/source navigation; lime identifies the primary next action and inspected phrase; pink and violet registers retain their established evidence/status uses. No new palette, gradients, decorative dashboard metrics, or arbitrary font substitution. Use the brand's workhorse body/label roles for operational controls rather than turning every line into a display headline.

Not included: redesigning Schools, institutional evidence, funding or navigation destinations; changing grading or signal counts; suppressing inconvenient findings; automatic message sending; public student reports; changing providers; introducing dependencies or infrastructure.

## 4. Input and processing flow

### Empty and returning states

- Compact site navigation with the current section clearly identified. On narrow screens use an accessible Menu disclosure instead of squeezing all destination labels into one row. Keep account access reachable; preserve every existing destination.
- Product name, one sentence explaining the audit, then a clearly labeled input area. Do not add a marketing hero or fictional example results.
- Keep the existing single-PDF path primary. Make Combine pieces an explicit adjacent alternative with a short explanation that it accepts labeled text/PDF pieces, not a Canvas connection.
- Returning students can reach their term view/saved reports without scrolling through the full upload explanation. Preserve all existing course and department access; don't render owner-only records in student navigation.

### Approved deliberate start

Use a common sequence for both input modes:

`Choose/add material → review source list and disclosures → Audit syllabus → processing → report`

Show file names, extracted page counts, piece labels and any extraction/OCR caveat before analysis. Allow correction and replacement before the metered request. Changing the present auto-start behavior is an owner-approved functional change; it has not been implemented by this planning handoff.

For combined input, keep a list of labeled pieces with text/PDF type, local page count where available, and remove/edit controls. Preserve source order and locators. Course code remains optional; term/year and applicability remain unknown until supplied, not guessed.

### Disclosures

Replace the single paragraph with short labeled sections: What is analyzed; Where it goes; Where results are saved; Policy-gap recording. Critical facts remain visible before Audit, especially OCR image transmission and the separately recorded instructor/quote exception. Details may expand, but do not hide material consent behind a tiny link or soften the required sign-up checkbox.

Provider copy must reflect the actual configured path. Do not promise that the PDF always stays in the browser when OCR sends page images. Do not claim no fallback if the running system has one.

### Approved autosave

Completed signed-in reports autosave to the student’s private account; no separate Save button is required. State this clearly before Audit. Distinguish saving, saved, and failed/unavailable states based on actual persistence results; never display Saved before success. Keep browser-only storage distinct from account storage, preserve recoverable reports on failure, and provide retry without rerunning analysis. Autosave is not publication, does not weaken sign-out/account isolation, and does not settle consent for importing pre-existing signed-out reports.

### Processing

Keep the source list visible and disable duplicate submission. Show only actual observable stages, such as extracting text, reading scanned pages when applicable, and analyzing. A separate verification stage is shown only if the backend exposes it; do not simulate timing or percentages. The basic report may become available while a separately labeled policy check continues. A policy-check failure must not erase a completed audit.

## 5. Report hierarchy and behavior

1. **Report identity and coverage.** Filename/course, source pieces, page count, available audit timestamp, and prominent partial/OCR/provider caveats. A concise action area exposes print, return to term view, and the approved persistence controls.
2. **Start here.** Biggest supported risk, existing overall read with its reason, and up to three supported questions/findings. If none is supported, say that; never imply the course is risk-free. Do not invent a new summary score.
3. **Local section links.** Overview, Risks, Five dimensions, School policy, Required contents, Next steps. Only label sections as completed when their requests actually completed. In-page links preserve reading/print continuity; avoid hiding the entire report behind tabs.
4. **Finding blocks.** Plain-language finding and stated impact; severity/status text; original quote and locator; See in context; a linked next-step action. Bring the existing FixKit affordance beside the finding, while retaining the complete Next steps section. A draft is generated only on deliberate request, is editable/copyable, and is never automatically sent.
5. **Five dimensions.** Compact status-and-count overview, then each dimension's supporting and burdensome evidence. Keep all five visible even when Not found or Not assessed. Mixed is a display-label refinement only; preserve the code distinction for limited evidence and the approved grading semantics. No repeated decorative Verified stamp on every quotation; explain verification once and keep exact source/context controls.
6. **School-policy comparison.** Pair syllabus wording with the school wording, their locators/URLs, source snapshot/applicability information, the relation, and a useful question. Side by side only when both text columns remain readable; stack with persistent source labels on phones. Disputed means unresolved, not whichever verdict is easier to present. Not run, checking, failed, partial and complete remain distinct.
7. **Required contents.** Keep component-level observations and questions distinct from graded dimensions. Collect only the missing applicability context. Unknown stays unknown; external references need review; content observations do not certify compliance.
8. **Next steps and print.** Collect questions/drafts already tied to findings. Print includes evidence from collapsed sections, both sides of contradictions/comparisons, original piece/page locators, source links, coverage and OCR caveats. It must not rely on clicking See in context to recover the essential evidence.

### Context interaction

Expand context inline under the quotation, highlight the verified span, and retain source/piece/page labels. Use a real button with expanded state and a controlled region. Keep focus on the initiating control and provide an obvious close action. Do not make the desktop experience depend on a second full-document pane that becomes unusable on phones. Do not expose unrelated private documents or invent local-page numbers for old reports.

## 6. State and content coverage

| State / range | Required behavior |
| --- | --- |
| Empty input | Explain accepted inputs and the next action; no fake report or grade. |
| Invalid, corrupt or unreadable file | Specific error at the input; no model request based only on a filename. |
| Reading / OCR | Honest status; input preserved; OCR transmission disclosed before it occurs. |
| Ready | Source list, coverage/reading caveats and disclosures visible before the approved Audit action. |
| Analyzing | No duplicate requests or provisional unverified findings; no made-up progress percentage. |
| Complete | Supported summary, evidence and next steps accessible together. |
| Partial / failed area | Prominent incomplete status; preserve successful sections; never turn failed coverage into absence. |
| No supported evidence | No fabricated grade or overall lean; explain retry/replace options. |
| Policy/contents/fix error | Local error and retry for that operation; preserve base report and user input. |
| Save unavailable/failed | Do not display Saved; retain the available report and offer recovery. |
| Sign-out/account switch | Prior account's report must not remain visible or import into another account. |
| Reopened legacy report | Preserve existing content and explain missing provenance; do not invent newer fields. |
| Long filename, URL, quotation or piece list | Wrap and disclose progressively; no horizontal page overflow or silently lost evidence. |
| Many findings / repeated quotes | Summary remains short; complete evidence stays accessible and printable; no truncation that changes meaning. |
| Zero, one or multiple courses | Term navigation works without hiding a report or requiring fake course data. |

Do not introduce arbitrary numeric upload, page, text or piece limits in the UI plan. Before implementation, read the current validation limits and mirror them exactly in controls and error copy. Use existing test fixtures for planning tests, clearly identified as synthetic; never import the private demo/answer key into the repository.

## 7. Responsive and accessibility acceptance

- Desktop: keep long-form evidence at a readable measure. Use wider space for paired policy evidence only where it helps comparison; do not fill empty space with decorative cards.
- Mobile: one reading column, usable navigation disclosure, wrapping actions, stacked comparisons, and no clipped account or input controls. Target checks: 320px, 390px, 768px and 1440px, plus the owner's actual viewport when implementing.
- Keyboard-only: input mode switch, source editing, audit action, context expansion, section links, policy retry, fix generation and print/save controls are reachable with visible focus and meaningful labels.
- Announce processing and recoverable errors without continually stealing focus. After a completed audit, make the new report discoverable; focus/scroll must not hide its coverage warning.
- Never encode grade, severity, source identity or completion by color alone. Respect reduced motion and zoom; use motion only for state feedback.
- Keep semantic headings and source quotations; escape document content. Print and screen must agree on substantive evidence.
- These are planned acceptance checks, not a claim that accessibility or responsive testing already passed.

## 8. Approved decisions and remaining boundaries

1. **Approved:** existing Field Guide identity, better input/disclosure hierarchy, source-linked report, next steps alongside findings, and mobile navigation repair.
2. **Approved:** review selected material and disclosures, then press **Audit syllabus**. File selection alone must not start analysis.
3. **Approved:** signed-in reports autosave with a clear notice and truthful save status, rather than requiring a separate Save action. This supersedes the older explicit-save requirement for those reports.
4. **Still separate:** importing pre-existing signed-out browser reports into an account is not settled by approval of signed-in autosave. Do not silently expand account import or weaken account isolation.
5. **Still separate:** reconcile provider fallback with the older no-substitution contract outside the UI-only slice. Until resolved, display actual provider behavior accurately and change no provider configuration.

## Direction contract

THESIS: Finding → evidence → next action, in the existing student workflow; refuse a decorative dashboard or marketing hero.

OWN-WORLD: Preserve DA Field Guide’s black/paper ground, cyan structure, lime actions, existing contrast registers and font roles. Standard web controls and readable evidence take priority over ornament.

STORY: Choose and review material; deliberately start Audit syllabus; understand the supported risk; inspect its exact source; take a useful next step. Signed-in reports autosave privately with truthful status.

FIRST VIEWPORT: Compact wrapping/mobile-disclosure navigation, product title and concise explanation, source controls, material disclosures and the primary Audit syllabus action. A completed report leads with identity/coverage, Start here and the supported summary, then local section links; no fake metrics.

FORM: Approved refinement of the established single-column student flow, not a new visual world or concept tournament. Inline quotation context is the signature interaction. No seed was requested for this local refinement; the context engine is unavailable.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

For this ordinary extension, documentation means verifying preservation against the existing brand authority and recording implementation evidence here; no replacement DESIGN.md or new raster assets are required.

## 9. Handoff and verification boundary

The initial planning pass changed no application code or DESIGN.md. The owner has since authorized implementation and deployment; the scoped direction contract above records that handoff without inventing a new visual world. The existing visual authority is preserved. Impeccable's context launcher failed earlier because its engine download failed; initialization used repository and brand sources directly. Live overlay configuration is deferred because this is planning-only and the engine is unavailable, not reported as set up.

For the subsequent implementation task, use the approved scoped flow with regression tests for evidence/provenance, initiation and persistence decisions, partial/failure states, policy pairing and print. Reuse current components and endpoints before creating new ones. Run typecheck, relevant unit tests, lint, production build and mocked browser tests; inspect rendered empty, combined-input, report, partial, context-open and print states at the target widths. Metered live-model checks require separate authorization. Report actual results and remaining production blockers rather than treating a polished screen as proof of evidence correctness.
