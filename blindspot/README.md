# Blindspot research worker

For requirement-by-requirement status and remaining work, see the
[full-goal acceptance audit](../docs/blindspot-goal-audit.md). Runtime collection
counts and passing tests alone do not establish completion of the investigation.

This is the local collection and analysis backend, separate from the built syllabus auditor. It has a private investigation screen at `/blindspot`. The owner selected this computer for recurring execution; a quiet Windows scheduled worker is installed. Bounded internet discovery, source analysis and cross-report incident/pattern proposals are connected. A live cross-report pass completed successfully; independently verified origins and comprehensive corpus coverage remain open.

From the repository root:

```powershell
python -m blindspot.cli collect --max-jobs 3
python -m blindspot.cli import-corpus
python -m blindspot.cli status
python -m unittest discover -s tests/blindspot -v
```

The default source registry is `blindspot/sources.json`. It covers policies, the newsroom, trustee meetings/resolutions, budget reports, senate, president, research administration and an independent OPB report. Add an explicit public document URL with its category, publisher and discovery provenance. This is a starting registry, not comprehensive coverage of UO administration.

State is stored in `.blindspot/research.sqlite`, ignored by Git. Keep that directory on persistent local storage. SQLite must not be shared between hosts over a network filesystem. Do not put source databases into the public repository. No dependency installation or database service is required for HTML collection; PDF extraction uses the existing `document_jobs` runtime and limits.

The collector follows validated HTTPS redirects, rejects private network destinations, pins validated DNS addresses for TLS, and limits response bytes/time. Publisher robots rules are checked, including redirected document URLs; missing robots files allow collection, access denial blocks it, and server failures cause retries. Durable per-host intervals defer work without consuming retry attempts. It extracts HTML, native PDF and DOCX/XLSX text with source locators. Native PDF packets support up to 500 pages and two million characters in an isolated, time-bounded process. Sparse/unreadable pages are staged outside the analysis pool for owner image review. The separate document_jobs OCR-receipt import remains unconnected; local reviewed transcription is available. HTML extraction records its limits: dynamic content is not rendered.

Link discovery follows UO-hosted documents within the university domain boundary; external reporting follows relevant URLs on the same publisher. It rejects query-driven crawling, login/donation paths and common non-document media. Each source can extend two levels, each document contributes at most ten link candidates, and a pass discovers at most thirty candidates. Job keys deduplicate URLs per collection period. A separate rotating-query loop supplies broader internet candidates. Spreadsheets/Word documents remain unsupported and visible as collection failures.

## Internet discovery

```powershell
python -m blindspot.cli discover --credits-verified
python -m blindspot.cli replay-discovery
```

The recurring worker attempts at most two rotating queries per UTC day, across twelve topics: interviews/statements, trustees, aid/access, accessibility, budgets/audits, admissions, employment, complaints/responses, governance/public records, housing/support, press updates and institutional outcomes. Searches use the existing Meta web-search adapter even when Baseten performs analysis. Search and analysis share the same daily logical-call cap. Search failure or budget exhaustion does not stop ordinary collection.

Only URLs from actual tool results can enter the catalog; narrative URLs and search snippets are not finding evidence. Empty tool proof is recorded as unconfirmed rather than as a successful search with no relevant sources. Query attempts, states and result links are retained in the private screen. Cataloged sources are seeded for daily refresh and their initial collection jobs receive priority over ordinary link-crawl backlog.

Some real independent-reporting tool results contain an empty snippet. Those URLs are retained with unverified relevance rather than being silently excluded. The publisher page still needs to be fetched and its institutional connection verified. For each external document cited by a finding, code requires an exact source passage naming University of Oregon or uoregon.edu; a search query or publisher label cannot supply that connection. A short bounded institution-context passage is included alongside selected excerpts, and reviewed text spans are merged without inflating coverage counts.

`replay-discovery` reprocesses up to one hundred saved completed searches without a new provider request. It preserves the original search provenance and queues newly recognized candidates idempotently. It does not reclassify snippets as source evidence.

`import-corpus` imports top-level saved web snapshots from `data/uo-policies`, preserving original fetch dates and marking them historical. It never overwrites already observed URLs and never imports the legacy PDF/OCR subdirectory. Two HTTP-only records in the existing corpus are rejected rather than silently relabeled HTTPS. The live collection path remains HTTPS only.

Snapshots preserve each URL's content history, including reversions. Identical content shares a hash while preserving each source URL. Matching hashes show duplication, not independent confirmation. Publication dates stay unknown when absent from extracted metadata.

Each collection invocation queues at most one job per registry URL per UTC day. Repeating the command during the same day does not refetch completed jobs. Failed jobs retain errors and retry with bounded exponential backoff. Expired leases are recoverable and stale workers cannot finish reclaimed jobs. Each new document version creates an analysis job.

## Analysis and private review

```powershell
python -m blindspot.cli analyze --max-jobs 1 --credits-verified
```

Use the flag only after verifying provider credits and a limit preventing out-of-pocket charges. The owner confirmed these checks in chat before the first live engine analysis. The Python worker calls the app's existing Node Meta/Baseten adapter and loads its existing `.env.local` configuration without printing credentials. Each job has at most two logical model steps; existing Meta fallback can add a transport request. Provider and fallback provenance are retained.

All supported CLI analysis now uses a persistent daily logical-call cap (default 12, configurable with `--daily-model-calls`) and a validated-response cache keyed by instructions and supplied context. Failed attempts consume the cap. Known recorded model steps from before budgeting are added once to the usage ledger. Cached steps do not consume new calls. If the daily limit is reached between Investigator and Skeptic, the analysis job is deferred to the next UTC day and can reuse the completed Investigator response. Newly collected versions receive priority over the archived import backlog.

## Recurring execution on this computer

The owner explicitly selected local execution. The installed task starts the quiet `pythonw` service at user logon and was started immediately. It collects at most three queued documents and analyzes at most one version per ten-minute cycle, with a 12-logical-step daily model cap. This computer must remain on and the account logged in. No new hosted service or paid plan was created.

```powershell
.\scripts\blindspot-task.ps1 -Mode Status
.\scripts\blindspot-task.ps1 -Mode Preview -CreditsVerified
.\scripts\blindspot-task.ps1 -Mode Install -CreditsVerified -DailyModelCalls 12
.\scripts\blindspot-task.ps1 -Mode Restart
.\scripts\blindspot-task.ps1 -Mode Remove
```

The task name is derived from this checkout's absolute path, and the management script checks ownership/configuration before changing it. Remove stops only this owned task and preserves research data. Restart refuses an active run, reserves a brief idle window, confirms the old task stopped, then starts the same task with its existing limits. The installed service writes rotating logs to `.blindspot/monitor.log`. Run history, due times, failures and model usage persist in the private SQLite database and appear in the private screen. The task uses the current user's limited privileges. It is not a machine-wide service and does not run while signed out.

For a finite timed verification rather than installing a task:

```powershell
python -m blindspot.cli watch --max-cycles 2 --interval 10 --max-jobs 3 --daily-model-calls 4 --credits-verified
```

Do not start another watch process merely because a status read is slow. Check the exact task with `-Mode Status` and inspect run history. Singleton run leases prevent overlap; expired runs can recover after a crash. Deployment-time code changes require a controlled restart after an active cycle finishes, because the service keeps its imported modules in memory.

The Investigator compares the anchor with up to five lexically related documents, using bounded excerpts. Code verifies each 12–500-character evidence quote against supplied source portions, allowing whitespace differences only. Missing, ambiguous, unseen and invented evidence is rejected. A separate Skeptic records reasons, counterevidence search, alternative explanations and temporal limits; its citations pass the same checks. Reports preserve coverage counts and rejected-proposal counts. A policy-only summary is projected as a source observation, including legacy reports, without rewriting stored analysis history. Reviewed leads do not by themselves establish institutional discrimination or a recurring pattern.

Run the Next app locally and open `/blindspot`, then sign in using an existing app-owner account. The API verifies the user and invokes the existing `gap_report` owner check before touching research storage; user-editable profile metadata never grants access. No Supabase migration is added. The local adapter requires Python and `.blindspot/research.sqlite` on the same host as Next. `BLINDSPOT_PYTHON` can select an installed interpreter. The database is excluded from deployment tracing. A Vercel deployment without a connected worker returns a readable storage-unavailable response; hosted integration is still pending.

The screen shows source search, saved document versions and passages, investigation leads, observations, Skeptic reviews, excerpt coverage, queue failures and append-only owner review history. Owner review notes never replace the original model report. Private page state is removed on account changes/sign-out. Recent-report and review-history limits are disclosed in the screen.

## Verified locally on 2026-11-03

A network-enabled collector invocation processed three live sources with `collected: 3`, `failed: 0`. Inspection found three documents/versions, three completed collection jobs, three pending analysis jobs, and no failed jobs. Saved extracted text sizes were 46,950 characters (policy), 475 (trustees listing), and 4,927 (OPB article). These are collection results, not verified institutional findings.

The restricted shell initially failed DNS resolution. A network-enabled invocation succeeded without changing the source URLs or collection logic.

## Remaining implementation

Wider query coverage and collection quality; spreadsheets/Word and reviewed scanned PDF ingestion; deeper corpus retrieval and lineage/incident/pattern grouping; real owner access verification against the deployed database; and remaining manual/live auditor review checks. Hosted worker/storage is an optional later target; the owner selected the local computer for the current recurring worker. No deployment, merge or push has been performed by this worker work.

Additional live evidence: a discovery-enabled pass collected seven more sources and identified thirty link candidates with one request deferred and no failures. Subsequent bounded passes collected native 60-page and 24-page trustee packets and a two-page budget report. The archived web import added 398 snapshots and rejected two HTTP-only source records. These results still do not prove continuous monitoring or institutional pattern findings.

One live analysis completed two Baseten calls, rejected two unverifiable proposals and saved one supported policy observation. The current read projection correctly shows zero investigation leads and one source observation from that report. Direct Node-to-Python storage access was verified against the real 415-document worker database. Browser tests use mocked auth/research responses, so their success does not establish that the owner's live database membership has been configured.

Subsequent runtime verification: two timed cycles completed with three new logical model calls. They retained one allegation-only lead from OPB's March 2025 civil-rights investigation reporting, including UO's response and the lack of a determination in supplied text. This is not an established discrimination finding or recurring pattern. After the owner chose local activation, the scheduled task was installed, independently observed Running, and its first scheduled cycle completed with one collection, one analysis, and no job failures. The database then held 418 documents and four reports. A one-time usage migration included the two original live calls, bringing recorded model usage for that UTC day to six at the checkpoint.

Live discovery checkpoint: Meta returned nineteen actual tool results for an administration/interviews/statements query. Initially nine institutional candidates were registered. Inspection showed the independent reporting entries had empty snippets; the corrected catalog replay recovered nine more candidates without another model call, including Daily Emerald, Lookout and other publisher URLs. The catalog held eighteen candidates. After a controlled idle restart, the scheduled worker's new run recorded discovery budget deferral while continuing collection. At that checkpoint it held 427 documents and five analysis reports, with twelve model steps used that UTC day. Provider errors now retain sanitized HTTP/timeout/invalid-response codes for retry diagnostics; credentials, response bodies and document text remain excluded from logs.
# Evidence grouping (2026-11-03)

The private overview derives read-only evidence groups from its latest 100 reports.
Exact shared action quotations (whitespace normalized) collapse copied coverage and
repeated analyses into one connected group. Policy-only observations are excluded;
latest owner dismissals in the loaded 500-review history are excluded. Group members
retain report/finding references, original action quotations and source locators.
Matching mechanism labels across groups appear as comparison candidates only.
Different quotations can concern the same event: group counts are **not** incident
counts, originating-lineage counts, confirmed recurrence or proof of discrimination.
Semantic incident resolution, verified origins and reviewed pattern conclusions
remain unfinished. This projection makes no provider calls and changes no saved report.

## Cross-report incident and pattern analysis (2026-11-03)

The recurring worker now alternates due cross-report work with source analysis in
its existing research slot. When at least two active source leads exist, it saves
a bounded input snapshot (up to 100 recent reports, 24 leads, 64 exact citations,
60,000 encoded characters). Source hashes and text offsets are revalidated;
nearby source context, prior objections and the latest owner review are included.
Whole omitted leads and coverage limits are disclosed. Policy observations and
owner-dismissed leads are excluded. No student uploads are consumed.

An Investigator proposes underlying incidents and recurring mechanisms using
only supplied evidence IDs. A separate Skeptic challenges incident identity,
duplicate coverage, allegations versus outcomes, policy applicability, chronology
and alternative explanations. Code rejects invented references, shared action
passages split into multiple incidents, unsupported policy-gap references and
patterns whose incidents were rejected. Unresolved source leads and incidents
propagate uncertainty to the pattern. These are private investigation leads;
originating-lineage independence and publication eligibility are never inferred.

Inputs, reports and model provenance are retained atomically behind fenced job
leases. Both model steps share the existing 12-step UTC daily cap and cache.
A budget-deferred Skeptic resumes against the same input without repeating its
Investigator call. Failed responses remain retryable. A changed source-lead or
owner-review selection marks an older synthesis as a historical snapshot.
The private screen exposes claims, incident membership, exact citations, source
context, chronology, objections and omitted-input counts.

Manual bounded command: `python -m blindspot.cli synthesize --credits-verified`.
It does not raise the daily budget. The first real job was queued from two saved
leads with 13 revalidated passages and deferred at the existing 12-step cap;
no additional model request occurred. A guarded idle reload activated the new
worker code. Its PowerShell guard now passes Python via stdin to preserve quotes
under Windows PowerShell. Live completion of this new model contract remains
unverified until budget becomes available. Office/scanned coverage, origin
verification, deeper retrieval and manual/live auditor review remain open.

## Native Office documents (2026-11-03)

Collection now reads public DOCX and XLSX packages in an isolated, 30-second
subprocess using Python's standard library. No Office application, formula engine,
macro or embedded file is executed, and external relationships are never fetched.
Archive limits: 20 MB source and expanded content, 2,000 members, 16 MB per XML
part, 200:1 member expansion; no encryption, unsafe paths, duplicate parts, DTDs,
entity declarations or VBA packages. Text is limited to four million characters,
50,000 locations, 100 sheets and 250,000 cells. Inputs outside these limits fail
explicitly. Older binary DOC/XLS formats are unsupported.

Word preserves body paragraphs, table rows, referenced headers/footers and notes.
Deleted/hidden runs, comments, images, layout and field instructions are excluded;
stored field-result text is not recalculated. XLSX stores raw values with sheet,
row and cell references. Cached formula values may be stale; missing cached values
are counted, never invented. Number/date/percent formats and merged-cell layout
are not rendered. Hidden sheets/rows are flagged; hidden columns, charts, comments,
external workbook data and formula dependencies are not reconstructed. These
limits accompany source context and research prompts, so stored values do not
silently become interpreted amounts, percentages or current outcomes.

Office locators propagate through quote verification and the private source view;
they are never labeled as physical PDF pages. Only locations intersecting displayed
or model-supplied text are projected, with a 6,000-character metadata allowance and
visible omission counts. Source browsing supports offsets through four million
characters while each response still returns at most 10,000 text characters.

Live verification collected the UO faculty onboarding checklist DOCX (2,785
characters, 20 locations), FY27 PD03 operating-budget XLSX (1,535,104 characters,
8,662 row locations), and FY26 PD12 XLSX (2,420,818 characters, 13,044 locations).
The two budget files first exposed the smaller initial extraction limits; their
actual sizes informed the bounded allowances above, then normal robot-checked
collection succeeded. Originals were linked by the UO HR and Budget Reports pages.
The registry now refreshes all three. Node-to-Python access opened the final 10,000
characters of the FY26 snapshot; model contexts measured about 56,000 characters.
The private database held 438 documents, with model usage unchanged at 12. No
Office-derived institutional conclusion has been verified. The owned worker was
reloaded through its idle guard and observed Running. Reviewed scanned-document
admission, live synthesis completion, origin verification and remaining auditor
review checks are still open.

## Image-backed source review (2026-11-03)

PDFs with unreadable/sparse native pages now enter a private review queue instead
of repeated extraction failures. Their original bytes are retained by SHA-256
under `.blindspot/scans/`; staged text never enters research analysis. Recrawling
unchanged bytes reuses the source record. Collection reports `review_pending`
separately from readable documents and failures.

The owner-only screen renders one physical page locally, in a bounded subprocess,
and displays the source image with page and source links. PNGs are limited to
2 MB/16 million pixels and served through the authenticated, no-store research
endpoint. Saved PDF and page-image hashes are checked before each review. The
owner enters an exact 40–500-character passage, specifies its image region, and
explicitly confirms comparison including qualifications and exceptions. The
reviewer comes from verified server authentication; a browser-supplied actor is
ignored. Local Tesseract is unavailable, so this path uses owner transcription;
automated OCR/Modal remains inactive and governed by its existing separate gates.

Approval atomically appends a receipt, creates a partial-source snapshot containing
only reviewed passages, and queues analysis. Receipts retain the PDF/image hashes,
physical page, region, reviewer and review time. Duplicate submissions reuse their
receipt and snapshot. Failed admission rolls back all changes. Multiple fragments
are explicitly partial; quote verification and synthesis revalidation reject spans
crossing their gaps. Snapshot/version history remains intact. This is an owner
attestation of source text, not automatic OCR validation or a substantive finding.

Live verification fetched the three-page UO encampment resolution agreement from
the university's public site. All three pages needed image review. Collection
staged the PDF with no failure or analysis job; the first page rendered legibly at
1224×1584 and was verified through the existing Node-to-Python bridge. The actual
source has zero approved passages. Its refresh URL is in the source registry.
The existing document_jobs approval/admission workflow remains separate; no prior
receipt or policy-reference selection was changed by this increment. Actual owner
approval and live analysis of a reviewed scan remain unverified.

## Owner-review changes and queued pattern work

Queued pattern inputs are immutable snapshots. When selected leads or owner
reviews change, pending jobs with an old input hash become `superseded`; their
payloads remain available for inspection. A current snapshot gets a new work key.
If fewer than two active leads remain, stale pending work is retired without
making a replacement model request. Unchanged budget-deferred work retains its
due time and cached Investigator result.

Active leases remain untouched. A runner revalidates its selected input before
each model step and before saving. If input changed, it retires its own fenced
claim and discards the obsolete result. An already active provider request cannot
be undone; its reserved model step still counts. Superseded jobs are excluded from
actionable queue counts. Expired stale claims can be superseded; stale workers
remain unable to complete through a newer lease.

The real queue's older pre-update snapshot was superseded and replaced with one
current pending job. The bounded verification command deferred at the existing
12-step daily cap without another model call. The guarded worker reload activated
the updated lifecycle while preserving its schedule and cap.

## Live cross-report verification and owner gate (2026-11-03)

The owner explicitly authorized two extra logical model steps once, keeping the
scheduled worker at 12/day. A bounded pass completed Investigator and Skeptic via
Baseten with exactly two uncached steps and no fallback. Recorded UTC-day usage
went from 12 to 14; the actual registered task arguments still specify
`--daily-model-calls 12`. The temporary idle-window reservation was restored.

The saved synthesis considered five source reports, selecting two active leads
and 13 source passages with no input-limit omissions or locator failures. It
retained two private incident proposals: an undated committee-membership procedure
and a historical investigation allegation. It proposed zero recurring patterns.
These are model-reviewed leads, not owner-confirmed institutional findings. The
absence of a pattern proposal from these excerpts does not establish absence of
discrimination or inequality. The stored input matches the current selection.
All 13 citations were independently rechecked after storage against their original
version text, content hash and exact offsets. No scanned passage was admitted.

The live Supabase owner membership and RPC gate were also verified with count-only,
transaction-local claim probes: owner context returned the expected array,
non-owner context raised `not allowed`, and anonymous execution lacks a grant.
Actual owner browser/JWT sign-in remains a separate check. See
[the verification record](../docs/blindspot-owner-verification.md) for scope and
existing advisor notices, including disabled leaked-password protection. No
database permission, auth setting, schema or user record was changed.

## Source availability and coverage

The owner screen now shows latest-URL intake counts, historical snapshots and
headline-only extraction gaps. Heading-only HTML is retained for inspection but
excluded from source analysis and cross-report evidence. Text availability does
not establish document completeness or claim support. Daily Emerald article-body
selection removes unrelated page sidebars; original versions remain stored.
The registry now has 30 source URLs, including office entry pages, direct official
budget statements and presidential/provost update indexes. See the [coverage checkpoint](../docs/blindspot-coverage-audit.md)
for bounded live checks and unresolved collection limits.

Source context now uses corpus-frequency and length-normalized lexical ranking
instead of raw shared-word counts. It collapses exact copies with the same
reviewed ranges, excludes unapproved scan text from ranking, preserves original
passage offsets, and records candidate/omission counts. The five-related-document
limit remains. See the [retrieval review](../docs/blindspot-retrieval-review.md)
for an actual before/after example and remaining vocabulary/applicability limits.

Persistent collection failures retain their last error and remain retryable, but
their exponential delay can grow to 24 hours instead of repeatedly consuming a
collection slot every hour. The initial delays remain 30, 60 and 120 seconds;
the daily ceiling is reached after repeated failures. Analysis retry timing and
the model budget are unchanged. Publisher restrictions are still respected on
every attempt; a delayed retry does not bypass robots or access controls.

Repeated parent-page discovery now uses durable collection history: active URLs
are skipped, unseen URLs come first, then previously scheduled URLs rotate in
oldest-job order. This advances beyond a page's first ten links without increasing
the per-document, per-pass or depth limits. Old completed URLs remain eligible
for later refresh; pending failures retain their existing backoff. Rotation
improves coverage but does not establish that every administrative document has
been found.

Document paths ending in PDF, DOCX or XLSX now use the same 20 MB download ceiling
as the native readers. Other paths remain limited to 5 MB; extensionless download
URLs can therefore still hit that smaller limit. Extensions are download hints,
not format verification: bytes, native extraction limits, redirect/DNS checks and
robots restrictions still apply. A real 9,608,355-byte Spanish injury notice was
downloaded and staged for image-backed review, not admitted as analyzed text.

Curated sources can specify an `analysis_priority` integer from 0 to 100. Seeding
raises pending analysis for that URL's latest saved version without changing its
budget due time, attempts or active leases. Fresh collection uses the same
priority; discovered child links do not inherit it. Other sources retain the
default priority and remain queued. The registry now includes three direct
sources prioritized for their administrative substance: budget-cut reporting,
donation reporting and the workplace-accommodation process. Priority does not
label wrongdoing, establish policy applicability or grant extra model steps.

New source reports can carry department/office scope in schema version 3. Each
name must occur verbatim with word boundaries in one of that finding's verified
passages, with only whitespace normalization. Invalid labels are omitted and counted;
labels are checked before the Skeptic reviews attribution. Quoted names establish
textual scope, not responsibility, policy applicability or discrimination.
The private screen filters findings/observations by recorded unit or Not recorded
and opens the supporting passage. Legacy reports remain unchanged and have no
department scope inferred from their titles, URLs or claims. Live populated
scope output awaits future analysis within the normal model budget.

## Owner originating-source review

The private screen can compare two passages from a saved cross-report analysis
and append a shared-origin, different-origin or unresolved assessment with a
reason. The server supplies the verified owner identity; both passages are
rechecked against immutable source text/hash/offsets and retained as receipts.
Revising a pair appends history instead of overwriting it. Identical passages
cannot establish different origins; contradictory shared-origin chains are shown.

These are owner assessments, not certified independent support. The independent
origin count stays unknown and publication eligibility stays false. The latest
200 pair assessments for selected evidence can enter future Investigator/Skeptic
context within the existing 60,000-character bound; omitted reviews are counted.
Notes are untrusted input, not model instructions. Changes invalidate the current
input hash and follow the existing deferred/superseded-job lifecycle and model
cap. Saving a review itself does not call a model; scheduled work handles any
reanalysis. With no recorded origin
reviews, prior input hashes remain unchanged.

The new local `origin_reviews` table is created on opening worker storage;
existing research records remain intact. No Supabase schema or permission change
is required. Real owner lineage assessments and live consumption by the model
remain unverified; no such assessment has been invented for the real corpus.

## OregonNews embedded story bodies

Some OregonNews pages contain a headline and a Shorthand embed rather than the
article body. The extractor recognizes up to five explicit body-script references
to `university-of-oregon-news.shorthandstories.com/.../embed.js` on the exact
`news.uoregon.edu` host. It derives the public story URL and queues it through
ordinary scope, depth, count, robots, DNS/TLS, redirect and byte checks. Scripts
are never executed by the worker. Other external scripts and hosts are excluded.

The headline snapshot remains incomplete; the separately fetched full story
retains `embedded_from` provenance. Publisher grouping collapses the known story
and parent into the UO group, and synthesis context preserves that relationship.
It is not independent corroboration. A live Fulbright story yielded 11,118
characters using this path, without cached search text or a model request.
