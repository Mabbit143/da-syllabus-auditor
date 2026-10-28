# Baseten, Meta and Modal document workflow

Status: owner approved, 2026-10-27. Implementation plan review pending.

## Intent and selected approach

Use the owner's Baseten $100 grant, Modal $100 grant and existing Meta access
together for DA Syllabus Auditor. The owner clarified Modal's name and asked
for OCR/document processing. Treat this as the split-role approach discussed
in conversation, with Modal handling documents.

Approaches considered:
1. Split roles (recommended): Baseten analysis, Meta research, Modal document
   processing. Small integration; public-source OCR is an offline preparation
   step rather than accelerating every student audit.
2. Modal orchestrates every audit: removes long processing from Vercel, but
   adds persistent jobs, polling, cancellation and another student-data boundary.

## Roles and flow

| Service | Responsibility |
| --- | --- |
| Baseten | Muse Spark Open extraction, analysis and consistency tools using exactly `meta-models/muse-spark-open-1026` |
| Meta | Search-grounded author, policy and opportunity discovery using the existing standard Meta model |
| Modal | Extract readable PDF text and OCR scanned public UO policy pages, preserving page numbers and provenance |

Public UO PDF URL -> bounded Modal document job -> local review bundle ->
reviewed corpus text -> application policy lookup -> Baseten comparison ->
code quote verification and deterministic grading. Meta supplies web research
where local reference coverage is missing. No automatic provider switching,
cross-provider racing or retrying every request on multiple paid endpoints.

## Existing implementation and exact changes

Verified in the checkout: `lib/meta.ts` already supports Baseten text/tool
calls through `MODEL_PROVIDER=baseten`, while `callMetaSearch` remains Meta.
Both API key variables are populated locally; their balances, permissions and
successful live access have not been checked during this task. Modal's Python
SDK is installed; account authentication and the granted balance are unverified.

Add tests around existing provider selection and harden provider response/error
handling without replacing grading or quote verification. Add a local status
command reporting configuration presence, selected roles and missing setup,
never credential values. Update upload disclosure to name Baseten when it
receives syllabus text. Verify the Baseten account's applicable retention and
training terms before sending private source data; use synthetic/public data
for the initial smoke test. `store:false` on Meta is not a Baseten guarantee.

Add an original Python Modal worker and local batch/review command. Start with
CPU document extraction and Tesseract OCR as the agent's proposed implementation
choice; do not deploy a second large language model on Modal. Pin compatible,
rights-checkable packages during implementation. Student PDF extraction remains
in-browser; no student PDFs or private-demo material enter this worker.

Invoke an authenticated Modal function only from the owner's local CLI/profile.
Do not add a public HTTP endpoint or student-facing job-submission route. Enforce
the bundled source-manifest allowlist and maximum limits inside the worker;
callers may lower limits only. One container with one input at a time enforces
one active job across CLI invocations; additional submissions queue explicitly.

## Document job contract

Input: job ID, an explicit public UO source URL from the corpus manifest, page
selection and limits. No arbitrary URLs, local paths, uploads, prompts or keys.
Allow HTTPS `uoregon.edu` and its subdomains only, port 443/default; validate
every redirect and resolved destination, reject private/loopback addresses and
other domains. Respect access-denied responses without bypassing them.
Pin each download connection to its validated public DNS destination while
preserving HTTPS hostname/certificate checks; validate each redirect independently.
Stream and cap bytes rather than trusting Content-Length. Bound page dimensions
and rendered pixels (16 million/page), worker memory (1 GiB), and rendering/OCR
subprocess time within the job deadline. Reject inputs exceeding those bounds.

Proposed initial limits: one PDF/job, 20 MB, 20 selected pages, 200 DPI, one
container, one active job and 300-second worker timeout. Larger sources require
explicit page ranges; do not silently truncate. No automatic retries or schedule.
Try existing text first, OCR only pages lacking usable text. Report each page's
method and failure. Downloaded documents are data; never execute embedded content.

Output: JSON and a human-readable review bundle containing original URL,
fetch time, source SHA-256, page number, extraction method, text and OCR word
boxes/confidence where available. Include page image/crop references so the
student-facing quoted passages can be checked against pixels. States: queued,
running, ready_for_review, partial, failed. A completed job is not a reviewed job.

## Analyze -> preview -> save

Write job output to an ignored local review directory, separate from the
authoritative corpus. Do not overwrite existing corpus files or indexes.
OCR confidence is a review aid, never a quote-verification substitute.

Promoting an OCR passage requires checking its exact words against the rendered
source page, recording the reviewed page/region and approval. Only approved text
is admitted as policy evidence; all other OCR output remains review_required.
Text-based extraction retains its method and source locator too. Hashes prevent
unintended duplicate jobs and detect changed documents; they do not prove meaning.

The application continues using its existing corpus until reviewed additions
are deliberately imported. OCR neither changes syllabus grades nor automatically
creates master-list gaps. Historical policies retain their applicable dates.

Reviewed import must connect to lookup, not just save disconnected files. Add a
versioned admission manifest under `data/uo-policies/reviewed-ocr/` containing
source URL, PDF SHA-256, OCR artifact SHA-256, page/region, approved exact text,
review timestamp and explicit topic selections. The local importer checks the
receipt and hashes and previews changes before writing. Its approval means the
owner checked the indicated words against that page image, not that OCR confidence
was high. The worker cannot approve its own output. Existing five hardcoded policy
passages remain selected unless the owner explicitly selects a reviewed replacement.
Extend policy and comparison types with optional OCR provenance and display the
reviewed page/region with its citation; old saved results remain compatible.
The loader must verify admitted quote/artifact consistency before every use.

## Configuration and spending

Keep `MODEL_API_KEY` and `BASETEN_API_KEY` server-only, preserve existing Meta
model ID and Baseten's exact hackathon model ID. Default analysis stays as-is
until the explicit Baseten setting is applied and tested. Keep Modal credentials
in its authenticated local profile, not the public repository or browser bundle.

Verify credited balances and available spending controls before cloud execution.
Resource/concurrency/job limits bound workload; they are not a guaranteed dollar
cap. No paid upgrade, credit purchase or automatic recharge. Do not claim the
emailed grant amount is the current balance. Initial live verification is one
small synthetic Baseten request and one single-page public Modal OCR job, after
configuration and credit checks. Reuse existing Meta test evidence unless a new
integration failure needs a minimal synthetic check.

## Acceptance and rollback

- Mocked tests prove analysis goes to the configured provider and web research
  always goes to Meta; no automatic double-spending/fallback.
- Missing credentials, quota, malformed responses and timeouts give safe readable
  errors without credential/source-text logs.
- Worker tests cover readable PDF, scanned page, corrupt/encrypted PDF, mixed
  extraction, bad URL/redirect, oversize input, selected ranges and timeout.
- Tests reject manifest escapes, redirect-to-private destinations, DNS rebinding,
  streamed oversize responses and excessive rendering dimensions; the worker
  enforces limits even when caller flags request larger ones.
- Unreviewed OCR never appears in the policy corpus, displayed findings or gaps.
- Page locators and source provenance survive processing and reviewed import.
- Existing Node/browser tests, typecheck, changed-file lint and build stay green.
- Live smoke-test results distinguish credential presence, authenticated access,
  credited balance, successful inference and successful OCR; each is separate.

Rollback: restore the previous analysis-provider setting and disable Modal job
submission. Existing corpus and application audits remain usable. Preserve local
review bundles for inspection; do not remove source data automatically.

No push to main is authorized. This design adds OCR for public reference
documents; student scanned PDFs keep the existing unreadable-file behavior.

Builder review completed: invocation/authentication, download limits, and reviewed
import/provenance contracts clarified. Offline implementation can proceed after
design approval; live execution still needs actual credit/access checks. If the
available controls or applicable privacy terms conflict with the $0/no-training
rules, stop that live path and bring the concrete conflict to the owner.

## Primary references

- Modal OCR queue example: https://modal.com/docs/examples/doc_ocr_jobs
- Modal batch processing: https://modal.com/docs/guide/batch-processing
- Modal job processing: https://modal.com/docs/guide/job-queue
- Baseten security/retention terms: https://www.baseten.co/security-practices/
- Exact Baseten hackathon model ID and offered credits: owner-provided grant email.
