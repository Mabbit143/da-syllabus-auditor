import type { ResearchSynthesis } from "@/lib/research/types";

export default function SynthesisSummary({ synthesis, open }: {
  synthesis: ResearchSynthesis;
  open: (version: number, start: number) => void;
}) {
  const report = synthesis.report;
  const citations = (ids: string[]) => ids.map((id) => {
    const evidence = report.evidence.find((item) => item.id === id);
    return evidence && <blockquote key={id}>
      <p>{evidence.quote}</p>
      <p>{evidence.role}{evidence.page ? ` · PDF page ${evidence.page}` : ` · ${evidence.source_locations?.map((location) => location.label).join("; ") || "saved text passage"}`}{" · "}
        <a href={evidence.url} target="_blank" rel="noopener noreferrer">Source</a>{" · "}
        <button onClick={() => open(evidence.version_id, Math.max(0, evidence.start - 300))}>Inspect synthesis citation</button>
      </p>
    </blockquote>;
  });
  const skeptic = (review: ResearchSynthesis["report"]["incidents"][number]["skeptic"]) => <details>
    <summary>Skeptic: {review.decision}</summary>
    <p>{review.reason}</p><p>Incident distinctions: {review.distinctness}</p>
    <p>Time and applicability: {review.temporal_scope}</p>
    {review.alternative_explanations.length > 0 && <><p>Alternative explanations</p><ul>{review.alternative_explanations.map((text, index) => <li key={index}>{text}</li>)}</ul></>}
    {citations(review.counterevidence_ids)}
  </details>;
  return <section aria-label="Cross-report investigation">
    <h2>Incident and pattern investigation</h2>
    <p>Analysis {synthesis.id} · {new Date(synthesis.completed_at * 1000).toLocaleString()} · {synthesis.input_current ? "Matches the current selected leads and owner reviews." : "Historical snapshot: selected leads or owner reviews have changed. A new analysis is needed."}</p>
    <p>{report.limitations}</p>
    {report.patterns.length === 0 && <p>No recurring-pattern proposal survived this analysis. This does not establish the absence of discrimination or inequality.</p>}
    {report.patterns.map((pattern) => <article key={pattern.id}>
      <h3>{pattern.claim}</h3>
      <p>{pattern.status} · {pattern.basis.replaceAll("_", " ")} · {pattern.kind.replaceAll("_", " ")}</p>
      <p>Proposed incidents: {pattern.incident_ids.join(", ")}. Independent originating lineages remain unverified. Private review lead.</p>
      <p>{pattern.temporal_scope}</p>
      {citations(pattern.policy_evidence_ids)}
      {skeptic(pattern.skeptic)}
      <ul>{pattern.questions.map((question, index) => <li key={index}>{question}</li>)}</ul>
    </article>)}
    <details><summary>Underlying incident proposals ({report.incidents.length})</summary>
      {report.incidents.map((incident) => <article key={incident.id}>
        <h3>{incident.id}: {incident.summary}</h3>
        <p>{incident.status} · {incident.basis === "allegation" ? "Attributed allegation; no outcome established" : `${incident.basis} described by the supplied record; interpretation requires review`} · {incident.mechanism_code.replaceAll("_", " ")}</p>
        <p>{incident.temporal_scope}</p><p>Proposed distinction: {incident.distinctness}</p>
        {citations(incident.evidence_ids)}
        {skeptic(incident.skeptic)}
        <p>Source leads: {incident.lead_ids.map((id) => {
          const lead = report.leads.find((item) => item.id === id);
          return lead ? `report ${lead.report_id}, lead ${lead.finding_id}` : id;
        }).join("; ")}. Record owner reviews on these leads below; dismissals remove them from future analyses.</p>
      </article>)}
    </details>
    <details><summary>Cross-report coverage</summary>
      <p>{report.coverage.note}</p>
      <p>{report.coverage.recent_reports} recent source report(s) considered · {report.coverage.omitted_leads} lead(s) omitted by input limits · {report.coverage.invalid_evidence_leads} lead(s) failed source-locator revalidation · {report.rejected_count} proposal(s) rejected.</p>
      <p>Provider steps: {report.model_calls?.map((call) => `${call.provider}${call.fallback ? " (fallback)" : ""}${call.cached ? " (cached)" : ""}`).join(", ") || "not recorded"}.</p>
    </details>
  </section>;
}
