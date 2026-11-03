# Blindspot Engine Implementation Plan

> Execute inline with superpowers:executing-plans. Preserve the built auditor.

**Goal:** Collect public UO administrative documents and reporting continuously, then expose evidence-backed institutional investigations privately.

**Architecture:** Independent Python worker with SQLite document/version/job state, bounded public web collection, and model-assisted verified analysis. The existing Next.js app supplies owner access; select a verified free scheduler and durable hosting before release.

**Tech Stack:** Python standard library for storage and queue; existing extraction/provider tools where compatible; Next.js and current owner authentication for UI.

**Spec:** docs/blindspot-engine-design.md

## Global constraints

- Free tiers only; no paid calls, publication, or deployment without applicable authorization.
- Preserve existing auditor behavior and consent boundaries.
- Exact evidence spans, explicit extraction failures, durable retries, independent source provenance.

## Review focus

- Concurrent workers and expired leases must never let a stale worker complete another worker's job.
- Identical text from different URLs must retain both provenance records without claiming independence.
- A source reverting to old content must preserve the intervening history.
- Missing dates must remain unknown.
- Failed or partial collection must remain visible and resumable.

## Task 1: Durable research state

Files: blindspot/store.py, blindspot/__init__.py, tests/blindspot/test_store.py.
Interfaces: Store(path); snapshot(url, text, metadata, now) returns immutable version id; enqueue(kind, key, payload, due) returns job id; claim(now, lease_seconds) returns leased job; finish(id, token, now, error=None) checks ownership and persists retries.

- [x] Write tests for unchanged/changed/reverted text, duplicate origin provenance, restart persistence, concurrent leases, expiration, stale completion, retry backoff.
- [x] Run `python -m unittest discover -s tests/blindspot -v` and observe missing implementation failure.
- [x] Implement SQLite transactions, immutable snapshots, per-URL observations, and leased jobs.
- [x] Re-run tests; record results in this plan.

## Task 2: Collection worker

Files: blindspot/fetch.py, blindspot/collect.py, blindspot/cli.py, tests/blindspot/test_collect.py.
Interfaces: fetch_public(url) returns bounded bytes and final URL; extract_document returns text, title, links and extraction coverage; run_once(store, limits) records snapshots and pending analysis.

- [ ] Test public destination validation on redirects, HTML extraction, provenance, incremental links, PDF coverage failures and queue recovery.
- [ ] Implement bounded fetch, discovery from a source registry, and local corpus import without widening existing UO download permissions.
- [ ] Verify a representative live collection with saved provenance and explicit coverage gaps.

## Task 3: Analysis

Files: blindspot/analyze.py, blindspot/evidence.py, tests/blindspot/test_analysis.py.
- [ ] Test invented quotes, prompt injection, chronology, syndication, counterevidence and rejected findings.
- [ ] Implement Investigator/Skeptic analysis with immutable version evidence, topic grouping, explicit uncertainty and review history.
- [ ] Verify supported and rejected cross-document findings end to end.

## Task 4: Private application integration

Files: owner research server routes, research page and components, targeted E2E tests; exact paths chosen after reading current auth contracts.
- [ ] Test non-owner denial, source browser, findings and run status.
- [ ] Implement owner-only read/review flows without importing student uploads.
- [ ] Verify user-visible evidence locators and error states.

## Task 5: Continuous operation and release checks

- [ ] Verify current provider and hackathon terms, available free hosting, durable volume and scheduler.
- [ ] Configure bounded recurring jobs; prove two scheduled runs with change detection.
- [ ] Run auditor review checks and regressions. Record remaining release gaps; never label a local pass continuous operation.

## Execution record

- 2026-11-03: Owner selected extending the app. Automatic goal continuation was incorrectly treated as design approval; corrected after owner objection. Owner subsequently explicitly said "ok yes continue". Proceeding on that authorization. No merge, push or deployment authorized by this plan.
- Ruling: local SQLite is the worker's initial persistence backend, avoiding a migration or paid infrastructure while contracts stabilize. Production durable hosting and app transport remain required deliverables.
- Task 1: seven initial storage tests observed failing before implementation, then passing. Collection and worker tests also observed failing before their modules existed, then passing.
- Task 2 partial: bounded HTTPS/HTML/native PDF extraction and queue runner implemented. Partial PDFs and unreviewed OCR are rejected. Initial three-source registry only; discovery and robots handling are not implemented and no crawler is scheduled.
- Live evidence: restricted shell DNS failed for all three sources; a network-enabled `python -m blindspot.cli collect --max-jobs 3` then collected all three. Stored state inspected: 3 documents, 3 versions, 3 completed collection jobs, 3 pending analysis jobs, no errors. No model request occurred. See blindspot/README.md for details and remaining scope.
- Task 2 continued: added tested publisher robots handling, persistent host request intervals, bounded two-level discovery, dated web-corpus import and isolated long native PDF extraction. New tests were observed failing before each implementation. Registry expanded from three to ten sources. Actual collection verified 60-page and 24-page trustee PDFs plus budget paperwork. Archived import added 398 records; two HTTP records rejected. General internet discovery, office documents and reviewed OCR imports remain open; Task 2 is not marked complete.
- Task 3 partial: exact research passage verification, bounded lexical context retrieval, Investigator/Skeptic passes, conservative publisher/content grouping, historical/undated labels, fenced report persistence and the existing-provider bridge are implemented. Owner explicitly confirmed model credits/spending limits. A bounded live analysis completed two Baseten calls; two proposals failed citation checks and one policy observation survived. Policy-only observations are separated from actionable leads, including legacy read projections; original saved reports remain intact. General incident/pattern aggregation and stronger full-corpus coverage remain open.
- Task 4 local implementation: private `/blindspot` page and `/api/research` owner gate, local Python storage adapter, document/version browser, evidence context, status/coverage/error views and append-only owner reviews. Owner lookup uses authenticated `getUser` plus existing `gap_report` RPC; metadata cannot grant ownership. No migration or live account mutation occurred. The Supabase connector requires an unavailable link_id, so live owner membership remains unverified. Direct app adapter read against actual worker state verified 415 documents and one report/observation.
- Build fixes: Cache Components disallows `runtime`/`dynamic` route flags; removed them and used request-time `connection()` before private GET handling. Turbopack tracing explicitly excludes the local worker executable and database. Restricted-shell static output creation failed with EPERM; normal-permission browser runs built successfully. Browser assertions were corrected to scope the alert away from Next's route announcer and preserve existing logout navigation to `/`.
- Verification checkpoint: 49 Python engine tests, 10 Node research/provider tests, typecheck and changed-file lint passed. Production-build browser run passed all 3 private research checks plus all 3 existing sign-out checks. A final research-only run also passed after extending source-library navigation coverage. Browser auth/data were mocked; the direct local storage bridge used the real database. No owner review was inserted into live research state by these tests. No scheduler or deployment has been started.
- Recurrence implementation: monitor leases, persisted run history, crash recovery, ten-minute wakeups, daily logical-call accounting and validated-response caching. Budget exhaustion defers unfinished analysis until the next UTC day and reuses successful prior steps. Legacy live calls are migrated into usage once. New live versions outrank the archived backlog without losing pending work during the SQLite schema upgrade.
- Owner decision: asked where to activate the ready worker; owner selected "This computer: $0, ready now; it must stay on with you logged in". Prepared/previewed an owned-task installer, then installed the limited-user quiet Windows task with twelve logical model steps per day and ten-minute cycles. The task was independently checked Running, and scheduled run 3 completed successfully. Two earlier finite verification cycles also completed; those used three fresh model calls and retained one allegation-only lead. No permanent hosted service was created.
- Run checkpoint: 418 documents, four analysis reports, one completed installed scheduled cycle plus two completed timed verification cycles. Six logical model steps recorded that UTC day, including the two pre-budget calls migrated once. One historical OPB allegation lead is not treated as a determined outcome or recurring pattern.
- Regression checkpoint: all 238 Node tests and all 40 browser tests passed, including the existing auditor flows and the new monitor-status view. The full browser run included a successful production build. Existing document/OCR Python suite passed all 20 tests. Remaining front-end review work is manual/live verification, not these automated checks. Broader discovery, office/scanned documents, deeper coverage and pattern/incident grouping remain open.
- Final local recurrence checks: all 59 engine Python tests passed (79 total with existing document/OCR tests), including restart-persistent limits, legacy-call migration, cached Investigator resume, stale-run fencing and archive/live queue priority upgrades. Typecheck and changed-file lint were clean. Work is preserved on local `feat/blindspot-engine`; nothing is pushed. Ruling: retain the current checkout path for the owner-selected running worker rather than moving state to a new worktree; use the feature branch for Git isolation.
- Broader discovery: added a Meta-only search bridge, twelve rotating query topics, two-attempt daily ceiling shared with the existing model budget, durable query history and a refreshable candidate catalog. Search results are fetched before analysis; snippets/narrative are never evidence. Actual tool results confirmed one live query with nineteen hits. Empty snippets initially excluded nine independent-reporting URLs; replaying saved results through the corrected catalog registered those without another request, giving eighteen candidates. Candidate collection receives priority over ordinary crawl backlog.
- Source-scope checks: external finding evidence must quote the University of Oregon connection from the document itself. Context retrieval includes a short institution passage and merges reviewed spans to keep coverage accurate. Safe diagnostic codes now distinguish provider HTTP/timeouts from malformed research responses without logging raw bodies or keys.
- Recurring integration: search failures do not stop collection/analysis; new catalog entries feed following cycles. The owned task was deliberately reloaded during a verified idle window to activate discovery. Actual run 8 recorded search/analysis budget deferral while collecting two more documents, reaching 427 documents/five reports. The 12-step daily cap was honored, not raised. Further provider work awaits the normal UTC reset. Restart management preserves the existing task arguments and refuses active-cycle interruption.
- Discovery verification: all 70 engine Python tests and all 241 Node tests passed. The three private-research browser tests passed with the query-history view and a successful production build. Typecheck and changed-file lint passed. The new tests cover empty-snippet reporting, no-call replay, daily query limits, collection/analysis continuing after search failure, external institutional scope, bounded scope context, and sanitized provider diagnostics. Office/scanned formats and incident/pattern grouping remain unfinished.
# Evidence-group triage increment (2026-11-03)

Added read-only grouping of exact shared action quotations across recent reports,
with transitive deduplication, dismissal handling and stable content-derived IDs.
The private view exposes saved context and repeated mechanism-label candidates.
This is a triage layer, not completed incident identity or pattern verification:
different passages may concern the same event, and allegations remain allegations.
The current local database projection returned 435 documents, five reports, two
evidence groups and zero repeated mechanism candidates without provider requests.
Original reports and owner review history are preserved. Independent origins,
semantic incident resolution and reviewed pattern conclusions remain open.
Verification: 74 engine Python tests and three private-research browser tests
passed, including opening saved context from the new grouping view. Production
build, TypeScript and changed-file lint passed. The restricted browser build first
failed with a filesystem EPERM; its authorized rerun passed. No provider call,
budget increase, worker restart, push or deployment was needed for this increment.

## Cross-report research increment (2026-11-03)

- Added durable incident/pattern Investigator and separate Skeptic passes, bounded
  and revalidated inputs, evidence-reference checks, duplicate-action rejection,
  policy-gap evidence requirements, uncertainty propagation, immutable results,
  cached budget resumption and stale-input detection after owner reviews.
- Recurring cycles give a due pattern job the research slot before another source
  analysis. Collection and Meta discovery retain their existing paths and limits.
  Source reports and pattern reports are counted separately in private run history.
- The owner screen shows incident summaries/basis, pattern proposals, exact saved
  citations, alternative explanations, chronology, source-lead references and
  coverage omissions. No automatic publication or independent-origin certification.
- Verification: 86 engine Python tests, 13 targeted Node tests and three private
  browser tests passed; the browser run built production successfully. Typecheck
  and changed-file lint passed. Fixtures verify semantics, fencing, stale reviews,
  bounded Unicode contexts, bad references, duplicate splits, Skeptic rejection,
  policy-gap requirements and next-day cached resumption.
- Real state: two active source leads, 13 revalidated passages; one synthesis job
  queued and budget-deferred with usage still 12. Live model output for this new
  contract is not yet verified. The owned task was successfully reloaded through
  its idle guard and observed Running; a legacy PowerShell -c quoting failure was
  fixed by piping the guard through stdin. No push/deploy/budget increase occurred.
- Remaining: live synthesis completion, reviewed originating lineages and incident
  identity, broader Office/scanned coverage, deeper corpus retrieval, actual owner
  database access and the remaining manual/live auditor checks.

## Native Office coverage increment (2026-11-03)

- Added isolated, bounded DOCX/XLSX native extraction without dependencies. Word
  paragraphs/table rows and referenced notes/headers retain locations; deleted and
  hidden runs are excluded. Spreadsheet stored values retain sheet/row/cell IDs,
  hidden sheet/row flags, formula provenance and missing-cache counts. No formulas
  or macros run; unsupported layout and formatting are disclosed.
- Quote verification, analysis contexts and owner source/citation views preserve
  native locators. Context-only projections cap metadata, disclose omissions and
  avoid exposing whole-workbook metadata. Browsing now accepts offsets through
  four million characters, still returning only a 10,000-character window.
- Real collection: UO onboarding DOCX 2,785 characters/20 locations; FY27 PD03 XLSX
  1,535,104/8,662; FY26 PD12 XLSX 2,420,818/13,044. Public landing-page links were
  verified before robots-checked collection. Initial workbook failures identified
  the actual XML/text/cell sizes; bounded limits were adjusted and both jobs then
  completed. The files' expanded packages remain below the unchanged 20 MB cap.
- Real late-window reads and lexical research contexts succeeded; Office contexts
  were under 56,000 characters. The Node bridge opened version 438 past 2.4 million
  characters within its existing timeout/output bounds. Model usage stayed at 12,
  no inference was requested, and all three sources entered the refresh registry.
- Verification includes native fixture extraction, exact locators, shared strings,
  sparse cells, cached/missing formula values, referenced exception notes/headers,
  external-part refusal, malformed/oversized/macro/entity packages, bounded metadata
  and large-window API behavior. Three private browser tests passed with formula
  warnings; production build, typecheck and changed-file lint passed. Fourteen
  targeted Node tests passed. The owned worker was guardedly reloaded and Running.
- The final full engine suite passed all 95 tests after the header/footnote and
  UTF-16 entity/macro rejection cases were added.
- Still open: reviewed scanned-document admission, live new synthesis contract,
  originating lineages, deeper retrieval, real owner database access and remaining
  manual/live auditor checks. No merge, push or deployment occurred.
