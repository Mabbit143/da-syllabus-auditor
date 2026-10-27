# Spec: v1 Syllabus Audit (upload → graded report)

Status: IMPLEMENTED — project started 2026-10-26 and built; app is live. Source: `docs/prd-da-syllabus-auditor.md`. The PRD wins on any conflict. Current build contract: `docs/spec-da-syllabus-auditor-v1.md`.

**Code gate: passed.** The hackathon started 2026-10-26 and the audit below is implemented. If implementation needs to deviate from this spec, stop, update the spec, and get approval first.

## Decisions (resolved 2026-10-26; kept for the record)

1. **Stack: DECIDED** — Next.js 16 on Vercel free tier, Supabase, `pdfjs-dist`. The API below maps to the implemented routes (`app/api/audit` and siblings). The $0 free-tier constraint applies throughout, including Meta Model API access.
2. **Dimension weighting: DECIDED** — equal weights (see Behavior 4 and `lib/rubric.ts`). No weighted formula is invented.
3. **Meta Model API details: VERIFIED and implemented** — base URL `https://api.meta.ai/v1`, `POST /v1/responses`, model `muse-spark-1.3` (never `-contributor`), `store: false`, low reasoning effort. See `lib/meta.ts`.

## Scope

In: single PDF upload, text extraction with page locators, five-dimension audit, overall read, three policy-risk flags, verified citations, printable report page.
Out (non-goals): see the final section.

## Behavior (given / when / then)

### 1. Upload
- Given a PDF, when uploaded, then show file name and page count and start the audit with no manual transcription.
- Given a non-PDF (by type or content), when uploaded, then reject with "Please upload a PDF file." No audit starts.
- Given a PDF over the size limit, when uploaded, then reject with the limit stated. **Limit: TBD, set by the chosen stack's free tier.**
- Given a password-protected or corrupt PDF, then fail with "could not read this file." No audit starts.
- Given a scanned/image-only PDF (no extractable text), then fail with "could not read text from this file." Never audit from the file name or guess. No OCR in v1.
- Given a PDF with partially extractable text, then audit the readable pages and list the unreadable page numbers in the report.

### 2. Extraction
- Text is extracted per page; every passage keeps its page number and, where detectable, a section heading.
- Very long syllabus: split by section and audit section by section. If a section fails, the report names the skipped section and still shows the rest.

### 3. Dimension grading
Dimensions: Transparency; Punitive vs. flexible; Accessibility in practice; Whose perspectives are in the room; Hidden curriculum.
- Each dimension returns: grade, rationale, 1–3 supporting passages, and a missing-evidence note.
- **Grade scale: APPROVED and implemented.** A–F is not used; three plain labels (Strong / Mixed / Weak) map to old-guard / mixed / inclusive without implying a school grade. See `lib/rubric.ts`.
- Given no evidence for a dimension (e.g. no accessibility section), then show "not found in this syllabus" with no grade inferred from silence beyond that statement. The dimension is marked "Not found," not "Weak."
- Given contradictory passages, then show both passages and mark the dimension "Mixed / unclear." The model does not resolve the contradiction.

### 4. Overall read
- One of: old-guard leaning, mixed, inclusive leaning, plus a visible breakdown of the five dimensions that produced it.
- Interim rule (equal weights, pending decision 2): the read follows the majority of graded dimensions. Dimensions marked "Not found" are excluded from the count and listed as excluded. If fewer than 3 dimensions are graded, show "Not enough evidence to give an overall read."
- No single opaque number is shown.

### 5. Policy-risk flags
Types: attendance, grade-weight, late-policy (plus the four dimension-linked flag types in the PRD data model).
- Each flag shows: the passage, the percentage/weight only where the text states it, and a plain-language impact sentence.
- Grade-weight concentration is flagged only from stated weights. Never computed from guesses.
- Given no attendance or late policy in the text, then show "not found in this syllabus," not a flag.

### 6. Citation gate (core requirement)
- Every displayed grade, flag, and finding must carry at least one passage.
- A passage counts as verified only if its text appears verbatim in the extracted syllabus text (after normalizing whitespace and line breaks only). A quote the model supplies is a claim, not proof.
- Any finding whose passage fails verification is dropped before display. If everything is dropped for a dimension, that dimension shows "not found in this syllabus."
- The report states how many model findings were dropped for failing verification.
- Each passage links to its page and surrounding context in the source text, so the student can read it and disagree.

### 7. Report
- Readable in under 2 minutes. Order: overall read and biggest risk, then five dimensions, then policy flags, then skipped/unreadable sections.
- Printable as a page. Sharing means a link or print/save-as-PDF of the report only, not publishing the uploaded syllabus.
- Fixed footer: "This audits the text of a document. It is not legal or academic advice and does not claim the course is discriminatory or say what the instructor intended."
- Language describes what the text shows, never author identity, demographics, or intent.

## API contract (implemented routes; logical operations below map to `app/api/`)

**Create audit** — input: one PDF file. Output: audit id, file name, page count, status.
Errors: 400 not a PDF / corrupt; 413 too large; 422 no extractable text; 502 Meta Model API failed after one retry; 504 audit exceeded the time budget.

**Get audit** — input: audit id. Output: status (`processing` | `complete` | `failed`) and, when complete, the full AuditReport with passages.
Errors: 404 unknown id; 410 expired or deleted.

**Rules for both:** every failure returns a plain-language message safe to show the student, and a readable server log with no syllabus text and no secrets. Every call is wrapped in explicit error handling (project convention).

## Data

New app, no migration. Entities exactly as in the PRD: Syllabus, Passage, Flag, DimensionScore, AuditReport. Additions this spec needs, none of which change the PRD's meaning:
- `Passage.verified` (true/false), set by the citation gate; only verified passages are ever stored for display.
- `AuditReport.skipped_sections` and `AuditReport.dropped_finding_count`.
- Retention (implemented): unsaved audits are transient (browser memory; server holds text only during the request). A signed-in student may save an audit to their own account (row-level security) and delete it; nothing is used for training or shared, apart from the disclosed `policy_gaps` exception in `docs/spec-da-syllabus-auditor-v1.md`.

## UI states

| Screen | Loading | Empty | Error | Success |
| --- | --- | --- | --- | --- |
| Upload | File name and page count appear, then progress | Drop zone with "PDF only" | Plain message per Behavior 1; student can retry | Moves to audit progress |
| Audit progress | Stage labels (reading, auditing, checking citations); target under 60 s | n/a | Names what failed; offers retry | Moves to report |
| Report | n/a | Per-dimension "not found in this syllabus" | Partial report lists skipped sections | Full report per Behavior 7 |
| Passage in context | n/a | n/a | "Source text unavailable" if the lookup fails | Shows passage highlighted in its page text |

## Non-goals (v1)

Multi-syllabus term view, crunch-week map, cross-course comparison; Canvas/LMS sync, calendar integration, grade-math simulation; draft emails to professors or advisors; professor, department, or institutional dashboards; OCR; user accounts (unless the stack makes them trivial); any claim about identity, demographics, or intent; any paid service.

## Acceptance checklist

Pass/fail, each checkable by a person. Tied to PRD metrics and stories. The app is built and live; leave a box unticked until you have seen the evidence (open checks are tracked in `docs/handoff-muse-code.md`).

- [ ] Typical syllabus PDF audits end to end in under 60 seconds (measured, not assumed).
- [ ] 100% of displayed grades and flags have a verbatim passage that exists in the extracted text.
- [ ] A model finding with a fabricated or altered quote never appears (test with a deliberately altered quote).
- [ ] Missing section shows "not found in this syllabus," not an inferred policy.
- [ ] Contradictory policies show both passages and "Mixed / unclear."
- [ ] Non-PDF, corrupt, oversize, and image-only files each fail with their specified message and start no audit.
- [ ] Image-only PDF never produces an audit from the file name.
- [ ] File name and page count are shown after upload.
- [ ] Five dimensions each show grade, rationale, 1–3 passages, and missing-evidence note.
- [ ] Overall read shows its breakdown and excluded dimensions; no unexplained number.
- [ ] Attendance, grade-weight, and late-policy flags show passage, stated weight only, and impact.
- [ ] Every grade and flag links to its passage in context.
- [ ] Skipped sections and unreadable pages are named in the report.
- [ ] The report prints cleanly and the disclaimer footer appears.
- [ ] No language in the report names author identity, demographics, or intent.
- [ ] Demo file `GamesSyllabus2025_clean.pdf` runs end to end; results are compared against `GamesSyllabus2025_highlight_notes.md` after the audit, and that file is never given to the model.
- [ ] Total cost is $0 (hosting, storage, and Meta Model API) confirmed before the demo.
- [ ] Uploaded text is not shared, published, or used for training, and retention follows the approved rule.
