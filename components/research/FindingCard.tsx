"use client";

import { useState } from "react";
import { researchRequest } from "@/lib/research/client";
import type { ResearchEvidence, ResearchFinding, ResearchReview } from "@/lib/research/types";

export default function FindingCard({ finding, reportId, reviews, open, saved }: { finding: ResearchFinding; reportId: number; reviews: ResearchReview[]; open: (version: number, start?: number) => void; saved: () => void }) {
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("reviewed");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function review(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      await researchRequest("/api/research", { method: "POST", body: JSON.stringify({ report_id: reportId, finding_id: finding.id, status, note }) });
      setNote(""); saved();
    } catch (error) { setError(error instanceof Error ? error.message : "Review could not be saved."); }
    finally { setBusy(false); }
  }
  const evidence = (item: ResearchEvidence, index: number) => <blockquote className="quote" key={`${item.version_id}:${item.start}:${index}`}>
    <p>{item.quote}</p>
    <p><a href={item.url} target="_blank" rel="noopener noreferrer">{item.role}{item.page ? ` · page ${item.page}` : " · web passage"}</a>{" · "}<button className="link" onClick={() => open(item.version_id, Math.max(0, item.start - 150))}>Read saved passage</button></p>
  </blockquote>;
  return <article className="card mixed">
    <h3>{finding.claim}</h3>
    <p>{finding.topic} · {finding.status.replaceAll("_", " ")}</p>
    <p>{finding.mechanism}</p>
    <p className="muted">{finding.temporal_scope} · {finding.distinct_documents} document(s), {finding.publisher_groups} publisher/content group(s). These groups do not establish independent confirmation.</p>
    {finding.evidence.map(evidence)}
    <details><summary>Skeptic review and counterevidence</summary>
      <p>{finding.skeptic.reason}</p><p>{finding.skeptic.counterevidence_search}</p><p>{finding.skeptic.temporal_scope}</p>
      {finding.skeptic.alternative_explanations.length > 0 && <ul>{finding.skeptic.alternative_explanations.map((text, index) => <li key={index}>{text}</li>)}</ul>}
      {finding.skeptic.counterevidence.map(evidence)}
    </details>
    {finding.questions.length > 0 && <details><summary>Questions to investigate</summary><ul>{finding.questions.map((text, index) => <li key={index}>{text}</li>)}</ul></details>}
    <form onSubmit={review}>
      <label>Review status <select value={status} onChange={(event) => setStatus(event.target.value)}><option value="reviewed">Reviewed</option><option value="follow_up">Follow up</option><option value="dismissed">Dismissed</option></select></label>
      <label>Review note <textarea required maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} /></label>
      <button disabled={busy || !note.trim()}>{busy ? "Saving…" : "Save review"}</button>
      {error && <p role="alert">{error}</p>}
    </form>
    {reviews.length > 0 && <details open><summary>Owner review history</summary><ul>{reviews.map((item) => <li key={item.id}>{item.status.replaceAll("_", " ")} · {new Date(item.created_at * 1000).toLocaleString()}<p>{item.note}</p></li>)}</ul></details>}
  </article>;
}
