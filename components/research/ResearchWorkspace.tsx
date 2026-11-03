"use client";

import { useEffect, useRef, useState } from "react";
import { researchRequest } from "@/lib/research/client";
import type { ResearchOverview, ResearchSource } from "@/lib/research/types";
import FindingCard from "./FindingCard";
import SourceViewer from "./SourceViewer";
import PatternSummary from "./PatternSummary";
import SynthesisSummary from "./SynthesisSummary";
import ScanReview from "./ScanReview";
import SourceCoverage from "./SourceCoverage";

export default function ResearchWorkspace() {
  const [data, setData] = useState<ResearchOverview | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"findings" | "observations" | "sources">("findings");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [sourceSearch, setSourceSearch] = useState("");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [source, setSource] = useState<ResearchSource | null>(null);
  const [sourceBusy, setSourceBusy] = useState(false);
  const sourceRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    researchRequest<ResearchOverview>(`/api/research?page=${page}&search=${encodeURIComponent(sourceSearch)}`, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) { setData(result); setError(""); } })
      .catch((error) => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Private research could not be loaded."); });
    return () => controller.abort();
  }, [page, sourceSearch, refresh]);
  useEffect(() => () => sourceRequest.current?.abort(), []);
  async function open(version: number, start = 0) {
    sourceRequest.current?.abort();
    const controller = new AbortController();
    sourceRequest.current = controller;
    setSourceBusy(true);
    try {
      const result = await researchRequest<ResearchSource>(`/api/research?version=${version}&start=${start}`, { signal: controller.signal });
      if (!controller.signal.aborted) setSource(result);
    } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Saved source could not be loaded."); }
    finally { if (!controller.signal.aborted) setSourceBusy(false); }
  }
  if (!data) return <>{error ? <p role="alert">{error}</p> : <p role="status">Loading private research…</p>}<button onClick={() => setRefresh((value) => value + 1)}>Try again</button></>;
  const findings = data.reports.flatMap((record) => record.report.findings.map((finding) => ({ record, finding })));
  const observations = data.reports.flatMap((record) => record.report.observations.map((finding) => ({ record, finding })));
  const departments = [...new Set([...findings, ...observations].flatMap(({ finding }) => finding.departments?.map((item) => item.name) || []))].sort();
  const visible = (tab === "observations" ? observations : findings).filter(({ finding }) => `${finding.claim} ${finding.topic} ${finding.mechanism}`.toLowerCase().includes(search.toLowerCase()) && (!department || (department === "unrecorded" ? !finding.departments?.length : finding.departments?.some((item) => `unit:${item.name}` === department))));
  const pending = (kind: string) => data.status.jobs.filter((job) => job.kind === kind && (job.state === "pending" || job.state === "running")).reduce((total, job) => total + job.count, 0);
  const monitor = data.status.monitor;
  const lastRun = monitor?.runs[0];
  return <>
    <p><strong>{data.status.documents} documents</strong> · {data.status.versions} saved versions · {data.status.analysis_reports} analysis report(s)</p>
    <p>Collection queue: {pending("collect")} · Analysis queue: {pending("analyze")} · Pattern queue: {pending("synthesize")}</p>
    <p className="muted">{lastRun?.runner === "scheduled" ? `Recurring worker last reported ${lastRun.state} at ${new Date((lastRun.finished_at || lastRun.started_at) * 1000).toLocaleString()}. Next planned check: ${monitor?.schedule ? new Date(monitor.schedule.next_due * 1000).toLocaleString() : "unknown"}. The worker host must remain running.` : lastRun?.runner === "verification" ? "Timed worker verification recorded; permanent scheduling is not installed." : "Manual worker collection. Continuous scheduling is not configured."} Last completed analysis: {data.status.latest_analysis_at ? new Date(data.status.latest_analysis_at * 1000).toLocaleString() : "none"}.</p>
    {monitor && monitor.runs.length > 0 && <details><summary>Worker run history and model usage</summary><ul>{monitor.runs.map((run) => <li key={run.id}>Run {run.id}: {run.state} · {run.runner} · {new Date(run.started_at * 1000).toLocaleString()} · {run.collection?.collected || 0} document(s) collected · {run.collection?.review_pending || 0} PDF(s) staged for source review · {run.analysis?.completed || 0} source analysis report(s) · {run.analysis?.pattern_completed || 0} cross-report analysis report(s){run.analysis?.budget_deferred ? " · analysis deferred at daily call limit" : ""}{run.error && <p>{run.error}</p>}</li>)}</ul><p>Logical model steps by UTC day: {monitor.model_usage.map((usage) => `${usage.day}: ${usage.calls}`).join("; ") || "none recorded"}. Provider fallback can add an API request.</p></details>}
    {data.status.discovery && <details><summary>Internet discovery ({data.status.discovery.registered_sources} candidate URLs)</summary><p>Search results are queued for document collection. They become evidence only after source text is fetched and its passages verified. Queries rotate across administration, independent reporting, access, finance, employment and governance; two search attempts per UTC day share the existing model-step cap.</p><ul>{data.status.discovery.queries.map((query) => <li key={query.id}><p>{query.day} · {query.query} · {query.state} · {query.result_count} tool result(s)</p>{query.error && <p>{query.error}</p>}{query.result_urls.length > 0 && <details><summary>Tool result links: relevance and full text require verification</summary><ul>{query.result_urls.map((url, index) => <li key={`${url}:${index}`}><a href={url} target="_blank" rel="noopener noreferrer">{url}</a></li>)}</ul></details>}</li>)}</ul></details>}
    <button onClick={() => setRefresh((value) => value + 1)}>Refresh status</button>
    {data.patterns && <PatternSummary patterns={data.patterns} open={open} />}
    {data.synthesis ? <SynthesisSummary synthesis={data.synthesis} open={open} /> : <p>Cross-report incident analysis has not completed yet. It uses the same daily model budget as source analysis and discovery.</p>}
    {data.scans && <ScanReview scans={data.scans} saved={() => setRefresh((value) => value + 1)} />}
    {data.coverage && <SourceCoverage coverage={data.coverage} open={open} />}
    {error && <p role="alert">{error}</p>}
    {data.status.failures.length > 0 && <details><summary>Collection and analysis failures ({data.status.failures.length})</summary><ul>{data.status.failures.map((job) => <li key={job.id}>{job.kind}: {job.last_error} · {job.attempts} attempt(s)</li>)}</ul></details>}
    <p><button onClick={() => setTab("findings")} aria-pressed={tab === "findings"}>Investigation leads ({findings.length})</button>{" "}<button onClick={() => setTab("observations")} aria-pressed={tab === "observations"}>Source observations ({observations.length})</button>{" "}<button onClick={() => setTab("sources")} aria-pressed={tab === "sources"}>Sources</button></p>
    {tab === "sources" ? <section aria-label="Source library">
      <form onSubmit={(event) => { event.preventDefault(); setPage(1); setSourceSearch(search); }}><label>Search source titles or URLs <input maxLength={200} value={search} onChange={(event) => setSearch(event.target.value)} /></label><button>Search sources</button></form>
      <p>{data.total_documents} matching source(s).</p>
      {data.documents.map((document) => <article className="card mixed" key={document.id}><h3>{document.title}</h3><p>{document.category} · {document.archived_snapshot ? `Archived snapshot from ${document.original_fetched_date || "unknown date"}` : "Live collection snapshot"}</p>{document.quality && !document.quality.analysis_ready && <p>{document.quality.note}</p>}<p><a href={document.url} target="_blank" rel="noopener noreferrer">Original source</a>{" · "}<button className="link" onClick={() => open(document.id)}>Read saved document</button></p></article>)}
      <button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous sources</button>{" "}<button disabled={page * 20 >= data.total_documents} onClick={() => setPage((value) => value + 1)}>Next sources</button>
    </section> : <section aria-label={tab === "observations" ? "Source observations" : "Investigation leads"}>
      <label>Filter by claim, topic or mechanism <input value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      <label>Department or office <select value={department} onChange={(event) => setDepartment(event.target.value)}><option value="">All recorded scopes</option><option value="unrecorded">Not recorded</option>{departments.map((name) => <option key={name} value={`unit:${name}`}>{name}</option>)}</select></label>
      {visible.length === 0 && <p>{tab === "findings" ? "No investigation leads in these reports. Source observations are available separately." : "No matching source observations."}</p>}
      {visible.map(({ record, finding }) => <FindingCard key={`${record.id}:${finding.id}`} reportId={record.id} finding={finding} reviews={data.reviews.filter((review) => review.report_id === record.id && review.finding_id === finding.id)} open={open} saved={() => setRefresh((value) => value + 1)} />)}
      <details><summary>Analysis coverage and rejected proposals</summary>{data.reports.map((record) => <div key={record.id}><p>Report {record.id}: {record.report.rejected_count} rejected proposal(s). Provider steps: {record.report.model_calls?.map((call) => `${call.provider}${call.fallback ? " (fallback)" : ""}${call.cached ? " (cached)" : ""}`).join(", ") || "not recorded"}.</p>{record.report.retrieval && <p>Related-source search: {record.report.retrieval.candidate_documents} distinct candidate document(s); {record.report.retrieval.matching_related_documents} matched, {record.report.retrieval.omitted_related_documents} omitted by the five-document limit. Identical-content copies collapsed: {record.report.retrieval.identical_content_collapsed}. {record.report.retrieval.limits}</p>}<ul>{record.report.coverage.map((coverage) => <li key={coverage.version_id}>Version {coverage.version_id}: {coverage.reviewed_characters} of {coverage.total_characters} characters supplied for review.</li>)}</ul></div>)}</details>
      <p className="muted">Showing up to {data.history_limits.reports} recent analysis reports and {data.history_limits.reviews} recent owner reviews. Leads remain subject to evidence and applicability review.</p>
    </section>}
    {sourceBusy && <p role="status">Loading saved passage…</p>}
    {source && <SourceViewer source={source} open={open} />}
  </>;
}
