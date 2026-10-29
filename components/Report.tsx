"use client";

import { useState } from "react";
import FixKit from "@/components/FixKit";
import RequiredContents from "@/components/RequiredContents";
import type { CourseContext } from "@/lib/policy/contents-types";
import { findingsFromReport } from "@/lib/fixes";
import { DIMENSION_EXPLAINER } from "@/lib/rubric";
import { POLICY_TOPICS, TOPIC_LABEL, TOPIC_PLAIN, type Relation } from "@/lib/policy/types";
import type { AuditReport, Page, Passage } from "@/lib/types";

const STATUS_TEXT = {
  strong: "Strong",
  weak: "Weak",
  mixed: "Mixed / unclear",
  not_found: "Not found in this syllabus",
  not_assessed: "Not assessed",
} as const;

/** The rest of the sentence around a verified quote, so a cut-off fragment still reads. Display only. */
function sentenceAround(text: string, start: number, end: number): [string, string] {
  const before = text.slice(Math.max(0, start - 200), start);
  const cut = Math.max(before.lastIndexOf(". "), before.lastIndexOf("? "), before.lastIndexOf("! "), before.lastIndexOf("\n"));
  const after = text.slice(end, end + 200);
  const stop = after.search(/[.!?](\s|$)/);
  return [cut === -1 ? "" : before.slice(cut + 1).trimStart(), stop === -1 ? "" : after.slice(0, stop + 1)];
}

/** A short plain summary computed from the findings, so a new reader knows what to do first. */
function StartHere({ report }: { report: AuditReport }) {
  const asks = findingsFromReport(report);
  const differs = (report.policyCheck?.items ?? []).filter((i) => i.relation === "conflicts" || i.relation === "adds_requirement").length;
  return (
    <section className="start-here">
      <h3>Start here</h3>
      {asks.length === 0 ? (
        <p>No problems with a quote behind them were found. The sections below show what the syllabus does say.</p>
      ) : (
        <>
          <p>{asks.length} thing{asks.length === 1 ? "" : "s"} worth asking your instructor about. The first few:</p>
          <ul>{asks.slice(0, 3).map((f) => <li key={f.id}>{f.label}</li>)}</ul>
        </>
      )}
      {differs > 0 && <p>{differs} place{differs === 1 ? "" : "s"} where this syllabus differs from your school&rsquo;s written policy. See &ldquo;Against your school&rsquo;s own policies&rdquo; below.</p>}
      <p className="muted noprint">Questions to ask, messages you can send and suggested wording are in <a href="#fixes">What to do about it</a>, at the end.</p>
    </section>
  );
}

function Quote({ passage, pages }: { passage: Passage; pages: Page[] }) {
  const [open, setOpen] = useState(false);
  const text = pages.find((p) => p.pageNumber === passage.page)?.text ?? "";
  const [lead, trail] = sentenceAround(text, passage.start, passage.end);
  return (
    <blockquote className="quote">
      <p>
        &ldquo;{lead && <span className="muted">{lead} </span>}
        {passage.text}
        {trail && <span className="muted">{trail}</span>}&rdquo;
      </p>
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

const RELATION_PLAIN: Record<Relation, string> = {
  matches: "The syllabus agrees with the school's written rule.",
  conflicts: "The syllabus and the school's written rule say different things. You may want to ask the instructor which one applies to you.",
  adds_requirement: "The syllabus asks for something the school's rule does not, or sends you somewhere first. That may be fine, but check the school's rule below.",
  silent: "The syllabus does not mention this topic, but the school has a written rule about it.",
  disputed: "Two separate checks read this differently, so treat it as unclear and read both quotes yourself.",
};

const RELATION_TEXT: Record<Relation, string> = {
  matches: "Matches the school policy",
  conflicts: "Conflicts with the school policy",
  adds_requirement: "Adds a step the school policy does not require",
  silent: "Not stated in this syllabus",
  disputed: "Two checks read this differently, so no verdict is shown",
};

export interface PolicyProps {
  school: string | null;
  busy: boolean;
  error: string;
  onRun: () => void;
  contentsBusy?: boolean;
  contentsError?: string;
  onRunContents?: (context: CourseContext) => void;
}

export default function Report({ report, pages, policy }: { report: AuditReport; pages: Page[]; policy?: PolicyProps }) {
  const policySchool = policy?.school ?? report.policyCheck?.school;
  const byId = new Map(report.passages.map((p) => [p.id, p]));
  const risk = report.biggestRiskIndex === null ? null : report.flags[report.biggestRiskIndex];

  return (
    <article className="report">
      <header>
        <h2>{report.fileName}</h2>
        <p className="muted">{report.pageCount} pages. This audit describes what the document says; it is not legal or academic advice.</p>
        {report.modelNote && <p className="warn">{report.modelNote}</p>}
        {report.textSource === "ocr" && <p className="warn">This file was a scan. Its text was read from page images by OCR, so quotes may contain reading errors.</p>}
        {report.coverage.status === "partial" && (
          <p className="warn">Partial audit. Skipped: {report.coverage.skipped.join(", ")}.</p>
        )}
      </header>

      <StartHere report={report} />

      <section className="overall">
        <h3>Overall read</h3>
        <p className="big">{report.overall.label ?? "Overall read unavailable"}</p>
        <p className="muted">{report.overall.reason}</p>
        <p>
          <strong>Biggest risk among attendance, grade weight and late work: </strong>
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
                {d.title}: <span className="grade">{d.status === "not_found" && d.notes?.length ? "No supported signal" : d.status === "mixed" && (d.positive === 0 || d.negative === 0) ? "Limited evidence" : STATUS_TEXT[d.status]}</span>
              </h4>
              <p className="muted dim-explainer">{DIMENSION_EXPLAINER[d.dimension]}</p>
              {d.notes?.map((n) => <p key={n} className="muted">{n}</p>)}
              {d.hits.length > 0 && (
                <p className="muted">
                  {d.positive} supportive and {d.negative} burdensome signal{d.positive + d.negative === 1 ? "" : "s"} found.
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
              {d.status === "mixed" && d.positive > 0 && d.negative > 0 && (
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
            {(f.passageIds ?? [f.passageId]).map((id) => <Quote key={id} passage={byId.get(id)!} pages={pages} />)}
          </div>
        ))}
      </section>

      {policy && (
        <section>
          <h3>Against your school&rsquo;s own policies</h3>
          {!policySchool && <p className="muted">Sign in and add your school to compare this syllabus with its published policies.</p>}
          {policySchool && (!report.policyCheck || report.policyCheck.comparisonStatus === "not_run") && !policy.busy && (
            <>
              <p className="muted">The comparison with {policySchool}&rsquo;s written policies has not been run for this report.</p>
              <button type="button" className="noprint" onClick={policy.onRun}>Check against {policySchool}</button>
            </>
          )}
          {policy.busy && <p role="status">Looking up {policy.school}&rsquo;s published policies and comparing. The first time for a school can take a minute or two.</p>}
          {policy.error && <p role="alert" className="warn">{policy.error}</p>}
          {report.policyCheck && report.policyCheck.comparisonStatus !== "not_run" && report.policyCheck.items.length === 0 && (
            <p>No policies could be verified for {report.policyCheck.school}, so nothing was compared.</p>
          )}
          {report.policyCheck && report.policyCheck.comparisonStatus !== "not_run" && report.policyCheck.items.length > 0 && report.policyCheck.items.length < POLICY_TOPICS.length && (
            <p className="muted">Not compared this time (no verified quote): {POLICY_TOPICS.filter((t) => !report.policyCheck!.items.some((i) => i.topic === t)).map((t) => TOPIC_LABEL[t]).join(", ")}.</p>
          )}
          {report.policyCheck?.items.map((it) => (
            <div key={it.topic} className={`card ${it.relation === "matches" ? "strong" : (it.relation === "silent" || it.relation === "disputed") ? "mixed" : "sev-medium"}`}>
              <h4>{TOPIC_LABEL[it.topic]}: <span className="grade">{RELATION_TEXT[it.relation]}</span></h4>
              <p className="muted">{TOPIC_PLAIN[it.topic]}</p>
              <p><strong>What this means:</strong> {RELATION_PLAIN[it.relation]}</p>
              {it.syllabusQuote ? (
                <blockquote className="quote"><p>&ldquo;{it.syllabusQuote}&rdquo;</p><span className="where">This syllabus, page {it.syllabusPage}</span></blockquote>
              ) : (
                <p className="muted">Not found in this syllabus.</p>
              )}
              <blockquote className="quote"><p>&ldquo;{it.schoolQuote}&rdquo;</p><span className="where">{report.policyCheck!.school}: <a href={it.schoolUrl} target="_blank" rel="noopener noreferrer">official page</a></span></blockquote>
              {it.schoolProvenance && <p className="where">Reviewed document, PDF page {it.schoolProvenance.page}; image region {it.schoolProvenance.region.join(", ")}. Source extraction: {it.schoolProvenance.extractionMethod}. Reviewed {it.schoolProvenance.reviewedAt}.</p>}
            </div>
          ))}
        </section>
      )}

      {policy?.onRunContents && (policy.school ?? report.policyCheck?.school ?? "").trim().replace(/\s+/g, " ").toLowerCase() === "university of oregon" && (
        <RequiredContents result={report.policyCheck?.requiredContents} busy={policy.contentsBusy ?? false} error={policy.contentsError ?? ""} onRun={policy.onRunContents} />
      )}

      <FixKit report={report} />

      <button type="button" className="noprint" onClick={() => window.print()}>
        Print or save this report
      </button>
    </article>
  );
}
