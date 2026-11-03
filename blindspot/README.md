# Blindspot research worker

This is the local collection and analysis backend, separate from the built syllabus auditor. It has a private investigation screen at `/blindspot`. The owner selected this computer for recurring execution; a quiet Windows scheduled worker is installed. Bounded recurring internet discovery is connected; deeper incident/lineage/pattern aggregation remains unfinished.

From the repository root:

```powershell
python -m blindspot.cli collect --max-jobs 3
python -m blindspot.cli import-corpus
python -m blindspot.cli status
python -m unittest discover -s tests/blindspot -v
```

The default source registry is `blindspot/sources.json`. It covers policies, the newsroom, trustee meetings/resolutions, budget reports, senate, president, research administration and an independent OPB report. Add an explicit public document URL with its category, publisher and discovery provenance. This is a starting registry, not comprehensive coverage of UO administration.

State is stored in `.blindspot/research.sqlite`, ignored by Git. Keep that directory on persistent local storage. SQLite must not be shared between hosts over a network filesystem. Do not put source databases into the public repository. No dependency installation or database service is required for HTML collection; PDF extraction uses the existing `document_jobs` runtime and limits.

The collector follows validated HTTPS redirects, rejects private network destinations, pins validated DNS addresses for TLS, and limits response bytes/time. Publisher robots rules are checked, including redirected document URLs; missing robots files allow collection, access denial blocks it, and server failures cause retries. Durable per-host intervals defer work without consuming retry attempts. It extracts HTML or native PDF text, retaining physical PDF page numbers. Native administrative packets support up to 500 pages and two million characters in an isolated, time-bounded process. Pages needing OCR or blank-page confirmation fail explicitly. The existing reviewed OCR workflow is not yet connected to research imports. HTML extraction records its limits: dynamic content is not rendered.

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
