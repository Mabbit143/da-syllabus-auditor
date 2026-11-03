# Blindspot Engine design

Date: 2026-11-03
Status: implementation in progress. Owner selected extending the existing app with a background worker and owner-only findings, then explicitly authorized continued work. This document describes the intended design; `blindspot/README.md` and the implementation plan distinguish verified capabilities from unfinished work. Continuous operation and the complete objective are not yet verified.

Execution target decision: the owner subsequently selected this computer for recurring operation. The local Windows task and durable SQLite state implement that choice; the computer must remain on with the owner logged in. A hosted worker is an optional later target. Two timed cycles and the first installed background cycle have completed; the broader research and pattern-analysis objective remains incomplete.

## Goal and existing application

The syllabus auditor is built, with review checks outstanding. Preserve its student workflows and evidence rules. The Blindspot Engine continuously collects public documents about University of Oregon administration and analyzes discrimination, inequality, gatekeeping, and differences between institutional actions and stated policies. Findings live in an owner-only investigation view.

Existing reusable pieces: data/uo-policies contains a UO document collection; lib/policy/corpus.ts verifies selected policy passages against saved snapshots; document_jobs supplies download/extraction and reviewed OCR workflows; lib/policy/pairs.ts supplies policy comparison work; lib/verify.ts supplies quote checks. Reuse these where compatible after inspecting their contracts. Their presence does not establish a running monitor or institutional research engine.

## Approaches and decision

1. Extend the existing app with a separate background worker and private findings view. Reuses evidence infrastructure and reduces hackathon integration work. Requires durable job state and isolation from interactive audits. Selected by owner.
2. Separate application and engine deployment. Independent operations, but duplicates storage and authentication setup. Not selected.

## Collection and source coverage

Maintain a source registry across UO policy offices, provost, trustees, senate, finance, HR, admissions, financial aid, accessibility, student affairs, institutional research, public reports, and university news. Include independent journalism, interviews, attributed official comments, and public institutional paperwork. Broader web discovery supplements known sources; record discovery queries and coverage gaps. Do not claim exhaustive internet coverage.

Discovery produces candidate URLs; fetch and extract actual documents before analysis. Preserve title, publisher, canonical URL, discovered-from URL, source category, publication date when known, event date when known, retrieval time, content hash, extraction method, and page/section locations. Dates can be unknown; retrieval time never substitutes for publication time.

Store immutable text snapshots and document versions, with links between versions. Deduplicate content and group syndicated reporting by originating source so copied articles cannot inflate evidence counts. Preserve provenance even when multiple URLs contain identical text.

HTML and text PDFs use existing extraction primitives where suitable. Scanned documents use the reviewed OCR path; unreadable documents receive an explicit failure state and never become fabricated evidence. Honor publisher access controls and fetch limits. A bounded, incremental queue retries failures with backoff and exposes failed jobs.

## Recurring work and costs

Run collection outside student HTTP requests. Use a persistent job queue with leases, retry counts, next-run times, and an idempotent worker. A scheduled runner wakes the worker; manual runs use the same path. Refresh sources on a configurable schedule and analyze only new or changed document versions. Record the last successful run, next due run, worker failures, discovered counts, and remaining queue work.

Remain within the existing free-tier budget. Reuse cached extraction and analysis. Start with a bounded corpus pass; explicit limits cap documents, bytes, model requests, and tokens per run. When limits are reached, save remaining work and show a partial run. Scheduling host, actual account access, and available credits must be verified before claiming continuous operation. No paid service or deployment is implied by this design.

## Analysis and evidence

Extract claims, decisions, access conditions, administrative burdens, eligibility rules, institutional commitments, and reported outcomes. Attach actors and departments only where supported by document text. Do not infer demographic identity from names or images.

Analyze related documents by topic, department, affected population when explicitly identified, and time period. Compare policy commitments with administrative requirements, decisions, and reported experiences. Identify both contradictions and recurring mechanisms such as restrictive eligibility, inaccessible procedures, unequal resource access, or uneven enforcement. Distinguish institutional statements, attributed allegations, documented decisions, and model interpretations.

An Investigator proposes findings with exact passages and document-version references. A Skeptic checks applicability, chronology, counterevidence, alternative explanations, and whether sources are independent. Code verifies every cited passage and locator against its stored version. Failed citations are rejected. Quote verification establishes what a document says; the investigation record must separately support the interpretation of those words.

Single-source leads remain useful and visible as leads. Pattern records show distinct originating sources and underlying incidents separately; five copies of one story are one lineage. Do not turn a source count into proof of discrimination. Historical records remain dated, and superseded policies cannot be presented as current without verification.

## Private investigation view

Owner authentication is enforced on server reads and writes, including background ingestion endpoints. Store public research separately from private student uploads. The engine consumes public documents and the already disclosed policy-gap records only within their existing consent rules; it does not silently ingest saved student syllabi.

Provide source coverage, collection status, failed jobs, a document/version browser, topic/department filters, and findings. A finding contains the claim, scope and dates, exact supporting passages with source links, related policy passages, independent origin counts, counterevidence, unresolved questions, and review status. Owners can mark a lead reviewed, dismiss it with a reason, or retain it for follow-up. Preserve the review history. No public publication is included.

## Delivery sequence

1. Verify reusable source/extraction/quote primitives and introduce document/version/job storage contracts.
2. Implement bounded collection, source discovery, deduplication, versioning, durable retries, and coverage reporting.
3. Add Investigator/Skeptic analysis with verified evidence and dated policy comparisons.
4. Add owner-only investigation UI and review history.
5. Configure an available free scheduled runner, verify real collection and analysis, and review the auditor for regressions.

## Acceptance evidence

- Collect representative live public UO policies, administrative paperwork, press releases, and independent reporting with interviews or attributed comments; retain actual text and provenance.
- An unchanged source reuses its version and analysis; changed content creates a new version without destroying prior evidence.
- A syndicated story does not become multiple independent confirmations.
- Invalid citations and unreadable extraction fail explicitly; malicious document instructions do not change agent rules.
- Policy applicability and historical/current distinctions survive end-to-end findings.
- A supported cross-document finding includes both sides, counterevidence checks, and traceable passages; an unsupported proposed finding is rejected or retained only as an explicit unresolved lead.
- A failed fetch retries without losing queue state; overlapping workers cannot process one lease concurrently; limits leave a resumable partial run.
- An actual scheduled run completes, a later run detects new/changed data, and the private UI reports authoritative run status. A local manual pass alone cannot satisfy continuous monitoring.
- Non-owners cannot retrieve research findings or mutate jobs; student data remains within existing consent boundaries.
- Existing auditor review checks and relevant regression tests pass before release.

## Remaining release prerequisites

Verify current provider access, free scheduler availability, storage capacity, owner authentication, and submission/model-use rules from their owning sources. Confirm the design before implementation. Merge/push/deploy remain subject to existing project instructions; no publication has occurred.

## Reuse inspection (2026-11-03)

Inspected current source files directly; these are implementation observations, not runtime verification:

- lib/policy/pairs.ts loads a fixed pair by id from POLICY_PAIRS, asks for up to five differences, and verifies both quoted passages using verifyQuote. lib/policy/pairs-types.ts registers two pairs only (syllabus requirement and attendance). This is a useful narrow comparison primitive, but does not implement discovery, ongoing collection, institutional pattern analysis, or a Skeptic pass. Its prompt deliberately excludes intent; retain its existing behavior for current callers and introduce the broader research analysis separately.
- pairs.ts splits plain text into artificial 6,000-character pages. Research citations must label these as text segments, preserving original PDF page numbers where available, so a segment is never presented as a physical page.
- document_jobs/download.py enforces bounded downloads, public destination checks, pinned TLS connections, redirect checks, and PDF signatures. It is a public-UO PDF downloader, not a general HTML/news collector. Preserve its existing caller restrictions; add an independently validated public-news/HTML collection path rather than silently widening this helper.
- document_jobs/extract.py uses isolated native PDF handling, bounded page selection, rendering limits, and Tesseract fallback. Its default maximum is 20 pages; long administrative packets require explicit ranges and coverage tracking. A partial extraction cannot be called a complete document review.
- lib/verify.ts checks exact text with whitespace normalization, rejects missing or ambiguous passages, and returns original source offsets. Its 12–500-character bounds must inform research claim schemas; longer supporting context can be retained separately with verified short evidence spans.
- Working tree at inspection contained only the untracked design document. No application files, dependencies, databases, or deployments were changed by this design work.
