# Blindspot research worker

This is the local collection and analysis backend, separate from the built syllabus auditor. It has a private investigation screen at `/blindspot`. The owner selected this computer for recurring execution; a quiet Windows scheduled worker is installed and its first background cycle has completed. Broader web discovery and recurring-pattern aggregation are still unfinished.

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

Link discovery follows UO-hosted documents within the university domain boundary; external reporting follows relevant URLs on the same publisher. It rejects query-driven crawling, login/donation paths and common non-document media. Each source can extend two levels, each document contributes at most ten link candidates, and a pass discovers at most thirty candidates. Job keys deduplicate URLs per collection period. Discovery does not yet include general internet search or spreadsheets/Word documents; unsupported files remain visible as collection failures.

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
.\scripts\blindspot-task.ps1 -Mode Remove
```

The task name is derived from this checkout's absolute path, and the management script checks ownership/configuration before changing it. Remove stops only this owned task and preserves research data. The installed service writes rotating logs to `.blindspot/monitor.log`. Run history, due times, failures and model usage persist in the private SQLite database and appear in the private screen. The task uses the current user's limited privileges. It is not a machine-wide service and does not run while signed out.

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

General web/news search and broader source registry; spreadsheets/Word and reviewed scanned PDF ingestion; deeper corpus retrieval and lineage/incident/pattern grouping; real owner access verification against the deployed database; and remaining manual/live auditor review checks. Hosted worker/storage is an optional later target; the owner selected the local computer for the current recurring worker. No deployment, merge or push has been performed by this worker work.

Additional live evidence: a discovery-enabled pass collected seven more sources and identified thirty link candidates with one request deferred and no failures. Subsequent bounded passes collected native 60-page and 24-page trustee packets and a two-page budget report. The archived web import added 398 snapshots and rejected two HTTP-only source records. These results still do not prove continuous monitoring or institutional pattern findings.

One live analysis completed two Baseten calls, rejected two unverifiable proposals and saved one supported policy observation. The current read projection correctly shows zero investigation leads and one source observation from that report. Direct Node-to-Python storage access was verified against the real 415-document worker database. Browser tests use mocked auth/research responses, so their success does not establish that the owner's live database membership has been configured.

Subsequent runtime verification: two timed cycles completed with three new logical model calls. They retained one allegation-only lead from OPB's March 2025 civil-rights investigation reporting, including UO's response and the lack of a determination in supplied text. This is not an established discrimination finding or recurring pattern. After the owner chose local activation, the scheduled task was installed, independently observed Running, and its first scheduled cycle completed with one collection, one analysis, and no job failures. The database then held 418 documents and four reports. A one-time usage migration included the two original live calls, bringing recorded model usage for that UTC day to six at the checkpoint.
