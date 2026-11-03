"use client";

import { useState } from "react";
import { researchRequest } from "@/lib/research/client";
import type { ResearchOrigins, ResearchSynthesis } from "@/lib/research/types";

const labels = { same_origin: "Same originating record", different_origin: "Different origins (owner assessment)", unresolved: "Unresolved" };

export default function OriginReview({ synthesis, origins, open, saved }: {
  synthesis: ResearchSynthesis; origins: ResearchOrigins;
  open: (version: number, start: number) => void; saved: () => void;
}) {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [relation, setRelation] = useState<keyof typeof labels>("unresolved");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const evidence = synthesis.report.evidence;
  const first = evidence.find((item) => item.id === left);
  const second = evidence.find((item) => item.id === right);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(""); setMessage("");
    if (relation === "different_origin" && first && second && first.quote.replace(/\s+/g, " ").trim() === second.quote.replace(/\s+/g, " ").trim()) {
      setError("Identical passages cannot establish different origins. Record shared or unresolved origin instead."); return;
    }
    setBusy(true);
    try {
      await researchRequest("/api/research", { method: "POST", body: JSON.stringify({ action: "origin_review", synthesis_id: synthesis.id, left_id: left, right_id: right, relation, note }) });
      setNote(""); setMessage("Origin assessment saved. It does not certify independent support."); saved();
    } catch (error) { setError(error instanceof Error ? error.message : "Origin assessment could not be saved."); }
    finally { setBusy(false); }
  }
  return <section aria-label="Originating source review">
    <h2>Originating source review</h2>
    <p>{origins.limitations}</p>
    <p>No independent originating-lineage count has been established. {origins.same_origin_groups.length} owner-assessed shared-origin group(s). {origins.omitted_latest_pairs} latest pair assessment(s) omitted by the review limit.</p>
    {origins.conflicts.length > 0 && <p role="alert">{origins.conflicts.length} origin assessment conflict(s): a different-origin pair is connected through shared-origin assessments. Resolve the source relationship before relying on it.</p>}
    <details><summary>Compare and review two source passages</summary>
      <form onSubmit={submit}>
        <label>First passage <select required value={left} onChange={(event) => setLeft(event.target.value)}><option value="">Choose a passage</option>{evidence.map((item) => <option key={item.id} value={item.id}>{item.quote.slice(0, 110)}</option>)}</select></label>
        <label>Second passage <select required value={right} onChange={(event) => setRight(event.target.value)}><option value="">Choose a passage</option>{evidence.map((item) => <option key={item.id} value={item.id}>{item.quote.slice(0, 110)}</option>)}</select></label>
        {[first, second].map((item, index) => item && <blockquote className="quote" key={index}><p>{item.quote}</p><a href={item.url} target="_blank" rel="noopener noreferrer">Original source</a>{" · "}<button type="button" className="link" onClick={() => open(item.version_id, Math.max(0, item.start - 150))}>Read {index === 0 ? "first" : "second"} saved source</button></blockquote>)}
        <label>Origin assessment <select value={relation} onChange={(event) => setRelation(event.target.value as keyof typeof labels)}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Origin assessment reason <textarea required maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} /></label>
        <button disabled={busy || !left || !right || left === right || !note.trim()}>{busy ? "Saving…" : "Save origin assessment"}</button>
        {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
      </form>
    </details>
    <details><summary>Origin review history ({origins.history_total})</summary><p>Showing up to {origins.history_limit} reviews for passages in this saved analysis. Older receipts remain stored.</p><ul>{origins.history.map((review) => <li key={review.id}>{labels[review.relation]} · {new Date(review.created_at * 1000).toLocaleString()} · saved analysis {review.source_synthesis_id}<p>{review.note}</p><p>{[review.left_id, review.right_id].map((id) => {
      const source = evidence.find((item) => item.id === id);
      return source && <button type="button" className="link" key={id} onClick={() => open(source.version_id, Math.max(0, source.start - 150))}>{source.quote.slice(0, 100)}</button>;
    })}</p></li>)}</ul></details>
  </section>;
}
