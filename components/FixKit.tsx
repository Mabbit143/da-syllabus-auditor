"use client";

import { useState } from "react";
import { findingsFromReport, type FixKit as Kit } from "@/lib/fixes";
import type { AuditReport } from "@/lib/types";

export default function FixKit({ report }: { report: AuditReport }) {
  const findings = findingsFromReport(report);
  const [kits, setKits] = useState<Kit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (findings.length === 0) return null;

  async function generate() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/fixes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ findings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "The fixes failed.");
      setKits(data.kits);
    } catch (err) {
      console.error("[fixes] failed:", err);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h3>What to do about it</h3>
      {!kits && (
        <>
          <p className="muted">
            {findings.length} problem{findings.length === 1 ? "" : "s"} found. Get questions to ask, a message you can send, and
            clearer wording to suggest for each. It is based only on the quotes above and is not legal or academic advice.
          </p>
          <button type="button" className="noprint" onClick={generate} disabled={busy}>{busy ? "Writing…" : "Get fixes"}</button>
        </>
      )}
      {error && <p role="alert" className="warn">{error}</p>}
      {kits && kits.length === 0 && <p>No fixes could be written for these findings. Try again.</p>}
      {kits?.map((k) => {
        const f = findings.find((x) => x.id === k.id);
        if (!f) return null;
        return (
          <div key={k.id} className="card mixed">
            <h4>{f.label}</h4>
            {f.quote && <blockquote className="quote"><p>&ldquo;{f.quote}&rdquo;</p><span className="where">Page {f.page}</span></blockquote>}
            {k.questions.length > 0 && (
              <>
                <p className="signal">Questions to ask</p>
                <ul className="why">{k.questions.map((q) => <li key={q}>{q}</li>)}</ul>
              </>
            )}
            {k.request && (
              <>
                <p className="signal">A message you could send</p>
                <p className="draft">{k.request}</p>
              </>
            )}
            {k.rewrite && (
              <>
                <p className="signal">Wording to suggest to the instructor</p>
                {k.rewrite.original && <p className="muted">Now: &ldquo;{k.rewrite.original}&rdquo;</p>}
                <p className="draft">{k.rewrite.suggested}</p>
                {k.rewrite.why && <p className="muted">{k.rewrite.why}</p>}
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}
