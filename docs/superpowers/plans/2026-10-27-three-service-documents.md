# Three-service document workflow implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Native execution was selected earlier and remains the execution method. Steps use checkbox syntax for tracking.

**Goal:** Connect Modal document OCR to reviewed UO policy evidence, Baseten analysis, and Meta research.

**Architecture:** Reuse existing Baseten and Meta transports with explicit routing, safe errors and truthful disclosure. Add an authenticated CLI-only Modal CPU worker that returns review bundles. A reviewed-admission manifest feeds the existing local policy lookup with optional OCR provenance.

**Tech Stack:** Existing Next.js/TypeScript; Python document worker on Modal SDK 1.6.2 and a Python 3.12 Modal image; PDFium, Pillow and Tesseract with compatible, rights-checked dependency pins established before installation.

**Spec:** `docs/superpowers/specs/2026-10-27-three-service-documents-design.md` (approved).

## Global constraints

- Preserve the existing uncommitted required-contents work; do not reset or overwrite it.
- Baseten model exactly `meta-models/muse-spark-open-1026`; Meta remains the standard model and sole web-search provider.
- Credentials server/local-profile only. No keys, source text, provider error bodies or reasoning in logs.
- No implicit fallback, duplicate provider calls, GPU model hosting, paid upgrades, recharge, automatic retries or schedules.
- Verify actual credit/access controls before cloud execution. No private syllabus traffic to Baseten until applicable privacy terms are verified.
- Modal accepts only explicitly selected public UO corpus PDFs; student PDF handling remains in-browser.
- Worker caps: 20 MB streamed download, 20 selected pages, 200 DPI, 16 million rendered pixels/page, 1 GiB memory, 300-second total timeout, one container/input.
- OCR is review_required until source-image review and explicit admission. Never promote confidence scores into evidence verification.
- No commits or pushes unless requested; keep changes locally reviewable.

## Review focus

- A redirect or DNS change targets private infrastructure: reject at connection time, not just URL parsing.
- A compressed PDF expands into enormous pages: bound dimensions, memory and subprocess runtime before rendering.
- An OCR bundle or review receipt changes after review: hash and quote mismatch must prevent admission/use.
- A previously saved policy carries forged OCR metadata: only the local approved manifest can authorize it.
- Runtime provider selection and upload disclosure differ: derive the disclosure from server configuration.

### Task 1: Provider routing, preflight and disclosure

**Files:** Modify `lib/meta.ts`; create `lib/providers.ts`, `lib/providers.test.mts`, `lib/meta.test.mts`, `scripts/provider-status.mjs`, `.env.example`. Convert `app/page.tsx` to a small server wrapper and move its current client implementation to `components/AuditorHome.tsx` with an analysis-provider disclosure prop. Update the approved spec's provider wording.

**Interfaces:** `analysisProvider(env): "meta" | "baseten"` rejects unknown settings. Existing `callMeta`, `callMetaSearch`, `runAgent` signatures remain compatible. Server wrapper passes only a provider label to the client. Status command returns booleans/roles and unverified live checks, never keys or inferred balances.

- [ ] Write failing transport tests using mocked fetch for routing, exact hackathon ID, Meta-only search, missing keys, quota, empty/malformed text/tool output and safe errors without provider-body leakage.
- [ ] Write failing tests for invalid configuration and the server-derived disclosure contract.
- [ ] Run and observe the expected failures before implementation.
- [ ] Implement the smallest routing/validation changes; retain existing timeouts, reasoning and quote gates. Rename `useBaseten` to a non-hook configuration name while retaining callers' behavior.
- [ ] Add the local read-only status command and documented variable names. Do not select Baseten in runtime configuration until credit/privacy checks are recorded.
- [ ] Move the client upload UI intact behind the server wrapper; display the configured analysis processor before upload. Meta research remains separately disclosed.
- [ ] Run focused Node tests and the original upload/report browser tests; both pass without live model calls.

### Task 2: Authenticated Modal document worker and local review bundles

**Files:** Create `document_jobs/{__init__,download,extract,modal_app,cli}.py`, `document_jobs/requirements.txt`, `tests/documents/test_download.py`, `tests/documents/test_extract.py`, `tests/documents/test_cli.py`; add ignored `.document-review/` output to `.gitignore`.

**Interfaces:** `download_pdf(url, manifest, limits) -> bytes`; `extract_document(pdf_bytes, selected_pages, limits) -> DocumentJobResult`; Modal function `process_document(job_id, source_url, page_selection, lower_limits)` returns that result; CLI `python -m document_jobs.cli status|preview|submit|collect` never exposes an HTTP service. Result includes status, source hash/URL/time, page text/method, PNG evidence and OCR boxes/confidence.

- [ ] Derive a bundled URL allowlist from the existing public PDF manifest, including recorded scan failures; pin and document original dependencies/licenses before installation.
- [ ] Write failing tests for unauthorized URL/port/userinfo, redirect escape, private DNS targets/rebinding, byte overflow, caller-raised limits, unreadable/corrupt/encrypted PDFs, missing ranges, excessive pixels and deadline failures.
- [ ] Implement a downloader whose socket connects to a vetted public IP while TLS validates the original hostname; revalidate every redirect, limit redirects and streamed bytes, respect 403/404, and accept PDF content only.
- [ ] Implement text-first page extraction and OCR only where usable text is absent. Render one page at a time, enforce pixel limits before allocation, and isolate native parsing/render/OCR in bounded subprocesses within the worker deadline. Return explicit per-page partial/failure state.
- [ ] Add the Modal app with max_containers=1, one input at a time, CPU only, memory=1024, timeout=300 and retries=0. Bundle the allowlist and worker modules. Authenticate through the owner's Modal profile; use a deployed named function, never an ephemeral per-submit app that bypasses the container cap.
- [ ] Add dry-run manifest preview and explicit submission/collection commands; write bundles under job-ID directories with atomic files and duplicate-source/range detection. Status must distinguish installed SDK from authentication, credited balance, deployment and successful job execution.
- [ ] Run Python tests with network/cloud boundaries mocked. Native extraction fixtures must use generated public/synthetic documents; report any missing local OCR dependency rather than claiming native integration tested.

### Task 3: Reviewed admission and application evidence integration

**Files:** Create `document_jobs/review.py`, `tests/documents/test_review.py`, `data/uo-policies/reviewed-ocr/index.json` (empty version-1 manifest), `lib/policy/reviewed-ocr.ts`, `lib/policy/reviewed-ocr.test.mts`. Modify `lib/policy/{types,corpus,compare,lookup}.ts`, `components/Report.tsx`, and `next.config.ts` file tracing.

**Interfaces:** Admission record: stable ID, topic, URL, sourcePdfSha256, artifactSha256, page, region, exact approved quote, reviewedAt and selected boolean. `loadReviewedPolicies(topics) -> SchoolPolicy[]` admits selected records only after file/hash/quote validation. Optional `SchoolPolicy.provenance` and `PolicyComparison.schoolProvenance` carry reviewed OCR page/region/hash metadata.

- [ ] Write failing Python/Node tests for unreviewed output, changed hashes/text/images, invalid page/region/topic, manifest/path traversal, non-UO URLs and forged cached metadata.
- [ ] Implement `review preview` showing exact candidate text beside source page references, followed by explicit owner-authored approval receipts. Worker output can never self-approve.
- [ ] Implement preview-before-write import of approved passages and their bounded evidence artifacts. Preserve source dates and mark method as reviewed OCR. Existing curated policy passages remain selected until a replacement is explicitly selected.
- [ ] Integrate the approved manifest loader into UO corpus selection, with quote/artifact consistency verified on every use. Cached client/database rows cannot authorize OCR; rehydrate only from the approved local manifest.
- [ ] Propagate optional provenance through comparisons and saved reports; show PDF page/region in citations and print. Include page anchors when recording school source URLs so gap citations retain a usable PDF page locator. Do not add unreviewed rows or alter RLS.
- [ ] Confirm the build traces admission metadata/artifacts; empty manifest leaves all current policy choices unchanged.
- [ ] Run Python and Node admission tests, corpus tests and mocked browser citation checks.

### Task 4: Setup verification, complete checks and handoff

**Files:** Create `docs/provider-document-setup.md`; update `docs/{handoff-muse-code,spec-da-syllabus-auditor-v1}.md` and this plan's ignored progress ledger.

- [ ] Record separate statuses for credential presence, authenticated access, actual credit balances, spending controls, applicable privacy terms, worker deployment and live smoke tests. Inspect authenticated dashboards/configuration if available; missing account access does not block offline implementation.
- [ ] Before cloud smoke tests, establish $0 out-of-pocket controls. Modal distinguishes gross workspace usage budget from net spend limit; verify applicable credits and the actual configured net limit. Never assume a notification or resource cap is a hard dollar stop.
- [ ] If credit/privacy conditions pass, enable Baseten explicitly and run one tiny synthetic inference, then deploy the authenticated Modal worker and run one selected public page. Record actual results and reuse them. If conditions cannot be verified, keep live actions gated and document exact owner setup still needed.
- [ ] Run all Node/Python tests, full mocked Playwright suite, typecheck, changed-file lint, production build and git diff --check. Report preexisting failures separately.
- [ ] Perform one independent read-only whole-change review with the approved design, this plan and ledger. Reproduce important findings with failing tests, fix in one pass, and rerun the complete relevant suite.
- [ ] Update the authoritative handoff with verified outcomes, remaining setup and rollback commands. Explicitly distinguish offline integration from live activation. Leave work uncommitted and do not push.

## Self-review

All approved design sections map to Tasks 1–4. Provider API and existing audit
interfaces stay compatible; OCR provenance is optional. Security, resource and
admission tests cover the five review-focus risks. Native execution is already
selected; only plan review is pending before implementation.
