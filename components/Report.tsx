"use client";

import { useState } from "react";
import type { AuditReport, Page, Passage } from "@/lib/types";

const STATUS_TEXT = {
  strong: "Strong",
  weak: "Weak",
  mixed: "Mixed / unclear",
  not_found: "Not found in this syllabus",
  not_assessed: "Not assessed",
} as const;

function Quote({ passage, pages }: { passage: Passage; pages: Page[] }) {
  const [open, setOpen] = useState(false);
  const text = pages.find((p) => p.pageNumber === passage.page)?.text ?? "";
  return (
    <blockquote className="quote">
      <p>&ldquo;{passage.text}&rdquo;</p>
      <span className="where">
        <span className="stamp">Verified</span>
        Page {passage.page}{" "}
        <button type="button" className="link noprint" onClick={() => setOpen(!open)}>
          {open ? "Hide context" : "See in context"}
        </button>
      </span>
      {open && (
        <pre className="context">
          {text.slice(Math.max(0, passage.start - 300), passage.start)}
          <mark>{text.slice(passage.start, passage.end)}</mark>
          {text.slice(passage.end, passage.end + 300)}
        </pre>
      )}
    </blockquote>
  );
}

export default function Report({ report, pages }: { report: AuditReport; pages: Page[] }) {
  const byId = new Map(report.passages.map((p) => [p.id, p]));
  const risk = report.biggestRiskIndex === null ? null : report.flags[report.biggestRiskIndex];

  return (
    <article className="report">
      <header>
        <h2>{report.fileName}</h2>
        <p className="muted">{report.pageCount} pages. This audit describes what the document says; it is not legal or academic advice.</p>
        {report.coverage.status === "partial" && (
          <p className="warn">Partial audit. Skipped: {report.coverage.skipped.join(", ")}.</p>
        )}
      </header>

      <section className="overall">
        <h3>Overall read</h3>
        <p className="big">{report.overall.label ?? "Overall read unavailable"}</p>
        <p className="muted">{report.overall.reason}</p>
        <p>
          <strong>Biggest risk: </strong>
          {risk ? `${risk.explanation} (page ${byId.get(risk.passageId)?.page})` : "No supported policy risk was identified in the assessed text."}
        </p>
      </section>

      <section>
        <h3>Five dimensions</h3>
        {report.dimensions.map((d) => {
          const hits = [...d.hits.filter((h) => h.polarity === 1).slice(0, 2), ...d.hits.filter((h) => h.polarity === -1).slice(0, 2)].slice(0, 3);
          return (
            <div key={d.dimension} className={`card ${d.status}`}>
              <h4>
                {d.title}: <span className="grade">{STATUS_TEXT[d.status]}</span>
              </h4>
              {d.hits.length > 0 && (
                <p className="muted">
                  {d.positive} supportive and {d.negative} burdensome signal{d.hits.length === 1 ? "" : "s"} found.
                </p>
              )}
              {hits.map((h) => (
                <div key={h.passageId}>
                  <p className="signal">{h.polarity === 1 ? "+" : "−"} {h.label}</p>
                  <Quote passage={byId.get(h.passageId)!} pages={pages} />
                  {h.pairedPassageId && <Quote passage={byId.get(h.pairedPassageId)!} pages={pages} />}
                  {h.evidence && (
                    <p className="muted">
                      Author bio ({h.evidence.author}): &ldquo;{h.evidence.quote}&rdquo;{" "}
                      <a href={h.evidence.url} target="_blank" rel="noopener noreferrer">source</a>
                    </p>
                  )}
                </div>
              ))}
              {d.status === "mixed" && d.hits.length > 0 && (
                <p className="muted">Mixed signals are shown as found; the audit does not decide which one governs.</p>
              )}
            </div>
          );
        })}
      </section>

      <section>
        <h3>Policy risks</h3>
        {report.flags.length === 0 && <p>No attendance, grade-weight or late-work risk was supported by the text.</p>}
        {report.flags.map((f, i) => (
          <div key={i} className={`card sev-${f.severity}`}>
            <h4>
              {f.kind === "weight" ? "Grade weight" : f.kind === "late" ? "Late work" : "Attendance"}:{" "}
              <span className="grade">{f.severity}</span>
            </h4>
            <p>{f.explanation}</p>
            <Quote passage={byId.get(f.passageId)!} pages={pages} />
          </div>
        ))}
      </section>

      <button type="button" className="noprint" onClick={() => window.print()}>
        Print or save this report
      </button>
    </article>
  );
}
